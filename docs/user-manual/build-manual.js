/* Pharma Ist — User Manual generator (docx). */
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  ImageRun, TableOfContents, PageBreak, LevelFormat, BorderStyle,
  Header, Footer, PageNumber, ShadingType, ExternalHyperlink,
} = require('docx');

const IMG = path.join(__dirname, 'images');
const OUT = path.join(__dirname, 'Pharma-Ist-User-Manual.docx');

/* ---- palette ---- */
const TEAL = '0D7D6B';     // brand
const TEALDK = '0B5F52';
const INK = '1C2A33';
const SLATE = '5B6B74';
const LIGHT = 'EAF3F1';    // callout bg
const AMBER = 'FFF4E0';
const AMBERLINE = 'E0A43B';

/* ---- numbering: one bullet ref + a pool of ordered refs so each step list restarts at 1 ---- */
const STEP_REFS = [];
const numberingConfig = [{
  reference: 'bul',
  levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 460, hanging: 260 } } } }],
}];
for (let i = 0; i < 120; i++) {
  const ref = 'n' + i;
  STEP_REFS.push(ref);
  numberingConfig.push({
    reference: ref,
    levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 460, hanging: 260 } } } }],
  });
}
let stepPtr = 0;
const nextStepRef = () => STEP_REFS[stepPtr++];

/* ---- helpers ---- */
const run = (text, o = {}) => new TextRun({ text, font: 'Arial', ...o });

function h1(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true,
    spacing: { after: 160 }, children: [run(text, { bold: true, size: 30, color: TEALDK })] });
}
function h2(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 },
    children: [run(text, { bold: true, size: 24, color: INK })] });
}
function h3(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 180, after: 80 },
    children: [run(text, { bold: true, size: 21, color: TEAL })] });
}
function p(text, o = {}) {
  const runs = Array.isArray(text) ? text : [run(text, { size: 21, color: INK })];
  return new Paragraph({ spacing: { after: 120, line: 276 }, children: runs, ...o });
}
function lead(text) {
  return new Paragraph({ spacing: { after: 140, line: 276 }, children: [run(text, { size: 21, color: SLATE, italics: true })] });
}
function bullets(items) {
  return items.map((t) => new Paragraph({ numbering: { reference: 'bul', level: 0 },
    spacing: { after: 60, line: 268 },
    children: Array.isArray(t) ? t : [run(t, { size: 21, color: INK })] }));
}
function steps(items) {
  const ref = nextStepRef();
  return items.map((t) => new Paragraph({ numbering: { reference: ref, level: 0 },
    spacing: { after: 80, line: 268 },
    children: Array.isArray(t) ? t : [run(t, { size: 21, color: INK })] }));
}
function kv(label, value) {
  return new Paragraph({ spacing: { after: 60, line: 268 }, children: [
    run(label + ': ', { bold: true, size: 21, color: INK }), run(value, { size: 21, color: INK }) ] });
}
/* callout box as a shaded, bordered paragraph block */
function callout(label, text, kind = 'note') {
  const bg = kind === 'tip' ? LIGHT : kind === 'warn' ? AMBER : LIGHT;
  const line = kind === 'warn' ? AMBERLINE : TEAL;
  return new Paragraph({
    spacing: { before: 100, after: 140, line: 272 },
    shading: { type: ShadingType.CLEAR, fill: bg },
    border: {
      left: { style: BorderStyle.SINGLE, size: 18, color: line, space: 8 },
      top: { style: BorderStyle.SINGLE, size: 2, color: bg, space: 6 },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: bg, space: 6 },
      right: { style: BorderStyle.SINGLE, size: 2, color: bg, space: 6 },
    },
    children: [ run(label + '  ', { bold: true, size: 20, color: line }), run(text, { size: 20, color: INK }) ],
  });
}
function shot(file, caption) {
  const data = fs.readFileSync(path.join(IMG, file));
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 40 },
      children: [ new ImageRun({ type: 'jpg', data, transformation: { width: 576, height: 432 },
        altText: { title: caption, description: caption, name: file } }) ] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 },
      children: [ run('Figure: ' + caption, { italics: true, size: 18, color: SLATE }) ] }),
  ];
}
const spacer = () => new Paragraph({ spacing: { after: 60 }, children: [run('', { size: 12 })] });

