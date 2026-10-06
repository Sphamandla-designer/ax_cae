# Design system implementation

_Started 2026-08-09 14:40 UTC_

---

## User

Please use the attached doc only to extract the design system and implement it to this system

## Assistant

_[tool: read_skill_prompt]_

_[tool: list_files]_

_[tool: run_script]_

_[tool: run_script]_

_[tool: read_file]_

_[tool: run_script]_

_[tool: run_script]_

Rendering times out in the sandbox — I'll render it in the preview instead.

_[tool: write_file]_

_[tool: show_html]_

_[tool: show_html]_

_[tool: sleep]_

_[tool: multi_screenshot]_

_[tool: get_webview_logs]_

_[tool: multi_screenshot]_

_[tool: eval_js_user_view]_

_[tool: multi_screenshot]_

_[tool: multi_screenshot]_

_[tool: multi_screenshot]_

_[tool: set_project_title]_

_[tool: delete_file]_

_[tool: write_file]_

Now the app itself — one large DC.

_[tool: dc_write]_

_[tool: ready_for_verification]_

## User

Save as standalone HTML: `CAE.dc.html`

## Assistant

_[tool: copy_files]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: super_inline_html]_

_[tool: show_html]_

_[tool: sleep]_

_[tool: save_screenshot]_

_[tool: get_webview_logs]_

_[tool: show_html]_

_[tool: present_fs_item_for_download]_

Standalone export ready above — single file, works fully offline (data, fonts and app bundled in). Note it always opens with demo data; the tweak you set applies only to the live project view.

## User

<pasted_text name="Pasted text (922 lines)">
# AX-Channels CAE V2 — Acquisition Intelligence Upgrade

We already have an existing functional prototype called:

**AX-Channels Client Acquisition Engine (CAE) V1**

Do NOT rebuild the application from scratch.

Do NOT replace the existing navigation or core CRM.

Preserve the existing V1 functionality and visual language.

The current V1 already contains:

* Dashboard / Command Center
* Prospects
* Opportunity Intelligence
* Outreach
* Pipeline
* Clients
* Tasks
* Analytics
* Templates
* Settings
* Prospect detail pages
* Lead scoring
* Opportunity scoring
* Outreach tracking
* Follow-up tracking
* Proposal tracking
* Activity history

The existing prospect-to-client pipeline is:

**New → Researching → Qualified → Outreach → Responded → Discovery → Proposal → Negotiation → Won/Lost**

Keep this workflow.

The purpose of V2 is to transform CAE from primarily a CRM into an **Acquisition Intelligence System for AX-Channels**.

The key question the product must answer is:

&gt; **"Which companies should AX-Channels pursue, why should we pursue them, who should we contact, what should we offer, what should we say, and what should I do next?"**

---

# 1. CREATE AN ACQUISITION INTELLIGENCE LAYER

Add an intelligence layer on top of the existing CRM.

Every prospect should have three major scores:

### Lead Score

How attractive is this company as a prospect?

### Opportunity Score

How strong is the digital opportunity?

### Acquisition Score

How strongly should AX-Channels pursue this company right now?

The Acquisition Score should combine:

* Lead quality
* Digital problem severity
* Business impact
* Service fit
* Estimated project value
* Decision-maker accessibility
* Likelihood of buying
* Recency/activity

Display:

**Acquisition Score: 87/100**

with classifications:

### 80–100

🔥 Priority

### 60–79

🟡 Pursue

### 40–59

⚪ Nurture

### 0–39

Low priority

Do not replace the existing /25 scoring system. Keep it and add the new acquisition score.

---

# 2. UPGRADE PROSPECT DETAIL

The prospect detail page should become the central workspace.

At the top display:

**Company**

**Industry**

**Acquisition Score**

**Lead Score**

**Opportunity Score**

**Pipeline Stage**

**Estimated Opportunity Value**

**Next Action**

**Next Action Date**

Add a prominent section:

# WHY THIS PROSPECT?

Show a concise intelligence summary:

### Why pursue

Example:

"Strong AX-Channels fit because the company has an outdated digital presence, visible mobile UX issues and multiple customer-facing digital opportunities."

### Primary opportunity

Example:

"Website redesign + customer experience improvement"

### Secondary opportunity

Example:

"Customer portal / internal dashboard"

### Potential value

Example:

"R25,000–R50,000"

### Recommended approach

Example:

"Lead with a personalized website experience audit rather than a generic website redesign pitch."

This section should be visible without requiring multiple clicks.

---

# 3. ADD DIGITAL OPPORTUNITY SCANNER

Create a new feature inside Opportunity Intelligence called:

**Digital Opportunity Scanner**

The user should be able to record the company's digital ecosystem.

Categories:

### Website

Status:

* Excellent
* Good
* Average
* Weak
* Missing

### Mobile Experience

### Mobile App

### Customer Portal

### Internal Systems

### Dashboard / Reporting

### E-commerce

### Booking / Lead Generation

### Automation

### AI Opportunities

### Digital Brand / Trust

For each category allow:

* Status
* Problem
* Evidence
* Opportunity
* Severity
* Business impact

Severity:

Low
Medium
High
Critical

---

# 4. DIGITAL EXPERIENCE SCORE

Based on the recorded scanner information, calculate a:

# Digital Experience Score

Out of 100.

Break it into:

* Website
* Mobile
* UX
* Conversion
* Digital infrastructure
* Internal systems
* Customer experience
* AI/automation maturity

Display the score visually.

Example:

**Digital Experience: 42/100**

Then show:

### Biggest weaknesses

1. Mobile experience — Critical
2. Website conversion — High
3. Customer portal — High

### Biggest opportunities

1. Website redesign
2. Customer portal
3. Internal dashboard

This should make the opportunity obvious.

---

# 5. OPPORTUNITY TYPES

Expand the existing service classification.

Use:

### Websites

* Website redesign
* New website
* Landing pages
* SEO-focused experience

### Product Design

* Mobile app
* Web app
* SaaS product
* UX/UI redesign

### Business Systems

* Dashboard
* Internal system
* Customer portal
* Operational platform

### Digital Transformation

* Process redesign
* Digital workflow
* Customer journey
* Digital infrastructure

### AI &amp; Automation

* AI UX
* AI assistant
* Workflow automation
* Intelligent dashboard
* AI-powered product

### UX Strategy

* UX audit
* UX research
* Product strategy
* Design system

Allow multiple opportunities per company.

---

# 6. OPPORTUNITY MATRIX

Create a visual opportunity matrix.

Each opportunity should have:

**Business Impact**

and

**Implementation Potential**

Display opportunities in four areas:

### Quick Win

High impact / low complexity

### Strategic

High impact / high complexity

### Low Priority

Low impact / low complexity

### Avoid

Low impact / high complexity

This should help determine what AX-Channels should pitch first.

---

# 7. DECISION-MAKER INTELLIGENCE

Improve the existing contact system.

