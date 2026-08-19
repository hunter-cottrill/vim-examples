"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  initWorkerVimSDK,
  type Diagnosis,
  type Encounter,
  type WorkerContextHandle,
} from "@vimconnect/app-sdk";
import { evaluateCds } from "@/lib/cds/engine";
import type { ModuleContext } from "@/lib/cds/modules/types";

const AUTH_BASE =
  process.env.NEXT_PUBLIC_ENV === "production"
    ? "https://api.getvim.ai"
    : "https://api.stage.getvim.ai";

type ConnectionStatus = "connecting" | "connected" | "error";

function csrfKey(launchId: string) {
  return `vim_worker_csrf_${launchId}`;
}

// The shape actually delivered to WorkerContextCallback — confirmed
// empirically to be wrapped the same way as the UI's context.onChange
// payload ({ id, type, identifier, fields }), contradicting the SDK's own
// doc comment claiming T is "the projected entity data shape" directly.
// `cc` isn't declared on Encounter at all; it's this EHR's real live field.
type EncounterContextFields = Partial<Encounter> & { cc?: string };

// Builds the CDS engine's ModuleContext from the same flat/nested field
// fallback already validated in the UI app. Patient problems are left empty
// here — this Worker only subscribes to encounter context, and reliably
// sourcing patient.problems would need either an untyped handle.api call or
// a patient-context subscription already shown to be sparse on this EHR; the
// diagnosis-gap module's trigger only needs the encounter itself.
function buildModuleContext(fields: EncounterContextFields): ModuleContext {
  const chiefComplaint = fields.subjective?.chiefComplaintNotes ?? fields.cc;
  const diagnoses: Diagnosis[] | undefined = fields.assessment?.diagnoses?.length
    ? fields.assessment.diagnoses
    : fields.diagnoses;
  // basicInformation.status is declared as "LOCKED" | "UNLOCKED", and the
  // deprecated flat isSigned is declared boolean — but this EHR's real wire
  // value for isSigned has been observed as a string like "signed"/"open"
  // (see app/page.tsx). String()-coerce both before comparing so neither
  // declared type blocks reading whatever's actually on the wire.
  const statusValue = String(fields.basicInformation?.status ?? fields.isSigned ?? "").toLowerCase();
  const isSigned = statusValue === "locked" || statusValue === "signed" || statusValue === "true";

  return {
    chiefComplaint,
    existingDiagnoses: (diagnoses ?? []).map((dx) => dx.code).filter((code): code is string => Boolean(code)),
    existingCpts: (fields.billingInformation?.procedureCodes ?? [])
      .map((cpt) => cpt.code)
      .filter((code): code is string => Boolean(code)),
    dateOfService: fields.basicInformation?.dateOfService ?? fields.dateOfService,
    isSigned,
    problems: [],
  };
}

