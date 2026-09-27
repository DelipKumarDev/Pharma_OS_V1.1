# PharmaOS — Customer Tenant Onboarding Runbook (Phase 8)

**Date:** 2026-09-26
**Objective:** A safe, idempotent tenant provisioning workflow and a platform-operator lifecycle — resolving the Phase-0 **P0-03** (no real provisioning) and completing **P0-02** (platform/super-admin separation).
**Result:** ✅ Provisioning + lifecycle implemented and verified — **11/11 onboarding assertions PASS**, no regression (security 32/32, auth 14/14, integrity 5/5).

---

## 1. Roles in the system

| Actor | Identity | Can do |
|---|---|---|
| **Platform operator** | user with the `platform:manage` permission (lives in the `platform` tenant) | provision tenants, view/suspend/reactivate/deactivate tenants, reset a tenant's owner, view tenant health |
| **Tenant owner** | first "Pharma Admin" of a pharmacy | full access to *their* pharmacy only |
| **Tenant staff** | Pharmacist / Inventory Manager / Billing Assistant / Reports Viewer | scoped by role |

`platform:manage` is **never** granted to a pharmacy role — the default roles created for each tenant exclude it, so no tenant admin can provision or see other tenants (verified by the cross-tenant + auth suites).

---

## 2. Bootstrap the platform operator (once per deployment)

```bash
# In the api container (or where DATABASE_URL + the code are available):
SUPER_ADMIN_EMAIL=ops@your-company.com SUPER_ADMIN_PASSWORD='<strong 12+ char password>' \
  pnpm --filter @pharmaos/api platform:admin
# or: npx tsx scripts/create-platform-admin.ts <email> <password>
```
Idempotent — creates/updates the `platform` tenant, the `platform:manage` permission, a **Platform Operator** role, and the operator user. Re-running is safe.

**Verified:** created `ops@pharmaos.test`; the operator can log in and provision.

---

## 3. Provision a pharmacy (the workflow)

`POST /api/tenants` (platform operator only). Runs atomically and **idempotently**:

```
Create/So-far Tenant (status: trial)
  → ensure global Permission catalog
  → create default Roles (Pharma Admin, Pharmacist, Inventory Manager, Billing Assistant, Reports Viewer) + grants
  → create Owner user (strong random temp password, status: pending, mustChangePassword: true)
      → assign Pharma Admin role
  → write Audit records (module: platform)
  → send invitation email (best-effort; temp password also returned to the operator)
```

**Request:**
```bash
curl -sk https://<domain>/api/tenants -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H 'Content-Type: application/json' -d '{
    "name": "Divya Care Pharmacy", "slug": "divya-care", "type": "retail", "plan": "starter",
    "city": "Bengaluru", "state": "Karnataka", "gstNumber": "29ABCDE1234F1Z5",
    "drugLicenseNumber": "KA-B-2026-001",
    "ownerName": "Dr. Divya Rao", "ownerEmail": "owner@divyacare.example.com", "ownerPhone": "9876500000"
  }'
```
**Response (201):** `{ tenant, owner:{id,email,name}, tempPassword, alreadyExisted:false }`. Hand the **temporary password** to the owner over a secure channel (it is also emailed if SMTP is configured).

**Idempotency & duplicate prevention:**
- Re-running with the same `slug` returns **200 `alreadyExisted:true`** and creates **no** duplicate tenant/owner (verified: tenants=1, owners=1 after two calls).
- The `slug` is globally unique; a previously **deactivated** slug is refused (409) to avoid reviving stale data by accident.
- No insecure default password — a 14-char policy-compliant random temp password is generated per owner.

**Verified:** provision → 201 + tempPassword; 5 default roles created; owner `mustChangePassword=true`, status `pending`, Pharma Admin role.

---

## 4. First sign-in — forced password change

1. Owner logs in with `ownerEmail` + temp password → **200**; the login response carries **`user.mustChangePassword: true`**. (Status `pending` → `active` on first successful login.)
2. The frontend must route a `mustChangePassword` user to **change password** before anything else.
3. `POST /api/auth/password/change` (currentPassword = temp, newPassword = policy-compliant) → clears the flag, invalidates old sessions/tokens.
4. Subsequent logins return `mustChangePassword: false`; the old temp password no longer works.

