import { redirect } from 'next/navigation';

// "Controlled Drugs" was a subset of the Schedule Register (same
// /api/schedule-register data, pre-filtered to Schedule X/H1). The Schedule
// Register already filters by any schedule, so the Compliance nav now deep-links
// to it filtered to Schedule X; this redirect keeps any old bookmark working.
export default function ControlledDrugsPage() {
  redirect('/schedule-register?schedule=X');
}
