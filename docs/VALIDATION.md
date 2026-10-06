# CAE V3 — final production validation (06 Oct 2026)

## Limits of this validation

**Real internet research could not be validated in this environment.** The test sandbox's network
policy refuses connections to every external website (HTTP 403 from the egress proxy for example.com,
python.org, capitec.co.za, discovery.co.za and shopify.com). The research proxy was therefore tested
against fixture websites served on a non-private address (192.0.2.2:80) with hostnames resolved through
`/etc/hosts`. The proxy ran in its production configuration: no `ALLOW_PRIVATE`, no `HOST_OVERRIDES`,
default bind address. Real-world behaviour still has to be confirmed by the user against real
company websites. Things the fixtures cannot reproduce include real TLS, CDNs and bot walls, cookie
banners, non-UTF-8 pages and very large sites.

## 1–2. Research cases (proxy in production mode, driven through the CAE UI)

| Case | Site | Result code | Facts stored | Sources | retrievedAt | UI shows | Research step | Complete attempt |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A valid | full site + JSON-LD + about/services | success | 11, all Observed, each with source | 4 | yes | Automated · Draft, per-fact source/time/quote | In progress until you complete it | allowed |
| B invalid domain | `acme..test`, `not a website` | refused by the form | — | — | — | "is not a valid domain" / "cannot contain spaces" | prospect not saved | — |
| C unreachable | non-resolving domain | DNS_FAILURE | 0 | 0 | — | "Research unavailable — Domain not found … No research was added" | In progress | blocked, lists what is missing |
| D timeout | never answers | TIMEOUT (≈5 s with a 4 s page limit) | 0 | 0 | — | "Research timed out" + Retry | In progress | blocked |
| E HTTP error | 500 / 404 / 403 | HTTP_ERROR / HTTP_ERROR / BLOCKED | 0 | 0 | — | "Website returned an error" / "Automated access refused" | In progress | blocked |
| F JS-heavy | empty SPA shell | JS_ONLY | 0 | 0 | — | "Website needs JavaScript" | In progress | blocked |
| G JSON-LD | JSON-LD + JS bundle, no body text | success, **partial** | 6 Observed | 2 | yes | "Partial research" + PARTIAL badge + reason | In progress | allowed (description is sourced) |
| H empty | `<body></body>` / "Under construction" | EMPTY_RESULT | 0 | 0 | — | "Nothing found" | In progress | blocked |
| I partial | title, social and phone links, no description | success, **partial** | 6 | 1 | yes | "Partial research — No company description was published" | In progress | blocked: description missing |
| J provider down | closed port | NETWORK_ERROR | 0 | 0 | — | "Research service unreachable … Check the endpoint in Settings" + Retry | In progress | blocked |
| K malformed | HTML body / wrong JSON shape / HTTP 500 | MALFORMED_RESPONSE ×2 / PROVIDER_ERROR | 0 | 0 | — | "Unreadable research response" / "Research provider error" | In progress | blocked |
| K facts without source | provider omits `source` | success | 3, all downgraded to **Assumption** | 1 | yes | "Source: none given by Fake — treated as an assumption" | In progress | **blocked**: "A source for the company description, or your confirmation" |
| robots.txt disallow | `Disallow: /` | BLOCKED | 0 | 0 | — | "Automated access refused" | In progress | blocked |

In every failure case the failure is stored on the research record with its code and time, the
activity log records it, and the research history keeps it.

## 13. Proxy security (production mode)

| Attempt | Result |
| --- | --- |
| Site redirects to `http://127.0.0.1:8901/` | BLOCKED (the redirect hop is checked). **The previously committed proxy followed this redirect and returned the internal page as research. Fixed.** |
| Site redirects to a host resolving to 169.254.169.254 | BLOCKED |
| Domain resolving to 127.0.0.1 / 169.254.169.254 | BLOCKED |
| `127.0.0.1`, `localhost`, `[::1]`, `2130706433`, `0x7f.1`, metadata IP URL | INVALID_DOMAIN |
| Port 22, `user:pw@host`, `file://`, `gopher://` | BLOCKED / INVALID_DOMAIN |
| Malformed JSON, `[]`, `{"website":42}`, wrong content type, GET | 400 / 400 / 400 / 415 / 404 with typed errors |
| 20 kB request body | 413 |
| 25 requests in a burst | 17 answered, then 429 RATE_LIMITED |
| `ALLOWED_ORIGIN=https://cae.example,null`, request from `https://evil.example` | 403. Allowed origins get their own origin echoed in CORS. |
| 20 MB streaming page | read capped at 1.5 MB, still answered |
| Listen address | 127.0.0.1 by default (was all interfaces) |
| Frontend | no keys in source or the built HTML; Settings reject endpoints containing key/secret/token and non-https remote URLs; localStorage holds no secrets |

## 4–10. Workflow, generation, isolation, persistence, integrity — 58/58 checks pass

- **No invented content.** For a sparse prospect, all four message types return *"Insufficient verified
  information to personalize this message."* with what is missing; approving an empty message is
  refused and nothing is recorded. An Indicated finding is written as "it looks like there may be …",
  never "I noticed". Generated text was scanned for revenue, staff, funding, awards, partnerships,
  launches, growth, customers and tech-stack claims: none.
- **Dependencies.** The following are refused with an explanation: completing research before it
  exists, an Observed assessment without a source, an assessment without evidence, an incomplete
  opportunity, a strategy without a value proposition, angle or channel, discovery without
  notes/pain points, a proposal without scope, and a Won outcome without a reason. A contact does not
  become the decision-maker until you mark them.
- **Next best action** checked at every stage, each after a reload. It never repeats a completed action. Fixed:
  after research was retrieved it still said "Research company"; it now says "Review and complete
  research".
- **Outreach truth.** Generating or copying records nothing. A saved draft is Draft, an approved
  message is Approved and a scheduled one is Scheduled, with no send time and no follow-up task. Only
  **Mark as sent** sets the send time, channel, message, purpose and touch, and creates exactly one
  follow-up task, still one after a reload. Sending touch 2 closes touch 1's task.
- **Live vs demo.** A prospect added and researched in the demo workspace is DEMO-labelled and
  never appears in the live workspace. None of the 10 live screens shows a demo company or DEMO label.
  Live analytics count only live outcomes. All of this holds after a reload.
- **Persistence.** Every record type survives a reload: company, research and its history, assessments,
  opportunity, contact, strategy, outreach, tasks, meeting, proposal, outcome, client and activity.
  Corrupted storage shows the recovery screen and is not overwritten. Raw export downloads the
  unreadable data, reset asks for confirmation (cancelling keeps the data), and restoring the backup
  brings the workspace back.
- **Integrity.** No orphans, duplicate IDs, null keys, NaN, duplicate contacts, duplicate activities or
  duplicate open follow-ups. `isDemo` always matches the workspace. Diagnostics report Clean, and detect and
  repair an injected orphan.

Regression suites after the fixes: in-app self-test 56/56, browser journey 33/33, smoke test (every
view × 13 sections × 4 demo prospects) with no console errors, and no horizontal overflow on 11 screens at
390/820/1440 px. The standalone file was checked from file://: offline it passes the self-test 56/56
with no external requests; with the proxy configured it retrieves sourced research.
