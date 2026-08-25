// The SDK's Insurance/Patient context payload has no structured network/plan ID
// field (confirmed against the installed @vimconnect/app-sdk types — only
// groupId/payerId/memberId/isPrimary/payerName). This substring mapping is
// necessarily app-owned, mirroring sdoh-app's isMedicaid()/MEDICAID_HINTS approach.

const PAYER_NETWORK_HINTS: Array<{ hints: string[]; networkId: string }> = [
  { hints: ['aetna'], networkId: 'network-a' },
  { hints: ['united', 'uhc'], networkId: 'network-a' },
  { hints: ['blue cross', 'bcbs', 'anthem'], networkId: 'network-b' },
  { hints: ['cigna'], networkId: 'network-b' },
];

export function networkIdForPayer(payerName?: string): string | undefined {
  if (!payerName) return undefined;
  const name = payerName.toLowerCase();
  return PAYER_NETWORK_HINTS.find((entry) => entry.hints.some((hint) => name.includes(hint)))?.networkId;
}