A company can have multiple contacts.

For each contact add:

* Name
* Title
* Department
* Email
* Phone
* LinkedIn
* Decision-making role
* Influence
* Relationship status
* Last contacted
* Preferred channel
* Notes

Decision-making role:

### Decision Maker

Can approve the project.

### Influencer

Can strongly influence the decision.

### Champion

Likely to support AX-Channels internally.

### Gatekeeper

Controls access to decision-maker.

### Unknown

Influence:

Low
Medium
High

Add a clear label:

**Decision-maker identified: YES / NO**

If NO, create a suggested next action:

**"Identify the decision-maker before outreach."**

---

# 8. ACQUISITION STRATEGY

Every high-priority prospect should have a dedicated:

# Acquisition Strategy

Fields:

### Primary problem

### Primary opportunity

### Target decision-maker

### Recommended service

### Recommended entry offer

### Outreach angle

### Proof to use

### Desired next step

### Estimated deal value

### Expected sales difficulty

Easy
Moderate
Difficult

Example:

Primary problem:
Outdated website

Primary opportunity:
Website redesign

Target:
Marketing Director

Entry offer:
Free 10-minute digital opportunity preview

Outreach angle:
Show 2–3 concrete UX issues and one redesigned concept

Proof:
Relevant AX-Channels case study

Desired next step:
15-minute discovery call

---

# 9. OUTREACH INTELLIGENCE

Keep the existing outreach functionality.

Upgrade it so outreach is connected to the opportunity.

When creating outreach, show:

### Company

### Decision-maker

### Problem

### Opportunity

### Recommended service

### Outreach angle

Then provide:

**Generate Personalized Message**

The generated message should NOT sound like generic agency spam.

It should be based on:

* Company
* Person
* Role
* Industry
* Observed problem
* Opportunity
* Recommended service

Create variants for:

### LinkedIn

Short and conversational.

### Email

Professional and value-focused.

### Follow-up

Adds new value rather than saying "just following up."

### Final follow-up

Closes the loop professionally.

For V2, AI can be represented with a simulated generation flow if real AI integration is not available.

---

# 10. DAILY ACQUISITION COMMAND CENTER

This is the most important dashboard upgrade.

The dashboard should prioritize ACTION.

Create a prominent section:

# TODAY'S ACQUISITION PLAN

Show:

### 🔥 Top Prospects

The 5 prospects with the highest Acquisition Score.

For each show:

* Company
* Acquisition score
* Opportunity
* Estimated value
* Decision-maker
* Next action

### 📩 Outreach Today

Show all outreach that should happen today.

### 🔁 Follow-ups Today

Show all follow-ups due.

### 🔎 Research Needed

Show prospects missing:

* Decision-maker
* Website analysis
* Opportunity
* Lead score

### 💰 Revenue Opportunities

Show the highest-value opportunities currently in:

* Qualified
* Outreach
* Responded
* Discovery
* Proposal

### 🎯 Recommended Actions

Generate a prioritized list.

Example:

1. Contact ABC Mining's Marketing Director
2. Research XYZ Logistics decision-maker
3. Send website opportunity preview to ABC Property
4. Follow up with Company X
5. Prepare proposal for Company Y

The dashboard should answer:

&gt; **"What should I do right now to increase my chances of getting a client?"**

---

# 11. ACQUISITION PRIORITY QUEUE

Create a dedicated page or panel:

# PRIORITY QUEUE

Rank all active prospects.

Each prospect should display:

Rank
Company
Acquisition Score
Opportunity
Estimated Value
Decision Maker
Stage
Next Action
Next Action Date

Allow sorting by:

* Acquisition Score
* Opportunity value
* Urgency
* Follow-up date
* Stage

Use the queue as the main daily working list.

---

# 12. "WHY NOW?" SIGNALS

Add signals that explain why a company may be worth pursuing now.

Examples:

* Recently launched/relaunched website
* Company growth
* New product/service
* Expansion
* New leadership
* New digital initiative
* Hiring digital/product roles
* Poor mobile experience
* Website appears outdated
* New branch/location
* Customer-facing digital gap
* Operational complexity

For V2, allow these to be manually entered.

Prepare the architecture for future automated detection.

---

# 13. ACQUISITION CAMPAIGNS

Upgrade the existing campaign concept.

Allow creation of campaigns such as:

### Mining Website Redesign Campaign

Target:
South African mining companies

Offer:
Digital Opportunity Preview

Goal:
10 discovery meetings

### Logistics Systems Campaign

Target:
South African logistics companies

Offer:
Operations UX Audit

### SME Website Campaign

Target:
Growing South African SMEs

Offer:
Website Experience Redesign

Each campaign should track:

* Prospects
* Outreach
* Replies
* Meetings
* Proposals
* Won
* Revenue
* Conversion rate

This will allow us to discover which campaigns actually work.

---

# 14. ACQUISITION SCORE EXPLANATION

Never show a score without explaining it.

When clicking Acquisition Score, show:

### Score Breakdown

Lead quality: 18/25

Opportunity strength: 22/25

Decision-maker access: 8/10

Business urgency: 7/10

Service fit: 9/10

Potential value: 8/10

Total:

**72/100**

Then:

### Recommendation

"Pursue"

### Reason

"Strong digital opportunity and good AX-Channels service fit, but decision-maker access needs improvement."

This makes the score actionable rather than decorative.

---

# 15. IMPROVE ANALYTICS

Keep all existing analytics.

Add:

### Acquisition Performance

* Average Acquisition Score of won clients
* Average Acquisition Score of lost prospects
* Best-performing industries
* Best-performing services
* Best-performing campaigns
* Best-performing outreach channels
* Average time from prospect → discovery
* Average time from discovery → proposal
* Average time from proposal → won
* Average project value by industry
* Revenue by campaign

Most importantly:

### What predicts a win?

Show patterns based on available data.

Example:

"Prospects with Acquisition Score &gt;80 convert at 3.2× the rate of prospects below 60."

If there is insufficient real data, clearly show:

**Insufficient data**

Do not fabricate conclusions.

---

# 16. DATA QUALITY

Add a data completeness indicator for each prospect.

Example:

**Profile completeness: 72%**

Missing:

* Decision-maker
* Website assessment
* Opportunity
* Estimated value

Clicking it should show what needs to be completed.

This prevents the CAE from becoming a database full of incomplete leads.

---

# 17. NEXT ACTION ENGINE

Every active prospect MUST have a next action.

Examples:

* Research company
* Identify decision-maker
* Complete digital audit
* Create opportunity brief
* Send initial outreach
* Follow up
* Schedule discovery
* Prepare proposal
* Negotiate
* Close
* Nurture

If there is no next action, display:

**⚠️ No next action**

and allow the user to create one immediately.

This is critical.

---

# 18. DO NOT OVERBUILD

Do NOT add:

* Full autonomous AI prospecting
* Automatic mass email
* Automatic LinkedIn messaging
* Complex integrations
* Billing
* Project management
* Employee management
* Client portals

Those belong to later versions.

V2 should focus on:

**Intelligence → Prioritization → Action.**

---

# 19. PRESERVE EXISTING DATA

Do not remove or break:

* Existing prospects
* Existing contacts
* Existing opportunities
* Existing outreach
* Existing tasks
* Existing proposals
* Existing clients
* Existing templates
* Existing analytics

Upgrade the existing structures where possible.

Do not duplicate functionality unnecessarily.

---

# 20. V2 SUCCESS TEST

After implementing V2, I should be able to take a real company and answer all of these questions inside CAE:

### Who are they?

### What do they do?

### Who should I contact?

### What is wrong with their current digital experience?

### What opportunity exists?

### How valuable is that opportunity?

### Why should AX-Channels pursue them?

### How strong is the prospect?

### What should I offer first?

### What should I say?

### When should I follow up?

### What should I do today?

If the system cannot answer these questions, the V2 is not complete.

---

# FINAL PRODUCT PRINCIPLE

Do not optimize the CAE for having more features.

Optimize it for:

**More qualified conversations.**

Then:

**More discovery meetings.**

Then:

**More proposals.**

Then:

**More AX-Channels revenue.**

Every feature should ultimately support that objective.

Modify the existing CAE V1 and produce CAE V2.

</pasted_text>

## Assistant

_[tool: write_file]_

_[tool: dc_write]_

## Assistant

Data layer for V2 is in place. Now building the V2 component.

_[tool: dc_write]_

_[tool: dc_write]_

Large single writes are failing — switching to incremental edits on a copy.

_[tool: copy_files]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

Now the intelligence helpers.

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

Now the nav and dashboard intelligence.

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

Now the prospect-detail intelligence additions.

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

Now the template. Dashboard acquisition plan first.

_[tool: dc_html_str_replace]_

Now the Priority Queue and Campaigns views.

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

Now the "Why this prospect" and strategy panels, plus the next-action engine.

_[tool: dc_html_str_replace]_

Now the Digital Experience Score panel and scanner records in the detail view.

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

Now analytics additions and the two new modals.

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_set_props]_

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: ready_for_verification]_

## User

Save as standalone HTML: `CAE V2.dc.html`

## Assistant

_[tool: run_script]_

_[tool: copy_files]_

_[tool: str_replace_edit]_

_[tool: super_inline_html]_

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: show_html]_

_[tool: grep]_

_[tool: dc_set_props]_

_[tool: super_inline_html]_

_[tool: show_html]_

_[tool: present_fs_item_for_download]_

V2 standalone is ready above — one offline file with the full intelligence layer and demo data bundled in.

## User

<pasted_text name="Pasted text (1118 lines)">
# AX-Channels CAE V2.5 — Acquisition Workflow Upgrade

We already have an existing functional application called:

**AX-Channels Client Acquisition Engine (CAE) V2**

This is an incremental upgrade to V2.

## IMPORTANT

Do NOT rebuild the application.

Do NOT redesign the entire interface.

Do NOT remove existing functionality.

Do NOT add unnecessary new modules.

Preserve the current navigation, visual language, data structures and major V2 functionality.

The purpose of V2.5 is to make the existing CAE **operationally excellent for real-world prospecting**.

This version will be the final workflow refinement before we begin testing the CAE with real companies.

The core principle is:

&gt; **Every prospect must move from information → intelligence → decision → action → outcome.**

The system must make it extremely difficult to have a prospect sitting in the CRM without a clear next action.

---

# 1. CORE ACQUISITION WORKFLOW

Implement and visually reinforce this workflow:

**ADD COMPANY**
↓
**RESEARCH**
↓
**DIGITAL ASSESSMENT**
↓
**IDENTIFY OPPORTUNITY**
↓
**IDENTIFY DECISION-MAKER**
↓
**PRIORITIZE**
↓
**CREATE ACQUISITION STRATEGY**
↓
**GENERATE OUTREACH**
↓
**SEND**
↓
**FOLLOW UP**
↓
**RESPONSE**
↓
**DISCOVERY**
↓
**PROPOSAL**
↓
**WON / LOST**
↓
**LEARN FROM OUTCOME**

This workflow should be visible within the prospect detail experience.

Do not create an unnecessary new navigation item for this.

Instead, integrate it into the existing Prospect workspace.

---

# 2. ADD A PROGRESSIVE PROSPECT WORKFLOW

When opening a prospect, display a clear workflow/progress indicator.

Example:

### Prospect Acquisition Progress

1. Company ✓
2. Research ✓
3. Digital Assessment ✓
4. Opportunity ✓
5. Decision-maker ✓
6. Strategy ✓
7. Outreach
8. Follow-up
9. Discovery
10. Proposal
11. Outcome

The current stage should be visually prominent.

Completed stages should be clearly marked.

Incomplete stages should be actionable.

Clicking an incomplete stage should take the user directly to the relevant section.

---

# 3. CREATE A "NEXT BEST ACTION" SYSTEM

This is one of the most important V2.5 features.

Every active prospect MUST have a:

# NEXT BEST ACTION

The system should determine the recommended next step based on the prospect's current state.

Examples:

If no digital assessment:

&gt; **Research digital experience**

If digital assessment exists but no opportunity:

&gt; **Identify primary opportunity**

If opportunity exists but no decision-maker:

&gt; **Identify decision-maker**

If decision-maker exists but no strategy:

&gt; **Create acquisition strategy**

If strategy exists but no outreach:

&gt; **Prepare initial outreach**

If outreach is drafted but not sent:

&gt; **Send initial outreach**

If outreach was sent and follow-up is due:

&gt; **Follow up with decision-maker**

If positive response:

&gt; **Schedule discovery**

If discovery completed but no proposal:

&gt; **Prepare proposal**

If proposal sent:

&gt; **Follow up on proposal**

If proposal accepted:

&gt; **Convert to client**

If prospect has no active opportunity:

&gt; **Reassess opportunity**

Display this prominently on:

* Dashboard
* Prospect list
* Prospect detail
* Priority Queue

---

# 4. ACTION READINESS

Add an:

# ACTION READINESS SCORE

This is different from Acquisition Score.

Acquisition Score answers:

&gt; "How valuable is this prospect to pursue?"

Action Readiness answers:

&gt; "Are we actually ready to take the next action?"

Calculate based on required information.

For example:

### Required before initial outreach

* Company identified
* Website/research completed
* Digital problem identified
* Opportunity identified
* Decision-maker identified
* Acquisition strategy created
* Outreach angle defined

Display:

**Action Readiness: 86%**

If something is missing:

&gt; ⚠️ Missing decision-maker

&gt; ⚠️ No primary opportunity

Provide a direct action button.

Examples:

**Identify Decision-maker**

**Assess Website**

**Create Opportunity**

**Create Strategy**

---

