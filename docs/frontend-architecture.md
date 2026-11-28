# StudyBuddy frontend architecture

## Purpose and stack

This document defines the Flutter V1 structure and integration conventions. The app serves learners and tutors. Admins use the same login API in a future admin interface; no admin dashboard or student-facing Admin link is part of this work. The initial admin client may use this Flutter project with responsive web support; choosing a separate web frontend is a later architectural decision. The backend remains the source of truth for permissions, statuses, ratings and university scope.

Use Flutter with Dart, feature-first organization, BLoC/Cubit for state management, a declarative router, Dio (or the selected HTTP client), JSON serialization, and secure platform storage for refresh credentials. Confirm exact package versions in `pubspec.yaml` and the course guide before implementation.

## App layers

```text
lib/
  app/                 # app bootstrap, router, theme
  core/                # API client, auth storage, errors, shared widgets
  features/
    auth/               # pages, bloc, repository, models, api service
    home/
    tutor_search/
    tutor_profile/
    tutor_editor/
    availability/
    session_requests/
    sessions/
    reviews/
    notifications/
    admin_disputes/     # include only if admin UI is in V1
```

Feature flow: **Page/Widgets -> BLoC/Cubit -> Repository contract -> Repository implementation -> API service/client -> REST API**. UI widgets do not call Dio or parse HTTP responses. Repositories map DTOs to app models and isolate transport details.

## Feature and BLoC map

| Feature              | BLoC/Cubit                                  | Main responsibility                                                                  |
| -------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------ |
| Authentication       | `AuthCubit`                                 | Register, login, restore session, refresh credentials, reload current user, logout.  |
| Home                 | `HomeCubit`                                 | Load upcoming sessions, shortcuts and notification count from existing repositories. |
| Tutor discovery      | `TutorSearchBloc`                           | Search, filters, pagination, retry and empty results.                                |
| Public tutor profile | `TutorProfileCubit`                         | Load public tutor data, availability, reviews and aggregate rating.                  |
| Tutor profile editor | `TutorProfileEditorBloc`                    | Edit draft, validate required fields, preview and publish/unpublish.                 |
| Availability         | `AvailabilityBloc`                          | Read and edit weekly slots and date exceptions.                                      |
| Requests             | `RequestsBloc`, `RequestDetailBloc`         | Lists, tutor decisions, counter-proposal, learner response and cancellation.         |
| Sessions             | `SessionsBloc`, `SessionDetailBloc`         | Lists, details, cancellation, completion outcome and dispute flow.                   |
| Reviews              | `ReviewSubmissionCubit`, `TutorReviewsBloc` | Submit eligible review and list public reviews.                                      |
| Notifications        | `NotificationsBloc`                         | List own notifications, mark read and navigate to the related resource.              |
| Admin disputes       | `AdminDisputesBloc`                         | Queue, inspect and resolve disputes if admin UI is in scope.                         |
| Account              | `AccountCubit`                              | Account details and user-initiated logout.                                           |

Avoid a global BLoC for unrelated feature state. Reuse shared auth/session state only for cross-cutting identity and token lifecycle.

## Navigation map

```text
Startup -> refresh-token restore -> Sign in / Register
                                   -> Home tab
Home tab -> nested destinations (when implemented): Tutor Search -> Tutor Profile -> Session Request
Search tab -> tutor discovery and nested tutor/profile flows
My Sessions tab -> session list and nested session detail/actions
Profile tab -> current-user profile, reload, and sign out
Tutor profile -> nested Tutor Space -> Profile Editor -> Subjects -> Availability -> Preview -> Publish
```

The only top-level destinations are **Home**, **Search**, **My Sessions**, and **Profile**. Other destinations are nested flows, not additional tabs. The current app implements the four-tab shell and onboarding/profile entry points; the unimplemented session, notification, tutor-editor, and nested detail screens remain future work. Tutor functions are enabled for a user who has a tutor profile. Navigation guards improve UX but do not replace API authorization. No admin destination is exposed in student authentication or navigation.

## API integration

