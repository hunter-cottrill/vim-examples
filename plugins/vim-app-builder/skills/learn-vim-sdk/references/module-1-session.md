# Module 1 · Starting a session

**Goal:** understand how an app goes from "launched" to "talking to the EHR".

**Learner writes this.** It's short, and it's worth having written one SDK call by hand before the agent writes the rest. Offer it; accept "just build it".

## Predict

> After the OAuth flow, the app holds an access token. What do you think it needs to do with it before it can read anything from the EHR — and is there anything it needs to tell Vim Connect?

## Build

`connectToVim(accessToken)`. Two calls: start the session, then tell the hub the app is ready. In the simulator there's no session, so it returns immediately.

**Reference implementation** — verified against `@vimconnect/app-sdk` 0.4.56. Build toward this in small steps and explain as you go; don't paste it wholesale.

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

Explain `setActivationStatus('ENABLED')`: until the app calls it, the Vim Connect panel treats the app as still loading.

## Check

Module 1 has no simulator check — in the simulator, `connectToVim` returns before doing anything. It gets verified for real in Module 7, when it runs against the sandbox. Say this plainly: some things only a live environment can prove.

## Break

Nothing to break in the simulator yet. Instead, trace the flow: open `src/app/app/page.tsx` and walk through the `connect` function with them. The code arrives from Vim, its CSRF state is checked, the server exchanges it for a token, and only then does `connectToVim` run.

Ask: *why does the token exchange happen on the server?* Because it uses the client secret, which must never reach the browser.

## Takeaway

A session starts with the access token, and the app must tell the hub it's ready.
