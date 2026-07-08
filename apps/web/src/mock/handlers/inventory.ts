import { http, HttpResponse, delay } from 'msw';
import type { InventoryItem, MedicineBatch, StockMovement, AIInsight } from '@pharmaos/types';

const now = new Date();
const daysFromNow = (d: number) => new Date(now.getTime() + d * 86400000).toISOString();
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();

export const INVENTORY: InventoryItem[] = [
  { id: 'inv_001', tenantId: 'tnt_001', medicineId: 'med_001', medicine: { id: 'med_001', name: 'Paracetamol 650mg' } as never, batchNumber: 'B250501', quantity: 102, reservedQuantity: 0, availableQuantity: 102, purchasePrice: 8.5, mrp: 15.50, sellingPrice: 15.50, manufacturingDate: daysAgo(180), expiryDate: daysFromNow(700), supplierId: 'sup_001', supplierName: 'Micro Labs', rackLocation: 'A-01-02', manufacturer: 'Micro Labs', strength: '650mg', category: 'OTC', dosageForm: 'Tablet', reorderLevel: 50, status: 'available', expiryStatus: 'good', batchStatus: 'active', createdAt: daysAgo(180), updatedAt: daysAgo(2) },
  { id: 'inv_002', tenantId: 'tnt_001', medicineId: 'med_002', medicine: { id: 'med_002', name: 'Crocin Advance 650mg' } as never, batchNumber: 'C240601', quantity: 87, reservedQuantity: 0, availableQuantity: 87, purchasePrice: 10.0, mrp: 16.50, sellingPrice: 16.50, manufacturingDate: daysAgo(200), expiryDate: daysFromNow(285), supplierId: 'sup_002', supplierName: 'GSK Pharma', rackLocation: 'A-01-03', manufacturer: 'GSK Pharma', strength: '650mg', category: 'OTC', dosageForm: 'Tablet', reorderLevel: 40, status: 'available', expiryStatus: 'good', batchStatus: 'active', createdAt: daysAgo(200), updatedAt: daysAgo(1) },
  { id: 'inv_003', tenantId: 'tnt_001', medicineId: 'med_003', medicine: { id: 'med_003', name: 'Calpol 650' } as never, batchNumber: 'CP250302', quantity: 18, reservedQuantity: 0, availableQuantity: 18, purchasePrice: 11.0, mrp: 17.55, sellingPrice: 17.55, manufacturingDate: daysAgo(250), expiryDate: daysFromNow(75), supplierId: 'sup_003', supplierName: 'Haleon', rackLocation: 'A-02-01', manufacturer: 'Haleon', strength: '650mg', category: 'OTC', dosageForm: 'Tablet', reorderLevel: 30, status: 'low_stock', expiryStatus: 'expiring_soon', batchStatus: 'active', createdAt: daysAgo(250), updatedAt: daysAgo(3) },
  { id: 'inv_004', tenantId: 'tnt_001', medicineId: 'med_004', medicine: { id: 'med_004', name: 'Augmentin 625mg' } as never, batchNumber: 'AUG25031', quantity: 200, reservedQuantity: 0, availableQuantity: 200, purchasePrice: 30.0, mrp: 45.30, sellingPrice: 45.30, manufacturingDate: daysAgo(150), expiryDate: daysFromNow(250), supplierId: 'sup_004', supplierName: 'GlaxoSmithKline', rackLocation: 'B-01-01', manufacturer: 'GlaxoSmithKline', strength: '625mg', category: 'Prescription', dosageForm: 'Tablet', reorderLevel: 60, status: 'available', expiryStatus: 'good', batchStatus: 'active', createdAt: daysAgo(150), updatedAt: daysAgo(1) },
  { id: 'inv_005', tenantId: 'tnt_001', medicineId: 'med_005', medicine: { id: 'med_005', name: 'Azithromycin 500mg' } as never, batchNumber: 'AZ50405', quantity: 15, reservedQuantity: 0, availableQuantity: 15, purchasePrice: 18.0, mrp: 22.40, sellingPrice: 22.40, manufacturingDate: daysAgo(300), expiryDate: daysFromNow(55), supplierId: 'sup_005', supplierName: 'Cipla', rackLocation: 'B-02-02', manufacturer: 'Cipla', strength: '500mg', category: 'Prescription', dosageForm: 'Tablet', reorderLevel: 20, status: 'low_stock', expiryStatus: 'expiring_soon', batchStatus: 'active', createdAt: daysAgo(300), updatedAt: daysAgo(4) },
  { id: 'inv_006', tenantId: 'tnt_001', medicineId: 'med_006', medicine: { id: 'med_006', name: 'Cetirizine 10mg' } as never, batchNumber: 'CT24701', quantity: 48, reservedQuantity: 0, availableQuantity: 48, purchasePrice: 8.5, mrp: 12.10, sellingPrice: 12.10, manufacturingDate: daysAgo(120), expiryDate: daysFromNow(560), supplierId: 'sup_006', supplierName: "Dr. Reddy's", rackLocation: 'C-01-03', manufacturer: "Dr. Reddy's", strength: '10mg', category: 'OTC', dosageForm: 'Tablet', reorderLevel: 25, status: 'available', expiryStatus: 'good', batchStatus: 'active', createdAt: daysAgo(120), updatedAt: daysAgo(2) },
  { id: 'inv_007', tenantId: 'tnt_001', medicineId: 'med_007', medicine: { id: 'med_007', name: 'Pantoprazole 40mg' } as never, batchNumber: 'PZ241502', quantity: 0, reservedQuantity: 0, availableQuantity: 0, purchasePrice: 14.0, mrp: 18.90, sellingPrice: 18.90, manufacturingDate: daysAgo(60), expiryDate: daysFromNow(480), supplierId: 'sup_007', supplierName: 'Sun Pharma', rackLocation: 'C-02-01', manufacturer: 'Sun Pharma', strength: '40mg', category: 'Prescription', dosageForm: 'Tablet', reorderLevel: 30, status: 'out_of_stock', expiryStatus: 'good', batchStatus: 'exhausted', createdAt: daysAgo(60), updatedAt: daysAgo(5) },
  { id: 'inv_008', tenantId: 'tnt_001', medicineId: 'med_008', medicine: { id: 'med_008', name: 'Amoxicillin 500mg' } as never, batchNumber: 'AM25022', quantity: 34, reservedQuantity: 0, availableQuantity: 34, purchasePrice: 10.0, mrp: 14.30, sellingPrice: 14.30, manufacturingDate: daysAgo(90), expiryDate: daysFromNow(490), supplierId: 'sup_008', supplierName: 'Alkem', rackLocation: 'D-01-01', manufacturer: 'Alkem', strength: '500mg', category: 'Prescription', dosageForm: 'Capsule', reorderLevel: 20, status: 'available', expiryStatus: 'good', batchStatus: 'active', createdAt: daysAgo(90), updatedAt: daysAgo(1) },
  { id: 'inv_009', tenantId: 'tnt_001', medicineId: 'med_009', medicine: { id: 'med_009', name: 'Metformin 500mg' } as never, batchNumber: 'MET2024D', quantity: 240, reservedQuantity: 0, availableQuantity: 240, purchasePrice: 4.5, mrp: 8.00, sellingPrice: 8.00, manufacturingDate: daysAgo(100), expiryDate: daysFromNow(620), supplierId: 'sup_005', supplierName: 'Cipla', rackLocation: 'D-02-01', manufacturer: 'Cipla', strength: '500mg', category: 'Prescription', dosageForm: 'Tablet', reorderLevel: 80, status: 'available', expiryStatus: 'good', batchStatus: 'active', createdAt: daysAgo(100), updatedAt: daysAgo(2) },
  { id: 'inv_010', tenantId: 'tnt_001', medicineId: 'med_010', medicine: { id: 'med_010', name: 'Atorvastatin 10mg' } as never, batchNumber: 'ATV2024F', quantity: 150, reservedQuantity: 0, availableQuantity: 150, purchasePrice: 45.0, mrp: 62.00, sellingPrice: 62.00, manufacturingDate: daysAgo(80), expiryDate: daysFromNow(730), supplierId: 'sup_009', supplierName: 'Pfizer', rackLocation: 'E-01-02', manufacturer: 'Pfizer', strength: '10mg', category: 'Prescription', dosageForm: 'Tablet', reorderLevel: 40, status: 'available', expiryStatus: 'good', batchStatus: 'active', createdAt: daysAgo(80), updatedAt: daysAgo(3) },
  { id: 'inv_011', tenantId: 'tnt_001', medicineId: 'med_011', medicine: { id: 'med_011', name: 'Amlodipine 5mg' } as never, batchNumber: 'AML2024K', quantity: 180, reservedQuantity: 0, availableQuantity: 180, purchasePrice: 22.0, mrp: 34.00, sellingPrice: 34.00, manufacturingDate: daysAgo(95), expiryDate: daysFromNow(645), supplierId: 'sup_005', supplierName: 'Cipla', rackLocation: 'E-02-01', manufacturer: 'Cipla', strength: '5mg', category: 'Prescription', dosageForm: 'Tablet', reorderLevel: 50, status: 'available', expiryStatus: 'good', batchStatus: 'active', createdAt: daysAgo(95), updatedAt: daysAgo(1) },
  { id: 'inv_012', tenantId: 'tnt_001', medicineId: 'med_012', medicine: { id: 'med_012', name: 'Omeprazole 20mg' } as never, batchNumber: 'OMZ2024I', quantity: 8, reservedQuantity: 0, availableQuantity: 8, purchasePrice: 18.0, mrp: 28.00, sellingPrice: 28.00, manufacturingDate: daysAgo(160), expiryDate: daysFromNow(540), supplierId: 'sup_010', supplierName: 'AlphaMed', rackLocation: 'F-01-01', manufacturer: 'AlphaMed', strength: '20mg', category: 'OTC', dosageForm: 'Capsule', reorderLevel: 20, status: 'low_stock', expiryStatus: 'good', batchStatus: 'active', createdAt: daysAgo(160), updatedAt: daysAgo(6) },
  { id: 'inv_013', tenantId: 'tnt_001', medicineId: 'med_013', medicine: { id: 'med_013', name: 'Salbutamol Inhaler' } as never, batchNumber: 'SBT2024R', quantity: 6, reservedQuantity: 0, availableQuantity: 6, purchasePrice: 78.0, mrp: 120.00, sellingPrice: 120.00, manufacturingDate: daysAgo(200), expiryDate: daysFromNow(25), supplierId: 'sup_005', supplierName: 'Cipla', rackLocation: 'F-02-03', manufacturer: 'Cipla', strength: '100mcg', category: 'Prescription', dosageForm: 'Inhaler', reorderLevel: 10, status: 'low_stock', expiryStatus: 'expiring_soon', batchStatus: 'active', createdAt: daysAgo(200), updatedAt: daysAgo(7) },
  { id: 'inv_014', tenantId: 'tnt_001', medicineId: 'med_014', medicine: { id: 'med_014', name: 'Insulin Glargine 300IU' } as never, batchNumber: 'INS2024X', quantity: 12, reservedQuantity: 2, availableQuantity: 10, purchasePrice: 900.0, mrp: 1200.00, sellingPrice: 1200.00, manufacturingDate: daysAgo(60), expiryDate: daysFromNow(305), supplierId: 'sup_011', supplierName: 'Sanofi', rackLocation: 'G-01-01', manufacturer: 'Sanofi', strength: '300IU/mL', category: 'Controlled', dosageForm: 'Injection', reorderLevel: 5, status: 'available', expiryStatus: 'good', batchStatus: 'active', createdAt: daysAgo(60), updatedAt: daysAgo(2) },
  { id: 'inv_015', tenantId: 'tnt_001', medicineId: 'med_015', medicine: { id: 'med_015', name: 'Ciprofloxacin 500mg' } as never, batchNumber: 'CPX2024Y', quantity: 95, reservedQuantity: 0, availableQuantity: 95, purchasePrice: 38.0, mrp: 55.00, sellingPrice: 55.00, manufacturingDate: daysAgo(110), expiryDate: daysFromNow(615), supplierId: 'sup_005', supplierName: 'Cipla', rackLocation: 'A-03-02', manufacturer: 'Cipla', strength: '500mg', category: 'Prescription', dosageForm: 'Tablet', reorderLevel: 30, status: 'available', expiryStatus: 'good', batchStatus: 'active', createdAt: daysAgo(110), updatedAt: daysAgo(3) },
  { id: 'inv_016', tenantId: 'tnt_001', medicineId: 'med_016', medicine: { id: 'med_016', name: 'Ibuprofen 400mg' } as never, batchNumber: 'IBU2024V', quantity: 365, reservedQuantity: 15, availableQuantity: 350, purchasePrice: 9.0, mrp: 14.00, sellingPrice: 14.00, manufacturingDate: daysAgo(130), expiryDate: daysFromNow(590), supplierId: 'sup_012', supplierName: 'Abbott', rackLocation: 'A-04-01', manufacturer: 'Abbott', strength: '400mg', category: 'OTC', dosageForm: 'Tablet', reorderLevel: 60, status: 'available', expiryStatus: 'good', batchStatus: 'active', createdAt: daysAgo(130), updatedAt: daysAgo(1) },
  { id: 'inv_017', tenantId: 'tnt_001', medicineId: 'med_017', medicine: { id: 'med_017', name: 'Losartan 50mg' } as never, batchNumber: 'LST2024P', quantity: 0, reservedQuantity: 0, availableQuantity: 0, purchasePrice: 52.0, mrp: 78.00, sellingPrice: 78.00, manufacturingDate: daysAgo(70), expiryDate: daysFromNow(660), supplierId: 'sup_013', supplierName: 'MSD', rackLocation: 'B-03-02', manufacturer: 'MSD', strength: '50mg', category: 'Prescription', dosageForm: 'Tablet', reorderLevel: 40, status: 'out_of_stock', expiryStatus: 'good', batchStatus: 'exhausted', createdAt: daysAgo(70), updatedAt: daysAgo(10) },
  { id: 'inv_018', tenantId: 'tnt_001', medicineId: 'med_018', medicine: { id: 'med_018', name: 'Vitamin D3 60000IU' } as never, batchNumber: 'VD32024H', quantity: 45, reservedQuantity: 0, availableQuantity: 45, purchasePrice: 140.0, mrp: 220.00, sellingPrice: 220.00, manufacturingDate: daysAgo(180), expiryDate: daysFromNow(185), supplierId: 'sup_014', supplierName: 'USV', rackLocation: 'C-03-01', manufacturer: 'USV', strength: '60000IU', category: 'OTC', dosageForm: 'Capsule', reorderLevel: 15, status: 'available', expiryStatus: 'good', batchStatus: 'active', createdAt: daysAgo(180), updatedAt: daysAgo(5) },
  { id: 'inv_019', tenantId: 'tnt_001', medicineId: 'med_019', medicine: { id: 'med_019', name: 'Montelukast 10mg' } as never, batchNumber: 'MTK2024O', quantity: 85, reservedQuantity: 5, availableQuantity: 80, purchasePrice: 82.0, mrp: 120.00, sellingPrice: 120.00, manufacturingDate: daysAgo(140), expiryDate: daysFromNow(580), supplierId: 'sup_005', supplierName: 'Cipla', rackLocation: 'D-03-02', manufacturer: 'Cipla', strength: '10mg', category: 'Prescription', dosageForm: 'Tablet', reorderLevel: 20, status: 'available', expiryStatus: 'good', batchStatus: 'active', createdAt: daysAgo(140), updatedAt: daysAgo(2) },
  { id: 'inv_020', tenantId: 'tnt_001', medicineId: 'med_020', medicine: { id: 'med_020', name: 'Ranitidine 150mg' } as never, batchNumber: 'RNT2024U', quantity: 240, reservedQuantity: 0, availableQuantity: 240, purchasePrice: 10.0, mrp: 16.00, sellingPrice: 16.00, manufacturingDate: daysAgo(400), expiryDate: daysAgo(45), supplierId: 'sup_015', supplierName: 'GSK Direct', rackLocation: 'E-03-01', manufacturer: 'GSK Direct', strength: '150mg', category: 'OTC', dosageForm: 'Tablet', reorderLevel: 60, status: 'expired', expiryStatus: 'expired', batchStatus: 'expired', createdAt: daysAgo(400), updatedAt: daysAgo(45) },
  { id: 'inv_021', tenantId: 'tnt_001', medicineId: 'med_021', medicine: { id: 'med_021', name: 'Aspirin 75mg' } as never, batchNumber: 'ASP2024J', quantity: 580, reservedQuantity: 20, availableQuantity: 560, purchasePrice: 6.0, mrp: 10.00, sellingPrice: 10.00, manufacturingDate: daysAgo(85), expiryDate: daysFromNow(800), supplierId: 'sup_012', supplierName: 'Abbott', rackLocation: 'A-05-01', manufacturer: 'Abbott', strength: '75mg', category: 'OTC', dosageForm: 'Tablet', reorderLevel: 100, status: 'available', expiryStatus: 'good', batchStatus: 'active', createdAt: daysAgo(85), updatedAt: daysAgo(1) },
  { id: 'inv_022', tenantId: 'tnt_001', medicineId: 'med_022', medicine: { id: 'med_022', name: 'Doxycycline 100mg' } as never, batchNumber: 'DOX2024B', quantity: 7, reservedQuantity: 0, availableQuantity: 7, purchasePrice: 25.0, mrp: 38.00, sellingPrice: 38.00, manufacturingDate: daysAgo(210), expiryDate: daysFromNow(45), supplierId: 'sup_005', supplierName: 'Cipla', rackLocation: 'B-04-01', manufacturer: 'Cipla', strength: '100mg', category: 'Prescription', dosageForm: 'Capsule', reorderLevel: 15, status: 'low_stock', expiryStatus: 'expiring_soon', batchStatus: 'active', createdAt: daysAgo(210), updatedAt: daysAgo(8) },
  { id: 'inv_023', tenantId: 'tnt_001', medicineId: 'med_023', medicine: { id: 'med_023', name: 'Clotrimazole Cream 15g' } as never, batchNumber: 'CTZ2024S', quantity: 55, reservedQuantity: 0, availableQuantity: 55, purchasePrice: 28.0, mrp: 42.00, sellingPrice: 42.00, manufacturingDate: daysAgo(75), expiryDate: daysFromNow(655), supplierId: 'sup_016', supplierName: 'Glenmark', rackLocation: 'C-04-02', manufacturer: 'Glenmark', strength: '1% w/w', category: 'OTC', dosageForm: 'Cream', reorderLevel: 15, status: 'available', expiryStatus: 'good', batchStatus: 'active', createdAt: daysAgo(75), updatedAt: daysAgo(4) },
  { id: 'inv_024', tenantId: 'tnt_001', medicineId: 'med_024', medicine: { id: 'med_024', name: 'Glimepiride 2mg' } as never, batchNumber: 'GLM2024T', quantity: 0, reservedQuantity: 0, availableQuantity: 0, purchasePrice: 38.0, mrp: 56.00, sellingPrice: 56.00, manufacturingDate: daysAgo(90), expiryDate: daysFromNow(640), supplierId: 'sup_011', supplierName: 'Sanofi', rackLocation: 'D-04-01', manufacturer: 'Sanofi', strength: '2mg', category: 'Prescription', dosageForm: 'Tablet', reorderLevel: 20, status: 'out_of_stock', expiryStatus: 'good', batchStatus: 'exhausted', createdAt: daysAgo(90), updatedAt: daysAgo(12) },
  { id: 'inv_025', tenantId: 'tnt_001', medicineId: 'med_025', medicine: { id: 'med_025', name: 'ORS Sachets' } as never, batchNumber: 'ORS2024W', quantity: 500, reservedQuantity: 0, availableQuantity: 500, purchasePrice: 4.0, mrp: 8.00, sellingPrice: 8.00, manufacturingDate: daysAgo(55), expiryDate: daysFromNow(760), supplierId: 'sup_001', supplierName: 'Micro Labs', rackLocation: 'E-04-01', manufacturer: 'Micro Labs', strength: '21.8g', category: 'OTC', dosageForm: 'Powder', reorderLevel: 100, status: 'available', expiryStatus: 'good', batchStatus: 'active', createdAt: daysAgo(55), updatedAt: daysAgo(2) },
  { id: 'inv_026', tenantId: 'tnt_001', medicineId: 'med_026', medicine: { id: 'med_026', name: 'Cefixime 200mg' } as never, batchNumber: 'CFX2024M', quantity: 9, reservedQuantity: 0, availableQuantity: 9, purchasePrice: 95.0, mrp: 145.00, sellingPrice: 145.00, manufacturingDate: daysAgo(170), expiryDate: daysFromNow(20), supplierId: 'sup_010', supplierName: 'AlphaMed', rackLocation: 'F-03-01', manufacturer: 'AlphaMed', strength: '200mg', category: 'Prescription', dosageForm: 'Tablet', reorderLevel: 15, status: 'low_stock', expiryStatus: 'expiring_soon', batchStatus: 'active', createdAt: daysAgo(170), updatedAt: daysAgo(9) },
  { id: 'inv_027', tenantId: 'tnt_001', medicineId: 'med_027', medicine: { id: 'med_027', name: 'Diclofenac Gel 30g' } as never, batchNumber: 'DCG2024Q', quantity: 40, reservedQuantity: 0, availableQuantity: 40, purchasePrice: 32.0, mrp: 48.00, sellingPrice: 48.00, manufacturingDate: daysAgo(65), expiryDate: daysFromNow(695), supplierId: 'sup_017', supplierName: 'Surgical Supplies', rackLocation: 'G-02-01', manufacturer: 'Surgical Supplies', strength: '1% w/w', category: 'OTC', dosageForm: 'Gel', reorderLevel: 10, status: 'available', expiryStatus: 'good', batchStatus: 'active', createdAt: daysAgo(65), updatedAt: daysAgo(3) },
  { id: 'inv_028', tenantId: 'tnt_001', medicineId: 'med_028', medicine: { id: 'med_028', name: 'Betadine Solution 500ml' } as never, batchNumber: 'BTD2024N', quantity: 30, reservedQuantity: 0, availableQuantity: 30, purchasePrice: 65.0, mrp: 95.00, sellingPrice: 95.00, manufacturingDate: daysAgo(100), expiryDate: daysFromNow(630), supplierId: 'sup_017', supplierName: 'Surgical Supplies', rackLocation: 'G-03-02', manufacturer: 'Win-Medicare', strength: '10% w/v', category: 'OTC', dosageForm: 'Lotion', reorderLevel: 10, status: 'available', expiryStatus: 'good', batchStatus: 'active', createdAt: daysAgo(100), updatedAt: daysAgo(5) },
  { id: 'inv_029', tenantId: 'tnt_001', medicineId: 'med_029', medicine: { id: 'med_029', name: 'Cough Syrup DX 100ml' } as never, batchNumber: 'CDX2024Z', quantity: 65, reservedQuantity: 0, availableQuantity: 65, purchasePrice: 42.0, mrp: 65.00, sellingPrice: 65.00, manufacturingDate: daysAgo(50), expiryDate: daysFromNow(680), supplierId: 'sup_001', supplierName: 'Micro Labs', rackLocation: 'H-01-01', manufacturer: 'Benadryl', strength: '100ml', category: 'OTC', dosageForm: 'Syrup', reorderLevel: 20, status: 'available', expiryStatus: 'good', batchStatus: 'active', createdAt: daysAgo(50), updatedAt: daysAgo(2) },
  { id: 'inv_030', tenantId: 'tnt_001', medicineId: 'med_030', medicine: { id: 'med_030', name: 'Dolo 650mg' } as never, batchNumber: 'DLO2024L', quantity: 8, reservedQuantity: 0, availableQuantity: 8, purchasePrice: 14.0, mrp: 22.00, sellingPrice: 22.00, manufacturingDate: daysAgo(220), expiryDate: daysFromNow(680), supplierId: 'sup_001', supplierName: 'Micro Labs', rackLocation: 'A-01-04', manufacturer: 'Micro Labs', strength: '650mg', category: 'OTC', dosageForm: 'Tablet', reorderLevel: 40, status: 'low_stock', expiryStatus: 'good', batchStatus: 'active', createdAt: daysAgo(220), updatedAt: daysAgo(6) },
  { id: 'inv_031', tenantId: 'tnt_001', medicineId: 'med_031', medicine: { id: 'med_031', name: 'Montair LC Tablet' } as never, batchNumber: 'MLC2024A', quantity: 0, reservedQuantity: 0, availableQuantity: 0, purchasePrice: 68.0, mrp: 98.00, sellingPrice: 98.00, manufacturingDate: daysAgo(120), expiryDate: daysFromNow(610), supplierId: 'sup_005', supplierName: 'Cipla', rackLocation: 'B-05-01', manufacturer: 'Cipla', strength: '10mg/5mg', category: 'Prescription', dosageForm: 'Tablet', reorderLevel: 20, status: 'out_of_stock', expiryStatus: 'good', batchStatus: 'exhausted', createdAt: daysAgo(120), updatedAt: daysAgo(15) },
  { id: 'inv_032', tenantId: 'tnt_001', medicineId: 'med_032', medicine: { id: 'med_032', name: 'Telmisartan 40mg' } as never, batchNumber: 'TEL2024C', quantity: 120, reservedQuantity: 0, availableQuantity: 120, purchasePrice: 48.0, mrp: 72.00, sellingPrice: 72.00, manufacturingDate: daysAgo(75), expiryDate: daysFromNow(710), supplierId: 'sup_007', supplierName: 'Sun Pharma', rackLocation: 'C-05-02', manufacturer: 'Sun Pharma', strength: '40mg', category: 'Prescription', dosageForm: 'Tablet', reorderLevel: 30, status: 'available', expiryStatus: 'good', batchStatus: 'active', createdAt: daysAgo(75), updatedAt: daysAgo(3) },
  { id: 'inv_033', tenantId: 'tnt_001', medicineId: 'med_033', medicine: { id: 'med_033', name: 'B Complex Syrup 200ml' } as never, batchNumber: 'BCX2024D', quantity: 70, reservedQuantity: 0, availableQuantity: 70, purchasePrice: 35.0, mrp: 55.00, sellingPrice: 55.00, manufacturingDate: daysAgo(60), expiryDate: daysFromNow(665), supplierId: 'sup_014', supplierName: 'USV', rackLocation: 'H-02-01', manufacturer: 'USV', strength: '200ml', category: 'OTC', dosageForm: 'Syrup', reorderLevel: 20, status: 'available', expiryStatus: 'good', batchStatus: 'active', createdAt: daysAgo(60), updatedAt: daysAgo(4) },
];

