import type {
  AdjectiveForm,
  DeNoun,
  DeVerb,
  EnNoun,
  EnVerb,
  Entry,
  EsNoun,
  EsVerb,
  ItNoun,
  FrNoun,
  FrVerb,
  ItVerb,
  Lang,
  Morphology,
  RuNoun,
  RuVerb,
  SvNoun,
  SvVerb,
} from '../db/types'

export interface MorphLine {
  label: string
  value: string
  /**
   * Which display line it sits on. Verbs use two: the base forms
   * (infinitive, imperative), then the tenses (present, past, perfect).
   * Extras such as a separable prefix go on line 3. Default 1.
   */
  row?: 1 | 2 | 3
  /** Shown after the value but never part of it: "ät" + "!". */
  suffix?: string
}

type Form = Morphology['form']

/**
 * Turns a morphology blob into labelled lines, using each language's own
 * grammatical terms. Showing a Swedish learner "preteritum" and a German
 * learner "Präteritum" is not pedantry — those are the words their textbook
 * and their teacher use.
 *
 * The casts below are safe because the stored form was validated against its
 * own language's schema on the way in (see `parseMorphology`). TypeScript
 * can't see that, because `kind` alone doesn't distinguish a Swedish noun
 * from a German one.
 */
export function morphLines(lang: Lang, form: Form | undefined): MorphLine[] {
  if (!form || form.kind === 'simple') return []

  if (form.kind === 'adjective') {
    const f = form as AdjectiveForm
    const labels: Record<Lang, Partial<Record<keyof AdjectiveForm, string>>> = {
      sv: { common: 'en', neuter: 'ett', plural: 'plural', definite: 'bestämd', comparative: 'komparativ', superlative: 'superlativ' },
      de: { masculine: 'maskulin', feminine: 'feminin', neuter: 'neutrum', plural: 'Plural', comparative: 'Komparativ', superlative: 'Superlativ' },
      en: { comparative: 'comparative', superlative: 'superlative' },
      es: { masculine: 'masculino', feminine: 'femenino', plural: 'plural', comparative: 'comparativo', superlative: 'superlativo' },
      it: { masculine: 'maschile', feminine: 'femminile', plural: 'plurale', comparative: 'comparativo', superlative: 'superlativo' },
      fr: { masculine: 'masculin', feminine: 'féminin', plural: 'pluriel', comparative: 'comparatif', superlative: 'superlatif' },
      ru: { masculine: 'мужской', feminine: 'женский', neuter: 'средний', plural: 'мн. число', comparative: 'сравнительная' },
      fa: {},
    }
    const fields: (keyof AdjectiveForm)[] = [
      'common', 'masculine', 'feminine', 'neuter', 'plural', 'definite',
      'comparative', 'superlative',
    ]
    return compact(fields.map((field) => {
      const value = f[field]
      const label = labels[lang][field]
      return typeof value === 'string' && label ? { label, value } : undefined
    }))
  }

  if (lang === 'sv') {
    if (form.kind === 'noun') {
      const f = form as SvNoun
      return compact([
        f.definiteSingular && { label: 'bestämd', value: f.definiteSingular },
        f.indefinitePlural && { label: 'plural', value: f.indefinitePlural },
        f.definitePlural && { label: 'plural best.', value: f.definitePlural },
      ])
    }
    const f = form as SvVerb
    return compact([
      { label: 'infinitiv', value: f.infinitiv, row: 1 },
      imp('imperativ', f.imperativ),
      { label: 'presens', value: f.presens, row: 2 },
      { label: 'preteritum', value: f.preteritum, row: 2 },
      { label: 'perfekt', value: `har ${f.supinum}`, row: 2 },
    ])
  }

  if (lang === 'de') {
    if (form.kind === 'noun') {
      const f = form as DeNoun
      return compact([
        f.plural && { label: 'Plural', value: f.plural },
        f.genitiveSingular && { label: 'Genitiv', value: f.genitiveSingular },
      ])
    }
    const f = form as DeVerb
    return compact([
      { label: 'Infinitiv', value: f.infinitiv, row: 1 },
      imp('Imperativ', f.imperativ),
      { label: 'Präsens', value: f.praesens, row: 2 },
      { label: 'Präteritum', value: f.praeteritum, row: 2 },
      // The auxiliary is shown joined to the participle because that is the
      // unit you actually have to produce: "ist gegangen", not "sein".
      { label: 'Perfekt', value: `${f.auxiliary === 'sein' ? 'ist' : 'hat'} ${f.partizip2}`, row: 2 },
      f.separable ? { label: 'trennbar', value: f.prefix ?? 'ja', row: 3 } : undefined,
    ])
  }

  if (lang === 'es') {
    if (form.kind === 'noun') {
      const f = form as EsNoun
      return compact([f.plural && { label: 'plural', value: f.plural }])
    }
    const f = form as EsVerb
    return compact([
      { label: 'infinitivo', value: f.infinitivo, row: 1 },
      imp('imperativo', f.imperativo),
      { label: 'presente', value: f.presente, row: 2 },
      { label: 'pretérito', value: f.preterito, row: 2 },
      { label: 'perfecto', value: `ha ${f.participio}`, row: 2 },
      f.gerundio ? { label: 'gerundio', value: f.gerundio, row: 3 } : undefined,
      f.reflexivo ? { label: 'reflexivo', value: 'sí', row: 3 } : undefined,
    ])
  }

  if (lang === 'it') {
    if (form.kind === 'noun') {
      const f = form as ItNoun
      return compact([f.plural && { label: 'plurale', value: f.plural }])
    }
    const f = form as ItVerb
    return compact([
      { label: 'infinito', value: f.infinito, row: 1 },
      imp('imperativo', f.imperativo),
      { label: 'presente', value: f.presente, row: 2 },
      // Auxiliary and participle together, because that pair is the unit you
      // actually have to produce — "è andato", not "essere" on its own. Same
      // reasoning as German's Perfekt line above.
      { label: 'passato prossimo', value: `${f.ausiliare === 'essere' ? 'è' : 'ha'} ${f.participio}`, row: 2 },
      f.gerundio ? { label: 'gerundio', value: f.gerundio, row: 3 } : undefined,
      f.riflessivo ? { label: 'riflessivo', value: 'sì', row: 3 } : undefined,
    ])
  }

  if (lang === 'fr') {
    if (form.kind === 'noun') {
      const f = form as FrNoun
      return compact([f.plural && { label: 'pluriel', value: f.plural }])
    }
    const f = form as FrVerb
    return compact([
      { label: 'infinitif', value: f.infinitif, row: 1 },
      imp('impératif', f.imperatif),
      { label: 'présent', value: f.present, row: 2 },
      // Auxiliary and participle together — "est allé" is the unit you produce.
      { label: 'passé composé', value: `${f.auxiliaire === 'être' ? 'est' : 'a'} ${f.participe}`, row: 2 },
      f.pronominal ? { label: 'pronominal', value: 'oui', row: 3 } : undefined,
    ])
  }

  if (lang === 'ru') {
    if (form.kind === 'noun') {
      const f = form as RuNoun
      return compact([
        f.genitive && { label: 'родительный', value: f.genitive },
        f.dative && { label: 'дательный', value: f.dative },
        f.accusative && { label: 'винительный', value: f.accusative },
        f.instrumental && { label: 'творительный', value: f.instrumental },
        f.prepositional && { label: 'предложный', value: f.prepositional },
        f.nominativePlural && { label: 'мн. число', value: f.nominativePlural },
      ])
    }
    const f = form as RuVerb
    return compact([
      { label: 'инфинитив', value: f.infinitive, row: 1 },
      imp('повелительное', f.imperative),
      { label: 'вид', value: f.aspect, row: 3 },
      // The other half of the pair, which you also have to be able to produce.
      // Kept on the same entry rather than split into a second word: to a
      // learner this is one item with two forms, and splitting it would mean
      // two review histories for one memory.
      f.aspectPartner ? { label: 'видовая пара', value: f.aspectPartner, row: 3 } : undefined,
      f.presentFirst ? { label: 'я', value: f.presentFirst, row: 2 } : undefined,
      f.presentThird ? { label: 'он/она', value: f.presentThird, row: 2 } : undefined,
      f.past ? { label: 'прошедшее', value: f.past, row: 2 } : undefined,
    ])
  }

  if (lang === 'en') {
    if (form.kind === 'noun') {
      const f = form as EnNoun
      return compact([f.plural && { label: 'plural', value: f.plural }])
    }
    const f = form as EnVerb
    return compact([
      { label: 'base', value: f.base, row: 1 },
      // The English imperative is the base form, so it needs no field.
      { label: 'imperative', value: f.base, row: 1, suffix: '!' },
      { label: 'present', value: f.thirdPerson, row: 2 },
      { label: 'past', value: f.past, row: 2 },
      { label: 'perfect', value: `has ${f.pastParticiple}`, row: 2 },
    ])
  }

  return []
}

