/** Shared currency formatting for estimate cents — used by both the UI card and the worker's push notification, so they never drift apart. */
export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}
