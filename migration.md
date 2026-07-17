# Quill: Agentic Content Operating System — Migration Brief

**Purpose:** This document was originally the working brief for migrating `chief-of-staff-dashboard` from a batch pipeline with agent-themed UI into a genuinely agentic architecture. It now doubles as the brief for Quill, a new, separate project: a content-marketing operating system built as a hybrid of that target architecture, Skribil's content capabilities, and a personal business-case doc's orchestration-layer concept — meant to demonstrate what a truly ambient agentic system can do, not just ship a content tool.

**Relationship to other personal tools (not part of this build):** `chief-of-staff-dashboard` is a separate, existing decision-support tool for job search — it keeps running unmodified. A future tool for finding airline-points deals is planned as another separate project. Quill shares architecture patterns with `chief-of-staff-dashboard` but no code dependency, no shared data, and nothing job-search-specific (e.g. the JSearch/RapidAPI decision in the original brief does not apply here — see §6).

**Repo note (2026-07-14):** This repo was cloned from `chief-of-staff-dashboard`, renamed to `quill`, and detached from the original's GitHub remote. Section 2 documents an audit of Skribil (`marketing-content-lab` + its separate `MCL-backend`), the production content-marketing app this build also draws from. Section 3 documents the personal business-case doc that this build also draws from — its conversational-agent front-end was named "Otto" there; here, both the project and its conversational interface (§3, §4) are simply **Quill**.

**Scope:** Single user, no multi-tenancy. Keep it simple — this is a personal tool, not a product being sold to multiple accounts.

**Audience:** Claude Code session driving the rebuild, plus future contributors.

---

## 1. Current-State Assessment

### What the system actually is today

A linear batch pipeline triggered by Vercel Cron at 7:00 AM UTC:

```
fetch (Adzuna + JSearch, parallel)
  → dedupe (by sourceId and company|role)
  → keyword score (hardcoded weights)
  → filter (min score, dealbreakers)
  → generate cover letters (sequential, sleep(2000) between calls)
  → upsert to MongoDB
```

### Known issues (in priority order)

1. **The four "agents" in `lib/cos-data.ts` are UI decoration.** Their system prompts are never sent to any LLM. Activity metrics ("214 listings scanned today", "accuracy: 96%") are hardcoded display data. The dashboard shows fiction.

2. **No LLM evaluates job fit.** The "Resume Scorer Agent" is `scoreJobKeywords()` in `pipeline.ts` — pure keyword matching (title 40pts, location 20, seniority 20, salary 20). The resume is never read during scoring.

3. **Only one LLM call exists** — cover letter generation in `generateCoverLetter()`, using `openai/gpt-4.1-nano`. The resume is truncated to 400 characters and the job description to 800–1000 characters in the prompt. Letters are written from stubs.

4. **The entire run lives inside one serverless function** (`maxDuration = 300`). Sequential letter generation with 2-second sleeps burns the budget. No retries, no partial recovery — a failure mid-run loses the remaining work.

5. **Cron is the only trigger.** No event triggers, no on-demand dispatch with orchestration. `POST /api/jobs/run` exists but calls the same fixed pipeline.

### What's worth keeping (do not rewrite these)

- **Data model** (`lib/actions.ts`): `DirectivesDoc`, `MatchDoc`, `CoverLetterEntry`, the status lifecycle (`New → Reviewing → Applied → Interviewing → Offer / Rejected / Not a Fit`), multi-resume support with `isDefault`, and the `breakdown[]` structure. This survives nearly untouched.
- **Job fetcher adapters** (`lib/job-fetcher.ts`): clean per-source functions, parallel fetch, source tagging. Keep the adapter pattern — it extends naturally to content sources later.
- **Dedup and actioned-status logic** in `pipeline.ts`: skipping only explicitly actioned jobs while re-scoring unactioned ones keeps the feed fresh. Keep this behavior exactly.
- **Auth** (better-auth) and the **UI shell**. The dashboard components can stay; they will simply start displaying real activity.

---

## 2. Skribil (`marketing-content-lab`) Audit

**Purpose of this section:** Quill is meant to merge this project's target architecture with what's reusable from Skribil, the production content-marketing app. This is what a direct audit of that codebase (`/Users/briannablacet/GitHub/marketing-content-lab`, plus its separate backend `/Users/briannablacet/GitHub/MCL-backend`) found.

### What Skribil actually is

Three separate, loosely-connected backends — not one:

1. **`marketing-content-lab` (Next.js)** — has its own direct MongoDB connection (`lib/mongodb.ts`) and a single 3,626-line API route, `src/pages/api/api_endpoints.ts`, that mode-switches across ~25 content-generation capabilities (taglines, personas, mission/vision, ab-test, email-nurture-flow, battlecard, case-study, style-checker/fixer, campaign-generation, landing-page, etc.) and calls OpenAI directly inline.
2. **`MCL-backend` (Express + Mongoose, separate repo)** — owns auth (custom JWT + bcrypt + Google OAuth), Stripe subscriptions, and a narrow content-humanizer feature. The only `node-cron` job in the whole system is nightly Stripe reconciliation — no content-related scheduling exists anywhere.
3. **The browser's `localStorage`** — this is where generated content actually lives. `ContentLibraryService.ts` reads/writes `localStorage.getItem('contentLibrary')`. There is no durable server-side record for most generated output.

**This is the same disease as `chief-of-staff-dashboard`, at larger scale:** one giant synchronous function doing prompt-engineering-as-router, no task/agent abstraction, no durable state for the thing the product actually produces.

### Confirmed debt (verified in code, not just architectural opinion)

- `src/templates.ts` and `src/data/templates.ts` are byte-identical duplicate files.
- `MCL-backend`'s `Content` model (`models/Content.js`) references `Client` and `Framework` Mongoose refs that **don't exist anywhere in the codebase** — this model is dead/broken and can't actually be populated.
- Two independent MongoDB connections (frontend's `lib/mongodb.ts` direct driver, backend's Mongoose) with no shared schema between them.

### What's genuinely reusable

