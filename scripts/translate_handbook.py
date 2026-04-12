#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path


SOURCE = Path("docs/USER_HANDBOOK.md")
OUTPUTS = {
    "zh": ("zh-CN", Path("docs/USER_HANDBOOK.zh.md")),
    "es": ("es", Path("docs/USER_HANDBOOK.es.md")),
    "de": ("de", Path("docs/USER_HANDBOOK.de.md")),
    "fr": ("fr", Path("docs/USER_HANDBOOK.fr.md")),
    "ja": ("ja", Path("docs/USER_HANDBOOK.ja.md")),
}
MAX_CHARS = 3500
SLEEP_SECONDS = 0.2
TABLE_OF_CONTENTS_HEADINGS = (
    "Table of Contents",
    "目录",
    "Tabla de contenidos",
    "Inhaltsverzeichnis",
    "Table des matieres",
    "Table des matières",
    "目次",
)


def translate_chunk(text: str, target: str) -> str:
    if not text:
        return text

    query = urllib.parse.urlencode(
        {
            "client": "gtx",
            "sl": "en",
            "tl": target,
            "dt": "t",
            "q": text,
        }
    )
    url = f"https://translate.googleapis.com/translate_a/single?{query}"
    with urllib.request.urlopen(url, timeout=120) as response:
        data = json.load(response)
    translated = "".join(part[0] for part in data[0] if part and part[0])
    time.sleep(SLEEP_SECONDS)
    return translated


def split_text(text: str, max_chars: int = MAX_CHARS) -> list[str]:
    if len(text) <= max_chars:
        return [text]

    pieces: list[str] = []
    current = ""

    for block in text.split("\n\n"):
        candidate = block if not current else f"{current}\n\n{block}"
        if current and len(candidate) > max_chars:
            pieces.append(current)
            current = block
        else:
            current = candidate

    if current:
        pieces.append(current)

    output: list[str] = []
    for piece in pieces:
        if len(piece) <= max_chars:
            output.append(piece)
            continue

        lines = piece.splitlines(True)
        current_line_chunk = ""
        for line in lines:
            candidate = current_line_chunk + line
            if current_line_chunk and len(candidate) > max_chars:
                output.append(current_line_chunk)
                current_line_chunk = line
            else:
                current_line_chunk = candidate
        if current_line_chunk:
            output.append(current_line_chunk)

    return output


def split_sections(text: str) -> list[str]:
    sections: list[str] = []
    current = []

    for line in text.splitlines(True):
        if line.startswith("## ") and current:
            sections.append("".join(current))
            current = [line]
        else:
            current.append(line)

    if current:
        sections.append("".join(current))

    return sections


def normalize_generated_markdown(markdown: str) -> str:
    return (
        markdown.replace("\r\n", "\n")
        .replace("---##", "---\n\n##")
        .replace("---###", "---\n\n###")
    )


def strip_embedded_table_of_contents(markdown: str) -> str:
    lines = markdown.splitlines()
    toc_start = None

    for index, line in enumerate(lines):
        if line.strip().startswith("## "):
            heading = line.strip()[3:].strip()
            if heading in TABLE_OF_CONTENTS_HEADINGS:
                toc_start = index
                break

    if toc_start is None:
        return markdown.strip() + "\n"

    next_heading = None
    for index in range(toc_start + 1, len(lines)):
        if lines[index].startswith("## "):
            next_heading = index
            break

    if next_heading is None:
        return "\n".join(lines[:toc_start]).strip() + "\n"

    kept = lines[:toc_start] + lines[next_heading:]
    return "\n".join(kept).strip() + "\n"


def translate_document(text: str, target: str) -> str:
    translated_sections: list[str] = []
    for section in split_sections(text):
        translated_chunks = [translate_chunk(chunk, target) for chunk in split_text(section)]
        translated_sections.append("".join(translated_chunks))
    translated = "".join(translated_sections)
    translated = normalize_generated_markdown(translated)
    translated = strip_embedded_table_of_contents(translated)
    return translated


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate localized handbook markdown files.")
    parser.add_argument(
        "locales",
        nargs="*",
        choices=sorted(OUTPUTS.keys()),
        default=sorted(OUTPUTS.keys()),
        help="Locales to generate.",
    )
    args = parser.parse_args()

    source_text = SOURCE.read_text(encoding="utf-8")

    for locale in args.locales:
        target, destination = OUTPUTS[locale]
        print(f"Translating handbook for {locale} -> {destination}")
        translated = translate_document(source_text, target)
        destination.write_text(translated, encoding="utf-8")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
