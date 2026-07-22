import { SupabaseRestClient, type SupabaseUser } from "./supabaseRest.ts";
import {
  HttpError,
  type JsonObject,
  type JsonValue,
  type PromptDefinition,
  type PromptResult,
  type ResourceTemplateDefinition,
  type ToolDefinition,
  ToolExecutionError,
  jsonResult,
  textResult,
  type ToolResult
} from "./types.ts";

type CampaignRow = {
  id: string;
  name: string;
  synopsis: string;
  owner_id: string;
  updated_at: number;
  archived_at?: number | null;
};

type CampaignMemberRow = {
  campaign_id: string;
  user_id: string;
  role: string;
  email?: string | null;
};

type FolderRow = {
  id: string;
  campaign_id: string;
  name: string;
  parent_folder_id?: string | null;
  shared?: boolean | null;
  deleted_at?: number | null;
};

type DocRow = {
  id: string;
  campaign_id: string;
  folder_id?: string | null;
  title: string;
  body: string;
  updated_at: number;
  shared?: boolean | null;
  sort_index?: number | null;
  deleted_at?: number | null;
};

type EdgeRow = {
  id: number;
  campaign_id: string;
  from_doc_id: string;
  to_doc_id: string;
  link_text: string;
  edge_type?: string | null;
  weight?: number | null;
};

type TagRow = {
  id: number;
  doc_id: string;
  type: string;
  value: string;
};

type TemplateRow = {
  id: string;
  campaign_id: string;
  name: string;
  description: string;
  kind: string;
  body: string;
  updated_at: number;
};

type MapRow = {
  id: string;
  campaign_id: string;
  name: string;
  image_storage_path?: string | null;
  width?: number | null;
  height?: number | null;
  updated_at: number;
};

type MapLocationRow = {
  id: number;
  map_id: string;
  doc_id: string;
  x: number;
  y: number;
};

type ReferenceRow = {
  id: string;
  slug: string;
  name: string;
  source: string;
  content: string;
};

type SessionNotesRow = {
  room_id: string;
  room_name: string;
  campaign_id?: string | null;
  content: string;
  updated_at: number;
};

type GraphHopRow = {
  doc_id: string;
  hop: number;
  path: string[];
};

type ProposalRow = {
  id: string;
  campaign_id: string;
  created_by: string;
  kind: string;
  title: string;
  payload: JsonObject;
  validation?: JsonObject | null;
  source_prompt?: string | null;
  status: string;
  created_at: number;
  updated_at: number;
};

type RequestContext = {
  db: SupabaseRestClient;
  user: SupabaseUser;
};

const DOC_SELECT =
  "id,campaign_id,folder_id,title,body,updated_at,shared,sort_index,deleted_at";
const DOC_SUMMARY_SELECT =
  "id,campaign_id,folder_id,title,updated_at,shared,sort_index,deleted_at";
const CAMPAIGN_SELECT = "id,name,synopsis,owner_id,updated_at,archived_at";
const FOLDER_SELECT = "id,campaign_id,name,parent_folder_id,shared,deleted_at";
const EDGE_SELECT = "id,campaign_id,from_doc_id,to_doc_id,link_text,edge_type,weight";
const TAG_SELECT = "id,doc_id,type,value";
const PROPOSAL_SELECT =
  "id,campaign_id,created_by,kind,title,payload,validation,source_prompt,status,created_at,updated_at";
const MAX_LIST_LIMIT = 500;
const DEFAULT_CONTEXT_LIMIT = 8;

export const toolDefinitions: ToolDefinition[] = [
  {
    name: "worldbuilder.list_campaigns",
    title: "List Campaigns",
    description: "List Worldbuilder campaigns visible to the authenticated user.",
    inputSchema: {
      type: "object",
      properties: {
        includeArchived: { type: "boolean", default: false }
      }
    }
  },
  {
    name: "worldbuilder.search_lore",
    title: "Search Lore",
    description: "Search visible docs and owned references for campaign lore.",
    inputSchema: {
      type: "object",
      properties: {
        campaignId: { type: "string" },
        query: { type: "string" },
        scope: {
          type: "string",
          enum: ["all", "docs", "references"],
          default: "all"
        },
        limit: { type: "number", default: 10 },
        audience: {
          type: "string",
          enum: ["dm", "player", "assistant"],
          default: "dm"
        }
      },
      required: ["campaignId", "query"]
    }
  },
  {
    name: "worldbuilder.get_doc_context",
    title: "Get Doc Context",
    description:
      "Build bounded context for a Worldbuilder doc: tags, links, backlinks, siblings, and recent docs.",
    inputSchema: {
      type: "object",
      properties: {
        docId: { type: "string" },
        maxDocs: { type: "number", default: DEFAULT_CONTEXT_LIMIT },
        audience: {
          type: "string",
          enum: ["dm", "player", "assistant"],
          default: "dm"
        }
      },
      required: ["docId"]
    }
  },
  {
    name: "worldbuilder.build_canon_packet",
    title: "Build Canon Packet",
    description:
      "Build a compact, source-linked canon packet for prompt grounding without dumping the whole vault.",
    inputSchema: {
      type: "object",
      properties: {
        campaignId: { type: "string" },
        focusDocIds: { type: "array", items: { type: "string" } },
        topic: { type: "string" },
        includeExamples: { type: "boolean", default: false },
        limit: { type: "number", default: 8 },
        audience: {
          type: "string",
          enum: ["dm", "player", "assistant"],
          default: "dm"
        }
      },
      required: ["campaignId"]
    }
  },
  {
    name: "worldbuilder.get_graph_neighborhood",
    title: "Get Graph Neighborhood",
    description: "Read k-hop graph context around a doc using Worldbuilder graph edges.",
    inputSchema: {
      type: "object",
      properties: {
        campaignId: { type: "string" },
        docId: { type: "string" },
        hops: { type: "number", default: 1 },
        direction: {
          type: "string",
          enum: ["in", "out", "both"],
          default: "both"
        }
      },
      required: ["campaignId", "docId"]
    }
  },
  {
    name: "worldbuilder.get_vault_diagnostics",
    title: "Get Vault Diagnostics",
    description:
      "Run read-only vault diagnostics for duplicate titles, broken wikilinks, and orphan docs.",
    inputSchema: {
      type: "object",
      properties: {
        campaignId: { type: "string" },
        limit: { type: "number", default: 50 },
        audience: {
          type: "string",
          enum: ["dm", "player", "assistant"],
          default: "dm"
        }
      },
      required: ["campaignId"]
    }
  },
  {
    name: "worldbuilder.build_session_brief",
    title: "Build Session Brief",
    description: "Build a read-only briefing from campaign lore and optional focus docs.",
    inputSchema: {
      type: "object",
      properties: {
        campaignId: { type: "string" },
        focusDocIds: { type: "array", items: { type: "string" } },
        partyLocation: { type: "string" },
        timeBudgetMinutes: { type: "number", default: 15 },
        audience: {
          type: "string",
          enum: ["dm", "player", "assistant"],
          default: "dm"
        }
      },
      required: ["campaignId"]
    }
  },
  {
    name: "worldbuilder.draft_doc",
    title: "Draft Doc Proposal",
    description:
      "Create a structured Markdown doc proposal scaffold using campaign context and templates.",
    inputSchema: {
      type: "object",
      properties: {
        campaignId: { type: "string" },
        templateKind: { type: "string" },
        title: { type: "string" },
        anchorDocIds: { type: "array", items: { type: "string" } },
        tone: { type: "string" },
        constraints: { type: "array", items: { type: "string" } },
        audience: {
          type: "string",
          enum: ["dm", "player", "assistant"],
          default: "dm"
        }
      },
      required: ["campaignId", "templateKind", "title"]
    }
  },
  {
    name: "worldbuilder.draft_doc_patch",
    title: "Draft Doc Patch Proposal",
    description: "Create a reviewable patch proposal scaffold for an existing doc.",
    inputSchema: {
      type: "object",
      properties: {
        docId: { type: "string" },
        instruction: { type: "string" },
        persona: { type: "string" },
        audience: {
          type: "string",
          enum: ["dm", "player", "assistant"],
          default: "dm"
        },
        preserveSections: { type: "array", items: { type: "string" } }
      },
      required: ["docId", "instruction"]
    }
  },
  {
    name: "worldbuilder.draft_scene",
    title: "Draft Scene Proposal",
    description: "Create a table-ready scene proposal scaffold from campaign context.",
    inputSchema: {
      type: "object",
      properties: {
        campaignId: { type: "string" },
        locationDocId: { type: "string" },
        npcDocIds: { type: "array", items: { type: "string" } },
        objective: { type: "string" },
        partyLevel: { type: "number" },
        tone: { type: "string" },
        audience: {
          type: "string",
          enum: ["dm", "player", "assistant"],
          default: "dm"
        }
      },
      required: ["campaignId", "objective"]
    }
  },
  {
    name: "worldbuilder.draft_encounter",
    title: "Draft Encounter Proposal",
    description: "Create a combat, hazard, social, or exploration encounter proposal scaffold.",
    inputSchema: {
      type: "object",
      properties: {
        campaignId: { type: "string" },
        encounterType: { type: "string" },
        partyLevel: { type: "number" },
        partySize: { type: "number" },
        locationDocId: { type: "string" },
        creatureTags: { type: "array", items: { type: "string" } },
        difficulty: { type: "string" },
        audience: {
          type: "string",
          enum: ["dm", "player", "assistant"],
          default: "dm"
        }
      },
      required: ["campaignId", "encounterType"]
    }
  },
  {
    name: "worldbuilder.draft_player_handout",
    title: "Draft Player Handout",
    description: "Shape source docs into a player-safe handout proposal scaffold.",
    inputSchema: {
      type: "object",
      properties: {
        sourceDocIds: { type: "array", items: { type: "string" } },
        spoilerPolicy: { type: "string" },
        format: { type: "string" },
        tone: { type: "string" }
      },
      required: ["sourceDocIds"]
    }
  },
  {
    name: "worldbuilder.generate_variants",
    title: "Generate Variant Scaffolds",
    description:
      "Generate multiple labeled option scaffolds for a bounded campaign task without making them canon.",
    inputSchema: {
      type: "object",
      properties: {
        campaignId: { type: "string" },
        task: { type: "string" },
        canonPacket: { type: "object" },
        count: { type: "number", default: 3 },
        format: { type: "string" },
        selectionCriteria: { type: "array", items: { type: "string" } },
        audience: {
          type: "string",
          enum: ["dm", "player", "assistant"],
          default: "dm"
        }
      },
      required: ["campaignId", "task"]
    }
  },
  {
    name: "worldbuilder.critique_proposal",
    title: "Critique Proposal",
    description:
      "Stress-test a proposal for genericness, continuity risk, player-safety risk, and table utility.",
    inputSchema: {
      type: "object",
      properties: {
        campaignId: { type: "string" },
        proposal: { type: "object" },
        critiqueMode: { type: "string" },
        sourceDocIds: { type: "array", items: { type: "string" } }
      },
      required: ["campaignId", "proposal"]
    }
  },
  {
    name: "worldbuilder.validate_proposal",
    title: "Validate Proposal",
    description: "Validate a proposal for duplicate titles, broken wikilinks, tags, and spoilers.",
    inputSchema: {
      type: "object",
      properties: {
        campaignId: { type: "string" },
        proposal: { type: "object" },
        audience: {
          type: "string",
          enum: ["dm", "player", "assistant"],
          default: "dm"
        }
      },
      required: ["campaignId", "proposal"]
    }
  },
  {
    name: "worldbuilder.save_proposal",
    title: "Save Proposal",
    description: "Persist a reviewable proposal without applying it to campaign canon.",
    inputSchema: {
      type: "object",
      properties: {
        campaignId: { type: "string" },
        proposal: { type: "object" },
        label: { type: "string" },
        sourcePrompt: { type: "string" }
      },
      required: ["campaignId", "proposal"]
    }
  }
];

