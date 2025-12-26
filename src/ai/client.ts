export type AiProvider = "none" | "openai" | "anthropic" | "google" | "mistral" | "cohere" | "ollama";

export type AiRequest = {
  provider: AiProvider;
  prompt: string;
  settings: {
    openAiKey?: string | null;
    openAiModel?: string | null;
    openAiBaseUrl?: string | null;
    ollamaModel?: string | null;
    ollamaBaseUrl?: string | null;
  };
};

export type AiResponse = {
  content: string;
  providerLabel: string;
};

const REQUEST_TIMEOUT_MS = 60_000;

async function fetchWithTimeout(input: RequestInfo, init: RequestInit) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("AI request timed out.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function sendPromptToProvider(request: AiRequest): Promise<AiResponse> {
  const { provider, prompt, settings } = request;
  if (!prompt.trim()) {
    throw new Error("Prompt is empty.");
  }
  console.debug("[WB] AI client: dispatch", { provider, promptLength: prompt.length });

  switch (provider) {
    case "ollama": {
      const baseUrl = settings.ollamaBaseUrl || "http://localhost:11434";
      const model = settings.ollamaModel || "";
      console.debug("[WB] AI client: ollama", { baseUrl, model });
      if (!model) {
        throw new Error("Select an Ollama model first.");
      }
      const response = await fetchWithTimeout(`${baseUrl.replace(/\/$/, "")}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt, stream: false })
      });
      console.debug("[WB] AI client: ollama response", { ok: response.ok, status: response.status });
      if (!response.ok) {
        throw new Error(`Ollama error ${response.status}.`);
      }
      const payload = (await response.json()) as { response?: string };
      const content = payload.response?.trim();
      if (!content) {
        throw new Error("Ollama returned no content.");
      }
      console.debug("[WB] AI client: ollama content", { length: content.length });
      return { content, providerLabel: `Ollama · ${model}` };
    }
    case "openai": {
      const baseUrl = settings.openAiBaseUrl || "https://api.openai.com/v1";
      const model = settings.openAiModel || "gpt-4o-mini";
      const apiKey = settings.openAiKey || "";
      console.debug("[WB] AI client: openai", { baseUrl, model, hasKey: Boolean(apiKey) });
      if (!apiKey) {
        throw new Error("OpenAI API key is missing.");
      }
      const response = await fetchWithTimeout(
        `${baseUrl.replace(/\/$/, "")}/chat/completions`,
        {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }]
        })
        }
      );
      console.debug("[WB] AI client: openai response", { ok: response.ok, status: response.status });
      if (!response.ok) {
        throw new Error(`OpenAI error ${response.status}.`);
      }
      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = payload.choices?.[0]?.message?.content?.trim();
      if (!content) {
        throw new Error("OpenAI returned no content.");
      }
      console.debug("[WB] AI client: openai content", { length: content.length });
      return { content, providerLabel: `OpenAI · ${model}` };
    }
    case "none":
      throw new Error("Select an AI provider in Settings.");
    default:
      throw new Error("This provider is not wired yet.");
  }
}
