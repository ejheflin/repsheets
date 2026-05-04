# Swipe-to-Reveal Actions on Workout Exercise Cards

**Date:** 2026-05-04  
**Status:** Approved

## Overview

Add a swipe-left gesture to collapsed exercise cards in the active workout tab. Swiping past a threshold reveals two action buttons — **Swap** (rename for this workout only) and **Delete** (remove exercise + all its sets). The gesture infrastructure is built as a reusable pair of primitives so it can be applied to set rows and other list items later.

## Scope

- Only applies to **collapsed** exercise cards during an **active workout**
- Does **not** modify the routine; changes are in-memory only until the workout is finished
- Expanded exercise cards are excluded (horizontal swipe would conflict with number inputs)

## New Files

### `src/ui/shared/useSwipeActions.ts`

A hook that manages touch gesture state for a single swipeable row.

**Interface:**
```typescript
interface UseSwipeActionsOptions {
  actionWidth: number   // total px width of the revealed action area
  threshold?: number    // fraction of actionWidth required to snap open (default 0.4)
}

interface UseSwipeActionsReturn {
  offset: number        // current translateX value (0 to -actionWidth)
  isOpen: boolean
  handlers: {
    onTouchStart: React.TouchEventHandler
    onTouchMove: React.TouchEventHandler
    onTouchEnd: React.TouchEventHandler
  }
  close: () => void
}
```

**Gesture logic:**
1. `touchstart` — record `startX`, `startY`; disable CSS transition for frame-accurate tracking
2. `touchmove` — on first movement, compare `|deltaX|` vs `|deltaY|`. If horizontal wins, take ownership (call `preventDefault` to suppress scroll); otherwise ignore all subsequent moves for this gesture. Clamp offset to `[-actionWidth, 0]`.
3. `touchend` — if `|offset| >= actionWidth * threshold` snap to `-actionWidth` (open); else snap to `0` (closed). Re-enable CSS transition for the snap animation.

Tapping the content area while open (a `click` event with no preceding swipe) calls `close()`.

**Implementation note:** `preventDefault` on `touchmove` requires non-passive listeners. React synthetic touch events cannot be made non-passive. The hook must attach listeners directly via `ref` + `addEventListener(type, handler, { passive: false })` and remove them on cleanup.

### `src/ui/shared/SwipeableRow.tsx`

A presentational wrapper that applies the swipe gesture to any row content.

**Interface:**
```typescript
interface SwipeAction {
  label: string
  icon: ReactNode
  color: string         // CSS background color for the button
  onClick: () => void
}

interface SwipeableRowProps {
  actions: SwipeAction[]
  className?: string
  children: ReactNode
}
```

**Layout:**
- Outer `div`: `position: relative; overflow: hidden; border-radius: 10px`
- Action buttons: `position: absolute; right: 0; top: 0; bottom: 0; display: flex`
  - Each button: equal width (`actionWidth / actions.length`), stacked icon + label (Option B style), `active:opacity-80` tap feedback
  - Button icons are thin SVGs (strokeWidth 1.5), consistent with project icon conventions
- Content `div`: `position: relative; z-index: 1; transform: translateX(offset)px`
  - CSS transition `transform 0.2s ease` enabled during snaps, disabled during active drag

`actionWidth` is derived from `actions.length * BUTTON_WIDTH` where `BUTTON_WIDTH = 72px`.

## Modified Files

### `src/data/useWorkout.ts`

Add two new operations to the workout context:

- **`removeExercise(exerciseIndex: number)`** — removes the exercise at the given index from `workout.exercises`. If the exercise is the last one of its `supersetGroup`, the group naturally dissolves (no cleanup needed — grouping is derived at render time).
- **`renameExercise(exerciseIndex: number, newName: string)`** — sets `workout.exercises[exerciseIndex].exercise` to the trimmed new name. No-op if `newName.trim()` is empty.

Neither operation touches the Google Sheet. The updated state is written to the sheet when `finishWorkout` is called normally.

### `src/ui/workout/ExerciseRow.tsx`

**New local state:**
```typescript
const [showSwap, setShowSwap] = useState(false)
const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
const [swapName, setSwapName] = useState(exercise.exercise)
```

**Collapsed render path:** wrap existing collapsed card JSX in `<SwipeableRow>` with two actions:

| Action | Icon | Color | Behavior |
|--------|------|-------|----------|
| Swap | arrows-right-left SVG | `#5c5ccc` | `setShowSwap(true)` |
| Delete | trash SVG | `#c0392b` | `setShowDeleteConfirm(true)` |

Opening either dialog also closes the swipe state (call `close()` from the row).

**Expanded render path:** unchanged — no `SwipeableRow` wrapper.

**Swap dialog** (rendered inline, conditionally):
- Title: "Swap Exercise"
- Subtitle: "This only affects your current workout — the routine is not changed."
- Pre-filled text input with current exercise name, accent border
- Buttons: Cancel (dismisses) | Confirm (calls `onRenameExercise(swapName.trim())`, dismisses)
- Confirm disabled if `swapName.trim()` is empty or unchanged

**Delete confirmation dialog** (rendered inline, conditionally):
- Title: "Remove Exercise?"
- Body: `"${exercise.exercise} and all its sets will be removed from this workout."`
- Buttons: Cancel | Remove (red, calls `onRemoveExercise()`)

**New props added to `ExerciseRowProps`:**
```typescript
onRemoveExercise: () => void
onRenameExercise: (newName: string) => void
```

## Props Threading

`WorkoutTab.tsx` already maps over exercises and passes per-exercise handlers. Two new handlers are added to each `<ExerciseRow>`:

```typescript
onRemoveExercise={() => removeExercise(exerciseIndex)}
onRenameExercise={(name) => renameExercise(exerciseIndex, name)}
```

## Behavior Edge Cases

- **Superset exercise deleted:** The remaining exercise in the group keeps its `supersetGroup` value; `WorkoutTab` grouping logic is unchanged (it just groups by consecutive matching values, so a single-item group renders without the superset wrapper).
- **Only exercise in workout deleted:** The workout becomes empty. This is allowed — the user can still finish or discard an empty workout.
- **Swap to existing exercise name:** Allowed. This is a log-only rename; no uniqueness constraint.
- **Swipe on expanded card:** `SwipeableRow` is not applied to the expanded path, so no gesture handling occurs.

## Visual Design

Follows existing UI conventions:
- Background `#1a1a2e`, surface `#2a2a4a`, accent `#6c63ff`
- Swap button: `#5c5ccc` (purple-adjacent)
- Delete button: `#c0392b` (red)
- Icons: thin SVGs, strokeWidth 1.5
- Buttons: `rounded-[10px]` on outer corners, squared on inner join
- `active:opacity-80` tap feedback on all buttons
