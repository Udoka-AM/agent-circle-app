# Plan 001: Restore keyboard focus-visible on all interactive controls

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 493d4e1..HEAD -- app/globals.css components app`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (a11y)
- **Planned at**: commit `493d4e1`, 2026-07-26

## Why this matters

Almost every input and many buttons use Tailwind `outline-none` with no
`:focus-visible` replacement. Only `.theme-toggle` defines a visible focus
ring. Keyboard users (and switch users) cannot tell which control is active.
This is ui-craft **GhostFocus** — Critical / merge-blocking for WCAG 2.2 AA.

## Current state

- `app/globals.css` — design tokens + theme-toggle focus styles (~lines 139–144).
- Forms strip outlines, e.g. `components/ListForm.tsx`:
  `className="… outline-none"` on the capital input.
- Same pattern in `SubmitAgentForm.tsx`, `MyAgents.tsx`, `app/admin/page.tsx`.
- Buttons/links (nav, filter chips, CTAs) have no dedicated focus-visible CSS.

Exemplar already correct — match this ring pattern:

```css
/* app/globals.css — theme-toggle */
.theme-toggle:focus-visible .theme-toggle-track {
  box-shadow: 0 0 0 2px var(--background), 0 0 0 4px var(--logo-blue);
}
```

## Commands you will need

| Purpose   | Command                | Expected on success      |
|-----------|------------------------|--------------------------|
| Install   | `npm install`          | exit 0                   |
| Lint      | `npm run lint`         | exit 0                   |
| Typecheck | `npx tsc --noEmit`     | exit 0                   |
| Dev       | `npm run dev`          | serves localhost:3000    |

## Scope

**In scope**:
- `app/globals.css` — add global interactive `:focus-visible` rules
- Optionally remove redundant `outline-none` from form controls *only if*
  global styles fully replace them (keep `outline-none` if you replace via
  a shared utility class that still provides a ring)

**Out of scope**:
- Restyling the Solana wallet-adapter modal internals beyond existing CSS
- Adding shadcn components
- Mobile nav (plan 002)

## Git workflow

- Branch: `advisor/001-focus-visible-baseline`
- Commit style (from recent log): imperative sentence, e.g. `Restore focus-visible rings on interactive controls`
- Do NOT push or open a PR unless asked

## Steps

### Step 1: Add global focus-visible rules

In `app/globals.css`, after the body rules (near the top utilities), add:

```css
:where(a, button, input, select, textarea, [role="button"], [role="switch"], [tabindex]:not([tabindex="-1"])):focus-visible {
  outline: 2px solid var(--logo-blue);
  outline-offset: 2px;
}

/* Keep theme-toggle's custom double-ring; suppress duplicate outline on the button itself */
.theme-toggle:focus-visible {
  outline: none;
}
```

Do not use `outline: none` globally. Prefer `:focus-visible` over `:focus` so
mouse users are not forced into rings.

**Verify**: `grep -n "focus-visible" app/globals.css` → shows both the global
rule and the theme-toggle exception.

### Step 2: Manual keyboard smoke (dev server)

Run `npm run dev`. Tab through `/`, `/agents`, `/builders` (with wallet
disconnected), and `/admin` lock screen.

**Verify**: Every link, filter chip, input, and primary button shows a blue
ring ≥ 2px when focused via keyboard. Theme toggle still shows its track ring.

### Step 3: Lint / typecheck

**Verify**: `npm run lint` → exit 0; `npx tsc --noEmit` → exit 0.

## Test plan

No automated tests in repo. Manual: keyboard Tab/Shift+Tab on four routes
above; confirm rings visible in both `data-theme="dark"` and `light`.

## Done criteria

- Global `:focus-visible` rule present in `app/globals.css`
- No interactive control that previously had only `outline-none` lacks a
  visible focus indicator
- Lint + tsc clean

## STOP conditions

- If product owner requires a different focus color than `--logo-blue`, stop
  and ask — do not invent a new token without updating both themes.
- If a third-party wallet button swallows focus styles via `!important`,
  document the gap in the plan status notes; do not vendor-patch their JS.

## Maintenance note

Any future `outline-none` on a control must ship with a replacement
`:focus-visible` style on that control or rely on this global rule.
