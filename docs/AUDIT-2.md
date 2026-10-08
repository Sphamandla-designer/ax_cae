# CAE V3 — feature-by-feature production audit (08 Oct 2026)

Scope: every screen, every workspace step, every modal, the domain rules behind them, and every
number shown. Method:

1. Five code reviews, each tracing every button, number and record change end to end: Dashboard/Queue/Tasks,
   Prospects/Pipeline/Opportunities/Clients/Campaigns, Outreach/Analytics/Templates, domain rules,
   and the prospect workspace with its modals.
2. A click crawler that presses every control on every screen and workspace step from the same saved
   state and records what changed (screen, stored data, dialog, error).
3. A metric check that recomputes every headline number from the stored records and compares it with
   the screen (demo workspace and a live journey workspace).
4. Browser tests for each fixed flow, plus the existing suites.

## What was wrong and is now fixed

### Tracking that did not match reality
| Problem | Effect before | Now |
| --- | --- | --- |
| Ticking a follow-up task | Task disappeared; the follow-up stayed "due" everywhere else | A follow-up task completes only when the next touch is marked sent, or skipped. Ticking it opens the Follow-up step |
| "+3d" on a follow-up task | Moved the task, not the follow-up | Moves both |
| Sending any message | Silently closed the "Schedule discovery" task created by a reply | Reply tasks stay open until their record exists (a meeting booked) |
| Reply on an earlier touch | The later touch stayed "due" | A reply on any touch ends the cadence for that prospect |
| Changing a recorded reply | Old task stayed, or a duplicate was created; "No response" did not restore the cadence | The reply task is updated. Un-recording a reply restores the follow-up |
| Drafts prepared ahead | Both became touch 1, so the cadence never completed | The touch number is set when the message is sent |
| Meetings | Not in Tasks; the Meetings KPI opened an unrelated list | Each scheduled meeting has a task. It closes when the meeting is recorded or cancelled |
| Recording discovery while a meeting was scheduled | Created a second meeting | Records the scheduled one |
| Marking a new decision-maker | The old one stayed. Messages still defaulted to the old one | One decision-maker per prospect |
| Composer recipient change | Greeting kept the old name | The message regenerates for the new recipient (asks first if edited) |
| Prospects never reached "Qualified" | No action set the stage | A prospect moves to Qualified when it becomes outreach-ready |

### Wrong or misleading numbers
| Problem | Now |
| --- | --- |
| Draft proposals counted in open and weighted pipeline | Only sent, undecided proposals of active prospects count |
| Lost or won prospects' proposals stayed "open"; won deals counted twice | Recording the outcome settles the proposals: winner Accepted, the rest Rejected |
| Expired proposals vanished from alerts | Shown as "Proposal expired" |
| Card value ≠ column total; Won column showed estimates | One value rule everywhere. The Won column shows the value actually won |
| Reply rate per message ("Replied" counted as positive) | Per prospect contacted. Positive = Positive / Meeting booked |
| "Best" industry, campaign or channel from 1 data point | Needs 3+ closed deals or messages, otherwise "Insufficient data" |
| Funnel dropped every Lost prospect after step 1 | Each prospect counts for the furthest stage its records prove |
| Qualified KPI ≠ the list it opened; daily "Qualified" counted any stage change | Same definition both sides. Daily count = moved to Qualified today |
| Bell counted each overdue follow-up twice | Counted once |
| "Overdue" next actions while you were simply waiting | Waiting actions carry their real date (follow-up, meeting, re-entry) or none |
| Stalled flag while following the cadence | Stall counts days without contact, not only days in a stage |
| Total potential included closed prospects | Active prospects only |
| Opportunity budget score fixed at 3 | Entered as "Budget fit" |
| "180.000" saved as R180 | Saved as R180 000 |
| Campaigns empty in the live workspace | Built from the campaign names on your prospects |

### Dead ends and wrong guidance
- A Lost prospect could never come back. It can now be reopened (Won / Lost → Reopen prospect); the
  old outcome is kept as history.
- A failed or pending research refresh re-locked a deal in Proposal. Completed research now stays
  in force until a newer version is completed.
- Next best action now handles a rejected proposal, an expired proposal, a reply superseded by a later
  message, a new decision-maker after "Wrong person", a Neutral reply, and four touches with no reply.
- Pipeline drag moved stages without the records behind them. Forward moves now need the record (for
  example a sent proposal). Closed cards say how to reopen.
- Old scheduled meetings were imported as "held". They now stay scheduled until you record them.

### Content and safety
- Message templates claimed things no record supports ("we recently helped a similar business…",
  "growing fast", "we've shipped two similar projects"). They were rewritten with placeholders only.
- Deleting a prospect now warns when a client or outcome record (and its revenue) will be removed.
- Notes typed just before switching step are saved.
- One-click actions that failed silently now show the reason.
- A stale error notice no longer lingers after a later action succeeds.
- The demo banner's "Switch to your live workspace" now switches (it only opened Settings).
- Dates in next-action reasons, the activity log and meeting tasks read DD MMM YYYY. Done tasks show
  when they were done; done and meeting tasks no longer offer "+3d".

## Evidence

- In-app self-test: 77/77 (Settings → QA). It now includes a check for each fix above.
- Metric check: 42/42 headline numbers match an independent recomputation, on the demo data and
  on a live journey.
- Fixed-flow browser tests: 12/12. Journey: 33/33. Workflow, persistence, isolation and integrity: 58/58.
  Research cases: all 19 behave as specified.
- Responsive: phone, tablet and desktop, with no console errors; Escape closes dialogs and returns focus.
- Click crawl: 3 306 clicks. That covers every control on all 12 screens (336 clicks) and every control in all 13 steps for 8
  demo prospects at every stage, from New to Won and Lost (2 970 clicks). There were no page or console errors.
  Controls with no visible effect were reviewed one by one. All were the tab, filter, score or radio that was already
  selected, a button disabled for a stated reason ("Create proposal" with no opportunity), or an external link. The
  one real dead control, the demo banner link, is fixed.

## Still true (unchanged limits)

- Automated research has only been validated against local test sites. The sandbox used for testing
  blocks the internet. Manual research works without it.
- Data lives in this browser's storage. Export regularly (Settings → Export).
- The CAE never sends anything. You send from your own email or LinkedIn, then press Mark as sent.