# 5. DO NOT CONFUSE SCORE WITH CONFIDENCE

Improve the existing Digital Experience Score.

If only some dimensions have been assessed, do NOT present the score as if the entire company has been evaluated.

Example:

Instead of:

&gt; Digital Experience: 43/100

show:

&gt; **Digital Experience: 43/100**
&gt;
&gt; Based on **4 of 8 assessed dimensions**
&gt;
&gt; **Assessment confidence: 50%**

If all dimensions are assessed:

&gt; **Assessment confidence: High**

If only 1–2 dimensions are assessed:

&gt; **Assessment confidence: Low**

This prevents false precision.

Do not invent information.

---

# 6. ADD EVIDENCE CONFIDENCE

For every important digital problem, allow the system to distinguish between:

### Observed

Directly confirmed.

### Indicated

Strong evidence suggests the problem.

### Assumption

Not yet confirmed.

Use these labels when recording:

* Problem
* Evidence
* Opportunity
* Why-now signal

Example:

**Problem:** Poor mobile navigation

**Evidence:** Observed

This distinction is important because CAE must separate facts from assumptions.

---

# 7. IMPROVE THE "WHY THIS PROSPECT?" SECTION

Keep the existing feature.

Upgrade it to clearly show:

### Why pursue?

Short explanation.

### Primary opportunity

The strongest commercial opportunity.

### Secondary opportunity

Additional opportunity.

### Potential value

Estimated ZAR range.

### Why now?

The strongest available urgency signal.

### Recommended approach

How AX-Channels should approach the company.

### Confidence

High / Medium / Low

Confidence should depend on how much information has actually been validated.

Do not fabricate reasons.

If there isn't enough information, say:

&gt; **Insufficient evidence — research required.**

---

# 8. CREATE A "DO NOT CONTACT YET" STATE

Not every prospect should immediately be contacted.

Add a clear state:

# NOT READY

Reasons:

* Insufficient research
* No decision-maker
* Opportunity unclear
* Weak AX-Channels fit
* No evidence of need
* Poor timing
* Need more information

The system should prevent the prospect from appearing in:

**Today's Outreach**

until minimum outreach readiness requirements are met.

Allow the user to override this manually with a confirmation.

---

# 9. OUTREACH READINESS CHECKLIST

Before allowing an outreach action, display:

### Outreach Readiness

☐ Company researched
☐ Digital problem identified
☐ Evidence recorded
☐ Primary opportunity identified
☐ Decision-maker identified
☐ Acquisition strategy created
☐ Outreach angle created
☐ Appropriate channel selected

Display:

### READY FOR OUTREACH

or:

### NOT READY

with the missing items.

This should be actionable.

---

# 10. IMPROVE OUTREACH GENERATION

Keep the existing outreach intelligence.

However, make the generated message follow this structure:

### Observation

Something specific about the company.

### Relevance

Why the observation matters.

### Opportunity

What could potentially be improved.

### Credibility

Why AX-Channels is reaching out.

### Low-friction CTA

A simple next step.

Do NOT make the messages sound like generic agency sales copy.

Avoid:

* Excessive corporate language
* Artificially sophisticated wording
* Overly long introductions
* Generic compliments
* "We are a leading..."
* "I hope this message finds you well"
* Aggressive sales language

Preferred style:

**Specific + human + concise + useful.**

Example structure:

&gt; "I noticed [specific issue] while reviewing [company]'s current digital experience. It looks like there may be an opportunity to simplify [specific journey]. I put together a quick concept showing how I'd approach it. Happy to send it over if useful."

The actual message should use the company's real information stored in CAE.

Do not invent facts.

---

# 11. OUTREACH PREVIEW

Before marking outreach as sent, show:

### Company

### Contact

### Problem

### Opportunity

### Channel

### Message

### CTA

### Follow-up date

Allow:

**Edit**

**Regenerate**

**Approve &amp; Send**

For V2.5, "Approve &amp; Send" can simply mark the outreach as sent and create the appropriate follow-up task.

Do not implement autonomous sending.

---

# 12. OUTREACH → OUTCOME LOOP

This is critical.

Every outreach must eventually have an outcome.

Track:

### Sent

### Viewed

### Replied

### Positive

### Neutral

### Negative

### No response

### Wrong person

### Not interested

### Meeting booked

When recording a response, allow the user to add:

**Response notes**

and:

**Next action**

---

# 13. RESPONSE-BASED NEXT ACTIONS

The system should react to the outcome.

### Positive

Recommend:

&gt; Schedule discovery

### Meeting booked

Recommend:

&gt; Prepare discovery

### No response

Recommend:

&gt; Follow-up

### Wrong person

Recommend:

&gt; Identify correct decision-maker

### Not interested

Recommend:

&gt; Move to nurture

### Negative

Recommend:

&gt; Close / nurture

### Interested but timing unclear

Recommend:

&gt; Set nurture date

This creates the feedback loop we currently need.

---

# 14. FOLLOW-UP ENGINE

Keep the existing four-touch structure.

Improve the workflow so each follow-up has:

* Date
* Channel
* Purpose
* Message
* Status
* Outcome
* Next action

Do not automatically send.

The system should create tasks.

Example:

### Touch 1

Initial observation.

### Touch 2

New value/insight.

### Touch 3

Relevant proof or concept.

### Touch 4

Close the loop.

Do not simply repeat:

&gt; "Just following up."

---

# 15. PRIORITY QUEUE UPGRADE

Keep the existing Priority Queue.

Change the ranking logic so it considers:

### Acquisition Score

### Action Readiness

### Urgency

### Opportunity Value

### Follow-up due

### Pipeline stage

A high-value prospect that is not ready should not necessarily appear above a slightly lower-value prospect that is ready to contact today.

Display:

**Priority**

**Action**

**Why now**

Example:

&gt; #1 ABC Mining
&gt; Acquisition Score: 86
&gt; Action Readiness: 100%
&gt; Opportunity: Website redesign
&gt; Estimated value: R40K–R60K
&gt; Why now: Outreach ready
&gt; **Action: Send initial outreach**

---

# 16. DASHBOARD — MAKE IT ACTION-FIRST

Preserve existing dashboard KPIs.

But make the primary dashboard section:

# TODAY'S ACQUISITION PLAN

Sections:

### 1. Contact Now

Prospects that are ready for outreach.

### 2. Follow Up Now

Prospects with follow-ups due.

### 3. Research Now

High-value prospects missing critical information.

### 4. Prepare Now

Prospects needing:

* Opportunity brief
* Strategy
* Outreach
* Proposal

### 5. Waiting

Prospects where AX-Channels is waiting for:

* Reply
* Meeting
* Proposal decision

### 6. At Risk

Prospects with:

* Overdue follow-up
* Stalled pipeline
* Expiring proposal
* No activity

The dashboard should tell me what to do, not merely tell me what exists.

---

# 17. ADD DAILY ACQUISITION TARGETS

