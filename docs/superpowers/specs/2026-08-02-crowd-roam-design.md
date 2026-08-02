# Crowd roaming — avatars walk the floor

Date: 2026-08-02
Branch: `feat/crowd-roam`
Follows: `2026-08-02-crowd-dance-glow-design.md` (shipped)

## Problem

The crowd reads as a formation, not an audience. Owner's words: *"they stay close and near each
other in lines, I want them to wander around in the space, go near speakers, return"* — like a
real concert.

Two causes, and neither is the animation amplitude:

1. **The grid is the model.** `gridSlot` assigns every listener a fixed cell in a dense rectangle
   and never moves them. The wander added on the previous branch only sweeps the leftover slack
   *inside* that cell, which at density is ~2px. Turning it up is impossible without collisions,
   because the cell is all the room a tile has.
2. **The region is a strip.** The band is the bottom ~25% minus obstacles. The speakers, the sides,
   and the whole area beside the visualizer are unreachable by construction, so nobody can ever
   "go near the speakers" — there is no floor there to stand on.

## Design

Replace *cell + jitter* with *region + path*.

### Region

`crowdRegion(boxW, boxH)` returns the whole usable floor, not a strip: full width inside a margin,
from below the now-playing banner down to the controls gutter. This is what puts floor under the
speakers.

`vizCircle(boxW, boxH)` returns the visualizer as a centre and radius, mirroring its JSX wrapper
(`top-[52%]`, `64vmin` capped at 460px) exactly as `vizBottomPx` already does. The crowd may walk
**around** it but never through it — the previous branch's clearance rule becomes an exclusion
*circle* rather than a horizontal cut, which is what frees up the sides.

### Path

`roamPath(uid, region, viz, steps)` returns N deterministic waypoints for one listener:

- Sampled from `hashUid(uid)`, so a listener stands in the same places on every device and across
  reloads — the same determinism `gridSlot` and the bob already rely on.
- Rejection-sampled against the visualizer circle, so no waypoint is ever inside the artwork.
- The path loops (last waypoint returns toward the first), so they "go near the speakers and
  return" rather than drifting off in one direction forever.

### Animation

One CSS keyframe walks the waypoints, driven by per-avatar custom properties, so 200 roaming
avatars still cost zero JavaScript per frame. Duration is long (60-120s, seeded per avatar) and
the delay is negative and seeded, so the crowd is mid-journey on arrival rather than all setting
off together.

The bob and the cheer are unchanged and compose on their existing elements.

## Consequences accepted

- **Avatars will cross each other.** That is what a real crowd does, and the owner already chose
  "a packed room should look packed" when the bob was shown to exceed its gap at density. The
  strict no-overlap guarantee therefore **no longer applies to positions over time** — it is
  replaced by the exclusion circle plus the region bounds. This is a deliberate reversal of the
  earlier constraint, not an oversight; see the previous spec for what it protected and why that
  reason (label collision at density, where labels are not drawn anyway) does not hold here.
- Name labels can transiently overlap while two listeners pass. Accepted for the same reason.

## Gains

Capacity rises: the region is several times the old band, so far fewer people fall into the
`+N in the crowd` badge. The screenshot that prompted this showed `+27` on a desktop window with
most of the floor empty.

## Tests

- Every waypoint lies inside the region and outside the visualizer circle, across phone, tablet
  and desktop boxes.
- Paths are deterministic per uid and differ between uids.
- Capacity is larger than the old band's for the same box.
- `prefers-reduced-motion` disables roaming along with the rest.


## Final model: steering simulation (2026-08-02)

`crowdMotion.ts` is a small steering system: wander toward a target, separate from near
neighbours, and get pushed out of fixed props. `useCrowdMotion.ts` runs it.

The per-frame JavaScript cost was accepted only after the two cheaper models failed the brief.
It is kept small: spatial hash for O(n) neighbour lookups, a 30fps tick, direct
`style.transform` writes so React never re-renders on movement, and the loop halts when the
crowd is empty, the tab is hidden, or reduced motion is requested.

Two findings worth keeping:

- **A proportional obstacle push does not work.** It fades to nothing at the boundary and
  balances against the wander pulling inward, so avatars settle just *inside* the clearance. The
  push is constant while inside, and a hard positional constraint runs after integration, because
  forces can be overpowered by a tight pocket of neighbours.
- **An escape direction must have floor beyond it.** The PA stacks run off the side of the
  region, so the shortest way out of one can be a direction where the region clamp puts the
  avatar straight back inside it.

Separation stays soft on purpose: neighbours brush and may slightly overlap, which is what was
asked for. Obstacles are hard.
