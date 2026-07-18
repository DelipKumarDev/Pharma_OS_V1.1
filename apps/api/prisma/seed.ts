import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ─── Tenant ───────────────────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'divya-pharmacy' },
    update: {},
    create: {
      id: 'tnt_001',
      name: 'Divya Pharmacy',
      slug: 'divya-pharmacy',
      type: 'retail',
      status: 'active',
      plan: 'professional',
      phone: '+91-9876543210',
      email: 'admin@divyapharmacy.com',
      addressLine1: '12, MG Road',
      addressLine2: 'Near Central Hospital',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560001',
      country: 'India',
      licenseNumber: 'KA/DRUG/2023/1234',
      gstNumber: '29ABCDE1234F1Z5',
      drugLicenseNumber: 'DL-KA-20-00123',
      drugLicenseExpiry: new Date('2026-12-31'),
      gstEnabled: true,
      gstRegistered: true,
      defaultGST: 12,
      lowStockThreshold: 10,
      expiryAlertDays: 90,
      autoBackup: true,
      printBillDefault: true,
      requirePrescription: true,
      enableOfflineMode: true,
      termsOnReceipt: 'Medicines once sold will not be taken back. Verify before purchase.',
      thankYouMessage: 'Thank you for choosing Divya Pharmacy! Get well soon.',
    },
  });
  console.log('✅ Tenant created:', tenant.name);

  // ─── Permissions ──────────────────────────────────────────────────────────
  const permissionDefs = [
    // medicines
    { module: 'medicines', action: 'view', resource: 'medicine', description: 'View medicines' },
    { module: 'medicines', action: 'create', resource: 'medicine', description: 'Add medicines' },
    { module: 'medicines', action: 'edit', resource: 'medicine', description: 'Edit medicines' },
    { module: 'medicines', action: 'delete', resource: 'medicine', description: 'Delete medicines' },
    { module: 'medicines', action: 'export', resource: 'medicine', description: 'Export medicines' },
    // inventory
    { module: 'inventory', action: 'view', resource: 'inventory', description: 'View inventory' },
    { module: 'inventory', action: 'create', resource: 'inventory', description: 'Add stock' },
    { module: 'inventory', action: 'edit', resource: 'inventory', description: 'Edit stock' },
    { module: 'inventory', action: 'delete', resource: 'inventory', description: 'Remove stock' },
    // billing
    { module: 'billing', action: 'view', resource: 'bill', description: 'View bills' },
    { module: 'billing', action: 'create', resource: 'bill', description: 'Create bills' },
    { module: 'billing', action: 'edit', resource: 'bill', description: 'Edit bills' },
    { module: 'billing', action: 'delete', resource: 'bill', description: 'Cancel bills' },
    // customers
    { module: 'customers', action: 'view', resource: 'customer', description: 'View customers' },
    { module: 'customers', action: 'create', resource: 'customer', description: 'Add customers' },
    { module: 'customers', action: 'edit', resource: 'customer', description: 'Edit customers' },
    // vendors
    { module: 'vendors', action: 'view', resource: 'vendor', description: 'View vendors' },
    { module: 'vendors', action: 'create', resource: 'vendor', description: 'Add vendors' },
    { module: 'vendors', action: 'edit', resource: 'vendor', description: 'Edit vendors' },
    // users
    { module: 'users', action: 'view', resource: 'user', description: 'View users' },
    { module: 'users', action: 'create', resource: 'user', description: 'Invite users' },
    { module: 'users', action: 'edit', resource: 'user', description: 'Edit users' },
    // reports
    { module: 'reports', action: 'view', resource: 'report', description: 'View reports' },
    { module: 'reports', action: 'export', resource: 'report', description: 'Export reports' },
    // settings
    { module: 'settings', action: 'view', resource: 'settings', description: 'View settings' },
    { module: 'settings', action: 'edit', resource: 'settings', description: 'Edit settings' },
    // prescriptions
    { module: 'prescriptions', action: 'view', resource: 'prescription', description: 'View prescriptions' },
    { module: 'prescriptions', action: 'create', resource: 'prescription', description: 'Add prescriptions' },
    { module: 'prescriptions', action: 'approve', resource: 'prescription', description: 'Approve prescriptions' },
    // returns
    { module: 'returns', action: 'view', resource: 'return', description: 'View returns' },
    { module: 'returns', action: 'create', resource: 'return', description: 'Create returns' },
    { module: 'returns', action: 'approve', resource: 'return', description: 'Approve returns' },
  ];

  const permissionIds: string[] = [];
  for (const pDef of permissionDefs) {
    const p = await prisma.permission.upsert({
  where: {
    module_action_resource: {
      module: pDef.module,
      action: pDef.action,
      resource: pDef.resource,
    },
  },
  update: {
    description: pDef.description,
  },
  create: {
    module: pDef.module,
    action: pDef.action,
    resource: pDef.resource,
    description: pDef.description,
  },
});
    permissionIds.push(p.id);
  }
  console.log('✅ Permissions seeded:', permissionIds.length);

  // ─── Roles ────────────────────────────────────────────────────────────────
  const adminRole = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Pharma Admin' } },
    update: {},
    create: {
      id: 'role_001',
      tenantId: tenant.id,
      name: 'Pharma Admin',
      description: 'Full access to all pharmacy modules and settings',
      isSystem: true,
    },
  });

  const pharmacistRole = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Pharmacist' } },
    update: {},
    create: {
      id: 'role_002',
      tenantId: tenant.id,
      name: 'Pharmacist',
      description: 'Dispensing, billing, and inventory management',
      isSystem: true,
    },
  });

  const inventoryRole = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Inventory Manager' } },
    update: {},
    create: {
      id: 'role_003',
      tenantId: tenant.id,
      name: 'Inventory Manager',
      description: 'Stock management, purchase orders, and expiry tracking',
      isSystem: false,
    },
  });

  const billingRole = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Billing Assistant' } },
    update: {},
    create: {
      id: 'role_004',
      tenantId: tenant.id,
      name: 'Billing Assistant',
      description: 'Create and manage customer bills',
      isSystem: false,
    },
  });

  const reportsRole = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Reports Viewer' } },
    update: {},
    create: {
      id: 'role_005',
      tenantId: tenant.id,
      name: 'Reports Viewer',
      description: 'Read-only access to all reports',
      isSystem: false,
    },
  });

  // Map "module:action" → permission id for explicit, non-fragile role grants.
  const permByKey = new Map<string, string>();
  permissionDefs.forEach((d, i) => permByKey.set(`${d.module}:${d.action}`, permissionIds[i]!));

  async function grant(roleId: string, keys: string[]) {
    for (const key of keys) {
      const permId = permByKey.get(key);
      if (!permId) { console.warn(`⚠️  seed: unknown permission ${key}`); continue; }
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId: permId } },
        update: {},
        create: { roleId, permissionId: permId },
      });
    }
  }

  // Pharma Admin — full access (every defined permission).
  await grant(adminRole.id, [...permByKey.keys()]);

  // Pharmacist — dispensing + billing + prescriptions, read stock/customers.
  await grant(pharmacistRole.id, [
    'medicines:view', 'inventory:view',
    'billing:view', 'billing:create',
    'customers:view', 'customers:create',
    'prescriptions:view', 'prescriptions:create', 'prescriptions:approve',
    'returns:view', 'returns:create',
  ]);

  // Inventory Manager — full stock + medicine master + vendors, read reports.
  await grant(inventoryRole.id, [
    'medicines:view', 'medicines:create', 'medicines:edit',
    'inventory:view', 'inventory:create', 'inventory:edit', 'inventory:delete',
    'vendors:view', 'vendors:create', 'vendors:edit',
    'reports:view',
  ]);

  // Billing Assistant — sales only, read stock/customers.
  await grant(billingRole.id, [
    'billing:view', 'billing:create',
    'customers:view', 'customers:create',
    'medicines:view', 'inventory:view',
  ]);

  // Reports Viewer — read-only reporting.
  await grant(reportsRole.id, [
    'reports:view', 'reports:export',
  ]);

  console.log('✅ Roles seeded');

  // ─── Users ────────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Admin@123', 12);

  const users = [
    { id: 'usr_001', email: 'admin@divyapharmacy.com', name: 'Rahul Sharma', phone: '9876543210', roleId: adminRole.id },
    { id: 'usr_002', email: 'pharmacist@divyapharmacy.com', name: 'Priya Patel', phone: '9812345678', roleId: pharmacistRole.id },
    { id: 'usr_003', email: 'inventory@divyapharmacy.com', name: 'Amit Joshi', phone: '9898765432', roleId: inventoryRole.id },
    { id: 'usr_004', email: 'billing@divyapharmacy.com', name: 'Sunita Khanna', phone: '9765432109', roleId: billingRole.id },
  ];

  for (const u of users) {
    const user = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: u.email } },
      update: {},
      create: {
        id: u.id,
        tenantId: tenant.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        passwordHash,
        status: 'active',
        mfaEnabled: false,
        lastLoginAt: new Date(),
      },
    });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: u.roleId } },
      update: {},
      create: { userId: user.id, roleId: u.roleId },
    });
  }
  console.log('✅ Users seeded');

  // ─── Medicines ────────────────────────────────────────────────────────────
  const medicines = [
    { id: 'med_001', name: 'Paracetamol 500mg', genericName: 'Paracetamol', manufacturer: 'GSK', category: 'analgesic', form: 'tablet', strength: '500mg', unit: 'strip', hsn: '30049099', barcode: '8901030654532', gstRate: 0, mrp: 22.5, purchasePrice: 8.5, sellingPrice: 20, reorderLevel: 100, requiresPrescription: false },
    { id: 'med_002', name: 'Amoxicillin 250mg', genericName: 'Amoxicillin', manufacturer: 'Cipla', category: 'antibiotic', form: 'capsule', strength: '250mg', unit: 'strip', schedule: 'H', hsn: '29411000', barcode: '8901030867424', gstRate: 12, mrp: 54, purchasePrice: 38, sellingPrice: 50, reorderLevel: 50, requiresPrescription: true },
    { id: 'med_003', name: 'Pantoprazole 40mg', genericName: 'Pantoprazole', manufacturer: 'Sun Pharma', category: 'gastroenterology', form: 'tablet', strength: '40mg', unit: 'strip', hsn: '30049099', barcode: '8901030129483', gstRate: 12, mrp: 44, purchasePrice: 25, sellingPrice: 40, reorderLevel: 80, requiresPrescription: false },
    { id: 'med_004', name: 'Metformin 500mg', genericName: 'Metformin HCl', manufacturer: 'USV', category: 'diabetes', form: 'tablet', strength: '500mg', unit: 'strip', hsn: '29251920', barcode: '8901030475829', gstRate: 0, mrp: 22, purchasePrice: 14, sellingPrice: 20, reorderLevel: 60, requiresPrescription: true },
    { id: 'med_005', name: 'Cetirizine 10mg', genericName: 'Cetirizine HCl', manufacturer: "Dr. Reddy's", category: 'antihistamine', form: 'tablet', strength: '10mg', unit: 'strip', hsn: '30049099', barcode: '8901030234561', gstRate: 5, mrp: 22, purchasePrice: 12, sellingPrice: 20, reorderLevel: 80, requiresPrescription: false },
    { id: 'med_006', name: 'Atorvastatin 10mg', genericName: 'Atorvastatin Calcium', manufacturer: 'Pfizer', category: 'cardiovascular', form: 'tablet', strength: '10mg', unit: 'strip', schedule: 'H', hsn: '29335995', barcode: '8901030998765', gstRate: 12, mrp: 55, purchasePrice: 35, sellingPrice: 50, reorderLevel: 40, requiresPrescription: true },
    { id: 'med_007', name: 'Azithromycin 500mg', genericName: 'Azithromycin', manufacturer: 'Zydus', category: 'antibiotic', form: 'tablet', strength: '500mg', unit: 'strip', schedule: 'H', gstRate: 12, mrp: 55, purchasePrice: 38, sellingPrice: 50, reorderLevel: 50, requiresPrescription: true },
    { id: 'med_008', name: 'Vitamin D3 1000IU', genericName: 'Cholecalciferol', manufacturer: 'Abbott', category: 'vitamins', form: 'tablet', strength: '1000IU', unit: 'bottle', gstRate: 12, mrp: 280, purchasePrice: 200, sellingPrice: 250, reorderLevel: 20, requiresPrescription: false },
    { id: 'med_009', name: 'Omeprazole 20mg', genericName: 'Omeprazole', manufacturer: 'Torrent', category: 'gastroenterology', form: 'capsule', strength: '20mg', unit: 'strip', gstRate: 5, mrp: 33, purchasePrice: 18, sellingPrice: 30, reorderLevel: 60, requiresPrescription: false },
    { id: 'med_010', name: 'Aspirin 75mg', genericName: 'Acetylsalicylic Acid', manufacturer: 'Bayer', category: 'cardiovascular', form: 'tablet', strength: '75mg', unit: 'strip', gstRate: 12, mrp: 18, purchasePrice: 8, sellingPrice: 16, reorderLevel: 50, requiresPrescription: false },
  ] as const;

  for (const med of medicines) {
    await prisma.medicine.upsert({
      where: { id: med.id },
      update: {},
      create: {
        ...med,
        tenantId: tenant.id,
        status: 'active',
        category: med.category as never,
        form: med.form as never,
        unit: med.unit as never,
        schedule: ('schedule' in med ? med.schedule : null) as never,
        createdBy: 'usr_001',
        updatedBy: 'usr_001',
      },
    });
  }
  console.log('✅ Medicines seeded:', medicines.length);

  // ─── Inventory ────────────────────────────────────────────────────────────
  const inventoryItems = [
    { id: 'inv_001', medicineId: 'med_001', batchNumber: 'PCM2024A', quantity: 180, purchasePrice: 8.5, mrp: 22.5, sellingPrice: 20, expiryDate: new Date('2026-06-01'), rackLocation: 'A1-S2' },
    { id: 'inv_002', medicineId: 'med_002', batchNumber: 'AMX2024B', quantity: 35, purchasePrice: 38, mrp: 54, sellingPrice: 50, expiryDate: new Date('2026-03-01'), rackLocation: 'B2-S1' },
    { id: 'inv_003', medicineId: 'med_003', batchNumber: 'PNT2024C', quantity: 120, purchasePrice: 25, mrp: 44, sellingPrice: 40, expiryDate: new Date('2026-09-01'), rackLocation: 'C1-S3' },
    { id: 'inv_004', medicineId: 'med_004', batchNumber: 'MET2024D', quantity: 35, purchasePrice: 14, mrp: 22, sellingPrice: 20, expiryDate: new Date('2025-12-01'), rackLocation: 'D2-S1' },
    { id: 'inv_005', medicineId: 'med_005', batchNumber: 'CET2024E', quantity: 90, purchasePrice: 12, mrp: 22, sellingPrice: 20, expiryDate: new Date('2026-06-01'), rackLocation: 'E1-S2' },
    { id: 'inv_006', medicineId: 'med_006', batchNumber: 'ATV2024F', quantity: 48, purchasePrice: 35, mrp: 55, sellingPrice: 50, expiryDate: new Date('2026-02-01'), rackLocation: 'F3-S1' },
    { id: 'inv_007', medicineId: 'med_007', batchNumber: 'AZI2024G', quantity: 25, purchasePrice: 38, mrp: 55, sellingPrice: 50, expiryDate: new Date('2025-09-01'), rackLocation: 'G1-S1' },
    { id: 'inv_008', medicineId: 'med_008', batchNumber: 'VD32024H', quantity: 8, purchasePrice: 200, mrp: 280, sellingPrice: 250, expiryDate: new Date('2025-01-01'), rackLocation: 'H2-S3' },
    { id: 'inv_009', medicineId: 'med_009', batchNumber: 'OMP2024I', quantity: 95, purchasePrice: 18, mrp: 33, sellingPrice: 30, expiryDate: new Date('2026-08-01'), rackLocation: 'A3-S1' },
    { id: 'inv_010', medicineId: 'med_010', batchNumber: 'ASP2024J', quantity: 65, purchasePrice: 8, mrp: 18, sellingPrice: 16, expiryDate: new Date('2026-12-01'), rackLocation: 'B1-S2' },
  ];

  for (const item of inventoryItems) {
    const now = new Date();
    const daysToExpiry = (item.expiryDate.getTime() - now.getTime()) / 86400000;
    const expiryStatus = daysToExpiry <= 0 ? 'expired' : daysToExpiry <= 90 ? 'expiring_soon' : 'good';
    const medicine = medicines.find(m => m.id === item.medicineId);
    const reorderLevel = medicine?.reorderLevel ?? 10;
    const status = item.quantity <= 0 ? 'out_of_stock' : item.quantity <= reorderLevel ? 'low_stock' : 'available';
    const batchStatus = item.quantity <= 0 ? 'exhausted' : daysToExpiry <= 0 ? 'expired' : 'active';

    await prisma.inventoryItem.upsert({
      where: { id: item.id },
      update: {},
      create: {
        ...item,
        tenantId: tenant.id,
        reservedQuantity: 0,
        manufacturingDate: null,
        expiryStatus: expiryStatus as never,
        status: status as never,
        batchStatus: batchStatus as never,
        createdBy: 'usr_001',
        updatedBy: 'usr_001',
      },
    });
  }
  console.log('✅ Inventory seeded:', inventoryItems.length);

  // ─── Customers ────────────────────────────────────────────────────────────
  const customers = [
    { id: 'c1', name: 'Ramesh Gupta', phone: '9876543210', email: 'ramesh.g@gmail.com', customerType: 'vip', loyaltyPoints: 1250, totalSpend: 42500 },
    { id: 'c2', name: 'Priya Sharma', phone: '9123456789', email: 'priya.sharma@yahoo.com', customerType: 'regular', loyaltyPoints: 680, totalSpend: 18900 },
    { id: 'c3', name: 'Mohan Lal', phone: '8765432109', customerType: 'credit', creditBalance: 1200, loyaltyPoints: 220, totalSpend: 8800 },
    { id: 'c4', name: 'Sunita Devi', phone: '7654321098', email: 'sunita@outlook.com', customerType: 'vip', loyaltyPoints: 3400, totalSpend: 89000 },
  ];

  for (const c of customers) {
    await prisma.customer.upsert({
      where: { id: c.id },
      update: {},
      create: {
        id: c.id,
        tenantId: tenant.id,
        name: c.name,
        phone: c.phone,
        email: 'email' in c ? c.email : undefined,
        customerType: c.customerType as never,
        loyaltyPoints: c.loyaltyPoints,
        totalSpend: c.totalSpend,
        creditBalance: 'creditBalance' in c ? c.creditBalance : 0,
        totalPurchases: 10,
        totalVisits: 10,
        status: 'active',
        createdBy: 'usr_001',
      },
    });
  }
  console.log('✅ Customers seeded:', customers.length);

  // ─── Vendors ─────────────────────────────────────────────────────────────
  const vendors = [
    { id: 'v1', name: 'MedLine Distributors', gstNumber: '27AABCU9603R1ZX', phone: '9876543210', email: 'orders@medline.in', city: 'Mumbai', state: 'Maharashtra', contactPerson: 'Rajesh Sharma', paymentTerms: 'Net 30', creditLimit: 200000, rating: 4.5 },
    { id: 'v2', name: 'PharmaCorp India', gstNumber: '07AAACB1122C1Z5', phone: '9123456789', email: 'supply@pharmacorp.com', city: 'Ahmedabad', state: 'Gujarat', contactPerson: 'Meena Patel', paymentTerms: 'Net 15', creditLimit: 100000, rating: 4.2 },
    { id: 'v3', name: 'National Medical Stores', gstNumber: '29AADCN3897G1Z1', phone: '8765432109', email: 'nm.stores@gmail.com', city: 'Bangalore', state: 'Karnataka', contactPerson: 'Suresh Kumar', paymentTerms: 'Net 45', creditLimit: 300000, rating: 4.8 },
  ];

  for (const v of vendors) {
    await prisma.vendor.upsert({
      where: { id: v.id },
      update: {},
      create: {
        id: v.id,
        tenantId: tenant.id,
        name: v.name,
        gstNumber: v.gstNumber,
        phone: v.phone,
        email: v.email,
        city: v.city,
        state: v.state,
        contactPerson: v.contactPerson,
        paymentTerms: v.paymentTerms,
        creditLimit: v.creditLimit,
        rating: v.rating,
        status: 'active',
        totalPurchases: 0,
        pendingPayment: 0,
        createdBy: 'usr_001',
      },
    });
  }
  console.log('✅ Vendors seeded:', vendors.length);

  // ─── Notifications ───────────────────────────────────────────────────────
  const notifications = [
    { id: 'n1', title: 'Low Stock Warning', message: 'Paracetamol 500mg is critically low — only 12 units left.', type: 'low_stock', category: 'inventory', priority: 'critical', isRead: false },
    { id: 'n2', title: 'Expiry Alert', message: '5 medicine batches will expire within 30 days.', type: 'expiry_alert', category: 'inventory', priority: 'warning', isRead: false },
    { id: 'n3', title: 'Payment Due', message: 'Invoice payment of ₹9,240 to PharmaCorp India is due in 5 days.', type: 'payment_due', category: 'vendor', priority: 'warning', isRead: true },
  ];

  for (const n of notifications) {
    await prisma.notification.upsert({
      where: { id: n.id },
      update: {},
      create: { id: n.id, tenantId: tenant.id, title: n.title, message: n.message, type: n.type as never, category: n.category as never, priority: n.priority as never, isRead: n.isRead },
    });
  }
  console.log('✅ Notifications seeded');

  // ─── Reorder Items ───────────────────────────────────────────────────────
  await prisma.reorderItem.upsert({
    where: { tenantId_medicineId: { tenantId: tenant.id, medicineId: 'med_001' } },
    update: {},
    create: {
      tenantId: tenant.id,
      medicineId: 'med_001',
      medicineName: 'Paracetamol 500mg',
      genericName: 'Paracetamol',
      currentStock: 12,
      reorderLevel: 50,
      suggestedQty: 500,
      priority: 'critical',
      status: 'pending',
      lastSaleQty30Days: 380,
      daysStockLeft: 1,
      preferredVendor: 'MedLine Distributors',
      lastPurchasePrice: 8.5,
    },
  });
  console.log('✅ Reorder items seeded');

  console.log('\n🎉 Seed completed successfully!');
  console.log('\n📝 Demo Login Credentials:');
  console.log('   Admin:      admin@divyapharmacy.com      / Admin@123');
  console.log('   Pharmacist: pharmacist@divyapharmacy.com / Admin@123');
  console.log('   Inventory:  inventory@divyapharmacy.com  / Admin@123');
  console.log('   Billing:    billing@divyapharmacy.com    / Admin@123');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
