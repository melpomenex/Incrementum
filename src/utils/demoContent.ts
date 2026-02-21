/**
 * Demo Content Utility
 * Provides sample documents and flashcards for new users to explore Incrementum
 */

const DEMO_CONTENT_KEY = "incrementum_demo_content_imported";

export interface DemoDocument {
  id: string;
  title: string;
  content: string;
  fileType: string;
  tags: string[];
}

export interface DemoFlashcard {
  id: string;
  documentId: string;
  question: string;
  answer: string;
  tags: string[];
}

const demoDocuments: DemoDocument[] = [
  {
    id: "demo-doc-1",
    title: "Introduction to Spaced Repetition",
    content: `
# Introduction to Spaced Repetition

Spaced repetition is a learning technique that incorporates increasing intervals of time between subsequent review of previously learned material. This exploits the psychological spacing effect.

## The Forgetting Curve

Hermann Ebbinghaus discovered the forgetting curve, which shows how information is lost over time when there's no attempt to retain it. The curve demonstrates that:

1. **Rapid initial decline**: Most forgetting happens in the first few hours and days after learning.
2. **Gradual leveling off**: The rate of forgetting slows down over time.
3. **Impact of review**: Each review session strengthens the memory and flattens the curve.

## The Spacing Effect

The spacing effect is the phenomenon whereby learning is greater when studying is spread out over time, as opposed to studying the same amount of time in a single session.

### Benefits of Spaced Repetition

- **Improved retention**: Information is retained longer in long-term memory.
- **Efficient use of time**: Focus on material you're about to forget.
- **Better understanding**: Regular review reinforces connections between concepts.
- **Reduced cramming**: Build knowledge gradually instead of last-minute studying.

## The FSRS Algorithm

Free Spaced Repetition Scheduler (FSRS) is a modern algorithm that optimizes review intervals based on your performance. It considers:

- **Difficulty**: How hard you find the material.
- **Stability**: How well you remember it over time.
- **Retrievability**: The probability you'll recall it now.

### Rating System

When reviewing, rate your recall:

- **Again**: Forgot completely, show again soon.
- **Hard**: Remembered with difficulty.
- **Good**: Remembered correctly (default).
- **Easy**: Knew it instantly.

## Getting Started

1. Import your learning materials (PDFs, EPUBs, articles).
2. Create extracts from key passages.
3. Convert extracts to flashcards.
4. Review daily for best results.

Remember: Consistency is key! Even 10 minutes of daily review is more effective than occasional long sessions.
    `,
    fileType: "markdown",
    tags: ["learning", "productivity", "tutorial"],
  },
  {
    id: "demo-doc-2",
    title: "Effective Learning Strategies",
    content: `
# Effective Learning Strategies

## Active Recall

Active recall is a principle of efficient learning with claims to need 95% of your study time. It involves:

- Testing yourself on the material you're learning.
- Not just re-reading or highlighting.
- The struggle to remember strengthens neural pathways.

### How to Practice Active Recall

1. **Close the book**: After reading a section, close it and try to recall the main points.
2. **Use flashcards**: Test yourself with questions, not just definitions.
3. **Teach others**: Explaining concepts helps you understand them better.
4. **Practice problems**: Apply what you've learned in new contexts.

## Interleaving

Interleaving is a learning technique that mixes different topics or types of problems.

### Benefits

- Improves ability to distinguish between concepts.
- Strengthens connections between related ideas.
- Better preparation for real-world applications.

## Elaborative Interrogation

Ask yourself "why" questions about the material:

- Why is this true?
- Why does this process work this way?
- How does this connect to what I already know?

## Dual Coding

Combine verbal and visual information:

- Create diagrams and mind maps.
- Use images alongside text.
- Visualize concepts in your mind.

## Metacognition

Think about your thinking:

- Monitor your understanding.
- Recognize when you don't understand something.
- Adjust your learning strategies accordingly.

## Summary

Effective learning is not about the time spent, but the strategies used. Combine spaced repetition with active recall, interleaving, and other evidence-based techniques for maximum retention.
    `,
    fileType: "markdown",
    tags: ["learning", "strategies", "productivity"],
  },
];