/* ===================== CONTENT ===================== */
const body = [];
const add = (...xs) => xs.forEach((x) => Array.isArray(x) ? body.push(...x) : body.push(x));

/* ----- Title page ----- */
add(
  new Paragraph({ spacing: { before: 2600 }, alignment: AlignmentType.CENTER,
    children: [run('Pharma Ist', { bold: true, size: 72, color: TEALDK })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 },
    children: [run('Pharmacy Management System', { size: 30, color: TEAL })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 60 },
    children: [run('User Manual', { bold: true, size: 40, color: INK })] }),
  new Paragraph({ alignment: AlignmentType.CENTER,
    children: [run('A complete, step-by-step guide for everyday use', { italics: true, size: 22, color: SLATE })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 1400 },
    children: [run('Version 1.0  ·  October 2026', { size: 20, color: SLATE })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 40 },
    children: [run('Built by Z2INFY Technologies', { size: 20, color: SLATE })] }),
);

/* ----- TOC ----- */
add(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, spacing: { after: 160 },
  children: [run('Contents', { bold: true, size: 30, color: TEALDK })] }));
add(new TableOfContents('Contents', { hyperlink: true, headingStyleRange: '1-2' }));

/* ===== 1. Introduction ===== */
add(h1('1. Introduction'));
add(lead('Welcome to Pharma Ist — the all-in-one software that runs your pharmacy: billing, inventory, prescriptions, GST compliance and reports, all in one place.'));
add(p('This manual is written so that anyone — a new cashier on their first day, a pharmacist, or the pharmacy owner — can follow along and use the software confidently. Every section tells you where to find a screen, what it does, and the exact steps to complete a task, with a picture of the screen.'));
add(h3('Who should read this'));
add(bullets([
  'Cashiers / billing staff — creating bills and handling customers.',
  'Pharmacists — dispensing medicines, prescriptions and controlled drugs.',
  'Inventory managers — stock, purchases, reorder and expiry.',
  'Owners / managers — reports, users, roles and settings.',
]));
add(h3('How to use this manual'));
add(bullets([
  'Read Section 2 (Getting Started) first — it explains logging in and the screen layout.',
  'Jump to the section for the task you want to do. Each one is self-contained.',
  'For common day-to-day jobs, see Section 14 (Everyday Scenarios) — full start-to-finish walkthroughs.',
]));
add(callout('Note', 'Screens in this manual use a demo pharmacy called "Divya Care Pharmacy" with sample data. Your pharmacy name, medicines and figures will differ, but every screen and button is the same.', 'note'));

/* ===== 2. Getting Started ===== */
add(h1('2. Getting Started'));
add(h2('2.1 Logging in'));
add(p('Open your web browser and go to your pharmacy’s Pharma Ist web address (for example, http://localhost:3000 during setup, or your live address such as https://billing.yourpharmacy.in).'));
add(...steps([
  'On the Sign In page, type your User ID (your email or 10-digit mobile number).',
  'Type your Password.',
  'Tick "Stay signed in" if this is your own device (optional).',
  'Click Sign in. You will land on the Dashboard.',
]));
add(p([ run('Trying it out? ', { bold: true, size: 21, color: INK }),
  run('Use the one-click ', { size: 21, color: INK }),
  run('Try a demo account', { bold: true, size: 21, color: INK }),
  run(' buttons (Admin, Pharmacist, Cashier, Manager). The demo password is shown on the page.', { size: 21, color: INK }) ]));
add(...shot('01-login.jpg', 'The Sign In page, with one-click demo-account buttons.'));
add(callout('Tip', 'Forgot your password? Click "Forgot password?" on the login page and follow the email instructions. If you were just invited, check your email for a link to set your first password.', 'tip'));

add(h2('2.2 The screen layout'));
add(p('Every page shares the same simple layout:'));
add(bullets([
  [run('Left sidebar', { bold: true, size: 21, color: INK }), run(' — your menu. Items are grouped (Sales, Procurement, Inventory, Customers, Compliance, Reports, Administration). Click a group to expand it.', { size: 21, color: INK })],
  [run('Top bar', { bold: true, size: 21, color: INK }), run(' — a global search box ("Search anything…"), your pharmacy name, a light/dark theme toggle, notifications, and your profile menu.', { size: 21, color: INK })],
  [run('Main area', { bold: true, size: 21, color: INK }), run(' — the page you are working on. Most pages open with summary cards at the top and a table or form below.', { size: 21, color: INK })],
]));
add(callout('Note', 'You only see the menu items your role is allowed to use. If a menu item or button is missing, your role does not have permission for it — ask your pharmacy admin. (See Section 12.2, Roles & Permissions.)', 'note'));

