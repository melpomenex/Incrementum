export type PluginPermission =
  | "cards:read"
  | "cards:write"
  | "reviews:read"
  | "reviews:write"
  | "documents:read"
  | "documents:write"
  | "network:outbound";

export type PluginLifecycleHook = "onLoad" | "onUnload" | "onReviewSubmitted" | "onCardCreated";

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  permissions: PluginPermission[];
}

export interface InstalledPlugin {
  manifest: PluginManifest;
  active: boolean;
  grantedPermissions: PluginPermission[];
  installedAt: string;
}

const STORAGE_KEY = "incrementum.plugins.v1";

type PluginStore = Record<string, InstalledPlugin>;

function readStore(): PluginStore {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeStore(store: PluginStore): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function listInstalledPlugins(): InstalledPlugin[] {
  return Object.values(readStore()).sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
}

export function installPlugin(manifest: PluginManifest): InstalledPlugin {
  if (!manifest.id.trim() || !manifest.name.trim() || !manifest.version.trim()) {
    throw new Error("Plugin manifest requires id, name, and version");
  }

  const store = readStore();
  const existing = store[manifest.id];
  const installed: InstalledPlugin = {
    manifest,
    active: existing?.active ?? false,
    grantedPermissions: existing?.grantedPermissions ?? [],
    installedAt: existing?.installedAt ?? new Date().toISOString(),
  };
  store[manifest.id] = installed;
  writeStore(store);
  return installed;
}

export function uninstallPlugin(pluginId: string): void {
  const store = readStore();
  delete store[pluginId];
  writeStore(store);
}

export function grantPluginPermission(pluginId: string, permission: PluginPermission): InstalledPlugin {
  const store = readStore();
  const plugin = store[pluginId];
  if (!plugin) {
    throw new Error(`Plugin ${pluginId} not installed`);
  }
  if (!plugin.manifest.permissions.includes(permission)) {
    throw new Error(`Plugin ${pluginId} did not request permission ${permission}`);
  }
  if (!plugin.grantedPermissions.includes(permission)) {
    plugin.grantedPermissions.push(permission);
  }
  store[pluginId] = plugin;
  writeStore(store);
  return plugin;
}

export function activatePlugin(pluginId: string): InstalledPlugin {
  const store = readStore();
  const plugin = store[pluginId];
  if (!plugin) {
    throw new Error(`Plugin ${pluginId} not installed`);
  }

  const missingPermission = plugin.manifest.permissions.find(
    (permission) => !plugin.grantedPermissions.includes(permission)
  );
  if (missingPermission) {
    throw new Error(`Missing required permission: ${missingPermission}`);
  }

  plugin.active = true;
  store[pluginId] = plugin;
  writeStore(store);
  dispatchPluginEvent(pluginId, "onLoad");
  return plugin;
}

export function deactivatePlugin(pluginId: string): InstalledPlugin {
  const store = readStore();
  const plugin = store[pluginId];
  if (!plugin) {
    throw new Error(`Plugin ${pluginId} not installed`);
  }

  plugin.active = false;
  store[pluginId] = plugin;
  writeStore(store);
  dispatchPluginEvent(pluginId, "onUnload");
  return plugin;
}

export function dispatchPluginEvent(pluginId: string, hook: PluginLifecycleHook, payload?: unknown): void {
  const event = new CustomEvent("incrementum:plugin-hook", {
    detail: {
      pluginId,
      hook,
      payload: payload ?? null,
      dispatchedAt: new Date().toISOString(),
    },
  });
  window.dispatchEvent(event);
}
