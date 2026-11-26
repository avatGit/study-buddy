# Contributing to StudyBuddy

This repository is a team monorepo for the StudyBuddy Flutter application, Node.js API and project documentation. Work through short-lived branches and pull requests so the team can review changes and preserve a clear contribution history.

## Branch rules

- Never push commits directly to `main` or `dev`.
- Do not force-push shared branches. Do not bypass branch protection or required checks.
- Create one task branch from the latest `dev` for each issue or closely related task.
- Use descriptive branch names:
  - `feat/<short-task>` for product features
  - `fix/<short-task>` for bug fixes
  - `docs/<short-task>` for documentation
  - `test/<short-task>` for test-only work
  - `chore/<short-task>` for tooling, setup or maintenance
- Examples: `feat/tutor-search-api`, `feat/auth-bloc`, `docs/m1-design`, `chore/m2-project-scaffold`.

```bash
git switch dev
git pull origin dev
git switch -c feat/short-task-name
```

## Pull request workflow

1. Choose or create the GitHub issue that describes the task. Keep each PR focused on one issue or a small set of directly related issues.
2. Implement the change on a task branch created from the latest `dev`.
3. Run the relevant checks locally and review the staged diff. Do not commit secrets, `.env` files, generated build output or unrelated changes.
4. Push the task branch and open a PR with **base `dev`**. Do not target `main` for ordinary feature or documentation work.
5. Link the issue in the PR description, for example `Closes #123` when the PR fully completes it. Summarize the change, checks run and any known limitation.
6. Request review from at least one other team member. The author should address review comments and wait for required CI checks before merging.
7. Merge using the repository's enabled merge strategy after approval and checks pass. Delete the task branch after merge when GitHub offers that option.
8. Before starting another task, update local `dev` and create a new branch from it.

## Promoting a milestone to main

`dev` is the team integration branch. `main` contains reviewed milestone snapshots. When the team has completed and reviewed a milestone, the team lead opens a separate PR from `dev` to `main`, obtains the required review and CI checks, and merges it. Create the milestone tag (for example `m1`) on the resulting `main` commit and publish the corresponding GitHub Release/progress note. Do not tag an unmerged task branch as a completed milestone.

## Commit messages

Use concise imperative messages with a conventional type where practical:

- `feat: add tutor search filters`
- `fix: reject expired session requests`
- `test: cover refresh token rotation`
- `docs: clarify API authorization rules`
- `chore: add pull request CI workflow`

Prefer several small, meaningful commits during the work over one large last-minute commit. Use your own GitHub identity and configured commit name/email.

## Checks before opening a PR

Run checks for the part you changed. The CI workflow runs checks for both projects on every PR.

### API

```bash
cd api
npm install
npm run typecheck
npm run build
npm test
```

### Flutter

```bash
cd app
flutter pub get
dart format .
flutter analyze
flutter test
```

If a local security policy prevents a tool from running, report the exact failure in the PR and rely on CI only if the corresponding remote check succeeds. Do not disable or bypass the policy.

## Code and product rules

- Read `docs/team-decisions.md`, `docs/backend-architecture.md` and `docs/frontend-architecture.md` before implementing related behavior.
- Keep the API authoritative for identity, authorization, resource ownership, university scope, status transitions and rating aggregates.
- Do not trust client-supplied actor IDs or role values. Do not log credentials, access/refresh tokens or sensitive user data.
- Preserve the agreed session, dispute, review and notification rules. If a requirement is ambiguous or a proposed API route changes, discuss it in the team and update the design docs before relying on it.
- Keep Flutter feature code feature-first. UI calls BLoC/Cubit, then repository, then API client; widgets must not call HTTP directly.
- Use the existing error envelope and response conventions. Add tests for authorization and domain rules when implementing API endpoints, and success/failure tests for each BLoC/Cubit with business logic.
- Keep documentation in English when it is part of the final course design deliverable. Team coordination may use French.

## PR description checklist

- [ ] Linked issue(s)
- [ ] Summary and user-visible or API behavior
- [ ] Relevant tests/checks run, or exact blocker reported
- [ ] No secrets or unrelated files included
- [ ] API/design documentation updated if contracts or decisions changed
- [ ] Another team member requested for review
