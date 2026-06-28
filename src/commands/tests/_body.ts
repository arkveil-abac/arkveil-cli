import { parseJsonObjectFlag } from "../../lib/input.js";
import type {
  UpdateTestRequest,
  TestStatus,
  SelectorType,
  ExpectedAccess,
} from "../../lib/types.js";

/** Shared flags for creating/updating a test. */
export interface TestBodyOptions {
  name: string;
  description?: string;
  tag?: string[];
  status: TestStatus;
  selectorType: SelectorType;
  actionCode?: string[];
  formula?: string;
  user?: string;
  context?: string;
  expectedAccess: ExpectedAccess;
  mustBeGrantedBy?: string[];
}

/**
 * Build the request body shared by create and update. `userAttributes` and
 * `contextAttributes` are required by the API and default to empty objects.
 */
export function buildTestBody(options: TestBodyOptions): UpdateTestRequest {
  return {
    name: options.name,
    ...(options.description !== undefined ? { description: options.description } : {}),
    tags: options.tag ?? [],
    status: options.status,
    selectorType: options.selectorType,
    ...(options.actionCode && options.actionCode.length > 0 ? { actionCodes: options.actionCode } : {}),
    ...(options.formula !== undefined ? { formulaDsl: options.formula } : {}),
    userAttributes: parseJsonObjectFlag(options.user, "--user") ?? {},
    contextAttributes: parseJsonObjectFlag(options.context, "--context") ?? {},
    expectedAccess: options.expectedAccess,
    ...(options.mustBeGrantedBy && options.mustBeGrantedBy.length > 0
      ? { mustBeGrantedByPolicyIds: options.mustBeGrantedBy }
      : {}),
  };
}
