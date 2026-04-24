"""Sentence-level chunker for streaming TTS.

Splits text into reasonably sized utterance chunks so each can be synthesized
independently and yielded to the caller as it completes.
"""
from __future__ import annotations

import re
from typing import List

# Abbreviations that end in "." but are not sentence terminators.
_ABBREVIATIONS = {
    "mr", "mrs", "ms", "dr", "jr", "sr", "st", "mt", "rev", "hon",
    "etc", "vs", "e.g", "i.e", "a.m", "p.m", "u.s", "u.k",
    "capt", "lt", "col", "gen", "prof", "gov", "sen",
    "no", "vol", "fig", "pp",
}

_ABBREV_PATTERN = re.compile(
    r"\b(" + "|".join(re.escape(a) for a in _ABBREVIATIONS) + r")\.",
    flags=re.IGNORECASE,
)

# Sentence-ending punctuation (optionally followed by closing quotes/brackets) 
# followed by whitespace and (optionally) an opening quote/paren and a capital letter.
_SENT_END = re.compile(r"([.!?]+[\"'}\]]*)([\s ]+)(?=[\"'(\[]?[A-Z0-9])")

DEFAULT_MAX_CHARS = 240
MIN_CHARS = 20


def chunk_text(text: str, max_chars: int = DEFAULT_MAX_CHARS) -> List[str]:
    """Split `text` into sentence-sized chunks suitable for TTS.

    - Protects common English abbreviations so "Mr. Smith went home." stays one sentence.
    - Merges very short fragments with neighbors (so "Yes." doesn't become its own chunk).
    - Further splits overly long sentences at commas / semicolons / conjunctions.
    """
    if not text or not text.strip():
        return []

    normalized = _ABBREV_PATTERN.sub(lambda m: m.group(1) + "<DOT>", text)
    pieces = _SENT_END.split(normalized)

    # _SENT_END.split returns [text, punct, whitespace, text, punct, whitespace, ...]
    sentences: List[str] = []
    buf = ""
    for i, piece in enumerate(pieces):
        if piece is None:
            continue
        if i % 3 == 0:
            buf += piece
        elif i % 3 == 1:
            # Sentence-ending punctuation; attach and flush.
            buf += piece
            cleaned = buf.replace("<DOT>", ".").strip()
            if cleaned:
                sentences.append(cleaned)
            buf = ""
        else:
            # Whitespace between sentences; discard (re-inserted by caller if needed).
            continue

    if buf.strip():
        sentences.append(buf.replace("<DOT>", ".").strip())

    # Further subdivide any over-long sentences.
    expanded: List[str] = []
    for sentence in sentences:
        if len(sentence) <= max_chars:
            expanded.append(sentence)
        else:
            expanded.extend(_split_long(sentence, max_chars))

    # Merge runt fragments into neighbors for better prosody.
    merged: List[str] = []
    for sentence in expanded:
        if merged and len(sentence) < MIN_CHARS and len(merged[-1]) + len(sentence) + 1 <= max_chars:
            merged[-1] = (merged[-1] + " " + sentence).strip()
        else:
            merged.append(sentence)

    return merged


def _split_long(sentence: str, max_chars: int) -> List[str]:
    """Split a long sentence at commas/semicolons/dashes."""
    candidates = re.split(r"([;,—–])\s+", sentence)
    out: List[str] = []
    buf = ""
    for piece in candidates:
        if not piece:
            continue
        if len(buf) + len(piece) + 1 > max_chars and buf:
            out.append(buf.strip())
            buf = piece
        else:
            buf = (buf + " " + piece).strip() if buf else piece

    if buf:
        out.append(buf.strip())

    # If any chunk is still too long (no natural breakpoints), hard-wrap it.
    final: List[str] = []
    for piece in out:
        if len(piece) <= max_chars:
            final.append(piece)
        else:
            words = piece.split()
            cur = ""
            for word in words:
                if len(cur) + len(word) + 1 > max_chars and cur:
                    final.append(cur.strip())
                    cur = word
                else:
                    cur = (cur + " " + word).strip() if cur else word
            if cur:
                final.append(cur.strip())
    return final
