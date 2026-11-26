# Team decisions

This file records decisions confirmed by the team for StudyBuddy V1. Proposals that still need agreement are listed separately so implementation does not treat them as settled requirements.

## Product and users

- StudyBuddy is a peer-tutoring platform for university students.
- Any authenticated user may act as a learner. A user may also tutor through a tutor profile; tutor capability does not remove learner capability.
- `USER` is the default role. `ADMIN` is a privileged server-controlled role and cannot be selected during public registration.
- User stories US-01 to US-15 are the approved core backlog and priorities. US-15 in-app notifications is Should. US-16 tutor profile preview is the only selected Could story and is optional after core Must/Should work. Other Could ideas are deferred and must not block the release.

## Universities and visibility

- University affiliation is optional and self-declared in V1. No proof is requested, and the application must not claim that affiliation is verified.
- University-scoped records are shown within the applicable university scope; records without a university are global, according to the API contract.
- Tutor search returns ACTIVE tutor profiles and excludes the current user's own profile.

## Tutor profiles and availability

- A user may have one tutor profile. It begins as `DRAFT` and is not publicly discoverable.
- A profile may be explicitly published as `ACTIVE` only after a non-empty biography, at least one subject, and at least one availability entry are present.
- An administrator may set a profile to `SUSPENDED`. Suspended profiles are hidden from new search and cannot receive new requests; existing records and sessions remain available to their participants.
- Tutors manage recurring weekly availability and date-specific exceptions. Exceptions override recurring availability for the affected period.

## Requests and sessions

- Multiple pending requests may propose the same time. Requests and counter-proposals do not reserve time slots.
- A pending request expires after 48 hours or when its proposed start time passes, whichever comes first. Expired request history is retained.
- Only the target tutor may accept, reject or counter-propose a pending request. Only the original learner may accept a counter-proposal or cancel their request.
- Accepting a request creates one `UPCOMING` session and changes the request to `ACCEPTED` atomically. Acceptance rechecks availability and conflicts.
- Two sessions overlap when `A.start < B.end && B.start < A.end`. Adjacent sessions do not overlap. Only `UPCOMING` sessions block a booking.
- Concurrent acceptances must be serialized/rechecked using an application and MongoDB transaction strategy. A losing conflicting attempt returns `409 SLOT_CONFLICT`; a simple unique index is not sufficient for arbitrary time ranges.
- Either participant may cancel an `UPCOMING` session before its scheduled end. A cancellation reason is required.
- After the scheduled end, the tutor may record `HELD` or `NO_SHOW_LEARNER`. `completedAt` is set when the session is marked `HELD`.
- If the tutor has not recorded an outcome, the learner may report tutor absence after the scheduled end. A learner may dispute a `HELD` outcome within 48 hours of `completedAt`. These reports open a dispute and do not themselves prove fault; the session enters `DISPUTED` while reviewed.
- Only an administrator resolves a dispute, choosing `HELD`, `NO_SHOW_LEARNER`, `NO_SHOW_TUTOR` or `RESOLVED_NO_FAULT`, with the administrator, time and rationale recorded.

## Reviews and notifications

- Only the learner attached to a `HELD` session may submit one standard review for that session. No standard review is allowed while a dispute is open or for another session status.
- Review ratings are integers from 1 to 5. Server-maintained tutor rating aggregates are not client-writable. Hidden/moderated reviews are excluded from public display and aggregates.
- V1's selected advanced feature is in-app notifications. Notifications follow successful domain actions and do not replace the canonical request or session status.
- Real-time chat, push notifications, email/SMS delivery and payment processing are outside V1 scope.

## Technical decisions

- Backend: Node.js 24+, Express 5, TypeScript, MongoDB and Mongoose. Flutter is the mobile client. The final design document is in English.
- Store timestamps as UTC BSON dates. Local display uses the relevant time zone.
- Use MongoDB transactions for multi-document state changes that require atomic consistency. Local and CI MongoDB must support transactions.
- Enforce object ownership, role checks, university scope and state transitions on the server. Client-side hiding of actions is only a UX measure.

## Items requiring explicit confirmation

- Backend API architecture notes identify GET/PATCH/DELETE routes for a user's own profile and availability as contract completions that may be needed by Flutter. Confirm the exact route list in the API contract before implementation.
- Confirm whether an administrator interface is part of the Flutter V1 client. Admin API endpoints are planned; the mobile admin UI is not assumed by this decision log.
