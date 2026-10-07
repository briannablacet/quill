# Quill

> **New here?** Read [`START-HERE.md`](START-HERE.md) first: a short tour of what the app does and why. This README is the technical map.

Quill is an **agentic content-marketing system**. You ask for content (a blog post, landing page, case study, social posts, a battlecard, taglines) or for research (competitor messaging, search rankings, content ideas). Quill queues the work as tasks, and a background worker runs AI agents that write it, **score it**, and **rewrite it if the score is too low**, without you having to push it along.

It's a single-user personal tool. Its design draws on Skribil's content capabilities (`marketing-content-lab`) and the architecture of `chief-of-staff-dashboard`, which it was originally cloned from. The design brief is in **`migration.md`**.

---

## How it works, in one pass

```
You (a page, or the floating assistant)
  └─ POST /api/content/generate, /api/ideas/generate, /api/competitive/generate, /api/serp/generate …
       └─ enqueueTask()  →  Mongo `tasks` collection   (status: queued)

Vercel Cron, every minute
  └─ GET /api/worker
       ├─ claims up to 5 queued tasks
       ├─ runTask()  →  the agent for that task type  (lib/agents/)
       ├─ saves the result  (status: done / failed, with retries and backoff)
       └─ enqueueFollowUps()  →  queues the next step automatically

The page polls  GET /api/tasks/[taskId]  and shows the result when it's done.
```

**The chain that makes it "agentic":**

1. `generate_content`: the **writer** drafts the piece, using your brand profile and company profile.
2. For blog posts, landing pages and case studies, a `score_content` task is queued automatically. The **evaluator** grades the draft against a scorecard.
3. If the score is **below 90**, Quill automatically queues a regeneration that targets the flagged issues, then scores the new draft.
4. A rewrite can fix every flagged issue and still score worse overall. Quill records whether the regeneration **improved or regressed**, so a worse draft never silently replaces a better one.
5. You can also trigger a rewrite yourself ("Fix This"). That's a `revise_content` task, scored the same way.

Long AI calls never run inside a web request. That's deliberate: each worker run has a fixed time budget (55 s per run, 50 s per task), and a slow task is recorded as a failure and retried rather than left stuck.

---

## Where things are

```
app/                              Next.js App Router
├── page.tsx                      home: links to the four modules (Studio, Competitive, SERP, Ideas)
├── studio/                       ★ main workspace: generate new content, or paste/upload existing content to grade it; history
│   └── [contentId]/              one piece of content: draft, scorecard, "Fix This", revisions
├── ideas/                        content ideas from search-ranking data
├── competitive/                  competitor messaging and positioning analysis
├── serp/                         tracked keywords and what's ranking for them over time
├── settings/                     brand profile + company profile
├── sign-in/, sign-up/, reset-password/
└── api/
    ├── worker/                   ★ the task runner (Vercel Cron, every minute)
    ├── tasks/[taskId]/           task status, for polling
    ├── content/                  list, generate, revise, upload, get one
    ├── ideas/, competitive/, serp/    list, generate, get one
    ├── brand-profile/, company-profile/
    ├── assistant/chat/           the floating assistant (tool-calling, see below)
    ├── auth/[...all]/            better-auth handler
    └── dev/                      test-only routes (test-generate, test-competitive)

lib/
├── tasks.ts                      ★ the task queue: enqueue, claim, complete, fail, retry/backoff
├── agents/
│   ├── index.ts                  ★ dispatcher (task type → agent) and enqueueFollowUps (the chain above)
│   ├── writer.ts                 drafts content for each mode
│   ├── evaluator.ts              scores drafts against a scorecard
│   ├── reviser.ts                rewrites a draft to fix specific issues
│   ├── competitive-intel.ts      analyzes what competitors' ranking pages say
│   ├── serp-monitor.ts           tracks rankings for keywords over time
│   ├── serper.ts                 Google search results via the Serper API (shared by the two above)
│   ├── ideation.ts               suggests ideas from real ranking data
│   ├── brand-profile.ts          extracts a brand profile from uploaded style-guide / messaging docs
│   ├── company-profile.ts        company facts the writer can rely on
│   └── prompts/                  one prompt file per content type and scorecard
├── parse-document.ts             text from uploaded .docx (mammoth) and .pdf (pdf.js)
├── session.ts                    getUserId(): who's signed in (see "Auth" below)
├── auth.ts, auth-client.ts       better-auth setup
├── mongodb.ts                    MongoDB client
└── db/                           Postgres (Drizzle) schema for auth tables

components/
├── quill/                        the app's screens: workspace, generate/upload panels, scorecard view,
│                                 ideas / competitive / SERP / settings panels, assistant widget, nav
└── ui/                           shadcn-style UI primitives
```

