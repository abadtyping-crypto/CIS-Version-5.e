# PROJECT RULES

## 1) Scope and Goal

- Build a multi-tenant admin platform with 14 pages and ~72 components, targeted for **Electron (Desktop)** and **Mobile**.
- **Crucial UI Split:** The UI served on the Electron Desktop view is COMPLETELY separate from the Mobile view. They must be wired and designed separately. (Do not serve the same UI for both).
- Keep all implementation clean-room (no legacy code copy/paste).
- Optimize for premium UI quality, maintainability, and predictable delivery.

## 2) Core Architecture

- Route pattern must be tenant-first: `/t/:tenantId/<page>`.
- Tenant state is global context; page components never hardcode tenant-specific business values.
- Use composition: pages in `src/pages`, reusable units in `src/components`, providers in `src/context`, constants/config in `src/config`.
- One-way data flow only: provider/page state -> props -> presentational components.

## 3) Component Separation Rules

- One component = one responsibility.
- Split by function, not by size only.
- Presentational components must not fetch data or contain routing logic.
- Business logic lives in hooks, providers, or page containers.
- If a component handles more than one domain concern, split it.

## 4) Naming and File Conventions

- Use explicit names: `ProfileSection`, `InvoicePreferencesPanel`, `TenantSwitcher`.
- Component files use PascalCase; utility/config files use camelCase.
- Avoid ambiguous names like `Common`, `Helper`, `Data`, `Misc`.
- Keep imports absolute/clear and grouped by: external, context/config, local components.

## 5) Multi-Tenant Rules

- Source tenant definitions from `src/config/tenants.js`.
- Always validate route `tenantId`; invalid tenant must redirect to default tenant.
- Tenant switcher must navigate to equivalent tenant route where possible.
- Tenant brand values (accent, locale, currency) are consumed through context only.

## 6) Theme System Rules

- Support `light` and `dark` themes from day one.
- Theme state persists in `localStorage`.
- UI colors must come from CSS variables (`--c-*`) only.
- No direct hex colors in component JSX classes unless truly exceptional.

## 7) Responsive and Layout Rules

- Mobile-first implementation mandatory for mobile views.
- **Strict UI Separation:** Desktop (Electron) and Mobile components must be completely split. 
- **Mobile UI Guidelines:** Serve limited options. Avoid unwanted text titles; convey meaning with icons heavily (e.g., `Application` = 🧾, `Search` = 🔎).
- Supported widths: 320px mobile, tablet, desktop wide.
- No horizontal overflow at 320px.
- Minimum interactive target size: 44px height.
- Prefer grid/flex composition with clear breakpoint behavior.

## 8) UI Quality Rules (Premium Standard)

- Use intentional typography (title/body pairing, clear hierarchy).
- Avoid generic flat layouts; include subtle depth (surface, border, spacing rhythm).
- Motion should be minimal and meaningful (state change, reveal, theme transition).
- Keep density balanced: compact but readable.
- Client/Dependent identity selectors must use a single searchable icon dropdown control (no split search+select controls).
- Client/Dependent icons must use shared resolver logic and prioritize emirate-specific icons before generic type icons.
- Dropdown icons must use a minimum visible size of 24px (`h-6 w-6`) for dark-theme legibility.

## 9) Accessibility Rules

- Every control has label or `aria-label`.
- Keyboard navigation must work across page controls.
- Maintain visible focus states.
- Contrast must remain readable in both light and dark modes.

## 10) State and Form Rules

- Keep form defaults in page-level constants or config objects.
- Controlled inputs for editable settings pages.
- Validation rules are explicit and colocated with feature domain.
- Save/cancel/reset actions must be deterministic.

## 11) Error Handling and Empty States

- Every async block must define loading, success, and error states.
- Show actionable error messages; avoid silent failures.
- Empty states must explain next action.

## 12) Performance Rules

- Avoid unnecessary rerenders: memoize derived data where useful.
- Lazy-load heavy pages/modules when it improves startup.
- Keep component trees shallow and predictable.

