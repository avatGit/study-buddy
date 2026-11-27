# StudyBuddy backend architecture

## Purpose and stack

This document is the backend implementation reference for the StudyBuddy V1 API. The stack is Node.js 24+, Express 5, TypeScript, MongoDB and Mongoose. The API is REST over HTTPS and uses JSON. Authenticated users can act as learners; a user with an active tutor profile also has tutor capabilities. University membership is optional and self-declared in V1, never presented as verified.

## Module structure

```text
api/src/
  app.ts                 # middleware and route mounting
  server.ts              # startup and graceful shutdown
  config/                # validated environment and Mongo connection
  middleware/            # auth, authorization, validation, errors, logging
  common/                # shared errors, pagination, response helpers
  modules/
    auth/ users/ universities/ subjects/ tutors/
    session-requests/ sessions/ disputes/ reviews/ notifications/
```

Each module may contain routes, controller, service, model/schema, validation and types. Routes map HTTP to controllers. Controllers parse the validated request and serialize a response. Services enforce business rules and transactions. Mongoose models define persistence. Keep business logic out of route/controller code.

## Common API contract

- Prefix: `/api`. Protected routes use `Authorization: Bearer <access-token>`.
- Derive the actor from the verified token, never from a client-supplied actor ID.
- Lists use `page` (1-based) and `limit` (default 20, maximum 100); return `{ items, page, limit, total }`.
- Success codes are listed per endpoint below. Errors use one envelope:

```json
{
  "error": {
    "code": "SLOT_CONFLICT",
    "message": "The selected time overlaps a confirmed session.",
    "status": 409,
    "details": []
  }
}
```

Common errors: `400 MALFORMED_REQUEST`, `401 UNAUTHENTICATED`, `403 FORBIDDEN`, `404 NOT_FOUND` (also use for out-of-scope objects to avoid disclosure), `409 CONFLICT`, and `422 VALIDATION_ERROR` or a domain-specific rule error. Error responses and logs must not contain credentials, tokens, password hashes or private data. Successful authentication responses return the tokens specified below over HTTPS.

## Authentication routes

| Method and path           | Access              | Success | Main errors and authorization                                                                                                     |
| ------------------------- | ------------------- | ------: | --------------------------------------------------------------------------------------------------------------------------------- |
| POST `/api/auth/register` | Public              |     201 | 400 malformed body, 409 email already registered, 422 invalid fields. Role is always `USER`; client cannot create an admin.       |
| POST `/api/auth/login`    | Public              |     200 | 400 malformed body, 401 invalid credentials, 422 invalid field format. Use a generic credential error.                            |
| POST `/api/auth/refresh`  | Valid refresh token |     200 | 400 malformed body, 401 expired, revoked, invalid or reused token. Rotate refresh tokens and store only their hashes server-side. |
| POST `/api/auth/logout`   | Authenticated user  |     204 | 401 missing/invalid access token. Revoke the current refresh-token session; repeated logout is idempotent.                        |

Authentication request and response bodies:

- Registration and login accept `{ "email": "...", "password": "..." }`. Email is trimmed and normalized to lowercase. Passwords must contain 8–128 characters.
- Registration returns `201`; login returns `200`. Both return `{ "user": { "id": "...", "email": "...", "role": "USER" }, "accessToken": "...", "refreshToken": "..." }`. `role` always comes from the stored user; registration ignores a client-supplied role.
- Refresh accepts `{ "refreshToken": "..." }`, returns `200` with the same response shape, and rotates both tokens. Missing/invalid request fields return `422`; invalid credentials or refresh tokens return `401 UNAUTHENTICATED`. Duplicate email returns `409 CONFLICT`.
- Logout requires an access-token Bearer header, accepts no request body and returns `204`. It revokes that token's refresh-token session; repeating logout is idempotent.
- Access tokens are short-lived HS256 JWTs signed with `ACCESS_TOKEN_SECRET`. Claims are `sub` (user ID), `sid` (session ID), `role`, `iat` and `exp`; lifetime is configured by `ACCESS_TOKEN_TTL`.
- Refresh tokens are 32-byte cryptographically random opaque values, returned to Flutter over HTTPS and stored by the client in secure storage. MongoDB stores only their SHA-256 hashes in one `authSessions` document per session. Refresh uses an atomic compare-and-swap on the stored hash and expiration, so only one concurrent use of a token can rotate successfully. Rotated or revoked tokens return `401 UNAUTHENTICATED`. Session expiration is extended by `REFRESH_TOKEN_TTL_DAYS` on rotation.
- Passwords are hashed with Argon2id. User email has a unique database index; the public registration role is always `USER`.

