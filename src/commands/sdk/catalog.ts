/**
 * The Arkveil SDK catalog: the single source of truth for `arkveil sdk`.
 *
 * Written for both humans and AI coding agents. An agent calls
 * `arkveil sdk info --json` to learn which SDK to install for a given language
 * and platform, the exact install command, a minimal usage snippet, and the
 * recipe for turning the project's attribute schemas into typed SDK code.
 *
 * Keep this in sync with the published packages (the `arkveil-js` monorepo):
 * `arkveil` (core), `@arkveil/node`, `@arkveil/nest`.
 */

/** A single installable SDK package targeting one platform/runtime. */
export interface SdkTarget {
  /** Stable id used as the `arkveil sdk info <target>` argument. */
  id: "core" | "node" | "nest";
  title: string;
  /** npm package name to install. */
  package: string;
  /** Runtime/platform this package targets. */
  platform: string;
  /** Frameworks it integrates with. */
  frameworks: string[];
  /** When an agent/human should pick this target over the others. */
  whenToUse: string;
  /** Exact install command (npm). */
  install: string;
  /** Minimal, copy-pasteable usage snippet. */
  quickStart: string;
  /** npm page for the package. */
  docs: string;
}

/** How the SDK becomes typed from a project's CLI-served schemas. */
export interface SdkTypingGuide {
  summary: string;
  /** The declaration-merging registries the generated file augments. */
  registries: Array<{
    interface: string;
    key: string;
    resolves: string;
    source: string;
  }>;
  /** The ordered recipe an AI agent follows to type the SDK. */
  steps: string[];
  /** A complete example of the file the agent should generate. */
  example: string;
}

export interface SdkCatalog {
  /** Human label for the one supported language family. */
  language: string;
  /** Individual languages supported today. */
  languages: string[];
  /** Package registry the install commands target. */
  registry: "npm";
  /** Runtime/toolchain requirements shared by every target. */
  requirements: { node: string; typescript: string };
  /** Plain-language note about current platform support. */
  note: string;
  targets: SdkTarget[];
  typing: SdkTypingGuide;
}

export const SDK_CATALOG: SdkCatalog = {
  language: "TypeScript / JavaScript",
  languages: ["TypeScript", "JavaScript"],
  registry: "npm",
  requirements: { node: ">=18", typescript: "^5 (for typed usage)" },
  note: "Only TypeScript / JavaScript is supported today, via three packages: the core SDK (arkveil), Node.js/Express (@arkveil/node), and NestJS (@arkveil/nest). There are no SDKs for other languages yet.",
  targets: [
    {
      id: "nest",
      title: "NestJS SDK",
      package: "@arkveil/nest",
      platform: "NestJS (Node.js)",
      frameworks: ["NestJS"],
      whenToUse:
        "Use in a NestJS application. Configure once with ArkveilModule.forRoot and protect routes declaratively with the @PermissionPoint decorator.",
      install: "npm install @arkveil/nest",
      quickStart: `import { Module } from "@nestjs/common";
import { ArkveilModule } from "@arkveil/nest";

@Module({
  imports: [
    ArkveilModule.forRoot({
      serviceUrl: "https://api.arkveil.com",
      apiKey: process.env.ARKVEIL_API_KEY!,
      getUserAttributes: (req) => ({ id: req.user?.id, role: req.user?.role }),
    }),
  ],
})
export class AppModule {}

// Protect a route — the code is type-checked once the registry is augmented:
import { Controller, Delete } from "@nestjs/common";
import { PermissionPoint } from "@arkveil/nest";

@Controller("articles")
export class ArticlesController {
  @Delete(":id")
  @PermissionPoint("content-service.article-delete")
  remove() {
    return "Protected content";
  }
}`,
      docs: "https://www.npmjs.com/package/@arkveil/nest",
    },
    {
      id: "node",
      title: "Node.js / Express SDK",
      package: "@arkveil/node",
      platform: "Node.js (Express, Fastify, and other HTTP frameworks)",
      frameworks: ["Express", "Fastify", "Node.js HTTP"],
      whenToUse:
        "Use in a non-Nest Node.js HTTP server. Provides a `permissionPoint(code)` middleware for Express/Fastify-style apps.",
      install: "npm install @arkveil/node arkveil",
      quickStart: `import { Arkveil } from "@arkveil/node";

const arkveil = new Arkveil({
  serviceUrl: "https://api.arkveil.com",
  apiKey: process.env.ARKVEIL_API_KEY!,
  getUserAttributes: (req) => ({ id: req.user?.id, role: req.user?.role }),
  onDenied: (req, res) => res.status(403).json({ error: "Forbidden" }),
});

app.post(
  "/api/admin",
  arkveil.permissionPoint("content-service.article-delete"),
  (req, res) => res.json({ message: "Protected content" }),
);`,
      docs: "https://www.npmjs.com/package/@arkveil/node",
    },
    {
      id: "core",
      title: "Core SDK (runtime-agnostic)",
      package: "arkveil",
      platform: "Any JavaScript runtime (Node.js, edge, workers, browser)",
      frameworks: ["any"],
      whenToUse:
        "Use when you want to call Arkveil directly (no middleware), or to build your own platform integration. @arkveil/node and @arkveil/nest are built on top of this.",
      install: "npm install arkveil",
      quickStart: `import { Arkveil } from "arkveil";

const arkveil = new Arkveil({
  serviceUrl: "https://api.arkveil.com",
  apiKey: process.env.ARKVEIL_API_KEY!,
});

const { granted } = await arkveil.checkPermission({
  code: "content-service.article-delete",
  user: { id: "user-123", role: "admin" },
  context: {},
});

if (granted) {
  // allow
} else {
  // deny
}`,
      docs: "https://www.npmjs.com/package/arkveil",
    },
  ],
  typing: {
    summary:
      "The SDK is typed by declaration merging. The CLI serves the project's attribute schemas as JSON Schema; an AI agent translates them to TypeScript and augments the SDK registries in a generated file. Until then, attributes are Record<string, any> and codes are string, so untyped usage keeps working.",
    registries: [
      {
        interface: "ArkveilUserRegistry",
        key: "attributes",
        resolves: "ArkveilUser",
        source: "arkveil schemas get user --json",
      },
      {
        interface: "ArkveilContextRegistry",
        key: "attributes",
        resolves: "ArkveilContext",
        source: "arkveil schemas get context --json",
      },
      {
        interface: "ArkveilCodeRegistry",
        key: "codes",
        resolves: "ArkveilCode",
        source: "the permission/action codes defined in your project",
      },
    ],
    steps: [
      "Fetch the user attribute JSON Schema: `arkveil schemas get user --json` (the schema is under `.jsonSchema`).",
      "Fetch the context attribute JSON Schema: `arkveil schemas get context --json`.",
      "Translate each JSON Schema into a TypeScript interface (respect `properties`, `required`, enums, and nested objects).",
      "Write a single generated file (e.g. `arkveil-attributes.generated.ts`) that exports those interfaces and augments `ArkveilUserRegistry` / `ArkveilContextRegistry` via `declare module \"arkveil\"`.",
      "Import the generated file once (a side-effect import) so the augmentation is in scope. `getUserAttributes`, `getContextAttributes`, and `checkPermission` are now type-checked against the schema.",
      "Re-run the fetch + regenerate whenever the project's attribute schemas change to keep the types in sync.",
    ],
    example: `// arkveil-attributes.generated.ts — generated from \`arkveil schemas get\`
export interface ArkveilUserAttributes {
  id?: string;
  role: "admin" | "editor" | "viewer";
}

export interface ArkveilContextAttributes {
  ipAddress?: string;
  region?: "EU" | "US";
}

declare module "arkveil" {
  interface ArkveilUserRegistry {
    attributes: ArkveilUserAttributes;
  }
  interface ArkveilContextRegistry {
    attributes: ArkveilContextAttributes;
  }
}`,
  },
};