add(h2('2.3 Who can do what (roles at a glance)'));
add(p('Pharma Ist uses roles to control access. The common roles are:'));
add(...steps([]));
add(bullets([
  [run('Admin / Pharma Admin', { bold: true, size: 21, color: INK }), run(' — full access to everything, including users, roles and settings.', { size: 21, color: INK })],
  [run('Pharmacist', { bold: true, size: 21, color: INK }), run(' — billing, prescriptions, dispensing and stock.', { size: 21, color: INK })],
  [run('Cashier / Billing Assistant', { bold: true, size: 21, color: INK }), run(' — create and manage customer bills.', { size: 21, color: INK })],
  [run('Inventory Manager', { bold: true, size: 21, color: INK }), run(' — stock, purchase orders and expiry.', { size: 21, color: INK })],
]));

add(h2('2.4 Changing the theme and signing out'));
add(bullets([
  'Light / dark mode: click the sun/moon icon in the top bar.',
  'Sign out: click Sign Out at the bottom of the left sidebar when you finish your shift.',
]));

/* ===== 3. Dashboard ===== */
add(h1('3. The Dashboard'));
add(lead('The Dashboard is your home screen — a quick health-check of the pharmacy the moment you log in.'));
add(kv('Where to find it', 'Left sidebar → Dashboard'));
add(h3('What you see'));
add(bullets([
  'A greeting and today’s date, with whether the pharmacy is "open".',
  'Four quick-action buttons: New Bill (F2), Register Rx (F3), Add Stock (F5), Process Return (F6).',
  'Summary cards: Today’s Revenue, Bills Issued Today, Low Stock Items, Expiring within 90 days.',
  'A 30-day revenue trend chart and a Sales-by-Category chart.',
]));
add(...shot('02-dashboard.jpg', 'The Dashboard — quick actions and the day’s key numbers.'));
add(callout('Tip', 'The quick-action buttons are the fastest way to start the most common jobs. You can also press the function keys shown on each button (F2, F3, F5, F6).', 'tip'));

/* ===== 4. Billing ===== */
add(h1('4. Billing (Point of Sale)'));
add(lead('The Billing screen is where you ring up a sale and print a GST receipt.'));
add(kv('Where to find it', 'Left sidebar → Sales → Billing (or click New Bill on the Dashboard)'));
add(...shot('03-billing.jpg', 'The Billing (POS) screen — search medicines on the left, bill on the right.'));
add(h3('Create a bill, step by step'));
add(...steps([
  'In the "Search medicine by name or generic" box, type the medicine name (at least 2 letters). Or press F8 and scan the barcode.',
  'Click the medicine in the results to add it to the bill. The batch and expiry are picked automatically.',
  'Set the Quantity. The price, GST and line total are calculated for you.',
  'Repeat for every item the customer is buying.',
  'Optional: enter the Customer name and Phone number on the right (needed for Rx medicines).',
  'Optional: enter a Bill discount % to reduce the whole bill.',
  'Choose the payment method: Cash, UPI, Card or Credit.',
  'For Cash, type the amount Tendered to show the change due.',
  'Click Pay & print (F9) to finish. The receipt opens ready to print.',
]));
add(h3('Worked example'));
add(callout('Example', 'A walk-in customer buys 1 strip of Paracetamol 650. Type "para", click Paracetamol 650, set Qty to 1, choose Cash, type the cash received, then Pay & print. The 80mm thermal receipt shows the GST breakup and prints automatically.', 'tip'));
add(h3('Handy shortcuts on this screen'));
add(bullets([
  'F1 — focus the search box.   F8 — scan a barcode.',
  'F4 — put the current bill on hold (serve another customer, resume later).',
  'F9 — finalize and print.',
]));
add(callout('Note', 'If a medicine is a Schedule H / H1 / X drug, Pharma Ist shows a warning and will not let you take payment until you fill in the patient and doctor names. This keeps you compliant with the law (see Section 10).', 'warn'));

