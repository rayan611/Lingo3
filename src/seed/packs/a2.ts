import type { Pack, SeedRow } from '../catalogue'

/**
 * A2 — the second hundred: saying when, why and how it went.
 *
 * The connectives that turn two sentences into one argument, twenty-five more
 * verbs, and the vocabulary of the four places a learner actually ends up
 * needing words for: a journey, an office, a doctor's room and the weather.
 *
 * Nothing here repeats A1 or the everyday pack. Where a word genuinely
 * collides in one language but not the others — Italian `perché` is both
 * "why" and "because" — the other language is chosen rather than the row
 * dropped, because the concept is worth a card in the seven languages where
 * it is a different word.
 *
 * Columns after id/pos/tags: fa en sv de es ru it fr.
 */
const rows: readonly SeedRow[] = [
  // --- joining two thoughts ------------------------------------------------
  ['c.and', 'other', 'connectors', 'و', 'and', 'och', 'und', 'y', 'и', 'e', 'et'],
  ['c.or', 'other', 'connectors', 'یا', 'or', 'eller', 'oder', 'o', 'или', 'o', 'ou'],
  ['c.but', 'other', 'connectors', 'اما', 'but', 'men', 'aber', 'pero', 'но', 'ma', 'mais'],
  ['c.because', 'other', 'connectors', 'چون', 'because', 'för att', 'weil', 'porque', 'потому что', 'poiché', 'parce que'],
  ['c.if', 'other', 'connectors', 'اگر', 'if', 'om', 'wenn', 'si', 'если', 'se', 'si'],
  ['c.also', 'adverb', 'connectors', 'همچنین', 'also', 'också', 'auch', 'también', 'также', 'anche', 'aussi'],
  ['c.always', 'adverb', 'connectors', 'همیشه', 'always', 'alltid', 'immer', 'siempre', 'всегда', 'sempre', 'toujours'],
  ['c.never', 'adverb', 'connectors', 'هرگز', 'never', 'aldrig', 'nie', 'nunca', 'никогда', 'mai', 'jamais'],
  ['c.sometimes', 'adverb', 'connectors', 'گاهی', 'sometimes', 'ibland', 'manchmal', 'a veces', 'иногда', 'a volte', 'parfois'],
  ['c.often', 'adverb', 'connectors', 'اغلب', 'often', 'ofta', 'oft', 'a menudo', 'часто', 'spesso', 'souvent'],
  ['c.maybe', 'adverb', 'connectors', 'شاید', 'maybe', 'kanske', 'vielleicht', 'quizás', 'может быть', 'forse', 'peut-être'],
  ['c.very', 'adverb', 'connectors', 'خیلی', 'very', 'mycket', 'sehr', 'muy', 'очень', 'molto', 'très'],
  ['c.already', 'adverb', 'connectors', 'قبلاً', 'already', 'redan', 'schon', 'ya', 'уже', 'già', 'déjà'],
  ['c.still', 'adverb', 'connectors', 'هنوز', 'still', 'fortfarande', 'noch', 'todavía', 'ещё', 'ancora', 'encore'],

  // --- twenty-five more verbs ----------------------------------------------
  ['v2.open', 'verb', 'verbs', 'باز کردن', 'to open', 'öppna', 'öffnen', 'abrir', 'открывать', 'aprire', 'ouvrir'],
  ['v2.close', 'verb', 'verbs', 'بستن', 'to close', 'stänga', 'schließen', 'cerrar', 'закрывать', 'chiudere', 'fermer'],
  ['v2.start', 'verb', 'verbs', 'شروع کردن', 'to start', 'börja', 'anfangen', 'empezar', 'начинать', 'cominciare', 'commencer'],
  ['v2.finish', 'verb', 'verbs', 'تمام کردن', 'to finish', 'avsluta', 'beenden', 'terminar', 'заканчивать', 'finire', 'finir'],
  ['v2.wait', 'verb', 'verbs', 'منتظر ماندن', 'to wait', 'vänta', 'warten', 'esperar', 'ждать', 'aspettare', 'attendre'],
  ['v2.ask', 'verb', 'verbs', 'پرسیدن', 'to ask', 'fråga', 'fragen', 'preguntar', 'спрашивать', 'chiedere', 'demander'],
  ['v2.answer', 'verb', 'verbs', 'پاسخ دادن', 'to answer', 'svara', 'antworten', 'responder', 'отвечать', 'rispondere', 'répondre'],
  ['v2.pay', 'verb', 'verbs', 'پرداختن', 'to pay', 'betala', 'bezahlen', 'pagar', 'платить', 'pagare', 'payer'],
  ['v2.send', 'verb', 'verbs', 'فرستادن', 'to send', 'skicka', 'senden', 'enviar', 'отправлять', 'inviare', 'envoyer'],
  ['v2.travel', 'verb', 'verbs travel', 'سفر کردن', 'to travel', 'resa', 'reisen', 'viajar', 'путешествовать', 'viaggiare', 'voyager'],
  ['v2.drive', 'verb', 'verbs', 'رانندگی کردن', 'to drive', 'köra', 'fahren', 'conducir', 'водить', 'guidare', 'conduire'],
  ['v2.walk', 'verb', 'verbs', 'راه رفتن', 'to walk', 'promenera', 'laufen', 'caminar', 'ходить пешком', 'camminare', 'marcher'],
  ['v2.run', 'verb', 'verbs', 'دویدن', 'to run', 'springa', 'rennen', 'correr', 'бегать', 'correre', 'courir'],
  ['v2.call', 'verb', 'verbs', 'زنگ زدن', 'to call', 'ringa', 'anrufen', 'llamar', 'звонить', 'chiamare', 'appeler'],
  ['v2.meet', 'verb', 'verbs', 'ملاقات کردن', 'to meet', 'träffa', 'treffen', 'conocer', 'встречать', 'incontrare', 'rencontrer'],
  ['v2.forget', 'verb', 'verbs', 'فراموش کردن', 'to forget', 'glömma', 'vergessen', 'olvidar', 'забывать', 'dimenticare', 'oublier'],
  ['v2.remember', 'verb', 'verbs', 'به یاد آوردن', 'to remember', 'komma ihåg', 'sich erinnern', 'recordar', 'помнить', 'ricordare', 'se souvenir'],
  ['v2.think', 'verb', 'verbs', 'فکر کردن', 'to think', 'tänka', 'denken', 'pensar', 'думать', 'pensare', 'penser'],
  ['v2.feel', 'verb', 'verbs', 'احساس کردن', 'to feel', 'känna', 'fühlen', 'sentir', 'чувствовать', 'sentirsi', 'ressentir'],
  ['v2.lose', 'verb', 'verbs', 'گم کردن', 'to lose', 'förlora', 'verlieren', 'perder', 'терять', 'perdere', 'perdre'],
  ['v2.find', 'verb', 'verbs', 'پیدا کردن', 'to find', 'hitta', 'finden', 'encontrar', 'находить', 'trovare', 'trouver'],
  ['v2.change', 'verb', 'verbs', 'تغییر دادن', 'to change', 'ändra', 'ändern', 'cambiar', 'менять', 'cambiare', 'changer'],
  ['v2.try', 'verb', 'verbs', 'تلاش کردن', 'to try', 'försöka', 'versuchen', 'intentar', 'пытаться', 'provare', 'essayer'],
  ['v2.choose', 'verb', 'verbs', 'انتخاب کردن', 'to choose', 'välja', 'wählen', 'elegir', 'выбирать', 'scegliere', 'choisir'],
  ['v2.stay', 'verb', 'verbs', 'ماندن', 'to stay', 'stanna', 'bleiben', 'quedarse', 'оставаться', 'rimanere', 'rester'],

  // --- a journey -----------------------------------------------------------
  ['tr.airport', 'noun', 'travel', 'فرودگاه', 'airport', 'en flygplats', 'der Flughafen', 'el aeropuerto', 'аэропорт', "l'aeroporto", "l'aéroport"],
  ['tr.plane', 'noun', 'travel', 'هواپیما', 'plane', 'ett flygplan', 'das Flugzeug', 'el avión', 'самолёт', "l'aereo", "l'avion"],
  ['tr.ticket', 'noun', 'travel', 'بلیت', 'ticket', 'en biljett', 'die Fahrkarte', 'el billete', 'билет', 'il biglietto', 'le billet'],
  ['tr.luggage', 'noun', 'travel', 'چمدان', 'luggage', 'ett bagage', 'das Gepäck', 'el equipaje', 'багаж', 'il bagaglio', 'les bagages'],
  ['tr.passport', 'noun', 'travel', 'گذرنامه', 'passport', 'ett pass', 'der Reisepass', 'el pasaporte', 'паспорт', 'il passaporto', 'le passeport'],
  ['tr.hotel', 'noun', 'travel', 'هتل', 'hotel', 'ett hotell', 'das Hotel', 'el hotel', 'гостиница', "l'albergo", "l'hôtel"],
  ['tr.map', 'noun', 'travel', 'نقشه', 'map', 'en karta', 'die Karte', 'el mapa', 'карта', 'la mappa', 'la carte'],
  ['tr.station', 'noun', 'travel', 'ایستگاه', 'station', 'en station', 'der Bahnhof', 'la estación', 'вокзал', 'la stazione', 'la gare'],
  ['tr.road', 'noun', 'travel', 'جاده', 'road', 'en väg', 'der Weg', 'la carretera', 'дорога', 'la via', 'la route'],
  ['tr.trip', 'noun', 'travel', 'سفر', 'trip', 'en resa', 'die Reise', 'el viaje', 'поездка', 'il viaggio', 'le voyage'],
  ['tr.border', 'noun', 'travel', 'مرز', 'border', 'en gräns', 'die Grenze', 'la frontera', 'граница', 'il confine', 'la frontière'],
  ['tr.holiday', 'noun', 'travel', 'تعطیلات', 'holiday', 'en semester', 'der Urlaub', 'las vacaciones', 'отпуск', 'la vacanza', 'les vacances'],
  ['tr.bag', 'noun', 'travel', 'کیف', 'bag', 'en väska', 'die Tasche', 'la bolsa', 'сумка', 'la borsa', 'le sac'],
  ['tr.taxi', 'noun', 'travel', 'تاکسی', 'taxi', 'en taxi', 'das Taxi', 'el taxi', 'такси', 'il taxi', 'le taxi'],

  // --- an office -----------------------------------------------------------
  ['w.meeting', 'noun', 'work', 'جلسه', 'meeting', 'ett möte', 'das Treffen', 'la reunión', 'встреча', 'la riunione', 'la réunion'],
  ['w.office', 'noun', 'work', 'دفتر', 'office', 'ett kontor', 'das Büro', 'la oficina', 'офис', "l'ufficio", 'le bureau'],
  ['w.boss', 'noun', 'work', 'رئیس', 'boss', 'en chef', 'der Chef', 'el jefe', 'начальник', 'il capo', 'le chef'],
  ['w.colleague', 'noun', 'work', 'همکار', 'colleague', 'en kollega', 'der Kollege', 'el colega', 'коллега', 'il collega', 'le collègue'],
  ['w.email', 'noun', 'work', 'ایمیل', 'email', 'ett mejl', 'die E-Mail', 'el correo', 'электронная почта', "l'email", 'le courriel'],
  ['w.report', 'noun', 'work', 'گزارش', 'report', 'en rapport', 'der Bericht', 'el informe', 'отчёт', 'il rapporto', 'le rapport'],
  ['w.project', 'noun', 'work', 'پروژه', 'project', 'ett projekt', 'das Projekt', 'el proyecto', 'проект', 'il progetto', 'le projet'],
  ['w.deadline', 'noun', 'work', 'مهلت', 'deadline', 'en deadline', 'die Frist', 'la fecha límite', 'срок', 'la scadenza', 'le délai'],
  ['w.company', 'noun', 'work', 'شرکت', 'company', 'ett företag', 'die Firma', 'la empresa', 'компания', "l'azienda", "l'entreprise"],
  ['w.salary', 'noun', 'work', 'حقوق', 'salary', 'en lön', 'das Gehalt', 'el sueldo', 'зарплата', 'lo stipendio', 'le salaire'],
  ['w.computer', 'noun', 'work', 'رایانه', 'computer', 'en dator', 'der Computer', 'el ordenador', 'компьютер', 'il computer', "l'ordinateur"],
  ['w.document', 'noun', 'work', 'سند', 'document', 'ett dokument', 'das Dokument', 'el documento', 'документ', 'il documento', 'le document'],

  // --- a doctor's room -----------------------------------------------------
  ['b.head', 'noun', 'body', 'سر', 'head', 'ett huvud', 'der Kopf', 'la cabeza', 'голова', 'la testa', 'la tête'],
  ['b.hand', 'noun', 'body', 'دست', 'hand', 'en hand', 'die Hand', 'la mano', 'рука', 'la mano', 'la main'],
  ['b.foot', 'noun', 'body', 'پا', 'foot', 'en fot', 'der Fuß', 'el pie', 'нога', 'il piede', 'le pied'],
  ['b.eye', 'noun', 'body', 'چشم', 'eye', 'ett öga', 'das Auge', 'el ojo', 'глаз', "l'occhio", "l'œil"],
  ['b.mouth', 'noun', 'body', 'دهان', 'mouth', 'en mun', 'der Mund', 'la boca', 'рот', 'la bocca', 'la bouche'],
  ['b.back', 'noun', 'body', 'پشت', 'back', 'en rygg', 'der Rücken', 'la espalda', 'спина', 'la schiena', 'le dos'],
  ['b.heart', 'noun', 'body', 'قلب', 'heart', 'ett hjärta', 'das Herz', 'el corazón', 'сердце', 'il cuore', 'le cœur'],
  ['b.tooth', 'noun', 'body', 'دندان', 'tooth', 'en tand', 'der Zahn', 'el diente', 'зуб', 'il dente', 'la dent'],
  ['h.doctor', 'noun', 'health', 'پزشک', 'doctor', 'en läkare', 'der Arzt', 'el médico', 'врач', 'il medico', 'le médecin'],
  ['h.hospital', 'noun', 'health', 'بیمارستان', 'hospital', 'ett sjukhus', 'das Krankenhaus', 'el hospital', 'больница', "l'ospedale", "l'hôpital"],
  ['h.medicine', 'noun', 'health', 'دارو', 'medicine', 'en medicin', 'das Medikament', 'la medicina', 'лекарство', 'la medicina', 'le médicament'],
  ['h.pain', 'noun', 'health', 'درد', 'pain', 'en smärta', 'der Schmerz', 'el dolor', 'боль', 'il dolore', 'la douleur'],
  ['h.ill', 'adjective', 'health', 'بیمار', 'ill', 'sjuk', 'krank', 'enfermo', 'больной', 'malato', 'malade'],
  ['h.healthy', 'adjective', 'health', 'سالم', 'healthy', 'frisk', 'gesund', 'sano', 'здоровый', 'sano', 'sain'],

  // --- how it felt ---------------------------------------------------------
  ['f.love', 'noun', 'feelings', 'عشق', 'love', 'kärlek', 'die Liebe', 'el amor', 'любовь', "l'amore", "l'amour"],
  ['f.fear', 'noun', 'feelings', 'ترس', 'fear', 'rädsla', 'die Angst', 'el miedo', 'страх', 'la paura', 'la peur'],
  ['f.anger', 'noun', 'feelings', 'خشم', 'anger', 'ilska', 'der Ärger', 'la ira', 'гнев', 'la rabbia', 'la colère'],
  ['f.hope', 'noun', 'feelings', 'امید', 'hope', 'hopp', 'die Hoffnung', 'la esperanza', 'надежда', 'la speranza', "l'espoir"],
  ['f.worry', 'noun', 'feelings', 'نگرانی', 'worry', 'oro', 'die Sorge', 'la preocupación', 'беспокойство', 'la preoccupazione', "l'inquiétude"],
  ['f.surprise', 'noun', 'feelings', 'تعجب', 'surprise', 'överraskning', 'die Überraschung', 'la sorpresa', 'удивление', 'la sorpresa', 'la surprise'],
  ['f.bored', 'adjective', 'feelings', 'بی‌حوصله', 'bored', 'uttråkad', 'gelangweilt', 'aburrido', 'скучающий', 'annoiato', 'ennuyé'],
  ['f.nervous', 'adjective', 'feelings', 'عصبی', 'nervous', 'nervös', 'nervös', 'nervioso', 'нервный', 'nervoso', 'nerveux'],
  ['f.calm', 'adjective', 'feelings', 'آرام', 'calm', 'lugn', 'ruhig', 'tranquilo', 'спокойный', 'calmo', 'calme'],
  ['f.proud', 'adjective', 'feelings', 'مفتخر', 'proud', 'stolt', 'stolz', 'orgulloso', 'гордый', 'orgoglioso', 'fier'],

  // --- the weather ---------------------------------------------------------
  ['na.weather', 'noun', 'weather', 'هوا', 'weather', 'väder', 'das Wetter', 'el tiempo', 'погода', 'il tempo', 'le temps'],
  ['na.rain', 'noun', 'weather', 'باران', 'rain', 'regn', 'der Regen', 'la lluvia', 'дождь', 'la pioggia', 'la pluie'],
  ['na.snow', 'noun', 'weather', 'برف', 'snow', 'snö', 'der Schnee', 'la nieve', 'снег', 'la neve', 'la neige'],
  ['na.sun', 'noun', 'weather', 'خورشید', 'sun', 'en sol', 'die Sonne', 'el sol', 'солнце', 'il sole', 'le soleil'],
  ['na.wind', 'noun', 'weather', 'باد', 'wind', 'en vind', 'der Wind', 'el viento', 'ветер', 'il vento', 'le vent'],
  ['na.cloud', 'noun', 'weather', 'ابر', 'cloud', 'ett moln', 'die Wolke', 'la nube', 'облако', 'la nuvola', 'le nuage'],
  ['na.tree', 'noun', 'nature', 'درخت', 'tree', 'ett träd', 'der Baum', 'el árbol', 'дерево', "l'albero", "l'arbre"],
  ['na.sea', 'noun', 'nature', 'دریا', 'sea', 'ett hav', 'das Meer', 'el mar', 'море', 'il mare', 'la mer'],
  ['na.mountain', 'noun', 'nature', 'کوه', 'mountain', 'ett berg', 'der Berg', 'la montaña', 'гора', 'la montagna', 'la montagne'],
  ['na.river', 'noun', 'nature', 'رودخانه', 'river', 'en flod', 'der Fluss', 'el río', 'река', 'il fiume', 'la rivière'],
  ['na.sky', 'noun', 'nature', 'آسمان', 'sky', 'en himmel', 'der Himmel', 'el cielo', 'небо', 'il cielo', 'le ciel'],
] as const

export const a2Pack: Pack = {
  id: 'a2',
  name: 'A2 level',
  blurb: 'Connectives, 25 more verbs, travel, work, health, feelings — 100 words.',
  rows,
}
