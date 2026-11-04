/**
 * Rule-based classifier for application email. Works offline, no API key.
 * Tuned on real-world templates from Greenhouse, Lever, Workday, Oracle HCM, HackerRank,
 * Hireflix and direct company/university mail.
 */
import * as chrono from "chrono-node";

export type Kind =
  | "received"
  | "assessment"
  | "assessment_done"
  | "interview"
  | "offer"
  | "rejection"
  | "info_request"
  | "update"
  | "outbound";

export type OppType = "job" | "internship" | "fellowship" | "grad_school" | "scholarship" | "research" | "program";

export interface EmailInput {
  from: string; // address
  fromName?: string | null;
  to?: string;
  subject: string;
  body: string; // plain text (may be a snippet)
  date: Date;
  direction: "in" | "out";
}

export interface Classification {
  relevant: boolean;
  confidence: number;
  kind: Kind | null;
  org: string | null;
  role: string | null;
  type: OppType;
  deadlines: { title: string; due: string }[]; // due = YYYY-MM-DD
  ask: { kind: "recommendation" | "review" | "referral"; personName: string | null; personEmail: string } | null;
  summary: string;
  extractor: string;
}

// ───────────────────────── vocab ─────────────────────────

const ATS_DOMAINS = [
  "greenhouse-mail.io", "greenhouse.io", "lever.co", "myworkday.com", "workday.com", "ashbyhq.com",
  "smartrecruiters.com", "icims.com", "hackerrank.com", "hackerrankforwork.com", "codesignal.com", "hireflix.com",
  "taleo.net", "jobvite.com", "recruitee.com", "workablemail.com", "workable.com", "bamboohr.com", "teamtailor.com",
  "teamtailor-mail.com", "successfactors.com", "successfactors.eu", "eightfold.ai", "avature.net", "gem.com",
  "phenompeople.com", "hirevue.com", "codility.com", "karat.io", "karat.com", "testgorilla.com", "pymetrics.com",
  "oraclecloud.com", "brassring.com", "applytojob.com", "breezy.hr", "personio.de", "rippling.com", "dover.com",
  "careers-page.com", "submittable.com", "slideroom.com", "embark.com", "liaisoncas.com", "collegenet.com",
];
const ATS_NAMES = /\b(workday|greenhouse|lever|ashby|smartrecruiters|icims|hackerrank|codesignal|hireflix|taleo|jobvite|workable|oracle|successfactors|hirevue|codility)\b/i;

const RECRUIT_LOCAL = /(recruit|career|talent|hiring|jobs?\b|admission|graduate|apply|application|fellowship|scholarship|internship|intern\b|campus|people-?ops|^hr\b|staffing|programs?\b)/i;

