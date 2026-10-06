# CAE V2.5.1 — production audit (6 Oct 2026)

Audit of the React port of `CAE V2.5.1.dc.html` (commit `55148fc`) before the V3 hardening.
Categories follow the brief: (1) action changes nothing … (17) workflow impossible to continue.

## Critical

| # | Cat. | Finding |
|---|---|---|
| C1 | 12, 4 | **Corrupt storage = silent data loss.** `load()` returned `null` on any parse error, the app booted the demo and the next save overwrote the user's data. |
| C2 | 7, 3 | **"Research" is a free-text summary.** Any non-empty summary completed Research; no website check, no source, no provenance. `researchOf()` also treated *any* company with a description + website as researched. |
| C3 | 7 | **The outreach generator invents facts** ("for a mining operation your size that usually means…", "we do this kind of work for SA … businesses"). The opportunity brief adds generic claims ("these gaps cost … customer trust"). |
| C4 | 8 | **Demo and live data share one workspace.** New companies are added between demo records; "Remove demo data" kept demo campaigns; new prospects default to industry *Mining* and source *LinkedIn* (invented values). |
| C5 | 3 | **Steps complete without evidence.** Assessment = any 3 scans (evidence defaults to "Not recorded"); Observed can be chosen with no source; Opportunity = any value; Strategy = problem + angle only; Discovery = a *scheduled* meeting whose date has passed; Follow-up = manual stage ≥ Responded; Prioritise = clicking score dots. |
| C6 | 9, 16 | **The workflow self-test writes into the real workspace** with fixed IDs (`o-qa`, `t-qa`…): QA records persist, a second run duplicates IDs, and "Clear test data" leaves orphan activities/meetings/proposals. |
| C7 | 11, 3 | **Follow-up "Complete" records nothing** — it clears the date and closes tasks without a touch, message or channel. |
| C8 | 12 | **Fake success:** "Copied ✓" shows even when the clipboard write fails; storage quota errors are swallowed. |

## High

| # | Cat. | Finding |
|---|---|---|
| H1 | 2 | `contactOf()`/`oppOf()` return the *first* record, not the decision-maker/best opportunity — header, pipeline values, KPIs and brief disagree with the workspace. |
| H2 | 2 | "Record as held" updates the first dated meeting (possibly a different, future one) and overwrites its date. |
| H3 | 2 | Proposals are not linked to an opportunity; value can be non-numeric (`parseInt` fallback). |
| H4 | 16 | Outreach status mixes delivery state with outcome (`Replied`, `No response`, `Positive` are all "status"); Draft → Sent skips approval. |
| H5 | 5 | "Why this prospect?" only exists for demo companies; live prospects show "No intelligence summary" forever. The V1 "digital" table never reflects assessments. |
| H6 | 17 | NOT READY reasons such as *No evidence of need* can never clear except by override. |
| H7 | 16 | No way to delete a prospect; nothing checks orphans or duplicate IDs. |
| H8 | 7 | Digital Experience score averages unassessed dimensions as 50/100. |
| H9 | 14 | Dates render without a year; demo prose dates do not move with the data. |
| H10 | 11 | Signals list says "add one when you spot growth" but there is no way to add one. |
| H11 | 12 | Analytics acceptance rate divides by zero (NaN%) when every proposal is a draft. |

## Medium

- Contact form defaults the role to *Decision Maker* (a contact becomes DM just by being added).
- Strategy can be created before a decision-maker exists; no value proposition or channel.
- Forms accept invalid emails, URLs, dates and negative/NaN values.
- Clickable `div`s are not keyboard-reachable; modals do not close on Escape or restore focus; inputs have no accessible names.
- Fixed 230 px sidebar and fixed multi-column grids overflow on phones.
- Persistence writes the whole workspace on every keystroke-driven state change.
