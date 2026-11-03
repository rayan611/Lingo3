# Vocabulary batch 008 — incomplete draft, 2026-11-03

Requested: 2,000 additional concepts / 12,000 six-language cards, without duplicates or incomplete entries.
Status: **NOT IMPORTED, NOT MERGED**. Draft currently contains **1,061 concepts / 6,366 cards**; 939 concepts remain.

## Evidence
- 7,273 unused Lexin noun candidates; 2,612 distinct generated proposals; 1,551 excluded.
- Draft keys checked across every language and part of speech against the earlier bank snapshot, including rejected concepts. Snapshot hash is in staging/batch-008/review.json; the old bank snapshot is deliberately not republished.
- Swedish forms come from the Lexin source. Italian phonetic articles normalized; article/gender contradictions rejected. Conservative German genitive derivation was applied where absent and requires semantic review.
- 5,305 morphology and 6,366 expansion schema parses passed, zero failures.
- Sample review rejected a Spanish small-town headword/example mismatch. The final Mistral sample had serious sense/translation errors and zero accepted concepts; no Mistral drafts entered this checkpoint.
- Schema validation and duplicate filters do not establish correct meanings or six-language human proofreading. Live collision checks and per-concept lookup verification remain pending.
- Current database normalization retains Italian l' elision. No claim that every truly article-free Italian query works.

## Blocker
Gemini generation began returning HTTP 402. Existing Groq backup returned partial output and HTTP 413/429; its request size and concurrency were subsequently reduced. The configured Mistral fallback answered but its quality sample was unacceptable. No credit purchases or top-ups were made.

## Reproduce/check
`node --import tsx scripts/validate-batch-008.ts data/shared-vocab/staging/batch-008/draft.json /tmp/batch008-failures.json`

The third argument explicitly permits partial-draft validation; final validation without that argument requires exactly 2,000 concepts.
Selected original proposals and Lexin attribution are retained in source.json; normalized draft in draft.json; exclusions/evidence in review.json.

## Production and operations
No batch-008 database writes, app-source changes, auth/schema/RLS changes, main merge or production deployment were performed. Existing ready-bank baseline was 3,102 concepts / 18,608 cards; it was not remeasured for this checkpoint.

Generation used a separate preview-only ops branch. Provider environment targets were restored to production-only after deployment snapshots. No provider values were read or exposed. These preview deployments retain their snapshotted credentials; newest helpers expire 2026-11-04, but older helper versions may not have the expiry. Deleting those temporary deployments is still pending because the available Vercel connector does not expose deployment deletion; do not delete the project or production deployments. Temporary helper source must never merge into main or this data PR.

Next: restore the main provider's usable quota, finish at least 2,000 acceptable concepts, review meaning consistency, recheck against the live bank, dry-run and atomically import the final package, then verify live lookups and report actual totals.
