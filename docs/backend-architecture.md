# Backend architecture

The API uses Node.js 24+, Express 5, TypeScript and MongoDB with Mongoose. Features are organized by resource. Each feature separates route definitions, controllers, services, schemas and models. Routes handle HTTP mapping; controllers translate requests and responses; services own business rules; models define MongoDB persistence. Shared middleware handles authentication, authorization, validation, errors, logging and configuration.

```text
src/
  app.ts
  server.ts
  config/
  middleware/
  common/
  modules/
    auth/
    users/
    universities/
    subjects/
    tutors/
    session-requests/
    sessions/
    disputes/
    reviews/
    notifications/
```

A module should contain only the layers it needs, for example `routes.ts`, `controller.ts`, `service.ts`, `model.ts`, `validation.ts`, and `types.ts`. Avoid putting business logic in routes/controllers. Use MongoDB transactions for multi-document state transitions; local and CI MongoDB environments must support transactions.
