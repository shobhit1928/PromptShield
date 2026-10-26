# Detection Limitations

## Why Rule-Based Detection Is Insufficient Alone

PromptShield's rule-based detector applies regex patterns against input text.
This approach has fundamental limitations that every user should understand.

---

## 1. Keyword presence ≠ attack

A text containing the word "ignore", "jailbreak", or "system prompt" is not
automatically an attack. Rules are designed to require structural indicators
(e.g., instruction-override framing, role-change patterns), but false positives
still occur on:

- Security research and educational content
- CTF writeups and academic papers
- Developer instructions that use instruction-like language
- Creative fiction containing relevant phrases

---

## 2. Evasion is trivial for rule-based systems

Simple transformations defeat regex rules:
- Unicode lookalike characters: `Ĭgnore` vs `Ignore`
- Token insertion: `Ignore . all . previous . instructions`
- Paraphrase: "Set aside your earlier guidance" evades DPI-001
- Encoding: base64, ROT13, pig latin

Rule-based systems are inherently backward-looking. They detect known patterns,
not novel attacks.

---

## 3. The ML classifier is trained on synthetic data

The starter dataset contains ~80 hand-crafted examples. At this scale:
- Precision and recall numbers are illustrative only
- The model will not generalise well to novel phrasing
- Class imbalance is likely even with "balanced" weighting
- 5-fold cross-validation on 80 samples has high variance

A reliable production classifier would require:
- Thousands of diverse, real-world examples
- Adversarial examples crafted specifically to evade detection
- Multiple validation rounds with independent annotators
- Regular retraining as attack patterns evolve

---

## 4. A detection result does not prove exploitability

PromptShield analyses **text**. It does not:
- Execute the text against a real LLM
- Know what system prompt the target model uses
- Know what tools or permissions the target model has
- Know whether the target model would comply with the injection

Whether a prompt injection succeeds depends on the specific model, system
prompt, tool configuration, and the model's training. Two identical inputs may
succeed on one LLM and fail on another.

**Never claim that a PromptShield detection result proves that an application is
vulnerable or exploitable.**

---

## 5. Indirect injection is particularly hard

Indirect prompt injection (injections embedded in external content retrieved
by an agent) is difficult to detect because:
- The malicious instruction appears in otherwise legitimate content
- Detection requires understanding the full agent context
- The injection may be split across multiple retrieved documents
- The attack may be conditional on later model state

Rules IPI-001 and IPI-002 cover obvious structural patterns only.

---

## 6. Multi-turn and context-dependent attacks

PromptShield analyses each input independently. It does not:
- Maintain conversation state
- Detect attacks that unfold over multiple turns
- Detect attacks that exploit model memory or retrieval state

---

## Responsible Disclosure

If you discover a systematic bypass for all detection categories that could be
used to harm real users, please document it responsibly and consider sharing
it with the security community through appropriate channels.
