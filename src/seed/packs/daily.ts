import type { Pack, SeedRow } from '../catalogue'

/**
 * Everyday words — the closed sets.
 *
 * Numbers, colours, days, months, the words for when something happens, food
 * and family. These are here rather than in A1 because they are *lists*: you
 * do not learn "Tuesday" in isolation, you learn the seven of them, and a
 * learner who wants to drill colours wants all eleven in one place.
 *
 * That is also why A1 does not repeat them. Every concept in the three packs
 * appears in exactly one of them — see the note in ../catalogue.ts — so the
 * colours live here and A1 spends its hundred on verbs and function words
 * instead of on `red` again.
 *
 * Columns, after id/pos/tags: fa en sv de es ru it fr.
 * Nouns carry their article where the language uses one, because a noun
 * learned without its gender has to be relearned with it.
 */
const rows: readonly SeedRow[] = [
  // --- numbers -------------------------------------------------------------
  ['num.1', 'other', 'numbers', 'یک', 'one', 'ett', 'eins', 'uno', 'один', 'uno', 'un'],
  ['num.2', 'other', 'numbers', 'دو', 'two', 'två', 'zwei', 'dos', 'два', 'due', 'deux'],
  ['num.3', 'other', 'numbers', 'سه', 'three', 'tre', 'drei', 'tres', 'три', 'tre', 'trois'],
  ['num.4', 'other', 'numbers', 'چهار', 'four', 'fyra', 'vier', 'cuatro', 'четыре', 'quattro', 'quatre'],
  ['num.5', 'other', 'numbers', 'پنج', 'five', 'fem', 'fünf', 'cinco', 'пять', 'cinque', 'cinq'],
  ['num.6', 'other', 'numbers', 'شش', 'six', 'sex', 'sechs', 'seis', 'шесть', 'sei', 'six'],
  ['num.7', 'other', 'numbers', 'هفت', 'seven', 'sju', 'sieben', 'siete', 'семь', 'sette', 'sept'],
  ['num.8', 'other', 'numbers', 'هشت', 'eight', 'åtta', 'acht', 'ocho', 'восемь', 'otto', 'huit'],
  ['num.9', 'other', 'numbers', 'نُه', 'nine', 'nio', 'neun', 'nueve', 'девять', 'nove', 'neuf'],
  ['num.10', 'other', 'numbers', 'ده', 'ten', 'tio', 'zehn', 'diez', 'десять', 'dieci', 'dix'],
  ['num.11', 'other', 'numbers', 'یازده', 'eleven', 'elva', 'elf', 'once', 'одиннадцать', 'undici', 'onze'],
  ['num.12', 'other', 'numbers', 'دوازده', 'twelve', 'tolv', 'zwölf', 'doce', 'двенадцать', 'dodici', 'douze'],
  ['num.13', 'other', 'numbers', 'سیزده', 'thirteen', 'tretton', 'dreizehn', 'trece', 'тринадцать', 'tredici', 'treize'],
  ['num.14', 'other', 'numbers', 'چهارده', 'fourteen', 'fjorton', 'vierzehn', 'catorce', 'четырнадцать', 'quattordici', 'quatorze'],
  ['num.15', 'other', 'numbers', 'پانزده', 'fifteen', 'femton', 'fünfzehn', 'quince', 'пятнадцать', 'quindici', 'quinze'],
  ['num.16', 'other', 'numbers', 'شانزده', 'sixteen', 'sexton', 'sechzehn', 'dieciséis', 'шестнадцать', 'sedici', 'seize'],
  ['num.17', 'other', 'numbers', 'هفده', 'seventeen', 'sjutton', 'siebzehn', 'diecisiete', 'семнадцать', 'diciassette', 'dix-sept'],
  ['num.18', 'other', 'numbers', 'هجده', 'eighteen', 'arton', 'achtzehn', 'dieciocho', 'восемнадцать', 'diciotto', 'dix-huit'],
  ['num.19', 'other', 'numbers', 'نوزده', 'nineteen', 'nitton', 'neunzehn', 'diecinueve', 'девятнадцать', 'diciannove', 'dix-neuf'],
  ['num.20', 'other', 'numbers', 'بیست', 'twenty', 'tjugo', 'zwanzig', 'veinte', 'двадцать', 'venti', 'vingt'],
  ['num.30', 'other', 'numbers', 'سی', 'thirty', 'trettio', 'dreißig', 'treinta', 'тридцать', 'trenta', 'trente'],
  ['num.40', 'other', 'numbers', 'چهل', 'forty', 'fyrtio', 'vierzig', 'cuarenta', 'сорок', 'quaranta', 'quarante'],
  ['num.50', 'other', 'numbers', 'پنجاه', 'fifty', 'femtio', 'fünfzig', 'cincuenta', 'пятьдесят', 'cinquanta', 'cinquante'],
  ['num.100', 'other', 'numbers', 'صد', 'hundred', 'hundra', 'hundert', 'cien', 'сто', 'cento', 'cent'],
  ['num.1000', 'other', 'numbers', 'هزار', 'thousand', 'tusen', 'tausend', 'mil', 'тысяча', 'mille', 'mille'],

  // --- colours -------------------------------------------------------------
  ['col.red', 'adjective', 'colours', 'قرمز', 'red', 'röd', 'rot', 'rojo', 'красный', 'rosso', 'rouge'],
  ['col.blue', 'adjective', 'colours', 'آبی', 'blue', 'blå', 'blau', 'azul', 'синий', 'blu', 'bleu'],
  ['col.green', 'adjective', 'colours', 'سبز', 'green', 'grön', 'grün', 'verde', 'зелёный', 'verde', 'vert'],
  ['col.yellow', 'adjective', 'colours', 'زرد', 'yellow', 'gul', 'gelb', 'amarillo', 'жёлтый', 'giallo', 'jaune'],
  ['col.black', 'adjective', 'colours', 'سیاه', 'black', 'svart', 'schwarz', 'negro', 'чёрный', 'nero', 'noir'],
  ['col.white', 'adjective', 'colours', 'سفید', 'white', 'vit', 'weiß', 'blanco', 'белый', 'bianco', 'blanc'],
  ['col.orange', 'adjective', 'colours', 'نارنجی', 'orange', 'orange', 'orange', 'naranja', 'оранжевый', 'arancione', 'orange'],
  ['col.pink', 'adjective', 'colours', 'صورتی', 'pink', 'rosa', 'rosa', 'rosa', 'розовый', 'rosa', 'rose'],
  ['col.purple', 'adjective', 'colours', 'بنفش', 'purple', 'lila', 'lila', 'morado', 'фиолетовый', 'viola', 'violet'],
  ['col.brown', 'adjective', 'colours', 'قهوه‌ای', 'brown', 'brun', 'braun', 'marrón', 'коричневый', 'marrone', 'marron'],
  ['col.grey', 'adjective', 'colours', 'خاکستری', 'grey', 'grå', 'grau', 'gris', 'серый', 'grigio', 'gris'],

  // --- days ----------------------------------------------------------------
  ['day.mon', 'noun', 'time days', 'دوشنبه', 'Monday', 'måndag', 'der Montag', 'el lunes', 'понедельник', 'il lunedì', 'le lundi'],
  ['day.tue', 'noun', 'time days', 'سه‌شنبه', 'Tuesday', 'tisdag', 'der Dienstag', 'el martes', 'вторник', 'il martedì', 'le mardi'],
  ['day.wed', 'noun', 'time days', 'چهارشنبه', 'Wednesday', 'onsdag', 'der Mittwoch', 'el miércoles', 'среда', 'il mercoledì', 'le mercredi'],
  ['day.thu', 'noun', 'time days', 'پنج‌شنبه', 'Thursday', 'torsdag', 'der Donnerstag', 'el jueves', 'четверг', 'il giovedì', 'le jeudi'],
  ['day.fri', 'noun', 'time days', 'جمعه', 'Friday', 'fredag', 'der Freitag', 'el viernes', 'пятница', 'il venerdì', 'le vendredi'],
  ['day.sat', 'noun', 'time days', 'شنبه', 'Saturday', 'lördag', 'der Samstag', 'el sábado', 'суббота', 'il sabato', 'le samedi'],
  ['day.sun', 'noun', 'time days', 'یکشنبه', 'Sunday', 'söndag', 'der Sonntag', 'el domingo', 'воскресенье', 'la domenica', 'le dimanche'],

  // --- months --------------------------------------------------------------
  ['mon.01', 'noun', 'time months', 'ژانویه', 'January', 'januari', 'der Januar', 'enero', 'январь', 'gennaio', 'janvier'],
  ['mon.02', 'noun', 'time months', 'فوریه', 'February', 'februari', 'der Februar', 'febrero', 'февраль', 'febbraio', 'février'],
  ['mon.03', 'noun', 'time months', 'مارس', 'March', 'mars', 'der März', 'marzo', 'март', 'marzo', 'mars'],
  ['mon.04', 'noun', 'time months', 'آوریل', 'April', 'april', 'der April', 'abril', 'апрель', 'aprile', 'avril'],
  ['mon.05', 'noun', 'time months', 'مه', 'May', 'maj', 'der Mai', 'mayo', 'май', 'maggio', 'mai'],
  ['mon.06', 'noun', 'time months', 'ژوئن', 'June', 'juni', 'der Juni', 'junio', 'июнь', 'giugno', 'juin'],
  ['mon.07', 'noun', 'time months', 'ژوئیه', 'July', 'juli', 'der Juli', 'julio', 'июль', 'luglio', 'juillet'],
  ['mon.08', 'noun', 'time months', 'اوت', 'August', 'augusti', 'der August', 'agosto', 'август', 'agosto', 'août'],
  ['mon.09', 'noun', 'time months', 'سپتامبر', 'September', 'september', 'der September', 'septiembre', 'сентябрь', 'settembre', 'septembre'],
  ['mon.10', 'noun', 'time months', 'اکتبر', 'October', 'oktober', 'der Oktober', 'octubre', 'октябрь', 'ottobre', 'octobre'],
  ['mon.11', 'noun', 'time months', 'نوامبر', 'November', 'november', 'der November', 'noviembre', 'ноябрь', 'novembre', 'novembre'],
  ['mon.12', 'noun', 'time months', 'دسامبر', 'December', 'december', 'der Dezember', 'diciembre', 'декабрь', 'dicembre', 'décembre'],

  // --- when ----------------------------------------------------------------
  ['time.today', 'adverb', 'time', 'امروز', 'today', 'i dag', 'heute', 'hoy', 'сегодня', 'oggi', "aujourd'hui"],
  ['time.tomorrow', 'adverb', 'time', 'فردا', 'tomorrow', 'i morgon', 'morgen', 'mañana', 'завтра', 'domani', 'demain'],
  ['time.yesterday', 'adverb', 'time', 'دیروز', 'yesterday', 'i går', 'gestern', 'ayer', 'вчера', 'ieri', 'hier'],
  ['time.morning', 'noun', 'time', 'صبح', 'morning', 'en morgon', 'der Morgen', 'la mañana', 'утро', 'la mattina', 'le matin'],
  ['time.evening', 'noun', 'time', 'عصر', 'evening', 'en kväll', 'der Abend', 'la tarde', 'вечер', 'la sera', 'le soir'],
  ['time.night', 'noun', 'time', 'شب', 'night', 'en natt', 'die Nacht', 'la noche', 'ночь', 'la notte', 'la nuit'],
  ['time.week', 'noun', 'time', 'هفته', 'week', 'en vecka', 'die Woche', 'la semana', 'неделя', 'la settimana', 'la semaine'],
  ['time.weekend', 'noun', 'time', 'آخر هفته', 'weekend', 'en helg', 'das Wochenende', 'el fin de semana', 'выходные', 'il fine settimana', 'le week-end'],
  ['time.month', 'noun', 'time', 'ماه', 'month', 'en månad', 'der Monat', 'el mes', 'месяц', 'il mese', 'le mois'],
  ['time.year', 'noun', 'time', 'سال', 'year', 'ett år', 'das Jahr', 'el año', 'год', "l'anno", "l'année"],
  ['time.hour', 'noun', 'time', 'ساعت', 'hour', 'en timme', 'die Stunde', 'la hora', 'час', "l'ora", "l'heure"],
  ['time.minute', 'noun', 'time', 'دقیقه', 'minute', 'en minut', 'die Minute', 'el minuto', 'минута', 'il minuto', 'la minute'],
  ['time.now', 'adverb', 'time', 'حالا', 'now', 'nu', 'jetzt', 'ahora', 'сейчас', 'adesso', 'maintenant'],
  ['time.later', 'adverb', 'time', 'بعداً', 'later', 'senare', 'später', 'más tarde', 'позже', 'più tardi', 'plus tard'],

  // --- food ----------------------------------------------------------------
  ['food.water', 'noun', 'food', 'آب', 'water', 'vatten', 'das Wasser', 'el agua', 'вода', "l'acqua", "l'eau"],
  ['food.bread', 'noun', 'food', 'نان', 'bread', 'bröd', 'das Brot', 'el pan', 'хлеб', 'il pane', 'le pain'],
  ['food.milk', 'noun', 'food', 'شیر', 'milk', 'mjölk', 'die Milch', 'la leche', 'молоко', 'il latte', 'le lait'],
  ['food.coffee', 'noun', 'food', 'قهوه', 'coffee', 'kaffe', 'der Kaffee', 'el café', 'кофе', 'il caffè', 'le café'],
  ['food.tea', 'noun', 'food', 'چای', 'tea', 'te', 'der Tee', 'el té', 'чай', 'il tè', 'le thé'],
  ['food.egg', 'noun', 'food', 'تخم‌مرغ', 'egg', 'ett ägg', 'das Ei', 'el huevo', 'яйцо', "l'uovo", "l'œuf"],
  ['food.cheese', 'noun', 'food', 'پنیر', 'cheese', 'ost', 'der Käse', 'el queso', 'сыр', 'il formaggio', 'le fromage'],
  ['food.meat', 'noun', 'food', 'گوشت', 'meat', 'kött', 'das Fleisch', 'la carne', 'мясо', 'la carne', 'la viande'],
  ['food.fish', 'noun', 'food', 'ماهی', 'fish', 'en fisk', 'der Fisch', 'el pescado', 'рыба', 'il pesce', 'le poisson'],
  ['food.rice', 'noun', 'food', 'برنج', 'rice', 'ris', 'der Reis', 'el arroz', 'рис', 'il riso', 'le riz'],
  ['food.apple', 'noun', 'food', 'سیب', 'apple', 'ett äpple', 'der Apfel', 'la manzana', 'яблоко', 'la mela', 'la pomme'],
  ['food.potato', 'noun', 'food', 'سیب‌زمینی', 'potato', 'en potatis', 'die Kartoffel', 'la patata', 'картофель', 'la patata', 'la pomme de terre'],
  ['food.salt', 'noun', 'food', 'نمک', 'salt', 'salt', 'das Salz', 'la sal', 'соль', 'il sale', 'le sel'],
  ['food.sugar', 'noun', 'food', 'شکر', 'sugar', 'socker', 'der Zucker', 'el azúcar', 'сахар', 'lo zucchero', 'le sucre'],
  ['food.fruit', 'noun', 'food', 'میوه', 'fruit', 'en frukt', 'die Frucht', 'la fruta', 'фрукт', 'la frutta', 'le fruit'],
  ['food.vegetable', 'noun', 'food', 'سبزیجات', 'vegetable', 'en grönsak', 'das Gemüse', 'la verdura', 'овощ', 'la verdura', 'le légume'],

  // --- family and people ---------------------------------------------------
  ['fam.mother', 'noun', 'family', 'مادر', 'mother', 'en mamma', 'die Mutter', 'la madre', 'мать', 'la madre', 'la mère'],
  ['fam.father', 'noun', 'family', 'پدر', 'father', 'en pappa', 'der Vater', 'el padre', 'отец', 'il padre', 'le père'],
  ['fam.brother', 'noun', 'family', 'برادر', 'brother', 'en bror', 'der Bruder', 'el hermano', 'брат', 'il fratello', 'le frère'],
  ['fam.sister', 'noun', 'family', 'خواهر', 'sister', 'en syster', 'die Schwester', 'la hermana', 'сестра', 'la sorella', 'la sœur'],
  ['fam.son', 'noun', 'family', 'پسر', 'son', 'en son', 'der Sohn', 'el hijo', 'сын', 'il figlio', 'le fils'],
  ['fam.daughter', 'noun', 'family', 'دختر', 'daughter', 'en dotter', 'die Tochter', 'la hija', 'дочь', 'la figlia', 'la fille'],
  ['fam.child', 'noun', 'family', 'بچه', 'child', 'ett barn', 'das Kind', 'el niño', 'ребёнок', 'il bambino', "l'enfant"],
  ['fam.wife', 'noun', 'family', 'همسر', 'wife', 'en fru', 'die Ehefrau', 'la esposa', 'жена', 'la moglie', "l'épouse"],
  ['fam.husband', 'noun', 'family', 'شوهر', 'husband', 'en make', 'der Ehemann', 'el esposo', 'муж', 'il marito', 'le mari'],
  ['fam.friend', 'noun', 'family', 'دوست', 'friend', 'en vän', 'der Freund', 'el amigo', 'друг', "l'amico", "l'ami"],
  ['fam.grandmother', 'noun', 'family', 'مادربزرگ', 'grandmother', 'en mormor', 'die Großmutter', 'la abuela', 'бабушка', 'la nonna', 'la grand-mère'],
  ['fam.grandfather', 'noun', 'family', 'پدربزرگ', 'grandfather', 'en morfar', 'der Großvater', 'el abuelo', 'дедушка', 'il nonno', 'le grand-père'],
  ['fam.family', 'noun', 'family', 'خانواده', 'family', 'en familj', 'die Familie', 'la familia', 'семья', 'la famiglia', 'la famille'],
  ['fam.man', 'noun', 'family', 'مرد', 'man', 'en man', 'der Mann', 'el hombre', 'мужчина', "l'uomo", "l'homme"],
  ['fam.woman', 'noun', 'family', 'زن', 'woman', 'en kvinna', 'die Frau', 'la mujer', 'женщина', 'la donna', 'la femme'],
] as const

export const dailyPack: Pack = {
  id: 'daily',
  name: 'Everyday words',
  blurb: 'Numbers, colours, days, months, time, food and family — 100 words.',
  rows,
}
