import type { Lang } from '../db/types'

/**
 * The five-line version of "how do I use this", in every language the app
 * offers as a native language.
 *
 * Separate from `HowTo`, which is the long form on the landing page. This one
 * is for the first five minutes: someone who has just signed in, does not yet
 * know what the two Add buttons do, and is not going to read six paragraphs
 * in their second language to find out. That is the whole reason it is
 * translated at all — the app's interface is in English, but the explanation
 * of the app does not have to be another thing to decode.
 *
 * Deliberately not wired to a translation library: seven languages times five
 * short steps is a table, and a table does not need a framework. If the
 * interface itself is ever translated this is the first thing to move.
 *
 * Keep each body to one sentence. The moment a step needs two, it belongs in
 * the long form instead.
 */

export type QuickStart = {
  intro: string
  steps: { title: string; body: string }[]
}

export const QUICK_START: Record<Lang, QuickStart> = {
  en: {
    intro: 'Five steps to the whole app.',
    steps: [
      {
        title: 'Choose your languages',
        body: 'In Settings → Languages, pick the language you think in and up to three you are learning.',
      },
      {
        title: 'Add a word',
        body: 'Type any word or short phrase and press Check and add — you never say which language it is.',
      },
      {
        title: 'Recall test',
        body: 'Your words for today: see the prompt, answer in your head, reveal it, then say how it went.',
      },
      {
        title: 'Review',
        body: 'The same words with nothing asked of you, to flip through when you only want to look.',
      },
      {
        title: 'My words and stories',
        body: 'Everything you have added, searchable — and a short text written out of it whenever you like.',
      },
    ],
  },

  fa: {
    intro: 'کل برنامه در پنج گام.',
    steps: [
      {
        title: 'زبان‌هایت را انتخاب کن',
        body: 'در Settings → Languages زبانی که با آن فکر می‌کنی و تا سه زبانی که یاد می‌گیری را انتخاب کن.',
      },
      {
        title: 'یک کلمه اضافه کن',
        body: 'هر کلمه یا عبارت کوتاهی را بنویس و Check and add را بزن — لازم نیست بگویی به چه زبانی است.',
      },
      {
        title: 'آزمون یادآوری (Recall test)',
        body: 'کلمه‌های امروزت: سؤال را ببین، در ذهنت جواب بده، جواب را نمایان کن و بگو چطور بود.',
      },
      {
        title: 'مرور (Review)',
        body: 'همان کلمه‌ها بدون هیچ سؤالی، برای وقتی که فقط می‌خواهی نگاهی بیندازی.',
      },
      {
        title: 'کلمه‌های من و داستان',
        body: 'هر چه اضافه کرده‌ای، قابل جست‌وجو — و هر وقت خواستی، متنی کوتاه ساخته‌شده از همان‌ها.',
      },
    ],
  },

  sv: {
    intro: 'Hela appen i fem steg.',
    steps: [
      {
        title: 'Välj dina språk',
        body: 'Under Settings → Languages väljer du språket du tänker på och upp till tre du lär dig.',
      },
      {
        title: 'Lägg till ett ord',
        body: 'Skriv ett ord eller en kort fras och tryck Check and add — du behöver aldrig ange vilket språk det är.',
      },
      {
        title: 'Recall test',
        body: 'Dagens ord: se frågan, svara i huvudet, visa svaret och säg sedan hur det gick.',
      },
      {
        title: 'Review',
        body: 'Samma ord utan att något frågas, att bläddra igenom när du bara vill titta.',
      },
      {
        title: 'Mina ord och texter',
        body: 'Allt du lagt till, sökbart — och en kort text skriven av dina egna ord när du vill.',
      },
    ],
  },

  de: {
    intro: 'Die ganze App in fünf Schritten.',
    steps: [
      {
        title: 'Sprachen auswählen',
        body: 'Unter Settings → Languages wählst du die Sprache, in der du denkst, und bis zu drei zum Lernen.',
      },
      {
        title: 'Ein Wort hinzufügen',
        body: 'Tippe ein Wort oder einen kurzen Ausdruck und drücke Check and add — die Sprache musst du nie angeben.',
      },
      {
        title: 'Recall test',
        body: 'Deine Wörter für heute: Frage ansehen, im Kopf antworten, aufdecken und sagen, wie es lief.',
      },
      {
        title: 'Review',
        body: 'Dieselben Wörter, ohne dass etwas gefragt wird — zum Durchblättern, wenn du nur schauen willst.',
      },
      {
        title: 'Meine Wörter und Texte',
        body: 'Alles Hinzugefügte, durchsuchbar — und jederzeit ein kurzer Text aus deinen eigenen Wörtern.',
      },
    ],
  },

  es: {
    intro: 'Toda la aplicación en cinco pasos.',
    steps: [
      {
        title: 'Elige tus idiomas',
        body: 'En Settings → Languages, elige el idioma en el que piensas y hasta tres que estés aprendiendo.',
      },
      {
        title: 'Añade una palabra',
        body: 'Escribe cualquier palabra o frase corta y pulsa Check and add — nunca tienes que decir de qué idioma es.',
      },
      {
        title: 'Recall test',
        body: 'Tus palabras de hoy: mira la pregunta, responde mentalmente, descúbrela y di qué tal te fue.',
      },
      {
        title: 'Review',
        body: 'Las mismas palabras sin preguntarte nada, para hojear cuando solo quieres mirar.',
      },
      {
        title: 'Mis palabras e historias',
        body: 'Todo lo que has añadido, con búsqueda — y un texto corto escrito con tus propias palabras cuando quieras.',
      },
    ],
  },

  ru: {
    intro: 'Всё приложение за пять шагов.',
    steps: [
      {
        title: 'Выберите языки',
        body: 'В Settings → Languages выберите язык, на котором вы думаете, и до трёх изучаемых.',
      },
      {
        title: 'Добавьте слово',
        body: 'Введите слово или короткую фразу и нажмите Check and add — указывать язык не нужно.',
      },
      {
        title: 'Recall test',
        body: 'Слова на сегодня: посмотрите вопрос, ответьте про себя, откройте ответ и скажите, как прошло.',
      },
      {
        title: 'Review',
        body: 'Те же слова, но без вопросов — просто пролистать, когда хочется только посмотреть.',
      },
      {
        title: 'Мои слова и тексты',
        body: 'Всё добавленное, с поиском — и короткий текст из ваших собственных слов в любой момент.',
      },
    ],
  },

  it: {
    intro: "Tutta l'app in cinque passi.",
    steps: [
      {
        title: 'Scegli le tue lingue',
        body: 'In Settings → Languages scegli la lingua in cui pensi e fino a tre che stai imparando.',
      },
      {
        title: 'Aggiungi una parola',
        body: 'Scrivi una parola o una frase breve e premi Check and add — non devi mai dire di che lingua si tratta.',
      },
      {
        title: 'Recall test',
        body: 'Le parole di oggi: guarda la domanda, rispondi a mente, scopri la risposta e di’ com’è andata.',
      },
      {
        title: 'Review',
        body: 'Le stesse parole senza che ti venga chiesto nulla, da sfogliare quando vuoi solo guardare.',
      },
      {
        title: 'Le mie parole e i testi',
        body: 'Tutto ciò che hai aggiunto, ricercabile — e un breve testo scritto con le tue parole quando vuoi.',
      },
    ],
  },
  fr: {
    intro: "Toute l'app en cinq étapes.",
    steps: [
      {
        title: 'Choisissez vos langues',
        body: 'Dans Settings → Languages, choisissez la langue dans laquelle vous pensez et jusqu’à trois langues que vous apprenez.',
      },
      {
        title: 'Ajoutez un mot',
        body: 'Tapez un mot ou une courte expression et appuyez sur Check and add — inutile de dire de quelle langue il s’agit.',
      },
      {
        title: 'Recall test',
        body: 'Les mots du jour : regardez la question, répondez de tête, retournez la carte et dites comment ça s’est passé.',
      },
      {
        title: 'Review',
        body: 'Les mêmes mots sans être interrogé, à feuilleter quand vous voulez simplement regarder.',
      },
      {
        title: 'Mes mots et les textes',
        body: 'Tout ce que vous avez ajouté, avec une recherche — et un court texte écrit avec vos mots quand vous le voulez.',
      },
    ],
  },
}