## Route catalogue

The access column identifies the required role or ownership check. All protected routes also require authentication. Unless specified otherwise, `400`, `401`, `403`, `404`, `409` and `422` may apply according to malformed input, identity, authorization, visibility, state conflict and validation respectively.

| Method and path                                          | Access                          |   Success | Main errors / checks                                                                                                                  |
| -------------------------------------------------------- | ------------------------------- | --------: | ------------------------------------------------------------------------------------------------------------------------------------- |
| GET `/api/universities`                                  | Public                          |       200 | Active universities only; optional selection, no proof of membership.                                                                 |
| GET `/api/subjects`                                      | Authenticated                   |       200 | Global plus user's optional university scope; validate filters and pagination.                                                        |
| GET `/api/tutors`                                        | Authenticated                   |       200 | ACTIVE profiles only; optional subject, minimum rating and day filters; exclude self; apply university/global scope.                  |
| GET `/api/tutors/:id`                                    | Authenticated, in scope         |       200 | Active profiles only; 404 absent, DRAFT, SUSPENDED or out of scope; public fields only.                                                |
| GET `/api/tutors/me/profile`                             | USER, owner                     | 200 / 404 | Read own DRAFT/ACTIVE/SUSPENDED profile, including own subject IDs and university affiliation.                                        |
| PUT `/api/tutors/me/profile`                             | USER, owner                     | 200 / 201 | Create/update own display name and bio; optional university affiliation update. Status, subject IDs and owner are server-controlled. |
| PUT `/api/tutors/me/subjects`                            | USER, owner                     |       200 | Replace subject associations; only active global or own-university subjects are allowed; 422 invalid association.                     |
| GET `/api/tutors/me/availabilities`                      | USER, owner                     |       200 | Read own recurring windows.                                                                                                           |
| POST `/api/tutors/me/availabilities`                      | USER, owner                     |       201 | Create recurring window; 409 overlapping window, 422 invalid interval/time zone.                                                      |
| PATCH `/api/tutors/me/availabilities/:availabilityId`    | USER, owner                     |       200 | Update own window only; 404 other/absent ID, 409 overlap, 422 invalid interval/time zone.                                              |
| DELETE `/api/tutors/me/availabilities/:availabilityId`   | USER, owner                     |       204 | Delete own window only; 404 other/absent ID.                                                                                          |
| POST `/api/tutors/me/exceptions`                         | USER, owner                     |       201 | Add date block or time range; 400 malformed date, 422 invalid range.                                                                  |
| DELETE `/api/tutors/me/exceptions/:exceptionId`          | USER, owner                     |       204 | 404 other/absent ID. Recommended contract completion.                                                                                 |
| POST `/api/tutors/me/publish`                            | USER, owner                     |       200 | DRAFT to ACTIVE only with non-empty bio, at least one active in-scope subject and availability; otherwise 422.                        |
| POST `/api/tutors/me/unpublish`                          | USER, owner                     |       200 | ACTIVE to DRAFT; DRAFT/SUSPENDED transitions return 409. Only an administrator may suspend.                                            |
| POST `/api/session-requests`                             | Authenticated learner           |       201 | Create PENDING request; validate active tutor, associated subject, future interval, no self-request; 404/422.                         |
| GET `/api/session-requests`                              | Participant                     |       200 | Return only sent/received requests; optional role/status filters.                                                                     |
| GET `/api/session-requests/:id`                          | Participant                     |       200 | 404 for non-participant or absent resource.                                                                                           |
| POST `/api/session-requests/:id/accept`                  | Target tutor                    |       201 | PENDING to ACCEPTED and create UPCOMING session atomically; 403 wrong actor, 409 invalid state or SLOT_CONFLICT.                      |
| POST `/api/session-requests/:id/reject`                  | Target tutor                    |       200 | PENDING to REJECTED; 403 wrong actor, 409 invalid state.                                                                              |
| POST `/api/session-requests/:id/counter-proposals`       | Target tutor                    |       200 | PENDING to COUNTER_PROPOSED with future interval; 403/409/422.                                                                        |
| POST `/api/session-requests/:id/accept-counter-proposal` | Original learner                |       201 | Recheck availability and conflicts, create session atomically; 403/409 SLOT_CONFLICT.                                                 |
| POST `/api/session-requests/:id/cancel`                  | Original learner                |       200 | PENDING or COUNTER_PROPOSED to CANCELLED; 403/409.                                                                                    |
| GET `/api/sessions`                                      | Participant                     |       200 | Own sessions only; optional role/status/date filters.                                                                                 |
| GET `/api/sessions/:id`                                  | Participant or authorized admin |       200 | 404 absent/out of scope; admin access must be justified by admin function.                                                            |
| POST `/api/sessions/:id/cancel`                          | Participant                     |       200 | UPCOMING only, before scheduled end, reason required; 403/409/422.                                                                    |
| POST `/api/sessions/:id/complete`                        | Assigned tutor                  |       200 | After scheduled end, outcome `HELD` or `NO_SHOW_LEARNER`; set `completedAt` for HELD; 403/409/422.                                    |
| POST `/api/sessions/:id/disputes`                        | Assigned learner                |       201 | After end report tutor absence, or dispute HELD within 48h; set session DISPUTED and open dispute; 403/409/422.                       |
| POST `/api/sessions/:id/reviews`                         | Assigned learner                |       201 | Only one review for HELD session; 403/409 duplicate or ineligible state/422 invalid rating.                                           |
| GET `/api/tutors/:id/reviews`                            | Authenticated, in scope         |       200 | Paginated, non-hidden reviews only; 404 unavailable/out of scope.                                                                     |
| GET `/api/notifications`                                 | Authenticated recipient         |       200 | Own notifications only; optional unread/read filter and pagination.                                                                   |
| PATCH `/api/notifications/:id/read`                      | Recipient                       |       200 | Mark own notification read; 404 absent or another recipient's item.                                                                   |
| GET `/api/admin/disputes`                                | ADMIN                           |       200 | Filter OPEN/RESOLVED; 403 non-admin.                                                                                                  |
| GET `/api/admin/disputes/:id`                            | ADMIN                           |       200 | Dispute and minimum relevant audit context; 403/404.                                                                                  |
| POST `/api/admin/disputes/:id/resolve`                   | ADMIN                           |       200 | Resolution must be HELD, NO_SHOW_LEARNER, NO_SHOW_TUTOR or RESOLVED_NO_FAULT with rationale; 403/409/422. Record admin and timestamp. |
| POST `/api/admin/tutors/:id/suspend`                     | ADMIN                           |       200 | Require reason, hide profile and block new requests; preserve history; 403/404/422.                                                   |
| POST `/api/admin/tutors/:id/restore`                     | ADMIN                           |       200 | Restore only if publication requirements hold; 403/404/422.                                                                           |

