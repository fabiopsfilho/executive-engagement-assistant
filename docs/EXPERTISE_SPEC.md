# Expertise Specification — Executive Engagement Assistant

**Purpose of this document.** This is a comprehensive, implementation-grounded
specification of how the assistant's "expertise" is created: where the knowledge
comes from, how it is assembled into an analysis, what guardrails shape it, and
what it produces. It is written to be complete enough to **train another agent**
(human or AI) to reproduce, extend, or reason about the system.

Everything here is derived from the actual codebase (backend Lambdas under
`backend/lambdas/`, infrastructure in `backend/lib/stack.ts`, and the web app in
`src/`). Where a claim maps to a specific file, the path is given.

---

## 1. What "the expertise" actually is

The assistant prepares the AWS Training & Certification (T&C) team for an
**Executive Briefing Center (EBC)** conversation with a customer. Its "expertise"
is **not** a hand-authored knowledge base of rules. It is an *emergent* product of
four ingredients combined at request time:

1. **A foundation model** (Anthropic Claude) that supplies reasoning and a body of
   trained-in domain knowledge.
2. **A carefully engineered persona + guardrail prompt** that constrains *how* the
   model reasons and what it is allowed to say.
3. **Live, per-account intelligence** gathered from external sources (web search,
   an AWS knowledge base, an AWS documentation MCP server).
4. **User-supplied ground truth** (Salesforce capture, uploaded documents, the
   attendee list) that is treated as the authoritative layer.

The system fuses these into **one unified analysis** per account. The single most
important design principle is: **every insight must be bespoke to the specific
company** — if you swapped in a different company, none of the output should still
make sense. That "uniqueness mandate" is enforced in the prompt, not the code.

---

## 2. System architecture (how a request flows)

```
Browser (React app, src/)                     AWS backend (API Gateway + Lambda)
────────────────────────                      ───────────────────────────────────
Account loaded / data changed
   │  regenerateAnalysis()                     POST /accounts/{id}/analysis
   ▼                                              │
generateUnifiedAnalysis() ───────────────────────►  account-analysis Lambda (API mode)
   │  (polls every 4s until ready)                 │  - returns cached result if ready
   │                                               │  - else marks "processing" and
   │                                               │    async-invokes ITSELF as a worker
   ▼                                               ▼
UnifiedAnalysisResponse  ◄──────────────────── account-analysis Lambda (worker mode)
   │                                               │  1. gather intelligence (parallel)
   ├─ Approach (4 questions)                        │  2. assemble one big context
   ├─ Buzz                                          │  3. single Bedrock call (Claude)
   ├─ Now                                           │  4. sanitize output
   └─ Next Steps / Key Asks                         │  5. write result to cache table
```

Key files:
- Orchestration + prompts: `backend/lambdas/account-analysis/index.ts`
- Model client: `backend/lambdas/shared/bedrock.ts`
- Web search: `backend/lambdas/shared/tavily.ts`
- AWS knowledge base (RAG): `backend/lambdas/shared/knowledge-base.ts`
- AWS documentation MCP: `backend/lambdas/shared/mcp.ts`
- Infra / config: `backend/lib/stack.ts`
- Frontend trigger + display: `src/App.tsx`, `src/components/ExecBrief.tsx`
- API types + polling: `src/services/api.ts`

### 2.1 The async worker + polling pattern (why it exists)

API Gateway has a hard ~29-second timeout. The analysis does heavy web search +
a large model call that can exceed that. So `account-analysis` runs in two modes
(`backend/lambdas/account-analysis/index.ts`, `handler`):

- **API mode** (called by the frontend): if a finished result is cached, return
  it; otherwise mark the job `processing`, asynchronously invoke the *same* Lambda
  as a worker (`InvocationType: 'Event'`), and immediately return
  `{ status: 'processing' }`.
- **Worker mode** (`event.__worker === true`): runs the full generation with no
  gateway timeout, then writes `{ status: 'ready', data }` to the DynamoDB cache
  table (`INTELLIGENCE_CACHE_TABLE`).

The frontend `generateUnifiedAnalysis` (`src/services/api.ts`) polls the endpoint
every 4s (up to ~120s) until `status !== 'processing'`.

> When training an agent to add a *new* heavy generator, replicate this pattern.
> The Slides endpoint does **not** use it (it is a single blocking call), which is
> why large slide generations can time out.

### 2.2 Caching and cache invalidation

