# Vocabulary batch 010 and fast inflection lookup

Date: 2026-11-08. App version: 0.7.4. Repo: rayan611/Lingo3.
Branch: feat/verb-bank-fast-lookup-20261108.
Reviewed navigation/code base: 8e42f3261dc6992a728985290c58ea946f401719; incorporated the already-live batch-009 archive from PR #37 (merge 11a2595b6a2d40c53a5b7b4ed5e0a6a59c37ccf4).
Project: vfximbxcxczntqywdryd.

## Delivered data

Exactly **200 new verb concepts / 1,600 entries** in **all eight supported languages**: fa, en, sv, de, es, it, fr, ru.
Ready bank: 4,283 concepts / 25,690 entries → **4,483 / 27,290**. Ready verb count: **271 → 471**.
A 364-concept multilingual draft was checked against the live bank in every language; 327 were headword-clean. The final 200 use distinct everyday/work/communication/action verbs with dictionary-covered simple headwords. This is an editorial selection, not a corpus-certified top-200 frequency list.

Final payload: data/shared-vocab/batch-010.json. SHA-256: **b37ac48124ebddb0edd0dc4b67ccb399a1eb6b322ce9417cdecb15a09ddfd253**.
Repeat import: **0 inserted / 200 already present / no clashes**. Same-language normalized-headword/POS duplicate groups remain **0**. Existing user and shared vocabulary were not overwritten; previous-record checksums remain unchanged:
- concepts: ae24acb2366adcdaca0604aaa53e2a68
- entries excluding the new generated form_keys column: 86a031714d75101b45893e713030a16f

The final archive is canonical. Do not import the preparatory historical payload from commit a3d8f013a18291791c5eff8180ef59cdcdaa3693: subsequent fixes deliberately removed bare-infinitive aliases from reflexive verbs and narrowed Romance extra aliases to simple finite indicative/conditional/subjunctive forms. Only newly imported batch-010 rows were adjusted. These refinements remove malformed template nonfinite/imperative combinations; they do not remove the verb concepts.

## Search and latency

The previous expression index still caused expensive repeated morphology parsing under RLS. Added a generated stored text[] column and GIN index; the existing two raw lookup functions now query the stored arrays and normalize the search term once per supported language. Stored keys automatically follow insert/update operations. No authentication, RLS policy, function owner, SECURITY INVOKER behavior, grants, core preference or ambiguity refusal was relaxed. Public wrappers remain unchanged.

The schema accepts optional additionalForms for verbs and Persian simple forms, preserving extra semicolon-separated dictionary conjugations when cards are saved locally. Named morphology fields still display using the established UI.

All stored lexical fields (including additionalForms) participate in exact form lookup across the eight supported languages. Metadata and example/notes prose are not lexical keys. Source-language selection disambiguates identical spellings. Genuinely ambiguous concepts still return a miss instead of guessing. Missing selected languages may still use partial AI completion. Hints/paired-word context intentionally retain the existing custom-generation behavior.

Measured anonymous database execution: **68.234 ms** for the prior slow example efter lunch (previous run 3158.670 ms), and **13.345 ms** for Russian крадёт after importing the new data. These are server-side measurements, not browser latency promises.
Eight real anonymous HTTPS requests for stulit / stole / gestohlen / robaste / rubavano / volaient / крадёт / می‌دزدد returned the correct concept with all eight entries and passed the actual ExpansionSchema. The first cold HTTP request took 7,228 ms including connection setup; the next seven took 155–415 ms. The existing client 1,800-ms wait and server fallback remain. Network failures/timeouts can still affect the user experience.

## Validation

