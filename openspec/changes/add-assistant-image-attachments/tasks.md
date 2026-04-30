# Tasks: Assistant Chat Image Attachments

## 1. Foundation Utilities
- [x] 1.1 Create `src/utils/imageCompression.ts` with `compressImage()` function (canvas-based, max 1280px, max 5MB output, JPEG conversion)
- [x] 1.2 Create `src/utils/visionCapability.ts` with `supportsVision(provider, model)` function (heuristic detection per provider)
- [x] 1.3 Add `AttachedImage` interface and `MAX_ATTACHED_IMAGES` (4) / `MAX_IMAGE_BYTES` (10MB) constants

## 2. AssistantPanel State & Types
- [x] 2.1 Extend `Message` interface with optional `images?: AttachedImage[]` field
- [x] 2.2 Add `attachedImages` state (`AttachedImage[]`) and `isDragOver` state to `AssistantPanel`
- [x] 2.3 Add helper functions: `attachImage(file: File)`, `removeImage(id: string)`, `clearAttachedImages()`

## 3. Paste Handler
- [x] 3.1 Add `paste` event listener on the input container `<div>` (not textarea)
- [x] 3.2 In handler: check `clipboardData.items` for image types, call `attachImage()` if found, let text paste propagate normally
- [x] 3.3 Guard: ignore paste when `isLoading` is true

## 4. Drag-and-Drop Handler
- [x] 4.1 Add `dragover`, `dragleave`, `drop` event listeners on input container
- [x] 4.2 On `dragover`: set `isDragOver` true, prevent default, check for image MIME types
- [x] 4.3 On `dragleave`: set `isDragOver` false
- [x] 4.4 On `drop`: extract `DataTransfer.files`, filter for image MIME types, call `attachImage()` for each
- [x] 4.5 Visual: dashed border / highlight on `isDragOver`

## 5. File Picker Button
- [x] 5.1 Add hidden `<input type="file" accept="image/*" multiple>` element
- [x] 5.2 Add 📎 (ImagePlus or Paperclip icon) button next to textarea that triggers the hidden input
- [x] 5.3 On file selection change: filter for images, call `attachImage()` for each

## 6. Image Preview Strip
- [x] 6.1 Render preview strip above textarea when `attachedImages.length > 0`
- [x] 6.2 Each thumbnail: image preview (64×64 or aspect-fit), filename/size label, × remove button
- [x] 6.3 Horizontal scroll when more thumbnails than fit
- [x] 6.4 On remove: call `removeImage(id)`, shift focus back to textarea

## 7. `attachImage()` Implementation
- [x] 7.1 Validate file type (image/*)
- [x] 7.2 Validate file size (reject > 10MB with toast)
- [x] 7.3 Validate count (reject if already at 4 images with toast)
- [x] 7.4 Read file as data URL via `FileReader`
- [x] 7.5 If image > 1MB, run through `compressImage()`
- [x] 7.6 Create `AttachedImage` object with id, dataUrl, fileName, fileSize
- [x] 7.7 Add to `attachedImages` state

## 8. Multimodal Message Construction
- [x] 8.1 Modify `handleSendMessage()`: if `attachedImages.length > 0`, construct `LLMMessage` with `content: Parts[]` instead of plain string
- [x] 8.2 Parts array: `{type: "text", text: input}` + `{type: "image_url", imageUrl: image.dataUrl}` for each image
- [x] 8.3 Store images in the user `Message` object for history: `message.images = [...attachedImages]`
- [x] 8.4 Call `clearAttachedImages()` after successful send

## 9. Vision Capability Check
- [x] 9.1 Before sending, call `supportsVision(provider, model)` with the effective provider and model
- [x] 9.2 If vision supported: send normally with images
- [x] 9.3 If vision NOT supported: strip images from the API message, send text only, add a system warning message to chat ("⚠️ [model] doesn't support images. Sending text only."), keep images attached for retry

## 10. Chat History Image Display
- [x] 10.1 In message rendering, check `message.images`
- [x] 10.2 If images exist on a user message: render inline thumbnail gallery above the text
- [x] 10.3 Clickable thumbnails that could open a lightbox (stretch: or just show at reasonable size)
- [x] 10.4 Ensure images survive localStorage serialization/deserialization (data URLs are strings)

## 11. Conversation Storage Compatibility
- [x] 11.1 Update `isValidMessage()` validation to accept new `images` field
- [x] 11.2 Ensure `readStoredConversations()` / `writeStoredConversations()` handle messages with images (they should — images are stored as string data URLs)
- [x] 11.3 Test: reload page with conversation containing image messages

## 12. Polish & Edge Cases
- [x] 12.1 Send button should be enabled when images are attached even if text is empty (images-only message)
- [x] 12.2 Placeholder text should update when images are attached: "Ask about the attached image(s)..."
- [x] 12.3 On conversation context switch, clear `attachedImages`
- [x] 12.4 Quick actions row: no change needed (image attachment doesn't affect /tools, /help, /clear)
