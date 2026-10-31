# Shared vocabulary

The common vocabulary lives in Supabase; a learner's selected concepts,
entries, and FSRS cards continue to live in the app's local Dexie store and
sync tables. This keeps review available offline and keeps scheduling private.

The core pack has 299 reviewed multilingual concepts (1,794 language entries)
with parallel examples. `lookup_shared_expansion` returns the same `Expansion`
shape as `/api/expand`, including the meaning and example gloss in the user's
native language. Exact, unambiguous, complete matches are returned without an
AI call. Hints and paired words use AI because their examples are contextual.

The supplied Lexin ZIP contains Swedish source data, not translations into
all Lingo3 languages. Its 18,876 normalized headwords and 21,179 senses are
stored in `dictionary_words` and `dictionary_senses`. They are source material,
not yet ready multilingual cards; they fall through to AI until the required
target-language entries have been generated and checked. A spelling match
alone does not merge a core concept with a Lexin sense.

After a complete AI result, the Vercel endpoint can cache it through the
service-role-only `cache_ai_expansion` function. This requires
`SUPABASE_SERVICE_ROLE_KEY` as a **server-side Vercel Secret**. The secret must
never be prefixed with `VITE_`. Until configured, the app still reads the core
pack and uses AI for misses. The current implementation awaits the short cache
write before sending an AI result, so a server shutdown cannot lose that write.

## Source credit

Swedish dictionary data: **Svenska ord/LEXIN, second edition**, Språkbanken
Text, University of Gothenburg, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
[Dataset and download](https://www.sprakbanken.se/resurser/lexin),
DOI: 10.23695/zkzz-bm37. The ZIP contains a provisional license dated 2002;
the current official catalogue labels the ZIP CC BY 4.0. The six-language core
pack was supplied separately by the project owner and is not represented as
a Lexin translation.
