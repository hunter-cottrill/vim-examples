"use client";

import { useEffect, useRef, useState } from "react";
import {
  initVimSDK,
  type Diagnosis,
  type Encounter,
  type Patient,
  type VimSDK,
} from "@vimconnect/app-sdk";
import type { CdsPayload, InsightCategory, Suggestion } from "@/lib/cds/types";
import { getModule } from "@/lib/cds/modules/registry";
import type { VocabEntry } from "@/lib/cds/vocab/types";

// SDKError is declared in the SDK's type definitions but isn't actually
// exported by the compiled runtime bundle, so `instanceof SDKError` isn't
// usable here — check the error's shape instead.
function isSdkErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === code
  );
}

type ConnectionStatus = "connecting" | "connected" | "error";
type EnrichmentStatus = "idle" | "loading" | "loaded" | "unsupported" | "error";
type WriteStatus =
  | "idle"
  | "checking_capability"
  | "not_available"
  | "requesting_permission"
  | "denied"
  | "updating"
  | "success"
  | "error";

interface PayloadLogEntry {
  label: string;
  timestamp: number;
  payload: unknown;
}

const MAX_LOGGED_PAYLOADS = 20;

// Defense-in-depth beyond the SDK's own permission gate, mirroring the same
// allow-list concept the Worker used to enforce before writeback moved here
// (Task 5) — only field paths genuinely configured as writable on this EHR
// are ever eligible, confirmed via a real INVALID_FIELDS error during M3.
const CDS_WRITEBACK_FIELD_ALLOWLIST: Record<string, string[]> = {
  "encounter.diagnoses": ["diagnoses"],
  "encounter.procedureCodes": ["billingInformation.procedureCodes"],
};

// Shared card/badge styling — one visual language for both the CDS
// suggestion cards and the patient/encounter panel below them.
type CardTone = "neutral" | "positive" | "warning";

const CARD_TONE_CLASSES: Record<CardTone, string> = {
  neutral: "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900",
  positive: "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/40",
  warning: "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40",
};

function cardClasses(tone: CardTone = "neutral") {
  return `rounded-xl border shadow-sm p-3 ${CARD_TONE_CLASSES[tone]}`;
}

const CONFIDENCE_CARD_CLASSES: Record<Suggestion["confidence"], string> = {
  high: "border-l-4 border-l-green-500 " + CARD_TONE_CLASSES.positive,
  medium: "border-l-4 border-l-amber-500 " + CARD_TONE_CLASSES.warning,
  low: "border-l-4 border-l-zinc-400 " + CARD_TONE_CLASSES.neutral,
};

const CONFIDENCE_BADGE_CLASSES: Record<Suggestion["confidence"], string> = {
  high: "bg-green-600 text-white dark:bg-green-500",
  medium: "bg-amber-500 text-white dark:bg-amber-600",
  low: "bg-zinc-400 text-white dark:bg-zinc-600",
};

const BADGE_BASE = "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium";
const BUTTON_BASE =
  "rounded-md px-3 py-1.5 text-sm font-medium shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50";

function appendPayload(
  setEntries: React.Dispatch<React.SetStateAction<PayloadLogEntry[]>>,
  label: string,
  payload: unknown
) {
  setEntries((prev) => [
    ...prev.slice(-(MAX_LOGGED_PAYLOADS - 1)),
    { label, timestamp: Date.now(), payload },
  ]);
}

function PayloadDropdown({
  title,
  entries,
  selectedIndex,
  onSelect,
  emptyMessage,
}: {
  title: string;
  entries: PayloadLogEntry[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  emptyMessage: string;
}) {
  const effectiveIndex = selectedIndex ?? entries.length - 1;
  const selected = entries[effectiveIndex];

  return (
    <details className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <summary className="cursor-pointer text-sm font-medium text-zinc-500 dark:text-zinc-400">
        {title} ({entries.length})
      </summary>
      {entries.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{emptyMessage}</p>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          <select
            className="rounded border border-zinc-300 bg-white p-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            value={effectiveIndex}
            onChange={(event) => onSelect(Number(event.target.value))}
          >
            {entries.map((entry, i) => (
              <option key={i} value={i}>
                {entry.label} — {new Date(entry.timestamp).toLocaleTimeString()}
              </option>
            ))}
          </select>
          <pre className="max-h-64 overflow-auto rounded bg-zinc-100 p-2 text-xs text-black dark:bg-zinc-900 dark:text-zinc-50">
            {JSON.stringify(selected?.payload, null, 2)}
          </pre>
        </div>
      )}
    </details>
  );
}

