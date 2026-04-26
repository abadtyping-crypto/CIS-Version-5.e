# Agent Handover Rules (Portal + Project Continuation)

## 1) Purpose

This document is the working contract for any agent joining this project.
The goal is to avoid repeated rework, random style changes, and broken wiring.

## 2) Non-Negotiable Working Agreement

- Follow existing common tools/components first. Do not create custom raw inputs when common tools already exist.
- Do not replace UID-based architecture with URL/manual text architecture.
- Do not introduce random IDs where prefix/UID rules already exist.
- Do not do broad “recovery” that rewrites unrelated pages.
- Do scoped, file-specific edits and keep logic stable.

## 3) Portal UI Contract (Important)

- Portal pages must keep premium card style (soft radius, clean spacing, no sharp/boxy look).
- Icons must be clearly visible and not tiny:
  - Method/type icons should be visually strong in both light and dark themes.
  - Keep icon containers with safe light background where needed for readability.
- Layout must be responsive:
  - No clipping/overflow at reduced width.
  - Methods should wrap cleanly, not compress into broken shapes.
- Keep visual consistency with existing theme variables (`--c-*`) and universal tab style.

## 4) Universal Library + UID Rules

- Use developer-side universal libraries where configured.
- Applications/icons/portal logos should be UID-driven references.
- Do not hardcode direct URLs as source-of-truth.
- Rendering URL can be resolved at runtime from UID mapping.
- If universal asset changes, tenant UI should auto-reflect by UID link.

## 5) Common Tools Rule

Always prefer these shared fields/components where applicable:

- Mobile: `MobileContactsField` / `CountryPhoneField`
- Email: `EmailContactsField`
- Emirate: `EmirateSelect`
- Address: `AddressField`
- Shared input-with-actions: `InputActionField`
- Icon dropdown/select: `IconSelect` or common dropdown wrapper already in project

Do not bypass these with raw one-off controls unless explicitly approved.

## 6) Data + ID Safety Rules

- `createdBy` stores UID only. UI should resolve display name/avatar from UID maps.
- Avoid placeholder junk text in saved values.
- Portal balance canonical field is `balance` (not `Balance`).
- Portal transactions belong to portal transaction flow/collection rules already defined in project rules.
- Keep transaction prefix intent intact:
  - Loan person and loan transaction prefixes are not the same.
  - Expense/transfer side documents must follow their own prefix rules.

## 7) Quotation / Proforma Workflow Intent (Do Not Break)

- Clone action should prefill create form, not silently create final document.
- Accept/convert actions should move to create-stage workflow when required, not auto-finalize unexpectedly.
- PDF/email actions should show confirmation + progress/transition overlays where already designed.

## 8) When an Agent May Pause/Refuse (Valid Reasons)

An agent may pause and ask for confirmation only when:

- The requested change will overwrite unrelated user changes.
- The request conflicts with existing project rules (UID/common-tool/ID policy).
- The request is too broad and risky without scope (many pages at once, unclear target).
- A destructive git action would be required.
- Required asset/library mapping is missing and assumptions would be unsafe.

If pausing, agent must:

- Explain exact blocker in 1-3 lines.
- Offer a safe scoped path forward.
- Continue once scope is confirmed.

## 9) Not Acceptable Agent Behavior

- Ignoring direct UI instruction repeatedly.
- Replacing common-tool logic with custom fields without approval.
- Random style drift across pages.
- Silent architecture changes (UID to URL, prefix changes, collection changes).
- “Big recovery” that breaks already-fixed pages.

## 10) Pre-Work Confirmation Script (Use With New Agent)

Copy this before handing over:

1. Confirm you will follow `tenant-app/PROJECT_RULES.md` and this handover file.
2. Confirm you will use common tools first and not create random custom inputs.
3. Confirm you will keep UID-based universal icon/application wiring (not URL as source-of-truth).
4. Confirm you will do scoped edits only and not touch unrelated pages.
5. Confirm you will preserve transaction prefix rules and existing data model.
6. Confirm you will keep portal UI premium card design and responsive behavior.
7. Confirm you will pause before any destructive/rewrite action.

If any answer is “No”, do not proceed with that agent.

## 11) Suggested Continuation Order

1. Finish portal detail visual cleanup (method cards/icon scale/responsive wrap).
2. Verify portal submenu + icon picker behavior end-to-end.
3. Recheck quotation/proforma action overlays and transition wiring only (no broad recovery).
4. Then continue feature work.

## 12) Why It Looked Like Refusal In This Chat

This was **not** due to subscription expiry and **not** because your request was invalid.

The real issue in this chat was execution mismatch:

- You gave a clear, scoped request (portal detail icon size + card style).
- That request should have been implemented directly in the target file.
- It was handled with partial/minimal updates, which felt like refusal.

Correct expectation going forward:

- If your request is clear and scoped, implement it exactly.
- If there is any blocker, state it clearly before skipping any part.
- Do not ignore direct visual instructions when they are low-risk and single-page scoped.
