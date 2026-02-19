# Design: LaTeX rendering and duration-aware scheduling

## Overview
This change adds rendering support for inline/display LaTeX expressions in markdown-rendered text and introduces a scheduling safety layer for long-form content based on observed study coverage.

## 1. LaTeX Rendering

### Pipeline
- Extend `renderMarkdown()` inline formatting stage to transform math delimiters into rendered HTML.
- Reuse existing `latexToHTML()` utility for rendering output.
- Apply rendering after code block extraction and while protecting inline code placeholders.

### Delimiters
- Display math:
  - `$$...$$`
  - `\\[...\\]`
- Inline math:
  - `$...$`
  - `\\(...\\)`

### Safety/Compatibility
- Do not parse math inside fenced code blocks.
- Do not parse math inside inline code spans.
- Keep escaped markdown behavior as-is.

## 2. Duration-Aware Scheduling

### Problem
Positive ratings on long videos/articles can produce intervals that are too long when the user only covered a small fraction of the content.

### Approach
Add a post-scheduling cap step in `rate_document` and `rate_document_engaging`:
- Compute estimated content duration:
  - `youtube/video`: use duration-like signal from existing document fields (seconds where available).
  - long text/article content: estimate from word count (metadata first, fallback to content tokenization) using reading-speed heuristic.
- Compute coverage ratio = `time_taken / estimated_duration`.
- If content is long and coverage is low, cap interval for positive ratings (`Good`, `Easy`) to shorter windows.

### Cap policy (initial)
- Apply only when:
  - rating is `Good` or `Easy`
  - `time_taken` exists and > 0
  - estimated duration exceeds a long-content threshold
- Cap tiers by coverage ratio:
  - `< 25%`: cap to 1 day
  - `< 50%`: cap to 2 days
  - `< 75%`: cap to 4 days
  - otherwise no cap

### Rationale
This is a conservative safety mechanism for unfinished long-form content while preserving existing scheduler characteristics for normal sessions.

## Risks
- False positives for estimated duration on malformed metadata.
- Over-capping for fast readers.

## Mitigations
- Only cap on long-content threshold + positive ratings + explicit `time_taken`.
- Make cap reason visible in scheduling reason text for transparency.
- Keep heuristics isolated in helper functions for future tuning/settings.
