import type { Metadata } from 'next';
import { ContactsView } from '@/modules/contacts/views/contacts-view';

export const metadata: Metadata = { title: 'Contacts' };

export default function ContactsPage() {
  return <ContactsView />;
}
