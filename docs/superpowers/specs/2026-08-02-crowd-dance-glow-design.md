# Crowd wander + happy glow reaction

Date: 2026-08-02
Branch: `feat/crowd-dance-glow`
Status: design agreed, implementation in progress

## Problem

Two asks from the owner, after a broadcast where the room held 120 listeners:

1. The dance floor reads as static. Make the avatars move around the space.
2. A listener has no way to express anything visually. Give them a way to show they are happy,
   visible to everyone else in the room.

## What already exists (and must be reused, not rebuilt)

Exploration cut the scope roughly in half.

| Piece | Where | State |
|---|---|---|
| Per-avatar bob, out of sync | `DanceFloor.tsx` tile render | Already shipped. `radio-bob` with `animationDelay` and `animationDuration` seeded from `hashUid` |
| Reduced-motion handling | `radio.css` `@media (prefers-reduced-motion: reduce)` | Already covers `radio-bob`, `radio-dance`, `radio-slot` and the rest |
| Energetic animation | `radio.css` `radio-dance`, 0.9s | Defined, **never used**. Written for an excited state that was never wired up |
| Avatar glow | `Avatar.tsx` `glow` prop | Already renders `filter: drop-shadow()` sized off the avatar |
| Position smoothing | `radio.css` `.radio-slot` transition | Already eases the left/top jump when the grid re-slots |

So the genuinely new work is **lateral movement** and **the reaction signal**. The excited
animation and the glow primitive are both already in the codebase.

## Decisions

**Movement = wander, not teleport.** Avatars drift within the slack the layout already reserves.

**Trigger = a button in the chat panel**, not tapping your own avatar. At crowd scale the floor
holds 55-91 avatars on a phone (measured via `crowdCapacity`), which puts each tile near the
16px minimum. Even your own avatar, which renders 12px larger and carries a ring, lands around
28px — under the project's 44px touch-target rule. A fixed control is hittable at any density.

**Transport = the presence payload**, not the `chat_reactions` table. A mood is ephemeral: it
should die with the session. Adding a field to the existing `channel.track({...})` costs no
table, no migration, and no RLS change. Accepted cost: no history, and a cheer does not survive
a reconnect. Both are fine for what this is.

## Design

### Wander

The binding constraint is the no-overlap guarantee that `DanceFloor.test.tsx` enforces at full
capacity. `gridSlot` already computes a jitter budget per axis:

```
maxJitter = 0.25 * (cell - footprint)
```

and currently spends it on a **static** hash-derived offset. Wander re-spends that same budget
as an animation range, at 0.8 amplitude.

Worst case is two neighbours swinging toward each other. Their centres start `cell` apart and
each moves at most `J = 0.8 * 0.25 * (cell - footprint)`, so the closest approach is
`cell - 2J = cell - 0.4*(cell - footprint)`, which stays above `footprint` for every `cell >=
footprint` — and cells are sized so the footprint fits by construction. The 0.8 factor is the
margin that keeps it from being exactly tangent.

Transform ownership forces one structural change: the slot div already carries
`translate(-50%, -50%)` and the inner div already carries the bob animation. Neither can hold a
second transform, so wander gets its own wrapper between them. At the 200-tile hard cap that is
200 extra divs, which is acceptable for a CSS-only animation.

### Happy glow

- `PresenceEntry` gains `cheerAt?: number`; `usePresence` tracks it and exposes `cheer()`.
- **Rate limit: one cheer per device per 3s.** `track()` rebroadcasts to every subscriber, so an
  unthrottled button at 120 listeners is a presence storm competing with the audio stream.
- A tile is cheering while `now - cheerAt < 5000`. It swaps `radio-bob` for the existing
  `radio-dance` and gains a `.radio-cheer` class with an amplified animated drop-shadow.
- Presence does not re-fire when the window elapses, so `DanceFloor` runs a 1s tick **only while
  at least one cheer is active**, never as a standing interval.

## Behaviour at maximum density (measured 2026-08-02)

| Device | Cap | Avatar | Labels | Drift |
|---|---|---|---|---|
| Phone 390x844 | 84 | 17px | none | 2.3px |
| Tablet 768x1024 | 126 | 17px | none | 2.2px |
| Laptop 1440x900 | 200 | 19px | none | 2.8px |
| Desktop 1920x1080 | 200 | 23px | none | 4.2px |
| Ultrawide 3440x1440 | 200 | 36px | none | 6.9px |

At 300 listeners a phone shows 84 with `+216 in the crowd`; a laptop and up show 200 with `+100`.
300 listeners render ~727 DOM nodes, all animated by CSS with no JS loop.

**Wander shrinks to near nothing when the room is full, and that is the bound working.** Drift only
ever spends the slack between a tile and its neighbour, and at capacity there is almost none. A
packed floor genuinely has no room to roam.

**Decided: the bob is deliberately NOT bounded the same way.** `radio-bob` sweeps a fixed 9px
each way regardless of density, while the tightest vertical gap at capacity is 7.8-16.6px, so two
stacked avatars can pass through each other on a full floor. This predates the feature and is kept
on purpose: at that density there are **no name labels**, and label collision was the original
reason the no-overlap rule exists. Small glowing dots overlapping as they dance reads as a crowded
room, not as a defect. Options considered and rejected: driving the bob from the same reserved
slack (a full floor goes visibly still), and lowering `CROWD_HARD_CAP` (fewer real people shown).
Do not "fix" the asymmetry between bounded wander and unbounded bob without revisiting this.

## Non-goals

- No tap-to-glow on the avatar itself (touch target, above).
- No reaction history, tally, or persistence.
- No change to the audio path, the schema, or any RLS policy.

## Risks

| Risk | Mitigation |
|---|---|
| Wander reintroduces avatar overlap | Overlap test extended to the worst-case excursion, at phone/tablet/desktop boxes. Loosening that test instead of the amplitude would defeat its purpose |
| Presence write storm at 120 listeners | 3s per-device rate limit, enforced in the hook rather than the button |
| Motion sickness / accessibility | `.radio-wander` and `.radio-cheer` join the existing `prefers-reduced-motion` disable list |
| DOM cost at 200 tiles | CSS animations only; no per-avatar rAF or React state tick |
