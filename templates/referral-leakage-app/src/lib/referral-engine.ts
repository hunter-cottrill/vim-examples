// Pure decision composition — SDK-free. The network lookup result is injected as
// a parameter rather than fetched internally, so this stays synchronous and
// testable with no SDK/EHR present.

import { networkIdForPayer } from './payer-network-map';
import { isInNetwork, type ProviderRecord } from './network-directory';
import { isEconsultCandidate, type Diagnosis, type EconsultMatch } from './referral-appropriateness';

export interface ProviderLike {
  npi?: string;
  specialty?: string;
}

export interface ReferralLike {
  identifiers?: { ehrReferralId?: string };
  targetProvider?: ProviderLike;
  conditions?: Diagnosis[];
  basicInformation?: { specialty?: string; reasons?: string };
}

export interface PatientLike {
  insurances?: Array<{ payerName?: string; isPrimary?: boolean }>;
}

export type NudgeSuggestion =
  | { kind: 'econsult_candidate'; condition: EconsultMatch; reason: string }
  | { kind: 'in_network_alternative'; provider: ProviderRecord; reason: string };

export function evaluateReferral(
  referral: ReferralLike,
  patient: PatientLike,
  networkMatches: ProviderRecord[],
): NudgeSuggestion[] {
  const suggestions: NudgeSuggestion[] = [];

  const specialty = referral.targetProvider?.specialty ?? referral.basicInformation?.specialty;
  const econsult = isEconsultCandidate(specialty, referral.conditions);
  if (econsult) {
    suggestions.push({
      kind: 'econsult_candidate',
      condition: econsult,
      reason: `${econsult.description} — often resolved via async e-consult instead of a full referral.`,
    });
  }

  const targetNpi = referral.targetProvider?.npi;
  const insurance = patient.insurances?.find((ins) => ins.isPrimary) ?? patient.insurances?.[0];
  const networkId = networkIdForPayer(insurance?.payerName);
  const alreadyInNetwork = !!targetNpi && !!networkId && isInNetwork(targetNpi, networkId);

  if (!alreadyInNetwork) {
    const alternative = networkMatches.find((m) => m.npi !== targetNpi);
    if (alternative) {
      suggestions.push({
        kind: 'in_network_alternative',
        provider: alternative,
        reason: `Dr. ${alternative.firstName} ${alternative.lastName} (${alternative.specialty}) is in-network — value tier ${alternative.valueTier}, ${alternative.distanceMinutes} min away.`,
      });
    }
  }

  return suggestions;
}
