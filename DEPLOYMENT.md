# PharmaOS — Production Deployment Guide

Two supported paths: **Docker Compose** (recommended — one server runs everything) and **bare-metal** (Node + PostgreSQL installed directly, e.g. on a shop PC).

---

## Option A — Docker Compose (recommended)

### Prerequisites
- A Linux VPS (2 GB RAM minimum — DigitalOcean/Hetzner/AWS Lightsail ~₹500–800/mo) or a shop PC running Docker Desktop
- A domain (e.g. `billing.divyapharmacy.in`) pointed at the server
- Docker Engine 24+ with the compose plugin

### Steps

```bash
# 1. Clone the repo on the server
git clone <your-repo-url> pharmaos && cd pharmaos

# 2. Create the environment file
cat > .env << 'EOF'
DB_PASSWORD=<strong-random-password>
JWT_SECRET=<openssl rand -base64 48>
JWT_REFRESH_SECRET=<openssl rand -base64 48>
APP_ORIGIN=https://billing.divyapharmacy.in
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=alerts@divyapharmacy.in
SMTP_PASS=<gmail-app-password>
EOF

# 3. TLS certificate (Let's Encrypt)
sudo certbot certonly --standalone -d billing.divyapharmacy.in
mkdir -p nginx/certs
cp /etc/letsencrypt/live/billing.divyapharmacy.in/fullchain.pem nginx/certs/
cp /etc/letsencrypt/live/billing.divyapharmacy.in/privkey.pem nginx/certs/

# 4. Build and start
docker compose up -d --build

# 5. Seed the first pharmacy (once)
docker compose exec api npx tsx prisma/seed.ts
```

The app is now at `https://billing.divyapharmacy.in`. The API is proxied under `/api/`, plain HTTP redirects to HTTPS.

### Updating

```bash
git pull && docker compose up -d --build
```

Migrations run automatically on API container start (`prisma migrate deploy`).

### Backups

- In-app: Settings → Import & Export → **Backup Now** (pg_dump inside the api container, stored in the `backups` volume)
- Cron (recommended): on the host,
  ```bash
  # /etc/cron.daily/pharmaos-backup
  docker compose -f /path/to/pharmaos/docker-compose.yml exec -T db \
    pg_dump -U pharmaos pharmaos | gzip > /var/backups/pharmaos-$(date +%F).sql.gz
  find /var/backups -name 'pharmaos-*.sql.gz' -mtime +30 -delete
  ```
- Restore: `gunzip -c backup.sql.gz | docker compose exec -T db psql -U pharmaos pharmaos`

---

## Option B — Bare metal (shop PC / Windows)

Suitable for a single pharmacy running everything on the billing counter PC.

### Prerequisites
- Node.js 20 LTS, pnpm 9+, PostgreSQL 15+

### Steps

```powershell
# 1. Database
psql -U postgres -c "CREATE DATABASE pharmaos;"

# 2. Configure
copy apps\api\.env.example apps\api\.env
# Edit apps/api/.env — set DATABASE_URL, generate JWT secrets

# 3. Install + migrate + seed
pnpm install
pnpm --filter @pharmaos/api prisma:generate
pnpm --filter @pharmaos/api prisma:migrate:deploy
pnpm --filter @pharmaos/api db:seed

# 4. Build
pnpm build

# 5. Run as Windows services (auto-start on boot) using NSSM or pm2
npm i -g pm2 pm2-windows-startup
pm2 start "pnpm --filter @pharmaos/api start" --name pharmaos-api
pm2 start "pnpm --filter web start" --name pharmaos-web
pm2 save && pm2-startup install
```

Open `http://localhost:3000` on the counter PC. Other devices on the shop Wi-Fi can use `http://<pc-ip>:3000`.

> ⚠ On bare metal without Nginx there is no HTTPS. Keep this setup on a trusted LAN only; use Option A for anything internet-facing.

---

## Production checklist

| Item | How |
|------|-----|
| ✅ Unique JWT secrets | `openssl rand -base64 48` × 2 — never reuse dev values |
| ✅ Strong DB password | Random 24+ chars |
| ✅ HTTPS | Nginx + Let's Encrypt (Option A) |
| ✅ Daily DB backup | Cron pg_dump (above) + periodic off-site copy |
| ✅ SMTP configured | Real OTP/alert email delivery |
| ✅ SMS provider (optional) | MSG91 (needs DLT registration) or Twilio |
| ✅ Rate limits | Defaults are production-safe (300 req/15 min, 5 login attempts) |
| ✅ Firewall | Only 80/443 exposed; DB port 5432 never public |
| ✅ Seed credentials rotated | Change the `Divya@Care2026` demo passwords immediately after first login |

## Thermal printer setup (billing counter)

1. Install the printer's Windows driver (Epson TM-T82, etc.) and set paper width to **80 mm**.
2. In Chrome/Edge, print once manually: select the thermal printer, set margins to **None**, disable headers/footers, and tick "remember settings".
3. PharmaOS receipts are formatted for 72 mm printable width — no further configuration needed.
4. Barcode scanners: any USB keyboard-wedge scanner works out of the box (press `F8` on the billing screen). Camera scanning works on Chrome/Edge via the Camera button.