## 13) Testing and Verification Rules

- Minimum verification per milestone:
- `npm run build` must pass.
- Manual responsive check at mobile and desktop widths.
- Manual tenant route check for at least 2 tenants.
- Theme toggle check (light/dark persistence after refresh).

## 14) Delivery Workflow

- Build one page at a time.
- For each page: define route -> define components -> implement UI -> wire state -> verify.
- Do not move to next page until current page is stable.
- Keep changelog notes short and file-referenced.

## 15) Git and Change Safety

- Never rewrite unrelated files.
- Avoid destructive operations.
- Keep commits scoped to a single page/feature when possible.

## 16) Immediate Build Order

- Phase 1: foundation (tenant + theme + shell + rules).
- Phase 2: implement pages one-by-one with strict component split.
- Phase 3: harden interactions, validation, and consistency pass.

## 17) Offline Sync Events Rule (Mandatory)

- Any data-changing operation must create a short `/syncEvents` entry.
- Applies to all modules: settings, portal management, applications, transactions, profile, notifications, and future modules.
- A write/change is not complete unless the domain write + sync event write both succeed.
- Keep sync event payload minimal to reduce data usage for offline devices.
- Required sync event fields:
  - `tenantId`
  - `eventType` (create/update/delete/statusChange/action)
  - `entityType` (portal/application/transaction/settings/user/...)
  - `entityId` (UID/docId)
  - `changedFields` (array of keys only, no heavy object copy)
  - `createdAt` (server timestamp)
  - `createdBy` (uid only)
  - `syncStatus` (`pending`)
- Do not store full entity snapshots in `/syncEvents`.
- Consumers (offline devices/electron/mobile) must replay events from `/syncEvents` to stay in sync.

## 18) Electron Specific Rules

- **Environment**: Use Electron for desktop distribution and build separate views for Mobile (APK). Use Web view for development only; URLs will be completely hidden in production.
- **Process Separation**: Strictly separate Main process (Node.js) and Renderer process (React).
- **Security**: Enable `contextIsolation`, `sandbox`, and disable `nodeIntegration` in the renderer.
- **Communication**: Use `ipcMain` and `ipcRenderer` via a `preload.js` script for all communication between processes.
- **Native Interops**: Any native OS feature (file system, printing, native notifications) must be gated behind IPC.
- **Event Token Persistence**: The "Event Token" (Sync Event issuing) must be consistent across all open windows/pages.
- **Distribution**: Target Windows platform primarily for Electron, APK for mobile.

## 19) Global Enforcement (All Pages, No Exceptions)

- These rules apply to every page/component/module, including newly added files and refactors.
- If a page conflicts with these rules, the page must be updated to match rules (not the opposite).
- New UI/logic work is incomplete until rule compliance is validated for:
  - route pattern
  - tenant scope
  - theme variables
  - validation behavior
  - sync event write requirement for data-changing flows
- Dependent storage must be single-source only:
  - Allowed path: `tenants/{tenantId}/clients/{parentClientId}/dependents/{dependentId}`
  - Disallowed: mirroring the same dependent document into `tenants/{tenantId}/clients/{dependentId}`
- Portal balance field is canonical and mandatory:
  - All portal reads/writes must use lowercase `balance` as source of truth.
  - `balanceType` must be derived from `balance` (`positive` or `negative`).
  - Do not introduce or persist alternate keys like `Balance`.
- Portal transaction storage path is mandatory:
  - Portal-only transactions (opening balance, internal transfer, loan portal-side entries, portal reports/history) must read/write `tenants/{tenantId}/portalTransactions`.
  - Do not write portal-only transaction records into `tenants/{tenantId}/transactions`.
- Currency/icon rule (strict):
  - Do not use dollar symbols/icons or USD labels anywhere in UI or documents.
  - All monetary displays must use AED and the shared `DirhamIcon`/`CurrencyValue` components (or plain `AED` text in select labels where icons aren’t supported).
  - Print/PDF outputs must also show AED (no `$` glyphs).
