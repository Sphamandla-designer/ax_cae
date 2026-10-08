# AX-Channels — Client Acquisition Engine (CAE) V3

A React + TypeScript client acquisition workspace, built from the Claude Design prototype
`project/CAE V2.5.1.dc.html` and hardened for real use. The design hand-off bundle is kept for
reference: `HANDOFF.md`, `chats/` (the design conversation) and `project/` (the prototypes and data).
The audit that drove the V3 rework is in `docs/AUDIT.md`; the feature-by-feature production audit
is in `docs/AUDIT-2.md`.

## Run

```bash
npm install
npm run dev               # http://localhost:5173
npm run build             # strict type-check + production bundle in dist/
npm run build:standalone  # one self-contained, offline HTML file: CAE-V3-standalone.html
```

The standalone file opens straight from disk (`file://`) — no npm, no server. Its JavaScript, CSS and
font are inlined.

## Design system

The CAE uses the AX-Channels design system from the website (`axchannels`, `assets/css/home.css`):
Archivo for text and JetBrains Mono for uppercase captions, ink `#0a0a0a` on white, the magenta accent
`#e0176b` (`#ff3d8a` on dark), a cyan glow on primary-button hover, pill buttons, 8–12 px cards and
dark panels lit with the hero's teal and magenta glow. Amber (`#9a6200`) is kept only for states that
need attention (due today, indicated, in progress); green and red keep their meaning. Tokens live in
`src/views/ui.tsx` (`C`) and `src/styles/global.css` (`--ax-*`); the AX mark is inlined from
`src/assets/ax-mark-reversed.png`.

## Using it day to day

1. **Dashboard → Today’s Acquisition Plan.** Work the tabs: Follow up now, Contact now, Prepare now,
   Research now. Every row's button opens the exact step that needs doing.
2. **Add a prospect** (+ Add prospect): company name and website are enough to start.
3. **Work the 13 steps** in the prospect workspace. The dark "Next best action" bar always names the
   first thing still missing, and each step says what it needs before it counts as complete.
4. **Outreach:** prepare the message (built only from your records), approve it, send it from your own
   email or LinkedIn, then press **Mark as sent**. That creates the follow-up task for the next touch.
5. **When they reply:** Response → Record response. Positive → schedule discovery (it appears in
   Tasks); record the meeting once it has happened; create and send the proposal; record Won or Lost.
6. **Tasks:** ordinary tasks tick off. Follow-up and meeting tasks complete themselves when the
   touch is sent or the meeting is recorded; ticking them takes you to that step.
7. **Lost but came back?** Won / Lost → Reopen prospect. **Export** your data weekly (Settings).

## Principles

- **No invented facts.** Every company fact has a source (URL or a named manual source), a retrieval
  date and a confidence level: **Observed** (seen on a source), **Indicated** (inferred from a source)
  or **Assumption**. Missing information stays **Unknown**.
- **Progress comes from records.** Each of the 13 workflow steps is LOCKED, READY, IN PROGRESS,
  COMPLETE or BLOCKED, computed from the saved records. Nothing is "done" because a button was pressed.
- **Messages use recorded data only.** When the records are too thin the generator says
  *"Insufficient verified information to personalize this message."* and lists what is missing.
- **Nothing is sent by the app.** Outreach moves Draft → Approved → (Scheduled) → Sent → Replied;
  only **Mark as sent** records a send, after you have sent it from your own email or LinkedIn.
- **Demo and live never mix.** They are separate workspaces; every demo record is labelled DEMO.

## Research providers

Research runs through one function, `researchCompany({ companyName, website, location })`
(`src/research/provider.ts`), with three modes:

| Mode | What happens |
| --- | --- |
| `manual` (default) | No automated lookup. You enter facts with their sources; research is recorded as *manual*. |
| `proxy` | The browser calls your own backend endpoint, which fetches the company's public website. |
| `api` | Same contract, for a hosted research service you run behind your own endpoint. |

**The frontend never holds API keys.** Settings refuse any endpoint or field that looks like a
key, secret, token or password, and require `https` (except `localhost`). Put provider credentials on
the server, in environment variables.

### Standalone (offline) vs. connected to the research proxy

| | Standalone HTML, no proxy | Connected to the research proxy |
| --- | --- | --- |
| Research screen says | **Automated research unavailable** — Reason: research provider not configured. Action: configure a research provider, or research manually. | **Automated research configured** (availability is checked when you run research) |
| "Research company" button | Not shown | Shown |
| How facts are recorded | You enter them, with source URLs; recorded as *manual* | Retrieved from the company's public pages; each fact keeps its source URL, retrieval time and a quote |
| Everything else (workflow, outreach, follow-ups, pipeline, storage) | Works fully offline | Same |

There is no silent fallback: if the proxy is down or misconfigured, research fails with a named error and
nothing is added.

### Connect live research

