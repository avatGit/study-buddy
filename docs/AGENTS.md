# Repository guidance for coding agents

These instructions apply to the entire StudyBuddy monorepo.

## Before changing files

- Read `README.md` and the relevant documents under `docs/`, especially `team-decisions.md`, `roadmap.md`, `backend-architecture.md` and `frontend-architecture.md`.
- Inspect the existing implementation and package scripts before proposing new structure or dependencies.
- Keep changes scoped to the requested issue. Do not implement deferred Could ideas unless the team explicitly requests them.
- Do not invent or silently change product rules, API contracts, status values, role permissions, data fields or university-scope behavior. If a necessary decision is unresolved, mark it as a proposal and ask the team before relying on it.

## Repository workflow

- Never commit or push directly to `main` or `dev`; never force-push shared branches.
- Work on a focused task branch from the latest `dev` and propose changes through a PR targeting `dev`. Follow `CONTRIBUTING.md`.
- Do not merge PRs, change branch protections, create milestone tags/releases, or publish external updates unless the user/team explicitly asks.
- Do not claim a task, test, build, or check passed unless it was actually run and passed. Report blocked local checks accurately and distinguish them from CI results.

## Backend conventions

- Stack: Node.js 24+, Express 5, TypeScript, MongoDB and Mongoose.
- Preserve the module layering: routes map requests, controllers handle HTTP translation, services enforce business rules, models define persistence. Avoid business logic in routes/controllers.
- Derive the acting user from verified authentication context, never from client-supplied actor identifiers or roles.
- Enforce ownership, role, optional university scope and state-transition rules on the server. Return the documented error envelope and status codes.
- Use transactions for multi-document operations requiring atomic consistency. Booking conflict logic must serialize/recheck concurrent acceptances; a unique index alone does not protect arbitrary overlapping intervals.
- Keep secrets in environment configuration, update `.env.example` only with safe placeholders, and never add real credentials, tokens or student personal data to files, fixtures or logs.
- Add or update API integration tests for success, validation, authorization, status transitions and concurrency relevant to the change.

## Flutter conventions

- Keep features under `app/lib/features/<feature>/` and shared infrastructure under `app/lib/core/`.
- Follow the flow Page/Widgets -> BLoC/Cubit -> repository -> API service/client. UI widgets must not make HTTP calls directly.
- Keep API DTO parsing and transport details out of widgets. Map backend errors into typed app failures and handle loading, content, empty and error states.
- Use secure platform storage for refresh credentials. Never log or expose tokens.
- Respect the agreed Flutter Material package/version in `pubspec.yaml`; keep `pubspec.lock` committed for the application.
- Add `bloc_test` coverage for BLoC/Cubit logic, including success and failure paths. Add widget tests for important screens and state-dependent actions where practical.

## Documentation and verification

- Update `docs/` when changing a confirmed API contract or business decision. Keep the design reference in English.
- Keep pull requests focused and update linked issues as the work changes state.
- Run relevant checks from `CONTRIBUTING.md` when possible. Do not suppress lints, weaken CI or change test expectations just to make a failing check pass.
- Do not add dependencies unless they solve a concrete need. If adding one, update the appropriate manifest and lockfile and explain its purpose in the PR.
