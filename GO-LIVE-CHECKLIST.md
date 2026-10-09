# PharmaOS — Go-Live Checklist (Step 1: Deployment Hardening → Pilot)

> Follow top to bottom. Every command is copy-pasteable and matches this repo
> (`docker-compose.yml`, `apps/api/Dockerfile`, `nginx/nginx.conf`).
> Target: a single VPS running Docker, serving one pilot pharmacy over HTTPS.
> Estimated time: half a day.

---

## Part 0 — Before you touch a server (15 min)

- [ ] **Pick a domain/subdomain** for the pilot, e.g. `billing.yourpharmacy.in`.
- [ ] **Buy a small VPS** (DigitalOcean / Hetzner / AWS Lightsail). Minimum for a pilot:
      **2 vCPU, 4 GB RAM, 40 GB SSD**, Ubuntu 22.04/24.04. (~₹500–900/mo.)
- [ ] **Point DNS**: create an **A record** for your subdomain → the VPS public IP.
      Wait for it to resolve (`ping billing.yourpharmacy.in` shows the VPS IP).

---

## Part 1 — Provision the server (15 min)

SSH in as a sudo user, then:

```bash
# Install Docker Engine + compose plugin
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker

# Basic firewall: allow SSH + HTTP + HTTPS only
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443
sudo ufw --force enable

# Get the code
git clone <your-repo-url> pharmaos && cd pharmaos
```

---

## Part 2 — Generate secrets & write `.env` (10 min)  ⚠️ CRITICAL

The `docker-compose.yml` reads these from a `.env` file **at the repo root**.
**Never reuse the dev JWT values.** Generate fresh ones:

```bash
# Run these and copy each output
openssl rand -base64 48    # → JWT_SECRET
openssl rand -base64 48    # → JWT_REFRESH_SECRET
openssl rand -base64 24    # → DB_PASSWORD
```

Create the root `.env`:

```bash
cat > .env <<'EOF'
# --- Database ---
DB_PASSWORD=<paste the 24-char secret>

# --- Auth (MUST be unique, never the dev values) ---
JWT_SECRET=<paste first 48-char secret>
JWT_REFRESH_SECRET=<paste second 48-char secret>

# --- Public origin (used for CORS) ---
APP_ORIGIN=https://billing.yourpharmacy.in

# --- Email (required for password reset + alerts) ---
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-alerts@yourpharmacy.in
SMTP_PASS=<gmail app password / SES SMTP password>
EMAIL_FROM=PharmaOS <your-alerts@yourpharmacy.in>

# --- SMS/WhatsApp (optional for pilot; leave blank to skip) ---
SMS_PROVIDER=
MSG91_AUTH_KEY=
MSG91_SENDER_ID=PHRMOS
EOF

chmod 600 .env      # lock it down
```

- [ ] `.env` created with **fresh** JWT secrets (verified NOT the dev defaults).
- [ ] `.env` is git-ignored (it is by default — never commit it).

---

## Part 3 — TLS certificate (10 min)

Get a free Let's Encrypt cert and place it where nginx expects (`./nginx/certs/`):

```bash
sudo apt-get update && sudo apt-get install -y certbot
# Port 80 must be free right now (compose not started yet)
sudo certbot certonly --standalone -d billing.yourpharmacy.in

mkdir -p nginx/certs
sudo cp /etc/letsencrypt/live/billing.yourpharmacy.in/fullchain.pem nginx/certs/fullchain.pem
sudo cp /etc/letsencrypt/live/billing.yourpharmacy.in/privkey.pem   nginx/certs/privkey.pem
sudo chown $USER:$USER nginx/certs/*.pem
```

- [ ] `nginx/certs/fullchain.pem` and `nginx/certs/privkey.pem` exist.
- [ ] (Optional) set the `server_name _;` in `nginx/nginx.conf` to your real domain.

---

## Part 4 — Build, start, seed (15 min)

```bash
# Build all images and start db + api + web + nginx
docker compose up -d --build

# Watch the API come up (it auto-runs `prisma migrate deploy` on start)
docker compose logs -f api      # Ctrl-C once you see "PharmaOS API running"

# Seed the first pharmacy ONCE (tsx ships in the image)
docker compose exec api npx tsx prisma/seed.ts
```

- [ ] `docker compose ps` shows db, api, web, nginx all **Up**.
- [ ] Migrations applied (log shows `migrate deploy` success).
- [ ] Seed completed (creates tenant, roles, permissions, demo medicines).

### ⚠️ Immediately change the seeded admin password
The seed creates `admin@divyacare.test` / `Divya@Care2026` — a **known default**.
Log in as admin in the browser and change it under **Settings/profile**, OR via API:

```bash
# get a token, then change password (replace NEWPASS with a strong one)
TOKEN=$(curl -s -X POST https://billing.yourpharmacy.in/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@divyacare.test","password":"Divya@Care2026"}' | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

curl -s -X POST https://billing.yourpharmacy.in/api/auth/password/change \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"currentPassword":"Divya@Care2026","newPassword":"NEWPASS_Strong@1"}'
```

- [ ] Default admin password changed.
- [ ] Rename the tenant/pharmacy to the real pharmacy under **Settings → Profile**.

---

## Part 5 — Post-deploy smoke test (10 min)

Run these from your laptop against the **live HTTPS** URL:

```bash
BASE=https://billing.yourpharmacy.in

# 1. HTTP → HTTPS redirect
curl -sI http://billing.yourpharmacy.in | grep -i location      # expect https://

# 2. Health
curl -s $BASE/health                                            # {"status":"ok"...}

# 3. Login (with the NEW admin password)
curl -s -X POST $BASE/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@divyacare.test","password":"NEWPASS_Strong@1"}'  # tokens returned

# 4. Unauthenticated call is blocked
curl -s -o /dev/null -w "%{http_code}\n" $BASE/api/medicines     # expect 401
```

Then in a browser at `https://billing.yourpharmacy.in`:
- [ ] Padlock shows a valid certificate (no warning).
- [ ] Log in → dashboard loads.
- [ ] Create one test bill end-to-end → prints/records correctly.
- [ ] **Password reset works** — click "Forgot password", confirm the OTP email actually arrives (proves SMTP).
- [ ] Log in as a non-admin role → confirm restricted areas are blocked.
- [ ] Delete the test bill / reset to clean before handing over.

---

## Part 6 — Ops hardening (before real daily use)

- [ ] **Automated daily DB backup** (cron). The API already writes to `/backups`; add a host cron for a real SQL dump too:
  ```bash
  # /etc/cron.daily/pharmaos-backup
  docker compose -f /home/USER/pharmaos/docker-compose.yml exec -T db \
    pg_dump -U pharmaos pharmaos | gzip > /home/USER/backups/pharmaos-$(date +\%F).sql.gz
  # keep 14 days
  find /home/USER/backups -name '*.sql.gz' -mtime +14 -delete
  ```
  Copy backups off-server (S3 / another machine) — a backup on the same VPS is not a backup.
- [ ] **Cert auto-renewal**: `sudo certbot renew --dry-run`, then add a monthly cron that renews and re-copies the pem files into `nginx/certs/` + `docker compose restart nginx`.
- [ ] **Log rotation** for Docker (`/etc/docker/daemon.json` → `"log-driver":"json-file","log-opts":{"max-size":"10m","max-file":"3"}`), then `sudo systemctl restart docker`.
- [ ] **Uptime monitor** (UptimeRobot/BetterStack) pinging `/health` every 5 min.
- [ ] **Confirm** `docker compose ps` restart policy is `unless-stopped` (it is) so it survives reboots.

---

## Part 7 — What is intentionally NOT in this checklist

These are **out of scope for a controlled pilot** but required before charging money / scaling:

| Deferred | Why it can wait for pilot | Needed before GA |
|----------|---------------------------|------------------|
| Independent security pen-test | Self-QA covered the basics; RBAC hole fixed | Yes — patient + Schedule-H data |
| CA review of GSTR-1 output | Not filing during a short pilot | Yes — before you rely on it for tax |
| Second-tenant isolation test | Pilot is one pharmacy | Yes — before onboarding customer #2 |
| Real load test (100s of users) | Pilot is low volume | Yes — before broad launch |
| SMS/WhatsApp provider | Email covers pilot alerts | Recommended |
| Subscription/billing system | Pilot is free | Yes — if selling as SaaS |
| A11y (axe/Lighthouse) pass | Non-blocking | Recommended |

---

## Definition of "pilot-ready" (all must be checked)

- [ ] Deployed on a real server over **HTTPS** with a valid cert.
- [ ] **Fresh** JWT secrets + DB password (no dev values anywhere).
- [ ] Default admin password **changed**; pharmacy profile set to the real shop.
- [ ] **Password-reset email verified** to actually arrive.
- [ ] Smoke test (Part 5) fully green.
- [ ] Automated **off-server backups** running.
- [ ] Uptime monitor live.

When every box above is ticked, you can put your **first pilot pharmacy** on it.
Watch it for 2–4 weeks, close the pilot findings, then work Part 7 before opening
to paying customers.
