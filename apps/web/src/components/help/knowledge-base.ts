// Curated in-app help knowledge base. Each article answers a "how do I…"
// question with steps, a navigation click-path, and a deep link ("Take me there").
export interface KbArticle {
  id: string;
  title: string;
  keywords: string[];
  intro: string;
  steps: string[];
  path: string[];      // breadcrumb of where to click
  route: string;       // deep link for "Take me there"
  image?: string;      // optional screenshot in /public/help
}

export const KB: KbArticle[] = [
  {
    id: 'add-medicine',
    title: 'Add a medicine to the master',
    keywords: ['add medicine', 'new medicine', 'create medicine', 'medicine master', 'add drug', 'add product'],
    intro: 'Add a new medicine so it can be stocked and billed.',
    steps: [
      'Open Medicine Master from the sidebar.',
      'Click "Add Medicine" (top right).',
      'Fill name, generic, manufacturer, form, strength, MRP and selling price.',
      'Tip: click "Scan photo" to auto-fill from a strip/box photo, then review.',
      'Click "Add Medicine" to save.',
    ],
    path: ['Medicine Master', 'Add Medicine'],
    route: '/medicines',
  },
  {
    id: 'scan-medicine',
    title: 'Scan a medicine photo to auto-fill',
    keywords: ['scan medicine', 'photo medicine', 'ocr medicine', 'auto fill medicine', 'strip photo'],
    intro: 'Save typing by scanning a medicine strip or box.',
    steps: [
      'Open Medicine Master → Add Medicine.',
      'Click "Scan photo" and choose a clear, flat photo.',
      'The name, strength, generic, composition and manufacturer are pre-filled.',
      'Review and complete the remaining fields, then Save.',
    ],
    path: ['Medicine Master', 'Add Medicine', 'Scan photo'],
    route: '/medicines',
  },
  {
    id: 'create-bill',
    title: 'Create a sales bill',
    keywords: ['create bill', 'new bill', 'billing', 'sell', 'pos', 'invoice customer', 'make bill'],
    intro: 'Bill medicines to a customer with GST and payment.',
    steps: [
      'Open Billing from the sidebar.',
      'Search a medicine (or press F8 to scan a barcode) and add it.',
      'Set quantity; GST and totals calculate automatically.',
      'Add the customer name/phone and choose a payment method.',
      'Press F9 (or Pay & Print) to finalise and print the receipt.',
    ],
    path: ['Billing'],
    route: '/billing',
  },
  {
    id: 'scan-bill',
    title: 'Scan a purchase bill into stock',
    keywords: ['scan bill', 'purchase bill', 'upload bill', 'supplier bill', 'ocr bill', 'add stock from bill', 'purchase invoice photo'],
    intro: 'Upload a supplier bill photo — items are read, you review, then stock updates.',
    steps: [
      'Open "Scan Bill" from the sidebar.',
      'Upload a photo of the supplier bill.',
      'Review the detected vendor and line items; correct anything and add batch/expiry.',
      'Click "Confirm & update stock".',
      'Stock, new medicines and the vendor are updated automatically.',
    ],
    path: ['Scan Bill'],
    route: '/scan',
  },
  {
    id: 'add-stock',
    title: 'Add stock / a new batch',
    keywords: ['add stock', 'new batch', 'stock intake', 'inventory add', 'receive stock', 'batch'],
    intro: 'Add a batch of an existing medicine to inventory.',
    steps: [
      'Open Stock & Inventory from the sidebar.',
      'Click "Add Stock".',
      'Pick the medicine, enter batch number, expiry, quantity and prices.',
      'Save — the batch becomes available for billing.',
    ],
    path: ['Stock & Inventory', 'Add Stock'],
    route: '/stock',
  },
  {
    id: 'add-customer',
    title: 'Add a customer',
    keywords: ['add customer', 'new customer', 'patient', 'create customer', 'contact'],
    intro: 'Save a customer for faster billing and refill reminders.',
    steps: [
      'Open Contacts (or Customers) from the sidebar.',
      'Click "Add Customer".',
      'Enter name and phone (email/address optional).',
      'Save.',
    ],
    path: ['Contacts', 'Add Customer'],
    route: '/contacts',
  },
  {
    id: 'add-vendor',
    title: 'Add a vendor / supplier',
    keywords: ['add vendor', 'supplier', 'new vendor', 'distributor'],
    intro: 'Register a supplier to track purchases and payments.',
    steps: [
      'Open Contacts → Vendors tab (or Vendors).',
      'Click "Add Vendor".',
      'Enter name, GST number and payment terms.',
      'Save.',
    ],
    path: ['Contacts', 'Vendors', 'Add Vendor'],
    route: '/contacts',
  },
  {
    id: 'reports-gst',
    title: 'View reports & GSTR-1',
    keywords: ['reports', 'gst', 'gstr1', 'gstr-1', 'sales report', 'analytics', 'tax report', 'export report'],
    intro: 'See sales analytics and generate GST filing data.',
    steps: [
      'Open Reports from the sidebar.',
      'Use the "GST & Compliance" tab for GSTR-1.',
      'Pick the month/year and click GSTR-1 to download the CSV.',
      'Other tabs cover sales, stock and profitability.',
    ],
    path: ['Reports', 'GST & Compliance'],
    route: '/reports',
  },
  {
    id: 'returns',
    title: 'Process a return',
    keywords: ['return', 'refund', 'customer return', 'vendor return'],
    intro: 'Handle a customer or vendor return with refund.',
    steps: [
      'Open Returns from the sidebar.',
      'Click "New Return" and choose the type.',
      'Add the items, reason and refund method.',
      'Approve, then Process to complete (resaleable items restock).',
    ],
    path: ['Returns'],
    route: '/returns',
  },
  {
    id: 'reorder',
    title: 'Reorder low-stock items',
    keywords: ['reorder', 'low stock', 'out of stock', 'restock', 'order queue'],
    intro: 'See what needs reordering and mark items ordered.',
    steps: [
      'Open Reorder Queue from the sidebar.',
      'Items below their reorder level are listed by priority.',
      'Update an item to "Ordered" once you place the purchase.',
    ],
    path: ['Reorder Queue'],
    route: '/reorder',
  },
  {
    id: 'templates',
    title: 'Change reminder / notification messages',
    keywords: ['message template', 'whatsapp message', 'sms message', 'reminder text', 'notification message', 'change message', 'refill reminder text'],
    intro: 'Customise the wording of automated WhatsApp/SMS and alerts.',
    steps: [
      'Open Settings → Message Templates.',
      'Edit any message; click a {{variable}} chip to insert it.',
      'Check the live preview, then click Save.',
    ],
    path: ['Settings', 'Message Templates'],
    route: '/settings',
  },
  {
    id: 'import-export',
    title: 'Import or export / backup data',
    keywords: ['import', 'export', 'backup', 'csv', 'excel', 'migrate data', 'download data'],
    intro: 'Bulk-import your catalog or export/backup your data.',
    steps: [
      'Open Settings → Import & Export.',
      'Download a template, fill it, and import (medicines, customers, etc.).',
      'Use Export to download CSVs, or Backup for a full data copy.',
    ],
    path: ['Settings', 'Import & Export'],
    route: '/settings',
  },
  {
    id: 'users-roles',
    title: 'Add staff & set permissions',
    keywords: ['user', 'staff', 'role', 'permission', 'invite user', 'access control', 'add employee'],
    intro: 'Invite staff and control what each role can do.',
    steps: [
      'Open Users (under Administration) to invite staff.',
      'Open Roles to set which modules a role can access.',
      'Assign a role when inviting the user.',
    ],
    path: ['Users', 'Roles'],
    route: '/users',
  },
  {
    id: 'schedule-h',
    title: 'Schedule H / prescription drugs',
    keywords: ['schedule h', 'prescription drug', 'h1', 'register', 'scheduled', 'narcotic'],
    intro: 'Scheduled drugs require a doctor and are logged in a register.',
    steps: [
      'When billing a Schedule H/H1/X drug, a doctor + patient are required.',
      'The sale is recorded automatically in the Schedule Register.',
      'Open "Schedule Register" to view or export it.',
    ],
    path: ['Schedule Register'],
    route: '/schedule-register',
  },
];

// Simple keyword-overlap scoring to find the best matching articles.
export function searchKb(query: string, limit = 3): KbArticle[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const words = q.split(/\s+/).filter(w => w.length > 1);
  const scored = KB.map(a => {
    let score = 0;
    const hay = (a.title + ' ' + a.keywords.join(' ') + ' ' + a.intro).toLowerCase();
    for (const kw of a.keywords) if (q.includes(kw) || kw.includes(q)) score += 5;
    for (const w of words) if (hay.includes(w)) score += 1;
    return { a, score };
  }).filter(x => x.score > 0).sort((x, y) => y.score - x.score);
  return scored.slice(0, limit).map(x => x.a);
}
