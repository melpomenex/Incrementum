import type { WordToken } from "./textModel";

const Y_THRESHOLD = 4;

export interface LineGroup {
  index: number;
  tokens: WordToken[];
  top: number;
  bottom: number;
}

export function groupTokensIntoLines(tokens: WordToken[]): LineGroup[] {
  if (tokens.length === 0) return [];

  const lines: LineGroup[] = [];
  let currentTokens: WordToken[] = [tokens[0]];
  let lineTop = tokens[0].rect.top;
  let lineBottom = tokens[0].rect.bottom;

  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];
    const tokenMidY = token.rect.top + token.rect.height / 2;

    if (Math.abs(tokenMidY - (lineTop + lineBottom) / 2) <= Y_THRESHOLD) {
      currentTokens.push(token);
      lineTop = Math.min(lineTop, token.rect.top);
      lineBottom = Math.max(lineBottom, token.rect.bottom);
    } else {
      lines.push({
        index: lines.length,
        tokens: currentTokens,
        top: lineTop,
        bottom: lineBottom,
      });
      currentTokens = [token];
      lineTop = token.rect.top;
      lineBottom = token.rect.bottom;
    }
  }

  // Push last line
  lines.push({
    index: lines.length,
    tokens: currentTokens,
    top: lineTop,
    bottom: lineBottom,
  });

  return lines;
}

export function findLineForToken(lines: LineGroup[], tokenIndex: number): LineGroup | null {
  for (const line of lines) {
    if (tokenIndex >= line.tokens[0].index && tokenIndex <= line.tokens[line.tokens.length - 1].index) {
      return line;
    }
  }
  return null;
}

export function findClosestTokenOnLine(
  line: LineGroup,
  desiredX: number,
): WordToken {
  let closest = line.tokens[0];
  let minDist = Infinity;

  for (const token of line.tokens) {
    const midX = token.rect.left + token.rect.width / 2;
    const dist = Math.abs(midX - desiredX);
    if (dist < minDist) {
      minDist = dist;
      closest = token;
    }
  }

  return closest;
}