const BATCHES_BY_MEDICINE: Record<string, MedicineBatch[]> = {
  med_001: [
    { batchId: 'bat_001a', medicineId: 'med_001', batchNumber: 'B250501', expiryDate: daysFromNow(700), manufacturingDate: daysAgo(180), quantityAvailable: 102, quantityInitial: 200, purchasePrice: 8.5, sellingPrice: 15.50, mrp: 15.50, supplierName: 'Micro Labs', batchStatus: 'active', createdAt: daysAgo(180) },
    { batchId: 'bat_001b', medicineId: 'med_001', batchNumber: 'B250401', expiryDate: daysFromNow(850), manufacturingDate: daysAgo(90), quantityAvailable: 150, quantityInitial: 150, purchasePrice: 8.8, sellingPrice: 15.50, mrp: 15.50, supplierName: 'Micro Labs', batchStatus: 'active', createdAt: daysAgo(90) },
    { batchId: 'bat_001c', medicineId: 'med_001', batchNumber: 'B240802', expiryDate: daysAgo(15), manufacturingDate: daysAgo(550), quantityAvailable: 0, quantityInitial: 200, purchasePrice: 7.5, sellingPrice: 14.00, mrp: 14.00, supplierName: 'Micro Labs', batchStatus: 'expired', createdAt: daysAgo(550) },
  ],
  med_002: [
    { batchId: 'bat_002a', medicineId: 'med_002', batchNumber: 'C240601', expiryDate: daysFromNow(285), manufacturingDate: daysAgo(200), quantityAvailable: 87, quantityInitial: 120, purchasePrice: 10.0, sellingPrice: 16.50, mrp: 16.50, supplierName: 'GSK Pharma', batchStatus: 'active', createdAt: daysAgo(200) },
    { batchId: 'bat_002b', medicineId: 'med_002', batchNumber: 'C241201', expiryDate: daysFromNow(680), manufacturingDate: daysAgo(60), quantityAvailable: 100, quantityInitial: 100, purchasePrice: 10.5, sellingPrice: 16.50, mrp: 16.50, supplierName: 'GSK Pharma', batchStatus: 'active', createdAt: daysAgo(60) },
  ],
};

