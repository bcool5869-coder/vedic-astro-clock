// ─── Vedic Astrology Live Transit Calculator ───────────────────────────────
// astronomy-engine.js for planetary positions
// Lahiri ayanamsha, sidereal positions, D1 + D9 charts

const SIGNS = [
  "Aries","Taurus","Gemini","Cancer","Leo","Virgo",
  "Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"
];
const SIGN_GLYPHS = ["♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓"];
const NAKSHATRAS = [
  "Ashwini","Bharani","Krittika","Rohini","Mrigashira","Ardra",
  "Punarvasu","Pushya","Ashlesha","Magha","Purva Phalguni","Uttara Phalguni",
  "Hasta","Chitra","Swati","Vishakha","Anuradha","Jyeshtha",
  "Moola","Purva Ashadha","Uttara Ashadha","Shravana","Dhanishtha",
  "Shatabhisha","Purva Bhadrapada","Uttara Bhadrapada","Revati"
];
const PLANET_COLORS = {
  Sun:"#fbbf24", Moon:"#e2e8f0", Mercury:"#6ee7b7",
  Venus:"#f9a8d4", Mars:"#f87171", Jupiter:"#fb923c",
  Saturn:"#a78bfa", Rahu:"#94a3b8", Ketu:"#a8a29e",
  Uranus:"#67e8f9", Neptune:"#818cf8", Pluto:"#c084fc"
};
const PLANET_SYMBOLS = {
  Sun:"☉", Moon:"☽", Mercury:"☿", Venus:"♀", Mars:"♂",
  Jupiter:"♃", Saturn:"♄", Rahu:"☊", Ketu:"☋",
  Uranus:"⛢", Neptune:"♆", Pluto:"♇"
};
const PLANET_ORDER = [
  "Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn",
  "Rahu","Ketu","Uranus","Neptune","Pluto"
];

// ─── Math helpers ─────────────────────────────────────────────────────────

function norm360(a) { return ((a % 360) + 360) % 360; }
function degToRad(d) { return d * Math.PI / 180; }
function radToDeg(r) { return r * 180 / Math.PI; }
function getJD(date) { return date.getTime() / 86400000.0 + 2440587.5; }

// ─── Ayanamsha ─────────────────────────────────────────────────────────────
// Lahiri ayanamsha (accurate to ~0.01° for current century)
function getLahiriAyanamsha(jd) {
  const T = (jd - 2451545.0) / 36525.0;
  // Lahiri value at J2000.0 = 23.85014°, rate = 50.2388475" / yr
  return 23.85014 + (50.2388475 / 3600) * T * 100;
}

// ─── Ecliptic longitude from equatorial vector ─────────────────────────────
// Manual rotation: equatorial (J2000) → ecliptic → longitude
function eclipticLon(vec) {
  // Mean obliquity of ecliptic J2000: 23.43929111°
  const eps = degToRad(23.43929111);
  const xe = vec.x;
  const ye = vec.y * Math.cos(eps) + vec.z * Math.sin(eps);
  return norm360(radToDeg(Math.atan2(ye, xe)));
}

// ─── Planet tropical geocentric ecliptic longitude ────────────────────────
function getTropLon(body, date) {
  const vec = Astronomy.GeoVector(body, date, true); // aberration=true
  return eclipticLon(vec);
}

// ─── Moon's mean ascending node (Rahu) — tropical ─────────────────────────
function getRahuTropLon(date) {
  const jd = getJD(date);
  const T = (jd - 2451545.0) / 36525.0;
  // Mean longitude of ascending node
  return norm360(125.04452 - 1934.136261 * T + 0.0020708 * T * T);
}

// ─── Vedic sign, nakshatra, pada, navamsha ─────────────────────────────────
function getVedicData(sidLon) {
  const NAK = 360 / 27;
  const PADA = NAK / 4;
  const d1SignIdx = Math.floor(sidLon / 30) % 12;
  const nakIdx    = Math.floor(sidLon / NAK) % 27;
  const padaIdx   = Math.floor((sidLon % NAK) / PADA);
  const d9SignIdx = (nakIdx * 4 + padaIdx) % 12;
  return {
    d1SignIdx, d1Sign: SIGNS[d1SignIdx],
    deg: (sidLon % 30).toFixed(2),
    nakIdx, nakName: NAKSHATRAS[nakIdx],
    padaIdx, pada: padaIdx + 1,
    d9SignIdx, d9Sign: SIGNS[d9SignIdx]
  };
}

// ─── Retrograde detection (simple: compare lon 2 hrs apart) ───────────────
function isRetrograde(body, date) {
  try {
    const dt1 = new Date(date.getTime() - 3600000);
    const dt2 = new Date(date.getTime() + 3600000);
    const lon1 = getTropLon(body, dt1);
    const lon2 = getTropLon(body, dt2);
    let diff = lon2 - lon1;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    return diff < 0;
  } catch (e) { return false; }
}

