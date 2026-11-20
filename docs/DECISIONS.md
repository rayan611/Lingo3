# Decisions

## 2026-11-20 — Academy administrative access

Use role-checked database functions with administrative audit records for creating enrollments, accessing private workspaces and notes, and permanently deleting eligible teachers. Public teacher articles expose only published translations; underlying author account IDs are not returned by the profile endpoint. A teacher with any foreign-key dependency cannot be deleted until those dependencies are handled; deactivation remains available. The administrator works as an administrator rather than impersonating an account. The migration is additive and old application code does not depend on its new fields.

2026-11-20: Academy administration uses audited operations under the administrator identity, not account impersonation. Permanent teacher deletion is denied when references remain; this prevents loss of historical records.

2026-11-20: Preserve historical records through an irreversible anonymous teacher marker instead of cascading deletion. Active enrollments, classes and bookings must be transferred or resolved before erasure. Messages sent through admin panels retain admin as sender.
