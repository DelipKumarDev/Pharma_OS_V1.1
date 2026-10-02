# PharmaOS — Settings ↔ UI/Functionality Audit

**Date:** 2026-10-02
**Trigger:** "big disconnect between settings options and front-end behaviour" — do changes in each Settings tile actually take effect in the UI? Find duplicates / improvements.
**Method:** traced every settings domain from the save path → where (if anywhere) the frontend/backend consumes it; verified the risky ones live.

---

## Root-cause pattern found

Several operational settings are read through `GET /api/settings`, which requires **`settings:view`**. The people who actually use those settings at the counter — cashiers / pharmacists with `billing:create` but **not** `settings:view` — get a 403, which the UI swallows into defaults. So the admin's configuration silently did nothing for the exact users who needed it.

Two concrete instances were found and fixed:
1. **Accepted payment methods** (earlier fix): POS read the wrong source *and* that source needed `settings:view`. Now carried on the auth user as `acceptedPaymentMethods`.
2. **Receipt header + GST/thank-you/terms + pharmacy profile on printed bills**: `printBill()` fetched `/api/settings` → cashiers printed bare receipts. Fixed via a new **`GET /api/settings/public`** (authenticated, no `settings:view`) returning the non-sensitive operational subset.

---

## Per-tile status

| Tile / section | Setting | Consumer | Status |
|---|---|---|---|
| **Pharmacy Profile** | name, logo, address, GST, licences, phone/email | header, printed receipts | ✅ works |
| **Tax & Billing** | GST enable / default GST | billing GST calc (backend) | ✅ works |
| | Payment methods accepted | POS buttons | ✅ **fixed** → `user.acceptedPaymentMethods` |
| | showGSTOnReceipt / showGenericName / terms / thankYou | printed receipt | ✅ **fixed** → `/api/settings/public` (was broken for cashiers) |
| | **Auto-print receipt on sale** (`printReceiptOnSale`) | POS after payment | ✅ **fixed** — POS always printed, now honours the toggle |
| **Receipt Configuration** | paper size + print toggles (address/phone/GSTIN/DL, batch/expiry/HSN/GST breakdown/doctor, QR, footer…) | printed receipt | ✅ works (via `/public` now, so cashiers get it too) |
| **Notifications** | lowStockAlert / expiryAlert / email / sms toggles | alerts cron job (`jobs/alerts.job.ts`) | ✅ works (backend) |
| **Message Templates** | refillReminder wording | WhatsApp refill (`lib/reminder.ts`) | ✅ works; alert templates used by the cron job |
| **Preferences** | currency / date format | `setActiveCurrency/DateFormat` → all `formatCurrency/formatDate` | ✅ works (live, no reload) |
| | low-stock threshold / expiry-alert days | inventory + dashboard + expiry + scan + alerts (backend) | ✅ works |
| | timezone | — | ⚠️ stored, not applied client-side (minor) |
| | auto-backup / frequency | backup job | ✅ works (backend) |
| **Dropdown Options** | list options (category/form/unit/gst/customerType) | `useDropdown` | ✅ works (customerType reconciled earlier) |
| **Form Fields** | show/require/label per field | `useFormFieldConfig` (**10 forms**) | ✅ works |
| **Access Control** | menu/tab visibility per role | `menuHidden` / sidebar + route guard | ✅ works |
| **Change Password** | — | auth API | ✅ functional |
| **Import & Export / Backup** | bulk import/export/backup | settings API (admin) | ✅ functional |
| **Integrations** | — | external page | placeholder (no tenant config to reflect) |

---

## Duplicates / improvements

- **Receipt settings split across two tiles** — ✅ **DONE.** The Tax & Billing receipt-content controls (`showGSTOnReceipt`, `showGenericName`, `termsOnReceipt`, `thankYouMessage`, auto-print) were moved into **Receipt Configuration** (new "Content & Behaviour" group). Tax & Billing now holds only GST + payment methods. Each section saves its own non-overlapping slice of the `billing` section (partial PATCH), so there's no cross-overwrite. Verified live: editing the thank-you in Receipt Configuration persists and is read back via `/api/settings/public`.
- **`paymentMethod` dropdown** (Dropdown Options) — removed earlier; the Tax & Billing "Payment Methods Accepted" toggles are now the single source of truth.
- **Backup** appears under both "Preferences" (auto-backup) and "Data Management → Import & Export" (manual backup) — related but not identical (schedule vs on-demand); acceptable.

---

## Fixed in this pass (committed)

- `GET /api/settings/public` — operational settings for POS/receipts without `settings:view`.
- `printBill()` + POS pharmacy-settings query now read `/api/settings/public` → cashiers get the full receipt header, GST display, thank-you, terms, UPI QR.
- POS honours **Auto-print receipt on sale** instead of always printing.
- (Earlier) accepted payment methods carried on the auth user + live `patchUser` on save.

*This audit is the working checklist; the receipt-tile consolidation is the one open recommendation.*