- Portal transaction ID consistency:
  - For portal transactions, `displayTransactionId` and document ID strategy must stay deterministic (`toSafeDocId(displayTransactionId, 'portal_tx')` or deterministic suffix variant).
  - No random UID fallback for portal transaction docs.
- Portal create lifecycle rule:
  - Portal creation must create both `/syncEvents` and `/notifications` records.
  - Notification payload must include `routePath` to the exact portal detail route: `/t/{tenantId}/portal-management/{portalId}`.
- Portal detail page rule:
  - Every portal must be addressable via `/t/:tenantId/portal-management/:portalId`.
  - This page is the canonical place for full portal history + portal-specific customization.
- Transaction ID rules must be applied on document IDs where configured:
  - Loan Persons document ID must follow `transactionIdRules.LOAN` prefix/padding (no random `lp_*` IDs).
  - Loan Transactions display ID must follow `transactionIdRules.LON`.

## 20) Agent Preflight Checklist (Mandatory Before Any Change)

- Read `PROJECT_RULES.md` fully before implementation.
- Read `SETTINGS_DATA_RULES.md` fully before implementation.
- Confirm tenant-safe path and data-shape assumptions before editing code.
- Confirm source-of-truth IDs before creating/writing documents.
- Do not proceed with implementation if any rule is unclear; clarify first.

## 21) Agent Handoff Clarity Standard

- Every implementation must leave enough signals for future agents to identify conventions quickly:
  - shared resolver/util location for repeated logic
  - explicit naming for rule-driven fields
  - rule references in plan/docs when behavior changes
- When introducing new reusable patterns (icons, badges, selectors, IDs), add/update the corresponding rule line in this file immediately.
- Applications Icon Library standard (mandatory for future pages/modules):
  - Source path: `tenants/{tenantId}/settings/applicationIconLibrary/icons/{iconId}`
  - `iconId` must be deterministic from icon name (safe-doc-id transform), no random UID.
  - `iconName` is mandatory and editable; rename must migrate doc ID accordingly.
  - Reuploading an icon must automatically remove prior storage asset URL.
  - Icon uploads must be compressed (webp, reduced footprint) for lightweight reuse across upcoming pages.

## 22) Super Admin Role Rules

- **Singularity**: There is strictly only ONE Super Admin user per tenant.
- **Creation**: The Super Admin is *only* created by the developer during onboarding. They cannot be created via the standard User Customization or User Control Center pages by the tenant.
- **Backend Identifier**: The role ID in Firestore will be explicitly `super_admin`.
- **Frontend Display**: In the UI, this role must always be badged/displayed as **Owner** or **Founder**.
- **Privileges & Access Control**:
  - The Super Admin has "superpower" access with absolutely no restrictions to any page.
  - They are never blocked from any functionality.
  - They are the *only* role with access to the User Customization / Reference configurations.
  - They are the "plan manager" who can assign notifications and roles.
  - They receive *all* notifications by default.
- **UI Exclusions**: The `super_admin` role MUST be skipped/excluded from the standard 4-role customization triggers on the User Role Customization page, as their permissions are immutable and absolute.

## 23) Universal Input Design & Common Tools Rule (Strict)

- **Avoid Mismatch Designs**: All inputs, dropdowns, form controls, and multi-value fields MUST strictly adhere to the universal "Tab Size & Design" parameter. Agents must NEVER invent bespoke padding, random button widths, or differing border logic.
- **Universal Tab Size**:
  - The absolute standard for input blocks is `min-h-[56px]`.
  - Inner action buttons (like appended `Add New`, `Paste`, `WhatsApp`, `Remove/X`) located inside these tabs MUST be perfectly square: `h-[56px] w-[56px]`. Do not use skinny rectangular widths (e.g., avoid `w-10` or `w-11`).
  - Inputs must utilize `rounded-2xl`.
  - Styling must include: `border border-[var(--c-border)] bg-[var(--c-panel)] text-[var(--c-text)] shadow-sm`.
  - Focus logic must utilize: `focus-within:border-[var(--c-accent)] focus-within:ring-4 focus-within:ring-[var(--c-accent)]/5`.
