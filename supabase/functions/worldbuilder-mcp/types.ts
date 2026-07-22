export const MCP_PROTOCOL_VERSION = "2025-06-18";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export type JsonRpcId = string | number | null;

export type JsonRpcMessage = {
  jsonrpc?: "2.0";
  id?: JsonRpcId;
  method?: string;
  params?: JsonObject;
};

export type JsonRpcError = {
  code: number;
  message: string;
  data?: JsonValue;
};

export type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: JsonValue;
  error?: JsonRpcError;
};

export type TextContent = {
  type: "text";
  text: string;
};

export type ToolResult = {
  content: TextContent[];
  structuredContent?: JsonValue;
  isError?: boolean;
};

export type ToolDefinition = {
  name: string;
  title: string;
  description: string;
  inputSchema: JsonObject;
  outputSchema?: JsonObject;
};

export type ResourceTemplateDefinition = {
  uriTemplate: string;
  name: string;
  description: string;
  mimeType: string;
};

export type PromptArgument = {
  name: string;
  description: string;
  required?: boolean;
};

export type PromptDefinition = {
  name: string;
  title: string;
  description: string;
  arguments?: PromptArgument[];
};

export type PromptMessage = {
  role: "user" | "assistant";
  content: TextContent;
};

export type PromptResult = {
  description: string;
  messages: PromptMessage[];
};

export class HttpError extends Error {
  status: number;
  data?: JsonValue;

  constructor(status: number, message: string, data?: JsonValue) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.data = data;
  }
}

export class ToolExecutionError extends Error {
  data?: JsonValue;

  constructor(message: string, data?: JsonValue) {
    super(message);
    this.name = "ToolExecutionError";
    this.data = data;
  }
}

export function textResult(text: string, structuredContent?: JsonValue): ToolResult {
  return {
    content: [{ type: "text", text }],
    structuredContent
  };
}

export function jsonResult(value: JsonValue): ToolResult {
  return textResult(JSON.stringify(value, null, 2), value);
}

export function errorResult(message: string, data?: JsonValue): ToolResult {
  return {
    content: [{ type: "text", text: message }],
    structuredContent: data,
    isError: true
  };
}
