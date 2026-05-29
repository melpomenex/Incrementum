/**
 * Lightweight LaTeX macro expansion for KaTeX.
 *
 * KaTeX does not support `\newcommand` or `\DeclareMathOperator`.
 * This module provides a pre-processing pass that expands these macros
 * before passing expressions to KaTeX.
 */

const MAX_RECURSION_DEPTH = 10;

interface MacroDef {
  argCount: number;
  body: string;
}

export class MacroExpander {
  private macros = new Map<string, MacroDef>();

  reset(): void {
    this.macros.clear();
  }

  define(cmd: string, argCount: number, body: string): void {
    this.macros.set(cmd, { argCount, body });
  }

  /**
   * Extract a brace-delimited group starting at `pos`.
   * Returns the content between braces and advances `pos` past the closing brace.
   */
  private extractBraceGroup(text: string, pos: number): { content: string; end: number } | null {
    if (pos >= text.length || text[pos] !== "{") return null;
    let depth = 0;
    let start = pos;
    while (pos < text.length) {
      if (text[pos] === "{") depth++;
      else if (text[pos] === "}") {
        depth--;
        if (depth === 0) {
          return { content: text.slice(start + 1, pos), end: pos + 1 };
        }
      }
      pos++;
    }
    return null;
  }

  private static readonly RE_NEWCOMMAND = /^\\newcommand(?![a-zA-Z])/;
  private static readonly RE_RENEWCOMMAND = /^\\renewcommand(?![a-zA-Z])/;
  private static readonly RE_DECLARE_OP = /^\\DeclareMathOperator(?![a-zA-Z])/;

  /**
   * Parse and register macro definitions from LaTeX source.
   * Strips the definitions from the returned expression.
   */
  parseDefinitions(expression: string): string {
    let result = "";
    let pos = 0;

    while (pos < expression.length) {
      const rest = expression.slice(pos);

      const renewMatch = MacroExpander.RE_RENEWCOMMAND.exec(rest);
      const newMatch = !renewMatch && MacroExpander.RE_NEWCOMMAND.exec(rest);
      const declareMatch = MacroExpander.RE_DECLARE_OP.exec(rest);

      if (newMatch) {
        let p = pos + newMatch[0].length;

        // Parse {\name}
        const nameGroup = this.extractBraceGroup(expression, p);
        if (!nameGroup) { result += expression[pos]; pos++; continue; }
        p = nameGroup.end;

        // The name should be \something
        const nameMatch = nameGroup.content.match(/^\\([a-zA-Z]+)$/);
        if (!nameMatch) { result += expression[pos]; pos++; continue; }
        const name = nameMatch[1];

        // Optional [n] for argument count
        let argCount = 0;
        if (p < expression.length && expression[p] === "[") {
          const bracketEnd = expression.indexOf("]", p);
          if (bracketEnd !== -1) {
            argCount = parseInt(expression.slice(p + 1, bracketEnd), 10) || 0;
            p = bracketEnd + 1;
          }
        }

        // Parse {body}
        const bodyGroup = this.extractBraceGroup(expression, p);
        if (!bodyGroup) { result += expression[pos]; pos++; continue; }

        this.define(name, argCount, bodyGroup.content);
        pos = bodyGroup.end;
        continue;
      }

      if (renewMatch) {
        let p = pos + renewMatch[0].length;

        const nameGroup = this.extractBraceGroup(expression, p);
        if (!nameGroup) { result += expression[pos]; pos++; continue; }
        p = nameGroup.end;

        const nameMatch = nameGroup.content.match(/^\\([a-zA-Z]+)$/);
        if (!nameMatch) { result += expression[pos]; pos++; continue; }
        const name = nameMatch[1];

        let argCount = 0;
        if (p < expression.length && expression[p] === "[") {
          const bracketEnd = expression.indexOf("]", p);
          if (bracketEnd !== -1) {
            argCount = parseInt(expression.slice(p + 1, bracketEnd), 10) || 0;
            p = bracketEnd + 1;
          }
        }

        const bodyGroup = this.extractBraceGroup(expression, p);
        if (!bodyGroup) { result += expression[pos]; pos++; continue; }

        this.define(name, argCount, bodyGroup.content);
        pos = bodyGroup.end;
        continue;
      }

      if (declareMatch) {
        let p = pos + declareMatch[0].length;

        // Skip optional *
        if (p < expression.length && expression[p] === "*") p++;

        // Parse {\cmd}
        const nameGroup = this.extractBraceGroup(expression, p);
        if (!nameGroup) { result += expression[pos]; pos++; continue; }
        p = nameGroup.end;

        const nameMatch = nameGroup.content.match(/^\\([a-zA-Z]+)$/);
        if (!nameMatch) { result += expression[pos]; pos++; continue; }

        // Parse {text}
        const textGroup = this.extractBraceGroup(expression, p);
        if (!textGroup) { result += expression[pos]; pos++; continue; }

        this.define(nameMatch[1], 0, `\\operatorname{${textGroup.content}}`);
        pos = textGroup.end;
        continue;
      }

      result += expression[pos];
      pos++;
    }

    return result;
  }

  /**
   * Expand all macro invocations in an expression.
   * Handles positional arguments (#1, #2, etc.).
   */
  expand(expression: string, depth = 0): string {
    if (depth >= MAX_RECURSION_DEPTH) {
      return expression;
    }

    // Find the first macro invocation and expand it
    for (const [cmd, def] of this.macros) {
      const escapedCmd = `\\${cmd}`;
      const idx = expression.indexOf(escapedCmd);
      if (idx === -1) continue;

      // Ensure it's not part of a longer command name
      const nextChar = expression[idx + escapedCmd.length];
      if (nextChar !== undefined && /[a-zA-Z]/.test(nextChar)) continue;

      let expanded: string;
      let consumedLength: number;

      if (def.argCount === 0) {
        expanded = def.body;
        consumedLength = escapedCmd.length;
      } else {
        const args: string[] = [];
        let pos = idx + escapedCmd.length;

        for (let i = 0; i < def.argCount; i++) {
          // Skip whitespace
          while (pos < expression.length && /\s/.test(expression[pos])) pos++;

          if (pos >= expression.length) break;

          if (expression[pos] === "{") {
            // Brace-delimited argument
            const argStart = pos;
            let braceDepth = 0;
            while (pos < expression.length) {
              if (expression[pos] === "{") braceDepth++;
              else if (expression[pos] === "}") {
                braceDepth--;
                if (braceDepth === 0) {
                  pos++;
                  break;
                }
              }
              pos++;
            }
            args.push(expression.slice(argStart + 1, pos - 1));
          } else {
            // Single-character argument
            args.push(expression[pos]);
            pos++;
          }
        }

        // Substitute #1, #2, etc. in body
        expanded = def.body;
        for (let i = 0; i < args.length; i++) {
          expanded = expanded.replaceAll(`#${i + 1}`, args[i]);
        }
        consumedLength = pos - idx;
      }

      // Recursively expand the replacement and the rest of the expression
      const before = expression.slice(0, idx);
      const after = expression.slice(idx + consumedLength);
      return this.expand(before + expanded + after, depth + 1);
    }

    return expression;
  }

  /**
   * Process an expression: parse definitions, strip them, and expand macros.
   */
  process(expression: string): string {
    const withoutDefs = this.parseDefinitions(expression);
    return this.expand(withoutDefs);
  }
}
