// Landscape parts for the iso kit: sun and shadows, paving joints, section strata,
// lobed canopies and shrubs, grass clumps and scale figures. World units are
// millimetres: x east, y north, z up.
// Every function here is self-contained apart from the kit's `iso`, `pathOf`,
// `cameraOf` and `depthOf`, so `landscapeScript()` can inline it after `kitScript()`.

import { iso, pathOf, cameraOf, depthOf } from "./iso-kit.mjs";

const DEG = Math.PI / 180;

// Deterministic noise so a build is repeatable.
export function seeded(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s = Math.imul(s ^ (s >>> 15), 2246822519) ^ Math.imul(s ^ (s >>> 13), 3266489917);
    s ^= s >>> 16;
    return (s >>> 0) / 4294967296;
  };
}

// Sun position for a latitude, a day of the year and a local solar hour.
// Returns altitude and azimuth in degrees (azimuth clockwise from north) and the
// unit vector toward the sun in world axes (x east, y north, z up).
export function sunAt(latitude, day, hour) {
  const decl = 23.44 * Math.sin(((360 / 365) * (day - 81)) * DEG) * DEG;
  const phi = latitude * DEG;
  const h = (hour - 12) * 15 * DEG;
  const sinAlt = Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(h);
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  const fromSouth = Math.atan2(Math.sin(h), Math.cos(h) * Math.sin(phi) - Math.tan(decl) * Math.cos(phi));
  const c = Math.cos(alt);
  const toward = [-Math.sin(fromSouth) * c, -Math.cos(fromSouth) * c, Math.sin(alt)];
  const azimuth = (((fromSouth / DEG) + 180) % 360 + 360) % 360;
  return { altitude: alt / DEG, azimuth, toward };
}

// Where a world point's shadow lands on the plane z = ground.
export function shadowPoint([x, y, z], toward, ground = 0) {
  const t = (z - ground) / Math.max(toward[2], 1e-3);
  return [x - toward[0] * t, y - toward[1] * t];
}

export function hull2(points) {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (sorted.length < 3) return sorted;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list) => {
    const out = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}

export function insidePolygon([x, y], poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Sample points that stand in for a caster's volume when it throws a shadow.
export function boxPoints(x0, y0, z0, x1, y1, z1) {
  const out = [];
  for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) out.push([x, y, z]);
  return out;
}
export function ellipsoidPoints([cx, cy, cz], [rx, ry, rz], rings = 7, around = 16) {
  const out = [];
  for (let i = 0; i <= rings; i++) {
    const v = -Math.PI / 2 + (Math.PI * i) / rings;
    for (let j = 0; j < around; j++) {
      const u = (Math.PI * 2 * j) / around;
      out.push([cx + rx * Math.cos(v) * Math.cos(u), cy + ry * Math.cos(v) * Math.sin(u), cz + rz * Math.sin(v)]);
    }
  }
  return out;
}

// Ground polygons (world x, y) for a list of casters, each a list of 3D points.
export function shadowsOf(casters, toward, ground = 0) {
  return casters.map((points) => hull2(points.map((p) => shadowPoint(p, toward, ground))));
}
// One path for all of them; same winding, so overlaps union instead of darkening.
export function shadowPath(polys, z, P) {
  return polys
    .filter((poly) => poly.length > 2)
    .map((poly) => pathOf(poly.map(([x, y]) => iso([x, y, z], P)), true))
    .join("");
}

// Clip a segment on the x or y axis against a list of [from, to] keep-out spans.
function cut(from, to, holes) {
  let runs = [[from, to]];
  for (const [a, b] of holes) {
    runs = runs.flatMap(([s, e]) => {
      if (b <= s || a >= e) return [[s, e]];
      const out = [];
      if (a > s) out.push([s, a]);
      if (b < e) out.push([b, e]);
      return out;
    });
  }
  return runs.filter(([s, e]) => e - s > 1);
}

