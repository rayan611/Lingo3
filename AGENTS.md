## Mandatory changelog workflow — effective 2026-11-19 (revision 1)

- BEFORE any code/config modification, read `CHANGELOG.md`, verify the current app version and latest relevant changes, and read `docs/DEVELOPMENT_HANDOFF.md`. Resolve missing/conflicting history against verified code; never invent releases or prior work.
- BEFORE completing work, update `CHANGELOG.md` in the same commit/change as the implementation. Every change entry must include its application version, actual date (YYYY-MM-DD), concise description, validation results/limits and commit/PR reference when known. Keep newest entries first; preserve history.
- New runtime releases must increment the app version using the existing repository mechanism and keep version sources consistent. Changes within the same unreleased version need separately dated/revisioned entries; never silently overwrite history or invent a version.
- Documentation/comment-only changes use a dated documentation revision plus the current app version; do not claim a new runtime release or deployment.
- Review/update `docs/SITEMAP.md` and `docs/ROUTE_INDEX.md` in the same change and record this in `docs/DEVELOPMENT_HANDOFF.md`. Distinguish implemented, tested, committed and deployed. Completion requires these records to be current.

# Development Agent Instructions

This repository follows the canonical [Rayan AI Development Team Master Operating Protocol](https://github.com/rayan611/apps-ontrol-panel-/blob/main/governance/MASTER_PROTOCOL.md).

At the start of every development session: read the master protocol, this repo's docs/PRODUCT_CHARTER.md if available, docs/AI_CONTEXT.md, docs/DEVELOPMENT_HANDOFF.md, and docs/DEVELOPMENT_HISTORY.md before editing code. If the task touches Academy, also read docs/ACADEMY_ROADMAP.md. Then inspect relevant commits, open PRs, deployments and database state. Never invent missing context.

Implement only approved scope, preserve working functionality, test and verify changes, use appropriate branches and PRs, and obtain explicit owner approval for high-risk production or destructive operations.

Before ending every development session: update and commit docs/DEVELOPMENT_HANDOFF.md for every real code/config change with work done, tests, deployment evidence, blockers, risks and exact next action. If Academy status changed, update docs/ACADEMY_ROADMAP.md. For every meaningful user-visible, architectural, authentication, database or navigation change, append a concise durable entry to docs/DEVELOPMENT_HISTORY.md. Tiny typo/doc-only edits may stay in the handoff only to avoid noisy history. Keep docs/AI_CONTEXT.md current when the production baseline or major architecture changes. Update docs/SITEMAP.md and docs/ROUTE_INDEX.md with any navigation change. Run npm run check:docs before completion. GitHub is the source of truth; Control Center drafts are not authoritative until published and verified in GitHub.

## Lean Development Protocol v3.0 (2026-11-02)
Follow the [central Lean Development Protocol v3.0](https://github.com/rayan611/apps-ontrol-panel-/blob/main/docs/AI_DEVELOPMENT_PROTOCOL.md) for proportional inspection, implementation, testing and handoff. This is the current owner-approved execution workflow; preserve existing security, approval and product-specific constraints.
