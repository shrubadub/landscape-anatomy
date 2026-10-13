import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../kit/iso-kit.mjs";
import * as s from "../../kit/landscape.mjs";
import * as G from "../../kit/lathe.mjs";
import { kitScript, landscapeScript } from "../../scripts/inline-kit.mjs";

// A pocket plaza seen as a sectional axo: a tree in a raised bed with a seat wall,
// a timber bench on unit paving, and the paving build-up cut open at the front.
// Moving the sun through June 21 at 49.3° N moves every shadow, and the readout
// gives the share of the bench seat in shade. World units are millimetres:
// x east, y north, z up.

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 640;
const HEIGHT = 470;

const LATITUDE = 49.3;
const DAY = 172;
const HOURS = [7, 19];

const SITE = { x0: 0, y0: 0, x1: 6000, y1: 4000 };
const FIELD = { x0: 0, y0: 0, x1: 5900, y1: 3900 };
const HEADER = 100;
const LAYERS = [
  { top: -460, bot: -900, kind: "soil", tone: "lo", seed: 21 },
  { top: -260, bot: -460, kind: "stone", tone: "lo", seed: 22 },
  { top: -110, bot: -260, kind: "gravel", tone: "lo", seed: 23 },
  { top: -80, bot: -110, kind: "fines", tone: "lo", seed: 24 },
  { top: 0, bot: -80, kind: "joints", tone: "mid", seed: 25 },
];
const PAVER = { length: 600, width: 300, bond: 0.5 };

const BED = { x0: 0, y0: 0, x1: 2900, y1: 2100 };
const WALL_T = 300;
const WALL_H = 420;
const COPING = 30;
const SOIL_Z = 330;
const SEAT_Z = 450;

const DRAIN = { x0: 300, x1: 5600, y0: 3300, y1: 3600 };

const TREE = [1350, 1000];
const TRUNK_TOP = 2800;
const CANOPY = { c: [1350, 1000, 4500], r: [2300, 2300, 1700] };

const BENCH = { x0: 3500, x1: 5300, y0: 1250, y1: 1700, z: 410, top: SEAT_Z };
const BENCH_LEGS = [3720, 5080];
const SLATS = 5;

const POLE = [5550, 550];
const POLE_H = 4500;

const SEATED = { at: [3950, 1475], face: [0, 1] };
const STANDING = { at: [3150, 3000], face: [1, 0] };

const PLAQUE = [5250, 2650];

const P = k.fitProjection(
  [...k.boxCorners({ x: SITE.x0, y: SITE.y0, w: SITE.x1, d: SITE.y1 }, -900, 0), [TREE[0], TREE[1], 6400], [POLE[0], POLE[1], POLE_H + 100]],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: 45 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const box = (x0, y0, x1, y1, r = 0) => ({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r });
const slab = (x0, y0, x1, y1, z0, z1, style = { tone: "mid" }, r = 0, bevel = 0) => S(k.slabOf(box(x0, y0, x1, y1, r), z0, z1 - z0, P, 4, bevel), style);
const depth = (x, y, z = 0) => k.depthOf([x, y, z], P);

// ---------------------------------------------------------------- ground
const holes = (course) => {
  const out = [];
  if (course.y0 < BED.y1) out.push([BED.x0, BED.x1]);
  if (course.y0 < DRAIN.y1 && course.y1 > DRAIN.y0) out.push([DRAIN.x0, DRAIN.x1]);
  return out;
};

function ground() {
  const plan = box(SITE.x0, SITE.y0, SITE.x1, SITE.y1);
  const out = [`<path class="iso-halo" d="${k.haloOf(plan, -900, 900, P)}"/>`];
  for (const layer of LAYERS) {
    out.push(S(k.slabOf(plan, layer.bot, layer.top - layer.bot, P, 1), { tone: "mid", crease: layer.top === 0 ? "faint" : "none" }));
    if (layer.kind === "joints") continue;
    const tex = s.strataTexture(layer.kind, SITE, layer.top, layer.bot, P, { seed: layer.seed });
    if (tex.lines) out.push(L(tex.lines, { tone: layer.tone, free: true }));
    if (tex.dots.length) out.push(D(tex.dots, { size: layer.kind === "fines" ? 0.35 : 0.6, tone: layer.tone }));
  }
  // Layer seams run round both cut faces and end on the outline.
  for (const layer of LAYERS.slice(0, -1)) {
    out.push(L(k.pathOf([at([SITE.x1, SITE.y0, layer.top]), at([SITE.x1, SITE.y1, layer.top]), at([SITE.x0, SITE.y1, layer.top])]), { tone: "mid" }));
  }
  // The concrete headers carry the cut on the paving layer, so draw them now.
  out.push(slab(FIELD.x1, SITE.y0, SITE.x1, SITE.y1, -200, 0, { tone: "mid" }));
  out.push(slab(SITE.x0, FIELD.y1, FIELD.x1, SITE.y1, -200, 0, { tone: "mid" }));
  return out.join("");
}

function paving() {
  const out = [];
  const joints = s.pavingJoints(FIELD, PAVER, 0, P, holes);
  out.push(L(joints.long, { tone: "lo" }), L(joints.cross, { tone: "lo" }));
  // Header edges and the scale on the front header: 100 mm ticks, a major every metre.
  out.push(L(k.pathOf([at([FIELD.x1, SITE.y0, 0]), at([FIELD.x1, FIELD.y1, 0]), at([SITE.x0, FIELD.y1, 0])]), { tone: "mid" }));
  const ticks = k.topTicks(300, 3300, 100, 10, FIELD.y1 + 12, 0, [22, 50], P, "x");
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "hi" }));
  out.push(D([300, 3300].map((x) => at([x, FIELD.y1 + 80, 0])), { size: 0.45, tone: "mid" }));
  return out.join("");
}

