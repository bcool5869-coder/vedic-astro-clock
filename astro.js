// ─── Vedic Astrology Live Transit Calculator ───────────────────────────────

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
const PLANET_ABBR = {
  Sun:"Su", Moon:"Mo", Mercury:"Me", Venus:"Ve", Mars:"Ma",
  Jupiter:"Ju", Saturn:"Sa", Rahu:"Ra", Ketu:"Ke",
  Uranus:"Ur", Neptune:"Ne", Pluto:"Pl"
};
const PLANET_ORDER = [
  "Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn",
  "Rahu","Ketu","Uranus","Neptune","Pluto"
];

// ─── Math ─────────────────────────────────────────────────────────────────
function norm360(a) { return ((a % 360) + 360) % 360; }
function d2r(d) { return d * Math.PI / 180; }
function r2d(r) { return r * 180 / Math.PI; }
function getJD(d) { return d.getTime() / 86400000.0 + 2440587.5; }

function getLahiriAyanamsha(jd) {
  const T = (jd - 2451545.0) / 36525.0;
  return 23.85014 + (50.2388475 / 3600) * T * 100;
}

function eclipticLon(vec) {
  const eps = d2r(23.43929111);
  const ye = vec.y * Math.cos(eps) + vec.z * Math.sin(eps);
  return norm360(r2d(Math.atan2(ye, vec.x)));
}

function getTropLon(body, date) {
  return eclipticLon(Astronomy.GeoVector(body, date, true));
}

function getRahuTropLon(date) {
  const T = (getJD(date) - 2451545.0) / 36525.0;
  return norm360(125.04452 - 1934.136261 * T + 0.0020708 * T * T);
}

function getVedicData(sidLon) {
  const NAK = 360/27, PADA = NAK/4;
  const d1SignIdx = Math.floor(sidLon / 30) % 12;
  const nakIdx    = Math.floor(sidLon / NAK) % 27;
  const padaIdx   = Math.floor((sidLon % NAK) / PADA);
  return {
    d1SignIdx, d1Sign: SIGNS[d1SignIdx],
    deg: (sidLon % 30).toFixed(2),
    nakIdx, nakName: NAKSHATRAS[nakIdx],
    padaIdx, pada: padaIdx + 1,
    d9SignIdx: (nakIdx * 4 + padaIdx) % 12,
    d9Sign: SIGNS[(nakIdx * 4 + padaIdx) % 12]
  };
}

function isRetrograde(body, date) {
  try {
    const l1 = getTropLon(body, new Date(date.getTime() - 3600000));
    const l2 = getTropLon(body, new Date(date.getTime() + 3600000));
    let d = l2 - l1;
    if (d > 180) d -= 360; if (d < -180) d += 360;
    return d < 0;
  } catch(e) { return false; }
}

function getAllPlanets(date) {
  const jd = getJD(date);
  const aya = getLahiriAyanamsha(jd);
  const results = [];
  const bodies = [
    { name:"Sun",     body:Astronomy.Body.Sun,     noRetro:true },
    { name:"Moon",    body:Astronomy.Body.Moon,    noRetro:true },
    { name:"Mercury", body:Astronomy.Body.Mercury },
    { name:"Venus",   body:Astronomy.Body.Venus },
    { name:"Mars",    body:Astronomy.Body.Mars },
    { name:"Jupiter", body:Astronomy.Body.Jupiter },
    { name:"Saturn",  body:Astronomy.Body.Saturn },
    { name:"Uranus",  body:Astronomy.Body.Uranus },
    { name:"Neptune", body:Astronomy.Body.Neptune },
    { name:"Pluto",   body:Astronomy.Body.Pluto },
  ];
  for (const { name, body, noRetro } of bodies) {
    try {
      const sidLon = norm360(getTropLon(body, date) - aya);
      results.push({ name, sidLon, ...getVedicData(sidLon), retro: noRetro ? false : isRetrograde(body, date) });
    } catch(e) { console.warn("Skip", name, e.message); }
  }
  const rahuSid = norm360(getRahuTropLon(date) - aya);
  const ketuSid = norm360(rahuSid + 180);
  for (const [n,s] of [["Rahu",rahuSid],["Ketu",ketuSid]]) {
    results.push({ name:n, sidLon:s, ...getVedicData(s), retro:true });
  }
  results.sort((a,b) => PLANET_ORDER.indexOf(a.name) - PLANET_ORDER.indexOf(b.name));
  return { planets: results };
}

// ─── SVG Wheel — 500×500 ───────────────────────────────────────────────────
// Ring layout (r values):
//   Sign ring:        240 → 195   (45px wide)
//   Nakshatra ring:   195 → 148   (47px wide)  ← numbers 1-27
//   Pada tick ring:   148 → 130   (18px, tick marks only)
//   Planet space:     ~100
//   Center hole:       48

