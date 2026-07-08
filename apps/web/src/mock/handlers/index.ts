import { authHandlers } from './auth';
import { medicineHandlers } from './medicine';
import { inventoryHandlers } from './inventory';
import { billingHandlers } from './billing';
import { userHandlers } from './user';
import { dashboardHandlers } from './dashboard';
import { tenantHandlers } from './tenants';
import { vendorHandlers } from './vendor';
import { customerHandlers } from './customer';
import { reorderHandlers } from './reorder';
import { auditHandlers } from './audit';
import { notificationHandlers } from './notification';
import { prescriptionHandlers } from './prescription';
import { returnsHandlers } from './returns';
import { settingsHandlers } from './settings';
import { reportsHandlers } from './reports';
import { barcodeHandlers } from './barcode';
import { refillHandlers } from './refills';

export const handlers = [
  ...authHandlers,
  ...medicineHandlers,
  ...inventoryHandlers,
  ...billingHandlers,
  ...userHandlers,
  ...dashboardHandlers,
  ...tenantHandlers,
  ...vendorHandlers,
  ...customerHandlers,
  ...reorderHandlers,
  ...auditHandlers,
  ...notificationHandlers,
  ...prescriptionHandlers,
  ...returnsHandlers,
  ...settingsHandlers,
  ...reportsHandlers,
  ...barcodeHandlers,
  ...refillHandlers,
];
