# vim-app-builder

Build a Vim Connect app — an app that runs inside an EHR and reacts to clinical workflow
events — without leaving your coding agent.

Two paths, depending on where you're starting:

| You have | Use | What it does |
|---|---|---|
| An app already, or one on Vim's older SDK | `/vim-app-builder:add-vim-sdk` | Reads your codebase and adds the Vim layer around it — launch flow, SDK client boundary, context reads, testing seam. Doesn't restructure your app. |
| Nothing yet | `/vim-app-builder:new-vim-app` | Scaffolds from a working template based on a short description of what you want. |

Either command is optional — both skills trigger on their own if you just describe what
you're doing.

## Install

```
/plugin marketplace add hunter-cottrill/vim-examples
/plugin install vim-app-builder@vim-examples
```

Restart your agent. Works in Claude Code, the VS Code and JetBrains extensions, and the
desktop app.

## What you get

The agent reads the live Vim SDK reference and the verified notes in
[`docs/vim-sdk-notes.md`](https://github.com/hunter-cottrill/vim-examples/blob/main/docs/vim-sdk-notes.md),
asks a few scoping questions with its own answers proposed, writes a plan, and builds it.

It carries the things that are easy to get wrong and hard to debug: workflow events are
one-shot so present-state has to come from the context keys, there's no teardown event and
both patient context keys have to be watched, capability is declared at runtime rather than
compiled in, and an exception inside an SDK callback is swallowed silently.

You end up with something runnable against fixtures with no EHR provisioned. Registering the
app in Vim Console and testing against a live EHR are human steps, and the plan labels them
as handoffs rather than guessing at credentials.

## Scope

This gets you to a working, demoable app — not a production deployment. Deployment,
security review, and marketplace submission are yours.

## Beta

Early and running from this repo rather than Vim's own marketplace. Rough edges are
expected; feedback is welcome and more useful than politeness.

## Related

- **Templates** —
  [`templates/`](https://github.com/hunter-cottrill/vim-examples/tree/main/templates), nine
  working apps covering chart-open, referral, and order triggers. The plugin scaffolds from
  these; you can also clone one directly.
- **Vim SDK docs** — https://developer-docs.getvim.ai/docs/
- **The SDK's own docs skill** — ships with `@vimconnect/app-sdk` and points your agent at
  the live reference. Complementary to this plugin: that one helps an agent write correct
  SDK calls, this one carries the procedure for putting them together.

## For maintainers

The template list is fetched at runtime from `templates/manifest.json`, not bundled here —
installed plugins are copied to a cache and would go stale. A new template appears with no
plugin update.

`.claude-plugin/marketplace.json` at the repo root exists so this can be installed from here
during beta. Remove it when the plugin moves into Vim's marketplace, so this repo stops
registering as a competing one.