Use `API_BASE_URL` for environment-specific base URL configuration. The Dio interceptor adds the short-lived bearer access token. Concurrent `401` responses share one refresh future; the client calls `POST /api/auth/refresh` outside the authenticated interceptor, securely stores both rotated tokens before retrying, and retries each eligible request at most once. Login, registration, and refresh requests are never recursively refreshed. A failed refresh clears stored credentials and transitions to sign-in once. Store access and refresh credentials together in platform secure storage; never log them.

On startup, restore a stored session by rotating its refresh token. Persist the returned access/refresh tokens in secure storage and place the returned user in the in-memory authenticated state; do not call `/api/users/me` again during that restore. Use authenticated `GET /api/users/me` only when explicitly reloading the current profile. Registration requires a trimmed `fullName` (1–120 characters), email and password, and may submit an optional `universityId` selected from the complete paginated public `GET /api/universities` catalogue; university names are never free-text input. Missing `fullName` on legacy accounts is represented as `null`, not inferred from email. Public registration cannot set `ADMIN`.

The “Forgot password?” action is visible only as disabled “Coming soon” UI. Password recovery and its API contract are deferred until email delivery and a secure reset-token flow are available; see [`frontend-api-needs.md`](frontend-api-needs.md).

Map the backend error envelope `{ error: { code, message, status, details } }` into typed app failures. Handle `401` by refreshing once then signing out, `403` as forbidden, `404` as unavailable/out of scope, `409 SLOT_CONFLICT` as a slot-selection conflict, `422` as field/domain validation, and network/5xx as retryable where safe. Never display raw stack traces or assume a button being hidden grants permission.

## UX state and behavior

Every network-backed screen defines loading, content, empty, and failure states. Forms preserve values after recoverable errors, disable duplicate submissions while a request is pending, show field errors for validation and a clear retry action for transient failures. Render actions from the backend resource status and current actor. Update UI only after a successful response, except deliberate optimistic changes that can be rolled back.

Cache the main tutor search list with explicit invalidation after filter changes and relevant updates. Do not cache private requests, disputes or notifications beyond the user's session unless the team defines secure invalidation. Provide accessible labels, readable contrast, keyboard support and responsive layouts for common student phones.

## Core endpoint integration map

| App feature          | Implemented API endpoints used by this flow                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Auth/onboarding      | `POST /api/auth/register`, `/login`, `/refresh`, `/logout`; public `GET /api/universities`; authenticated `GET /api/users/me`                                     |
| Tutor search/profile | `GET /api/subjects`, `GET /api/tutors`, `GET /api/tutors/:id`                                                                                                      |
| Tutor profile setup  | `/api/tutors/me/profile`, `/subjects`, `/availabilities`, `/exceptions`, `/publish`, `/unpublish`                                                                  |

The following V1 endpoint groups remain planned and are not implemented API routes: `/api/session-requests`, `/api/sessions`, `/api/notifications`, tutor reviews, and `/api/admin/*`. The mounted API route inventory and exact contracts are in [`api/openapi.yaml`](../api/openapi.yaml). Availability GET/PATCH/exception DELETE and own-profile GET routes are implemented; use the OpenAPI specification rather than this feature roadmap for the current request/response contract.

Use generated or hand-maintained typed DTOs aligned with the API specification.

## Testing and acceptance

- Unit test BLoCs/Cubits for event-to-state behavior, pagination and failures.
- Test repositories and API serialization with mocked HTTP responses, including each shared error code.
- Widget test loading/empty/error/content, form validation and status-dependent actions.
- Integration test: sign in, search, view tutor, send request, accept/counter-propose, create session, complete, review; separately test tutor profile publication and dispute reporting.
- Never put production credentials, real student data or tokens in fixtures, logs or screenshots.

## Delivery ownership and handoff

Marieta owns Flutter authentication and discovery, then contributes to interaction flows. Francine owns tutor profile/availability and notifications after her API contribution and review. Dan owns backend and joins Flutter integration after core API delivery. Use the GitHub issues as the task source of truth and keep the Figma link and approved wireframes in the design document.
