# ROUND 69 — THE ORBIT RESTORED & THE SNAPPY SUMMON (2026-09-29)

**Branch: `r68-explorer-upgrade` (continues).** Two traveler verdicts on R68,
both obeyed literally.

## 1. THE ORBIT IS RESTORED (`2687d047`)

The traveler's law: **the rotating view is needed everywhere.** Swinging the
camera's *angle* (0° → 30° → 270°) is how a hidden hole is found from a fixed
point — R68's "glide over empty space, orbit only over bodies" orphaned the
most important search gesture. Nothing is deleted; the grammar is joined:

| Drag | Gesture |
|---|---|
| **Plain left-drag** | **ORBIT again** (everywhere — the pre-R68 behavior, restored) |
| **Ctrl + left-drag** | GLIDE (the R68 exploring drift, kept as a partner) |
| Shift / right / middle-drag | PAN (unchanged) |

Move, turn, glide — three first-class gestures, none abandoned. The R68 pan
leash (3× altitude free flight) and the cursor-anchored dive are untouched —
they compose with orbit perfectly: swing to aim, wheel to travel.

## 2. THE SNAPPIER SUMMON (`78262e7b`)

The traveler's verdict on the forward Kamui: the final stage (the throat's
stabilizing blink) dragged, and the whole summon read as lag. Bound given:
**1–2.5 s faster, max.** The choreography compresses **5.5 s → 3.5 s (−2.0 s)**,
shape preserved — every beat re-spanned in proportion, never slowed:

| Constant | Was | Now |
|---|---|---|
| `KAMUI_TRIGGER_DURATION` | 5.5 s | **3.5 s** |
| Beat spans (tear/wind/flicker/deepen/throat) | 0.95/2.05/3.05/4.35/5.5 | **0.6/1.3/1.95/2.77/3.5** |
| `KAMUI_VACUUM_WINDOW` | 1.5 s | **0.95 s** |
| Void-flicker pulse window (engine) | 1.75–2.75 s | **1.1–1.75 s** |
| `KAMUI_ENTRY_HOLD` | 5.5 s | **3.5 s** (still = the summon; the R67 throat handoff rides it exactly) |

The R67 handoff, the arrival settle, the throat unwind, and the eject are all
duration-relative — they inherit the compression with zero changes. The
reverse (eject) Kamui was already 1.9 s and stays. The round18 gauntlet's
constant pins were updated **in the same commit** (the gauntlet discipline).

## Verification

- `npm run typecheck` — clean (after every commit).
- round16 · round17 · **round18 (re-pinned, GREEN)** · round63 — ALL GREEN.
- `npm run smoke` — **GREEN**: clean boot, zero console errors, reference
  frame matches (histL1 0.0577 ≤ 0.12).

## Escape hatch

`git revert 2687d047` returns the drag grammar to R68's; `git revert 78262e7b`
restores the 5.5 s summon. Each behavior, one commit.
