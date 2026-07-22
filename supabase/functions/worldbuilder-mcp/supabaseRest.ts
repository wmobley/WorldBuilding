import { HttpError, type JsonObject, type JsonValue } from "./types.ts";

type QueryValue = string | number | boolean | null | undefined;
type QueryParams = Record<string, QueryValue>;

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) {
    throw new HttpError(500, `Missing required environment variable: ${name}`);
  }
  return value;
}

function buildUrl(baseUrl: string, path: string, params?: QueryParams) {
  const url = new URL(path, baseUrl.replace(/\/$/, ""));
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function normalizeBearerToken(authorization: string) {
  const trimmed = authorization.trim();
  if (!trimmed) return "";
  return trimmed.toLowerCase().startsWith("bearer ") ? trimmed : `Bearer ${trimmed}`;
}

export type SupabaseUser = {
  id: string;
  email?: string;
};

export class SupabaseRestClient {
  private readonly supabaseUrl: string;
  private readonly anonKey: string;
  private readonly authorization: string;

  constructor(authorization: string) {
    this.supabaseUrl = requireEnv("SUPABASE_URL");
    this.anonKey = requireEnv("SUPABASE_ANON_KEY");
    this.authorization = normalizeBearerToken(authorization);
    if (!this.authorization) {
      throw new HttpError(401, "Missing Authorization bearer token.");
    }
  }

  private headers(extra?: HeadersInit): HeadersInit {
    return {
      apikey: this.anonKey,
      Authorization: this.authorization,
      Accept: "application/json",
      ...extra
    };
  }

  async getUser(): Promise<SupabaseUser> {
    const response = await fetch(buildUrl(this.supabaseUrl, "/auth/v1/user"), {
      method: "GET",
      headers: this.headers()
    });
    return await this.parseResponse<SupabaseUser>(response, "load Supabase user");
  }

  async get<T extends JsonValue>(path: string, params?: QueryParams): Promise<T> {
    const response = await fetch(buildUrl(this.supabaseUrl, path, params), {
      method: "GET",
      headers: this.headers()
    });
    return await this.parseResponse<T>(response, `GET ${path}`);
  }

  async post<T extends JsonValue>(
    path: string,
    body: JsonObject,
    params?: QueryParams,
    extraHeaders?: HeadersInit
  ): Promise<T> {
    const response = await fetch(buildUrl(this.supabaseUrl, path, params), {
      method: "POST",
      headers: this.headers({
        "Content-Type": "application/json",
        ...extraHeaders
      }),
      body: JSON.stringify(body)
    });
    return await this.parseResponse<T>(response, `POST ${path}`);
  }

  private async parseResponse<T extends JsonValue>(
    response: Response,
    operation: string
  ): Promise<T> {
    const contentType = response.headers.get("content-type") ?? "";
    const raw = await response.text();
    const parsed = raw && contentType.includes("application/json")
      ? (JSON.parse(raw) as JsonValue)
      : raw;

    if (!response.ok) {
      const message =
        typeof parsed === "object" && parsed && !Array.isArray(parsed)
          ? String((parsed as JsonObject).message ?? `${operation} failed`)
          : `${operation} failed`;
      throw new HttpError(response.status, message, parsed as JsonValue);
    }

    return parsed as T;
  }
}