function drain() {
  const out = [];
  out.push(S(k.slabOf(box(DRAIN.x0, DRAIN.y0, DRAIN.x1, DRAIN.y1), -40, 40, P, 1), { tone: "mid", flat: true }));
  const inner = { x0: DRAIN.x0 + 30, x1: DRAIN.x1 - 30, y0: DRAIN.y0 + 70, y1: DRAIN.y1 - 70 };
  out.push(L(k.planOutline(box(inner.x0, inner.y0, inner.x1, inner.y1), 0, P, 1), { tone: "mid" }));
  const bars = [];
  for (let x = inner.x0 + 40; x < inner.x1 - 20; x += 40) bars.push(k.lineOnTop([x, inner.y0], [x, inner.y1], 0, P));
  out.push(L(bars.join(""), { tone: "lo" }));
  // Grate locking bolts every 1 m.
  const bolts = [];
  for (let x = inner.x0 + 500; x < inner.x1; x += 1000) bolts.push(at([x, DRAIN.y0 + 35, 0]), at([x, DRAIN.y1 - 35, 0]));
  out.push(D(bolts, { size: 0.4, tone: "mid" }));
  return out.join("");
}

function plaque() {
  const [x, y] = PLAQUE;
  const out = [];
  out.push(S(k.cylinder(x, y, 170, -20, 20, P, 40), { tone: "mid", flat: true }));
  out.push(L(k.ring(x, y, 140, 0, P, 40), { tone: "lo" }));
  const arrow = [[x, y + 120], [x + 45, y - 60], [x, y - 25], [x - 45, y - 60]];
  out.push(`<path class="iso-line" data-tone="hi" style="fill:var(--anatomy-hi)" d="${k.pathOf(arrow.map(([u, v]) => at([u, v, 0])), true)}"/>`);
  out.push(k.faceTextSvg(k.topMatrix([x + 70, y - 70], 0, P, "x"), "N", { size: 70, tone: "mid" }));
  return out.join("");
}

// ---------------------------------------------------------------- bed
const WALLS = {
  back: [BED.x0, BED.y0, BED.x1 - WALL_T, BED.y0 + WALL_T],
  left: [BED.x0, BED.y0 + WALL_T, BED.x0 + WALL_T, BED.y1 - WALL_T],
  right: [BED.x1 - WALL_T, BED.y0, BED.x1, BED.y1 - WALL_T],
  front: [BED.x0, BED.y1 - WALL_T, BED.x1, BED.y1],
};

