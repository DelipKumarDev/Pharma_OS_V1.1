import { http, HttpResponse, delay } from 'msw';
import type { Medicine } from '@pharmaos/types';

const MEDICINES: Medicine[] = [
  { id: 'med_001', tenantId: 'tnt_001', name: 'Paracetamol 500mg', genericName: 'Paracetamol', brandName: 'Crocin', manufacturer: 'GSK India', category: 'analgesic', form: 'tablet', strength: '500mg', unit: 'strip', composition: 'Paracetamol 500mg', hsn: '30049099', barcode: '8901030000012', schedule: null, requiresPrescription: false, gstRate: 12, mrp: 20, purchasePrice: 14, sellingPrice: 18, reorderLevel: 50, status: 'active', createdAt: '2024-01-15T10:00:00Z', updatedAt: '2024-01-15T10:00:00Z' },
  { id: 'med_002', tenantId: 'tnt_001', name: 'Amoxicillin 250mg', genericName: 'Amoxicillin', brandName: 'Mox', manufacturer: 'Cipla Ltd', category: 'antibiotic', form: 'capsule', strength: '250mg', unit: 'strip', requiresPrescription: true, gstRate: 12, mrp: 52, purchasePrice: 40, sellingPrice: 48, reorderLevel: 30, schedule: 'H', composition: 'Amoxicillin 250mg', status: 'active', createdAt: '2024-01-16T10:00:00Z', updatedAt: '2024-01-16T10:00:00Z' },
  { id: 'med_003', tenantId: 'tnt_001', name: 'Pantoprazole 40mg', genericName: 'Pantoprazole', brandName: 'Pan-40', manufacturer: 'Alkem Laboratories', category: 'gastroenterology', form: 'tablet', strength: '40mg', unit: 'strip', requiresPrescription: false, gstRate: 12, mrp: 42, purchasePrice: 30, sellingPrice: 38, reorderLevel: 40, composition: 'Pantoprazole Sodium 40mg', status: 'active', createdAt: '2024-01-17T10:00:00Z', updatedAt: '2024-01-17T10:00:00Z' },
  { id: 'med_004', tenantId: 'tnt_001', name: 'Metformin 500mg', genericName: 'Metformin HCl', brandName: 'Glucophage', manufacturer: 'USV Limited', category: 'diabetes', form: 'tablet', strength: '500mg', unit: 'strip', requiresPrescription: true, gstRate: 5, mrp: 22, purchasePrice: 16, sellingPrice: 20, reorderLevel: 60, schedule: 'H', composition: 'Metformin Hydrochloride 500mg', status: 'active', createdAt: '2024-01-18T10:00:00Z', updatedAt: '2024-01-18T10:00:00Z' },
  { id: 'med_005', tenantId: 'tnt_001', name: 'Cetirizine 10mg', genericName: 'Cetirizine HCl', brandName: 'Cetzine', manufacturer: 'Sun Pharma', category: 'antihistamine', form: 'tablet', strength: '10mg', unit: 'strip', requiresPrescription: false, gstRate: 12, mrp: 20, purchasePrice: 14, sellingPrice: 18, reorderLevel: 40, composition: 'Cetirizine Dihydrochloride 10mg', status: 'active', createdAt: '2024-01-19T10:00:00Z', updatedAt: '2024-01-19T10:00:00Z' },
  { id: 'med_006', tenantId: 'tnt_001', name: 'Atorvastatin 10mg', genericName: 'Atorvastatin Calcium', brandName: 'Lipitor', manufacturer: 'Pfizer India', category: 'cardiovascular', form: 'tablet', strength: '10mg', unit: 'strip', requiresPrescription: true, gstRate: 12, mrp: 85, purchasePrice: 62, sellingPrice: 78, reorderLevel: 25, schedule: 'H', composition: 'Atorvastatin Calcium 10mg', status: 'active', createdAt: '2024-01-20T10:00:00Z', updatedAt: '2024-01-20T10:00:00Z' },
  { id: 'med_007', tenantId: 'tnt_001', name: 'Azithromycin 500mg', genericName: 'Azithromycin', brandName: 'Zithromax', manufacturer: 'Pfizer India', category: 'antibiotic', form: 'tablet', strength: '500mg', unit: 'strip', requiresPrescription: true, gstRate: 12, mrp: 140, purchasePrice: 100, sellingPrice: 130, reorderLevel: 20, schedule: 'H', composition: 'Azithromycin Dihydrate 500mg', status: 'active', createdAt: '2024-01-21T10:00:00Z', updatedAt: '2024-01-21T10:00:00Z' },
  { id: 'med_008', tenantId: 'tnt_001', name: 'Vitamin D3 1000IU', genericName: 'Cholecalciferol', brandName: 'D-Rise', manufacturer: 'USV Limited', category: 'vitamins', form: 'capsule', strength: '1000IU', unit: 'bottle', requiresPrescription: false, gstRate: 5, mrp: 280, purchasePrice: 200, sellingPrice: 250, reorderLevel: 15, composition: 'Cholecalciferol 1000IU', status: 'active', createdAt: '2024-01-22T10:00:00Z', updatedAt: '2024-01-22T10:00:00Z' },
  { id: 'med_009', tenantId: 'tnt_001', name: 'Omeprazole 20mg', genericName: 'Omeprazole', brandName: 'Omez', manufacturer: 'Dr. Reddy\'s', category: 'gastroenterology', form: 'capsule', strength: '20mg', unit: 'strip', requiresPrescription: false, gstRate: 12, mrp: 35, purchasePrice: 24, sellingPrice: 32, reorderLevel: 45, composition: 'Omeprazole 20mg', status: 'active', createdAt: '2024-01-23T10:00:00Z', updatedAt: '2024-01-23T10:00:00Z' },
  { id: 'med_010', tenantId: 'tnt_001', name: 'Aspirin 75mg', genericName: 'Acetylsalicylic Acid', brandName: 'Ecosprin', manufacturer: 'USV Limited', category: 'cardiovascular', form: 'tablet', strength: '75mg', unit: 'strip', requiresPrescription: false, gstRate: 12, mrp: 18, purchasePrice: 12, sellingPrice: 16, reorderLevel: 80, composition: 'Aspirin 75mg', status: 'active', createdAt: '2024-01-24T10:00:00Z', updatedAt: '2024-01-24T10:00:00Z' },
  { id: 'med_011', tenantId: 'tnt_001', name: 'Amlodipine 5mg', genericName: 'Amlodipine Besylate', brandName: 'Amlip', manufacturer: 'Cipla Ltd', category: 'cardiovascular', form: 'tablet', strength: '5mg', unit: 'strip', requiresPrescription: true, gstRate: 12, mrp: 45, purchasePrice: 30, sellingPrice: 40, reorderLevel: 35, schedule: 'H', composition: 'Amlodipine Besylate 5mg', status: 'active', createdAt: '2024-01-25T10:00:00Z', updatedAt: '2024-01-25T10:00:00Z' },
  { id: 'med_012', tenantId: 'tnt_001', name: 'Dolo 650mg', genericName: 'Paracetamol', brandName: 'Dolo', manufacturer: 'Micro Labs', category: 'analgesic', form: 'tablet', strength: '650mg', unit: 'strip', requiresPrescription: false, gstRate: 12, mrp: 30, purchasePrice: 20, sellingPrice: 27, reorderLevel: 60, composition: 'Paracetamol 650mg', status: 'active', createdAt: '2024-01-26T10:00:00Z', updatedAt: '2024-01-26T10:00:00Z' },
  { id: 'med_013', tenantId: 'tnt_001', name: 'Cefixime 200mg', genericName: 'Cefixime', brandName: 'Taxim-O', manufacturer: 'Alkem Laboratories', category: 'antibiotic', form: 'tablet', strength: '200mg', unit: 'strip', requiresPrescription: true, gstRate: 12, mrp: 180, purchasePrice: 130, sellingPrice: 165, reorderLevel: 20, schedule: 'H', composition: 'Cefixime Trihydrate 200mg', status: 'active', createdAt: '2024-01-27T10:00:00Z', updatedAt: '2024-01-27T10:00:00Z' },
  { id: 'med_014', tenantId: 'tnt_001', name: 'Betadine Solution 500ml', genericName: 'Povidone-Iodine', brandName: 'Betadine', manufacturer: 'Win-Medicare', category: 'dermatology', form: 'lotion', strength: '10%', unit: 'bottle', requiresPrescription: false, gstRate: 12, mrp: 120, purchasePrice: 85, sellingPrice: 110, reorderLevel: 10, composition: 'Povidone Iodine 10%', status: 'active', createdAt: '2024-01-28T10:00:00Z', updatedAt: '2024-01-28T10:00:00Z' },
  { id: 'med_015', tenantId: 'tnt_001', name: 'Montelukast 10mg', genericName: 'Montelukast Sodium', brandName: 'Montair', manufacturer: 'Cipla Ltd', category: 'respiratory', form: 'tablet', strength: '10mg', unit: 'strip', requiresPrescription: true, gstRate: 12, mrp: 150, purchasePrice: 110, sellingPrice: 138, reorderLevel: 25, composition: 'Montelukast Sodium 10mg', status: 'active', createdAt: '2024-01-29T10:00:00Z', updatedAt: '2024-01-29T10:00:00Z' },
  { id: 'med_016', tenantId: 'tnt_001', name: 'Losartan 50mg', genericName: 'Losartan Potassium', brandName: 'Cosaar', manufacturer: 'MSD Pharmaceuticals', category: 'cardiovascular', form: 'tablet', strength: '50mg', unit: 'strip', requiresPrescription: true, gstRate: 12, mrp: 95, purchasePrice: 68, sellingPrice: 88, reorderLevel: 30, schedule: 'H', composition: 'Losartan Potassium 50mg', status: 'active', createdAt: '2024-01-30T10:00:00Z', updatedAt: '2024-01-30T10:00:00Z' },
  { id: 'med_017', tenantId: 'tnt_001', name: 'Diclofenac Gel 30g', genericName: 'Diclofenac Sodium', brandName: 'Voltaflam', manufacturer: 'Novartis India', category: 'analgesic', form: 'gel', strength: '1%', unit: 'tube', requiresPrescription: false, gstRate: 12, mrp: 65, purchasePrice: 45, sellingPrice: 58, reorderLevel: 20, composition: 'Diclofenac Diethylamine 1.16%', status: 'active', createdAt: '2024-02-01T10:00:00Z', updatedAt: '2024-02-01T10:00:00Z' },
  { id: 'med_018', tenantId: 'tnt_001', name: 'Salbutamol Inhaler', genericName: 'Salbutamol', brandName: 'Asthalin', manufacturer: 'Cipla Ltd', category: 'respiratory', form: 'inhaler', strength: '100mcg', unit: 'piece', requiresPrescription: true, gstRate: 12, mrp: 110, purchasePrice: 78, sellingPrice: 100, reorderLevel: 15, schedule: 'H', composition: 'Salbutamol Sulphate 100mcg/dose', status: 'active', createdAt: '2024-02-02T10:00:00Z', updatedAt: '2024-02-02T10:00:00Z' },
  { id: 'med_019', tenantId: 'tnt_001', name: 'Clotrimazole Cream 15g', genericName: 'Clotrimazole', brandName: 'Candid', manufacturer: 'Glenmark Pharma', category: 'antifungal', form: 'cream', strength: '1%', unit: 'tube', requiresPrescription: false, gstRate: 12, mrp: 55, purchasePrice: 38, sellingPrice: 50, reorderLevel: 20, composition: 'Clotrimazole 1%', status: 'active', createdAt: '2024-02-03T10:00:00Z', updatedAt: '2024-02-03T10:00:00Z' },
  { id: 'med_020', tenantId: 'tnt_001', name: 'Glimepiride 2mg', genericName: 'Glimepiride', brandName: 'Amaryl', manufacturer: 'Sanofi India', category: 'diabetes', form: 'tablet', strength: '2mg', unit: 'strip', requiresPrescription: true, gstRate: 5, mrp: 75, purchasePrice: 52, sellingPrice: 68, reorderLevel: 30, schedule: 'H', composition: 'Glimepiride 2mg', status: 'active', createdAt: '2024-02-04T10:00:00Z', updatedAt: '2024-02-04T10:00:00Z' },
  { id: 'med_021', tenantId: 'tnt_001', name: 'Ranitidine 150mg', genericName: 'Ranitidine HCl', brandName: 'Zinetac', manufacturer: 'GSK India', category: 'antacid', form: 'tablet', strength: '150mg', unit: 'strip', requiresPrescription: false, gstRate: 12, mrp: 28, purchasePrice: 18, sellingPrice: 25, reorderLevel: 40, composition: 'Ranitidine Hydrochloride 150mg', status: 'active', createdAt: '2024-02-05T10:00:00Z', updatedAt: '2024-02-05T10:00:00Z' },
  { id: 'med_022', tenantId: 'tnt_001', name: 'Chlorpheniramine 4mg', genericName: 'Chlorpheniramine Maleate', brandName: 'Piriton', manufacturer: 'GSK India', category: 'antihistamine', form: 'tablet', strength: '4mg', unit: 'strip', requiresPrescription: false, gstRate: 12, mrp: 15, purchasePrice: 9, sellingPrice: 13, reorderLevel: 50, composition: 'Chlorpheniramine Maleate 4mg', status: 'active', createdAt: '2024-02-06T10:00:00Z', updatedAt: '2024-02-06T10:00:00Z' },
  { id: 'med_023', tenantId: 'tnt_001', name: 'Ondansetron 4mg', genericName: 'Ondansetron HCl', brandName: 'Emeset', manufacturer: 'Cipla Ltd', category: 'gastroenterology', form: 'tablet', strength: '4mg', unit: 'strip', requiresPrescription: true, gstRate: 12, mrp: 55, purchasePrice: 38, sellingPrice: 50, reorderLevel: 25, composition: 'Ondansetron Hydrochloride 4mg', status: 'active', createdAt: '2024-02-07T10:00:00Z', updatedAt: '2024-02-07T10:00:00Z' },
  { id: 'med_024', tenantId: 'tnt_001', name: 'Metronidazole 400mg', genericName: 'Metronidazole', brandName: 'Flagyl', manufacturer: 'Abbott India', category: 'antibiotic', form: 'tablet', strength: '400mg', unit: 'strip', requiresPrescription: true, gstRate: 12, mrp: 35, purchasePrice: 22, sellingPrice: 30, reorderLevel: 35, schedule: 'H', composition: 'Metronidazole 400mg', status: 'active', createdAt: '2024-02-08T10:00:00Z', updatedAt: '2024-02-08T10:00:00Z' },
  { id: 'med_025', tenantId: 'tnt_001', name: 'Prednisolone 10mg', genericName: 'Prednisolone', brandName: 'Wysolone', manufacturer: 'Pfizer India', category: 'other', form: 'tablet', strength: '10mg', unit: 'strip', requiresPrescription: true, gstRate: 12, mrp: 48, purchasePrice: 32, sellingPrice: 44, reorderLevel: 20, schedule: 'H', composition: 'Prednisolone 10mg', status: 'active', createdAt: '2024-02-09T10:00:00Z', updatedAt: '2024-02-09T10:00:00Z' },
  { id: 'med_026', tenantId: 'tnt_001', name: 'Calcium + Vitamin D3', genericName: 'Calcium Carbonate + Cholecalciferol', brandName: 'Calcimax', manufacturer: 'Meyer Organics', category: 'vitamins', form: 'tablet', strength: '500mg+250IU', unit: 'strip', requiresPrescription: false, gstRate: 5, mrp: 130, purchasePrice: 90, sellingPrice: 118, reorderLevel: 30, composition: 'Calcium Carbonate 1250mg + Vitamin D3 250IU', status: 'active', createdAt: '2024-02-10T10:00:00Z', updatedAt: '2024-02-10T10:00:00Z' },
  { id: 'med_027', tenantId: 'tnt_001', name: 'Terbinafine 250mg', genericName: 'Terbinafine HCl', brandName: 'Terbicip', manufacturer: 'Cipla Ltd', category: 'antifungal', form: 'tablet', strength: '250mg', unit: 'strip', requiresPrescription: true, gstRate: 12, mrp: 220, purchasePrice: 158, sellingPrice: 200, reorderLevel: 10, composition: 'Terbinafine Hydrochloride 250mg', status: 'active', createdAt: '2024-02-11T10:00:00Z', updatedAt: '2024-02-11T10:00:00Z' },
  { id: 'med_028', tenantId: 'tnt_001', name: 'Ibuprofen 400mg', genericName: 'Ibuprofen', brandName: 'Brufen', manufacturer: 'Abbott India', category: 'analgesic', form: 'tablet', strength: '400mg', unit: 'strip', requiresPrescription: false, gstRate: 12, mrp: 22, purchasePrice: 14, sellingPrice: 20, reorderLevel: 50, composition: 'Ibuprofen 400mg', status: 'active', createdAt: '2024-02-12T10:00:00Z', updatedAt: '2024-02-12T10:00:00Z' },
  { id: 'med_029', tenantId: 'tnt_001', name: 'ORS Sachets', genericName: 'Oral Rehydration Salts', brandName: 'Electral', manufacturer: 'Franco-Indian', category: 'other', form: 'powder', strength: '21.8g', unit: 'sachet', requiresPrescription: false, gstRate: 5, mrp: 12, purchasePrice: 7, sellingPrice: 10, reorderLevel: 100, composition: 'Sodium Chloride 2.6g + Glucose 13.5g + KCl 1.5g + Sodium Citrate 2.9g', status: 'active', createdAt: '2024-02-13T10:00:00Z', updatedAt: '2024-02-13T10:00:00Z' },
  { id: 'med_030', tenantId: 'tnt_001', name: 'Amoxicillin 500mg + Clavulanic Acid', genericName: 'Co-Amoxiclav', brandName: 'Augmentin', manufacturer: 'GSK India', category: 'antibiotic', form: 'tablet', strength: '500mg+125mg', unit: 'strip', requiresPrescription: true, gstRate: 12, mrp: 280, purchasePrice: 200, sellingPrice: 258, reorderLevel: 15, schedule: 'H', composition: 'Amoxycillin 500mg + Clavulanic Acid 125mg', status: 'active', createdAt: '2024-02-14T10:00:00Z', updatedAt: '2024-02-14T10:00:00Z' },
  { id: 'med_031', tenantId: 'tnt_001', name: 'Levothyroxine 50mcg', genericName: 'Levothyroxine Sodium', brandName: 'Thyrox', manufacturer: 'Macleods Pharma', category: 'other', form: 'tablet', strength: '50mcg', unit: 'strip', requiresPrescription: true, gstRate: 5, mrp: 32, purchasePrice: 22, sellingPrice: 29, reorderLevel: 40, schedule: 'H', composition: 'Levothyroxine Sodium 50mcg', status: 'active', createdAt: '2024-02-15T10:00:00Z', updatedAt: '2024-02-15T10:00:00Z' },
  { id: 'med_032', tenantId: 'tnt_001', name: 'B-Complex + C Tablets', genericName: 'Vitamin B Complex + Vitamin C', brandName: 'Becosules', manufacturer: 'Pfizer India', category: 'vitamins', form: 'capsule', strength: 'Compound', unit: 'bottle', requiresPrescription: false, gstRate: 5, mrp: 180, purchasePrice: 125, sellingPrice: 162, reorderLevel: 20, composition: 'B1 10mg + B2 10mg + B6 3mg + B12 15mcg + C 150mg + Folic Acid 1.5mg', status: 'active', createdAt: '2024-02-16T10:00:00Z', updatedAt: '2024-02-16T10:00:00Z' },
  { id: 'med_033', tenantId: 'tnt_001', name: 'Codeine Cough Syrup 100ml', genericName: 'Codeine Phosphate', brandName: 'Codicuf', manufacturer: 'Wockhardt', category: 'respiratory', form: 'syrup', strength: '10mg/5ml', unit: 'bottle', requiresPrescription: true, gstRate: 12, mrp: 88, purchasePrice: 62, sellingPrice: 80, reorderLevel: 10, schedule: 'H1', composition: 'Codeine Phosphate 10mg + Chlorpheniramine 4mg per 5ml', status: 'active', createdAt: '2024-02-17T10:00:00Z', updatedAt: '2024-02-17T10:00:00Z' },
  { id: 'med_034', tenantId: 'tnt_001', name: 'Ciprofloxacin 500mg', genericName: 'Ciprofloxacin HCl', brandName: 'Ciplox', manufacturer: 'Cipla Ltd', category: 'antibiotic', form: 'tablet', strength: '500mg', unit: 'strip', requiresPrescription: true, gstRate: 12, mrp: 68, purchasePrice: 48, sellingPrice: 62, reorderLevel: 25, schedule: 'H', composition: 'Ciprofloxacin Hydrochloride 500mg', status: 'active', createdAt: '2024-02-18T10:00:00Z', updatedAt: '2024-02-18T10:00:00Z' },
  { id: 'med_035', tenantId: 'tnt_001', name: 'Folic Acid 5mg', genericName: 'Folic Acid', brandName: 'Folvite', manufacturer: 'Pfizer India', category: 'vitamins', form: 'tablet', strength: '5mg', unit: 'strip', requiresPrescription: false, gstRate: 5, mrp: 10, purchasePrice: 6, sellingPrice: 9, reorderLevel: 60, composition: 'Folic Acid 5mg', status: 'active', createdAt: '2024-02-19T10:00:00Z', updatedAt: '2024-02-19T10:00:00Z' },
  { id: 'med_036', tenantId: 'tnt_001', name: 'Insulin Glargine 300IU', genericName: 'Insulin Glargine', brandName: 'Lantus', manufacturer: 'Sanofi India', category: 'diabetes', form: 'injection', strength: '100IU/ml', unit: 'vial', requiresPrescription: true, gstRate: 5, mrp: 1200, purchasePrice: 900, sellingPrice: 1100, reorderLevel: 5, schedule: 'H', composition: 'Insulin Glargine recombinant 100IU/ml', status: 'active', createdAt: '2024-02-20T10:00:00Z', updatedAt: '2024-02-20T10:00:00Z' },
  { id: 'med_037', tenantId: 'tnt_001', name: 'Amitriptyline 25mg', genericName: 'Amitriptyline HCl', brandName: 'Tryptomer', manufacturer: 'Pfizer India', category: 'psychiatry', form: 'tablet', strength: '25mg', unit: 'strip', requiresPrescription: true, gstRate: 12, mrp: 25, purchasePrice: 16, sellingPrice: 22, reorderLevel: 20, schedule: 'H', composition: 'Amitriptyline Hydrochloride 25mg', status: 'discontinued', createdAt: '2024-02-21T10:00:00Z', updatedAt: '2024-03-01T10:00:00Z' },
  { id: 'med_038', tenantId: 'tnt_001', name: 'Enalapril 5mg', genericName: 'Enalapril Maleate', brandName: 'Envas', manufacturer: 'Cadila Healthcare', category: 'cardiovascular', form: 'tablet', strength: '5mg', unit: 'strip', requiresPrescription: true, gstRate: 12, mrp: 38, purchasePrice: 26, sellingPrice: 34, reorderLevel: 30, schedule: 'H', composition: 'Enalapril Maleate 5mg', status: 'active', createdAt: '2024-02-22T10:00:00Z', updatedAt: '2024-02-22T10:00:00Z' },
];

