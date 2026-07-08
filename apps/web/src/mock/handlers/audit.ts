import { http, HttpResponse } from 'msw';
import type { AuditLog, UserSession, SecurityEvent, AuditStats } from '@pharmaos/types';

const AUDIT_LOGS: AuditLog[] = [
  { id: 'al1', userId: 'u1', userName: 'Ankit Sharma', userRole: 'Owner', module: 'billing', action: 'create', entityId: 'b421', entityName: 'Bill B-2026-0421', description: 'Created new bill for Ramesh Gupta — ₹2,580', severity: 'info', status: 'success', createdAt: new Date(Date.now() - 30 * 60000).toISOString() },
  { id: 'al2', userId: 'u2', userName: 'Priya Cashier', userRole: 'Cashier', module: 'billing', action: 'cancel', entityId: 'b418', entityName: 'Bill B-2026-0418', description: 'Cancelled bill B-2026-0418 (₹890) — Reason: Customer request', beforeValue: { status: 'completed', amount: 890 }, afterValue: { status: 'cancelled', amount: 890 }, severity: 'warning', status: 'success', createdAt: new Date(Date.now() - 45 * 60000).toISOString() },
  { id: 'al3', userId: 'u3', userName: 'Raj Inventory', userRole: 'Inventory Staff', module: 'inventory', action: 'adjust', entityId: 'inv12', entityName: 'Paracetamol 500mg', description: 'Stock adjustment: 250 → 180 units (−70) — Reason: Physical count', beforeValue: { qty: 250 }, afterValue: { qty: 180 }, severity: 'warning', status: 'success', createdAt: new Date(Date.now() - 2 * 3600000).toISOString() },
  { id: 'al4', userId: 'u1', userName: 'Ankit Sharma', userRole: 'Owner', module: 'vendor', action: 'payment', entityId: 'vp3', entityName: 'MedLine Distributors', description: 'Recorded payment ₹13,422 to MedLine Distributors via NEFT', severity: 'info', status: 'success', createdAt: new Date(Date.now() - 3 * 3600000).toISOString() },
  { id: 'al5', userId: 'u4', userName: 'Unknown', userRole: 'Cashier', module: 'auth', action: 'login_failed', description: 'Failed login attempt for user cashier@pharmaos.in from IP 192.168.1.45', ipAddress: '192.168.1.45', severity: 'critical', status: 'failed', createdAt: new Date(Date.now() - 4 * 3600000).toISOString() },
  { id: 'al6', userId: 'u1', userName: 'Ankit Sharma', userRole: 'Owner', module: 'user', action: 'update', entityId: 'u2', entityName: 'Priya Cashier', description: 'Updated user role: Cashier → Pharmacist', beforeValue: { role: 'Cashier' }, afterValue: { role: 'Pharmacist' }, severity: 'critical', status: 'success', createdAt: new Date(Date.now() - 5 * 3600000).toISOString() },
  { id: 'al7', userId: 'u3', userName: 'Raj Inventory', userRole: 'Inventory Staff', module: 'inventory', action: 'delete', entityId: 'inv08', entityName: 'Expired Batch PKT2024A', description: 'Disposed expired batch PKT2024A (Qty: 45 units) — Paracetamol 650mg', beforeValue: { qty: 45, status: 'expired' }, afterValue: { qty: 0, status: 'disposed' }, severity: 'warning', status: 'success', createdAt: new Date(Date.now() - 6 * 3600000).toISOString() },
  { id: 'al8', userId: 'u1', userName: 'Ankit Sharma', userRole: 'Owner', module: 'settings', action: 'update', description: 'Updated GST configuration — CGST 6% + SGST 6% enabled', beforeValue: { gstEnabled: false }, afterValue: { gstEnabled: true, cgst: 6, sgst: 6 }, severity: 'critical', status: 'success', createdAt: new Date(Date.now() - 1 * 86400000).toISOString() },
  { id: 'al9', userId: 'u2', userName: 'Priya Cashier', userRole: 'Cashier', module: 'billing', action: 'print', entityId: 'b420', entityName: 'Bill B-2026-0420', description: 'Printed invoice for Bill B-2026-0420 (₹1,240)', severity: 'info', status: 'success', createdAt: new Date(Date.now() - 1 * 3600000).toISOString() },
  { id: 'al10', userId: 'u1', userName: 'Ankit Sharma', userRole: 'Owner', module: 'auth', action: 'login', description: 'Owner login from Chrome/Windows — IP 192.168.1.10', ipAddress: '192.168.1.10', deviceInfo: 'Chrome 124 / Windows 11', severity: 'info', status: 'success', createdAt: new Date(Date.now() - 8 * 3600000).toISOString() },
  { id: 'al11', userId: 'u3', userName: 'Raj Inventory', userRole: 'Inventory Staff', module: 'inventory', action: 'update', entityId: 'inv05', entityName: 'Metformin 500mg', description: 'Added new batch MTF2026A — 400 units @ ₹22 from PharmaCorp', severity: 'info', status: 'success', createdAt: new Date(Date.now() - 5 * 86400000).toISOString() },
  { id: 'al12', userId: 'u1', userName: 'Ankit Sharma', userRole: 'Owner', module: 'report', action: 'export', description: 'Exported Monthly Sales Report — June 2026 (PDF)', severity: 'info', status: 'success', createdAt: new Date(Date.now() - 2 * 86400000).toISOString() },
];