- **Common Tools Must Be Reused**:
  - Do NOT build raw generic inputs for specialized data when a shared tool already exists.
  - **Generic Text / Number / URL / Multiline Input**: ALWAYS use `InputActionField` for standard text entry, paste/copy actions, uppercase transforms, append buttons, and multiline text areas.
  - **Mobile Numbers**: ALWAYS use `MobileContactsField` for multi-mobile entries or `CountryPhoneField` for one phone field with UAE/country formatting.
  - **Email Addresses**: ALWAYS use `EmailContactsField`.
  - **Contact Persons**: ALWAYS use `ContactPersonsField` for repeated contact person names.
  - **Addresses**: ALWAYS use `AddressField` for branch/company/client address text. Do not hand-roll address textareas.
  - **Identity Documents**: ALWAYS use `IdentityDocumentField` for Emirates ID, Passport, Person Code, Work Permit, and Unified Number input/type selection.
  - **Emirate Selection**: ALWAYS use `EmirateSelect` (do not replace it with raw `<select>` or `IconSelect`).
  - **Generic Dropdowns**: Use `GenericSelectField` for normal option lists and `IconSelect` only when icon-backed choices are required.
  - **Relationship Selection**: Use `RelationSelect` for family/dependent relationship fields.
  - **Portal Selection**: Use `PortalSelectField` for portal picking, `PortalMethodSelectField` for portal method choices, and `PortalTransactionSelector` for transaction selection inside portal workflows.
  - **Application Identity / Application Rows**: Use `ApplicationIdentityRow` and `ApplicationSignatureLine` for repeated application display/signature lines instead of recreating bespoke row layouts.
  - **Application Icon Quick Add**: Use `ApplicationIconQuickAddPanel` when a page needs quick application/icon creation from the shared icon library flow.
  - **Currency / AED Display**: ALWAYS use `CurrencyValue` and `DirhamIcon` for money display. Do not use `$`, `Dhs`, or raw AED text unless a PDF fallback requires plain text.
  - **Creator / User Attribution**: Use `CreatedByIdentityCard` for compact creator attribution displays.
  - **Document Actions**: Use `DocumentActionButton` for download/preview/print/email-style document action controls.
  - **Confirmations**: Use `ConfirmDialog` for destructive or confirmation flows.
  - **Prominent Validation / Error Awareness**: Use `FocusErrorOverlay` for blocking validation errors or important failures that must capture the user's attention. Do not hide critical errors only at the top/bottom of a long page.
  - **Action Progress**: Use `ActionProgressOverlay` or `ProgressVideoOverlay` for blocking generation/save/send progress states instead of one-off loading panels.
  - **Secure Preview / Quick View**: Use `SecureViewer` for secure document/PDF preview and `QuickViewModal` for structured record previews.
  - **Image Tools**: Use `ImageStudio` for image crop/edit workflows and `ImageZoomTool` for zoomable image viewing.
  - **Service Template Editing**: Use `ServiceTemplateEditor` for application/service template editing flows.
  - **Signatures**: Reuse `SignatureCard` for signature capture/display areas. Do not redesign it page-by-page.
- **Logo Display Standard**: Uploaded logos are square 512x512 assets and must be displayed in square containers with `aspect-square` and `object-cover` unless the specific task is document/PDF rendering where `object-contain` is explicitly needed. Logo selection rows should use the shared left-image-cover pattern: the image fills the left square of the option/card with no extra inner frame.
- **Raw HTML Exception**: Raw `<input>`, `<select>`, or `<textarea>` is allowed only for tiny local controls where no shared tool exists yet (for example a range slider, color picker, hidden file input, or internal search field). Even then, it must visually match the universal sizing, border, radius, focus, and theme-token rules.
- **Enforcement**: Any agent editing or creating a new page MUST first check `tenant-app/src/components/common/*` and reuse the matching component. New shared field components belong in `src/components/common`, not inside page files, when the pattern will appear more than once.
