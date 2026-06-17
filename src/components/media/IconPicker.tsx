/**
 * IconPicker
 * Emoji grid + custom input for folder/feed icons
 */

import { useState } from "react";
import { Smiley, X } from "@phosphor-icons/react";

const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  { label: "Common", emojis: ["📁", "📰", "🌐", "💻", "📚", "🎨", "🔬", "📈", "🎮", "🎬"] },
  { label: "Tech", emojis: ["🔧", "⚡", "🤖", "📱", "🖥️", "📊", "🛡️", "🔑", "📡", "📡"] },
  { label: "Science", emojis: ["🧪", "🔭", "🧬", "🌍", "🧠", "📊", "🔬", "⚛️", "🧮", "💡"] },
  { label: "Media", emojis: ["📸", "🎵", "📝", "🎙️", "📹", "📺", "📰", "📖", "🏷️", "📬"] },
  { label: "Misc", emojis: ["⭐", "❤️", "🔥", "💡", "🎯", "🏆", "📌", "✅", "🔔", "💬"] },
];

interface IconPickerProps {
  currentIcon?: string;
  onSelect: (icon: string) => void;
  onClose: () => void;
}

export function IconPicker({ currentIcon, onSelect, onClose }: IconPickerProps) {
  const [customIcon, setCustomIcon] = useState(currentIcon || "");
  const [showAll, setShowAll] = useState(false);

  const frequentlyUsed = ["📁", "📰", "🌐", "💻", "📚", "🎨", "⭐", "🔥", "💡", "📊"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-xl shadow-2xl w-72 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 py-2 border-b border-border flex items-center justify-between">
          <span className="text-sm font-medium text-foreground flex items-center gap-1">
            <Smiley className="w-4 h-4" /> Pick Icon
          </span>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground rounded">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Custom input */}
        <div className="px-3 py-2 border-b border-border">
          <input
            value={customIcon}
            onChange={(e) => setCustomIcon(e.target.value)}
            placeholder="Type emoji or paste..."
            className="w-full px-2 py-1 text-sm bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {customIcon && (
            <button
              onClick={() => { onSelect(customIcon); onClose(); }}
              className="mt-1 w-full px-2 py-1 text-xs bg-primary text-primary-foreground rounded"
            >
              Use "{customIcon}"
            </button>
          )}
        </div>

        {/* Quick picks */}
        <div className="p-3 grid grid-cols-5 gap-1">
          {(showAll ? EMOJI_CATEGORIES.flatMap((c) => c.emojis) : frequentlyUsed).map((emoji) => (
            <button
              key={emoji}
              onClick={() => { onSelect(emoji); onClose(); }}
              className={`p-2 text-lg rounded hover:bg-muted/60 transition-colors ${
                currentIcon === emoji ? "bg-primary/10 ring-1 ring-primary" : ""
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors border-t border-border"
        >
          {showAll ? "Show less" : "Show all categories"}
        </button>
      </div>
    </div>
  );
}
