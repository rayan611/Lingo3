import type { Pack, SeedRow } from '../catalogue'

/**
 * A1 — the first hundred words you can actually say something with.
 *
 * Greetings, pronouns, question words, the twenty-five verbs that carry most
 * of a beginner's speech, the prepositions that glue them together, the nouns
 * of a house and a street, and the adjectives you reach for first.
 *
 * No numbers, colours, days, months, food or family: those are closed sets
 * and they live in the everyday pack, where they can be drilled as the sets
 * they are. Nothing appears in two packs — see ../catalogue.ts.
 *
 * Verbs are given as the plain infinitive (`äta`, `essen`, `manger`), with
 * the English column marked "to eat" so the card is unambiguous about what
 * kind of word it is. The conjugation tables are not shipped: ask the app to
 * expand a word and the model fills them in, which is better than a hundred
 * hand-written tables each of which could be wrong.
 *
 * Columns after id/pos/tags: fa en sv de es ru it fr.
 */
const rows: readonly SeedRow[] = [
  // --- greetings and politeness --------------------------------------------
  ['greet.hello', 'phrase', 'greetings', 'سلام', 'hello', 'hej', 'hallo', 'hola', 'привет', 'ciao', 'salut'],
  ['greet.goodbye', 'phrase', 'greetings', 'خداحافظ', 'goodbye', 'hej då', 'tschüss', 'adiós', 'до свидания', 'arrivederci', 'au revoir'],
  ['greet.yes', 'other', 'greetings', 'بله', 'yes', 'ja', 'ja', 'sí', 'да', 'sì', 'oui'],
  ['greet.no', 'other', 'greetings', 'نه', 'no', 'nej', 'nein', 'no', 'нет', 'no', 'non'],
  ['greet.please', 'phrase', 'greetings', 'لطفاً', 'please', 'snälla', 'bitte', 'por favor', 'пожалуйста', 'per favore', "s'il vous plaît"],
  ['greet.thanks', 'phrase', 'greetings', 'متشکرم', 'thank you', 'tack', 'danke', 'gracias', 'спасибо', 'grazie', 'merci'],
  ['greet.sorry', 'phrase', 'greetings', 'متأسفم', 'sorry', 'förlåt', 'Entschuldigung', 'lo siento', 'извините', 'scusa', 'désolé'],
  ['greet.excuseme', 'phrase', 'greetings', 'ببخشید', 'excuse me', 'ursäkta', 'entschuldigen Sie', 'perdone', 'простите', 'permesso', 'excusez-moi'],
  ['greet.goodmorning', 'phrase', 'greetings', 'صبح بخیر', 'good morning', 'god morgon', 'guten Morgen', 'buenos días', 'доброе утро', 'buongiorno', 'bonjour'],
  ['greet.welcome', 'phrase', 'greetings', 'خوش آمدید', 'welcome', 'välkommen', 'willkommen', 'bienvenido', 'добро пожаловать', 'benvenuto', 'bienvenue'],

  // --- pronouns ------------------------------------------------------------
  // Persian does not mark gender on its third person, so `he` and `she` would
  // otherwise be the same card twice. The parenthetical says which is meant;
  // a learner of German, where er and sie are genuinely different words,
  // needs both rows.
  ['pron.i', 'other', 'pronouns', 'من', 'I', 'jag', 'ich', 'yo', 'я', 'io', 'je'],
  ['pron.you', 'other', 'pronouns', 'تو', 'you', 'du', 'du', 'tú', 'ты', 'tu', 'tu'],
  ['pron.he', 'other', 'pronouns', 'او (مرد)', 'he', 'han', 'er', 'él', 'он', 'lui', 'il'],
  ['pron.she', 'other', 'pronouns', 'او (زن)', 'she', 'hon', 'sie', 'ella', 'она', 'lei', 'elle'],
  ['pron.we', 'other', 'pronouns', 'ما', 'we', 'vi', 'wir', 'nosotros', 'мы', 'noi', 'nous'],
  ['pron.they', 'other', 'pronouns', 'آنها', 'they', 'de', 'sie (Plural)', 'ellos', 'они', 'loro', 'ils'],
  ['pron.this', 'other', 'pronouns', 'این', 'this', 'den här', 'dieser', 'este', 'этот', 'questo', 'ce'],
  ['pron.that', 'other', 'pronouns', 'آن', 'that', 'den där', 'jener', 'ese', 'тот', 'quello', 'cela'],

  // --- question words ------------------------------------------------------
  ['q.what', 'other', 'questions', 'چه', 'what', 'vad', 'was', 'qué', 'что', 'che cosa', 'quoi'],
  ['q.who', 'other', 'questions', 'چه کسی', 'who', 'vem', 'wer', 'quién', 'кто', 'chi', 'qui'],
  ['q.where', 'other', 'questions', 'کجا', 'where', 'var', 'wo', 'dónde', 'где', 'dove', 'où'],
  ['q.when', 'other', 'questions', 'کی', 'when', 'när', 'wann', 'cuándo', 'когда', 'quando', 'quand'],
  ['q.why', 'other', 'questions', 'چرا', 'why', 'varför', 'warum', 'por qué', 'почему', 'perché', 'pourquoi'],
  ['q.how', 'other', 'questions', 'چگونه', 'how', 'hur', 'wie', 'cómo', 'как', 'come', 'comment'],
  ['q.which', 'other', 'questions', 'کدام', 'which', 'vilken', 'welcher', 'cuál', 'какой', 'quale', 'quel'],
  ['q.howmuch', 'other', 'questions', 'چقدر', 'how much', 'hur mycket', 'wie viel', 'cuánto', 'сколько', 'quanto', 'combien'],

  // --- the verbs that carry a beginner's speech ----------------------------
  ['v.be', 'verb', 'verbs', 'بودن', 'to be', 'vara', 'sein', 'ser', 'быть', 'essere', 'être'],
  ['v.have', 'verb', 'verbs', 'داشتن', 'to have', 'ha', 'haben', 'tener', 'иметь', 'avere', 'avoir'],
  ['v.do', 'verb', 'verbs', 'کردن', 'to do', 'göra', 'machen', 'hacer', 'делать', 'fare', 'faire'],
  ['v.go', 'verb', 'verbs', 'رفتن', 'to go', 'gå', 'gehen', 'ir', 'идти', 'andare', 'aller'],
  ['v.come', 'verb', 'verbs', 'آمدن', 'to come', 'komma', 'kommen', 'venir', 'приходить', 'venire', 'venir'],
  ['v.eat', 'verb', 'verbs', 'خوردن', 'to eat', 'äta', 'essen', 'comer', 'есть', 'mangiare', 'manger'],
  ['v.drink', 'verb', 'verbs', 'نوشیدن', 'to drink', 'dricka', 'trinken', 'beber', 'пить', 'bere', 'boire'],
  ['v.sleep', 'verb', 'verbs', 'خوابیدن', 'to sleep', 'sova', 'schlafen', 'dormir', 'спать', 'dormire', 'dormir'],
  ['v.work', 'verb', 'verbs', 'کار کردن', 'to work', 'arbeta', 'arbeiten', 'trabajar', 'работать', 'lavorare', 'travailler'],
  ['v.speak', 'verb', 'verbs', 'صحبت کردن', 'to speak', 'tala', 'sprechen', 'hablar', 'говорить', 'parlare', 'parler'],
  ['v.read', 'verb', 'verbs', 'خواندن', 'to read', 'läsa', 'lesen', 'leer', 'читать', 'leggere', 'lire'],
  ['v.write', 'verb', 'verbs', 'نوشتن', 'to write', 'skriva', 'schreiben', 'escribir', 'писать', 'scrivere', 'écrire'],
  ['v.see', 'verb', 'verbs', 'دیدن', 'to see', 'se', 'sehen', 'ver', 'видеть', 'vedere', 'voir'],
  ['v.hear', 'verb', 'verbs', 'شنیدن', 'to hear', 'höra', 'hören', 'oír', 'слышать', 'sentire', 'entendre'],
  ['v.know', 'verb', 'verbs', 'دانستن', 'to know', 'veta', 'wissen', 'saber', 'знать', 'sapere', 'savoir'],
  ['v.want', 'verb', 'verbs', 'خواستن', 'to want', 'vilja', 'wollen', 'querer', 'хотеть', 'volere', 'vouloir'],
  ['v.can', 'verb', 'verbs', 'توانستن', 'to be able to', 'kunna', 'können', 'poder', 'мочь', 'potere', 'pouvoir'],
  ['v.need', 'verb', 'verbs', 'نیاز داشتن', 'to need', 'behöva', 'brauchen', 'necesitar', 'нуждаться', 'avere bisogno di', 'avoir besoin de'],
  ['v.buy', 'verb', 'verbs', 'خریدن', 'to buy', 'köpa', 'kaufen', 'comprar', 'покупать', 'comprare', 'acheter'],
  ['v.live', 'verb', 'verbs', 'زندگی کردن', 'to live', 'bo', 'wohnen', 'vivir', 'жить', 'vivere', 'habiter'],
  ['v.learn', 'verb', 'verbs', 'یاد گرفتن', 'to learn', 'lära sig', 'lernen', 'aprender', 'учить', 'imparare', 'apprendre'],
  ['v.understand', 'verb', 'verbs', 'فهمیدن', 'to understand', 'förstå', 'verstehen', 'entender', 'понимать', 'capire', 'comprendre'],
  ['v.give', 'verb', 'verbs', 'دادن', 'to give', 'ge', 'geben', 'dar', 'давать', 'dare', 'donner'],
  ['v.take', 'verb', 'verbs', 'گرفتن', 'to take', 'ta', 'nehmen', 'tomar', 'брать', 'prendere', 'prendre'],
  ['v.help', 'verb', 'verbs', 'کمک کردن', 'to help', 'hjälpa', 'helfen', 'ayudar', 'помогать', 'aiutare', 'aider'],

  // --- prepositions --------------------------------------------------------
  ['prep.in', 'preposition', 'prepositions', 'در', 'in', 'i', 'in', 'en', 'в', 'in', 'dans'],
  ['prep.on', 'preposition', 'prepositions', 'روی', 'on', 'på', 'auf', 'sobre', 'на', 'su', 'sur'],
  ['prep.under', 'preposition', 'prepositions', 'زیر', 'under', 'under', 'unter', 'debajo de', 'под', 'sotto', 'sous'],
  ['prep.with', 'preposition', 'prepositions', 'با', 'with', 'med', 'mit', 'con', 'с', 'con', 'avec'],
  ['prep.without', 'preposition', 'prepositions', 'بدون', 'without', 'utan', 'ohne', 'sin', 'без', 'senza', 'sans'],
  ['prep.to', 'preposition', 'prepositions', 'به', 'to', 'till', 'zu', 'a', 'к', 'a', 'à'],
  ['prep.from', 'preposition', 'prepositions', 'از', 'from', 'från', 'von', 'de', 'от', 'da', 'de'],
  ['prep.for', 'preposition', 'prepositions', 'برای', 'for', 'för', 'für', 'para', 'для', 'per', 'pour'],
  ['prep.between', 'preposition', 'prepositions', 'بین', 'between', 'mellan', 'zwischen', 'entre', 'между', 'tra', 'entre'],
  ['prep.before', 'preposition', 'prepositions', 'قبل از', 'before', 'före', 'vor', 'antes de', 'до', 'prima di', 'avant'],
  ['prep.after', 'preposition', 'prepositions', 'بعد از', 'after', 'efter', 'nach', 'después de', 'после', 'dopo', 'après'],
  ['prep.near', 'preposition', 'prepositions', 'نزدیک', 'near', 'nära', 'in der Nähe von', 'cerca de', 'рядом с', 'vicino a', 'près de'],

  // --- a house and a street ------------------------------------------------
  ['n.house', 'noun', 'home', 'خانه', 'house', 'ett hus', 'das Haus', 'la casa', 'дом', 'la casa', 'la maison'],
  ['n.door', 'noun', 'home', 'درب', 'door', 'en dörr', 'die Tür', 'la puerta', 'дверь', 'la porta', 'la porte'],
  ['n.window', 'noun', 'home', 'پنجره', 'window', 'ett fönster', 'das Fenster', 'la ventana', 'окно', 'la finestra', 'la fenêtre'],
  ['n.table', 'noun', 'home', 'میز', 'table', 'ett bord', 'der Tisch', 'la mesa', 'стол', 'il tavolo', 'la table'],
  ['n.chair', 'noun', 'home', 'صندلی', 'chair', 'en stol', 'der Stuhl', 'la silla', 'стул', 'la sedia', 'la chaise'],
  ['n.bed', 'noun', 'home', 'تخت', 'bed', 'en säng', 'das Bett', 'la cama', 'кровать', 'il letto', 'le lit'],
  ['n.room', 'noun', 'home', 'اتاق', 'room', 'ett rum', 'das Zimmer', 'la habitación', 'комната', 'la stanza', 'la chambre'],
  ['n.car', 'noun', 'city', 'ماشین', 'car', 'en bil', 'das Auto', 'el coche', 'машина', 'la macchina', 'la voiture'],
  ['n.bus', 'noun', 'city', 'اتوبوس', 'bus', 'en buss', 'der Bus', 'el autobús', 'автобус', "l'autobus", 'le bus'],
  ['n.train', 'noun', 'city', 'قطار', 'train', 'ett tåg', 'der Zug', 'el tren', 'поезд', 'il treno', 'le train'],
  ['n.street', 'noun', 'city', 'خیابان', 'street', 'en gata', 'die Straße', 'la calle', 'улица', 'la strada', 'la rue'],
  ['n.city', 'noun', 'city', 'شهر', 'city', 'en stad', 'die Stadt', 'la ciudad', 'город', 'la città', 'la ville'],
  ['n.country', 'noun', 'city', 'کشور', 'country', 'ett land', 'das Land', 'el país', 'страна', 'il paese', 'le pays'],
  ['n.shop', 'noun', 'city', 'مغازه', 'shop', 'en affär', 'das Geschäft', 'la tienda', 'магазин', 'il negozio', 'le magasin'],
  ['n.school', 'noun', 'city', 'مدرسه', 'school', 'en skola', 'die Schule', 'la escuela', 'школа', 'la scuola', "l'école"],
  ['n.job', 'noun', 'work', 'شغل', 'job', 'ett jobb', 'die Arbeit', 'el trabajo', 'работа', 'il lavoro', 'le travail'],
  ['n.money', 'noun', 'city', 'پول', 'money', 'pengar', 'das Geld', 'el dinero', 'деньги', 'i soldi', "l'argent"],
  ['n.phone', 'noun', 'home', 'تلفن', 'phone', 'en telefon', 'das Telefon', 'el teléfono', 'телефон', 'il telefono', 'le téléphone'],
  ['n.book', 'noun', 'home', 'کتاب', 'book', 'en bok', 'das Buch', 'el libro', 'книга', 'il libro', 'le livre'],
  ['n.key', 'noun', 'home', 'کلید', 'key', 'en nyckel', 'der Schlüssel', 'la llave', 'ключ', 'la chiave', 'la clé'],

  // --- the adjectives you reach for first ----------------------------------
  ['adj.big', 'adjective', 'adjectives', 'بزرگ', 'big', 'stor', 'groß', 'grande', 'большой', 'grande', 'grand'],
  ['adj.small', 'adjective', 'adjectives', 'کوچک', 'small', 'liten', 'klein', 'pequeño', 'маленький', 'piccolo', 'petit'],
  ['adj.good', 'adjective', 'adjectives', 'خوب', 'good', 'bra', 'gut', 'bueno', 'хороший', 'buono', 'bon'],
  ['adj.bad', 'adjective', 'adjectives', 'بد', 'bad', 'dålig', 'schlecht', 'malo', 'плохой', 'cattivo', 'mauvais'],
  ['adj.new', 'adjective', 'adjectives', 'جدید', 'new', 'ny', 'neu', 'nuevo', 'новый', 'nuovo', 'nouveau'],
  ['adj.old', 'adjective', 'adjectives', 'قدیمی', 'old', 'gammal', 'alt', 'viejo', 'старый', 'vecchio', 'vieux'],
  ['adj.hot', 'adjective', 'adjectives', 'داغ', 'hot', 'varm', 'heiß', 'caliente', 'горячий', 'caldo', 'chaud'],
  ['adj.cold', 'adjective', 'adjectives', 'سرد', 'cold', 'kall', 'kalt', 'frío', 'холодный', 'freddo', 'froid'],
  ['adj.long', 'adjective', 'adjectives', 'بلند', 'long', 'lång', 'lang', 'largo', 'длинный', 'lungo', 'long'],
  ['adj.short', 'adjective', 'adjectives', 'کوتاه', 'short', 'kort', 'kurz', 'corto', 'короткий', 'corto', 'court'],
  ['adj.easy', 'adjective', 'adjectives', 'آسان', 'easy', 'lätt', 'einfach', 'fácil', 'лёгкий', 'facile', 'facile'],
  ['adj.difficult', 'adjective', 'adjectives', 'سخت', 'difficult', 'svår', 'schwierig', 'difícil', 'трудный', 'difficile', 'difficile'],
  ['adj.happy', 'adjective', 'adjectives', 'خوشحال', 'happy', 'glad', 'glücklich', 'feliz', 'счастливый', 'felice', 'heureux'],
  ['adj.tired', 'adjective', 'adjectives', 'خسته', 'tired', 'trött', 'müde', 'cansado', 'усталый', 'stanco', 'fatigué'],
  ['adj.hungry', 'adjective', 'adjectives', 'گرسنه', 'hungry', 'hungrig', 'hungrig', 'hambriento', 'голодный', 'affamato', 'affamé'],
  ['adj.thirsty', 'adjective', 'adjectives', 'تشنه', 'thirsty', 'törstig', 'durstig', 'sediento', 'жаждущий', 'assetato', 'assoiffé'],
  ['adj.beautiful', 'adjective', 'adjectives', 'زیبا', 'beautiful', 'vacker', 'schön', 'bonito', 'красивый', 'bello', 'beau'],
] as const

export const a1Pack: Pack = {
  id: 'a1',
  name: 'A1 level',
  blurb: 'Greetings, pronouns, question words, 25 core verbs, prepositions — 100 words.',
  rows,
}
