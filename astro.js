// ─── Vedic Astrology Live Transit Calculator ───────────────────────────────

const SIGNS = [
  "Aries","Taurus","Gemini","Cancer","Leo","Virgo",
  "Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"
];
const SIGN_SHORT = ["Ari","Tau","Gem","Can","Leo","Vir","Lib","Sco","Sag","Cap","Aqu","Pis"];
const NAKSHATRAS = [
  "Ashwini","Bharani","Krittika","Rohini","Mrigashira","Ardra",
  "Punarvasu","Pushya","Ashlesha","Magha","Purva Phalguni","Uttara Phalguni",
  "Hasta","Chitra","Swati","Vishakha","Anuradha","Jyeshtha",
  "Moola","Purva Ashadha","Uttara Ashadha","Shravana","Dhanishtha",
  "Shatabhisha","Purva Bhadrapada","Uttara Bhadrapada","Revati"
];
const PLANET_COLORS = {
  Sun:"#d97706", Moon:"#6b7280", Mercury:"#059669",
  Venus:"#db2777", Mars:"#dc2626", Jupiter:"#ea580c",
  Saturn:"#7c3aed", Rahu:"#1e40af", Ketu:"#92400e",
  Uranus:"#0891b2", Neptune:"#4f46e5", Pluto:"#7e22ce"
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
function decToDMS(dec) {
  const d = Math.floor(dec);
  const mFull = (dec - d) * 60;
  const m = Math.floor(mFull);
  const sFull = (mFull - m) * 60;
  const s = Math.floor(sFull);
  const ms = Math.floor((sFull - s) * 1000);
  return `${d}° ${String(m).padStart(2,'0')}' ${String(s).padStart(2,'0')}" ${String(ms).padStart(3,'0')}`;
}

function getVedicData(sidLon) {
  const NAK = 360/27, PADA = NAK/4;
  const d1SignIdx = Math.floor(sidLon / 30) % 12;
  const nakIdx    = Math.floor(sidLon / NAK) % 27;
  const padaIdx   = Math.floor((sidLon % NAK) / PADA);
  const degInSign = sidLon % 30;
  return {
    d1SignIdx, d1Sign: SIGNS[d1SignIdx],
    deg: degInSign.toFixed(2),
    degDMS: decToDMS(degInSign),
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

// ─── SVG Wheel — 600×600, planets OUTSIDE the ring with lines ─────────────
// Ring layout:
//   Sign ring:       220 → 178  (42px)
//   Nakshatra ring:  178 → 134  (44px)  numbers 1-27
//   Pada tick ring:  134 → 118  (16px)
//   Inner white:     118 → 0
//   Planet labels:   outside at ~258–300 with lines from 220

const CX = 300, CY = 300;
const R_SO = 220, R_SI = 178;    // sign outer/inner
const R_NO = 178, R_NI = 134;    // nakshatra outer/inner
const R_PDO = 134, R_PDI = 118;  // pada ring
const R_CTR = 44;                // center hole
const R_LABEL      = 262;        // label placement outside the wheel

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

function lonToAngle(lon)  { return -90 + lon; }
function signMidAngle(i)  { return lonToAngle(i*30 + 15); }
function nakMidAngle(i)   { return lonToAngle(i*(360/27) + (360/54)); }

const SIGN_COLORS = [
  "rgba(239,68,68,0.15)",  "rgba(34,197,94,0.12)",  "rgba(96,165,250,0.15)",  "rgba(167,139,250,0.14)",
  "rgba(239,68,68,0.10)",  "rgba(34,197,94,0.08)",  "rgba(96,165,250,0.10)",  "rgba(167,139,250,0.09)",
  "rgba(239,68,68,0.15)",  "rgba(34,197,94,0.12)",  "rgba(96,165,250,0.15)",  "rgba(167,139,250,0.14)"
];

// Spread overlapping label angles so they don't collide
function spreadAngles(items, minGap) {
  if (items.length <= 1) return items;
  // Sort by angle
  items.sort((a,b) => a.angle - b.angle);
  // Iterative push-apart
  for (let pass = 0; pass < 20; pass++) {
    let moved = false;
    for (let i = 1; i < items.length; i++) {
      let diff = items[i].labelAngle - items[i-1].labelAngle;
      // wrap
      if (diff < -180) diff += 360;
      if (diff < minGap) {
        const push = (minGap - diff) / 2;
        items[i-1].labelAngle -= push;
        items[i].labelAngle   += push;
        moved = true;
      }
    }
    // also check wrap-around (last vs first)
    let diff = (items[0].labelAngle + 360) - items[items.length-1].labelAngle;
    if (diff < minGap) {
      const push = (minGap - diff) / 2;
      items[items.length-1].labelAngle -= push;
      items[0].labelAngle              += push;
    }
    if (!moved) break;
  }
  return items;
}

function buildWheel(svgEl, planets, chartType) {
  while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);

  // White background for whole SVG area
  svgEl.appendChild(E("rect",{ x:0,y:0,width:600,height:600, fill:"#ffffff" }));

  // ── Outer background circle (white with border)
  svgEl.appendChild(E("circle",{cx:CX,cy:CY,r:R_SO, fill:"#ffffff",stroke:"#7c3aed","stroke-width":"1.5"}));

  // ════════ RING 1: SIGN RING (220 → 178) ════════
  for (let i = 0; i < 12; i++) {
    const sa = lonToAngle(i*30), ea = lonToAngle((i+1)*30);
    svgEl.appendChild(E("path",{ d:arcD(R_SI,R_SO,sa,ea), fill:SIGN_COLORS[i], stroke:"none" }));

    // spoke at boundary
    const p1=P(R_NI,sa), p2=P(R_SO,sa);
    svgEl.appendChild(E("line",{x1:p1.x,y1:p1.y,x2:p2.x,y2:p2.y,stroke:"#7c3aed","stroke-width":"1.2"}));

    // sign name — rotated to follow the ring arc
    const gp = P((R_SI+R_SO)/2, signMidAngle(i));
    const rot = signMidAngle(i) + 90; // tangent rotation
    svgEl.appendChild(E("text",{x:gp.x,y:gp.y,fill:"#5b21b6","font-size":"10","font-weight":"700",
      "text-anchor":"middle","dominant-baseline":"middle",
      transform:`rotate(${rot},${gp.x},${gp.y})`
    }, SIGN_SHORT[i]));
  }
  svgEl.appendChild(E("circle",{cx:CX,cy:CY,r:R_SI,fill:"none",stroke:"#7c3aed","stroke-width":"1.2"}));

  // ════════ RING 2: NAKSHATRA RING (178 → 134) ════════
  const NAK_DEG = 360/27;
  for (let i = 0; i < 27; i++) {
    const sa = lonToAngle(i*NAK_DEG), ea = lonToAngle((i+1)*NAK_DEG);
    const fill = i%2===0 ? "rgba(99,102,241,0.08)" : "rgba(139,92,246,0.04)";
    svgEl.appendChild(E("path",{ d:arcD(R_NI,R_NO,sa,ea), fill, stroke:"none" }));

    const p1=P(R_NI,sa), p2=P(R_NO,sa);
    svgEl.appendChild(E("line",{x1:p1.x,y1:p1.y,x2:p2.x,y2:p2.y,stroke:"#a78bfa","stroke-width":"0.7"}));

    const np = P((R_NI+R_NO)/2, nakMidAngle(i));
    svgEl.appendChild(E("text",{x:np.x,y:np.y,fill:"#1e1b4b","font-size":"10","font-weight":"700",
      "text-anchor":"middle","dominant-baseline":"middle"}, String(i+1)));
  }
  svgEl.appendChild(E("circle",{cx:CX,cy:CY,r:R_NI,fill:"none",stroke:"#a78bfa","stroke-width":"1"}));

  // ════════ RING 3: PADA TICKS (134 → 118) ════════
  svgEl.appendChild(E("circle",{cx:CX,cy:CY,r:R_PDO,fill:"none",stroke:"#000000","stroke-width":"0.7"}));
  svgEl.appendChild(E("circle",{cx:CX,cy:CY,r:R_PDI,fill:"none",stroke:"#000000","stroke-width":"0.7"}));
  for (let i = 0; i < 108; i++) {
    const a = lonToAngle(i*(360/108));
    const isNak = i%4===0, isSign = i%9===0;
    const p1=P(isNak ? R_PDI : R_PDI+5, a), p2=P(R_PDO,a);
    svgEl.appendChild(E("line",{x1:p1.x,y1:p1.y,x2:p2.x,y2:p2.y,
      stroke:"#000000",
      "stroke-width": isSign?"1.2": isNak?"0.8":"0.4"}));
  }

  // ── Inner white area
  svgEl.appendChild(E("circle",{cx:CX,cy:CY,r:R_PDI,fill:"#ffffff",stroke:"none"}));

  // ── Center
  svgEl.appendChild(E("circle",{cx:CX,cy:CY,r:R_CTR,fill:"#f5f3ff",stroke:"#7c3aed","stroke-width":"1.2"}));
  svgEl.appendChild(E("text",{x:CX,y:CY,fill:"#5b21b6","font-size":"12","font-weight":"800",
    "text-anchor":"middle","dominant-baseline":"middle","letter-spacing":"2"}, chartType));

  // ════════ PLANETS OUTSIDE WITH LINES ════════
  const sigKey = chartType==="D9" ? "d9SignIdx" : "d1SignIdx";

  // Build planet items with their angles
  const items = planets.map(p => {
    const angle = chartType==="D1"
      ? lonToAngle(p.sidLon)
      : signMidAngle(p[sigKey]);
    return { ...p, angle, labelAngle: angle };
  });

  // Spread labels so they don't overlap (min 8° apart)
  spreadAngles(items, 8);

  for (const item of items) {
    const col = PLANET_COLORS[item.name] || "#333";
    const abbr = PLANET_ABBR[item.name];

    // Line from center → label (passes through all rings like the reference)
    const labelPos = P(R_LABEL, item.labelAngle);
    svgEl.appendChild(E("line",{
      x1:CX, y1:CY,
      x2:labelPos.x, y2:labelPos.y,
      stroke:col, "stroke-width":"0.8", opacity:"0.5"
    }));

    // Planet abbreviation outside the wheel
    svgEl.appendChild(E("text",{
      x:labelPos.x, y:labelPos.y,
      fill:col, "font-size":"12", "font-weight":"700",
      "text-anchor":"middle","dominant-baseline":"middle"
    }, abbr + (item.retro?" ℞":"")));
  }
}

// ─── Table ─────────────────────────────────────────────────────────────────
function updateTable(planets) {
  const tbody = document.getElementById("planet-tbody");
  tbody.innerHTML = "";
  for (const p of planets) {
    const col = PLANET_COLORS[p.name]||"#333";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div class="planet-cell">
          <span class="planet-dot" style="background:${col};box-shadow:0 0 6px ${col}55"></span>
          <span class="planet-name">${PLANET_SYMBOLS[p.name]} ${p.name}</span>
          ${p.retro?'<span class="retro">℞</span>':""}
        </div>
      </td>
      <td><span class="sign-badge">${SIGN_SHORT[p.d1SignIdx]} ${p.d1Sign}</span></td>
      <td class="degrees">${p.degDMS}</td>
      <td class="nakshatra">${p.nakName}</td>
      <td class="pada">${p.pada}</td>
      <td><span class="sign-badge" style="border-color:rgba(124,58,237,0.35);color:#7c3aed">${SIGN_SHORT[p.d9SignIdx]} ${p.d9Sign}</span></td>
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
