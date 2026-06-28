import type { CliContext } from "../../lib/context.js";

/**
 * Human-readable reference for the Arkveil formula DSL.
 *
 * Single source of truth for `arkveil formula syntax`. Kept in sync with the
 * ANTLR grammar (Formula.g4) in the kernel. Written for both humans and LLM
 * agents that generate DSL — so it is explicit about the easy-to-get-wrong
 * parts (single `=`, lowercase keywords, integer-only numbers, the `where`
 * precedence rule).
 */
export const FORMULA_SYNTAX_REFERENCE = `Arkveil Formula DSL — syntax reference

A formula is a single boolean expression evaluated against the attributes of a
request; it returns true or false. Formulas are used for policy conditions and
filters, target conditions, and test selectors.

ATTRIBUTE REFERENCES
  Read request attributes through one of four roots. The dot is part of the
  keyword — write "user.role", not "user . role":

    user.<path>      e.g. user.role, user.profile.age
    context.<path>   e.g. context.country, context.time.hour   (note: "context.", not "ctx.")
    action.<path>    e.g. action.name, action.tags
    request.<path>   e.g. request.invoice.amount

  Paths may be nested with dots: request.invoice.line.total

LITERALS
  String    "double quoted"     escape an inner quote with \\"   e.g. "O\\"Brien"
  Integer   42                   whole numbers only — no decimals, no negatives
  Boolean   true   false
  Array     ["a","b"]  [1,2,3]  [true,false]
              • never empty
              • all elements must be the same type
              • elements are literals only (no attribute references inside an array)

COMPARISON
  =      equal        user.role = "admin"
  !=     not equal    user.status != "blocked"

  Equality is a single "=" (NOT "=="). "==" is not valid.

STRING PREDICATES        left <op> right
  contains                request.path contains "/admin"
  containsIgnoreCase      user.email containsIgnoreCase "@Arkveil.com"
  startsWith              action.name startsWith "delete"
  startsWithIgnoreCase    action.name startsWithIgnoreCase "Delete"
  matches                 user.name matches "^A.*"          (regular expression)

PRESENCE / SET / COLLECTION CHECKS
  is null              user.manager is null
  is not null          user.manager is not null
  in <array>           user.role in ["admin","editor"]
  not in <array>       context.region not in ["EU","UK"]
  is empty             action.tags is empty
  is not empty         action.tags is not empty
  is uniform           request.amounts is uniform     (all elements are equal)
  is diverse           request.amounts is diverse     (elements are not all equal)

BOOLEAN LOGIC          precedence, lowest to highest:  or  <  and  <  not
  and     user.active = true and context.country = "US"
  or      user.isOwner = true or user.role = "admin"
  not     not (user.suspended = true)

  Keywords are lowercase. Use parentheses to group: (a or b) and c

ITERATIVE PREDICATES OVER COLLECTIONS
  Test the elements of an array. <condition> is a full boolean expression in
  which "it" refers to the current element:

    any    <collection> [as <alias>] where <condition>    at least one element matches
    all    <collection> [as <alias>] where <condition>    every element matches
    every  <collection> [as <alias>] where <condition>    every element matches
    none   <collection> [as <alias>] where <condition>    no element matches
    exists <collection> [as <alias>] where <condition>    at least one element matches

  • <collection> must be an array attribute (user./context./action./request.)
    or an array literal. It cannot be "it", a scalar literal, or a parenthesized
    expression.
  • Because <condition> is a full expression, "and"/"or" bind INSIDE the where:
        any user.tags where it = "a" or it = "b"
    To combine a whole iterative predicate with an outer expression, wrap it in
    parentheses:
        (any user.tags where it = "a") or user.active = true
  • Each <collection> must be one of those roots or an array literal — you cannot
    iterate an alias element (e.g. "g.members" is not a valid collection).
  • For nested iteration, name the outer collection with "as" and reference its
    current element as <alias>.it ("it" alone is always the innermost element):
        any user.groups as g where any context.allowedGroups where it = g.it

EXAMPLES
  user.role = "admin"
  user.role = "admin" and context.country = "US"
  not (user.suspended = true) and user.role in ["admin","editor"]
  request.path startsWith "/admin/" and user.clearance != "none"
  action.tags is not empty and none action.tags where it = "blocked"
  any user.permissions where it startsWith "billing:"
  all request.items as line where line.it != ""
  (any user.tags where it = "vip") or user.isOwner = true
`;

/** Print the formula DSL syntax reference (no network / auth required). */
export function formulaSyntax(ctx: CliContext): Promise<void> {
  ctx.out.data(
    { dsl: "arkveil-formula", reference: FORMULA_SYNTAX_REFERENCE },
    () => FORMULA_SYNTAX_REFERENCE,
  );
  return Promise.resolve();
}
