import type { Output } from "../../lib/output.js";
import type { Tag } from "../../lib/types.js";

export function renderTag(o: Output, tag: Tag): string {
  return o.keyValue([
    ["id", tag.id],
    ["slug", tag.slug],
    ["color", tag.color],
    ["tooltip", tag.tooltip ?? ""],
    ["description", tag.description ?? ""],
  ]);
}
