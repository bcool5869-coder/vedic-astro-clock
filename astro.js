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
function getJD(date) { return date.getTime() / 86400000.0 + 2440587.5; }

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
  const NAK = 360 / 27, PADA = NAK / 4;
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
      const v = getVedicData(sidLon);
      results.push({ name, sidLon, ...v, retro: noRetro ? false : isRetrograde(body, date) });
    } catch(e) { console.warn("Skip", name, e.message); }
  }
  const rahuSid = norm360(getRahuTropLon(date) - aya);
  const ketuSid = norm360(rahuSid + 180);
  for (const [n, s] of [["Rahu",rahuSid],["Ketu",ketuSid]]) {
    results.push({ name:n, sidLon:s, ...getVedicData(s), retro:true });
  }
  results.sort((a,b) => PLANET_ORDER.indexOf(a.name) - PLANET_ORDER.indexOf(b.name));
  return { planets: results, ayanamsha: aya };
}

// ─── SVG Wheel ─────────────────────────────────────────────────────────────
// 400×400 SVG, 5 concentric rings:
//   Sign ring (outer):   R 188 → 158
//   Nakshatra ring:      R 158 → 128
//   Pada tick ring:      R 128 → 114   (just tick marks, no fill band)
//   Planet orbit:        R ~88
//   Center hole:         R 40

const CX = 200, CY = 200;
const R_SO = 188, R_SI = 158;   // sign ring outer/inner
const R_NO = 158, R_NI = 128;   // nakshatra ring outer/inner
const R_PI_O = 128, R_PI_I = 114; // pada inner ring
const R_PLT = 88;                // planet radius
const R_CTR = 40;                // center hole

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
  const lg = (a2-a1 > 180) ? 1 : 0;
  return `M${s1.x},${s1.y} A${r2},${r2} 0 ${lg},1 ${s2.x},${s2.y} `
       + `L${s3.x},${s3.y} A${r1},${r1} 0 ${lg},0 ${s4.x},${s4.y} Z`;
}

// Aries (lon=0) at top (-90°), clockwise
function lonToAngle(lon)  { return -90 + lon; }
function signMid(i)       { return lonToAngle(i * 30 + 15); }
function nakMid(i)        { return lonToAngle(i * (360/27) + (360/54)); }