const MOVEMENTS_BY_MEDICINE: Record<string, StockMovement[]> = {
  med_001: [
    { movementId: 'mv_001', medicineId: 'med_001', batchId: 'bat_001a', batchNumber: 'B250501', movementType: 'PURCHASE', quantityChange: 200, performedBy: 'Dr. Ravi Sharma', referenceId: 'PO-1256', notes: 'Regular reorder', createdAt: daysAgo(180) },
    { movementId: 'mv_002', medicineId: 'med_001', batchId: 'bat_001a', batchNumber: 'B250501', movementType: 'SALE', quantityChange: -48, performedBy: 'Cashier 1', referenceId: 'INV000041', createdAt: daysAgo(10) },
    { movementId: 'mv_003', medicineId: 'med_001', batchId: 'bat_001a', batchNumber: 'B250501', movementType: 'ADJUSTMENT', quantityChange: -10, performedBy: 'Dr. Ravi Sharma', notes: 'Damaged stock removal', createdAt: daysAgo(5) },
    { movementId: 'mv_004', medicineId: 'med_001', batchId: 'bat_001a', batchNumber: 'B250501', movementType: 'SALE', quantityChange: -40, performedBy: 'Cashier 2', referenceId: 'INV000045', createdAt: daysAgo(2) },
  ],
};

