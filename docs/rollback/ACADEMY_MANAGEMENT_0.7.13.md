# Academy management 0.7.13 rollback

Previous production deployment: `dpl_CL2CpgMFRsPAvP4eLbP87mB8mwKm` (0.7.12). Roll back the Vercel alias to that deployment if the frontend regresses. The new schema is additive and remains compatible with 0.7.12; do not drop the plan table or Instagram column, because they may contain user data.

If an authorization problem is found, disable the affected new public and matching private RPC EXECUTE grants for `anon`/`authenticated` first, then investigate and restore least-privilege grants through a reviewed migration. Keep audit logs. Disabling the RPC will show an error in the new UI and will not erase plans or teacher information. Restoring the replaced `academy_admin_save_teacher` to the earlier definition requires a reviewed compatibility patch: the earlier version does not update Instagram, but the column and data should remain.

The guarded deletion RPC is transactional and refuses any teacher with a foreign-key dependency. A committed deletion of an eligible teacher is irreversible through the application; restore requires an appropriate database backup. No existing production teacher is deleted by this migration or its tests.
