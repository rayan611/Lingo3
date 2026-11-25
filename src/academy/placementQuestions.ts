/** Multiple-choice level check. Three questions per CEFR step, written in the language being tested. */
export type PlacementQuestion = {
  level: 'A1' | 'A2' | 'B1' | 'B2'
  q: string
  options: string[]
  answer: number
}

export const PLACEMENT_LANGS = ['sv', 'en'] as const
export type PlacementLang = (typeof PLACEMENT_LANGS)[number]

export const PLACEMENT: Record<PlacementLang, PlacementQuestion[]> = {
  sv: [
    { level: 'A1', q: 'Jag ___ Anna.', options: ['heter', 'heta', 'hette', 'hetar'], answer: 0 },
    { level: 'A1', q: 'Det här är ___ bok.', options: ['min', 'mitt', 'mina', 'mig'], answer: 0 },
    { level: 'A1', q: 'Ett äpple och ___ banan.', options: ['en', 'ett', 'ena', 'etta'], answer: 0 },
    { level: 'A2', q: 'Igår ___ jag på bio.', options: ['går', 'gick', 'gått', 'ska gå'], answer: 1 },
    { level: 'A2', q: 'Jag har två ___.', options: ['bil', 'bilen', 'bilar', 'bilarna'], answer: 2 },
    {
      level: 'A2',
      q: 'Hon bor i Sverige, men hon ___ inte svenska bra.',
      options: ['pratar', 'prata', 'pratade', 'pratat'],
      answer: 0
    },
    {
      level: 'B1',
      q: 'Om jag hade tid, ___ jag hjälpa dig.',
      options: ['ska', 'skulle', 'skall', 'skulla'],
      answer: 1
    },
    {
      level: 'B1',
      q: 'Boken ___ jag läste var spännande.',
      options: ['vem', 'vad', 'som', 'var'],
      answer: 2
    },
    {
      level: 'B1',
      q: 'Han frågade ___ jag kom från.',
      options: ['vem', 'varifrån', 'vilken', 'när'],
      answer: 1
    },
    {
      level: 'B2',
      q: 'Trots att det regnade ___ vi en promenad.',
      options: ['tar', 'tagit', 'tog', 'tagen'],
      answer: 2
    },
    {
      level: 'B2',
      q: 'Projektet, ___ kostnader steg kraftigt, lades ned.',
      options: ['som', 'vars', 'vilkas', 'dess'],
      answer: 1
    },
    {
      level: 'B2',
      q: 'Det är viktigt att man ___ sig i tid.',
      options: ['anmäla', 'anmält', 'anmälde', 'anmäler'],
      answer: 3
    }
  ],
  en: [
    { level: 'A1', q: 'She ___ a teacher.', options: ['are', 'is', 'am', 'be'], answer: 1 },
    {
      level: 'A1',
      q: 'I ___ coffee every morning.',
      options: ['drink', 'drinks', 'drinking', 'drank'],
      answer: 0
    },
    { level: 'A1', q: 'There ___ two books on the table.', options: ['is', 'are', 'be', 'am'], answer: 1 },
    {
      level: 'A2',
      q: 'Yesterday we ___ to the museum.',
      options: ['go', 'gone', 'went', 'going'],
      answer: 2
    },
    {
      level: 'A2',
      q: "I'm ___ than my brother.",
      options: ['tallest', 'taller', 'more tall', 'tall'],
      answer: 1
    },
    {
      level: 'A2',
      q: 'She has lived here ___ 2019.',
      options: ['for', 'from', 'since', 'during'],
      answer: 2
    },
    {
      level: 'B1',
      q: 'If it rains tomorrow, we ___ at home.',
      options: ['stay', 'would stay', 'stayed', 'will stay'],
      answer: 3
    },
    {
      level: 'B1',
      q: 'The film ___ I saw last night was great.',
      options: ['who', 'what', 'that', 'where'],
      answer: 2
    },
    { level: 'B1', q: 'He asked me ___ I was doing.', options: ['that', 'what', 'which', 'who'], answer: 1 },
    { level: 'B2', q: 'I wish I ___ more time.', options: ['have', 'had', 'would have', 'has'], answer: 1 },
    {
      level: 'B2',
      q: 'By the time we arrived, the film ___ already started.',
      options: ['has', 'was', 'had', 'have'],
      answer: 2
    },
    { level: 'B2', q: 'She suggested ___ a taxi.', options: ['to take', 'take', 'took', 'taking'], answer: 3 }
  ]
}

const ORDER = ['A1', 'A2', 'B1', 'B2'] as const
export type PlacementLevel = 'A1' | 'A2' | 'B1' | 'B2'

/**
 * The estimate is the highest step at which at least two of three were right and every lower step also passed.
 * Zero correct at A1 gives A1 ("beginner"). It is an estimate: a teacher confirms it in the trial lesson.
 */
export function scorePlacement(
  lang: PlacementLang,
  answers: (number | null)[]
): { level: PlacementLevel; correct: number; total: number } {
  const questions = PLACEMENT[lang]
  let correct = 0
  const perLevel: Record<string, number> = { A1: 0, A2: 0, B1: 0, B2: 0 }
  questions.forEach((question, i) => {
    if (answers[i] === question.answer) {
      correct++
      perLevel[question.level]++
    }
  })
  let level: PlacementLevel = 'A1'
  for (const step of ORDER) {
    if (perLevel[step] >= 2) level = step
    else break
  }
  return { level, correct, total: questions.length }
}
