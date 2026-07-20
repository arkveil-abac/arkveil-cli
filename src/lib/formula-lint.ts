/**
 * Offline checks for Formula DSL text and dataset references.
 *
 * These exist to turn confusing server errors into actionable local ones. The
 * two that matter most:
 *
 * - `entity.` is no longer a lexer token (the namespace is `data.` now), so a
 *   stale formula fails at apply with a raw parse error — "mismatched input
 *   'author_id' expecting 'it'" — that says nothing about the rename.
 * - A dataset reference must be canonical lowercase; unlike `datasetCode` on a
 *   target, DSL text is not normalized server-side.
 *
 * Nothing here parses the DSL. Every rule is a word-boundary or shape check
 * that cannot produce a false positive on valid input, so the results are safe
 * to surface as warnings before the request goes out.
 */

/** Formula DSL keywords. A dataset identity segment that collides with one of
 * these makes the dataset unaddressable in policy conditions, and the server
 * rejects it at datasource/dataset creation. */
export const FORMULA_KEYWORDS: ReadonlySet<string> = new Set([
  "user",
  "context",
  "action",
  "request",
  "data",
  "and",
  "or",
  "not",
  "is",
  "in",
  "it",
  "as",
  "any",
  "all",
  "none",
  "every",
  "exists",
  "where",
  "null",
  "true",
  "false",
  "empty",
  "uniform",
  "diverse",
  "contains",
  "matches",
]);

/** Dataset references inside an `exists` body: a full code or a bare table. */
const EXISTS_REFERENCE = /\bexists\s+([A-Za-z_][A-Za-z0-9_.]*)/g;
/** The retired row-attribute namespace. */
const ENTITY_NAMESPACE = /\bentity\.([A-Za-z_][A-Za-z0-9_]*)/g;
/** Array literals — elements stay unsigned integers, strings, or booleans. */
const ARRAY_LITERAL = /\[([^\]]*)\]/g;
/** A scalar numeric literal needs digits on both sides of any dot. */
const MALFORMED_NUMBER = /(?<![A-Za-z0-9_."])(?:\.\d+|\d+\.(?!\d))/;

/**
 * Lint a formula (a policy condition/filter, a target condition, or a test
 * selector formula). Returns human-readable warnings, most specific first;
 * an empty array means nothing suspicious was found.
 */
export function lintFormula(formula: string, flag: string): string[] {
  const warnings: string[] = [];

  const renamed = [...formula.matchAll(ENTITY_NAMESPACE)].map((m) => m[1]);
  if (renamed.length > 0) {
    const first = renamed[0];
    warnings.push(
      `${flag} uses the removed \`entity.\` namespace (${renamed.map((c) => `entity.${c}`).join(", ")}). ` +
        `Dataset columns are read as \`data.<column>\` now — write \`data.${first}\`. ` +
        "The server has no compatibility shim; this fails with a raw parse error.",
    );
  }

  for (const [, reference] of formula.matchAll(EXISTS_REFERENCE)) {
    if (reference === undefined) continue;
    // `exists <collection> where …` over an attribute array is the iterative
    // predicate, not a dataset fetch.
    if (/^(user|context|action|request|data)\./.test(reference)) continue;
    warnings.push(...lintDatasetReference(reference, flag));
  }

  for (const [, elements] of formula.matchAll(ARRAY_LITERAL)) {
    if (elements === undefined) continue;
    if (/(^|,)\s*-?\d+\.\d+\s*(,|$)/.test(elements) || /(^|,)\s*-\d+\s*(,|$)/.test(elements)) {
      warnings.push(
        `${flag} has an array literal with a signed or decimal element ([${elements.trim()}]). ` +
          "Array elements stay unsigned integers, strings, or booleans — only scalar comparisons take " +
          "decimals and negatives.",
      );
    }
  }

  if (MALFORMED_NUMBER.test(formula)) {
    warnings.push(
      `${flag} has a numeric literal missing digits on one side of the dot. ` +
        "Write `0.5` and `1.0`, not `.5` or `1.`.",
    );
  }

  return warnings;
}

/**
 * Lint a dataset reference as it appears in DSL text: either the full
 * `datasource.schema.table` code or a bare table name. Short references resolve
 * against the workspace's live datasets when the policy is *saved*, which makes
 * them state-dependent — fine for a one-off, risky in a manifest.
 */
export function lintDatasetReference(reference: string, flag: string): string[] {
  const warnings: string[] = [];
  const segments = reference.split(".");

  if (reference !== reference.toLowerCase()) {
    warnings.push(
      `${flag} references dataset '${reference}' with non-lowercase characters. ` +
        "DSL text is not normalized server-side; write the reference in canonical lowercase.",
    );
  }
  if (segments.length === 2) {
    warnings.push(
      `${flag} references dataset '${reference}' with two segments. ` +
        "A reference is either a bare table name or the full datasource.schema.table code.",
    );
  }
  if (segments.length > 3) {
    warnings.push(
      `${flag} references dataset '${reference}' with ${segments.length} segments; ` +
        "a dataset code has exactly 3 (datasource.schema.table).",
    );
  }
  if (segments.length === 1) {
    warnings.push(
      `${flag} uses the short dataset reference '${reference}'. ` +
        "It binds to whichever live dataset has that table name at save time, so the same text can " +
        "resolve differently per workspace or break when another `*.*." +
        `${reference.toLowerCase()}\` appears. Prefer the full datasource.schema.table code in ` +
        "anything repeatable.",
    );
  }

  return warnings;
}

/**
 * Lint a value that must be a full canonical dataset code (a DATA target
 * binding, an `abac read/write` argument, a dataset test's `datasetCode`) —
 * short references are not accepted in those places.
 */
export function lintDatasetCode(code: string, flag: string): string[] {
  const segments = code.split(".");
  if (segments.length !== 3 || segments.some((s) => s.length === 0)) {
    return [
      `${flag} value '${code}' is not a dataset code: it must have exactly 3 segments ` +
        "(datasource.schema.table).",
    ];
  }
  return [];
}

/**
 * Lint a datasource name or a dataset schema/table segment. A segment that is a
 * Formula DSL keyword is rejected server-side, so catch it before the call.
 */
export function lintIdentitySegment(segment: string, label: string): string[] {
  if (FORMULA_KEYWORDS.has(segment.toLowerCase())) {
    return [
      `${label} '${segment}' is a Formula DSL keyword and would make the dataset unaddressable ` +
        "in policy conditions.",
    ];
  }
  return [];
}
