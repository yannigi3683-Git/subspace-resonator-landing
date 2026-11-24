# Hybrid stage look (2026-11-24)

Replaces the Stage panel's dance floor (`DanceFloor`) with `HybridDanceFloor` as the only look.
No skin toggle. `DanceFloor.tsx` stays in the tree because `HybridDanceFloor` reuses its
`padCrowd`, `readCrowdTestParam`, `isCheering`, `Rect` and `BroadcasterAvatar`, and so a revert is
one line in `LiveRoom.tsx`.

## What changed on screen

- The big centred psychedelic visualizer (`PsyViz`) is replaced by a small flower
  (`HybridVisualizer`, 176px max, 60% opacity) tucked behind the DJ. It no longer takes the middle
  of the floor from the crowd.
- Both Turbosound Floodlight PA stacks show at every width. The old floor hid them below 400px, so
  they never appeared on a phone. At phone width they are 76px wide.
- An `ABOARD NN` count sits beside the On Air indicator.
- Names are always rendered. Chat, presence, audio and the tab bar are untouched.

## The names-versus-capacity decision

The old floor dropped name labels once the room got dense (`hasLabel` false), and kept up to 200
avatars. This look inverts that: the name is the thing that must stay, so the avatar and the
name's width shrink instead.

- Name width runs from 84px down to a 44px floor (about 7 characters at 10px mono, then an ellipsis).
- The crowd simulation separates neighbours by `radius`. In this look `radius` covers the name
  under the avatar (`labelW * 0.35`), not only the avatar, otherwise names pile up.
- The roaming region is inset by half a name on each side so the widest label can never be pushed
  off screen. The simulation clamps tile centres to the region, not tile edges.
- Capacity is therefore set by names fitting (`MIN_CELL_PX`), not by the 12px avatar floor. On a
  390px phone (floor 724px tall) that is about 54 listeners; beyond it the status row shows
  `+N in the crowd` beside `ABOARD`. A 960x800 desktop floor holds about 136, not 200.
- Phones reserve only `PHONE_GUTTER_PX` (24px, half a tile) at the bottom of the floor, desktop
  `CONTROLS_GUTTER_PX` (64px). Below md the volume control is its own row under the floor, so the
  bigger gutter only made sense where the pill floats over it. Read once at mount via `matchMedia`.
- `LIVE DJ` sits on a dark pill: bare, the pink text vanished into the flower's pink rings.
- `obstacleRects` in `DanceFloor` returns nothing below 400px because the old floor hid the PAs
  there. `hybridObstacleRects` always returns both stacks, mirroring the 76/150/210px widths in the
  JSX. If those widths change, change both.

## Not verified

Visual layout was checked in headless Chromium at 390x780 and 1100x800 with 5, 16, 40 and 60
listeners. It has not been looked at on a real phone, and the audio path was not touched or tested.

## Round 2 (2026-11-24, after the owner reviewed the preview)

The first build drifted from what was approved, and the owner rejected three parts of it. This round
reverts those parts to the original floor and keeps the rest.

- **Visualizer: the original `PsyViz`, unchanged.** Same canvas, colours, size (`64vmin`, max 460px)
  and place (centre of the floor, `top-[52%]`); `vizCircle` from `DanceFloor` is the crowd's
  obstacle again. The small flower (`HybridVisualizer`) was deleted. Do not shrink or recolour the
  visualizer without asking: "smaller, less psychedelic" was the first complaint.
- **No now-playing bar.** The station title (or the peeking track name) shows under the DJ, where
  `LIVE DJ_` was, through `NowPlaying` with `neon`: 12-13px pixel font, pink glow, on a dark pill so
  it reads over the nebula. Its width stops short of the PA stacks and a long name marquees.
  `NowPlaying` still mounts, so lock-screen metadata (`mediaSession`) is unchanged.
- **PA stacks back to the original phone width (96px)**, moved up to `top-[44px]` into the space the
  bar left. `hybridObstacleRects` mirrors both.
- **Names wider:** `HYBRID_LABEL_MIN_W` 44 -> 56, so short names stop collapsing to "Test …".
- **Capacity cost, accepted by the owner:** a 390px phone holds about 33 named avatars before
  `+N in the crowd` (was about 54). The largest real shows so far had 15-24 listeners.

## Round 3 (2026-11-24): title, bigger speakers, names drop when packed

- **Station title row** at the top: `SUBSPACE RESONATOR` white + `LIVE RADIO` cyan with a glow
  (`radio-title-glow`), above the On Air / ABOARD row.
- **Bigger PA stacks:** 120 / 170 / 230px (phone / sm / lg), at `top-[64px]`. `paWidthPx` mirrors it.
- **The names-always rule is REVERSED by the owner.** Testing showed only ~25 avatars on a real phone,
  and the owner wants 30-40+ visible. Names now show only while each listener has room for one
  (`NAMED_CELL_PX`, about 20 on a phone); past that `hasLabel` is false, names drop and the avatar
  keeps shrinking to `HYBRID_AVATAR_MIN` (14px). Capacity is set by the avatar
  (`DOT_CELL_PX`), so a phone holds 100+, still capped at 200. This supersedes "The
  names-versus-capacity decision" above.
