# AX-Channels — Client Acquisition Engine (CAE) V3

A React + TypeScript client acquisition workspace, built from the Claude Design prototype
`project/CAE V2.5.1.dc.html` and hardened for real use. The design hand-off bundle is kept for
reference: `HANDOFF.md`, `chats/` (the design conversation) and `project/` (the prototypes and data).
The audit that drove the V3 rework is in `docs/AUDIT.md`.

## Run

```bash
npm install
npm run dev               # http://localhost:5173
npm run build             # strict type-check + production bundle in dist/
npm run build:standalone  # one self-contained, offline HTML file: CAE-V3-standalone.html
```

The standalone file opens straight from disk (`file://`) — no npm, no server. Its JavaScript, CSS and
font are inlined.

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

### Connect live research

1. Start the reference proxy (Node 18+, no dependencies) on a machine with internet access:

   ```bash
   node server/research-proxy.mjs                       # http://localhost:8787/research
   PORT=9000 ALLOWED_ORIGIN=https://cae.example node server/research-proxy.mjs
   ```

   It fetches the home page plus up to three About / Services / Contact pages, respects robots.txt,
   blocks private and internal addresses (SSRF protection), rate-limits requests, and returns only what
   the pages say: JSON-LD organisation data, meta description, social and contact links, and site
   signals (viewport, copyright year). Every fact carries its source URL and a supporting quote.
   Optional variable: `PAGE_TIMEOUT_MS` (default 12000).
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

- Settings → QA → **Run self-test**: 56 checks on an isolated workspace (the live workspace is
  verified untouched afterwards).
- Browser journey (Playwright): first run → proxy research with sources → assessments → opportunity
  → decision-maker → strategy → message → approve → mark sent → one follow-up task → reply →
  discovery → proposal → Won → client; plus the failure path (DNS failure, refused Observed
  assessment, manual fallback, invalid domain). 33/33 pass.
- Every screen and workspace section renders without console errors at 390, 820 and 1440 px wide.
