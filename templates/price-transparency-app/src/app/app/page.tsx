"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { initVimSDK, type VimSDK } from "@vimconnect/app-sdk";
import { ErrorScreen } from "@/components/ErrorScreen";
import { PriceTransparencyView } from "@/components/PriceTransparencyView";
import { getEnvironment } from "@/lib/sdk-config";

type ErrorDetail = {
  message: string;
  code: string | undefined;
  timestamp: string;
  userAgent: string;
};

/**
 * Main App Page Content - OAuth Callback + Price Transparency UI
 */
function AppPageContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "connected" | "error">(
    "loading",
  );
  const [error, setError] = useState<ErrorDetail | null>(null);
  const [vimSDK, setVimSDK] = useState<VimSDK | null>(null);

  // Prevent duplicate initialization
  const initializingRef = useRef(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current || initializingRef.current) {
      return;
    }
    initializingRef.current = true;
    initializeApp();
  }, []);

  async function initializeApp() {
    try {
      const code = searchParams.get("code");
      const stateParam = searchParams.get("state");

      if (!code || !stateParam) {
        throw new Error("Missing OAuth parameters");
      }

      // Validate CSRF state
      const [launchId, csrfToken] = stateParam.split(":");
      if (!launchId || !csrfToken) {
        throw new Error("Invalid state parameter format");
      }
      const flowKey = `oauth_state_${launchId}`;
      const storedToken = sessionStorage.getItem(flowKey);
      if (csrfToken !== storedToken) {
        throw new Error("CSRF validation failed");
      }
      sessionStorage.removeItem(flowKey);

      initializedRef.current = true;

      // Initialize SDK via workspace import (typed). Build-once, run-anywhere:
      // the core-sdk host is decided at runtime by origin. We only nudge the SDK
      // to the staging host when THIS app is itself running in staging, so the
      // staging deploy actually exercises the workspace SDK. `__overrideEnv` is a
      // runtime-only param (not in the public SDKInitOptions type) — hence the cast.
      const sdk = await initVimSDK({
        debug: true,
        ...(getEnvironment() === "staging" ? { __overrideEnv: "staging" } : {}),
      } as Parameters<typeof initVimSDK>[0] & { __overrideEnv?: "staging" });

      setVimSDK(sdk);
      setStatus("connected");

      // Dev-only escape hatch: lets you call sdk.ehr.* directly from the
      // DevTools console attached to this iframe, for live debugging against
      // whatever EHR/sandbox this connection is against. Never exposed in
      // production.
      if (getEnvironment() !== "production") {
        (window as unknown as { __vimSdk?: VimSDK }).__vimSdk = sdk;
      }
    } catch (err: any) {
      console.error("Initialization error:", err);
      setError({
        message: err.message ?? "Unknown error",
        code: err.code,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
      });
      setStatus("error");
      initializedRef.current = false;
    } finally {
      initializingRef.current = false;
    }
  }

  if (status === "loading") {
    return (
      <div className="loading-container">
        <div className="loading-content">
          <div className="spinner" style={{ margin: "0 auto 16px" }} />
          <p style={{ color: "var(--color-text-muted)" }}>
            Connecting to Vim...
          </p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    /*
     * UX split: show a friendly message for end users (providers/patients)
     * who should never see raw SDK internals. Technical details live behind
     * "Show Diagnostics" so developers can expand and copy them into bug
     * reports. Copy this pattern in production apps — never surface raw SDK
     * error messages directly to end users.
     */
    return (
      <ErrorScreen
        heading="Connection Error"
        message="Something went wrong. Press retry to reload the application."
        diagnostics={[
          { label: "Error:", value: error?.message ?? "Unknown error" },
          { label: "Code:", value: error?.code ?? "N/A" },
          { label: "Time:", value: error?.timestamp ?? "N/A" },
          { label: "Browser:", value: error?.userAgent ?? "N/A" },
        ]}
        retry={{
          label: "Retry",
          onClick: () => window.location.reload(),
        }}
      />
    );
  }

  if (!vimSDK) return null;
  return <PriceTransparencyView sdk={vimSDK} />;
}

/**
 * Main App Page with Suspense boundary
 */
export default function AppPage() {
  return (
    <Suspense
      fallback={
        <div className="loading-container">
          <div className="loading-content">
            <div className="spinner" style={{ margin: "0 auto 16px" }} />
            <p style={{ color: "var(--color-text-muted)" }}>Loading...</p>
          </div>
        </div>
      }
    >
      <AppPageContent />
    </Suspense>
  );
}