export default function Home() {
  const initialized = useRef(false);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [sdk, setSdk] = useState<VimSDK | null>(null);
  const [encounter, setEncounter] = useState<Partial<Encounter> | null>(null);
  const [patient, setPatient] = useState<Partial<Patient> | null>(null);
  const [chartPatient, setChartPatient] = useState<Partial<Patient> | null>(null);
  const [enrichedPatient, setEnrichedPatient] = useState<Partial<Patient> | undefined>(
    undefined
  );
  const [enrichedProblems, setEnrichedProblems] = useState<Diagnosis[] | undefined>(
    undefined
  );
  const [problemsStatus, setProblemsStatus] = useState<EnrichmentStatus>("idle");

  // Raw payload history for the "Read Payloads" / "Write Payloads" dropdowns.
  const [readPayloads, setReadPayloads] = useState<PayloadLogEntry[]>([]);
  const [writePayloads, setWritePayloads] = useState<PayloadLogEntry[]>([]);
  const [selectedReadIndex, setSelectedReadIndex] = useState<number | null>(null);
  const [selectedWriteIndex, setSelectedWriteIndex] = useState<number | null>(null);

  const [writeStatus, setWriteStatus] = useState<WriteStatus>("idle");
  const [writeMessage, setWriteMessage] = useState<string | null>(null);

  // The Worker's published CDS payload (pull channel) and, if this app was
  // opened by tapping a Worker notification, the launch context that got us
  // here.
  const [cdsPayload, setCdsPayload] = useState<CdsPayload | null>(null);
  const [launchContext, setLaunchContext] = useState<{
    source: "worker-notification";
    launchPayload: Record<string, unknown>;
  } | null>(null);

  // Task 3/5: which suggestions the provider has checked, which have already
  // been written this session, and the state of the confirm-selections
  // writeback ceremony.
  const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<Set<string>>(new Set());
  const [writtenSuggestionIds, setWrittenSuggestionIds] = useState<Set<string>>(new Set());
  const [cdsWriteStatus, setCdsWriteStatus] = useState<WriteStatus>("idle");
  const [cdsWriteMessage, setCdsWriteMessage] = useState<string | null>(null);

  // Task 6: manual vocabulary lookup per category — the fallback when the
  // auto-suggested shortlist is missing or insufficient. Manually-added
  // suggestions join the same selection/writeback flow as LLM suggestions.
  const [manualSuggestionsByCategory, setManualSuggestionsByCategory] = useState<
    Record<string, Suggestion[]>
  >({});
  const [manualLookupOpenCategory, setManualLookupOpenCategory] = useState<InsightCategory | null>(
    null
  );
  const [manualLookupQuery, setManualLookupQuery] = useState("");
  const [manualLookupResults, setManualLookupResults] = useState<VocabEntry[]>([]);
  const [manualLookupStatus, setManualLookupStatus] = useState<"idle" | "loading" | "error">(
    "idle"
  );

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    let unsubscribeChartOpen: (() => void) | undefined;
    let unsubscribeEncounter: (() => void) | undefined;
    let unsubscribePatient: (() => void) | undefined;
    let unsubscribeChartPatient: (() => void) | undefined;
    let unsubscribeCds: (() => void) | undefined;

    // Populated by /launch after a successful OAuth code exchange. If absent,
    // initVimSDK() falls back to its own token_endpoint-query-param resolution.
    const accessToken = sessionStorage.getItem("vim_access_token") ?? undefined;
    const idToken = sessionStorage.getItem("vim_id_token") ?? undefined;

    initVimSDK({ debug: true, accessToken, idToken })
      .then((sdkInstance) => {
        sdkInstance.hub.setActivationStatus("ENABLED");

        // M6: consume-once. Must be read exactly once per app open, right
        // when the SDK connects, rather than deferred into a lazy useState
        // initializer — here the SDK instance itself is only available
        // after this async connect resolves, not synchronously at mount.
        const consumedLaunchContext = sdkInstance.consumeLaunchContext();
        if (consumedLaunchContext) {
          console.log("[payload] consumeLaunchContext", consumedLaunchContext);
          setLaunchContext(consumedLaunchContext);
        }

        unsubscribeCds = sdkInstance.workerState.on<CdsPayload>(
          "carePilotCds",
          (_prev, next) => {
            console.log("[payload] carePilotCds (from Worker)", next);
            setCdsPayload(next);
            setSelectedSuggestionIds(new Set());
            setWrittenSuggestionIds(new Set());
            setCdsWriteStatus("idle");
            setCdsWriteMessage(null);
            setManualSuggestionsByCategory({});
            setManualLookupOpenCategory(null);
            setManualLookupQuery("");
            setManualLookupResults([]);
            setManualLookupStatus("idle");
          }
        );

        unsubscribeChartOpen = sdkInstance.ehr.workflow.on("chart_open", (event) => {
          console.log("[payload] chart_open event", event);
          appendPayload(setReadPayloads, "chart_open event", event);

          // EventEntityMap types entities.patient as a full `Patient`, but the
          // real chart_open payload is a bare entity reference
          // ({ entityType, id, type }), not a resolved Patient record.
          const patient = event.entities.patient as unknown as {
            entityType: string;
            id: string;
            type: "existing" | "new";
          };
          console.log("chart_open: patient", patient.id);
        });

        // Vim SDK context payloads wrap entity data under `.fields` (alongside
        // `id`/`type`/`identifier` metadata) — `curr` itself is `undefined`,
        // not an empty object, when the encounter/patient leaves context.
        unsubscribeEncounter = sdkInstance.ehr.context.onChange(
          "encounter_open:encounter",
          (_prev, curr) => {
            console.log("[payload] encounter_open:encounter", curr);
            appendPayload(setReadPayloads, "encounter_open:encounter", curr);

            if (curr) {
              // `cc` isn't declared on the SDK's Encounter type, but is the
              // field this EHR (and the SDK's own docs example) populates.
              const fieldsWithCc = curr.fields as Partial<Encounter> & { cc?: string };
              console.log("Active encounter:", fieldsWithCc.cc);
            }
            setEncounter(curr?.fields ?? null);
          }
        );
        unsubscribePatient = sdkInstance.ehr.context.onChange(
          "encounter_open:patient",
          (_prev, curr) => {
            console.log("[payload] encounter_open:patient", curr);
            appendPayload(setReadPayloads, "encounter_open:patient", curr);
            setPatient(curr?.fields ?? null);
          }
        );
        // encounter_open:patient only carries identifiers in this EHR;
        // chart_open:patient carries the fuller demographics projection (but
        // no problem list — confirmed absent from every source we checked),
        // so subscribe to it too as an enrichment fallback.
        unsubscribeChartPatient = sdkInstance.ehr.context.onChange(
          "chart_open:patient",
          (_prev, curr) => {
            console.log("[payload] chart_open:patient", curr);
            appendPayload(setReadPayloads, "chart_open:patient", curr);
            setChartPatient(curr?.fields ?? null);
          }
        );

        setSdk(sdkInstance);
        setStatus("connected");
      })
      .catch((error) => {
        console.error("CarePilot: failed to initialize Vim SDK", error);
        setStatus("error");
      });

    return () => {
      unsubscribeChartOpen?.();
      unsubscribeEncounter?.();
      unsubscribePatient?.();
      unsubscribeChartPatient?.();
      unsubscribeCds?.();
    };
  }, []);

  // identifiers.id is deprecated in favor of identifiers.ehrPatientId, kept
  // here only as a fallback for EHRs that haven't backfilled the new field.
  // chart_open:patient is a fallback source in case encounter_open:patient
  // hasn't fired yet or omits identifiers for some EHR.
  const patientId =
    patient?.identifiers?.ehrPatientId ??
    patient?.identifiers?.id ??
    chartPatient?.identifiers?.ehrPatientId ??
    chartPatient?.identifiers?.id;

  // Entity API enrichment: the pushed context doesn't guarantee full
  // demographics/problem data, so pull the patient record explicitly once we
  // know who's in view. Not every EHR implements every operation, so
  // NOT_IMPLEMENTED is a normal, expected outcome here — not a bug.
  useEffect(() => {
    function resetEnrichedPatient() {
      setEnrichedPatient(undefined);
    }

    if (!sdk || !patientId) {
      resetEnrichedPatient();
      return;
    }

    // Re-bind as consts so their narrowed (non-null) types survive into the
    // nested function below — TS narrowing doesn't cross function boundaries.
    const activeSdk = sdk;
    const activePatientId = patientId;
    let cancelled = false;

    function fetchPatientDetails() {
      activeSdk.ehr.api.patient
        .getPatient({ patientId: activePatientId })
        .then((response) => {
          if (cancelled) return;
          console.log("[payload] patient.getPatient response", response);
          appendPayload(setReadPayloads, "patient.getPatient response", response);
          if (response.success) {
            setEnrichedPatient(response.data);
          }
        })
        .catch((error) => {
          if (cancelled) return;

          // Error/SDKError instances don't serialize via JSON.stringify (their
          // message/stack aren't own-enumerable properties), so capture a
          // plain object instead — otherwise the payload dropdown would show
          // an empty "{}" for every failed call.
          const errorPayload = {
            code: (error as { code?: unknown })?.code,
            message: error instanceof Error ? error.message : String(error),
          };
          console.log("[payload] patient.getPatient error", errorPayload);
          appendPayload(setReadPayloads, "patient.getPatient error", errorPayload);

          if (isSdkErrorCode(error, "NOT_IMPLEMENTED")) {
            console.warn(
              "CarePilot: patient.getPatient is not implemented for this EHR"
            );
          } else {
            console.error("CarePilot: failed to fetch patient details", error);
          }
        });
    }

    fetchPatientDetails();

    return () => {
      cancelled = true;
    };
  }, [sdk, patientId]);

  // Problems are a dedicated Entity API operation — getPatient() does not
  // return them as a side effect (confirmed empirically: a successful
  // getPatient response on one EHR had no `problems` key at all). Independent
  // effect since getPatient/getProblems support can differ per EHR.
  useEffect(() => {
    function resetProblems() {
      setEnrichedProblems(undefined);
      setProblemsStatus("idle");
    }

    if (!sdk || !patientId) {
      resetProblems();
      return;
    }

    const activeSdk = sdk;
    const activePatientId = patientId;
    let cancelled = false;

    function fetchProblems() {
      setProblemsStatus("loading");
      activeSdk.ehr.api.patient
        .getProblems({ patientId: activePatientId })
        .then((response) => {
          if (cancelled) return;
          console.log("[payload] patient.getProblems response", response);
          appendPayload(setReadPayloads, "patient.getProblems response", response);
          if (response.success) {
            setEnrichedProblems(response.data);
            setProblemsStatus("loaded");
          } else {
            setProblemsStatus("error");
          }
        })
        .catch((error) => {
          if (cancelled) return;

          const errorPayload = {
            code: (error as { code?: unknown })?.code,
            message: error instanceof Error ? error.message : String(error),
          };
          console.log("[payload] patient.getProblems error", errorPayload);
          appendPayload(setReadPayloads, "patient.getProblems error", errorPayload);

          if (isSdkErrorCode(error, "NOT_IMPLEMENTED")) {
            console.warn(
              "CarePilot: patient.getProblems is not implemented for this EHR"
            );
            setProblemsStatus("unsupported");
          } else {
            console.error("CarePilot: failed to fetch problems", error);
            setProblemsStatus("error");
          }
        });
    }

    fetchProblems();

    return () => {
      cancelled = true;
    };
  }, [sdk, patientId]);

  // Prefer the Entity API's fuller record, then chart_open:patient's richer
  // context projection, then encounter_open:patient's sparse one.
  const demographics =
    enrichedPatient?.demographics ?? chartPatient?.demographics ?? patient?.demographics;
  const patientName = [demographics?.firstName, demographics?.lastName]
    .filter(Boolean)
    .join(" ");
  // getProblems() is the dedicated source; getPatient()/context's embedded
  // `problems` field are kept as low-priority fallbacks in case some other
  // EHR populates them despite what we've observed so far.
  const problems =
    enrichedProblems ?? chartPatient?.problems ?? patient?.problems ?? enrichedPatient?.problems;

  // This sandbox EHR populates the legacy flat fields (cc/diagnoses/isSigned/
  // dateOfService) rather than the newer nested shape the SDK's types mark as
  // current (subjective/assessment/basicInformation) — read both, preferring
  // whichever is actually populated, since other EHRs may use the nested one.
  // `cc` isn't declared on the SDK's Encounter type at all (a live field the
  // type definitions don't account for), so it's read via an explicit extension.
  const encounterWithCc = encounter as (Partial<Encounter> & { cc?: string }) | null;
  const chiefComplaint = encounter?.subjective?.chiefComplaintNotes ?? encounterWithCc?.cc;
  const encounterStatus = String(
    encounter?.basicInformation?.status ?? encounter?.isSigned ?? "status unknown"
  );
  const encounterIsSigned = /sign|lock/i.test(encounterStatus);
  const dateOfService =
    encounter?.basicInformation?.dateOfService ?? encounter?.dateOfService;
  const diagnoses = encounter?.assessment?.diagnoses?.length
    ? encounter.assessment.diagnoses
    : encounter?.diagnoses;

  // M3: the permission-gated writeback ceremony, run by hand (no agent/
  // suggestWriteback involved) — getCapability -> inspect disruptive/
  // permissionState -> requestPermission if requestable -> hasPermission
  // gate -> update. Every step's result is logged to the Write Payloads
  // dropdown so the whole ceremony is inspectable, not just its outcome.
  async function handleProposeUpdate() {
    if (!sdk) return;

    const writeback = sdk.ehr.context.encounter;
    // requestPermission('update') on this EHR rejected `assessment` with
    // INVALID_FIELDS, naming the actual configured allowlist: "Valid leaf
    // fields: [diagnoses, billingInformation.procedureCodes]" — writeback
    // permission is scoped per-field by EHR configuration, not just
    // available/unavailable at the operation level. `diagnoses` is used here
    // since it's both valid and the closest fit to "assessment field."
    const proposedFields: Partial<Encounter> = {
      diagnoses: [
        {
          code: "Z00.00",
          description: "CarePilot demo diagnosis — permission-gated update test",
        },
      ],
    };

    function recordWriteError(label: string, error: unknown) {
      // Error/SDKError instances don't serialize via JSON.stringify, so
      // capture a plain object instead (same reasoning as the read-side
      // error logging above).
      const errorPayload = {
        code: (error as { code?: unknown })?.code,
        message: error instanceof Error ? error.message : String(error),
      };
      console.log(`[payload] ${label}`, errorPayload);
      appendPayload(setWritePayloads, label, errorPayload);
      setWriteStatus("error");

      if (isSdkErrorCode(error, "ENTITY_NOT_IN_CONTEXT")) {
        setWriteMessage("ENTITY_NOT_IN_CONTEXT — the encounter left context before the write completed.");
      } else if (isSdkErrorCode(error, "OPERATION_NOT_CONFIGURED")) {
        setWriteMessage("OPERATION_NOT_CONFIGURED — update isn't configured for this EHR.");
      } else if (isSdkErrorCode(error, "PERMISSION_REQUIRED")) {
        setWriteMessage("PERMISSION_REQUIRED — attempted a disruptive update without permission.");
      } else {
        setWriteMessage("Unexpected error — see console/Write Payloads for details.");
      }
    }

    // 1. getCapability('update')
    setWriteStatus("checking_capability");
    setWriteMessage(null);
    const capability = writeback.getCapability("update");
    console.log("[payload] encounter.getCapability('update')", capability);
    appendPayload(setWritePayloads, "encounter.getCapability('update')", capability);

    if (!capability.available) {
      setWriteStatus("not_available");
      setWriteMessage(capability.reason ?? "Update is not available for this encounter.");
      return;
    }

    // 2. Inspect disruptive / permissionState before deciding what to do next.
    if (capability.permissionState === "denied") {
      setWriteStatus("denied");
      setWriteMessage(
        `Permission previously denied this session (disruptive: ${String(capability.disruptive)}).`
      );
      return;
    }

    // Tracks whether we already have a fresh, authoritative "granted" answer
    // from this very ceremony — either capability said so up front, or
    // requestPermission just confirmed it a moment ago.
    let permitted = capability.permissionState === "granted";

    // 3/4. requestPermission('update') if requestable
    if (capability.permissionState === "requestable") {
      setWriteStatus("requesting_permission");
      let permissionResult: "granted" | "denied";
      try {
        permissionResult = await writeback.requestPermission("update", {
          fields: Object.keys(proposedFields),
        });
      } catch (error) {
        recordWriteError("encounter.requestPermission('update') error", error);
        return;
      }
      console.log("[payload] encounter.requestPermission('update')", permissionResult);
      appendPayload(setWritePayloads, "encounter.requestPermission('update')", {
        result: permissionResult,
      });

      if (permissionResult === "denied") {
        setWriteStatus("denied");
        setWriteMessage("Provider denied the write request — nothing was written.");
        return;
      }
      permitted = true;
    }

    // 5. hasPermission('update') — called and logged per the ceremony, but
    // not trusted to override a grant we just confirmed directly above: it
    // can read stale state immediately after requestPermission resolves
    // (confirmed empirically — requestPermission returned "granted" while
    // hasPermission() in the same tick still reported false).
    const hasPermissionNow = writeback.hasPermission("update");
    console.log("[payload] encounter.hasPermission('update')", hasPermissionNow);
    appendPayload(setWritePayloads, "encounter.hasPermission('update')", {
      result: hasPermissionNow,
    });

    if (!permitted && !hasPermissionNow) {
      setWriteStatus("denied");
      setWriteMessage("No permission to update — nothing was written.");
      return;
    }

    // 6. update(...)
    setWriteStatus("updating");
    try {
      // 'append' adds to the existing diagnoses array rather than replacing
      // it wholesale, unlike 'override'/'merge'.
      const result = await writeback.update(proposedFields, { mode: "append" });
      console.log("[payload] encounter.update(...)", result);
      appendPayload(setWritePayloads, "encounter.update(...)", result);

      if (result.success) {
        setWriteStatus("success");
        setWriteMessage("Update written successfully.");
      } else {
        setWriteStatus("error");
        setWriteMessage(result.error ?? "Update failed.");
      }
    } catch (error) {
      recordWriteError("encounter.update(...) error", error);
    }
  }

  function toggleSuggestionSelection(id: string) {
    setSelectedSuggestionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Task 6: manual vocabulary lookup — the fallback when the auto-suggested
  // shortlist is missing or insufficient. No free-text: every result comes
  // from GET /api/vocab/search, which only ever returns real vocabulary
  // entries for the requested system.
  function openManualLookup(category: InsightCategory) {
    setManualLookupOpenCategory(category);
    setManualLookupQuery("");
    setManualLookupResults([]);
    setManualLookupStatus("idle");
  }

  async function searchManualLookup(category: InsightCategory, query: string) {
    setManualLookupQuery(query);
    const insightModule = getModule(category);
    if (!insightModule || !query.trim()) {
      setManualLookupResults([]);
      return;
    }

    setManualLookupStatus("loading");
    try {
      const response = await fetch(
        `/api/vocab/search?system=${encodeURIComponent(insightModule.vocabulary)}&q=${encodeURIComponent(query)}`
      );
      if (!response.ok) {
        setManualLookupStatus("error");
        return;
      }
      const data: { results: VocabEntry[] } = await response.json();
      setManualLookupResults(data.results);
      setManualLookupStatus("idle");
    } catch {
      setManualLookupStatus("error");
    }
  }

  function addManualSuggestion(category: InsightCategory, entry: VocabEntry) {
    const insightModule = getModule(category);
    const id = `manual-${category}-${entry.code}`;

    const suggestion: Suggestion = {
      id,
      category,
      code: entry.code,
      system: entry.system,
      display: entry.description,
      rationale: "Manually selected by provider from the vocabulary lookup.",
      confidence: "high",
      evidenceStrength: "confirmed-data",
      supportingEvidence: [],
      writeback: insightModule?.writeback ?? null,
      source: "manual",
    };

    setManualSuggestionsByCategory((prev) => {
      const existing = prev[category] ?? [];
      if (existing.some((s) => s.id === id)) return prev; // already added
      return { ...prev, [category]: [...existing, suggestion] };
    });
    setSelectedSuggestionIds((prev) => new Set(prev).add(id));
    setManualLookupOpenCategory(null);
  }

  // Task 5: the writeback ceremony for CDS suggestions the provider checked.
  // Same shape as handleProposeUpdate's hand-rolled M3 ceremony — getCapability
  // -> inspect permissionState -> requestPermission if requestable ->
  // hasPermission gate -> update — just targeting the union of selected
  // codes instead of one hardcoded demo diagnosis. Only "encounter.diagnoses"
  // is reachable in this build (diagnosis-gap is the only enabled module);
  // "encounter.procedureCodes" arrives once quality-measure is enabled.
  async function handleConfirmCdsSelections() {
    if (!sdk || !cdsPayload) return;

    const allSuggestions = cdsPayload.groups.flatMap((group) => [
      ...group.suggestions,
      ...(manualSuggestionsByCategory[group.category] ?? []),
    ]);
    const selected = allSuggestions.filter(
      (s) => selectedSuggestionIds.has(s.id) && s.writeback?.kind === "encounter.diagnoses"
    );
    if (selected.length === 0) {
      setCdsWriteMessage("Select at least one suggestion to write.");
      return;
    }

    // Defense-in-depth beyond the SDK's own permission gate: confirm the
    // target field is one this EHR is actually known to allow before ever
    // attempting the write.
    const allowedFields = CDS_WRITEBACK_FIELD_ALLOWLIST["encounter.diagnoses"];
    if (!allowedFields?.includes("diagnoses")) {
      setCdsWriteStatus("error");
      setCdsWriteMessage("Writeback target not in the allow-list — refusing to write.");
      return;
    }

    const proposedFields: Partial<Encounter> = {
      diagnoses: selected.map((s) => ({ code: s.code, description: s.display })),
    };

    function recordCdsWriteError(label: string, error: unknown) {
      const errorPayload = {
        code: (error as { code?: unknown })?.code,
        message: error instanceof Error ? error.message : String(error),
      };
      console.log(`[payload] ${label}`, errorPayload);
      appendPayload(setWritePayloads, label, errorPayload);
      setCdsWriteStatus("error");

      if (isSdkErrorCode(error, "ENTITY_NOT_IN_CONTEXT")) {
        setCdsWriteMessage("ENTITY_NOT_IN_CONTEXT — the encounter left context before the write completed.");
      } else if (isSdkErrorCode(error, "OPERATION_NOT_CONFIGURED")) {
        setCdsWriteMessage("OPERATION_NOT_CONFIGURED — update isn't configured for this EHR.");
      } else if (isSdkErrorCode(error, "PERMISSION_REQUIRED")) {
        setCdsWriteMessage("PERMISSION_REQUIRED — attempted a disruptive update without permission.");
      } else if (isSdkErrorCode(error, "INVALID_DATA")) {
        setCdsWriteMessage("INVALID_DATA — the update payload was rejected by the EHR.");
      } else {
        setCdsWriteMessage("Unexpected error — see console/Write Payloads for details.");
      }
    }

    const writeback = sdk.ehr.context.encounter;

    setCdsWriteStatus("checking_capability");
    setCdsWriteMessage(null);
    const capability = writeback.getCapability("update");
    console.log("[payload] cds encounter.getCapability('update')", capability);
    appendPayload(setWritePayloads, "cds encounter.getCapability('update')", capability);

    if (!capability.available) {
      setCdsWriteStatus("not_available");
      setCdsWriteMessage(capability.reason ?? "Update is not available for this encounter.");
      return;
    }

    if (capability.permissionState === "denied") {
      setCdsWriteStatus("denied");
      setCdsWriteMessage(
        `Permission previously denied this session (disruptive: ${String(capability.disruptive)}).`
      );
      return;
    }

    let permitted = capability.permissionState === "granted";

    if (capability.permissionState === "requestable") {
      setCdsWriteStatus("requesting_permission");
      let permissionResult: "granted" | "denied";
      try {
        permissionResult = await writeback.requestPermission("update", { fields: allowedFields });
      } catch (error) {
        recordCdsWriteError("cds encounter.requestPermission('update') error", error);
        return;
      }
      console.log("[payload] cds encounter.requestPermission('update')", permissionResult);
      appendPayload(setWritePayloads, "cds encounter.requestPermission('update')", {
        result: permissionResult,
      });

      if (permissionResult === "denied") {
        setCdsWriteStatus("denied");
        setCdsWriteMessage("Provider denied the write request — nothing was written.");
        return;
      }
      permitted = true;
    }

    // hasPermission() is logged per the ceremony but, as observed during M3
    // testing, can read stale state immediately after requestPermission
    // resolves — trust the fresh result tracked above as an OR-condition.
    const hasPermissionNow = writeback.hasPermission("update");
    console.log("[payload] cds encounter.hasPermission('update')", hasPermissionNow);
    appendPayload(setWritePayloads, "cds encounter.hasPermission('update')", {
      result: hasPermissionNow,
    });

    if (!permitted && !hasPermissionNow) {
      setCdsWriteStatus("denied");
      setCdsWriteMessage("No permission to update — nothing was written.");
      return;
    }

    setCdsWriteStatus("updating");
    try {
      const result = await writeback.update(proposedFields, { mode: "append" });
      console.log("[payload] cds encounter.update(...)", result);
      appendPayload(setWritePayloads, "cds encounter.update(...)", result);

      if (result.success) {
        setCdsWriteStatus("success");
        setCdsWriteMessage(`Wrote ${selected.length} diagnosis code(s) successfully.`);
        const writtenIds = new Set(selected.map((s) => s.id));
        setWrittenSuggestionIds((prev) => new Set([...prev, ...writtenIds]));
        setSelectedSuggestionIds((prev) => {
          const next = new Set(prev);
          writtenIds.forEach((id) => next.delete(id));
          return next;
        });
      } else {
        setCdsWriteStatus("error");
        setCdsWriteMessage(result.error ?? "Update failed.");
      }
    } catch (error) {
      recordCdsWriteError("cds encounter.update(...) error", error);
    }
  }

  const writeInProgress =
    writeStatus === "checking_capability" ||
    writeStatus === "requesting_permission" ||
    writeStatus === "updating";

  const cdsWriteInProgress =
    cdsWriteStatus === "checking_capability" ||
    cdsWriteStatus === "requesting_permission" ||
    cdsWriteStatus === "updating";

  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-md flex-col gap-4 py-16 px-6">
        <div>
          <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
            CarePilot
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Vim SDK status: {status}
          </p>
        </div>

        {cdsPayload && cdsPayload.groups.length > 0 && (
          <section className="flex flex-col gap-3 rounded-xl border border-blue-300 bg-blue-50 p-4 shadow-md dark:border-blue-800 dark:bg-blue-950">
            {launchContext && (
              <p className="text-xs font-medium text-blue-700 dark:text-blue-300">
                Opened from a CarePilot notification
              </p>
            )}
            <h2 className="text-sm font-semibold text-blue-800 dark:text-blue-200">
              CDS suggestions
            </h2>

            {cdsPayload.groups.map((group) => {
              const manualSuggestions = manualSuggestionsByCategory[group.category] ?? [];
              const allGroupSuggestions = [...group.suggestions, ...manualSuggestions];

              return (
                <div key={group.category} className="flex flex-col gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-black dark:text-zinc-50">
                      {group.title}
                    </h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">{group.triggerReason}</p>
                  </div>

                  {allGroupSuggestions.length === 0 ? (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      No auto-suggestions for this category.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {allGroupSuggestions.map((suggestion) => {
                        const written = writtenSuggestionIds.has(suggestion.id);
                        return (
                          <li
                            key={suggestion.id}
                            className={`flex flex-col gap-1.5 rounded-xl p-3 shadow-sm ${CONFIDENCE_CARD_CLASSES[suggestion.confidence]}`}
                          >
                            <label className="flex items-start gap-2">
                              <input
                                type="checkbox"
                                className="mt-1"
                                checked={selectedSuggestionIds.has(suggestion.id)}
                                disabled={written}
                                onChange={() => toggleSuggestionSelection(suggestion.id)}
                              />
                              <span className="flex flex-1 flex-col gap-1">
                                <span className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-sm font-medium text-black dark:text-zinc-50">
                                    {suggestion.code} — {suggestion.display}
                                  </span>
                                  {written && (
                                    <span className={`${BADGE_BASE} bg-blue-600 text-white dark:bg-blue-500`}>
                                      written
                                    </span>
                                  )}
                                  {suggestion.source === "manual" && (
                                    <span
                                      className={`${BADGE_BASE} border border-zinc-300 text-zinc-600 dark:border-zinc-600 dark:text-zinc-300`}
                                    >
                                      manual
                                    </span>
                                  )}
                                </span>
                                <span className="flex flex-wrap items-center gap-1.5">
                                  <span
                                    className={`${BADGE_BASE} ${CONFIDENCE_BADGE_CLASSES[suggestion.confidence]}`}
                                  >
                                    {suggestion.confidence} confidence
                                  </span>
                                  <span
                                    className={`${BADGE_BASE} border border-zinc-300 text-zinc-600 dark:border-zinc-600 dark:text-zinc-300`}
                                  >
                                    {suggestion.evidenceStrength === "confirmed-data"
                                      ? "confirmed"
                                      : "suspected"}
                                  </span>
                                </span>
                                <span className="text-xs text-zinc-700 dark:text-zinc-300">
                                  {suggestion.rationale}
                                </span>
                                {suggestion.supportingEvidence.length > 0 && (
                                  <span className="text-xs italic text-zinc-500 dark:text-zinc-500">
                                    {suggestion.supportingEvidence.join(" · ")}
                                  </span>
                                )}
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {manualLookupOpenCategory === group.category ? (
                    <div className="flex flex-col gap-2 rounded-xl border border-blue-200 bg-white p-3 shadow-sm dark:border-blue-900 dark:bg-zinc-950">
                      <input
                        type="text"
                        autoFocus
                        placeholder="Search ICD-10-CM…"
                        value={manualLookupQuery}
                        onChange={(e) => {
                          void searchManualLookup(group.category, e.target.value);
                        }}
                        className="rounded-md border border-zinc-300 bg-white p-1.5 text-sm shadow-sm outline-none transition-colors focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-900"
                      />
                      {manualLookupStatus === "loading" && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">Searching…</p>
                      )}
                      {manualLookupStatus === "error" && (
                        <p className="text-xs text-red-600 dark:text-red-400">Search failed.</p>
                      )}
                      {manualLookupResults.length > 0 && (
                        <ul className="flex max-h-40 flex-col gap-1 overflow-auto">
                          {manualLookupResults.map((entry) => (
                            <li key={entry.code}>
                              <button
                                type="button"
                                onClick={() => addManualSuggestion(group.category, entry)}
                                className="w-full rounded-md px-2 py-1 text-left text-xs text-black transition-colors hover:bg-blue-100 active:bg-blue-200 dark:text-zinc-50 dark:hover:bg-blue-900 dark:active:bg-blue-800"
                              >
                                {entry.code} — {entry.description}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      <button
                        type="button"
                        onClick={() => setManualLookupOpenCategory(null)}
                        className="self-start rounded-md px-2 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 active:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:active:bg-zinc-700"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openManualLookup(group.category)}
                      className="self-start rounded-md border border-blue-300 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 shadow-sm transition-colors hover:bg-blue-100 active:bg-blue-200 dark:border-blue-700 dark:bg-zinc-900 dark:text-blue-300 dark:hover:bg-blue-900 dark:active:bg-blue-800"
                    >
                      + Add a different code
                    </button>
                  )}
                </div>
              );
            })}

            <div>
              <button
                type="button"
                onClick={() => {
                  void handleConfirmCdsSelections();
                }}
                disabled={cdsWriteInProgress || selectedSuggestionIds.size === 0}
                className={`${BUTTON_BASE} border border-blue-600 bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 disabled:hover:bg-blue-600 dark:border-blue-500 dark:bg-blue-600 dark:hover:bg-blue-500`}
              >
                {cdsWriteInProgress
                  ? "Working…"
                  : `Confirm selected (${selectedSuggestionIds.size})`}
              </button>
              {cdsWriteMessage && (
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{cdsWriteMessage}</p>
              )}
            </div>
          </section>
        )}

        {!encounter && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No encounter currently in context.
          </p>
        )}

        {encounter && (
          <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 shadow-md dark:border-zinc-800 dark:bg-zinc-950">
            <div className={cardClasses("neutral")}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Patient
              </h2>
              <p className="mt-1 text-base text-black dark:text-zinc-50">
                {patientName || "Unknown"}
                {demographics?.dateOfBirth && ` · DOB ${demographics.dateOfBirth}`}
                {demographics?.gender && ` · ${demographics.gender}`}
              </p>
            </div>

            <div className={cardClasses("neutral")}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Encounter
                </h2>
                <span
                  className={`${BADGE_BASE} ${
                    encounterIsSigned
                      ? "bg-zinc-500 text-white dark:bg-zinc-600"
                      : "bg-green-600 text-white dark:bg-green-500"
                  }`}
                >
                  {encounterStatus}
                </span>
              </div>
              <p className="mt-1 text-base text-black dark:text-zinc-50">
                {dateOfService && dateOfService}
              </p>
              {chiefComplaint && (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  CC: {chiefComplaint}
                </p>
              )}
            </div>

            <div className={cardClasses(diagnoses?.length ? "positive" : "warning")}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Assessment
              </h2>
              {diagnoses?.length ? (
                <ul className="mt-1 list-disc pl-4 text-sm text-black dark:text-zinc-50">
                  {diagnoses.map((dx, i) => (
                    <li key={dx.code ?? i}>
                      {dx.description ?? dx.code ?? "Unlabeled diagnosis"}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  No diagnoses documented yet.
                </p>
              )}
            </div>

            <div className={cardClasses(problems?.length ? "positive" : "neutral")}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Problem list
              </h2>
              {problems?.length ? (
                <ul className="mt-1 list-disc pl-4 text-sm text-black dark:text-zinc-50">
                  {problems.map((dx, i) => (
                    <li key={dx.code ?? i}>
                      {dx.description ?? dx.code ?? "Unlabeled problem"}
                    </li>
                  ))}
                </ul>
              ) : problemsStatus === "loading" ? (
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
              ) : problemsStatus === "unsupported" ? (
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Not supported via Entity API on this EHR.
                </p>
              ) : problemsStatus === "error" ? (
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Failed to load.
                </p>
              ) : (
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  No active problems on file.
                </p>
              )}
            </div>

            <div className={cardClasses("neutral")}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Propose encounter update
              </h2>
              <button
                type="button"
                onClick={() => {
                  void handleProposeUpdate();
                }}
                disabled={writeInProgress}
                className={`${BUTTON_BASE} mt-2 border border-zinc-300 bg-white text-black hover:bg-zinc-100 active:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800 dark:active:bg-zinc-700`}
              >
                {writeInProgress ? "Working…" : "Propose assessment note"}
              </button>
              {writeMessage && (
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {writeMessage}
                </p>
              )}
            </div>
          </section>
        )}

        <PayloadDropdown
          title="Read Payloads"
          entries={readPayloads}
          selectedIndex={selectedReadIndex}
          onSelect={setSelectedReadIndex}
          emptyMessage="No read payloads captured yet."
        />
        <PayloadDropdown
          title="Write Payloads"
          entries={writePayloads}
          selectedIndex={selectedWriteIndex}
          onSelect={setSelectedWriteIndex}
          emptyMessage="No write/update calls have been made by this app yet."
        />
      </main>
    </div>
  );
}