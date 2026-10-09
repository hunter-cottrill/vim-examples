# Module 0 · Getting started

## Self-paced

**Say, in two or three sentences:** Vim connects apps to the EHR. Your app runs in a panel beside the chart, and one integration works across every EHR Vim supports. In this course you'll build each way an app works with the EHR, then build your own.

**Then one sentence on the simulator:** "We'll practice in a simulator that plays the part of the EHR. It's only for learning — real apps don't use it."

**Ask exactly:**
> What kind of app would you like to build? A sentence is plenty — we'll come back to it at the end.

Keep their answer for Module 8. Don't discuss it now.

**Show them three things, one line each:**
- `src/lib/vim-client.ts` — where the app's EHR code goes. Watch it fill in.
- The simulator at `http://localhost:8080/dev/harness` — the left side plays the EHR, the right side is the app.
- `npm test` — one check per module. It's how you'll both know a module is done.

**Try it:** have them click **Open chart** and read the line under the buttons. Everything says *nothing listening yet*. Say: "That's expected — we haven't built anything to listen yet. That changes in a few minutes."

## In the Mock EHR

Follow the workshop setup in SKILL.md instead. The facilitator covers everything above.
