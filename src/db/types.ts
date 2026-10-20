import { z } from 'zod'
import { DEFAULT_THEME, type Theme } from '../lib/theme'

// ---------------------------------------------------------------------------
// Languages
// ---------------------------------------------------------------------------

// Languages live in their own dependency-free module so the serverless
// handlers can import the same list the app uses; re-exported here because
// everything already imports them from this file.
export {
  LANGUAGES,
  LANGS,
  type Lang,
} from './langs'
import { LANGUAGES, LANGS, type Lang } from './langs'

// Derived, so a new language cannot be half-added — one entry above and every
// lookup below has it.
export const LANG_NAMES = Object.fromEntries(
  Object.entries(LANGUAGES).map(([k, v]) => [k, v.name]),
) as Record<Lang, string>

export const LANG_NATIVE_NAMES = Object.fromEntries(
  Object.entries(LANGUAGES).map(([k, v]) => [k, v.native]),
) as Record<Lang, string>

/** BCP-47 tags, used for speech synthesis and `lang` attributes. */
export const LANG_BCP47 = Object.fromEntries(
  Object.entries(LANGUAGES).map(([k, v]) => [k, v.bcp47]),
) as Record<Lang, string>

export const RTL_LANGS: ReadonlySet<Lang> = new Set(
  (Object.entries(LANGUAGES) as [Lang, { rtl: boolean }][])
    .filter(([, v]) => v.rtl)
    .map(([k]) => k),
)

// ---------------------------------------------------------------------------
// Parts of speech and categories
// ---------------------------------------------------------------------------

export const PARTS_OF_SPEECH = [
  'noun',
  'verb',
  'adjective',
  'adverb',
  'preposition',
  'phrase',
  'other',
] as const
export type PartOfSpeech = (typeof PARTS_OF_SPEECH)[number]

export const CATEGORIES = [
  'daily',
  'verbs',
  'prepositions',
  'work',
  'travel',
  'food',
  'home',
  'uncategorised',
] as const
export type Category = (typeof CATEGORIES)[number]

// ---------------------------------------------------------------------------
// Morphology — deliberately per-language.
//
// A shared schema across Swedish, German and English silently loses
// information: German needs an auxiliary verb and a separable-prefix flag that
// Swedish has no use for, and the two languages' noun genders are different
// systems entirely. So this is a discriminated union on `lang`.
// ---------------------------------------------------------------------------

const svNoun = z.object({
  kind: z.literal('noun'),
  /** Swedish common/neuter gender — decides the indefinite article. */
  gender: z.enum(['en', 'ett']),
  definiteSingular: z.string().optional(),
  indefinitePlural: z.string().optional(),
  definitePlural: z.string().optional(),
})

const svVerb = z.object({
  kind: z.literal('verb'),
  infinitiv: z.string(),
  presens: z.string(),
  preteritum: z.string(),
  supinum: z.string(),
  imperativ: z.string().optional(),
  /** e.g. "gå upp" — particle verbs behave like German separables. */
  particle: z.string().optional(),
})

const deNoun = z.object({
  kind: z.literal('noun'),
  gender: z.enum(['der', 'die', 'das']),
  plural: z.string().optional(),
  /** Genitive singular — needed for the strong/weak declension patterns. */
  genitiveSingular: z.string().optional(),
})

const deVerb = z.object({
  kind: z.literal('verb'),
  infinitiv: z.string(),
  /** 3rd person singular, which is where stem changes surface. */
  praesens: z.string(),
  praeteritum: z.string(),
  partizip2: z.string(),
  /** Perfect tense auxiliary. Getting this wrong is the classic learner error. */
  auxiliary: z.enum(['haben', 'sein']),
  separable: z.boolean(),
  /** The detached prefix, if separable: "aufstehen" -> "auf". */
  prefix: z.string().optional(),
})

/**
 * Spanish. Structurally the closest to what German already needed: a gender
 * that decides the article, and a verb whose useful forms are the infinitive,
 * one present, one past and the participle.
 */
const esNoun = z.object({
  kind: z.literal('noun'),
  gender: z.enum(['el', 'la']),
  plural: z.string().optional(),
})

