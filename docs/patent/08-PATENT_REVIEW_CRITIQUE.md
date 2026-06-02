# Heard Again — Patentability Critique and Attorney Handoff Corrections

> **Prepared:** June 2, 2026
> **Purpose:** candid pre-counsel screening of the current patent packet against the repository
> **Important:** this is an engineering and issue-spotting review, not a legal opinion, freedom-to-operate opinion, patentability opinion, or substitute for advice from a registered patent practitioner. The prior-art links below are search leads for counsel, not an exhaustive search.

---

## 1. Bottom-line recommendation

Do **not** send the existing packet to counsel as though it is 80% ready for filing. It contains useful invention notes, but it currently mixes:

1. implemented behavior;
2. partially wired behavior;
3. desired future safeguards;
4. ordinary implementation choices; and
5. unsupported novelty conclusions.

That mixture creates avoidable credibility and written-description problems. A provisional application only helps later claims to the extent its disclosure adequately supports them. The USPTO explains that a provisional must contain a written description compliant with 35 U.S.C. § 112(a), and warns that a pre-filing disclosure protected by the U.S. grace period may still prevent foreign patenting. See [USPTO: Provisional Application for Patent](https://www.uspto.gov/patents-getting-started/patent-basics/types-patent-applications/provisional-application-patent). The USPTO's written-description guidance also frames the inquiry as whether the disclosure conveys that the inventor possessed the later-claimed subject matter as of filing. See [MPEP § 2163](https://www.uspto.gov/web/offices/pac/mpep/s2163.html).

### Recommended spend decision

| Area | Recommendation | Candid assessment |
|---|---|---|
| Consent-gated voice cloning | **Pay for a focused prior-art search and claim-strategy consultation only after correcting the implementation record.** | This is the best candidate, but the current packet overstates both the implementation and the novelty. The potentially useful claim center is a narrowly specified, end-to-end, policy-driven enforcement mechanism for posthumous or delegated synthetic-voice use—not the broad idea of recording consent, signing a token, encrypting a file, or revoking access. |
| Evidence-gated persona chat | **Do not lead with the present broad claims. Ask counsel whether a much narrower improvement is worth preserving.** | Retrieval, confidence thresholds, refusal behavior, persona modeling, and document-grounded Q&A all have substantial prior art. The implemented pipeline may still be valuable product know-how, but the current packet does not identify a clearly differentiated technical improvement. |
| Tile-and-stitch graph export | **Treat as low priority unless counsel finds a narrow export-specific distinction after a search.** | The implementation is real and useful, but tiled rendering, browser/headless capture, and compositing are established techniques. Family-tree use is likely a field-of-use limitation rather than the inventive concept. |
| Hybrid/on-premises architecture | **Do not spend filing budget on the current claims.** | The described cloud UI, local GPU service, tunnel, heartbeat, shared schema, container orchestration, and storage abstraction are conventional architecture choices. Combining them for genealogy is unlikely to create a strong patent position without a specific technical mechanism and measured improvement. |
| “Whole architecture” | **Do not attempt to patent the platform as a whole.** | A patent application may describe the whole platform as context, but claims should target one or more concrete technical improvements. A broad platform claim risks § 101 eligibility objections and §§ 102/103 novelty or obviousness objections while being expensive to prosecute and difficult to enforce. |

### Best practical path

1. Preserve evidence of conception and implementation dates.
2. Determine every public disclosure, public use, offer-for-sale, demo, website launch, repository visibility change, and third-party disclosure date before open-sourcing anything.
3. Separate the voice-consent notes into **implemented today** and **proposed embodiments**.
4. Decide whether to finish a genuinely differentiated voice-consent enforcement design before filing.
5. Pay counsel first for a scoped search and a go/no-go opinion, not immediate drafting of multiple provisionals.

---

## 2. Legal screen counsel should apply

A software or AI-related claim is not automatically ineligible, but merely running an idea on generic computers is not enough. The USPTO's current materials state that eligibility under 35 U.S.C. § 101 remains separate from novelty, nonobviousness, and disclosure under §§ 102, 103, and 112. They emphasize evaluation of an asserted technological improvement in the specification and the claim as a whole. See [USPTO subject-matter eligibility page](https://www.uspto.gov/patent/laws-and-regulations/examination-policy/subject-matter-eligibility), [USPTO December 5, 2025 eligibility update](https://www.uspto.gov/subscription-center/2025/uspto-updates-subject-matter-eligibility-guidance-mpep), and [MPEP § 2106](https://www.uspto.gov/web/offices/pac/mpep/documents/2100_2106_01.htm).

For these invention notes, counsel should screen at least:

| Requirement | Question for this packet |
|---|---|
| **§ 101 — eligible subject matter** | Does the proposed claim recite a concrete technical improvement or merely organize permissions, retrieve information, apply thresholds, or automate a human policy using generic services? |
| **§ 102 — novelty** | Does one earlier reference disclose every element of the proposed claim? |
| **§ 103 — nonobviousness** | Even if no single reference discloses every element, would a skilled engineer have had reason to combine known access-control, cryptographic, RAG, screenshot, and deployment techniques? The USPTO notes that the obviousness analysis considers the claimed subject matter as a whole. See [MPEP § 2144](https://www.uspto.gov/web/offices/pac/mpep/s2144.html). |
| **§ 112(a) — written description and enablement** | Does the filing describe the mechanism in sufficient detail, including alternatives and edge cases, rather than naming a desired result? The USPTO describes written description, enablement, and best mode as separate specification requirements. See [MPEP § 2161](https://www.uspto.gov/web/offices/pac/mpep/s2161.html). |
| **Enforcement value** | Could infringement be detected from a competitor's public behavior or obtainable evidence, or would the important steps remain hidden inside a private backend? |

---

## 3. Repository-to-packet accuracy audit

### 3.1 Material corrections required before attorney review

| Packet statement | Repository evidence | Correction to send counsel |
|---|---|---|
| The voice system is **multi-party** consent gated. | `VoiceService.synthesize()` accepts the existence of one active record matching either the voice profile or the person. The consent creation API also returns early when one matching active record exists. | Describe the present implementation as **single-record explicit consent gating with granular permission fields**. Describe quorum rules, required relative classes, estate-representative precedence, conflicts, and multiple attestations as proposed embodiments unless and until implemented. |
| The TTS service validates an HMAC consent token on every synthesis request. | The UI issues a short-lived HMAC token, but `VoiceService` does not pass it into the provider call. The REST provider sends only the broad TTS service bearer token and familyspace header. The RunPod provider also submits synthesis input without the consent token. `TTS/app/main.py` contains consent-token validation references, but its imported `app.services.consent_validator` module is absent from the repository; the separate `TTS/tts-service` tree authenticates its REST path with the service token. | Say: **a token issuer and an older/incomplete validation path exist, but the active provider paths do not establish end-to-end per-request consent-token enforcement.** Do not claim this as shipped behavior. If pursued, consolidate the TTS tree and wire issuance, transport, signature verification, expiry, profile binding, tenant binding, consent-record lookup, and revocation behavior end to end. |
| Voice-profile weights use per-familyspace AES-256-GCM encryption with key derivation, and revocation rotates keys. | The patent packet names encryption service and GCS storage files that do not exist in the repository. The checked-in TTS profile directories contain `.pt` files. | Move AES-GCM, envelope encryption, tenant-derived keys, key rotation, and crypto-erasure to a **proposed embodiment** section unless counsel receives a separate implementation branch. If implemented, document key hierarchy, KMS/HSM boundary, nonce handling, rotation procedure, and whether revocation disables one profile or an entire tenant. |
| Every consent event is recorded to an immutable audit trail with before/after state. | The Prisma schema has an `AuditLog` model, and repository infrastructure can create audit rows. However, the API routes in `UI/src/pages/api/voice/consent/` directly call Prisma and do not create audit entries. The schema itself does not make rows immutable. | Say: **audit infrastructure exists, but voice-consent grant/revocation logging and tamper-evidence are not demonstrated on these API paths.** If this matters to the claim strategy, implement append-only or tamper-evident semantics and test the grant, use, and revocation paths. |
| Revocation makes an existing voice profile unusable. | Revocation sets `revokedAt`. The UI synthesis path re-checks active consent before use, but no repository evidence shows profile deletion, key destruction, profile locking, token denylisting, or service-level database re-check. | Say: **application-layer re-check can block future UI-mediated synthesis after revocation; cryptographic unusability is proposed, not implemented.** |
| Voice cloning itself is gated before a profile is created. | The reviewed synthesis path checks consent for playback when a profile is linked to a person. The packet should not imply that every upload, training, clone-creation, design-and-clone, blend, local, REST, and RunPod path has been verified as gated. | Inventory each profile-creation and synthesis path separately. Claim only the paths actually enforced and tested. |
| The Evidence Gate uses the threshold shown in the packet as though it were a singular system value. | `EvidenceGateImpl` has defaults of `0.2`, `0.15`, and `1`; `ChatService` overrides them with `0.12`, `0.08`, and `1`. | Describe thresholds as configurable and identify the production call-site override. Avoid presenting `0.12` as inherently inventive. |
| The Evidence Gate ensures **every** answer is grounded exclusively in documents. | The pipeline retrieves documents, gates low-evidence requests before generation, validates generated text, and can fall back. It also injects persona-profile material into evidence handling. This is useful safety logic, but “ensures every answer” is broader than the demonstrated guarantee. | Use careful wording: **the implementation applies retrieval thresholds and post-generation validation to reduce unsupported output, with refusal and fallback behavior.** If claiming stronger guarantees, define claim-level support mapping and deterministic enforcement. |
| The export captures tiles at 1:1 scale. | The exporter uses a Puppeteer viewport with `deviceScaleFactor: 2`, calculates a 2× output canvas, captures 2000-unit tiles, and composites with 2× offsets. | Describe this accurately as tiled browser capture composited into a 2× raster output. Do not describe it as vector output; it is PNG raster output preserving browser-rendered detail at the selected scale. |

### 3.2 Duplicate invention framing

`02-VOICE_CLONING_PIPELINE.md` and `06-CONSENT_MANAGEMENT.md` substantially overlap. Counsel should receive one coherent voice-consent disclosure with:

1. a current-state implementation table;
2. separately labeled proposed embodiments;
3. sequence diagrams for profile creation, synthesis, revocation, and recovery;
4. explicit policy semantics for who must consent and how many approvals are required; and
5. a list of alternative implementations, not just one HMAC/PBKDF2/AES combination.

The current packet should not use phrases such as “Nobody handles this,” “No existing persona chatbot has this,” “novel invention,” or “distinct from prior art” before counsel completes a search.

---

## 4. Candidate-by-candidate patentability critique

## 4.1 Consent-gated synthetic voice use

### What appears real today

The repository demonstrates commercially useful building blocks:

- tenant-scoped `VoiceConsent` records;
- granular `allowsGeneration`, `allowsCloudProcessing`, and `allowsSharing` flags;
- revocation timestamps;
- UI-layer synthesis gating for person-linked profiles;
- a short-lived HMAC token issuer; and
- familyspace-scoped TTS service authentication.

### Why the current broad framing is weak

The broad ingredients are known access-control techniques. A particularly important search lead is [US10936732B2, “System and method for registering multi-party consent”](https://patents.google.com/patent/US10936732B2/en), which discusses multi-party consent, consent-token-based access control, hashed token derivation, encryption-key derivation, expiration or invalidation, revocation, and records or receipts for consent actions. Counsel should also review [US8700909B2, “Revocation of a biometric reference template”](https://patents.google.com/patent/US8700909B2/en) as a biometric revocation lead and [US8955084B2, “Timestamp-based token revocation”](https://patents.google.com/patent/US8955084B2/en) as a token-revocation lead.

Those references do not automatically defeat a carefully drafted synthetic-voice claim. They do mean the packet should not characterize “multi-party consent + token + encryption + revocation + audit” as unsearched novelty.

### Where a narrower claim investigation may be worthwhile

Ask counsel to investigate whether there is a supportable distinction in a concrete workflow such as:

1. binding an immutable identity record for the represented person to one or more source recordings and a synthetic-voice profile;
2. computing a required approval policy from relationship, estate, jurisdiction, age, or profile-use context;
3. issuing a short-lived capability only after the policy is satisfied;
4. binding that capability to tenant, profile, permitted operation, compute location, and current consent-version or revocation epoch;
5. validating that capability at the synthesis boundary, including a fresh revocation check or epoch comparison;
6. enforcing distinct permissions for local generation, cloud processing, publication, and sharing; and
7. cryptographically disabling a profile or wrapped profile key when the relevant policy becomes unsatisfied.

The potential value is the **specific end-to-end state transition and enforcement protocol**, if novel—not the family-tree context by itself.

### Engineering work before describing this as implemented

- Define a real multi-party policy model: required approvers, quorum, relationship classes, estate authority, conflicts, expiry, minors, and re-approval.
- Gate profile creation and every synthesis path, including REST, streaming, RunPod, narration workers, design-and-clone, blend, and local fallbacks.
- Pass and validate the consent capability end to end.
- Decide whether the TTS boundary trusts a broad service token, a consent capability, or both.
- Implement profile-scoped envelope encryption and document revocation semantics precisely.
- Add audit records for grant, use, denial, expiry, revocation, rotation, and deletion; decide whether tamper evidence is required.
- Add integration tests proving that stale or revoked capabilities fail.

## 4.2 Evidence-gated persona chat

### What appears real today

This is the most complete of the described product features. The code:

1. retrieves person- and familyspace-scoped documents;
2. deduplicates and ranks chunks;
3. computes top score, average top-three score, and distinct source count;
4. refuses before LLM generation when evidence is insufficient;
5. builds a grounded prompt when the gate passes;
6. performs post-generation validation; and
7. can refuse or generate a grounded fallback.

### Why the present claims are likely too broad

The packet's core concept—retrieve evidence, score it, compare confidence to a threshold, and answer or abstain—is crowded. Search leads include:

- [US11880661B2, “Unsupervised dynamic confidence thresholding for answering questions”](https://patents.google.com/patent/US11880661B2/en), which describes document-backed question answering, evidence gathering, scoring, confidence thresholds, returning sufficiently confident answers, and not returning insufficiently confident answers;
- [US10061842B2, “Displaying answers in accordance with answer classifications”](https://patents.google.com/patent/US10061842B2/en), which discusses displaying or withholding answers based on answer-confidence classifications; and
- [US20210027770A1, “Multi-turn dialogue response generation with persona modeling”](https://patents.google.com/patent/US20210027770A1/en), as a persona-chat lead.

Natural-language refusals that remain “in character” are good product design, but standing alone are unlikely to be a strong technical invention. Likewise, selecting ChromaDB, embeddings, configurable numeric thresholds, and an LLM is unlikely to supply nonobviousness.

### Possible narrower improvement to explore

Only pursue this area if the product can articulate and implement a stronger technical mechanism, for example:

- claim-level or sentence-level provenance mapping from generated output to source spans;
- deterministic suppression or rewriting of unsupported clauses rather than only whole-response gating;
- contradiction detection across family records with temporal and source-authority weighting;
- separation of factual evidence from persona-style evidence so style cannot bootstrap factual support;
- a support envelope persisted with the answer so later reviewers can reproduce the evidence decision; or
- a measured technical result, such as a reproducible reduction in unsupported claims at a defined answer rate.

That would require a fresh search. Do not assume these alternatives are novel.

## 4.3 Tile-and-stitch graph export

### What appears real today

The exporter is concrete: it launches Puppeteer, waits for an export readiness signal, reads tree bounds, disables clipping constraints, captures a grid of tiles, and composites them into a PNG with Sharp. The React Flow canvas also disables visible-element-only rendering for export.

### Why the present framing is weak

The broad technique is likely an application of established rendering patterns. Search leads include:

- [EP2350873A1, “Capturing the visual content of browser windows”](https://patents.google.com/patent/EP2350873A1/en), which discusses browser and headless-browser capture; and
- [US10546038B2, “Intelligent browser-based display tiling”](https://patents.google.com/patent/US10546038B2/en), which describes browser content divided into tiles.

The current implementation may be a valuable operational technique, but “family tree + Puppeteer + tiles + Sharp + background job” is likely vulnerable to an obviousness combination. Moving an export to an asynchronous worker and uploading the result to object storage are also conventional service-design choices.

### Only pursue if there is a sharper distinction

Potentially searchable distinctions would need to be specific, such as a graph-export layout protocol that deterministically materializes virtualized off-screen nodes, reconciles graph coordinates with browser transforms, preserves edge continuity across tiles, and chooses scale or tile size based on renderer constraints. The repository contains pieces of this story, but the packet currently emphasizes generic tiling more than a distinct graph-rendering mechanism.

## 4.4 Hybrid local/cloud architecture

### Recommendation: drop as a standalone filing target

The current claim ideas collect familiar elements: cloud web UI, local GPU inference, secure tunnel, shared database schema, heartbeat, selectable deployment modes, containers, and storage adapters. The packet does not identify a novel protocol, scheduler, failover mechanism, data-minimization boundary, or measured infrastructure improvement caused by a nonconventional arrangement.

Keep this architecture in the background section of another disclosure if it explains where consent enforcement occurs. Do not present Prisma, Docker Compose, Caddy, Tailscale or Cloudflare Tunnel, local GPU inference, or a heartbeat registry as inventions merely because they are combined in this product.

---

## 5. Open-source and disclosure corrections

The existing lawyer summary should be revised before it is relied on.

### 5.1 Public disclosure

The U.S. grace-period statement is directionally useful but incomplete. The USPTO says a provisional may be filed up to 12 months after an inventor's public disclosure under the U.S. grace period, while warning that the same pre-filing disclosure may preclude patenting in foreign countries. It also notes that publication, public use, offer for sale, or other activity only needs to be publicly available to qualify as a disclosure. See [USPTO: Provisional Application for Patent](https://www.uspto.gov/patents-getting-started/patent-basics/types-patent-applications/provisional-application-patent).

Before open-sourcing or sending a non-confidential public demo, give counsel a dated disclosure log:

| Item | Date | Public or confidential? | Audience | What technical detail was disclosed? | Evidence link |
|---|---|---|---|---|---|
| Website launch | TBD | TBD | TBD | TBD | TBD |
| Hosted beta access | TBD | TBD | TBD | TBD | TBD |
| Repository visibility changes | TBD | TBD | TBD | TBD | TBD |
| Sales or hosting offers | TBD | TBD | TBD | TBD | TBD |
| Demos, videos, posts, pitch decks, emails | TBD | TBD | TBD | TBD | TBD |
| Third-party contractor access and NDAs | TBD | TBD | TBD | TBD | TBD |

### 5.2 AGPLv3 and Apache 2.0 both contain patent-license language

The packet currently says Apache 2.0 grants an express patent license while AGPLv3 does not. That is incorrect. Apache License 2.0 § 3 grants a contributor patent license for claims necessarily infringed by the contribution alone or in combination with the work. See [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0.html). GNU AGPLv3 § 11 also grants a contributor patent license under the contributor's essential patent claims. See [GNU AGPLv3](https://www.gnu.org/licenses/agpl-3.0.html.en).

The scope, contributor implications, network-source obligations, dual-licensing structure, inbound contribution policy, and enforceability strategy should be reviewed by counsel before release. Do not tell counsel that AGPLv3 preserves unrestricted patent enforcement against users of the AGPL-licensed implementation.

### 5.3 Recommended wording replacement

Replace “Open Source + Patent: No Conflict” with:

> Filing a patent application and releasing source code can coexist, but timing and license scope matter. Public disclosure before filing may impair foreign rights and can start a U.S. grace-period clock. Both Apache 2.0 and AGPLv3 contain patent-license provisions with different practical licensing strategies. Please advise on filing timing, license selection, contributor agreements, dual licensing, and which patent rights would be licensed to downstream users.

---

## 6. Concrete wording changes for the existing packet

| Current style | Safer attorney-handoff wording |
|---|---|
| “Nobody handles this.” | “We have not completed a professional prior-art search. We believe the following workflow may differ from commonly observed commercial products; please search and assess.” |
| “Why patentable” | “Potential point for counsel to assess under §§ 101, 102, 103, and 112.” |
| “Strongest” / “Very Strong” | “Highest internal priority for prior-art screening.” |
| “invented a multi-party consent system” | “The repository currently implements single-record consent gating and granular permission flags. We are evaluating a policy-driven multi-party embodiment described separately.” |
| “revocation with cryptographic effect” | “Proposed embodiment: revocation epoch and profile-key disablement. Current repository evidence demonstrates application-layer revocation checks, not cryptographic erasure.” |
| “immutable audit trail” | “Audit-log model exists. Proposed embodiment: append-only or tamper-evident consent event log integrated into grant, use, and revocation flows.” |
| “grounded exclusively in uploaded documents” | “Applies retrieval thresholds, refusal behavior, and post-generation validation to reduce unsupported answers; stronger deterministic source-support enforcement is under evaluation.” |
| “vector-quality” PNG | “Browser-rendered tiled raster export at selected output scale.” |
| “distinct from prior art” | “Candidate distinction requiring prior-art review.” |

---

## 7. Additional code-derived opportunities worth discussing, not claiming yet

These are not recommendations to file. They are topics for product and counsel triage after implementation review and searching.

| Topic | Why it may be more interesting than the current broad wording | What is missing before counsel can evaluate it |
|---|---|---|
| Consent-version or revocation-epoch capabilities | A synthesis capability bound to a changing policy version may provide a concrete enforcement story and detectable state machine. | End-to-end implementation, threat model, stale-token tests, and a search. |
| Profile-scoped crypto-erasure | Disabling only the affected synthetic identity may be technically sharper than rotating a whole tenant key. | Envelope-key design, recovery policy, backup handling, clone-source handling, and a search. |
| Evidence support envelopes | Persisting reproducible sentence-to-source support decisions may distinguish the persona system from a simple threshold gate. | Data model, deterministic validator, evaluation metrics, and a search. |
| Contradictory family-record reconciliation | Genealogical records contain conflicting dates, names, and accounts. A source-authority and temporal-resolution mechanism could solve a domain-specific technical data problem. | Actual algorithm, data structures, measured results, and a search. |
| Virtualized graph export materialization | Export-specific graph materialization and transform reconciliation may be a more concrete rendering problem than generic screenshot tiling. | A documented algorithm, edge cases, performance measurements, and a search. |

Avoid patent-padding. A smaller disclosure around a real, testable technical mechanism is more useful than a long list of ordinary stack choices.

---

## 8. Attorney handoff package checklist

Before paying for drafting, prepare:

### Disclosure and ownership

- [ ] Earliest conception date for each candidate, with dated notes, commits, diagrams, and test artifacts.
- [ ] Every contributor who materially helped conceive each candidate claim concept; AI tools are not inventors, and counsel should assess the human contribution. See [USPTO AI inventorship FAQs](https://www.uspto.gov/initiatives/artificial-intelligence/faqs).
- [ ] Assignment, employment, contractor, and NDA records.
- [ ] Public-disclosure and offer-for-sale timeline.
- [ ] Desired countries and budget before any public release.

### Voice-consent technical appendix

- [ ] Current-state sequence diagram for profile creation and synthesis.
- [ ] Proposed-state sequence diagram clearly labeled as proposed.
- [ ] Policy table for self, family attestation, estate representative, quorum, conflict, expiry, and revocation.
- [ ] Capability payload, signing, expiry, audience, tenant, profile, operation, and revocation-version semantics.
- [ ] Encryption key hierarchy and revocation behavior.
- [ ] Test matrix for every local, REST, RunPod, streaming, worker, and fallback path.

### Persona technical appendix

- [ ] Retrieval and refusal sequence diagram.
- [ ] Exact distinction between factual documents, profile facts, style evidence, and fallback text.
- [ ] Evaluation dataset and unsupported-claim metrics.
- [ ] Any proposed sentence-level provenance or contradiction-resolution design.

### Export technical appendix

- [ ] Renderer constraints and benchmark data.
- [ ] Coordinate-transform and graph-materialization sequence.
- [ ] Tile seam, edge continuity, typography, memory, and maximum-size tests.

---

## 9. Suggested counsel instruction

Send counsel this instruction rather than asking for immediate filing of five inventions:

> Please perform an initial patentability and filing-strategy screen, beginning with the narrowly defined consent-gated synthetic-voice workflow. The attached materials distinguish implemented behavior from proposed embodiments. Please advise whether a focused search supports spending money on a provisional, whether any proposed claims present § 101 or § 103 risk, what additional technical detail is needed for § 112 support, whether any pre-filing disclosures affect U.S. or foreign rights, and how an AGPLv3 or Apache 2.0 release would affect the licensing strategy. Please quote the search and go/no-go assessment separately from drafting.

---

## 10. Overall conclusion

There is a real product here, but the current packet is more confident than the evidence supports. The architecture as a whole is not the strongest patent target. The evidence-gated persona and export features are implemented and useful, yet their current broad formulations appear crowded or conventional. The best reason to spend a limited initial legal budget is a **narrow investigation** of an end-to-end, policy-driven synthetic-voice consent enforcement protocol—after the repository record is corrected and the intended technical mechanism is defined precisely.
