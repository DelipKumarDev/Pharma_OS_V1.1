import { redirect } from 'next/navigation';

// The standalone Permissions matrix duplicated the Permission Matrix already in
// Roles & Permissions (/roles), which also manages roles. The nav entry was
// removed; this redirect keeps any old bookmark / deep link working.
export default function PermissionsPage() {
  redirect('/roles');
}