export const resourceTemplates: ResourceTemplateDefinition[] = [
  {
    uriTemplate: "worldbuilder://campaign/{campaignId}",
    name: "Campaign",
    description: "Campaign metadata visible to the caller.",
    mimeType: "application/json"
  },
  {
    uriTemplate: "worldbuilder://campaign/{campaignId}/docs",
    name: "Campaign Docs",
    description: "Visible docs for a campaign, summarized.",
    mimeType: "application/json"
  },
  {
    uriTemplate: "worldbuilder://campaign/{campaignId}/canon-packet",
    name: "Campaign Canon Packet",
    description: "Bounded canon packet for prompt grounding.",
    mimeType: "application/json"
  },
  {
    uriTemplate: "worldbuilder://campaign/{campaignId}/diagnostics",
    name: "Campaign Diagnostics",
    description: "Read-only vault diagnostics.",
    mimeType: "application/json"
  },
  {
    uriTemplate: "worldbuilder://campaign/{campaignId}/proposals",
    name: "Campaign Proposals",
    description: "Saved MCP proposal workbench items for a campaign.",
    mimeType: "application/json"
  },
  {
    uriTemplate: "worldbuilder://doc/{docId}",
    name: "Document",
    description: "A visible Worldbuilder document.",
    mimeType: "application/json"
  },
  {
    uriTemplate: "worldbuilder://doc/{docId}/context",
    name: "Document Context",
    description: "Bounded graph and tag context for a document.",
    mimeType: "application/json"
  },
  {
    uriTemplate: "worldbuilder://graph/{campaignId}/neighborhood/{docId}",
    name: "Graph Neighborhood",
    description: "One-hop graph neighborhood around a document.",
    mimeType: "application/json"
  },
  {
    uriTemplate: "worldbuilder://proposal/{proposalId}",
    name: "Proposal",
    description: "A saved MCP proposal payload.",
    mimeType: "application/json"
  }
];

export const promptDefinitions: PromptDefinition[] = [
  {
    name: "worldbuilder.campaign_briefing",
    title: "Campaign Briefing",
    description: "Use Lorekeeper plus Archivist personas to brief campaign state.",
    arguments: [
      { name: "campaignId", description: "Campaign id to brief.", required: true },
      { name: "focus", description: "Optional session, topic, or doc focus." },
      { name: "audience", description: "dm, player, or assistant. Defaults to dm." }
    ]
  },
  {
    name: "worldbuilder.lore_continuity_audit",
    title: "Lore Continuity Audit",
    description: "Use the Continuity Editor persona to find contradictions and gaps.",
    arguments: [
      { name: "campaignId", description: "Campaign id to audit.", required: true },
      { name: "scope", description: "Optional doc ids, topic, or folder scope." }
    ]
  },
  {
    name: "worldbuilder.prompt_recipe_builder",
    title: "Prompt Recipe Builder",
    description:
      "Use the Prompt Architect persona to turn a vague DM goal into a bounded prompt recipe.",
    arguments: [
      { name: "goal", description: "The DM's broad goal.", required: true },
      { name: "format", description: "Desired output format, such as table, JSON, or Markdown." }
    ]
  },
  {
    name: "worldbuilder.prep_question_generator",
    title: "Prep Question Generator",
    description: "Use the Dramaturge persona to generate high-leverage prep questions.",
    arguments: [
      { name: "campaignId", description: "Campaign id.", required: true },
      { name: "nextSessionGoal", description: "What the next session should accomplish." }
    ]
  },
  {
    name: "worldbuilder.player_safe_summary",
    title: "Player-Safe Summary",
    description: "Use Player Handout Editor persona to transform canon into shareable text.",
    arguments: [
      { name: "source", description: "Docs, topic, or summary source.", required: true },
      { name: "spoilerPolicy", description: "How strictly to remove spoilers." }
    ]
  },
  {
    name: "worldbuilder.expand_location",
    title: "Expand Location",
    description: "Use Dungeon Architect plus Lorekeeper personas to expand a location proposal.",
    arguments: [
      { name: "locationDocId", description: "Location doc to ground the expansion.", required: true },
      { name: "tone", description: "Desired tone or genre pressure." },
      { name: "detail", description: "Target detail level." }
    ]
  },
  {
    name: "worldbuilder.build_encounter",
    title: "Build Encounter",
    description: "Use Encounter Smith plus Rules Steward personas to draft an encounter.",
    arguments: [
      { name: "campaignId", description: "Campaign id.", required: true },
      { name: "encounterType", description: "Combat, hazard, social, exploration, or puzzle." },
      { name: "party", description: "Party size and level." }
    ]
  },
  {
    name: "worldbuilder.generate_lore_variants",
    title: "Generate Lore Variants",
    description: "Use Lorekeeper plus Continuity Editor personas to generate labeled options.",
    arguments: [
      { name: "campaignId", description: "Campaign id.", required: true },
      { name: "task", description: "Bounded lore task.", required: true },
      { name: "count", description: "Number of variants." }
    ]
  },
  {
    name: "worldbuilder.critique_lore_draft",
    title: "Critique Lore Draft",
    description: "Use Continuity Editor plus Prompt Architect personas to stress-test a draft.",
    arguments: [
      { name: "campaignId", description: "Campaign id.", required: true },
      { name: "proposal", description: "Draft/proposal payload to critique.", required: true }
    ]
  },
  {
    name: "worldbuilder.prepare_session_packet",
    title: "Prepare Session Packet",
    description:
      "Use Session Scribe, Dramaturge, and Encounter Smith personas to create a session packet proposal.",
    arguments: [
      { name: "campaignId", description: "Campaign id.", required: true },
      { name: "focus", description: "Session focus or expected party location." },
      { name: "timeBudgetMinutes", description: "Prep time budget." }
    ]
  }
];

