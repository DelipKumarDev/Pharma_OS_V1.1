import type { Metadata } from 'next';
import { MedicinesView } from '@/modules/medicines/views/medicines-view';

export const metadata: Metadata = { title: 'Medicines' };

export default function MedicinesPage() {
  return <MedicinesView />;
}
