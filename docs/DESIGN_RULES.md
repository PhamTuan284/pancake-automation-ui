# UI Design Rules

This document defines visual rules for the MeiT Tools UI so screens remain consistent, easy to maintain, and accessible.

## 1) Design Principles

- Keep UI simple and predictable.
- Prefer consistency over novelty.
- Reuse tokens/components before creating new styles.
- Every interactive element must have clear hover/focus/disabled states.

## 2) Color System

Use a small palette. Do not exceed these role groups without product approval.

### 2.1 Maximum color groups

- **Base neutrals**: up to 6 shades (background, surface, border, text levels).
- **Primary brand**: up to 3 shades (default, hover, subtle bg).
- **Semantic**: success, warning, error, info (1 main + optional subtle bg each).

### 2.2 Current recommended roles

- `bg-page`: `#0f172a`
- `bg-surface`: `#0b1220` to `#1e293b`
- `border-default`: `#334155`
- `text-primary`: `#e2e8f0`
- `text-secondary`: `#94a3b8`
- `primary`: `#3b82f6`
- `primary-hover`: `#1d4ed8`
- `success`: `#22c55e`
- `warning`: `#f59e0b`
- `error`: `#ef4444`

### 2.3 Color usage rules

- Use color to indicate meaning, not decoration.
- Do not use more than 1 primary CTA color per screen.
- Keep contrast compliant:
  - Normal text: at least WCAG AA (4.5:1).
  - Large text: at least 3:1.

## 3) Typography

### 3.1 Font family

- Primary: `system-ui, -apple-system, Segoe UI, Roboto, sans-serif`.
- Use one family across product unless there is a strong brand requirement.

### 3.2 Font size scale

Use this scale only:

- `12px` caption
- `14px` body-sm / helper
- `16px` body
- `18px` section heading
- `22px` page heading

### 3.3 Font weights

- Regular: `400`
- Medium: `500`
- Semibold: `600`
- Bold: `700` (headings only)

### 3.4 Line height

- Body: `1.45` to `1.6`
- Headings: `1.2` to `1.35`

## 4) Spacing and Layout

Use an 8px spacing grid.

- Allowed spacing tokens: `4, 8, 12, 16, 24, 32, 40`.
- Card padding: `16` or `24`.
- Section gap: minimum `16`.
- Avoid one-off values unless truly necessary.

## 5) Buttons (Consistency Rule)

All buttons must follow the same structure and radius.

### 5.1 Button types

- **Primary**: main action per section.
- **Secondary**: alternative action.
- **Danger**: destructive action only.
- **Link button**: low-emphasis inline actions.

### 5.2 Shared button spec

- Height: `44px` to `46px`
- Horizontal padding: `16px` to `20px`
- Border radius: `10px` to `12px`
- Font: `14px` to `15px`, weight `600`
- Cursor: pointer when enabled

### 5.3 State rules

- Hover: visible change in bg or border.
- Focus: visible ring (keyboard accessible).
- Disabled: reduced opacity + not-allowed cursor + no hover effect.
- Loading: keep width stable and prevent double-click.

## 6) Inputs and Forms

- Inputs and selects should match button height where possible.
- Show clear focus state.
- Label every input (visible label preferred).
- Error messages appear near field and use semantic error color.
- Keep validation text short and actionable.

## 7) Tables

- Sticky header for long lists.
- Right-align numeric/index columns.
- Row hover should be subtle.
- Keep action buttons aligned and consistent across rows.
- Prefer truncation/wrapping strategy per column; avoid random behavior.

## 8) Icons

- Use one icon style set across product.
- Standard sizes: `16` or `20`.
- Never rely on icon alone for critical meaning; pair with text or tooltip.

## 9) Motion

- Duration: `120ms` to `200ms` for hover/focus transitions.
- Avoid large/complex animation on productivity screens.
- Respect reduced-motion preferences where possible.

## 10) Accessibility Baseline

- Keyboard reachable for all interactions.
- Visible focus indicators.
- Semantic HTML first (`button`, `label`, table semantics).
- Do not communicate status by color only.
- Touch targets should be at least `40x40`.

## 11) Component Reuse Policy

- If a style pattern is used 2+ times, extract reusable class/component.
- New variants must be documented before merging.
- Prefer tokens over hard-coded color/size values.

## 12) Definition of Done (UI)

A UI change is complete only when:

- It uses existing design tokens/components where applicable.
- States (hover/focus/disabled/error/loading) are implemented.
- Contrast and keyboard interaction are acceptable.
- Visual style matches this document.

---

## Quick Checklist for PRs

- [ ] Uses approved color roles only
- [ ] Typography follows scale
- [ ] Buttons match shared style and states
- [ ] Spacing follows 8px grid tokens
- [ ] No one-off visual hacks without comment/justification
- [ ] Accessibility checks done (focus, contrast, keyboard)
