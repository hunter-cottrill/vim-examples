// Cosmetic display-label lookup for an Order's coarse `type` field. This is
// NOT a crosswalk with a confidence tier — it never asserts a clinical fact,
// only prettifies a label, so falling back to the raw string is always safe.
export const ORDER_TYPE_LABELS: Record<string, string> = {
  lab: 'Lab order',
  imaging: 'Imaging order',
  med: 'Medication order',
  referral: 'Referral order',
  procedure: 'Procedure order',
};

export function mapOrderTypeLabel(rawType: string | undefined): string {
  if (!rawType) return 'Order';
  return ORDER_TYPE_LABELS[rawType] ?? rawType;
}