// Joint lines for unit paving in a running bond, laid with the long side along x.
// `holes(row)` returns the [from, to] x spans to leave out of a course whose
// y range is [row.y0, row.y1] (a bed, a drain, a tree grate).
// Every joint runs edge to edge of its course, so every line ends on an edge.
export function pavingJoints({ x0, y0, x1, y1 }, { length = 600, width = 300, bond = 0.5 }, z, P, holes = () => []) {
  const long = [];
  const cross = [];
  let row = 0;
  for (let y = y0; y < y1 - 1; y += width, row++) {
    const course = { y0: y, y1: Math.min(y + width, y1) };
    const spans = cut(x0, x1, holes(course));
    if (y > y0) {
      for (const [s, e] of spans) long.push(pathOf([iso([s, y, z], P), iso([e, y, z], P)]));
    }
    const shift = (row % 2) * length * bond;
    for (let x = x0 + shift; x < x1; x += length) {
      if (x <= x0 + 1) continue;
      if (!spans.some(([s, e]) => x > s + 1 && x < e - 1)) continue;
      cross.push(pathOf([iso([x, course.y0, z], P), iso([x, course.y1, z], P)]));
    }
  }
  return { long: long.join(""), cross: cross.join("") };
}

// Textures for the two visible section faces of a ground layer, x = xMax and y = yMax.
// kind: "joints" (vertical lines at the given xs/ys), "fines" (small dots),
// "gravel" (dots), "stone" (small rings), "soil" (short level dashes).
export function strataTexture(kind, { x0, y0, x1, y1 }, zTop, zBot, P, { seed = 3, every = 600, xs, ys } = {}) {
  const rnd = seeded(seed);
  const faces = [
    { at: (u, z) => [x1, u, z], from: y0, to: y1, marks: ys },
    { at: (u, z) => [u, y1, z], from: x0, to: x1, marks: xs },
  ];
  const lines = [];
  const dots = [];
  const h = zTop - zBot;
  for (const face of faces) {
    const span = face.to - face.from;
    if (kind === "joints") {
      const marks = face.marks ?? Array.from({ length: Math.floor(span / every) }, (_, i) => face.from + (i + 1) * every);
      for (const u of marks) if (u > face.from + 1 && u < face.to - 1) lines.push(pathOf([iso(face.at(u, zTop), P), iso(face.at(u, zBot), P)]));
    } else if (kind === "soil") {
      const count = Math.round((span * h) / 90000);
      for (let i = 0; i < count; i++) {
        const u = face.from + 80 + rnd() * (span - 200);
        const z = zBot + 30 + rnd() * (h - 60);
        const w = 50 + rnd() * 70;
        lines.push(pathOf([iso(face.at(u, z), P), iso(face.at(u + w, z), P)]));
      }
    } else {
      const density = { fines: 1 / 9000, gravel: 1 / 14000, stone: 1 / 60000 }[kind] ?? 1 / 12000;
      const count = Math.round(span * h * density);
      const r = { fines: 5, gravel: 12, stone: 42 }[kind] ?? 10;
      for (let i = 0; i < count; i++) {
        const u = face.from + r + 6 + rnd() * (span - 2 * r - 12);
        const z = zBot + r + 4 + rnd() * Math.max(0, h - 2 * r - 8);
        if (kind === "stone") {
          const ring = Array.from({ length: 9 }, (_, k) => {
            const a = (k / 8) * Math.PI * 2;
            return iso(face.at(u + Math.cos(a) * r * (0.8 + 0.3 * rnd()), z + Math.sin(a) * r * 0.7), P);
          });
          lines.push(pathOf(ring, true));
        } else dots.push(iso(face.at(u, z), P));
      }
    }
  }
  return { lines: lines.join(""), dots };
}