Add a simple daily target module.

Example:

### Today's Target

New prospects: 5

Qualified: 3

Outreach: 5

Follow-ups: 3

Discovery meetings: 1

Proposals: 1

Allow these targets to be configurable in Settings.

Display progress:

**Outreach: 3 / 5**

**Follow-ups: 2 / 3**

Do not make targets punitive.

They are operating targets.

---

# 18. PROSPECT LIST — SHOW ACTION, NOT JUST DATA

Update prospect cards/table rows to emphasize:

* Company
* Acquisition Score
* Opportunity
* Value
* Stage
* Decision-maker
* Action Readiness
* Next Best Action
* Next Action Date

A user should be able to scan the list and immediately know:

&gt; **Who should I work on?**

---

# 19. PIPELINE STALL DETECTION

Add simple stall detection.

A prospect should be marked:

### Stalled

if it remains in the same stage beyond a reasonable threshold.

Suggested defaults:

Researching: 7 days

Qualified: 7 days

Outreach: 10 days

Responded: 5 days

Discovery: 10 days

Proposal: 14 days

Negotiation: 14 days

Allow thresholds to be configured later.

Show:

&gt; ⚠️ Stalled for 12 days

and provide:

**Take action**

---

# 20. LOST / NOT INTERESTED LEARNING

When marking a prospect Lost, ask for a reason.

Options:

* No budget
* No current need
* Wrong timing
* Chose competitor
* No response
* Wrong decision-maker
* Poor fit
* Project cancelled
* Other

Allow notes.

When marking Won:

* Final project value
* Service purchased
* Acquisition source
* Campaign
* Time to close

This information will later be used to improve the acquisition system.

---

# 21. OUTCOME LEARNING

After a prospect reaches Won or Lost, show:

# ACQUISITION OUTCOME

### What happened?

### Original Acquisition Score

### Original Opportunity Score

### Original Action Readiness

### Industry

### Service

### Deal value

### Acquisition source

### Campaign

### Time to close

This data should be stored for future analytics.

Do NOT claim the system is "learning" automatically yet.

We are simply collecting structured outcome data.

---

# 22. DATA COMPLETENESS

Keep the existing Profile Completeness feature.

Improve it so it distinguishes:

### Required

Information required for the current stage.

### Recommended

Information that improves confidence.

Example:

For "Researching":

Required:

* Company
* Website
* Industry

For "Outreach":

Required:

* Digital problem
* Evidence
* Opportunity
* Decision-maker
* Strategy
* Outreach

For "Proposal":

Required:

* Discovery completed
* Scope
* Value
* Proposal

Do not require unnecessary fields.

---

# 23. PROSPECT WORKFLOW ACTION BAR

Add a compact action bar to the prospect detail page.

Example:

**[Research] [Assess] [Opportunity] [Decision-maker] [Strategy] [Outreach] [Follow-up] [Discovery] [Proposal]**

The current relevant action should be emphasized.

This should make the prospect detail page feel like a workspace rather than a static profile.

---

# 24. REAL DATE/TIME

Remove hardcoded demo dates where they affect the user experience.

Use the actual current date/time.

Do not hardcode:

"Sunday 9 August 2026"

or other demo dates.

Use the system date dynamically.

---

# 25. DEMO DATA

Keep existing demo data.

Clearly identify it as demo data.

Do not mix demo data with future real prospect data without a clear distinction.

Add an optional:

**Reset Demo Data**

action in Settings.

This should restore the original demo state.

---

# 26. IMPORTANT — DO NOT OVERBUILD

Do NOT implement:

* Autonomous prospecting
* Autonomous LinkedIn messaging
* Autonomous email sending
* Scraping
* Complex external integrations
* Full AI research
* Automated website crawling
* Billing
* Project management
* Client portal

Those belong to later phases.

V2.5 is about:

# **WORKFLOW QUALITY**

Not feature quantity.

---

# 27. V2.5 ACCEPTANCE TEST

The finished application must allow me to take a brand-new company and perform this exact workflow:

### Step 1

Add company.

### Step 2

Research company.

### Step 3

Assess digital experience.

### Step 4

Record evidence.

### Step 5

Identify digital problem.

### Step 6

Create opportunity.

### Step 7

Estimate opportunity value.

### Step 8

Identify decision-maker.

### Step 9

Create acquisition strategy.

### Step 10

Calculate Acquisition Score.

### Step 11

Calculate Action Readiness.

### Step 12

Generate outreach.

### Step 13

Review and approve outreach.

### Step 14

Mark outreach sent.

### Step 15

Automatically create follow-up task.

### Step 16

Record response.

### Step 17

System recommends next action.

### Step 18

Move prospect through pipeline.

### Step 19

Record discovery.

### Step 20

Create proposal.

### Step 21

Mark Won or Lost.

### Step 22

Record outcome.

At every stage, the system should clearly tell the user:

&gt; **WHAT SHOULD I DO NEXT?**

---

# FINAL QUALITY STANDARD

Do not optimize V2.5 for:

* More screens
* More charts
* More settings
* More fields
* More AI

Optimize it for:

**Less uncertainty**

**Less manual thinking**

**Better prioritization**

**Better outreach**

**More consistent follow-up**

**More qualified conversations**

**More proposals**

**More AX-Channels clients**

After completing V2.5, stop adding features.

The next phase will be:

# REAL-WORLD TESTING

We will put actual prospects into the system and evaluate how well the CAE performs.

Do not proceed to a V3 feature build automatically.

Build and refine V2.5 only.

</pasted_text>

## Assistant

_[tool: write_file]_

_[tool: copy_files]_

Now the V2.5 logic: real dates, next-best-action engine, readiness, stalls.

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

Now the core V2.5 engines.

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

Now wiring the dashboard plan, queue and list to the new engines.

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

Now the prospect list, detail workflow, and outcome recording.

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

Now the returned values for the new UI + modals.

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

Now the template updates. Dashboard plan first.

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

Now the queue columns, prospect list columns, and detail workflow UI.

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

Now the detail workflow bar, readiness panel and outcome section.

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

Now DX confidence, why-now confidence, evidence labels, and the outreach outcome loop.

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_js_str_replace]_

Now the outreach history → outcome loop, and the two new modals + settings.

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

Now the outreach preview upgrade and the two new modals.

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: show_html]_

_[tool: dc_set_props]_

_[tool: show_html]_

_[tool: str_replace_edit]_

_[tool: dc_js_str_replace]_

_[tool: show_html]_

Contact now now surfaces a genuinely ready prospect. Handing off for review.

_[tool: ready_for_verification]_

V2.5 is out for review as `CAE V2.5.dc.html` — V2 is untouched.

