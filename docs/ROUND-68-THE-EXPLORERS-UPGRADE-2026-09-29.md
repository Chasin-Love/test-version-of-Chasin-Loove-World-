# ROUND 68 — THE EXPLORER'S UPGRADE (2026-09-29)

**Branch: `r68-explorer-upgrade`** — isolated from `main` by design: this wave
takes risks so `main` never has to. Two fronts, both born from real traveler
feedback: the touch visitor (the experience report's lowest score) and the
explorer's complaint — *"this theme is a universe but I can't explore the
universe."*

## The diagnosis (why exploring felt broken)

Three stacked laws, each reasonable alone, together made free exploration
impossible:

1. **The wheel had one dimension.** It changed only the distance to ONE
   center point. Point at the right side of the cosmic web and dive — you
   still flew into the middle. There was no "zoom toward what I'm looking at."
2. **The drag had one gesture.** Left-drag = orbit (rotate the camera around
   the center). Moving across the field required Shift+drag / right-drag —
   a modifier the traveler must be told about and then never forget.
3. **The stage edges sat ON the interesting views.** The web ceiling (0.865)
   was inside the web's own outer band: pull out to see the whole structure
   and you were teleported to the multiverse *while still in-range*. Same at
   the multiverse floor. And the crossing fired on ANY fast scroll near the
   edge.

## The commit map (each step its own commit — `git log` maps them)

| Commit | What it does |
|---|---|
| `b670f602` | **THE EXPLORER'S HAND** — plain left-drag now GLIDES (drifts the view across the field); it becomes an orbit turn only when a body is under the pointer (rotation is pointless over empty web, natural around a world). Shift/right/middle keep explicit pan. The pan leash grows to **3× altitude** in free flight (was 1.2 everywhere), so a drift can actually cross a structure. |
| `1c83e127` | **THE CURSOR-ANCHORED DIVE** — the wheel now walks the orbit center toward what the wheel ray touches: an object hit (body / galaxy / cluster / reality bubble) or a bounded point down the ray (min(85% of altitude, camera-to-hit)). Dive at the right side of the web and you ARRIVE there. Google-Earth grammar, engine-owned raycast (`resolveAimPoint`), rig-owned center walk; the dive dies with its momentum — a resting dial never drifts the center. |
| `f52be82d` | **THE EXPLORATION MARGIN** — web ceiling 0.865 → **0.94** (the whole outer web band is now in-stage), multiverse floor 0.8 → **0.735** (a true whole-sphere vantage exists). Crossings now demand a DELIBERATE push: the dial at the edge AND `WARP_ZOOM_VEL` outward velocity — never a plain fast scroll. The Kamui remains the only stage bridge, exactly as THE LAW requires. |
| `cc6b3c07` | **THE TOUCH GRAMMAR** — the finger gets its hover: first tap on an object raises its card (inspect, no action), a second tap on the same object inside 1.6 s acts (the click path plays unchanged); a tap on empty space dismisses the card; **long-press** (550 ms) opens the context menu; two-finger gestures hand off cleanly to the rig's pinch/pan pair (no double-drive, no ghost clicks); the tap's card positions at the TAP point (fingers often never produce a pointermove). Tap-move threshold widened 7 → 12 px for finger noise. |
| `c5616c81` | **FINGER-SIZED BUTTONS** — one coarse-pointer rule (`@media (pointer: coarse)`): the hover cards' action buttons grow to the 44 px touch minimum, with a visible press response. A mouse keeps the compact size. Zero component churn. |

## What was deliberately NOT changed

- THE LAW (Kamui as the only stage bridge) — crossings still fire the jutsu;
  they are just deliberate now.
- Focused-flight behavior: while a body owns the framing, the tight pan leash
  (1.2×), the focus clamps, and orbit-primacy are untouched — a framed world
  is a subject to orbit, not a place to drift from.
- The default boot view, the pinhole camera memory, all black-hole code.

## Verification

- `npm run typecheck` — clean (after every commit).
- round16 (lens law) · round17 (port pins) · round18 (Kamui) · round63 (void
  seals) — **ALL GREEN**.
- `npm run smoke` — **GREEN**: clean boot, zero console errors, reference
  frame matches (histL1 0.0530 ≤ 0.12; the boot camera is unaffected).

## The new traveler's grammar (what to tell users)

| Gesture | Now |
|---|---|
| Wheel over a target | dive TOWARD it (object or deep field) |
| Wheel outward at the web's rim | explore the whole structure; only a hard push at the very edge crosses (via Kamui) |
| Left-drag on empty field | glide across the universe (with momentum fling) |
| Left-drag on a world | orbit around it |
| Shift / right / middle-drag | explicit pan (unchanged) |
| Two-finger pinch / drag (touch) | zoom / pan (unchanged, cleaner handoff) |
| Tap (touch) | inspect card; tap again to act |
| Long-press (touch) | context menu |

## Runtime escape hatch

Every behavior is its own commit: `git revert <sha>` removes exactly one
(the hand, the dive, the margin, the touch grammar, the button sizes) without
touching the others. Merge to `main` only when the traveler says it feels right.
