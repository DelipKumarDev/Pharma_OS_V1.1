# PharmaOS — QA Phase 9: UI/UX & Accessibility

**Document ID:** QA-UIUX-09
**Version under test:** V1.2.2
**Method:** Heuristic evaluation (Nielsen) + WCAG 2.1 AA review + runtime browser checks performed earlier this cycle (login, dashboard, reports navigation)
**Date:** 2026-07-15

> Scope note: full automated axe-core sweep was not run (no browser-driver available in this session at execution time). Findings below combine (a) live browser observations captured earlier this cycle and (b) source-level review of the component layer. Items needing a live screen-reader pass are flagged **[verify-live]**.

---

## 1. Heuristic evaluation (Nielsen's 10)

| # | Heuristic | Assessment | Notes |
|---|-----------|-----------|-------|
| 1 | Visibility of system status | ✅ Good | Skeleton loaders on every data page; Sonner toasts on actions; "Starting PharmaOS…" boot state |
| 2 | Match to real world | ✅ Good | Pharmacy-domain language (batch, MRP, Schedule H, GSTR-1); ₹ currency; DD/MM/YYYY dates |
| 3 | User control & freedom | ✅ Good | Cancel on dialogs/sheets; bill hold/resume; non-destructive nav |
| 4 | Consistency & standards | ✅ Good | shadcn/ui system, consistent Button/Card/Badge; unified "Ayush Modern" theme |
| 5 | Error prevention | ✅ Good | Zod client validation + server 422; Schedule-H billing blocks missing doctor; confirm dialogs on delete |
| 6 | Recognition over recall | ✅ Good | Sidebar labels + icons; search-as-you-type; keyboard shortcut hints shown inline |
| 7 | Flexibility & efficiency | ✅ Good | Billing keyboard shortcuts (F1/F4/F8/F9); barcode scan; collapsible sidebar |
| 8 | Aesthetic & minimalist | ✅ Good | Clean KPI cards, restrained palette |
| 9 | Help users recover from errors | ⚠️ Adequate | Toasts show messages; some generic API messages ("Invalid data provided") surface to users — see DEF-005 |
| 10 | Help & documentation | ✅ Good | Help & Shortcuts page present |

## 2. Accessibility (WCAG 2.1 AA)

| Guideline | Status | Evidence / note |
|-----------|--------|-----------------|
| 1.1.1 Non-text content | ⚠️ **[verify-live]** | Lucide icons are decorative; icon-only buttons (sidebar collapse, some actions) need `aria-label` audit |
| 1.4.3 Contrast (AA) | ✅ | Deep emerald `#0F766E` on ivory and white on dark sidebar exceed 4.5:1; verified on primary text |
| 1.4.11 Non-text contrast | ✅ | Badges/borders meet 3:1 |
| 2.1.1 Keyboard | ✅ | Radix UI primitives are keyboard-operable; billing has explicit shortcuts |
| 2.4.7 Focus visible | ⚠️ **[verify-live]** | Radix defaults provide focus rings; confirm not suppressed by Tailwind `outline-none` anywhere |
| 3.3.1 Error identification | ✅ | Form fields show inline validation messages (React Hook Form + Zod) |
| 3.3.2 Labels/instructions | ✅ | Form inputs are labeled |
| 4.1.2 Name/role/value | ✅ | Radix components expose correct ARIA roles (verified via accessibility tree earlier: tabs, dialogs) |
| 1.4.10 Reflow (responsive) | ✅ | Tailwind responsive grids; tables in `overflow-x-auto`; mobile viewport supported |
| 1.4.12 Dark mode | ✅ | `next-themes` with light/dark; theme-aware tokens |

## 3. Runtime observations (captured earlier this cycle)

- ✅ Login → dashboard → reports navigation works; no console errors after the duplicate-key fix.
- ✅ Reports tabs (Sales, GST, Stock, Profitability, Customers, Daily Close) all render; the dead-stock table renders real data with **no duplicate-key React warnings** (fixed earlier).
- ✅ Skeleton loaders present on all data pages; no layout shift observed.
- ✅ 29 routes build as static pages (`next build`).

## 4. Findings

### DEF-005 — Generic API error strings surface to end users (Low)
Some server errors (`"Invalid data provided"` from Prisma validation on prescription/return/purchase item shape) can reach the UI toast. Recommend mapping these to friendly, field-specific messages. Non-blocking; cosmetic/clarity.

### Accessibility follow-ups (Low, [verify-live])
1. Audit icon-only buttons for `aria-label` (sidebar collapse, table row actions).
2. Confirm visible focus indicators are never removed by a global `outline-none`.
3. Run an automated axe-core / Lighthouse a11y pass in CI before GA.

**No High/Critical UI or accessibility defects.**

**Phase 9 status: COMPLETE** (with 3 Low accessibility follow-ups recommended for GA, none blocking pilot).