What changed: an 11-step workflow tracker and action bar on every prospect; a Next Best Action engine that derives the step from actual state; Action Readiness with an outreach checklist, "not ready" blocking (with override) and direct fix buttons; Digital Experience score now reports assessed dimensions and confidence instead of false precision; Observed/Indicated/Assumption labels on all evidence and signals; outreach preview with Edit / Regenerate / Approve & send that auto-creates the follow-up task; response outcomes that set the recommended next action; stall detection; Won/Lost reason capture with a structured outcome record; a six-lane day plan (Contact / Follow up / Research / Prepare / Waiting / At risk); configurable daily targets and Reset demo data in Settings; real system date throughout.

One judgement call: the demo dataset had no digital scan for Peak Analytics, which left "Contact now" legitimately empty — I recorded its scan (four categories, real evidence) so the ready-to-contact path is visible.

## User

Found issues — fixing…

## User

Found issues — fixing…

## User

Found issues — fixing…

## Assistant

_[tool: grep]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

## User

Save as standalone HTML: `CAE V2.5.dc.html`

## Assistant

_[tool: run_script]_

_[tool: grep]_

_[tool: run_script]_

_[tool: copy_files]_

_[tool: str_replace_edit]_

_[tool: dc_set_props]_

_[tool: super_inline_html]_

_[tool: show_html]_

_[tool: present_fs_item_for_download]_

V2.5 standalone is ready above — single offline file, all three data layers merged in, demo data on by default.

## User

<pasted_text name="Pasted text (1203 lines)">
# CAE V2.5 — CRITICAL WORKFLOW &amp; CLICKABILITY FIX

We have an existing AX-Channels CAE V2.5 prototype.

DO NOT rebuild the application.

DO NOT redesign the visual system.

DO NOT add new features.

This task is specifically to fix and harden the **entire navigation and acquisition workflow** so that every visible action, button, card, stage and CTA actually works and takes the user to the correct place.

The current problem is:

&gt; The interface shows workflow concepts such as Research, Next Best Action, Opportunity, Decision-maker, Strategy and Outreach, but some of these stages do not have an obvious clickable action that moves the prospect into the correct workflow step.

This must be fixed throughout the entire application.

---

# 1. CORE PRINCIPLE

Every visible interactive element must do something.

There must be NO:

* Dead buttons
* Decorative buttons that look clickable
* Dead workflow stages
* Dead cards
* Dead "Next Best Action" labels
* Dead navigation items
* Dead tabs
* Dead dropdown actions
* Dead "View" buttons
* Dead "Start" buttons
* Dead "Continue" buttons
* Dead "Mark done" buttons
* Dead "Generate" buttons
* Dead "Research" actions

If an element looks interactive, it MUST be interactive.

If something is intentionally informational and not clickable, style it clearly as informational rather than as a button.

---

# 2. MAKE THE PROSPECT WORKFLOW EXPLICIT

The prospect detail page must contain a clearly visible:

# ACQUISITION WORKFLOW

Use this exact sequence:

**1. Company**
↓
**2. Research**
↓
**3. Digital Assessment**
↓
**4. Opportunity**
↓
**5. Decision-maker**
↓
**6. Prioritize**
↓
**7. Strategy**
↓
**8. Outreach**
↓
**9. Follow-up**
↓
**10. Response**
↓
**11. Discovery**
↓
**12. Proposal**
↓
**13. Won / Lost**

Each stage MUST be clickable.

---

# 3. WHAT HAPPENS WHEN A WORKFLOW STAGE IS CLICKED

This is critical.

Clicking a stage must take the user to the correct section of the prospect workspace.

### Company

Open the company/profile information section.

### Research

Open the Research section.

If no research exists:

Show:

&gt; **Research this company**
&gt;
&gt; Review the company, website, services, market presence and digital experience.

Buttons:

**Start Research**

**Mark Research Complete**

If research already exists:

Show the saved research and:

**Edit Research**

**Mark Complete**

---

### Digital Assessment

Open the Digital Opportunity Scanner.

If not completed:

Show:

**Start Digital Assessment**

If partially completed:

Show:

**Continue Assessment**

If complete:

Show:

**Review Assessment**

---

### Opportunity

Open Opportunity Intelligence.

If no opportunity exists:

Show:

**Identify Opportunity**

If one exists:

Show:

**Review Opportunity**

---

### Decision-maker

Open the contacts/decision-maker section.

If no decision-maker exists:

Show:

**Add Decision-maker**

If a contact exists but is not identified as the decision-maker:

Show:

**Review Contacts**

**Mark as Decision-maker**

---

### Prioritize

Open Acquisition Score.

Show:

* Acquisition Score
* Score breakdown
* Opportunity strength
* Lead quality
* Decision-maker access
* Urgency
* Service fit
* Potential value

Show:

**Review Priority**

---

### Strategy

Open Acquisition Strategy.

If incomplete:

Show:

**Create Acquisition Strategy**

If complete:

Show:

**Edit Strategy**

---

### Outreach

Open the Outreach workspace for this company.

If outreach is not ready:

Show exactly what is missing.

Example:

&gt; ⚠ Outreach not ready
&gt;
&gt; Missing:
&gt;
&gt; * Decision-maker
&gt; * Primary opportunity
&gt; * Acquisition strategy

Then provide clickable actions:

**Identify Decision-maker**

**Create Opportunity**

**Create Strategy**

If ready:

Show:

**Generate Outreach**

**Review Draft**

**Mark as Sent**

---

### Follow-up

Open the company's follow-up activity.

Show:

* Current touch
* Previous message
* Follow-up date
* Follow-up status
* Next follow-up

Actions:

**Complete Follow-up**

**Reschedule**

**Skip**

**Open Outreach**

---

### Response

Open the outreach outcome interface.

Allow:

* Positive
* Neutral
* No response
* Negative
* Wrong person
* Not interested
* Meeting booked

After selecting an outcome, immediately show the recommended next action.

---

### Discovery

Open discovery/meeting area.

Actions:

**Schedule Discovery**

**Record Discovery**

**Add Notes**

**Move to Proposal**

---

### Proposal

Open proposal area.

Actions:

**Create Proposal**

**View Proposal**

**Mark Sent**

**Record Response**

**Move to Negotiation**

---

### Won / Lost

Open the outcome interface.

Actions:

**Mark Won**

**Mark Lost**

When Won:

Collect:

* Final project value
* Service purchased
* Campaign/source
* Time to close

When Lost:

Collect:

* Lost reason
* Notes
* Optional future nurture date

---

# 4. ADD A PRIMARY ACTION TO EVERY WORKFLOW STAGE

Every stage must have ONE obvious primary CTA.

Examples:

Research:

**Start Research →**

Digital Assessment:

**Start Assessment →**

Opportunity:

**Identify Opportunity →**

Decision-maker:

**Add Decision-maker →**

Strategy:

**Create Strategy →**

Outreach:

**Generate Outreach →**

Follow-up:

**Complete Follow-up →**

Response:

**Record Response →**

Discovery:

**Schedule Discovery →**

Proposal:

**Create Proposal →**

Outcome:

**Record Outcome →**