/* ===== 5. Prescriptions ===== */
add(h1('5. Prescriptions'));
add(lead('Capture, verify and dispense doctor prescriptions, with a full record for compliance.'));
add(kv('Where to find it', 'Left sidebar → Sales → Prescriptions (or Register Rx on the Dashboard)'));
add(...shot('06-prescriptions.jpg', 'The Prescriptions screen — status cards and filter tabs.'));
add(h3('Register and dispense a prescription'));
add(...steps([
  'Click Register Prescription (top right).',
  'Enter the patient name, doctor name and the medicines prescribed (type manually, or upload a photo of the prescription).',
  'Save it. The prescription appears in the list with the status "Pending Review".',
  'A pharmacist reviews it and clicks Approve (or Reject with a reason).',
  'When the customer collects the medicine, open the prescription and click Dispense. This records who dispensed it and when.',
]));
add(p('Use the tabs — All, Pending Review, Approved, Dispensed, Rejected — to filter the list, and the search box to find a prescription by Rx number, patient or doctor.'));

/* ===== 6. Returns ===== */
add(h1('6. Returns'));
add(lead('Handle medicines coming back — from customers, or returned to your vendors.'));
add(kv('Where to find it', 'Left sidebar → Sales → Returns (or Process Return on the Dashboard)'));
add(...shot('07-returns.jpg', 'The Returns screen — Customer Returns and Vendor Returns in one place.'));
add(h3('Process a customer return'));
add(...steps([
  'Click New Return (top right).',
  'Find the original bill (by bill number or customer).',
  'Select the item(s) being returned and the quantity.',
  'Choose a reason (for example, wrong item, damaged, expired).',
  'Submit. Depending on your settings this may need an admin to Approve.',
  'Once processed, the stock is added back and the refund is recorded.',
]));
add(callout('Note', 'The tabs at the top switch between All Returns, Customer Returns and Vendor Returns. "Purchase Returns" (sending stock back to a supplier) opens here on the Vendor Returns tab.', 'note'));

/* ===== 7. Procurement ===== */
add(h1('7. Procurement (Buying Stock)'));
add(lead('Everything about ordering stock from suppliers and receiving it into your shelves.'));
add(kv('Where to find it', 'Left sidebar → Procurement'));
add(p('The Procurement group has: Purchase Orders, Scan Supplier Invoice, Vendors, Goods Receipt and Purchase Returns.'));

add(h2('7.1 Vendors'));
add(p('Vendors are your suppliers / distributors. Keep their details, GST number, payment terms and outstanding balances here.'));
add(...shot('09-vendors.jpg', 'The Vendors screen — your suppliers, purchases and balances.'));
add(h3('Add a vendor'));
add(...steps([
  'Click Add Vendor (top right).',
  'Fill in the name, contact person, phone, GST number, city and payment terms.',
  'Save. The vendor is now available when you create purchase orders.',
]));

add(h2('7.2 Purchase Orders'));
add(p('A Purchase Order (PO) is a formal order you send to a vendor for stock.'));
add(...shot('08-purchase-orders.jpg', 'The Purchase Orders screen — open orders and their value.'));
add(h3('Create and receive a purchase order'));
add(...steps([
  'Click New Purchase Order.',
  'Choose the vendor.',
  'Add the medicines and quantities you want to order, with the purchase price.',
  'Save and send. The PO status becomes "Ordered".',
  'When the stock arrives, open the PO and click Receive (or use Goods Receipt). Enter the batch numbers, expiry dates and quantities received.',
  'The received stock is added to your inventory automatically, and a stock movement is recorded for the audit trail.',
]));
add(callout('Tip', 'Short on a medicine? The Reorder Queue (Section 8.3) has an "Order Now" button that starts a purchase order for you with the suggested quantity.', 'tip'));

add(h2('7.3 Scan Supplier Invoice'));
add(p('Instead of typing a purchase in by hand, you can photograph or upload the supplier’s invoice. Pharma Ist reads the lines, lets you review them, and then adds the stock. Find it under Procurement → Scan Supplier Invoice.'));

/* ===== 8. Inventory ===== */
add(h1('8. Inventory (Stock)'));
add(lead('See exactly what you have, where it is, what is running low and what is about to expire.'));
add(kv('Where to find it', 'Left sidebar → Inventory'));
add(p('The Inventory group has: Stock Management, Medicine Catalog, Batch Management, Transfers, Reorder Queue, Expiry Monitor and Stock Count.'));