/**
 * Italian. Spanish's structure plus the auxiliary.
 *
 * The auxiliary is the reason this is not simply esVerb renamed: the passato
 * prossimo takes essere or avere, the choice is not predictable from the verb
 * alone, and with essere the participle agrees with the subject. It is the
 * Italian equivalent of the German haben/sein error, so it is required rather
 * than optional — a guess here is drilled for months.
 */
const itNoun = z.object({
  kind: z.literal('noun'),
  gender: z.enum(['il', 'la']),
  plural: z.string().optional(),
})

const itVerb = z.object({
  kind: z.literal('verb'),
  infinito: z.string(),
  /** 3rd person singular, where an irregular stem shows. */
  presente: z.string(),
  participio: z.string(),
  /** passato prossimo auxiliary. Not predictable; never guessed. */
  ausiliare: z.enum(['essere', 'avere']),
  gerundio: z.string().optional(),
  /** Reflexive verbs carry the pronoun: "alzarsi", not "alzare". */
  riflessivo: z.boolean().optional(),
})

/** French. Gender as the article it takes, like Italian; le/la even before a
 * vowel (l'), since the marker names the gender, not the elided article. */
const frNoun = z.object({
  kind: z.literal('noun'),
  gender: z.enum(['le', 'la']),
  plural: z.string().optional(),
})

const frVerb = z.object({
  kind: z.literal('verb'),
  infinitif: z.string(),
  /** 3rd person singular présent. */
  present: z.string(),
  participe: z.string(),
  /** passé composé auxiliary. Not predictable; never guessed. */
  auxiliaire: z.enum(['être', 'avoir']),
  /** Pronominal verbs carry the pronoun: "se lever". */
  pronominal: z.boolean().optional(),
})

const esVerb = z.object({
  kind: z.literal('verb'),
  infinitivo: z.string(),
  /** 3rd person singular, where the stem changes surface: puede, duerme. */
  presente: z.string(),
  preterito: z.string(),
  participio: z.string(),
  gerundio: z.string().optional(),
  /** Reflexive verbs carry the pronoun: "levantarse", not "levantar". */
  reflexivo: z.boolean().optional(),
})

/**
 * Russian.
 *
 * Two things make this harder than the others. Nouns decline through six
 * cases, so the forms are a table rather than a couple of fields — the five
 * oblique singulars plus the nominative plural are stored, which is what a
 * textbook drills first.
 *
 * And verbs come in aspect pairs: писать and написать are one meaning in two
 * aspects, and a learner has to produce both. They are kept as ONE entry with
 * an `aspectPartner` field rather than two concepts, because splitting them
 * would mean two review histories and two entries in the known-word count for
 * what is, to the learner, one item. The partner is shown on the card.
 */
const ruNoun = z.object({
  kind: z.literal('noun'),
  gender: z.enum(['м', 'ж', 'с']),
  genitive: z.string().optional(),
  dative: z.string().optional(),
  accusative: z.string().optional(),
  instrumental: z.string().optional(),
  prepositional: z.string().optional(),
  nominativePlural: z.string().optional(),
  /** Animate nouns take the genitive in the accusative; worth flagging. */
  animate: z.boolean().optional(),
})

const ruVerb = z.object({
  kind: z.literal('verb'),
  infinitive: z.string(),
  aspect: z.enum(['несовершенный', 'совершенный']),
  /** The other half of the pair — the form you also have to be able to produce. */
  aspectPartner: z.string().optional(),
  /** 1st and 3rd singular, which is where the conjugation class shows. */
  presentFirst: z.string().optional(),
  presentThird: z.string().optional(),
  past: z.string().optional(),
})

const enNoun = z.object({
  kind: z.literal('noun'),
  plural: z.string().optional(),
})

const enVerb = z.object({
  kind: z.literal('verb'),
  base: z.string(),
  thirdPerson: z.string(),
  past: z.string(),
  pastParticiple: z.string(),
})

const faSimple = z.object({ kind: z.literal('simple') })
const simple = z.object({ kind: z.literal('simple') })

