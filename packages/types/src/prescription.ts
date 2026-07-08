export type PrescriptionStatus = 'pending_review' | 'approved' | 'dispensed' | 'rejected' | 'expired';

export interface PrescriptionMedicine {
  id: string;
  medicineName: string;
  genericName?: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity?: number;
  instructions?: string;
  dispensed: boolean;
}

export interface Prescription {
  id: string;
  prescriptionNumber: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  doctorName: string;
  doctorRegNumber?: string;
  hospitalName?: string;
  prescriptionDate: string;
  validUntil?: string;
  status: PrescriptionStatus;
  imageUrl?: string;
  imageType?: 'image' | 'pdf';
  medicines: PrescriptionMedicine[];
  billId?: string;
  billNumber?: string;
  notes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PrescriptionStats {
  total: number;
  pendingReview: number;
  approved: number;
  dispensedToday: number;
  rejected: number;
  expiringSoon: number;
}

export interface CreatePrescriptionRequest {
  customerName: string;
  customerPhone?: string;
  customerId?: string;
  doctorName: string;
  doctorRegNumber?: string;
  hospitalName?: string;
  prescriptionDate: string;
  validUntil?: string;
  medicines: Omit<PrescriptionMedicine, 'id' | 'dispensed'>[];
  notes?: string;
}