function wall(name) {
  const [x0, y0, x1, y1] = WALLS[name];
  const out = [];
  out.push(slab(x0, y0, x1, y1, 0, WALL_H, { tone: "mid" }));
  if (name === "front") {
    // Timber seat on the front wall: slats on two steel flats.
    out.push(slab(x0 + 20, y0 + 20, x1 - 20, y1 - 20, WALL_H, WALL_H + 6, { tone: "lo", crease: "none" }));
    const w = (WALL_T - 20 - 4 * 12) / 5;
    for (let i = 0; i < 5; i++) {
      const sy = y0 + 10 + i * (w + 12);
      out.push(slab(x0 + 10, sy, x1 - 10, sy + w, WALL_H + 6, SEAT_Z + 20, { tone: "mid" }, 6, 1));
      const screws = [];
      for (let sx = x0 + 300; sx < x1 - 100; sx += 900) screws.push(at([sx, sy + w / 2, SEAT_Z + 20]));
      out.push(D(screws, { size: 0.35, tone: "lo" }));
    }
  } else {
    out.push(slab(x0 - (name === "left" ? 0 : 0), y0, x1, y1, WALL_H, WALL_H + COPING, { tone: "mid" }, 0, 0));
    // Coping joints every 1.2 m run across the coping, edge to edge.
    const along = x1 - x0 > y1 - y0;
    const joints = [];
    if (along) for (let x = x0 + 1200; x < x1 - 100; x += 1200) joints.push(k.lineOnTop([x, y0], [x, y1], WALL_H + COPING, P));
    else for (let y = y0 + 1200; y < y1 - 100; y += 1200) joints.push(k.lineOnTop([x0, y], [x1, y], WALL_H + COPING, P));
    out.push(L(joints.join(""), { tone: "lo" }));
  }
  return out.join("");
}

function soil() {
  const x0 = BED.x0 + WALL_T, y0 = BED.y0 + WALL_T, x1 = BED.x1 - WALL_T, y1 = BED.y1 - WALL_T;
  const out = [S(k.slabOf(box(x0, y0, x1, y1), 0, SOIL_Z, P, 1), { tone: "lo", flat: true })];
  out.push(D(s.stipple({ x0, y0, x1, y1 }, SOIL_Z, P, { every: 95, seed: 41 }), { size: 0.35, tone: "lo" }));
  return out.join("");
}

const SHRUBS = [
  { c: [700, 650], r: 430, seed: 51 },
  { c: [2200, 620], r: 380, seed: 52 },
  { c: [620, 1500], r: 360, seed: 53 },
];
const GRASSES = [
  [1950, 1350, 61], [2250, 1500, 62], [1700, 1550, 63], [1050, 1550, 64], [2300, 1100, 65], [500, 1050, 66], [900, 400, 67], [1650, 450, 68],
];

function bedItems() {
  const items = [];
  for (const shrub of SHRUBS) {
    const centre = [shrub.c[0], shrub.c[1], SOIL_Z + shrub.r * 0.45];
    const lobes = s.lobesOf(centre, shrub.r, P, { count: 5, spread: 0.5, squash: 0.4, size: [0.5, 0.7], seed: shrub.seed });
    items.push({ depth: depth(shrub.c[0], shrub.c[1]), svg: s.lobedSvg(lobes, { tone: "mid", stipple: 0.7, seed: shrub.seed }) });
  }
  for (const [x, y, seed] of GRASSES) {
    items.push({ depth: depth(x, y), svg: L(s.grassClump([x, y, SOIL_Z], P, { height: 520, blades: 13, spread: 300, seed }), { tone: "mid", free: true, className: "site-blade" }) });
  }
  items.push({ depth: depth(TREE[0], TREE[1]), svg: tree() });
  return items.sort((a, b) => a.depth - b.depth).map((item) => item.svg).join("");
}

