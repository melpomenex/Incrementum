export interface DictionaryResult {
  word: string;
  definitions: string[];
  synonyms: string[];
}

async function fetchDefinitions(word: string): Promise<string[]> {
  const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
  if (!response.ok) return [];

  const data = await response.json();
  const definitions: string[] = [];
  const entries = Array.isArray(data) ? data : [];
  for (const entry of entries) {
    const meanings = Array.isArray(entry?.meanings) ? entry.meanings : [];
    for (const meaning of meanings) {
      const defs = Array.isArray(meaning?.definitions) ? meaning.definitions : [];
      for (const def of defs) {
        if (typeof def?.definition === "string" && def.definition.trim()) {
          definitions.push(def.definition.trim());
        }
      }
    }
  }

  return Array.from(new Set(definitions)).slice(0, 6);
}

async function fetchSynonyms(word: string): Promise<string[]> {
  const response = await fetch(`https://api.datamuse.com/words?ml=${encodeURIComponent(word)}&max=10`);
  if (!response.ok) return [];

  const data = await response.json();
  const synonyms = (Array.isArray(data) ? data : [])
    .map((entry: any) => (typeof entry?.word === "string" ? entry.word.trim() : ""))
    .filter(Boolean);
  return Array.from(new Set(synonyms)).slice(0, 8);
}

export async function lookupDictionary(word: string): Promise<DictionaryResult> {
  const normalized = word.trim().toLowerCase();
  if (!normalized) {
    throw new Error("Word is required");
  }

  const [definitions, synonyms] = await Promise.all([
    fetchDefinitions(normalized),
    fetchSynonyms(normalized),
  ]);

  return {
    word: normalized,
    definitions,
    synonyms,
  };
}