const CX = 250, CY = 250;
const R_SO = 240, R_SI = 195;    // sign outer/inner
const R_NO = 195, R_NI = 148;    // nakshatra outer/inner
const R_PDO = 148, R_PDI = 130;  // pada outer/inner
const R_PLT = 100;               // planet placement
const R_CTR = 48;                // center

const NS = "http://www.w3.org/2000/svg";
function E(tag, attrs, text) {
  const e = document.createElementNS(NS, tag);
  for (const [k,v] of Object.entries(attrs)) e.setAttribute(k,v);
  if (text !== undefined) e.textContent = text;
  return e;
}
function P(r, aDeg) {
  const a = d2r(aDeg);
  return { x: CX + r*Math.cos(a), y: CY + r*Math.sin(a) };
}
function arcD(r1, r2, a1, a2) {
  const s1=P(r2,a1), s2=P(r2,a2), s3=P(r1,a2), s4=P(r1,a1);
  return `M${s1.x},${s1.y} A${r2},${r2} 0 0,1 ${s2.x},${s2.y} `
       + `L${s3.x},${s3.y} A${r1},${r1} 0 0,0 ${s4.x},${s4.y} Z`;
}

// Aries at top (−90°), clockwise
function lonToAngle(lon)   { return -90 + lon; }
function signMidAngle(i)   { return lonToAngle(i*30 + 15); }
function nakMidAngle(i)    { return lonToAngle(i*(360/27) + (360/54)); }

// Sign element colors (fire/earth/air/water cycling)
const SIGN_COLORS = [
  "rgba(239,68,68,0.15)",  "rgba(34,197,94,0.10)", "rgba(96,165,250,0.13)", "rgba(167,139,250,0.12)",
  "rgba(239,68,68,0.10)",  "rgba(34,197,94,0.08)", "rgba(96,165,250,0.10)", "rgba(167,139,250,0.09)",
  "rgba(239,68,68,0.13)",  "rgba(34,197,94,0.10)", "rgba(96,165,250,0.12)", "rgba(167,139,250,0.11)"
];
const NAK_COLORS = ["rgba(124,58,237,0.10)","rgba(168,85,247,0.05)"];