add(h2('8.1 Stock Management'));
add(p('This is your inventory hub. The top cards show Total Items, Low Stock, Expiring (90 days) and Need Reorder — click any card to jump to the matching page. Two tabs sit below: Overview (stock health) and Stock Levels (every batch, with filters).'));
add(...shot('04-stock.jpg', 'Stock Management — the inventory hub with health summary.'));
add(h3('Add new stock'));
add(...steps([
  'Click Add Stock (top right).',
  'Search for the medicine.',
  'Enter the batch number, quantity, purchase price, MRP, expiry date and (optionally) the rack location.',
  'Save. The stock is now available for billing.',
]));
add(callout('Tip', 'To bulk-load stock from a spreadsheet, use the Import button and follow the column format shown. Use Export to download your current stock as a spreadsheet.', 'tip'));

add(h2('8.2 Medicine Catalog'));
add(p('The catalog is your master list of every medicine you stock — name, generic name, manufacturer, category, form, strength, MRP and GST rate. This is different from stock: the catalog says what a medicine is; stock says how many you have.'));
add(...shot('05-medicines.jpg', 'The Medicine Catalog — your master medicine list.'));
add(h3('Add a medicine to the catalog'));
add(...steps([
  'Click Add Medicine (top right).',
  'Fill in the name, generic name, manufacturer, category, form and strength.',
  'Enter the MRP, selling price and GST rate.',
  'For prescription medicines, select the drug Schedule (H, H1 or X).',
  'Save. You can now add stock batches for this medicine.',
]));
add(callout('Note', 'To stop selling a medicine without losing its history, open its menu and choose Discontinue. It disappears from new bill searches but all past records stay intact.', 'note'));

add(h2('8.3 Reorder Queue'));
add(p('A smart shopping list: medicines at or below their reorder level, ranked by urgency, with a suggested order quantity and preferred vendor.'));
add(...shot('11-reorder.jpg', 'The Reorder Queue — what to buy next, ranked by urgency.'));
add(...steps([
  'Review the Critical (red) items first.',
  'Click Order Now on an item to start a purchase order with the suggested quantity, or',
  'Click Export Queue to share the list.',
]));

add(h2('8.4 Expiry Monitor'));
add(p('Prevent losses from expired stock. Batches are grouped into buckets: Expired, within 30 days, 31–60 days, 61–90 days, and Good Stock.'));
add(...shot('12-expiry.jpg', 'The Expiry Monitor — act before medicines expire.'));
add(...steps([
  'Check the "Within 30 Days" tab regularly.',
  'For near-expiry items, decide to Return to vendor, Discount to sell faster, or Dispose.',
  'Use Export Report for your records.',
]));

add(h2('8.5 Batch Management, Transfers & Stock Count'));
add(bullets([
  [run('Batch Management', { bold: true, size: 21, color: INK }), run(' — view and manage individual batches of a medicine (batch number, expiry, quantity).', { size: 21, color: INK })],
  [run('Transfers', { bold: true, size: 21, color: INK }), run(' — move stock between locations or branches.', { size: 21, color: INK })],
  [run('Stock Count', { bold: true, size: 21, color: INK }), run(' — do a physical count and reconcile it against the system to fix any differences.', { size: 21, color: INK })],
]));

/* ===== 9. Customers ===== */
add(h1('9. Customers'));
add(lead('Keep customer profiles, loyalty points, credit accounts and purchase history.'));
add(kv('Where to find it', 'Left sidebar → Customers'));
add(...shot('10-customers.jpg', 'Customer Management — profiles, loyalty and credit.'));
add(h3('Add a customer'));
add(...steps([
  'Click Add Customer (top right).',
  'Enter the name, phone, email and customer type (for example, Walk-in, Regular or VIP).',
  'Save. You can now pick this customer on the billing screen and track their history.',
]));
add(p('The Customers group also has Contacts, Loyalty, Credit Accounts and Patient History for deeper customer management.'));
add(callout('Note', 'Credit Accounts track customers who pay later ("Store Credit"). The Total Credit Due card shows how much is outstanding.', 'note'));