const demoFlashcards: DemoFlashcard[] = [
  {
    id: "demo-card-1",
    documentId: "demo-doc-1",
    question: "What is the forgetting curve?",
    answer: "A curve discovered by Hermann Ebbinghaus that shows how information is lost over time when there's no attempt to retain it. It demonstrates rapid initial decline, gradual leveling off, and the impact of review.",
    tags: ["learning", "memory"],
  },
  {
    id: "demo-card-2",
    documentId: "demo-doc-1",
    question: "What is the spacing effect?",
    answer: "The phenomenon whereby learning is greater when studying is spread out over time, as opposed to studying the same amount of time in a single session.",
    tags: ["learning", "memory"],
  },
  {
    id: "demo-card-3",
    documentId: "demo-doc-1",
    question: "What are the four rating options in FSRS and what do they mean?",
    answer: "1. **Again**: Forgot completely, show again soon.\n2. **Hard**: Remembered with difficulty.\n3. **Good**: Remembered correctly (default).\n4. **Easy**: Knew it instantly.",
    tags: ["fsrs", "review"],
  },
  {
    id: "demo-card-4",
    documentId: "demo-doc-1",
    question: "What factors does the FSRS algorithm consider?",
    answer: "**Difficulty**: How hard you find the material.\n**Stability**: How well you remember it over time.\n**Retrievability**: The probability you'll recall it now.",
    tags: ["fsrs", "algorithm"],
  },
  {
    id: "demo-card-5",
    documentId: "demo-doc-2",
    question: "What is active recall?",
    answer: "A learning principle that involves testing yourself on the material you're learning, rather than just re-reading or highlighting. The struggle to remember strengthens neural pathways.",
    tags: ["learning", "strategies"],
  },
  {
    id: "demo-card-6",
    documentId: "demo-doc-2",
    question: "What is interleaving?",
    answer: "A learning technique that mixes different topics or types of problems. It improves the ability to distinguish between concepts and strengthens connections between related ideas.",
    tags: ["learning", "strategies"],
  },
  {
    id: "demo-card-7",
    documentId: "demo-doc-2",
    question: "What is elaborative interrogation?",
    answer: "Asking yourself 'why' questions about the material: Why is this true? Why does this process work this way? How does this connect to what I already know?",
    tags: ["learning", "strategies"],
  },
  {
    id: "demo-card-8",
    documentId: "demo-doc-2",
    question: "What is dual coding?",
    answer: "A learning strategy that combines verbal and visual information: creating diagrams and mind maps, using images alongside text, and visualizing concepts in your mind.",
    tags: ["learning", "strategies"],
  },
  {
    id: "demo-card-9",
    documentId: "demo-doc-2",
    question: "What is metacognition in learning?",
    answer: "Thinking about your thinking: monitoring your understanding, recognizing when you don't understand something, and adjusting your learning strategies accordingly.",
    tags: ["learning", "metacognition"],
  },
  {
    id: "demo-card-10",
    documentId: "demo-doc-1",
    question: "What are the main benefits of spaced repetition?",
    answer: "1. **Improved retention**: Information is retained longer in long-term memory.\n2. **Efficient use of time**: Focus on material you're about to forget.\n3. **Better understanding**: Regular review reinforces connections.\n4. **Reduced cramming**: Build knowledge gradually.",
    tags: ["learning", "benefits"],
  },
];

/**
 * Check if demo content has already been imported
 */
export function hasImportedDemoContent(): boolean {
  return localStorage.getItem(DEMO_CONTENT_KEY) === "true";
}

/**
 * Mark demo content as imported
 */
export function markDemoContentImported(): void {
  localStorage.setItem(DEMO_CONTENT_KEY, "true");
}

/**
 * Get demo documents
 */
export function getDemoDocuments(): DemoDocument[] {
  return demoDocuments;
}

/**
 * Get demo flashcards
 */
export function getDemoFlashcards(): DemoFlashcard[] {
  return demoFlashcards;
}

/**
 * Reset demo content (for testing)
 */
export function resetDemoContent(): void {
  localStorage.removeItem(DEMO_CONTENT_KEY);
}

export default {
  hasImportedDemoContent,
  markDemoContentImported,
  getDemoDocuments,
  getDemoFlashcards,
  resetDemoContent,
  demoDocuments,
  demoFlashcards,
};