export const medicineHandlers = [
  http.get('/api/medicines', async ({ request }) => {
    await delay(400);
    const url = new URL(request.url);
    const search = url.searchParams.get('search')?.toLowerCase() ?? '';
    const category = url.searchParams.get('category') ?? '';
    const page = Number(url.searchParams.get('page') ?? 1);
    const limit = Number(url.searchParams.get('limit') ?? 50);

    let filtered = [...MEDICINES];
    if (search) {
      filtered = filtered.filter(
        (m) =>
          m.name.toLowerCase().includes(search) ||
          m.genericName.toLowerCase().includes(search) ||
          (m.brandName?.toLowerCase().includes(search) ?? false) ||
          m.manufacturer.toLowerCase().includes(search)
      );
    }
    if (category && category !== 'all') {
      filtered = filtered.filter((m) => m.category === category);
    }

    const start = (page - 1) * limit;
    const data = filtered.slice(start, start + limit);
    return HttpResponse.json({ success: true, data: { data, total: filtered.length, page, limit, totalPages: Math.ceil(filtered.length / limit) } });
  }),

  http.get('/api/medicines/:id', async ({ params }) => {
    await delay(200);
    const medicine = MEDICINES.find((m) => m.id === params['id']);
    if (!medicine) return HttpResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    return HttpResponse.json({ success: true, data: medicine });
  }),

  http.post('/api/medicines', async ({ request }) => {
    await delay(600);
    const body = await request.json() as Partial<Medicine>;
    const newMedicine: Medicine = {
      ...body as Medicine,
      id: `med_${Date.now()}`,
      tenantId: 'tnt_001',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    MEDICINES.push(newMedicine);
    return HttpResponse.json({ success: true, data: newMedicine }, { status: 201 });
  }),

  http.put('/api/medicines/:id', async ({ params, request }) => {
    await delay(400);
    const idx = MEDICINES.findIndex((m) => m.id === params['id']);
    if (idx === -1) return HttpResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    const body = await request.json() as Partial<Medicine>;
    const updated = { ...MEDICINES[idx]!, ...body, updatedAt: new Date().toISOString() };
    MEDICINES[idx] = updated;
    return HttpResponse.json({ success: true, data: updated });
  }),

  http.delete('/api/medicines/:id', async ({ params }) => {
    await delay(400);
    const idx = MEDICINES.findIndex((m) => m.id === params['id']);
    if (idx === -1) return HttpResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    MEDICINES[idx] = { ...MEDICINES[idx]!, status: 'discontinued', updatedAt: new Date().toISOString() };
    return HttpResponse.json({ success: true, data: null });
  }),
];