// Exported so display code can narrow to one language's form. `kind` alone is
// not enough to narrow across the whole union: a "noun" could be Swedish or
// German, and those have different fields.
export type SvNoun = z.infer<typeof svNoun>
export type SvVerb = z.infer<typeof svVerb>
export type DeNoun = z.infer<typeof deNoun>
export type DeVerb = z.infer<typeof deVerb>
export type EnNoun = z.infer<typeof enNoun>
export type EnVerb = z.infer<typeof enVerb>
export type EsNoun = z.infer<typeof esNoun>
export type EsVerb = z.infer<typeof esVerb>
export type ItNoun = z.infer<typeof itNoun>
export type ItVerb = z.infer<typeof itVerb>
export type FrNoun = z.infer<typeof frNoun>
export type FrVerb = z.infer<typeof frVerb>
export type RuNoun = z.infer<typeof ruNoun>
export type RuVerb = z.infer<typeof ruVerb>

export const MorphologySchema = z.discriminatedUnion('lang', [
  z.object({ lang: z.literal('sv'), form: z.union([svNoun, svVerb, simple]) }),
  z.object({ lang: z.literal('de'), form: z.union([deNoun, deVerb, simple]) }),
  z.object({ lang: z.literal('en'), form: z.union([enNoun, enVerb, simple]) }),
  z.object({ lang: z.literal('es'), form: z.union([esNoun, esVerb, simple]) }),
  z.object({ lang: z.literal('ru'), form: z.union([ruNoun, ruVerb, simple]) }),
  z.object({ lang: z.literal('it'), form: z.union([itNoun, itVerb, simple]) }),
  z.object({ lang: z.literal('fr'), form: z.union([frNoun, frVerb, simple]) }),
  z.object({ lang: z.literal('fa'), form: faSimple }),
])
export type Morphology = z.infer<typeof MorphologySchema>

// ---------------------------------------------------------------------------
// Core records
// ---------------------------------------------------------------------------

/**
 * A concept is the language-independent anchor: one idea, N language entries.
 * Everything else hangs off this, which is what makes "turn German off" and
 * "add a fourth language later" cheap instead of a migration.
 */
export interface Concept {
  id: string
  /** The word as the user typed it. */
  lemma: string
  /** Which language they typed it in. */
  sourceLang: Lang
  pos: PartOfSpeech
  /** @deprecated single-category field; kept so pre-tags words keep working. */
  category: Category
  /**
   * Topics, free text and multi-valued. A word is routinely more than one
   * thing — `beställa` is restaurant and work — so a single category could not
   * survive contact with real use. `category` above is the old single field;
   * both are honoured when filtering.
   */
  tags?: string[]
  notes?: string
  createdAt: number
  updatedAt: number
  /** Soft delete — a hard delete can't be replicated to other devices. */
  deletedAt?: number
}

export interface Entry {
  /** `${conceptId}:${lang}` — deterministic, so sync can't duplicate it. */
  id: string
  conceptId: string
  lang: Lang
  /** The word in this language, including its article where that's idiomatic. */
  headword: string
  /** A short gloss. */
  meaning: string
  morphology?: Morphology['form']
  /** One example sentence. Parallel across languages — same situation, not a
   *  literal translation, so the sentences can be compared side by side. */
  example?: string
  exampleGloss?: string
  notes?: string
  updatedAt: number
}

export const CARD_STATES = ['New', 'Learning', 'Review', 'Relearning'] as const

/**
 * One FSRS card per (concept x language). This is the decision that lets a
 * language be switched off and back on without losing or corrupting its
 * schedule, and stops an easy English item from being dragged around by a
 * hard German one at the algorithm level.
 */
export interface Card {
  /** `${conceptId}:${lang}` */
  id: string
  conceptId: string
  lang: Lang
  // --- FSRS state, stored flat so Dexie can index `due` ---
  due: number
  stability: number
  difficulty: number
  elapsedDays: number
  scheduledDays: number
  learningSteps: number
  reps: number
  lapses: number
  state: number
  lastReview?: number
  /** Suspended cards never enter the queue but keep their state intact. */
  suspended?: boolean
  updatedAt: number
}

