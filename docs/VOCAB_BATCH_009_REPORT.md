# Vocabulary batch 009 — adjectives, opposites, time and place

Date: 2026-11-08. Application 0.7.3; reviewed source main `8e42f3261dc6992a728985290c58ea946f401719`.
Branch: `data/adjectives-time-place-20261108`. Payload commit: `f260213b1dd66f0b7cb34fc0753d530c563bfbb5`.
Supabase: `vfximbxcxczntqywdryd`.

## Live result

Exactly 100 new concepts / 600 entries: 50 distinct new adjectives, each with an opposite, plus 50 new time/place adverbs or adverbial expressions. Six languages: fa, en, sv, de, es, it. This batch is not a frequency-ranked corpus. Existing very common words (now, today, under, next to, etc.) were reused rather than inserted again.

The 50 new adjectives comprise 20 new opposite pairs and 10 adjectives whose opposite already exists. There are 30 documented pairs covering all 50 new adjectives. Opposites are localized, visible entry notes; they are not new structured WordLink fields or clickable antonym links. Old entries were not edited to add reciprocal notes. See `batch-009-antonyms.json` for exact concept references.

Ready bank: 4,183 concepts / 25,090 entries → **4,283 / 25,690**. Same-language normalized-headword/POS duplicate groups remain **0**. Previous records' checksums are unchanged.

## Verification

- Six-language `precheck_core_vocab` passed before authoring and again before import.
- Initial rollback rehearsals detected 11 cross-POS/inflection ambiguities; replaced the affected candidates using natural distinct words/expressions. Final full rehearsal returned the correct concept in 600/600 explicit-language lookups, then rolled back.
- Production insertion was atomic under table write locks, with precheck and exact 100-concept / 600-entry assertions.
- Production full lookup: 600/600 correct with explicit source language (postgres role).
- Anonymous role: six direct representative searches, one per language, all returned the correct concept. Authenticated role: one real full expansion (tillgänglig → accessible), correct notes/forms/examples. No invented signed-in user was used.
- Production stored payload comparison: 600/600 exact headword, example, morphology and note matches.
- Repeat import: 0 inserted, 100 already present, no clashes; rehearsal rolled back.
- `node scripts/check-vocab-009.mjs`: 100 concepts, 600 entries, 250 adjective morphology objects, 300 localized opposite notes, 30 valid antonym pairs.
- Payload file SHA-256: `cdf49eaa61002dcfd948a2ec9777e8b726273fe3b60e18c6ac9d7d7fb6e15d16`.
- Existing concept checksum before/after: `4f19e7e5783437009ea2246b4fb7ddda`; entry checksum: `6cbf50e584fa9f4beddb2adfeed874ea`.

## Material speed limitation

An anonymous single-query EXPLAIN ANALYZE for `efter lunch` measured **3,158.670 ms inside PostgreSQL**. The current client bank request in `src/ai/expand.ts` times out after **1,800 ms**. Consequently these cards are live and retrievable, but **the complete UI path is not verified to avoid AI**. Existing ambiguous automatic-language searches may also fall back to AI; the source-language selector is useful. Hints/paired-word requests intentionally bypass the bank. French/Russian are not included in this six-language batch and may still require AI.

An attempted all-card anonymous/authenticated aggregate test timed out; its transaction rolled back and the live batch count was confirmed zero before the successful final import. Full all-card RLS testing and latency optimization remain open. No RLS, function privileges, lookup policy or application timeout was changed to hide this limitation. A focused follow-up should profile the indexed form lookup under RLS and verify representative bank responses inside the client's time budget.

No app-source/schema/auth/user-list changes; no application build/deployment is needed for shared-bank data. No browser/phone/offline E2E or independent human proofreading in all six languages was performed. This package does not automatically add words to a user's personal list.

## Navigation review

`docs/SITEMAP.md` and `docs/ROUTE_INDEX.md` were absent on reviewed main and are added from current App.tsx navigation and SettingsPanel.tsx sections. Routing and menus did not change. Public/share routes remain documented separately from authenticated workspace screens. No orphan page was created by this data import.

## Recovery

Reimporting this file is safe and idempotent. Do not count it as new words again. If content needs to be withdrawn, quarantine only the exact 100 source keys in this JSON with a separately authorized operation; physical deletion is unnecessary. Existing words and personal cards are outside this batch.

## New adjectives

