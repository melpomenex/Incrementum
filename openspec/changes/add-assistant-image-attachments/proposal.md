# Proposal: Assistant Chat Image Attachments

## Intent

Users want to paste screenshots (or attach image files) directly into the assistant chat input and ask questions about them. This is the primary workflow for interacting with visual content — slides, diagrams, screenshots, UI mockups, scanned documents, etc. The system should seamlessly route images alongside text to whatever LLM provider is active (OpenAI, Anthropic, OpenRouter, Ollama/local), stripping images only when the provider/model doesn't support vision.

## Scope

**In scope:**
- Paste images from clipboard (Cmd+V / Ctrl+V) into the assistant chat input
- Drag-and-drop image files into the input area
- File picker button for image selection
- Image preview thumbnails in the input area before sending
- Remove individual attached images before sending
- Multimodal message construction: user message as `content: Parts[{text, image_url}, ...]`
- Graceful degradation: if the selected provider/model doesn't support vision, strip images and warn the user
- Image display in chat history (render thumbnails for past image messages)
- Persist image attachments in conversation storage (base64 data URLs in localStorage)

**Out of scope:**
- Image editing/cropping before sending (future enhancement)
- PDF page capture → attach workflow (separate from OCR flow)
- Sending images to non-vision models with OCR pre-processing (future)
- Streaming image generation responses (DALL-E, etc.)
- Mobile-specific image picker (PWA camera roll access)

## Approach

The Rust backend already supports multimodal messages:
- `LLMMessageContent::Parts(Vec<LLMMessageContentPart>)` with `Text` and `ImageUrl` variants
- `map_openai_messages()` / `map_anthropic_messages()` properly serialize to OpenAI and Anthropic API formats
- Anthropic's `parse_data_url()` handles base64 data URLs

The TypeScript frontend has the matching types (`LLMImageContentPart`, `LLMMessageContentPart`) but `AssistantPanel.tsx` currently only sends `content: string` (plain text) messages.

The implementation focuses on:
1. **UI layer** in `AssistantPanel.tsx`: clipboard paste handler, drag-drop handler, file picker button, image preview strip
2. **Message construction**: convert `input text + attached images` → `LLMMessage` with `content: Parts[]`
3. **Backend pass-through**: already works — the Rust side handles `Parts` correctly for all providers
4. **Vision capability detection**: new utility to check if a model supports vision, with graceful fallback
5. **Chat history display**: render image thumbnails in historical user messages
