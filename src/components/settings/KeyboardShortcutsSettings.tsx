/**
 * Keyboard Shortcut Settings Component
 */

import { useState } from "react";
import {
  type ShortcutAction,
  ShortcutCategory,
  formatKeyCombo,
  useShortcutStore,
  findConflicts,
} from "../common/KeyboardShortcuts";
import { useVimiumEnabled } from "../common/VimiumNavigation";
import { SettingsSection, SettingsRow } from "./SettingsPage";
import { useI18n } from "../../lib/i18n";

const shortcutCategoryLabels: Record<ShortcutCategory, string> = {
  [ShortcutCategory.Navigation]: "settings.shortcutCategory.navigation",
  [ShortcutCategory.Editing]: "settings.shortcutCategory.editing",
  [ShortcutCategory.View]: "settings.shortcutCategory.view",
  [ShortcutCategory.Review]: "settings.shortcutCategory.review",
  [ShortcutCategory.Documents]: "settings.shortcutCategory.documents",
  [ShortcutCategory.Flashcards]: "settings.shortcutCategory.flashcards",
  [ShortcutCategory.General]: "settings.shortcutCategory.general",
};

const shortcutLabels: Record<string, { name: string; description: string }> = {
  "nav.forward": {
    name: "settings.shortcuts.nav.forward.name",
    description: "settings.shortcuts.nav.forward.description",
  },
  "nav.back": {
    name: "settings.shortcuts.nav.back.name",
    description: "settings.shortcuts.nav.back.description",
  },
  "nav.up": {
    name: "settings.shortcuts.nav.up.name",
    description: "settings.shortcuts.nav.up.description",
  },
  "nav.command-palette": {
    name: "settings.shortcuts.nav.commandPalette.name",
    description: "settings.shortcuts.nav.commandPalette.description",
  },
  "edit.new-document": {
    name: "settings.shortcuts.edit.newDocument.name",
    description: "settings.shortcuts.edit.newDocument.description",
  },
  "edit.new-extract": {
    name: "settings.shortcuts.edit.newExtract.name",
    description: "settings.shortcuts.edit.newExtract.description",
  },
  "edit.new-flashcard": {
    name: "settings.shortcuts.edit.newFlashcard.name",
    description: "settings.shortcuts.edit.newFlashcard.description",
  },
  "edit.save": {
    name: "settings.shortcuts.edit.save.name",
    description: "settings.shortcuts.edit.save.description",
  },
  "edit.undo": {
    name: "settings.shortcuts.edit.undo.name",
    description: "settings.shortcuts.edit.undo.description",
  },
  "edit.redo": {
    name: "settings.shortcuts.edit.redo.name",
    description: "settings.shortcuts.edit.redo.description",
  },
  "view.zoom-in": {
    name: "settings.shortcuts.view.zoomIn.name",
    description: "settings.shortcuts.view.zoomIn.description",
  },
  "view.zoom-out": {
    name: "settings.shortcuts.view.zoomOut.name",
    description: "settings.shortcuts.view.zoomOut.description",
  },
  "view.fullscreen": {
    name: "settings.shortcuts.view.fullscreen.name",
    description: "settings.shortcuts.view.fullscreen.description",
  },
  "view.sidebar": {
    name: "settings.shortcuts.view.sidebar.name",
    description: "settings.shortcuts.view.sidebar.description",
  },
  "review.start": {
    name: "settings.shortcuts.review.start.name",
    description: "settings.shortcuts.review.start.description",
  },
  "review.again": {
    name: "settings.shortcuts.review.again.name",
    description: "settings.shortcuts.review.again.description",
  },
  "review.hard": {
    name: "settings.shortcuts.review.hard.name",
    description: "settings.shortcuts.review.hard.description",
  },
  "review.good": {
    name: "settings.shortcuts.review.good.name",
    description: "settings.shortcuts.review.good.description",
  },
  "review.easy": {
    name: "settings.shortcuts.review.easy.name",
    description: "settings.shortcuts.review.easy.description",
  },
  "review.skip": {
    name: "settings.shortcuts.review.skip.name",
    description: "settings.shortcuts.review.skip.description",
  },
  "doc.import": {
    name: "settings.shortcuts.documents.import.name",
    description: "settings.shortcuts.documents.import.description",
  },
  "doc.search": {
    name: "settings.shortcuts.documents.search.name",
    description: "settings.shortcuts.documents.search.description",
  },
  "doc.next": {
    name: "settings.shortcuts.documents.next.name",
    description: "settings.shortcuts.documents.next.description",
  },
  "doc.prev": {
    name: "settings.shortcuts.documents.previous.name",
    description: "settings.shortcuts.documents.previous.description",
  },
  "gen.screenshot": {
    name: "settings.shortcuts.general.screenshot.name",
    description: "settings.shortcuts.general.screenshot.description",
  },
  "gen.settings": {
    name: "settings.shortcuts.general.settings.name",
    description: "settings.shortcuts.general.settings.description",
  },
  "gen.help": {
    name: "settings.shortcuts.general.help.name",
    description: "settings.shortcuts.general.help.description",
  },
  "gen.quit": {
    name: "settings.shortcuts.general.quit.name",
    description: "settings.shortcuts.general.quit.description",
  },
};

