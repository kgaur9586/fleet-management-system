export type VehicleDocumentStatus = 'active' | 'expiring_soon' | 'expired';

export const getVehicleDocumentStatus = (
  expiryDate: Date,
  asOf = new Date(),
  expiringSoonDays = 30
): VehicleDocumentStatus => {
  const expiryTime = expiryDate.getTime();
  const asOfTime = asOf.getTime();
  if (expiryTime < asOfTime) return 'expired';
  if (expiryTime <= asOfTime + expiringSoonDays * 24 * 60 * 60 * 1000) return 'expiring_soon';
  return 'active';
};
