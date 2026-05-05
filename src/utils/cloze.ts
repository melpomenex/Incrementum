/**
 * Parse {{cN::text}} and {{cN::text::hint}} cloze deletions from raw text.
 * Returns array of { start, end, content, hint?, number } for each deletion.
 * Used as a fallback when cloze_ranges are not pre-calculated (e.g. AI-generated cloze cards).
 */
export function parseClozeDeletions(text: string): Array<{
  start: number;
  end: number;
  content: string;
  hint?: string;
  number: number;
}> {
  const results: Array<{ start: number; end: number; content: string; hint?: string; number: number }> = [];
  // Match {{c<number>::content}} or {{c<number>::content::hint}}
  const pattern = /\{\{c(\d+)::(.+?)(?:::(.+?))?\}\}/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    results.push({
      start: match.index,
      end: match.index + match[0].length,
      content: match[2],
      hint: match[3],
      number: parseInt(match[1], 10),
    });
  }
  return results;
}

/**
 * Check if text contains raw {{cN::...}} cloze deletion syntax.
 */
export function hasRawClozeSyntax(text: string): boolean {
  return /\{\{c\d+::/.test(text);
}

/**
 * Strip cloze markers and return plain text with just the content revealed.
 */
export function stripClozeMarkers(text: string): string {
  return text.replace(/\{\{c\d+::(.+?)(?:::(.+?))?\}\}/g, "$1");
}