function tree() {
  const [x, y] = TREE;
  const out = [];
  // Tree pit edge: a steel ring in the mulch.
  out.push(L(k.ring(x, y, 420, SOIL_Z, P, 40), { tone: "lo" }));
  // One turned trunk: a root flare that eases into a slow taper.
  const rise = TRUNK_TOP - SOIL_Z;
  const F = G.frameOf([x, y, SOIL_Z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  out.push(S(G.solidOf([[0, 290], [60, 240, 1], [220, 200, 1], [rise, 150]], F, P), { tone: "mid", crease: "none" }));
  // Bark: fissures on the lit side that fade in and out.
  const bark = [];
  for (const a of [2.0, 2.35, 2.7, 3.05]) {
    const r = 190 - a * 4;
    const points = [0, 1, 2, 3, 4].map((i) => at([x + Math.cos(a) * (r - i * 6), y + Math.sin(a) * (r - i * 6), SOIL_Z + 300 + a * 90 + i * 260]));
    bark.push(k.fadeLineSvg(points, { fade: [120, 120], tone: "lo" }));
  }
  out.push(bark.join(""));
  // Scaffold branches leave the top of the trunk as tapered limbs into the crown.
  const scaffold = [[-900, -500, 4100], [800, -700, 4300], [700, 800, 4000], [-700, 700, 4400]];
  const limbs = scaffold
    .map(([dx, dy, z]) => {
      const from = [x, y, TRUNK_TOP - 250];
      const dir = [dx, dy, z - from[2]];
      const len = Math.hypot(...dir);
      const Fb = G.frameAlong(from, dir.map((v) => v / len));
      return { depth: depth(x + dx / 2, y + dy / 2, z), svg: S(G.solidOf([[0, 110], [len, 40]], Fb, P), { tone: "mid", crease: "none" }) };
    })
    .sort((a, b) => a.depth - b.depth);
  out.push(...limbs.map((l) => l.svg));
  const lobes = s.lobesOf(CANOPY.c, CANOPY.r[0], P, { count: 8, spread: 0.55, squash: 0.7, size: [0.42, 0.58], seed: 71 });
  out.push(s.lobedSvg(lobes, { tone: "mid", opacity: 0.9, stipple: 0.45, seed: 71 }));
  return out.join("");
}

// ---------------------------------------------------------------- things on the paving
function bench() {
  const out = [];
  const foot = (x) => {
    out.push(slab(x - 70, BENCH.y0 + 30, x + 70, BENCH.y1 - 30, 0, 12, { tone: "lo" }));
    out.push(D([at([x - 40, BENCH.y0 + 60, 12]), at([x + 40, BENCH.y1 - 60, 12])], { size: 0.35, tone: "mid" }));
    out.push(slab(x - 30, BENCH.y0 + 40, x + 30, BENCH.y1 - 40, 12, BENCH.z - 30, { tone: "mid" }));
    out.push(slab(x - 40, BENCH.y0 + 10, x + 40, BENCH.y1 - 10, BENCH.z - 30, BENCH.z, { tone: "mid" }));
  };
  for (const x of BENCH_LEGS) foot(x);
  const gap = 12;
  const w = (BENCH.y1 - BENCH.y0 - gap * (SLATS - 1)) / SLATS;
  // One lit seat; the slat gaps are grooves that run end to end.
  out.push(slab(BENCH.x0, BENCH.y0, BENCH.x1, BENCH.y1, BENCH.z, BENCH.top, { tone: "hi", lit: true }, 10, 1.5));
  const grooves = [];
  for (let i = 1; i < SLATS; i++) {
    const y = BENCH.y0 + i * (w + gap) - gap / 2;
    grooves.push(k.lineOnTop([BENCH.x0 + 4, y], [BENCH.x1 - 4, y], BENCH.top, P));
  }
  out.push(L(grooves.join(""), { tone: "mid" }));
  const screws = [];
  for (let i = 0; i < SLATS; i++) for (const x of BENCH_LEGS) screws.push(at([x, BENCH.y0 + i * (w + gap) + w / 2, BENCH.top]));
  out.push(D(screws, { size: 0.35, tone: "mid" }));
  return out.join("");
}

// Scale figures as solids. `face` is a unit axis vector the figure looks along.
function person({ at: [x, y], face }, pose) {
  const [fx, fy] = face;
  const sx = -fy, sy = fx;
  const plan = (cx, cy, along, across, r) => {
    const w = Math.abs(fx) * along + Math.abs(sx) * across;
    const d = Math.abs(fy) * along + Math.abs(sy) * across;
    return { x: cx - w / 2, y: cy - d / 2, w, d, r };
  };
  const off = (u, v) => [x + fx * u + sx * v, y + fy * u + sy * v];
  const parts = [];
  const add = (point, svg) => parts.push({ depth: depth(point[0], point[1], point[2] ?? 0), svg });
  if (pose === "stand") {
    for (const v of [-95, 95]) {
      const [lx, ly] = off(0, v);
      add([lx, ly, 0], S(k.cylinder(lx, ly, 62, 0, 820, P, 18), { tone: "mid", crease: "none" }));
    }
    const torso = plan(x, y, 220, 380, 100);
    const body = S(k.slabOf(torso, 820, 610, P, 6), { tone: "mid" });
    for (const v of [-235, 235]) {
      const [ax, ay] = off(10, v);
      add([ax, ay, 820], S(k.cylinder(ax, ay, 45, 860, 540, P, 14), { tone: "mid", crease: "none" }));
    }
    const sorted = parts.sort((a, b) => a.depth - b.depth);
    const [far, near] = sorted.slice(-2).sort((a, b) => a.depth - b.depth);
    const legs = sorted.slice(0, -2);
    return [...legs.map((p) => p.svg), far.svg, body, near.svg, S(k.cylinder(x, y, 48, 1430, 70, P, 14), { tone: "mid", crease: "none" }), s.sphereSvg([x, y, 1620], 115, P)].join("");
  }
  // Seated on the bench seat.
  const thighs = plan(...off(110, 0), 460, 340, 60);
  const seatSvg = S(k.slabOf(thighs, SEAT_Z, 140, P, 6), { tone: "mid" });
  const shins = [-85, 85].map((v) => {
    const [lx, ly] = off(330, v);
    return { depth: depth(lx, ly), svg: S(k.cylinder(lx, ly, 55, 0, SEAT_Z + 80, P, 16), { tone: "mid", crease: "none" }) };
  });
  const [tx, ty] = off(-60, 0);
  const torso = plan(tx, ty, 220, 370, 100);
  const body = S(k.slabOf(torso, SEAT_Z + 140, 600, P, 6), { tone: "mid" });
  const arms = [-225, 225].map((v) => {
    const [ax, ay] = off(30, v);
    return { depth: depth(ax, ay), svg: S(k.cylinder(ax, ay, 42, SEAT_Z + 200, 520, P, 14), { tone: "mid", crease: "none" }) };
  }).sort((a, b) => a.depth - b.depth);
  return [seatSvg, arms[0].svg, body, arms[1].svg, S(k.cylinder(tx, ty, 46, SEAT_Z + 740, 60, P, 14), { tone: "mid", crease: "none" }), s.sphereSvg([tx, ty, SEAT_Z + 920], 112, P), ...shins.sort((a, b) => a.depth - b.depth).map((p) => p.svg)].join("");
}

function pole() {
  const [x, y] = POLE;
  const out = [];
  out.push(slab(x - 180, y - 180, x + 180, y + 180, 0, 20, { tone: "lo" }, 20));
  out.push(D(k.corners(box(x - 180, y - 180, x + 180, y + 180), 45).map(([u, v]) => at([u, v, 20])), { size: 0.4, tone: "mid" }));
  out.push(S(k.cylinder(x, y, 95, 20, 380, P, 24), { tone: "mid" }));
  out.push(L(k.sideArc(x, y, 95, 300, P, 16), { tone: "lo" }));
  out.push(S(k.cylinder(x, y, 60, 400, POLE_H - 400, P, 20), { tone: "mid", crease: "none" }));
  out.push(S(k.slabOf(box(x - 520, y - 90, x + 40, y + 90, 40), POLE_H - 40, 80, P, 6, 2), { tone: "mid" }));
  out.push(S(k.cylinder(x - 400, y, 70, POLE_H - 90, 50, P, 20), { tone: "mid" }));
  return out.join("");
}

// ---------------------------------------------------------------- shadows
const mm = (points) => points.map((point) => point.map((v) => Math.round(v * 10) / 10));
const CASTERS = [
  s.ellipsoidPoints(CANOPY.c, CANOPY.r),
  s.boxPoints(TREE[0] - 160, TREE[1] - 160, SOIL_Z, TREE[0] + 160, TREE[1] + 160, TRUNK_TOP),
  ...Object.values(WALLS).map(([x0, y0, x1, y1]) => s.boxPoints(x0, y0, 0, x1, y1, SEAT_Z)),
  s.boxPoints(BENCH.x0, BENCH.y0, BENCH.z, BENCH.x1, BENCH.y1, BENCH.top),
  ...BENCH_LEGS.map((x) => s.boxPoints(x - 40, BENCH.y0 + 10, 0, x + 40, BENCH.y1 - 10, BENCH.z)),
  s.boxPoints(POLE[0] - 60, POLE[1] - 60, 0, POLE[0] + 60, POLE[1] + 60, POLE_H),
  s.boxPoints(POLE[0] - 520, POLE[1] - 90, POLE_H - 40, POLE[0] + 40, POLE[1] + 90, POLE_H + 40),
  s.personPoints(SEATED.at, { pose: "sit", facing: Math.atan2(SEATED.face[1], SEATED.face[0]) }),
  s.personPoints(STANDING.at, { pose: "stand", facing: Math.atan2(STANDING.face[1], STANDING.face[0]) }),
].map(mm);
// What can shade the seat: the crown, the trunk and the light.
const OVER_SEAT = [0, 1, CASTERS.length - 4, CASTERS.length - 3];
const SEAT_SAMPLES = [];
for (let i = 0; i < 18; i++) for (let j = 0; j < 4; j++) SEAT_SAMPLES.push([Math.round(BENCH.x0 + 50 + (i * (BENCH.x1 - BENCH.x0 - 100)) / 17), Math.round(BENCH.y0 + 40 + (j * (BENCH.y1 - BENCH.y0 - 80)) / 3)]);

function shadeAt(hour) {
  const sun = s.sunAt(LATITUDE, DAY, hour);
  const polys = s.shadowsOf(CASTERS, sun.toward, 0);
  const onSeat = s.shadowsOf(OVER_SEAT.map((i) => CASTERS[i]), sun.toward, BENCH.top);
  const shaded = SEAT_SAMPLES.filter((p) => onSeat.some((poly) => s.insidePolygon(p, poly))).length / SEAT_SAMPLES.length;
  return { sun, polys, shaded };
}

const clock = (hour) => {
  const h = Math.floor(hour), m = Math.round((hour - h) * 60);
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
};
const readoutOf = (hour, shade) => `Jun 21 · ${clock(hour)} · sun ${Math.round(shade.sun.altitude)}° · bench ${Math.round(shade.shaded * 100)}% in shade`;

const START = 14;
const first = shadeAt(START);
const clipId = "site-top";
const siteTop = k.pathOf([[SITE.x0, SITE.y0], [SITE.x1, SITE.y0], [SITE.x1, SITE.y1], [SITE.x0, SITE.y1]].map(([x, y]) => at([x, y, 0])), true);

const outside = [
  { depth: depth((BENCH.x0 + BENCH.x1) / 2, BENCH.y0), svg: bench() + person(SEATED, "sit") },
  { depth: depth(...STANDING.at), svg: person(STANDING, "stand") },
  { depth: depth(...POLE), svg: pole() },
].sort((a, b) => a.depth - b.depth);

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A pocket plaza drawn as a sectional axonometric. Unit pavers in a running bond sit on bedding sand, a crushed base and a subbase, cut open at the front edge. A tree grows in a raised bed edged by a seat wall with a timber top; a backless bench, a light pole, a trench drain and two people stand on the paving. Shadows follow the sun through June 21 at 49° north.",
  body: [
    `<defs><clipPath id="${clipId}"><path d="${siteTop}"/></clipPath></defs>`,
    ground(),
    paving(),
    drain(),
    plaque(),
    `<path data-part="shadow" class="site-shadow" clip-path="url(#${clipId})" d="${s.shadowPath(first.polys, 0, P)}"/>`,
    wall("back"),
    wall("left"),
    soil(),
    bedItems(),
    wall("right"),
    wall("front"),
    ...outside.map((item) => item.svg),
  ],
});

