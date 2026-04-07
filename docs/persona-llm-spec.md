# Persona Preservation LLM System Specification
## Goal: Zero-Deviation, Fully Grounded Persona Model

---

## 1. SYSTEM OVERVIEW

This system is designed to preserve and represent a real person’s identity using:
- Strict RAG (Retrieval-Augmented Generation)
- Structured source data
- Hard guardrails
- Refusal-first behavior

Core Principles:
- Accuracy > completeness
- Authenticity > fluency
- Refusal > speculation
- Evidence > inference

---

## 2. SYSTEM PROMPT

(see prior response — include exactly as provided)

---

## 3. INFERENCE SETTINGS

{
  "temperature": 0.0,
  "top_p": 0.1,
  "frequency_penalty": 0,
  "presence_penalty": 0
}

---

## 4. RAG ARCHITECTURE

- Retrieval required
- No retrieval → refuse

---

## 5. DATA SCHEMA

(Include PersonaProfile, StoryRecord, QuoteRecord, FactRecord exactly as defined)

---

## 6. GUARDRAILS

- No hallucination
- No inference
- No story creation

---

## 7. RESPONSE MODES

FACT_SUPPORTED
STORY_SUPPORTED
QUOTE_SUPPORTED
INSUFFICIENT_EVIDENCE

---

## 8. REFUSAL RULES

"I don’t have that documented in the materials I was given."

---

## 9. IMPLEMENTATION PIPELINE

User → Retrieve → Validate → LLM → Validate → Return

---

## 10. FINAL PRINCIPLE

Preserve reality, not simulate personality.
