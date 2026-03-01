import { beforeEach, describe, expect, it } from "vitest";
import {
  activatePlugin,
  deactivatePlugin,
  grantPluginPermission,
  installPlugin,
  listInstalledPlugins,
  uninstallPlugin,
} from "../pluginHost";

describe("pluginHost", () => {
  beforeEach(() => {
    const memoryStore = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: (key: string) => memoryStore.get(key) ?? null,
        setItem: (key: string, value: string) => memoryStore.set(key, value),
        removeItem: (key: string) => memoryStore.delete(key),
      },
      configurable: true,
    });
    localStorage.removeItem("incrementum.plugins.v1");
  });

  it("installs and lists plugins", () => {
    installPlugin({
      id: "plugin.demo",
      name: "Demo Plugin",
      version: "1.0.0",
      permissions: ["cards:read"],
    });

    const plugins = listInstalledPlugins();
    expect(plugins).toHaveLength(1);
    expect(plugins[0].manifest.id).toBe("plugin.demo");
  });

  it("requires permission grant before activation", () => {
    installPlugin({
      id: "plugin.secure",
      name: "Secure Plugin",
      version: "1.0.0",
      permissions: ["cards:write"],
    });

    expect(() => activatePlugin("plugin.secure")).toThrow();
    grantPluginPermission("plugin.secure", "cards:write");
    const activated = activatePlugin("plugin.secure");
    expect(activated.active).toBe(true);

    const deactivated = deactivatePlugin("plugin.secure");
    expect(deactivated.active).toBe(false);
  });

  it("uninstalls plugins", () => {
    installPlugin({
      id: "plugin.remove",
      name: "Remove Me",
      version: "0.0.1",
      permissions: [],
    });
    uninstallPlugin("plugin.remove");
    expect(listInstalledPlugins()).toHaveLength(0);
  });
});
