import { SupabaseRestClient } from "./supabaseRest.ts";
import {
  MCP_PROTOCOL_VERSION,
  HttpError,
  ToolExecutionError,
  errorResult,
  type JsonObject,
  type JsonRpcId,
  type JsonRpcMessage,
  type JsonRpcResponse,
  type JsonValue
} from "./types.ts";
import {
  callTool,
  getPrompt,
  promptDefinitions,
  readResource,
  resourceTemplates,
  toolDefinitions
} from "./worldbuilder.ts";

const SERVER_NAME = "worldbuilder-mcp";
const SERVER_VERSION = "0.1.0";

function allowedOrigins() {
  const configured = Deno.env.get("WB_MCP_ALLOWED_ORIGINS");
  if (configured) {
    return configured
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
  }
  return [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:54321",
    "http://127.0.0.1:54321"
  ];
}

function originAllowed(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const allowed = allowedOrigins();
  return allowed.includes("*") || allowed.includes(origin);
}

function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin");
  const allowed = allowedOrigins();
  const allowOrigin = origin && (allowed.includes("*") || allowed.includes(origin))
    ? origin
    : "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers":
      "authorization, content-type, accept, mcp-protocol-version, mcp-session-id",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Expose-Headers": "mcp-session-id",
    Vary: "Origin"
  };
}

function jsonResponse(request: Request, body: JsonValue, status = 200, extra?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      "Content-Type": "application/json",
      ...extra
    }
  });
}

function emptyResponse(request: Request, status = 202, extra?: HeadersInit) {
  return new Response(null, {
    status,
    headers: {
      ...corsHeaders(request),
      ...extra
    }
  });
}

function rpcResult(id: JsonRpcId, result: JsonValue): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(
  id: JsonRpcId,
  code: number,
  message: string,
  data?: JsonValue
): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id,
    error: { code, message, data }
  };
}

function asObject(value: JsonValue | undefined): JsonObject {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  return {};
}

function authHeader(request: Request) {
  return request.headers.get("authorization") ?? "";
}

async function createContext(request: Request) {
  const db = new SupabaseRestClient(authHeader(request));
  const user = await db.getUser();
  return { db, user };
}

function isMcpEndpoint(request: Request) {
  const { pathname } = new URL(request.url);
  return pathname.endsWith("/mcp") || pathname.endsWith("/worldbuilder-mcp");
}

async function dispatchRequest(
  request: Request,
  message: JsonRpcMessage
): Promise<Response> {
  const id = message.id ?? null;
  const method = message.method;

  if (message.jsonrpc !== "2.0" || !method) {
    return jsonResponse(request, rpcError(id, -32600, "Invalid JSON-RPC request."), 400);
  }

  if (method === "initialize") {
    return jsonResponse(request, rpcResult(id, {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {
        tools: { listChanged: false },
        resources: { listChanged: false },
        prompts: { listChanged: false }
      },
      serverInfo: {
        name: SERVER_NAME,
        version: SERVER_VERSION
      },
      instructions:
        "Worldbuilder Phase 2 MCP server. Provides campaign context plus proposal-workbench tools. Canon remains read-only; proposal saves require Authorization: Bearer <Supabase user JWT>."
    }));
  }

  if (!("id" in message)) {
    return emptyResponse(request, 202);
  }

  if (method === "ping") {
    return jsonResponse(request, rpcResult(id, {}));
  }

  switch (method) {
    case "tools/list":
      return jsonResponse(request, rpcResult(id, { tools: toolDefinitions }));
    case "resources/list":
      return jsonResponse(request, rpcResult(id, {
        resources: [
          {
            uri: "worldbuilder://server",
            name: "Worldbuilder MCP Server",
            description: "Read-only MCP server metadata.",
            mimeType: "application/json"
          }
        ]
      }));
    case "resources/templates/list":
      return jsonResponse(request, rpcResult(id, { resourceTemplates }));
    case "prompts/list":
      return jsonResponse(request, rpcResult(id, { prompts: promptDefinitions }));
    case "prompts/get": {
      const params = asObject(message.params);
      const name = params.name;
      if (typeof name !== "string" || !name) {
        return jsonResponse(request, rpcError(id, -32602, "Missing prompt name."), 400);
      }
      const result = getPrompt(name, asObject(params.arguments));
      return jsonResponse(request, rpcResult(id, result as unknown as JsonValue));
    }
  }

  let ctx: Awaited<ReturnType<typeof createContext>>;
  try {
    ctx = await createContext(request);
  } catch (error) {
    const httpError = normalizeError(error);
    return jsonResponse(
      request,
      rpcError(id, -32001, httpError.message, httpError.data),
      httpError.status === 500 ? 500 : 401
    );
  }

  try {
    switch (method) {
      case "tools/call": {
        const params = asObject(message.params);
        const name = params.name;
        if (typeof name !== "string" || !name) {
          return jsonResponse(request, rpcError(id, -32602, "Missing tool name."), 400);
        }
        const result = await callTool(ctx, name, params.arguments);
        return jsonResponse(request, rpcResult(id, result as unknown as JsonValue));
      }
      case "resources/read": {
        const params = asObject(message.params);
        const uri = params.uri;
        if (typeof uri !== "string" || !uri) {
          return jsonResponse(request, rpcError(id, -32602, "Missing resource URI."), 400);
        }
        const value = uri === "worldbuilder://server"
          ? {
            name: SERVER_NAME,
            version: SERVER_VERSION,
            protocolVersion: MCP_PROTOCOL_VERSION,
            phase: "read-only"
          }
          : await readResource(ctx, uri);
        return jsonResponse(request, rpcResult(id, {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(value, null, 2)
            }
          ]
        }));
      }
      default:
        return jsonResponse(request, rpcError(id, -32601, `Unknown method: ${method}`), 404);
    }
  } catch (error) {
    if (error instanceof ToolExecutionError && method === "tools/call") {
      return jsonResponse(request, rpcResult(id, errorResult(error.message, error.data)));
    }
    const normalized = normalizeError(error);
    return jsonResponse(
      request,
      rpcError(id, normalized.status === 404 ? -32601 : -32000, normalized.message, normalized.data),
      normalized.status
    );
  }
}

function normalizeError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;
  if (error instanceof Error) return new HttpError(500, error.message);
  return new HttpError(500, "Unexpected server error.");
}

Deno.serve(async (request: Request) => {
  if (!originAllowed(request)) {
    return jsonResponse(request, { error: "Origin is not allowed." }, 403);
  }

  if (request.method === "OPTIONS") {
    return emptyResponse(request, 204);
  }

  if (!isMcpEndpoint(request)) {
    return jsonResponse(request, {
      name: SERVER_NAME,
      version: SERVER_VERSION,
      endpoint: "/mcp",
      status: "ok"
    });
  }

  if (request.method === "GET") {
    return emptyResponse(request, 405, { Allow: "POST, OPTIONS" });
  }

  if (request.method !== "POST") {
    return emptyResponse(request, 405, { Allow: "POST, OPTIONS" });
  }

  let message: JsonRpcMessage;
  try {
    const parsed = await request.json();
    if (Array.isArray(parsed)) {
      return jsonResponse(
        request,
        rpcError(null, -32600, "Batch JSON-RPC requests are not supported by this endpoint."),
        400
      );
    }
    message = parsed as JsonRpcMessage;
  } catch {
    return jsonResponse(request, rpcError(null, -32700, "Invalid JSON body."), 400);
  }

  return await dispatchRequest(request, message);
});