/* ===== 10. Compliance ===== */
add(h1('10. Compliance (Schedule Register)'));
add(lead('A statutory record of every Schedule H, H1 and X drug you dispense — required under the Drugs & Cosmetics Act, 1940.'));
add(kv('Where to find it', 'Left sidebar → Compliance → Schedule Register'));
add(...shot('13-schedule.jpg', 'The Schedule Drug Register — a ready-to-audit statutory record.'));
add(p('You do not fill this register in by hand. When you bill a Schedule H / H1 / X medicine and enter the patient and doctor details, Pharma Ist records the entry here automatically — medicine, schedule, batch, quantity, patient, prescriber, the bill, who dispensed it, and when.'));
add(...steps([
  'Use the tabs (All, Sch H, Sch H1, Sch X) to filter by schedule.',
  'Search by patient, doctor, medicine, bill or batch.',
  'Click Export Register (CSV) to hand a clean record to a drug inspector during an audit.',
]));
add(callout('Note', '"Controlled Drugs" in the Compliance menu opens this same register filtered to Schedule X.', 'note'));

/* ===== 11. Reports ===== */
add(h1('11. Reports & Analytics'));
add(lead('Understand how your pharmacy is doing — sales, purchases, stock, profit, GST and customers.'));
add(kv('Where to find it', 'Left sidebar → Reports'));
add(...shot('14-reports.jpg', 'Reports & Analytics — the full reporting suite.'));
add(p('Reports available:'));
add(bullets([
  'Sales — revenue trend, payment mix and peak hours.',
  'Purchase — what you bought and from whom.',
  'Inventory — stock health and valuation.',
  'Stock Reconciliation — opening + purchases + returns − sales − disposals = closing (proves your stock balances).',
  'Returns — customer and vendor returns.',
  'Financial — profit and margins.',
  'GST — rate-wise tax for your returns (GSTR-style).',
  'Customer Insights — top customers and buying patterns.',
]));
add(...steps([
  'Pick the report from the Reports menu (or the tabs across the top).',
  'Choose the period: Today, 7 Days, 30 Days, 90 Days — or Live.',
  'Click Export CSV to download, or Print for a paper copy.',
]));

/* ===== 12. Administration ===== */
add(h1('12. Administration'));
add(lead('For owners and admins: manage staff logins, what each role can do, and all pharmacy settings.'));
add(kv('Where to find it', 'Left sidebar → Administration'));

add(h2('12.1 User Management'));
add(p('Invite your staff and give each person a role.'));
add(...shot('15-users.jpg', 'User Management — invite staff and assign roles.'));
add(...steps([
  'Click Invite User (top right).',
  'Enter the person’s name, email and phone.',
  'Assign one or more roles (for example, Pharmacist or Cashier).',
  'Send the invite. They receive an email to set their password and log in.',
]));
add(callout('Note', 'A newly invited user has the status "Pending" until they set their password. You can also Export the user list as a spreadsheet.', 'note'));

add(h2('12.2 Roles & Permissions'));
add(p('A role is a set of permissions. Permissions are granted per module (Medicine Master, Inventory, Billing, Customers, Reports…) and per action (View, Create, Edit, Delete, Export, Approve).'));
add(...shot('16-roles.jpg', 'Roles & Permissions — control exactly what each role can do.'));
add(h3('Create or edit a role'));
add(...steps([
  'Click Create Role (or the pencil icon on an existing role).',
  'Give the role a name and short description.',
  'Tick the actions the role may perform for each module.',
  'Save. Staff with this role immediately get (or lose) those abilities — this is what shows or hides menu items and buttons for them.',
]));
add(callout('Tip', 'Give each person the least access they need to do their job. For example, a Cashier usually needs Billing (Create) and Customers (View/Create) — but not Settings or Users.', 'tip'));

