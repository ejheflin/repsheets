# Drag-to-Reorder Exercises in Active Workout

**Date:** 2026-05-04  
**Status:** Approved

## Overview

Allow users to long-press the exercise name on a collapsed exercise card and drag to reorder exercises within the active workout. Reordering is in-memory only — the programmed routine is not modified.

## Scope

- Collapsed exercise cards only (expanded cards have inputs that conflict with drag)
- Active workout only — disabled in edit mode (`isEditMode`)
- Does not modify the routine; order change is applied to `workout.exercises[]` in state and written to the sheet as-is when `finishWorkout` is called

## New Packages

- `@dnd-kit/core` — drag engine, sensors, DndContext
- `@dnd-kit/sortable` — SortableContext, useSortable, arrayMove
- `@dnd-kit/utilities` — CSS.Transform.toString

## Modified Files

- `src/data/useWorkout.tsx` — add `reorderExercises(fromIdx, toIdx)`
- `src/ui/workout/WorkoutTab.tsx` — DndContext + SortableContext, PointerSensor, onDragEnd, sortable transform on exercise wrappers
- `src/ui/workout/ExerciseRow.tsx` — drag handle icon, dragHandleListeners, dragAttributes, isDragging visual state

## Activation

`PointerSensor` with `activationConstraint: { delay: 400, tolerance: 5 }`:

- Hold finger on exercise name for **400ms** without moving more than **5px** → drag activates
- Movement beyond 5px before 400ms cancels (treated as swipe or scroll)
- No conflict with `SwipeableRow`: swipe is immediate horizontal movement, long-press requires stillness

## Drag Handle

A 6-dot grid icon (⠿ style, `#555` stroke, 12×18px) appears to the left of the exercise name on collapsed cards. It is the touch target for drag activation — `listeners` from `useSortable` are spread onto this icon's parent button. The icon is not shown in expanded view or in edit mode.

## Visual Feedback (Live Reorder)

**Dragging card:**
- `transform` from dnd-kit applied (tracks finger)
- `scale(1.03)` via additional CSS transform
- `box-shadow: 0 8px 24px rgba(0,0,0,0.6)` — elevated appearance
- `border: 1.5px solid #6c63ff` — accent highlight
- `z-index: 10` — floats above siblings
- No transform transition while actively dragging (tracks finger exactly)

**Other cards:**
- Receive `translateY` from dnd-kit as dragged card crosses their midpoint
- `transition: transform 200ms ease` — smooth live reorder animation
- User always sees the final order in real time

**On release:**
- Card snaps to final position with dnd-kit default spring
- `reorderExercises` called in `onDragEnd` with `active.id` and `over.id`

## Architecture Details

### WorkoutTab

```
DndContext
  sensors: [PointerSensor { delay:400, tolerance:5 }]
  collisionDetection: closestCenter
  onDragEnd: ({ active, over }) => {
    if active.id !== over.id:
      oldIndex = exercises.findIndex(ex => ex.exercise === active.id)
      newIndex = exercises.findIndex(ex => ex.exercise === over.id)
      reorderExercises(oldIndex, newIndex)
  }

  SortableContext
    items: exercise names (stable IDs that travel with each exercise)
    strategy: verticalListSortingStrategy

    For each exercise:
      SortableExerciseWrapper (inline in WorkoutTab map)
        useSortable({ id: ex.exercise })
        wrapper div:
          ref={setNodeRef}
          style: merged sortable transform + delete animation
          (mutually exclusive states — different CSS properties, no conflict)
        ExerciseRow with drag props threaded through
```

### CSS transition merging on wrapper div

The wrapper div handles two independent animations:

| State | Properties animated |
|-------|-------------------|
| Delete animation | `max-height`, `opacity` |
| dnd-kit sort | `transform` |
| Actively dragging | no transition on `transform` |

Since these are different CSS properties they can coexist in one `transition` declaration. `overflow` is `hidden` only when `isDeleting`, so dragged card shadow is never clipped.

### ExerciseRow new props

```typescript
dragHandleListeners?: React.HTMLAttributes<HTMLButtonElement>
dragAttributes?: React.HTMLAttributes<HTMLDivElement>
isDragging?: boolean
```

`dragHandleListeners` spread onto the exercise name button (the long-press target). `isDragging` applies the elevated visual state to the card.

### useWorkout addition

```typescript
reorderExercises(fromIdx: number, toIdx: number): void
```

Splices `workout.exercises` — removes exercise at `fromIdx`, inserts at `toIdx`. Superset groupings (`supersetGroup` field) travel with each exercise; consecutive matching values continue to render as superset groups.

## Edge Cases

- **Superset exercises reordered:** Dragging an exercise out of a consecutive superset pair splits the group — it now renders as two individual exercises. This is acceptable and predictable.
- **Single exercise workout:** Drag activates but `onDragEnd` is a no-op (no valid `over` target).
- **Edit mode:** `PointerSensor` not added to `DndContext` when `isEditMode` — no drag affordance shown.
- **Expanded card:** Drag handle icon hidden; drag not active on expanded cards (only collapsed cards have the handle rendered).