const AI_INSIGHTS: AIInsight[] = [
  { id: 'ai_001', type: 'reorder', title: 'Reorder Suggested', description: 'Due in 56 Tablets\nReorder within 3 days', actionLabel: 'Reorder Now', priority: 'high' },
  { id: 'ai_002', type: 'transfer', title: 'Stock Transfer', description: 'Crocin Advance 650mg\nMove to Rack A-01', actionLabel: 'Transfer Now', priority: 'medium' },
  { id: 'ai_003', type: 'expiry', title: 'Expiry Alert', description: '9 Medicines\nWill expire in 30 days', actionLabel: 'View Details', priority: 'high' },
  { id: 'ai_004', type: 'demand', title: 'Demand Prediction', description: 'High demand expected\nfor Paracetamol in May', actionLabel: 'View Forecast', priority: 'medium' },
  { id: 'ai_005', type: 'dead_stock', title: 'Dead Stock Alert', description: '12 Medicines\nNo movement in 90+ days', actionLabel: 'View Report', priority: 'medium' },
  { id: 'ai_006', type: 'low_stock', title: 'Low Stock Alert', description: '37 Items\nBelow reorder level', actionLabel: 'View All', priority: 'high' },
];

export const inventoryHandlers = [
  http.get('/api/inventory/stats', async () => {
    await delay(200);
    const totalValue = INVENTORY.reduce((sum, i) => sum + i.availableQuantity * i.mrp, 0);
    return HttpResponse.json({
      success: true,
      data: {
        totalMedicines: 18452,
        inventoryValue: totalValue,
        lowStockCount: INVENTORY.filter((i) => i.status === 'low_stock').length,
        expiringSoonCount: INVENTORY.filter((i) => { const d = new Date(i.expiryDate).getTime() - now.getTime(); return d > 0 && d < 30 * 86400000; }).length,
        outOfStockCount: INVENTORY.filter((i) => i.status === 'out_of_stock').length,
        pendingTransfers: 26,
      },
    });
  }),

  http.get('/api/inventory/ai-insights', async () => {
    await delay(300);
    return HttpResponse.json({ success: true, data: AI_INSIGHTS });
  }),

  http.get('/api/inventory/batches/:medicineId', async ({ params }) => {
    await delay(300);
    const batches = BATCHES_BY_MEDICINE[params['medicineId'] as string] ?? [];
    return HttpResponse.json({ success: true, data: batches });
  }),

  http.get('/api/inventory/movements/:medicineId', async ({ params }) => {
    await delay(300);
    const movements = MOVEMENTS_BY_MEDICINE[params['medicineId'] as string] ?? [];
    return HttpResponse.json({ success: true, data: movements });
  }),

  http.get('/api/inventory', async ({ request }) => {
    await delay(350);
    const url = new URL(request.url);
    const search = url.searchParams.get('search')?.toLowerCase() ?? '';
    const status = url.searchParams.get('status') ?? '';
    const expiryStatus = url.searchParams.get('expiryStatus') ?? '';
    const category = url.searchParams.get('category') ?? '';
    const dosageForm = url.searchParams.get('dosageForm') ?? '';
    const page = Number(url.searchParams.get('page') ?? 1);
    const limit = Number(url.searchParams.get('limit') ?? 50);

    let filtered = [...INVENTORY];
    if (search) {
      filtered = filtered.filter((i) =>
        (i.medicine as { name: string } | undefined)?.name.toLowerCase().includes(search) ||
        i.batchNumber.toLowerCase().includes(search) ||
        (i.rackLocation ?? '').toLowerCase().includes(search) ||
        (i.manufacturer ?? '').toLowerCase().includes(search)
      );
    }
    if (status && status !== 'all') filtered = filtered.filter((i) => i.status === status);
    if (expiryStatus && expiryStatus !== 'all') filtered = filtered.filter((i) => i.expiryStatus === expiryStatus);
    if (category && category !== 'all') filtered = filtered.filter((i) => i.category === category);
    if (dosageForm && dosageForm !== 'all') filtered = filtered.filter((i) => i.dosageForm?.toLowerCase() === dosageForm.toLowerCase());

    const start = (page - 1) * limit;
    const data = filtered.slice(start, start + limit);
    return HttpResponse.json({ success: true, data: { data, total: filtered.length, page, limit, totalPages: Math.ceil(filtered.length / limit) } });
  }),

  http.post('/api/inventory', async ({ request }) => {
    await delay(600);
    const body = await request.json() as Partial<InventoryItem>;
    const newItem: InventoryItem = {
      ...body as InventoryItem,
      id: `inv_${Date.now()}`,
      tenantId: 'tnt_001',
      reservedQuantity: 0,
      availableQuantity: (body.quantity ?? 0),
      status: (body.quantity ?? 0) === 0 ? 'out_of_stock' : (body.quantity ?? 0) <= 10 ? 'low_stock' : 'available',
      expiryStatus: 'good',
      batchStatus: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    INVENTORY.unshift(newItem);
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),

  http.patch('/api/inventory/:id/adjust', async ({ params, request }) => {
    await delay(400);
    const idx = INVENTORY.findIndex((i) => i.id === params['id']);
    if (idx === -1) return HttpResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    const body = await request.json() as { adjustment: number; reason: string; physicalCount?: number };
    const item = INVENTORY[idx]!;
    const newQty = body.physicalCount !== undefined ? body.physicalCount : Math.max(0, item.quantity + body.adjustment);
    INVENTORY[idx] = {
      ...item,
      quantity: newQty,
      availableQuantity: Math.max(0, newQty - item.reservedQuantity),
      status: newQty === 0 ? 'out_of_stock' : newQty <= (item.reorderLevel ?? 10) ? 'low_stock' : 'available',
      updatedAt: new Date().toISOString(),
    };
    return HttpResponse.json({ success: true, data: INVENTORY[idx] });
  }),

  http.delete('/api/inventory/:id', async ({ params }) => {
    await delay(300);
    const idx = INVENTORY.findIndex((i) => i.id === params['id']);
    if (idx === -1) return HttpResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    INVENTORY.splice(idx, 1);
    return HttpResponse.json({ success: true });
  }),
];