function buildWheel(svgEl, planets, chartType) {
  while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);

  // ── Background
  svgEl.appendChild(E("circle",{ cx:CX,cy:CY,r:R_SO, fill:"#07071a", stroke:"#2a2a4a","stroke-width":"1.5" }));

  // ── SIGN RING (outermost) ──────────────────────────────────────────────
  for (let i = 0; i < 12; i++) {
    const sa = lonToAngle(i*30), ea = lonToAngle((i+1)*30);
    const fills = ["rgba(220,38,38,0.12)","rgba(239,68,68,0.06)",    // fire
                   "rgba(34,197,94,0.10)","rgba(34,197,94,0.05)",    // earth
                   "rgba(96,165,250,0.12)","rgba(96,165,250,0.06)",  // air
                   "rgba(167,139,250,0.10)","rgba(167,139,250,0.05)",// water
                   "rgba(251,191,36,0.10)","rgba(251,191,36,0.05)",
                   "rgba(96,165,250,0.10)","rgba(96,165,250,0.05)"];
    svgEl.appendChild(E("path",{ d:arcD(R_SI,R_SO,sa,ea), fill:fills[i], stroke:"none" }));

    // spoke at sign boundary
    const p1=P(R_NI,sa), p2=P(R_SO,sa);
    svgEl.appendChild(E("line",{ x1:p1.x,y1:p1.y,x2:p2.x,y2:p2.y, stroke:"#3a3a6a","stroke-width":"1.2" }));

    // sign glyph
    const gp = P((R_SI+R_SO)/2, signMid(i));
    svgEl.appendChild(E("text",{ x:gp.x,y:gp.y, fill:"#a855f7","font-size":"16",
      "text-anchor":"middle","dominant-baseline":"middle" }, SIGN_GLYPHS[i]));
  }
  svgEl.appendChild(E("circle",{ cx:CX,cy:CY,r:R_SI, fill:"none",stroke:"#3a3a6a","stroke-width":"1" }));

  // ── NAKSHATRA RING ─────────────────────────────────────────────────────
  const NAK_DEG = 360/27;
  for (let i = 0; i < 27; i++) {
    const sa = lonToAngle(i*NAK_DEG), ea = lonToAngle((i+1)*NAK_DEG);
    const fill = i%2===0 ? "rgba(124,58,237,0.08)" : "rgba(168,85,247,0.04)";
    svgEl.appendChild(E("path",{ d:arcD(R_NI,R_NO,sa,ea), fill, stroke:"none" }));

    // nakshatra boundary spoke
    const p1=P(R_NI,sa), p2=P(R_NO,sa);
    svgEl.appendChild(E("line",{ x1:p1.x,y1:p1.y,x2:p2.x,y2:p2.y, stroke:"#2a2a5a","stroke-width":"0.7" }));

    // nakshatra number (1-27) in middle of segment
    const np = P((R_NI+R_NO)/2, nakMid(i));
    svgEl.appendChild(E("text",{ x:np.x,y:np.y, fill:"#7c9cbf","font-size":"8",
      "text-anchor":"middle","dominant-baseline":"middle","font-weight":"600" }, String(i+1)));
  }
  svgEl.appendChild(E("circle",{ cx:CX,cy:CY,r:R_NI, fill:"none",stroke:"#2a2a5a","stroke-width":"0.8" }));

  // ── PADA RING (108 divisions = 3.333° each) ────────────────────────────
  svgEl.appendChild(E("circle",{ cx:CX,cy:CY,r:R_PI_O, fill:"none",stroke:"#1e1e3a","stroke-width":"0.5" }));
  svgEl.appendChild(E("circle",{ cx:CX,cy:CY,r:R_PI_I, fill:"none",stroke:"#1e1e3a","stroke-width":"0.5" }));

  const PADA_DEG = 360/108;
  for (let i = 0; i < 108; i++) {
    const a = lonToAngle(i*PADA_DEG);
    const isNakBound = i%4===0;
    const isSignBound = i%9===0;
    const r1 = R_PI_I + (isNakBound ? 0 : 4);
    const r2 = R_PI_O;
    const p1=P(r1,a), p2=P(r2,a);
    svgEl.appendChild(E("line",{
      x1:p1.x,y1:p1.y, x2:p2.x,y2:p2.y,
      stroke: isSignBound?"#4a4a7a": isNakBound?"#2e2e5a":"#1a1a38",
      "stroke-width": isNakBound?"0.8":"0.5"
    }));
  }

  // ── INNER AREA background
  svgEl.appendChild(E("circle",{ cx:CX,cy:CY,r:R_PI_I, fill:"#07071a", stroke:"none" }));

  // Dashed orbit ring
  svgEl.appendChild(E("circle",{ cx:CX,cy:CY,r:R_PLT+10, fill:"none",
    stroke:"#12122a","stroke-width":"0.5","stroke-dasharray":"2,5" }));

  // ── CENTER ──────────────────────────────────────────────────────────────
  svgEl.appendChild(E("circle",{ cx:CX,cy:CY,r:R_CTR, fill:"#050510",stroke:"#2a2a4a","stroke-width":"1" }));
  svgEl.appendChild(E("text",{ x:CX,y:CY, fill:"#a855f7","font-size":"10","font-weight":"700",
    "text-anchor":"middle","dominant-baseline":"middle","letter-spacing":"1.5" }, chartType));

  // ── PLANETS ────────────────────────────────────────────────────────────
  const sigKey = chartType==="D9" ? "d9SignIdx" : "d1SignIdx";
  const groups = {};
  for (const p of planets) {
    const k = p[sigKey];
    (groups[k] = groups[k]||[]).push(p);
  }

  for (const [sIdx, grp] of Object.entries(groups)) {
    const count = grp.length;
    const spread = Math.min(20, 22/count);

    grp.forEach((p, i) => {
      const base = signMid(parseInt(sIdx));
      const offset = (i - (count-1)/2) * spread;
      const angle = chartType==="D1"
        ? lonToAngle(p.sidLon) + (count>1 ? offset*0.25 : 0)
        : base + offset;

      const pos = P(R_PLT, angle);
      const col = PLANET_COLORS[p.name] || "#fff";
      const abbr = PLANET_ABBR[p.name] || p.name.slice(0,2);

      // glow
      svgEl.appendChild(E("circle",{ cx:pos.x,cy:pos.y,r:"11", fill:col,opacity:"0.1" }));
      // dot
      svgEl.appendChild(E("circle",{ cx:pos.x,cy:pos.y,r:"5.5", fill:col,stroke:"#05050f","stroke-width":"1.5" }));
      // planet abbreviation (like the reference: Su, Mo, Ma, etc.)
      svgEl.appendChild(E("text",{
        x:pos.x, y:pos.y+15,
        fill:col,"font-size":"8.5","font-weight":"600",
        "text-anchor":"middle","dominant-baseline":"middle",
        "letter-spacing":"0.3"
      }, abbr + (p.retro ? " ℞" : "")));
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
  const now = new Date();
  document.getElementById("clock").textContent = now.toLocaleString("en-IN",{
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
