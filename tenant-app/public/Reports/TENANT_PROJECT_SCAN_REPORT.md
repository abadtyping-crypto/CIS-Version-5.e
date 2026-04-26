# Tenant Project Scan Report - PDF Master Studio and Branding Flow

Scan date: 2026-04-26  
Project: `tenant-app` inside `ACIS Version 5.0`  
Scope: React/Vite/Electron tenant app, settings branding, logo library, PDF master studio, PDF generation paths, and design framework.

## 1. Rules Read Before Scan

I read the project rules before making this report:

- `PROJECT_RULES.md`
- `SETTINGS_DATA_RULES.md`
- `WORKING_PLAN.md`
- `tenant-app/AGENT_HANDOVER_PORTAL_RULES.md`

Important rules confirmed:

- Tenant routes must stay under `/t/:tenantId/...`.
- Settings writes must be camelCase, must use `updatedBy: user.uid`, must include `updatedAt`, and must trigger `createSyncEvent`.
- UID is the identity source of truth. Display names/emails are display-only.
- Settings and Firestore/backend behavior should not be changed blindly.
- Currency output should stay AED / Dirham, not dollar.
- UI should reuse existing project primitives and CSS variables.

No functional code changes were made during this scan. This file is the scan output.

## 2. Framework and Runtime

The tenant app is a React 19 + Vite 7 + Electron application.

Key dependencies from `tenant-app/package.json`:

- React: `react`, `react-dom`
- Routing: `react-router-dom`
- Firebase: `firebase`
- PDF: `jspdf`, `jspdf-autotable`, `pdfjs-dist`
- UI icons: `lucide-react`
- Logo crop/editor: `react-easy-crop`
- Build/runtime: Vite, Electron, ESLint, Tailwind/PostCSS

The app root is `tenant-app/src/App.jsx`.

Main provider order:

- `ThemeProvider`
- `AuthProvider`
- `TenantProvider`
- `GlobalProgressProvider`
- `RequireAuth`
- `AppLayout`

The layout switches between desktop and mobile using `AppLayout.jsx`.

## 3. Tenant Route Map

Routes are tenant-scoped under `/t/:tenantId`.

Main routes found in `tenant-app/src/App.jsx`:

- `/t/:tenantId/dashboard`
- `/t/:tenantId/settings`
- `/t/:tenantId/daily-transactions`
- `/t/:tenantId/tasks-tracking`
- `/t/:tenantId/invoice-management`
- `/t/:tenantId/quotations`
- `/t/:tenantId/proforma-invoices`
- `/t/:tenantId/receive-payments`
- `/t/:tenantId/operation-expenses`
- `/t/:tenantId/notifications`
- `/t/:tenantId/profile`
- `/t/:tenantId/profile/edit`
- `/t/:tenantId/portal-management`
- `/t/:tenantId/portal-management/new`
- `/t/:tenantId/portal-management/edit/:portalId`
- `/t/:tenantId/portal-management/:portalId`
- `/t/:tenantId/document-calendar`
- `/t/:tenantId/client-onboarding`
- `/t/:tenantId/clients/:clientId`
- `/t/:tenantId/clients/:clientId/dependents/:dependentId`
- `/t/:tenantId/favorites`
- `/t/:tenantId/search`
- `/t/:tenantId/chat-help`
- `/t/:tenantId/workflows/proformas/new`
- `/t/:tenantId/workflows/proformas/:proformaId`
- `/t/:tenantId/workflows/tasks`
- `/t/:tenantId/workflows/tracking`
- `/t/:tenantId/workflows/refund-log`

Navigation labels are mainly defined in `tenant-app/src/config/appNavigation.js`.

Important observation: `invoice-management` is currently a placeholder route, not a full PDF-producing invoice workspace.

## 4. Design System and Layout Pattern

The app uses a shared desktop/mobile shell:

- `tenant-app/src/components/layout/AppLayout.jsx`
- `tenant-app/src/components/layout/DesktopLayout.jsx`
- `tenant-app/src/components/layout/MobileLayout.jsx`
- `tenant-app/src/components/layout/PageShell.jsx`
- `tenant-app/src/components/layout/UniversalPageHeader.jsx`
- `tenant-app/src/components/layout/AppSidebar.jsx`
- `tenant-app/src/components/layout/DesktopHeader.jsx`

Desktop layout:

- Forces desktop mode inside Electron.
- Uses `desktop-shell`, `desktop-frame`, `desktop-content`, `desktop-main`.
- Uses glass panel styling, compact shell widths, and density modes.
- Has sidebar modes: mini, compact, standard, wide.

Mobile layout:

- Uses `mobile-shell`, `MobileHeader`, `MobileBottomBar`.
- Keeps body overflow locked while active.
- Reads mobile wallpaper/icon style from `mobileAppearance`.

Styling foundation:

- `tenant-app/src/index.css` defines project CSS variables:
  - `--c-bg`
  - `--c-surface`
  - `--c-panel`
  - `--c-border`
  - `--c-text`
  - `--c-muted`
  - `--c-accent`
  - `--c-ring`
- Supports light/dark through `:root[data-theme='dark']`.
- Uses Tailwind utility classes with CSS variables.
- Settings pages use card sections, rounded panels, borders, and compact typography.

Common UI components used in settings and document flows:

- `SettingCard`
- `InputActionField`
- `MobileContactsField`
- `EmailContactsField`
- `AddressField`
- `CountryPhoneField`
- `IconSelect`
- `CurrencyValue`
- `DocumentActionButton`
- `SecureViewer`

## 5. Settings Page Structure

Settings page file:

- `tenant-app/src/pages/SettingsPage.jsx`

Settings sections:

- `brand` -> `BrandDetailsSection`
- `pdfStudio` -> `PdfMasterStudioSection`
- `svcTemplates` -> `ServiceTemplateSection`
- `appIconLibrary` -> `ApplicationIconLibrarySection`
- `users` -> `UserCustomizationSection`
- `control` -> `UserControlCenterSection`
- `mail` -> `MailConfigurationSection`
- `mailTemplates` -> `EmailTemplateSection`
- `counters` -> `IDRulesSection`
- `whatsapp` -> `WhatsAppConfigurationSection`
- `fileManager` -> `FileManagerSection`

PDF Master Studio is present and wired into Settings:

- Import: `tenant-app/src/pages/SettingsPage.jsx`
- Rendered when `tab=pdfStudio`
- Mobile settings also allow `pdfStudio`.

## 6. Branding Settings and Logo Library

Main file:

- `tenant-app/src/components/settings/BrandDetailsSection.jsx`

Subsections:

- `tenant-app/src/components/settings/BrandingSubsections.jsx`

Storage helper:

- `tenant-app/src/lib/brandLogoStorage.js`

Logo reader hook:

- `tenant-app/src/hooks/useTenantBrandingLogos.js`

Firestore source:

- `tenants/{tenantId}/settings/branding`

Branding fields currently handled:

- `companyName`
- `brandName`
- `isBrandNameHeaderEnabled`
- `landlines`
- `mobiles`
- `mobileContacts`
- `addresses`
- `emirate`
- `poBoxNumber`
- `poBoxEmirate`
- `emails`
- `webAddress`
- `bankDetails`
- `locationPin`
- social links
- `isLogoLibraryEnabled`
- `logoLibrary`
- `logoUsage`
- `activeLogoSlotId`
- `activeLogoUrl`

Logo library shape:

```js
{
  slotId: 'logo_1',
  name: '...',
  url: 'https://...'
}
```

Logo upload path:

```text
tenants/{tenantId}/branding/logos/{slotId}_{timestamp}.{ext}
```

Logo upload rules:

- Allowed image types: PNG, SVG, JPEG, WEBP.
- Maximum size: 2 MB.
- Existing Firebase Storage logo is deleted before replacement when possible.

Logo usage currently only maps:

- `header`
- `login`

Important gap:

- Brand Settings only maps logos to app surfaces like header/login.
- PDF Master Studio separately selects a logo from `branding.logoLibrary`.
- There is no Brand Settings-level `logoUsage` mapping for invoice, quotation, payment, statement, etc.

Branding write behavior:

- `BrandDetailsSection` saves to `branding`.
- Uses `updatedBy: user.uid`.
- Calls `upsertTenantSettingDoc`, which writes `updatedAt: serverTimestamp()`.
- Calls `createSyncEvent` with entity type `settingsBranding`.

This part aligns with the identity/sync rules.

## 7. PDF Master Studio Current Structure

Main file:

- `tenant-app/src/components/settings/PdfMasterStudioSection.jsx`

Firestore document:

- `tenants/{tenantId}/settings/pdfTemplate_default`

The Studio scans:

- `branding.companyName`
- `branding.mobileContacts` or fallback `branding.mobiles`
- `branding.emailContacts` or fallback `branding.emails`
- `branding.addresses`
- `branding.poBoxNumber` / `branding.poBoxEmirate`
- `branding.bankDetails`
- `branding.logoLibrary`

Current Studio page types:

- `invoice`
- `quotation`
- `claim`
- `acknowledgement`
- `payment`
- `clientStatement`
- `portalStatement`
- `portalStatementQuotation`

Current Studio controls:

- Dynamic toggles only for scanned branding values.
- Individual toggles for mobile contacts.
- Individual toggles for email contacts.
- Individual toggles for addresses.
- PO Box toggle only if PO Box exists.
- Bank visibility per bank account.
- Logo card selection using live image preview.
- Logo position: left, center, right, bottom.
- Font choices: Helvetica, Times, Courier, Helvetica Bold.
- Color controls: header accent, bottom accent, table accent.
- Global `tableEnabled`.
- Independent watermark enable toggle.
- Watermark type: logo or text.
- Watermark logo picker with live image cards.
- Watermark size and opacity sliders.
- Watermark position: center, top, bottom, diagonal.
- Terms and Conditions enable toggle and text area.
- Preview through `generateTenantPdf(..., templateOverride: previewTemplate)`.
- Preview displayed in `SecureViewer`.

The Studio already follows much of the requested "dynamic scanned UI" concept.

Important write behavior:

- Saves via `upsertTenantSettingDoc(tenantId, 'pdfTemplate_default', savePayload)`.
- Includes `updatedBy: user?.uid || ''`.
- Includes `updatedAt: new Date().toISOString()` in payload, but `upsertTenantSettingDoc` overwrites/sets `updatedAt` with Firestore `serverTimestamp()`.
- Calls `createSyncEvent` with entity type `settingsPdfTemplate`.

Important gap:

- The master studio writes one global `pdfTemplate_default`, not per-document docs under `settings/pdfTemplates/templates/{documentType}`.
- The PDF engine reads both per-document template docs and this master doc, then merges them.
- The Studio has the page buttons, but the actual application pages do not yet exist for every document type.

## 8. PDF Template Renderer Contract

File:

- `tenant-app/src/lib/pdfTemplateRenderer.js`

Declared document types:

- `invoice`
- `quotation`
- `claim`
- `acknowledgement`
- `payment`
- `clientStatement`
- `portalStatement`
- `portalStatementQuotation`
- `paymentReceipt`
- `nextInvoice`
- `performerInvoice`
- `statement`

Default template includes:

- `logoSlotId`
- `logoUrl`
- `logoPosition`
- `fontStyle`
- `headerAccentColor`
- `bottomAccentColor`
- `tableAccentColor`
- `paperSize`
- `orientation`
- `margins`
- `showCompanyName`
- `showCompanyAddress`
- `showBankDetails`
- `showContactInfo`
- `tableEnabled`
- `enableTerms`
- `contactVisibilityMap`
- `bankAccountsVisibility`
- `enableWatermark`
- `watermarkType`
- `watermarkLogoSlotId`
- `watermarkText`
- `watermarkOpacity`
- `watermarkScale`
- `watermarkPosition`
- `documentConfigs`

Important gap against the latest requirement:

- Normalizer still allows `paperSize: 'Letter'` and `orientation: 'landscape'`.
- The generator itself currently hardcodes A4 portrait for the main engine, but the template contract still exposes non-A4/non-portrait options.

## 9. PDF Template Storage Path

File:

- `tenant-app/src/lib/pdfTemplateStorage.js`

Storage path for template assets:

```text
tenants/{tenantId}/pdfTemplates/{documentType}/{templateId}/{assetType}_{timestamp}.{ext}
```

Allowed types:

- PNG
- SVG
- JPG/JPEG
- WEBP

This is separate from the brand logo library path.

## 10. PDF Engine Current Behavior

Main file:

- `tenant-app/src/lib/pdfGenerator.js`

Entry point:

```js
generateTenantPdf({
  tenantId,
  documentType,
  data,
  save,
  returnBase64,
  filename,
  templateOverride,
})
```

Reads:

- `fetchTenantPdfTemplates(tenantId)`
- `getTenantSettingDoc(tenantId, 'preferenceSettings')`
- `getTenantSettingDoc(tenantId, 'branding')`
- `getTenantSettingDoc(tenantId, 'pdfTemplate_default')`
- optionally `transactionIdRules` for filename policies

