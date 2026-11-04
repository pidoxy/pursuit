import { claudeAvailable, classifyWithClaude } from "./claude";
import { classifyRules, type Classification, type EmailInput } from "./rules";

export * from "./rules";

/**
 * Rules first (free, instant). Claude refines inbound mail the rules found plausibly relevant
 * or uncertain, when a key is configured. Outbound asks always use rules.
 */
export async function classify(e: EmailInput): Promise<Classification> {
  const rules = classifyRules(e);
  if (e.direction === "out" || !claudeAvailable()) return rules;
  if (!rules.relevant && rules.confidence < 0.2) return rules; // obvious noise: don't spend tokens
  try {
    const ai = await classifyWithClaude(e);
    return { ...ai, deadlines: ai.deadlines.length ? ai.deadlines : rules.deadlines };
  } catch (err) {
    console.error("[classify] Claude failed, using rules:", err);
    return rules;
  }
}
