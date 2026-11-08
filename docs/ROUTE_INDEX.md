# Lingo3 — route index

Reviewed: 2026-11-08. App version: 0.7.3.
Code reference: main `8e42f3261dc6992a728985290c58ea946f401719`, especially `src/App.tsx` TAB_PATHS / tabFromPath / HomeTiles / TrainingCenter.
No route implementation changed in vocabulary batch 009.

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

Shared-bank RPC `lookup_shared_expansion` is called before AI by src/ai/expand.ts when no hint/partner is supplied. Six-language data-only additions are immediately available from Supabase and do not require a new navigation entry. A 3.159-second anonymous DB query exceeded the current 1.8-second client wait in verification; fast UI bank acceptance remains open.

## Status

All listed workspace/public entries are implemented in reviewed source. No new planned feature is represented as an active route. The bank admin UI and performance follow-up have no new route in this change. Existing compatibility paths are retained intentionally; no links or pages were removed. Signed-in visual/browser Back testing was not performed in this data-only task.