/** Append-only. This is the one table that can never conflict on sync. */
export interface ReviewLogRow {
  id: string
  cardId: string
  conceptId: string
  lang: Lang
  grade: number
  state: number
  due: number
  stability: number
  difficulty: number
  elapsedDays: number
  lastElapsedDays: number
  scheduledDays: number
  reviewedAt: number
}

/**
 * A text generated from words you already know.
 *
 * `knownCount` and `wordCount` are stored rather than recomputed on read: they
 * are a fact about the moment the text was written, and the vocabulary moves
 * underneath. A text that was 90% familiar in October should still say 90% in
 * December, not quietly improve.
 */
export interface Story {
  id: string
  title: string
  body: string
  lang: Lang
  genre: string
  topics: string[]
  wordCount: number
  knownCount: number
  unknownWords: string[]
  glossary?: { word: string; meaning: string }[]
  createdAt: number
  updatedAt: number
  deletedAt?: number
}

export const STORY_GENRES = [
  { id: 'fun', label: 'Everyday, light' },
  { id: 'fact', label: 'A true fact' },
  { id: 'social', label: 'A social situation' },
  { id: 'dialogue', label: 'A short dialogue' },
  { id: 'joke', label: 'A joke' },
] as const

/**
 * A word jotted down to deal with later.
 *
 * Deliberately NOT a Concept: nothing has been looked up, nothing has been
 * decided about it, and it has no entries, no cards and no place in the
 * known-word set the reading generator measures coverage against. It is a
 * line of text with a date, and it leaves this table only by becoming a real
 * word or by being thrown away.
 *
 * It shipped device-local, on the argument that a scratchpad for the twenty
 * minutes between writing a word down and having time to add it properly is
 * not worth a Postgres table. That turned out to be the wrong read of how it
 * is used: words get parked on the phone in class and worked through on the
 * laptop in the evening, which was named as the condition for reconsidering.
 * It follows the account now.
 *
 * Which is why it carries `updatedAt` and a soft `deletedAt` like every other
 * synced row: a word removed on the laptop has to be representable as a
 * change the phone can receive, and a row that is simply missing locally
 * always loses last-write-wins — so a hard delete would be undone by the next
 * full resync.
 */
export interface LaterWord {
  id: string
  lemma: string
  createdAt: number
  updatedAt: number
  deletedAt?: number
}

/** A word added while offline, waiting for expansion. */
export interface PendingExpansion {
  id: string
  conceptId: string
  attempts: number
  lastError?: string
  createdAt: number
}