const USER_SESSIONS: UserSession[] = [
  { id: 's1', userId: 'u1', userName: 'Ankit Sharma', userRole: 'Owner', loginAt: new Date(Date.now() - 8 * 3600000).toISOString(), deviceInfo: 'Chrome 124 / Windows 11', ipAddress: '192.168.1.10', isActive: true, actionsCount: 24 },
  { id: 's2', userId: 'u2', userName: 'Priya Cashier', userRole: 'Cashier', loginAt: new Date(Date.now() - 6 * 3600000).toISOString(), logoutAt: new Date(Date.now() - 1 * 3600000).toISOString(), deviceInfo: 'Chrome 124 / Windows 10', ipAddress: '192.168.1.12', isActive: false, actionsCount: 18 },
  { id: 's3', userId: 'u3', userName: 'Raj Inventory', userRole: 'Inventory Staff', loginAt: new Date(Date.now() - 3 * 3600000).toISOString(), deviceInfo: 'Firefox 125 / Android 14', ipAddress: '192.168.1.15', isActive: true, actionsCount: 7 },
];

const SECURITY_EVENTS: SecurityEvent[] = [
  { id: 'se1', eventType: 'failed_login', userName: 'unknown@pharmaos.in', description: '3 consecutive failed login attempts from IP 192.168.1.45', severity: 'high', isResolved: false, createdAt: new Date(Date.now() - 4 * 3600000).toISOString() },
  { id: 'se2', eventType: 'permission_change', userId: 'u2', userName: 'Priya Cashier', description: 'Role changed from Cashier to Pharmacist by Owner Ankit Sharma', severity: 'medium', isResolved: true, createdAt: new Date(Date.now() - 5 * 3600000).toISOString() },
];

const AUDIT_STATS: AuditStats = {
  totalLogsToday: 8,
  criticalActions: 3,
  failedActions: 1,
  activeUsers: 2,
  sensitiveActionsToday: 4,
  totalSessions: 3,
};

export const auditHandlers = [
  http.get('/api/audit/stats', () => HttpResponse.json({ success: true, data: AUDIT_STATS })),

  http.get('/api/audit', ({ request }) => {
    const url = new URL(request.url);
    const module = url.searchParams.get('module');
    const action = url.searchParams.get('action');
    const userId = url.searchParams.get('userId');
    const severity = url.searchParams.get('severity');
    const search = url.searchParams.get('search')?.toLowerCase() ?? '';
    const page = parseInt(url.searchParams.get('page') ?? '1');
    const limit = parseInt(url.searchParams.get('limit') ?? '20');

    let logs = [...AUDIT_LOGS];
    if (module) logs = logs.filter(l => l.module === module);
    if (action) logs = logs.filter(l => l.action === action);
    if (userId) logs = logs.filter(l => l.userId === userId);
    if (severity) logs = logs.filter(l => l.severity === severity);
    if (search) logs = logs.filter(l => l.description.toLowerCase().includes(search) || l.userName.toLowerCase().includes(search) || l.entityName?.toLowerCase().includes(search));

    logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const total = logs.length;
    const paginated = logs.slice((page - 1) * limit, page * limit);
    return HttpResponse.json({ success: true, data: { data: paginated, total, page, limit } });
  }),

  http.get('/api/audit/sessions', () => HttpResponse.json({ success: true, data: { data: USER_SESSIONS, total: USER_SESSIONS.length } })),

  http.get('/api/audit/security-events', () => HttpResponse.json({ success: true, data: { data: SECURITY_EVENTS, total: SECURITY_EVENTS.length } })),
];
