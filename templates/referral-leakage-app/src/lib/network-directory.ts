import { NETWORK_DIRECTORY, type ProviderRecord } from './network-data';

export type { ProviderRecord };

/** In-network candidates for a specialty, best value tier first. Never synthesizes a record. */
export function matchNetwork(specialty: string, networkId: string, excludeNpi?: string): ProviderRecord[] {
  return NETWORK_DIRECTORY
    .filter((p) => p.specialty === specialty && p.networkId === networkId && p.npi !== excludeNpi)
    .sort((a, b) => b.valueTier - a.valueTier);
}

export function isInNetwork(npi: string, networkId: string): boolean {
  return NETWORK_DIRECTORY.some((p) => p.npi === npi && p.networkId === networkId);
}
