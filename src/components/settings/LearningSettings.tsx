import { useState } from "react";
import { useI18n } from "../../lib/i18n";
import { useSettingsStore } from "../../stores/settingsStore";
import { useStudyDeckStore } from "../../stores/studyDeckStore";
import { optimizeAlgorithmParams } from "../../api/algorithm";
import { CANONICAL_FSRS_PARAMETER_LENGTH } from "../../utils/fsrsParameters";

export function LearningSettings() {
  const { t } = useI18n();
  const { settings, updateSettings } = useSettingsStore();
  const { decks } = useStudyDeckStore();
  const [newScopeType, setNewScopeType] = useState<"deck" | "tag">("deck");
  const [newScopeId, setNewScopeId] = useState("");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizerMessage, setOptimizerMessage] = useState<string | null>(null);

  const scopedOverrides = settings.learning.scopedFsrsOverrides ?? [];

  return (
    <div className="space-y-6">
      {/* Algorithm Selection */}
      <div>
        <h3 className="text-lg font-semibold mb-3 text-foreground">{t("learningSettings.algorithm")}</h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="algorithm-select" className="block text-sm font-medium text-foreground mb-2">
              Spaced Repetition Algorithm
            </label>
            <select
              id="algorithm-select"
              value={settings.learning.algorithm}
              onChange={(e) =>
                updateSettings({
                  learning: { ...settings.learning, algorithm: e.target.value as any },
                })
              }
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground"
            >
              <option value="fsrs">FSRS-6 (Recommended)</option>
              <option value="sm18">SuperMemo 18</option>
              <option value="sm20">SuperMemo 20</option>
              <option value="sm2">SuperMemo 2</option>
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              {settings.learning.algorithm === "fsrs"
                ? "Free Spaced Repetition Scheduler — optimal retention-based scheduling"
                : settings.learning.algorithm === "sm18"
                ? "SuperMemo 18 — uses stability increase matrix for interval calculation"
                : settings.learning.algorithm === "sm20"
                ? "SuperMemo 20 — Rust and TypeScript DSR scheduler based on the reverse-engineered SM-20 core"
                : `SuperMemo ${settings.learning.algorithm.toUpperCase().replace("SM", "")}`}
            </p>
          </div>

          {(settings.learning.algorithm === "fsrs" || settings.learning.algorithm === "sm18") && (
          <div>
            <label htmlFor="fsrs-retention" className="block text-sm font-medium text-foreground mb-2">
              {settings.learning.algorithm === "sm18" ? "Forgetting Index" : "Desired Retention"}: {Math.round(settings.learning.fsrsParams.desiredRetention * 100)}%
            </label>
            <input
              type="range"
              id="fsrs-retention"
              min="70"
              max="99"
              value={settings.learning.fsrsParams.desiredRetention * 100}
              onChange={(e) =>
                updateSettings({
                  learning: {
                    ...settings.learning,
                    fsrsParams: {
                      ...settings.learning.fsrsParams,
                      desiredRetention: parseInt(e.target.value) / 100,
                    },
                  },
                })
              }
              className="w-full"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {settings.learning.algorithm === "sm18"
                ? "Lower = more frequent reviews (default 90%)"
                : "Higher retention = more frequent reviews"}
            </p>
            {settings.learning.algorithm === "fsrs" && (
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={async () => {
                    try {
                      setIsOptimizing(true);
                      setOptimizerMessage(null);
                      const result = await optimizeAlgorithmParams({
                        min_ease_factor: 1.3,
                        initial_ease_factor: 2.5,
                        desired_retention: settings.learning.fsrsParams.desiredRetention,
                      });
                      updateSettings({
                        learning: {
                          ...settings.learning,
                          fsrsParams: {
                            ...settings.learning.fsrsParams,
                            personalizedWeights: result.fsrs_weights,
                            lastOptimizationAt: new Date().toISOString(),
                            optimizedReviewCount: result.history_count,
                          },
                        },
                      });
                      const quality = result.history_count >= result.minimum_history_required
                        ? "Personalized weights applied."
                        : "Applied provisional weights (limited history).";
                      setOptimizerMessage(
                        `${quality} Reviews used: ${result.history_count}/${result.minimum_history_required}.`
                      );
                    } catch (error) {
                      setOptimizerMessage(error instanceof Error ? error.message : "Failed to run optimizer");
                    } finally {
                      setIsOptimizing(false);
                    }
                  }}
                  disabled={isOptimizing}
                  className="px-3 py-2 rounded-md border border-border text-sm text-foreground disabled:opacity-50"
                >
                  {isOptimizing ? "Optimizing..." : "Run Personal FSRS Optimizer"}
                </button>
                {settings.learning.fsrsParams.personalizedWeights?.length === CANONICAL_FSRS_PARAMETER_LENGTH && (
                  <span className="text-xs text-green-500">FSRS-6 profile active (21 params)</span>
                )}
              </div>
            )}
            {optimizerMessage && (
              <p className="mt-2 text-xs text-muted-foreground">{optimizerMessage}</p>
            )}
          </div>
          )}

          {settings.learning.algorithm === "fsrs" && (
          <div className="border border-border rounded-lg p-4 space-y-3">
            <div>
              <h4 className="font-medium text-foreground">{t("learningSettings.scopedOverrides")}</h4>
              <p className="text-xs text-muted-foreground">
                Precedence is global → deck → tag. Tag overrides win when both match.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <select
                value={newScopeType}
                onChange={(e) => setNewScopeType(e.target.value as "deck" | "tag")}
                className="px-2 py-2 rounded-md border border-border bg-background text-foreground"
              >
                <option value="deck">Deck</option>
                <option value="tag">Tag</option>
              </select>
              {newScopeType === "deck" ? (
                <select
                  value={newScopeId}
                  onChange={(e) => setNewScopeId(e.target.value)}
                  className="px-2 py-2 rounded-md border border-border bg-background text-foreground md:col-span-2"
                >
                  <option value="">Select deck</option>
                  {decks.map((deck) => (
                    <option key={deck.id} value={deck.id}>
                      {deck.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={newScopeId}
                  onChange={(e) => setNewScopeId(e.target.value)}
                  placeholder="tag-name"
                  className="px-2 py-2 rounded-md border border-border bg-background text-foreground md:col-span-2"
                />
              )}
            </div>

            <button
              onClick={() => {
                const trimmed = newScopeId.trim();
                if (!trimmed) return;
                updateSettings({
                  learning: {
                    ...settings.learning,
                    scopedFsrsOverrides: [
                      ...scopedOverrides,
                      {
                        id: `${newScopeType}-${trimmed}-${Date.now()}`,
                        scopeType: newScopeType,
                        scopeId: trimmed,
                        desiredRetention: settings.learning.fsrsParams.desiredRetention,
                        maximumInterval: settings.learning.fsrsParams.maximumInterval,
                        enabled: true,
                      },
                    ],
                  },
                });
                setNewScopeId("");
              }}
              className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm"
            >
              Add override
            </button>

            <div className="space-y-2">
              {scopedOverrides.length === 0 && (
                <p className="text-xs text-muted-foreground">{t("learningSettings.noScopedOverrides")}</p>
              )}
              {scopedOverrides.map((override) => (
                <div key={override.id} className="border border-border rounded-md p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-foreground">
                      {override.scopeType === "deck" ? "Deck" : "Tag"}:{" "}
                      <span className="font-medium">{override.scopeId}</span>
                    </div>
                    <button
                      onClick={() =>
                        updateSettings({
                          learning: {
                            ...settings.learning,
                            scopedFsrsOverrides: scopedOverrides.filter((entry) => entry.id !== override.id),
                          },
                        })
                      }
                      className="text-xs text-destructive"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs text-muted-foreground">
                      Retention
                      <input
                        type="number"
                        min="0.7"
                        max="0.99"
                        step="0.01"
                        value={override.desiredRetention ?? settings.learning.fsrsParams.desiredRetention}
                        onChange={(e) =>
                          updateSettings({
                            learning: {
                              ...settings.learning,
                              scopedFsrsOverrides: scopedOverrides.map((entry) =>
                                entry.id === override.id
                                  ? { ...entry, desiredRetention: Number(e.target.value) }
                                  : entry
                              ),
                            },
                          })
                        }
                        className="mt-1 w-full px-2 py-1 rounded border border-border bg-background text-foreground"
                      />
                    </label>
                    <label className="text-xs text-muted-foreground">
                      Max interval
                      <input
                        type="number"
                        min="1"
                        max="36500"
                        value={override.maximumInterval ?? settings.learning.fsrsParams.maximumInterval}
                        onChange={(e) =>
                          updateSettings({
                            learning: {
                              ...settings.learning,
                              scopedFsrsOverrides: scopedOverrides.map((entry) =>
                                entry.id === override.id
                                  ? { ...entry, maximumInterval: Number(e.target.value) }
                                  : entry
                              ),
                            },
                          })
                        }
                        className="mt-1 w-full px-2 py-1 rounded border border-border bg-background text-foreground"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}
        </div>
      </div>

      {/* New Cards */}
      <div>
        <h3 className="text-lg font-semibold mb-3 text-foreground">{t("learningSettings.newCards")}</h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="newCardsPerDay" className="block text-sm font-medium text-foreground mb-2">
              New Cards per Day
            </label>
            <input
              type="number"
              id="newCardsPerDay"
              min="0"
              max="100"
              value={settings.learning.newCardsPerDay}
              onChange={(e) =>
                updateSettings({
                  learning: { ...settings.learning, newCardsPerDay: parseInt(e.target.value) || 0 },
                })
              }
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground"
            />
          </div>

          <div>
            <label htmlFor="initialInterval" className="block text-sm font-medium text-foreground mb-2">
              Initial Interval (days)
            </label>
            <input
              type="number"
              id="initialInterval"
              min="0"
              max="30"
              value={settings.learning.initialInterval}
              onChange={(e) =>
                updateSettings({
                  learning: { ...settings.learning, initialInterval: parseInt(e.target.value) || 0 },
                })
              }
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground"
            />
          </div>
        </div>
      </div>

      {/* Reviews */}
      <div>
        <h3 className="text-lg font-semibold mb-3 text-foreground">{t("learningSettings.reviews")}</h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="reviewsPerDay" className="block text-sm font-medium text-foreground mb-2">
              Reviews per Day Limit
            </label>
            <input
              type="number"
              id="reviewsPerDay"
              min="0"
              max="1000"
              value={settings.learning.reviewsPerDay}
              onChange={(e) =>
                updateSettings({
                  learning: { ...settings.learning, reviewsPerDay: parseInt(e.target.value) || 0 },
                })
              }
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Set to 0 for unlimited reviews
            </p>
          </div>

          <div>
            <label htmlFor="maxReviewTime" className="block text-sm font-medium text-foreground mb-2">
              Max Review Time per Card (seconds)
            </label>
            <input
              type="number"
              id="maxReviewTime"
              min="5"
              max="300"
              value={settings.learning.maxReviewTime}
              onChange={(e) =>
                updateSettings({
                  learning: { ...settings.learning, maxReviewTime: parseInt(e.target.value) || 60 },
                })
              }
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground"
            />
          </div>
        </div>
      </div>

      {/* Lapses */}
      <div>
        <h3 className="text-lg font-semibold mb-3 text-foreground">{t("learningSettings.lapses")}</h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="lapseSteps" className="block text-sm font-medium text-foreground mb-2">
              Lapse Steps (minutes)
            </label>
            <input
              type="text"
              id="lapseSteps"
              value={settings.learning.lapseSteps.join(", ")}
              onChange={(e) =>
                updateSettings({
                  learning: {
                    ...settings.learning,
                    lapseSteps: e.target.value.split(",").map((s) => parseInt(s.trim()) || 10),
                  },
                })
              }
              placeholder="10, 20, 30"
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Comma-separated values in minutes (e.g., "10, 20, 30")
            </p>
          </div>

          <div>
            <label htmlFor="lapseInterval" className="block text-sm font-medium text-foreground mb-2">
              Relearning Interval (days)
            </label>
            <input
              type="number"
              id="lapseInterval"
              min="1"
              max="30"
              value={settings.learning.lapseInterval}
              onChange={(e) =>
                updateSettings({
                  learning: { ...settings.learning, lapseInterval: parseInt(e.target.value) || 1 },
                })
              }
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground"
            />
          </div>
        </div>
      </div>

      {/* Graduated Interval */}
      <div>
        <h3 className="text-lg font-semibold mb-3 text-foreground">{t("learningSettings.graduatedInterval")}</h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="graduatingInterval" className="block text-sm font-medium text-foreground mb-2">
              Graduating Interval (days)
            </label>
            <input
              type="number"
              id="graduatingInterval"
              min="1"
              max="30"
              value={settings.learning.graduatingInterval}
              onChange={(e) =>
                updateSettings({
                  learning: { ...settings.learning, graduatingInterval: parseInt(e.target.value) || 1 },
                })
              }
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Interval at which a card graduates from learning to review
            </p>
          </div>

          <div>
            <label htmlFor="easyInterval" className="block text-sm font-medium text-foreground mb-2">
              Easy Interval (days)
            </label>
            <input
              type="number"
              id="easyInterval"
              min="1"
              max="60"
              value={settings.learning.easyInterval}
              onChange={(e) =>
                updateSettings({
                  learning: { ...settings.learning, easyInterval: parseInt(e.target.value) || 4 },
                })
              }
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Interval when "Easy" is pressed on new card
            </p>
          </div>
        </div>
      </div>

      {/* Leech Threshold */}
      <div>
        <h3 className="text-lg font-semibold mb-3 text-foreground">{t("learningSettings.leechCards")}</h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="leechThreshold" className="block text-sm font-medium text-foreground mb-2">
              Leech Threshold (lapses)
            </label>
            <input
              type="number"
              id="leechThreshold"
              min="3"
              max="20"
              value={settings.learning.leechThreshold}
              onChange={(e) =>
                updateSettings({
                  learning: { ...settings.learning, leechThreshold: parseInt(e.target.value) || 8 },
                })
              }
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Cards with more lapses will be tagged as leeches and suspended
            </p>
          </div>
        </div>
      </div>

      {/* Timezone */}
      <div>
        <h3 className="text-lg font-semibold mb-3 text-foreground">{t("learningSettings.timezone")}</h3>
        <div>
          <label htmlFor="timezone" className="block text-sm font-medium text-foreground mb-2">
            Your Timezone
          </label>
          <select
            id="timezone"
            value={settings.learning.timezone}
            onChange={(e) =>
              updateSettings({
                learning: { ...settings.learning, timezone: e.target.value },
              })
            }
            className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground"
          >
            <option value="auto">Auto-detect</option>
            <option value="America/New_York">Eastern Time</option>
            <option value="America/Chicago">Central Time</option>
            <option value="America/Denver">Mountain Time</option>
            <option value="America/Los_Angeles">Pacific Time</option>
            <option value="Europe/London">GMT (London)</option>
            <option value="Europe/Paris">Central European (Paris)</option>
            <option value="Asia/Tokyo">Japan Time</option>
            <option value="Asia/Shanghai">China Time</option>
            <option value="Australia/Sydney">Australia Eastern Time</option>
          </select>
          <p className="text-xs text-muted-foreground mt-1">
            Determines when a new day starts for reviews
          </p>
        </div>
      </div>

      {/* Postpone Settings */}
      <div>
        <h3 className="text-lg font-semibold mb-3 text-foreground">{t("postpone.settingsTitle")}</h3>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("postpone.settingsDescription")}
          </p>

          {/* Toggle: Auto-Postpone */}
          <SettingToggle
            label={t("postpone.autoPostponeEnabled")}
            description={t("postpone.autoPostponeEnabledDescription")}
            checked={settings.learning.postpone.autoPostponeEnabled}
            onChange={(checked) =>
              updateSettings({
                learning: { ...settings.learning, postpone: { ...settings.learning.postpone, autoPostponeEnabled: checked } },
              })
            }
          />

          {/* Toggle: Simple Mode */}
          <SettingToggle
            label={t("postpone.simpleMode")}
            description={t("postpone.simpleModeDescription")}
            checked={settings.learning.postpone.simpleMode}
            onChange={(checked) =>
              updateSettings({
                learning: { ...settings.learning, postpone: { ...settings.learning.postpone, simpleMode: checked } },
              })
            }
          />

          {/* Toggle: Randomization */}
          <SettingToggle
            label={t("postpone.randomize")}
            description={t("postpone.randomizeDescription")}
            checked={settings.learning.postpone.randomize}
            onChange={(checked) =>
              updateSettings({
                learning: { ...settings.learning, postpone: { ...settings.learning.postpone, randomize: checked } },
              })
            }
          />

          {/* Item parameters */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2">{t("postpone.itemParams")}</h4>
            <div className="grid grid-cols-2 gap-3">
              <NumberSetting
                label={t("postpone.itemIncrease")}
                value={settings.learning.postpone.itemIncrease}
                min={0} max={200}
                onChange={(v) =>
                  updateSettings({
                    learning: { ...settings.learning, postpone: { ...settings.learning.postpone, itemIncrease: v } },
                  })
                }
              />
              <NumberSetting
                label={t("postpone.itemMinIncrease")}
                value={settings.learning.postpone.itemMinIncrease}
                min={0} max={365}
                onChange={(v) =>
                  updateSettings({
                    learning: { ...settings.learning, postpone: { ...settings.learning.postpone, itemMinIncrease: v } },
                  })
                }
              />
              <NumberSetting
                label={t("postpone.itemMaxIncrease")}
                value={settings.learning.postpone.itemMaxIncrease}
                min={0} max={365}
                onChange={(v) =>
                  updateSettings({
                    learning: { ...settings.learning, postpone: { ...settings.learning.postpone, itemMaxIncrease: v } },
                  })
                }
              />
              <NumberSetting
                label={t("postpone.itemCap")}
                value={settings.learning.postpone.itemCap}
                min={1} max={36500}
                onChange={(v) =>
                  updateSettings({
                    learning: { ...settings.learning, postpone: { ...settings.learning.postpone, itemCap: v } },
                  })
                }
              />
              <NumberSetting
                label={t("postpone.itemFloor")}
                value={settings.learning.postpone.itemFloor}
                min={0} max={365}
                onChange={(v) =>
                  updateSettings({
                    learning: { ...settings.learning, postpone: { ...settings.learning.postpone, itemFloor: v } },
                  })
                }
              />
            </div>
          </div>

          {/* Topic (document) parameters */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2">{t("postpone.topicParams")}</h4>
            <div className="grid grid-cols-2 gap-3">
              <NumberSetting
                label={t("postpone.topicIncrease")}
                value={settings.learning.postpone.topicIncrease}
                min={0} max={200}
                onChange={(v) =>
                  updateSettings({
                    learning: { ...settings.learning, postpone: { ...settings.learning.postpone, topicIncrease: v } },
                  })
                }
              />
              <NumberSetting
                label={t("postpone.topicMinIncrease")}
                value={settings.learning.postpone.topicMinIncrease}
                min={0} max={365}
                onChange={(v) =>
                  updateSettings({
                    learning: { ...settings.learning, postpone: { ...settings.learning.postpone, topicMinIncrease: v } },
                  })
                }
              />
              <NumberSetting
                label={t("postpone.topicMaxIncrease")}
                value={settings.learning.postpone.topicMaxIncrease}
                min={0} max={365}
                onChange={(v) =>
                  updateSettings({
                    learning: { ...settings.learning, postpone: { ...settings.learning.postpone, topicMaxIncrease: v } },
                  })
                }
              />
              <NumberSetting
                label={t("postpone.topicCap")}
                value={settings.learning.postpone.topicCap}
                min={1} max={36500}
                onChange={(v) =>
                  updateSettings({
                    learning: { ...settings.learning, postpone: { ...settings.learning.postpone, topicCap: v } },
                  })
                }
              />
              <NumberSetting
                label={t("postpone.topicFloor")}
                value={settings.learning.postpone.topicFloor}
                min={0} max={365}
                onChange={(v) =>
                  updateSettings({
                    learning: { ...settings.learning, postpone: { ...settings.learning.postpone, topicFloor: v } },
                  })
                }
              />
            </div>
          </div>

          {/* Eligibility thresholds */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2">{t("postpone.eligibilityThresholds")}</h4>
            <div className="grid grid-cols-2 gap-3">
              <NumberSetting
                label={t("postpone.minElapsed")}
                value={settings.learning.postpone.minElapsed}
                min={0} max={365}
                onChange={(v) =>
                  updateSettings({
                    learning: { ...settings.learning, postpone: { ...settings.learning.postpone, minElapsed: v } },
                  })
                }
              />
              <NumberSetting
                label={t("postpone.minPriority")}
                value={settings.learning.postpone.minPriority}
                min={0} max={100}
                onChange={(v) =>
                  updateSettings({
                    learning: { ...settings.learning, postpone: { ...settings.learning.postpone, minPriority: v } },
                  })
                }
              />
              <NumberSetting
                label={t("postpone.minPriority2")}
                value={settings.learning.postpone.minPriority2}
                min={0} max={100}
                onChange={(v) =>
                  updateSettings({
                    learning: { ...settings.learning, postpone: { ...settings.learning.postpone, minPriority2: v } },
                  })
                }
              />
              <NumberSetting
                label={t("postpone.minStability")}
                value={settings.learning.postpone.minStability}
                min={0} max={365}
                onChange={(v) =>
                  updateSettings({
                    learning: { ...settings.learning, postpone: { ...settings.learning.postpone, minStability: v } },
                  })
                }
              />
              <NumberSetting
                label={t("postpone.topicPriorityMin")}
                value={settings.learning.postpone.topicPriorityMin}
                min={0} max={100}
                onChange={(v) =>
                  updateSettings({
                    learning: { ...settings.learning, postpone: { ...settings.learning.postpone, topicPriorityMin: v } },
                  })
                }
              />
              <NumberSetting
                label={t("postpone.topicRepMin")}
                value={settings.learning.postpone.topicRepMin}
                min={0} max={365}
                onChange={(v) =>
                  updateSettings({
                    learning: { ...settings.learning, postpone: { ...settings.learning.postpone, topicRepMin: v } },
                  })
                }
              />
              <NumberSetting
                label={t("postpone.topicElapsedMin")}
                value={settings.learning.postpone.topicElapsedMin}
                min={0} max={365}
                onChange={(v) =>
                  updateSettings({
                    learning: { ...settings.learning, postpone: { ...settings.learning.postpone, topicElapsedMin: v } },
                  })
                }
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <span className="text-sm font-medium text-foreground">{label}</span>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          className="sr-only peer"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
      </label>
    </div>
  );
}

function NumberSetting({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-foreground mb-1">{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))}
        className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm min-h-[44px]"
      />
    </div>
  );
}