/**
 * The gender marker, shown as its own badge rather than buried in the forms.
 * For Swedish and German it is the single highest-value field on the card, and
 * it only sticks if it is learned together with the word rather than bolted on
 * afterwards.
 */
export function genderBadge(lang: Lang, form: Form | undefined): string | null {
  if (!form || form.kind !== 'noun') return null
  if (lang === 'sv') return (form as SvNoun).gender
  if (lang === 'de') return (form as DeNoun).gender
  if (lang === 'es') return (form as EsNoun).gender
  if (lang === 'it') return (form as ItNoun).gender
  if (lang === 'fr') return (form as FrNoun).gender
  if (lang === 'ru') return (form as RuNoun).gender
  return null
}

/** True when an entry is missing the forms a learner of that language needs. */
export function isIncomplete(entry: Entry): boolean {
  if (!entry.morphology) return true
  if (entry.morphology.kind !== 'noun') return false
  // The languages where a missing gender is expensive: it decides the article
  // or the whole declension, and the scheduler will drill a wrong one for
  // months.
  if (!['sv', 'de', 'es', 'ru', 'it', 'fr'].includes(entry.lang)) return false
  return !genderBadge(entry.lang, entry.morphology)
}

/** The imperative, when the model gave one: line 1, with its "!". */
function imp(label: string, value: string | undefined): MorphLine | undefined {
  return value ? { label, value: value.replace(/!+$/, ''), row: 1, suffix: '!' } : undefined
}

function compact(items: (MorphLine | false | undefined | '')[]): MorphLine[] {
  return items.filter((x): x is MorphLine => !!x)
}