function WorkerFlow() {
  const searchParams = useSearchParams();
  const initialized = useRef(false);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    let unsubscribeEncounter: (() => void) | undefined;

    async function connectWorker(accessToken?: string, idToken?: string) {
      try {
        const worker = await initWorkerVimSDK({ debug: true, accessToken, idToken });
        setStatus("connected");

        // M4: the observe step moves into the Worker.
        //
        // The SDK's own `fields`/`debounceMs` HookDeclaration options proved
        // unreliable here: a registration using fields:['fields.cc'] +
        // debounceMs:800 never fired on the actual encounter-open event
        // (confirmed via a parallel ungated registration that DID fire
        // immediately with fields.cc populated), and instead fired later —
        // on leaving the encounter — carrying stale internal state. Worth
        // noting the SDK's own doc comment on debounceMs: "Phase 1 —
        // implemented last (Step 10)", consistent with this being a rougher
        // corner of the API. Reimplementing the same intent (only act once
        // meaningful data is present; don't fire on every intermediate
        // tick) directly in the handler instead, since a gate-free
        // registration is what actually delivers fresh data reliably.
        let debounceTimer: ReturnType<typeof setTimeout> | undefined;
        let pendingHandle: { close(): void } | undefined;

        unsubscribeEncounter = worker.ehr.context.register<{
          id?: string;
          fields?: EncounterContextFields;
        }>(
          "encounter_open:encounter",
          // CDS writeback now runs from the UI (Task 5), not via
          // suggestWriteback — only "notify" is needed here.
          { operations: ["notify"] },
          (prev, curr, handle) => {
            console.log("[worker] encounter_open:encounter", prev, curr);

            if (debounceTimer) clearTimeout(debounceTimer);
            pendingHandle?.close();
            pendingHandle = undefined;

            const fields = curr?.fields;
            if (!fields?.cc) {
              // Not meaningful yet, or the encounter left context — nothing
              // to reason about.
              handle.close();
              return;
            }

            pendingHandle = handle;
            const encounterId = curr?.id ?? "unknown";
            debounceTimer = setTimeout(() => {
              void runCdsEngine(fields, encounterId, handle);
              pendingHandle = undefined;
            }, 800);
          }
        );

        // Task 1: assemble the module context, run the CDS engine (gate on
        // each enabled module's trigger, then one batched backend call for
        // whichever fired), and publish the result to workerState. Falls
        // back to the plain M4 "encounter opened" notification when nothing
        // triggers, matching the old evaluateEncounter()'s null-proposal case.
        async function runCdsEngine(
          fields: EncounterContextFields,
          encounterId: string,
          handle: WorkerContextHandle
        ) {
          const ctx = buildModuleContext(fields);
          const payload = await evaluateCds(encounterId, ctx);

          // Re-check validity AFTER the async engine call — if a newer
          // context change superseded this handle while the backend call was
          // in flight, this result is stale and shouldn't be published over
          // whatever the newer invocation is already producing.
          if (!handle.hub?.isValid()) {
            handle.close();
            return;
          }

          if (!payload) {
            // notificationId includes a per-fire timestamp so Vim's Hub
            // never dedupes it — a deliberate testing convenience for a
            // sandbox with a limited pool of encounters to reopen. The
            // "right" production ID is stable per encounter, confirmed via
            // result.status === "deduped"; revert once there's enough
            // sandbox variety to test without it.
            handle.hub.pushNotification.show({
              title: "CarePilot",
              text: `Encounter opened — CC: ${fields.cc ?? "n/a"}`,
              notificationId: `carepilot-encounter-${encounterId}-${Date.now()}`,
              type: "info",
            });
            return;
          }

          worker.workerState.write("carePilotCds", payload);
        }
      } catch (error) {
        console.error("CarePilot Worker: failed to initialize Vim Worker SDK", error);
        setStatus("error");
      }
    }

    async function handleCallback(code: string, state: string) {
      const [stateLaunchId, csrfToken] = state.split(":");
      const storedCsrf = stateLaunchId
        ? sessionStorage.getItem(csrfKey(stateLaunchId))
        : null;

      if (!stateLaunchId || !csrfToken || storedCsrf !== csrfToken) {
        console.error("CarePilot Worker: CSRF validation failed");
        setStatus("error");
        return;
      }
      sessionStorage.removeItem(csrfKey(stateLaunchId));

      const redirectUri = `${window.location.origin}/worker`;
      const response = await fetch("/api/auth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, redirectUri }),
      });

      if (!response.ok) {
        console.error("CarePilot Worker: token exchange failed");
        setStatus("error");
        return;
      }

      const { accessToken, idToken } = await response.json();
      await connectWorker(accessToken, idToken);
    }

    function handleLaunch(launchId: string) {
      const clientId = process.env.NEXT_PUBLIC_CLIENT_ID;
      if (!clientId) {
        console.error("CarePilot Worker: missing NEXT_PUBLIC_CLIENT_ID");
        setStatus("error");
        return;
      }

      const csrfToken = crypto.randomUUID();
      sessionStorage.setItem(csrfKey(launchId), csrfToken);

      const redirectUri = `${window.location.origin}/worker`;
      const authorizeUrl = new URL("/app-auth/authorize", AUTH_BASE);
      authorizeUrl.searchParams.set("response_type", "code");
      authorizeUrl.searchParams.set("launch", launchId);
      authorizeUrl.searchParams.set("client_id", clientId);
      authorizeUrl.searchParams.set("scope", "launch openid");
      authorizeUrl.searchParams.set("state", `${launchId}:${csrfToken}`);
      authorizeUrl.searchParams.set("redirect_uri", redirectUri);

      window.location.assign(authorizeUrl.toString());
    }

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const launchId = searchParams.get("launch_id");

    if (code && state) {
      handleCallback(code, state).catch((error) => {
        console.error("CarePilot Worker: unexpected error during token exchange", error);
        setStatus("error");
      });
    } else if (launchId) {
      handleLaunch(launchId);
    } else {
      // No launch context on the URL — fall back to the SDK's own
      // token_endpoint auto-fetch, in case this document is reloaded
      // outside of a fresh Worker launch.
      connectWorker();
    }

    return () => {
      unsubscribeEncounter?.();
    };
  }, [searchParams]);

  return <p style={{ padding: 24 }}>CarePilot Worker status: {status}</p>;
}

export default function WorkerPage() {
  return (
    <Suspense fallback={<p style={{ padding: 24 }}>Loading…</p>}>
      <WorkerFlow />
    </Suspense>
  );
}