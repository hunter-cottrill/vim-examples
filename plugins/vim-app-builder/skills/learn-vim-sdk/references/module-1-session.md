# Module 1 · Connecting

A quick module — no question. This code is the same in every app.

**Say:** "Before your app can do anything, it starts a session with Vim using a sign-in token, and tells Vim Connect it's ready. It's the same in every app, so I'll write it and we'll keep moving."

**Build** `connectToVim`. Then one or two sentences: it starts the session and tells Vim the app is ready. In the simulator, there's no session to start, so it returns straight away.

Reference implementation — verified against the SDK version pinned in the reference solution. Build toward it; don't paste it at the learner.

```typescript
// ─── MODULE 1 · Starting a session ──────────────────────────────────────────

/**
 * Start an SDK session with the access token from the OAuth launch flow,
 * then tell the Vim hub the app is ready.
 */
export async function connectToVim(accessToken: string): Promise<void> {
  if (SIM_MODE) return;
  const sdk = await initVimSDK({ accessToken });
  sdk.hub.setActivationStatus('ENABLED');
}
```

**Check:** `npm test` — the Module 1 check should pass.

## In the Mock EHR

Build it without discussion, as part of the workshop setup in SKILL.md.

## Only if asked

Sign-in uses a standard OAuth flow. The app's server swaps a one-time code for the token, because that step uses the app's secret, which must never reach the browser. It's already built into the starter.