- Final live full-header lookup: **1,600 / 1,600** return the expected concept with explicit source language (postgres role).
- Anonymous representative header checks: **16/16**; authenticated-role checks: **16/16**. No fake signed-in production account was created.
- Final stored-payload equality and final immutable raw-file request are recorded in the verification JSON.
- Local focused checker: **200 concepts, 1,600 entries/morphology parses, 36,211 searchable entry/form keys** (includes repeated keys across concepts/languages).
- SQL regression fixtures pass: draft/rejected rows hidden, ready forms returned, ambiguous forms refused, metadata/example text/substrings not matched, existing sitter/suttit preserved, generated aliases refreshed after morphology updates. Transaction rolled back; **0 fixture concepts remain**.
- All ten existing local regression scripts passed through node --import tsx. The normal npm test entry failed only because this runtime forbids tsx CLI's IPC pipe; the same test files were run directly. The expanded API suite proves a complete inflected bank hit returns origin=bank without provider or AI-usage-counter calls.
- Typecheck and production/PWA build passed; CI 42484015283 passed; PR #38 merged as 72e67705487bddf4f3094cc618169c594127a9b3. Production dpl_Eib5QQ2tsEC2dpGKDGBKX6PPXkGd is READY with that code commit and lingo3.com/www aliases; public version is 0.7.4. Final payload comparison is 1,600/1,600 exact.
- Security advisor findings are unchanged from baseline; no new finding introduced by this migration.
- No physical signed-in phone/browser or offline end-to-end acceptance, exhaustive check of every grammatical paradigm, or independent human proofreading in eight languages was performed.

## Sources and content limits

- Swedish dictionary forms: existing Lexin/Svenska ord rows in this project, linked by infinitive tokens or present-tense lemmas; the 220 matching source records are archived in batch-010-lexin-matches.json. Manual overrides cover modern words absent there and known irregular forms.
- French/Spanish/Italian: verbecc **2.0.3** dictionary/template output, **no ML-predicted conjugations accepted**; finite templates were reviewed and filtered, with explicit auxiliary/irregular overrides. https://github.com/bretttolbert/verbecc (LGPL; upstream Verbiste/mlconjug attribution in that project).
- German: RosaeNLG german-verbs **5.4.0** and german-verbs-dict **3.4.0**, derived from LanguageTool german-pos-dict; known inseparable-prefix, spelling and sense errors were corrected. https://github.com/RosaeNLG/rosaenlg and https://github.com/languagetool-org/german-pos-dict ; dictionary resources CC-BY-SA-4.0. Preserve this attribution with redistributed derived German data.
- English: lemminflect **0.2.3**, with semantic override for lie/lied and regular-word overrides. https://github.com/bjascob/LemmInflect .
- Russian: pymorphy3 **2.0.6** / OpenCorpora dictionary **2.4.417150.4580142**. Only known dictionary infinitives and finite forms accepted. https://github.com/no-plagiarism/pymorphy3 and https://opencorpora.org/ (dictionary CC-BY-SA).
- Persian compound stems/forms were authored for this package, preserving common spacing variants.

Examples use original, parallel grammar-practice frames (“Today we are practising the verb …”). They are not 200 individually contextualized usage examples. Extra forms improve retrieval; this release does not promise every possible compound tense/person phrase in every language.

## Rollback and navigation

scripts/rollback-stored-forms.sql restores only the previous lookup definitions; additive column/index and vocabulary remain. Do not delete personal rows. Data can be quarantined by exact package source keys if a later review requires it; no physical deletion is needed.

SITEMAP.md and ROUTE_INDEX.md were reviewed against current App/Settings/showcase navigation and updated to 0.7.4. No new route, menu, Back behavior or admin page was introduced.

## Verb list

