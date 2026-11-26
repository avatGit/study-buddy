# StudyBuddy implementation roadmap

This roadmap orders the existing GitHub issues by dependency. It contains no calendar deadlines. Parallel work is noted where tasks can proceed independently. GitHub issues remain the task-level source of truth.

## M0 and M1: team setup and design

1. [#1 Confirm team, T10 topic and teacher repository access](https://github.com/avatGit/study-buddy/issues/1). Close the team setup checklist.
2. [#2 Define product scope and user stories](https://github.com/avatGit/study-buddy/issues/2). Confirm problem, actors, V1 scope and story priorities.
3. [#4 Finalize MongoDB data model](https://github.com/avatGit/study-buddy/issues/4). Define collections, fields, references, indexes and integrity rules from the approved product rules.
4. [#3 Finalize API contract and authorization](https://github.com/avatGit/study-buddy/issues/3). Define methods, paths, roles, success codes, errors and object-level access rules from the product rules and data model.
5. In parallel after product scope is stable:
   - [#6 Wireframes and navigation map](https://github.com/avatGit/study-buddy/issues/6).
   - [#8 Whole-system architecture diagram](https://github.com/avatGit/study-buddy/issues/8).
   - [#7 Flutter layers diagram for one feature](https://github.com/avatGit/study-buddy/issues/7), aligned with the API contract and app structure.
6. [#5 Assemble and review `docs/design.pdf`](https://github.com/avatGit/study-buddy/issues/5) after #2, #3, #4, #6, #7 and #8 are complete. The team reviews the design package before closing M1.

## M2: API foundation and walking skeleton

7. [#17 Establish API foundation](https://github.com/avatGit/study-buddy/issues/17), based on the accepted data model and API contract.
8. [#9 Implement authentication and tokens](https://github.com/avatGit/study-buddy/issues/9), after #17.
9. After the foundation and authentication are available, progress these API tracks in parallel where ownership permits:
   - [#15 Tutor profile and publication API](https://github.com/avatGit/study-buddy/issues/15), dependent on #17 and #9.
   - [#10 Availability and exception API](https://github.com/avatGit/study-buddy/issues/10), dependent on the tutor profile contract and #9.
   - [#16 Tutor and subject search API](https://github.com/avatGit/study-buddy/issues/16), dependent on subjects, profiles, availability and #9.
   - [#11 Demo data and API documentation](https://github.com/avatGit/study-buddy/issues/11), as the relevant models and endpoints become stable.
10. [#22 Flutter foundation and authentication](https://github.com/avatGit/study-buddy/issues/22) can proceed once auth contracts are stable and Marieta's planned API contribution has been reviewed.
11. [#13 Deploy walking skeleton and configure CI](https://github.com/avatGit/study-buddy/issues/13) after a protected API path, a real list/resource endpoint and the Flutter foundation can run together.

## M3: core workflows and app integration

12. [#14 Request and counter-proposal lifecycle](https://github.com/avatGit/study-buddy/issues/14), after authentication, tutor profile, subject and availability APIs (#9, #15, #10, #16).
13. [#12 Prevent concurrent double booking](https://github.com/avatGit/study-buddy/issues/12), after request acceptance in #14 can create sessions. Verify with a concurrent integration test.
14. [#19 Session cancellation, outcomes and disputes](https://github.com/avatGit/study-buddy/issues/19), after sessions can be created by #14. Implement the agreed `completedAt`, `DISPUTED` and administrative resolution behavior.
15. After session outcomes and dispute rules are available:

- [#18 Reviews and rating aggregates](https://github.com/avatGit/study-buddy/issues/18), dependent on #19 and the `HELD` outcome.
- [#20 In-app notifications](https://github.com/avatGit/study-buddy/issues/20), dependent on successful request, session and dispute events from #14 and #19.

16. Frontend tracks can progress against reviewed contracts and approved wireframes:

- [#23 Flutter tutor search and profiles](https://github.com/avatGit/study-buddy/issues/23), dependent on #16, #22 and #6.
- [#26 Flutter tutor profile and publication](https://github.com/avatGit/study-buddy/issues/26), dependent on #15, #10 and #6.
- [#25 Flutter requests, sessions, reviews, disputes and notifications](https://github.com/avatGit/study-buddy/issues/25), dependent on #14, #18, #19, #20 and #22.

17. [#21 Integration tests, API security and documentation](https://github.com/avatGit/study-buddy/issues/21) can run alongside Flutter work as endpoints stabilize. It must cover access control, booking concurrency, state transitions, reviews and notifications.
18. [#27 Integrate and validate end-to-end journeys](https://github.com/avatGit/study-buddy/issues/27) after the API and Flutter tracks are integrated. Validate learner, tutor and dispute workflows.

## M4: optional enhancement and release candidate

19. [#28 US-16 tutor profile preview](https://github.com/avatGit/study-buddy/issues/28) is the only selected Could story. Start only after core Must and Should work and end-to-end integration are complete. It must not block the release candidate.
20. [#24 Prepare release candidate and defense](https://github.com/avatGit/study-buddy/issues/24) follows completion of core M3 integration, tests and deployment. Include US-16 only if it is complete before code freeze.

## Dependency overview

```text
#2 Product
  +--> #4 Data model --> #3 API contract
  +--> #6 Wireframes/navigation
  +--> #8 System architecture --> #7 Flutter layers
                         \\ all design outputs --> #5 Design PDF

#17 API foundation --> #9 Auth
  +--> #15 Tutor profile --> #10 Availability --> #16 Search
  +--> #11 Demo data and API docs
  +--> #22 Flutter foundation
  #14 Requests --> #12 Booking concurrency
       +--> #19 Sessions/disputes --> #18 Reviews
                            +-------> #20 Notifications

#16 --> #23 Flutter discovery
#15 + #10 --> #26 Flutter tutor setup
#14 + #18 + #19 + #20 + #22 --> #25 Flutter interactions
#21 Tests/security + #23 + #25 + #26 --> #27 End-to-end
#27 --> optional #28 --> #24 Release candidate
```

The dependency graph is a planning aid. If GitHub issue dependency links are not configured, add the relevant `blocked by` relationships in GitHub or track them in the Project board. A task may start earlier when its contract is stable, but integration must respect the dependencies above.