const live = `
const P = ${JSON.stringify(P)};
const CASTERS = ${JSON.stringify(CASTERS)};
const OVER_SEAT = ${JSON.stringify(OVER_SEAT)};
const SEAT_SAMPLES = ${JSON.stringify(SEAT_SAMPLES)};
const LATITUDE = ${LATITUDE}, DAY = ${DAY}, SEAT_TOP = ${BENCH.top};
const HOURS = ${JSON.stringify(HOURS)};
const s = { sunAt, shadowsOf, insidePolygon, shadowPath };
const BENCH = { top: SEAT_TOP };
${shadeAt.toString()}
const clock = ${clock.toString()};
const readoutOf = ${readoutOf.toString()};
const stage = document.querySelector(".iso-stage");
const shadow = stage.querySelector('[data-part="shadow"]');
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
let hour = ${START}, target = hour, frame = 0, last = 0, tourClock = 0, touring = !still.matches, visible = false, idle = 0, drawn = -1;
const tourAt = (t) => { const span = HOURS[1] - HOURS[0]; const u = (t / 28) % 2; return HOURS[0] + span * (u < 1 ? u : 2 - u); };
function draw() {
  const key = Math.round(hour * 60);
  if (key === drawn) return;
  drawn = key;
  const shade = shadeAt(hour);
  shadow.setAttribute("d", shadowPath(shade.polys, 0, P));
  const text = readoutOf(hour, shade);
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuenow", hour.toFixed(1));
  stage.setAttribute("aria-valuetext", text);
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  if (touring) { tourClock += dt; target = tourAt(tourClock + 28 * (${START} - HOURS[0]) / (HOURS[1] - HOURS[0])); }
  hour = still.matches ? target : hour + (target - hour) * (1 - Math.exp(-dt / 0.25));
  if (Math.abs(target - hour) < 0.004) hour = target;
  draw();
  frame = visible && (touring || hour !== target) ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const steer = (next) => { touring = false; target = clamp(next, HOURS[0], HOURS[1]); clearTimeout(idle); idle = setTimeout(() => { touring = !still.matches; tourClock = 0; run(); }, 4000); run(); };
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("pointermove", (event) => {
  const b = stage.getBoundingClientRect();
  steer(HOURS[0] + clamp((event.clientX - b.left) / b.width, 0, 1) * (HOURS[1] - HOURS[0]));
});
stage.addEventListener("keydown", (event) => {
  let to = null;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") to = Math.round(target * 2) / 2 + 0.5;
  if (event.key === "ArrowLeft" || event.key === "ArrowDown") to = Math.round(target * 2) / 2 - 0.5;
  if (event.key === "Home") to = HOURS[0];
  if (event.key === "End") to = HOURS[1];
  if (to === null) return;
  event.preventDefault();
  steer(to);
});
const hourParam = new URLSearchParams(location.search).get("hour");
if (hourParam) { touring = false; hour = target = clamp(Number(hourParam), HOURS[0], HOURS[1]); }
draw();
`;

