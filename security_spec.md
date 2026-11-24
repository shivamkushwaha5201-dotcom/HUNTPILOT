# Security Specification: HuntPilot AI Firestore Rules

## 1. Data Invariants

1. **Strict Ownership**: Every document in `users`, `projects`, `launchDrafts`, `analysisReports`, `academyProgress`, `chatMessages`, `competitorResearch`, `activities`, `phConnections`, `launchSchedules`, and `savedIntelligence` belongs strictly to one authenticated, email-verified user (`request.auth.uid`).
2. **PII & Credential Isolation**: User profile documents (`/users/{userId}`) contain `email` and personal profile data. Blanket `list` queries on `/users`, `/academyProgress`, and `/phConnections` are denied; `get`, `create`, and `update` are strictly restricted to `request.auth.uid == userId`. OAuth access/refresh tokens MUST NEVER be stored in Firestore (`phConnections` stores non-secret connection status only).
3. **Referential Integrity**: A `LaunchDraft`, `AnalysisReport`, or project-scoped `LaunchSchedule` cannot be created without referencing an existing `Project` whose `ownerId` matches `request.auth.uid`.
4. **Immutable Ownership & Creation Timestamps**: `ownerId`, `id`, and `createdAt` cannot be modified after creation. `createdAt` on create and `updatedAt` on update must equal `request.time`.
5. **No Self-Assigned Paid Plans**: `planTier` is strictly constrained to `'free'` on creation and cannot be escalated by client writes.
6. **Strict Payload Boundaries**: Every string, array, and object is bounded by explicit `.size()` checks and `hasAll`/`hasOnly` key allowlists to prevent shadow-field injection and resource exhaustion.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Identity Spoofing on Project Create**: Creating `/projects/proj-1` with `ownerId: "victim-uid"` while signed in as `attacker-uid` -> `PERMISSION_DENIED`.
2. **Shadow Field Injection on User Profile / PH Connection**: Creating `/phConnections/attacker-uid` with extra ghost field `accessToken: "secret"` -> `PERMISSION_DENIED`.
3. **Plan Escalation on User Profile Update**: Updating `/users/attacker-uid` with `planTier: "agency"` -> `PERMISSION_DENIED`.
4. **Unverified Email Write**: Creating `/projects/proj-1` or `/launchSchedules/sched-1` when `request.auth.token.email_verified == false` -> `PERMISSION_DENIED`.
5. **Orphaned Launch Draft / Schedule**: Creating `/launchSchedules/sched-1` referencing non-existent `projectId: "missing-proj"` -> `PERMISSION_DENIED`.
6. **Cross-Tenant Draft Hijack**: Creating `/launchDrafts/draft-1` referencing another user's existing `projectId` -> `PERMISSION_DENIED`.
7. **ID Poisoning**: Creating `/projects/invalid..id/slash` or a 1.5KB project ID -> `PERMISSION_DENIED`.
8. **Client-Forged Timestamp**: Creating `/savedIntelligence/intel-1` with `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time` -> `PERMISSION_DENIED`.
9. **Immutable Owner Tampering**: Updating `/launchSchedules/sched-1` to change `ownerId` or `projectId` -> `PERMISSION_DENIED`.
10. **Blanket Enumeration**: Listing `/users` or `/phConnections` collection -> `PERMISSION_DENIED`.
11. **Unscoped List Query**: Listing `/projects` or `/launchSchedules` without filtering `ownerId == request.auth.uid` -> `PERMISSION_DENIED`.
12. **Array / String Overflow (Denial of Wallet)**: Creating `/launchDrafts/draft-1` with 25 taglines or a 50KB description -> `PERMISSION_DENIED`.

