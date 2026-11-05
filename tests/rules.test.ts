import { describe, expect, it } from "vitest";
import { classifyRules, extractDeadlines, orgKey } from "@/lib/classify/rules";

const D = new Date("2026-11-04T10:00:00Z");
type Case = { name: string; from: string; fromName?: string; subject: string; body: string; kind: string | null; org?: string | null; type?: string; role?: string };

const cases: Case[] = [
  { name: "Greenhouse received (Anthropic)", from: "no-reply@us.greenhouse-mail.io", subject: "Thank you for applying to Anthropic",
    body: "Hi Sam, We appreciate you taking the time to submit an application for the Anthropic Research Resident position, and are delighted that you would consider joining our team!", kind: "received", org: "Anthropic", type: "fellowship" },
  { name: "Lever received (Palantir)", from: "no-reply@hire.lever.co", fromName: "Palantir Technologies", subject: "Your application has been received!",
    body: "Hi Sam, Thank you for submitting your application to be a Software Engineer, Internship - Infrastructure at Palantir. Our team is reviewing your application and will be in touch.", kind: "received", org: "Palantir Technologies", type: "internship" },
  { name: "Workday rejection (G-Research)", from: "gresearch@myworkday.com", fromName: "G-Research Workday", subject: "Your application to G-Research",
    body: "Dear Sam, Thank you for your interest in G-Research and your application to our Graduate Machine Learning Engineer position. Unfortunately we will not be progressing your application any further.", kind: "rejection", org: "G-Research" },
  { name: "Cloudflare received", from: "no-reply@cloudflare.com", subject: "Cloudflare Recruiting | Application Received - Software Engineer, CDN Configuration Group",
    body: "Hi Sam, Thank you for applying to Cloudflare, we wanted to let you know that we have received your application for the Software Engineer, CDN Configuration Group position!", kind: "received", org: "Cloudflare", role: "Software Engineer, CDN Configuration Group" },
  { name: "Meta received", from: "do-not-reply@recruiting.facebook.com", fromName: "The Recruiting team at Meta", subject: "Thank you for applying to Meta",
    body: "Our recruiting team will contact you if you're a strong match. Hi Sam, We appreciate you taking the time to submit your application for the Software Engineer role.", kind: "received", org: "Meta" },
  { name: "Hireflix video interview (ERA)", from: "users@hireflix.com", fromName: "ERA via Hireflix", subject: "Reminder: Start your interview with ERA",
    body: "Sam, this a friendly reminder that we've invited you to complete a brief video interview for our ERA AI Winter Fellowship 2027 - Technical Safety Track role. Please complete it by November 10.", kind: "interview", org: "ERA", type: "fellowship" },
  { name: "Oracle HCM received (Goldman)", from: "GSRecruiting@oracle.com", fromName: "Goldman Sachs Recruiting", subject: "Thank You for Applying to Goldman Sachs",
    body: "Hi Sam, Thank you for your application. A member of our recruiting team will reach out if your experience and skills are a match.", kind: "received", org: "Goldman Sachs" },
  { name: "Oracle HCM rejection (Goldman)", from: "GSRecruiting@oracle.com", fromName: "Goldman Sachs Recruiting", subject: "Your Application with Goldman Sachs",
    body: "Hi Sam, Thank you for applying for a role in the 2026 | EMEA | London | Engineering | Summer Analyst program at Goldman Sachs. We reviewed your application and unfortunately we will not be moving forward.", kind: "rejection", org: "Goldman Sachs", type: "internship" },
  { name: "HackerRank invite", from: "support@hackerrankforwork.com", fromName: "Goldman Sachs Hiring Team", subject: "Your HackerRank 2026 Goldman Sachs Engineering -- Programming Invitation",
    body: "Hi, Thank you for your interest in joining Goldman Sachs! We're excited to invite you to the next step in the process: the online assessment. Please complete it within 5 days.", kind: "assessment", org: "Goldman Sachs" },
  { name: "HackerRank done", from: "support@hackerrankforwork.com", fromName: "Goldman Sachs Hiring Team", subject: "Thanks for taking the 2026 Goldman Sachs Engineering -- Programming",
    body: "Submission Confirmation. Hello, Thanks for completing 2026 Goldman Sachs Engineering -- Programming. We've sent your submission to Goldman Sachs.", kind: "assessment_done", org: "Goldman Sachs" },
  { name: "BofA assessment", from: "noreply@campuscareers.bofa.com", subject: "Bank of America: Assessment Invitation",
    body: "Application ID: 4917263 Dear Sam, Thank you for applying to the Global Technology Software Engineer Summer 2027 Analyst - Bromley at Bank of America. We're pleased to share that you have been invited to complete an assessment.", kind: "assessment", org: "Bank of America", type: "internship" },
  { name: "Moniepoint program received", from: "no-reply@eu.greenhouse-mail.io", subject: "Your DreamDevs Application Is In",
    body: "Dear Sam, Thank you for taking the leap and applying to the DreamDevs programme. DreamDevs is Moniepoint's initiative to discover Africa's brightest engineers.", kind: "received", type: "program" },
  { name: "Google received", from: "noreply@google.com", subject: "Thanks for applying to Google",
    body: "Hi Sam, Thanks for applying to Google! There are a ton of great companies out there, so we appreciate your interest in joining our team.", kind: "received", org: "Google" },
  { name: "Offer", from: "badekoya@sbsc.com", fromName: "Busayomi Adekoya", subject: "Offer of Contract",
    body: "Hello Sam, We are pleased to offer you a contract as a Backend Engineer at SBSC. Please review the attached offer letter and respond by 20 November 2026.", kind: "offer", type: "job" },
  { name: "Interview scheduling", from: "talent@acme.io", fromName: "Acme Talent", subject: "Interview invitation – Backend Engineer",
    body: "Hi Sam, we'd like to invite you to a technical interview for the Backend Engineer position. Please share your availability for next week.", kind: "interview", org: "Acme" },
  { name: "Admissions received", from: "admissions@iliad.ac", subject: "Application received",
    body: "Dear applicant, we have received your application to the MSc in Artificial Intelligence programme.", kind: "received", type: "grad_school" },
  { name: "Max Planck internship", from: "cactus-internship@tuebingen.mpg.de", subject: "CaCTüS Internship: application submitted",
    body: "Dear Sam, your application to the CaCTüS internship programme has been submitted successfully.", kind: "received", type: "internship" },
  { name: "LinkedIn easy apply", from: "jobs-noreply@linkedin.com", subject: "Sam, your application was sent to Flutterwave",
    body: "Your application was sent to Flutterwave. Software Engineer · Lagos", kind: "received", org: "Flutterwave" },
  // Regressions from a real inbox backfill
  { name: "Unicode org in subject", from: "cactus-internship@tuebingen.mpg.de", subject: "CaCTüS Internship: application submitted",
    body: "Dear Sam, your application to the CaCTüS internship programme has been submitted successfully.", kind: "received", org: "CaCTüS Internship" },
  { name: "Truncated snippet doesn't absorb the subject into the role", from: "do-not-reply@recruiting.facebook.com", fromName: "The Recruiting team at Meta", subject: "Thank you for applying to Meta",
    body: "We appreciate you taking the time to submit your application for the Software", kind: "received", org: "Meta", role: "Software" },
  { name: "'applying to X' is the org, not the role", from: "no-reply@imc.com", subject: "IMC Trading: Thank you for your application",
    body: "Hi Sam, thank you for applying to IMC. We have received your application.", kind: "received", org: "IMC Trading" },
  { name: "Role inside 'a role in the X program'", from: "GSRecruiting@oracle.com", fromName: "Goldman Sachs Recruiting", subject: "Your Application with Goldman Sachs",
    body: "Thank you for applying for a role in the 2026 | EMEA | London | Engineering | Summer Analyst program in the London office at Goldman Sachs. Unfortunately we will not be moving forward.", kind: "rejection", org: "Goldman Sachs", role: "2026 | EMEA | London | Engineering | Summer Analyst" },
  { name: "Role with a comma", from: "no-reply@hire.lever.co", fromName: "Palantir Technologies", subject: "Your application has been received!",
    body: "Thank you for submitting your application to be a Software Engineer, Internship - Infrastructure at Palantir.", kind: "received", role: "Software Engineer, Internship - Infrastructure" },
  // Noise that must be ignored
  { name: "LinkedIn job alert", from: "jobalerts-noreply@linkedin.com", subject: "30+ new jobs for software engineer", body: "Jobs you may like", kind: null },
  { name: "LeetCode promo", from: "no-reply@leetcode.com", subject: "Weekly contest", body: "Join the contest", kind: null },
  { name: "Calendar accept", from: "victoria@gmail.com", subject: "Accepted: Consulting Club Of Lagos AI/ML Track @ Thu", body: "has accepted this invitation", kind: null },
  { name: "GitLab pipeline", from: "gitlab@mg.gitlab.com", subject: "Fraud Ai Service | Failed pipeline for develop", body: "Pipeline has failed", kind: null },
  { name: "Personal email", from: "friend@gmail.com", fromName: "Zaynab", subject: "Re: catching up", body: "Oh nice, see you soon", kind: null },
  { name: "Subscription", from: "noreply@po.atlassian.net", subject: "Your subscription will be deactivated soon", body: "Add payment details", kind: null },
];