// ─── Compute all planets ───────────────────────────────────────────────────
function getAllPlanets(date) {
  const jd = getJD(date);
  const aya = getLahiriAyanamsha(jd);
  const results = [];

  const bodies = [
    { name: "Sun",     body: Astronomy.Body.Sun,     noRetro: true },
    { name: "Moon",    body: Astronomy.Body.Moon,    noRetro: true },
    { name: "Mercury", body: Astronomy.Body.Mercury },
    { name: "Venus",   body: Astronomy.Body.Venus },
    { name: "Mars",    body: Astronomy.Body.Mars },
    { name: "Jupiter", body: Astronomy.Body.Jupiter },
    { name: "Saturn",  body: Astronomy.Body.Saturn },
    { name: "Uranus",  body: Astronomy.Body.Uranus },
    { name: "Neptune", body: Astronomy.Body.Neptune },
    { name: "Pluto",   body: Astronomy.Body.Pluto },
  ];

  for (const { name, body, noRetro } of bodies) {
    try {
      const tropLon = getTropLon(body, date);
      const sidLon  = norm360(tropLon - aya);
      const v = getVedicData(sidLon);
      const retro = noRetro ? false : isRetrograde(body, date);
      results.push({ name, sidLon, ...v, retro });
    } catch (e) {
      console.warn("Skipping", name, e.message);
    }
  }

  // Rahu (ascending node) & Ketu (descending node)
  const rahuTrop = getRahuTropLon(date);
  const rahuSid  = norm360(rahuTrop - aya);
  const ketuSid  = norm360(rahuSid + 180);

  for (const [pname, sid] of [["Rahu", rahuSid], ["Ketu", ketuSid]]) {
    const v = getVedicData(sid);
    results.push({ name: pname, sidLon: sid, ...v, retro: true }); // nodes always retrograde
  }

  // Sort by traditional order
  results.sort((a, b) => PLANET_ORDER.indexOf(a.name) - PLANET_ORDER.indexOf(b.name));
  return { planets: results, ayanamsha: aya };
}

// ─── SVG Wheel ─────────────────────────────────────────────────────────────
const CX = 150, CY = 150;
const R_OUTER  = 130;
const R_SIGN_I = 108;  // inner edge of sign ring
const R_PLANET = 82;   // planet orbit radius
const R_INNER  = 32;   // center hole

const NS = "http://www.w3.org/2000/svg";

function svgEl(tag, attrs, text) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
}

function polar(r, angleDeg) {
  const a = degToRad(angleDeg);
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
}

// Sign i starts at -90 + i*30 degrees (Aries at top, clockwise)
function signMidAngle(i) { return -90 + i * 30 + 15; }
function lonToAngle(lon)  { return -90 + lon; } // D1: exact placement

function arcPath(r1, r2, startA, endA) {
  const s1 = polar(r2, startA), s2 = polar(r2, endA);
  const s3 = polar(r1, endA),   s4 = polar(r1, startA);
  const large = (endA - startA > 180) ? 1 : 0;
  return `M${s1.x},${s1.y} A${r2},${r2} 0 ${large},1 ${s2.x},${s2.y} `
       + `L${s3.x},${s3.y} A${r1},${r1} 0 ${large},0 ${s4.x},${s4.y} Z`;
}

