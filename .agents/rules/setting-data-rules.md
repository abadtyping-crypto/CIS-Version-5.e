---
trigger: always_on
---

Anti-Gravity Project: Mandatory Setting Data Rules
All agents, services, and modules within the Anti-Gravity Project MUST adhere to the following data standards and rules for all Settings, Portal, Application, and transactional/metadata documents.
1. Identity Source of Truth (Mandatory UID Only)
User Identity Source: User identity must be resolved via uid only.
Creation/Update Tracking: The fields createdBy and updatedBy must store only the user's uid string.
ID Policy: Never store randomly generated IDs when the Firebase document ID is sufficient and exists. If an additional ID is absolutely required, it must be documented in a code comment and must remain deterministic (e.g., derived from key input fields).
2. Data Shape Standard
Field Naming: Backend and Firestore field names must be exclusively in camelCase.
Profile Duplication Avoidance: Avoid storing duplicate user profile fields (e.g., name, email, phone, role) within settings or transactional documents when these details can be resolved from the uid during a read operation.
Document Scoping: Keep each settings document domain-scoped (e.g., profileSettings, preferenceSettings, securitySettings) with a minimal set of relevant fields.
3. Minimal Data Usage & Relational Reads (Write Minimum, Read More)
Storage Minimization: Store only the fields strictly required for rendering the UI or for policy checks.
Write Minimum: For example, createdBy is stored as just a UID string.
Connect on Frontend: The frontend is responsible for resolving that UID to display relational details (e.g., avatar, display name, role, profile route, history).
NO PLACEHOLDER WRITING: Backend Firestore writes must contain only necessary, non-placeholder data.
Derived Value Prohibition: Do not persist derived or computed values (e.g., formatting labels, display text, computed summaries, client-side formatted dates).
Large Data Structures: Do not store large arrays or objects in settings documents if the data can be queried on demand from other collections.
Data Density: Prefer boolean flags and compact enums over verbose objects or long string representations.
4. Write Rules for All Transactions/Settings
Update Operations: Every write operation (including partial updates) must include:
updatedAt (server timestamp)
updatedBy (uid only)
Create Operations: Every creation operation must include:
createdAt (server timestamp)
createdBy (uid only)
Customization Policy: Customization must be strictly user-specific (keyed by uid or user document path). No writes based on role-wise branching in settings payload are allowed.
5. Read Rules & Relational Wiring (Crucial Wiring Rule)
User Detail Resolution: Resolve user display details (Avatar, Display Name, Role, History) from the core auth/user collection by uid at read time.
Identity Storage Ban: Do not write user names, avatars, or roles directly into transactional/settings/metadata documents. Retrieve the uid stored in the document, and use it for the lookup.
Client Trust: Do not trust or authorize based on client-passed identity fields (like user role, name, or tenant ID).
Tenant Scoping: All tenant-aware read paths must stay under the /t/:tenantId/... context.
6. Customization Policy
User-Wise Only: All customization (settings, portals, applications, future modules) must be stored user-wise only.
Role-Wise Customization Ban: No role-wise customization storage is permitted.
7. Sync Events Rule for Offline Devices (Mandatory)
Mandatory Record: For every successful create, update, delete, or action-state change operation, a single, short record must be created in the /syncEvents collection.
Mandatory Fields:
tenantId
eventType (e.g., CREATE, UPDATE)
entityType (e.g., Setting, Portal)
entityId (the ID of the document that changed)
changedFields (an array of field names only)
createdAt (server timestamp)
createdBy (uid only)
syncStatus (must be pending upon creation)
Payload Limit: Never store full document snapshots or large data payloads in /syncEvents. Keep the record minimal to facilitate fast delta syncing.
