/**
 * Keyboard Shortcut Settings Component
 */

import { useState } from "react";
import {
  formatKeyCombo,
  useShortcutStore,
} from "../common/KeyboardShortcuts";
import { useVimiumEnabled } from "../common/VimiumNavigation";
import { SettingsSection, SettingsRow } from "./SettingsPage";
import { useI18n } from "../../lib/i18n";

/**
 * Keyboard shortcut recording button
 */
function ShortcutRecorder({
  combo,
  onUpdate,
}: {
  combo: { key: string; ctrl?: boolean; alt?: boolean; shift?: boolean; meta?: boolean };
  onUpdate: (combo: { key: string; ctrl?: boolean; alt?: boolean; shift?: boolean; meta?: boolean }) => void;
}) {
  const [isRecording, setIsRecording] = useState(false);

  const handleRecord = () => {
    setIsRecording(true);

    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const newCombo = {
        key: e.key,
        ctrl: e.ctrlKey,
        alt: e.altKey,
        shift: e.shiftKey,
        meta: e.metaKey,
      };

      onUpdate(newCombo);
      setIsRecording(false);

      window.removeEventListener("keydown", handler, true);
    };

    window.addEventListener("keydown", handler, true);
  };

  return (
    <button
      onClick={handleRecord}
      className={`px-3 py-2 border border-border rounded-md text-sm min-w-32 transition-colors ${
        isRecording
          ? "bg-primary text-primary-foreground animate-pulse"
          : "bg-background hover:bg-muted"
      }`}
    >
      {isRecording ? t("settings.pressKeys") : formatKeyCombo(combo)}
    </button>
  );
}

/**
 * Keyboard Shortcut Settings
 */
export function KeyboardShortcutSettings({ onChange }: { onChange: () => void }) {
  const { t } = useI18n();
  const { shortcuts, updateShortcut, resetShortcut, resetAll } = useShortcutStore();
  const [vimiumEnabled, setVimiumEnabled] = useVimiumEnabled();

  const grouped = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, typeof shortcuts>);

  return (
    <>
      <SettingsSection
        title={t("settings.keyboardShortcuts")}
        description={t("settings.keyboardShortcutsDesc")}
      >
        <div className="flex justify-end mb-4">
          <button
            onClick={() => {
              resetAll();
              onChange();
            }}
            className="text-sm text-muted-foreground hover:text-destructive transition-colors"
          >
            {t("settings.resetAllDefaults")}
          </button>
        </div>

        {Object.entries(grouped).map(([category, shortcuts]) => (
          <div key={category} className="mb-6">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {category}
            </h3>

            <div className="space-y-1">
              {shortcuts.map((shortcut) => {
                const combo = shortcut.currentCombo || shortcut.defaultCombo;

                return (
                  <SettingsRow
                    key={shortcut.id}
                    label={shortcut.name}
                    description={shortcut.description}
                  >
                    <div className="flex items-center gap-2">
                      {shortcut.editable !== false && (
                        <ShortcutRecorder
                          combo={combo}
                          onUpdate={(newCombo) => {
                            updateShortcut(shortcut.id, newCombo);
                            onChange();
                          }}
                        />
                      )}

                      {shortcut.currentCombo && (
                        <button
                          onClick={() => {
                            resetShortcut(shortcut.id);
                            onChange();
                          }}
                          className="p-2 hover:bg-destructive/10 hover:text-destructive rounded"
                          title={t("settings.resetToDefault")}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </SettingsRow>
                );
              })}
            </div>
          </div>
        ))}
      </SettingsSection>

      <SettingsSection
        title={t("settings.vimiumNavigation")}
        description={t("settings.vimiumNavigationDesc")}
      >
        <div className="space-y-1">
          <SettingsRow
            label={t("settings.enableVimium")}
            description={t("settings.enableVimiumDesc")}
          >
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={vimiumEnabled}
                onChange={(event) => {
                  setVimiumEnabled(event.target.checked);
                  onChange();
                }}
              />
              <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </SettingsRow>

          <SettingsRow
            label={t("settings.linkHintKeys")}
            description={t("settings.linkHintKeysDesc")}
          >
            <input
              type="text"
              defaultValue="asdfghjkl;qwertyuiopzxcvbnm"
              onChange={onChange}
              className="w-64 px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm font-mono"
            />
          </SettingsRow>
        </div>
      </SettingsSection>
    </>
  );
}
