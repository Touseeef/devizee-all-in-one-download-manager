---
name: design-system
description: Use for ANY change that touches colors, spacing, radius, shadows, typography, or motion in the frontend. This is the only source of truth for visual values in this app — no arbitrary Tailwind values (bg-[#09090b], p-[13px], shadow-[0_2px...]) are allowed outside this file. Load references/tokens.css for the exact values.
---

# Design System — Devizee (Linear/Apple-HIG direction)

## Why this exists
The UI has looked "vibe coded" so far because every component invented its
own colors and spacing ad hoc (`emerald-500`, `zinc-900/50`, one-off opacity
values scattered through JSX). Professional apps don't have "a nice
palette" — they have a small, fixed set of **semantic tokens** defined once
and referenced everywhere. This skill is that fixed set. Nothing here is a
suggestion; treat it as load-bearing.

## The rule, stated plainly
**No component may use a raw Tailwind color class (`bg-zinc-900`,
`text-emerald-400`, `border-slate-200`) or an arbitrary value
(`bg-[#09090b]`, `shadow-[...]`) anywhere in JSX.** Every visual value
comes from a token defined in `references/tokens.css`, applied via Tailwind
v4's `@theme` block so tokens become real utility classes
(`bg-surface-1`, `text-primary`, `border-subtle`, `shadow-elevated`, etc).
If a needed value doesn't exist as a token yet, add it to
`references/tokens.css` first — don't invent it inline in a component.

## Token categories (see references/tokens.css for exact values)
1. **Surface colors** — `surface-0` (app bg) through `surface-3`
   (highest elevation, e.g. modals/popovers). Never more than 4 surface
   levels; if a design needs a 5th, that's a sign the layout is too
   layered, not a sign to add a token.
2. **Border colors** — `border-subtle` (default dividers/card edges) and
   `border-strong` (focus rings, active states). Only two — don't add a
   third "medium" border color.
3. **Text colors** — `text-primary`, `text-secondary`, `text-tertiary`.
   Three levels only. `text-tertiary` is for timestamps/metadata, never
   for anything the user needs to read to use the app.
4. **Accent** — one brand accent (`accent`, `accent-hover`,
   `accent-subtle` for badge backgrounds). This is the ONLY saturated
   color allowed for non-status UI (buttons, active tab indicator, focus
   rings, links). It must never be reused to mean "success" — that's a
   different token (see below).
5. **Status colors** — `status-success`, `status-warning`,
   `status-danger`, `status-info`. These are semantically reserved:
   `status-success` only ever means a completed/healthy state,
   `status-danger` only ever means an error/destructive action,
   `status-warning` only for degraded-but-not-failed states. Never borrow
   a status color for decoration, and never use the brand accent color to
   represent a status — that's exactly how you get an ambiguous state
   that silently renders as "mystery yellow." Cross-reference the
   status-model skill for the full state→color mapping — that mapping is
   the only place status colors get chosen.
6. **Radius scale** — `radius-sm` (12px — chips/badges/small buttons),
   `radius-md` (10px — inputs, list rows), `radius-lg` (16px — cards,
   panels), `radius-full` (pills, avatars). Four values, nothing between
   them. Note sm > md here intentionally — small controls read better
   with slightly rounder corners at this size; don't "fix" this without
   checking how it looks first.
7. **Elevation (shadow)** — `shadow-flat` (no shadow — most surfaces),
   `shadow-raised` (dropdowns, context menus), `shadow-floating` (modals,
   toasts). Dark theme shadows are mostly border + subtle glow, not drop
   shadow — real drop shadows barely read on near-black backgrounds. See
   tokens.css for theme-specific implementations of each level.
8. **Typography scale** — `text-caption` through `text-display`, six
   steps, defined with exact px/line-height/weight in tokens.css. Font
   weights are restricted to 400/500/600 only — never 300 (too thin for
   a desktop app at these sizes) or 700+/800/900 (reads as shouting;
   reserve heavy weight for nothing in this app).
9. **Motion** — exactly three durations (`duration-fast` 120ms,
   `duration-base` 200ms, `duration-slow` 320ms) and one easing curve
   (`ease-standard`). No spring/bounce physics anywhere except optionally
   a single one-off celebration micro-animation on "download completed"
   — and even that should be restrained, not playful/gamified (that's
   part of what read as "vibe coded" before).

## Component rules that follow from the tokens
- A card/panel is `surface-1` on `surface-0` background, `radius-lg`,
  `border-subtle`, `shadow-flat` by default — only elevate to
  `shadow-raised` on hover/active if the component is interactive.
- Buttons: primary action = `accent` background + white/near-white text.
  Secondary action = `surface-2` background + `border-subtle` +
  `text-primary`. Never more than one primary-styled button visible in
  the same view — if two feel equally important, that's a hierarchy
  problem to solve in layout, not in color.
- Only one accent color is visible on screen at a time as "the brand
  color" — status colors (progress bars mid-download, error banners) are
  allowed to coexist with it since they mean something different.

## Before/after example
Wrong: `<div className="bg-[#111114] border border-zinc-800/90 rounded-2xl p-4">`
Right: `<div className="bg-surface-1 border-subtle rounded-lg p-4">`
The second version survives a future theme/rebrand change; the first one
requires hunting through every file that copy-pasted that hex value.