export interface Settings {
  id: 'singleton'
  /**
   * What to call you in the app. Account data, so it syncs — unlike the theme,
   * which is a property of the device you happen to be holding.
   */
  displayName?: string
  /**
   * Which palette the app uses.
   *
   * Account data now, like the four preferences below it. It was device-local
   * until v3.3 on the reasoning that a theme belongs to the screen you are
   * holding — true of a *particular* screen, but it meant every new device
   * started wrong, and that cost more than it saved. A device that genuinely
   * wants its own can still set one: see DEVICE_OVERRIDABLE.
   *
   * Undefined means never chosen, and resolves to DEFAULT_THEME rather than
   * to the device's light/dark setting.
   */
  theme?: Theme
  nativeLang: Lang
  /** Ordered by priority — this is the stacking order on the review card. */
  targetLangs: Lang[]
  /** Subset of targetLangs that are currently being studied. Anything not in
   *  here keeps its cards but is excluded from scheduling and the queue. */
  activeLangs: Lang[]
  dailyNewLimit: number
  dailyReviewLimit: number
  /** FSRS target recall probability. 0.9 is the usual default. */
  requestRetention: number
  /**
   * Type the answer for this language before revealing, instead of only
   * recalling it in your head. Deliberately one language: interference between
   * Swedish and German shows up in production, and typing all three would turn
   * a two-minute session into a ten-minute one.
   *
   * Account data since v3.3, overridable per device.
   */
  typedLang?: Lang
  /**
   * Go to the next word by itself once every due language on the card has
   * been graded, instead of waiting for Next.
   *
   * Off by default, and that is the honest default rather than a timid one:
   * the pause after grading is where you read the interval you just earned
   * and notice the gender you got wrong. Auto-advance trades that for speed,
   * which is the right trade on a phone with thirty cards due and the wrong
   * one while you are still learning what the grades do.
   *
   * Account data since v3.3, overridable per device.
   */
  autoAdvance?: boolean
  /**
   * Speak the answer as soon as it is revealed, rather than waiting for the
   * speaker to be tapped.
   *
   * Off by default. It shipped on in v3.2, on the argument that an extra tap
   * is the friction that stops you ever hearing the word — a week of use said
   * otherwise: a card that talks at you unasked is worse than one you tap. The
   * speakers stay on every card either way, so what this decides is only
   * whether one plays unprompted. When it is on, only the first due language
   * speaks: three in a row is a queue you sit through before you can grade.
   *
   * Account data since v3.3, overridable per device — and this is the one
   * where the override earns its keep, because which voices are installed is
   * a property of the device.
   */
  speakOnReveal?: boolean
  /**
   * How fast the voices speak, as the Web Speech API's rate multiplier.
   *
   * Slower than natural by default. The point of hearing a word in a review
   * is to catch where it breaks and which vowel is long, not to practise
   * listening at conversational pace — that is what Reading is for.
   */
  speechRate?: number
  /**
   * Quick translate: the language you type in and up to three to see it in.
   * Independent of the languages you study, and account data so every device
   * opens the translator the same way. Codes from TRANSLATE_LANGS.
   */
  translateFrom?: string
  translateTo?: string[]
  updatedAt: number
}

/**
 * What a brand-new account starts with.
 *
 * English as the native language and Swedish as the one target: this is what
 * someone who has just found the app gets, and they are far more likely to
 * read English than Persian. Both are changed in Settings in two taps, and
 * nothing here touches an account that already exists — these values are only
 * read when a settings row is first created.
 *
 * One target rather than three, deliberately. Three languages on day one is
 * three cards due for every word before you know whether you like the app.
 */
export const DEFAULT_SETTINGS: Settings = {
  id: 'singleton',
  nativeLang: 'en',
  targetLangs: ['sv'],
  activeLangs: ['sv'],
  dailyNewLimit: 15,
  dailyReviewLimit: 150,
  requestRetention: 0.9,
  theme: DEFAULT_THEME,
  speakOnReveal: false,
  speechRate: 0.95,
  updatedAt: 0,
}

// ---------------------------------------------------------------------------
// Account settings vs this device
// ---------------------------------------------------------------------------

/**
 * The preferences a single device may keep for itself.
 *
 * Everything in `Settings` follows the account: set it once and a second
 * device is already set up, which is the whole point of the change. But some
 * of it genuinely does depend on the machine — a phone with a good Swedish
 * voice and a laptop without one are the same account — so each of these five
 * can be pinned to the device you are holding.
 *
 * An override is the exception, not the default. A device holds none until you
 * ask for one, and clearing it hands the value back to the account.
 */
export const DEVICE_OVERRIDABLE = [
  'theme',
  'typedLang',
  'autoAdvance',
  'speakOnReveal',
  'speechRate',
] as const

export type DeviceOverridableKey = (typeof DEVICE_OVERRIDABLE)[number]

/**
 * What this device has pinned. `null` is a real answer meaning "none here" —
 * it is how you say "no typed recall on this phone" against an account that
 * has one. An absent key means the account decides.
 */
export type DeviceOverride = {
  [K in DeviceOverridableKey]?: Settings[K] | null
}

/**
 * The values actually in force: the account row, with this device's pins
 * laid over it.
 *
 * This is the single definition of "the setting in force", and it is what
 * `readSettings` returns — so every screen reads the resolved value without
 * knowing any of this exists. The one caller that must NOT use it is the sync
 * push, which sends the account row as it stands; pushing the resolved view
 * would quietly promote one device's preference to everybody's.
 */
