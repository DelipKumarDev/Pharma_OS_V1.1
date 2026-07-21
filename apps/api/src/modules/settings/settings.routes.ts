import { Router } from 'express';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { MedicineCategory, MedicineForm, DrugSchedule } from '@prisma/client';
import { authenticate, requirePermission } from '../../middleware/authenticate';
import { prisma } from '../../config/database';
import { sendSuccess } from '../../utils/response';
import { AuthRequest } from '../../middleware/authenticate';
import { NextFunction, Response } from 'express';
import { toCsv, sendCsv } from '../../utils/csv';
import { logger } from '../../utils/logger';
import { resolveTemplates, TEMPLATE_VARIABLES, MessageTemplates } from '../../utils/template';

const router = Router();
router.use(authenticate);

const t = (req: AuthRequest) => req.user!.tenantId;

// Case/spacing-insensitive column lookup so imports work with the template
// headers ("Medicine Name") as well as camelCase keys ("medicineName")
function getField(row: Record<string, unknown>, ...aliases: string[]): string | undefined {
  const normalized = new Map(
    Object.entries(row).map(([k, v]) => [k.toLowerCase().replace(/[^a-z0-9]/g, ''), v]),
  );
  for (const alias of aliases) {
    const v = normalized.get(alias.toLowerCase().replace(/[^a-z0-9]/g, ''));
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return undefined;
}

function parseNum(v: string | undefined): number | undefined {
  if (v === undefined) return undefined;
  const n = Number(v.replace(/[₹,\s]/g, ''));
  return isNaN(n) ? undefined : n;
}

function parseExpiryDate(v: string | undefined): Date | undefined {
  if (!v) return undefined;
  // MM/YYYY or MM-YYYY → last day of that month
  const mmYyyy = v.match(/^(\d{1,2})[/\-](\d{4})$/);
  if (mmYyyy) return new Date(Number(mmYyyy[2]), Number(mmYyyy[1]), 0);
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : d;
}

router.get('/', requirePermission('settings', 'view'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: t(req) } });
    if (!tenant) { res.status(404).json({ success: false, message: 'Tenant not found' }); return; }
    sendSuccess(res, {
      profile: {
        pharmacyName: tenant.name, ownerName: '', pharmacyType: tenant.type,
        licenseNumber: tenant.licenseNumber, drugLicenseNumber: tenant.drugLicenseNumber,
        gstNumber: tenant.gstNumber, address: tenant.addressLine1, city: tenant.city,
        state: tenant.state, pincode: tenant.pincode, phone: '', mobile: '', email: tenant.email ?? '',
        website: '', logoUrl: tenant.logoUrl, supportContact: tenant.supportContact ?? '',
      },
      system: {
        timezone: tenant.timezone, dateFormat: tenant.dateFormat, currency: tenant.currency,
        lowStockThreshold: tenant.lowStockThreshold, expiryAlertDays: tenant.expiryAlertDays,
        autoBackup: tenant.autoBackup, backupFrequency: 'daily', sessionTimeout: tenant.sessionTimeout, language: tenant.language,
      },
      tax: { enableGST: tenant.gstEnabled, gstRegistered: tenant.gstRegistered, defaultGST: tenant.defaultGST },
      billing: {
        printReceiptOnSale: tenant.printReceiptOnSale, showGSTOnReceipt: tenant.showGSTOnReceipt,
        showGenericName: tenant.showGenericName, termsOnReceipt: tenant.termsOnReceipt,
        thankYouMessage: tenant.thankYouMessage, acceptCash: tenant.acceptCash,
        acceptUPI: tenant.acceptUPI, acceptCard: tenant.acceptCard, acceptCredit: tenant.acceptCredit,
        upiId: tenant.upiId, creditLimit: tenant.creditLimit,
      },
      notifications: {
        lowStockAlert: tenant.lowStockAlert, expiryAlert: tenant.expiryAlert,
        reorderAlert: tenant.reorderAlert, dailyReport: tenant.dailyReport,
        weeklyReport: tenant.weeklyReport, monthlyReport: tenant.monthlyReport,
        emailAlerts: tenant.emailAlerts, smsAlerts: tenant.smsAlerts,
        whatsappAlerts: tenant.whatsappAlerts, alertEmail: tenant.alertEmail, alertPhone: tenant.alertPhone,
      },
      templates: {
        values: resolveTemplates(tenant.messageTemplates),
        variables: TEMPLATE_VARIABLES,
      },
    });
  } catch (err) { next(err); }
});

