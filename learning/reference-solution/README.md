# Learning path — reference solution

The learning starter with every module built. **This is the answer key — don't hand it to learners.**

It exists for two reasons:

1. **Facilitators.** If a session goes sideways, this is what each module should produce. Diff a learner's `src/lib/vim-client.ts` against this one.
2. **Keeping the course honest.** The `learn-vim-sdk` skill embeds each module's reference code. CI checks that code is identical to the matching section here, and this app is built and tested against every SDK release. If the SDK changes in a way that breaks the course, CI fails here rather than a learner finding out mid-session.

## The rule that keeps it in sync

Apart from `src/lib/vim-client.ts`, this app and `learning/starter/` are identical — same hook, panel, harness, fixtures, and checks. CI enforces that too. To change the course:

- **Changing what a module teaches:** edit the module's section in this `vim-client.ts`, then paste the same block into the matching module file in `plugins/vim-app-builder/skills/learn-vim-sdk/references/`.
- **Changing anything else** — the panel, the harness, a check: make the same change in both apps.

`node learning/check-learning.mjs`, run from the repo root, tells you whether they agree.

## Run it

```bash
npm install
npm test                                  # all 13 checks pass
NEXT_PUBLIC_SIM_MODE=true npm run dev     # http://localhost:8080/dev/harness
```
