# ACIS WORKING PLAN
# Every agent MUST read this before touching any code.
# Updated: 2026-04-02

---

## RULE #1 FOR EVERY AGENT
Before writing a single line of code, you MUST:
1. Read `PROJECT_RULES.md` fully
2. Read `SETTINGS_DATA_RULES.md` fully
3. Read this file fully
4. Ask the developer if ANYTHING is unclear
5. Never implement backend/Firestore changes without explicit developer approval

---

## CURRENT PROJECT STATE

### Developer Portal (localhost:5173)
- Path: `developer-app/`
- Status: Running (`npm run dev`)
- Auth: Firebase Google Auth → Firestore `acisDev` collection

### Tenant App
- Path: `tenant-app/`
- Status: In development

---

## COMPLETED IN THIS SESSION (2026-04-02)

### 1. WhatsApp API — Platform Settings
- File: `developer-app/src/pages/PlatformSettingsPage.jsx`
- Feature: Test Handshake UI fixed (status display now shows properly)
- Status: ✅ Done — BLOCKED on Meta account access (see Meta Issue below)

### 2. Google Integration Section — Platform Settings
- File: `developer-app/src/pages/PlatformSettingsPage.jsx`
- Firestore path: `system_configs/google_integration`
- Fields stored: `isDriveEnabled`, `driveFolderId`, `gmailSender`, `isGmailEnabled`
- Status: ⚠️ UI done but handler has rule violations (see Known Issues)

### 3. DownloadPage.jsx
- Deleted — was orphaned, no route connected
- Old Apps Script bridge plan was dropped by developer

---

## KNOWN ISSUES (Must Fix)

### Issue 1 — Google Integration Handler (Priority: High)
- File: `PlatformSettingsPage.jsx`
- Function: `handleSaveGoogleIntegration`
- Problems:
  - Missing `updatedBy: uid` (violates SETTINGS_DATA_RULES #4)
  - Storing static `serviceAccountEmail` in Firestore (violates "no placeholder writing" rule)
- Fix needed: Add `updatedBy`, remove static service account email field

### Issue 2 — Google Integration UI Label (Priority: Low)
- "Gmail Email Delivery" should be "SMTP / Email Gateway" to support Outlook users
- Developer approved this change — pending implementation

---

## PLANNED FEATURES (Discuss Before Building)

### Feature A — PDF / Browser Viewer
- Location in app: TBD — need developer to confirm which page/section
- Purpose: View Drive documents (invoices, passports, etc.) inside the app
- Requirements needed:
  - [ ] Which page/tab should it appear on?
  - [ ] What file types? (PDF only? Also images?)
  - [ ] Where do files come from? (Drive URL, Firestore URL, local?)
- Status: ❌ NOT started — discussion needed first

### Feature B — Google Drive File Upload
- Purpose: Move invoices/documents to Super Admin's Drive folder
- Plan: Files → Super Admin Drive Folder (organized by UID subfolders)
- Requirements needed:
  - [ ] Drive API enabled in Google Cloud project `acis-bridge`?
  - [ ] OAuth2 Web Client ID from console.cloud.google.com
  - [ ] OR plan to use Firebase Cloud Functions with service account
- Status: ❌ NOT started — requirements needed first

### Feature C — SMTP / Email Gateway
- Purpose: Automated emails to clients (optional per tenant plan)
- Setup location: Welcome Page (first login flow) OR Platform Settings
- Fields needed: SMTP Host, Port, Email, App Password
- Status: ❌ NOT started — discussion needed

### Feature D — Welcome Setup Page (First Login Flow)
- Shown on first Super Admin login only
- Steps in welcome page:
  1. Tenant eligibility check
  2. ID prefix setup
  3. Brand settings
  4. Email/SMTP setup (optional)
  5. Drive folder setup (optional)
- After completion: page permanently hidden (support can restore)
- Status: ❌ NOT started — after testing phase

---

## META / WHATSAPP ISSUE (External Blocker)

### Status: Waiting for Meta Support
- ACIS Typing App ID: `26215201534789429`
- Target Portfolio: Abad Commercial (ID: `946384358564838`)
- Current Portfolio (wrong): Abadtyping (ID: `4528217927408109`)
- WABA ID: `1269026171864714`
- Meta Support ticket submitted — waiting for reply

### When Meta Support Resolves:
1. Generate System User Access Token in verified portfolio
2. Update token in Platform Settings → Test Handshake
3. WhatsApp integration is production-ready

---

## HOW TO USE THIS FILE

At start of each session:
1. Agent reads this file
2. Agent reads PROJECT_RULES.md
3. Agent reads SETTINGS_DATA_RULES.md
4. Agent discusses with developer before ANY implementation
5. After session: agent updates "COMPLETED" and "KNOWN ISSUES" sections

---

## SERVICE ACCOUNT INFO (DO NOT PUT IN FRONTEND CODE)
- Project: `acis-bridge`
- Service Account Email: `acis-bridge@acis-bridge.iam.gserviceaccount.com`
- Key file: `developer-app/.env/acis-bridge-da5918e1c73c.json`
- ⚠️ NEVER import this file in React/frontend code
- Use only in: Firebase Cloud Functions (backend)
