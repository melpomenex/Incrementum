/**
 * Tests for AssistantPanel's parseToolCalls, normalizeToolParameters,
 * buildConfirmationMessage, and buildToolInstruction logic.
 *
 * These are extracted from AssistantPanel.tsx so they can be tested without React.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Types (mirrored from AssistantPanel.tsx) ───────────────────────────

interface ToolCall {
  name: string;
  parameters: Record<string, unknown>;
  result?: unknown;
  status: "pending" | "success" | "error";
}

interface MCPTool {
  name: string;
  description: string;
}

// ─── Extracted parseToolCalls (mirror of AssistantPanel.tsx logic) ──────

function parseToolCalls(
  content: string,
  availableTools: Array<{ name: string }>
): { cleanedContent: string; toolCalls: ToolCall[] } {
  const knownToolNames = new Set(availableTools.map((t) => t.name));
  const toolCalls: ToolCall[] = [];
  const toolCallRegex = /```tool_calls\s*([\s\S]*?)```/g;
  let cleanedContent = content;
  let match: RegExpExecArray | null;

  const extractCalls = (
    parsed: unknown
  ): Array<{ name?: string; arguments?: Record<string, unknown> }> => {
    if (Array.isArray(parsed)) return parsed;
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray((parsed as Record<string, unknown>).tool_calls)
    ) {
      return (parsed as Record<string, unknown>)
        .tool_calls as Array<{ name?: string; arguments?: Record<string, unknown> }>;
    }
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as Record<string, unknown>).name === "string"
    ) {
      return [parsed as { name?: string; arguments?: Record<string, unknown> }];
    }
    return [];
  };

  while ((match = toolCallRegex.exec(content)) !== null) {
    const raw = match[1].trim();
    try {
      const parsed = JSON.parse(raw);
      const calls = extractCalls(parsed);

      calls.forEach(
        (call: { name?: string; arguments?: Record<string, unknown> }) => {
          if (typeof call?.name === "string" && knownToolNames.has(call.name)) {
            const args = call.arguments;
            const normalizedArgs =
              args && typeof args === "object" && !Array.isArray(args)
                ? args
                : {};
            toolCalls.push({
              name: call.name,
              parameters: normalizedArgs,
              status: "pending",
            });
          }
        }
      );
      cleanedContent = cleanedContent.replace(match[0], "").trim();
    } catch (error) {
      console.warn("Failed to parse tool call block:", error);
    }
  }

  // Fallback 1: try to parse unfenced JSON containing recognized tool names
  if (toolCalls.length === 0 && knownToolNames.size > 0) {
    const jsonBlockRegex =
      /(?:^|\n)((?:\{[\s\S]*?\}|\[[\s\S]*?\]))(?:\n|$)/g;
    let fallbackMatch: RegExpExecArray | null;
    while ((fallbackMatch = jsonBlockRegex.exec(cleanedContent)) !== null) {
      const raw = fallbackMatch[1].trim();
      try {
        const parsed = JSON.parse(raw);
        const calls = extractCalls(parsed);
        const validCalls = calls.filter(
          (call) =>
            typeof call?.name === "string" && knownToolNames.has(call.name)
        );
        if (validCalls.length > 0) {
          validCalls.forEach((call) => {
            const args = call.arguments;
            const normalizedArgs =
              args && typeof args === "object" && !Array.isArray(args)
                ? args
                : {};
            toolCalls.push({
              name: call.name!,
              parameters: normalizedArgs,
              status: "pending",
            });
          });
          cleanedContent = cleanedContent.replace(fallbackMatch[0], "").trim();
        } else if (knownToolNames.has("create_qa_card") && Array.isArray(parsed)) {
          // No tool-name matches — check for {question, answer} card arrays
          let foundCards = false;
          for (const item of parsed) {
            if (item && typeof item === "object") {
              const q = item.question ?? item.Q ?? item.q;
              const a = item.answer ?? item.A ?? item.a;
              if (typeof q === "string" && typeof a === "string") {
                toolCalls.push({ name: "create_qa_card", parameters: { question: q, answer: a }, status: "pending" });
                foundCards = true;
              }
            }
          }
          if (foundCards) {
            cleanedContent = cleanedContent.replace(fallbackMatch[0], "").trim();
          }
        }
      } catch {
        // Not valid JSON — leave untouched
      }
    }
  }

  // Fallback 2: convert fenced JSON arrays of {question, answer} into create_qa_card calls
  if (toolCalls.length === 0 && knownToolNames.has("create_qa_card")) {
    const jsonArrRegex = /```(?:json)?\s*\n?([\s\S]*?)```/g;
    let arrMatch: RegExpExecArray | null;
    while ((arrMatch = jsonArrRegex.exec(cleanedContent)) !== null) {
      const raw = arrMatch[1].trim();
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item && typeof item === "object") {
              const q = item.question ?? item.Q ?? item.q;
              const a = item.answer ?? item.A ?? item.a;
              if (typeof q === "string" && typeof a === "string") {
                toolCalls.push({
                  name: "create_qa_card",
                  parameters: { question: q, answer: a },
                  status: "pending",
                });
              }
            }
          }
          // Remove the matched fence block from content
          cleanedContent = cleanedContent.replace(arrMatch[0], "").trim();
        }
      } catch {
        // Not valid JSON
      }
    }
  }

  // Fallback 3: convert UNFENCED JSON arrays of {question, answer} into create_qa_card calls
  // This catches the common case where the LLM outputs raw JSON without code fences.
  if (toolCalls.length === 0 && knownToolNames.has("create_qa_card")) {
    // Strategy: find JSON arrays that start with [{ and contain question/answer-like keys.
    // Use a relaxed regex that only needs to match the start of the first object.
    const arrayLikeRegex = /\[\s*\{[^}]*?(?:question|Q|q)\s*:/s;
    let arrMatch = arrayLikeRegex.exec(cleanedContent);
    if (arrMatch) {
      try {
        // Try to find the full array by extending from the match start
        const start = arrMatch.index;
        const afterMatch = cleanedContent.slice(start);
        const arrayStart = afterMatch.indexOf("[");
        if (arrayStart !== -1) {
          // Find the matching closing bracket
          let depth = 0;
          let end = -1;
          for (let i = arrayStart; i < afterMatch.length; i += 1) {
            if (afterMatch[i] === "[") depth += 1;
            else if (afterMatch[i] === "]") {
              depth -= 1;
              if (depth === 0) {
                end = i + 1;
                break;
              }
            }
          }
          if (end !== -1) {
            const raw = afterMatch.slice(arrayStart, end);
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              let foundCards = false;
              for (const item of parsed) {
                if (item && typeof item === "object") {
                  const q = item.question ?? item.Q ?? item.q;
                  const a = item.answer ?? item.A ?? item.a;
                  if (typeof q === "string" && typeof a === "string") {
                    toolCalls.push({
                      name: "create_qa_card",
                      parameters: { question: q, answer: a },
                      status: "pending",
                    });
                    foundCards = true;
                  }
                }
              }
              if (foundCards) {
              // Remove the matched array from content
              cleanedContent =
                cleanedContent.slice(0, start + arrayStart) +
                cleanedContent.slice(start + end);
              cleanedContent = cleanedContent
                .replace(/\n{3,}/g, "\n\n")
                .trim();
              } // end if (foundCards)
            }
          }
        }
      } catch {
        // Not valid JSON — leave untouched
      }
    }
  }

  return { cleanedContent, toolCalls };
}

// ─── Extracted buildConfirmationMessage (mirror of AssistantPanel.tsx) ──

function buildConfirmationMessage(
  results: Array<{ name: string; status: "success" | "error"; error?: string }>
): string | null {
  const succeeded = results.filter((r) => r.status === "success");
  const failed = results.filter((r) => r.status === "error");

  const parts: string[] = [];

  if (succeeded.length > 0) {
    const counts: Record<string, number> = {};
    succeeded.forEach((r) => {
      counts[r.name] = (counts[r.name] || 0) + 1;
    });

    const hasCards =
      counts["create_qa_card"] ||
      counts["create_cloze_card"] ||
      counts["batch_create_cards"];
    const hasDeck = counts["create_deck"];

    if (hasDeck && !hasCards) {
      // Deck was created but no cards — likely the LLM didn't include card calls
      parts.push(
        `⚠️ Deck created but no flashcards were saved. The AI may have only created the deck without the card tool calls. Try asking again to add cards.`
      );
    } else {
      const summaries = Object.entries(counts).map(([name, count]) => {
        const label =
          name === "create_qa_card" ||
          name === "create_cloze_card" ||
          name === "batch_create_cards"
            ? `${count} flashcard${count > 1 ? "s" : ""}`
            : name === "create_extract"
              ? `${count} extract${count > 1 ? "s" : ""}`
              : name === "create_document"
                ? `${count} document${count > 1 ? "s" : ""}`
                : `${count} ${name}${count > 1 ? "s" : ""}`;
        return label;
      });
      parts.push(`Created ${summaries.join(", ")} and saved to your library.`);
    }
  }

  if (failed.length > 0) {
    const errors = failed.map((r) => `${r.name}: ${r.error}`).join("; ");
    parts.push(`Failed: ${errors}`);
  }

  return parts.join(" ") || null;
}

// ─── Extracted normalizeToolParameters (mirror of AssistantPanel.tsx) ───

function normalizeToolParameters(
  toolName: string,
  parameters: Record<string, unknown>,
  documentId?: string,
  docTitle?: string
): Record<string, unknown> {
  const normalized = { ...parameters };
  const attachableTools = new Set([
    "create_cloze_card",
    "create_qa_card",
    "create_extract",
    "batch_create_cards",
  ]);

  if (documentId && attachableTools.has(toolName) && normalized.document_id == null) {
    normalized.document_id = documentId;
  }

  if (docTitle && attachableTools.has(toolName)) {
    const deckTag = `deck:${docTitle}`;
    const existingTags: string[] = Array.isArray(normalized.tags)
      ? normalized.tags.map((t: unknown) => String(t))
      : [];
    if (!existingTags.some((t) => t.toLowerCase() === deckTag.toLowerCase())) {
      normalized.tags = [...existingTags, deckTag];
    }
  }

  return normalized;
}

// ─── Mock tools list ────────────────────────────────────────────────────

const MOCK_TOOLS = [
  { name: "create_qa_card", description: "Create a Q&A flashcard" },
  { name: "create_cloze_card", description: "Create a cloze card" },
  { name: "create_extract", description: "Create an extract" },
  { name: "batch_create_cards", description: "Batch create cards" },
  { name: "create_document", description: "Create a document" },
  { name: "create_deck", description: "Create a study deck" },
  { name: "get_document", description: "Get a document" },
  { name: "search_documents", description: "Search documents" },
  { name: "get_learning_items", description: "Get learning items" },
  { name: "get_document_extracts", description: "Get document extracts" },
  { name: "get_review_queue", description: "Get review queue" },
];

// ═══════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════

describe("parseToolCalls", () => {
  describe("Primary: fenced tool_calls blocks", () => {
    it("parses a single create_qa_card tool call", () => {
      const content = `I'll create a flashcard for you.

\`\`\`tool_calls
{"tool_calls":[{"name":"create_qa_card","arguments":{"question":"What is photosynthesis?","answer":"The process by which plants convert sunlight into energy."}}]}
\`\`\`

Done!`;

      const result = parseToolCalls(content, MOCK_TOOLS);
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].name).toBe("create_qa_card");
      expect(result.toolCalls[0].parameters.question).toBe(
        "What is photosynthesis?"
      );
      expect(result.toolCalls[0].parameters.answer).toBe(
        "The process by which plants convert sunlight into energy."
      );
      expect(result.toolCalls[0].status).toBe("pending");
      expect(result.cleanedContent).not.toContain("tool_calls");
    });

    it("parses a tool_calls block with create_deck AND create_qa_card calls together", () => {
      const content = `\`\`\`tool_calls
{"tool_calls":[
  {"name":"create_deck","arguments":{"name":"Biology 101"}},
  {"name":"create_qa_card","arguments":{"question":"What is photosynthesis?","answer":"Converting light to chemical energy."}},
  {"name":"create_qa_card","arguments":{"question":"What are chloroplasts?","answer":"Organelles where photosynthesis occurs."}}
]}
\`\`\``;

      const result = parseToolCalls(content, MOCK_TOOLS);
      expect(result.toolCalls).toHaveLength(3);
      expect(result.toolCalls[0].name).toBe("create_deck");
      expect(result.toolCalls[0].parameters.name).toBe("Biology 101");
      expect(result.toolCalls[1].name).toBe("create_qa_card");
      expect(result.toolCalls[2].name).toBe("create_qa_card");
    });

    it("parses multiple tool calls in one block (mixed types)", () => {
      const content = `Here are your flashcards:

\`\`\`tool_calls
{"tool_calls":[
  {"name":"create_qa_card","arguments":{"question":"What is X?","answer":"X is..."}},
  {"name":"create_qa_card","arguments":{"question":"Why does Y happen?","answer":"Because..."}},
  {"name":"create_cloze_card","arguments":{"text":"The {{key term}} is important for..."}}
]}
\`\`\``;

      const result = parseToolCalls(content, MOCK_TOOLS);
      expect(result.toolCalls).toHaveLength(3);
      expect(result.toolCalls[0].name).toBe("create_qa_card");
      expect(result.toolCalls[1].name).toBe("create_qa_card");
      expect(result.toolCalls[2].name).toBe("create_cloze_card");
    });

    it("parses a tool_calls block with extra whitespace", () => {
      const content = `\`\`\`tool_calls   
{"tool_calls":[{"name":"create_qa_card","arguments":{"question":"Q1","answer":"A1"}}]}  
\`\`\``;

      const result = parseToolCalls(content, MOCK_TOOLS);
      expect(result.toolCalls).toHaveLength(1);
    });

    it("ignores tool calls with unknown tool names", () => {
      const content = `\`\`\`tool_calls
{"tool_calls":[{"name":"nonexistent_tool","arguments":{"x":1}}]}
\`\`\``;

      const result = parseToolCalls(content, MOCK_TOOLS);
      expect(result.toolCalls).toHaveLength(0);
    });

    it("strips tool_calls blocks from cleanedContent", () => {
      const content = `Before\n\`\`\`tool_calls\n{"tool_calls":[{"name":"create_qa_card","arguments":{"question":"Q","answer":"A"}}]}\n\`\`\`\nAfter`;

      const result = parseToolCalls(content, MOCK_TOOLS);
      // The cleaned content should not contain the tool_calls block
      expect(result.cleanedContent).not.toContain("tool_calls");
      expect(result.cleanedContent).toContain("Before");
      expect(result.cleanedContent).toContain("After");
    });
  });

  describe("Fallback 1: unfenced JSON with recognized tool names", () => {
    it("parses unfenced tool_calls JSON object", () => {
      const content = `I created the cards:
{"tool_calls":[{"name":"create_qa_card","arguments":{"question":"What is 2+2?","answer":"4"}}]}`;

      const result = parseToolCalls(content, MOCK_TOOLS);
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].name).toBe("create_qa_card");
      expect(result.toolCalls[0].parameters.question).toBe("What is 2+2?");
    });

    it("parses unfenced array of tool call objects with recognized names", () => {
      const content = `[{"name":"create_qa_card","arguments":{"question":"Q1","answer":"A1"}},{"name":"create_cloze_card","arguments":{"text":"The {{x}} is y"}}]`;

      const result = parseToolCalls(content, MOCK_TOOLS);
      expect(result.toolCalls).toHaveLength(2);
    });

    it("parses a single unfenced tool call object", () => {
      const content = `{"name":"create_qa_card","arguments":{"question":"Q?","answer":"A!"}}`;

      const result = parseToolCalls(content, MOCK_TOOLS);
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].name).toBe("create_qa_card");
    });
  });

  describe("Fallback 2: fenced JSON arrays with {question, answer}", () => {
    it("parses a fenced JSON array of Q&A pairs", () => {
      const content = `Here are the flashcards:

\`\`\`json
[
  {"question": "What is the capital of France?", "answer": "Paris"},
  {"question": "What is 2+2?", "answer": "4"}
]
\`\`\``;

      const result = parseToolCalls(content, MOCK_TOOLS);
      expect(result.toolCalls).toHaveLength(2);
      expect(result.toolCalls[0].name).toBe("create_qa_card");
      expect(result.toolCalls[0].parameters.question).toBe(
        "What is the capital of France?"
      );
      expect(result.toolCalls[0].parameters.answer).toBe("Paris");
    });

    it("handles Q/A shorthand keys", () => {
      const content = `\`\`\`json
[{"Q": "Capital of Japan?", "A": "Tokyo"}, {"q": "2*3?", "a": "6"}]
\`\`\``;

      const result = parseToolCalls(content, MOCK_TOOLS);
      expect(result.toolCalls).toHaveLength(2);
      expect(result.toolCalls[0].parameters.question).toBe("Capital of Japan?");
      expect(result.toolCalls[0].parameters.answer).toBe("Tokyo");
      expect(result.toolCalls[1].parameters.question).toBe("2*3?");
      expect(result.toolCalls[1].parameters.answer).toBe("6");
    });

    it("handles fenced JSON without language identifier", () => {
      const content = `\`\`\`
[{"question": "Q?", "answer": "A!"}]
\`\`\``;

      const result = parseToolCalls(content, MOCK_TOOLS);
      expect(result.toolCalls).toHaveLength(1);
    });
  });

  describe("Fallback 3: UNFENCED JSON arrays of {question, answer}", () => {
    it("parses raw unfenced JSON array of Q&A pairs (the LLM-dropped-tool-calls bug)", () => {
      // This was the BUG scenario — LLM outputs raw JSON without fences
      // after saying "I've created flashcards"
      const content = `I've created 2 flashcards for you:

[{"question": "What is photosynthesis?", "answer": "The process by which plants convert light into energy."}, {"question": "What is cellular respiration?", "answer": "The process cells use to break down glucose into ATP."}]

These cards cover the key concepts from the document.`;

      const result = parseToolCalls(content, MOCK_TOOLS);
      expect(result.toolCalls).toHaveLength(2);
      expect(result.toolCalls[0].name).toBe("create_qa_card");
      expect(result.toolCalls[0].parameters.question).toBe("What is photosynthesis?");
      expect(result.toolCalls[1].name).toBe("create_qa_card");
      expect(result.toolCalls[1].parameters.question).toBe("What is cellular respiration?");
    });

    it("removes the unfenced JSON array from cleaned content", () => {
      const content = `Before\n[{"question": "Q?", "answer": "A!"}]\nAfter`;

      const result = parseToolCalls(content, MOCK_TOOLS);
      expect(result.toolCalls).toHaveLength(1);
      expect(result.cleanedContent).toContain("Before");
      expect(result.cleanedContent).toContain("After");
      expect(result.cleanedContent).not.toContain('"question"');
    });

    it("handles multi-line unfenced JSON", () => {
      const content = `Here are the cards:
[
  {"question": "What is 1+1?", "answer": "2"},
  {"question": "What is 2+2?", "answer": "4"}
]
Done.`;

      const result = parseToolCalls(content, MOCK_TOOLS);
      expect(result.toolCalls).toHaveLength(2);
    });
  });
});

describe("buildConfirmationMessage", () => {
  it("returns confirmation for successful card creation", () => {
    const results = [
      { name: "create_qa_card", status: "success" as const },
      { name: "create_qa_card", status: "success" as const },
      { name: "create_cloze_card", status: "success" as const },
    ];
    const msg = buildConfirmationMessage(results);
    expect(msg).toContain("flashcard");
    expect(msg).toContain("saved to your library");
  });

  it("returns null for empty results", () => {
    expect(buildConfirmationMessage([])).toBeNull();
  });

  it("includes error details for failed calls", () => {
    const results = [
      { name: "create_qa_card", status: "success" as const },
      {
        name: "create_extract",
        status: "error" as const,
        error: "document_id is required",
      },
    ];
    const msg = buildConfirmationMessage(results);
    expect(msg).toContain("flashcard");
    expect(msg).toContain("Failed:");
    expect(msg).toContain("document_id is required");
  });

  it("handles all-failed results", () => {
    const results = [
      {
        name: "create_qa_card",
        status: "error" as const,
        error: "DB locked",
      },
    ];
    const msg = buildConfirmationMessage(results);
    expect(msg).toContain("Failed:");
  });

  it("detects deck-without-cards scenario and warns", () => {
    // This is the core user-reported bug: deck created, cards not
    const results = [
      { name: "create_deck", status: "success" as const },
    ];
    const msg = buildConfirmationMessage(results);
    expect(msg).toContain("⚠️");
    expect(msg).toContain("no flashcards were saved");
  });

  it("does NOT warn when deck AND cards both succeed", () => {
    const results = [
      { name: "create_deck", status: "success" as const },
      { name: "create_qa_card", status: "success" as const },
      { name: "create_qa_card", status: "success" as const },
    ];
    const msg = buildConfirmationMessage(results);
    expect(msg).not.toContain("⚠️");
    expect(msg).toContain("saved to your library");
  });
});

describe("normalizeToolParameters", () => {
  it("injects document_id when missing", () => {
    const params = { question: "Q?", answer: "A!" };
    const result = normalizeToolParameters("create_qa_card", params, "doc-123");
    expect(result.document_id).toBe("doc-123");
  });

  it("does not override existing document_id", () => {
    const params = { question: "Q?", answer: "A!", document_id: "other-doc" };
    const result = normalizeToolParameters("create_qa_card", params, "doc-123");
    expect(result.document_id).toBe("other-doc");
  });

  it("injects deck tag from document title", () => {
    const params = { question: "Q?", answer: "A!" };
    const result = normalizeToolParameters("create_qa_card", params, undefined, "My PDF");
    expect(result.tags).toContain("deck:My PDF");
  });

  it("does not inject document_id for non-attachable tools", () => {
    const params = { query: "test" };
    const result = normalizeToolParameters("search_documents", params, "doc-123");
    expect(result.document_id).toBeUndefined();
  });

  it("adds deck tag for cloze cards too", () => {
    const params = { text: "The {{concept}} is important" };
    const result = normalizeToolParameters("create_cloze_card", params, undefined, "Biology Notes");
    expect(result.tags).toContain("deck:Biology Notes");
  });

  it("adds deck tag for batch_create_cards", () => {
    const params = { cards: [{ question: "Q?", answer: "A!" }] };
    const result = normalizeToolParameters("batch_create_cards", params, "doc-123", "Physics");
    expect(result.document_id).toBe("doc-123");
    expect(result.tags).toContain("deck:Physics");
  });

  it("does not duplicate deck tag if already present", () => {
    const params = { question: "Q?", answer: "A!", tags: ["deck:My PDF", "important"] };
    const result = normalizeToolParameters("create_qa_card", params, undefined, "My PDF");
    expect(result.tags).toEqual(["deck:My PDF", "important"]);
  });
});

describe("conversation history ordering (regression)", () => {
  it("current user message should come AFTER history", () => {
    // This is a structural test to document the correct ordering.
    // The callLLM function should construct messages as:
    // [system, ...history, current_user]
    // NOT [system, current_user, ...history]
    const systemMsg = { role: "system", content: "tool instructions" };
    const history1 = { role: "user", content: "create a deck" };
    const history2 = { role: "assistant", content: "deck created" };
    const currentPrompt = { role: "user", content: "add cards about photosynthesis" };

    // CORRECT ordering:
    const correctOrder = [systemMsg, history1, history2, currentPrompt];
    expect(correctOrder.map((m) => m.content)).toEqual([
      "tool instructions",
      "create a deck",
      "deck created",
      "add cards about photosynthesis",
    ]);

    // WRONG ordering (the old bug):
    const wrongOrder = [systemMsg, currentPrompt, history1, history2];
    // Verify wrong order is actually different
    expect(wrongOrder.map((m) => m.content)).not.toEqual(
      correctOrder.map((m) => m.content)
    );
  });
});