const EXCLUDE_SENDER = /(linkedin\.com|leetcode\.com|substack\.com|glassdoor\.com|indeed\.com|medium\.com|tryexponent\.com|alison\.com|coursera\.org|udemy\.com|gainrepmail\.com|wellfound\.com|ziprecruiter\.com|monster\.com|jobberman\.com|myjobmag\.com|handshake|facebookmail\.com|github\.com|gitlab\.com|google\.com\/calendar|calendar-notification)/i;
const EXCLUDE_SUBJECT = /(job alert|jobs? (for|matching) you|recommended jobs|new jobs|jobs you may|is hiring|we're hiring|newsletter|webinar|digest|% off|sale\b|unsubscribe|weekly roundup|masterclass|happy birthday|invitation: |accepted: |declined: |updated invitation)/i;
// LinkedIn Easy Apply confirmations are useful even though LinkedIn is otherwise excluded.
const LINKEDIN_APPLIED = /your application was sent to (.+)$/i;

const REJECTION = /(unfortunately|regret to inform|not (be )?(moving|progressing|proceeding) (forward|further|ahead)|not (to )?(move|progress|proceed) (forward|further)|decided to (move|proceed|go) forward with other|other candidates (whose|who)|will not be (moving|progressing|proceeding)|(have|has) not been selected|were not selected|unable to offer you|position has (now )?been filled|decided not to (move|proceed|progress)|not able to (move|progress) (forward|your application)|we have decided to pursue|won't be (moving|progressing)|not (be )?able to offer|no longer under consideration|will not be offering)/i;
const OFFER = /(pleased to (offer|extend)|delighted to offer|happy to offer|offer of (employment|contract|admission|a place)|(your|an|the) offer letter|we('d| would) like to offer you|congratulations[^.]{0,100}\b(offer|admitted|selected for|accepted into|accepted to)\b|you have been (selected|admitted|accepted) (for|to|into)|we are excited to welcome you)/i;
const INTERVIEW_INVITE = /(invit\w+ (you )?to (an? |the )?(\w+ )?interview|interview (invitation|invite|request|availability|scheduling|confirmation)|schedule (an? |your )?(\w+ )?interview|(video|phone|technical|final|onsite|virtual) interview|your interview (with|for|is)|next round|phone screen|technical screen|superday|meet the team|start your interview|complete (a|the|your) (brief )?(video|one-way) interview)/i;
const ASSESSMENT_DONE = /(thank(s| you) for (taking|completing|submitting) (the|your)[^.]{0,60}(test|assessment|challenge|programming)|submission confirmation|we('ve| have) (sent|received) your submission|assessment (has been )?(completed|submitted))/i;
const ASSESSMENT = /(assessment|coding challenge|online test|hackerrank|codesignal|codility|take[- ]home|technical test|aptitude test|test invitation|programming (test|challenge|exercise)|case study|game-based|psychometric|online exercise)/i;
const INFO_REQUEST = /(action required|please (provide|submit|send|complete|upload|confirm)|kindly (provide|submit|send|complete)|additional (information|documents)|missing (documents|information)|complete your (application|profile|registration)|reference (request|details)|we need (a few|some) more)/i;
const RECEIVED = /(thank(s| you) for (applying|your application|your interest in|submitting your application|taking the leap and applying)|application (has been |was )?(received|submitted|is in)|we('ve| have) received your application|successfully (applied|submitted)|your application (to|for|with) .{2,60} (has been|is being|is under) (received|review|consideration)|under consideration|thank you for applying|application confirmation|application received)/i;
const APPLICATION_WORDS = /\b(application|applied|applying|candidate|candidacy|position|role|internship|fellowship|scholarship|admission|programme|program|cohort|interview|assessment|offer)\b/i;

const TYPE_RULES: [RegExp, OppType][] = [
  [/\b(fellowship|fellows?\b|residen(cy|t)\b)/i, "fellowship"],
  [/\b(scholarship|bursary|grant)\b/i, "scholarship"],
  [/\b(ph\.?d|msc|m\.sc|master'?s|graduate (school|program|admission)|admission|admissions|statement of purpose|doctoral)\b/i, "grad_school"],
  [/\b(research (attachment|assistant|internship|position|visit)|lab\b|postdoc|research intern)/i, "research"],
  [/\b(intern|internship|summer(\s+\d{4})?\s+(analyst|associate|intern)|placement|industrial training|co-?op)\b/i, "internship"],
  [/\b(programme|program|bootcamp|accelerator|cohort|academy|dreamdevs)\b/i, "program"],
];

// ───────────────────────── helpers ─────────────────────────

const domainOf = (addr: string) => (addr.split("@")[1] ?? "").toLowerCase();
const localOf = (addr: string) => (addr.split("@")[0] ?? "").toLowerCase();

export function isAtsSender(addr: string): boolean {
  const d = domainOf(addr);
  return ATS_DOMAINS.some((a) => d === a || d.endsWith("." + a)) || (/oracle\.com$/.test(d) && RECRUIT_LOCAL.test(localOf(addr)));
}

/** recruiting@company.com, or a recruiting subdomain like campuscareers.bank.com / recruiting.company.com. */
export function isRecruitSender(addr: string): boolean {
  return RECRUIT_LOCAL.test(localOf(addr)) || /^(campus)?(careers?|recruit\w*|jobs|talent|hiring|apply)\./.test(domainOf(addr));
}

const GENERIC_NAME = /^(no-?reply|noreply|do-?not-?reply|notifications?|support|info|team|hello|admin|mailer|system|the)$/i;
const ORG_NOISE = /\b(university recruiting|campus recruiting|talent acquisition|recruiting team|recruitment team|hiring team|recruiting|recruitment|recruiter|careers?|talent|hiring|team|hr|jobs|notifications?|no-?reply|admissions? office|admissions?|secretariat|the recruiting team at|people)\b/gi;

function cleanOrg(raw: string): string | null {
  let s = raw.replace(/["“”]/g, "").trim();
  const at = s.match(/\b(?:team|recruiting|recruitment|careers) at (.+)$/i);
  if (at) s = at[1];
  s = s.replace(/\bvia\b.*$/i, "");
  s = s.replace(ATS_NAMES, "");
  s = s.replace(ORG_NOISE, "");
  s = s.replace(/[|:–—\-,]+\s*$/g, "").replace(/^\s*[|:–—\-,]+/g, "");
  s = s.replace(/\s{2,}/g, " ").trim();
  if (!s || s.length < 2 || GENERIC_NAME.test(s)) return null;
  if (/^[a-z]/.test(s) && !/^[a-z]+\.[a-z]+$/.test(s)) s = s[0].toUpperCase() + s.slice(1);
  return s.slice(0, 60);
}

function titleCaseDomain(addr: string): string | null {
  const d = domainOf(addr);
  if (!d || /gmail|yahoo|outlook|hotmail|icloud|proton/.test(d)) return null;
  const parts = d.split(".");
  // careers.company.com → company; company.co.uk → company
  const sld = parts.length >= 3 && /^(co|com|ac|edu|org|gov)$/.test(parts[parts.length - 2]) ? parts[parts.length - 3] : parts[parts.length - 2];
  if (!sld || sld.length < 2) return null;
  return sld.length <= 4 ? sld.toUpperCase() : sld[0].toUpperCase() + sld.slice(1);
}

// "Proper Noun Sequence" incl. &, ., -, and lowercase connectors (of, and, de).
const PROPER = "(\\p{Lu}[\\p{L}\\p{N}&.'’\\-]*(?:\\s+(?:of|and|de|for|the|&)?\\s*\\p{Lu}[\\p{L}\\p{N}&.'’\\-]*){0,5})";
const ORG_PATTERNS: RegExp[] = [
  new RegExp(`(?:applying|applied|application|apply)\\s+(?:to|with|at|for a role at|for a position at)\\s+(?:the\\s+)?${PROPER}`, "u"),
  new RegExp(`(?:interest in|interested in|joining|join)\\s+(?:the\\s+)?${PROPER}`, "u"),
  new RegExp(`(?:position|role|program|programme|opportunity|internship|fellowship)\\s+(?:at|with)\\s+(?:the\\s+)?${PROPER}`, "u"),
  new RegExp(`(?<![\\p{L}])at\\s+${PROPER}(?:[.,!]|\\s+(?:office|team|is|has|and|we|in)(?![\\p{L}]))`, "u"),
];
const SUBJECT_ORG: RegExp[] = [
  new RegExp(`(?:to|with|at|from|@)\\s+(?:the\\s+)?${PROPER}\\s*[!.]?$`, "u"),
  new RegExp(`^${PROPER}\\s*(?::|\\||-|–)`, "u"),
  new RegExp(`your\\s+${PROPER}\\s+application`, "u"),
];
const BAD_ORG = /^(Dear|Hi|Hello|Thank|Thanks|We|You|Your|The|Our|This|Please|Unfortunately|Application|Applications|Interview|Assessment|Programming|Engineering|Software|Summer|Global|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December|Re|Fwd|Fw|Next|Offer|Offers|Status|Decision|Outcome|Results|Congratulations|Important|Action|Reminder|Update|Start|Complete|Invitation|Online|London|Lagos|Remote|EMEA|APAC|USA|UK|Africa|Europe|Microsoft Teams|Google Meet|Zoom|MSc|MA|MS|BSc|BA|PhD|Ph\.D|MPhil|MBA|MEng|Master|Masters|Bachelor|Doctor|Doctoral|Postgraduate|Undergraduate)\b/;

function firstMatch(text: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const cand = m[1].replace(/\s+(Inc|Ltd|LLC|PLC|GmbH|Limited)\.?$/i, "").trim();
      if (cand.length >= 2 && !BAD_ORG.test(cand)) return cand.slice(0, 60);
    }
  }
  return null;
}

export function extractOrg(e: EmailInput): string | null {
  const name = e.fromName ?? "";
  const viaMatch = name.match(/^(.+?)\s+via\s+/i);
  const fromName = viaMatch ? viaMatch[1] : name;
  const ats = isAtsSender(e.from);
  const recruitMailbox = isRecruitSender(e.from);

  const subj = e.subject.replace(/^(re|fwd?|fw):\s*/gi, "");
  const li = subj.match(LINKEDIN_APPLIED);
  if (li) return cleanOrg(li[1]);

  const subjRaw = firstMatch(subj, SUBJECT_ORG);
  const fromSubject = subjRaw ? cleanOrg(subjRaw) : null;
  const fromBody = firstMatch(e.body.slice(0, 1500), ORG_PATTERNS);
  const cleanedName = fromName ? cleanOrg(fromName) : null;
  // A display name like "Busayomi Adekoya" is a person, not an org — unless it came through a hiring platform,
  // where the display name is the company ("Goldman Sachs Recruiting").
  const personLike = Boolean(cleanedName && /^\p{Lu}\p{Ll}+(?: \p{Lu}[\p{Ll}'’-]+){1,2}$/u.test(cleanedName));

  const candidates = [
    viaMatch ? cleanedName : null,
    fromSubject,
    ats ? cleanedName : null,
    recruitMailbox && !personLike ? cleanedName : null,
    fromBody,
    !ats ? titleCaseDomain(e.from) : null,
    !personLike ? cleanedName : null,
  ].filter(Boolean) as string[];
  return candidates[0] ?? null;
}

const END = String.raw`(?:\s+(?:position|role|program|programme)\b|\s+(?:at|with|is|has|was|will)\s|\s+in the\s|\s+office\b|[.!(]|$)`;
const ROLE_PATTERNS: RegExp[] = [
  new RegExp(String.raw`application (?:to be an? |for (?:the |our )?(?:role of |position of )?)(.{3,90}?)` + END, "i"),
  new RegExp(String.raw`(?:applying|applied) for (?:a role in the |a role as an? |the |our |an? )?(?:role of |position of )?(.{3,90}?)` + END, "i"),
  /applying to the (.{3,90}?) at \p{Lu}/u,
  /(?:for|as) (?:the|a|an|our) (.{3,80}?) (?:position|role|opening|vacancy)\b/i,
  /(?:interview|assessment) for (?:the |our )?(.{3,80}?)(?:\s+(?:position|role)\b|\s+at\s|[.!]|$)/i,
];

export function extractRole(e: EmailInput, org: string | null): string | null {
  const subj = e.subject.replace(/^(re|fwd?|fw):\s*/gi, "");
  // "Application Received - Software Engineer, CDN Configuration Group"
  const dash = subj.match(/(?:application received|application submitted|thank you for applying|application confirmation)\s*[-–:|]\s*(.{3,90})$/i);
  let role: string | null = dash?.[1] ?? null;
  if (!role) {
    outer: for (const text of [e.body.slice(0, 1500), subj]) {
      for (const re of ROLE_PATTERNS) {
        const m = text.match(re);
        if (m?.[1]) {
          role = m[1];
          break outer;
        }
      }
    }
  }
  if (!role) return null;
  role = role.replace(/\s{2,}/g, " ").replace(/^(the|a|an|our)\s+/i, "").trim();
  if (org) {
    const o = org.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    role = role.replace(new RegExp(`\\s*(?:at|with|-|\\|)?\\s*${o}\\s*$`, "i"), "").replace(new RegExp(`^${o}\\s+`, "i"), "").trim();
  }
  role = role.replace(/[,\s]+$/, "");
  if (role.length < 3 || /^(this|that|it|our team|us|you|the position|the role|a role|a position)$/i.test(role)) return null;
  return role.slice(0, 90);
}

export function detectType(text: string): OppType {
  for (const [re, t] of TYPE_RULES) if (re.test(text)) return t;
  return "job";
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

const DEADLINE_CUE = /(deadline|due|by|before|no later than|within|expires?|closes?|complete|submit|until)/i;

export function extractDeadlines(text: string, ref: Date, defaultTitle: string): { title: string; due: string }[] {
  const out: { title: string; due: string }[] = [];
  const sentences = text.slice(0, 4000).split(/(?<=[.!?])\s+|\n+/);
  for (const s of sentences) {
    if (!DEADLINE_CUE.test(s)) continue;
    const within = s.match(/within\s+(\d{1,2})\s+(day|days|hour|hours|business days)/i);
    if (within) {
      const n = Number(within[1]);
      const days = /hour/i.test(within[2]) ? Math.max(1, Math.ceil(n / 24)) : n;
      out.push({ title: defaultTitle, due: ymd(new Date(ref.getTime() + days * 86400_000)) });
      continue;
    }
    for (const r of chrono.parse(s, ref, { forwardDate: true })) {
      if (!r.start.isCertain("day") && !r.start.isCertain("weekday")) continue;
      const d = r.start.date();
      if (d.getTime() < ref.getTime() - 86400_000) continue;
      if (d.getTime() > ref.getTime() + 365 * 86400_000) continue;
      out.push({ title: defaultTitle, due: ymd(d) });
      break;
    }
    if (out.length >= 2) break;
  }
  return out;
}

const SUMMARY: Record<Kind, string> = {
  received: "Application received",
  assessment: "Assessment invitation",
  assessment_done: "Assessment submitted",
  interview: "Interview invitation",
  offer: "Offer",
  rejection: "Not moving forward",
  info_request: "Information requested",
  update: "Update",
  outbound: "You emailed",
};

// ───────────────────────── main ─────────────────────────

export function classifyRules(e: EmailInput): Classification {
  const subj = e.subject.replace(/^(re|fwd?|fw):\s*/gi, "");
  const text = `${subj}\n${e.body}`;
  const empty: Classification = {
    relevant: false, confidence: 0, kind: null, org: null, role: null, type: "job",
    deadlines: [], ask: null, summary: "", extractor: "rules",
  };

  // Outbound: recommendation / review requests and applications you sent.
  if (e.direction === "out") {
    const to = (e.to ?? "").split(",")[0]?.trim() ?? "";
    const toAddr = (to.match(/<([^>]+)>/)?.[1] ?? to).toLowerCase();
    const recommendation = /(recommendation|reference letter|letter of (recommendation|support)|referee|reference for)/i.test(subj);
    const review = /(review|feedback)/i.test(subj) && /(draft|statement|essay|application|cv|resume|sop|proposal)/i.test(subj);
    const referral = /\breferral\b|refer me/i.test(subj);
    const applicationish = APPLICATION_WORDS.test(subj) || /(enquiry|inquiry|attachment|opportunity)/i.test(subj);
    if (!recommendation && !review && !referral && !applicationish) return empty;
    const greet = e.body.match(/^(?:[Dd]ear|[Hh]i|[Hh]ello)\s+(?:(?:Dr|Prof|Professor|Associate Professor|Mr|Mrs|Ms|Mx)\.?\s+)?([A-Z][\w'’-]+(?:\s+[A-Z][\w'’-]+)?)(?=[,\s])/m);
    const forWhat = subj.match(/(?:for|–|-|:)\s*(?:the\s+)?(\p{Lu}[\p{L}\p{N}&.'’\- ]{2,60}?)(?:\s+(?:internship|fellowship|application|programme|program|scholarship|admission))?\s*(?:\d{4})?\s*$/u);
    const org = forWhat ? cleanOrg(forWhat[1]) : null;
    return {
      ...empty,
      relevant: true,
      confidence: recommendation || review ? 0.8 : 0.5,
      kind: "outbound",
      org,
      type: detectType(text),
      ask: recommendation || review || referral
        ? { kind: recommendation ? "recommendation" : review ? "review" : "referral", personName: greet?.[1] ?? null, personEmail: toAddr }
        : null,
      summary: recommendation ? "You asked for a recommendation" : review ? "You asked for a review" : `You emailed: ${subj.slice(0, 80)}`,
    };
  }

  const li = subj.match(LINKEDIN_APPLIED);
  if (EXCLUDE_SENDER.test(e.from) && !li) return empty;
  if (EXCLUDE_SUBJECT.test(subj)) return empty;

  const ats = isAtsSender(e.from);
  const recruitMailbox = isRecruitSender(e.from) || RECRUIT_LOCAL.test(e.fromName ?? "");

  let kind: Kind | null = null;
  if (REJECTION.test(text)) kind = "rejection";
  else if (OFFER.test(text)) kind = "offer";
  else if (ASSESSMENT_DONE.test(text)) kind = "assessment_done";
  else if (INTERVIEW_INVITE.test(text)) kind = "interview";
  else if (ASSESSMENT.test(subj) || (ASSESSMENT.test(e.body) && (ats || recruitMailbox))) kind = "assessment";
  else if (RECEIVED.test(text) || li) kind = "received";
  else if (INFO_REQUEST.test(text) && (ats || recruitMailbox)) kind = "info_request";

  // Relevance scoring
  let score = 0;
  if (ats) score += 0.45;
  if (recruitMailbox) score += 0.25;
  if (kind && kind !== "info_request") score += 0.4;
  if (kind === "info_request") score += 0.2;
  if (APPLICATION_WORDS.test(subj)) score += 0.15;
  if (li) score = 1;
  // A personal reply in an application thread without stage words: low-confidence update.
  if (!kind && (ats || recruitMailbox) && APPLICATION_WORDS.test(text)) kind = "update";
  if (!kind) return { ...empty, confidence: Math.min(score, 0.4) };

  const org = extractOrg(e);
  const role = extractRole(e, org);
  const type = detectType(`${subj} ${role ?? ""} ${e.body.slice(0, 600)}`);
  if (org) score += 0.1;
  if (org && (kind === "offer" || kind === "interview" || kind === "rejection")) score += 0.15;
  const confidence = Math.max(0, Math.min(1, score));

  const actionTitle =
    kind === "assessment" ? `Complete ${org ?? "the"} assessment`
    : kind === "interview" ? `Prepare for / schedule ${org ?? ""} interview`.replace(/\s+/g, " ")
    : kind === "info_request" ? `Reply to ${org ?? "request"}`
    : kind === "offer" ? `Respond to ${org ?? ""} offer`.replace(/\s+/g, " ")
    : "";
  let deadlines = actionTitle ? extractDeadlines(e.body, e.date, actionTitle) : [];
  if (actionTitle && !deadlines.length) {
    // No explicit date: give it a sensible default so it lands on Today.
    const days = kind === "offer" ? 5 : 3;
    deadlines = [{ title: actionTitle, due: ymd(new Date(e.date.getTime() + days * 86400_000)) }];
  }

  return {
    relevant: confidence >= 0.35,
    confidence,
    kind,
    org,
    role,
    type,
    deadlines,
    ask: null,
    summary: SUMMARY[kind] + (role ? ` · ${role}` : ""),
    extractor: "rules",
  };
}

export function stageForKind(kind: Kind): { stage: string; outcome?: string } | null {
  switch (kind) {
    case "received": return { stage: "applied" };
    case "assessment":
    case "assessment_done": return { stage: "assessment" };
    case "interview": return { stage: "interview" };
    case "offer": return { stage: "offer" };
    case "rejection": return { stage: "closed", outcome: "rejected" };
    default: return null;
  }
}

export const STAGES = ["interested", "applied", "assessment", "interview", "offer", "closed"] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_RANK: Record<string, number> = { interested: 0, applied: 1, assessment: 2, interview: 3, offer: 4, closed: 5 };

export function orgKey(org: string): string {
  return org
    .toLowerCase()
    .replace(/\b(inc|ltd|llc|plc|gmbh|limited|corp|corporation|technologies|technology|group|holdings|company|co)\b\.?/g, "")
    .replace(/[^a-z0-9]/g, "");
}
