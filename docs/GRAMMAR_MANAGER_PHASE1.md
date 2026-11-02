# Grammar Manager

Offline-first personal sections and rules per language, including creation, rule editing, search, soft deletion and a language picker. Dexie account stores stay isolated. Anonymous notes are adopted on sign-in.

Cloud sync uses private Supabase tables and atomic conditional writes against the existing `updated_at` revision token. RLS enforces auth.uid() ownership; the UPDATE includes the exact previously observed token, so Postgres rejects stale writes. New records use INSERT, never blind UPSERT. Device timestamps do not decide which edit wins. Clients preserve conflicting edits as visible conflict copies, including edit/delete races. Local edits made during an upload remain pending. Account switches cancel work against the captured database handle. Grammar errors are reported separately from vocabulary sync.

Sync runs on sign-in/load, reconnection, periodic intervals, backgrounding, after grammar writes, and through Sync now. A newly created conflict copy is uploaded on the following pass. Full paginated reconciliation includes tombstones; this first release favors correctness over incremental reads.

Validation: `npm test`, `npm run typecheck`, `npm run build`. `scripts/check-grammar.ts` models two independent devices and concurrent edits. `scripts/check-grammar-db.sql` runs inside BEGIN/ROLLBACK against a database with at least two existing accounts and checks owner CRUD, stale-write rejection, cross-user isolation and anonymous denial. A separate least-privilege migration revokes anonymous access and non-CRUD grants on the grammar tables. No test data should persist.

Rollout: the initial grammar tables and owner RLS were applied by concurrent project work. This release uses that schema without another migration. A proposed numeric-version RPC migration passed a rollback rehearsal but was not applied: the Supabase confirmation expired twice. That approach was discarded in favor of compatible atomic conditional updates. No vocabulary/auth data is rewritten. The daily backup workflow currently skips its dump/upload steps and must not be described as a working backup.

Deferred: curated shared library, AI improvements, sharing, section hierarchy editing/deletion, example authoring UI and level/tag editing. These are separate follow-up features.
