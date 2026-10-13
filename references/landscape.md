# Landscape

How to draw small outdoor places, site furnishings and construction build-ups with the kit. The craft rules in `craft.md` still hold; this file covers what changes when the subject is a place instead of a machine. The reference figure is `examples/pocket-plaza/`.

## Contents

1. The place is the explanation
2. Units, axes and camera
3. Ground, grade and the cut
4. Paving
5. Planting
6. Furnishings and scale figures
7. Sun and shadow
8. Tones and colour
9. Checks

## 1. The place is the explanation

Anatomy invents a machine to explain an abstract idea. A landscape figure draws the real place, and the drawing explains how that place works. Pick the one question the figure answers before anything else:

| Question | What the figure shows | What moves |
|---|---|---|
| Is the bench comfortable at 2 pm in June? | Tree, bench, shadows | Sun through the day; readout is the share of the seat in shade |
| Where does the water go? | Paving falls, trench drain, curb cut, rain garden | A storm fills the garden to ponding depth, then the overflow |
| What is under the paving? | The cut edge or an exploded build-up | Layers separate one by one |
| How is the bench fixed? | Bench, footings, fixings | The bench lifts off its footings |
| What does it look like in 10 years? | Planting at true nursery and mature sizes | Growth slider, year 1 to 25 |
| How is a 600 mm grade change resolved? | Steps, ramp, seat wall, handrails | A figure walks each route; readout is the slope |

Sizes: a **Detail** (one element or a build-up, 30–60 parts), a **Place** (a parklet, plaza corner, courtyard or rain garden, 60–150 parts) and a **Site** (a park or a street block, which is an Epic: propose a Place-sized slice first).

## 2. Units, axes and camera

- Work in **millimetres**: x east, y north, z up. `fitProjection` scales the drawing to the card, so real dimensions go straight in.
- With the default azimuth of 45°, +x runs to the lower right and +y to the lower left, so north points down and to the left. Draw the north arrow on the ground (a plaque or an engraved arrow) and let it point wherever north really is; don't rotate the site to put north up.
- Elevation 30° suits a plaza. Use 45–60° to look down into a courtyard or a planting bed.
- `kit/landscape.mjs` holds the landscape helpers. It imports from `iso-kit.mjs`, and `landscapeScript()` in `scripts/inline-kit.mjs` inlines it into a page after `kitScript()`.

## 3. Ground, grade and the cut

- Build the ground as a **plinth of real layers**, bottom to top, one `slabOf` each, and cut it open on the two faces toward the viewer (x max and y max). That cut is the section, and it is where a landscape figure earns its detail.
- `strataTexture(kind, rect, zTop, zBot, P)` textures both cut faces: `"soil"` (short level dashes), `"stone"` (small rings, subbase), `"gravel"` (dots, base course), `"fines"` (small dots, bedding sand) and `"joints"` (vertical lines). Draw it with `free: true` lines and `dotsSvg`.
- Draw a seam where each layer meets the next, along both faces and ending on the outline.
- Edge restraints carry the cut on the paving layer: a concrete header or steel edge drawn as its own slab, deeper than the pavers.
- A typical unit-paver build-up for a figure: 80 mm pavers, 30 mm bedding sand, 150 mm crushed base, 200 mm subbase, then subgrade.

## 4. Paving

- `pavingJoints(rect, { length, width, bond }, z, P, holes)` draws a running bond (or a stack bond with `bond: 0`) with every joint running edge to edge of its course. `holes(course)` returns the x spans to leave out of a course, so a bed, a drain or a grate interrupts the field and the joints still end on edges.
- Draw joints `lo`, header edges `mid`.
- A trench drain is a flat inset slab with a grate frame, bars every 40 mm and locking bolts every metre.
- A scale belongs on a real part: ticks every 100 mm and a major every metre along a header or edge strip (`topTicks`), with end dots.

## 5. Planting

Plants are the one place the "solids only" rule bends.

- **Canopies and shrubs** are clusters of spheres: `lobesOf(centre, radius, P, options)` returns the lobes, and `lobedSvg(lobes, { tone, opacity, stipple })` draws the union outline, one crescent of shade on the far side and leaf stipple. A crown over the subject takes `opacity` around 0.9 so the space below it still reads; shrubs stay opaque.
- **Trunks** are turned with `G.solidOf`: a root flare that eases into a slow taper, never a stack of cylinders (that reads as a telescoping pole). Scaffold limbs are tapered `solidOf` bodies on `G.frameAlong`, sorted by depth and drawn before the crown.
- **Grasses** are `grassClump([x, y, z], P)`: arching blades from one base, drawn as `free` lines.
- **Mulch and fine ground** are `stipple(rect, z, P)` dots.
- Show the tree pit or soil volume when the figure is about the tree.
- Keep planting tonal, not botanical: the reader knows tree, shrub, grass and mulch at a glance, and species go in the caption.

## 6. Furnishings and scale figures

- Furniture is built like a machine: footings with fixings, cast legs, a seat with slat grooves that run end to end, screws at each leg. A seat wall gets a coping or a timber top on steel flats.
- Light poles stand on a base plate with four bolts, a shroud, a pole and an arm with a luminaire.
- **Scale figures** are simple solids at true size: legs, a rounded torso, arms, a neck and a head (`sphereSvg`). Standing height 1750 mm, seat height 450 mm. Sort the far arm before the torso and the near arm after it. Use figures to show the use the figure is about, never as decoration, and keep them clear of each other on screen.
- `FIGURE` has standard heights; `personPoints` gives a figure's shadow-casting volume.

## 7. Sun and shadow

- `sunAt(latitude, day, hour)` gives altitude, azimuth and the unit vector toward the sun in world axes, in solar time.
- Each caster is a list of 3D points (`boxPoints`, `ellipsoidPoints`, `personPoints`). `shadowsOf(casters, toward, ground)` returns their ground polygons and `shadowPath(polys, z, P)` one path for all of them. Every polygon has the same winding, so overlaps union instead of darkening.
- Draw shadows after the paving and before anything that stands on it, clipped to the top of the plinth so nothing falls off the edge into the air.
- A readout that measures shade samples the surface on its own plane: cast the overhead casters onto `z = seat height` and count samples with `insidePolygon`.
- The page rebuilds the shadow path from the same functions, so the drawing and the readout can't disagree.

## 8. Tones and colour

- The kit's hierarchy still holds: ground `lo`, hardscape and structure `mid`, the subject `hi`, exactly one `lit` part.
- Shadows use `.site-shadow`, a flat fill at low opacity. Foliage has its own leaf and shade tokens in `SITE_CSS`; put `<style>${SITE_CSS}</style>` in the page beside the kit's styles.
- Colour only when it carries meaning (water, planting against hardscape, a material comparison), in muted greens, earth and stone. For space2place work, use the s2p brand palette.

## 9. Checks

On top of `verify.md`:

- Every dimension is real: riser, tread, seat height, ramp slope, paver module, layer depths. Say in the caption which are assumed.
- Every joint, seam, contour and rail ends on an edge, a post or a dot. Grass blades and bark fissures are the only free ends.
- Every person stands on a surface or sits on a seat, and every tree sits in a bed or a pit.
- Shadows stay on the plinth top, and nothing pops when the sun moves.
- Capture at three hours (morning, early afternoon, evening) in both themes and at 390 px wide.