add(h2('12.3 Settings'));
add(p('The Settings hub groups every configuration area as tiles.'));
add(...shot('17-settings.jpg', 'Settings — every configuration area in one place.'));
add(bullets([
  [run('Pharmacy Configuration', { bold: true, size: 21, color: INK }), run(' — Pharmacy Profile (name, logo, licence), Tax & Billing (GST, payment methods), Receipt Configuration (what prints on the receipt).', { size: 21, color: INK })],
  [run('Communication', { bold: true, size: 21, color: INK }), run(' — Notifications, Message Templates (WhatsApp/SMS), Integrations.', { size: 21, color: INK })],
  [run('Data Management', { bold: true, size: 21, color: INK }), run(' — Import, export, backup and restore.', { size: 21, color: INK })],
  [run('Customization', { bold: true, size: 21, color: INK }), run(' — Dropdown Options and Form Fields (show/hide/rename fields on forms).', { size: 21, color: INK })],
  [run('System Preferences', { bold: true, size: 21, color: INK }), run(' — Localization, thresholds, security, and Change Password.', { size: 21, color: INK })],
  [run('Administration', { bold: true, size: 21, color: INK }), run(' — Access Control, Users, Roles and the Audit Log.', { size: 21, color: INK })],
]));
add(callout('Tip', 'Set your real pharmacy name, logo, GST number and licence in Pharmacy Profile first — these appear on every receipt and report.', 'tip'));

/* ===== 13. Help ===== */
add(h1('13. Help & Support'));
add(lead('Guides, FAQs and support channels, built into the software.'));
add(kv('Where to find it', 'Left sidebar → Support → Help'));
add(...shot('18-help.jpg', 'Help & Support — searchable FAQs and contact options.'));
add(bullets([
  'Browse or search the Frequently Asked Questions by category (Medicines, Inventory, Billing, Reports, Users, System).',
  'Use Chat Support or Email Support to reach the team.',
  'The Support group also has Notifications and a Keyboard Shortcuts reference.',
]));

/* ===== 14. Scenarios ===== */
add(h1('14. Everyday Scenarios'));
add(lead('Follow these start-to-finish walkthroughs for the most common daily jobs.'));

add(h2('Scenario A — Opening the pharmacy for the day'));
add(...steps([
  'Log in (Section 2.1). You land on the Dashboard.',
  'Check Today’s Revenue and Bills — confirm yesterday closed correctly.',
  'Check the Low Stock Items and Expiring cards.',
  'If anything is low, open the Reorder Queue (Section 8.3) and place orders.',
  'You are ready to serve customers.',
]));

add(h2('Scenario B — Selling an over-the-counter medicine (cash)'));
add(...steps([
  'Click New Bill on the Dashboard (or Sales → Billing).',
  'Search the medicine (e.g. "Paracetamol"), click it, set the quantity.',
  'Choose Cash and enter the amount tendered.',
  'Click Pay & print. Hand over the printed receipt and the change.',
]));

add(h2('Scenario C — Dispensing a Schedule H (prescription) medicine'));
add(...steps([
  'On the Billing screen, add the Schedule H medicine. A warning badge appears.',
  'Enter the Customer (patient) name and phone, and the Doctor name — payment stays blocked until these are filled.',
  'Take payment and print.',
  'The sale is automatically written to the Schedule Register (Section 10) — no extra work needed.',
]));

add(h2('Scenario D — Receiving new stock from a supplier'));
add(...steps([
  'Procurement → Purchase Orders → New Purchase Order (or Order Now from the Reorder Queue).',
  'Choose the vendor, add medicines, quantities and purchase prices; save and send.',
  'When the delivery arrives, open the PO and click Receive.',
  'Enter the batch numbers, expiry dates and quantities received.',
  'Stock updates automatically; check it under Inventory → Stock Management.',
]));

add(h2('Scenario E — Handling a customer return'));
add(...steps([
  'Sales → Returns → New Return.',
  'Find the original bill, select the item and quantity, and choose a reason.',
  'Submit (an admin approves if your settings require it).',
  'Stock goes back on the shelf and the refund is recorded.',
]));

add(h2('Scenario F — Adding a brand-new medicine you’ve never stocked'));
add(...steps([
  'Inventory → Medicine Catalog → Add Medicine. Fill in the details and Schedule (if any). Save.',
  'Inventory → Stock Management → Add Stock. Enter the first batch, quantity, prices and expiry. Save.',
  'The medicine is now searchable on the Billing screen.',
]));

add(h2('Scenario G — Closing the day'));
add(...steps([
  'From the Dashboard, click Day Close.',
  'Count your cash and enter the amount; the screen shows any variance against expected cash.',
  'Confirm to record the day close. This keeps your records accurate and stops the "day close pending" reminder.',
]));

add(h2('Scenario H — Weekly business review (owner)'));
add(...steps([
  'Reports → Sales; set the period to 7 Days. Review revenue, payment mix and peak hours.',
  'Reports → Financial for profit and margins; Reports → GST before filing.',
  'Reports → Stock Reconciliation to confirm stock balances.',
  'Inventory → Reorder Queue to plan next week’s purchases.',
]));