`analysisCacheKey(accountData)` builds a stable key from the inputs that affect the
analysis: a normalized company name, the **attendee count**, the **length of the
captured Salesforce/plan text**, and a **signature of uploaded documents** (count +
total text length). A version prefix (`analysis-v17:`) lets us invalidate all
caches at once. Result: adding attendees, capturing Salesforce data, or uploading a
document changes the key and forces a fresh analysis that incorporates the new data.

---

## 3. The foundation model

- **Model:** Anthropic **Claude Haiku 4.5** (`us.anthropic.claude-haiku-4-5-20251001-v1:0`)
  via **AWS Bedrock**, region `us-east-1`. Configured as `BEDROCK_MODEL_ID` in
  `backend/lib/stack.ts` and read in `backend/lambdas/shared/bedrock.ts`.
- **Two invocation helpers** (`shared/bedrock.ts`):
  - `invokeClaudeJSON<T>(system, messages, {maxTokens, temperature})` — used for
    structured output. It strips markdown code fences, isolates the JSON
    object/array, and includes a **best-effort repair** for JSON truncated at the
    token limit (`repairTruncatedJson` balances quotes/braces). If parsing still
    fails it returns `{ raw: text }` rather than throwing.
  - `invokeClaudeText(...)` — same call, returns raw text.
- **The model contributes two things:** (a) general reasoning/synthesis ability,
  and (b) a set of **trained-in domain facts** that the prompt explicitly licenses
  it to cite (see §5.4).

For the unified analysis the call is made with `maxTokens: 5000` and
`temperature: 0.45` (lower temperature = more grounded, less florid).

---

## 4. The four intelligence sources

At generation time the worker gathers intelligence **in parallel**, each call
wrapped in `withTimeout(...)` so a slow/failed source degrades gracefully (returns
an empty string) instead of blocking the whole analysis.

### 4.1 Live public web search — Tavily (`shared/tavily.ts`)

The primary source of *current, company-specific* facts. Uses the Tavily Search API
(`https://api.tavily.com/search`, server-side `TAVILY_API_KEY`). Wrappers:
- `tavilySearch(query, opts)` — general web search, returns formatted
  `[title](url)\ncontent` blocks (optionally a summary answer).
- `tavilyLinkedInSearch(query)` — same, constrained to `linkedin.com`.
- `tavilyGlassdoorSearch(query)` — constrained to `glassdoor.com`.

For each account the analysis runs several searches (see §5.1), covering: what the
company does, strategic priorities & recent news, cloud/AI hiring, executive
leadership, and employee sentiment. Searches are **region/language-aware** — e.g.
LATAM accounts get Portuguese/Spanish queries — so non-US companies surface real
local data instead of thin English results.

### 4.2 AWS T&C Knowledge Base — Bedrock RAG (`shared/knowledge-base.ts`)

Retrieval-augmented generation against a Bedrock **Knowledge Base**
(`KNOWLEDGE_BASE_ID`, currently `TJHYCVRLXH`) via `bedrock-agent-runtime`'s
`RetrieveCommand` (vector search). `retrieveFromKnowledgeBase(query, maxResults)`
returns concatenated text chunks (capped ~3000 chars). `getTCStrategyContext(
industry, persona, topics)` issues persona/industry-scoped queries and returns the
combined context (capped ~4000 chars). This is AWS's own curated **T&C training
strategy** material.

### 4.3 AWS Knowledge MCP server — product docs (`shared/mcp.ts`)

Calls the AWS Knowledge MCP server (`https://knowledge-mcp.global.api.aws`,
`search_documentation` tool, topic `training-certification`) for official AWS T&C
product documentation. `getTCProductKnowledge(industry, topics)` searches for
things like "AWS Training Certification {industry} workforce development" and
"AWS Skill Builder enterprise subscription features" (capped ~2000 chars). This
grounds any AWS-product references in real documentation.

### 4.4 Model-native domain expertise (curated proof points)

The prompt explicitly authorizes the model to cite a fixed set of well-known
industry statistics from its own training — for example: BCG's finding that ~6% of
companies are AI leaders and have ~13x more AI-skilled workers; the "10-20-70"
split (70% of AI value is people/process/org change); Forrester's ~229% training
ROI; AWS enterprise-program figures (234% ROI, 85% participation, 65%
pilot-to-production); 88% of managers at mature orgs role-model AI vs 25% at
laggards. These are the assistant's "consultant's proof points."

> **Integrity caveat to teach any agent:** these statistics come from the model's
> training and are **hard-coded as citable in the prompt — they are not fetched or
> fact-checked live per run.** They are treated as durable, well-known figures. The
> model is instructed to cite the *right* one for the moment, not dump them all.

