# Plan 004: Fix form labels, filter semantics, and missing UI states

> **Executor instructions**: Follow step by step; verify each step; update
> `plans/README.md` status when done.
>
> **Drift check**: `git diff --stat 493d4e1..HEAD -- components/ListForm.tsx components/AgentsGrid.tsx components/LeaderboardTable.tsx components/SubmitAgentForm.tsx components/MyAgents.tsx app/dashboard/page.tsx`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/001-focus-visible-baseline.md
- **Category**: bug (a11y + StateMatrixHoles)
- **Planned at**: commit `493d4e1`, 2026-07-26

## Why this matters

1. `ListForm` labels are not tied to inputs (`htmlFor` / `id` missing) — screen
   readers announce unlabeled fields.
2. Market filter and market-focus chip buttons do not expose selected state
   (`aria-pressed` or radiogroup pattern).
3. `AgentsGrid` has no empty state when filters yield zero agents.
4. `MyAgents` returns `null` while loading — no progress signal (Nielsen:
   visibility of system status).

## Current state

- `ListForm.tsx`: `<label>` without `htmlFor`; inputs without `id`.
- Filter buttons in `LeaderboardTable.tsx` / `AgentsGrid.tsx` /
  `SubmitAgentForm.tsx`: visual selected style only.
- `AgentsGrid.tsx`: maps `filtered` with no `filtered.length === 0` branch
  (LeaderboardTable already has empty copy — match that tone).
- `MyAgents.tsx`: `if (!session || (loaded && agents.length === 0)) return null;`
  — when `session` exists and `!loaded`, renders nothing.

## Commands you will need

| Purpose   | Command             | Expected |
|-----------|---------------------|----------|
| Lint      | `npm run lint`      | exit 0   |
| Typecheck | `npx tsc --noEmit`  | exit 0   |
| Dev       | `npm run dev`       | up       |

## Scope

**In scope**:
- `components/ListForm.tsx`
- `components/LeaderboardTable.tsx` (filter a11y only)
- `components/AgentsGrid.tsx` (filter a11y + empty state)
- `components/SubmitAgentForm.tsx` (market chip a11y; market label association)
- `components/MyAgents.tsx` (loading skeleton/text)

**Out of scope**:
- Adopting shadcn Field / ToggleGroup / Empty (direction item; optional later)
- Dashboard mock-data honesty badge (UI-11 — separate unless trivial)
- Admin confirm dialog (UI-08)

## Steps

### Step 1: ListForm label association

Give inputs stable ids (`capital-usdc`, etc.), set `htmlFor` on labels.
For read-only risk fields, use `id` on the value container and
`aria-labelledby` or keep as text with visible label (not fake inputs).

**Verify**: `grep -n "htmlFor\|id=" components/ListForm.tsx` shows matching
pairs for the capital input at minimum.

### Step 2: Filter / market chips — selected semantics

For single-select chip groups:

```tsx
role="group"
aria-label="Filter by market"
// each button:
aria-pressed={market === m}
```

Apply to LeaderboardTable, AgentsGrid, and SubmitAgentForm market focus
(SubmitAgentForm: `aria-label="Market focus"` on the group).

**Verify**: In DevTools Accessibility tree, pressed chip reports pressed=true.

### Step 3: AgentsGrid empty state

When `filtered.length === 0`, render centered muted copy analogous to
leaderboard: `No agents in this market yet.` (or include sort context if useful).
Do not invent illustration/emoji.

**Verify**: Force filter to empty market in UI or temporarily with mock —
empty copy appears.

### Step 4: MyAgents loading state

While `session && !loaded`, render a short status line or 1–2 skeleton
blocks using existing tokens (`animate-pulse` on `bg` with `--border` /
`--card` is acceptable; do not add a new Spinner library).

Keep `return null` only for `!session` or loaded-and-empty.

**Verify**: Throttle network in DevTools; builders page shows loading UI
before agents appear.

### Step 5: Lint / typecheck

**Verify**: `npm run lint` && `npx tsc --noEmit` → exit 0.

## Done criteria

- ListForm capital field programmatically labeled
- Chip groups expose pressed state
- AgentsGrid empty filter handled
- MyAgents shows loading when session present

## STOP conditions

- Do not refactor all forms into a shared Form primitive in this plan
- Do not install shadcn unless operator requests it as part of execution

## Maintenance note

New chip filters should copy the `role="group"` + `aria-pressed` pattern
from LeaderboardTable after this lands.
