# Design: Assistant Chat Image Attachments

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│  AssistantPanel.tsx                                 │
│  ┌───────────────────────────────────────────────┐  │
│  │  Input Area                                   │  │
│  │  ┌─────────────────────────────────────────┐  │  │
│  │  │  Image Preview Strip                    │  │  │
│  │  │  [thumb1 ×] [thumb2 ×] [thumb3 ×]       │  │  │
│  │  └─────────────────────────────────────────┘  │  │
│  │  ┌──────────────────────────┐ ┌──────────┐   │  │
│  │  │  Textarea                │ │ 📎 Send  │   │  │
│  │  │  "What's on this slide?" │ │          │   │  │
│  │  └──────────────────────────┘ └──────────┘   │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
         │
         │ handleSendMessage()
         ▼
┌─────────────────────────────────────────┐
│  Message Construction                   │
│  text + images → LLMMessage {           │
│    role: "user",                        │
│    content: Parts([                     │
│      { type: "text", text: "..." },     │
│      { type: "image_url", imageUrl:     │
│        "data:image/png;base64,..." }    │
│    ])                                   │
│  }                                      │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  chatWithContext() (existing API)       │
│  → Tauri invoke("llm_chat_with_context")│
│  → Rust: map_openai_messages() /        │
│         map_anthropic_messages()         │
│  → Provider API call                    │
└─────────────────────────────────────────┘
```

## Key Design Decisions

### 1. Data URLs for Image Transport
**Decision:** Store and transmit images as base64 data URLs (`data:image/png;base64,...`).
**Why:**
- Already supported by the Rust backend (`parse_data_url()` for Anthropic, `image_url.url` pass-through for OpenAI/OpenRouter/Ollama)
- No need for file system temporary storage or Tauri asset protocol
- Works identically in PWA (web) and desktop (Tauri) contexts
- localStorage persistence is straightforward

**Trade-off:** Base64 is ~33% larger than binary. For 4 images × ~5 MB each = ~27 MB of base64 in a single message. This is acceptable for the assistant panel (short conversations, user-initiated) but we'll cap at 4 images and 5 MB per image to keep things reasonable.

### 2. Clipboard Paste via `paste` Event
**Decision:** Listen to the `paste` event on the input container (not the textarea directly).
**Why:**
- The `paste` event on `<textarea>` fires for text but NOT for images in many browsers
- By listening on the parent container `<div>`, we can intercept `clipboardData.items` for image MIME types
- Text paste still works normally because we only intercept when `type.startsWith('image/')`

**Implementation:**
```tsx
useEffect(() => {
  const container = inputContainerRef.current;
  if (!container) return;
  
  const handlePaste = (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) attachImage(file);
        return;
      }
    }
    // Let text paste propagate normally
  };
  
  container.addEventListener('paste', handlePaste);
  return () => container.removeEventListener('paste', handlePaste);
}, []);
```

### 3. Vision Capability Detection
**Decision:** Heuristic-based detection using model ID patterns, not API introspection.
**Why:**
- No reliable API endpoint to query "does this model support vision?" across all providers
- Model naming conventions are fairly consistent:
  - OpenAI: `gpt-4o`, `gpt-4-turbo`, `gpt-4o-mini` → vision ✅; `gpt-3.5-turbo`, `gpt-4` (old) → vision ❌
  - Anthropic: All current models (claude-3-5-sonnet, claude-3-opus, etc.) → vision ✅
  - OpenRouter: Model ID prefix determines capability
  - Ollama: Model ID suffix (`-vision`, `-vl`) or known vision models

**Implementation:** A `supportsVision(provider, model)` utility function:

```typescript
export function supportsVision(provider: string, model: string): boolean {
  // Anthropic: all current models support vision
  if (provider === 'anthropic') return true;
  
  // OpenAI vision models
  if (provider === 'openai') {
    const visionModels = ['gpt-4o', 'gpt-4-turbo', 'gpt-4o-mini', 'o1', 'o3', 'o4-mini'];
    return visionModels.some(m => model.includes(m));
  }
  
  // OpenRouter: check known vision prefixes
  if (provider === 'openrouter') {
    const visionPrefixes = ['openai/gpt-4o', 'anthropic/claude', 'google/gemini', 'meta-llama/llama-3.2-vision'];
    return visionPrefixes.some(p => model.startsWith(p)) || model.includes(':vision');
  }
  
  // Ollama: vision models typically have -vision, -vl suffix
  if (provider === 'ollama') {
    return model.includes('-vision') || model.includes('-vl') || model.includes('llava');
  }
  
  return false;
}
```

### 4. Message Type Extension
**Decision:** Extend the `Message` interface to support multimodal content.
**Why:**
- Currently `Message.content` is `string` — always plain text
- Need to store both text and image data URLs for display in chat history
- The `LLMMessage` type already supports `Parts[]` — we align the internal `Message` with it

**Change:**
```typescript
interface AttachedImage {
  id: string;
  dataUrl: string;        // data:image/png;base64,...
  fileName?: string;
  fileSize?: number;      // bytes
  width?: number;
  height?: number;
}

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;                    // text content (always present for display)
  timestamp: number;
  images?: AttachedImage[];           // NEW: attached images for user messages
  toolCalls?: ToolCall[];
}
```

The `content` field stays as a string for display purposes. When constructing the `LLMMessage` for the API call, we combine `content` + `images` into the `Parts[]` format.

### 5. Image Compression
**Decision:** Client-side canvas-based compression for images > 1 MB.
**Why:**
- Screenshot images from Retina displays can be 5-15 MB
- LLM vision APIs don't need >1280px resolution
- Compressing client-side keeps the backend simple

**Implementation:**
```typescript
async function compressImage(dataUrl: string, maxDimension = 1280, maxBytes = 5 * 1024 * 1024): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        const scale = maxDimension / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      
      // Try JPEG at 0.8 quality first (much smaller than PNG)
      const jpeg = canvas.toDataURL('image/jpeg', 0.8);
      if (jpeg.length <= maxBytes) return resolve(jpeg);
      
      // Fall back to lower quality
      const jpegLow = canvas.toDataURL('image/jpeg', 0.5);
      return resolve(jpegLow);
    };
    img.src = dataUrl;
  });
}
```

### 6. Drag-and-Drop Visual Feedback
**Decision:** Show a dashed border overlay on the input container during drag-over.
**Why:**
- Standard UX pattern for drop zones
- Users need clear feedback that the area accepts images

## File Changes

### New Files
- `src/utils/imageCompression.ts` — Image compression utility
- `src/utils/visionCapability.ts` — Vision detection utility

### Modified Files
- `src/components/assistant/AssistantPanel.tsx` — Main changes:
  - Add `attachedImages` state (`AttachedImage[]`)
  - Add paste event listener on input container
  - Add drag-and-drop handlers on input container
  - Add file picker button with hidden `<input type="file">`
  - Add image preview strip above textarea
  - Modify `handleSendMessage()` to construct multimodal `LLMMessage`
  - Modify message rendering to show image thumbnails
  - Add vision check with warning on unsupported models
  - Store images in `Message.images` for persistence
- `src/api/llm/index.ts` — No changes needed (already supports `Parts[]`)
- `src-tauri/src/commands/llm.rs` — No changes needed (already handles multimodal messages)

## UX Flow

### Primary Flow: Paste Screenshot
1. User takes screenshot (Cmd+Shift+4 on macOS)
2. User focuses assistant input (or it's already focused)
3. User presses Cmd+V
4. Image appears as thumbnail above textarea
5. User types question: "What's the formula on this slide?"
6. User presses Enter
7. Message appears in chat with thumbnail
8. LLM receives multimodal message and responds

### Edge Flow: Non-Vision Model
1. User pastes image + types question
2. User presses Enter
3. System detects current model doesn't support vision
4. Warning appears: "⚠️ [model-name] doesn't support images. Sending text only."
5. Text-only message is sent to LLM
6. Images remain attached (not cleared) so user can switch provider and retry
