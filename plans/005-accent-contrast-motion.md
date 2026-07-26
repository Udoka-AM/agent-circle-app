# Plan 005: Fix accent-text contrast, light StatusBadge, and reduced motion

> **Executor instructions**: Follow step by step; verify each step; update
> `plans/README.md` status when done.
>
> **Drift check**: `git diff --stat 493d4e1..HEAD -- app/globals.css components/Badge.tsx`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt (a11y / design-system)
- **Planned at**: commit `493d4e1`, 2026-07-26

## Why this matters

1. `.accent-text` uses gradient `background-clip: text` on nearly every page
   H1. Contrast cannot be verified across the gradient (ui-craft anti-default
   **#6 Gradient text** / GradientCrutch).
2. Non-live `StatusBadge` uses `border-white/15 bg-white/5`, which disappears
   or fails contrast on light theme.
3. Theme thumb spring + card `hover:-translate-y-0.5` ignore
   `prefers-reduced-motion`.

## Current state

```css
/* app/globals.css */
.accent-text {
  background: var(--grad-accent-text);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
}
```

```tsx
// components/Badge.tsx — non-live
className="… border-white/15 bg-white/5 … text-[var(--muted)]"
```

```tsx
// AgentsGrid card
className="… hover:-translate-y-0.5"
```

## Commands you will need

| Purpose   | Command             | Expected |
|-----------|---------------------|----------|
| Dev       | `npm run dev`       | up       |
| Lint      | `npm run lint`      | exit 0   |

## Scope

**In scope**:
- `app/globals.css` — `.accent-text` solid color; reduced-motion media query
- `components/Badge.tsx` — theme-safe non-live badge styles
- `components/AgentsGrid.tsx` — gate hover translate behind motion preference
  (CSS class preferred over JS)

**Out of scope**:
- Removing all accent gradient usage from borders/buttons (`--grad-accent` on
  CTAs can remain — solid text is the requirement)
- Full DESIGN.md bootstrap (direction item UI-13)

## Steps

### Step 1: Replace gradient text with solid accent

Change `.accent-text` to use a solid, theme-aware color with verified intent:

```css
.accent-text {
  color: var(--accent-solid);
  background: none;
  -webkit-text-fill-color: unset;
}
```

Keep `--accent-solid` as defined for dark/light in `:root` /
`:root[data-theme="light"]`. If contrast of `--accent-solid` on
`--background` is weakly under 4.5:1 for body-adjacent H1, darken/lighten
`--accent-solid` in both themes slightly — document the hex change in the
commit message.

**Verify**: Inspect an H1 span.accent-text in DevTools — computed color is
opaque solid, not `transparent`.

### Step 2: Fix StatusBadge non-live styles

Replace white opacity utilities with token borders:

```tsx
className="inline-flex … rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide"
style={{ borderColor: "var(--border-strong)", color: "var(--muted)", background: "var(--card-solid)" }}
```

(or equivalent Tailwind arbitrary values using CSS variables). Live badge can
keep positive tint.

**Verify**: Toggle theme to light on `/agents` — VETTING/PAUSED chips remain
visible against white cards.

### Step 3: Reduced motion

In `app/globals.css`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

And for AgentsGrid, prefer a class like `motion-safe:hover:-translate-y-0.5`
if Tailwind v4 supports `motion-safe` in this project; otherwise add:

```css
@media (prefers-reduced-motion: reduce) {
  .hover-lift:hover { transform: none; }
}
```

and swap the card class accordingly.

**Verify**: Emulate `prefers-reduced-motion: reduce` in DevTools — theme
toggle thumb does not spring; cards do not lift.

### Step 4: Lint

**Verify**: `npm run lint` → exit 0.

## Done criteria

- No gradient clipped text on headings via `.accent-text`
- Non-live badges readable in light theme
- Reduced-motion preference honored for transitions/hover lift

## STOP conditions

- If brand owner insists gradient text must stay on marketing-only surfaces,
  stop and split a `.accent-text-brand` for Brand-register pages only —
  Product pages must stay solid. This app is Product register by default.

## Maintenance note

New decorative gradients belong on borders/fills, not on body/headline text.
Update `plans/README.md` direction if a DESIGN.md is later authored — document
solid accent rule there.
