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
export type ExplainResultDTO = S["ExplainResultDTO"];
export type PermissionCheckResponse = S["PermissionCheckResponse"];
export type WriteChecksResponse = S["WriteChecksResponse"];
export type ReadConditionResponse = S["ReadConditionResponse"];
export type SuggestResponse = S["SuggestResponse"];
export type Expression = S["Expression"];

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
export type ExplainRequest = S["ExplainRequest"];
export type PermissionCheckRequest = S["PermissionCheckRequest"];
export type WriteChecksRequest = S["WriteChecksRequest"];
export type ReadConditionRequest = S["ReadConditionRequest"];

// Enumerations reused by flags
export type TestStatus = NonNullable<S["UpdateTestStatusRequest"]["status"]>;
export type PolicyType = NonNullable<S["CreatePolicyRequest"]["type"]>;
export type PolicyStatus = NonNullable<S["CreatePolicyRequest"]["status"]>;
export type TargetType = NonNullable<S["CreateTargetRequest"]["type"]>;
export type TargetMode = NonNullable<S["CreateTargetRequest"]["mode"]>;
export type SelectorType = NonNullable<S["CreateTestRequest"]["selectorType"]>;
export type ExpectedAccess = NonNullable<S["CreateTestRequest"]["expectedAccess"]>;
export type AttributeSchemaType = "user" | "context" | "action";
export type DatasourceDialect = NonNullable<S["CreateDatasourceRequest"]["dialect"]>;
export type PkType = NonNullable<S["CreateDatasetRequest"]["pkType"]>;
