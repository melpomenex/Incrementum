# OCR Features

Text extraction from images using multiple OCR providers.

---

## Overview

Incrementum provides Optical Character Recognition (OCR) capabilities to extract text from images, screenshots, scanned documents, and photos. This enables you to:

- Import text from screenshots and images
- Digitize scanned documents
- Extract content from photos of whiteboards or books
- Convert handwritten notes (with supported providers)
- Extract mathematical equations and formulas

---

## Supported OCR Providers

| Provider | Type | Best For | Internet Required |
|----------|------|----------|-------------------|
| **Tesseract** | Local | General text, on-device privacy | No |
| **GLM-Ocr** | Local | High-quality document OCR, CPU or GPU | No |
| **Google Cloud Vision** | Cloud | High accuracy, multiple languages | Yes |
| **AWS Textract** | Cloud | Documents, tables, forms | Yes |
| **Mistral OCR** | Cloud | Modern AI-based extraction | Yes |
| **Mathpix** | Cloud | Mathematical equations, formulas | Yes |
| **GPT-4o Vision** | Cloud | Complex layouts, handwriting | Yes |
| **Claude Vision** | Cloud | Complex images, reasoning | Yes |

---

## Setup Guide

### GLM-Ocr (Local AI OCR)

GLM-Ocr is a high-quality local OCR model that runs entirely on your device. It provides excellent accuracy for document text extraction without sending data to external servers.

#### Deployment Options

**CPU Mode (Default)**
- Runs on any modern CPU
- No GPU required
- Slower but highly accurate
- Ideal for privacy-sensitive documents

**GPU Mode (vLLM)**
- Requires NVIDIA GPU with CUDA support
- Significantly faster processing
- Recommended for batch OCR workflows
- Deploy via vLLM for optimized inference

#### Setup

1. **Install GLM-Ocr** (one-time setup):
   ```bash
   # CPU deployment
   pip install glm-ocr
   
   # GPU deployment with vLLM
   pip install glm-ocr vllm
   ```

2. **Start the local server**:
   ```bash
   # CPU mode
   glm-ocr-server --port 8000
   
   # GPU mode with vLLM
   glm-ocr-server --port 8000 --backend vllm --device cuda
   ```

3. In Incrementum: **Settings → OCR → GLM-Ocr**
4. Enter server URL (default: `http://localhost:8000`)
5. Test with a sample image

#### Features

- **High Accuracy**: State-of-the-art text recognition
- **Document Optimized**: Excellent for scanned documents and PDFs
- **Multi-language**: Supports 100+ languages automatically
- **Layout Preservation**: Maintains paragraph and line structure
- **Private**: All processing happens locally

---

### Tesseract (Local OCR)

Tesseract runs locally on your device, providing privacy and offline capability.

#### Installation

