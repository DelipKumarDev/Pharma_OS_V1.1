import { Prisma } from '@prisma/client';

// The global permission catalog. Permissions are shared across tenants (matched by
// module_action_resource). Includes the platform-operator permission used to gate
// tenant provisioning — it is NOT part of any pharmacy role.
export const PERMISSION_CATALOG: Array<{ module: string; action: string; resource: string; description: string }> = [
  { module: 'medicines', action: 'view', resource: 'medicine', description: 'View medicines' },
  { module: 'medicines', action: 'create', resource: 'medicine', description: 'Add medicines' },
  { module: 'medicines', action: 'edit', resource: 'medicine', description: 'Edit medicines' },
  { module: 'medicines', action: 'delete', resource: 'medicine', description: 'Delete medicines' },
  { module: 'medicines', action: 'export', resource: 'medicine', description: 'Export medicines' },
  { module: 'inventory', action: 'view', resource: 'inventory', description: 'View inventory' },
  { module: 'inventory', action: 'create', resource: 'inventory', description: 'Add stock' },
  { module: 'inventory', action: 'edit', resource: 'inventory', description: 'Edit stock' },
  { module: 'inventory', action: 'delete', resource: 'inventory', description: 'Remove stock' },
  { module: 'billing', action: 'view', resource: 'bill', description: 'View bills' },
  { module: 'billing', action: 'create', resource: 'bill', description: 'Create bills' },
  { module: 'billing', action: 'edit', resource: 'bill', description: 'Edit bills' },
  { module: 'billing', action: 'delete', resource: 'bill', description: 'Cancel bills' },
  { module: 'customers', action: 'view', resource: 'customer', description: 'View customers' },
  { module: 'customers', action: 'create', resource: 'customer', description: 'Add customers' },
  { module: 'customers', action: 'edit', resource: 'customer', description: 'Edit customers' },
  { module: 'vendors', action: 'view', resource: 'vendor', description: 'View vendors' },
  { module: 'vendors', action: 'create', resource: 'vendor', description: 'Add vendors' },
  { module: 'vendors', action: 'edit', resource: 'vendor', description: 'Edit vendors' },
  { module: 'users', action: 'view', resource: 'user', description: 'View users' },
  { module: 'users', action: 'create', resource: 'user', description: 'Invite users' },
  { module: 'users', action: 'edit', resource: 'user', description: 'Edit users' },
  { module: 'reports', action: 'view', resource: 'report', description: 'View reports' },
  { module: 'reports', action: 'export', resource: 'report', description: 'Export reports' },
  { module: 'settings', action: 'view', resource: 'settings', description: 'View settings' },
  { module: 'settings', action: 'edit', resource: 'settings', description: 'Edit settings' },
  { module: 'prescriptions', action: 'view', resource: 'prescription', description: 'View prescriptions' },
  { module: 'prescriptions', action: 'create', resource: 'prescription', description: 'Add prescriptions' },
  { module: 'prescriptions', action: 'approve', resource: 'prescription', description: 'Approve prescriptions' },
  { module: 'returns', action: 'view', resource: 'return', description: 'View returns' },
  { module: 'returns', action: 'create', resource: 'return', description: 'Create returns' },
  { module: 'returns', action: 'approve', resource: 'return', description: 'Approve returns' },
  // Platform operator — provisioning/lifecycle of tenants. Never granted to a pharmacy role.
  { module: 'platform', action: 'manage', resource: 'platform', description: 'Provision and manage tenants (platform operator)' },
];

// Default per-tenant roles. "Pharma Admin" is the tenant owner role (all pharmacy
// permissions, but NOT platform:manage).
const ALL_PHARMACY = PERMISSION_CATALOG.filter(p => p.module !== 'platform').map(p => `${p.module}:${p.action}`);

export const DEFAULT_ROLES: Array<{ name: string; description: string; isSystem: boolean; grants: string[] }> = [
  { name: 'Pharma Admin', description: 'Full access to all pharmacy modules and settings', isSystem: true, grants: ALL_PHARMACY },
  { name: 'Pharmacist', description: 'Dispensing, billing, and inventory management', isSystem: true, grants: [
    'medicines:view', 'inventory:view', 'billing:view', 'billing:create', 'customers:view', 'customers:create',
    'prescriptions:view', 'prescriptions:create', 'prescriptions:approve', 'returns:view', 'returns:create',
  ] },
  { name: 'Inventory Manager', description: 'Stock management, purchase orders, and expiry tracking', isSystem: false, grants: [
    'medicines:view', 'medicines:create', 'medicines:edit', 'inventory:view', 'inventory:create', 'inventory:edit', 'inventory:delete',
    'vendors:view', 'vendors:create', 'vendors:edit', 'reports:view',
  ] },
  { name: 'Billing Assistant', description: 'Create and manage customer bills', isSystem: false, grants: [
    'billing:view', 'billing:create', 'customers:view', 'customers:create', 'medicines:view', 'inventory:view',
  ] },
  { name: 'Reports Viewer', description: 'Read-only access to all reports', isSystem: false, grants: ['reports:view', 'reports:export'] },
];

export const OWNER_ROLE_NAME = 'Pharma Admin';

// Idempotently upsert the global permission catalog; returns module:action -> id.
export async function ensurePermissionCatalog(tx: Prisma.TransactionClient): Promise<Map<string, string>> {
  const byKey = new Map<string, string>();
  for (const p of PERMISSION_CATALOG) {
    const row = await tx.permission.upsert({
      where: { module_action_resource: { module: p.module, action: p.action, resource: p.resource } },
      update: { description: p.description },
      create: p,
    });
    byKey.set(`${p.module}:${p.action}`, row.id);
  }
  return byKey;
}

// Idempotently create the default roles for a tenant and grant their permissions.
// Returns the owner (Pharma Admin) role id.
export async function ensureDefaultRoles(tx: Prisma.TransactionClient, tenantId: string, permByKey: Map<string, string>): Promise<string> {
  let ownerRoleId = '';
  for (const def of DEFAULT_ROLES) {
    const role = await tx.role.upsert({
      where: { tenantId_name: { tenantId, name: def.name } },
      update: {},
      create: { tenantId, name: def.name, description: def.description, isSystem: def.isSystem },
    });
    if (def.name === OWNER_ROLE_NAME) ownerRoleId = role.id;
    for (const key of def.grants) {
      const permId = permByKey.get(key);
      if (!permId) continue;
      await tx.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permId } },
        update: {},
        create: { roleId: role.id, permissionId: permId },
      });
    }
  }
  return ownerRoleId;
}
