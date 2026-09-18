/**
 * Explanation for `reason: ATTRIBUTE_INCOMPATIBLE`, shared by every abac command
 * that prints a reason. A payload value contradicts the type its attribute
 * schema declares (`"high"` for an `integer`, `"u-42"` for a `uuid`), so the
 * engine evaluated it as absent. The decision or SQL stands as returned — the
 * fix is in the payload or the schema, not in the policy.
 */
export const ATTRIBUTE_INCOMPATIBLE_NOTE =
  "ATTRIBUTE_INCOMPATIBLE — a --user/--context/--request value does not match its declared " +
  "attribute type and was evaluated as absent (fix the payload or the schema, not the policy).";