Template merge order:

1. `PDF_DEFAULT_TEMPLATE`
2. per-document renderer template from `settings/pdfTemplates/templates/{documentType}`
3. master template from `settings/pdfTemplate_default`
4. `templateOverride`, if passed

Document labels supported inside engine:

- `invoice`
- `quotation`
- `claim`
- `acknowledgement`
- `payment`
- `clientStatement`
- `portalStatement`
- `portalStatementQuotation`
- `paymentReceipt`
- `nextInvoice`
- `performerInvoice`
- `statement`

Logo resolution order for normal PDFs:

1. `template.logoSlotId` from `branding.logoLibrary`
2. `branding.logoUsage[documentType]`
3. `branding.logoUsage.header`
4. `template.logoUrl`
5. `branding.activeLogoUrl`

Watermark logo resolution:

1. `template.watermarkLogoSlotId`
2. selected document logo

Branding text rendering:

- Company name comes from `branding.companyName || branding.legalName || branding.brandName`.
- Addresses come from `branding.addresses`.
- PO Box comes from `branding.poBoxNumber` and `branding.poBoxEmirate`.
- Emails come from `branding.emailContacts` or fallback `branding.emails`.
- Mobiles come from `branding.mobileContacts` or fallback `branding.mobiles`.
- Landlines come from `branding.landlines` or fallback `branding.landline`.

Granular contact control:

- Engine supports `contactVisibilityMap`.
- Keys include:
  - `mobile:0`, `mobile:1`, etc.
  - `email:0`, `email:1`, etc.
  - `address:0`, `address:1`, etc.
  - `poBox`
  - legacy keys like `showPrimaryEmail`, `showPrimaryMobile`

Layout safety behavior already present:

- Main PDFs are generated as A4 portrait.
- Branding lines use `doc.splitTextToSize`.
- Header height is calculated from wrapped branding text.
- Content cursor starts after calculated header height.
- `ensurePageSpace()` pushes content to a new page when needed.
- Terms and bank details wrap and check page space.
- Footer moves to a new page if content is too close to the bottom.

Currency:

- Loads `/dirham.svg`.
- Draws Dirham icon next to numeric amounts where possible.
- Falls back to `AED` text if icon fails.
- No dollar formatting found in the main PDF generator.

Important gap:

- `generatePremiumPortalStatement()` is a separate custom path for `portalStatement`, and it does not use the same full dynamic scanned contact mapping as the normal engine.
- Portal statement logo uses `branding.logoUrl || branding.iconUrl`, while branding currently stores logos in `logoLibrary` / `activeLogoUrl`. This can explain missing logo/details in portal statement PDFs.

## 11. Active PDF Generation Call Sites

### Quotations

File:

- `tenant-app/src/pages/QuotationPage.jsx`

Document type:

- `quotation`

Actions using `generateTenantPdf`:

- Download quotation PDF
- Preview quotation PDF
- Print quotation PDF
- Email quotation PDF

Data builder sends:

- `txId`
- `date`
- `recipientName`
- `amount`
- `description`
- `items`
- quotation-specific fields such as discount/terms where available

### Proforma Invoices

File:

- `tenant-app/src/pages/ProformaInvoicesPage.jsx`

Document type:

- `nextInvoice`

Actions using `generateTenantPdf`:

- Download/generate PDF
- Email PDF
- WhatsApp PDF

Important issue:

- One path calls `save: true, returnBase64: true`.
- Another WhatsApp path expects `pdfRes.url`, but `generateTenantPdf` currently returns `{ ok, doc }` or `{ ok, doc, base64 }`, not a public URL. This means that WhatsApp PDF delivery path likely cannot work as written.

### Portal Detail Statements

File:

- `tenant-app/src/pages/PortalDetailPage.jsx`

Document type:

- `portalStatement`

Actions:

- Print statement
- Download statement
- Preview statement
- Email statement

Data includes:

- `statementRows`
- `portalLogoUrl`
- `recipientName`
- statement date range

### Portal Reports

File:

- `tenant-app/src/components/portal/ReportsSection.jsx`

Document type:

- `portalStatement`

This generates a portal statement from selected portal transactions.

### Portal Recent Transactions

File:

- `tenant-app/src/components/portal/RecentTransactionsSection.jsx`

Document types:

- `paymentReceipt`
- `performerInvoice`

