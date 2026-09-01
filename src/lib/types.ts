/**
 * Friendly aliases for the auto-generated component schemas, so command code
 * reads cleanly and stays decoupled from the generated file's deep paths.
 */
import type { components } from "./generated/schema.js";

type S = components["schemas"];

// Resources
export type Tag = S["TagDTO"];
export type DatasourceDTO = S["DatasourceDTO"];
export type DatasetDTO = S["DatasetDTO"];
export type PolicyDTO = S["PolicyDTO"];
export type TargetDTO = S["TargetDTO"];
export type ActionDTO = S["ActionDTO"];
export type TestDTO = S["TestDTO"];
export type ResolvedNavigationTree = S["ResolvedNavigationTree"];
export type ResolvedNavigationNode = S["ResolvedNavigationNode"];
export type TestRunDTO = S["TestRunDTO"];
export type TestRunHistoryResponse = S["TestRunHistoryResponse"];
export type UserSettings = S["UserSettings"];
export type AttributeSchemaResponse = S["AttributeSchemaResponse"];
export type ApiKeySummaryResponse = S["ApiKeySummaryResponse"];
export type CreateApiKeyResponse = S["CreateApiKeyResponse"];
export type ExplainActionResultDTO = S["ExplainActionResultDTO"];
export type ExplainDatasetResultDTO = S["ExplainDatasetResultDTO"];
export type EvaluationDetails = S["EvaluationDetails"];
export type FiltrationEvaluationDetails = S["FiltrationEvaluationDetails"];
export type FilterEvaluation = S["FilterEvaluation"];
export type DataPolicyEvaluation = S["DataPolicyEvaluation"];
export type PermissionCheckResponse = S["PermissionCheckResponse"];
export type WriteChecksResponse = S["WriteChecksResponse"];
export type ReadConditionResponse = S["ReadConditionResponse"];
export type TouchConditionResponse = S["TouchConditionResponse"];
export type DatasetCheckOutcome = S["DatasetCheckOutcome"];
export type SuggestResponse = S["SuggestResponse"];
export type Expression = S["Expression"];
export type TestResultDTO = S["TestResultDTO"];
export type DatasetTestOutcome = S["DatasetTestOutcome"];

// Request bodies
export type CreateTagRequest = S["CreateTagRequest"];
export type UpdateTagRequest = S["UpdateTagRequest"];
export type CreateDatasourceRequest = S["CreateDatasourceRequest"];
export type UpdateDatasourceRequest = S["UpdateDatasourceRequest"];
export type CreateDatasetRequest = S["CreateDatasetRequest"];
export type UpdateDatasetRequest = S["UpdateDatasetRequest"];
export type CreateFolderRequest = S["CreateFolderRequest"];
export type UpdateFolderRequest = S["UpdateFolderRequest"];
export type CreateActionRequest = S["CreateActionRequest"];
export type UpdateActionRequest = S["UpdateActionRequest"];
export type CreateTargetRequest = S["CreateTargetRequest"];
export type UpdateTargetRequest = S["UpdateTargetRequest"];
export type CreatePolicyRequest = S["CreatePolicyRequest"];
export type UpdatePolicyRequest = S["UpdatePolicyRequest"];
export type CreateTestRequest = S["CreateTestRequest"];
export type UpdateTestRequest = S["UpdateTestRequest"];
export type UpdateTestStatusRequest = S["UpdateTestStatusRequest"];
export type UserSettingsBody = S["UserSettings"];
export type UpdateAttributeSchemaRequest = S["UpdateAttributeSchemaRequest"];
export type SuggestRequest = S["SuggestRequest"];
export type ParseFormulaRequest = S["ParseFormulaRequest"];
export type ExplainActionRequest = S["ExplainActionRequest"];
export type ExplainDatasetRequest = S["ExplainDatasetRequest"];
export type PermissionCheckRequest = S["PermissionCheckRequest"];
export type WriteChecksRequest = S["WriteChecksRequest"];
export type ReadConditionRequest = S["ReadConditionRequest"];
export type TouchConditionRequest = S["TouchConditionRequest"];

// Enumerations reused by flags
export type TestStatus = NonNullable<S["UpdateTestStatusRequest"]["status"]>;
export type PolicyType = NonNullable<S["CreatePolicyRequest"]["type"]>;
export type PolicyStatus = NonNullable<S["CreatePolicyRequest"]["status"]>;
export type TargetType = NonNullable<S["CreateTargetRequest"]["type"]>;
export type TargetMode = NonNullable<S["CreateTargetRequest"]["mode"]>;
export type AttributeSchemaType = "user" | "context" | "action";
export type DatasourceDialect = NonNullable<S["CreateDatasourceRequest"]["dialect"]>;
export type PkType = NonNullable<S["CreateDatasetRequest"]["pkType"]>;
/** What a request does: CREATE | READ | UPDATE | DELETE. */
export type DataOperation = S["ExplainDatasetRequest"]["operation"];
/** The mutation subset of `DataOperation` — what write checks and `policy.operations` speak. */
export type WriteOperation = S["WriteChecksRequest"]["operation"];

/**
 * Test specifications, hand-written rather than aliased from the generated
 * schema: the generator names the Jackson discriminator after the schema
 * ("ActionAccessTestSpecification"), while the wire value is the subtype name
 * ("ACTION_ACCESS"). These types spell the values the API actually accepts.
 */
export type TestSpecificationType = "ACTION_ACCESS" | "DATASET_READ" | "DATASET_WRITE";
export type ActionSelectorType = "ACTION_SET" | "FORMULA" | "ALL_ACTIONS";
export type ExpectedAccess = "GRANTED" | "DENIED";

export type ActionTestSelector =
  | { type: "ACTION_SET"; actionCodes: string[] }
  | { type: "FORMULA"; formulaDsl: string }
  | { type: "ALL_ACTIONS" };

export interface ActionAccessTestSpecification {
  type: "ACTION_ACCESS";
  selector: ActionTestSelector;
  scenario: {
    userAttributes: Record<string, unknown>;
    contextAttributes: Record<string, unknown>;
    requestAttributes?: Record<string, unknown>;
    datasetFixtures?: Record<string, Record<string, unknown>[]>;
  };
  assertion: { expectedAccess: ExpectedAccess; mustBeGrantedByPolicyIds?: string[] };
}

export interface DatasetTestScenario {
  userAttributes: Record<string, unknown>;
  contextAttributes: Record<string, unknown>;
  datasetFixtures: Record<string, Record<string, unknown>[]>;
}

export interface DatasetReadTestSpecification {
  type: "DATASET_READ";
  datasetCode: string;
  scenario: DatasetTestScenario;
  assertion: { expectedVisiblePks: string[] };
}

export interface DatasetWriteTestSpecification {
  type: "DATASET_WRITE";
  datasetCode: string;
  operation: WriteOperation;
  scenario: DatasetTestScenario;
  /** One field per check the operation has: writable = TOUCH (UPDATE/DELETE), producible = RESULT (CREATE/UPDATE). */
  assertion: { expectedWritablePks?: string[]; expectedProduciblePks?: string[] };
}

export type TestSpecification =
  | ActionAccessTestSpecification
  | DatasetReadTestSpecification
  | DatasetWriteTestSpecification;

/** Request bodies as the API accepts them, with our `specification` typing. */
export type TestBody = Omit<UpdateTestRequest, "specification"> & {
  specification: TestSpecification;
};
export type CreateTestBody = TestBody & { parentFolderId: string };
