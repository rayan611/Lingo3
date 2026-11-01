# Agent and Human Development Rules

Version: 1.0.0 (2026-11-01)

1. Read `docs/PRODUCT_CHARTER.md` before proposing or implementing changes. Preserve its mission, target users and boundaries.
2. Read project README, applicable architecture, open issues, current branch, recent commits and latest handoff. Never assume chat memory is authoritative.
3. Work in a dedicated feature branch. Do not merge to main, deploy production, change production database, rotate secrets, or perform destructive operations without explicit owner approval.
4. Describe task, acceptance criteria, risks and expected tests. Keep changes minimal and backwards compatible.
5. Run relevant tests; report what ran, what passed, and what could not be verified. Never fabricate results.
6. Record completed work, branch/commit, remaining tasks, blockers and next step in `docs/DEVELOPMENT_HANDOFF.md` or a linked GitHub issue/PR.
7. Propose instruction changes through PRs, increment semantic version, and update the revision history. Product-specific instructions cannot override platform safety requirements.
8. Humans, ChatGPT, Claude and other agents use the same GitHub state; never rely on one provider's proprietary memory for project continuity.

## Revision history
| Version | Date | Change |
| --- | --- | --- |
| 1.0.0 | 2026-11-01 | Initial cross-agent working protocol |
