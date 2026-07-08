import { http, HttpResponse } from 'msw';
import type { Notification, NotificationStats } from '@pharmaos/types';

const NOTIFICATIONS: Notification[] = [
  { id: 'n1', title: 'Critical Stock Alert', message: 'Vitamin B12 500mcg is out of stock! (0 units remaining). Add to reorder queue immediately.', type: 'out_of_stock', category: 'inventory', priority: 'critical', isRead: false, actionUrl: '/reorder', actionLabel: 'Reorder Now', entityName: 'Vitamin B12 500mcg', createdAt: new Date(Date.now() - 10 * 60000).toISOString() },
  { id: 'n2', title: 'Low Stock Warning', message: 'Paracetamol 500mg is critically low — only 12 units left. Daily consumption: ~13 units. Stock lasts <1 day.', type: 'low_stock', category: 'inventory', priority: 'critical', isRead: false, actionUrl: '/reorder', actionLabel: 'View Reorder Queue', entityName: 'Paracetamol 500mg', createdAt: new Date(Date.now() - 2 * 3600000).toISOString() },
  { id: 'n3', title: 'Invoice Mismatch Detected', message: 'Purchase Invoice NMS-2026-0128 from National Medical Stores has a quantity mismatch. Ordered: 300, Received: 280 units of Atorvastatin 10mg. Review required.', type: 'approval_required', category: 'vendor', priority: 'warning', isRead: false, actionUrl: '/vendors', actionLabel: 'Review Invoice', entityName: 'NMS-2026-0128', createdAt: new Date(Date.now() - 3 * 3600000).toISOString() },
  { id: 'n4', title: 'Failed Login Attempt', message: '3 consecutive failed login attempts detected from IP 192.168.1.45. The account has been temporarily flagged.', type: 'login_alert', category: 'security', priority: 'critical', isRead: false, actionUrl: '/audit', actionLabel: 'View Audit Logs', createdAt: new Date(Date.now() - 4 * 3600000).toISOString() },
  { id: 'n5', title: 'Expiry Alert — 5 Medicines', message: '5 medicine batches will expire within 30 days. Total value at risk: ₹12,400. Take action now.', type: 'expiry_alert', category: 'inventory', priority: 'warning', isRead: false, actionUrl: '/expiry', actionLabel: 'View Expiry Dashboard', createdAt: new Date(Date.now() - 5 * 3600000).toISOString() },
  { id: 'n6', title: 'Payment Due — PharmaCorp India', message: 'Invoice PC-2026-0892 payment of ₹9,240 to PharmaCorp India is due in 5 days. Pay before Jun 30, 2026 to avoid overdue.', type: 'payment_due', category: 'vendor', priority: 'warning', isRead: true, actionUrl: '/vendors', actionLabel: 'Record Payment', entityName: 'PharmaCorp India', createdAt: new Date(Date.now() - 6 * 3600000).toISOString(), readAt: new Date(Date.now() - 2 * 3600000).toISOString() },
  { id: 'n7', title: 'Stock Adjustment Approved', message: 'Stock adjustment for Paracetamol 500mg (250 → 180 units) has been recorded successfully.', type: 'system', category: 'inventory', priority: 'info', isRead: true, entityName: 'Paracetamol 500mg', createdAt: new Date(Date.now() - 2 * 3600000).toISOString(), readAt: new Date(Date.now() - 1 * 3600000).toISOString() },
  { id: 'n8', title: 'Reorder Queue Updated', message: 'Metformin 500mg (35 units) has been automatically added to the reorder queue. Suggested order: 400 units.', type: 'reorder_due', category: 'inventory', priority: 'warning', isRead: false, actionUrl: '/reorder', actionLabel: 'View Queue', entityName: 'Metformin 500mg', createdAt: new Date(Date.now() - 1 * 86400000).toISOString() },
  { id: 'n9', title: 'Customer Credit Due', message: 'Mohan Lal has an outstanding credit balance of ₹1,200. Due for collection — last reminder sent 10 days ago.', type: 'customer_due', category: 'customer', priority: 'info', isRead: true, actionUrl: '/customers', actionLabel: 'View Customer', entityName: 'Mohan Lal', createdAt: new Date(Date.now() - 1 * 86400000).toISOString(), readAt: new Date(Date.now() - 12 * 3600000).toISOString() },
  { id: 'n10', title: 'New Purchase Confirmed', message: 'Purchase Invoice ML-2026-0541 from MedLine Distributors confirmed. 2 medicines added to inventory.', type: 'system', category: 'vendor', priority: 'info', isRead: true, entityName: 'ML-2026-0541', createdAt: new Date(Date.now() - 2 * 86400000).toISOString(), readAt: new Date(Date.now() - 2 * 86400000).toISOString() },
];

const NOTIFICATION_STATS: NotificationStats = {
  totalUnread: 5,
  criticalUnread: 2,
  warningUnread: 3,
  infoUnread: 0,
  todayTotal: 5,
};

export const notificationHandlers = [
  http.get('/api/notifications/stats', () => HttpResponse.json({ success: true, data: NOTIFICATION_STATS })),

  http.get('/api/notifications', ({ request }) => {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const unreadOnly = url.searchParams.get('unread') === 'true';
    const priority = url.searchParams.get('priority');

    let notifs = [...NOTIFICATIONS];
    if (category) notifs = notifs.filter(n => n.category === category);
    if (unreadOnly) notifs = notifs.filter(n => !n.isRead);
    if (priority) notifs = notifs.filter(n => n.priority === priority);

    notifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return HttpResponse.json({ success: true, data: { data: notifs, total: notifs.length } });
  }),

  http.patch('/api/notifications/:id/read', ({ params }) => {
    const idx = NOTIFICATIONS.findIndex(n => n.id === params.id);
    const notif = NOTIFICATIONS[idx];
    if (idx !== -1 && notif) {
      notif.isRead = true;
      notif.readAt = new Date().toISOString();
      NOTIFICATION_STATS.totalUnread = Math.max(0, NOTIFICATION_STATS.totalUnread - 1);
    }
    return HttpResponse.json({ success: true });
  }),

  http.patch('/api/notifications/mark-all-read', () => {
    NOTIFICATIONS.forEach(n => { n.isRead = true; n.readAt = new Date().toISOString(); });
    NOTIFICATION_STATS.totalUnread = 0;
    NOTIFICATION_STATS.criticalUnread = 0;
    NOTIFICATION_STATS.warningUnread = 0;
    NOTIFICATION_STATS.infoUnread = 0;
    return HttpResponse.json({ success: true });
  }),
];