### 4.5 Source reliability posture

Every external source can fail silently (network, missing key, no results) and the
system is built to tolerate that: each returns `''`/`[]` on failure, wrapped in
`withTimeout`. A thinner analysis is preferred over a failed one. The prompt tells
the model to be honest and consultative when research is thin (lean on
industry + stated priority, recommend discovery questions) rather than fabricate.

---

## 5. How the analysis is assembled (`generateAnalysis`)

`generateAnalysis(accountData, tcData)` in
`backend/lambdas/account-analysis/index.ts` is the heart of the system.

### 5.1 Step 1 — gather intelligence in parallel

Determines `industry`, `companyName`, `geo`, picks a locale query set
(`localeMap`), then fires (all `withTimeout`-guarded, run concurrently):
- `getTCProductKnowledge(...)` — MCP product docs (3s budget)
- `getTCStrategyContext(...)` — Bedrock KB strategy (3s budget)
- `tavilySearch(profileQ)` — what the company does (6s)
- an English profile search too, for non-NAMER geos (dual local + global coverage)
- `tavilySearch(strategyQ)` — strategy & news (6s)
- `tavilyLinkedInSearch(... hiring cloud AI data engineer roles ...)` (6s)
- `tavilyLinkedInSearch(... CEO CTO CIO CHRO executive leadership ...)` (6s)
- `tavilyGlassdoorSearch(... employee reviews culture L&D ...)` (6s)

### 5.2 Step 2 — assemble ONE context block

All gathered material plus the account payload is concatenated into a single
context string with an explicit **source hierarchy** (see §6): captured
Salesforce/uploaded docs/attendees first (authoritative), then knowledge base and
product docs, then public web search as supplementary color. The account's own
fields (segment, geo, SFDC priority, SMGS phase, T2K, signals, `public_intelligence`,
`ebc_data`, `tc` pipeline `tcData`) are all inlined.

### 5.3 Step 3 — single Bedrock call → structured JSON

One `invokeClaudeJSON<UnifiedAnalysisResponse>` call produces **all** sections at
once, guaranteeing internal consistency. The system prompt sent is
`CONDENSED_SYSTEM + '\n\n' + SYSTEM_PROMPT`, and a long, explicit `userMessage`
instructs the model *how* to be insightful and returns a strict JSON schema.

### 5.4 The two-part system prompt

There are two prompt blocks, both in `account-analysis/index.ts`:

- **`SYSTEM_PROMPT`** — the task frame + hard rules:
  - **Uniqueness Mandate** ("THE #1 RULE"): output must be bespoke; no reusable
    frameworks; explicitly bans canned phrases ("squad-level AI fluency",
    "capability assessment", "90-day pilot", "operating model", etc.) unless the
    specific data truly warrants them. *"Escalate specificity as data grows."*
  - **One connected story:** Buzz informs Approach; Approach/Buzz/Now reinforce;
    Next Steps & Key Asks follow from the same analysis; no section may contradict
    another.
  - **Executive tone:** boardroom language (outcomes, competitive position,
    workforce, ROI) — not technical services/architectures.
  - **Attendee rule** (see §7).
  - **Format rules:** each Approach field is a 1–2 sentence summary with a matching
    `_detail`; exactly 4 `next_steps`, 4 `key_asks`, 4 `now_initiatives`; empty
    arrays allowed; never pad with invented facts.