| فارسی | English | Svenska | متضاد |
|---|---|---|---|
| مسئولیت‌پذیر | responsible | ansvarsfull | بی‌مسئولیت. |
| بی‌مسئولیت | irresponsible | oansvarig | مسئولیت‌پذیر. |
| قابل‌اعتماد | reliable | pålitlig | غیرقابل‌اعتماد. |
| غیرقابل‌اعتماد | unreliable | opålitlig | قابل‌اعتماد. |
| قانونی | legal | laglig | غیرقانونی. |
| غیرقانونی | illegal | olaglig | قانونی. |
| قابل‌مشاهده | visible | synlig | نامرئی. |
| نامرئی | invisible | osynlig | قابل‌مشاهده. |
| دسترس‌پذیر | accessible | tillgänglig | دسترس‌ناپذیر. |
| دسترس‌ناپذیر | inaccessible | otillgänglig | دسترس‌پذیر. |
| مناسب | suitable | lämplig | نامناسب. |
| نامناسب | unsuitable | olämplig | مناسب. |
| مؤثر | effective | effektiv | بی‌اثر. |
| بی‌اثر | ineffective | ineffektiv | مؤثر. |
| فعال | active | aktiv | غیرفعال. |
| غیرفعال | inactive | inaktiv | فعال. |
| انعطاف‌پذیر | flexible | flexibel | انعطاف‌ناپذیر. |
| انعطاف‌ناپذیر | inflexible | oflexibel | انعطاف‌پذیر. |
| موقتی | temporary | tillfällig | دائمی. |
| دائمی | permanent | permanent | موقتی. |
| برابر | equal | jämlik | نابرابر. |
| نابرابر | unequal | ojämlik | برابر. |
| منصفانه | fair | rättvis | ناعادلانه. |
| ناعادلانه | unfair | orättvis | منصفانه. |
| منظم | regular | regelbunden | نامنظم. |
| نامنظم | irregular | oregelbunden | منظم. |
| فرمان‌بردار | obedient | lydig | نافرمان. |
| نافرمان | disobedient | olydig | فرمان‌بردار. |
| بالغ | mature | mogen | نابالغ. |
| نابالغ | immature | omogen | بالغ. |
| خوردنی | edible | ätlig | غیرخوراکی. |
| غیرخوراکی | inedible | oätlig | خوردنی. |
| بردبار | tolerant | tolerant | نابردبار. |
| نابردبار | intolerant | intolerant | بردبار. |
| عقلانی | rational | rationell | غیرعقلانی. |
| غیرعقلانی | irrational | irrationell | عقلانی. |
| اهل همکاری | cooperative | samarbetsvillig | ناهمکار. |
| ناهمکار | uncooperative | ovillig att samarbeta | اهل همکاری. |
| بادقت | attentive | uppmärksam | بی‌توجه. |
| بی‌توجه | inattentive | ouppmärksam | بادقت. |
| کم‌عمق | shallow | grund | عمیق. |
| کج | crooked | krokig | صاف. |
| مات | opaque | ogenomskinlig | شفاف. |
| نادرستکار | dishonest | oärlig | درستکار. |
| ناقص | imperfect | ofullkomlig | کامل. |
| بی‌اهمیت | unimportant | oviktig | مهم. |
| ناسپاس | ungrateful | otacksam | سپاسگزار. |
| ناکافی | insufficient | otillräcklig | کافی. |
| بی‌ارزش | worthless | värdelös | باارزش. |
| بی‌باک | fearless | orädd | ترسیده. |

## New time/place expressions

Multiword time/place expressions are stored as adverbs to match their adverbial use in the examples; their component words can have other parts of speech.

| فارسی | English | Svenska |
|---|---|---|
| بعد از ناهار | after lunch | efter lunch |
| کمی بعد | shortly afterwards | strax därefter |
| از پیش | beforehand | i förväg |
| پس از آن | afterwards | efteråt |
| در گذشته | in the past | förr i tiden |
| امشب | tonight | ikväll |
| دیشب | last night | igår kväll |
| پریروز | the day before yesterday | i förrgår |
| پس‌فردا | the day after tomorrow | i övermorgon |
| امروز صبح | this morning | i morse |
| فردا صبح | tomorrow morning | imorgon bitti |
| هفتهٔ گذشته | last week | förra veckan |
| هفتهٔ آینده | next week | nästa vecka |
| این هفته | this week | den här veckan |
| ماه گذشته | last month | förra månaden |
| ماه آینده | next month | nästa månad |
| این ماه | this month | den här månaden |
| سال گذشته | last year | förra året |
| سال آینده | next year | nästa år |
| امسال | this year | i år |
| هر روز | every day | varje dag |
| هر هفته | every week | varje vecka |
| هر ماه | every month | varje månad |
| هر سال | every year | varje år |
| تمام روز | all day | hela dagen |
| تمام شب | all night | hela natten |
| شب‌ها | at night | på natten |
| قبل از ناهار | before lunch | före lunch |
| بعد از کار | after work | efter jobbet |
| هنگام غروب | at dusk | i skymningen |
| سر وقت | on time | i tid |
| هم‌زمان | at the same time | samtidigt |
| از این به بعد | from now on | från och med nu |
| از آن زمان | since then | sedan dess |
| سرانجام | eventually | så småningom |
| برای همیشه | forever | för alltid |
| به سمت شرق | eastward | österut |
| به سمت غرب | westward | västerut |
| به سمت شمال | northward | norrut |
| به سمت جنوب | southward | söderut |
| جای دیگر | somewhere else | någon annanstans |
| آن طرف | over there | där borta |
| این طرف | over here | här borta |
| سمت چپ | to the left | till vänster |
| سمت راست | to the right | till höger |
| مستقیم به جلو | straight ahead | rakt fram |
| در وسط | in the middle | i mitten |
| در فضای بسته | indoors | inomhus |
| در فضای باز | outdoors | utomhus |
| در دوردست | far away | långt borta |