Tutor profile and recurring availability route details:

- Every `/api/tutors/me/*` route requires a verified Bearer access token with role `USER`. Resolve the tutor profile through the authenticated user's ID; never accept an owner ID or profile ID from the request body. Missing profiles return `404 NOT_FOUND`; a non-USER account receives `403 FORBIDDEN`.
- `PUT /api/tutors/me/profile` accepts `{ "displayName": "...", "bio": "...", "universityId": "..." | null }`. `displayName` is required and non-empty; `bio` is required but may be empty while saving a draft. `universityId` is optional: omission preserves the existing affiliation, `null` clears it, and an ID must reference an active university. User affiliation is optional, self-declared and unverified; it is stored only on `users`, not duplicated on tutor profiles. Changing affiliation is rejected with `422 VALIDATION_ERROR` if existing subject associations would become out of scope. First creation returns `201`; updates return `200`. Unknown/server-controlled fields are rejected with `422`.
- `GET /api/tutors/me/profile` returns `{ id, displayName, bio, universityId, subjectIds, status, createdAt, updatedAt }`. It may return the owner's DRAFT or SUSPENDED profile. Another account resolves only its own profile; no profile for that account returns `404`.
- `PUT /api/tutors/me/subjects` accepts `{ "subjectIds": ["<ObjectId>", ...] }` and replaces the complete association list; an empty list clears it. Each ID must exist, be active, and be global or in the authenticated user's university scope. Invalid, duplicate, inactive and out-of-scope IDs return `422 VALIDATION_ERROR`. Success returns the same owner-profile shape as `GET /api/tutors/me/profile`. Subjects are seeded/managed separately; no subject administration route is part of this API.
- `GET /api/tutors/me/availabilities` returns `{ "items": [...] }`. `POST /api/tutors/me/availabilities` accepts `{ "dayOfWeek": 0, "startTime": "09:00", "endTime": "11:00", "timeZone": "Europe/Paris" }` and returns `201` with `{ id, dayOfWeek, startTime, endTime, timeZone, createdAt, updatedAt }`. `dayOfWeek` uses 0=Sunday through 6=Saturday; times are local `HH:mm`, and `timeZone` must be a valid IANA identifier. End must be later than start on the same day; overnight windows must be split. Overlapping windows on a tutor/day return `409 CONFLICT`; adjacent windows are allowed.
- `PATCH /api/tutors/me/availabilities/:availabilityId` accepts a non-empty partial set of the four availability fields and returns `200` with the updated-window shape. `DELETE` returns `204`. Both operate only on the current user's records; absent or other-owner IDs return `404 NOT_FOUND`. Invalid IDs/fields return `422`; overlapping updates return `409`. Date exceptions and one-time availability are outside this module's scope.
- `POST /api/tutors/me/publish` accepts no body and returns the owner-profile shape with `200` after `DRAFT -> ACTIVE`. It requires a non-empty bio, at least one active in-scope subject and at least one recurring window; a missing requirement returns `422 VALIDATION_ERROR`. Publishing `ACTIVE` or `SUSPENDED` returns `409 CONFLICT`.
- `POST /api/tutors/me/unpublish` accepts no body and returns the owner-profile shape with `200` after `ACTIVE -> DRAFT`. Repeating it on DRAFT or attempting it on SUSPENDED returns `409 CONFLICT`. A DRAFT may be republished after meeting the requirements. Only trusted administrator operations may set `SUSPENDED`; no admin suspension/restore route is implemented here, and a suspended owner cannot republish.
- `GET /api/tutors/:id` requires authentication and returns `200` only for an ACTIVE profile within the caller's university/global scope. Its response is `{ id, displayName, bio, universityId, subjects, availabilities }`; subjects contain only `{ id, name, code? }` fields for active in-scope catalog entries, and availability contains only `{ id, dayOfWeek, startTime, endTime, timeZone }`. Email, password hashes, tokens and internal moderation data are never returned. DRAFT, SUSPENDED, missing and out-of-scope profiles all return `404 NOT_FOUND`; malformed profile IDs return `422 VALIDATION_ERROR`.
- Public visibility includes global profiles for all authenticated callers and university profiles only for callers in the same university. A user without `universityId` remains in global scope. This issue adds no learner settings or university-selection flow; university selection through the profile endpoint applies only when a tutor profile is being created/edited.
- The reusable request-eligibility service returns true only for ACTIVE profiles whose bio, active in-scope subject and recurring availability requirements remain satisfied. Future request-creation code must use it; DRAFT/SUSPENDED profiles are never eligible. No request routes are added here.

