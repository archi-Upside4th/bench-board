/**
 * Per-model API pricing (USD per 1M tokens). Used by importTrialResults to
 * auto-fill cost_usd when the trial JSON's cost is null.
 *
 * Sources (May 2026):
 *  - OpenAI:    https://openai.com/api/pricing/
 *  - Anthropic: https://platform.claude.com/docs/en/about-claude/pricing
 *  - Google:    https://ai.google.dev/gemini-api/docs/pricing
 *  - DeepSeek:  https://api-docs.deepseek.com/
 *
 * If cachedInput isn't set, we assume input * 0.5 (industry-typical 50% off
 * for cached input tokens).
 */
export type Pricing = {
  input: number;        // USD per 1M tokens
  output: number;       // USD per 1M tokens (also charges reasoning tokens)
  cachedInput?: number; // USD per 1M cached input tokens
};

const PRICING: Record<string, Pricing> = {
  // ---------- OpenAI ----------
  "gpt-5.5":         { input: 5.00,  output: 30.00, cachedInput: 0.50 },
  "gpt-5.5-pro":     { input: 30.00, output: 180.00 },
  "gpt-5.4":         { input: 2.50,  output: 15.00 },
  "gpt-5.4-mini":    { input: 0.75,  output: 4.50 },
  "gpt-5.4-nano":    { input: 0.20,  output: 1.25 },
  "gpt-5":           { input: 1.25,  output: 10.00, cachedInput: 0.125 },
  "gpt-5-mini":      { input: 0.25,  output: 2.00 },
  "gpt-5-nano":      { input: 0.05,  output: 0.40 },
  "gpt-4.1":         { input: 2.00,  output: 8.00 },
  "gpt-4.1-mini":    { input: 0.40,  output: 1.60 },
  "gpt-4.1-nano":    { input: 0.10,  output: 0.40 },
  "gpt-4o":          { input: 2.50,  output: 10.00 },
  "gpt-4o-mini":     { input: 0.15,  output: 0.60 },
  "o1":              { input: 15.00, output: 60.00 },
  "o1-mini":         { input: 3.00,  output: 12.00 },
  "o3":              { input: 2.00,  output: 8.00 },
  "o3-mini":         { input: 1.10,  output: 4.40 },
  "o4-mini":         { input: 0.55,  output: 2.20 },
  // OpenAI OSS models on OpenRouter free tier (cost = 0)
  "gpt-oss-120b":    { input: 0,     output: 0 },
  "gpt-oss-20b":     { input: 0,     output: 0 },

  // ---------- Anthropic ----------
  "claude-opus-4-7":   { input: 5.00, output: 25.00 },
  "claude-opus-4-6":   { input: 5.00, output: 25.00 },
  "claude-sonnet-4-6": { input: 3.00, output: 15.00 },
  "claude-sonnet-4-5": { input: 3.00, output: 15.00 },
  "claude-haiku-4-5":  { input: 1.00, output: 5.00 },

  // ---------- Google ----------
  "gemini-3.1-pro":   { input: 2.50, output: 15.00 },
  "gemini-2.5-pro":   { input: 1.25, output: 10.00 },
  "gemini-2.5-flash": { input: 0.30, output: 2.50 },
  "gemini-2.5-flash-lite": { input: 0.10, output: 0.40 },

  // ---------- DeepSeek ----------
  "deepseek-v3.5":    { input: 0.27, output: 1.10 },
  "deepseek-v3":      { input: 0.27, output: 1.10 },
  "deepseek-r1":      { input: 0.55, output: 2.19 },

  // ---------- Meta ----------
  "llama-3.3-70b":    { input: 0.59, output: 0.79 },

  // ---------- Special ----------
  "_free": { input: 0, output: 0 },
};

/**
 * Look up pricing for a model identifier. Handles:
 *   - provider prefix:  "openai/gpt-5"           → "gpt-5"
 *   - dated suffix:     "gpt-5-2025-08-07"       → "gpt-5"
 *   - tier suffix:      "gpt-oss-120b:free"      → "_free"
 *   - case insensitive
 */
export function lookupPricing(model: string): Pricing | null {
  if (!model) return null;
  const lower = model.toLowerCase();
  // OpenRouter-style :free tier
  if (lower.includes(":free")) return PRICING._free;
  // Strip ":tier" suffix
  const noTier = lower.split(":")[0];
  // Strip provider prefix
  const noPrefix = noTier.includes("/") ? noTier.slice(noTier.indexOf("/") + 1) : noTier;
  // Exact match
  if (PRICING[noPrefix]) return PRICING[noPrefix];
  // Longest-prefix match (e.g., "gpt-5-2025-08" → "gpt-5")
  const keys = Object.keys(PRICING).filter((k) => k !== "_free");
  // Sort longer keys first so we prefer "gpt-5-mini" over "gpt-5"
  keys.sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (noPrefix === key || noPrefix.startsWith(key + "-") || noPrefix.startsWith(key + ":") || noPrefix.startsWith(key + ".")) {
      return PRICING[key];
    }
  }
  return null;
}

/**
 * Compute cost in USD for one trial.
 *
 * Convention (matches OpenAI / OpenRouter usage stats):
 *   - `output_tokens` ALREADY INCLUDES `reasoning_tokens` (reasoning is just
 *     a breakdown of the output). Don't add reasoning again — it'd double-count.
 *   - `input_tokens` ALREADY INCLUDES `cached_tokens`. The cached portion
 *     is billed at the cached rate; the rest at the input rate.
 *
 *   billed_input  = input_tokens - cached_tokens        × input_price
 *   billed_cached = cached_tokens                       × cached_price
 *   billed_output = output_tokens                       × output_price
 */
export function computeCost(
  model: string,
  tokens: { input?: number | null; output?: number | null; reasoning?: number | null; cached?: number | null }
): number | null {
  const p = lookupPricing(model);
  if (!p) return null;
  const input = tokens.input ?? 0;
  const output = tokens.output ?? 0;
  const cached = Math.min(tokens.cached ?? 0, input);
  const freshInput = Math.max(0, input - cached);
  const cachedRate = p.cachedInput ?? p.input * 0.5;
  // reasoning_tokens is intentionally ignored — already inside output_tokens per
  // OpenAI/OpenRouter convention.
  const cost = (freshInput * p.input + cached * cachedRate + output * p.output) / 1_000_000;
  return cost;
}
