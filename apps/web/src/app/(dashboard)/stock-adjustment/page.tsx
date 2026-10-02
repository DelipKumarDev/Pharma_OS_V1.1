import { redirect } from 'next/navigation';

// "Stock Adjustment" just re-listed inventory with the same per-row Adjust
// dialog the Stock page already offers (and Stock Count handles bulk counts).
// Folded into the Stock page; this redirect keeps any old bookmark working.
export default function StockAdjustmentPage() {
  redirect('/stock');
}
