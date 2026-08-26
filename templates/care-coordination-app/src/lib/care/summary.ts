import type {
  CareCoordinationSummary,
  EncounterSnapshot,
  OrderSnapshot,
  PageStatus,
  PatientSnapshot,
  ProblemEntry,
  ReferralSnapshot,
  SectionStatus,
} from './types';
import { deriveProviderMentions } from './providerMentions';

// Pure assembly: threads order/referral into providerMentions. `order`'s
// typeLabel is expected to already be filled in by the caller (the SDK
// client, via mapOrderTypeLabel) since that mapping depends on a raw field
// this module has no reason to know about beyond OrderSnapshot's shape.
export function buildSummary(
  patient: SectionStatus<PatientSnapshot>,
  problems: SectionStatus<ProblemEntry[]>,
  encounter: SectionStatus<EncounterSnapshot>,
  order: SectionStatus<OrderSnapshot>,
  referral: SectionStatus<ReferralSnapshot>,
): CareCoordinationSummary {
  return {
    patient,
    problems,
    encounter,
    order,
    referral,
    providerMentions: deriveProviderMentions(order, referral),
  };
}

// 'connecting' and 'error' are lifecycle states the page component assigns
// directly (SDK init / OAuth failure) — this function never returns them.
// A single section erroring still yields 'result': that section renders its
// own inline error while the rest of the card renders normally (partial
// rendering, no all-or-nothing gate).
export function derivePageStatus(
  patientIdResolved: boolean,
  summary: CareCoordinationSummary,
): PageStatus {
  if (!patientIdResolved) return { kind: 'waiting' };
  return { kind: 'result', summary };
}
