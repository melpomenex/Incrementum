export type ConfiguredLLMProvider = "openai" | "anthropic" | "ollama" | "openrouter";

const LOCAL_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
  "host.docker.internal",
]);

export function isLocalBaseUrl(baseUrl?: string | null): boolean {
  if (!baseUrl) return false;

  try {
    const url = new URL(baseUrl);
    const hostname = url.hostname.trim().toLowerCase();
    return LOCAL_HOSTS.has(hostname) || hostname.endsWith(".local");
  } catch {
    return false;
  }
}

export function providerAllowsKeylessAccess(
  provider: ConfiguredLLMProvider,
  baseUrl?: string | null
): boolean {
  return provider === "ollama" || (provider === "openai" && isLocalBaseUrl(baseUrl));
}

export function providerRequiresApiKey(
  provider: ConfiguredLLMProvider,
  baseUrl?: string | null
): boolean {
  return !providerAllowsKeylessAccess(provider, baseUrl);
}
