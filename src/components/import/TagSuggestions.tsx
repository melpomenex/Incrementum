/**
 * Tag Suggestions Component
 * Shows AI-suggested tags during import with one-click selection
 */

import { useState, useEffect } from "react";
import {
  Sparkles,
  Tag,
  Plus,
  X,
  Loader2,
  RefreshCw,
  Check,
  AlertCircle,
} from "lucide-react";
import { useAITagSuggestions, generateBasicTags, type TagSuggestion } from "../../hooks/useAITagSuggestions";

interface TagSuggestionsProps {
  content: string;
  title?: string;
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  enableAI?: boolean;
  className?: string;
}

const CONFIDENCE_COLORS = {
  high: "bg-green-500/20 text-green-600 border-green-500/30",
  medium: "bg-amber-500/20 text-amber-600 border-amber-500/30",
  low: "bg-muted text-muted-foreground border-border",
};

const CATEGORY_ICONS = {
  topic: "📚",
  type: "📄",
  difficulty: "📊",
  custom: "✨",
};

export function TagSuggestions({
  content,
  title,
  selectedTags,
  onTagsChange,
  enableAI = true,
  className = "",
}: TagSuggestionsProps) {
  const {
    suggestions: aiSuggestions,
    isLoading,
    error,
    suggestTags,
    clearSuggestions,
  } = useAITagSuggestions();

  const [showInput, setShowInput] = useState(false);
  const [customTag, setCustomTag] = useState("");
  const [hasLoadedAI, setHasLoadedAI] = useState(false);

  // Generate basic tags as fallback
  const basicSuggestions = generateBasicTags(content, title);

  // Use AI suggestions if available, otherwise use basic
  const suggestions = aiSuggestions.length > 0 ? aiSuggestions : basicSuggestions;

  // Load AI suggestions on mount if enabled
  useEffect(() => {
    if (enableAI && content && !hasLoadedAI && aiSuggestions.length === 0) {
      setHasLoadedAI(true);
      suggestTags(content, title);
    }
  }, [enableAI, content, title, hasLoadedAI, aiSuggestions.length, suggestTags]);

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter((t) => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  const addCustomTag = () => {
    const trimmed = customTag.trim().toLowerCase().replace(/\s+/g, "-");
    if (trimmed && !selectedTags.includes(trimmed)) {
      onTagsChange([...selectedTags, trimmed]);
      setCustomTag("");
      setShowInput(false);
    }
  };

  const handleRefresh = () => {
    clearSuggestions();
    setHasLoadedAI(false);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Tags</span>
          {isLoading && (
            <span className="text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin inline mr-1" />
              Analyzing...
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {enableAI && (
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="p-1.5 hover:bg-muted rounded transition-colors disabled:opacity-50"
              title="Refresh suggestions"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${isLoading ? "animate-spin" : ""}`} />
            </button>
          )}
          <button
            onClick={() => setShowInput(!showInput)}
            className="p-1.5 hover:bg-muted rounded transition-colors"
            title="Add custom tag"
          >
            <Plus className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Selected Tags */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-1 bg-primary/20 text-primary rounded-full text-xs"
            >
              {tag}
              <button
                onClick={() => toggleTag(tag)}
                className="hover:bg-primary/30 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Custom Tag Input */}
      {showInput && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={customTag}
            onChange={(e) => setCustomTag(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCustomTag()}
            placeholder="Add custom tag..."
            className="flex-1 px-3 py-1.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            autoFocus
          />
          <button
            onClick={addCustomTag}
            disabled={!customTag.trim()}
            className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm disabled:opacity-50"
          >
            Add
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-2 bg-red-500/10 text-red-600 rounded-lg text-xs">
          <AlertCircle className="w-3 h-3" />
          <span>{error}</span>
        </div>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="w-3 h-3" />
            <span>Suggested tags</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((suggestion) => {
              const isSelected = selectedTags.includes(suggestion.tag);
              return (
                <button
                  key={suggestion.tag}
                  onClick={() => toggleTag(suggestion.tag)}
                  className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs border transition-all ${
                    isSelected
                      ? "bg-primary/20 text-primary border-primary/50"
                      : CONFIDENCE_COLORS[suggestion.confidence]
                  }`}
                  title={`${suggestion.category} • ${suggestion.confidence} confidence`}
                >
                  <span>{CATEGORY_ICONS[suggestion.category]}</span>
                  <span>{suggestion.tag}</span>
                  {isSelected && <Check className="w-3 h-3" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* No suggestions */}
      {!isLoading && suggestions.length === 0 && selectedTags.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No tag suggestions available. Add your own tags above.
        </p>
      )}
    </div>
  );
}

/**
 * Compact inline tag suggestions
 */
interface InlineTagSuggestionsProps {
  suggestions: TagSuggestion[];
  selectedTags: string[];
  onTagToggle: (tag: string) => void;
  className?: string;
}

export function InlineTagSuggestions({
  suggestions,
  selectedTags,
  onTagToggle,
  className = "",
}: InlineTagSuggestionsProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {suggestions.slice(0, 5).map((suggestion) => {
        const isSelected = selectedTags.includes(suggestion.tag);
        return (
          <button
            key={suggestion.tag}
            onClick={() => onTagToggle(suggestion.tag)}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors ${
              isSelected
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80 text-muted-foreground"
            }`}
          >
            {suggestion.tag}
            {isSelected && <Check className="w-3 h-3" />}
          </button>
        );
      })}
    </div>
  );
}

export default TagSuggestions;