Choice is based on transaction type.

### Portal Internal Transfer

File:

- `tenant-app/src/components/portal/InternalTransferSection.jsx`

Document type:

- Dynamic: `status.download.docType`

This uses the same PDF engine for generated transfer notes.

## 12. Requested Page Types vs Current App Reality

Requested page/master types:

- Invoice
- Quotation
- Claim
- Acknowledgment
- Payment
- ClientStatement
- Portal Statement Quotation

Current support status:

| Type | Studio button | Engine label/default | Active app page/call site |
| --- | --- | --- | --- |
| Invoice | Yes, `invoice` | Yes | Route is placeholder; no full invoice PDF page found |
| Quotation | Yes, `quotation` | Yes | Yes, `QuotationPage.jsx` |
| Claim | Yes, `claim` | Yes | No active page/call site found |
| Acknowledgment | Yes, `acknowledgement` | Yes | No active page/call site found |
| Payment | Yes, `payment` | Yes | Payment receipts exist through `paymentReceipt`; no `payment` page/call site found |
| ClientStatement | Yes, `clientStatement` | Yes | No active client statement page/call site found |
| Portal Statement | Yes, `portalStatement` | Yes | Yes, `PortalDetailPage.jsx`, `ReportsSection.jsx` |
| Portal Statement Quotation | Yes, `portalStatementQuotation` | Yes | No active page/call site found |

Conclusion:

- The Studio and engine know most requested document types.
- The actual user-facing pages/call sites are only complete for quotation, proforma invoice, portal statement, recent transaction payment receipt/proforma, and internal transfer.
- Missing pages/workflows still need to be added before dynamic footer content can be finalized per document type.

## 13. Main Findings and Risks

### Finding 1 - PDF Master Studio exists, but page workflows are incomplete

The current Studio has buttons for the requested master types. The app does not yet have active generation pages for claim, acknowledgement, client statement, portal statement quotation, or a real invoice management flow.

### Finding 2 - Company name/address can be missing in portal statement PDF

Normal PDFs read `branding.companyName`, `branding.addresses`, `mobileContacts`, `emails`, and logo library.

The premium portal statement path reads older/different fields:

- `branding.legalName`
- `branding.officeAddress`
- `branding.logoUrl`
- `branding.iconUrl`

But Brand Settings stores:

- `companyName`
- `addresses`
- `logoLibrary`
- `activeLogoUrl`

This mismatch is a likely reason company name, address, and logo may not appear on generated portal statement PDFs.

### Finding 3 - Logo library works with live image cards

Brand Settings displays uploaded logos as image cards.

PDF Master Studio also displays logos as live image cards for:

- document logo
- watermark logo

This part is directionally correct.

### Finding 4 - Watermark live preview exists

PDF Master Studio currently previews logo/text watermark with opacity and scale sliders.

The opacity slider changes CSS opacity in the preview, so the brightness/visibility changes live.

### Finding 5 - Color picker card frame is already using an inner swatch pattern

The Studio `ColorControl` uses:

- outer bordered wrapper
- inner swatch with padding
- hidden native color input overlay

This preserves the card frame/border and avoids filling the entire frame.

Other color controls elsewhere should follow this pattern if they currently flood the whole card.

### Finding 6 - Two PDF template systems coexist

There is:

- master doc: `settings/pdfTemplate_default`
- per-document collection: `settings/pdfTemplates/templates/{documentType}`

The engine merges both.

Risk: if future changes only update one path, the preview and generated PDFs may drift.

### Finding 7 - Portal Statement has a separate PDF path

`portalStatement` immediately goes to `generatePremiumPortalStatement`.

That function is visually custom and uses fixed assumptions. It bypasses several normal engine features.

Risk: styling, logo, scanned contact toggles, and footer behavior can differ from other PDFs.

### Finding 8 - WhatsApp proforma expects a URL that the generator does not return

`ProformaInvoicesPage.jsx` has a WhatsApp flow that calls:

```js
generateTenantPdf({ save: true })
```

Then expects:

```js
pdfRes.url
```

The generator does not currently upload or return a URL. It only saves locally or returns base64/doc. This is likely a broken flow.

### Finding 9 - Template contract still allows non-A4 settings

`normalizePdfTemplatePayload` still accepts Letter and landscape, although the generation requirement says fixed A4 portrait with no page-size overrides.

The main generator is A4 portrait, but the exposed template contract can confuse future UI/storage.