**Verified:** login flags must-change; after change, flag clears, new password works, **old password → 401**.

---

## 5. Platform lifecycle operations (all audited)

| Action | Endpoint | Effect |
|---|---|---|
| List tenants | `GET /api/tenants` | operator sees **all**; a tenant user sees only their own |
| View tenant | `GET /api/tenants/:id` | operator any; tenant user own only |
| **Tenant health/metadata** | `GET /api/tenants/:id/health` | users/activeUsers/medicines/bills, last activity, GST/DL, status, plan |
| **Activate / suspend / etc.** | `PATCH /api/tenants/:id/status` `{status}` | on non-operational status, **kills the tenant's sessions + tokens immediately** |
| **Reset tenant admin** | `POST /api/tenants/:id/reset-admin` | new temp password (must-change), invalidates the owner's sessions |
| **Deactivate (soft-delete)** | `DELETE /api/tenants/:id` | suspend + soft-delete; sessions killed |

**Tenant suspension is enforced at the request layer** — `authenticate` checks the tenant's status/deletedAt on every request, so a suspended pharmacy's users are blocked instantly (even if they hold a valid token or re-login), and reactivation restores access.

**Every platform action writes an audit record** (`module: platform`, actor recorded) — super-admin functions do **not** bypass auditing.

**Verified:** health 200; suspend → owner request **403**, reactivate → **200**; reset-admin → old pw **401**, new temp works with must-change; **5 platform audit logs** recorded for the test tenant.

---

## 6. Onboarding checklist (hand to the pharmacy)

After first sign-in, the owner should:
1. Change the temporary password (forced).
2. Complete the pharmacy profile (Settings → name, address, GSTIN, drug licence, logo).
3. Configure tax/billing and receipt (paper size, footer).
4. Create staff users and assign roles (Pharmacist/Inventory/Billing/Reports).
5. Import or add opening stock (medicines + inventory).
6. Add key vendors and customers.
7. Print a test bill and confirm the receipt + UPI QR.

---

## 7. Verification

**Suite:** `apps/api/scripts/onboarding.test.ts` · **Run:** `pnpm --filter @pharmaos/api test:onboarding`. Synthetic data; self-cleaning.

| Assertion | Result |
|---|---|
| Provision → 201 + temp password + owner | **PASS** |
| Default roles created (5) | **PASS** |
| Owner: must-change + pending + Pharma Admin | **PASS** |
| Owner login flags must-change | **PASS** |
| Forced password change clears flag; old pw fails | **PASS** |
| Idempotent re-provision (no duplicates) | **PASS** |
| Platform gate: non-platform admin → 403 | **PASS** |
| Tenant health/metadata | **PASS** |
| Suspend → 403, reactivate → 200 | **PASS** |
| Reset admin (temp, old fails, must-change) | **PASS** |
| Platform actions audited (>0) | **PASS** |
| **Total** | **11/11 PASS** |

Regression after Phase 8 changes (tenant status in `authenticate`, `mustChangePassword`): **security 32/32, auth 14/14, integrity 5/5**, `tsc --noEmit` exit 0.

---

## 8. Status

| Item | Status |
|---|---|
| Idempotent tenant provisioning | **PASS** |
| Duplicate tenant/owner prevention | **PASS** |
| No insecure default passwords | **PASS** (random temp, must-change) |
| Default roles + permissions per tenant | **PASS** |
| Platform/super-admin separation (P0-02) | **PASS** |
| Tenant lifecycle (create/view/activate/suspend/deactivate/reset/health) | **PASS** |
| Suspension enforced immediately | **PASS** |
| Super-admin actions audited | **PASS** |
| Invitation email | **PASS** (best-effort; needs SMTP to deliver) |
| Frontend "must change password" screen | **NOT VERIFIED** (backend flag ready; UI enforcement is a web task) |

*Provisioning + platform lifecycle are complete and verified. The one remaining piece is the frontend forcing the password-change screen on the `mustChangePassword` flag (the backend exposes it and blocks the old password). Phase 8 complete — awaiting approval before Phase 9 (End-to-End Pharmacy Pilot).*