// A lobed mass (a tree canopy or a shrub) as a cluster of spheres. Each sphere
// projects to a circle of radius r·k. Returns the circles in screen space, sorted
// back to front, and a centre for depth sorting.
export function lobesOf(centre, radius, P, { count = 7, spread = 0.55, squash = 0.75, size = [0.45, 0.62], seed = 5 } = {}) {
  const rnd = seeded(seed);
  const { k } = cameraOf(P);
  const [cx, cy, cz] = centre;
  const out = [{ c: [cx, cy, cz], r: radius * size[1] }];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rnd() * 0.6;
    const lift = (rnd() - 0.35) * radius * squash * 0.8;
    const reach = radius * spread * (0.75 + rnd() * 0.35);
    out.push({ c: [cx + Math.cos(a) * reach, cy + Math.sin(a) * reach, cz + lift], r: radius * (size[0] + rnd() * (size[1] - size[0])) });
  }
  return out
    .map((lobe) => ({ ...lobe, at: iso(lobe.c, P), screen: lobe.r * k, depth: depthOf(lobe.c, P) }))
    .sort((a, b) => a.depth - b.depth);
}

const circlePath = ([x, y], r) => `M${(x - r).toFixed(1)} ${y.toFixed(1)}a${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(2 * r).toFixed(1)} 0a${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(-2 * r).toFixed(1)} 0Z`;