function translateWithFallback(
  t: (key: string) => string,
  key: string | undefined,
  fallback: string
) {
  if (!key) return fallback;
  const translated = t(key);
  return translated === key ? fallback : translated;
}

function getShortcutCopy(shortcut: ShortcutAction, t: (key: string) => string) {
  const translationKeys = shortcutLabels[shortcut.id];

  return {
    name: translateWithFallback(t, translationKeys?.name, shortcut.name),
    description: translateWithFallback(t, translationKeys?.description, shortcut.description),
  };
}

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
  const { t } = useI18n();
  const [isRecording, setIsRecording] = useState(false);

  const handleRecord = () => {
    setIsRecording(true);

    const handler = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.key === "Escape") {
        setIsRecording(false);
        window.removeEventListener("keydown", handler, true);
        return;
      }

      const modifierKeys = ["Control", "Alt", "Shift", "Meta", "OS"];
      if (modifierKeys.includes(event.key)) {
        return;
      }

      onUpdate({
        key: event.key,
        ctrl: event.ctrlKey,
        alt: event.altKey,
        shift: event.shiftKey,
        meta: event.metaKey,
      });
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
  const [conflicts, setConflicts] = useState<Record<string, string>>({});

  const handleUpdateShortcut = (id: string, combo: { key: string; ctrl?: boolean; alt?: boolean; shift?: boolean; meta?: boolean }) => {
    updateShortcut(id, combo);

    const newConflicts = { ...conflicts };
    delete newConflicts[id];
    const conflicting = findConflicts(combo, id, useShortcutStore.getState().shortcuts);
    if (conflicting.length > 0) {
      const names = conflicting.map((s) => s.name).join(", ");
      newConflicts[id] = names;
    }
    setConflicts(newConflicts);

    onChange();
  };

  const handleResetShortcut = (id: string) => {
    resetShortcut(id);
    setConflicts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    onChange();
  };

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

        {Object.entries(grouped).map(([category, shortcutsInCategory]) => (
          <div key={category} className="mb-6">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {translateWithFallback(
                t,
                shortcutCategoryLabels[category as ShortcutCategory],
                category
              )}
            </h3>

            <div className="space-y-1">
              {shortcutsInCategory.map((shortcut) => {
                const combo = shortcut.currentCombo || shortcut.defaultCombo;
                const copy = getShortcutCopy(shortcut, t);

                return (
                  <SettingsRow
                    key={shortcut.id}
                    label={copy.name}
                    description={copy.description}
                  >
                    <div className="flex items-center gap-2">
                      {shortcut.editable !== false && (
                        <ShortcutRecorder
                          combo={combo}
                          onUpdate={(newCombo) => handleUpdateShortcut(shortcut.id, newCombo)}
                        />
                      )}

                      {shortcut.currentCombo && (
                        <button
                          onClick={() => handleResetShortcut(shortcut.id)}
                          className="p-2 hover:bg-destructive/10 hover:text-destructive rounded"
                          title={t("settings.resetToDefault")}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                      )}

                      {conflicts[shortcut.id] && (
                        <span className="text-xs text-destructive ml-2">
                          {t("settings.shortcutConflict")}: {conflicts[shortcut.id]}
                        </span>
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