export function effectiveSettings(
  account: Settings,
  override: DeviceOverride | null | undefined,
): Settings {
  if (!override) return account
  const out: Settings = { ...account }
  for (const key of DEVICE_OVERRIDABLE) {
    if (!(key in override)) continue
    const value = override[key]
    // `null` means the device has deliberately chosen "none", which in
    // Settings is spelled `undefined`.
    ;(out as unknown as Record<string, unknown>)[key] =
      value === null ? undefined : value
  }
  return out
}

/**
 * The target languages currently being studied, in priority order.
 *
 * This is the list every *display* path uses. A paused language keeps its
 * cards and still receives entries for words added while it is paused — so
 * that resuming never leaves a hole in the vocabulary — but it is not a
 * language you are studying today, and putting it on a word card, a preview
 * or a review screen is noise about something you deliberately set aside.
 *
 * The writing paths (`applyExpansion` and card creation) stay on
 * `targetLangs` on purpose: pause means "stop asking me", not "stop
 * collecting".
 */
export function activeTargets(settings: {
  targetLangs: Lang[]
  activeLangs: Lang[]
}): Lang[] {
  return settings.targetLangs.filter((l) => settings.activeLangs.includes(l))
}

// ---------------------------------------------------------------------------
// AI expansion payload
//
// The model is asked for exactly this shape. Anything that doesn't parse is
// rejected rather than written, so a bad response can't corrupt the database.
// ---------------------------------------------------------------------------

export const ExpansionEntrySchema = z.object({
  lang: z.enum(LANGS as [Lang, ...Lang[]]),
  headword: z.string().min(1),
  meaning: z.string().min(1),
  morphology: z.unknown().optional(),
  example: z.string().optional(),
  exampleGloss: z.string().optional(),
  notes: z.string().optional(),
})

/**
 * A word worth knowing alongside this one — usually not a synonym but a
 * register variant. `hallo` and `tjena` mean the same thing; which one you
 * say to your manager is the part that is hard to get from a dictionary.
 */
export const RelatedWordSchema = z.object({
  lang: z.enum(LANGS as [Lang, ...Lang[]]),
  word: z.string().min(1).max(60),
  meaning: z.string().max(80).optional(),
  /** "casual", "formal", "written only", "northern Sweden" — one or two words. */
  register: z.string().max(40).optional(),
  note: z.string().max(140).optional(),
})
export type RelatedWord = z.infer<typeof RelatedWordSchema>

export const ExpansionSchema = z.object({
  pos: z.enum(PARTS_OF_SPEECH),
  /** Suggested topics. Advisory — the user can change them before saving. */
  tags: z.array(z.string().min(1).max(24)).max(4).optional(),
  /** The model may correct a typo or strip an article; we show this to the user. */
  normalisedLemma: z.string().optional(),
  /**
   * Which language the model read the input as. The Add box no longer asks,
   * so this is how the concept learns its own `sourceLang` — and it is shown
   * on the preview, because a word read as the wrong language is the one
   * mistake that is cheap to catch here and expensive to catch in a month.
   *
   * Optional in the schema, required in both tool schemas: a model that
   * omits it should cost us the label, not the whole expansion.
   */
  detectedLang: z.enum(LANGS as [Lang, ...Lang[]]).optional(),
  entries: z.array(ExpansionEntrySchema).min(1),
  related: z.array(RelatedWordSchema).max(6).optional(),
})
export type Expansion = z.infer<typeof ExpansionSchema>

/** One previewed entry, with its morphology already validated for display. */
export type WordPreviewEntryView = z.infer<typeof ExpansionEntrySchema> & {
  form: Morphology['form'] | undefined
}

/**
 * Validates the morphology blob against the schema for its own language.
 * Returns undefined rather than throwing: a wrong gender field should cost us
 * the gender, not the whole word.
 */
export function parseMorphology(
  lang: Lang,
  raw: unknown,
): Morphology['form'] | undefined {
  if (raw == null || typeof raw !== 'object') return undefined
  const result = MorphologySchema.safeParse({ lang, form: raw })
  return result.success ? result.data.form : undefined
}
