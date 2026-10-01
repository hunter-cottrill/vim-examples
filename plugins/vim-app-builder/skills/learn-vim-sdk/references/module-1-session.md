# Module 1 · Starting a session

## Why it matters

This is the handshake that lets the app act on the provider's behalf, inside their EHR. Vim handles sign-in, so the app never sees the provider's EHR credentials — it receives a token scoped to this session.

**Learner writes this.** It's short, and it's worth writing one SDK call by hand. Offer it; accept "just build it".

## Predict

> After sign-in, the app holds an access token. What does it need to do with it before it can read anything — and is there anything it should tell Vim Connect?

### Answer key

- **Credit fully:** start an SDK session with the token, and tell Vim Connect the app is ready.
- **Credit partly:** "use the token to call the API" — right idea; the token starts a session, and the session is what makes calls.
- **Then add:** until the app says it's ready, the panel treats it as still loading.

## Build

`connectToVim(accessToken)`.

Reference implementation — Verified against `@vimconnect/app-sdk` 0.4.56. Build toward it in small steps; don't paste it wholesale.

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

Point at two lines. The first, `if (SIM_MODE) return;`, is the simulator seam: in the simulator there's no session, so the function returns early. `setActivationStatus('ENABLED')` is the "I'm ready" signal.

## Check

`npm test` — the Module 1 check should pass, and the panel's Module 1 card changes to "Built". That's all the simulator can prove. The real session only runs when they go live, in Module 7.

## Break

Open `src/app/app/page.tsx` together and trace `connect`. The sign-in code arrives from Vim, its state is checked, the app's server exchanges the code for a token, and only then does `connectToVim` run.

Ask: *why does the exchange happen on the server?*

- **Credit fully:** it uses the client secret, which must never reach the browser.
- **Credit partly:** "security" or "to keep it hidden" — right instinct; name the specific thing being protected, the client secret.

## Your app

> What would your app do in the first second after it starts — what would the provider see while it loads?

## Under the hood — only if asked

The token exchange is a standard OAuth authorization-code flow. The CSRF check stops another site from injecting a sign-in. Authorization codes are single-use, and there's no refresh flow: each launch signs in again.

## Takeaway

The app starts a session with its token, and tells the hub it's ready.