function asObject(value: JsonValue | undefined): JsonObject {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  return {};
}

function objectArg(args: JsonObject, name: string, required = false): JsonObject {
  const value = args[name];
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (required) throw new ToolExecutionError(`Missing required object argument: ${name}`);
  return {};
}

function stringArg(args: JsonObject, name: string, required = false) {
  const value = args[name];
  if (typeof value === "string" && value.trim()) return value.trim();
  if (required) throw new ToolExecutionError(`Missing required string argument: ${name}`);
  return "";
}

function boolArg(args: JsonObject, name: string, defaultValue = false) {
  const value = args[name];
  return typeof value === "boolean" ? value : defaultValue;
}

function numberArg(args: JsonObject, name: string, defaultValue: number, min = 1, max = 100) {
  const value = args[name];
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : defaultValue;
  return Math.min(max, Math.max(min, Math.floor(numeric)));
}

function stringArrayArg(args: JsonObject, name: string) {
  const value = args[name];
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim() !== "");
}

function audienceArg(args: JsonObject) {
  const audience = stringArg(args, "audience");
  return ["dm", "player", "assistant"].includes(audience) ? audience : "dm";
}

function safeIds(ids: string[], label: string) {
  const uniqueIds = Array.from(new Set(ids)).filter(Boolean);
  const invalid = uniqueIds.find((id) => !/^[A-Za-z0-9:_-]+$/.test(id));
  if (invalid) {
    throw new ToolExecutionError(`Invalid ${label} id: ${invalid}`);
  }
  return uniqueIds;
}

function titleKey(title: string) {
  return title.trim().toLowerCase();
}

function excerpt(body: string, limit = 420) {
  const withoutFrontmatter = body.replace(/^---[\s\S]*?---\s*/, "");
  const withoutDm = stripDmOnlyBlocks(withoutFrontmatter);
  const withoutLinks = withoutDm.replace(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g, "$2$1");
  const withoutTags = withoutLinks.replace(/[@#][a-zA-Z_]+:[\w-]+/g, "");
  const normalized = withoutTags.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit).trim()}...`;
}

function stripDmOnlyBlocks(body: string) {
  return body
    .replace(/^:::(?:spoiler|dm-only|private)\b[\s\S]*?^:::\s*$/gim, "")
    .replace(/<!--\s*(?:dm|spoiler|private)[\s\S]*?-->/gim, "");
}

function parseWikiLinks(body: string) {
  const links = new Set<string>();
  const pattern = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body))) {
    const target = match[1]?.trim();
    if (target && !target.startsWith("asset:") && !target.startsWith("doc:")) {
      links.add(target);
    }
  }
  return Array.from(links);
}

function parseInlineTags(body: string) {
  const tags = new Set<string>();
  const pattern = /[@#]([a-zA-Z_]+):([\w-]+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body))) {
    tags.add(`${match[1]}:${match[2]}`);
  }
  return Array.from(tags);
}

function extractProposalBody(proposal: JsonObject) {
  for (const key of ["bodyMarkdown", "patchMarkdown", "playerMarkdown", "markdown", "body"]) {
    const value = proposal[key];
    if (typeof value === "string") return value;
  }
  const draft = proposal.draft;
  if (draft && typeof draft === "object" && !Array.isArray(draft)) {
    return extractProposalBody(draft);
  }
  return "";
}

function extractProposalTitle(proposal: JsonObject, fallback = "Untitled proposal") {
  const title = proposal.title;
  if (typeof title === "string" && title.trim()) return title.trim();
  const draft = proposal.draft;
  if (draft && typeof draft === "object" && !Array.isArray(draft)) {
    return extractProposalTitle(draft, fallback);
  }
  return fallback;
}

function extractProposalKind(proposal: JsonObject) {
  const kind = proposal.kind;
  return typeof kind === "string" && kind.trim() ? kind.trim() : "proposal";
}

function proposalUri(id: string) {
  return `worldbuilder://proposal/${id}`;
}

function fallbackTemplate(kind: string, title: string) {
  const normalizedKind = kind.trim() || "Page";
  return [
    `# ${title}`,
    "",
    `> [NEW OPTION] ${normalizedKind} proposal. Review before making this canon.`,
    "",
    "## Canon Used",
    "- Source docs and facts to preserve.",
    "",
    "## Proposal",
    "- Add structured, table-ready material here.",
    "",
    "## Links",
    "- Existing wiki links this proposal should reference.",
    "",
    "## Tags",
    "- Proposed namespaced tags.",
    "",
    "## DM Decision Needed",
    "- What must be accepted, rejected, or revised?"
  ].join("\n");
}

function headings(body: string) {
  return body
    .split(/\r?\n/)
    .map((line) => /^(#{1,6})\s+(.+)$/.exec(line))
    .filter((match): match is RegExpExecArray => Boolean(match))
    .map((match) => ({
      level: match[1].length,
      text: match[2].trim()
    }));
}

function resourceLink(uri: string, name: string, description?: string): JsonObject {
  return {
    type: "resource_link",
    uri,
    name,
    description: description ?? name,
    mimeType: "application/json"
  };
}

function summarizeDoc(doc: DocRow, includeBody = false): JsonObject {
  const summary: JsonObject = {
    id: doc.id,
    campaignId: doc.campaign_id,
    title: doc.title,
    folderId: doc.folder_id ?? null,
    shared: Boolean(doc.shared),
    updatedAt: doc.updated_at,
    deletedAt: doc.deleted_at ?? null,
    uri: `worldbuilder://doc/${doc.id}`,
    excerpt: excerpt(doc.body ?? "")
  };
  if (includeBody) {
    summary.body = stripDmOnlyBlocks(doc.body ?? "");
  }
  return summary;
}

function isPlayerVisible(doc: DocRow, foldersById: Map<string, FolderRow>) {
  if (doc.shared) return true;
  if (!doc.folder_id) return false;
  return Boolean(foldersById.get(doc.folder_id)?.shared);
}

function filterAudienceDocs(
  docs: DocRow[],
  folders: FolderRow[],
  audience: string
) {
  const foldersById = new Map(folders.map((folder) => [folder.id, folder]));
  return docs
    .filter((doc) => !doc.deleted_at)
    .filter((doc) => audience === "player" ? isPlayerVisible(doc, foldersById) : true);
}

async function listCampaignRows(ctx: RequestContext, includeArchived = false) {
  const params: Record<string, string | number> = {
    select: CAMPAIGN_SELECT,
    order: "updated_at.desc"
  };
  if (!includeArchived) params.archived_at = "is.null";
  return await ctx.db.get<CampaignRow[]>("/rest/v1/campaigns", params);
}

async function listMembershipRows(ctx: RequestContext) {
  return await ctx.db.get<CampaignMemberRow[]>("/rest/v1/campaign_members", {
    select: "campaign_id,user_id,role,email"
  });
}

async function getCampaign(ctx: RequestContext, campaignId: string) {
  const rows = await ctx.db.get<CampaignRow[]>("/rest/v1/campaigns", {
    select: CAMPAIGN_SELECT,
    id: `eq.${campaignId}`,
    limit: 1
  });
  return rows[0] ?? null;
}

async function listDocs(ctx: RequestContext, campaignId: string, includeBody = true) {
  return await ctx.db.get<DocRow[]>("/rest/v1/docs", {
    select: includeBody ? DOC_SELECT : DOC_SUMMARY_SELECT,
    campaign_id: `eq.${campaignId}`,
    order: "updated_at.desc",
    limit: MAX_LIST_LIMIT
  });
}

async function getDoc(ctx: RequestContext, docId: string) {
  const rows = await ctx.db.get<DocRow[]>("/rest/v1/docs", {
    select: DOC_SELECT,
    id: `eq.${docId}`,
    limit: 1
  });
  return rows[0] ?? null;
}

async function getDocsByIds(ctx: RequestContext, ids: string[]) {
  if (ids.length === 0) return [];
  const uniqueIds = safeIds(ids, "doc").slice(0, 100);
  return await ctx.db.get<DocRow[]>("/rest/v1/docs", {
    select: DOC_SELECT,
    id: `in.(${uniqueIds.join(",")})`,
    limit: uniqueIds.length
  });
}

async function listFolders(ctx: RequestContext, campaignId: string) {
  return await ctx.db.get<FolderRow[]>("/rest/v1/folders", {
    select: FOLDER_SELECT,
    campaign_id: `eq.${campaignId}`,
    limit: MAX_LIST_LIMIT
  });
}

async function listEdges(ctx: RequestContext, campaignId: string) {
  return await ctx.db.get<EdgeRow[]>("/rest/v1/edges", {
    select: EDGE_SELECT,
    campaign_id: `eq.${campaignId}`,
    limit: 1000
  });
}

async function listTagsForDocs(ctx: RequestContext, docIds: string[]) {
  if (docIds.length === 0) return [];
  const uniqueIds = safeIds(docIds, "doc").slice(0, 250);
  return await ctx.db.get<TagRow[]>("/rest/v1/tags", {
    select: TAG_SELECT,
    doc_id: `in.(${uniqueIds.join(",")})`,
    limit: 1000
  });
}

async function listTemplates(ctx: RequestContext, campaignId: string) {
  return await ctx.db.get<TemplateRow[]>("/rest/v1/templates", {
    select: "id,campaign_id,name,description,kind,body,updated_at",
    campaign_id: `eq.${campaignId}`,
    order: "updated_at.desc",
    limit: 100
  });
}

async function listMaps(ctx: RequestContext, campaignId: string) {
  return await ctx.db.get<MapRow[]>("/rest/v1/maps", {
    select: "id,campaign_id,name,image_storage_path,width,height,updated_at",
    campaign_id: `eq.${campaignId}`,
    order: "updated_at.desc",
    limit: 100
  });
}

async function listMapLocations(ctx: RequestContext, mapIds: string[]) {
  if (mapIds.length === 0) return [];
  const uniqueMapIds = safeIds(mapIds, "map");
  return await ctx.db.get<MapLocationRow[]>("/rest/v1/map_locations", {
    select: "id,map_id,doc_id,x,y",
    map_id: `in.(${uniqueMapIds.join(",")})`,
    limit: 1000
  });
}

async function listReferences(ctx: RequestContext) {
  return await ctx.db.get<ReferenceRow[]>("/rest/v1/references", {
    select: "id,slug,name,source,content",
    order: "name.asc",
    limit: 250
  });
}

async function listSessionNotes(ctx: RequestContext, campaignId: string) {
  return await ctx.db.get<SessionNotesRow[]>("/rest/v1/session_notes", {
    select: "room_id,room_name,campaign_id,content,updated_at",
    campaign_id: `eq.${campaignId}`,
    order: "updated_at.desc",
    limit: 10
  });
}

async function listProposals(ctx: RequestContext, campaignId: string) {
  return await ctx.db.get<ProposalRow[]>("/rest/v1/mcp_proposals", {
    select: PROPOSAL_SELECT,
    campaign_id: `eq.${campaignId}`,
    order: "updated_at.desc",
    limit: 100
  });
}

async function getProposal(ctx: RequestContext, proposalId: string) {
  const rows = await ctx.db.get<ProposalRow[]>("/rest/v1/mcp_proposals", {
    select: PROPOSAL_SELECT,
    id: `eq.${proposalId}`,
    limit: 1
  });
  return rows[0] ?? null;
}

function summarizeProposal(row: ProposalRow): JsonObject {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    kind: row.kind,
    title: row.title,
    status: row.status,
    validation: row.validation ?? null,
    sourcePrompt: row.source_prompt ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    uri: proposalUri(row.id)
  };
}

async function listCampaigns(ctx: RequestContext, args: JsonObject): Promise<ToolResult> {
  const includeArchived = boolArg(args, "includeArchived", false);
  const [campaigns, memberships] = await Promise.all([
    listCampaignRows(ctx, includeArchived),
    listMembershipRows(ctx).catch(() => [])
  ]);
  const membershipsByCampaign = new Map(memberships.map((row) => [row.campaign_id, row]));
  const result = campaigns.map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    synopsis: campaign.synopsis,
    role: campaign.owner_id === ctx.user.id
      ? "owner"
      : membershipsByCampaign.get(campaign.id)?.role ?? "member",
    updatedAt: campaign.updated_at,
    archivedAt: campaign.archived_at ?? null,
    uri: `worldbuilder://campaign/${campaign.id}`
  }));
  return jsonResult({ campaigns: result as JsonValue });
}

