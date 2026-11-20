# Architecture

Lingo3 is a Vite/React/TypeScript application with an Academy area backed by Supabase Postgres. Academy rows are protected by row-level security; role-sensitive actions use database functions. Public Academy pages use the existing server-rendered metadata endpoint. See `SITEMAP.md` and `ROUTE_INDEX.md` for routes.

The 0.7.13 management migration introduces an RLS-protected course plan table, invoker API wrappers around checked functions in non-exposed schemas, and audited administrative views and actions. Teacher deletion refuses linked records. No authentication-session impersonation is implemented. Rollback guidance is in `rollback/ACADEMY_MANAGEMENT_0.7.13.md`.
