---
description: How to work on the budget app - check and update project plan
---

# Budget App Development Workflow

// turbo-all

## Before Starting Work

1. Read the current project plan to understand progress:

   ```
   cat project-plan.md
   ```

2. Read the spec for context on requirements:

   ```
   cat spec.md
   ```

3. Identify the current milestone and next unchecked task.

## During Development

1. When starting a task, mark it as in-progress in `project-plan.md`:
   - Change `- [ ]` to `- [/]`

2. When completing a task, mark it done:
   - Change `- [/]` to `- [x]`

3. When completing a milestone deliverable, add a completion note.

## After Completing Work

1. Update `project-plan.md` with any new tasks discovered during implementation.

2. If the spec needs clarification based on implementation learnings, update `spec.md`.

## Key Files

- `spec.md` - Product requirements and architecture
- `project-plan.md` - Implementation checklist and milestones
