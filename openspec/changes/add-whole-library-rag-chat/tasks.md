# Implementation Tasks

## 1. Backend: storage
- [ ] 1.1 Migration `051_add_document_chunk_embeddings.sql` + add to `MIGRATIONS` array
- [ ] 1.2 Repository methods: `upsert_chunk_embedding`, `get_chunk_embeddings(document_ids?)`, `get_stale_chunk_ids`, `count_chunks`, `delete_document_chunk_embeddings`

## 2. Backend: shared provider builder
- [ ] 2.1 Lift `get_provider`/`provider_name`/`model_name` into shared module
- [ ] 2.2 Re-export from semantic_graph so existing callers still work

## 3. Backend: RAG commands (`commands/rag.rs`)
- [ ] 3.1 `rag_index_document(document_id, config)` — chunk + embed + upsert
- [ ] 3.2 `rag_index_collection(config)` — iterate active collection
- [ ] 3.3 `rag_index_status()` — counts + provider/model
- [ ] 3.4 `rag_search(query, document_ids?, limit, config)` — embed query + top-k cosine
- [ ] 3.5 `rag_chat(query, document_ids?, history, config, llm)` — retrieve + grounded LLM call
- [ ] 3.6 Register all in `lib.rs`

## 4. Settings (both layers)
- [ ] 4.1 `EmbeddingSettings` type + defaults + Zod schema
- [ ] 4.2 Merge into persisted-settings hydration

## 5. Frontend
- [ ] 5.1 `src/api/rag.ts` wrappers
- [ ] 5.2 `src/stores/ragStore.ts` (status, results, loading)
- [ ] 5.3 `AssistantPanel.tsx` scope selector ("This document" / "Whole library") + citation rendering
- [ ] 5.4 `EmbeddingSettings.tsx` settings section

## 6. Spec + validation
- [ ] 6.1 `specs/whole-library-rag-chat/spec.md`
- [ ] 6.2 cargo build + test, tsc, vitest
