import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { ensurePermissionCatalog, ensureDefaultRoles } from '../src/modules/tenant/tenant.defaults';

// One-off, idempotent, ADDITIVE sync: re-applies the current DEFAULT_ROLES grants
// (and the permission catalog) to every existing tenant. ensureDefaultRoles only
// upserts role-permissions, so this grants any newly-added default permissions to
// existing roles without removing anything a tenant already has or customised.
const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } });
  console.log(`Syncing default role grants across ${tenants.length} tenant(s)...`);

  await prisma.$transaction(async (tx) => {
    const permByKey = await ensurePermissionCatalog(tx);
    for (const t of tenants) {
      await ensureDefaultRoles(tx, t.id, permByKey);
      console.log(`  ✓ ${t.name} (${t.id})`);
    }
  });

  console.log('Done.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