1. Start the reference proxy (Node 18+, no dependencies) on a machine with internet access:

   ```bash
   node server/research-proxy.mjs                                   # http://127.0.0.1:8787/research
   ALLOWED_ORIGIN=null node server/research-proxy.mjs               # only the standalone file (file:// sends Origin "null")
   ALLOWED_ORIGIN=https://cae.example PORT=9000 node server/research-proxy.mjs
   ```

   | Variable | Default | Meaning |
   | --- | --- | --- |
   | `PORT` | 8787 | Port |
   | `HOST` | 127.0.0.1 | Listen address. The default accepts requests from this computer only. Use `0.0.0.0` only behind your own authentication. |
   | `ALLOWED_ORIGIN` | `*` | Comma-separated browser origins allowed to call the proxy; others get HTTP 403. `null` = the standalone file. |
   | `PAGE_TIMEOUT_MS` / `TOTAL_TIMEOUT_MS` | 12000 / 20000 | Per-page and whole-run time limits |
   | `ALLOW_PRIVATE`, `HOST_OVERRIDES` | off | **Testing only.** Never set these in real use. |

   What it does: fetches the home page (https, falling back to http once if https is unavailable) plus up to
   three About / Services / Contact pages, honours robots.txt, and returns only what the pages say:
   JSON-LD organisation data, meta description, social and contact links, and site observations
   (https, viewport, copyright year). Every fact carries its source URL, retrieval time and a supporting quote.

   Safety: only public http(s) sites on ports 80/443. Every connection, **including each redirect**, is
   checked after DNS resolution, so loopback, private, link-local, carrier-grade NAT and cloud-metadata
   addresses are refused. IP-address URLs, credentials in URLs and non-web schemes are refused. Limits:
   20 requests per minute per client, 10 kB request bodies, 1.5 MB per page, 5 redirects.
2. Point the CAE at it, either:
   - **Settings → Research provider → Proxy**, endpoint `http://localhost:8787/research`, or
   - edit the `window.CAE_CONFIG` block near the end of the HTML file:

     ```html
     <script>
       window.CAE_CONFIG = {
         researchProvider: { mode: "proxy", endpoint: "http://localhost:8787/research", timeoutMs: 25000 },
       };
     </script>
     ```

   A Settings choice overrides the file.

### Contract

`POST endpoint` with `{ "companyName", "website", "location" }`. Success:

```json
{ "success": true, "provider": "…", "website": "https://…", "retrievedAt": "ISO-8601",
  "facts": { "description": { "value": "…", "source": "https://…", "confidence": "Observed", "quote": "…" } },
  "sources": [{ "url": "https://…", "title": "…", "retrievedAt": "ISO-8601" }],
  "confidence": "Observed", "partial": false }
```

Failure: `{ "success": false, "code": "DNS_FAILURE", "error": "…", "retryable": false }`. Codes:
INVALID_DOMAIN, NOT_CONFIGURED, OFFLINE, NETWORK_ERROR, TIMEOUT, DNS_FAILURE, SITE_UNAVAILABLE,
HTTP_ERROR, BLOCKED, JS_ONLY, RATE_LIMITED, PROVIDER_ERROR, MALFORMED_RESPONSE, EMPTY_RESULT,
UNSAFE_CONFIG. A failure is stored on the research record with its reason and adds no facts. A fact
returned without a source is downgraded to Assumption.

## Data

- Saved in `localStorage` under `CAE_DATA_V3` as a versioned envelope
  (`{ schemaVersion: 3, active, workspaces: { live, demo }, settings }`). The previous good save is kept
  in `CAE_DATA_V3_BACKUP`.
- Data from V2.5.1 (`ax-cae:v2.5.1`) is migrated once. Legacy live research becomes an unverified
  draft, and legacy "Observed" assessments without a source become "Indicated".
- If saved data is unreadable the app does not overwrite it: a recovery screen offers to restore the
  backup, export the raw data, or start over.
- Settings → **Export / Import** (JSON) and **Diagnostics** (record counts, integrity check with orphan
  repair, storage use).

## How it is put together

| Path | What it holds |
| --- | --- |
| `src/App.tsx` | The controller: loads and saves the workspace, applies actions, builds the view model. |
| `src/domain/actions.ts` | Every change as a validated pure function `(db, input, ctx) → { ok, db } \| { ok: false, errors }`. |
| `src/domain/workflow.ts` | Step statuses, readiness, next best action, completeness, stall detection. |
| `src/domain/generate.ts` | The outreach message generator (recorded facts only). |
| `src/domain/integrity.ts` | Relationship and value checks; orphan repair. |
| `src/domain/selftest.ts` | The in-app self-test (Settings → QA). Runs on a temporary workspace. |
| `src/research/provider.ts` | The research provider client. |
| `server/research-proxy.mjs` | The reference research backend. |
| `src/data/` | Types, the V3 migration, and the demo dataset. |
| `src/views/` | Screens, the prospect workspace sections (`workspace/`), modals and UI primitives. |

## QA

The final validation evidence (research cases, security tests, workflow checks) is in `docs/VALIDATION.md`.

- Settings → QA → **Run self-test**: 77 checks on an isolated workspace (the live workspace is
  verified untouched afterwards), including one per fix from the production audit.
- Browser journey (Playwright): first run → proxy research with sources → assessments → opportunity
  → decision-maker → strategy → message → approve → mark sent → one follow-up task → reply →
  discovery → proposal → Won → client; plus the failure path (DNS failure, refused Observed
  assessment, manual fallback, invalid domain). 33/33 pass.
- Every screen and workspace section renders without console errors at 390, 820 and 1440 px wide.