// SVG for a lobed mass: the union outline (each lobe stroked underneath, then
// every fill on top), a shade crescent on the side away from the light and leaf
// stipple. `opacity` below 1 lets the space under a canopy read through it.
export function lobedSvg(lobes, { tone = "mid", opacity = 1, stipple = 0.5, seed = 9, className = "site-foliage" } = {}) {
  const rnd = seeded(seed);
  const rims = lobes.map((l) => circlePath(l.at, l.screen)).join("");
  // The whole mass takes the shade tone, then the same lobes nudged toward the
  // light cover it again in the leaf tone: what is left is one crescent of shade
  // on the far side of the mass, with no lines inside it.
  const lit = lobes.map((l) => circlePath([l.at[0] - l.screen * 0.2, l.at[1] - l.screen * 0.16], l.screen * 0.94)).join("");
  const dots = [];
  const ticks = [];
  for (const l of lobes) {
    const n = Math.round(l.screen * l.screen * stipple * 0.05);
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2;
      const d = Math.sqrt(rnd()) * l.screen * 0.86;
      const x = l.at[0] + Math.cos(a) * d;
      const y = l.at[1] + Math.sin(a) * d;
      const lean = Math.cos(a - 0.7);
      if (rnd() < 0.3 + 0.4 * Math.max(0, lean)) dots.push([x, y]);
      else if (rnd() < 0.25) ticks.push(`M${x.toFixed(1)} ${y.toFixed(1)}q1.2 -1 2.4 0`);
    }
  }
  const dotSvg = dots.map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="0.45"/>`).join("");
  const id = `site-clip-${seed}`;
  return `<g class="${className}" data-tone="${tone}"${opacity < 1 ? ` opacity="${opacity}"` : ""}>` +
    `<clipPath id="${id}"><path d="${rims}"/></clipPath>` +
    `<path class="site-foliage-rim" d="${rims}"/>` +
    `<path class="site-foliage-shadeside" d="${rims}"/>` +
    `<path class="site-foliage-fill" clip-path="url(#${id})" d="${lit}"/>` +
    `<path class="site-foliage-tick" d="${ticks.join("")}"/>` +
    `<g class="site-foliage-dots">${dotSvg}</g></g>`;
}

// A grass clump: blades fan out from a base and arch over.
export function grassClump([x, y, z], P, { height = 500, blades = 11, spread = 260, seed = 7 } = {}) {
  const rnd = seeded(seed);
  const out = [];
  for (let i = 0; i < blades; i++) {
    const a = rnd() * Math.PI * 2;
    const reach = spread * (0.35 + rnd() * 0.65);
    const h = height * (0.65 + rnd() * 0.45);
    const base = iso([x + Math.cos(a) * 30, y + Math.sin(a) * 30, z], P);
    const mid = iso([x + Math.cos(a) * reach * 0.35, y + Math.sin(a) * reach * 0.35, z + h * 0.85], P);
    const tip = iso([x + Math.cos(a) * reach, y + Math.sin(a) * reach, z + h * 0.7], P);
    out.push(`M${base[0].toFixed(1)} ${base[1].toFixed(1)}Q${mid[0].toFixed(1)} ${mid[1].toFixed(1)} ${tip[0].toFixed(1)} ${tip[1].toFixed(1)}`);
  }
  return out.join("");
}

// Ground stipple (mulch, decomposed granite) inside a rectangle on a plane.
export function stipple({ x0, y0, x1, y1 }, z, P, { every = 120, seed = 11, inset = 40 } = {}) {
  const rnd = seeded(seed);
  const count = Math.round(((x1 - x0) * (y1 - y0)) / (every * every));
  return Array.from({ length: count }, () => iso([x0 + inset + rnd() * (x1 - x0 - 2 * inset), y0 + inset + rnd() * (y1 - y0 - 2 * inset), z], P));
}

export const sphereSvg = (centre, r, P, extra = "") => {
  const { k } = cameraOf(P);
  return `<path class="site-head"${extra} d="${circlePath(iso(centre, P), r * k)}"/>`;
};

// Height and proportions of scale figures, in millimetres.
export const FIGURE = { height: 1750, eye: 1620, seat: 450, shoulder: 400, hip: 340, knee: 500 };

// The shadow-casting volume of a standing or seated person.
export function personPoints([x, y], { pose = "stand", facing = 0, z = 0 } = {}) {
  const c = Math.cos(facing), s = Math.sin(facing);
  const at = (u, v, h) => [x + u * c - v * s, y + u * s + v * c, z + h];
  if (pose === "sit") return [at(-120, -180, 450), at(-120, 180, 450), at(400, -180, 450), at(400, 180, 450), at(-150, -200, 1250), at(-150, 200, 1250), at(-60, 0, 1330), at(400, -120, 0), at(400, 120, 0)];
  return [at(-110, -200, 0), at(110, 200, 0), at(-110, -200, 1450), at(110, 200, 1450), at(0, 0, FIGURE.height)];
}

// Styles for the landscape layers; put them in a <style> beside ISO_CSS.
export const SITE_CSS = `
.iso{--site-shadow:#000;--site-shadow-opacity:.42;--site-leaf:#1a1d19;--site-leaf-shade:#121411}
.iso[data-theme="light"]{--site-shadow:#5f6158;--site-shadow-opacity:.2;--site-leaf:#fbfbfa;--site-leaf-shade:#e9eae5}
.site-shadow{fill:var(--site-shadow);opacity:var(--site-shadow-opacity);stroke:none}
.site-foliage-rim{fill:none;stroke-width:1.3px;vector-effect:non-scaling-stroke}
.site-foliage-fill{fill:var(--site-leaf);stroke:none}
.site-foliage-shadeside{fill:var(--site-leaf-shade);stroke:none}
.site-foliage-tick{fill:none;stroke-width:.6px;vector-effect:non-scaling-stroke}
.site-foliage[data-tone="mid"] .site-foliage-rim,.site-foliage[data-tone="mid"] .site-foliage-tick{stroke:var(--anatomy-mid)}
.site-foliage[data-tone="lo"] .site-foliage-rim,.site-foliage[data-tone="lo"] .site-foliage-tick{stroke:var(--anatomy-lo)}
.site-foliage[data-tone="hi"] .site-foliage-rim,.site-foliage[data-tone="hi"] .site-foliage-tick{stroke:var(--anatomy-hi)}
.site-foliage-dots{fill:var(--anatomy-mid)}
.site-foliage[data-tone="lo"] .site-foliage-dots{fill:var(--anatomy-lo)}
.site-head{fill:var(--anatomy-top);stroke:var(--anatomy-mid);stroke-width:var(--anatomy-weight);vector-effect:non-scaling-stroke}
.site-blade{fill:none}
`;
