type DebugFetchRecord = {
  method: string;
  url: string;
  status: number;
  requestHeaders?: Record<string, string>;
  responseSnippet?: string;
};

declare global {
  interface Window {
    __incrementumDebug?: {
      network?: {
        enabled: boolean;
        records: DebugFetchRecord[];
      };
    };
  }
}

const MAX_RECORDS = 50;
const SNIPPET_MAX_LEN = 200;

function toHeaderObject(headers?: HeadersInit): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }
  return headers as Record<string, string>;
}

function pushRecord(record: DebugFetchRecord): void {
  const debugRoot = (window.__incrementumDebug ??= {});
  const network = (debugRoot.network ??= { enabled: true, records: [] });
  network.records.push(record);
  if (network.records.length > MAX_RECORDS) {
    network.records.splice(0, network.records.length - MAX_RECORDS);
  }
}

export function isNetworkDebugEnabled(): boolean {
  if (!import.meta.env.DEV) return false;
  if (import.meta.env.VITE_DEBUG_NETWORK === "1") return true;
  return localStorage.getItem("incrementum.debug.network") === "1";
}

export function installNetworkDebugInstrumentation(): void {
  if (!isNetworkDebugEnabled()) return;
  if ((window as any).__incrementumNetworkDebugInstalled) return;
  (window as any).__incrementumNetworkDebugInstalled = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const method = request.method || init?.method || "GET";
    const requestHeaders = toHeaderObject(init?.headers ?? request.headers);
    const response = await originalFetch(input, init);

    if (response.status >= 400) {
      let snippet = "";
      try {
        snippet = (await response.clone().text()).slice(0, SNIPPET_MAX_LEN);
      } catch {
        snippet = "";
      }

      const record: DebugFetchRecord = {
        method,
        url: request.url,
        status: response.status,
        requestHeaders,
        responseSnippet: snippet,
      };
      pushRecord(record);
      console.error("[NetworkDebug][fetch]", record);
    }

    return response;
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null
  ) {
    (this as any).__debugMethod = method;
    (this as any).__debugUrl = String(url);
    (this as any).__debugHeaders = {};
    return originalOpen.call(this, method, url, async ?? true, username, password);
  };

  XMLHttpRequest.prototype.setRequestHeader = function (name: string, value: string) {
    const headers = ((this as any).__debugHeaders ??= {});
    headers[name] = value;
    return originalSetRequestHeader.call(this, name, value);
  };

  XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
    this.addEventListener("loadend", () => {
      if (this.status < 400) return;

      const record: DebugFetchRecord = {
        method: (this as any).__debugMethod ?? "GET",
        url: (this as any).__debugUrl ?? "(unknown)",
        status: this.status,
        requestHeaders: (this as any).__debugHeaders ?? {},
        responseSnippet: typeof this.responseText === "string"
          ? this.responseText.slice(0, SNIPPET_MAX_LEN)
          : "",
      };

      pushRecord(record);
      console.error("[NetworkDebug][xhr]", record);
      console.error("[NetworkDebug][xhr-meta]", {
        userAgent: navigator.userAgent,
        origin: window.location.origin,
        referrer: document.referrer || "(none)",
      });
    });

    return originalSend.call(this, body);
  };

  window.addEventListener("securitypolicyviolation", (event) => {
    console.warn("[NetworkDebug][csp]", {
      blockedURI: event.blockedURI,
      violatedDirective: event.violatedDirective,
      effectiveDirective: event.effectiveDirective,
      originalPolicy: event.originalPolicy,
      sourceFile: event.sourceFile,
      lineNumber: event.lineNumber,
      columnNumber: event.columnNumber,
    });
  });

  window.addEventListener(
    "error",
    (event) => {
      const target = event.target as (HTMLElement & { src?: string; href?: string }) | null;
      const src = target?.src || target?.href;
      if (!src) return;
      console.error("[NetworkDebug][resource-error]", {
        url: src,
        userAgent: navigator.userAgent,
        origin: window.location.origin,
        referrer: document.referrer || "(none)",
      });
    },
    true
  );
}
