import { http, HttpResponse, delay } from 'msw';

// Indian pharmacy EAN-13 barcodes mapped to medicines
const BARCODE_DB: Record<string, object> = {
  '8901030654532': {
    id: 'med_001', name: 'Paracetamol 500mg', genericName: 'Paracetamol',
    manufacturer: 'GSK', mrp: 22.50, sellingPrice: 20.00, gstRate: 0,
    requiresPrescription: false, reorderLevel: 100, category: 'Analgesic',
  },
  '8901030867424': {
    id: 'med_002', name: 'Amoxicillin 250mg', genericName: 'Amoxicillin',
    manufacturer: 'Cipla', mrp: 54.00, sellingPrice: 50.00, gstRate: 12,
    requiresPrescription: true, reorderLevel: 50, category: 'Antibiotic',
  },
  '8901030129483': {
    id: 'med_003', name: 'Pantoprazole 40mg', genericName: 'Pantoprazole',
    manufacturer: 'Sun Pharma', mrp: 44.00, sellingPrice: 40.00, gstRate: 12,
    requiresPrescription: false, reorderLevel: 80, category: 'Gastro',
  },
  '8901030475829': {
    id: 'med_004', name: 'Metformin 500mg', genericName: 'Metformin',
    manufacturer: 'USV', mrp: 22.00, sellingPrice: 20.00, gstRate: 0,
    requiresPrescription: true, reorderLevel: 60, category: 'Diabetes',
  },
  '8901030234561': {
    id: 'med_005', name: 'Cetirizine 10mg', genericName: 'Cetirizine',
    manufacturer: 'Dr. Reddy\'s', mrp: 22.00, sellingPrice: 20.00, gstRate: 5,
    requiresPrescription: false, reorderLevel: 80, category: 'Antiallergic',
  },
  '8901030998765': {
    id: 'med_006', name: 'Atorvastatin 10mg', genericName: 'Atorvastatin',
    manufacturer: 'Pfizer', mrp: 55.00, sellingPrice: 50.00, gstRate: 12,
    requiresPrescription: true, reorderLevel: 40, category: 'Cardio',
  },
  '8901030345672': {
    id: 'med_007', name: 'Azithromycin 500mg', genericName: 'Azithromycin',
    manufacturer: 'Zydus', mrp: 55.00, sellingPrice: 50.00, gstRate: 12,
    requiresPrescription: true, reorderLevel: 50, category: 'Antibiotic',
  },
  '8901030556789': {
    id: 'med_009', name: 'Omeprazole 20mg', genericName: 'Omeprazole',
    manufacturer: 'Torrent', mrp: 33.00, sellingPrice: 30.00, gstRate: 5,
    requiresPrescription: false, reorderLevel: 60, category: 'Gastro',
  },
};

export const barcodeHandlers = [
  http.get('/api/medicines/barcode/:code', async ({ params }) => {
    await delay(180);
    const medicine = BARCODE_DB[params.code as string];
    if (!medicine) {
      return HttpResponse.json({ success: false, message: 'Barcode not found in database' }, { status: 404 });
    }
    return HttpResponse.json({ success: true, data: medicine });
  }),
];