### Finding 10 - Footer plan is partially present

Engine has default footer text per document type.

PDF Master Studio saves `documentConfigs` and marks `footerMode: 'system'`.

But page-specific default/non-editable footer content is not fully finalized because several requested pages/call sites are missing.

## 14. Files Scanned

Rules and project:

- `PROJECT_RULES.md`
- `SETTINGS_DATA_RULES.md`
- `WORKING_PLAN.md`
- `tenant-app/AGENT_HANDOVER_PORTAL_RULES.md`
- `tenant-app/package.json`
- `tenant-app/tailwind.config.js`
- `tenant-app/src/index.css`

Routing and layout:

- `tenant-app/src/App.jsx`
- `tenant-app/src/config/tenants.js`
- `tenant-app/src/config/appNavigation.js`
- `tenant-app/src/components/layout/AppLayout.jsx`
- `tenant-app/src/components/layout/DesktopLayout.jsx`
- `tenant-app/src/components/layout/MobileLayout.jsx`
- `tenant-app/src/components/layout/PageShell.jsx`
- `tenant-app/src/components/layout/UniversalPageHeader.jsx`
- `tenant-app/src/components/layout/AppSidebar.jsx`
- `tenant-app/src/components/layout/DesktopHeader.jsx`

Settings and branding:

- `tenant-app/src/pages/SettingsPage.jsx`
- `tenant-app/src/components/settings/SettingCard.jsx`
- `tenant-app/src/components/settings/BrandDetailsSection.jsx`
- `tenant-app/src/components/settings/BrandingSubsections.jsx`
- `tenant-app/src/components/settings/PdfMasterStudioSection.jsx`
- `tenant-app/src/components/settings/ApplicationIconLibrarySection.jsx`
- `tenant-app/src/components/settings/IDRulesSection.jsx`

PDF:

- `tenant-app/src/lib/pdfGenerator.js`
- `tenant-app/src/lib/pdfTemplateRenderer.js`
- `tenant-app/src/lib/pdfTemplateStorage.js`
- `tenant-app/src/components/pdf/PDFViewer.jsx`
- `tenant-app/src/components/pdf/PDFStudioConfig.jsx`
- `tenant-app/src/components/pdf/DocumentTemplate.jsx`

Storage/helpers:

- `tenant-app/src/lib/backendStore.js`
- `tenant-app/src/lib/syncEvents.js`
- `tenant-app/src/lib/brandLogoStorage.js`
- `tenant-app/src/hooks/useTenantBrandingLogos.js`

PDF-producing pages/components:

- `tenant-app/src/pages/QuotationPage.jsx`
- `tenant-app/src/pages/ProformaInvoicesPage.jsx`
- `tenant-app/src/pages/PortalDetailPage.jsx`
- `tenant-app/src/components/portal/ReportsSection.jsx`
- `tenant-app/src/components/portal/RecentTransactionsSection.jsx`
- `tenant-app/src/components/portal/InternalTransferSection.jsx`

## 15. Implementation Guardrails for Next Step

Before changing code, the safest next implementation order is:

1. Normalize the PDF document type list across Studio, renderer, engine, and backend allowlist.
2. Add/restore missing user-facing pages or entry points for claim, acknowledgement, client statement, invoice, payment, and portal statement quotation.
3. Fix the portal statement branding mismatch so it reads the same scanned branding fields and logo library as the normal engine.
4. Keep the Studio as the source of master layout settings, but decide whether per-document templates remain active or are migrated into the master structure.
5. Enforce fixed A4 portrait in UI/storage normalization, not only inside the generator.
6. Keep every settings write using `user.uid`, `updatedAt`, camelCase, and `createSyncEvent`.
7. Validate the generated PDFs visually after changes because the portal statement path and normal PDF path are currently different engines.

## 16. Short Understanding Summary

The tenant app already has the core pieces for a PDF Master Studio: a settings tab, a scanned branding UI, logo library cards, watermark preview, granular contact visibility, and a safe-ish A4 PDF generator. The main problem is not only front-end polish. The bigger issue is alignment across data fields and document types. Branding saves modern fields such as `companyName`, `addresses`, `logoLibrary`, and `activeLogoUrl`, while some PDF paths still read older fields such as `legalName`, `officeAddress`, `logoUrl`, and `iconUrl`. Also, several requested PDF document pages exist in the Studio/engine as names, but not yet as active app workflows.
