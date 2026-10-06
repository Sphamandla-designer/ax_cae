# AX-Channels — Client Acquisition Engine (CAE) V2.5.1

A React + TypeScript implementation of the Claude Design prototype `project/CAE V2.5.1.dc.html`
(the workflow and clickability release of the CAE). The design hand-off bundle is kept for reference:
`HANDOFF.md`, `chats/` (the design conversation) and `project/` (the prototypes and data).

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production bundle in dist/
npm run preview    # serve the production bundle
```

## How it is put together

| Path | What it holds |
| --- | --- |
| `src/App.tsx` | The controller: state, record mutators, and the engines from the design (acquisition score, action readiness, next best action, 13-stage workflow, stall detection). `renderVals()` builds the view model. |
| `src/views/` | One component per screen, section and modal. The markup was converted 1:1 from the design (`scripts/convert-design.py`) and is maintained by hand from here on. |
| `src/data/demo-*.ts` | The design's demo dataset, layered V1 → V2 → V2.5 as in the prototype. |
| `src/data/seed.ts` | Builds the demo workspace for today's date and the empty workspace. |
| `src/lib/storage.ts` | Saves the workspace to `localStorage` (key `ax-cae:v2.5.1`). |
| `src/styles/` | Global styles and the design's hover states. |

### Data

- The workspace is saved in the browser after every change, so it survives a reload.
- The demo dataset was written around 9 Aug 2026. When it loads, every date in it moves by the same
  offset to today, so follow-ups, stalls and expiries look the way the design intended.
- Settings → **Reset** restores the demo. Settings → **Remove demo data** starts an empty workspace
  for real prospects; the sidebar badge then reads "Live workspace".

## Changes from the prototype

The screens match the prototype pixel for pixel: an automated screenshot diff found 0 differing pixels
across all 12 views and all 13 workspace stages for 5 prospects. Behaviour follows the V2.5 / V2.5.1
briefs in `chats/`, and these prototype bugs were fixed:

- **New prospects stayed blocked.** A new prospect was marked *NOT READY: Insufficient research*, and
  nothing ever cleared it. A not-ready reason now clears itself when its gap is filled (research
  completed, decision-maker identified, opportunity recorded).
- **Approve & send skipped the readiness check.** It now asks for confirmation and lists what is
  missing, like the existing override.
- **The wrong message was logged.** The outreach record stored a placeholder instead of the message
  that was approved. Copy also ignored edits. Both now use the text you see.
- **Mark done could mark a step done without its record.** It now records the real-world actions
  (send a draft, complete a follow-up, follow up on a proposal, convert a client). For steps that need
  data, it opens the right form and says what is missing.
- **Next best action routing.** The Next best action button, the stall banner and every "Do it →" /
  queue / list action open the matching section, with its form already open when the step needs data.
  Before, follow-up, discovery and proposal actions all landed on the generic outreach section, and
  research landed on Company.
- **Fix-it buttons in the readiness card only navigated.** The "Missing: …" buttons now open the form
  that fills the gap (decision-maker, assessment, opportunity, strategy, research). The missing-channel
  item no longer shows a mislabelled "Complete research" button.
- **Contacts could not be edited.** Contact cards now have **Edit**, as the V2.5.1 brief requires (§13).
  Without it, a decision-maker with no preferred channel could never reach 100% readiness.
- **The logged next action went stale.** It stayed at "Research company" after later steps were done.
  It now moves on as research, assessment, opportunity, decision-maker and strategy are saved.
- **Closing a deal skipped the outcome form.** Choosing Won or Lost from the stage menu, or dragging a
  card into those pipeline columns, now opens the outcome form (lost reason or won value), so every
  closed prospect gets an outcome record.
- **Opening a prospect kept the previous one's state.** It used to keep the previous prospect's
  workspace section and half-filled form. Every prospect now opens clean.
- **Stall detection.** Pipeline drag-and-drop now restarts the stall clock. Marking outreach sent
  restarts it only when the stage actually changes.
- **Follow-ups from the Outreach screen** now behave like the ones in the prospect workspace: they
  close the follow-up task, log activity and set the next action.
- **Dates.** "Today" is the local calendar date (the prototype used UTC), and it rolls over at
  midnight. Date arithmetic no longer drifts across time zones. Hard-coded demo dates are gone:
  "proposal expires" uses today + 7 days, and the discovery date is a date picker that rejects
  invalid input.
- **Settings → Workflow test** now works under React's batched updates (every step committed
  before it is checked).
- **Smaller fixes.** New-prospect contacts get the full decision-maker fields. The "what predicts a
  win" threshold now matches its own message (≥3 won and ≥3 lost). Every record has a unique id.