Do not make users guess where to click.

---

# 5. NEXT BEST ACTION MUST NAVIGATE

The existing:

# NEXT BEST ACTION

must NOT merely be text.

If it says:

&gt; Research company

clicking it MUST open the Research workspace.

If it says:

&gt; Identify opportunity

clicking it MUST open Opportunity Intelligence.

If it says:

&gt; Identify decision-maker

clicking it MUST open Contacts / Decision-maker.

If it says:

&gt; Create acquisition strategy

clicking it MUST open Strategy.

If it says:

&gt; Send initial outreach

clicking it MUST open Outreach.

If it says:

&gt; Follow up

clicking it MUST open the correct follow-up interface.

The user should never see a recommended action that they cannot immediately execute.

---

# 6. "MARK DONE" MUST ADVANCE THE WORKFLOW

This is extremely important.

When the user clicks:

**Mark Done**

the system must:

1. Complete the current action.
2. Update the relevant record.
3. Add an activity entry.
4. Recalculate Action Readiness.
5. Recalculate Next Best Action.
6. Determine the next workflow stage/action.
7. Update the prospect UI immediately.

Example:

Current:

&gt; Next Best Action: Research company

User clicks:

**Mark Done**

System changes to:

&gt; Research ✓

Then:

&gt; Next Best Action: Complete Digital Assessment

with CTA:

**Start Assessment →**

Do not leave the user on a completed action with no next step.

---

# 7. WORKFLOW STAGE STATUS

Each stage should visually show one of:

### LOCKED

Cannot proceed because a prerequisite is missing.

### READY

Can be started.

### IN PROGRESS

Work has started.

### COMPLETE

Stage completed.

### BLOCKED

Something is preventing progress.

Use clear visual states.

---

# 8. DO NOT LOCK THE USER TOO AGGRESSIVELY

A stage may be technically recommended but the user should still be able to navigate manually.

For example:

If Research is incomplete, the user should still be able to click Opportunity and view it.

However, the system should clearly show:

&gt; ⚠ Research incomplete

Do not hide information.

Do not trap the user inside a wizard.

The workflow is a guide, not a prison.

---

# 9. DASHBOARD ACTIONS MUST WORK

Every item in:

# TODAY'S ACQUISITION PLAN

must be clickable.

For example:

### Contact Now

Click company → Prospect workspace.

Click action → Outreach.

### Research Now

Click company → Prospect workspace.

Click action → Research.

### Follow Up Now

Click action → Follow-up.

### Prepare Now

Click action → relevant missing stage.

### At Risk

Click → relevant problem/stage.

Never make the dashboard merely informational.

---

# 10. PRIORITY QUEUE MUST BE ACTIONABLE

Every prospect row/card must have:

**View**

**Next Action**

The Next Action button must open the correct workflow section.

Example:

&gt; ABC Mining
&gt;
&gt; Acquisition: 87
&gt;
&gt; Action Readiness: 100%
&gt;
&gt; Next Action: Send outreach

Click:

**Send outreach →**

must open Outreach for ABC Mining.

---

# 11. PROSPECT LIST MUST BE ACTIONABLE

Every prospect should support:

**Open**

**Next Action**

**Stage**

**More**

The "Next Action" must navigate to the correct workflow section.

Do not make the user open the prospect and then hunt for the action.

---

# 12. OPPORTUNITY CARDS MUST BE CLICKABLE

Every opportunity card should open:

**Opportunity Detail**

From there provide:

**View Company**

**Edit Opportunity**

**Create Strategy**

**Generate Outreach**

The buttons must actually work.

---

# 13. DECISION-MAKER ACTIONS MUST WORK

Every contact card should support:

**View**

**Edit**

**Mark Decision-maker**

**Add Activity**

If there is no decision-maker:

show:

**Add Decision-maker →**

and navigate to the correct contact form.

---

# 14. OUTREACH ACTIONS MUST WORK

Every outreach item must have functional:

**Open**

**Edit**

**Generate**

**Approve**

**Mark Sent**

**Reschedule**

**Complete**

**Record Outcome**

Do not create UI controls without connected state logic.

---

# 15. PIPELINE CARDS MUST WORK

Pipeline cards must be clickable.

Clicking a card opens the prospect.

Drag-and-drop stage changes must continue to work.

If stage changes:

* Update company stage
* Add activity
* Recalculate next action
* Recalculate readiness
* Update dashboard
* Update queue

---

# 16. TASKS MUST BE CONNECTED TO PROSPECTS

Every acquisition-related task must link back to the relevant prospect.

Clicking:

&gt; Research ABC Mining

must open ABC Mining's Research section.

Clicking:

&gt; Follow up ABC Mining

must open ABC Mining's Follow-up section.

Tasks must never become isolated dead-end records.

---

# 17. SEARCH RESULTS MUST BE CLICKABLE

When searching:

ABC Mining

the result should open the company.

Do not make search merely return static text.

---

# 18. NOTIFICATIONS MUST BE CLICKABLE

If the notification says:

&gt; Follow-up due: ABC Mining

clicking it should open:

**ABC Mining → Follow-up**

If:

&gt; Proposal expiring

click → Proposal.

If:

&gt; No next action

click → Prospect workspace → Next Action.

---

# 19. EMPTY STATES MUST HAVE ACTIONS

Never show an empty state without a useful CTA.

Bad:

&gt; No research yet.

Good:

&gt; No research yet.
&gt;
&gt; Start by documenting what you found about the company.

**Start Research →**

Bad:

&gt; No decision-maker.

Good:

&gt; No decision-maker identified.

**Add Decision-maker →**

Every empty state should help the user progress.

---

# 20. MODALS MUST HAVE WORKING CLOSE / SAVE / CANCEL

Every modal must have:

**Cancel / Close**

**Save / Confirm**

No modal should trap the user.

After saving:

* Close modal where appropriate
* Update state
* Update activity
* Recalculate scores/readiness
* Refresh visible data

---

# 21. FORMS MUST HAVE VALIDATION

Required fields should clearly show:

**Required**

If the user attempts to continue without required information:

Show exactly what is missing.

Do not silently fail.

Do not allow an action to appear complete when the required information was never saved.

---

# 22. STAGE TRANSITIONS MUST BE CONSISTENT

When a stage is completed, update the prospect's pipeline stage where appropriate.

Example:

Research complete:

**Researching**

→ **Qualified** only if qualification requirements are met.

Do NOT automatically push every prospect through the entire pipeline.

The system should distinguish:

### Workflow task completion

from

### Sales pipeline stage

These are related but not identical.

---

# 23. IMPORTANT DISTINCTION

Do not confuse:

**Research**

with:

**Qualified**

Do not confuse:

**Opportunity identified**

with:

**Outreach sent**

Do not confuse:

**Outreach sent**

with:

**Responded**

Do not automatically advance a prospect merely because a form was completed unless that transition is explicitly defined.

The system should preserve sales reality.

