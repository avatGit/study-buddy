# StudyBuddy frontend architecture

## Purpose and stack

This document defines the Flutter V1 structure and integration conventions. The app serves learners and tutors. Admin dispute-management screens are included only if the team confirms the administrator will use the mobile app; otherwise the admin API can be operated by a future protected admin client. The backend remains the source of truth for permissions, statuses, ratings and university scope.

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
| Authentication       | `AuthBloc`                                  | Register, login, restore session, refresh credentials, logout.                       |
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
Startup -> Auth check -> Sign in / Register
                         -> Home
Home -> Tutor Search -> Tutor Profile -> Session Request -> My Requests -> Request Detail
Home -> My Sessions -> Session Detail -> Cancel / Report or dispute / Review when eligible
Home -> Notifications -> Related Request or Session
Home -> Tutor Space -> Profile Editor -> Subjects -> Availability -> Preview -> Publish
```

Tutor functions are enabled for a user who has a tutor profile. Navigation guards improve UX but do not replace API authorization. Admin route area is role-gated and conditional on the team deciding to build it in the mobile app.

## API integration

Use base URL configuration per environment. The Dio interceptor adds the short-lived bearer access token, refreshes through `POST /api/auth/refresh` when appropriate, and retries a request at most once. Prevent simultaneous refresh races. Store refresh credentials only in platform secure storage. Logout calls `POST /api/auth/logout`, clears local credentials even if the server call fails, and returns to sign-in.

Map the backend error envelope `{ error: { code, message, status, details } }` into typed app failures. Handle `401` by refreshing once then signing out, `403` as forbidden, `404` as unavailable/out of scope, `409 SLOT_CONFLICT` as a slot-selection conflict, `422` as field/domain validation, and network/5xx as retryable where safe. Never display raw stack traces or assume a button being hidden grants permission.

## UX state and behavior

Every network-backed screen defines loading, content, empty, and failure states. Forms preserve values after recoverable errors, disable duplicate submissions while a request is pending, show field errors for validation and a clear retry action for transient failures. Render actions from the backend resource status and current actor. Update UI only after a successful response, except deliberate optimistic changes that can be rolled back.

Cache the main tutor search list with explicit invalidation after filter changes and relevant updates. Do not cache private requests, disputes or notifications beyond the user's session unless the team defines secure invalidation. Provide accessible labels, readable contrast, keyboard support and responsive layouts for common student phones.

## Core endpoint integration map

| App feature          | API endpoints                                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Auth                 | `POST /api/auth/register`, `/login`, `/refresh`, `/logout`                                                                                                         |
| Tutor search/profile | `GET /api/subjects`, `GET /api/tutors`, `GET /api/tutors/:id`, `GET /api/tutors/:id/reviews`                                                                       |
| Tutor profile setup  | `GET/PUT /api/tutors/me/profile`, `/subjects`, `/availabilities`, `/exceptions`, `/publish`, `/unpublish`                                                          |
| Requests             | `POST/GET /api/session-requests`, `GET /api/session-requests/:id`, action routes `/accept`, `/reject`, `/counter-proposals`, `/accept-counter-proposal`, `/cancel` |
| Sessions             | `GET /api/sessions`, `GET /api/sessions/:id`, action routes `/cancel`, `/complete`, `/disputes`, `/reviews`                                                        |
| Notifications        | `GET /api/notifications`, `PATCH /api/notifications/:id/read`                                                                                                      |
| Admin disputes       | `GET /api/admin/disputes`, `GET /api/admin/disputes/:id`, `POST /api/admin/disputes/:id/resolve`                                                                   |

Availability GET/PATCH/exception DELETE and own-profile GET routes are proposed contract completions; confirm them with backend before wiring the UI. Use generated or hand-maintained typed DTOs aligned with the final API contract.

## Testing and acceptance

- Unit test BLoCs/Cubits for event-to-state behavior, pagination and failures.
- Test repositories and API serialization with mocked HTTP responses, including each shared error code.
- Widget test loading/empty/error/content, form validation and status-dependent actions.
- Integration test: sign in, search, view tutor, send request, accept/counter-propose, create session, complete, review; separately test tutor profile publication and dispute reporting.
- Never put production credentials, real student data or tokens in fixtures, logs or screenshots.

## Delivery ownership and handoff

Marieta owns Flutter authentication and discovery, then contributes to interaction flows. Francine owns tutor profile/availability and notifications after her API contribution and review. Dan owns backend and joins Flutter integration after core API delivery. Use the GitHub issues as the task source of truth and keep the Figma link and approved wireframes in the design document.
