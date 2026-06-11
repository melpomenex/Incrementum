// Tag-Aware Scheduling (TAS) Settings Panel

import React from "react";
import { useTASStore } from "../../stores/tasStore";

const TASSettingsPanel: React.FC = () => {
  const config = useTASStore((s) => s.config);
  const updateConfig = useTASStore((s) => s.updateConfig);

  const handleToggleTAS = () => {
    updateConfig({ enabled: !config.enabled });
  };

  const handleToggleInterference = () => {
    updateConfig({
      interference: { ...config.interference, enabled: !config.interference.enabled },
    });
  };

  const handleTogglePrerequisites = () => {
    updateConfig({
      prerequisites: { ...config.prerequisites, enabled: !config.prerequisites.enabled },
    });
  };

  return (
    <div className="space-y-4 p-4 bg-surface rounded-lg border border-border">
      <h3 className="text-lg font-semibold text-foreground">
        Tag-Aware Scheduling
      </h3>

      {/* Master Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium text-foreground">
            Enable TAS
          </span>
          <p className="text-xs text-muted-foreground">
            Reorder and gate the review queue using tag relationships
          </p>
        </div>
        <button
          onClick={handleToggleTAS}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            config.enabled ? "bg-primary" : "bg-muted"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              config.enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {config.enabled && (
        <>
          <hr className="border-border" />

          {/* Interference Subsystem */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">
                Interference Jitter
              </span>
              <button
                onClick={handleToggleInterference}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  config.interference.enabled ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    config.interference.enabled ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>

            {config.interference.enabled && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground">
                    Minimum Separation: {config.interference.minSeparationHours}h
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={24}
                    step={1}
                    value={config.interference.minSeparationHours}
                    onChange={(e) =>
                      updateConfig({
                        interference: {
                          ...config.interference,
                          minSeparationHours: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0h</span>
                    <span>12h</span>
                    <span>24h</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground">
                    Coherence Threshold: {config.interference.coherenceThreshold.toFixed(2)}
                  </label>
                  <input
                    type="range"
                    min={0.5}
                    max={1.0}
                    step={0.05}
                    value={config.interference.coherenceThreshold}
                    onChange={(e) =>
                      updateConfig({
                        interference: {
                          ...config.interference,
                          coherenceThreshold: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0.50</span>
                    <span>0.75</span>
                    <span>1.00</span>
                  </div>
                </div>
              </>
            )}
          </div>

          <hr className="border-border" />

          {/* Prerequisites Subsystem */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">
                Prerequisite Gating
              </span>
              <button
                onClick={handleTogglePrerequisites}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  config.prerequisites.enabled ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    config.prerequisites.enabled ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>

            {config.prerequisites.enabled && (
              <div>
                <label className="text-xs text-muted-foreground">
                  Maturity Ratio: {config.prerequisites.maturityRatio.toFixed(2)}
                </label>
                <input
                  type="range"
                  min={0.5}
                  max={1.0}
                  step={0.05}
                  value={config.prerequisites.maturityRatio}
                  onChange={(e) =>
                    updateConfig({
                      prerequisites: {
                        ...config.prerequisites,
                        maturityRatio: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0.50</span>
                  <span>0.75</span>
                  <span>1.00</span>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default TASSettingsPanel;