router.patch('/:section', requirePermission('settings', 'edit'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const section = req.params['section'];
    const body = req.body as Record<string, unknown>;
    const tenantId = t(req);

    const sectionMap: Record<string, Partial<Record<string, unknown>>> = {
      profile: {
        name: body['pharmacyName'],
        phone: body['phone'],
        email: body['email'],
        addressLine1: body['address'],
        city: body['city'],
        state: body['state'],
        pincode: body['pincode'],
        licenseNumber: body['licenseNumber'],
        drugLicenseNumber: body['drugLicenseNumber'],
        gstNumber: body['gstNumber'],
        supportContact: body['supportContact'],
      },
      system: {
        timezone: body['timezone'],
        dateFormat: body['dateFormat'],
        currency: body['currency'],
        lowStockThreshold: body['lowStockThreshold'],
        expiryAlertDays: body['expiryAlertDays'],
        autoBackup: body['autoBackup'],
        sessionTimeout: body['sessionTimeout'],
        language: body['language'],
      },
      tax: {
        gstEnabled: body['enableGST'],
        gstRegistered: body['gstRegistered'],
        defaultGST: body['defaultGST'],
      },
      billing: {
        printReceiptOnSale: body['printReceiptOnSale'],
        showGSTOnReceipt: body['showGSTOnReceipt'],
        showGenericName: body['showGenericName'],
        termsOnReceipt: body['termsOnReceipt'],
        thankYouMessage: body['thankYouMessage'],
        acceptCash: body['acceptCash'],
        acceptUPI: body['acceptUPI'],
        acceptCard: body['acceptCard'],
        acceptCredit: body['acceptCredit'],
        upiId: body['upiId'],
        creditLimit: body['creditLimit'],
      },
      notifications: {
        lowStockAlert: body['lowStockAlert'],
        expiryAlert: body['expiryAlert'],
        reorderAlert: body['reorderAlert'],
        dailyReport: body['dailyReport'],
        weeklyReport: body['weeklyReport'],
        monthlyReport: body['monthlyReport'],
        emailAlerts: body['emailAlerts'],
        smsAlerts: body['smsAlerts'],
        whatsappAlerts: body['whatsappAlerts'],
        alertEmail: body['alertEmail'],
        alertPhone: body['alertPhone'],
      },
    };

    // Message templates are stored in a single JSON column, merged over what exists.
    if (section === 'templates') {
      const current = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { messageTemplates: true } });
      const existing = (current?.messageTemplates && typeof current.messageTemplates === 'object') ? current.messageTemplates as Record<string, unknown> : {};
      const incoming = (body['values'] ?? body) as Partial<MessageTemplates>;
      const keys: (keyof MessageTemplates)[] = ['refillReminder', 'lowStockAlert', 'expiryAlert', 'paymentDue'];
      const merged: Record<string, string> = {};
      for (const [k, v] of Object.entries(existing)) if (typeof v === 'string') merged[k] = v;
      for (const k of keys) if (typeof incoming[k] === 'string') merged[k] = (incoming[k] as string).slice(0, 500);
      const updated = await prisma.tenant.update({ where: { id: tenantId }, data: { messageTemplates: merged } });
      sendSuccess(res, { section, updated: true, tenantId: updated.id, templates: merged }, 'Message templates updated');
      return;
    }

    const updateData = sectionMap[section ?? ''] ?? body;
    const filtered = Object.fromEntries(Object.entries(updateData).filter(([, v]) => v !== undefined));

    const updated = await prisma.tenant.update({ where: { id: tenantId }, data: filtered });
    sendSuccess(res, { section, updated: true, tenantId: updated.id }, 'Settings updated');
  } catch (err) { next(err); }
});

// ─── Backup — pg_dump with JSON fallback ─────────────────────────────────────

function runPgDump(outFile: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const dbUrl = process.env['DATABASE_URL'];
    if (!dbUrl) { reject(new Error('DATABASE_URL not set')); return; }
    const proc = spawn('pg_dump', ['--no-owner', '--format=plain', `--file=${outFile}`, dbUrl], {
      stdio: ['ignore', 'ignore', 'pipe'],
      shell: process.platform === 'win32',
    });
    let stderr = '';
    proc.stderr.on('data', d => { stderr += String(d); });
    proc.on('error', reject);
    proc.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `pg_dump exited with code ${code}`));
    });
  });
}