| English | فارسی | Svenska |
|---|---|---|
| to steal | دزدیدن | stjäla |
| to kill | کشتن | döda |
| to shoot | شلیک کردن | skjuta |
| to escape | گریختن | fly |
| to threaten | تهدید کردن | hota |
| to protect | محافظت کردن | skydda |
| to defend | دفاع کردن | försvara |
| to attack | حمله کردن | attackera |
| to punish | تنبیه کردن | straffa |
| to arrest | بازداشت کردن | arrestera |
| to rescue | نجات دادن | rädda |
| to survive | زنده ماندن | överleva |
| to suffer | رنج بردن | lida |
| to injure | مجروح کردن | skada |
| to heal | التیام یافتن | läka |
| to treat | درمان کردن | behandla |
| to examine | معاینه کردن | undersöka |
| to operate | جراحی کردن | operera |
| to breathe | نفس کشیدن | andas |
| to meditate | مراقبه کردن | meditera |
| to stretch | کشش دادن | sträcka |
| to bend | خم کردن | böja |
| to crawl | خزیدن | krypa |
| to dive | شیرجه زدن | dyka |
| to compete | رقابت کردن | tävla |
| to participate | شرکت کردن | delta |
| to beat | شکست دادن | besegra |
| to admire | تحسین کردن | beundra |
| to respect | احترام گذاشتن | respektera |
| to forgive | بخشیدن | förlåta |
| to regret | پشیمان بودن | ångra |
| to complain | شکایت کردن | klaga |
| to criticize | انتقاد کردن | kritisera |
| to praise | ستایش کردن | berömma |
| to encourage | دلگرم کردن | uppmuntra |
| to support | حمایت کردن | stödja |
| to motivate | انگیزه دادن | motivera |
| to inspire | الهام بخشیدن | inspirera |
| to impress | تحت تأثیر قرار دادن | imponera |
| to annoy | کلافه کردن | irritera |
| to surprise | غافلگیر کردن | överraska |
| to frighten | ترساندن | skrämma |
| to calm | آرام کردن | lugna |
| to entertain | سرگرم کردن | underhålla |
| to envy | حسادت کردن | avundas |
| to admit | اعتراف کردن | erkänna |
| to deny | انکار کردن | förneka |
| to confess | اقرار کردن | bekänna |
| to lie | دروغ گفتن | ljuga |
| to obey | اطاعت کردن | lyda |
| to refuse | امتناع کردن | vägra |
| to approve | تصویب کردن | godkänna |
| to reject | رد کردن | avvisa |
| to prevent | جلوگیری کردن | förhindra |
| to avoid | اجتناب کردن | undvika |
| to risk | به خطر انداختن | riskera |
| to dare | جرئت کردن | våga |
| to deserve | سزاوار بودن | förtjäna |
| to depend | بستگی داشتن | bero |
| to belong | تعلق داشتن | tillhöra |
| to include | شامل بودن | inkludera |
| to exclude | مستثنا کردن | utesluta |
| to contain | در بر داشتن | innehålla |
| to consist | تشکیل شدن | bestå |
| to exist | وجود داشتن | finnas |
| to disappear | ناپدید شدن | försvinna |
| to endure | تاب آوردن | uthärda |
| to tolerate | تحمل کردن | tolerera |
| to adapt | سازگار کردن | anpassa |
| to adjust | تنظیم کردن | justera |
| to develop | توسعه دادن | utveckla |
| to expand | گسترش دادن | utvidga |
| to reduce | کاهش دادن | reducera |
| to multiply | ضرب کردن | multiplicera |
| to divide | تقسیم کردن | dividera |
| to subtract | تفریق کردن | subtrahera |
| to calculate | محاسبه کردن | beräkna |
| to predict | پیش‌بینی کردن | förutsäga |
| to prove | اثبات کردن | bevisa |
| to confirm | تأیید کردن | bekräfta |
| to verify | راستی‌آزمایی کردن | verifiera |
| to identify | شناسایی کردن | identifiera |
| to discover | کشف کردن | upptäcka |
| to invent | اختراع کردن | uppfinna |
| to create | خلق کردن | skapa |
| to design | طراحی کردن | utforma |
| to produce | تولید کردن | producera |
| to manufacture | تولید صنعتی کردن | tillverka |
| to install | نصب کردن | installera |
| to connect | متصل کردن | ansluta |
| to charge | شارژ کردن | ladda |
| to copy | کپی کردن | kopiera |
| to browse | مرور کردن | bläddra |
| to scan | اسکن کردن | skanna |
| to broadcast | پخش کردن | sända |
| to publish | منتشر کردن | publicera |
| to filter | فیلتر کردن | filtrera |
| to encrypt | رمزگذاری کردن | kryptera |
| to decrypt | رمزگشایی کردن | dekryptera |
| to synchronize | همگام‌سازی کردن | synkronisera |
| to analyze | تحلیل کردن | analysera |
| to evaluate | ارزیابی کردن | utvärdera |
| to investigate | تحقیق کردن | utreda |
| to observe | مشاهده کردن | observera |
| to notice | متوجه شدن | märka |
| to focus | تمرکز کردن | fokusera |
| to concentrate | متمرکز کردن | koncentrera |
| to revise | بازنگری کردن | revidera |
| to summarize | خلاصه کردن | sammanfatta |
| to describe | توصیف کردن | beskriva |
| to define | تعریف کردن | definiera |
| to clarify | روشن کردن موضوع | förtydliga |
| to specify | مشخص کردن | specificera |
| to mention | ذکر کردن | nämna |
| to announce | اعلام کردن | meddela |
| to warn | هشدار دادن | varna |
| to persuade | متقاعد کردن | övertala |
| to convince | قانع کردن | övertyga |
| to recommend | توصیه کردن | rekommendera |
| to consult | مشورت کردن | rådgöra |
| to interrupt | قطع کردن صحبت | avbryta |
| to respond | واکنش نشان دادن | reagera |
| to express | بیان کردن | uttrycka |
| to communicate | ارتباط برقرار کردن | kommunicera |
| to gossip | غیبت کردن | skvallra |
| to chat | گپ زدن | chatta |
| to whistle | سوت زدن | vissla |
| to sigh | آه کشیدن | sucka |
| to roar | غریدن | ryta |
| to bark | پارس کردن | skälla |
| to meow | میو کردن | mjaua |
| to chirp | جیک‌جیک کردن | kvittra |
| to buzz | وزوز کردن | surra |
| to sniff | بو کشیدن | sniffa |
| to scratch | خاراندن | klia |
| to rub | مالیدن | gnugga |
| to squeeze | فشردن | klämma |
| to pinch | نیشگون گرفتن | nypa |
| to hit | زدن | slå |
| to break | شکستن | bryta |
| to crush | خرد کردن | krossa |
| to tie | گره زدن | knyta |
| to hang | آویزان کردن | hänga |
| to attach | وصل کردن | fästa |
| to detach | جدا کردن | lossa |
| to arrange | چیدن | ordna |
| to decorate | تزئین کردن | dekorera |
| to renovate | بازسازی کردن | renovera |
| to restore | بازگرداندن | återställa |
| to polish | صیقل دادن | polera |
| to sharpen | تیز کردن | vässa |
| to saw | اره کردن | såga |
| to weld | جوش دادن | svetsa |
| to glue | چسب زدن | limma |
| to turn | برگرداندن | vända |
| to roll | غلتاندن | rulla |
| to slide | سر خوردن | glida |
| to drag | کشاندن | släpa |
| to lower | پایین آوردن | sänka |
| to balance | متعادل کردن | balansera |
| to accelerate | شتاب دادن | accelerera |
| to steer | هدایت کردن فرمان | styra |
| to flow | جریان داشتن | strömma |
| to chop | خردخرد کردن | hacka |
| to knead | ورز دادن | knåda |
| to season | چاشنی زدن | krydda |
| to serve | سرو کردن | servera |
| to feed | غذا دادن | mata |
| to fertilize | کود دادن | gödsla |
| to prune | هرس کردن | beskära |
| to bloom | شکوفه دادن | blomma |
| to wither | پژمرده شدن | vissna |
| to sprout | جوانه زدن | gro |
| to recycle | بازیافت کردن | återvinna |
| to conserve | حفظ منابع کردن | bevara |
| to pollute | آلوده کردن | förorena |
| to destroy | ویران کردن | förstöra |
| to rinse | آبکشی کردن | skölja |
| to disinfect | ضدعفونی کردن | desinficera |
| to separate | جدا ساختن | separera |
| to combine | ترکیب کردن | kombinera |
| to invest | سرمایه‌گذاری کردن | investera |
| to insure | بیمه کردن | försäkra |
| to import | واردات کردن | importera |
| to export | صادرات کردن | exportera |
| to transport | حمل‌ونقل کردن | transportera |
| to store | انبار کردن | förvara |
| to distribute | توزیع کردن | distribuera |
| to manage | مدیریت کردن | hantera |
| to supervise | نظارت کردن | övervaka |
| to delegate | واگذار کردن | delegera |
| to assign | تخصیص دادن | tilldela |
| to simplify | ساده کردن | förenkla |
| to complicate | پیچیده کردن | komplicera |
| to optimize | بهینه کردن | optimera |
| to coordinate | هماهنگ کردن | samordna |
| to establish | بنیان گذاشتن | inrätta |
| to fire | اخراج کردن | avskeda |
| to pronounce | تلفظ کردن | uttala |
| to quote | نقل‌قول کردن | citera |