### Task types

| Task | Agent | Triggered by |
|---|---|---|
| `generate_content` | writer | Studio, or the assistant |
| `score_content` | evaluator | automatically after generating or revising a blog post, landing page or case study |
| `revise_content` | reviser | "Fix This", or automatically after a low score |
| `fetch_competitor_content` | competitive-intel | Competitive page, or the assistant |
| `monitor_serp` | serp-monitor | SERP page, or the assistant |
| `suggest_ideas` | ideation | Ideas page, or the assistant |

Content modes the writer handles: `blog_post`, `landing_page`, `case_study`, `social_media`, `battlecard`, `taglines`.

### The assistant

The floating assistant (`components/quill/assistant-widget.tsx` → `app/api/assistant/chat/`) is a real tool-calling chat, not an FAQ bot. Its tools (`post`, `rankings`, `competitors`, `ideas`) enqueue the same tasks the page buttons do, so there's one execution path, and no long work happens inside the chat request.

---

## Data

**MongoDB** (`MONGODB_URI`), for everything the app works with:

| Collection | Holds |
|---|---|
| `tasks` | the queue: type, payload, status, attempts, result/error |
| `content` | drafts, scores, scorecards, revision lineage (`regeneratedFrom`) |
| `brand_profiles` | one per user, extracted from uploaded brand documents |
| `company_profiles` | company facts |
| `competitive_intel` | competitor messaging analyses |
| `serp_snapshots` | ranking snapshots over time |
| `ideas` | generated content ideas |

**Postgres** (`DATABASE_URL`), only for sign-in: better-auth's `user`, `session`, `account` and `verification` tables, defined with Drizzle in `lib/db/schema.ts`.

**AI:** Claude (`anthropic/claude-sonnet-5`) through the Vercel AI SDK (`ai` package) and Vercel AI Gateway.

---

## Auth

Sign-in uses **better-auth** (email and password) on Postgres. `lib/session.ts` decides the current user:

- **In development, or when `DEMO_MODE=true`:** everyone is a fixed user, `dev-test-user`, so the UI works without a Postgres connection.
- **Otherwise:** the real better-auth session.

`DEMO_MODE` was meant as a temporary switch for showing the deployed site before real sign-in was set up.

---

## Running it locally

```bash
pnpm install
pnpm dev
```

The worker only runs when something calls `/api/worker`. On Vercel that's the cron in `vercel.json`. Locally, call it yourself to process queued tasks: open `http://localhost:3000/api/worker`, or, if `CRON_SECRET` is set, `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/worker`.

| Variable | What it's for |
|---|---|
| `MONGODB_URI` | All app data |
| `DATABASE_URL` | Postgres for better-auth (not needed in dev, see Auth) |
| `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL` | Auth base URL (falls back to Vercel's URLs) |
| `SERPER_API_KEY` | Google search results for SERP monitoring, competitive intel and ideation |
| `CRON_SECRET` | Protects `/api/worker` |
| `DEMO_MODE` | `true` = skip real sign-in (see Auth) |
| AI Gateway credentials | Claude calls through Vercel AI Gateway (provided automatically on Vercel; locally set `AI_GATEWAY_API_KEY`) |

---

## Things to know before reading the code

- **Start with three files:** `lib/tasks.ts` (the queue), `lib/agents/index.ts` (what runs, and what triggers what), and `app/api/worker/route.ts` (the runner). Everything else is an agent or a screen on top of those.
- **Leftovers from `chief-of-staff-dashboard`** (Quill was cloned from it), unused by anything in Quill: `lib/cos-data.ts`, `lib/job-fetcher.ts`, `lib/parse-resume.ts`, `lib/export-resume.ts`, and `scripts/cleanup-default-user.mjs`. They're also why `ADZUNA_*` and `JSEARCH_API_KEY` appear in the code. Safe to ignore.
- **`app/api/dev/`** routes are for testing agents directly.
- **`migration.md`** is the full design brief: why it's built as a task queue, what each phase added, and the decisions behind it.