function buildWheel(svgEl, planets, chartType) {
  while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);

  // ── Outer background
  svgEl.appendChild(E("circle",{cx:CX,cy:CY,r:R_SO, fill:"#07071a",stroke:"#3a3a6a","stroke-width":"1.5"}));

  // ════════════════════════════════════════════════
  // RING 1: SIGN RING  (240 → 195)
  // ════════════════════════════════════════════════
  for (let i = 0; i < 12; i++) {
    const sa = lonToAngle(i*30), ea = lonToAngle((i+1)*30);

    // colored segment
    svgEl.appendChild(E("path",{ d:arcD(R_SI,R_SO,sa,ea), fill:SIGN_COLORS[i], stroke:"none" }));

    // boundary spokes (full height from nak ring to outer)
    const p1=P(R_NI,sa), p2=P(R_SO,sa);
    svgEl.appendChild(E("line",{ x1:p1.x,y1:p1.y, x2:p2.x,y2:p2.y,
      stroke:"#4a4a8a","stroke-width":"1.5" }));

    // sign glyph — larger
    const gp = P((R_SI+R_SO)/2, signMidAngle(i));
    svgEl.appendChild(E("text",{ x:gp.x,y:gp.y,
      fill:"#c084fc","font-size":"20","text-anchor":"middle","dominant-baseline":"middle"
    }, SIGN_GLYPHS[i]));
  }
  // Ring separator
  svgEl.appendChild(E("circle",{cx:CX,cy:CY,r:R_SI,fill:"none",stroke:"#4a4a8a","stroke-width":"1.2"}));

  // ════════════════════════════════════════════════
  // RING 2: NAKSHATRA RING  (195 → 148)
  // ════════════════════════════════════════════════
  const NAK_DEG = 360/27;
  for (let i = 0; i < 27; i++) {
    const sa = lonToAngle(i*NAK_DEG), ea = lonToAngle((i+1)*NAK_DEG);

    // alternating fill
    svgEl.appendChild(E("path",{ d:arcD(R_NI,R_NO,sa,ea),
      fill:NAK_COLORS[i%2], stroke:"none" }));

    // boundary spoke
    const p1=P(R_NI,sa), p2=P(R_NO,sa);
    svgEl.appendChild(E("line",{ x1:p1.x,y1:p1.y, x2:p2.x,y2:p2.y,
      stroke:"#2e2e6a","stroke-width":"0.8" }));

    // nakshatra number — bold and bright
    const np = P((R_NI+R_NO)/2, nakMidAngle(i));
    svgEl.appendChild(E("text",{ x:np.x,y:np.y,
      fill:"#93c5fd","font-size":"11","font-weight":"700",
      "text-anchor":"middle","dominant-baseline":"middle"
    }, String(i+1)));
  }
  svgEl.appendChild(E("circle",{cx:CX,cy:CY,r:R_NI,fill:"none",stroke:"#2e2e6a","stroke-width":"1"}));

  // ════════════════════════════════════════════════
  // RING 3: PADA TICK RING  (148 → 130)
  // ════════════════════════════════════════════════
  svgEl.appendChild(E("circle",{cx:CX,cy:CY,r:R_PDO,fill:"none",stroke:"#1e1e4a","stroke-width":"0.8"}));
  svgEl.appendChild(E("circle",{cx:CX,cy:CY,r:R_PDI,fill:"none",stroke:"#1e1e4a","stroke-width":"0.8"}));

  const PADA_DEG = 360/108;
  for (let i = 0; i < 108; i++) {
    const a = lonToAngle(i*PADA_DEG);
    const isNakBound  = i%4===0;
    const isSignBound = i%9===0;
    const r1 = isNakBound ? R_PDI : R_PDI + 6;
    const r2 = R_PDO;
    const p1=P(r1,a), p2=P(r2,a);
    svgEl.appendChild(E("line",{
      x1:p1.x,y1:p1.y, x2:p2.x,y2:p2.y,
      stroke: isSignBound ? "#5a5a9a" : isNakBound ? "#3a3a7a" : "#1e1e4a",
      "stroke-width": isNakBound ? "1" : "0.5"
    }));
  }

  // ── Inner background (planet area)
  svgEl.appendChild(E("circle",{cx:CX,cy:CY,r:R_PDI,fill:"#060614",stroke:"none"}));

  // Dashed orbit ring
  svgEl.appendChild(E("circle",{cx:CX,cy:CY,r:R_PLT+12,fill:"none",
    stroke:"#111130","stroke-width":"0.6","stroke-dasharray":"3,6"}));

  // ════════════════════════════════════════════════
  // CENTER
  // ════════════════════════════════════════════════
  svgEl.appendChild(E("circle",{cx:CX,cy:CY,r:R_CTR,fill:"#040410",stroke:"#3a3a6a","stroke-width":"1.2"}));
  svgEl.appendChild(E("text",{x:CX,y:CY,fill:"#a855f7","font-size":"13","font-weight":"800",
    "text-anchor":"middle","dominant-baseline":"middle","letter-spacing":"2"}, chartType));

  // ════════════════════════════════════════════════
  // PLANETS
  // ════════════════════════════════════════════════
  const sigKey = chartType==="D9" ? "d9SignIdx" : "d1SignIdx";
  const groups = {};
  for (const p of planets) {
    const k = p[sigKey];
    (groups[k] = groups[k]||[]).push(p);
  }

  for (const [sIdx, grp] of Object.entries(groups)) {
    const count = grp.length;
    const spread = Math.min(18, 20/count);

    grp.forEach((p, i) => {
      const base = signMidAngle(parseInt(sIdx));
      const offset = (i - (count-1)/2) * spread;
      const angle = chartType==="D1"
        ? lonToAngle(p.sidLon) + (count>1 ? offset*0.2 : 0)
        : base + offset;

      const pos = P(R_PLT, angle);
      const col = PLANET_COLORS[p.name] || "#fff";
      const abbr = PLANET_ABBR[p.name];

      // outer glow
      svgEl.appendChild(E("circle",{cx:pos.x,cy:pos.y,r:"13",fill:col,opacity:"0.12"}));
      // planet dot
      svgEl.appendChild(E("circle",{cx:pos.x,cy:pos.y,r:"6",fill:col,stroke:"#040410","stroke-width":"1.5"}));
      // planet symbol above dot
      svgEl.appendChild(E("text",{
        x:pos.x, y:pos.y-14,
        fill:col,"font-size":"9","font-weight":"700",
        "text-anchor":"middle","dominant-baseline":"middle"
      }, PLANET_SYMBOLS[p.name]));
      // abbreviation below dot
      svgEl.appendChild(E("text",{
        x:pos.x, y:pos.y+16,
        fill:col,"font-size":"8.5","font-weight":"600",
        "text-anchor":"middle","dominant-baseline":"middle"
      }, abbr + (p.retro?" ℞":"")));
    });
  }
}

// ─── Table ─────────────────────────────────────────────────────────────────
function updateTable(planets) {
  const tbody = document.getElementById("planet-tbody");
  tbody.innerHTML = "";
  for (const p of planets) {
    const col = PLANET_COLORS[p.name]||"#fff";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div class="planet-cell">
          <span class="planet-dot" style="background:${col};box-shadow:0 0 6px ${col}55"></span>
          <span class="planet-name">${PLANET_SYMBOLS[p.name]} ${p.name}</span>
          ${p.retro?'<span class="retro">℞</span>':""}
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
  document.getElementById("clock").textContent = new Date().toLocaleString("en-IN",{
    weekday:"long",year:"numeric",month:"long",day:"numeric",
    hour:"2-digit",minute:"2-digit",second:"2-digit",timeZoneName:"short"
  });
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
  } catch(e) { console.error("Astro error:", e); }
}

window.addEventListener("load", () => { update(); setInterval(update, 1000); });