## Authorization rules

1. Public routes: registration, login, refresh credential and active university catalogue only.
2. `USER`: any authenticated user may search and request tutoring. A tutor action requires ownership of an ACTIVE tutor profile where applicable.
3. Ownership: `/me` routes resolve the profile from the authenticated user. Request and session reads/actions require participant status, except documented admin routes.
4. Admin: enforce `ADMIN` on all `/api/admin/*` routes on the server. Never trust role or actor IDs in request bodies.
5. University scope: optional self-declared `universityId`; filter same-university and global records according to the selected rules. Do not imply affiliation is verified. Use 404 for out-of-scope resources where useful to prevent enumeration.
6. State transitions are checked in services on every mutation, even if Flutter hides unavailable actions.

## Data model summary

Collections: `universities`, `users`, `authSessions`, `tutorProfiles`, `subjects`, `recurringAvailabilities`, `availabilityExceptions`, `sessionRequests`, `sessions`, `disputes`, `reviews`, `notifications`. Users may have an optional `universityId` ObjectId reference to `universities`; `null` or absent means global scope. `TutorProfile` contains `userId`, `displayName`, `bio`, `subjectIds`, `status` and timestamps. Subject records contain `name`, `normalizedName`, optional `code`, optional/null `universityId`, `isActive` and timestamps. Normalize names using NFKC, trimming and lowercase. A recurring availability contains `tutorProfileId`, `dayOfWeek`, `startTime`, `endTime`, `timeZone` and timestamps. Use ObjectId references for independently queried/lifecycle-managed entities; embed only small stable display snapshots. Store timestamps as BSON Dates in UTC. Keep server-owned fields (passwordHash, role, profile owner, subject associations, statuses, aggregates) out of client write DTOs except their explicit replacement/affiliation operations.

