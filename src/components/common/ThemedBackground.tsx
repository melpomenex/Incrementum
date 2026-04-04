import { useEffect, useState } from "react";
import { useTheme } from "../../contexts/ThemeContext";

const animatedThemeIds = new Set([
  "deep-space",
  "storm-forest",
  "aurora-drift",
  "sunset-drive",
  "ocean-depths",
  "emberfall",
  "desert-mirage",
]);

const starPositions = [
  { left: "6%", top: "14%", size: 2, delay: "0s" },
  { left: "17%", top: "28%", size: 3, delay: "1.1s" },
  { left: "28%", top: "10%", size: 2, delay: "2.2s" },
  { left: "36%", top: "42%", size: 2, delay: "0.7s" },
  { left: "46%", top: "18%", size: 4, delay: "1.8s" },
  { left: "56%", top: "30%", size: 2, delay: "2.7s" },
  { left: "64%", top: "12%", size: 3, delay: "0.3s" },
  { left: "74%", top: "38%", size: 2, delay: "2.5s" },
  { left: "81%", top: "20%", size: 4, delay: "1.4s" },
  { left: "88%", top: "44%", size: 2, delay: "3.1s" },
  { left: "92%", top: "16%", size: 3, delay: "1.9s" },
];

const bubblePositions = [
  { left: "8%", size: 10, duration: "14s", delay: "0s" },
  { left: "22%", size: 18, duration: "18s", delay: "4s" },
  { left: "39%", size: 12, duration: "16s", delay: "2s" },
  { left: "57%", size: 14, duration: "20s", delay: "7s" },
  { left: "73%", size: 9, duration: "15s", delay: "1s" },
  { left: "89%", size: 16, duration: "22s", delay: "5s" },
];

const emberPositions = [
  { left: "10%", size: 5, duration: "7s", delay: "0s" },
  { left: "22%", size: 7, duration: "8s", delay: "1.5s" },
  { left: "34%", size: 4, duration: "6.5s", delay: "3s" },
  { left: "48%", size: 6, duration: "8.2s", delay: "0.8s" },
  { left: "61%", size: 5, duration: "7.4s", delay: "2.1s" },
  { left: "74%", size: 8, duration: "8.8s", delay: "1.1s" },
  { left: "87%", size: 4, duration: "6.9s", delay: "2.8s" },
];

function DeepSpaceBackground() {
  return (
    <>
      <div className="theme-motion-bg theme-deep-space-base" />
      <div className="theme-motion-bg theme-deep-space-nebula theme-motion-drift-slow" />
      <div className="theme-motion-bg theme-deep-space-grid" />
      <div className="theme-motion-bg theme-deep-space-stars theme-motion-pan-vertical" />
      <div className="theme-motion-bg theme-deep-space-stars theme-deep-space-stars-secondary theme-motion-pan-vertical" />
      <div className="theme-motion-bg">
        {starPositions.map((star) => (
          <span
            key={`${star.left}-${star.top}`}
            className="theme-star-twinkle"
            style={{
              left: star.left,
              top: star.top,
              width: star.size,
              height: star.size,
              animationDelay: star.delay,
            }}
          />
        ))}
      </div>
    </>
  );
}

function StormForestBackground({ lightningFlash }: { lightningFlash: number }) {
  return (
    <>
      <div className="theme-motion-bg theme-storm-forest-sky" />
      <div className="theme-motion-bg theme-storm-forest-mist theme-motion-drift-medium" />
      <div className="theme-motion-bg theme-storm-forest-rain" />
      <div className="theme-motion-bg theme-storm-forest-rain theme-storm-forest-rain-far" />
      <div className="theme-motion-bg theme-storm-forest-canopy" />
      <div
        className="theme-motion-bg theme-storm-forest-lightning"
        style={{ opacity: lightningFlash }}
      />
    </>
  );
}

function AuroraDriftBackground() {
  return (
    <>
      <div className="theme-motion-bg theme-aurora-night" />
      <div className="theme-motion-bg theme-aurora-curtain theme-motion-wave-slow" />
      <div className="theme-motion-bg theme-aurora-curtain theme-aurora-curtain-secondary theme-motion-wave-medium" />
      <div className="theme-motion-bg theme-aurora-stars theme-motion-pan-vertical" />
    </>
  );
}

