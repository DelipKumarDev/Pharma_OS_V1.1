/**
 * Bootstrap a PharmaOS PLATFORM OPERATOR — the identity allowed to provision and
 * manage tenants (holds the platform:manage permission). Idempotent.
 *
 * Usage:
 *   SUPER_ADMIN_EMAIL=ops@you.com SUPER_ADMIN_PASSWORD='Str0ng!Pass' npx tsx scripts/create-platform-admin.ts
 *   # or: npx tsx scripts/create-platform-admin.ts <email> <password>
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { ensurePermissionCatalog } from '../src/modules/tenant/tenant.defaults';

const prisma = new PrismaClient();

async function main() {
  const email = (process.env['SUPER_ADMIN_EMAIL'] ?? process.argv[2] ?? '').trim();
  const password = process.env['SUPER_ADMIN_PASSWORD'] ?? process.argv[3] ?? '';
  if (!email || !password) {
    console.error('❌ Provide SUPER_ADMIN_EMAIL + SUPER_ADMIN_PASSWORD (env) or <email> <password> (args).');
    process.exit(1);
  }
  if (password.length < 12) {
    console.error('❌ Platform admin password must be at least 12 characters.');
    process.exit(1);
  }

  await prisma.$transaction(async tx => {
    // A dedicated platform tenant houses the operator identity.
    const tenant = await tx.tenant.upsert({
      where: { slug: 'platform' },
      update: { status: 'active' },
      create: { name: 'PharmaOS Platform', slug: 'platform', type: 'retail', status: 'active', plan: 'enterprise' },
    });

    const permByKey = await ensurePermissionCatalog(tx);
    const platformPermId = permByKey.get('platform:manage');
    if (!platformPermId) throw new Error('platform:manage permission missing from catalog');

    const role = await tx.role.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: 'Platform Operator' } },
      update: {},
      create: { tenantId: tenant.id, name: 'Platform Operator', description: 'Provision and manage tenants', isSystem: true },
    });
    // Grant platform:manage (+ a couple of read perms for basic navigation).
    for (const key of ['platform:manage', 'settings:view', 'users:view']) {
      const pid = permByKey.get(key);
      if (pid) await tx.rolePermission.upsert({ where: { roleId_permissionId: { roleId: role.id, permissionId: pid } }, update: {}, create: { roleId: role.id, permissionId: pid } });
    }

    const existing = await tx.user.findFirst({ where: { tenantId: tenant.id, email } });
    const passwordHash = await bcrypt.hash(password, 12);
    let user;
    if (existing) {
      user = await tx.user.update({ where: { id: existing.id }, data: { passwordHash, status: 'active', mustChangePassword: false, deletedAt: null } });
      console.log(`↻ Updated existing platform operator ${email}`);
    } else {
      user = await tx.user.create({ data: { tenantId: tenant.id, name: 'Platform Operator', email, passwordHash, status: 'active', mustChangePassword: false } });
      console.log(`✓ Created platform operator ${email}`);
    }
    await tx.userRole.upsert({ where: { userId_roleId: { userId: user.id, roleId: role.id } }, update: {}, create: { userId: user.id, roleId: role.id } });
  });

  console.log('✅ Platform operator ready. Sign in and POST /api/tenants to provision pharmacies.');
  await prisma.$disconnect();
}

main().catch(async e => { console.error('bootstrap failed:', e); await prisma.$disconnect().catch(() => {}); process.exit(1); });
