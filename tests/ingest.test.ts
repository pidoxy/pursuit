import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { followUps } from "@/lib/followups";
import { unwrapForwarded } from "@/lib/forward";
import { ingest } from "@/lib/ingest";
import { insights, today } from "@/lib/data";
import type { RawEmail, User } from "@/lib/types";

const U = "usr_test";
const mk = (o: Partial<Omit<RawEmail, "date">> & { extId: string; subject: string; body: string; date: string; from: string }): RawEmail => ({
  source: "import", threadId: null, direction: "in", fromName: null, to: "me@example.com", snippet: null, ...o, date: new Date(o.date),
});

beforeAll(() => {
  db.prepare(`INSERT INTO users (id, email, name, password_hash, inbound_code) VALUES (?, 'me@example.com', 'Sam Test', 'x', 'code123')`).run(U);
});

describe("ingestion pipeline", () => {
  it("creates one opportunity and walks it through stages", async () => {
    await ingest(U, [
      mk({ extId: "1", from: "no-reply@us.greenhouse-mail.io", subject: "Thank you for applying to Anthropic", body: "We appreciate you taking the time to submit an application for the Research Resident position.", date: "2026-10-01T10:00:00Z" }),
      mk({ extId: "2", from: "no-reply@us.greenhouse-mail.io", fromName: "Anthropic Recruiting", subject: "Anthropic: next steps", body: "We'd like to invite you to a technical interview for the Research Resident position. Please share your availability by October 20.", date: "2026-10-10T10:00:00Z" }),
      mk({ extId: "3", from: "no-reply@us.greenhouse-mail.io", fromName: "Anthropic Recruiting", subject: "Your application to Anthropic", body: "Unfortunately we have decided to move forward with other candidates.", date: "2026-10-25T10:00:00Z" }),
    ], { now: new Date("2027-01-15T00:00:00Z") }); // a backfill: old closings apply directly
    const opps = db.prepare(`SELECT * FROM opportunities WHERE user_id = ?`).all(U) as { org: string; stage: string; outcome: string; type: string; applied_at: string }[];
    expect(opps).toHaveLength(1);
    expect(opps[0]).toMatchObject({ org: "Anthropic", stage: "closed", outcome: "rejected", type: "fellowship" });
    expect(opps[0].applied_at).toBe("2026-10-01T10:00:00.000Z");
    const events = db.prepare(`SELECT kind FROM events WHERE user_id = ? ORDER BY at`).all(U).map((r) => (r as { kind: string }).kind);
    expect(events).toEqual(["received", "interview", "rejection"]);
    const ev = db.prepare(`SELECT evidence FROM events WHERE user_id = ? AND kind = 'interview'`).get(U) as { evidence: string };
    expect(ev.evidence).toMatch(/invite you to a technical interview/);
    const task = db.prepare(`SELECT title, due_at FROM tasks WHERE user_id = ?`).get(U) as { title: string; due_at: string };
    expect(task.due_at).toBe("2026-10-20");
  });

  it("is idempotent", async () => {
    const r = await ingest(U, [mk({ extId: "1", from: "no-reply@us.greenhouse-mail.io", subject: "Thank you for applying to Anthropic", body: "x", date: "2026-10-01T10:00:00Z" })]);
    expect(r.added).toBe(0);
  });

  it("attaches replies by thread and ignores noise", async () => {
    await ingest(U, [
      mk({ extId: "10", threadId: "t-acme", from: "talent@acme.io", fromName: "Acme Talent", subject: "Interview invitation – Backend Engineer", body: "We'd like to invite you to a technical interview for the Backend Engineer position.", date: "2026-11-01T09:00:00Z" }),
      mk({ extId: "11", threadId: "t-acme", from: "jane@acme.io", fromName: "Jane Doe", subject: "Re: Interview invitation – Backend Engineer", body: "Great, Tuesday at 2pm works. See you then!", date: "2026-11-02T09:00:00Z" }),
      mk({ extId: "12", from: "jobalerts-noreply@linkedin.com", subject: "30 new jobs for you", body: "Jobs you may like", date: "2026-11-02T09:00:00Z" }),
    ]);
    const acme = db.prepare(`SELECT id, stage FROM opportunities WHERE org = 'Acme'`).get() as { id: string; stage: string };
    expect(acme.stage).toBe("interview");
    const msgs = db.prepare(`SELECT ext_id, status, opportunity_id FROM messages WHERE ext_id IN ('11','12')`).all() as { ext_id: string; status: string; opportunity_id: string }[];
    expect(msgs.find((m) => m.ext_id === "11")).toMatchObject({ status: "matched", opportunity_id: acme.id });
    expect(msgs.find((m) => m.ext_id === "12")?.status).toBe("irrelevant");
  });

  it("records recommender asks and surfaces follow-ups owed", async () => {
    await ingest(U, [
      mk({ extId: "20", threadId: "t-rec", direction: "out", from: "me@example.com", to: "Prof Ada <ada@uni.edu>", subject: "Request for Recommendation – CaCTüS Internship 2027", body: "Dear Prof. Ada, I am applying again for the CaCTüS internship and would be grateful if you could write a letter.", date: "2026-10-20T08:00:00Z" }),
      mk({ extId: "21", threadId: "t-closer", direction: "out", from: "me@example.com", to: "Bob <bob@x.com>", subject: "Re: notes", body: "Thank you!", date: "2026-10-20T08:00:00Z" }),
      mk({ extId: "22", threadId: "t-answered", direction: "out", from: "me@example.com", to: "Cy <cy@x.com>", subject: "Question about the role", body: "Could you tell me more about the team and the interview process for this role?", date: "2026-10-20T08:00:00Z" }),
      mk({ extId: "23", threadId: "t-answered", from: "cy@x.com", fromName: "Cy", subject: "Re: Question about the role", body: "Sure, happy to.", date: "2026-10-22T08:00:00Z" }),
    ]);
    const ask = db.prepare(`SELECT a.kind, a.status, p.name, p.email FROM asks a JOIN people p ON p.id = a.person_id`).get() as { kind: string; status: string; name: string; email: string };
    expect(ask).toMatchObject({ kind: "recommendation", status: "asked", name: "Ada", email: "ada@uni.edu" });
    const f = followUps(U, 7, new Date("2026-11-04T10:00:00Z"));
    expect(f.map((x) => x.threadId)).toEqual(["t-rec"]);
    expect(f[0].days).toBe(15);
  });

  it("builds the Today view and insights", () => {
    const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(U) as User;
    const t = today(user, new Date("2026-11-04T10:00:00Z"));
    expect(t.followUps).toHaveLength(1);
    expect(t.dueSoon.map((x) => x.org)).toContain("Acme");
    expect(t.overdue).toHaveLength(0);
    const i = insights(U, new Date("2026-11-04T10:00:00Z"));
    expect(i.total).toBe(2);
    expect(i.funnel.interview).toBe(2);
    expect(i.medianDaysToResponse).toBe(9);
  });

  it("routes recent closings to Review instead of applying them", async () => {
    await ingest(U, [
      mk({ extId: "30", from: "no-reply@hire.lever.co", fromName: "Kestrel Labs", subject: "Your application has been received!", body: "Thank you for submitting your application to be a Software Engineer at Kestrel Labs.", date: "2026-10-28T10:00:00Z" }),
      mk({ extId: "31", from: "no-reply@hire.lever.co", fromName: "Kestrel Labs", subject: "Update on your Kestrel Labs application", body: "Unfortunately, we have decided to move forward with other candidates.", date: "2026-11-03T10:00:00Z" }),
    ], { now: new Date("2026-11-04T10:00:00Z") });
    const k = db.prepare(`SELECT id, stage FROM opportunities WHERE org = 'Kestrel Labs'`).get() as { id: string; stage: string };
    expect(k.stage).toBe("applied");
    const m = db.prepare(`SELECT status, opportunity_id FROM messages WHERE ext_id = '31'`).get() as { status: string; opportunity_id: string };
    expect(m).toEqual({ status: "review", opportunity_id: k.id });
  });

  it("applies ignore and alias rules", async () => {
    db.prepare(`INSERT INTO user_rules (id, user_id, kind, match) VALUES ('r1', ?, 'ignore_domain', 'spammyjobs.com')`).run(U);
    db.prepare(`INSERT INTO user_rules (id, user_id, kind, match, value) VALUES ('r2', ?, 'org_alias', ?, 'Northwind Health')`).run(U, "northwind");
    await ingest(U, [
      mk({ extId: "40", from: "alerts@mail.spammyjobs.com", subject: "Thank you for applying to Spammy", body: "We have received your application for the Analyst position.", date: "2026-11-01T10:00:00Z" }),
      mk({ extId: "41", from: "careers@northwind.io", fromName: "Northwind Careers", subject: "Application received - ML Engineer", body: "Thank you for applying to Northwind. We have received your application for the ML Engineer position.", date: "2026-11-01T10:00:00Z" }),
    ]);
    expect((db.prepare(`SELECT status FROM messages WHERE ext_id = '40'`).get() as { status: string }).status).toBe("ignored");
    expect(db.prepare(`SELECT 1 FROM opportunities WHERE org = 'Northwind Health'`).get()).toBeTruthy();
  });

  it("marks a recommender's letter as submitted from a portal email", async () => {
    await ingest(U, [
      mk({ extId: "50", from: "no-reply@portal.example.org", fromName: "CaCTüS Portal", subject: "Recommendation received", body: "The letter of recommendation from Prof. Ada has been submitted for your application.", date: "2026-11-02T10:00:00Z" }),
    ]);
    const a = db.prepare(`SELECT status, submitted_at FROM asks a JOIN people p ON p.id = a.person_id WHERE p.email = 'ada@uni.edu'`).get() as { status: string; submitted_at: string };
    expect(a.status).toBe("submitted");
    expect(a.submitted_at).toBe("2026-11-02T10:00:00.000Z");
  });

  it("unwraps manually forwarded emails", () => {
    const u = unwrapForwarded("Fwd: Your application to G-Research", "FYI\n\n---------- Forwarded message ---------\nFrom: G-Research Workday <gresearch@myworkday.com>\nDate: Wed, Oct 21, 2026 at 10:45 AM\nSubject: Your application to G-Research\nTo: <me@example.com>\n\nDear Sam, unfortunately we will not be progressing.");
    expect(u).toMatchObject({ from: "gresearch@myworkday.com", fromName: "G-Research Workday", subject: "Your application to G-Research" });
    expect(u?.body).toContain("unfortunately");
  });
});