function buildWheel(svgEl2, planets, chartType) {
  while (svgEl2.firstChild) svgEl2.removeChild(svgEl2.firstChild);

  // Outer bg
  svgEl2.appendChild(svgEl("circle", { cx: CX, cy: CY, r: R_OUTER, fill: "#07071a", stroke: "#1e1e3a", "stroke-width": "1.5" }));

  // 12 sign segments
  for (let i = 0; i < 12; i++) {
    const sa = -90 + i * 30, ea = sa + 30;

    // Segment fill
    const fill = i % 2 === 0 ? "rgba(124,58,237,0.07)" : "rgba(168,85,247,0.03)";
    svgEl2.appendChild(svgEl("path", { d: arcPath(R_SIGN_I, R_OUTER, sa, ea), fill, stroke: "none" }));

    // Spoke line at start of each sign
    const p1 = polar(R_SIGN_I, sa), p2 = polar(R_OUTER, sa);
    svgEl2.appendChild(svgEl("line", { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, stroke: "#2a2a4a", "stroke-width": "0.8" }));

    // Sign glyph in middle of ring
    const gp = polar((R_SIGN_I + R_OUTER) / 2, signMidAngle(i));
    svgEl2.appendChild(svgEl("text", {
      x: gp.x, y: gp.y, fill: "#a855f7", "font-size": "13",
      "text-anchor": "middle", "dominant-baseline": "middle"
    }, SIGN_GLYPHS[i]));
  }

  // Inner circle + separator ring
  svgEl2.appendChild(svgEl("circle", { cx: CX, cy: CY, r: R_SIGN_I, fill: "none", stroke: "#1e1e3a", "stroke-width": "0.8" }));
  svgEl2.appendChild(svgEl("circle", { cx: CX, cy: CY, r: R_INNER, fill: "#07071a", stroke: "#1e1e3a", "stroke-width": "1" }));

  // Dashed orbit ring
  svgEl2.appendChild(svgEl("circle", {
    cx: CX, cy: CY, r: R_PLANET + 8, fill: "none",
    stroke: "#14142a", "stroke-width": "0.5", "stroke-dasharray": "2,4"
  }));

  // Center label
  svgEl2.appendChild(svgEl("text", {
    x: CX, y: CY, fill: "#a855f7", "font-size": "9", "font-weight": "600",
    "text-anchor": "middle", "dominant-baseline": "middle", "letter-spacing": "1"
  }, chartType));

  // ── Planets ──
  const signKey = chartType === "D9" ? "d9SignIdx" : "d1SignIdx";

  // Group planets by sign for overlap handling
  const groups = {};
  for (const p of planets) {
    const k = p[signKey];
    (groups[k] = groups[k] || []).push(p);
  }

  for (const [sIdx, group] of Object.entries(groups)) {
    const count = group.length;
    const spread = Math.min(22, 24 / count);

    group.forEach((p, i) => {
      const base = signMidAngle(parseInt(sIdx));
      const offset = (i - (count - 1) / 2) * spread;

      // D1: place by exact longitude; D9: spread within sign sector
      const angle = chartType === "D1"
        ? lonToAngle(p.sidLon) + (count > 1 ? offset * 0.3 : 0)
        : base + offset;

      const pos = polar(R_PLANET, angle);
      const col = PLANET_COLORS[p.name] || "#fff";

      svgEl2.appendChild(svgEl("circle", { cx: pos.x, cy: pos.y, r: "9", fill: col, opacity: "0.1" }));
      svgEl2.appendChild(svgEl("circle", { cx: pos.x, cy: pos.y, r: "5", fill: col, stroke: "#07071a", "stroke-width": "1.2" }));
      svgEl2.appendChild(svgEl("text", {
        x: pos.x, y: pos.y - 12,
        fill: col, "font-size": "8.5", "text-anchor": "middle", "dominant-baseline": "middle"
      }, PLANET_SYMBOLS[p.name] || p.name[0]));
    });
  }

  // Degree tick marks on outer edge
  for (let i = 0; i < 36; i++) {
    const a = -90 + i * 10;
    const isMaj = i % 3 === 0;
    const p1 = polar(R_OUTER - (isMaj ? 6 : 3), a);
    const p2 = polar(R_OUTER, a);
    svgEl2.appendChild(svgEl("line", {
      x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
      stroke: isMaj ? "#3a3a5c" : "#1e1e3a", "stroke-width": isMaj ? "1" : "0.5"
    }));
  }
}

// ─── Table ─────────────────────────────────────────────────────────────────
function updateTable(planets) {
  const tbody = document.getElementById("planet-tbody");
  tbody.innerHTML = "";
  for (const p of planets) {
    const col = PLANET_COLORS[p.name] || "#fff";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div class="planet-cell">
          <span class="planet-dot" style="background:${col}; box-shadow:0 0 6px ${col}55"></span>
          <span class="planet-name">${PLANET_SYMBOLS[p.name]} ${p.name}</span>
          ${p.retro ? '<span class="retro">℞</span>' : ""}
        </div>
      </td>
      <td><span class="sign-badge">${SIGN_GLYPHS[p.d1SignIdx]} ${p.d1Sign}</span></td>
      <td class="degrees">${p.deg}°</td>
      <td class="nakshatra">${p.nakName}</td>
      <td class="pada">${p.pada}</td>
      <td><span class="sign-badge" style="border-color:rgba(192,132,252,0.35);color:#c084fc">${SIGN_GLYPHS[p.d9SignIdx]} ${p.d9Sign}</span></td>
    `;
    tbody.appendChild(tr);
  }
}

// ─── Clock ─────────────────────────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  const opts = {
    weekday:"long", year:"numeric", month:"long", day:"numeric",
    hour:"2-digit", minute:"2-digit", second:"2-digit", timeZoneName:"short"
  };
  document.getElementById("clock").textContent = now.toLocaleString("en-IN", opts);
}

// ─── Main loop ─────────────────────────────────────────────────────────────
const svgD1 = document.getElementById("wheel-d1");
const svgD9 = document.getElementById("wheel-d9");

function update() {
  updateClock();
  try {
    const { planets } = getAllPlanets(new Date());
    buildWheel(svgD1, planets, "D1");
    buildWheel(svgD9, planets, "D9");
    updateTable(planets);
  } catch (e) {
    console.error("Astro error:", e);
  }
}

window.addEventListener("load", () => {
  update();
  setInterval(update, 1000);
});