function SunsetDriveBackground() {
  return (
    <>
      <div className="theme-motion-bg theme-sunset-drive-sky" />
      <div className="theme-motion-bg theme-sunset-drive-sun theme-motion-pulse-soft" />
      <div className="theme-motion-bg theme-sunset-drive-clouds theme-motion-drift-slow" />
      <div className="theme-motion-bg theme-sunset-drive-road theme-motion-road-scroll" />
      <div className="theme-motion-bg theme-sunset-drive-grid theme-motion-road-scroll" />
    </>
  );
}

function OceanDepthsBackground() {
  return (
    <>
      <div className="theme-motion-bg theme-ocean-depths-base" />
      <div className="theme-motion-bg theme-ocean-depths-caustics theme-motion-wave-medium" />
      <div className="theme-motion-bg theme-ocean-depths-glow theme-motion-pulse-soft" />
      <div className="theme-motion-bg">
        {bubblePositions.map((bubble) => (
          <span
            key={bubble.left}
            className="theme-ocean-bubble"
            style={{
              left: bubble.left,
              width: bubble.size,
              height: bubble.size,
              animationDuration: bubble.duration,
              animationDelay: bubble.delay,
            }}
          />
        ))}
      </div>
    </>
  );
}

function EmberfallBackground() {
  return (
    <>
      <div className="theme-motion-bg theme-emberfall-base" />
      <div className="theme-motion-bg theme-emberfall-smoke theme-motion-drift-medium" />
      <div className="theme-motion-bg theme-emberfall-glow theme-motion-pulse-soft" />
      <div className="theme-motion-bg">
        {emberPositions.map((ember) => (
          <span
            key={ember.left}
            className="theme-ember-particle"
            style={{
              left: ember.left,
              width: ember.size,
              height: ember.size,
              animationDuration: ember.duration,
              animationDelay: ember.delay,
            }}
          />
        ))}
      </div>
    </>
  );
}

function DesertMirageBackground() {
  return (
    <>
      <div className="theme-motion-bg theme-desert-mirage-sky" />
      <div className="theme-motion-bg theme-desert-mirage-sun theme-motion-pulse-soft" />
      <div className="theme-motion-bg theme-desert-mirage-dunes theme-motion-drift-slow" />
      <div className="theme-motion-bg theme-desert-mirage-heat theme-motion-shimmer" />
      <div className="theme-motion-bg theme-desert-mirage-dust theme-motion-pan-horizontal" />
    </>
  );
}

export function ThemedBackground() {
  const { theme } = useTheme();
  const [lightningFlash, setLightningFlash] = useState(0);

  useEffect(() => {
    if (theme.id !== "storm-forest") {
      setLightningFlash(0);
      return;
    }

    let cancelled = false;
    let timeoutId: number | undefined;

    const triggerFlash = () => {
      if (cancelled) return;
      setLightningFlash(0.9);
      window.setTimeout(() => {
        if (!cancelled) setLightningFlash(0.15);
      }, 110);
      window.setTimeout(() => {
        if (!cancelled) setLightningFlash(0.65);
      }, 180);
      window.setTimeout(() => {
        if (!cancelled) setLightningFlash(0);
      }, 340);

      const nextDelay = 7000 + Math.random() * 9000;
      timeoutId = window.setTimeout(triggerFlash, nextDelay);
    };

    timeoutId = window.setTimeout(triggerFlash, 2200);
    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [theme.id]);

  if (!animatedThemeIds.has(theme.id)) {
    return null;
  }

  return (
    <div className={`theme-motion-root theme-motion-root-${theme.id}`} aria-hidden="true">
      {theme.id === "deep-space" && <DeepSpaceBackground />}
      {theme.id === "storm-forest" && <StormForestBackground lightningFlash={lightningFlash} />}
      {theme.id === "aurora-drift" && <AuroraDriftBackground />}
      {theme.id === "sunset-drive" && <SunsetDriveBackground />}
      {theme.id === "ocean-depths" && <OceanDepthsBackground />}
      {theme.id === "emberfall" && <EmberfallBackground />}
      {theme.id === "desert-mirage" && <DesertMirageBackground />}
    </div>
  );
}
