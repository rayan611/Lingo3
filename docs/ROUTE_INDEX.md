# Lingo3 — route index

Reviewed: 2026-11-09. App version: 0.7.5.
Code reference: base main `dfa536ed7197aa7de6aa3698859f79cb5adcbb56`; branch `feat/review-card-removal`; `src/ui/Training.tsx`, `Review.tsx`, `WordCard.tsx`, `src/App.tsx`.
Review scope: highlighted information button opens full native/active-learning-language details from Word Practice and Recall. Bottom Remove offers tests-only suspension (manual practice retained) or personal-list soft removal; shared bank retained. Restore to tests available for suspended words. Detail Back returns to the current activity; recall removal skips the word without grading/counting it. Paths/primary menus unchanged.


## Workspace routes

| Path | Internal tab / screen | Entry | Back / return |
|---|---|---|---|
| / | add / AddWord | Logo, Add a word primary tile, Home/exit actions | Browser tab history |
| /training-center | training-center / TrainingCenter | Primary tile, child return link | Home → / |
| /words | browse / Browse | Training Center + sibling navigation | Training Center link; browser history |
| /grammar | grammar / GrammarManager | Training Center + siblings | Training Center link; browser history |
| /read | read / StoryMode | Training Center + siblings | Training Center link; browser history |
| /review | training / Training | Training Center + siblings | Home/exit → /; browser history |
| /recall | review / ReviewTab | Recall test primary tile | Exit resets review session and returns to / |
| /translate | translate / Translate | Primary tile | Other primary tiles; browser history |
| /settings | settings / SettingsPanel | Primary tile | Other primary tiles; browser history |

Workspace sign-in is enforced by App when authConfigured and no session. State changes push a history entry with lingo3Tab and TAB_PATHS; popstate restores valid tabs. Trailing slashes are normalized for route selection. Unknown/non-screen entry paths initialize the Add screen while preserving the initial URL until a navigation occurs. Do not invent dedicated login, profile or admin URLs: those are conditional/nested components.

## Public and conditional routes

| URL / condition | Behavior | Navigation |
|---|---|---|
| /showcase.html | Static public showcase | Header/footer anchors and App Login/Open app |
| /privacy | Privacy before session gate | Explicit Back pushes / |
| /invite/<name> | Parsed inviter-aware landing | Open clears invite URL to /; current entry/session logic retained |
| First visit, signed out | Landing | Open app → session gate |
| Auth configured, signed out | SignIn | Existing authentication flow |
| Recovery session | ResetPassword before Workspace | Done ends recovery and resumes Workspace |

Public aliases/first-visit behavior remain subject to existing service-worker/server configuration; no deployment routing change is part of this batch.

## API inventory (not pages)

Existing handlers, verified by repository paths: /api/expand, /api/translate, /api/story, /api/tts, /api/grammar-examples, /api/ai-status. Authentication, rate limiting and provider behavior are governed by their existing handlers; this review does not certify all endpoint behavior.

Shared-bank RPC `lookup_shared_expansion` is called before AI by src/ai/expand.ts when no hint/partner is supplied. The new 200-concept batch covers all eight supported languages. Stored form keys removed repeated morphology parsing: anonymous database samples measured 13–68 ms; eight real HTTPS inflection lookups parsed correctly. Network timing is separate (one initial cold HTTPS request took 7.228 seconds; the seven warm requests took 155–415 ms). The client still waits 1.8 seconds before its server fallback; hints/paired words intentionally request custom context. No new navigation entry is required.

## Status

All listed workspace/public entries are implemented in reviewed source. No new planned feature is represented as an active route. The bank admin UI has no new route in this change; query performance was improved within the existing RPCs. Existing compatibility paths are retained intentionally; no links or pages were removed. Signed-in visual/browser Back testing was not performed in this data-only task.
