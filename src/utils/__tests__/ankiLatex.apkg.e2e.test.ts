import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeAnkiFlashcardFields, renderAnkiHtmlWithLatex } from "../ankiLatex";

const EXTRACTED_FIELDS_PATH = path.resolve(process.cwd(), ".tmp/differential_equations_fields.json");
const HAS_EXTRACTED_FIELDS = existsSync(EXTRACTED_FIELDS_PATH);
const LATEX_HINT = /\\[a-zA-Z]+|\[latex\]|\[\$\$\]|\[\$\]|\$\$|\\\(|\\\[|\^\{|_\{/;

interface ExtractedField {
  note_id: number;
  field_name: string;
  value: string;
}

describe("anki latex real-deck e2e", () => {
  it.skipIf(!HAS_EXTRACTED_FIELDS)("renders latex-bearing fields extracted from Differential_Equations.apkg", () => {
    const raw = readFileSync(EXTRACTED_FIELDS_PATH, "utf-8");
    const fields = JSON.parse(raw) as ExtractedField[];

    expect(fields.length).toBeGreaterThan(0);

    let latexFieldCount = 0;
    let renderedMathCount = 0;
    let fallbackCount = 0;

    for (const field of fields) {
      if (!field.value || !LATEX_HINT.test(field.value)) continue;
      latexFieldCount += 1;

      const normalized = normalizeAnkiFlashcardFields({ question: field.value });
      expect(normalized.question?.html.length).toBeGreaterThan(0);

      const html = renderAnkiHtmlWithLatex(field.value);
      expect(html).not.toMatch(/\[latex\]|\[\/latex\]|\[\$\]|\[\/\$\]|\[\$\$\]|\[\/\$\$\]/i);

      if (html.includes("math-expression")) {
        renderedMathCount += 1;
      }
      if (html.includes('data-latex-fallback="true"')) {
        fallbackCount += 1;
      }
    }

    expect(latexFieldCount).toBeGreaterThan(0);
    expect(renderedMathCount).toBeGreaterThan(0);
    expect(fallbackCount).toBeLessThan(latexFieldCount);
  });
});
