// Controlled provider network directory. CONCEPT: every suggested provider must
// come from this literal list — never free text, never model-authored. Real impl
// would source this from the org's own network-adequacy system; the SDK has no
// provider-network concept at all (see PLAN.md Section 6).

export interface ProviderRecord {
  npi: string;
  firstName: string;
  lastName: string;
  specialty: string;
  networkId: string;
  valueTier: 1 | 2 | 3 | 4 | 5;
  distanceMinutes: number;
}

export const NETWORK_DIRECTORY: ProviderRecord[] = [
  // Cardiology
  { npi: '1000000001', firstName: 'Priya', lastName: 'Patel', specialty: 'Cardiology', networkId: 'network-a', valueTier: 5, distanceMinutes: 12 },
  { npi: '1000000002', firstName: 'James', lastName: 'Wu', specialty: 'Cardiology', networkId: 'network-a', valueTier: 3, distanceMinutes: 20 },
  { npi: '1000000003', firstName: 'Anna', lastName: 'Rivera', specialty: 'Cardiology', networkId: 'network-b', valueTier: 4, distanceMinutes: 35 },

  // Dermatology
  { npi: '2000000001', firstName: 'Omar', lastName: 'Haddad', specialty: 'Dermatology', networkId: 'network-a', valueTier: 5, distanceMinutes: 8 },
  { npi: '2000000002', firstName: 'Grace', lastName: 'Kim', specialty: 'Dermatology', networkId: 'network-a', valueTier: 2, distanceMinutes: 15 },
  { npi: '2000000003', firstName: 'Marcus', lastName: 'Lee', specialty: 'Dermatology', networkId: 'network-b', valueTier: 4, distanceMinutes: 40 },

  // Endocrinology
  { npi: '3000000001', firstName: 'Sofia', lastName: 'Novak', specialty: 'Endocrinology', networkId: 'network-a', valueTier: 4, distanceMinutes: 18 },
  { npi: '3000000002', firstName: 'David', lastName: 'Chen', specialty: 'Endocrinology', networkId: 'network-a', valueTier: 3, distanceMinutes: 25 },
  { npi: '3000000003', firstName: 'Elena', lastName: 'Petrova', specialty: 'Endocrinology', networkId: 'network-b', valueTier: 5, distanceMinutes: 30 },

  // Orthopedics
  { npi: '4000000001', firstName: 'Robert', lastName: 'Nguyen', specialty: 'Orthopedics', networkId: 'network-a', valueTier: 5, distanceMinutes: 10 },
  { npi: '4000000002', firstName: 'Lily', lastName: 'Brooks', specialty: 'Orthopedics', networkId: 'network-a', valueTier: 3, distanceMinutes: 22 },
  { npi: '4000000003', firstName: 'Hassan', lastName: 'Ali', specialty: 'Orthopedics', networkId: 'network-b', valueTier: 2, distanceMinutes: 28 },

  // Gastroenterology
  { npi: '5000000001', firstName: 'Wei', lastName: 'Zhang', specialty: 'Gastroenterology', networkId: 'network-a', valueTier: 4, distanceMinutes: 14 },
  { npi: '5000000002', firstName: 'Nadia', lastName: 'Ibrahim', specialty: 'Gastroenterology', networkId: 'network-a', valueTier: 5, distanceMinutes: 9 },
  { npi: '5000000003', firstName: 'Carlos', lastName: 'Mendez', specialty: 'Gastroenterology', networkId: 'network-b', valueTier: 2, distanceMinutes: 45 },
];