- **`CONDENSED_SYSTEM`** — a compact persona ("world-class AI Skills Transformation
  expert from AWS T&C") + the sharpest guardrails, deliberately short so the whole
  prompt fits within timing/latency budgets. It restates: use the research / be
  specific; uniqueness is #1; the **data-integrity line** (allowed vs forbidden);
  attendee handling; name-integrity (never use initials/fragments as a person);
  **never narrate absence of data**; no assumptions about training state; captured
  Salesforce data is primary.

### 5.5 Step 4 — sanitize (`sanitizeAnalysis`)

A deterministic safety net runs on the model output. It strips any sentence that
narrates a data gap or comments on attendee presence/absence (regex bank matching
"no confirmed attendees", "based on limited search results", "the search did not…",
"zero detected hiring", etc.), then tidies leftover punctuation/casing. This
guarantees such phrases never reach the UI **regardless of model behavior** — the
prompt forbids them *and* the code removes them.

---

## 6. The data hierarchy (the single most important rule for quality)

When multiple sources are present, they are **layers to synthesize, not competing
truths**, with this precedence:

1. **Captured Salesforce / account summary data** (`accountPlanText`) — internal AWS
   intelligence (opportunities, pipeline, spend, stakeholders, priorities). **Most
   authoritative**; outranks public web search.
2. **Uploaded documents** (`externalDocs[]` — Databooks, briefs) — the *depth* layer:
   drivers, trends, executive intelligence, suggested next steps. Treated as the
   richest source; mine deeply.
3. **Attendee list** (`ebc_data.attendees`) — exactly who is in the room.
4. **AWS knowledge base + MCP product docs** — reinforcement.
5. **Public web search** — supplementary color; never overrides internal sources.

The prompt instructs the model to **triangulate**: connect an internal Salesforce
fact (an open opportunity, a named stakeholder, spend) to a document-identified
driver and to a confirmed attendee's role, so every recommendation is grounded in
the combined picture. Convergence across sources = the strongest insight.

**Progressive enrichment:** with only a company name it produces a public-footprint
analysis; add Salesforce capture and it re-derives around real opportunities/
stakeholders; add documents/attendees and it re-derives around those specifics.
More data ⇒ more bespoke, never a fall back to a template.

---

## 7. Integrity guardrails (what keeps it trustworthy)

These are the rules an agent MUST preserve to keep output credible:

- **No fabrication.** State only what the research/data supports. Do not invent what
  the company does, executive names/titles, numbers, quotes, or initiatives. If a
  single vague snippet exists, do not amplify it into a bold claim.
- **Names:** only name a person with a full real name from the research or the
  attendee list. Never present initials/fragments ("M.A.") as a person — use the
  role instead ("the CEO").
- **Attendees:** confirmed attendees come **only** from the provided list. If the
  list is empty, center `who_to_focus` on real executives found online (named as
  people to engage), never called "attendees", with no disclaimer about a missing
  list. The words "attendee/attend/attending" must not appear in `who_to_focus`
  unless a list was provided.
- **Never narrate absence of data** in any field (no "no confirmed attendees", "zero
  detected hiring", "no social activity found"). Omit silently; speak to what is
  known or what the industry/priority implies. Enforced by prompt **and**
  `sanitizeAnalysis`.
- **No assumed training state.** No claims about their certifications / Skill Builder
  / "greenfield" unless it appears in captured/uploaded data.
- **Proof-point statistics** are citable expert knowledge (the exception to "only
  use provided facts"), but must be the right stat for the moment.

---

## 8. What it produces — `UnifiedAnalysisResponse`

One JSON object (defined in `account-analysis/index.ts` and mirrored in
`src/services/api.ts`) drives the entire UI. Fields:

**Approach** (the four EBC questions; each summary + expandable `_detail`):
- `who_to_focus` / `who_to_focus_detail` — who to prioritize and why (tied to their
  real agenda).
- `what_conversations` / `what_conversations_detail` — the one bold, distinctive
  conversation angle (the non-obvious hook).
- `where_to_start` / `where_to_start_detail` — the recommended entry approach.
- `whats_happening` / `whats_happening_detail` — the dynamic in their world creating
  urgency now.

**Buzz** ("what people are saying"):
- `buzz_summary` — signal synthesis.
- `buzz_executive_insights: string[]` — one insight per real executive found.
- `buzz_hiring_analysis: { roles: {title,url}[], why_this_matters }` — real open
  roles + what the skills gap means.
- `buzz_sentiment_analysis: { signals: string[], why_this_matters }` — employee
  sentiment.
- `buzz_tc_opportunity` — the distinctive workforce-development approach for *this*
  company.

**Now** ("what to focus on now"):
- `now_focus`, `now_initiatives: string[]` (4), `now_key_asks: string[]` (4),
  `now_opening_move`.

**Next Steps & Key Asks:**
- `next_steps: string[]` (4) — concrete sequenced **actions the AWS team takes**,
  each tracing to a specific captured/document fact.
- `key_asks: string[]` (4) — specific things to **secure from the customer**,
  distinct from next steps.

The `userMessage` explicitly requires next_steps (actions we take), key_asks
(things we request), now_initiatives (strategic plays) and now_key_asks to be
**mutually distinct**, and all to reference specific facts from the newest data.

### 8.1 Downstream products built from the same analysis

The single analysis object feeds every other feature so they stay consistent:
- **Approach / Now / Buzz / Next Steps / Key Asks** UI (`ExecBrief.tsx`, `App.tsx`).
- **Conversation quote** ("Here is a Quote") — actually from `engagementPlans` /
  `generateEngagementPlan`, *not* from `analysis` (an agent extending export should
  know this distinction).
- **Slides deck** (`generate-slides` Lambda) — built from the analysis.
- **Downloadable analysis document** (`exportAnalysisToDocx` in
  `src/services/slideExport.ts`) — Word export of Approach + quote + Now + Buzz +
  Next Steps + Key Asks.

---

## 9. Inputs the system consumes

- **Account/EBC data** (`Account`, `src/types.ts`): `customer_name`, `industry`,
  `segment`, `geo`, `sfdc_data` (priority, SMGS phase, T2K, open opps),
  `ebc_data` (dates, themes, attendees, location), `public_intelligence`, `signals`,
  `tc_current_state`, `tc_opportunity_score`.
- **T&C pipeline** (`tcData`) — pipeline value, open opps, products, students,
  loaded from an uploaded `tc-opportunities.xlsx` in S3 via the `tc-data` Lambda.
- **Captured Salesforce text** (`accountPlanText`) — scraped by the browser
  extension from the SFDC page and posted into the app.
- **Uploaded documents** (`externalDocs[]`) — account plans, briefs, Databooks
  (txt/csv/docx/pdf/xlsx), text-extracted client-side.
- **Attendee list** (`ebc_data.attendees`) — imported from CSV/TSV/Excel/Word/PDF/
  TXT (multiple files supported; merged + deduped), parsed in
  `src/services/attendeeParser.ts`.

---

## 10. How to extend or retrain (guidance for a new agent)

1. **Change the "expertise" ⇒ change the prompts**, not the code. The persona,
   uniqueness mandate, integrity rules, and proof points all live in
   `SYSTEM_PROMPT` + `CONDENSED_SYSTEM` in `account-analysis/index.ts`. Editing them
   changes behavior across every derived feature at once.
2. **Add a new intelligence source** by writing a `shared/*` helper that returns a
   string (empty on failure), calling it inside `generateAnalysis` **in parallel**
   with `withTimeout`, and inserting its text into the context block at the correct
   place in the hierarchy (§6). Bump the cache-key version prefix if it changes
   output.
3. **Preserve the guardrails.** If you add fields or sources, extend
   `sanitizeAnalysis` so no data-gap narration or attendee-absence commentary can
   leak, and keep the "no fabrication / names / attendees / no-absence" rules.
4. **Respect timing.** Heavy work must use the async worker + polling pattern
   (§2.1); keep the prompt lean enough to finish within budget.
5. **Keep sections distinct and consistent.** The whole value proposition is one
   connected, non-contradictory story with mutually-distinct action lists.
6. **Update the cache key** whenever you introduce a new input that should change
   the output (`analysisCacheKey`).

---

## 11. Known limitations & risks to communicate

- **Proof-point stats are model-native and not verified live** (§4.4) — reliable as
  well-known figures, not per-run fact-checked.
- **Slides endpoint is a single blocking call** (no worker/poll) and can hit the
  ~29s API Gateway limit on large inputs; the frontend now surfaces a timeout error
  with retry, but the durable fix is to convert it to the worker pattern.
- **External research can be thin or fail** for low-footprint or non-English
  companies; the system degrades to industry/priority-based, discovery-oriented
  advice rather than failing.
- **Secrets in source:** the Tavily API key and Knowledge Base ID are currently
  committed in `backend/lib/stack.ts`. This is a security risk; they should be moved
  to a secrets manager / injected env before wider distribution.
- **Attendee parsing for documents (PDF/Word) is best-effort** heuristic text
  extraction; tabular sources (CSV/Excel) are the most reliable.

---

## 12. One-paragraph summary (for quick onboarding)

The assistant's expertise is a Claude (Haiku 4.5, on Bedrock) reasoning engine
steered by a strict "AWS T&C AI-Skills-Transformation consultant" persona prompt,
fed at request time with (a) live web search via Tavily about the specific company,
(b) RAG over an AWS T&C strategy Knowledge Base, (c) AWS product docs via an AWS
Knowledge MCP server, and (d) a curated set of citable industry proof points from
the model's own training — all layered beneath the user's own Salesforce capture,
uploaded documents, and attendee list, which are treated as authoritative. It fuses
these into one internally-consistent JSON analysis (Approach, Buzz, Now, Next Steps,
Key Asks) under a hard "make it uniquely about THIS company / never fabricate /
never narrate missing data" mandate enforced by both the prompt and a
post-processing sanitizer, runs asynchronously with caching to beat gateway
timeouts, and reuses that single analysis for the on-screen brief, the slide deck,
and the downloadable document.