const body = `<style>${s.SITE_CSS}</style>` + k.plateHtml({
  fig: "Fig 1",
  title: "Pocket plaza",
  hint: "Hover to move the sun",
  readout: readoutOf(START, first),
  keys: [
    { mark: "lit", label: "Bench seat: the readout is the share of it in shade" },
    { mark: "flat", label: "Shadow cast by the sun for that hour" },
  ],
  caption:
    "A 6 × 4 m pocket plaza at 49° N on June 21, in solar time. A 6.2 m tree with a 4.6 m crown grows in a raised bed behind a 450 mm seat wall; the backless bench stands 450 mm high. The cut edge shows 80 mm pavers on 30 mm bedding sand, 150 mm crushed base and 200 mm subbase over subgrade, held by a concrete header. The front header carries a 3 m scale in 100 mm ticks.",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Pocket plaza: arrow keys move the sun through the day" aria-valuemin="${HOURS[0]}" aria-valuemax="${HOURS[1]}" aria-valuenow="${START}">${svg}</div>`,
});

const name = theme === "light" ? "pocket-plaza-light.html" : "pocket-plaza.html";
writeFileSync(join(HERE, name), k.pageHtml({ title: "Pocket plaza", theme, body, script: kitScript() + landscapeScript() + live, width: 700 }));
console.log("wrote", name, "·", readoutOf(START, first));
