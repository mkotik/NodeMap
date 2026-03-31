- use scss, not module.scss. all scss should be scoped within the page so there are no naming conflicts.
- Always read @DESIGN.md for design context and specifications.

## Database Migrations

Prisma's `migrate dev` and `migrate deploy` cannot reach the Railway database directly (the migration engine fails with P1001 even though the public proxy is TCP-reachable). To apply migrations:

1. Create the migration folder and SQL file under `web-interface/prisma/migrations/<timestamp>_<name>/migration.sql` as normal.
2. Run `npx prisma generate` to update the client.
3. Apply the SQL and register it in `_prisma_migrations` via the `pg` client:

```js
node -e "
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL });
c.connect()
  .then(() => c.query('<YOUR SQL HERE>'))
  .then(() => c.query(\`INSERT INTO _prisma_migrations (id, checksum, migration_name, finished_at, applied_steps_count) VALUES (gen_random_uuid(), '', '<timestamp>_<name>', NOW(), 1) ON CONFLICT DO NOTHING\`))
  .then(() => { console.log('Migration applied'); return c.end(); })
  .catch(e => { console.error(e.message); c.end(); process.exit(1); });
"
```

Use `IF NOT EXISTS` / `IF EXISTS` in ALTER statements for safety.