describe("rule classifier on real-world templates", () => {
  for (const c of cases) {
    it(c.name, () => {
      const r = classifyRules({ from: c.from, fromName: c.fromName, subject: c.subject, body: c.body, date: D, direction: "in" });
      if (c.kind === null) {
        expect(r.relevant, `${c.name} should be ignored`).toBe(false);
        return;
      }
      expect(r.relevant).toBe(true);
      expect(r.kind).toBe(c.kind);
      if (c.org !== undefined) expect(r.org).toBe(c.org);
      if (c.type) expect(r.type).toBe(c.type);
      if (c.role) expect(r.role).toBe(c.role);
    });
  }

  it("an offer from a person (not a platform) is confident enough to track", () => {
    const r = classifyRules({ from: "hr.person@sbsc.com", fromName: "Busayomi Adekoya", subject: "Congratulations!", body: "Hello Sam, We are pleased to offer you a contract as a Backend Engineer at SBSC.", date: D, direction: "in" });
    expect(r.kind).toBe("offer");
    expect(r.org).toBe("SBSC");
    expect(r.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it("extracts explicit deadlines and 'within N days'", () => {
    const era = classifyRules({ from: "users@hireflix.com", fromName: "ERA via Hireflix", subject: "Start your interview", body: "Please complete it by November 10.", date: D, direction: "in" });
    expect(era.deadlines[0]?.due).toBe("2026-11-10");
    expect(extractDeadlines("Please complete it within 5 days.", D, "x")[0].due).toBe("2026-11-09");
  });

  it("detects recommendation and review asks you sent", () => {
    const r = classifyRules({ from: "me@gmail.com", to: "a.bello@university.edu", subject: "Request for Recommendation – CaCTüS Internship 2027",
      body: "Dear Associate Professor Bello, Good day.", date: D, direction: "out" });
    expect(r.ask?.kind).toBe("recommendation");
    expect(r.ask?.personEmail).toBe("a.bello@university.edu");
    const v = classifyRules({ from: "me@gmail.com", to: "Glory <glory@gmail.com>", subject: "CaCTüS Internship Application Draft Review",
      body: "Hi Glory, thank you", date: D, direction: "out" });
    expect(v.ask?.kind).toBe("review");
    expect(v.ask?.personName).toBe("Glory");
  });

  it("normalises org keys", () => {
    expect(orgKey("Palantir Technologies")).toBe(orgKey("Palantir"));
    expect(orgKey("Goldman Sachs Inc.")).toBe("goldmansachs");
  });
});

describe("real-inbox regressions (2)", () => {
  it("recognises recruiting subdomains and 'applying to the X at Y' roles", () => {
    const r = classifyRules({ from: "noreply@campuscareers.bofa.com", subject: "Bank of America - Stay Connected", body: "Hi Sam, Thank you for applying to the Global Technology Software Engineer Summer 2027 Analyst - Bromley at Bank of America. Your application is under consideration.", date: D, direction: "in" });
    expect(r.confidence).toBeGreaterThanOrEqual(0.6);
    expect(r.role).toBe("Global Technology Software Engineer Summer 2027 Analyst - Bromley");
  });
  it("links an outbound recommendation request to a unicode-named programme", () => {
    const r = classifyRules({ from: "me@gmail.com", to: "prof@uni.edu", subject: "Request for Recommendation – CaCTüS Internship 2027", body: "Dear Prof. Ada,", date: D, direction: "out" });
    expect(r.org).toBe("CaCTüS Internship");
  });
});

describe("real-inbox regressions (3)", () => {
  it("stops the role before 'is under consideration'", () => {
    const r = classifyRules({ from: "noreply@campuscareers.bofa.com", subject: "Bank of America - Stay Connected", body: "Your application for Global Technology Software Engineer Summer 2026 Analyst - Bromley is under consideration.", date: D, direction: "in" });
    expect(r.role).toBe("Global Technology Software Engineer Summer 2026 Analyst - Bromley");
  });
});

describe("admissions", () => {
  it("uses the institution, not the degree, as the organisation", () => {
    const r = classifyRules({ from: "admissions@tessellate.ac", subject: "Application received: MSc Artificial Intelligence", body: "Dear applicant, we have received your application to the MSc in Artificial Intelligence programme.", date: D, direction: "in" });
    expect(r.org).toBe("Tessellate");
    expect(r.type).toBe("grad_school");
  });
});

describe("subject words that aren't organisations", () => {
  it("'Offer: Backend Engineer' comes from the sender, not the word Offer", () => {
    const r = classifyRules({ from: "talent@halcyon.dev", fromName: "Halcyon Talent", subject: "Offer: Backend Engineer", body: "We are delighted to offer you the Backend Engineer position at Halcyon.", date: D, direction: "in" });
    expect(r.kind).toBe("offer");
    expect(r.org).toBe("Halcyon");
  });
});

describe("recommendation submitted", () => {
  const base = { from: "no-reply@portal.org", fromName: "Portal", to: "me@example.com", date: new Date("2026-11-01"), direction: "in" as const };
  it("flags portal submission notices", () => {
    expect(classifyRules({ ...base, subject: "Recommendation received", body: "The letter of recommendation from Prof. Ada has been submitted." }).recSubmitted).toBe(true);
    expect(classifyRules({ ...base, subject: "Update", body: "Your recommender Dr. Lee has submitted their letter." }).recSubmitted).toBe(true);
  });
  it("does not confuse an application confirmation with a letter", () => {
    const c = classifyRules({ ...base, from: "no-reply@hire.lever.co", fromName: "Kestrel Labs", subject: "Application received", body: "Thanks for your cover letter. Your application has been received for the Software Engineer position at Kestrel Labs." });
    expect(c.recSubmitted).toBeFalsy();
    expect(c.kind).toBe("received");
  });
});
