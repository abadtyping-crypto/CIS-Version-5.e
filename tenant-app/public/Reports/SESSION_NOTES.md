# ACIS Project — Session Notes
Last Updated: 2026-04-02 (Session from ~19:00 to 05:30 GST+4)

---

## 1. Project Overview
- **Project:** ACIS Typing — Multi-tenant Document Management + WhatsApp Delivery System
- **Type:** Vite + React developer portal (admin only), separate from main Electron app
- **Dev Server:** `npm run dev` → runs at `http://localhost:5173`
- **Database:** Firebase Firestore
- **Key file:** `developer-app/src/pages/PlatformSettingsPage.jsx`

---

## 2. WhatsApp/Meta Status (BLOCKED - PENDING META SUPPORT)

### Assets
| Asset | Value |
|---|---|
| Verified Business Portfolio | Abad Commercial Information Services |
| Correct Portfolio ID | `946384358564838` |
| WABA ID | `1269026171864714` |
| ACIS Typing App ID | `26215201534789429` |
| App currently in (WRONG portfolio) | Abadtyping — ID: `4528217927408109` |
| Verified Phone | +971551012119 |
| Business Email | info@abadtyping.com |

### The Problem
- ACIS Typing app is in the WRONG unverified portfolio (`4528217927408109`)
- Correct VERIFIED portfolio (`946384358564838`) is not accessible from any current login
- Meta Support ticket has been submitted requesting transfer
- **DO NOT make more changes in Meta UI — wait for support reply**

### Accounts Center Status (as of end of session)
- Instagram `@abadtyping` ✅ connected to Facebook `Abad Typing` in Accounts Center
- The verified Abad Commercial portfolio still requires the original Gmail to access
- The original Gmail was found in Thunderbird backup — password recovery partially done

### Temporary Workaround
- Can use temporary 24-hour token from developers.facebook.com → ACIS Typing → WhatsApp → API Setup
- Update token in Platform Settings → Test Handshake works in dev mode

---

## 3. Google Drive Integration — PLANNED (NOT YET BUILT)

### Architecture Plan
```
Scan/OCR → File Manager
     ↓
Admin Google Drive (UID-based folders per tenant/client)
     ↓
Drive File ID → saved in Firestore
     ↓
Firestore converts ID → view link URL
     ↓
Displayed in app iframe
```

### Tiers
- **Premium plan** → Direct Firestore storage (fastest)
- **Silver plan** → Google Drive storage

### What needs to be built
1. Google Cloud Project + OAuth2 credentials
2. Google Integration section in PlatformSettingsPage
3. Admin OAuth connect button → stores token in `system_configs/google_integration`
4. Drive folder creation by UID
5. File upload → Drive → get file ID → store in Firestore

---

## 4. Gmail Integration — PLANNED (NOT YET BUILT)
- Admin-level OAuth authentication
- UID-based — one update propagates to all
- Plan not fully defined yet — to be discussed next session

---

## 5. Platform Settings Page — Current State
- File: `developer-app/src/pages/PlatformSettingsPage.jsx` (1069 lines)
- WhatsApp section: ✅ Complete with Test Handshake
- Gmail section: ❌ Not built
- Drive section: ❌ Not built
- Broadcast section: ✅ Complete
- Logo/Branding section: ✅ Complete

---

## 6. Known Bugs/Issues
- Multiple AI agents have worked on this project with inconsistent approaches
- Some backend logic still needs testing
- Rules written in project folder are NOT being read by AI agents consistently
- Reusable UI components are implemented (good practice maintained)

---

## 7. Business Context
- Developer is hired temporarily by investors
- 15-day project now at 45+ days
- Payment on hold until completion
- Investors own: domain, Facebook account, Instagram, business portfolio
- Developer built everything using investor-provided credentials

---

## 8. Next Session Priorities
1. **Google Cloud Project setup** — check console.cloud.google.com for existing project
2. **Build Google Drive Integration** in PlatformSettingsPage
3. **WhatsApp** — check if Meta Support replied, apply their fix
4. **Gmail Integration** — define exact plan then build

---

## 9. Developer App Port
- Always running on `localhost:5173`
- Start with: `npm run dev` in `developer-app/` folder
- Firebase project: ACIS (check firebase.js for config)
