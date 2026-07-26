# Plan 003: Make leaderboard usable on narrow viewports

> **Executor instructions**: Follow step by step; verify each step; update
> `plans/README.md` status when done.
>
> **Drift check**: `git diff --stat 493d4e1..HEAD -- components/LeaderboardTable.tsx`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (responsive / TextOverflow)
- **Planned at**: commit `493d4e1`, 2026-07-26

## Why this matters

`LeaderboardTable` uses a fixed 8-column CSS grid inside a container with
`overflow-hidden`. On phones the row content is clipped or crushed; rank,
metrics, and “View →” become unusable. This is ui-craft **TextOverflow** and
blocks the home route’s primary job: compare live agents before listing capital.

## Current state

```tsx
// components/LeaderboardTable.tsx — repeated template
className="grid grid-cols-[48px_1fr_100px_90px_90px_100px_120px_80px] …"
// outer:
className="overflow-hidden rounded-2xl border"
```

Empty filter copy exists (`No live agents in this market yet.`) — keep it.

## Commands you will need

| Purpose   | Command             | Expected |
|-----------|---------------------|----------|
| Dev       | `npm run dev`       | up       |
| Lint      | `npm run lint`      | exit 0   |
| Typecheck | `npx tsc --noEmit`  | exit 0   |

## Scope

**In scope**: `components/LeaderboardTable.tsx` only (markup/CSS classes).

**Out of scope**: AgentsGrid card layout; changing ranking data; adding charts.

## Recommended approach (pick one; do not mix half-implementations)

**Preferred**: Below `md`, render each agent as a stacked card/row (rank +
avatar/name + key metrics + link). At `md+`, keep the current table grid.

**Acceptable alternative**: Keep the grid but wrap it in
`overflow-x-auto` (remove `overflow-hidden` or move it), set
`min-w-[720px]` on the grid, and ensure the header scrolls with rows.
Still provide sticky first columns only if trivial — do not over-engineer.

## Steps

### Step 1: Implement responsive layout

Refactor `LeaderboardTable` so viewport ≤ `md` does not clip columns.

- Preserve filter chips and empty state.
- Preserve Link wrapping each agent to `/agents/${slug}`.
- Keep RankBadge, AgentAvatar, MarketChip, Sparkline on desktop; on mobile
  you may drop Sparkline to save space but keep Score + Return at minimum.

**Verify**: At 375px width, every agent row’s name is readable and the row
navigates on click/tap; no horizontal clip of the primary name.

### Step 2: Long-name stress

Temporarily think through a 40-char agent name — ensure `truncate` +
`min-w-0` remains on the name flex child (already present on desktop).

**Verify**: Name truncates with ellipsis; layout does not blow out.

### Step 3: Lint / typecheck

**Verify**: `npm run lint` && `npx tsc --noEmit` → exit 0.

## Done criteria

- Home leaderboard usable at 375px without pinched columns
- Desktop (≥768px) still shows multi-column comparison
- Empty filter state unchanged in meaning

## STOP conditions

- If product wants a completely different leaderboard (charts-first), stop —
  this plan is a responsive fix, not a redesign.
- Do not install table libraries.

## Maintenance note

Market filter chips are duplicated with AgentsGrid — consolidating chips is
out of scope here (see plan 004 for a11y on chips).
