// Fictional demo inbox with dates relative to "now". Used by the sample-data sandbox, the import script and tests.
// Every name, company and address here is invented.
export interface DemoMessage {
  id: string;
  threadId: string;
  direction: "in" | "out";
  from: string;
  to?: string;
  subject: string;
  date: string;
  body: string;
}

export function demoMessages(nowMs = Date.now()): DemoMessage[] {
  const now = nowMs;

  const d = (days: number, h = 10) => new Date(now - days * 86400_000 + (h - 12) * 3600_000).toISOString();
  let n = 0;
  const m = (o: Partial<DemoMessage> & { from: string; subject: string; date: string; body: string }): DemoMessage => ({ id: `demo-${++n}`, threadId: o.threadId ?? `t-${n}`, direction: "in", ...o });
  const me = "you@example.com";

  return [
  m({ from: "Orbital AI Recruiting <no-reply@us.greenhouse-mail.io>", subject: "Thank you for applying to Orbital AI", date: d(34), threadId: "orb",
      body: "Hi, We appreciate you taking the time to submit an application for the Research Resident position, and are delighted that you would consider joining our team!" }),
  m({ from: "Orbital AI Recruiting <no-reply@us.greenhouse-mail.io>", subject: "Orbital AI: interview invitation", date: d(6), threadId: "orb",
      body: "We'd like to invite you to a technical interview for the Research Resident position. Please share your availability by " + new Date(now + 2 * 86400_000).toDateString() + "." }),
  m({ from: "Lumen via Hireflix <users@hireflix.com>", subject: "Start your interview with Lumen", date: d(9),
      body: "We've invited you to complete a brief video interview for our Lumen Fellowship 2027 - Policy Track role. Please complete it by " + new Date(now - 1 * 86400_000).toDateString() + "." }),
  m({ from: "Acme Bank Hiring Team <support@hackerrankforwork.com>", subject: "Your HackerRank Acme Bank Engineering Invitation", date: d(2),
      body: "Thank you for your interest in joining Acme Bank! We're excited to invite you to the next step in the process: the online assessment. Please complete it within 4 days." }),
  m({ from: "Northwind Careers <careers@northwind.io>", subject: "Application received - ML Engineer", date: d(40), threadId: "nw",
      body: "Thank you for applying to Northwind. We have received your application for the ML Engineer position." }),
  m({ from: me, to: "Dana Okoro <dana@northwind.io>", direction: "out", subject: "Following up: ML Engineer application", date: d(16), threadId: "nw-f",
      body: "Hi Dana, I applied for the ML Engineer role last month and wanted to check whether there is any update on next steps. I'd be glad to share more about my recent work." }),
  m({ from: "Kestrel Labs <no-reply@hire.lever.co>", subject: "Your application has been received!", date: d(12),
      body: "Thank you for submitting your application to be a Software Engineer, Infrastructure at Kestrel Labs. Our team is reviewing your application." }),
  m({ from: "Kestrel Labs <no-reply@hire.lever.co>", subject: "Update on your Kestrel Labs application", date: d(3),
      body: "Thank you for your interest in Kestrel Labs. Unfortunately, we have decided to move forward with other candidates whose experience more closely matches the role." }),
  m({ from: "Halcyon Talent <talent@halcyon.dev>", subject: "Offer: Backend Engineer", date: d(1), threadId: "hal",
      body: "We are delighted to offer you the Backend Engineer position at Halcyon. Please review the attached offer letter and let us know by " + new Date(now + 6 * 86400_000).toDateString() + "." }),
  m({ from: "Halcyon Talent <talent@halcyon.dev>", subject: "Thank you for applying to Halcyon", date: d(30), threadId: "hal0",
      body: "Thank you for applying to Halcyon. We have received your application for the Backend Engineer position." }),
  m({ from: "admissions@tessellate.ac", subject: "Application received: MSc Artificial Intelligence", date: d(20),
      body: "Dear applicant, we have received your application to the MSc in Artificial Intelligence programme. Decisions are released in March." }),
  m({ from: "Meridian Foundation <scholarships@meridianfoundation.org>", subject: "Meridian Scholarship: application submitted", date: d(25),
      body: "Thank you for applying to the Meridian Scholarship 2027. Your application has been submitted successfully." }),
  m({ from: "Polaris Pay Recruiting <recruiting@polarispay.com>", subject: "Thank you for applying to Polaris Pay", date: d(55),
      body: "Thank you for applying to Polaris Pay. We have received your application for the Software Engineer Intern role." }),
  m({ from: "Vertex Research <no-reply@eu.greenhouse-mail.io>", subject: "Thank you for applying to Vertex Research", date: d(70),
      body: "Thank you for applying to Vertex Research. We have received your application for the Research Engineer position." }),
  m({ from: "Vertex Research <no-reply@eu.greenhouse-mail.io>", subject: "Your Vertex Research assessment", date: d(60),
      body: "You have been invited to complete a coding challenge for the Research Engineer position. Please complete the assessment within 5 days." }),
  m({ from: "Vertex Research <no-reply@eu.greenhouse-mail.io>", subject: "Thanks for taking the Vertex Research Programming test", date: d(57),
      body: "Thanks for completing the Vertex Research programming test. We've sent your submission to the hiring team." }),
  m({ from: "Vertex Research <no-reply@eu.greenhouse-mail.io>", subject: "Your application to Vertex Research", date: d(44),
      body: "Thank you for your interest. Unfortunately we will not be progressing your application any further." }),
  m({ from: me, to: "Prof. Amara Bello <amara.bello@university.edu>", direction: "out", subject: "Request for Recommendation – Lumen Fellowship 2027", date: d(11), threadId: "rec1",
      body: "Dear Prof. Bello, I am applying for the Lumen Fellowship and would be grateful if you could write a letter of recommendation. The deadline is at the end of the month." }),
  m({ from: me, to: "Tobi Adeyemi <tobi@example.com>", direction: "out", subject: "Lumen Fellowship statement draft review", date: d(13), threadId: "rev1",
      body: "Hi Tobi, could you review my statement draft for the Lumen Fellowship? Comments welcome directly in the doc." }),
  m({ from: "Tobi Adeyemi <tobi@example.com>", subject: "Re: Lumen Fellowship statement draft review", date: d(12), threadId: "rev1",
      body: "Left comments — strong opening, tighten the middle section." }),
  m({ from: me, to: "Jordan Lee <jordan@quasar.ai>", direction: "out", subject: "Research internship enquiry", date: d(21), threadId: "quasar",
      body: "Dear Dr. Lee, I'm a final-year computer science student working on retrieval-augmented generation and would love to ask whether your lab is taking research interns next summer." }),
  m({ from: "Lumen Fellowship Portal <no-reply@apply.lumenfellowship.org>", subject: "Recommendation received for your Lumen Fellowship application", date: d(4),
      body: "Good news: the letter of recommendation from Prof. Amara Bello has been submitted for your Lumen Fellowship 2027 application." }),
  // Noise
  m({ from: "jobalerts-noreply@linkedin.com", subject: "30 new jobs for machine learning engineer", date: d(1), body: "Jobs you may like" }),
  m({ from: "no-reply@leetcode.com", subject: "Weekly Contest 471", date: d(2), body: "Join this week's contest" }),
];
}
