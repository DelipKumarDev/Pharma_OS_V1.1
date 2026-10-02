/**
 * Pilot reset: snapshot all data to a JSON backup, then wipe every table except
 * the migrations table and the global Permission catalog. Leaves a clean DB for
 * a fresh pilot. Platform operator is re-created afterwards by
 * create-platform-admin.ts. Run: npx tsx scripts/reset-data.ts <backupPath>
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();
const KEEP = new Set(['_prisma_migrations', 'Permission']);

async function main() {
  const backupPath = process.argv[2] ?? `backup-before-pilot-${Date.now()}.json`;

  const tables: { tablename: string }[] = await prisma.$queryRawUnsafe(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`,
  );
  const names = tables.map((t) => t.tablename);

  // ── Snapshot (best-effort) ──
  const snapshot: Record<string, unknown> = {};
  for (const name of names) {
    try {
      snapshot[name] = await prisma.$queryRawUnsafe(`SELECT * FROM "${name}"`);
    } catch (e) { snapshot[name] = `__skip__ ${(e as Error).message}`; }
  }
  fs.writeFileSync(backupPath, JSON.stringify(snapshot, (_k, v) => (typeof v === 'bigint' ? Number(v) : v), 2));
  const counts = Object.fromEntries(names.map((n) => [n, Array.isArray(snapshot[n]) ? (snapshot[n] as unknown[]).length : 0]));
  console.log(`📦 Backup → ${backupPath}`);
  console.log('   rows:', JSON.stringify(counts));

  // ── Wipe ──
  const toWipe = names.filter((n) => !KEEP.has(n));
  const quoted = toWipe.map((n) => `"${n}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`);
  console.log(`🧹 Truncated ${toWipe.length} tables (kept: ${[...KEEP].join(', ')})`);

  // sanity
  const tenantCount: { count: bigint }[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::bigint AS count FROM "Tenant"`);
  console.log(`   tenants now: ${Number(tenantCount[0].count)}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