async function searchLore(ctx: RequestContext, args: JsonObject): Promise<ToolResult> {
  const campaignId = stringArg(args, "campaignId", true);
  const query = stringArg(args, "query", true).toLowerCase();
  const limit = numberArg(args, "limit", 10, 1, 50);
  const scope = stringArg(args, "scope") || "all";
  const audience = audienceArg(args);

  const [docs, folders] = await Promise.all([
    scope === "references" ? Promise.resolve([]) : listDocs(ctx, campaignId),
    scope === "references" ? Promise.resolve([]) : listFolders(ctx, campaignId)
  ]);
  const visibleDocs = filterAudienceDocs(docs, folders, audience);

  const docResults = scope === "references"
    ? []
    : visibleDocs
      .map((doc) => {
        const docExcerpt = excerpt(doc.body);
        const haystack = `${doc.title}\n${docExcerpt}\n${doc.body}`.toLowerCase();
        if (!haystack.includes(query)) return null;
        const titleMatch = doc.title.toLowerCase().includes(query);
        return {
          kind: "doc",
          score: titleMatch ? 20 : 8,
          title: doc.title,
          uri: `worldbuilder://doc/${doc.id}`,
          excerpt: docExcerpt,
          updatedAt: doc.updated_at
        };
      })
      .filter((entry): entry is JsonObject & { score: number } => Boolean(entry));

  const referenceResults = scope === "docs"
    ? []
    : (await listReferences(ctx))
      .map((reference) => {
        const refExcerpt = excerpt(reference.content, 300);
        const haystack = `${reference.name}\n${reference.source}\n${refExcerpt}`.toLowerCase();
        if (!haystack.includes(query)) return null;
        const nameMatch = reference.name.toLowerCase().includes(query);
        return {
          kind: "reference",
          score: nameMatch ? 16 : 5,
          title: reference.name,
          source: reference.source,
          uri: `worldbuilder://reference/${reference.slug}`,
          excerpt: refExcerpt
        };
      })
      .filter((entry): entry is JsonObject & { score: number } => Boolean(entry));

  const results = [...docResults, ...referenceResults]
    .sort((a, b) => b.score - a.score || String(a.title).localeCompare(String(b.title)))
    .slice(0, limit)
    .map(({ score: _score, ...entry }) => entry);

  return jsonResult({ query, audience, results: results as JsonValue });
}

async function getDocContext(ctx: RequestContext, args: JsonObject): Promise<ToolResult> {
  const docId = stringArg(args, "docId", true);
  const maxDocs = numberArg(args, "maxDocs", DEFAULT_CONTEXT_LIMIT, 1, 25);
  const audience = audienceArg(args);
  const current = await getDoc(ctx, docId);
  if (!current || current.deleted_at) throw new ToolExecutionError("Document not found.");

  const [folders, edges, campaignDocs] = await Promise.all([
    listFolders(ctx, current.campaign_id),
    listEdges(ctx, current.campaign_id),
    listDocs(ctx, current.campaign_id)
  ]);
  const visibleDocs = filterAudienceDocs(campaignDocs, folders, audience);
  const visibleById = new Map(visibleDocs.map((doc) => [doc.id, doc]));
  if (audience === "player" && !visibleById.has(current.id)) {
    throw new ToolExecutionError("Document is not visible to the requested audience.");
  }

  const outgoing = edges.filter((edge) => edge.from_doc_id === current.id);
  const incoming = edges.filter((edge) => edge.to_doc_id === current.id);
  const linkedDocs = outgoing
    .map((edge) => visibleById.get(edge.to_doc_id))
    .filter((doc): doc is DocRow => Boolean(doc))
    .slice(0, maxDocs);
  const backlinks = incoming
    .map((edge) => visibleById.get(edge.from_doc_id))
    .filter((doc): doc is DocRow => Boolean(doc))
    .slice(0, maxDocs);
  const siblings = visibleDocs
    .filter((doc) => doc.id !== current.id && (doc.folder_id ?? null) === (current.folder_id ?? null))
    .sort((a, b) => (a.sort_index ?? 0) - (b.sort_index ?? 0) || a.title.localeCompare(b.title))
    .slice(0, maxDocs);
  const recent = visibleDocs
    .filter((doc) => doc.id !== current.id)
    .sort((a, b) => b.updated_at - a.updated_at)
    .slice(0, maxDocs);
  const involvedIds = [
    current.id,
    ...linkedDocs.map((doc) => doc.id),
    ...backlinks.map((doc) => doc.id),
    ...siblings.map((doc) => doc.id)
  ];
  const tags = await listTagsForDocs(ctx, involvedIds);
  const tagsByDocId = groupBy(tags, (tag) => tag.doc_id);

  const result = {
    currentDoc: {
      ...summarizeDoc(current),
      headings: headings(current.body),
      tags: tagsByDocId.get(current.id) ?? []
    },
    linkedDocs: linkedDocs.map((doc) => ({
      ...summarizeDoc(doc),
      tags: tagsByDocId.get(doc.id) ?? []
    })),
    backlinks: backlinks.map((doc) => ({
      ...summarizeDoc(doc),
      tags: tagsByDocId.get(doc.id) ?? []
    })),
    siblings: siblings.map((doc) => summarizeDoc(doc)),
    recentlyUpdatedDocs: recent.map((doc) => summarizeDoc(doc)),
    resourceLinks: [
      resourceLink(`worldbuilder://doc/${current.id}`, current.title),
      resourceLink(`worldbuilder://doc/${current.id}/context`, `${current.title} context`)
    ]
  };

  return jsonResult(result as JsonValue);
}

