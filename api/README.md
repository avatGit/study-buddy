# StudyBuddy API

## Local quick start

Requires Node.js 24 or newer, npm, and MongoDB running as a replica set (or an Atlas development cluster).

1. Install dependencies:

   ```powershell
   cd api
   npm install
   Copy-Item .env.example .env
   ```

2. Set a private `ACCESS_TOKEN_SECRET` of at least 32 characters and configure `MONGODB_URI` in `.env`. Do not commit `.env`.

3. Start MongoDB. For a single-node local replica set with Docker:

   ```powershell
   docker run --name studybuddy-mongo -d -p 27017:27017 mongo:8 --replSet rs0 --bind_ip_all
   docker exec studybuddy-mongo mongosh --quiet --eval "rs.initiate({_id:'rs0',members:[{_id:0,host:'127.0.0.1:27017'}]})"
   ```

   Use the local URI in `.env`:

   ```text
   MONGODB_URI=mongodb://127.0.0.1:27017/studybuddy_demo?replicaSet=rs0
   ```

   An Atlas development URI can be used to run the API, but the demo seed script intentionally refuses remote MongoDB hosts. Keep Atlas credentials in `.env` and never use a production cluster for local development.

4. Start the API and check liveness:

   ```powershell
   npm run dev
   ```

   In another terminal:

   ```powershell
   Invoke-RestMethod http://localhost:3000/health
   ```

   Expected response: `{"status":"ok"}`.

## Demo records

The seed creates deterministic university, global and university-scoped subjects, learner/tutor/admin accounts, an ACTIVE tutor profile, recurring availability, and a future dated time-block exception. It uses Argon2id for all password hashes.

To opt in, set these values in the local `.env` first. Choose distinct email addresses and passwords of 8–128 characters; these values are local-only and are not printed by the script:

```text
DEMO_SEED_ENABLED=true
DEMO_LEARNER_EMAIL=learner@example.test
DEMO_LEARNER_PASSWORD=<choose-a-local-password>
DEMO_TUTOR_EMAIL=tutor@example.test
DEMO_TUTOR_PASSWORD=<choose-a-local-password>
DEMO_ADMIN_EMAIL=admin@example.test
DEMO_ADMIN_PASSWORD=<choose-a-local-password>
```

The script requires `NODE_ENV` other than `production`, a loopback MongoDB host, and the exact database name `studybuddy_demo`. It does not seed an Atlas or production database. The admin role is assigned only by this trusted script; public registration always creates `USER` accounts.

Run or reset the seed from `api/`:

```powershell
npm run seed:demo
npm run seed:demo:reset
```

Seeding is idempotent and updates only its reserved record IDs. The explicit reset command removes only those IDs and never drops collections or deletes unrelated records. Keep the configured demo emails stable; if you need different emails, reset the demo records first, update `.env`, then seed again. The dated exception is set one week in the future so it remains valid when seeding later.

## Checks

```powershell
npm run lint
npm run typecheck
npm run build
npm test
```

Tests use an in-memory MongoDB replica set. The API also uses transactions for tutor availability/profile operations, so a standalone MongoDB server is insufficient; use the local replica set above or a transaction-capable Atlas deployment.

## API reference and limitations

The implemented API is documented in [openapi.yaml](./openapi.yaml). Every `/api/subjects` and `/api/tutors` route, including public tutor reads, requires a valid Bearer access token. Public tutor serializers exclude account credentials and internal moderation fields.

Only routes listed in the OpenAPI file are currently mounted. University catalogue, session-request, session, review, notification, and admin-management routes shown as future contract areas in `docs/backend-architecture.md` are not available in this API yet. Review submission and maintenance of tutor rating aggregates are also not implemented.
