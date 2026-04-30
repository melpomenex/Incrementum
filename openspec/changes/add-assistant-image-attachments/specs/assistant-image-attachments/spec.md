## ADDED Requirements

### Requirement: Clipboard Paste Image Attachment
System SHALL allow users to paste images from the system clipboard into the assistant chat input via Cmd+V (macOS) or Ctrl+V (Windows/Linux).
#### Scenario: Paste screenshot into chat
- GIVEN the assistant panel input is focused
- AND the system clipboard contains an image (from screenshot, copy, etc.)
- WHEN the user presses Cmd+V or Ctrl+V
- THEN the image SHALL be attached to the current message as a preview thumbnail
- AND the input SHALL remain focused for typing

#### Scenario: Paste text when images are attached
- GIVEN one or more images are attached to the current message
- AND the system clipboard contains plain text
- WHEN the user presses Cmd+V or Ctrl+V
- THEN the text SHALL be inserted at the cursor position in the textarea (standard behavior)
- AND attached images SHALL NOT be affected

#### Scenario: Paste when input is loading
- GIVEN the assistant is currently processing a request
- WHEN the user presses Cmd+V with an image in clipboard
- THEN the paste SHALL be ignored (no image attached)

### Requirement: Drag-and-Drop Image Attachment
System SHALL allow users to drag image files from the desktop/file manager and drop them onto the assistant chat input area.
#### Scenario: Drop image file
- GIVEN the user drags one or more image files (PNG, JPEG, GIF, WebP) over the input area
- WHEN the files are dropped
- THEN each image SHALL be read and attached as a preview thumbnail
- AND a visual drop zone indicator SHALL appear during the drag-over

#### Scenario: Drop non-image file
- GIVEN the user drags a non-image file over the input area
- WHEN the file is dropped
- THEN the drop SHALL be rejected
- AND no attachment SHALL be created

### Requirement: File Picker Image Attachment
System SHALL provide a button in the input area to open a native file picker for selecting images.
#### Scenario: Select image via file picker
- GIVEN the user clicks the image attachment button (📎 or similar icon)
- WHEN the file picker opens and the user selects one or more image files
- THEN each selected image SHALL be attached as a preview thumbnail

### Requirement: Image Preview in Input
System SHALL display attached image thumbnails in the input area before the message is sent.
#### Scenario: Single image attached
- GIVEN one image is attached
- THEN a thumbnail preview SHALL appear above the textarea
- AND the thumbnail SHALL include a remove (×) button
- AND the thumbnail SHALL show the image filename or size hint

#### Scenario: Multiple images attached
- GIVEN multiple images are attached (up to 4)
- THEN thumbnails SHALL be displayed in a horizontal scrollable strip
- AND each thumbnail SHALL have an individual remove button

#### Scenario: Maximum images reached
- GIVEN 4 images are already attached
- WHEN the user attempts to attach another image
- THEN the attachment SHALL be rejected
- AND a toast message SHALL inform the user of the 4-image limit

### Requirement: Send Multimodal Message
System SHALL construct multimodal messages containing both text and image content when images are attached.
#### Scenario: Send text with images
- GIVEN the user has typed a message and attached one or more images
- WHEN the user presses Enter (or clicks Send)
- THEN the message SHALL be sent as a multimodal content array: `[{type: "text", text: "..."}, {type: "image_url", imageUrl: "data:..."}]`
- AND all attached images SHALL be cleared after sending
- AND the text input SHALL be cleared

#### Scenario: Send images only (no text)
- GIVEN the user has attached one or more images but typed no text
- WHEN the user presses Enter or clicks Send
- THEN the message SHALL be sent with images only (no text part needed, or a minimal placeholder)

### Requirement: Vision Capability Detection
System SHALL detect whether the currently selected model supports vision/image inputs and handle the case where it does not.
#### Scenario: Model supports vision
- GIVEN the selected provider/model supports image inputs (e.g., gpt-4o, claude-3-5-sonnet, llama3.2-vision)
- WHEN the user sends a message with attached images
- THEN the images SHALL be included in the API request
- AND the model SHALL receive and process both text and images

#### Scenario: Model does not support vision
- GIVEN the selected provider/model does NOT support image inputs (e.g., gpt-3.5-turbo, claude-3-haiku without vision, text-only Ollama model)
- WHEN the user sends a message with attached images
- THEN the images SHALL be stripped from the request
- AND the text portion SHALL be sent normally
- AND a warning message SHALL inform the user that images were not sent because the model doesn't support vision

### Requirement: Image Display in Chat History
System SHALL render image thumbnails in the chat message history for user messages that contained image attachments.
#### Scenario: View historical message with images
- GIVEN a previous user message contained image attachments
- WHEN the conversation is loaded from storage
- THEN the images SHALL be displayed as inline thumbnails within the message bubble
- AND the text portion SHALL be displayed alongside/below the images

### Requirement: Image Persistence in Conversation Storage
System SHALL persist image attachments as part of the conversation history in localStorage.
#### Scenario: Store and reload conversation with images
- GIVEN a user sent a message with images
- WHEN the conversation is saved to localStorage and later reloaded
- THEN the images SHALL be preserved as base64 data URLs within the message content
- AND the conversation shall reload with images intact

### Requirement: Image Size Validation
System SHALL validate and constrain image sizes to prevent excessive memory usage.
#### Scenario: Image exceeds size limit
- GIVEN an attached image exceeds 10 MB
- WHEN the image is being processed for attachment
- THEN the image SHALL be rejected
- AND a toast message SHALL inform the user of the size limit

#### Scenario: Large image auto-compressed
- GIVEN an attached image is between 5 MB and 10 MB
- WHEN the image is being processed
- THEN the image SHALL be compressed/resized to fit within 5 MB before attaching
- AND the quality reduction SHALL be acceptable for LLM vision processing (1280px max dimension)