async function buildCanonPacket(ctx: RequestContext, args: JsonObject): Promise<ToolResult> {
  const campaignId = stringArg(args, "campaignId", true);
  const focusDocIds = stringArrayArg(args, "focusDocIds");
  const topic = stringArg(args, "topic");
  const includeExamples = boolArg(args, "includeExamples", false);
  const limit = numberArg(args, "limit", 8, 1, 20);
  const audience = audienceArg(args);
  const [allDocs, folders] = await Promise.all([
    listDocs(ctx, campaignId),
    listFolders(ctx, campaignId)
  ]);
  const visibleDocs = filterAudienceDocs(allDocs, folders, audience);
  const selected = focusDocIds.length > 0
    ? visibleDocs.filter((doc) => focusDocIds.includes(doc.id)).slice(0, limit)
    : topic
      ? visibleDocs
        .filter((doc) => `${doc.title}\n${doc.body}`.toLowerCase().includes(topic.toLowerCase()))
        .slice(0, limit)
      : visibleDocs.slice(0, limit);
  const tags = await listTagsForDocs(ctx, selected.map((doc) => doc.id));
  const tagsByDocId = groupBy(tags, (tag) => tag.doc_id);
  const canonFacts = selected.map((doc) => ({
    docId: doc.id,
    title: doc.title,
    uri: `worldbuilder://doc/${doc.id}`,
    excerpt: excerpt(doc.body, 520),
    tags: tagsByDocId.get(doc.id) ?? []
  }));
  const openQuestions = selected.flatMap((doc) =>
    doc.body
      .split(/\r?\n/)
      .filter((line) => line.includes("?"))
      .slice(0, 3)
      .map((line) => ({ docId: doc.id, title: doc.title, question: line.trim() }))
  );
  const packet = {
    campaignId,
    audience,
    topic: topic || null,
    canonFacts,
    inferences: [],
    openQuestions,
    constraints: [
      "Treat canonFacts as established campaign canon.",
      "Mark any extrapolation as inferred.",
      "Mark new creations as new option and do not present them as canon.",
      "Use resource URIs when referencing source material."
    ],
    styleExamples: includeExamples
      ? selected.slice(0, 3).map((doc) => ({
        title: doc.title,
        uri: `worldbuilder://doc/${doc.id}`,
        excerpt: excerpt(doc.body, 260)
      }))
      : []
  };
  return jsonResult(packet as JsonValue);
}

async function getGraphNeighborhood(ctx: RequestContext, args: JsonObject): Promise<ToolResult> {
  const campaignId = stringArg(args, "campaignId", true);
  const docId = stringArg(args, "docId", true);
  const hops = numberArg(args, "hops", 1, 0, 3);
  const direction = ["in", "out", "both"].includes(stringArg(args, "direction"))
    ? stringArg(args, "direction")
    : "both";
  const hopRows = await ctx.db.post<GraphHopRow[]>("/rest/v1/rpc/graph_k_hop_docs", {
    p_campaign_id: campaignId,
    p_start_doc_id: docId,
    p_max_hops: hops,
    p_direction: direction
  });
  const nodeIds = hopRows.map((row) => row.doc_id);
  const [docs, edges] = await Promise.all([
    getDocsByIds(ctx, nodeIds),
    listEdges(ctx, campaignId)
  ]);
  const nodeSet = new Set(nodeIds);
  const result = {
    campaignId,
    startDocId: docId,
    hops,
    direction,
    nodes: hopRows.map((hop) => {
      const doc = docs.find((entry) => entry.id === hop.doc_id);
      return {
        docId: hop.doc_id,
        hop: hop.hop,
        path: hop.path,
        title: doc?.title ?? hop.doc_id,
        uri: `worldbuilder://doc/${hop.doc_id}`,
        excerpt: doc ? excerpt(doc.body) : ""
      };
    }),
    edges: edges
      .filter((edge) => nodeSet.has(edge.from_doc_id) && nodeSet.has(edge.to_doc_id))
      .map((edge) => ({
        fromDocId: edge.from_doc_id,
        toDocId: edge.to_doc_id,
        linkText: edge.link_text,
        edgeType: edge.edge_type ?? "link",
        weight: edge.weight ?? 1
      }))
  };
  return jsonResult(result as JsonValue);
}

async function getVaultDiagnostics(ctx: RequestContext, args: JsonObject): Promise<ToolResult> {
  const campaignId = stringArg(args, "campaignId", true);
  const limit = numberArg(args, "limit", 50, 1, 200);
  const audience = audienceArg(args);
  const [docs, folders, edges] = await Promise.all([
    listDocs(ctx, campaignId),
    listFolders(ctx, campaignId),
    listEdges(ctx, campaignId)
  ]);
  const visibleDocs = filterAudienceDocs(docs, folders, audience);
  const byTitle = new Map<string, DocRow[]>();
  for (const doc of visibleDocs) {
    const key = titleKey(doc.title);
    byTitle.set(key, [...(byTitle.get(key) ?? []), doc]);
  }
  const duplicateTitles = Array.from(byTitle.entries())
    .filter(([, entries]) => entries.length > 1)
    .flatMap(([, entries]) =>
      entries.map((doc) => ({
        type: "duplicate_title",
        severity: "warning",
        docId: doc.id,
        title: doc.title,
        uri: `worldbuilder://doc/${doc.id}`
      }))
    );
  const titleSet = new Set(Array.from(byTitle.keys()));
  const brokenLinks = visibleDocs.flatMap((doc) =>
    parseWikiLinks(doc.body)
      .filter((target) => !titleSet.has(titleKey(target)))
      .map((target) => ({
        type: "broken_wikilink",
        severity: "warning",
        docId: doc.id,
        title: doc.title,
        target,
        uri: `worldbuilder://doc/${doc.id}`
      }))
  );
  const connectedIds = new Set(edges.flatMap((edge) => [edge.from_doc_id, edge.to_doc_id]));
  const orphanDocs = visibleDocs
    .filter((doc) => !connectedIds.has(doc.id))
    .map((doc) => ({
      type: "orphan_doc",
      severity: "info",
      docId: doc.id,
      title: doc.title,
      uri: `worldbuilder://doc/${doc.id}`
    }));
  const findings = [...duplicateTitles, ...brokenLinks, ...orphanDocs].slice(0, limit);
  return jsonResult({
    campaignId,
    audience,
    findingCount: findings.length,
    findings
  } as JsonValue);
}

async function buildSessionBrief(ctx: RequestContext, args: JsonObject): Promise<ToolResult> {
  const campaignId = stringArg(args, "campaignId", true);
  const focusDocIds = stringArrayArg(args, "focusDocIds");
  const partyLocation = stringArg(args, "partyLocation");
  const timeBudgetMinutes = numberArg(args, "timeBudgetMinutes", 15, 5, 120);
  const audience = audienceArg(args);
  const canonPacket = await buildCanonPacket(ctx, {
    campaignId,
    focusDocIds: focusDocIds as unknown as JsonValue,
    topic: partyLocation,
    limit: 10,
    audience
  });
  const sessions = await listSessionNotes(ctx, campaignId).catch(() => []);
  const structured = canonPacket.structuredContent as JsonObject;
  const brief = {
    campaignId,
    audience,
    timeBudgetMinutes,
    partyLocation: partyLocation || null,
    canonPacket: structured,
    recentSessionNotes: sessions.map((session) => ({
      roomId: session.room_id,
      roomName: session.room_name,
      updatedAt: session.updated_at,
      excerpt: excerpt(session.content, 500)
    })),
    tableUse: [
      "Start with the canon facts; do not treat new ideas as canon.",
      "Use open questions as prep prompts.",
      "Convert any player-facing output through the player-safe summary prompt."
    ]
  };
  return jsonResult(brief as JsonValue);
}

