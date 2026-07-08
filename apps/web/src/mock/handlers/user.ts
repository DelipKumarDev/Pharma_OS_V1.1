import { http, HttpResponse, delay } from 'msw';
import type { User, Role } from '@pharmaos/types';

export const ROLES: Role[] = [
  { id: 'role_001', tenantId: 'tnt_001', name: 'Pharma Admin', description: 'Full access to all pharmacy modules and settings', permissions: [{ id: 'perm_001', module: 'medicines', action: 'view', resource: 'medicine', description: 'View medicines' }, { id: 'perm_002', module: 'medicines', action: 'create', resource: 'medicine', description: 'Add medicines' }, { id: 'perm_003', module: 'medicines', action: 'edit', resource: 'medicine', description: 'Edit medicines' }, { id: 'perm_004', module: 'medicines', action: 'delete', resource: 'medicine', description: 'Delete medicines' }, { id: 'perm_005', module: 'inventory', action: 'view', resource: 'inventory', description: 'View inventory' }, { id: 'perm_006', module: 'inventory', action: 'create', resource: 'inventory', description: 'Add stock' }, { id: 'perm_007', module: 'billing', action: 'view', resource: 'bill', description: 'View bills' }, { id: 'perm_008', module: 'billing', action: 'create', resource: 'bill', description: 'Create bills' }, { id: 'perm_009', module: 'users', action: 'view', resource: 'user', description: 'View users' }, { id: 'perm_010', module: 'users', action: 'create', resource: 'user', description: 'Invite users' }, { id: 'perm_011', module: 'reports', action: 'view', resource: 'report', description: 'View reports' }, { id: 'perm_012', module: 'reports', action: 'export', resource: 'report', description: 'Export reports' }, { id: 'perm_013', module: 'settings', action: 'view', resource: 'settings', description: 'View settings' }, { id: 'perm_014', module: 'settings', action: 'edit', resource: 'settings', description: 'Edit settings' }], isSystem: true, userCount: 1, createdAt: '2024-01-01T00:00:00Z' },
  { id: 'role_002', tenantId: 'tnt_001', name: 'Pharmacist', description: 'Dispensing, billing, and inventory management', permissions: [{ id: 'perm_015', module: 'medicines', action: 'view', resource: 'medicine', description: 'View medicines' }, { id: 'perm_016', module: 'inventory', action: 'view', resource: 'inventory', description: 'View inventory' }, { id: 'perm_017', module: 'inventory', action: 'edit', resource: 'inventory', description: 'Adjust stock' }, { id: 'perm_018', module: 'billing', action: 'view', resource: 'bill', description: 'View bills' }, { id: 'perm_019', module: 'billing', action: 'create', resource: 'bill', description: 'Create bills' }, { id: 'perm_020', module: 'reports', action: 'view', resource: 'report', description: 'View reports' }], isSystem: true, userCount: 3, createdAt: '2024-01-01T00:00:00Z' },
  { id: 'role_003', tenantId: 'tnt_001', name: 'Inventory Manager', description: 'Stock management, purchase orders, and expiry tracking', permissions: [{ id: 'perm_021', module: 'medicines', action: 'view', resource: 'medicine', description: 'View medicines' }, { id: 'perm_022', module: 'inventory', action: 'view', resource: 'inventory', description: 'View inventory' }, { id: 'perm_023', module: 'inventory', action: 'create', resource: 'inventory', description: 'Add stock' }, { id: 'perm_024', module: 'inventory', action: 'edit', resource: 'inventory', description: 'Edit stock' }, { id: 'perm_025', module: 'inventory', action: 'delete', resource: 'inventory', description: 'Remove stock' }], isSystem: false, userCount: 1, createdAt: '2024-01-15T00:00:00Z' },
  { id: 'role_004', tenantId: 'tnt_001', name: 'Billing Assistant', description: 'Create and manage customer bills', permissions: [{ id: 'perm_026', module: 'medicines', action: 'view', resource: 'medicine', description: 'View medicines' }, { id: 'perm_027', module: 'inventory', action: 'view', resource: 'inventory', description: 'View inventory' }, { id: 'perm_028', module: 'billing', action: 'view', resource: 'bill', description: 'View bills' }, { id: 'perm_029', module: 'billing', action: 'create', resource: 'bill', description: 'Create bills' }], isSystem: false, userCount: 2, createdAt: '2024-02-01T00:00:00Z' },
  { id: 'role_005', tenantId: 'tnt_001', name: 'Reports Viewer', description: 'Read-only access to all reports', permissions: [{ id: 'perm_030', module: 'reports', action: 'view', resource: 'report', description: 'View reports' }], isSystem: false, userCount: 1, createdAt: '2024-03-01T00:00:00Z' },
];