Important indexes: unique `users.email`, `authSessions.refreshTokenHash`, `tutorProfiles.userId`, and `{ subjects.universityId, subjects.normalizedName }`; `authSessions.expiresAt` has a TTL index. Active tutor lookup is indexed by `{ status, updatedAt }`; recurring availability lookup uses `{ tutorProfileId, dayOfWeek, startTime }`. Overlap is checked transactionally while serializing changes through the owning profile; adjacent time windows are allowed. At most one OPEN dispute per session via partial unique index or equivalent service-level serialized check. Search indexes cover university/status/subject for tutors, participant/status/date for requests and sessions, and recipient/read/date for notifications. A unique index cannot enforce arbitrary time-range overlap.

## Domain invariants and transactions

- Tutor profile: DRAFT until explicitly published; publish requires biography, one active in-scope subject and one recurring availability. Owner unpublish changes ACTIVE back to DRAFT. SUSPENDED is admin-only and cannot be cleared by its owner. DRAFT/SUSPENDED profiles are hidden from public reads and ineligible for new requests.
- Requests expire 48h after creation or when their proposed start passes, whichever comes first. A worker marks EXPIRED; do not TTL-delete history. Requests and counter-proposals do not reserve slots.
- Intervals overlap if `A.start < B.end && B.start < A.end`; adjacent sessions do not overlap. Only UPCOMING sessions block bookings.
- Accepting a request atomically changes request state, creates one session and rejects conflicting PENDING requests. Serialize competing tutor slot acceptance, transact, then recheck; return `409 SLOT_CONFLICT` to the losing attempt.
- Either participant may cancel an UPCOMING session before its scheduled end with a reason. After the end, tutor records HELD or NO_SHOW_LEARNER. A learner report of tutor absence or a timely contest opens DISPUTED; only an admin records the final resolution and rationale.
- Only a HELD session permits one learner review. `completedAt` is set when HELD. Hidden reviews are excluded from public display and aggregates.
- Notifications are in-app records created after successful domain actions. They do not replace canonical state. No chat, push, email or SMS in V1.

Use MongoDB transactions for booking acceptance, dispute resolution and multi-document review aggregate updates where consistency requires them. Local/CI MongoDB must run as a replica set or compatible cluster.

## Error handling, validation and security

Validate environment variables at startup, request bodies/query/params at route boundaries, and cross-document rules in services. Use one async error middleware and a stable error-code catalogue. Hash passwords with Argon2id or bcrypt. Use short-lived access tokens and rotating refresh tokens stored hashed. Rate-limit authentication, apply Helmet, configure CORS narrowly, redact secrets/tokens in logs, enforce TLS in deployment, and keep `.env` out of Git. Pagination and sort fields must be allowlisted.

## Testing and operations

Integration tests cover registration/refresh/revocation, object ownership, university scope, publication, request expiry, counter-proposal, concurrent slot acceptance, cancellation/outcome/dispute windows, review uniqueness/aggregates and notification recipient isolation. Provide `/health` and readiness checks, structured logs, seed data that is safe and repeatable, OpenAPI examples, and CI lint/typecheck/tests. Never use real student personal data in fixtures.
