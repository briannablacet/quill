# Quill — Start Here

Quill is an agentic content-marketing system that explores how AI can move beyond individual generation requests into orchestrated execution, evaluation, and iterative improvement.

This document is intended as a quick orientation to the application. For the full technical architecture, task system, data model, dependencies, and setup instructions, see [`README.md`](README.md).

## The Core Idea

Quill draws on content capabilities explored in Skribil but uses a substantially different execution model.

Instead of performing long AI operations directly inside a web request, Quill represents work as **tasks**.

Those tasks can be queued, claimed by a worker, routed to specialized agents, completed or retried, and used to trigger subsequent work automatically.

The result is a system capable of moving a workflow forward without requiring the user to manually initiate every individual AI interaction.

## The Agentic Content Loop

The clearest example is content creation.

For supported content types, the workflow is:

**Request → Queue → Write → Evaluate → Revise if necessary → Re-evaluate**

More specifically:

1. A user requests content.
2. Quill creates a `generate_content` task.
3. The writer agent creates the draft using the user's brand and company profiles.
4. For supported content types, Quill automatically queues a `score_content` task.
5. The evaluator scores the draft against a defined scorecard.
6. If the content scores below 90, Quill automatically initiates a targeted regeneration addressing the identified problems.
7. The new version is evaluated again.
8. Quill records whether the regeneration improved or regressed so a worse version does not silently replace the better one.

A user can also initiate the revision process manually through **Fix This**.

This means quality evaluation and corrective action are embedded directly into the execution workflow.

## A Quick Tour

### Studio

The primary content workspace.

Users can generate new content or provide existing content for evaluation.

Current content modes include:

- blog posts
- landing pages
- case studies
- social media
- battlecards
- taglines

Individual content views show the draft, scorecard, revisions, and Fix This workflow.

### Competitive Intelligence

Analyzes competitor messaging and positioning using content from ranking pages.

### SERP Monitoring

Tracks search rankings for selected keywords over time.

### Ideas

Uses real search-ranking information to generate content ideas.

### Brand + Company Profiles

Quill maintains reusable context for generation.

The Brand Profile can be extracted from uploaded style guides and messaging documents, while the Company Profile supplies factual company information the writer can rely on.

### Assistant

Quill's floating assistant is a tool-calling interface, not a separate FAQ/chatbot layer.

Its tools can initiate content, ranking, competitor, and ideation workflows by enqueueing the same underlying tasks used elsewhere in the application.

That means the conversational interface and the standard UI share a common execution architecture.

## Relevance to the Current Evaluation

Quill is useful as a reference implementation because it demonstrates a different way of thinking about AI-powered marketing workflows.

Rather than:

> user asks → model responds → workflow ends

Quill can operate more like:

> user establishes intent → system executes → system evaluates → system corrects → user receives the result

That pattern may be useful when evaluating future content workflows where quality, governance, orchestration, or multi-step execution should happen within the system rather than being left entirely to the user.

## Relationship to Skribil

Skribil contains a significantly broader set of marketing capabilities.

It includes strategic onboarding, messaging, positioning, campaign planning, content strategy, channel selection, numerous content-generation modes, repurposing, enhancement, and content management.

Quill intentionally does not reproduce that entire feature set.

Instead, it explores a next-stage execution architecture for selected capabilities.

A useful shorthand is:

- **Skribil** = breadth of the marketing operating model
- **Quill** = agentic orchestration of the work

One potential direction worth evaluating is whether selected Quill patterns—particularly task orchestration, specialized agents, evaluation, and revision—could be incorporated into a broader application foundation.

## Relationship to Content Studio

Content Studio represents a focused ServiceNow implementation of related content-generation and governance concepts.

Quill is not intended as a replacement for Content Studio.

It is being shared to demonstrate architectural patterns that may be relevant as those workflows evolve—particularly asynchronous execution, specialized agents, embedded quality evaluation, and automated corrective action.

## Where to Start in the Code

Three files provide the fastest technical orientation:

**`lib/tasks.ts`**
The task queue: enqueueing, claiming, completion, failure handling, retries, and backoff.

**`lib/agents/index.ts`**
The dispatcher that maps task types to agents and determines which follow-up tasks are automatically triggered.

**`app/api/worker/route.ts`**
The worker that claims and executes queued tasks.

From there, look at:

**`lib/agents/`**
This contains the specialized writer, evaluator, reviser, competitive intelligence, SERP, ideation, brand-profile, and related agents.

## Suggested Evaluation Path

If you're short on time:

**Studio → generate a supported content type → inspect scoring → Fix This / revision → Assistant → README**

For the code:

**`lib/tasks.ts` → `lib/agents/index.ts` → `app/api/worker/route.ts`**

That will show the core architectural difference between Quill and a traditional synchronous AI content application.
