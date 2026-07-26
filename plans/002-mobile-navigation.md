# Plan 002: Add mobile navigation for primary app routes

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 493d4e1..HEAD -- components/Nav.tsx app/globals.css`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/001-focus-visible-baseline.md (recommended so new
  controls inherit focus rings)
- **Category**: bug (UX / responsive)
- **Planned at**: commit `493d4e1`, 2026-07-26

## Why this matters

`Nav` hides the four primary links below the `sm` breakpoint and provides no
hamburger, drawer, or alternate menu. On phones, users cannot reach
Leaderboard, Agents, For Builders, or Dashboard without typing URLs. This
breaks core product IA on the most common trading-glance device.

## Current state

```tsx
// components/Nav.tsx
<nav className="hidden items-center gap-7 text-sm sm:flex" …>
  {LINKS.map((link) => (
    <Link key={link.href} href={link.href} className="nav-link">…</Link>
  ))}
</nav>
```

No `sm:hidden` menu button exists. Repo has no Sheet/Dialog primitives —
implement a small disclosure with `<button>` + conditional panel; do not add
shadcn unless the operator explicitly asks.

Match existing visual language: CSS variables, `rounded-2xl` / `rounded-full`,
`--border`, `--card`, accent gradient reserved for primary CTAs (wallet), not
for every chrome element.

## Commands you will need

| Purpose   | Command             | Expected on success |
|-----------|---------------------|---------------------|
| Install   | `npm install`       | exit 0              |
| Dev       | `npm run dev`       | localhost:3000      |
| Lint      | `npm run lint`      | exit 0              |
| Typecheck | `npx tsc --noEmit`  | exit 0              |

## Scope

**In scope**:
- `components/Nav.tsx` — mobile menu button + panel; keep desktop nav
- `app/globals.css` — only if needed for menu open animation / reduced-motion
  (prefer CSS already available)

**Out of scope**:
- Redesigning desktop nav
- Adding Admin to the public nav
- Installing new dependencies

## Git workflow

- Branch: `advisor/002-mobile-navigation`
- Commit message style: `Add mobile navigation menu for primary routes`

## Steps

### Step 1: Convert Nav to a client component with open state

Add `"use client"` at top of `Nav.tsx` (ThemeToggle/WalletButton already
client-bound; Nav becomes client for menu state).

Keep `LINKS` array as-is.

Add:
- `const [open, setOpen] = useState(false)`
- A `sm:hidden` icon button (`aria-expanded={open}`, `aria-controls="mobile-nav"`,
  `aria-label={open ? "Close menu" : "Open menu"}`)
- When `open`, render a panel (`id="mobile-nav"`) listing the same `LINKS` as
  full-width links; clicking a link calls `setOpen(false)`
- Close on Escape (`useEffect` keydown listener when `open`)
- Optional: lock body scroll while open

Use simple SVG or Unicode “☰” / “×” only if no icon library is already a
dependency — `lucide-react` is **not** in this package.json; do not add it.
Inline SVG chevron/hamburger paths are preferred over emoji.

**Verify**: `grep -n "aria-expanded\|mobile-nav\|sm:hidden" components/Nav.tsx`
shows the button and panel.

### Step 2: Responsive check

At viewport width 375px: menu button visible, desktop link row hidden.
Open menu → all four routes reachable. At ≥640px: desktop links visible,
menu button hidden, panel closed.

**Verify**: DevTools device mode; Tab order reaches menu button then links
when open.

### Step 3: Lint / typecheck

**Verify**: `npm run lint` && `npx tsc --noEmit` → exit 0.

## Test plan

Manual: 375px and 1280px widths; keyboard Esc closes; focus-visible visible
on menu button (plan 001).

## Done criteria

- All four primary routes reachable below `sm`
- Menu button has correct ARIA
- Esc closes menu
- Desktop layout unchanged in appearance

## STOP conditions

- If Nav must stay a Server Component for an undocumented reason, stop and
  report — extract `MobileNav` client child instead of inventing a different IA.
- Do not add `@radix-ui` / shadcn without operator approval.

## Maintenance note

When adding a top-level route, append it to `LINKS` only — both desktop and
mobile consume that array.
