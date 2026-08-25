// DEV-ONLY. Realistic Referral/Patient fixtures, shaped exactly like the installed
// @vimconnect/app-sdk's ReferralSchema/PatientSchema (confirmed field-for-field
// against node_modules/@vimconnect/app-sdk/dist/index.d.ts — see the ProviderShape/
// DiagnosisShape/etc. below). This module imports NOTHING — not the SDK, not any
// app lib — so it's safe to pull into either the Tier 1 harness or the Tier 2
// simulator without pulling anything else along with it. Only ever reachable when
// NEXT_PUBLIC_SIM_MODE === 'true'; the pages/components that import this are
// themselves gated (see src/app/dev/harness/page.tsx and src/dev/SimulatorControls.tsx).
//
// Every fixture's referral/patient object is a structural superset of the app's
// own narrow ReferralLike/PatientLike (src/lib/referral-engine.ts) — passing one
// directly to evaluateReferral(), onReferralStart's callback, etc. type-checks with
// no cast, exactly as a real SDK payload would.

interface ProviderShape {
  npi?: string;
  firstName?: string;
  lastName?: string;
  specialty?: string;
  middleName?: string;
  ehrProviderId?: string;
}

interface DiagnosisShape {
  code?: string;
  status?: string;
  system?: string;
  onSetDate?: string;
  description?: string;
}

interface ReferralShape {
  conditions?: DiagnosisShape[];
  identifiers?: { ehrReferralId?: string };
  targetProvider?: ProviderShape;
  basicInformation?: {
    notes?: string;
    status?: string;
    endDate?: string;
    reasons?: string;
    authCode?: string;
    isLocked?: boolean;
    priority?: string;
    specialty?: string;
    startDate?: string;
    createdDate?: string;
    facilityName?: string;
    numberOfVisits?: number;
  };
  referringProvider?: ProviderShape;
}

interface PatientShape {
  pcp?: ProviderShape;
  address?: { city?: string; state?: string; zipCode?: string; address1?: string; address2?: string };
  problems?: DiagnosisShape[];
  allergies?: Array<{
    allergyDetails?: { name?: string; criticality?: string };
    basicInformation?: { status?: string; onsetDate?: string };
    allergyReactionDetails?: { name?: string; severity?: string };
  }>;
  insurances?: Array<{ groupId?: string; payerId?: string; memberId?: string; isPrimary?: boolean; payerName?: string }>;
  contactInfo?: { email?: string; faxNumber?: string; homePhoneNumber?: string; mobilePhoneNumber?: string };
  identifiers?: { id?: string; mrn?: string; ehrPatientId?: string };
  demographics?: {
    gender?: 'male' | 'female';
    lastName?: string;
    firstName?: string;
    middleName?: string;
    dateOfBirth?: string;
  };
}

export interface ReferralFixture {
  id: string;
  label: string;
  description: string;
  referral: ReferralShape;
  patient: PatientShape;
}

const REFERRING_PROVIDER: ProviderShape = {
  npi: '1000099999',
  firstName: 'Alice',
  lastName: 'Nguyen',
  specialty: 'Internal Medicine',
  ehrProviderId: 'prov-int-004',
};

const AETNA_PATIENT: PatientShape = {
  demographics: { firstName: 'Maria', lastName: 'Gonzalez', gender: 'female', dateOfBirth: '1968-04-12' },
  address: { address1: '482 Elm St', city: 'Springfield', state: 'IL', zipCode: '62704' },
  contactInfo: { email: 'maria.gonzalez@example.com', mobilePhoneNumber: '217-555-0142' },
  identifiers: { ehrPatientId: 'pat-10234' },
  insurances: [{ payerName: 'Aetna PPO', payerId: 'AET001', memberId: 'W123456789', groupId: 'GRP4521', isPrimary: true }],
};

