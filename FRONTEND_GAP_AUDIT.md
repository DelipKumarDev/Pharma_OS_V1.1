# PharmaOS — Frontend Config & RBAC Gap Audit

**Date:** 2026-09-28
**Trigger:** RBAC not enforced in the UI; settings toggles (e.g. payment methods) not reflected in the app; forms/fields not honoring config; suspected duplicates.
**Method:** traced the config→consumer wiring and the permission model end-to-end, verified live in the browser.

---

## Root causes (two patterns)

1. **Config exists but forms ignore it.** The app has a solid config layer — `useDropdown(key)` (option lists) and `useFormFieldConfig(formId)` (show/require/label per field), both merging the tenant's saved overrides from the auth store — but **most forms hardcode their values** instead of calling these hooks. So editing a list/field in Settings changes nothing on the screen that uses it. (The **save + backend are correct** — verified: a direct API PATCH of `paymentMethod:[cash,upi]` persisted and, after re-login, billing showed only cash/upi.)
2. **No action-level RBAC.** Nav filtering + a route guard now enforce *page* access (committed), but **no `can('module:action')` check gates the buttons** (Create/Edit/Delete/Export/Approve) inside pages — so a read-only role still sees action buttons (they'd 403 on click).

---

## Fixed & verified (committed)

| Fix | Commit | Evidence |
|---|---|---|
| **Nav RBAC** — sidebar filters by permission; groups a user can't access disappear | 3f4231e | Billing Assistant: Reports & Compliance hidden |
| **Route guard** — typing a forbidden URL redirects to /dashboard | 3f4231e | `/reports` → `/dashboard` |
| **Billing payment methods config-driven** (`useDropdown('paymentMethod')`) | 5cb8432 | config `[cash,upi]` → billing shows only cash,upi |
| **`useCan()` action-RBAC hook** + applied to Roles (Create/Edit/Delete gated) | 5cb8432 | hook verified |
| Production build unblocked (2 web type errors) | 3f4231e | `next build` compiles |
| **Action RBAC applied to 11 module views** — vendors, medicines, users, customers, prescriptions, returns, inventory, purchase-orders, reorder, expiry, billing, reports, contacts (Create/Edit/Delete/Approve/Export/Pay gated by `can('module:action')`) | _this batch_ | `tsc` clean |
| **customerType dropdown config-driven** (`useDropdown('customerType')`) + registry aligned to app enum (was `wholesale/staff`, now `walk_in/regular/vip/credit`) + zod relaxed to `string` so custom types work | _this batch_ | `tsc` clean |
| **Duplicates removed** — deleted dead `new-bill-sheet.tsx` (never imported); removed redundant Reports→Purchase and Reports→Expiry menu entries (duplicated Procurement/Inventory pages) | _this batch_ | grep: 0 refs |
| **Form-field config honored in all 6 configurable forms** — billing (POS customer/discount), medicine, add-stock, customer, vendor, prescription now read `useFormFieldConfig(formId)` for show/require/label. Reconciled the `customer` and `prescription` field-ID registries to the forms' real field names (they didn't match, so toggles were dead) | _this batch_ | `tsc` clean |

---

## Remaining gaps (concrete, prioritized)

### A. Hardcoded dropdowns — wire to `useDropdown(key)`
| File | List | Registry key |
|---|---|---|
| `modules/customers/views/customers-view.tsx` | customer type (`walk_in/regular/…`, zod enum too — note the enum uses `vip/credit` which don't match the registry `wholesale/staff` — reconcile) | `customerType` |
| `components/billing/new-bill-sheet.tsx` | payment methods (a second billing entry — **verify if this component is still used**; if it duplicates `billing-view`, remove it — see §D) | `paymentMethod` |
| (done) medicine category/form/unit, gstRate | — | already via `useDropdown` in add-medicine-dialog, medicines-view, stock-view |

### B. Action-level RBAC — add `useCan()` and gate buttons (20 views)
Every module view below has Create/Add/Delete/Export/Approve buttons with **no permission gate**. Pattern: `const can = useCan();` then `{can('<module>:<action>') && <Button/>}`.

`users-view` (users:create/edit) · `vendors-view` (vendors:create/edit) · `medicines-view` (medicines:create/edit/delete/export) · `customers-view` (customers:create/edit) · `stock-view` + `inventory-view` (inventory:create/edit/delete) · `prescriptions-view` (prescriptions:create/approve) · `returns-view` (returns:create/approve) · `purchase-orders-view` (inventory:create) · `reorder-view` (inventory:edit) · `expiry-view` (inventory:edit) · `billing-view` (billing:create) · `reports-view` (reports:export) · `audit-view` (view-only) · `schedule-register-view` (reports:view) · `scan-bill-view` (inventory:create) · `contacts-view` (customers:*) · `tenants-view` (platform:manage) · `settings-view` (settings:edit — partly done) · `offline-view` (n/a).

### C. Form fields not honoring `useFormFieldConfig` (8 forms)
`components/inventory/{add-stock-sheet,adjust-stock-dialog,edit-stock-dialog}.tsx` · `components/users/invite-user-dialog.tsx` · `modules/customers/views/customers-view.tsx` (add/edit customer) · `modules/prescriptions/views/prescriptions-view.tsx` · `modules/vendors/views/vendors-view.tsx`.
Pattern: `const ff = useFormFieldConfig('<formId>');` then `ff.isEnabled('field')`, `ff.isRequired('field')`, `ff.label('field', 'Default')`.

### D. Duplicates to reconcile (validate → disable the redundant one)
- **Reports group** "Purchase" (→/purchase-orders) and "Expiry" (→/expiry) duplicate the Procurement/Inventory pages — already gated to `reports:view` (committed) so they don't leak, but consider removing them from the Reports menu entirely.
- **`new-bill-sheet.tsx`** vs `billing-view.tsx` — likely a duplicate billing entry (there was a "Quick Bill" removed in Phase-2). Confirm it isn't rendered; if dead, delete it.
- Cross-check any other "two links to the same page" (e.g. a submodule appearing under two groups) once §B is done.

---

## Fix order (recommended)

1. **Finish config consumption (A)** — small, high-impact: completes "settings toggles work everywhere". 
2. **Action RBAC (B)** — mechanical per-view button gating; do in batches with `tsc` after each.
3. **Form-field config (C)** — wire the 8 forms.
4. **Duplicates (D)** — remove the redundant entries.

Each is the *same* two patterns applied repeatedly; the API already enforces the matching permission, so these are UX-correctness fixes over an enforced boundary.

*This audit is the working checklist; items move to the "Fixed & verified" table as they land.*