async function collectTenantData(tenantId: string) {
  const [medicines, inventory, customers, vendors, bills, prescriptions, returns] = await Promise.all([
    prisma.medicine.findMany({ where: { tenantId, deletedAt: null } }),
    prisma.inventoryItem.findMany({ where: { tenantId, deletedAt: null } }),
    prisma.customer.findMany({ where: { tenantId, deletedAt: null } }),
    prisma.vendor.findMany({ where: { tenantId, deletedAt: null } }),
    prisma.bill.findMany({ where: { tenantId, deletedAt: null }, include: { items: true } }),
    prisma.prescription.findMany({ where: { tenantId }, include: { medicines: true } }),
    prisma.returnRequest.findMany({ where: { tenantId }, include: { items: true } }),
  ]);
  return { medicines, inventory, customers, vendors, bills, prescriptions, returns };
}

router.post('/backup', requirePermission('settings', 'edit'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const backupDir = path.resolve(process.env['BACKUP_DIR'] ?? 'backups');
    fs.mkdirSync(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');

    // Preferred: full SQL dump via pg_dump
    const sqlFile = path.join(backupDir, `pharmaos-backup-${stamp}.sql`);
    try {
      await runPgDump(sqlFile);
      const size = fs.statSync(sqlFile).size;
      sendSuccess(res, {
        method: 'pg_dump',
        file: path.basename(sqlFile),
        size: `${(size / 1024 / 1024).toFixed(2)} MB`,
        createdAt: new Date().toISOString(),
      }, 'Full database backup created');
      return;
    } catch (err) {
      logger.warn(`pg_dump unavailable (${(err as Error).message}) — falling back to JSON export`);
      if (fs.existsSync(sqlFile)) fs.unlinkSync(sqlFile);
    }

    // Fallback: tenant-scoped JSON snapshot
    const data = await collectTenantData(t(req));
    const jsonFile = path.join(backupDir, `pharmaos-backup-${stamp}.json`);
    fs.writeFileSync(jsonFile, JSON.stringify({ exportedAt: new Date().toISOString(), tenantId: t(req), ...data }, null, 0));
    const size = fs.statSync(jsonFile).size;
    const records = Object.values(data).reduce((s, arr) => s + arr.length, 0);
    sendSuccess(res, {
      method: 'json',
      file: path.basename(jsonFile),
      size: `${(size / 1024 / 1024).toFixed(2)} MB`,
      records,
      createdAt: new Date().toISOString(),
    }, 'Tenant data backup created (install PostgreSQL client tools for full SQL dumps)');
  } catch (err) { next(err); }
});

// ─── Export — real CSV/JSON downloads ────────────────────────────────────────

