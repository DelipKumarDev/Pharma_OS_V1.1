import { redirect } from 'next/navigation';

// /inventory was an unlinked duplicate of the canonical "Stock & Inventory"
// page (/stock). Redirect so any old link resolves there instead of a dead end.
export default function InventoryPage() {
  redirect('/stock');
}
