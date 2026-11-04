# Pursuit — Product Requirements Document

**Status:** v1.0 (MVP) · **Owner:** Emmanuel Idoko · **Last updated:** 2026-11-04

> Pursuit reads your application email and keeps your whole pipeline in one place: jobs, internships, fellowships, grad school, scholarships and research positions. It shows every application's stage, extracts deadlines and to-dos from the mail itself, tells you who you owe a follow-up, tracks recommenders and reviewers, and keeps your best answers ready to reuse.

---

## 1. Problem

Ambitious students and early-career engineers run dozens of applications at once, each on a different portal (Greenhouse, Lever, Workday, HackerRank, Hireflix, university forms) and each emailing in a different format. The pipeline lives in an inbox with thousands of unread messages, plus hand-made Gmail labels.

The founder's own inbox (Nov 2026) shows the failure modes:
- **Volume:** 248 labelled application threads, 155 of them rejections, 16,000 unread threads. Important mail sinks.
- **Missed actions:** a fellowship **video-interview reminder** sat unread for two weeks, and a recruiter **follow-up went unanswered for 16 days** with no reminder to chase it.
- **Invisible dependencies:** one Max Planck internship application involved three essay reviewers and a recommender, all tracked from memory.
- **Repeated writing:** the same research pitch was rewritten in at least five emails and essays.
- **No feedback loop:** there's no view of response rates by application type, how long companies take, or where things stall.

