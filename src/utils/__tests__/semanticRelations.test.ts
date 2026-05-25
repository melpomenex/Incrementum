import { describe, expect, it } from "vitest";
import {
  tokenize,
  jaccardSimilarity,
  calculateItemSimilarity,
  scoreFocalTopic,
  buildSemanticGraph,
} from "../semanticRelations";
import type { QueueItem } from "../../types/queue";

describe("semanticRelations Utilities", () => {
  describe("tokenize", () => {
    it("converts text to lowercase, removes punctuation and filters stop words", () => {
      const text = "The quick brown Fox jumps over a lazy Dog! discrete-math";
      const tokens = tokenize(text);

      expect(tokens.has("quick")).toBe(true);
      expect(tokens.has("brown")).toBe(true);
      expect(tokens.has("fox")).toBe(true);
      expect(tokens.has("jumps")).toBe(true);
      expect(tokens.has("lazy")).toBe(true);
      expect(tokens.has("dog")).toBe(true);
      expect(tokens.has("discrete-math")).toBe(true);

      // Stop words filtered out
      expect(tokens.has("the")).toBe(false);
      expect(tokens.has("over")).toBe(false);
      expect(tokens.has("a")).toBe(false);
    });

    it("handles empty or null text gracefully", () => {
      expect(tokenize("").size).toBe(0);
      expect(tokenize(null as any).size).toBe(0);
    });
  });

  describe("jaccardSimilarity", () => {
    it("calculates exact intersection over union ratio", () => {
      const setA = new Set(["turing", "automata", "complexity"]);
      const setB = new Set(["automata", "complexity", "languages"]);

      // Intersection: ["automata", "complexity"] (size 2)
      // Union: ["turing", "automata", "complexity", "languages"] (size 4)
      // Jaccard similarity: 2 / 4 = 0.5
      expect(jaccardSimilarity(setA, setB)).toBe(0.5);
    });

    it("returns 0 if either set is empty", () => {
      expect(jaccardSimilarity(new Set(["a"]), new Set())).toBe(0);
      expect(jaccardSimilarity(new Set(), new Set(["b"]))).toBe(0);
    });
  });

  describe("calculateItemSimilarity", () => {
    const itemA: QueueItem = {
      id: "item-1",
      documentId: "doc-1",
      documentTitle: "Introduction to Automata Theory",
      itemType: "document",
      priority: 5,
      estimatedTime: 5,
      tags: ["Turing", "CS"],
      category: "Computer Science",
      progress: 0,
    };

    const itemB: QueueItem = {
      id: "item-2",
      documentId: "doc-1",
      documentTitle: "Turing Machines and Computability",
      itemType: "document",
      priority: 8,
      estimatedTime: 5,
      tags: ["Turing", "Math"],
      category: "Computer Science",
      progress: 0,
    };

    const itemC: QueueItem = {
      id: "item-3",
      documentId: "doc-2",
      documentTitle: "Renaissance Art History",
      itemType: "document",
      priority: 2,
      estimatedTime: 5,
      tags: ["Italy", "Painting"],
      category: "Arts & Humanities",
      progress: 0,
    };

    it("returns high similarity for related items in the same category/document with shared tokens", () => {
      const similarityAB = calculateItemSimilarity(itemA, itemB);
      expect(similarityAB).toBeGreaterThan(0.5); // high similarity
    });

    it("returns very low similarity for completely unrelated items", () => {
      const similarityAC = calculateItemSimilarity(itemA, itemC);
      expect(similarityAC).toBeLessThan(0.2); // low similarity
    });
  });

  describe("scoreFocalTopic", () => {
    const csItem: QueueItem = {
      id: "cs-1",
      documentId: "doc-1",
      documentTitle: "Automata and Formal Languages",
      itemType: "document",
      priority: 5,
      estimatedTime: 5,
      tags: ["automata", "languages"],
      category: "Computer Science",
      progress: 0,
    };

    const artItem: QueueItem = {
      id: "art-1",
      documentId: "doc-2",
      documentTitle: "Impressionist Painting and Light",
      itemType: "document",
      priority: 4,
      estimatedTime: 5,
      tags: ["monet", "france"],
      category: "Fine Arts",
      progress: 0,
    };

    it("returns 1.0 for direct substring match", () => {
      const score = scoreFocalTopic(csItem, "Automata");
      expect(score).toBe(1.0);
    });

    it("returns positive score for token overlap match", () => {
      const score = scoreFocalTopic(csItem, "formal languages");
      expect(score).toBeGreaterThan(0);
    });

    it("returns 0 for unrelated items", () => {
      const score = scoreFocalTopic(artItem, "Quantum Computing");
      expect(score).toBe(0);
    });

    it("returns 1.0 for empty topic (matches everything)", () => {
      const score = scoreFocalTopic(artItem, "");
      expect(score).toBe(1.0);
    });

    it("performs direct token/text overlap matching for generic topics", () => {
      const scorePaint = scoreFocalTopic(artItem, "Impressionist Painting");
      expect(scorePaint).toBeGreaterThan(0);
    });
  });

  describe("buildSemanticGraph", () => {
    const items: QueueItem[] = [
      {
        id: "1",
        documentId: "doc-1",
        documentTitle: "Neural Networks and Deep Learning",
        itemType: "document",
        priority: 5,
        estimatedTime: 5,
        tags: ["AI", "ML"],
        category: "Computer Science",
        progress: 0,
      },
      {
        id: "2",
        documentId: "doc-1",
        documentTitle: "Convolutional Neural Networks for Vision",
        itemType: "document",
        priority: 6,
        estimatedTime: 5,
        tags: ["AI", "Vision"],
        category: "Computer Science",
        progress: 0,
      },
      {
        id: "3",
        documentId: "doc-2",
        documentTitle: "Intro to Poetry Writing",
        itemType: "document",
        priority: 2,
        estimatedTime: 5,
        tags: ["literature"],
        category: "Arts",
        progress: 0,
      }
    ];

    it("generates correct number of nodes", () => {
      const graph = buildSemanticGraph(items, 30);
      expect(graph.nodes.length).toBe(3);
    });

    it("filters edges based on strictness threshold", () => {
      const graph30 = buildSemanticGraph(items, 30);
      // Items 1 and 2 share category + document + tokens (neural, networks)
      expect(graph30.edges.length).toBeGreaterThanOrEqual(1);

      // At very high threshold, fewer or no edges
      const graph85 = buildSemanticGraph(items, 85);
      expect(graph85.edges.length).toBeLessThanOrEqual(graph30.edges.length);
    });

    it("filters nodes according to focal topic query", () => {
      const graph = buildSemanticGraph(items, 10, "Neural Networks");
      expect(graph.nodes.length).toBe(2); // Only items 1 and 2 match
      expect(graph.nodes.find(n => n.id === "3")).toBeUndefined();
    });
  });
});
