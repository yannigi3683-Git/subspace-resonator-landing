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