Peers in mentoring cohorts (e.g. MLC Africa's grad-school support group) have the same problem.

## 2. Goals & non-goals

### Goals (MVP)
1. **Zero data entry:** connect Gmail (read-only) or set up a forwarding filter. Applications appear on their own, and existing mail is backfilled.
2. **Correct stage tracking:** detect applied/received, assessment, interview, offer, rejection and information-request emails, then update the opportunity and its timeline.
3. **Nothing slips:** pull deadlines and required actions out of email ("complete the video interview by…") as tasks; flag stale applications.
4. **Follow-ups owed:** threads where *you* wrote last to a real person and nobody has replied after N days, with a ready-to-edit follow-up draft.
5. **Recommenders & reviewers:** track who was asked to recommend or review, for which opportunity, the status and the due date.
6. **Answer bank:** save and reuse your best paragraphs (bio, research pitch, "why us") with one-click copy.
7. **Insights:** applications per month, response rate, outcomes by type, median days to first response.
8. **Works without an AI key:** a rule-based classifier handles the common case. Claude, when configured, improves extraction on messy email.
9. **Deployable** as one Docker container with SQLite.

### Non-goals (MVP)
- Sending email for you (Pursuit drafts; you send from Gmail).
- Auto-applying to jobs or scraping job boards.
- Calendar write access (v1.1: ICS feed of deadlines and interviews).
- Team or cohort dashboards (v2).

## 3. Users

| Persona | Situation | Job to be done |
|---|---|---|
| **The serial applicant** | 30–80 applications a season, jobs and fellowships mixed | "Show me what needs me today, and never let a deadline or interview invite slip." |
| **The grad-school applicant** | Statements of purpose, recommenders, portals | "Who has submitted their letter? What's due this week?" |
| **The mentor** | Supports a cohort | (v2) "Who in my cohort is stuck, and where?" |

## 4. User stories

- US-1 I sign up and connect Gmail read-only (or copy my forwarding address). Pursuit backfills the last 6 months.
- US-2 **Today** shows tasks due or overdue, follow-ups owed, deadlines this week, new updates, and stale applications.
- US-3 **Pipeline** shows each opportunity by stage (Interested → Applied → Assessment → Interview → Offer → Closed), filterable by type, and I can move one between stages.
- US-4 An opportunity page shows a timeline of every related email (with a link to it in Gmail), tasks, recommenders and reviewers, notes and the stage history.
- US-5 Uncertain matches land in **Review**, where I confirm, reassign or ignore them. Nothing is silently dropped.
- US-6 Follow-ups owed show a draft I can copy or open in Gmail. I can snooze or dismiss them.
- US-7 **People** lists recommenders and reviewers, each with their asks (asked → agreed → submitted).
- US-8 **Answers**: create, tag, search and copy reusable text.
- US-9 **Insights**: funnel, response rate, outcomes by type, applications per month.
- US-10 A morning brief email (opt-in) carries the Today view.
- US-11 I can add or edit opportunities by hand, and import or export JSON.

## 5. Functional requirements

### 5.1 Ingestion
- **Gmail (read-only).** OAuth 2.0 with the `gmail.readonly` scope; tokens encrypted at rest (AES-256-GCM, key from `APP_SECRET`).
  - **Backfill:** a Gmail query that targets application mail (hiring-platform senders, application/interview/offer/rejection keywords) plus sent mail from the same window.
  - **Incremental:** every 15 minutes, using `history.list` from the stored `historyId`, falling back to a query when the history has expired.
- **Forwarding:** each user gets a private address. Inbound webhooks use Postmark's JSON format with a shared secret.
- **Import:** JSON upload of messages (`{id, threadId, from, to, subject, date, snippet, body, direction}`).
- Messages are stored with a trimmed body (8 KB) for extraction and display. Attachments are not stored.

### 5.2 Classification
- **Rule engine (always on).**
  - **Relevance:** hiring-platform domains (Greenhouse, Lever, Workday, Ashby, SmartRecruiters, iCIMS, HackerRank, CodeSignal, Hireflix, Oracle HCM, etc.), recruiting mailboxes, and subject/body phrases.
  - **Exclusions:** job-alert digests, newsletters, marketing.
  - **Stage:** detected by ordered phrase rules. Rejection beats offer, which beats interview, which beats assessment, which beats received.
  - **Company:** from the sender's display name (stripping "Recruiting", "Careers", "Hiring Team", "via X"), body patterns ("at X", "to X", "joining X"), or the domain as a fallback.
  - **Role:** from "for the X position", "application for X", "to be a X at".
  - **Type:** job, internship, fellowship, grad school, scholarship, research or program, from keywords.
  - **Deadlines:** sentences containing deadline cues, parsed as dates (chrono), become tasks.
  - **Confidence:** 0–1. Anything below 0.6 goes to Review.
- **Claude (optional):** with `ANTHROPIC_API_KEY` set, the same output schema comes from a structured-output call with the rules as a fallback. The email is treated as untrusted data.
- **Matching:** an existing opportunity is matched by normalised company and fuzzy role; otherwise a new one is created. Stage only moves forward unless the email is a rejection or offer.

### 5.3 Follow-ups
- A thread qualifies when its last message is outbound, to a non-automated address, older than `followup_days` (default 7, adjustable), and not dismissed or snoozed.
- The draft is a template using the recipient's name, the subject and the days since; Claude polishes it when available.

### 5.4 Brief & stale rules
- **Stale:** stage Applied with no inbound activity for 21+ days.
- **Morning brief:** sent at 07:00 in the user's timezone, only when there's something to report.

### 5.5 Security & privacy
- Read-only Gmail scope; no email is sent on your behalf.
- Disconnect deletes the stored tokens; the account-delete action deletes all data.
- Every query is scoped by `user_id`. Session cookies are httpOnly, and passwords are hashed with scrypt.
- Email content is never treated as instructions, and the model has no tools.

## 6. Design principles
1. **Today first:** the home screen is a to-do list, not a dashboard.
2. **Show the source:** every stage change links to the email that caused it.
3. **Calm density:** an information-dense tool with clear hierarchy: cool paper neutrals and a single indigo accent.

## 7. Success metrics
| Metric | Target |
|---|---|
| Classification precision on stage (labelled sample) | ≥ 90% |
| Opportunities created without manual edits | ≥ 80% |
| Weekly active users / signups | ≥ 50% in season |
| Follow-ups acted on within 48h of surfacing | ≥ 40% |

## 8. Architecture
- Next.js 15 (App Router) with TypeScript, SQLite (better-sqlite3), Tailwind v4, and the same structure as Hearth.
- Gmail REST through `fetch` (no Google SDK); OAuth web-server flow.
- In-process scheduler (`instrumentation.ts`) for sync and briefs. Single Docker container; Render and Fly configs.

## 9. Release plan
| Phase | Scope |
|---|---|
| MVP | Everything above |
| v1.1 | ICS feed of deadlines and interviews; Chrome extension "save this job posting" |
| v1.2 | Outlook / Microsoft Graph; LinkedIn "applied" import |
| v2 | Cohorts: mentors see mentees' pipelines (with consent) |

## 10. Risks
| Risk | Mitigation |
|---|---|
| Google restricted-scope verification for a public app | Personal or testing-mode projects work immediately (up to 100 test users); a forwarding filter needs no Google approval; plan the CASA assessment before a public launch |
| Misclassification | Review queue, confidence threshold, every change linked to its email, manual edits never overwritten |
| Privacy | Read-only scope, encrypted tokens, self-hostable, delete-everything |
