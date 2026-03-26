# SETTINGS DATA RULES

## 1) Identity Source of Truth
- User identity source is `uid` only.
- `createdBy` must store only `uid` string.
- Never store random generated IDs when Firebase document ID already exists and is sufficient.
- If additional ID is absolutely required, document why in code comment and keep deterministic.

## 2) Data Shape Standard
- Backend and Firestore field names must be camelCase only.
- Avoid duplicate user profile fields in settings docs (`name`, `email`, `phone`, `role`) when they can be resolved from `uid`.
- Keep each settings document domain-scoped (`profileSettings`, `preferenceSettings`, `securitySettings`) with minimal fields.

## 3) Minimal Data Usage & Relational Reads
- Store only fields required for rendering or policy checks. **Write minimum (e.g. `createdBy` is just a UID string) but connect with more on the frontend** (e.g. resolve that UID to display their avatar, name, role, profile route, and history).
- **NO PLACEHOLDER WRITING** in Backend Firestore. Write only necessary data.
- Do not persist derived values (formatting labels, display text, computed summaries).
- Do not store large arrays/objects in settings if they can be queried on demand.
- Prefer boolean flags and compact enums over verbose objects.

## 4) Write Rules for Settings Page
- Every write must include:
  - `updatedAt` (server timestamp)
  - `updatedBy` (uid only)
- Create operations must include:
  - `createdAt` (server timestamp)
  - `createdBy` (uid only)
- No writes based on role-wise branching in settings payload.
- User-specific customization only (keyed by uid or user document path).

## 5) Read Rules & Relational Wiring
- **Crucial Wiring Rule:** Resolve user display details from auth/user collection by `uid` at read time. Do not write user names, avatars, or roles directly into transactional/settings docs.
- Retrieve the `uid` stored in the document, and use it to fetch the latest Avatar, Display Name, Role, and History when displaying it in the UI.
- Do not trust client-passed identity fields.
- Tenant-aware read path must stay under `/t/:tenantId/...` context.

## 6) Customization Policy
- No role-wise customization storage.
- All customization must be user-wise only.
- This same rule applies to:
  - settings
n  - portals
  - applications
  - any future module

## 7) Portal and Application Wiring
- Use same metadata discipline as settings:
  - `createdBy: uid`
  - `updatedBy: uid`
- Do not copy user details into portal/application docs.
- Fetch required user info from `uid` join/lookup only when needed.
- Application Icon Library docs must use deterministic doc IDs from icon names (no random UID), with mandatory `iconName` and compressed icon asset URLs.
- Portal transaction writes for portal-management flows must use `tenants/{tenantId}/portalTransactions` (not generic `transactions`).
- Portal creation notifications should include `routePath` for deep-link navigation to the created portal detail page.

## 8) Validation and Security
- Validate payload keys against allowed schema before write.
- Reject unknown fields in backend layer.
- Enforce ownership/tenant checks server-side using `uid` and tenant context.
- Never authorize by client-side role flags.

## 9) Migration Rules (Existing Data)
- Remove duplicated identity fields from settings/portal/application docs.
- Backfill missing `createdBy`/`updatedBy` with known uid if available.
- Convert non-camelCase keys to camelCase.
- Keep migration idempotent and logged.

## 10) Settings Page Implementation Checklist
- [ ] All write payload keys are camelCase.
- [ ] `createdBy` / `updatedBy` store uid only.
- [ ] No random UID field unless required and documented.
- [ ] No role-wise customization persisted.
- [ ] User-wise customization path confirmed.
- [ ] No duplicated user profile fields in settings docs.
- [ ] Backend validation rejects extra/unexpected fields.

## 11) Canonical Example
```json
{
  "theme": "dark",
  "language": "en",
  "notificationEnabled": true,
  "createdAt": "serverTimestamp",
  "createdBy": "uid_abc123",
  "updatedAt": "serverTimestamp",
  "updatedBy": "uid_abc123"
}
```

## 12) Non-Compliant Example (Do Not Use)
```json
{
  "Created_By": "John Doe",
  "role": "Admin",
  "userName": "John",
  "customizationByRole": {
    "Admin": { "theme": "dark" }
  },
  "randomUid": "xyz-123-987"
}
```

## 13) Sync Events Rule for Offline Devices (Mandatory)
- For every create/update/delete/action-state change, also create one short `/syncEvents` record.
- Mandatory fields:
  - `tenantId`
  - `eventType`
  - `entityType`
  - `entityId`
  - `changedFields` (field names only)
  - `createdAt`
  - `createdBy` (uid only)
  - `syncStatus` (`pending`)
- Keep payload minimal; never store full document snapshots in `/syncEvents`.
- This rule applies to settings, portal, application, and all future modules.
