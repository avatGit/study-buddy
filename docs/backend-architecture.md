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
| GET `/api/tutors/:id`                                    | Authenticated, in scope         |       200 | 404 if absent, suspended or out of scope; expose public fields only.                                                                  |
| GET `/api/tutors/me/profile`                             | USER, owner                     | 200 / 404 | Read own DRAFT/ACTIVE/SUSPENDED profile. Recommended contract completion needed by profile editor.                                    |
| PUT `/api/tutors/me/profile`                             | USER, owner                     | 200 / 201 | Create/update own DRAFT fields; 422 invalid fields. Never accept status or rating aggregates from client.                             |
| POST `/api/tutors/me/subjects`                           | USER, owner                     |       200 | Validate subject IDs and university scope; 422 invalid association.                                                                   |
| GET `/api/tutors/me/availabilities`                      | USER, owner                     |       200 | Read own recurring windows and exceptions. Recommended contract completion for schedule editor.                                       |
| POST `/api/tutors/me/availabilities`                     | USER, owner                     |       201 | Create recurring window; 400 malformed time, 409 duplicate/overlap if prohibited, 422 invalid interval.                               |
| PATCH `/api/tutors/me/availabilities/:availabilityId`    | USER, owner                     |       200 | Update own window only; 404 other/absent ID, 422 invalid interval. Recommended contract completion.                                   |
| DELETE `/api/tutors/me/availabilities/:availabilityId`   | USER, owner                     |       204 | 404 other/absent ID.                                                                                                                  |
| POST `/api/tutors/me/exceptions`                         | USER, owner                     |       201 | Add date block or time range; 400 malformed date, 422 invalid range.                                                                  |
| DELETE `/api/tutors/me/exceptions/:exceptionId`          | USER, owner                     |       204 | 404 other/absent ID. Recommended contract completion.                                                                                 |
| POST `/api/tutors/me/publish`                            | USER, owner                     |       200 | DRAFT to ACTIVE only with non-empty bio, at least one subject and availability; otherwise 422.                                        |
| POST `/api/tutors/me/unpublish`                          | USER, owner                     |       200 | Hide own profile from new searches; reject invalid transition with 409.                                                               |
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

The GET/PATCH/DELETE tutor-profile and availability routes marked as recommended complete the UI read/edit lifecycle; confirm these additions in the team API contract before implementation. They are included here to make the integration needs explicit.

## Authorization rules

1. Public routes: registration, login, refresh credential and active university catalogue only.
2. `USER`: any authenticated user may search and request tutoring. A tutor action requires ownership of an ACTIVE tutor profile where applicable.
3. Ownership: `/me` routes resolve the profile from the authenticated user. Request and session reads/actions require participant status, except documented admin routes.
4. Admin: enforce `ADMIN` on all `/api/admin/*` routes on the server. Never trust role or actor IDs in request bodies.
5. University scope: optional self-declared `universityId`; filter same-university and global records according to the selected rules. Do not imply affiliation is verified. Use 404 for out-of-scope resources where useful to prevent enumeration.
6. State transitions are checked in services on every mutation, even if Flutter hides unavailable actions.

## Data model summary

Collections: `universities`, `users`, `authSessions`, `tutorProfiles`, `subjects`, `recurringAvailabilities`, `availabilityExceptions`, `sessionRequests`, `sessions`, `disputes`, `reviews`, `notifications`. Use ObjectId references for independently queried/lifecycle-managed entities; embed only small stable display snapshots. Store timestamps as BSON Date in UTC. Keep server-owned fields (passwordHash, role, statuses, aggregates) out of client write DTOs.

Important unique indexes: `users.email`, `authSessions.refreshTokenHash`, `tutorProfiles.userId`, `sessions.requestId`, `reviews.sessionId`; `authSessions.expiresAt` has a TTL index. At most one OPEN dispute per session via partial unique index or equivalent service-level serialized check. Search indexes cover university/status/subject for tutors, participant/status/date for requests and sessions, and recipient/read/date for notifications. A unique index cannot enforce arbitrary time-range overlap.

## Domain invariants and transactions

- Tutor profile: DRAFT until explicitly published; publish requires biography, one subject and one availability. SUSPENDED profiles are not searchable and receive no new requests.
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
