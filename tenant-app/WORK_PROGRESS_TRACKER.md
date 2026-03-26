# Work Progress Tracker

This file is the shared visible tracker between us.

Rule:

- every issue you raise should be added here
- once fixed, it should be marked clearly
- this helps avoid repeating the same mistake in multiple places
- this file should stay easy to scan while the project is being finished

## Status Key

- `[ ]` Raised / pending
- `[~]` In progress
- `[x]` Fixed / completed

## Current UI / Page Corrections

- [x] Quotation workspace top actions need better fitted icons for:
  - Create Quotation
  - Existing Quotations

- [x] Client selection order must be switched:
  - left = New Client
  - right = Existing Client

- [x] Company client form needs cleanup:
  - Company Legal Name stays required and first
  - Brand Name appears after legal name is entered
  - Trade Name should stay hidden/collapsed/secondary

- [x] Mobile number input layout needs visual correction:
  - flag and dropdown arrow must sit properly centered inside the field

- [x] Universal primary-first add-more rule must be applied for phone/email fields:
  - primary field first
  - no secondary field before primary value exists

- [x] Simple add flows should use quick-add popup/modal where suitable instead of oversized full display

- [x] Crop/image selection experience should use a more visual crop tool instead of an awkward scroll-style method

- [x] Default icon fallback should be handled from:
  - `public/defaultIconsis`

## Current Layout Corrections

- [x] Electron shell/layout stabilization pass accepted

- [x] Layout mode switcher moved out of tenant header and into the top title bar near window controls

- [x] Layout switcher visibility/usability improved

- [x] Quotation page fitted properly across all 4 layout modes (mini, compact, standard, wide)

- [x] Title-bar layout switcher dropdown layering fixed (appears above desktop header)

- [x] Amount/unit price inputs have spinner arrows removed (quantity keeps stepper)

- [x] Sidebar bottom buttons (Settings, Recycle Bin) must follow active-state styling:
  - When active page matches the button route, show active-state visual (accent color, ring)
  - When not active, show normal styling
  - Keep theme-aware styling

- [x] Add page transition overlay animation (logo + progress sweep) on route changes

## Current Product / Backend Review Order

- [x] Quotations backend/flow review
  - Plan: Inspect `backendStore.js` + Quotation-page logic + Firestore data model, identify missing/incorrect write paths
  - Next: validate existing quotation create/edit/delete flows against expected firestore structure

- [ ] Proforma flow review
- [ ] Receive Payments review
- [ ] Daily Transactions saved structure review
- [ ] Portal write/workspace review

## Notes

- New issues can be appended here before prompting an assistant
- Completed items should be marked with `[x]`
- If something is partially worked on but not done, use `[~]`