---

# 24. GLOBAL CLICKABILITY AUDIT

Before finishing, inspect EVERY interactive-looking element in the application.

Test:

### Navigation

* Dashboard
* Priority Queue
* Prospects
* Opportunities
* Outreach
* Pipeline
* Campaigns
* Tasks
* Analytics
* Settings

### Dashboard

* KPI cards
* Prospect cards
* Action buttons
* Follow-ups
* Research actions
* At-risk actions

### Prospects

* Search
* Filters
* Prospect cards
* Next action
* Open
* More actions

### Prospect Detail

* Workflow stages
* Next Best Action
* Score
* Readiness
* Research
* Assessment
* Opportunity
* Contacts
* Strategy
* Outreach
* Follow-up
* Response
* Discovery
* Proposal
* Outcome

### Opportunities

* Tabs
* Cards
* Actions
* Company links

### Outreach

* Generate
* Edit
* Approve
* Send
* Follow-up
* Outcome

### Pipeline

* Cards
* Drag/drop
* Stage changes

### Tasks

* Open prospect
* Complete
* Reschedule

### Analytics

If a metric/card looks interactive, make it interactive.

If it is not intended to be interactive, style it as a static metric.

### Settings

Every setting control must either work or clearly be marked as informational.

---

# 25. ADD A DEVELOPMENT / QA MODE

Add a small developer-only option in Settings:

# Interaction Audit

When enabled, display a subtle indicator for interactive elements.

Also add:

### Workflow Test

Allow us to run:

**New Prospect → Research → Assessment → Opportunity → Decision-maker → Strategy → Outreach**

and verify each transition.

This is for development/testing and can be hidden later.

---

# 26. FINAL ACCEPTANCE TEST

The application is NOT complete until the following exact test works:

### Test A

Create new prospect.

↓

Click:

**Research**

↓

Research workspace opens.

↓

Click:

**Start Research**

↓

Save research.

↓

Click:

**Digital Assessment**

↓

Digital Opportunity Scanner opens.

↓

Complete assessment.

↓

Click:

**Opportunity**

↓

Opportunity workspace opens.

↓

Create opportunity.

↓

Click:

**Decision-maker**

↓

Contact workspace opens.

↓

Add decision-maker.

↓

Click:

**Strategy**

↓

Strategy workspace opens.

↓

Create strategy.

↓

Click:

**Outreach**

↓

Outreach workspace opens.

↓

Generate message.

↓

Approve message.

↓

Mark Sent.

↓

System creates follow-up.

↓

Click:

**Follow-up**

↓

Follow-up workspace opens.

↓

Record response.

↓

System recommends the correct next action.

Every step must work without the user needing to manually hunt through the application.

---

# 27. FINAL REQUIREMENT

After implementation, do a complete click-through QA of the application.

Do not only inspect whether the UI looks correct.

Actually test every workflow:

**Create → Open → Edit → Save → Complete → Next Action → Navigate → Update → Recalculate.**

Fix any dead ends.

Fix any buttons that do nothing.

Fix any actions that navigate to the wrong section.

Fix any state that does not update after an action.

Fix any workflow stage that is visible but cannot be entered.

The final experience should feel like a connected operating system, not a collection of screens.

## SUCCESS CRITERIA

A user should always be able to answer:

&gt; **Where am I?**

&gt; **What stage is this prospect in?**

&gt; **What have I completed?**

&gt; **What is missing?**

&gt; **What should I do next?**

&gt; **Where do I click to do it?**

If any answer is unclear, improve the interface.

Do not add unrelated features.

This is a **workflow and interaction integrity upgrade only.**

</pasted_text>

## Assistant

This is a substantial integrity pass. Working on a copy so the current V2.5 stays intact.

_[tool: copy_files]_

_[tool: update_todos]_

_[tool: dc_js_str_replace]_

Now the mutators that make each stage's CTA actually do work.

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

Now the renderVals for the workspace sections.

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

Now wiring the lists, tasks, notifications, KPIs to route into the right section.

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

Logic layer done. Now the detail template: replacing the old stage rail with the 13-stage workflow and adding the workspace.

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_js_str_replace]_

Now gating the existing cards and adding the remaining sections.

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

Now the strategy card gating with its editor, the contacts panel actions, and settings QA block.

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_js_str_replace]_

Now the contacts panel actions and settings QA block.

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

Now the actionable buttons on dashboard/queue/list rows and opportunity cards.

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: eval_js]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: eval_js]_

_[tool: grep]_

_[tool: grep]_

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: dc_set_props]_

Now click-testing the workflow end to end.

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: show_html]_

_[tool: eval_js]_

_[tool: eval_js]_

The workflow rail and statuses work. Now testing the stage navigation and forms.

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: grep]_

_[tool: dc_html_str_replace]_

_[tool: dc_js_str_replace]_

Now running the built-in workflow test, which exercises every state transition.

_[tool: eval_js]_

All 10 transitions pass. Now testing the interactive forms by hand.

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: save_screenshot]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: show_html]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: get_webview_logs]_

_[tool: update_todos]_

_[tool: ready_for_verification]_

`CAE V2.5.1.dc.html` — the clickability pass. V2.5 is untouched.

The prospect page is now a workspace: a 13-stage rail (Company → Won/Lost) where every stage is clickable, carries a status (Complete / In progress / Ready / Locked / Blocked) and opens its own section with one primary CTA. Locked stages are still navigable — the workflow guides, it doesn't trap.

Real editors now exist behind those CTAs, and they write records: research (summary/findings, save draft or mark complete), digital assessment (category, status, severity, problem, evidence, confidence, impact), opportunity (type from the taxonomy, value, complexity, scores), contacts (add, mark decision-maker, log contact), strategy (all ten fields), discovery (schedule / record as held / move to proposal), proposal (create / mark sent / viewed / negotiation), outcome (won/lost with reason capture). Required fields are labelled and refuse to save silently.

Next Best Action is now a button that navigates, and Mark done completes the action, logs activity, recalculates readiness and moves you to the next stage. Dashboard rows, queue rows, prospect rows, opportunity cards, tasks, notifications, search results and KPI cards all route to the correct section rather than just the prospect. Stage completion never auto-advances the sales stage except where the transition is explicit (research → Researching, outreach sent → Outreach, discovery held → Discovery, proposal sent → Proposal).

Settings has the QA tooling you asked for: Interaction audit outlines every interactive element, and Workflow Test runs new prospect → research → assessment → opportunity → decision-maker → strategy → outreach → response and reports each transition. It currently passes 10 of 10.

One note: I verified stage routing, statuses, gating and the transition chain by driving the app directly; typed-form entry I could only confirm through validation behaviour and the test runner, since synthetic keystrokes don't reach React inputs reliably. Worth a manual pass on the forms when you next open it.

## User

Found issues — fixing…

## User

Found issues — fixing…

## Assistant

## Assistant

## Assistant

