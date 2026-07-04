# Strict Persona System Implementation

## Overview
This implementation creates a strict, grounded persona system that prevents LLM hallucinations and ensures the persona only responds with verified information from documents and known facts.

## Key Changes

### 1. Enhanced System Prompts (PersonaService.ts)
- **Knowledge Boundaries**: System prompt now explicitly lists all verified facts with confidence scores
- **Strict Rules**: Absolute enforcement rules that the LLM must follow
- **Uncertainty Phrases**: Pre-defined phrases for when information is unknown:
  - "Hmm, I seem to have forgotten about that."
  - "I don't recall that, I'm afraid."
  - "That doesn't ring a bell, sorry."
  - "My memory fails me on that one."
  - "I wish I could remember, but I don't."

### 2. PromptBuilder Enforcement Rules (PromptBuilder.ts)
- **Document-Only Policy**: LLM can only reference information verbatim from retrieved documents
- **Hallucination Prevention**: Zero tolerance for fabricated details
- **Response Validation Checklist**: LLM is instructed to validate its own response before output
- **Speculative Language Ban**: Prevents "I think", "I believe", "perhaps", "maybe", "probably", "likely"

### 3. Lowered Temperature Settings
- **Temperature**: Reduced from 0.7 to 0.3 for more deterministic, fact-based responses
- **Repeat Penalty**: Increased to 1.2 to encourage conciseness and reduce filler content

### 4. Hallucination Detection (LLMGateway.ts)
New violation types detected:
- **Speculative Language**: "I think", "I believe", "perhaps", "maybe", etc.
- **Invention Patterns**: Detects fabricated names, dates, places, relationships
- **Unsupported Claims**: Validates that claims have document support
- **Uncertainty Bypass**: Detects variations that avoid required uncertainty phrases

### 5. Context-Aware Validation (ChatService.ts)
- Passes document content to validation for fact-checking
- Compares LLM output against known facts and retrieved documents
- Automatically replaces hallucinated responses with uncertainty phrases
- Logs all violations for monitoring

## How It Works

1. **Document Ingestion**: Documents are processed and facts are extracted with confidence scores (>= 0.8 for verified, 0.5-0.8 for partial)

2. **Prompt Construction**: The system prompt includes:
   - Exact count of verified facts
   - List of all verified facts
   - Strict rules about knowledge boundaries
   - Uncertainty phrases for unknown topics

3. **LLM Generation**: Runs with low temperature (0.3) for consistent, factual responses

4. **Post-Generation Validation**: The response is checked for:
   - Hallucination patterns
   - Unsupported claims
   - Speculative language
   - PII leaks
   - Prompt injection attempts

5. **Fallback Handling**:
   - High-severity violations → Neutral fallback message
   - Hallucinations detected → Random uncertainty phrase
   - Medium violations → Filtered content
   - Valid responses → Original content

## Response Behaviors

### When Information IS Known
The persona responds naturally in their authentic voice, using the verified facts from the knowledge base.

### When Information is NOT Known
The persona responds with one of the uncertainty phrases:
- "Hmm, I seem to have forgotten about that."
- "I don't recall that, I'm afraid."
- "That doesn't ring a bell, sorry."
- "My memory fails me on that one."
- "I wish I could remember, but I don't."

The persona will NOT:
- Invent names, dates, places, or relationships
- Make assumptions or "fill in gaps"
- Say "I think" or "I believe" about unverified topics
- Suggest where else information might be found
- Express curiosity about unknown topics

## Testing Recommendations

Test the system with queries that:
1. Ask about verified facts (should respond accurately)
2. Ask about unverified topics (should use uncertainty phrase)
3. Try to elicit speculation (should be rejected)
4. Ask about family members not in records (should not invent them)
5. Request personal details not in documents (should admit forgetting)

## Files Modified

- `/Chat/src/services/persona/PersonaService.ts` - Strict system prompt generation
- `/Chat/src/services/chat/PromptBuilder.ts` - Enforcement rules and lower temperature
- `/Chat/src/services/llm/LLMGateway.ts` - Hallucination detection
- `/Chat/src/services/chat/ChatService.ts` - Context-aware validation
- `/Chat/src/types/llm.ts` - New violation types

## Next Steps

1. Test the system with real queries
2. Monitor the logs for violation patterns
3. Adjust confidence thresholds if needed
4. Add more uncertainty phrases if desired
5. Consider implementing a feedback loop for false positives