const USERS: User[] = [
  { id: 'usr_001', tenantId: 'tnt_001', name: 'Rahul Sharma', email: 'rahul@divyapharmacy.com', phone: '9876543210', status: 'active', roles: [ROLES[0]!], mfaEnabled: true, lastLoginAt: new Date().toISOString(), createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 'usr_002', tenantId: 'tnt_001', name: 'Priya Patel', email: 'priya@divyapharmacy.com', phone: '9812345678', status: 'active', roles: [ROLES[1]!], mfaEnabled: false, lastLoginAt: '2026-06-23T15:00:00Z', createdAt: '2024-01-05T00:00:00Z', updatedAt: '2024-01-05T00:00:00Z' },
  { id: 'usr_003', tenantId: 'tnt_001', name: 'Amit Joshi', email: 'amit@divyapharmacy.com', phone: '9898765432', status: 'active', roles: [ROLES[1]!], mfaEnabled: false, lastLoginAt: '2026-06-24T09:00:00Z', createdAt: '2024-02-01T00:00:00Z', updatedAt: '2024-02-01T00:00:00Z' },
  { id: 'usr_004', tenantId: 'tnt_001', name: 'Sunita Khanna', email: 'sunita@divyapharmacy.com', phone: '9765432109', status: 'active', roles: [ROLES[2]!], mfaEnabled: false, lastLoginAt: '2026-06-23T11:00:00Z', createdAt: '2024-02-15T00:00:00Z', updatedAt: '2024-02-15T00:00:00Z' },
  { id: 'usr_005', tenantId: 'tnt_001', name: 'Kiran Reddy', email: 'kiran@divyapharmacy.com', phone: '9654321098', status: 'active', roles: [ROLES[3]!], mfaEnabled: false, lastLoginAt: '2026-06-22T08:00:00Z', createdAt: '2024-03-01T00:00:00Z', updatedAt: '2024-03-01T00:00:00Z' },
  { id: 'usr_006', tenantId: 'tnt_001', name: 'Rajiv Nair', email: 'rajiv@divyapharmacy.com', phone: null as unknown as string, status: 'locked', roles: [ROLES[3]!], mfaEnabled: false, lastLoginAt: '2026-05-10T14:00:00Z', createdAt: '2024-03-15T00:00:00Z', updatedAt: '2024-06-01T00:00:00Z' },
  { id: 'usr_007', tenantId: 'tnt_001', name: 'Meera Krishnan', email: 'meera@divyapharmacy.com', phone: '9543210987', status: 'pending', roles: [ROLES[4]!], mfaEnabled: false, lastLoginAt: undefined, createdAt: '2026-06-20T00:00:00Z', updatedAt: '2026-06-20T00:00:00Z' },
];

export const userHandlers = [
  http.get('/api/users', async () => {
    await delay(400);
    return HttpResponse.json({ success: true, data: { data: USERS, total: USERS.length, page: 1, limit: 20, totalPages: 1 } });
  }),

  http.post('/api/users', async ({ request }) => {
    await delay(600);
    const body = await request.json() as { name: string; email: string; phone?: string; roleIds: string[] };
    const userRoles = body.roleIds.map((id) => ROLES.find((r) => r.id === id)).filter(Boolean) as Role[];
    const newUser: User = {
      id: `usr_${Date.now()}`,
      tenantId: 'tnt_001',
      name: body.name,
      email: body.email,
      phone: body.phone,
      status: 'pending',
      roles: userRoles,
      mfaEnabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    USERS.push(newUser);
    return HttpResponse.json({ success: true, data: newUser }, { status: 201 });
  }),

  http.put('/api/users/:id', async ({ params, request }) => {
    await delay(400);
    const idx = USERS.findIndex((u) => u.id === params['id']);
    if (idx === -1) return HttpResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    const body = await request.json() as Partial<User>;
    USERS[idx] = { ...USERS[idx]!, ...body, updatedAt: new Date().toISOString() };
    return HttpResponse.json({ success: true, data: USERS[idx] });
  }),

  http.get('/api/roles', async () => {
    await delay(300);
    return HttpResponse.json({ success: true, data: { data: ROLES, total: ROLES.length, page: 1, limit: 20, totalPages: 1 } });
  }),

  http.post('/api/roles', async ({ request }) => {
    await delay(500);
    const body = await request.json() as { name: string; description?: string; permissionIds: string[] };
    const newRole: Role = {
      id: `role_${Date.now()}`,
      tenantId: 'tnt_001',
      name: body.name,
      description: body.description,
      permissions: [],
      isSystem: false,
      userCount: 0,
      createdAt: new Date().toISOString(),
    };
    ROLES.push(newRole);
    return HttpResponse.json({ success: true, data: newRole }, { status: 201 });
  }),

  http.delete('/api/roles/:id', async ({ params }) => {
    await delay(300);
    const idx = ROLES.findIndex((r) => r.id === params['id']);
    if (idx === -1) return HttpResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    if (ROLES[idx]!.isSystem) return HttpResponse.json({ success: false, message: 'Cannot delete system roles' }, { status: 400 });
    ROLES.splice(idx, 1);
    return HttpResponse.json({ success: true, data: null });
  }),
];
