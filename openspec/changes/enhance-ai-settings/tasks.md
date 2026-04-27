## 1. Extend LLMProviderConfig interface and store

- [x] 1.1 Add `temperature`, `maxTokens`, `systemPrompt` fields to `LLMProviderConfig` interface in `src/stores/llmProvidersStore.ts`
- [x] 1.2 Update `addProvider` to set default values (temperature: 0.7, maxTokens: 4096)
- [x] 1.3 Add `AIControlsSettings` interface to `src/stores/settingsStore.ts` under `ai` key with: `autoGenerate`, `cardsPerExtract`, `qualityThreshold`, `requireApproval`, `autoSummarize`, `summaryLength`, `includeSummaryInCards`, `maxTokensPerRequest`, `contextFromRelatedCards`, `documentSnippetLength`
- [x] 1.4 Add defaults for all new AI control settings in `defaultSettings`

## 2. Per-provider advanced settings UI

- [x] 2.1 Add temperature slider (0.0–2.0, step 0.1) to `LLMProviderSettings.tsx` below model selector
- [x] 2.2 Add max_tokens number input (1–128000) to `LLMProviderSettings.tsx`
- [x] 2.3 Add system_prompt textarea to `LLMProviderSettings.tsx`
- [x] 2.4 Wire form fields to `updateProvider` store action

## 3. AI Settings page sub-sections

- [x] 3.1 Add "Auto-Generation" sub-section to settings page with: enable toggle, cards-per-extract (1–20), quality threshold slider (0.0–1.0), require-approval toggle (sub-controls disabled when auto-gen off)
- [x] 3.2 Add "Summarization" sub-section with: auto-summarize toggle, summary length dropdown (short/medium/long), include-in-card-content toggle (sub-controls disabled when auto-summarize off)
- [x] 3.3 Add "Context Window" sub-section with: max-tokens-per-request input (256–128000), include-related-cards toggle, document-snippet-length input (200–10000)

## 4. Wire settings to AI functionality

- [x] 4.1 Pass per-provider temperature and max_tokens from `LLMProviderConfig` to chat completion requests in `src/api/llm/index.ts`
- [x] 4.2 Pass per-provider system_prompt as system message in chat requests
- [x] 4.3 Wire auto-generation toggle and cards-per-extract to extract creation flow (call `generate_flashcards_from_extract` with configured count)
- [x] 4.4 Wire quality threshold to filter generated flashcards before display/save
- [x] 4.5 Implement manual approval workflow: hold generated cards in pending state, show review UI, approve/reject
- [x] 4.6 Wire auto-summarize toggle and summary length to extract creation flow (call `summarize_content` with word count from length mapping)
- [x] 4.7 Wire "include summary in card content" to prepend summary in flashcard generation prompt
- [x] 4.8 Wire max-tokens-per-request, context-from-related-cards, and document-snippet-length to chat request logic