**Windows**
1. Download installer from [GitHub](https://github.com/UB-Mannheim/tesseract/wiki)
2. Run installer and note the installation path
3. Add to PATH or configure in Incrementum settings

**macOS**
```bash
brew install tesseract
brew install tesseract-lang  # Additional languages
```

**Linux (Ubuntu/Debian)**
```bash
sudo apt install tesseract-ocr
sudo apt install tesseract-ocr-all  # All languages
```

**Linux (Fedora)**
```bash
sudo dnf install tesseract
sudo dnf install tesseract-langpack-*
```

#### Configuration

1. Open **Settings → OCR**
2. Select **Tesseract** as provider
3. Set language(s) for recognition
4. Test with a sample image

---

### Google Cloud Vision

Best for high-accuracy text recognition with support for 50+ languages.

#### Setup

1. Create a [Google Cloud account](https://cloud.google.com/)
2. Enable the [Vision API](https://console.cloud.google.com/apis/library/vision.googleapis.com)
3. Create a [Service Account](https://console.cloud.google.com/iam-admin/serviceaccounts)
4. Download the JSON key file
5. In Incrementum: **Settings → OCR → Google Cloud Vision**
6. Paste the API key or upload the key file

#### Features

- **Document Text Detection**: Optimized for dense text
- **Handwriting Recognition**: Supports handwritten text
- **Language Detection**: Auto-detects text language
- **Text Annotation**: Preserves layout and formatting

---

### AWS Textract

Ideal for structured documents like forms and tables.

#### Setup

1. Create an [AWS account](https://aws.amazon.com/)
2. Navigate to [IAM Console](https://console.aws.amazon.com/iam/)
3. Create a user with `AmazonTextractFullAccess` permission
4. Generate Access Key ID and Secret Access Key
5. In Incrementum: **Settings → OCR → AWS Textract**
6. Enter your credentials

#### Features

- **Forms Extraction**: Key-value pairs from forms
- **Table Extraction**: Structured table data
- **Query Capability**: Ask questions about document content
- **Multi-page Documents**: Process multi-page PDFs

---

### Mistral OCR

Modern AI-based OCR with excellent accuracy.

#### Setup

1. Sign up at [Mistral AI](https://mistral.ai/)
2. Generate an API key from the console
3. In Incrementum: **Settings → OCR → Mistral OCR**
4. Enter your API key

---

### Mathpix

Specialized for mathematical equations and scientific notation.

#### Setup

1. Create account at [Mathpix](https://mathpix.com/)
2. Get API keys from the dashboard
3. In Incrementum: **Settings → OCR → Mathpix**
4. Enter App ID and App Key

#### Features

- **LaTeX Output**: Converts equations to LaTeX
- **MathML Support**: Standard mathematical markup
- **Chemistry Recognition**: Chemical formulas and structures
- **Symbol Recognition**: Greek letters, operators, matrices

**Example**: An image of `E = mc²` becomes:
```latex
E = mc^2
```

---

### GPT-4o Vision (OpenAI)

General-purpose vision model with strong OCR capabilities.

#### Setup

1. Create an [OpenAI account](https://platform.openai.com/)
2. Generate an API key
3. In Incrementum: **Settings → OCR → GPT-4o**
4. Enter your API key

#### Features

- **Complex Layouts**: Understands document structure
- **Handwriting**: Good handwritten text recognition
- **Context Understanding**: Can summarize extracted text
- **Multi-modal**: Can describe images alongside OCR

---

### Claude Vision (Anthropic)

Advanced vision capabilities with reasoning.

#### Setup

1. Create an [Anthropic account](https://console.anthropic.com/)
2. Generate an API key
3. In Incrementum: **Settings → OCR → Claude Vision**
4. Enter your API key

---

## Using OCR in Incrementum

### Screenshot Capture

1. Click **Documents → Import → Screenshot**
2. Select screen area to capture
3. OCR runs automatically on the captured image
4. Review and edit extracted text
5. Save as extract or document

**Keyboard Shortcut**: Set a global hotkey in Settings for quick capture

### Image Import

1. Click **Documents → Import → Image**
2. Select image file (PNG, JPG, WEBP, etc.)
3. Choose OCR provider (or use default)
4. Review extracted text
5. Save to your library

### Document with Images

When importing PDFs or documents containing images:
1. Enable "Extract images for OCR" in import settings
2. Incrementum will process embedded images
3. Extracted text is appended to the document

---

## Language Support

### Tesseract Languages

Tesseract supports 100+ languages. Common codes:

| Code | Language | Code | Language |
|------|----------|------|----------|
| eng | English | chi_sim | Chinese (Simplified) |
| spa | Spanish | chi_tra | Chinese (Traditional) |
| fra | French | jpn | Japanese |
| deu | German | kor | Korean |
| rus | Russian | ara | Arabic |
| por | Portuguese | hin | Hindi |
| ita | Italian | tha | Thai |

**Install additional languages:**
```bash
# Ubuntu/Debian
sudo apt install tesseract-ocr-[lang]

# macOS
brew install tesseract-lang
```

### Cloud Providers

Google Cloud Vision, AWS Textract, and AI providers support most languages automatically without additional setup.

---

## OCR Best Practices

### Image Quality Tips

| Factor | Recommendation |
|--------|---------------|
| Resolution | Minimum 300 DPI for documents |
| Lighting | Even, glare-free illumination |
| Contrast | High contrast between text and background |
| Orientation | Straight-on angle, minimal skew |
| Cropping | Include only relevant text areas |

### Improving Accuracy

1. **Pre-process images**:
   - Crop to text area only
   - Increase contrast if text is faint
   - Straighten rotated images

2. **Choose the right provider**:
   - Clear printed text: Tesseract (free, private)
   - High-quality documents: GLM-Ocr (local AI)
   - Handwriting: GPT-4o Vision or Google Cloud
   - Equations: Mathpix
   - Tables/forms: AWS Textract

3. **Language settings**:
   - Set correct language for Tesseract
   - Use auto-detect for cloud providers

4. **Review and edit**:
   - Always proofread OCR output
   - Common errors: `0` vs `O`, `1` vs `l`, `5` vs `S`

---

## Cost Considerations

### Free Options

| Provider | Cost | Limitations |
|----------|------|-------------|
| Tesseract | Free | Requires local installation, lower accuracy on poor quality images |
| GLM-Ocr | Free | Requires local setup, GPU recommended for best performance |

### Cloud Pricing (as of 2026)

| Provider | Pricing Model | Approximate Cost |
|----------|--------------|------------------|
| Google Cloud Vision | Per 1000 pages | $1.50 - $3.50 |
| AWS Textract | Per page | $0.0015 - $0.06 |
| Mistral OCR | Per token | Varies by image size |
| Mathpix | Per request | $0.02 per image |
| GPT-4o Vision | Per token | ~$0.005 - $0.015 per image |
| Claude Vision | Per token | ~$0.003 - $0.015 per image |

**Tip**: Use Tesseract for routine tasks and cloud providers for difficult images or when accuracy is critical.

---

## Troubleshooting

### Common Issues

**"Tesseract not found"**
- Ensure Tesseract is installed and in PATH
- Or set the path manually in Settings → OCR

**Poor recognition accuracy**
- Check image quality (resolution, contrast)
- Verify correct language is selected
- Try a different OCR provider
- Pre-process image (crop, enhance contrast)

**Cloud API errors**
- Verify API key is correct
- Check internet connection
- Review API quota/limits
- Ensure billing is enabled (cloud providers)

**Slow processing**
- Large images: Resize before OCR
- Try Tesseract for faster local processing
- Disable unnecessary OCR features

**Handwriting not recognized**
- Use GPT-4o Vision or Google Cloud
- Tesseract has limited handwriting support
- Ensure clear, legible writing

---

## Privacy Considerations

| Provider | Data Privacy |
|----------|-------------|
| Tesseract | ✅ Local processing - most private |
| GLM-Ocr | ✅ Local processing - most private |
| Google Cloud Vision | ⚠️ Sent to Google servers |
| AWS Textract | ⚠️ Sent to AWS servers |
| Mistral OCR | ⚠️ Sent to Mistral servers |
| Mathpix | ⚠️ Sent to Mathpix servers |
| GPT-4o | ⚠️ Sent to OpenAI servers |
| Claude | ⚠️ Sent to Anthropic servers |

**Recommendation**: Use Tesseract or GLM-Ocr for sensitive documents (both process locally).

---

## Advanced Features

### Batch OCR

Process multiple images at once:
1. Select multiple images in import dialog
2. OCR runs on all images sequentially
3. Review extracted text for each

### OCR with AI Enhancement

Combine OCR with AI for better results:
1. Extract text with OCR
2. Use AI features to:
   - Correct OCR errors
   - Format and structure text
   - Generate summaries
   - Create flashcards

### Custom OCR Workflows

Create automated OCR pipelines:
1. Screenshot capture → OCR → Auto-create extract
2. Image import → OCR → Generate flashcards
3. Document scan → OCR → Summarize → Create cards

---

## API Reference (for Developers)

### Rust Backend

```rust
// Example: OCR command
#[tauri::command]
async fn ocr_image(
    image_path: String,
    provider: OcrProvider,
    language: Option<String>,
) -> Result<String, String> {
    // Implementation
}
```

### TypeScript Frontend

```typescript
// Example: OCR API call
const extractedText = await invoke('ocr_image', {
  imagePath: '/path/to/image.png',
  provider: 'tesseract',
  language: 'eng'
});
```

---

## Future Enhancements

Planned OCR improvements:

- [x] On-device ML models (no cloud required) ✅ GLM-Ocr
- [ ] Real-time camera OCR
- [ ] Batch processing improvements
- [ ] Custom model training
- [ ] Better handwriting recognition (local)

---

# Audio & Video Features

Incrementum includes powerful audio and video processing capabilities for importing and working with multimedia content.

---

## Audiobook Import

Import audiobooks and automatically transcribe them for study and review.

### Supported Formats

- **MP3** - Common audiobook format
- **M4B** - Apple audiobook format with chapter support
- **AAC** - Advanced Audio Coding
- **FLAC** - Lossless audio compression
- **WAV** - Uncompressed audio

### Import Process

1. Click **Documents → Import → Audiobook**
2. Select your audiobook file(s)
3. Configure import options:
   - **Transcribe**: Enable automatic speech-to-text
   - **Provider**: Choose transcription service (Groq, Local Whisper, etc.)
   - **Language**: Select audio language for better accuracy
   - **Split by chapters**: Create separate documents per chapter
4. Review and save imported content

### Audiobook Features

**Chapter Detection**
- Automatically detects chapters from M4B metadata
- Creates separate documents for each chapter
- Preserves chapter titles and ordering

**Progress Tracking**
- Syncs playback position with reading progress
- Resume listening where you left off
- Visual progress indicator in document list

**Transcription Integration**
- Full text transcription available alongside audio
- Search within transcribed content
- Create extracts from specific sections

---

## Video Transcription

Extract and transcribe audio from video files for studying lectures, tutorials, and presentations.

### Supported Formats

- **MP4** - Standard video format
- **MKV** - Matroska container
- **AVI** - Audio Video Interleave
- **MOV** - QuickTime format
- **WEBM** - Web video format

### Local Video Player

The built-in video player provides a seamless study experience:

**Playback Controls**
- Standard play/pause, seek, volume controls
- Keyboard shortcuts (Space to play/pause, arrow keys to seek)
- Speed control: 0.5x to 2.5x playback speed

**Transcript View**
- Synchronized transcript alongside video
- Click any transcript line to jump to that timestamp
- Search and filter transcript content
- Auto-scroll follows video playback

**Video Clipping**
- Create clips from specific video segments
- Define start and end timestamps
- Extract clips as separate documents
- Preserve clip context and source reference

### Transcription Providers

| Provider | Type | Speed | Quality | Setup |
|----------|------|-------|---------|-------|
| **Groq** | Cloud | Very Fast | Excellent | API key required |
| **Local Whisper** | Local | Medium | Good | Runs on your device |
| **OpenAI Whisper** | Cloud | Fast | Excellent | API key required |

#### Groq Transcription (Recommended)

Fastest option with excellent accuracy:
1. Get API key from [Groq Console](https://console.groq.com/)
2. Enter key in **Settings → Transcription → Groq**
3. Select model: `whisper-large-v3` or `distil-whisper`

#### Local Whisper

Fully private transcription on your device:
1. Download Whisper model (tiny, base, small, medium, large)
2. Runs on CPU (any device) or GPU (NVIDIA with CUDA)
3. No internet required after model download
4. Configure in **Settings → Transcription → Local Whisper**

### Chapter Detection

Automatically detect and extract chapters from video files:

**Supported Sources**
- YouTube videos (with chapter timestamps)
- Local video files with embedded chapters
- Manually defined chapter markers

**Chapter Features**
- Creates document outline from chapters
- Navigate between chapters easily
- Extract individual chapters as separate documents
- Preserve chapter hierarchy

### Using Video Content

**Creating Extracts**
1. Watch video with transcript visible
2. Select text in transcript
3. Click **Extract** to create extract with timestamp
4. Extract includes video reference for context

**Flashcards from Video**
1. Pause at key moment
2. Create extract from transcript
3. Generate flashcards from extract
4. Review includes timestamp link back to video

**Video Clips**
1. Select video segment (start/end timestamps)
2. Click **Create Clip**
3. Clip appears as separate document
4. Original context preserved

---

## YouTube Integration

Import YouTube videos with automatic metadata extraction and transcription.

### Import Methods

**URL Import**
1. Copy YouTube video URL
2. Click **Documents → Import → YouTube URL**
3. Paste URL and confirm
4. Metadata (title, description, chapters) auto-fetched

**Browser Tab**
1. Open **Browser** tab
2. Navigate to YouTube video
3. Click **Import** button when prompted
4. Video added to library with transcription

### YouTube Features

- **Automatic Transcription**: Full transcript extraction
- **Chapter Support**: Recognizes YouTube chapter markers
- **Thumbnail Import**: Saves video thumbnail as cover
- **Description Preservation**: Full video description included
- **Comments (Optional)**: Import top comments for context

---

## Transcription Notifications

Receive toast notifications when transcription completes:

- **Progress Indicator**: Shows transcription status
- **Completion Toast**: "Transcription complete" with Open button
- **Error Handling**: Clear error messages if transcription fails
- **Background Processing**: Continue using app during transcription

---

## Privacy Considerations

| Feature | Local Processing | Cloud Processing |
|---------|-----------------|------------------|
| Audiobook Import | ✅ File stays local | ⚠️ Only if transcribed via cloud |
| Local Video | ✅ Fully local | ⚠️ Only if transcribed via cloud |
| YouTube Videos | N/A | ⚠️ Fetched from YouTube servers |
| Local Whisper | ✅ Fully private | N/A |
| Groq Transcription | N/A | ⚠️ Sent to Groq servers |

**Recommendation**: Use Local Whisper for maximum privacy with audio/video content.

---

*Last updated: February 2026*
