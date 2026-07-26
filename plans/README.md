# Advisor plans — Agent Circle UI/UX

**Audit**: 2026-07-26 · commit `493d4e1` · skills: ui-craft + shadcn/improve  
**Scope**: UI / UX / a11y / responsive / design-system gaps (not full nine-category improve sweep)  
**Visual verification**: pending (`npm install` + `npm run dev` not run during advisor pass)

## Priority order

| Plan | Status | Depends on | Finding |
|------|--------|------------|---------|
| [001-focus-visible-baseline.md](./001-focus-visible-baseline.md) | TODO | none | UI-01 GhostFocus |
| [002-mobile-navigation.md](./002-mobile-navigation.md) | TODO | 001 (share focus styles) | UI-02 |
| [003-leaderboard-responsive.md](./003-leaderboard-responsive.md) | TODO | none | UI-03 |
| [004-form-filter-states.md](./004-form-filter-states.md) | TODO | 001 | UI-04, UI-06, UI-07 |
| [005-accent-contrast-motion.md](./005-accent-contrast-motion.md) | TODO | none | UI-05, UI-09, UI-10 |

## Direction (not planned unless requested)

- Adopt shadcn (Field, ToggleGroup, Empty, Skeleton, AlertDialog) or author `DESIGN.md` for the existing token set (UI-13).
- Soften VisualSameness across page headers (UI-14).
- Confirm dialog for admin Reject (UI-08).
- Demo badge / hide mock metrics until wallet verified (UI-11).
- Gate “List this agent” to `status === "live"` (UI-12).

## Considered and rejected

- Geist fonts as Inter-reflex — **rejected**; create-next-app default, intentional.
- Logo `alt=""` — **rejected**; adjacent “Agent Circle” text provides the name.
- Wallet adapter modal a11y internals — **out of scope**; third-party; CSS overrides only.

## Verification baseline (repo)

| Purpose | Command | Notes |
|---------|---------|-------|
| Install | `npm install` | no node_modules at audit time |
| Dev | `npm run dev` | Next 16 |
| Lint | `npm run lint` | eslint |
| Typecheck | `npx tsc --noEmit` | no dedicated script |
| Tests | none | no test script — characterization tests not required for these UI plans unless noted |
