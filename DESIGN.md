# Agent Circle App — Design System

Product shell for listing and tracking AI trading agents on Solana. Traders compare vetted performance; builders submit and manage agents. Visual identity aligns with the marketing site (`agentscircle`) while staying a **Product** register: flat elevated surfaces, dense data, restrained motion — not glass/aurora marketing chrome.

## Visual Theme & Atmosphere

Dark-first marketplace tooling. Confidence through clarity: tabular metrics, blue brand accents, quiet neutrals. Emotional tone: competitive, precise, trustworthy — not playful or “AI purple.”

## Color Palette & Roles

| Token | Dark | Light | Role |
|-------|------|-------|------|
| `--background` | `#07090e` | `#f6f5f2` | Page canvas |
| `--background-elevated` | `#0c0f16` | `#ffffff` | Sticky chrome / elevated strips |
| `--foreground` | `#e8edf6` | `#12141a` | Primary text |
| `--card` / `--card-solid` | `#0e121c` / `#10141e` | `#ffffff` | Cards and solid panels |
| `--border` / `--border-strong` | white 10% / 18% | ink 10% / 18% | Dividers and control borders |
| `--muted` | `#8b93a5` | `#5b6270` | Secondary text, labels |
| `--logo-blue` | `#1885ff` | `#1568d6` | Brand primary / solid CTAs |
| `--grad-accent` / `--grad-brand` | blue→white | same stops | Selected chips, rank badges, accent borders, wallet chrome |
| `--grad-brand-soft` | blue translucent 135° | same idea | Soft washes |
| `--on-accent` | `#07090e` | `#07090e` | Text/icons on gradient fills |
| `--on-primary` | `#ffffff` | `#ffffff` | Text on solid `--logo-blue` |
| `--accent-glow` | blue glow | softer blue | Selection / elevation tint |
| `--positive` / `--negative` | `#4fd6a0` / `#ff8a8a` | `#1c9d6c` / `#d5453f` | PnL / risk only |

**Usage rules**

- Primary actions (Submit, List, Approve): solid `--logo-blue` + `--on-primary`.
- Selected chips / rank / decorative accent fills: `--grad-accent` + `--on-accent`.
- Headline accent spans: solid `--logo-blue` via `.accent-text` — never gradient-clipped text.
- Semantic green/red only for performance and risk — never as brand decoration.

## Typography

| Level | Family | Size / weight | Role |
|-------|--------|---------------|------|
| Display / page H1 | Gilroy ExtraBold/Bold | ~2.25rem / 600–800 | Page titles |
| Accent phrase | Gilroy + `.accent-text` | inherits H1 | Emphasized clause in title |
| Eyebrow | Poppins | 12px / 600 / uppercase / tracking | Section label |
| Body | Poppins | 14–16px / 400–500 | Lede, descriptions |
| Label | Poppins | 11–12px / 600 | Form labels, column headers |
| Metric | Poppins tabular | 14–24px / 600 | Scores, money, % |

`--font-display`: Gilroy (`/fonts/Gilroy-*.woff`).  
`--font-body` / `--font-sans`: Poppins (next/font).

## Spacing & Layout

Scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64.  
Content max width: `max-w-6xl` (lists), `max-w-4xl` / `max-w-2xl` (detail / forms).  
Page padding: `px-6 py-14`. Radius: chips/buttons `999px`; cards `1rem` (`rounded-2xl`); controls `0.75rem` (`rounded-xl`).

## Components

| Recipe | Spec |
|--------|------|
| `.btn-primary` | `rounded-full`, bg `--logo-blue`, color `--on-primary`, py-3 px-6, font-semibold |
| `.btn-accent` | `rounded-full`, bg `--grad-accent`, color `--on-accent` |
| `.btn-ghost` | `rounded-full`, border `--border-strong`, color `--muted` |
| `.chip` | `rounded-full`, border `--border`, color `--muted`, px-4 py-2 text-xs font-semibold |
| `.chip-selected` | bg `--grad-accent`, color `--on-accent`, no border |
| `.card-surface` | `rounded-2xl`, border `--border`, bg `--card` |
| Status live | positive tint + dot |
| Status other | border `--border-strong`, bg `--card-solid`, color `--muted` |
| Nav link | muted; hover solid `--logo-blue` (not gradient text) |

## Iconography & Imagery

Logo mark: `/logo.png`. Agent avatars: deterministic initials on hue gradient; optional `--grad-accent` ring for top ranks. No emoji as UI icons.

## Motion

State feedback 160–220ms ease. Theme thumb may use spring; honor `prefers-reduced-motion: reduce` (collapse transitions/animations). Hover lift only with `motion-safe`.

## Accessibility

WCAG 2.2 AA. Focus: `--ring` (double ring with `--logo-blue`). Do not strip outlines without a replacement. Touch targets ≥ 24×24 (prefer 32+). Color never sole status cue.

## Don'ts

- No warm pastel accents (`#f7d5db`, gold/terracotta solids).
- No gradient clipped body/headline text.
- No glass/aurora as default product chrome.
- No Geist / Inter / system-ui as brand display/body.
- No raw hex for brand fills in components — use tokens / `.btn-*` / `.chip*`.
- No purple-as-brand default.
