import { redirect } from 'next/navigation';

// "Purchase Returns" was a read-only subset of the Returns module's Vendor
// Returns tab (same /api/returns?type=vendor_return data, no approve/process).
// The Procurement nav now deep-links to the full Returns page filtered to vendor
// returns; this redirect keeps any old bookmark working.
export default function PurchaseReturnsPage() {
  redirect('/returns?type=vendor_return');
}