- **Prompt library** — the ~25 modes in `api_endpoints.ts`, despite the monolith packaging, are a real, battle-tested prompt corpus (with anti-hallucination/factual-grounding instructions already iterated on in prod — see the file's header comments). This is exactly the "prompts as versioned files" requirement in §7 below, just needs extraction from the mode-switch.
- **Context/retrieval concept** — `BrandVoiceContext`, `StyleGuideContext`, `WritingStyleContext`, `MessagingContext` already model the "messaging docs/style guide as retrieval layer" idea in Phase 5 — currently client-side React context only, but the *shape* of what needs retrieving is proven out in production.
- **Template system** — the `Template` interface (category, difficulty, dynamic form sections) is a decent pattern for a content-request intake form, once de-duplicated.
- **`VerticalMarket` model** (`lexicon`, `styleGuide`, `complianceNotes`) — the closest thing Skribil has to a real "brand/style guide as data" object; more structured than the frontend contexts.
- **Multi-tenancy shape** — `User.clients[]` (one user manages multiple client brands) is an agency model worth preserving if Quill needs to serve multiple brands per account.
- **Stripe billing integration** — mature; keep as reference when Quill needs billing.

### How this merges with the target architecture (Section 4)

`chief-of-staff-dashboard`'s plan (task queue → orchestrator → LLM agents, MongoDB-backed) is the right skeleton and is *more* mature than anything currently in Skribil — Skribil has no task/agent abstraction at all. The merge is not "combine two architectures" — it's: **use this project's architecture as the chassis, and migrate Skribil's prompt corpus and retrieval-layer concepts into it as new agent/task types**, fixing Skribil's actual production bug (no durable content storage) in the process. See Phase 3 and Phase 5 updates below.

---

## 3. Business Case Origin (personal doc → Quill)

**Provenance:** a business-case/architecture doc written for a Phase 2 project pitched internally at a previous employer (ServiceNow/Moveworks), where it was ultimately killed. It is being rebuilt independently here, decoupled from that employer's branding and specific IP — concepts are fair game, their product names are not. The pitch's conversational-agent front-end was named "Otto"; here, that role — and the project as a whole — is simply **Quill**.

### What the doc validates

The doc's own three-phase model (content-creation layer → full lifecycle system → ambient agent orchestration) maps closely onto this brief's Phase 1–5 structure (§4) and independently arrived at the same shape: structured reference docs feeding a prompt layer, then transformation/governance, then proactive multi-system agents fronted by a conversational interface. That convergence is a good sign the target architecture in §4 is pointed the right way.

### Capability cross-reference

The doc names capabilities that only partially cover what you described wanting to build. Cross-referenced against this brief's Phase 5 (§4):

| Desired capability | Covered by the doc? | Status in this brief |
|---|---|---|
| Write/edit against messaging docs & style guides | Yes — reference-material layer feeding the prompt architecture | Already in Phase 5 (retrieval layer) |
| Competitor article/blog search on target keywords | Yes — "competitive messaging intelligence" | Already in Phase 5 (competitive intel agent) |
| Detect search-algorithm / SEO changes | No — only a passing mention under the orchestration layer | Already in Phase 5 (SERP monitor agent) — net-new, not from the doc |
| Analyze performance reports (what's working/not) | No — the doc's "Content Quality Scorecard" is pre-publish quality grading, not post-publish performance | Already in Phase 5 (performance analyst) — net-new, not from the doc |
| Suggest ideas from the "working" list | No | Already in Phase 5 (ideation agent) — net-new, not from the doc |
| PM tool integration | Yes — Asana/Slack/Google Docs named explicitly under the orchestration layer | Already in Phase 5 |

Net: three of your five capabilities were independently validated by a real business case; two (algorithm-change detection, performance-driven ideation) are genuinely new ground this brief covers that the doc didn't.

### New elements worth adopting from the doc

- **Content Quality Scorecard** — a letter-grade score with a breakdown of *why* plus concrete fix guidance, applied to a draft before publish. This is a good shape for the evaluator agent's output on writer-agent drafts (distinct from the evaluator agent's existing job-fit scoring in §4) — add as a `score_content` task type in Phase 2.
- **Quill (conversational interface)** — a natural-language front door to the orchestrator, so a user can ask for status, trigger tasks, or get proactive surfaced insights (deadlines, SEO changes, feedback) instead of only reading a dashboard. Lands in Phase 5 alongside the other new agents; becomes a consumer of the task queue and agent registry (§4) rather than a new execution path.

---

## 4. Target Architecture

### Core principle

Separate **triggers**, **orchestration**, and **execution**. Cron remains as one trigger among several; the fixed pipeline is replaced by an orchestrator that dispatches discrete tasks to real agents.

```
TRIGGERS                  ORCHESTRATOR                 AGENTS (execution)
────────                  ────────────                 ──────────────────
cron (recurring scan)  →                            →  fetcher      (tool-based, no LLM: competitor content, SERP checks, report ingestion)
webhook (future)       →   reads state,             →  evaluator    (LLM: Content Quality Scorecard, performance analysis)
user action (UI/Quill) →   decides what to enqueue, →  writer       (LLM: content generation across modes, ideation)
agent follow-up        →   monitors task queue      →  [orchestrated follow-up work]
```

**Note on provenance:** the task queue / worker / orchestrator *pattern* below is carried over from `chief-of-staff-dashboard`'s target architecture. The task types are not — Quill has no job-search functionality, so nothing job-domain (`fetch_jobs`, `evaluate_job`, `write_cover_letter`) is ported. Every task type here is content-native from Phase 1 onward.

### Components to build

**Task queue (DB-backed, no new infra).** A `tasks` collection in Quill's MongoDB:

```typescript
type TaskDoc = {
  taskId: string
  userId: string
  type: "generate_content" | "score_content" | "fetch_competitor_content" | "monitor_serp" | "analyze_performance" | "suggest_ideas"
  payload: Record<string, unknown>
  status: "queued" | "running" | "done" | "failed"
  attempts: number
  maxAttempts: number        // default 3
  result?: Record<string, unknown>
  error?: string
  createdAt: Date
  updatedAt: Date
}
```

A worker endpoint claims queued tasks (findOneAndUpdate with status transition — atomic claim), executes, records results. Vercel Cron can tick the worker every minute; each tick processes a small batch, which sidesteps the 300-second ceiling entirely.

**Orchestrator.** No direct code predecessor — built fresh, following `chief-of-staff-dashboard`'s `runJobPipeline()` only as an architectural reference for "reads state, decides what to enqueue." On a recurring trigger (or user/Quill-initiated request): enqueue `generate_content` or `fetch_competitor_content` tasks. When a `generate_content` task completes, the orchestrator enqueues a `score_content` follow-up automatically. This is where agentic behavior lives: the orchestrator enqueues follow-up work based on results rather than following a fixed script.

**Evaluator agent — Content Quality Scorecard (§3).** LLM evaluation of a content draft against the retrieval layer (messaging docs, style guides, brand voice — Phase 5, §2's `BrandVoiceContext`/`StyleGuideContext`/`VerticalMarket` concepts promoted to real data). Returns structured JSON: `{ grade: "A"–"F", score: 0-100, breakdown: [{criterion, met, note}], fixGuidance: string[] }`. Use a capable model (Claude Sonnet class) — evaluation quality is the product, same principle as `chief-of-staff-dashboard`'s evaluator.

**Writer agent.** Generates content across modes (blog post, tagline, landing page, email, etc.) — the `generate_content` task type, parametrized by `mode`. Each mode's prompt is extracted from Skribil's `api_endpoints.ts` mode-switch (§2) into its own versioned file (§7), one at a time rather than all at once. Full context in, always (no truncated inputs — that was `chief-of-staff-dashboard`'s cover-letter bug, not one to repeat here).

**Content persistence (fixes a real Skribil bug).** Generated content is stored as a real Mongo document (one collection, one document per generated asset — `topic`, `mode`, `body`, `status`, `score`, `createdAt`), never in `localStorage`. Skribil's `ContentLibraryService` currently persists only to the browser, so content doesn't survive a cleared cache or a second device; Quill should not repeat this.

**Agent registry.** A DB-backed registry where each agent (fetcher, evaluator, writer) has: config, an actually-used system prompt, tool access, and real activity counters incremented by task completion. The dashboard reads live data — no hardcoded metrics, per the ground rule Quill inherits from `chief-of-staff-dashboard`'s own `cos-data.ts` mistake (§1).

---

## 5. Migration Plan (phased, each phase shippable)

**Phase 1 — Task queue + worker + first real content task.** Add `tasks` collection, worker endpoint, atomic claim logic, retry with backoff — all domain-agnostic infrastructure. Validate the loop end-to-end with one real task type: `generate_content`, a single mode (e.g. blog post) extracted from Skribil's prompt corpus (§2), full context in, output persisted as a real Mongo document. *Outcome: working queue/worker infra, and the first genuinely agentic (and durably stored) content task — no legacy job-search code ported.*

**Phase 2 — Evaluator agent (Content Quality Scorecard).** Build `score_content` (§3): LLM grades a `generate_content` draft, returns letter grade + breakdown + fix guidance. Wire the orchestrator to enqueue `score_content` automatically after every `generate_content` completes. *Outcome: the evaluator role exists and produces real signal on writer output — quality becomes measurable, not just generated.*

**Phase 3 — Writer agent expansion.** Extract more of Skribil's `api_endpoints.ts` prompt corpus (§2) into versioned prompt files, one mode at a time, each becoming a `generate_content` variant (parametrized by `mode`). *Outcome: broad content-type coverage, all real Mongo documents, none in `localStorage`.*

*Status:* `blog_post`, `taglines`, `social_media`, `landing_page`, `case_study` are built and verified. `boilerplate`/`adapt-boilerplate` intentionally skipped for now. **UI scoping decision:** Quill is going into a work context, and taglines aren't relevant to that work — `taglines` stays fully implemented in the backend (don't delete it, don't degrade it) but should not be offered as a selectable option whenever UI gets built. Revisit if that changes.

**Phase 4 — Orchestrator + live registry.** Orchestrator decides follow-up work based on scores (e.g. low `score_content` grade → automatic regeneration). Agent registry replaces the static `agents[]` array (`lib/cos-data.ts`, inherited from `chief-of-staff-dashboard`) with real counters. Add on-demand triggers from the UI ("re-score this draft", "write me a post about X"). *Outcome: genuinely agentic — system decides its own follow-up work.*

**Phase 5 — Content OS extension.** New agent types on the same framework: competitive intel (`fetch_competitor_content`, keyword-based), SERP monitor (`monitor_serp`, event trigger source), performance analyst (`analyze_performance`, report ingestion), ideation (`suggest_ideas`, works from the analyst's "working" list). Messaging docs, style guides, and banned-words list become a retrieval layer for the writer and evaluator agents — the natural evolution of Skribil's `BrandVoiceContext`/`StyleGuideContext`/`VerticalMarket` concepts (§2) promoted from client-side React context into a real retrieval-backed Mongo collection. PM tool integration (Asana/Linear/Notion via API or MCP) lands here. Quill (§3), the conversational front-end, becomes the primary interaction surface, consuming the task queue and agent registry — not a new execution path.

*Status — competitive intel + SERP monitor:* Built and verified live (`lib/agents/competitive-intel.ts`, `lib/agents/serp-monitor.ts`, `SERPER_API_KEY` set). **Important correction made here:** Skribil's `handleCompetitiveAnalysis` (§2) was never actually a real fetch — it asked the LLM to recall a competitor from training data, with no live data source at all. That's not what got ported. Both new agents share one real data source, `lib/agents/serper.ts` (Serper.dev, real Google search results), consistent with the "same backend, different presentation" structure discussed: competitive intel fetches actual current page text for top-ranking results and analyzes messaging/positioning from what's really there (verified: it caught a real positioning gap — a competitor's top-ranking page was actually reviewing *other* companies' tools, not describing their own product); SERP monitor tracks ranking positions for a keyword over time (new `serp_snapshots` collection) and surfaces what changed since the last check. Note from live testing: back-to-back calls seconds apart can show real Google result volatility that isn't meaningful signal — genuine insight comes from comparing snapshots days/weeks apart, not immediate re-runs.

*Extension — named competitors + battlecard (2026-07-17):* `fetch_competitor_content` now accepts an explicit `competitors: string[]` list (names or URLs) as an alternative to keyword discovery — bare names resolve to a real URL via one Serper search (`resolveCompetitorTarget`, exported for reuse), mirroring Skribil's original `isURL`/`extractDomain` input handling but with a real fetch behind it. Verified live on "HubSpot" and "Jasper AI" by name. New `battlecard` content mode (writer.ts) rebuilds Skribil's `handleBattlecardGeneration` — that prompt asked for "exact rebuttals" and "quotable statistics" about a named competitor with zero real data provided, the same fabrication risk case_study.ts exists to prevent, just uncaught in the original. The rebuilt version fetches the competitor's real page content and grounds every competitor-facing claim in it, explicitly instructed to say when evidence is too thin rather than invent something plausible — verified live against Salesforce Agentforce, including the model correctly noting when a section's own evidence was absent rather than papering over it. One real bug caught and fixed: initial `maxOutputTokens: 2500` truncated the 7-section structure mid-list; raised to 4000.

*Status — ideation:* Built and verified (`lib/agents/ideation.ts`), but scoped differently than originally planned. `analyze_performance` remains unbuilt — no real published-content-with-real-metrics data source exists yet, and none was available to build against (§ Decisions). Rather than block ideation on that, it was rebuilt to work from real Scorecard data instead (`content` collection's `score`/`breakdown` fields) as the closest available substitute for "what's actually working." Verified: every generated idea traces to a specific cited score and criterion, not generic advice. Caveat: with only ~7 scored pieces so far, all thematically narrow (today's test content), the ideas are correspondingly narrow — this is the agent being honest about thin data, not a bug. Revisit whether to build `analyze_performance` for real once actual performance data exists (§ Decisions notes work data may become available).

---

## 6. Decisions Needed Before Phase 1

1. **Product identity:** Decided — Quill is its own repo (cloned from `chief-of-staff-dashboard`, detached from its remote), not a Skribil feature, an in-place Skribil rewrite, or a continuation of the ServiceNow/Moveworks pitch (§3). Decided — personal tool, single user, no multi-tenancy. Don't build for accounts/orgs that don't exist yet.
2. **LLM provider strategy:** Standardize on Anthropic API, keep the Vercel AI SDK abstraction (recommended — it already supports provider swapping), or mix by task type?
3. **Deploy target:** Stay on Vercel (fine with the queue design) or move the worker to something with longer-lived compute?
4. **Auth strategy (from §2 audit):** `chief-of-staff-dashboard` already uses better-auth; Skribil/`MCL-backend` uses custom JWT + bcrypt + Google OAuth. Recommend standardizing on better-auth in Quill rather than porting the JWT system over — cleaner, and consistent with decision #1.
5. **`analyze_performance` data source (new, from §5 build):** No real published-content-with-metrics data exists yet, so this agent is unbuilt. User noted (2026-07-17) they may be able to bring real, non-confidential search/performance data from work — if that materializes, build `analyze_performance` against its actual shape rather than guessing at a format now.

~~JSearch/RapidAPI plan~~ — removed. That decision was about `chief-of-staff-dashboard`'s job-fetching source and does not apply to Quill; Quill has no job-search functionality (see the "Relationship to other personal tools" note above).

---

## 7. Ground Rules for the Rebuild

- Preserve the data model and status lifecycle. UI components should keep working against the same document shapes.
- Every phase ships independently. No big-bang rewrite.
- No mock data, no placeholder metrics. If an agent displays a number, a real task incremented it.
- Evaluation prompts and writer prompts live in versioned files, not inline strings — they are product surface area and will be iterated on.
- Log both scoring systems during Phase 2 before trusting the new one (this rule is inherited from `chief-of-staff-dashboard`'s keyword-vs-LLM comparison; Quill's `score_content` has no prior scoring system to compare against, so it doesn't apply here — noted for when a future agent does replace an earlier heuristic).
- Generated content is always a real database document, never `localStorage`-only (see §2's Skribil finding — this was a real production gap, not a hypothetical).
- When porting a Skribil prompt or feature, extract and clean it — do not copy `api_endpoints.ts`'s mode-switch structure wholesale, and do not carry over duplicate files or dangling model refs (§2).
- Concepts from the §3 business-case doc are fair game; its employer-specific product names ("MAP," "Otto," "Content Studio") are not — use Quill's own naming throughout code, UI copy, and docs.