async function validateProposalPayload(
  ctx: RequestContext,
  campaignId: string,
  proposal: JsonObject,
  audience = "dm"
): Promise<JsonObject> {
  const [docs, folders] = await Promise.all([
    listDocs(ctx, campaignId),
    listFolders(ctx, campaignId)
  ]);
  const visibleDocs = filterAudienceDocs(docs, folders, audience);
  const body = extractProposalBody(proposal);
  const title = extractProposalTitle(proposal, "");
  const targetDocId = typeof proposal.targetDocId === "string" ? proposal.targetDocId : "";
  const titleMap = new Map(visibleDocs.map((doc) => [titleKey(doc.title), doc]));
  const findings: JsonObject[] = [];

  if (title) {
    const duplicate = titleMap.get(titleKey(title));
    if (duplicate && duplicate.id !== targetDocId) {
      findings.push({
        type: "duplicate_title",
        severity: "warning",
        message: `A doc named "${title}" already exists.`,
        uri: `worldbuilder://doc/${duplicate.id}`
      });
    }
  }

  const links = parseWikiLinks(body);
  for (const target of links) {
    if (!titleMap.has(titleKey(target))) {
      findings.push({
        type: "broken_wikilink",
        severity: "warning",
        message: `Proposal links to missing doc "${target}".`,
        target
      });
    }
  }

  for (const tag of parseInlineTags(body)) {
    if (!/^[a-zA-Z_]+:[\w-]+$/.test(tag)) {
      findings.push({
        type: "invalid_tag",
        severity: "warning",
        message: `Tag "${tag}" does not match namespace:value format.`,
        tag
      });
    }
  }

  const lowerBody = body.toLowerCase();
  if ((audience === "player" || extractProposalKind(proposal).includes("handout")) &&
    /\b(dm only|dm truth|spoiler|secret|private)\b/i.test(body)) {
    findings.push({
      type: "player_safety",
      severity: "error",
      message: "Player-facing proposal may contain DM-only or spoiler language."
    });
  }

  if (body && !body.includes("worldbuilder://")) {
    findings.push({
      type: "source_grounding",
      severity: "info",
      message: "Proposal does not include Worldbuilder source URIs."
    });
  }

  if (body && !/\b(canon|inferred|new option|contradiction|needs dm decision)\b/i.test(body)) {
    findings.push({
      type: "canon_label",
      severity: "info",
      message: "Proposal does not visibly label canon, inference, new options, or DM decisions."
    });
  }

  return {
    status: findings.some((finding) => finding.severity === "error")
      ? "error"
      : findings.some((finding) => finding.severity === "warning")
        ? "warning"
        : "ok",
    findingCount: findings.length,
    findings: findings as unknown as JsonValue,
    parsed: {
      title,
      kind: extractProposalKind(proposal),
      wikilinks: links,
      tags: parseInlineTags(lowerBody)
    }
  };
}

function critiqueProposalPayload(proposal: JsonObject): JsonObject {
  const body = extractProposalBody(proposal);
  const lowerBody = body.toLowerCase();
  const genericPhrases = [
    "ancient evil",
    "dark secret",
    "shadow cult",
    "lost empire",
    "chosen one",
    "mysterious artifact",
    "forgotten prophecy"
  ];
  const findings: JsonObject[] = [];
  const foundGeneric = genericPhrases.filter((phrase) => lowerBody.includes(phrase));
  if (foundGeneric.length > 0) {
    findings.push({
      type: "genericness",
      severity: "warning",
      message: "Proposal uses familiar fantasy defaults that may need specificity.",
      evidence: foundGeneric
    });
  }
  if (body && !/\b(choice|consequence|cost|risk|clue|hook|pressure)\b/i.test(body)) {
    findings.push({
      type: "table_utility",
      severity: "info",
      message: "Proposal may need clearer table use: choices, consequences, clues, hooks, or pressure."
    });
  }
  if (body && !body.includes("worldbuilder://")) {
    findings.push({
      type: "source_grounding",
      severity: "info",
      message: "Proposal should cite source resource URIs before being treated as grounded."
    });
  }
  if (/\b(secret|spoiler|dm truth|private)\b/i.test(body)) {
    findings.push({
      type: "player_safety",
      severity: "warning",
      message: "Proposal contains language that should be reviewed before player-facing use."
    });
  }
  if (!/\b(canon|inferred|new option|needs dm decision)\b/i.test(body)) {
    findings.push({
      type: "canon_control",
      severity: "info",
      message: "Proposal should label canon facts, inferred claims, new options, and DM decisions."
    });
  }
  return {
    status: findings.some((finding) => finding.severity === "warning") ? "review" : "ok",
    findingCount: findings.length,
    findings: findings as unknown as JsonValue
  };
}