/** Look up a single target by its id. */
export function findTarget(id: string): SdkTarget | undefined {
  return SDK_CATALOG.targets.find((t) => t.id === id);
}

export const SDK_TARGET_IDS = SDK_CATALOG.targets.map((t) => t.id);

/** Render one target as a human-readable block. */
export function renderTarget(t: SdkTarget): string {
  return [
    `${t.title}  (${t.package})`,
    `  Platform:   ${t.platform}`,
    `  Frameworks: ${t.frameworks.join(", ")}`,
    `  When:       ${t.whenToUse}`,
    `  Install:    ${t.install}`,
    "",
    indent(t.quickStart, 2),
  ].join("\n");
}

/** Render the typed-attributes recipe as a human-readable block. */
export function renderTyping(typing: SdkTypingGuide): string {
  const registries = typing.registries
    .map(
      (r) =>
        `  • ${r.interface} (key "${r.key}") → ${r.resolves}\n      from: ${r.source}`,
    )
    .join("\n");
  const steps = typing.steps.map((s, i) => `  ${i + 1}. ${s}`).join("\n");
  return [
    "TYPED USER & CONTEXT ATTRIBUTES",
    `  ${typing.summary}`,
    "",
    "  Registries to augment:",
    registries,
    "",
    "  Steps:",
    steps,
    "",
    "  Example generated file:",
    indent(typing.example, 4),
  ].join("\n");
}

/** Render the whole catalog (optionally filtered to one target) as text. */
export function renderCatalog(target?: SdkTarget): string {
  const c = SDK_CATALOG;
  const header = [
    "Arkveil SDK — install & usage",
    "",
    `Language:     ${c.language}`,
    `Registry:     ${c.registry}`,
    `Requirements: Node ${c.requirements.node}, TypeScript ${c.requirements.typescript}`,
    "",
    c.note,
  ].join("\n");

  if (target) {
    return [header, "", renderTarget(target)].join("\n");
  }

  const targets = c.targets.map(renderTarget).join("\n\n");
  return [
    header,
    "",
    "TARGETS",
    "",
    targets,
    "",
    renderTyping(c.typing),
    "",
    "See also: `arkveil sdk install <core|node|nest>`, `arkveil schemas get <user|context>`.",
  ].join("\n");
}

function indent(text: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return text
    .split("\n")
    .map((line) => (line.length > 0 ? pad + line : line))
    .join("\n");
}