/* ===== 15. Reference ===== */
add(h1('15. Quick Reference & Troubleshooting'));
add(h2('15.1 Keyboard shortcuts'));
add(bullets([
  'F2 — New Bill        F3 — Register Prescription',
  'F5 — Add Stock       F6 — Process Return',
  'F1 — Focus search (Billing)   F8 — Scan barcode   F4 — Hold bill   F9 — Pay & print',
  '/ — focus global search   Esc — close any dialog   ? — open Help',
]));
add(h2('15.2 Troubleshooting'));
add(bullets([
  [run('A menu item or button is missing. ', { bold: true, size: 21, color: INK }), run('Your role does not have permission. Ask your admin (Section 12.2).', { size: 21, color: INK })],
  [run('Can’t take payment on a bill. ', { bold: true, size: 21, color: INK }), run('A Schedule H/H1/X medicine needs the patient and doctor names first (Section 4, 10).', { size: 21, color: INK })],
  [run('A medicine isn’t in billing search. ', { bold: true, size: 21, color: INK }), run('It may have no stock, or be discontinued. Check the Medicine Catalog and Stock Management.', { size: 21, color: INK })],
  [run('"Day close pending" keeps showing. ', { bold: true, size: 21, color: INK }), run('Complete the Day Close from the Dashboard (Scenario G).', { size: 21, color: INK })],
  [run('Forgot password. ', { bold: true, size: 21, color: INK }), run('Use "Forgot password?" on the login page.', { size: 21, color: INK })],
]));
add(h2('15.3 Glossary'));
add(bullets([
  [run('Batch', { bold: true, size: 21, color: INK }), run(' — a specific lot of a medicine with its own batch number and expiry date.', { size: 21, color: INK })],
  [run('MRP', { bold: true, size: 21, color: INK }), run(' — Maximum Retail Price printed on the pack.', { size: 21, color: INK })],
  [run('Schedule H / H1 / X', { bold: true, size: 21, color: INK }), run(' — categories of prescription drugs with legal record-keeping requirements.', { size: 21, color: INK })],
  [run('Reorder level', { bold: true, size: 21, color: INK }), run(' — the stock level at which a medicine should be re-ordered.', { size: 21, color: INK })],
  [run('GST', { bold: true, size: 21, color: INK }), run(' — Goods and Services Tax, calculated automatically on every bill.', { size: 21, color: INK })],
]));
add(spacer());
add(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 300 },
  children: [run('— End of Manual —', { italics: true, size: 20, color: SLATE })] }));
add(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 40 },
  children: [run('Pharma Ist · Built by Z2INFY Technologies', { size: 18, color: SLATE })] }));

/* ===================== DOCUMENT ===================== */
const doc = new Document({
  creator: 'Z2INFY Technologies',
  title: 'Pharma Ist — User Manual',
  description: 'Complete user manual for the Pharma Ist pharmacy management system',
  styles: {
    default: { document: { run: { font: 'Arial', size: 21, color: INK } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 30, bold: true, color: TEALDK, font: 'Arial' },
        paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 24, bold: true, color: INK, font: 'Arial' },
        paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 21, bold: true, color: TEAL, font: 'Arial' },
        paragraph: { spacing: { before: 160, after: 80 }, outlineLevel: 2 } },
    ],
  },
  numbering: { config: numberingConfig },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    headers: { default: new Header({ children: [ new Paragraph({ alignment: AlignmentType.RIGHT,
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D9E2E0', space: 4 } },
      children: [run('Pharma Ist — User Manual', { size: 16, color: SLATE })] }) ] }) },
    footers: { default: new Footer({ children: [ new Paragraph({ alignment: AlignmentType.CENTER,
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'D9E2E0', space: 4 } },
      children: [ run('Page ', { size: 16, color: SLATE }),
        new TextRun({ children: [PageNumber.CURRENT], size: 16, color: SLATE, font: 'Arial' }),
        run(' of ', { size: 16, color: SLATE }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: SLATE, font: 'Arial' }) ] }) ] }) },
    children: body,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  console.log('WROTE', OUT, '(' + (buf.length / 1024).toFixed(0) + ' KB)');
  console.log('step lists used:', stepPtr);
});