async function draftDoc(ctx: RequestContext, args: JsonObject): Promise<ToolResult> {
  const campaignId = stringArg(args, "campaignId", true);
  const templateKind = stringArg(args, "templateKind", true);
  const title = stringArg(args, "title", true);
  const anchorDocIds = stringArrayArg(args, "anchorDocIds");
  const tone = stringArg(args, "tone") || "neutral";
  const constraints = stringArrayArg(args, "constraints");
  const audience = audienceArg(args);
  const [templates, anchorRows, canonPacket] = await Promise.all([
    listTemplates(ctx, campaignId).catch(() => []),
    getDocsByIds(ctx, anchorDocIds),
    buildCanonPacket(ctx, { campaignId, focusDocIds: anchorDocIds as unknown as JsonValue, audience })
  ]);
  const anchors = anchorRows.filter((doc) => doc.campaign_id === campaignId);
  const template = templates.find((entry) =>
    entry.kind.toLowerCase() === templateKind.toLowerCase() ||
    entry.name.toLowerCase().includes(templateKind.toLowerCase())
  );
  const baseBody = template?.body || fallbackTemplate(templateKind, title);
  const bodyMarkdown = baseBody
    .replace(/^# .+$/m, `# ${title}`)
    .replace(/\{\{\s*(?:title|name|.+name)\s*\}\}/gi, title);
  const proposal: JsonObject = {
    kind: "doc_draft",
    campaignId,
    title,
    templateKind,
    tone,
    constraints: constraints as unknown as JsonValue,
    bodyMarkdown,
    anchorDocs: anchors.map((doc) => summarizeDoc(doc)),
    proposedLinks: anchors.map((doc) => doc.title),
    proposedTags: parseInlineTags(bodyMarkdown),
    canonPacket: canonPacket.structuredContent ?? {}
  };
  const validation = await validateProposalPayload(ctx, campaignId, proposal, audience);
  return jsonResult({ proposal, validation } as JsonValue);
}

async function draftDocPatch(ctx: RequestContext, args: JsonObject): Promise<ToolResult> {
  const docId = stringArg(args, "docId", true);
  const instruction = stringArg(args, "instruction", true);
  const persona = stringArg(args, "persona") || "Continuity Editor";
  const preserveSections = stringArrayArg(args, "preserveSections");
  const audience = audienceArg(args);
  const doc = await getDoc(ctx, docId);
  if (!doc || doc.deleted_at) throw new ToolExecutionError("Document not found.");
  const patchMarkdown = [
    `# Patch Proposal: ${doc.title}`,
    "",
    `Target: worldbuilder://doc/${doc.id}`,
    `Persona: ${persona}`,
    `Audience: ${audience}`,
    "",
    "## Instruction",
    instruction,
    "",
    "## Preserve",
    ...(preserveSections.length ? preserveSections.map((section) => `- ${section}`) : ["- Existing canon unless explicitly changed."]),
    "",
    "## Current Excerpt",
    excerpt(doc.body, 700),
    "",
    "## Proposed Replacement Blocks",
    "- [NEW OPTION] Add revised Markdown blocks here.",
    "",
    "## Needs DM Decision",
    "- Approve, revise, or reject before applying to canon."
  ].join("\n");
  const proposal: JsonObject = {
    kind: "doc_patch",
    campaignId: doc.campaign_id,
    title: `Patch: ${doc.title}`,
    targetDocId: doc.id,
    instruction,
    persona,
    preserveSections: preserveSections as unknown as JsonValue,
    patchMarkdown
  };
  const validation = await validateProposalPayload(ctx, doc.campaign_id, proposal, audience);
  return jsonResult({ proposal, validation } as JsonValue);
}

async function draftScene(ctx: RequestContext, args: JsonObject): Promise<ToolResult> {
  const campaignId = stringArg(args, "campaignId", true);
  const objective = stringArg(args, "objective", true);
  const locationDocId = stringArg(args, "locationDocId");
  const npcDocIds = stringArrayArg(args, "npcDocIds");
  const partyLevel = numberArg(args, "partyLevel", 1, 1, 30);
  const tone = stringArg(args, "tone") || "adventurous";
  const focusDocs = (await getDocsByIds(ctx, [locationDocId, ...npcDocIds].filter(Boolean)))
    .filter((doc) => doc.campaign_id === campaignId);
  const proposal: JsonObject = {
    kind: "scene_draft",
    campaignId,
    title: `Scene: ${objective}`,
    objective,
    partyLevel,
    tone,
    sourceDocs: focusDocs.map((doc) => summarizeDoc(doc)),
    scene: {
      openingSituation: "[NEW OPTION] What is happening when the players arrive?",
      playerChoices: ["Choice with consequence", "Alternate approach", "Costly shortcut"],
      clues: ["Player-facing clue tied to canon"],
      complications: ["Pressure that changes the scene"],
      exits: ["Where the scene can go next"]
    }
  };
  return jsonResult({ proposal, critique: critiqueProposalPayload(proposal) } as JsonValue);
}

async function draftEncounter(ctx: RequestContext, args: JsonObject): Promise<ToolResult> {
  const campaignId = stringArg(args, "campaignId", true);
  const encounterType = stringArg(args, "encounterType", true);
  const partyLevel = numberArg(args, "partyLevel", 1, 1, 30);
  const partySize = numberArg(args, "partySize", 4, 1, 12);
  const locationDocId = stringArg(args, "locationDocId");
  const difficulty = stringArg(args, "difficulty") || "medium";
  const creatureTags = stringArrayArg(args, "creatureTags");
  const locationRow = locationDocId ? await getDoc(ctx, locationDocId) : null;
  const location = locationRow?.campaign_id === campaignId ? locationRow : null;
  const proposal: JsonObject = {
    kind: "encounter_draft",
    campaignId,
    title: `${difficulty} ${encounterType} encounter`,
    encounterType,
    partyLevel,
    partySize,
    difficulty,
    creatureTags: creatureTags as unknown as JsonValue,
    location: location ? summarizeDoc(location) : null,
    encounter: {
      objective: "[NEW OPTION] What both sides want.",
      roster: ["Creature/NPC/hazard slot"],
      terrain: ["Feature that changes tactics"],
      tactics: ["How the opposition reacts"],
      scaling: ["Add/remove pressure by party performance"],
      rewardOrClue: "[NEW OPTION] What this reveals or grants."
    }
  };
  return jsonResult({ proposal, critique: critiqueProposalPayload(proposal) } as JsonValue);
}

async function draftPlayerHandout(ctx: RequestContext, args: JsonObject): Promise<ToolResult> {
  const sourceDocIds = stringArrayArg(args, "sourceDocIds");
  if (sourceDocIds.length === 0) throw new ToolExecutionError("At least one sourceDocId is required.");
  const spoilerPolicy = stringArg(args, "spoilerPolicy") || "remove DM-only information";
  const format = stringArg(args, "format") || "markdown";
  const tone = stringArg(args, "tone") || "clear";
  const docs = await getDocsByIds(ctx, sourceDocIds);
  if (docs.length === 0) throw new ToolExecutionError("No visible source docs found.");
  const campaignId = docs[0].campaign_id;
  if (docs.some((doc) => doc.campaign_id !== campaignId)) {
    throw new ToolExecutionError("Player handout source docs must belong to one campaign.");
  }
  const playerMarkdown = [
    "# Player Handout Draft",
    "",
    `Tone: ${tone}`,
    `Format: ${format}`,
    `Spoiler policy: ${spoilerPolicy}`,
    "",
    ...docs.map((doc) => [
      `## ${doc.title}`,
      "",
      excerpt(stripDmOnlyBlocks(doc.body), 900),
      "",
      `Source: worldbuilder://doc/${doc.id}`
    ].join("\n"))
  ].join("\n\n");
  const proposal: JsonObject = {
    kind: "player_handout",
    campaignId,
    title: "Player Handout Draft",
    sourceDocIds: sourceDocIds as unknown as JsonValue,
    spoilerPolicy,
    format,
    tone,
    playerMarkdown
  };
  const validation = await validateProposalPayload(ctx, campaignId, proposal, "player");
  return jsonResult({ proposal, validation } as JsonValue);
}

async function generateVariants(ctx: RequestContext, args: JsonObject): Promise<ToolResult> {
  const campaignId = stringArg(args, "campaignId", true);
  const task = stringArg(args, "task", true);
  const count = numberArg(args, "count", 3, 2, 8);
  const format = stringArg(args, "format") || "table";
  const selectionCriteria = stringArrayArg(args, "selectionCriteria");
  const audience = audienceArg(args);
  const canonPacket = objectArg(args, "canonPacket");
  const angles = ["conservative fit", "dramatic complication", "moral cost", "faction pressure", "mystery clue", "player choice", "regional consequence", "rules-light twist"];
  const variants = Array.from({ length: count }, (_, index) => ({
    label: `Option ${index + 1}`,
    status: "new option",
    angle: angles[index % angles.length],
    task,
    format,
    canonFit: "Tie this option to canon facts before use.",
    contradictionRisk: "Check against source docs and diagnostics.",
    dmDecision: "Accept, merge, revise, or reject."
  }));
  const proposal: JsonObject = {
    kind: "variant_set",
    campaignId,
    title: `Variants: ${task}`,
    audience,
    task,
    selectionCriteria: selectionCriteria as unknown as JsonValue,
    canonPacket,
    variants: variants as unknown as JsonValue
  };
  return jsonResult({ proposal, variants: variants as unknown as JsonValue } as JsonValue);
}

async function critiqueProposal(ctx: RequestContext, args: JsonObject): Promise<ToolResult> {
  const campaignId = stringArg(args, "campaignId", true);
  const proposal = objectArg(args, "proposal", true);
  const critiqueMode = stringArg(args, "critiqueMode") || "general";
  const critique = critiqueProposalPayload(proposal);
  const validation = await validateProposalPayload(ctx, campaignId, proposal, audienceArg(args));
  return jsonResult({ critiqueMode, critique, validation } as JsonValue);
}

async function validateProposal(ctx: RequestContext, args: JsonObject): Promise<ToolResult> {
  const campaignId = stringArg(args, "campaignId", true);
  const proposal = objectArg(args, "proposal", true);
  const validation = await validateProposalPayload(ctx, campaignId, proposal, audienceArg(args));
  return jsonResult({ validation } as JsonValue);
}

async function saveProposal(ctx: RequestContext, args: JsonObject): Promise<ToolResult> {
  const campaignId = stringArg(args, "campaignId", true);
  const proposal = objectArg(args, "proposal", true);
  const label = stringArg(args, "label");
  const sourcePrompt = stringArg(args, "sourcePrompt");
  const validation = await validateProposalPayload(ctx, campaignId, proposal, audienceArg(args));
  const now = Date.now();
  const payload: JsonObject = {
    id: crypto.randomUUID(),
    campaign_id: campaignId,
    created_by: ctx.user.id,
    kind: extractProposalKind(proposal),
    title: label || extractProposalTitle(proposal),
    payload: proposal,
    validation,
    source_prompt: sourcePrompt || null,
    status: "draft",
    created_at: now,
    updated_at: now
  } as unknown as JsonObject;
  const rows = await ctx.db.post<ProposalRow[]>(
    "/rest/v1/mcp_proposals",
    payload,
    { select: PROPOSAL_SELECT },
    { Prefer: "return=representation" }
  );
  const saved = rows[0];
  if (!saved) throw new ToolExecutionError("Proposal insert did not return a row.");
  return jsonResult({
    proposal: summarizeProposal(saved),
    resource: resourceLink(proposalUri(saved.id), saved.title),
    validation
  } as JsonValue);
}

export async function callTool(
  ctx: RequestContext,
  name: string,
  rawArgs: JsonValue | undefined
): Promise<ToolResult> {
  const args = asObject(rawArgs);
  switch (name) {
    case "worldbuilder.list_campaigns":
      return await listCampaigns(ctx, args);
    case "worldbuilder.search_lore":
      return await searchLore(ctx, args);
    case "worldbuilder.get_doc_context":
      return await getDocContext(ctx, args);
    case "worldbuilder.build_canon_packet":
      return await buildCanonPacket(ctx, args);
    case "worldbuilder.get_graph_neighborhood":
      return await getGraphNeighborhood(ctx, args);
    case "worldbuilder.get_vault_diagnostics":
      return await getVaultDiagnostics(ctx, args);
    case "worldbuilder.build_session_brief":
      return await buildSessionBrief(ctx, args);
    case "worldbuilder.draft_doc":
      return await draftDoc(ctx, args);
    case "worldbuilder.draft_doc_patch":
      return await draftDocPatch(ctx, args);
    case "worldbuilder.draft_scene":
      return await draftScene(ctx, args);
    case "worldbuilder.draft_encounter":
      return await draftEncounter(ctx, args);
    case "worldbuilder.draft_player_handout":
      return await draftPlayerHandout(ctx, args);
    case "worldbuilder.generate_variants":
      return await generateVariants(ctx, args);
    case "worldbuilder.critique_proposal":
      return await critiqueProposal(ctx, args);
    case "worldbuilder.validate_proposal":
      return await validateProposal(ctx, args);
    case "worldbuilder.save_proposal":
      return await saveProposal(ctx, args);
    default:
      throw new HttpError(404, `Unknown tool: ${name}`);
  }
}

export async function readResource(
  ctx: RequestContext,
  uri: string
): Promise<JsonValue> {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    throw new HttpError(400, `Invalid resource URI: ${uri}`);
  }
  if (parsed.protocol !== "worldbuilder:") {
    throw new HttpError(400, `Unsupported resource protocol: ${parsed.protocol}`);
  }

  const host = parsed.hostname;
  const parts = parsed.pathname.split("/").filter(Boolean);
  if (host === "campaign") {
    const campaignId = parts[0];
    const section = parts[1] ?? "";
    if (!campaignId) throw new HttpError(400, "Missing campaign id.");
    if (!section) {
      const campaign = await getCampaign(ctx, campaignId);
      if (!campaign) throw new HttpError(404, "Campaign not found.");
      return campaign as unknown as JsonValue;
    }
    if (section === "docs") {
      const docs = await listDocs(ctx, campaignId);
      return docs.filter((doc) => !doc.deleted_at).map((doc) => summarizeDoc(doc)) as JsonValue;
    }
    if (section === "folders") return await listFolders(ctx, campaignId) as unknown as JsonValue;
    if (section === "tags") {
      const docs = await listDocs(ctx, campaignId, false);
      return await listTagsForDocs(ctx, docs.map((doc) => doc.id)) as unknown as JsonValue;
    }
    if (section === "templates") return await listTemplates(ctx, campaignId) as unknown as JsonValue;
    if (section === "maps") {
      const maps = await listMaps(ctx, campaignId);
      const locations = await listMapLocations(ctx, maps.map((map) => map.id));
      return { maps, locations } as unknown as JsonValue;
    }
    if (section === "references") return await listReferences(ctx) as unknown as JsonValue;
    if (section === "canon-packet") {
      const result = await buildCanonPacket(ctx, { campaignId });
      return result.structuredContent ?? {};
    }
    if (section === "diagnostics") {
      const result = await getVaultDiagnostics(ctx, { campaignId });
      return result.structuredContent ?? {};
    }
    if (section === "proposals") {
      const proposals = await listProposals(ctx, campaignId);
      return proposals.map((proposal) => summarizeProposal(proposal)) as JsonValue;
    }
  }

  if (host === "doc") {
    const docId = parts[0];
    const section = parts[1] ?? "";
    if (!docId) throw new HttpError(400, "Missing doc id.");
    if (!section) {
      const doc = await getDoc(ctx, docId);
      if (!doc) throw new HttpError(404, "Document not found.");
      return summarizeDoc(doc, true) as JsonValue;
    }
    if (section === "context") {
      const result = await getDocContext(ctx, { docId });
      return result.structuredContent ?? {};
    }
    if (section === "tags") {
      return await listTagsForDocs(ctx, [docId]) as unknown as JsonValue;
    }
    if (["links", "backlinks", "canon-summary"].includes(section)) {
      const result = await getDocContext(ctx, { docId });
      const context = result.structuredContent as JsonObject;
      if (section === "links") return context.linkedDocs ?? [];
      if (section === "backlinks") return context.backlinks ?? [];
      return context.currentDoc ?? {};
    }
  }

  if (host === "graph") {
    const campaignId = parts[0];
    const section = parts[1];
    const docId = parts[2];
    if (campaignId && section === "neighborhood" && docId) {
      const result = await getGraphNeighborhood(ctx, { campaignId, docId, hops: 1, direction: "both" });
      return result.structuredContent ?? {};
    }
  }

  if (host === "reference") {
    const slug = parts[0];
    const rows = await ctx.db.get<ReferenceRow[]>("/rest/v1/references", {
      select: "id,slug,name,source,content",
      slug: `eq.${slug}`,
      limit: 1
    });
    if (!rows[0]) throw new HttpError(404, "Reference not found.");
    return rows[0] as unknown as JsonValue;
  }

  if (host === "proposal") {
    const proposalId = parts[0];
    if (!proposalId) throw new HttpError(400, "Missing proposal id.");
    const proposal = await getProposal(ctx, proposalId);
    if (!proposal) throw new HttpError(404, "Proposal not found.");
    return {
      ...summarizeProposal(proposal),
      payload: proposal.payload,
      validation: proposal.validation ?? null
    } as JsonValue;
  }

  throw new HttpError(404, `Unknown resource: ${uri}`);
}