export const FIXTURES: ReferralFixture[] = [
  {
    id: 'out-of-network-cardiology',
    label: 'Out-of-network cardiology',
    description: 'Target provider is not in the Aetna network — should surface an in-network alternative.',
    patient: AETNA_PATIENT,
    referral: {
      identifiers: { ehrReferralId: 'ref-90001' },
      targetProvider: {
        npi: '1999999901',
        firstName: 'Harold',
        lastName: 'Weiss',
        specialty: 'Cardiology',
        ehrProviderId: 'prov-ext-771',
      },
      referringProvider: REFERRING_PROVIDER,
      conditions: [
        {
          code: 'I25.10',
          system: 'ICD-10-CM',
          description: 'Atherosclerotic heart disease of native coronary artery without angina pectoris',
          status: 'active',
          onSetDate: '2024-11-02',
        },
      ],
      basicInformation: {
        specialty: 'Cardiology',
        reasons: 'Evaluate for coronary artery disease progression',
        status: 'pending',
        priority: 'routine',
        startDate: '2026-08-20',
      },
    },
  },
  {
    id: 'econsult-eligible-dermatology',
    label: 'E-consult-eligible dermatology',
    description:
      'Diagnosis matches the bundled e-consult vocabulary; target is already top-tier in-network, so only the e-consult nudge should fire.',
    patient: AETNA_PATIENT,
    referral: {
      identifiers: { ehrReferralId: 'ref-90002' },
      targetProvider: {
        npi: '2000000001', // Omar Haddad — Dermatology, network-a, tier 5 (src/lib/network-data.ts)
        firstName: 'Omar',
        lastName: 'Haddad',
        specialty: 'Dermatology',
        ehrProviderId: 'prov-ext-118',
      },
      referringProvider: REFERRING_PROVIDER,
      conditions: [
        {
          code: 'L30.9',
          system: 'ICD-10-CM',
          description: 'Dermatitis, unspecified',
          status: 'active',
          onSetDate: '2026-07-15',
        },
      ],
      basicInformation: {
        specialty: 'Dermatology',
        reasons: 'Chronic dermatitis, not responding to OTC treatment',
        status: 'pending',
        priority: 'routine',
        startDate: '2026-08-20',
      },
    },
  },
  {
    id: 'already-in-network-top-tier',
    label: 'Already in-network, top tier',
    description:
      'Target is already the best in-network option for this specialty, and the diagnosis is not e-consult-eligible — should stay silent.',
    patient: AETNA_PATIENT,
    referral: {
      identifiers: { ehrReferralId: 'ref-90003' },
      targetProvider: {
        npi: '4000000001', // Robert Nguyen — Orthopedics, network-a, tier 5
        firstName: 'Robert',
        lastName: 'Nguyen',
        specialty: 'Orthopedics',
        ehrProviderId: 'prov-ext-552',
      },
      referringProvider: REFERRING_PROVIDER,
      conditions: [
        {
          code: 'S83.511A',
          system: 'ICD-10-CM',
          description: 'Sprain of anterior cruciate ligament of right knee, initial encounter',
          status: 'active',
          onSetDate: '2026-08-01',
        },
      ],
      basicInformation: {
        specialty: 'Orthopedics',
        reasons: 'Persistent knee instability after twisting injury',
        status: 'pending',
        priority: 'routine',
        startDate: '2026-08-20',
      },
    },
  },
  {
    id: 'no-signal',
    label: 'No signal (unmapped specialty + unmapped payer)',
    description:
      'Specialty has no bundled network or e-consult data, and the payer has no network mapping — should stay silent.',
    patient: {
      demographics: { firstName: 'Tom', lastName: 'Baxter', gender: 'male', dateOfBirth: '1975-09-30' },
      address: { address1: '17 Birch Ln', city: 'Springfield', state: 'IL', zipCode: '62701' },
      contactInfo: { email: 'tom.baxter@example.com', mobilePhoneNumber: '217-555-0199' },
      identifiers: { ehrPatientId: 'pat-10287' },
      insurances: [{ payerName: 'Regional Health Plan', payerId: 'RHP009', memberId: 'RHP-88221', isPrimary: true }],
    },
    referral: {
      identifiers: { ehrReferralId: 'ref-90004' },
      targetProvider: {
        npi: '3999999904',
        firstName: 'Carol',
        lastName: 'Diaz',
        specialty: 'Neurology',
        ehrProviderId: 'prov-ext-903',
      },
      referringProvider: REFERRING_PROVIDER,
      conditions: [
        {
          code: 'G43.909',
          system: 'ICD-10-CM',
          description: 'Migraine, unspecified, not intractable, without status migrainosus',
          status: 'active',
          onSetDate: '2026-06-10',
        },
      ],
      basicInformation: {
        specialty: 'Neurology',
        reasons: 'Recurrent migraines, evaluate for preventive therapy',
        status: 'pending',
        priority: 'routine',
        startDate: '2026-08-20',
      },
    },
  },
];

export function getFixture(id: string): ReferralFixture | undefined {
  return FIXTURES.find((f) => f.id === id);
}