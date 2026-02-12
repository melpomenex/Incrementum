/**
 * AI Tag Suggestions Hook
 * Suggests tags for documents based on content analysis
 */

import { useState, useCallback } from "react";
import { answerQuestion } from "../../api/ai";

export interface TagSuggestion {
  tag: string;
  confidence: "high" | "medium" | "low";
  category: "topic" | "type" | "difficulty" | "custom";
}

interface UseAITagSuggestionsReturn {
  suggestions: TagSuggestion[];
  isLoading: boolean;
  error: string | null;
  suggestTags: (content: string, title?: string) => Promise<TagSuggestion[]>;
  clearSuggestions: () => void;
}

// Common tag categories for learning content
const TOPIC_TAGS = [
  "programming", "science", "mathematics", "history", "philosophy",
  "psychology", "economics", "literature", "art", "music",
  "technology", "business", "health", "language", "politics",
];

const TYPE_TAGS = [
  "tutorial", "research", "reference", "guide", "textbook",
  "article", "documentation", "case-study", "lecture", "notes",
];

const DIFFICULTY_TAGS = [
  "beginner", "intermediate", "advanced", "expert",
];

export function useAITagSuggestions(): UseAITagSuggestionsReturn {
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestTags = useCallback(async (content: string, title?: string): Promise<TagSuggestion[]> => {
    setIsLoading(true);
    setError(null);

    try {
      // Use a limited portion of content for tag analysis
      const contentPreview = content.slice(0, 2000);

      const prompt = `Analyze the following ${title ? `titled "${title}"` : ""} content and suggest relevant tags.

Content preview:
${contentPreview}

Please respond with a JSON array of tag suggestions. Each suggestion should have:
- tag: the suggested tag (lowercase, no spaces, use hyphens if needed)
- confidence: "high", "medium", or "low"
- category: "topic", "type", "difficulty", or "custom"

Example format:
[{"tag":"machine-learning","confidence":"high","category":"topic"},{"tag":"tutorial","confidence":"medium","category":"type"}]

Provide 3-7 relevant tags. Only respond with the JSON array, no additional text.`;

      const response = await answerQuestion(prompt, contentPreview);

      // Parse the JSON response
      let parsedTags: TagSuggestion[] = [];

      try {
        // Try to extract JSON from the response
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          parsedTags = JSON.parse(jsonMatch[0]);
        }
      } catch {
        // If parsing fails, extract tags from text
        const tagMatches = response.match(/"tag":\s*"([^"]+)"/g);
        if (tagMatches) {
          parsedTags = tagMatches.map((match, index) => {
            const tag = match.replace(/"tag":\s*"([^"]+)"/, "$1");
            return {
              tag,
              confidence: index < 3 ? "high" : "medium",
              category: "custom" as const,
            };
          });
        }
      }

      // Validate and clean up suggestions
      const validSuggestions = parsedTags
        .filter((s) => s.tag && typeof s.tag === "string")
        .map((s) => ({
          tag: s.tag.toLowerCase().replace(/\s+/g, "-"),
          confidence: s.confidence || "medium",
          category: s.category || "custom",
        }))
        .slice(0, 7);

      setSuggestions(validSuggestions);
      return validSuggestions;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to suggest tags";
      setError(errorMessage);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
    setError(null);
  }, []);

  return {
    suggestions,
    isLoading,
    error,
    suggestTags,
    clearSuggestions,
  };
}

/**
 * Generate basic tags from content without AI
 * Fallback when AI is not available
 */
export function generateBasicTags(content: string, title?: string): TagSuggestion[] {
  const suggestions: TagSuggestion[] = [];
  const lowerContent = content.toLowerCase();
  const lowerTitle = title?.toLowerCase() || "";

  // Check for topic keywords
  const topicKeywords: Record<string, string[]> = {
    "programming": ["code", "function", "variable", "algorithm", "programming", "developer", "software"],
    "science": ["experiment", "hypothesis", "research", "study", "scientific", "data"],
    "mathematics": ["equation", "formula", "calculation", "theorem", "proof", "mathematical"],
    "technology": ["technology", "digital", "software", "hardware", "computer", "tech"],
    "business": ["business", "market", "strategy", "company", "enterprise", "startup"],
    "health": ["health", "medical", "wellness", "fitness", "diet", "exercise"],
    "psychology": ["psychology", "behavior", "cognitive", "mental", "emotion", "mind"],
    "history": ["history", "historical", "century", "ancient", "medieval", "era"],
    "philosophy": ["philosophy", "ethics", "logic", "existence", "reasoning", "thought"],
    "language": ["language", "linguistic", "grammar", "vocabulary", "translation", "speaking"],
  };

  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    const matchCount = keywords.filter(
      (kw) => lowerContent.includes(kw) || lowerTitle.includes(kw)
    ).length;

    if (matchCount >= 2) {
      suggestions.push({
        tag: topic,
        confidence: matchCount >= 4 ? "high" : "medium",
        category: "topic",
      });
    }
  }

  // Check for content type
  if (lowerContent.includes("step 1") || lowerContent.includes("how to") || lowerContent.includes("tutorial")) {
    suggestions.push({ tag: "tutorial", confidence: "high", category: "type" });
  }
  if (lowerContent.includes("abstract") || lowerContent.includes("methodology") || lowerContent.includes("conclusion")) {
    suggestions.push({ tag: "research", confidence: "medium", category: "type" });
  }
  if (lowerContent.includes("definition") || lowerContent.includes("refers to") || lowerContent.includes("glossary")) {
    suggestions.push({ tag: "reference", confidence: "medium", category: "type" });
  }

  // Check for difficulty indicators
  if (lowerContent.includes("introduction") || lowerContent.includes("basics") || lowerContent.includes("beginner")) {
    suggestions.push({ tag: "beginner", confidence: "medium", category: "difficulty" });
  }
  if (lowerContent.includes("advanced") || lowerContent.includes("expert") || lowerContent.includes("deep dive")) {
    suggestions.push({ tag: "advanced", confidence: "medium", category: "difficulty" });
  }

  return suggestions.slice(0, 5);
}

export default useAITagSuggestions;