router.get('/export/:type', requirePermission('settings', 'edit'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = t(req);
    const type = req.params['type'];
    const stamp = new Date().toISOString().slice(0, 10);

    switch (type) {
      case 'medicines': {
        const rows = await prisma.medicine.findMany({ where: { tenantId, deletedAt: null }, orderBy: { name: 'asc' } });
        sendCsv(res, `medicines-${stamp}.csv`, toCsv(rows, [
          { header: 'Medicine Name', value: r => r.name },
          { header: 'Generic Name', value: r => r.genericName },
          { header: 'Brand Name', value: r => r.brandName },
          { header: 'Manufacturer', value: r => r.manufacturer },
          { header: 'Category', value: r => r.category },
          { header: 'Dosage Form', value: r => r.form },
          { header: 'Strength', value: r => r.strength },
          { header: 'Unit', value: r => r.unit },
          { header: 'HSN Code', value: r => r.hsn },
          { header: 'Barcode', value: r => r.barcode },
          { header: 'Schedule', value: r => r.schedule },
          { header: 'GST %', value: r => r.gstRate },
          { header: 'MRP', value: r => r.mrp },
          { header: 'Purchase Price', value: r => r.purchasePrice },
          { header: 'Selling Price', value: r => r.sellingPrice },
          { header: 'Reorder Level', value: r => r.reorderLevel },
          { header: 'Status', value: r => r.status },
        ]));
        return;
      }
      case 'inventory': {
        const rows = await prisma.inventoryItem.findMany({
          where: { tenantId, deletedAt: null },
          include: { medicine: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
        });
        sendCsv(res, `inventory-${stamp}.csv`, toCsv(rows, [
          { header: 'Medicine Name', value: r => r.medicine?.name },
          { header: 'Batch Number', value: r => r.batchNumber },
          { header: 'Qty', value: r => r.quantity },
          { header: 'Purchase Price', value: r => r.purchasePrice },
          { header: 'MRP', value: r => r.mrp },
          { header: 'Selling Price', value: r => r.sellingPrice },
          { header: 'Expiry Date', value: r => r.expiryDate.toISOString().slice(0, 10) },
          { header: 'Rack Location', value: r => r.rackLocation },
          { header: 'Status', value: r => r.status },
        ]));
        return;
      }
      case 'customers': {
        const rows = await prisma.customer.findMany({ where: { tenantId, deletedAt: null }, orderBy: { name: 'asc' } });
        sendCsv(res, `customers-${stamp}.csv`, toCsv(rows, [
          { header: 'Name', value: r => r.name },
          { header: 'Phone', value: r => r.phone },
          { header: 'Email', value: r => r.email },
          { header: 'Address', value: r => r.address },
          { header: 'Type', value: r => r.customerType },
          { header: 'Total Purchases', value: r => r.totalPurchases },
          { header: 'Total Spend', value: r => r.totalSpend },
          { header: 'Loyalty Points', value: r => r.loyaltyPoints },
          { header: 'Status', value: r => r.status },
        ]));
        return;
      }
      case 'vendors': {
        const rows = await prisma.vendor.findMany({ where: { tenantId, deletedAt: null }, orderBy: { name: 'asc' } });
        sendCsv(res, `vendors-${stamp}.csv`, toCsv(rows, [
          { header: 'Company Name', value: r => r.name },
          { header: 'Contact Person', value: r => r.contactPerson },
          { header: 'Phone', value: r => r.phone },
          { header: 'Email', value: r => r.email },
          { header: 'Address', value: r => r.address },
          { header: 'GST Number', value: r => r.gstNumber },
          { header: 'Payment Terms', value: r => r.paymentTerms },
          { header: 'Pending Payment', value: r => r.pendingPayment },
          { header: 'Status', value: r => r.status },
        ]));
        return;
      }
      case 'bills': {
        const rows = await prisma.bill.findMany({
          where: { tenantId, deletedAt: null },
          include: { items: true },
          orderBy: { createdAt: 'desc' },
          take: 10000,
        });
        sendCsv(res, `bills-${stamp}.csv`, toCsv(rows, [
          { header: 'Bill No', value: r => r.billNumber },
          { header: 'Date', value: r => r.createdAt.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) },
          { header: 'Customer', value: r => r.customerName ?? 'Walk-in' },
          { header: 'Phone', value: r => r.customerPhone },
          { header: 'Items', value: r => r.items.length },
          { header: 'Subtotal', value: r => r.subtotal },
          { header: 'Discount', value: r => r.discountAmount },
          { header: 'GST', value: r => r.taxAmount },
          { header: 'Total', value: r => r.totalAmount },
          { header: 'Paid', value: r => r.paidAmount },
          { header: 'Payment Method', value: r => r.paymentMethod },
          { header: 'Status', value: r => r.status },
        ]));
        return;
      }
      case 'backup': {
        const data = await collectTenantData(tenantId);
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="pharmaos-data-${stamp}.json"`);
        res.send(JSON.stringify({ exportedAt: new Date().toISOString(), ...data }));
        return;
      }
      default:
        res.status(400).json({ success: false, message: `Unknown export type "${type}". Valid: medicines, inventory, customers, vendors, bills, backup` });
    }
  } catch (err) { next(err); }
});

// ─── Import — validates and inserts parsed CSV rows ──────────────────────────
// Body: { rows: Array<Record<string, string>> } — frontend parses the CSV file

const VALID_CATEGORIES = Object.values(MedicineCategory) as string[];
const VALID_FORMS = Object.values(MedicineForm) as string[];
const VALID_SCHEDULES = Object.values(DrugSchedule) as string[];

router.post('/import/:type', requirePermission('settings', 'edit'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = t(req);
    const type = req.params['type'];
    const rows = (req.body as { rows?: Array<Record<string, unknown>> }).rows;

    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(422).json({ success: false, message: 'Request body must contain a non-empty "rows" array (parsed from your CSV file)' });
      return;
    }
    if (rows.length > 5000) {
      res.status(422).json({ success: false, message: 'Maximum 5000 rows per import. Split your file and retry.' });
      return;
    }

    let imported = 0, skipped = 0;
    const errors: Array<{ row: number; message: string }> = [];

    if (type === 'medicines') {
      const existing = await prisma.medicine.findMany({ where: { tenantId, deletedAt: null }, select: { name: true } });
      const existingNames = new Set(existing.map(m => m.name.toLowerCase()));
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]!;
        const name = getField(row, 'Medicine Name', 'name');
        if (!name) { errors.push({ row: i + 1, message: 'Medicine Name is required' }); continue; }
        if (name.length > 150) { errors.push({ row: i + 1, message: 'Medicine Name exceeds 150 characters' }); continue; }
        if (existingNames.has(name.toLowerCase())) { skipped++; continue; }
        const category = getField(row, 'Category')?.toLowerCase();
        const form = getField(row, 'Dosage Form', 'form')?.toLowerCase();
        const schedule = getField(row, 'Schedule')?.toUpperCase();
        const mrp = parseNum(getField(row, 'MRP')) ?? 0;
        const sellingPrice = parseNum(getField(row, 'Selling Price', 'sellingPrice')) ?? mrp;
        const gstRate = parseNum(getField(row, 'GST %', 'GST', 'gstRate')) ?? 12;
        if (mrp < 0 || sellingPrice < 0) { errors.push({ row: i + 1, message: 'Prices cannot be negative' }); continue; }
        if (gstRate < 0 || gstRate > 100) { errors.push({ row: i + 1, message: 'GST % must be between 0 and 100' }); continue; }
        await prisma.medicine.create({
          data: {
            tenantId, name,
            genericName: getField(row, 'Generic Name', 'genericName'),
            brandName: getField(row, 'Brand Name', 'brandName'),
            manufacturer: getField(row, 'Manufacturer'),
            category: (category && VALID_CATEGORIES.includes(category) ? category : 'other') as MedicineCategory,
            form: (form && VALID_FORMS.includes(form) ? form : 'tablet') as MedicineForm,
            strength: getField(row, 'Strength'),
            hsn: getField(row, 'HSN Code', 'hsn'),
            barcode: getField(row, 'Barcode'),
            schedule: schedule && VALID_SCHEDULES.includes(schedule) ? (schedule as DrugSchedule) : null,
            requiresPrescription: !!schedule && ['H', 'H1', 'X'].includes(schedule),
            gstRate, mrp, sellingPrice,
            purchasePrice: parseNum(getField(row, 'Purchase Price', 'purchasePrice')) ?? 0,
            reorderLevel: parseNum(getField(row, 'Reorder Level', 'reorderLevel')) ?? 10,
            createdBy: req.user!.sub,
          },
        });
        existingNames.add(name.toLowerCase());
        imported++;
      }
    } else if (type === 'customers') {
      const existing = await prisma.customer.findMany({ where: { tenantId, deletedAt: null, phone: { not: null } }, select: { phone: true } });
      const existingPhones = new Set(existing.map(c => c.phone));
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]!;
        const name = getField(row, 'Name', 'Customer Name');
        if (!name) { errors.push({ row: i + 1, message: 'Name is required' }); continue; }
        const phone = getField(row, 'Phone', 'Mobile');
        if (phone && phone.replace(/\D/g, '').length < 10) { errors.push({ row: i + 1, message: 'Phone must have at least 10 digits' }); continue; }
        if (phone && existingPhones.has(phone)) { skipped++; continue; }
        const city = getField(row, 'City');
        const address = getField(row, 'Address');
        await prisma.customer.create({
          data: {
            tenantId, name, phone,
            email: getField(row, 'Email'),
            address: [address, city].filter(Boolean).join(', ') || undefined,
            notes: getField(row, 'Notes'),
          },
        });
        if (phone) existingPhones.add(phone);
        imported++;
      }
    } else if (type === 'vendors') {
      const existing = await prisma.vendor.findMany({ where: { tenantId, deletedAt: null }, select: { name: true } });
      const existingNames = new Set(existing.map(v => v.name.toLowerCase()));
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]!;
        const name = getField(row, 'Company Name', 'Name', 'Vendor Name');
        if (!name) { errors.push({ row: i + 1, message: 'Company Name is required' }); continue; }
        if (existingNames.has(name.toLowerCase())) { skipped++; continue; }
        await prisma.vendor.create({
          data: {
            tenantId, name,
            contactPerson: getField(row, 'Contact Person', 'contactPerson'),
            phone: getField(row, 'Phone'),
            email: getField(row, 'Email'),
            address: getField(row, 'Address'),
            gstNumber: getField(row, 'GST Number', 'GSTIN', 'gstNumber'),
            paymentTerms: getField(row, 'Payment Terms', 'Payment Terms (days)', 'paymentTerms'),
          },
        });
        existingNames.add(name.toLowerCase());
        imported++;
      }
    } else if (type === 'inventory') {
      const medicines = await prisma.medicine.findMany({ where: { tenantId, deletedAt: null }, select: { id: true, name: true, reorderLevel: true } });
      const medByName = new Map(medicines.map(m => [m.name.toLowerCase(), m]));
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]!;
        const medName = getField(row, 'Medicine Name', 'Medicine', 'name');
        if (!medName) { errors.push({ row: i + 1, message: 'Medicine Name is required' }); continue; }
        const med = medByName.get(medName.toLowerCase());
        if (!med) { errors.push({ row: i + 1, message: `Medicine "${medName}" not found in master — import medicines first` }); continue; }
        const batchNumber = getField(row, 'Batch Number', 'Batch', 'batchNumber');
        if (!batchNumber) { errors.push({ row: i + 1, message: 'Batch Number is required' }); continue; }
        const qty = parseNum(getField(row, 'Qty', 'Quantity'));
        if (qty === undefined || qty < 0) { errors.push({ row: i + 1, message: 'Qty must be a non-negative number' }); continue; }
        const expiryDate = parseExpiryDate(getField(row, 'Expiry Date (MM/YYYY)', 'Expiry Date', 'Expiry', 'expiryDate'));
        if (!expiryDate) { errors.push({ row: i + 1, message: 'Expiry Date is required (MM/YYYY or YYYY-MM-DD)' }); continue; }
        const mrp = parseNum(getField(row, 'MRP')) ?? 0;
        await prisma.inventoryItem.create({
          data: {
            tenantId,
            medicineId: med.id,
            batchNumber,
            quantity: qty,
            purchasePrice: parseNum(getField(row, 'Purchase Price', 'purchasePrice')) ?? 0,
            mrp,
            sellingPrice: parseNum(getField(row, 'Selling Price', 'sellingPrice')) ?? mrp,
            expiryDate,
            rackLocation: getField(row, 'Rack Location', 'Rack', 'rackLocation'),
            status: qty === 0 ? 'out_of_stock' : qty <= med.reorderLevel ? 'low_stock' : 'available',
            createdBy: req.user!.sub,
          },
        });
        imported++;
      }
    } else {
      res.status(400).json({ success: false, message: `Unknown import type "${type}". Valid: medicines, customers, vendors, inventory` });
      return;
    }

    sendSuccess(res, { imported, skipped, errors: errors.length, errorDetails: errors.slice(0, 50) },
      `Imported ${imported} record${imported !== 1 ? 's' : ''}${skipped ? `, skipped ${skipped} duplicate${skipped !== 1 ? 's' : ''}` : ''}${errors.length ? `, ${errors.length} error${errors.length !== 1 ? 's' : ''}` : ''}`);
  } catch (err) { next(err); }
});

router.get('/import/template/:type', requirePermission('settings', 'view'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const templates: Record<string, { columns: string[]; rows: number }> = {
      medicines: { columns: ['Medicine Name', 'Generic Name', 'Manufacturer', 'Category', 'Dosage Form', 'Strength', 'Schedule', 'MRP', 'Selling Price', 'HSN Code', 'GST %'], rows: 3 },
      inventory: { columns: ['Medicine Name', 'Batch Number', 'Qty', 'Purchase Price', 'MRP', 'Expiry Date (MM/YYYY)', 'Rack Location'], rows: 2 },
      customers: { columns: ['Name', 'Phone', 'Email', 'Address', 'City', 'Date of Birth', 'Notes'], rows: 3 },
      vendors: { columns: ['Company Name', 'Contact Person', 'Phone', 'Email', 'Address', 'GST Number', 'Payment Terms (days)', 'Credit Limit'], rows: 2 },
    };
    const t = templates[req.params['type']!];
    if (!t) { res.status(404).json({ success: false, message: 'Template not found' }); return; }
    sendSuccess(res, { ...t, type: req.params['type'] });
  } catch (err) { next(err); }
});

export default router;