export function getPrompt(name: string, rawArgs: JsonObject): PromptResult {
  const args = asObject(rawArgs);
  const prompt = promptDefinitions.find((entry) => entry.name === name);
  if (!prompt) throw new HttpError(404, `Unknown prompt: ${name}`);

  const text = buildPromptText(name, args);
  return {
    description: prompt.description,
    messages: [
      {
        role: "user",
        content: { type: "text", text }
      }
    ]
  };
}

function buildPromptText(name: string, args: JsonObject) {
  const serializedArgs = JSON.stringify(args, null, 2);
  const sharedRules = [
    "Use Worldbuilder MCP resources/tools for canon before inventing.",
    "Label content as canon, inferred, new option, contradiction, or needs DM decision.",
    "Prefer bounded, structured output over broad whole-world generation.",
    "Do not write to campaign canon; Phase 2 may save proposal records only."
  ].join("\n- ");

  switch (name) {
    case "worldbuilder.campaign_briefing":
      return `Act as Lorekeeper plus Archivist. Build a campaign briefing from the provided args and relevant Worldbuilder resources.\n\nArgs:\n${serializedArgs}\n\nRules:\n- ${sharedRules}\n\nOutput sections: canon anchors, active tensions, useful source URIs, open questions, and next prep moves.`;
    case "worldbuilder.lore_continuity_audit":
      return `Act as Continuity Editor. Audit the requested campaign scope for contradictions, duplicate names, dangling mysteries, broken assumptions, and missing source links.\n\nArgs:\n${serializedArgs}\n\nRules:\n- ${sharedRules}\n\nOutput a table with severity, finding, evidence URI, confidence, and suggested fix.`;
    case "worldbuilder.prompt_recipe_builder":
      return `Act as Prompt Architect. Turn the DM goal into a reusable prompt recipe.\n\nArgs:\n${serializedArgs}\n\nRules:\n- ${sharedRules}\n\nOutput: canon packet requirements, narrow task, output schema, critique pass, variant policy, and follow-up iteration step.`;
    case "worldbuilder.prep_question_generator":
      return `Act as Dramaturge. Generate high-leverage prep questions for the next session or campaign focus.\n\nArgs:\n${serializedArgs}\n\nRules:\n- ${sharedRules}\n\nGroup questions by lore, NPCs, locations, encounters, player-facing reveals, and consequences.`;
    case "worldbuilder.player_safe_summary":
      return `Act as Player Handout Editor. Convert the requested source into player-safe prose.\n\nArgs:\n${serializedArgs}\n\nRules:\n- ${sharedRules}\n- Exclude DM-only and unshared information unless explicitly authorized by the DM.\n\nOutput player text first, then a DM-only omitted-spoilers checklist.`;
    case "worldbuilder.expand_location":
      return `Act as Dungeon Architect plus Lorekeeper. Expand the requested location as a proposal, not canon.\n\nArgs:\n${serializedArgs}\n\nRules:\n- ${sharedRules}\n\nOutput proposed sections, playable areas, hooks, clues, tags, links, and a critique checklist.`;
    case "worldbuilder.build_encounter":
      return `Act as Encounter Smith plus Rules Steward. Build an encounter proposal grounded in canon and rules references.\n\nArgs:\n${serializedArgs}\n\nRules:\n- ${sharedRules}\n\nOutput objective, roster, terrain, tactics, scaling, reward/clue, and validation notes.`;
    case "worldbuilder.generate_lore_variants":
      return `Act as Lorekeeper plus Continuity Editor. Generate labeled lore variants for a bounded task.\n\nArgs:\n${serializedArgs}\n\nRules:\n- ${sharedRules}\n\nFor each variant include canon fit, contradiction risk, moral cost or consequence, and a DM decision prompt.`;
    case "worldbuilder.critique_lore_draft":
      return `Act as Continuity Editor plus Prompt Architect. Critique the supplied lore draft before it enters canon.\n\nArgs:\n${serializedArgs}\n\nRules:\n- ${sharedRules}\n\nGroup findings by genericness, contradiction, weak table utility, player-safety risk, and revision instruction.`;
    case "worldbuilder.prepare_session_packet":
      return `Act as Session Scribe plus Dramaturge plus Encounter Smith. Prepare a session packet proposal.\n\nArgs:\n${serializedArgs}\n\nRules:\n- ${sharedRules}\n\nOutput recap context, scenes, NPCs, encounters, clues, unresolved questions, and proposal save guidance.`;
    default:
      return `Use this Worldbuilder prompt with args:\n${serializedArgs}`;
  }
}

function groupBy<T>(values: T[], keyFn: (value: T) => string) {
  const groups = new Map<string, T[]>();
  for (const value of values) {
    const key = keyFn(value);
    groups.set(key, [...(groups.get(key) ?? []), value]);
  }
  return groups;
}
