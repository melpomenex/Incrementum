import type { WordToken } from "./textModel";
import { type LineGroup, findLineForToken, findClosestTokenOnLine } from "./lineGrouper";

export interface MotionResult {
  cursorIndex: number;
  desiredColumn: number;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function motionH(tokens: WordToken[], cursorIndex: number, _desiredColumn: number): MotionResult {
  if (cursorIndex <= 0) return { cursorIndex: 0, desiredColumn: _desiredColumn };
  const newIndex = cursorIndex - 1;
  const token = tokens[newIndex];
  return { cursorIndex: newIndex, desiredColumn: token.rect.left + token.rect.width / 2 };
}

export function motionL(tokens: WordToken[], cursorIndex: number, _desiredColumn: number): MotionResult {
  if (cursorIndex >= tokens.length - 1) return { cursorIndex: tokens.length - 1, desiredColumn: _desiredColumn };
  const newIndex = cursorIndex + 1;
  const token = tokens[newIndex];
  return { cursorIndex: newIndex, desiredColumn: token.rect.left + token.rect.width / 2 };
}

export function motionW(tokens: WordToken[], cursorIndex: number, _desiredColumn: number): MotionResult {
  const newIndex = clamp(cursorIndex + 1, 0, tokens.length - 1);
  const token = tokens[newIndex];
  return { cursorIndex: newIndex, desiredColumn: token.rect.left + token.rect.width / 2 };
}

export function motionB(tokens: WordToken[], cursorIndex: number, _desiredColumn: number): MotionResult {
  const newIndex = clamp(cursorIndex - 1, 0, tokens.length - 1);
  const token = tokens[newIndex];
  return { cursorIndex: newIndex, desiredColumn: token.rect.left + token.rect.width / 2 };
}

export function motionE(tokens: WordToken[], cursorIndex: number, _desiredColumn: number): MotionResult {
  // If already at end of word, move to end of next word
  const newIndex = clamp(cursorIndex + 1, 0, tokens.length - 1);
  const token = tokens[newIndex];
  return { cursorIndex: newIndex, desiredColumn: token.rect.right };
}

export function motion0(tokens: WordToken[], cursorIndex: number, lines: LineGroup[]): MotionResult {
  const line = findLineForToken(lines, cursorIndex);
  if (!line) return { cursorIndex, desiredColumn: 0 };
  const first = line.tokens[0];
  return { cursorIndex: first.index, desiredColumn: first.rect.left };
}

export function motionDollar(tokens: WordToken[], cursorIndex: number, lines: LineGroup[]): MotionResult {
  const line = findLineForToken(lines, cursorIndex);
  if (!line) return { cursorIndex, desiredColumn: 0 };
  const last = line.tokens[line.tokens.length - 1];
  return { cursorIndex: last.index, desiredColumn: last.rect.right };
}

export function motionJ(tokens: WordToken[], cursorIndex: number, desiredColumn: number, lines: LineGroup[]): MotionResult {
  const currentLine = findLineForToken(lines, cursorIndex);
  if (!currentLine || currentLine.index >= lines.length - 1) return { cursorIndex, desiredColumn };

  const nextLine = lines[currentLine.index + 1];
  const target = findClosestTokenOnLine(nextLine, desiredColumn);
  return { cursorIndex: target.index, desiredColumn };
}

export function motionK(tokens: WordToken[], cursorIndex: number, desiredColumn: number, lines: LineGroup[]): MotionResult {
  const currentLine = findLineForToken(lines, cursorIndex);
  if (!currentLine || currentLine.index <= 0) return { cursorIndex, desiredColumn };

  const prevLine = lines[currentLine.index - 1];
  const target = findClosestTokenOnLine(prevLine, desiredColumn);
  return { cursorIndex: target.index, desiredColumn };
}

export function motionGG(tokens: WordToken[]): MotionResult {
  if (tokens.length === 0) return { cursorIndex: 0, desiredColumn: 0 };
  const token = tokens[0];
  return { cursorIndex: 0, desiredColumn: token.rect.left + token.rect.width / 2 };
}

export function motionG(tokens: WordToken[]): MotionResult {
  if (tokens.length === 0) return { cursorIndex: 0, desiredColumn: 0 };
  const lastIndex = tokens.length - 1;
  const token = tokens[lastIndex];
  return { cursorIndex: lastIndex, desiredColumn: token.rect.left + token.rect.width / 2 };
}

export function motionOpenBrace(tokens: WordToken[], cursorIndex: number, lines: LineGroup[]): MotionResult {
  const currentLine = findLineForToken(lines, cursorIndex);
  if (!currentLine || currentLine.index <= 0) {
    // Already at first line, go to first token
    if (tokens.length > 0) {
      return { cursorIndex: 0, desiredColumn: tokens[0].rect.left + tokens[0].rect.width / 2 };
    }
    return { cursorIndex: 0, desiredColumn: 0 };
  }

  // Jump to the start of the previous paragraph (gap in Y between lines)
  for (let i = currentLine.index; i > 0; i--) {
    const gap = lines[i].top - lines[i - 1].bottom;
    if (gap > 20) {
      const target = lines[i].tokens[0];
      return { cursorIndex: target.index, desiredColumn: target.rect.left + target.rect.width / 2 };
    }
  }

  // No paragraph gap found, go to first line
  const first = lines[0].tokens[0];
  return { cursorIndex: first.index, desiredColumn: first.rect.left + first.rect.width / 2 };
}

export function motionCloseBrace(tokens: WordToken[], cursorIndex: number, lines: LineGroup[]): MotionResult {
  const currentLine = findLineForToken(lines, cursorIndex);
  if (!currentLine || currentLine.index >= lines.length - 1) {
    // Already at last line
    if (tokens.length > 0) {
      const last = tokens[tokens.length - 1];
      return { cursorIndex: last.index, desiredColumn: last.rect.left + last.rect.width / 2 };
    }
    return { cursorIndex: 0, desiredColumn: 0 };
  }

  // Jump to the start of the next paragraph (gap in Y between lines)
  for (let i = currentLine.index + 1; i < lines.length; i++) {
    if (i > 0) {
      const gap = lines[i].top - lines[i - 1].bottom;
      if (gap > 20) {
        const target = lines[i].tokens[0];
        return { cursorIndex: target.index, desiredColumn: target.rect.left + target.rect.width / 2 };
      }
    }
  }

  // No paragraph gap found, go to last line
  const lastLine = lines[lines.length - 1];
  const last = lastLine.tokens[0];
  return { cursorIndex: last.index, desiredColumn: last.rect.left + last.rect.width / 2 };
}
