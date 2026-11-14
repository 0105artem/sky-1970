/* Небо Елены: движок неба, сцены и натальное колесо.
   Данные планет посчитаны по Swiss Ephemeris (assets/data.js), здесь только отрисовка. */
(function () {
'use strict';

/* ================== НАСТРОЙКА ==================
   Время рождения по местному времени Коряжмы (UTC+3), например '07:30'.
   null — время неизвестно: асцендент и дома не показываются. */
var BIRTH_TIME = '22:00';

var S = window.SKY, RAD = Math.PI / 180, TAU = Math.PI * 2;
document.documentElement.classList.add('js');
var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- математика ---------- */
function n360(a) { a %= 360; return a < 0 ? a + 360 : a; }
function dAng(a, b) { return ((b - a + 540) % 360) - 180; }
function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
function lerp(a, b, t) { return a + (b - a) * t; }
function ease(u) { return u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; }
function ecl(lon, lat) { var l = lon * RAD, b = lat * RAD, c = Math.cos(b); return [c * Math.cos(l), c * Math.sin(l), Math.sin(b)]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function norm(a) { var l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
function mat2q(R, U, B) {
  var m00 = R[0], m01 = R[1], m02 = R[2], m10 = U[0], m11 = U[1], m12 = U[2], m20 = B[0], m21 = B[1], m22 = B[2], tr = m00 + m11 + m22, s;
  if (tr > 0) { s = Math.sqrt(tr + 1) * 2; return [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, s / 4]; }
  if (m00 > m11 && m00 > m22) { s = Math.sqrt(1 + m00 - m11 - m22) * 2; return [s / 4, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s]; }
  if (m11 > m22) { s = Math.sqrt(1 + m11 - m00 - m22) * 2; return [(m01 + m10) / s, s / 4, (m12 + m21) / s, (m02 - m20) / s]; }
  s = Math.sqrt(1 + m22 - m00 - m11) * 2; return [(m02 + m20) / s, (m12 + m21) / s, s / 4, (m10 - m01) / s];
}
function q2mat(q) {
  var x = q[0], y = q[1], z = q[2], w = q[3];
  return [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
          [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
          [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]];
}
function qdot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]; }
function slerp(a, b, t) {
  var d = qdot(a, b), s = 1, o;
  if (d < 0) { d = -d; s = -1; }
  if (d > 0.9995) { o = [a[0] + (s * b[0] - a[0]) * t, a[1] + (s * b[1] - a[1]) * t, a[2] + (s * b[2] - a[2]) * t, a[3] + (s * b[3] - a[3]) * t]; }
  else { var th = Math.acos(d), sn = Math.sin(th), wa = Math.sin((1 - t) * th) / sn, wb = Math.sin(t * th) / sn * s; o = [a[0] * wa + b[0] * wb, a[1] * wa + b[1] * wb, a[2] * wa + b[2] * wb, a[3] * wa + b[3] * wb]; }
  var l = Math.hypot(o[0], o[1], o[2], o[3]); return [o[0] / l, o[1] / l, o[2] / l, o[3] / l];
}

/* ---------- время рождения и позиции ---------- */
function parseTime(s) {
  if (!s) return null;
  var m = /^(\d{1,2})[:.](\d{2})$/.exec(String(s).trim()); if (!m) return null;
  var h = +m[1] + (+m[2]) / 60; return h >= 0 && h < 24 ? h : null;
}
var qsT = null; try { qsT = new URLSearchParams(location.search).get('t'); } catch (e) {}
var birthH = parseTime(qsT); if (birthH == null) birthH = parseTime(BIRTH_TIME);
var hasTime = birthH != null, tf = (hasTime ? birthH : 12) / 24;
var KEYS = S.keys, NB = KEYS.length, IDX = {}; KEYS.forEach(function (k, i) { IDX[k] = i; });
var P70 = S.p70a.map(function (a, i) { var b = S.p70b[i]; return [n360(a[0] + dAng(a[0], b[0]) * tf), a[1] + (b[1] - a[1]) * tf]; });
var P26 = S.p26;
var HS = hasTime ? window.ASTRO.houses(birthH) : null;
var ASCLON = HS ? HS.asc : 0;
var HOUSE_KEY = ['личность и то, какой Вас видят', 'ценности и ресурсы', 'общение, учеба, близкий круг', 'дом, семья, корни', 'творчество, радость, дети', 'труд и забота о себе', 'союзы и важные люди', 'глубокие перемены', 'путешествия, философия, знание', 'призвание и положение в обществе', 'друзья, единомышленники, мечты', 'уединение, интуиция, внутренний мир'];
function houseOf(lon) { if (!HS) return 0; for (var i = 0; i < 12; i++) { var a = HS.cusps[i], b = HS.cusps[(i + 1) % 12]; if (n360(lon - a) < n360(b - a)) return i + 1; } return 0; }

var SIGN = ['Овен', 'Телец', 'Близнецы', 'Рак', 'Лев', 'Дева', 'Весы', 'Скорпион', 'Стрелец', 'Козерог', 'Водолей', 'Рыбы'];
var SIGN_IN = ['Овне', 'Тельце', 'Близнецах', 'Раке', 'Льве', 'Деве', 'Весах', 'Скорпионе', 'Стрельце', 'Козероге', 'Водолее', 'Рыбах'];
var SIGN_OF = ['Овна', 'Тельца', 'Близнецов', 'Рака', 'Льва', 'Девы', 'Весов', 'Скорпиона', 'Стрельца', 'Козерога', 'Водолея', 'Рыб'];
var SIGN_G = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];
var VS = '︎';
function signOf(l) { return Math.floor(n360(l) / 30); }
function degStr(l) { l = n360(l) % 30; var d = Math.floor(l), m = Math.round((l - d) * 60); if (m === 60) { d++; m = 0; } return d + '°' + (m < 10 ? '0' : '') + m + '′'; }

var BODY = {
  sun: { n: 'Солнце', g: '☉', c: '#ffd98a', r: 6.5 }, moon: { n: 'Луна', g: '☽', c: '#f3efff', r: 5.5 },
  mercury: { n: 'Меркурий', g: '☿', c: '#e9dfcf', r: 2.8 }, venus: { n: 'Венера', g: '♀', c: '#fff1d6', r: 4.2 },
  mars: { n: 'Марс', g: '♂', c: '#ff9d80', r: 3.4 }, jupiter: { n: 'Юпитер', g: '♃', c: '#f6dfb0', r: 4.2 },
  saturn: { n: 'Сатурн', g: '♄', c: '#ecd49c', r: 3.4 }, uranus: { n: 'Уран', g: '♅', c: '#b5e4e6', r: 2.3 },
  neptune: { n: 'Нептун', g: '♆', c: '#a9bcff', r: 2.3 }, pluto: { n: 'Плутон', g: '♇', c: '#d9c3d4', r: 2.1 },
  node: { n: 'Лунный узел', g: '☊', c: '#e3c27a', r: 0 }
};
var RETRO = { venus: 1, saturn: 1 };
var ASPECTS = [['sun', 'venus'], ['sun', 'jupiter'], ['sun', 'saturn'], ['moon', 'mercury'], ['moon', 'neptune'], ['mercury', 'neptune'], ['mercury', 'pluto'], ['venus', 'jupiter'], ['venus', 'saturn'], ['mars', 'uranus'], ['jupiter', 'saturn'], ['neptune', 'pluto']];

var moonSign = signOf(P70[IDX.moon][0]);
var WINFO = {
  sun: 'Суть и воля. Глубина, интуиция и внутренняя сила, которая с годами только растет.',
  moon: moonSign === 1 ? 'Чувства и душа. Умение создавать уют, ценить красоту и простые радости.' : 'Чувства и душа. Живой ум, любопытство и радость от хорошего разговора.',
  mercury: 'Ум и слово. Широкий взгляд и умение видеть общую картину.',
  venus: 'Красота и ценности. Тонкое чутье на настоящее и преданность тем, кто дорог.',
  mars: 'Энергия и действие. Чувство справедливости и умение добиваться своего красиво.',
  jupiter: 'Удача и рост. Везение там, где нужно видеть суть и понимать людей.',
  saturn: 'Опора. Надежность, основательность и умение строить надолго.',
  uranus: 'Знак поколения, которое искало новую гармонию и справедливость.',
  neptune: 'Знак поколения: мечта о смысле и далеких горизонтах.',
  pluto: 'Знак поколения: сила преображать мир трудом и заботой.',
  node: 'Направление роста: делиться знаниями и своей глубиной с людьми.'
};
var PL_TIP = { sun: 'Суть и воля', moon: 'Чувства и душа', mercury: 'Ум и слово', venus: 'Красота и ценности', mars: 'Энергия и действие', jupiter: 'Удача и рост', saturn: 'Опора и основа', uranus: 'Свобода и новизна', neptune: 'Мечта и интуиция', pluto: 'Сила преображения', node: 'Направление роста' };
var SIGN_KEY = ['Смелость и начало', 'Устойчивость и красота', 'Ум и общение', 'Дом и забота', 'Щедрость и творчество', 'Порядок и мастерство', 'Гармония и вкус', 'Глубина и сила', 'Смысл и горизонты', 'Цель и основательность', 'Свобода и идеи', 'Интуиция и сострадание'];
var ELEM = ['огонь', 'земля', 'воздух', 'вода'];
var MODE = ['кардинальный', 'фиксированный', 'мутабельный'];
var RULER = ['Марс', 'Венера', 'Меркурий', 'Луна', 'Солнце', 'Меркурий', 'Венера', 'Плутон, а в старой традиции Марс', 'Юпитер', 'Сатурн', 'Уран, а в старой традиции Сатурн', 'Нептун, а в старой традиции Юпитер'];
var SIGN_ESS = ['Начало круга: энергия первого шага, смелость и прямота.', 'Устойчивость, чувство красоты и вкус к настоящему.', 'Живой ум, слово, обмен идеями.', 'Дом, память, забота о своих.', 'Щедрость, творчество, радость быть собой.', 'Мастерство, точность, польза в каждом деле.', 'Равновесие, вкус, искусство отношений и договоров.', 'Глубина, сила чувств, способность к преображению.', 'Поиск смысла, широта взгляда, дальние дороги.', 'Цель, выдержка, умение строить надолго.', 'Свобода мысли, дружба, идеи, опережающие время.', 'Интуиция, сострадание, воображение.'];
var SIGN_MYTH = ['Златорунный баран, спасший Фрикса и Геллу. За его руном плавали аргонавты.', 'Зевс, принявший облик белого быка, чтобы похитить Европу.', 'Братья Кастор и Поллукс: бессмертный разделил свое бессмертие со смертным.', 'Краб, которого Гера послала против Геракла и в благодарность подняла на небо.', 'Немейский лев, первый подвиг Геракла.', 'Астрея, богиня справедливости, последней из бессмертных покинувшая землю. В руке у нее колос, звезда Спика.', 'Весы Астреи. У греков на этом месте были клешни Скорпиона, отдельным знаком Весы сделали римляне.', 'Скорпион, победивший охотника Ориона. С тех пор они не встречаются на небе: когда восходит Скорпион, Орион заходит.', 'Кентавр с луком. По одной из версий, это мудрый Хирон, учитель героев.', 'Козерог с рыбьим хвостом: бог Пан, нырнувший в Нил, спасаясь от Тифона.', 'Ганимед, прекраснейший из юношей, ставший виночерпием богов.', 'Афродита и Эрот, обернувшиеся рыбами и связавшие себя лентой, чтобы не потеряться.'];
var PDET = {
  sun: { b: [['Что это', 'Солнце в карте: ядро личности, воля, цель и то, что дает ощущение смысла.'], ['В Скорпионе', 'Знак неподвижной воды: глубина, проницательность, умение идти до сути. У древних у знака было три символа: скорпион, змея и орел, три ступени одной силы.'], ['В Вашей карте', 'Солнце стоит рядом с Юпитером и Венерой. Соединение Солнца с Юпитером традиция считает одним из самых счастливых: широта души, великодушие, вера в свои силы.']], f: ['три символа Скорпиона', 'соединение Солнца и Юпитера', 'соляр'] },
  moon: { b: [['Что это', 'Луна: внутренний мир, чувства, привычки, то, что дает покой и силы.'], moonSign === 1 ? ['В Тельце', 'Здесь Луна, по традиции, в экзальтации, самом сильном своем положении: устойчивость, чувство красоты, умение создавать уют.'] : ['В Близнецах', 'Чувства живут через слово и мысль: любознательность, легкость, вкус к новому. Таким людям важно, чтобы было с кем поговорить и о чем подумать.'], ['В Вашей карте', 'Вы родились сразу после полнолуния: в тот вечер почти полная Луна стояла высоко над Коряжмой, неподалеку от Плеяд. Рожденным под полной Луной приписывают яркие чувства и умение видеть обе стороны любого вопроса.']], f: ['рожденные в полнолуние', 'Плеяды в мифах'] },
  mercury: { b: [['Что это', 'Меркурий: ум, речь и способ учиться.'], ['В Стрельце', 'Мышление крупными мазками: интерес к смыслам, философии, дальним странам. Старые книги считали, что Меркурию здесь тесно в мелочах; современные авторы видят дар обобщать и вдохновлять словом.'], ['В Вашей карте', 'Меркурий стоит рядом с Нептуном. Такое соединение связывают с образным мышлением, интуицией и чуткостью к символам.']], f: ['Меркурий в Стрельце', 'соединение Меркурия и Нептуна'] },
  venus: { b: [['Что это', 'Венера: то, что мы любим и ценим. Красота, вкус, радость.'], ['В Скорпионе', 'Вкус к подлинному и нелюбовь к поверхностному. Одни авторы пишут о магнетизме, другие о редкой верности своим ценностям.'], ['В Вашей карте', 'Венера ретроградна: так бывает примерно у семи человек из ста. Это читают как собственное, ни на чье не похожее чувство красоты. А рядом стоит Юпитер: эту пару издавна называли малым и большим счастьем.']], f: ['ретроградная Венера в карте', 'малое и большое счастье'] },
  mars: { b: [['Что это', 'Марс: энергия, решимость, способ добиваться своего.'], ['В Весах', 'Сила, направленная на справедливость и равновесие. Классики говорили, что Марс здесь учится дипломатии; современные авторы называют это стратегическим умом и даром вести переговоры.'], ['В Вашей карте', 'Марс стоит рядом с Ураном: самостоятельность, смелость решений, изобретательность.']], f: ['Марс в Весах', 'соединение Марса и Урана'] },
  jupiter: { b: [['Что это', 'Юпитер: рост, удача, щедрость и мировоззрение.'], ['В Скорпионе', 'Тяга к глубокому знанию: психологии, тайнам, всему, что скрыто от беглого взгляда. Удача приходит там, где нужно видеть суть.'], ['В Вашей карте', 'Юпитер стоит рядом с Солнцем и Венерой; три планеты в одном знаке называют стеллиумом. Раз в 12 лет Юпитер возвращается на свое место, и эти годы считают временем роста. Ваше следующее возвращение: декабрь 2029 года.']], f: ['стеллиум в Скорпионе', 'возвращение Юпитера'] },
  saturn: { b: [['Что это', 'Сатурн: время, опора и мастерство. То, что строится годами.'], ['В Тельце', 'Основательность и терпение: умение создавать прочное и ценить настоящее.'], ['В Вашей карте', 'Сатурн обходит круг за 29 с половиной лет и в 2029 году вернется в Вашу точку. Одни астрологи называют такие годы временем итогов, другие временем зрелых плодов.']], f: ['возвращение Сатурна', 'Сатурн в Тельце'] },
  uranus: { b: [['Что это', 'Уран: свобода, новизна, неожиданные повороты. В знаке он проводит семь лет, поэтому это знак поколения.'], ['В Весах', 'Уран шел по Весам с 1968 по 1975 год: поколение, которое по-новому взглянуло на равенство и справедливость.'], ['В Вашей карте', 'У Вас Уран стоит рядом с Марсом, и общее качество поколения становится личным: независимость и смелость.']], f: ['Уран в Весах, поколение'] },
  neptune: { b: [['Что это', 'Нептун: мечта, интуиция, вдохновение. По одному знаку он идет около 14 лет.'], ['В Стрельце', 'Поколение искателей смысла и дальних горизонтов.'], ['В Вашей карте', 'Нептун вошел в Стрелец всего за неделю до Вашего рождения и стоит в самом начале знака, рядом с Меркурием. Начало знака называют его самой чистой, свежей нотой.']], f: ['Нептун в Стрельце', 'соединение Меркурия и Нептуна'] },
  pluto: { b: [['Что это', 'Плутон: сила преображения. В одном знаке он проводит от 12 до 30 лет.'], ['В Деве', 'Плутон шел по Деве с 1957 по 1972 год: поколение, изменившее труд, медицину и технологии.'], ['В Вашей карте', 'Плутон стоит на последнем градусе Девы. Его называют градусом завершения: качества знака в самой зрелой форме.']], f: ['Плутон в Деве, поколение'] },
  node: { b: [['Что это', 'Лунные узлы не планеты, а две точки, где путь Луны пересекает путь Солнца. Именно возле узлов случаются затмения.'], ['В Водолее', 'Северный узел показывает направление роста. В Водолее это путь к людям и идеям: делиться знанием, быть среди единомышленников.']], f: ['лунные узлы', 'ось Лев и Водолей', 'сарос'] }
};
var STAR_DET = {
  'Антарес': { b: [['Что это', 'Красный сверхгигант в 550 световых годах от нас. На месте Солнца он занял бы все пространство до орбиты Марса и дальше.'], ['Имя', '«Антарес» значит «соперник Ареса», то есть Марса: за такой же красный цвет.'], ['В традиции', 'Одна из четырех царских звезд древней Персии, «стражей неба». Остальные три: Альдебаран, Регул и Фомальгаут.']], f: ['царские звезды Персии'] },
  'Регул': { b: [['Что это', 'Самая яркая звезда Льва, в 79 световых годах от нас. Лежит почти точно на пути Солнца.'], ['Имя', '«Регул» по-латыни «маленький царь». Это имя звезде дал Коперник.'], ['В традиции', 'Одна из четырех царских звезд. 14 ноября 2026 года рядом с ней стоят Марс и Юпитер.']], f: ['царские звезды Персии'] },
  'Спика': { b: [['Что это', 'Самая яркая звезда Девы, голубой гигант в 250 световых годах.'], ['Имя', '«Спика» значит «колос»: его держит в руке небесная Дева.'], ['В истории', 'Наблюдая Спику, грек Гиппарх во II веке до нашей эры открыл прецессию: то самое медленное смещение звезд относительно знаков.']], f: ['Гиппарх и прецессия'] },
  'Альдебаран': { b: [['Что это', 'Оранжевый гигант, «глаз» небесного Тельца, в 65 световых годах.'], ['Имя', 'По-арабски «идущий следом»: он восходит вслед за Плеядами.'], ['В традиции', 'Одна из четырех царских звезд древней Персии.']], f: ['царские звезды Персии'] },
  'Плеяды': { b: [['Что это', 'Скопление молодых голубых звезд в 440 световых годах. Глазом видно шесть или семь, в телескоп больше тысячи.'], ['Имена', 'У греков это семь сестер, дочери Атланта. На Руси их звали Стожарами, в Японии зовут Субару.'], ['В Вашей карте', 'В вечер Вашего рождения неподалеку от Плеяд светила почти полная Луна.']], f: ['Плеяды в мифах', 'Стожары'] }
};
var ZOD_DET = { e: 'Как читать небо', t: 'Знаки и созвездия', b: [['Лента', 'Зодиак: пояс неба, по которому движутся Солнце, Луна и планеты. Астрология делит его на двенадцать равных знаков по 30° и ведет отсчет от точки весеннего равноденствия.'], ['Смещение', 'Земная ось медленно описывает круг за 26 тысяч лет, и звезды смещаются относительно знаков на один градус за 72 года. Это явление, прецессию, открыл Гиппарх во II веке до нашей эры.'], ['Что из этого следует', 'Две тысячи лет назад знаки и созвездия совпадали, сегодня созвездия ушли почти на целый знак. Западная астрология считает по знакам, то есть по временам года; индийская, джйотиш, по звездам. Поэтому Марс в знаке Весов на небе стоит среди звезд Девы, и ошибки здесь нет.'], ['Эра Водолея', 'Точка весеннего равноденствия сама идет по созвездиям: сейчас она в Рыбах и приближается к Водолею. Отсюда и выражение «эра Водолея».']], f: ['прецессия равноденствий', 'тропический и сидерический зодиак', 'эра Водолея'] };
var PARADE_DET = { e: '14 ноября 2026', t: 'Парад планет', b: [['Что это', 'Парадом планет называют дни, когда несколько планет видны в одной части неба. Сами по себе такие дни бывают несколько раз в год.'], ['Чем особенен сегодняшний', 'Именно 14 ноября Меркурий, Венера, Марс и Юпитер собираются вместе редко: за последние полвека так было в 1984 и 1997 годах и сегодня.'], ['Марс и Юпитер', 'Сегодня между ними меньше полутора градусов, это три диаметра полной Луны. В Ваш день рождения так близко они стояли только в 1995 году, а в следующий раз сойдутся в 2080-м. Рядом с ними горит Регул, сердце Льва.']], f: ['соединение Марса и Юпитера', 'Регул, царская звезда'] };
function natalRows(list) { return '<div class="rows">' + list.map(function (k) { return '<div><i>' + BODY[k].g + VS + '</i><b>' + BODY[k].n + '</b><span>' + PL_TIP[k].toLowerCase() + '</span></div>'; }).join('') + '</div>'; }
function detail(key) {
  var t = key.split(':'), k = t[1], d;
  if (key === 'zodiac') return ZOD_DET;
  if (key === 'parade') return PARADE_DET;
  if (key === 'asc' && HS) { var as = signOf(HS.asc), ab = [['Что это', 'Асцендент: точка зодиака, которая в минуту рождения восходит на востоке. Знак на восходе сменяется примерно каждые два часа, поэтому для асцендента нужно точное время.'], [(as === 4 ? 'Во ' : 'В ') + SIGN_IN[as], ASC_TEXT[as] + (as === 4 ? ' Людей с восходящим Львом описывают как тех, кто умеет быть в центре внимания, не стараясь: тепло, достоинство, щедрый жест.' : '')]];
    if (as === 4) ab.push(['В Вашей карте', 'Управитель Льва, Солнце, стоит у Вас в Скорпионе рядом с Юпитером и Венерой: яркость Льва опирается на глубину Скорпиона. Само созвездие Льва в ту минуту только показывалось из-за горизонта.']);
    ab.push(['Середина неба', 'Вторая важная точка, высшая точка зодиака в минуту рождения: ' + degStr(HS.mc) + ' ' + SIGN_OF[signOf(HS.mc)] + '. Ее связывают с призванием. ' + SIGN_ESS[signOf(HS.mc)]]);
    return { e: degStr(HS.asc) + ' ' + SIGN_OF[as], t: 'Асцендент ' + (as === 4 ? 'во ' : 'в ') + SIGN_IN[as], g: SIGN_G[as], b: ab, f: ['асцендент ' + (as === 4 ? 'во ' : 'в ') + SIGN_IN[as], 'управитель асцендента', 'середина неба в ' + SIGN_IN[signOf(HS.mc)]] }; }
  if (t[0] === 'p' && PDET[k]) { var lon = P70[IDX[k]][0], sg = signOf(lon); var hb = PDET[k].b.slice(), hn = houseOf(lon); if (hn) hb.push(['В ' + hn + ' доме', 'Дома показывают, в какой сфере жизни планета проявляется ярче всего. ' + hn + ' дом: ' + HOUSE_KEY[hn - 1] + '.']); return { e: degStr(lon) + ' ' + SIGN_OF[sg] + (hn ? ' · ' + hn + ' дом' : ''), t: BODY[k].n + ' в ' + SIGN_IN[sg], g: BODY[k].g, b: hb, f: PDET[k].f }; }
  if (t[0] === 's') { var i = +k, np = natalIn(i); d = { e: 'Знак зодиака', t: SIGN[i], g: SIGN_G[i], b: [['Знак', 'Стихия: ' + ELEM[i % 4] + '. Крест: ' + MODE[i % 3] + '. Управитель: ' + RULER[i] + '.'], ['Суть', SIGN_ESS[i]], ['Миф', SIGN_MYTH[i]]], f: ['миф о созвездии ' + SIGN_OF[i], MODE[i % 3] + ' крест'] }; if (np.length) d.b.push(['В Вашей карте', natalRows(np)]); return d; }
  if (t[0] === 'st' && STAR_DET[k]) return { e: STAR_KIND[k] || 'Звезда', t: k, b: STAR_DET[k].b, f: STAR_DET[k].f };
  return null;
}
var ASC_TEXT = [
  'Вас видят энергичной и прямой: Вы входите, и дело сдвигается с места.',
  'Первое впечатление: спокойствие и надежность. Рядом с Вами людям становится устойчивее.',
  'Живая, быстрая, интересная собеседница: с Вами легко заговорить и трудно закончить разговор.',
  'От Вас веет теплом и заботой. Люди чувствуют: здесь их поймут.',
  'Вас замечают сразу: достоинство, щедрость и умение держаться.',
  'Собранность, вкус к деталям и точное слово: так Вас видят с первой встречи.',
  'Обаяние, такт и чувство меры: Вы умеете расположить к себе любого.',
  'Сильный взгляд и магнетизм: Вас запоминают с первой встречи.',
  'Открытость, оптимизм и широта: рядом с Вами хочется думать о большом.',
  'Достоинство и основательность: Вам доверяют серьезное.',
  'Оригинальность и независимый ум: Вы не похожи ни на кого.',
  'Мягкость, чуткость и загадка: к Вам тянутся за пониманием.'
];

/* ---------- перемотка времени 2026 → 1970 ---------- */
var UNW = {};
['sun', 'mercury', 'venus', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'node'].forEach(function (k) {
  var i = IDX[k], a = [S.year[0][i][0]];
  for (var y = 1; y < S.year.length; y++) a.push(a[y - 1] + dAng(S.year[y - 1][i][0], S.year[y][i][0]));
  UNW[k] = a;
});
var NY = S.year.length - 1;
var POS = KEYS.map(function () { return [0, 0]; });
function posAt(T) {
  var y = NY * (1 - T), i0 = Math.min(NY - 1, Math.floor(y)), f = y - i0;
  for (var b = 0; b < NB; b++) {
    var k = KEYS[b], u = UNW[k], lon, lat;
    if (u) {
      lon = u[i0] + (u[i0 + 1] - u[i0]) * f + dAng(S.year[NY][b][0], P26[b][0]) * (1 - T) + dAng(S.year[0][b][0], P70[b][0]) * T;
      lat = S.year[i0][b][1] + (S.year[i0 + 1][b][1] - S.year[i0][b][1]) * f + (P26[b][1] - S.year[NY][b][1]) * (1 - T) + (P70[b][1] - S.year[0][b][1]) * T;
    } else {
      lon = P26[b][0] + dAng(P26[b][0], P70[b][0]) * T; lat = P26[b][1] + (P70[b][1] - P26[b][1]) * T;
    }
    POS[b][0] = lon; POS[b][1] = lat;
  }
}

/* ---------- подготовка каталога ---------- */
var NS = S.stars.length / 4, SX = new Float32Array(NS), SY = new Float32Array(NS), SZ = new Float32Array(NS), SM = new Float32Array(NS), SC8 = new Uint8Array(NS), SPH = new Float32Array(NS), SW = new Float32Array(NS);
(function () {
  for (var i = 0; i < NS; i++) {
    var v = ecl(S.stars[i * 4] / 100, S.stars[i * 4 + 1] / 100);
    SX[i] = v[0]; SY[i] = v[1]; SZ[i] = v[2]; SM[i] = S.stars[i * 4 + 2] / 10; SC8[i] = S.stars[i * 4 + 3];
    SPH[i] = Math.random() * TAU; SW[i] = 0.9 + Math.random() * 2.6;
  }
})();
var SCOL = ['#bfd2ff', '#eef1ff', '#fff5e2', '#ffdfb4', '#ffc8a0'];
var CONS = {}; Object.keys(S.cons).forEach(function (id) { CONS[id] = S.cons[id].map(function (line) { return line.map(function (p) { return ecl(p[0], p[1]); }); }); });
var MW = S.mw.map(function (p) { return { v: ecl(p[0], p[1]), w: [0, .035, .06, .085, .11, .13][p[2]] }; });
var NAMED = {}; Object.keys(S.names).forEach(function (n) { NAMED[n] = ecl(S.names[n][0], S.names[n][1]); });
if (HS) { S.names['Асцендент'] = [HS.asc, 0]; NAMED['Асцендент'] = ecl(HS.asc, 0); }
NAMED['созвездие Скорпиона'] = ecl(258, -25.5); NAMED['знак Скорпиона'] = ecl(225, 16.8); NAMED['Млечный Путь'] = ecl(271, -2);
var HZ = S.hor.z, HN = S.hor.n, HE = S.hor.e;
function horVec(az, alt) { var a = az * RAD, h = alt * RAD, c = Math.cos(h), cn = c * Math.cos(a), ce = c * Math.sin(a), sz = Math.sin(h); return [cn * HN[0] + ce * HE[0] + sz * HZ[0], cn * HN[1] + ce * HE[1] + sz * HZ[1], cn * HN[2] + ce * HE[2] + sz * HZ[2]]; }

/* ---------- сцены ---------- */
var CALM = { ecl: [300, 38], span: 120, spanD: 120, spin: .5, center: true };
var SC = {
  hero:    { cam: { hor: [128, 72], span: 110, spanD: 120, center: true }, T: 0, cons: .1, planets: .45 },
  parade:  { cam: { hor: [151, 23], span: 78, spanD: 96, fy: .52 }, T: 0, ground: 1, ecl: .4, cons: .12, seq: [['mercury', 1.5], ['venus', 2.1], ['mars', 2.7], ['jupiter', 3.3]], np: { mercury: [12, 4, 'left'], venus: [12, 4, 'left'], mars: [-11, -7, 'right'], jupiter: [12, 2, 'left'] }, stars: ['Регул'], sl: { 'Регул': [-14, 26, 'right'] } },
  sunret:  { cam: { ecl: [224, 3], span: 64, spanD: 76 }, T: 0, ecl: .6, rib: .55, cons: .14, names: ['mercury', 'venus'], seq: [['sun', 1.0]], sign: 7 },
  zodiac:  { cam: { ecl: [241, -5], span: 62, spanD: 74, fy: .3 }, T: 0, ecl: .6, rib: .7, cons: .12, hlCons: 'Sco', sign: 7, stars: ['знак Скорпиона', 'созвездие Скорпиона'] },
  rewind:  { cam: { ecl: [211, -2], span: 88, spanD: 104 }, T: 1, ecl: .6, rib: .5, cons: .12, glyphs: 'all', afterT: true },
  gather:  { cam: { ecl: [211, -2], span: 88, spanD: 104 }, T: 1, ecl: .6, rib: .5, cons: .12, glyphs: 'all', noNames: true, seq: [['pluto', .7], ['uranus', .85], ['mars', 1], ['venus', 1.15], ['jupiter', 1.3], ['sun', 1.45], ['neptune', 1.6], ['mercury', 1.75]] },
  stellium:{ cam: { ecl: [240, -7], span: 58, spanD: 70 }, T: 1, ecl: .6, rib: .55, cons: .12, hlCons: 'Sco', glyphs: 'all', seq: [['sun', 1.2], ['venus', 1.7], ['jupiter', 2.2]], np: { jupiter: [10, -15, 'left'], venus: [12, 5, 'left'] }, sign: 7, stars: ['Антарес', 'созвездие Скорпиона'], sl: { 'Антарес': [-62, -2, 'right'] } },
  sun:     { cam: { ecl: [234, -3.5], span: 38, spanD: 46 }, T: 1, ecl: .6, rib: .45, cons: .1, glyphs: 'all', hl: ['sun'], sign: 7, hlCons: 'Sco' },
  venus:   { cam: { ecl: [232.5, -4.5], span: 36, spanD: 44 }, T: 1, ecl: .6, rib: .45, cons: .1, glyphs: 'all', hl: ['venus'], sign: 7, hlCons: 'Sco' },
  jupiter: { cam: { ecl: [233.5, -2.5], span: 36, spanD: 44 }, T: 1, ecl: .6, rib: .45, cons: .1, glyphs: 'all', hl: ['jupiter'], sign: 7, hlCons: 'Sco' },
  mercury: { cam: { ecl: [251, -4], span: 46, spanD: 54 }, T: 1, ecl: .6, rib: .45, cons: .1, glyphs: 'all', hl: ['mercury'], names: ['neptune'], np: { mercury: [-12, 4, 'right'] }, sign: 8, hlCons: 'Sgr' },
  mars:    { cam: { ecl: [207, -1], span: 50, spanD: 58 }, T: 1, ecl: .6, rib: .45, cons: .14, glyphs: 'all', hl: ['mars'], names: ['uranus'], sign: 6, hlCons: 'Lib', stars: ['Спика'] },
  moon:    { cam: { ecl: [63, 0], span: 58, spanD: 66 }, T: 1, ecl: .6, rib: .4, cons: .14, glyphs: 'all', hl: ['moon'], sign: moonSign, hlCons: moonSign === 1 ? 'Tau' : 'Gem', stars: ['Плеяды', 'Альдебаран'] },
  saturn:  { cam: { ecl: [58, -2], span: 52, spanD: 60 }, T: 1, ecl: .6, rib: .45, cons: .14, glyphs: 'all', hl: ['saturn'], sign: 1, hlCons: 'Tau', stars: ['Плеяды'] },
  wheel:   { cam: { wheel: true }, T: 1, wheel: 1, ecl: 1, rib: 1, cons: 0, dim: .16, mw: 0, glyphs: 'all' },
  asc:     { cam: { hor: [82, 20], hb: 'k', span: 86, spanD: 100 }, T: 1, ground: .62, ecl: .7, rib: .55, cons: .14, glyphs: 'all', hlCons: 'Leo', sign: HS ? signOf(HS.asc) : 4, stars: ['Асцендент'], sl: { 'Асцендент': [14, -14, 'left'] } },
  n6:      { cam: CALM, T: 1, cons: .05, dim: .4, planets: 0, part: '6' },
  n1:      { cam: CALM, T: 1, cons: .05, dim: .4, planets: 0, part: '1' },
  n33:     { cam: CALM, T: 1, cons: .05, dim: .4, planets: 0, part: '33', rose: true },
  n4:      { cam: CALM, T: 1, cons: .05, dim: .4, planets: 0, part: '4' },
  square:  { cam: CALM, T: 1, cons: .05, dim: .3, planets: 0 },
  year:    { cam: CALM, T: 1, cons: .05, dim: .4, planets: 0, part: '8', then: 'inf' },
  wish:    { cam: { ecl: [320, 30], span: 120, spanD: 120, spin: .4, center: true }, T: 1, cons: .08, dim: .7, planets: 0 }
};

SC.moon.cam.ecl[0] = P70[IDX.moon][0] + (moonSign === 1 ? 4 : 13);

/* ---------- DOM ---------- */
var cv = document.getElementById('sky'), ctx = cv.getContext('2d');
var prog = document.getElementById('prog'), yearEl = document.getElementById('year');
var ascTop = 600, paradeTop = 600, wheelTop = 300, W = 0, H = 0, DPR = 1, maxDPR = Math.min(window.devicePixelRatio || 1, 2), portrait = true, refW = 0, FX = .5, FY = .36;

(function hero() {
  var h = document.getElementById('heroName');
  h.innerHTML = Array.prototype.map.call(h.textContent, function (c, i) { return '<span style="animation-delay:' + (.3 + i * .14) + 's">' + c + '</span>'; }).join('');
})();

(function texts() {
  if (moonSign === 1) {
    document.getElementById('moonTitle').innerHTML = 'Луна <em>в&nbsp;Тельце</em>';
    document.getElementById('moonText').innerHTML = 'В&nbsp;тот день Луна была почти полной и&nbsp;стояла рядом с&nbsp;Плеядами. Душе нужны покой, красота и&nbsp;надежность. Вы умеете создавать уют, и&nbsp;рядом с&nbsp;Вами тепло.';
  }
  if (HS) {
    var s = signOf(HS.asc);
    document.getElementById('ascScene').hidden = false;
    document.getElementById('ascTitle').innerHTML = 'Асцендент <em>' + (s === 4 ? 'во' : 'в') + '&nbsp;' + SIGN_IN[s] + '</em>';
    document.getElementById('ascEyebrow').textContent = 'Каким Вас видит мир · ' + degStr(HS.asc) + ' ' + SIGN_OF[s];
    document.getElementById('ascText').textContent = 'В минуту Вашего рождения над восточным горизонтом Коряжмы поднимался знак ' + SIGN_OF[s] + '. Восходящий знак называют асцендентом. ' + ASC_TEXT[s];
  }
  var sq = document.getElementById('square');
  var PSY = [[1, 4, 'Характер'], [4, 3, 'Здоровье'], [7, 1, 'Удача'], [2, 3, 'Энергия'], [5, 0, ''], [8, 0, ''], [3, 0, ''], [6, 1, 'Труд'], [9, 1, 'Память']];
  sq.innerHTML = PSY.map(function (p) {
    var d = p[0], c = p[1], dg = '';
    for (var i = 0; i < c; i++) dg += '<i style="transition-delay:' + (.3 + d * .09 + i * .1).toFixed(2) + 's">' + d + '</i>';
    return '<div class="cell' + (c >= 3 ? ' strong' : c ? '' : ' quiet') + '"><div class="dg">' + (c ? dg : '·') + '</div>' + (p[2] ? '<div class="lb">' + p[2] + '</div>' : '') + '</div>';
  }).join('');
})();

/* ---------- колесо: выбор планеты ---------- */
var sel = null, selCons = null, hits = [], shits = [], lhits = [];
var wE = document.getElementById('wEyebrow'), wT = document.getElementById('wTitle'), wP = document.getElementById('wText'), chipsEl = document.getElementById('chips');
var wDef = { e: wE.textContent, t: wT.innerHTML, p: wP.innerHTML + (HS ? ' Слева на&nbsp;круге отмечен асцендент.' : '') };
wP.innerHTML = wDef.p;
KEYS.forEach(function (k) {
  var b = document.createElement('button'); b.className = 'chip'; b.type = 'button'; b.id = 'chip-' + k;
  b.textContent = BODY[k].g + VS; b.setAttribute('aria-label', BODY[k].n); b.setAttribute('aria-pressed', 'false');
  b.addEventListener('click', function () { select(sel === k ? null : k); });
  chipsEl.appendChild(b);
});
['sun', 'venus', 'jupiter', 'mercury', 'mars', 'moon', 'saturn'].forEach(function (k) { var c = document.querySelector('[data-s=' + k + '] .card'); if (c) c.insertAdjacentHTML('beforeend', '<button type="button" class="more" data-more="p:' + k + '">Подробнее</button>'); });
['zodiac', 'parade', 'asc'].forEach(function (k) { var c = document.querySelector('[data-s=' + k + '] .card'); if (c) c.insertAdjacentHTML('beforeend', '<button type="button" class="more" data-more="' + k + '">Подробнее</button>'); });
var wMore = document.getElementById('wMore');
function select(k) {
  sel = k; wMore.hidden = !k; if (k) wMore.setAttribute('data-more', 'p:' + k);
  KEYS.forEach(function (x) { document.getElementById('chip-' + x).setAttribute('aria-pressed', x === k ? 'true' : 'false'); });
  if (!k) { wE.textContent = wDef.e; wT.innerHTML = wDef.t; wP.innerHTML = wDef.p; return; }
  var lon = P70[IDX[k]][0], s = signOf(lon);
  wE.textContent = degStr(lon) + ' ' + SIGN_OF[s] + (HS ? ' · ' + houseOf(lon) + ' дом' : '');
  wT.innerHTML = BODY[k].n + ' <em>в&nbsp;' + SIGN_IN[s] + '</em>';
  wP.textContent = WINFO[k];
  var c = document.getElementById('chip-' + k); if (c.scrollIntoView && portrait) c.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduce ? 'auto' : 'smooth' });
}
var tipEl = document.getElementById('tip'), tipT = 0, dragMoved = false, ptrs = {}, pinch0 = 0, zoom0 = 1, pinching = false;
function hideTip() { clearTimeout(tipT); tipEl.classList.remove('show'); }
function showTip(x, y, o) {
  var h = '<div class="tip-e">' + o.e + '</div><div class="tip-t">' + (o.g ? '<span class="tip-g">' + o.g + VS + '</span>' : '') + o.t + '</div>';
  if (o.k) h += '<div class="tip-k">' + o.k + '</div>';
  if (o.d) h += '<div class="tip-d">' + o.d + '</div>';
  if (o.list && o.list.length) h += '<div class="tip-l"><span>В Вашей карте здесь</span>' + natalRows(o.list) + '</div>';
  if (o.more) h += '<button type="button" class="more" data-more="' + o.more + '">Подробнее</button>';
  tipEl.innerHTML = h; tipEl.classList.remove('below', 'side');
  var w = tipEl.offsetWidth, hh = tipEl.offsetHeight, av = o.avoid ? consBox(o.avoid) : null, best = null, bs = 1e12;
  var cs = [[x - w / 2, y - hh - 22, ''], [x - w / 2, y + 24, 'below'], [x + 28, y - hh / 2, 'side'], [x - w - 28, y - hh / 2, 'side']];
  if (av) cs.push([av.x1 + 14, y - hh / 2, 'side'], [av.x0 - w - 14, y - hh / 2, 'side'], [x - w / 2, av.y0 - hh - 14, 'side'], [x - w / 2, av.y1 + 14, 'side'], [av.x1 + 14, av.y0, 'side'], [av.x0 - w - 14, av.y0, 'side']);
  for (var i = 0; i < cs.length; i++) {
    var l = clamp(cs[i][0], 10, Math.max(10, W - w - 10)), t = clamp(cs[i][1], 10, Math.max(10, H - hh - 10)), sc = Math.hypot(l + w / 2 - x, t + hh / 2 - y) * .6 + i;
    if (x > l - 6 && x < l + w + 6 && y > t - 6 && y < t + hh + 6) sc += 4e5;
    if (av) sc += Math.max(0, Math.min(l + w, av.x1) - Math.max(l, av.x0)) * Math.max(0, Math.min(t + hh, av.y1) - Math.max(t, av.y0)) * 8;
    if (Math.abs(l - cs[i][0]) > 1 || Math.abs(t - cs[i][1]) > 1) { sc += 60; if (cs[i][2] !== 'side') cs[i][2] = 'side'; }
    if (sc < bs) { bs = sc; best = [l, t, cs[i][2]]; }
  }
  if (best[2]) tipEl.classList.add(best[2]);
  tipEl.style.left = best[0] + 'px'; tipEl.style.top = best[1] + 'px'; tipEl.style.setProperty('--ax', clamp(x - best[0], 18, w - 18) + 'px');
  tipEl.classList.add('show'); clearTimeout(tipT); tipT = setTimeout(hideTip, 60000);
}
function consBox(id) {
  var L = CONS[id]; if (!L) return null;
  var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, n = 0;
  for (var i = 0; i < L.length; i++) for (var j = 0; j < L[i].length; j++) { var p = proj(L[i][j]); if (!p.ok || p.z < -.3) continue; n++; if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y; }
  if (!n) return null;
  x0 = Math.max(0, x0 - 22); y0 = Math.max(0, y0 - 22); x1 = Math.min(W, x1 + 22); y1 = Math.min(H, y1 + 22);
  return x1 > x0 && y1 > y0 ? { x0: x0, y0: y0, x1: x1, y1: y1 } : null;
}
var sheetEl = document.getElementById('sheet'), sheetIn = sheetEl.querySelector('.sh-in'), sheetOpen = false;
function openSheet(key) {
  var d = detail(key); if (!d) return;
  var h = '<div class="tip-e">' + d.e + '</div><h3>' + (d.g ? '<span class="tip-g">' + d.g + VS + '</span>' : '') + d.t + '</h3>';
  d.b.forEach(function (b) { h += '<div class="sh-b"><div class="sh-l">' + b[0] + '</div>' + (b[1].charAt(0) === '<' ? b[1] : '<p>' + b[1] + '</p>') + '</div>'; });
  if (d.f && d.f.length) h += '<div class="sh-b"><div class="sh-l">Что поискать, если станет интересно</div><div class="sh-f">' + d.f.map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</div></div>';
  sheetIn.innerHTML = h; sheetEl.querySelector('.sh-box').scrollTop = 0; sheetEl.classList.add('open'); sheetEl.setAttribute('aria-hidden', 'false'); sheetOpen = true; hideTip();
}
function closeSheet() { sheetEl.classList.remove('open'); sheetEl.setAttribute('aria-hidden', 'true'); sheetOpen = false; }
window.addEventListener('keydown', function (e) { if (e.key === 'Escape' && sheetOpen) closeSheet(); });
sheetEl.addEventListener('wheel', function (e) { if (!e.target.closest('.sh-box')) e.preventDefault(); }, { passive: false });
function natalIn(i) { var o = []; for (var b = 0; b < NB; b++) if (signOf(P70[b][0]) === i) o.push(KEYS[b]); return o; }
function consAt(x, y) {
  var best = null, bd = 13, a = { x: 0, y: 0, z: 0, s: 0, ok: false }, b = { x: 0, y: 0, z: 0, s: 0, ok: false };
  for (var id in CONS) for (var i = 0; i < CONS[id].length; i++) { var ln = CONS[id][i];
    for (var j = 0; j < ln.length - 1; j++) {
      proj(ln[j], a); proj(ln[j + 1], b); if (!a.ok || !b.ok || a.z < -.3 || b.z < -.3) continue;
      var dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1, t = clamp(((x - a.x) * dx + (y - a.y) * dy) / l2, 0, 1), d = Math.hypot(x - a.x - dx * t, y - a.y - dy * t);
      if (d < bd) { bd = d; best = id; }
    } }
  return best;
}
var lastTap = 0, lastTX = 0, lastTY = 0;
document.addEventListener('click', function (e) {
  if (!e.target.closest) return;
  var mb = e.target.closest('[data-more]');
  if (mb) { openSheet(mb.getAttribute('data-more')); return; }
  if (e.target.closest('#sheet')) { if (e.target.closest('.sh-x') || e.target.classList.contains('sh-bg')) closeSheet(); return; }
  if (dragMoved) { dragMoved = false; return; }
  if (e.target.closest('.card,.chip,button,a,#tip,#ctl,.hero-in,.wish-in')) return;
  var x = e.clientX, y = e.clientY, best = null, bd = 28, i, d, hx = x, hy = y, tnow = Date.now();
  if (tnow - lastTap < 340 && Math.hypot(x - lastTX, y - lastTY) < 40) { lastTap = 0; resetLook(); hideTip(); if (sel) select(null); return; }
  lastTap = tnow; lastTX = x; lastTY = y;
  for (i = 0; i < hits.length; i++) { d = Math.hypot(hits[i].x - x, hits[i].y - y); if (d < bd) { bd = d; best = hits[i].k; hx = hits[i].x; hy = hits[i].y; } }
  for (i = 0; i < shits.length; i++) if (Math.hypot(shits[i].x - x, shits[i].y - y) < bd - 2) best = null;
  if (best) {
    if (scene.wheel) { hideTip(); select(best === sel ? null : best); return; }
    var lon = POS[IDX[best]][0];
    showTip(hx, hy, { e: degStr(lon) + ' ' + SIGN_OF[signOf(lon)], t: BODY[best].n, g: BODY[best].g, k: PL_TIP[best], more: T > .99 ? 'p:' + best : '', avoid: scene.hlCons }); return;
  }
  for (i = 0, bd = 30; i < lhits.length; i++) { d = Math.hypot(lhits[i].x - x, lhits[i].y - y); if (d < bd) { bd = d; best = lhits[i]; } }
  if (best) { showTip(best.x, best.y, { e: STAR_KIND[best.n] || 'Звезда', t: best.n, d: STAR_TIP[best.n] || '', more: STAR_DET[best.n] ? 'st:' + best.n : '', avoid: scene.hlCons }); return; }
  var sb = -1; bd = 30;
  for (i = 0; i < shits.length; i++) { d = Math.hypot(shits[i].x - x, shits[i].y - y); if (d < bd) { bd = d; sb = shits[i].i; hx = shits[i].x; hy = shits[i].y; } }
  if (sb >= 0) {
    var np = natalIn(sb), zc = ZCONS[sb];
    consTap = { id: zc, until: last + 8 }; if (consHL[zc] == null) consHL[zc] = 0;
    showTip(hx, hy, { e: 'Знак зодиака · ' + ELEM[sb % 4], t: SIGN[sb], g: SIGN_G[sb], k: SIGN_KEY[sb], list: np, more: 's:' + sb, avoid: zc }); return;
  }
  if (A.cons * (1 - A.wheel) > .03) {
    var c = consAt(x, y);
    if (c) { consTap = { id: c, until: last + 6 }; if (consHL[c] == null) consHL[c] = 0; showTip(x, y, { e: 'Созвездие', t: S.cnames && S.cnames[c] || c, d: c === 'Sco' ? 'Его сердце, алый Антарес.' : '', avoid: c }); return; }
  }
  hideTip(); if (scene.wheel && sel) select(null);
});
/* осмотреться: тянуть в стороны, щипком приближать */
var storyEl = document.getElementById('story');
function pdist() { var k = Object.keys(ptrs); return Math.hypot(ptrs[k[0]].x - ptrs[k[1]].x, ptrs[k[0]].y - ptrs[k[1]].y); }
storyEl.addEventListener('pointerdown', function (e) {
  if (e.target.closest && e.target.closest('.card,.chip,button,a')) return;
  dragMoved = false; ptrs[e.pointerId] = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, m: e.pointerType === 'mouse' };
  if (Object.keys(ptrs).length === 2) { pinch0 = pdist() || 1; zoom0 = look.zoom; pinching = true; }
});
window.addEventListener('pointermove', function (e) {
  var p = ptrs[e.pointerId]; if (!p) return;
  var n = Object.keys(ptrs).length, px = p.x, py = p.y; p.x = e.clientX; p.y = e.clientY;
  if (n >= 2) { look.reset = false; look.zoom = look.zt = clamp(zoom0 * pdist() / pinch0, .6, 4); dragMoved = true; hideTip(); return; }
  if (!dragMoved && Math.hypot(p.x - p.x0, p.y - p.y0) < 8) return;
  if (!dragMoved && !p.m && Math.abs(p.y - p.y0) > Math.abs(p.x - p.x0)) { delete ptrs[e.pointerId]; return; }
  dragMoved = true; look.reset = false; hideTip();
  var k = camK0 ? cam.k : cam.k * look.zoom;
  if (scene.cam.wheel) { var d = Math.atan2(p.y - cam.cy, p.x - cam.cx) - Math.atan2(py - cam.cy, px - cam.cx); if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; look.roll += d; }
  else { look.yaw += (p.x - px) / k; if (p.m) look.pitch = clamp(look.pitch + (p.y - py) / k, -1.2, 1.2); }
});
function pend(e) { delete ptrs[e.pointerId]; if (Object.keys(ptrs).length < 2) pinching = false; }
function zoomBy(f) { look.reset = false; look.zt = clamp(look.zt * f, .6, 4); }
document.getElementById('zin').addEventListener('click', function () { zoomBy(1.45); });
document.getElementById('zout').addEventListener('click', function () { zoomBy(1 / 1.45); });
document.getElementById('zreset').addEventListener('click', function () { resetLook(); hideTip(); });
window.addEventListener('wheel', function (e) { if (!e.ctrlKey || scene.cam.center) return; e.preventDefault(); zoomBy(Math.exp(-e.deltaY * .012)); }, { passive: false });
window.addEventListener('keydown', function (e) { if (scene.cam.center) return; if (e.key === '+' || e.key === '=') zoomBy(1.3); else if (e.key === '-') zoomBy(1 / 1.3); else if (e.key === '0') resetLook(); });
window.addEventListener('pointerup', pend); window.addEventListener('pointercancel', pend);
/* если браузер сам не доводит прокрутку до экрана, доводим мы */
var snapT = 0, touching = false;
function snapNow() {
  if (touching) return;
  var y = window.scrollY, best = 0, bd = 1e9; for (var i = 0; i < tops.length; i++) { var d = Math.abs(tops[i] - y); if (d < bd) { bd = d; best = tops[i]; } }
  if (bd > 3 && bd < H) window.scrollTo({ top: best, behavior: reduce ? 'auto' : 'smooth' });
}
window.addEventListener('scroll', function () { hideTip(); clearTimeout(snapT); snapT = setTimeout(snapNow, 170); }, { passive: true });
window.addEventListener('touchstart', function () { touching = true; }, { passive: true });
function tend() { touching = false; clearTimeout(snapT); snapT = setTimeout(snapNow, 220); }
window.addEventListener('touchend', tend, { passive: true }); window.addEventListener('touchcancel', tend, { passive: true });

/* ---------- музыка: космический эмбиент, синтезируется в браузере ---------- */
var snd = { on: true, ctx: null, master: null, next: 0, spark: 0, bank: 0, chord: 0, voices: null, timer: 0 };
try { if (localStorage.getItem('nebo-sound') === '0') snd.on = false; } catch (e) {}
/* аккорды сдвигаются на терцию: «волшебное» кинозвучание без мажорной веселости */
var PROG = [[50, 57, 66, 73, 76], [53, 60, 69, 76, 79], [50, 57, 64, 69, 78], [46, 58, 65, 72, 74]], CHORD_LEN = 11;
function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
function sndBuild(ctx, dest) {
  var master = ctx.createGain(); master.gain.value = 0; master.connect(dest);
  var sr = ctx.sampleRate, len = Math.floor(sr * 4.2), ir = ctx.createBuffer(2, len, sr), ch, d, i;
  for (ch = 0; ch < 2; ch++) { d = ir.getChannelData(ch); for (i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4); }
  var rev = ctx.createConvolver(); rev.buffer = ir; var wet = ctx.createGain(); wet.gain.value = .6; rev.connect(wet); wet.connect(master);
  /* фильтр медленно «дышит» */
  var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1700; lp.Q.value = .5;
  var fl = ctx.createOscillator(); fl.frequency.value = .045; var flg = ctx.createGain(); flg.gain.value = 800; fl.connect(flg); flg.connect(lp.frequency); fl.start();
  var dry = ctx.createGain(); dry.gain.value = .55; lp.connect(dry); dry.connect(master); lp.connect(rev);
  var banks = [[], []];
  for (var b = 0; b < 2; b++) for (var v = 0; v < 5; v++) {
    var g = ctx.createGain(); g.gain.value = 0; g.connect(lp);
    var o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), o3 = ctx.createOscillator(); o1.type = 'sine'; o2.type = 'triangle'; o3.type = 'sine'; o1.detune.value = -5; o2.detune.value = 6;
    var tg = ctx.createGain(); tg.gain.value = .3; o1.connect(g); o2.connect(tg); tg.connect(g);
    /* верхняя октава мерцает */
    var sg = ctx.createGain(); sg.gain.value = .1; var sl = ctx.createOscillator(); sl.frequency.value = .25 + Math.random() * .5; var slg = ctx.createGain(); slg.gain.value = .09; sl.connect(slg); slg.connect(sg.gain); sl.start();
    o3.connect(sg); sg.connect(g); o1.start(); o2.start(); o3.start();
    banks[b].push({ g: g, o: [o1, o2], hi: o3 });
  }
  /* космический ветер */
  var nb = ctx.createBuffer(1, sr * 3, sr); d = nb.getChannelData(0); for (i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  var ns = ctx.createBufferSource(); ns.buffer = nb; ns.loop = true; var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 1.6;
  var wl = ctx.createOscillator(); wl.frequency.value = .031; var wlg = ctx.createGain(); wlg.gain.value = 520; wl.connect(wlg); wlg.connect(bp.frequency); wl.start();
  var ng = ctx.createGain(); ng.gain.value = .02; var nl = ctx.createOscillator(); nl.frequency.value = .07; var nlg = ctx.createGain(); nlg.gain.value = .012; nl.connect(nlg); nlg.connect(ng.gain); nl.start();
  ns.connect(bp); bp.connect(ng); ng.connect(master); ng.connect(rev); ns.start();
  return { master: master, banks: banks, bells: rev, bellDry: master };
}
function sndSchedule(S0, ctx, until) {
  while (S0.next < until) {
    var t = Math.max(S0.next, ctx.currentTime + .02), ch = PROG[S0.chord % PROG.length], on = S0.voices.banks[S0.bank], off = S0.voices.banks[1 - S0.bank];
    for (var v = 0; v < 5; v++) {
      var f = mtof(ch[v]), tv = t + v * .85;
      on[v].o[0].frequency.setValueAtTime(f, t); on[v].o[1].frequency.setValueAtTime(f, t); on[v].hi.frequency.setValueAtTime(f * 2, t);
      on[v].g.gain.setTargetAtTime(v === 0 ? .1 : .07, tv, 1.3); off[v].g.gain.setTargetAtTime(0, t + v * .5, 1.7);
    }
    S0.bank = 1 - S0.bank; S0.chord++; S0.next += CHORD_LEN;
  }
  while (S0.spark < until) {
    var ts = Math.max(S0.spark, ctx.currentTime + .02), cur = PROG[Math.max(0, S0.chord - 1) % PROG.length], n = cur[2 + ((Math.random() * 3) | 0)] + (Math.random() < .5 ? 12 : 24);
    var eg = ctx.createGain(), amp = .018 + Math.random() * .02; eg.gain.setValueAtTime(0, ts); eg.gain.linearRampToValueAtTime(amp, ts + .03); eg.gain.exponentialRampToValueAtTime(.0001, ts + 3.5);
    var o = ctx.createOscillator(); o.frequency.value = mtof(n); o.connect(eg);
    var dg = ctx.createGain(); dg.gain.value = .3; eg.connect(S0.voices.bells); eg.connect(dg); dg.connect(S0.voices.bellDry);
    o.start(ts); o.stop(ts + 3.7);
    S0.spark += 4 + Math.random() * 5;
  }
}
var SND_VOL = 1.25, sndBtnEl = document.getElementById('snd');
function sndUi() { sndBtnEl.classList.toggle('off', !snd.on); sndBtnEl.setAttribute('aria-pressed', snd.on ? 'true' : 'false'); sndBtnEl.setAttribute('aria-label', snd.on ? 'Выключить музыку' : 'Включить музыку'); }
function sndStart() {
  if (!snd.on) return;
  try {
    if (!snd.ctx) {
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      snd.ctx = new AC(); snd.voices = sndBuild(snd.ctx, snd.ctx.destination); snd.master = snd.voices.master;
      snd.next = snd.ctx.currentTime + .15; snd.spark = snd.ctx.currentTime + 7;
      snd.timer = setInterval(function () { if (snd.on && snd.ctx.state === 'running') sndSchedule(snd, snd.ctx, snd.ctx.currentTime + 2.5); }, 800);
    }
    if (snd.ctx.state !== 'running') snd.ctx.resume();
    snd.master.gain.setTargetAtTime(SND_VOL, snd.ctx.currentTime, 1.6);
  } catch (e) {}
}
function sndStop() { if (!snd.ctx) return; try { snd.master.gain.setTargetAtTime(0, snd.ctx.currentTime, .25); setTimeout(function () { if (!snd.on || document.hidden) snd.ctx.suspend(); }, 1200); } catch (e) {} }
sndBtnEl.addEventListener('click', function () { snd.on = !snd.on; try { localStorage.setItem('nebo-sound', snd.on ? '1' : '0'); } catch (e) {} sndUi(); if (snd.on) sndStart(); else sndStop(); });
['pointerup', 'touchend', 'keydown', 'click'].forEach(function (ev) { window.addEventListener(ev, function () { if (snd.on && (!snd.ctx || snd.ctx.state !== 'running')) sndStart(); }, { passive: true }); });
sndUi();

/* ---------- спрайты ---------- */
function rgba(hex, a) { var n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }
function glowSprite(hex, core) {
  var c = document.createElement('canvas'); c.width = c.height = 64; var g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, rgba(hex, core)); gr.addColorStop(.22, rgba(hex, core * .38)); gr.addColorStop(.55, rgba(hex, core * .1)); gr.addColorStop(1, rgba(hex, 0));
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return c;
}
var glowW = glowSprite('#fff3dc', .9), glowMW = glowSprite('#e0b4d8', 1), GLOW = {};
KEYS.forEach(function (k) { GLOW[k] = glowSprite(BODY[k].c, 1); });

/* ---------- состояние ---------- */
var secs = [], tops = [], cur = -1, scene = SC.hero, sceneT0 = 0, sceneEl = null;
var cam = { q: [0, 0, 0, 1], k: 300, cx: 0, cy: 0 }, R = [1, 0, 0], U = [0, 1, 0], F = [0, 0, 1], tw = { from: null, t0: -9, dur: 1, ang: 0 };
var A = { ground: 0, ecl: 0, rib: 0, wheel: 0, cons: .1, stars: 1, mw: 1, planets: 1, part: 0, asc: 0 };
var glyphA = new Float32Array(NB), nameA = new Float32Array(NB), hlA = new Float32Array(NB), hlOn = new Float32Array(NB), signA = new Float32Array(12);
var consHL = {}, starLbl = {};
var rollPhi = 0, rollVel = 0, camK0 = 0, groundK = 1, figA = 0, consTap = null, look = { yaw: 0, pitch: 0, roll: 0, zoom: 1, zt: 1, reset: false };
var T = 0, Tanim = null, prevPX = new Float32Array(NB), prevPY = new Float32Array(NB), Tmoving = false;
var FS = "'AstroSym','Noto Sans Symbols','Apple Symbols','Segoe UI Symbol',sans-serif";

function layout() {
  W = window.innerWidth; H = window.innerHeight;
  portrait = W < 900 || W < H;
  if (portrait) { refW = W; FX = .5; FY = .36; } else { refW = Math.min(W * .6, H * 1.05); FX = .34; FY = .5; }
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  secs = Array.prototype.filter.call(document.querySelectorAll('.sc'), function (s) { return !s.hidden; });
  tops = secs.map(function (s) { return s.offsetTop; });
  var wc = document.querySelector('.wheelcard'); if (wc) wheelTop = wc.offsetTop;
  wc = document.querySelector('[data-s=parade] .card'); if (wc) paradeTop = wc.offsetTop;
  wc = document.querySelector('[data-s=asc] .card'); if (wc && wc.offsetTop) ascTop = wc.offsetTop;
  shapes = {}; scatter();
}
function wheelR() { return portrait ? Math.min(.365 * W, .24 * H) : Math.min(.22 * W, .33 * H); }
function camTarget(c, now) {
  var f, u, k, cx, cy;
  if (c.wheel) {
    var a = ASCLON * RAD, Rw = wheelR(); f = [0, 0, -1]; u = [Math.sin(a), -Math.cos(a), 0]; k = Rw / 2;
    cx = FX * W; cy = portrait ? Math.max(1.256 * Rw + Math.min(54, Math.max(16, wheelTop - 2.512 * Rw - 8)), wheelTop * .5 + 4) : .5 * H;
  } else {
    if (c.hor) { f = horVec(c.hor[0], c.hor[1]); u = HZ; } else { f = ecl(c.ecl[0] + (c.spin || 0) * now, c.ecl[1]); u = [0, 0, 1]; }
    var span = (portrait ? c.span : (c.spanD || c.span)) * RAD, ref = c.center ? Math.min(W, H * 1.2) : refW;
    k = ref / (4 * Math.tan(span / 4)); cx = (c.center ? .5 : FX) * W; cy = (c.center ? .5 : portrait && c.fy ? c.fy : FY) * H;
    if (portrait && c.hor && !c.center) cy = Math.min(cy, (c.hb ? ascTop : paradeTop) - 26 - 2 * k * Math.tan(c.hor[1] * RAD / 2));
  }
  var r = norm(cross(f, u)); u = cross(r, f);
  return { q: mat2q(r, u, [-f[0], -f[1], -f[2]]), k: k, cx: cx, cy: cy };
}
function retarget(now, instant) {
  if (camK0) { cam.k = camK0; camK0 = 0; }
  var tg = camTarget(scene.cam, now);
  if (instant || reduce) { cam.q = tg.q; cam.k = tg.k; cam.cx = tg.cx; cam.cy = tg.cy; tw.t0 = -99; tw.dur = .001; tw.from = null; return; }
  tw.from = { q: cam.q.slice(), k: cam.k, cx: cam.cx, cy: cam.cy }; tw.t0 = now;
  tw.ang = 2 * Math.acos(Math.min(1, Math.abs(qdot(cam.q, tg.q)))) / RAD;
  tw.dur = clamp(1.25 + tw.ang / 75, 1.3, 3);
}
function rotAx(v, k, t) { var c = Math.cos(t), sn = Math.sin(t), d = (k[0] * v[0] + k[1] * v[1] + k[2] * v[2]) * (1 - c), x = cross(k, v); return [v[0] * c + x[0] * sn + k[0] * d, v[1] * c + x[1] * sn + k[1] * d, v[2] * c + x[2] * sn + k[2] * d]; }
function resetLook() { look.reset = true; look.zt = 1; }
function updateCam(now) {
  if (camK0) { cam.k = camK0; camK0 = 0; }
  var tg = camTarget(scene.cam, now), u = tw.from ? clamp((now - tw.t0) / tw.dur, 0, 1) : 1;
  if (u >= 1) { cam.q = tg.q; cam.k = tg.k; cam.cx = tg.cx; cam.cy = tg.cy; tw.from = null; }
  else {
    var e = ease(u), bump = 1 - .38 * Math.sin(Math.PI * u) * clamp((tw.ang - 40) / 100, 0, 1);
    cam.q = slerp(tw.from.q, tg.q, e); cam.k = Math.exp(lerp(Math.log(tw.from.k), Math.log(tg.k), e)) * bump;
    cam.cx = lerp(tw.from.cx, tg.cx, e); cam.cy = lerp(tw.from.cy, tg.cy, e);
  }
  var m = q2mat(cam.q); R = m[0]; U = m[1]; F = [-m[2][0], -m[2][1], -m[2][2]];
  var rr = rollPhi + (scene.cam.wheel ? look.roll : 0), c, sn, a, b;
  if (!scene.cam.wheel && (look.yaw || look.pitch)) {
    var ax = scene.cam.hor ? HZ : [0, 0, 1];
    R = rotAx(R, ax, look.yaw); U = rotAx(U, ax, look.yaw); F = rotAx(F, ax, look.yaw);
    c = Math.cos(look.pitch); sn = Math.sin(look.pitch); a = [F[0] * c + U[0] * sn, F[1] * c + U[1] * sn, F[2] * c + U[2] * sn]; U = [U[0] * c - F[0] * sn, U[1] * c - F[1] * sn, U[2] * c - F[2] * sn]; F = a;
  }
  if (rr) { c = Math.cos(rr); sn = Math.sin(rr); a = [R[0] * c + U[0] * sn, R[1] * c + U[1] * sn, R[2] * c + U[2] * sn]; b = [U[0] * c - R[0] * sn, U[1] * c - R[1] * sn, U[2] * c - R[2] * sn]; R = a; U = b; }
  camK0 = cam.k; cam.k *= look.zoom;
}
var PO = { x: 0, y: 0, z: 0, s: 0, ok: false };
function proj(v, o) {
  o = o || PO;
  var z = v[0] * F[0] + v[1] * F[1] + v[2] * F[2];
  if (z < -0.88) { o.ok = false; return o; }
  var s = 2 * cam.k / (1 + z);
  o.x = cam.cx + (v[0] * R[0] + v[1] * R[1] + v[2] * R[2]) * s; o.y = cam.cy - (v[0] * U[0] + v[1] * U[1] + v[2] * U[2]) * s; o.z = z; o.s = s; o.ok = true; return o;
}

/* ---------- смена сцены ---------- */
function setScene(i, now, instant) {
  if (i === cur) return;
  cur = i; sceneEl = secs[i]; scene = SC[sceneEl.getAttribute('data-s')] || SC.hero; sceneT0 = now;
  for (var j = 0; j < secs.length; j++) secs[j].classList.toggle('on', j === i);
  if (scene.cam.hor) { var hb = scene.cam.hb === 'k' && S.hor70 ? S.hor70 : S.hor; HZ = hb.z; HN = hb.n; HE = hb.e; }
  retarget(now, instant);
  var tT = scene.T;
  if (instant || reduce) { T = tT; Tanim = null; }
  else if (Math.abs(tT - T) > 1e-3) Tanim = { from: T, to: tT, t0: now + (tT && scene.afterT ? .5 : 0), dur: tT && scene.afterT ? 4.6 * Math.abs(tT - T) + .4 : 1.5, roll: tT && scene.afterT && T < .05 ? 1 : 0 };
  for (j = 0; j < NB; j++) hlOn[j] = 0;
  if (!scene.wheel && sel) select(null);
  resetLook(); hideTip(); consTap = null;
  partShape = scene.part || null; partRose = !!scene.rose;
}
function chase(v, t, r) { return v + (t - v) * r; }

/* ---------- отрисовка ---------- */
function drawGlow() {
  if (A.ground * groundK < .01 || HZ !== S.hor.z) return;
  var p = proj(ecl(P26[0][0], 0)); if (!p.ok) return;
  var rad = cam.k * 1.25, g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
  g.addColorStop(0, 'rgba(255,214,170,.6)'); g.addColorStop(.22, 'rgba(232,140,150,.34)'); g.addColorStop(.6, 'rgba(156,33,69,.15)'); g.addColorStop(1, 'rgba(156,33,69,0)');
  ctx.globalAlpha = A.ground * groundK; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
}
function drawMW(now) {
  var a = A.mw * A.stars * (1 - A.wheel); if (a < .02 || quality < 1) return;
  ctx.globalCompositeOperation = 'lighter';
  for (var i = 0; i < MW.length; i++) {
    var p = proj(MW[i].v); if (!p.ok || p.z < -.2) continue;
    var sz = 13 * RAD * p.s; if (p.x < -sz || p.x > W + sz || p.y < -sz || p.y > H + sz) continue;
    ctx.globalAlpha = MW[i].w * a * 1.5 * (reduce ? 1 : .72 + .28 * Math.sin(now * .42 + i * 1.7)); ctx.drawImage(glowMW, p.x - sz / 2, p.y - sz / 2, sz, sz);
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
}
function strokeLines(lines) {
  for (var i = 0; i < lines.length; i++) {
    var ln = lines[i], pen = false;
    for (var j = 0; j < ln.length; j++) {
      var p = proj(ln[j]);
      if (!p.ok || p.z < -.35) { pen = false; continue; }
      if (pen) ctx.lineTo(p.x, p.y); else { ctx.moveTo(p.x, p.y); pen = true; }
    }
  }
}
function drawCons() {
  var a = A.cons * (1 - A.wheel);
  if (a > .01) {
    ctx.beginPath(); for (var id in CONS) if (!(consHL[id] > .02)) strokeLines(CONS[id]);
    ctx.strokeStyle = 'rgba(246,227,176,' + a.toFixed(3) + ')'; ctx.lineWidth = 1; ctx.stroke();
  }
  for (id in consHL) {
    var h = consHL[id] * ((consTap && consTap.id === id) || selCons === id ? 1 : 1 - A.wheel); if (h < .02) continue;
    ctx.beginPath(); strokeLines(CONS[id]);
    ctx.strokeStyle = 'rgba(246,227,176,' + (a + h * .62).toFixed(3) + ')'; ctx.lineWidth = 1 + h * .4; ctx.stroke();
  }
}
/* Рисунки созвездий: Stellarium (Johan Meuris), Free Art License. Привязка по трем звездам. */
var FIGURES = true;
try { if (/[?&]fig=1/.test(location.search)) FIGURES = true; } catch (e) {}
var ZCONS = ['Ari', 'Tau', 'Gem', 'Cnc', 'Leo', 'Vir', 'Lib', 'Sco', 'Sgr', 'Cap', 'Aqr', 'Psc'];
var ART = {}, artImg = {}, artA = {};
var HERS = {};
(function () { if (!S.art) return; for (var b = 0; b < NB; b++) HERS[ZCONS[signOf(P70[b][0])]] = 1; for (var id in S.art) ART[id] = { f: S.art[id].f, a: S.art[id].a.map(function (q) { return [q[0], q[1], ecl(q[2], q[3])]; }) }; })();
function artLoad(id) { if (artImg[id] || !ART[id]) return; var im = new Image(); im.src = 'assets/art/' + ART[id].f; artImg[id] = im; }
function drawFigure() {
  for (var id in artA) {
    var al = artA[id]; if (al < .02) continue;
    var im = artImg[id]; if (!im || !im.complete || !im.naturalWidth) continue;
    var an = ART[id].a, x = [], y = [], i, ok = true;
    for (i = 0; i < 3; i++) { var p = proj(an[i][2]); if (!p.ok || p.z < -.2) { ok = false; break; } x.push(p.x); y.push(p.y); }
    if (!ok) continue;
    var u1 = an[0][0], v1 = an[0][1], u2 = an[1][0], v2 = an[1][1], u3 = an[2][0], v3 = an[2][1], det = u1 * (v2 - v3) + u2 * (v3 - v1) + u3 * (v1 - v2);
    function sol(q) { return [(q[0] * (v2 - v3) + q[1] * (v3 - v1) + q[2] * (v1 - v2)) / det, (q[0] * (u3 - u2) + q[1] * (u1 - u3) + q[2] * (u2 - u1)) / det, (q[0] * (u2 * v3 - u3 * v2) + q[1] * (u3 * v1 - u1 * v3) + q[2] * (u1 * v2 - u2 * v1)) / det]; }
    var A1 = sol(x), A2 = sol(y);
    ctx.save(); ctx.setTransform(DPR * A1[0], DPR * A2[0], DPR * A1[1], DPR * A2[1], DPR * A1[2], DPR * A2[2]);
    ctx.globalAlpha = .9 * al; ctx.drawImage(im, 0, 0); ctx.restore();
  }
  ctx.globalAlpha = 1;
}
function drawStars(now) {
  var k = cam.k, lim = k < 110 ? 4.4 : k < 230 ? 5.2 : 6.1, dim = A.stars, sizeK = clamp(Math.pow(k / 300, .28), .75, 1.5);
  if (quality < 1) lim -= .6;
  var streak = Math.abs(rollVel) > .08 && window.Path2D ? new Path2D() : null, sa = -rollVel * .085, sc = Math.cos(sa), ss = Math.sin(sa);
  var F0 = F[0], F1 = F[1], F2 = F[2], R0 = R[0], R1 = R[1], R2 = R[2], U0 = U[0], U1 = U[1], U2 = U[2], cx = cam.cx, cy = cam.cy, last = -1, k2 = 2 * k;
  for (var i = 0; i < NS; i++) {
    var m = SM[i]; if (m > lim) break;
    var x = SX[i], y = SY[i], z = SZ[i], zz = x * F0 + y * F1 + z * F2; if (zz < -.4) continue;
    var s = k2 / (1 + zz), X = cx + (x * R0 + y * R1 + z * R2) * s; if (X < -6 || X > W + 6) continue;
    var Y = cy - (x * U0 + y * U1 + z * U2) * s; if (Y < -6 || Y > H + 6) continue;
    var r = (3.1 - .46 * m) * sizeK; if (r < .5) r = .5;
    var a = 1.12 - m * .135; if (a > 1) a = 1; a *= dim;
    var tk = reduce ? 1 : .5 + .5 * Math.sin(now * SW[i] + SPH[i]);
    if (m < 5.4) a *= .55 + .45 * tk;
    var c = SC8[i]; if (c !== last) { ctx.fillStyle = SCOL[c]; last = c; }
    ctx.globalAlpha = a;
    if (r < 1.3) { var d = r * 1.7; ctx.fillRect(X - d / 2, Y - d / 2, d, d); }
    else {
      if (m < 1.7) { ctx.globalAlpha = a * .45; ctx.drawImage(glowW, X - r * 5, Y - r * 5, r * 10, r * 10); ctx.globalAlpha = a; }
      ctx.beginPath(); ctx.arc(X, Y, r, 0, TAU); ctx.fill();
      if (m < 2.7) { var sl = r * (2.2 + 3.2 * tk); ctx.globalAlpha = a * .55; ctx.fillRect(X - sl, Y - .4, sl * 2, .8); ctx.fillRect(X - .4, Y - sl, .8, sl * 2); }
    }
    if (streak && m < 4.7) { var ox = X - cx, oy = Y - cy; streak.moveTo(X, Y); streak.lineTo(cx + ox * sc - oy * ss, cy + ox * ss + oy * sc); }
  }
  ctx.globalAlpha = 1;
  if (streak) { ctx.strokeStyle = 'rgba(255,238,218,' + (.3 * dim).toFixed(3) + ')'; ctx.lineWidth = 1; ctx.stroke(streak); }
}
function pathLat(lat, step) {
  var pen = false;
  for (var l = 0; l <= 360; l += step) {
    var p = proj(ecl(l, lat));
    if (!p.ok || p.z < -.75 || p.x < -W || p.x > 2 * W || p.y < -H || p.y > 2 * H) { pen = false; continue; }
    if (pen) ctx.lineTo(p.x, p.y); else { ctx.moveTo(p.x, p.y); pen = true; }
  }
}
var RB0 = 3, RB1 = 13;
function drawEcliptic() {
  shits.length = 0;
  var a = A.ecl, rb = A.rib, wm = A.wheel, i, p, q = { x: 0, y: 0, z: 0, s: 0, ok: false };
  if (a > .01) {
    ctx.beginPath(); pathLat(0, 2); ctx.strokeStyle = 'rgba(227,194,122,' + Math.min(1, a * (rb < .05 ? 1.5 : .75)).toFixed(3) + ')'; ctx.lineWidth = 1;
    if (rb < .05) ctx.setLineDash([2, 6]); ctx.stroke(); ctx.setLineDash([]);
  }
  if (rb < .01) return;
  for (i = 0; i < 12; i++) {
    if (signA[i] < .02) continue;
    ctx.beginPath(); var first = true, l;
    for (l = i * 30; l <= i * 30 + 30; l += 3) { p = proj(ecl(l, RB0)); if (!p.ok) { first = null; break; } if (first) { ctx.moveTo(p.x, p.y); first = false; } else ctx.lineTo(p.x, p.y); }
    if (first === null) continue;
    for (l = i * 30 + 30; l >= i * 30; l -= 3) { p = proj(ecl(l, RB1)); if (!p.ok) break; ctx.lineTo(p.x, p.y); }
    ctx.closePath(); ctx.fillStyle = 'rgba(194,65,107,' + (.3 * signA[i] * rb).toFixed(3) + ')'; ctx.fill();
  }
  ctx.beginPath(); pathLat(RB0, 2); pathLat(RB1, 2);
  for (i = 0; i < 12; i++) { p = proj(ecl(i * 30, RB0)); if (!p.ok) continue; proj(ecl(i * 30, RB1), q); if (!q.ok) continue; ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); }
  ctx.strokeStyle = 'rgba(227,194,122,' + (rb * .55).toFixed(3) + ')'; ctx.lineWidth = 1; ctx.stroke();
  var tstep = wm > .5 ? 5 : 10; ctx.beginPath();
  for (i = 0; i < 360; i += tstep) {
    if (i % 30 === 0) continue;
    p = proj(ecl(i, RB0)); if (!p.ok || p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > H + 20) continue;
    proj(ecl(i, RB0 + (i % 10 ? 1.1 : 2)), q); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
  }
  ctx.strokeStyle = 'rgba(227,194,122,' + (rb * .4).toFixed(3) + ')'; ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; shits.length = 0;
  for (i = 0; i < 12; i++) {
    p = proj(ecl(i * 30 + 15, 8)); if (!p.ok || p.x < -40 || p.x > W + 40 || p.y < -40 || p.y > H + 40) continue;
    var bw = 10 * RAD * p.s, big = bw > 74 && wm < .5, fs = clamp(bw * .5, 11, 26), hl = signA[i];
    if (big) proj(ecl(i * 30 + 15, 9.4));
    ctx.globalAlpha = rb * (.62 + .38 * hl); ctx.fillStyle = hl > .5 ? '#f6e3b0' : '#e3c27a';
    ctx.font = fs.toFixed(1) + 'px ' + FS; ctx.fillText(SIGN_G[i] + VS, PO.x, PO.y + 1);
    if (rb > .3) shits.push({ i: i, x: PO.x, y: PO.y });
    if (big) { proj(ecl(i * 30 + 15, 5.2)); ctx.font = "500 10px Manrope,sans-serif"; ctx.globalAlpha = rb * (.55 + .45 * hl); ctx.fillText(SIGN[i].toUpperCase(), PO.x, PO.y); }
  }
  ctx.globalAlpha = 1;
}
var LIN = -28.1, P1 = { x: 0, y: 0, z: 0, s: 0, ok: false }, P2 = { x: 0, y: 0, z: 0, s: 0, ok: false };
function drawWheel() {
  var wm = A.wheel; if (wm < .02) return;
  var i;
  ctx.beginPath(); pathLat(LIN, 3); ctx.strokeStyle = 'rgba(227,194,122,' + (wm * .32).toFixed(3) + ')'; ctx.lineWidth = 1; ctx.stroke();
  if (HS) {
    for (i = 0; i < 12; i++) {
      var c = HS.cusps[i], main = i === 0 || i === 9;
      proj(ecl(c, LIN), P1); proj(ecl(c, main ? RB1 : RB0), P2); if (!P1.ok || !P2.ok) continue;
      ctx.beginPath(); ctx.moveTo(P1.x, P1.y); ctx.lineTo(P2.x, P2.y);
      ctx.strokeStyle = main ? 'rgba(232,165,191,' + (wm * (.7 + .3 * A.asc)).toFixed(3) + ')' : 'rgba(227,194,122,' + (wm * .22).toFixed(3) + ')'; ctx.lineWidth = main ? 1.4 + A.asc : 1; ctx.stroke();
      var mid = c + dAng(c, HS.cusps[(i + 1) % 12]) / 2; proj(ecl(mid, -24.5), P1);
      ctx.globalAlpha = wm * .5; ctx.fillStyle = '#c4b0c2'; ctx.font = '500 9px Manrope,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), P1.x, P1.y);
      if (main) { proj(ecl(c + 5, -37), P1); ctx.globalAlpha = wm; ctx.fillStyle = '#e8a5bf'; ctx.font = '600 10px Manrope,sans-serif'; ctx.fillText(i === 0 ? 'AC' : 'MC', P1.x, P1.y); }
      ctx.globalAlpha = 1;
    }
  }
  for (i = 0; i < ASPECTS.length; i++) {
    var a = ASPECTS[i], la = P70[IDX[a[0]]][0], lb = P70[IDX[a[1]]][0];
    if (Math.abs(dAng(la, lb)) < 12) continue;
    proj(ecl(la, LIN), P1); proj(ecl(lb, LIN), P2); if (!P1.ok || !P2.ok) continue;
    var on = sel && (a[0] === sel || a[1] === sel), al = sel ? (on ? .95 : .12) : .42;
    ctx.beginPath(); ctx.moveTo(P1.x, P1.y); ctx.lineTo(P2.x, P2.y);
    ctx.strokeStyle = 'rgba(227,194,122,' + (wm * al).toFixed(3) + ')'; ctx.lineWidth = on ? 1.6 : 1; ctx.stroke();
  }
  ctx.fillStyle = 'rgba(246,227,176,' + wm.toFixed(3) + ')';
  for (i = 0; i < NB; i++) { proj(ecl(P70[i][0], LIN), P1); if (!P1.ok) continue; ctx.beginPath(); ctx.arc(P1.x, P1.y, 1.6, 0, TAU); ctx.fill(); }
}
var disp = new Float32Array(NB), order = [];
function spread(gap) {
  order.length = 0; var i;
  for (i = 0; i < NB; i++) if (glyphA[i] > .01) order.push(i);
  order.sort(function (a, b) { return POS[a][0] - POS[b][0]; });
  var groups = order.map(function (b) { return [b]; }), ch = true;
  function place(g) { var m = 0, j; for (j = 0; j < g.length; j++) m += POS[g[j]][0]; m /= g.length; for (j = 0; j < g.length; j++) disp[g[j]] = m + (j - (g.length - 1) / 2) * gap; }
  groups.forEach(place);
  while (ch) {
    ch = false;
    for (i = 0; i < groups.length - 1; i++) {
      var a = groups[i], b = groups[i + 1];
      if (disp[b[0]] - disp[a[a.length - 1]] < gap) { groups.splice(i, 2, a.concat(b)); place(groups[i]); ch = true; break; }
    }
  }
}
function label(txt, x, y, font, fill, align) {
  ctx.font = font; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(11,5,16,.7)'; ctx.lineJoin = 'round'; ctx.strokeText(txt, x, y);
  ctx.fillStyle = fill; ctx.fillText(txt, x, y);
}
function drawPlanets(now) {
  var wm = A.wheel, pa = A.planets, i, k, b, p;
  var sRef = lerp(cam.k, 2 * cam.k, wm), gap = 25 / (sRef * RAD);
  spread(gap); hits.length = 0;
  var off = lerp(30, Math.max(27, .42 * cam.k), wm), gsz = lerp(17, clamp(cam.k * .26, 16, 24), wm);
  for (i = 0; i < NB; i++) {
    k = KEYS[i]; b = BODY[k];
    var lon = POS[i][0], lat = POS[i][1] * (1 - wm);
    p = proj(ecl(lon, lat), P1); if (!p.ok) { prevPX[i] = NaN; continue; }
    var vis = k === 'node' ? wm : Math.max(pa, wm), h = hlA[i];
    var on = p.x > -60 && p.x < W + 60 && p.y > -60 && p.y < H + 60;
    if (b.r && vis > .01 && on) {
      var r = b.r * lerp(1, .62, wm) * (1 + .25 * h); if (r < 1.8) r = 1.8;
      if (Tmoving && prevPX[i] === prevPX[i]) {
        var dx = p.x - prevPX[i], dy = p.y - prevPY[i], dl = Math.hypot(dx, dy);
        if (dl > 2 && dl < W) { var g = ctx.createLinearGradient(prevPX[i] - dx * 2, prevPY[i] - dy * 2, p.x, p.y); g.addColorStop(0, rgba(b.c, 0)); g.addColorStop(1, rgba(b.c, .7)); ctx.strokeStyle = g; ctx.lineWidth = r * 1.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(prevPX[i] - dx * 2, prevPY[i] - dy * 2); ctx.lineTo(p.x, p.y); ctx.stroke(); }
      }
      var gs = r * (5.5 + 5 * h) * (k === 'sun' ? 1.5 : 1);
      ctx.globalAlpha = vis * (.75 + .25 * h); ctx.drawImage(GLOW[k], p.x - gs, p.y - gs, gs * 2, gs * 2);
      ctx.globalAlpha = vis; ctx.fillStyle = b.c; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
      if (hlOn[i] > 0) {
        var age = now - hlOn[i];
        if (age < 1.4) { ctx.globalAlpha = vis * (1 - age / 1.4) * .9; ctx.strokeStyle = b.c; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(p.x, p.y, r + 5 + age * 34, 0, TAU); ctx.stroke(); }
      }
      if (h > .02 && wm < .5) { ctx.globalAlpha = vis * h * .7; ctx.strokeStyle = '#f6e3b0'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x, p.y, r + 5 + (reduce ? 0 : Math.sin(now * 2.2) * 1.2), 0, TAU); ctx.stroke(); }
    }
    prevPX[i] = p.x; prevPY[i] = p.y;
    if (b.r && vis > .4 && on) hits.push({ k: k, x: p.x, y: p.y });
    var px = p.x, py = p.y, ps = p.s;
    /* глиф */
    var ga = glyphA[i] * (k === 'node' ? wm : 1);
    if (ga > .01 && on) {
      var q = proj(ecl(disp[i], lat - off / (ps * RAD)), P2);
      if (q.ok) {
        var isSel = sel === k && wm > .5, ddx = q.x - px, ddy = q.y - py, dd = Math.hypot(ddx, ddy) || 1, r0 = (b.r || 2) + 4, r1 = gsz * .62;
        if (dd > r0 + r1 + 2) { ctx.globalAlpha = ga * .4; ctx.strokeStyle = '#e3c27a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px + ddx / dd * r0, py + ddy / dd * r0); ctx.lineTo(q.x - ddx / dd * r1, q.y - ddy / dd * r1); ctx.stroke(); }
        if (isSel) { ctx.globalAlpha = ga; ctx.fillStyle = 'rgba(194,65,107,.5)'; ctx.strokeStyle = '#e8a5bf'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(q.x, q.y, gsz * .82, 0, TAU); ctx.fill(); ctx.stroke(); }
        ctx.globalAlpha = ga * (sel && wm > .5 && !isSel ? .55 : 1);
        ctx.font = gsz.toFixed(1) + 'px ' + FS; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = h > .5 || isSel ? '#fff6dc' : '#f6e3b0';
        ctx.fillText(b.g + VS, q.x, q.y + 1);
        if (RETRO[k] && wm > .3) { ctx.globalAlpha = ga * wm * .8; ctx.font = '500 8px Manrope,sans-serif'; ctx.fillStyle = '#e8a5bf'; ctx.fillText('R', q.x + gsz * .55, q.y + gsz * .5); }
        if (ga > .4) hits.push({ k: k, x: q.x, y: q.y });
      }
    }
    /* имя */
    var na = nameA[i] * (1 - wm);
    if (na > .01 && on && b.r) {
      var np = scene.np && scene.np[k] || [0, -(b.r + 15), 'center'];
      ctx.globalAlpha = na; label(b.n, px + np[0], py + np[1], "500 12.5px Manrope,sans-serif", '#f5ecf2', np[2]);
    }
  }
  ctx.globalAlpha = 1;
}
var STAR_KIND = { 'Плеяды': 'звездное скопление', 'Асцендент': 'восходящая точка' };
var STAR_TIP = { 'Асцендент': 'Точка зодиака, которая поднималась над горизонтом в минуту Вашего рождения.', 'Антарес': 'Самая яркая звезда созвездия Скорпиона, его алое «сердце».', 'Регул': 'Главная звезда созвездия Льва, «сердце Льва».', 'Спика': 'Главная звезда созвездия Девы, «колос» в ее руке.', 'Альдебаран': 'Главная звезда созвездия Тельца, «глаз быка».', 'Плеяды': 'Звездное скопление в Тельце, его называют «Семь сестер».' };
function drawStarLabels() {
  lhits.length = 0;
  for (var n in starLbl) {
    var a = starLbl[n] * (1 - A.wheel); if (a < .02) continue;
    var p = proj(NAMED[n]); if (!p.ok) continue;
    ctx.globalAlpha = a;
    if (S.names[n]) {
      var px = p.x, py = p.y, so = scene.sl && scene.sl[n] || [14, -12, 'left'];
      ctx.strokeStyle = 'rgba(232,165,191,.9)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(px, py, 9, 0, TAU); ctx.stroke();
      label((STAR_KIND[n] || 'звезда').toUpperCase(), px + so[0], py + so[1] - 15, "500 9px Manrope,sans-serif", 'rgba(232,165,191,.95)', so[2]);
      label(n, px + so[0], py + so[1], "italic 400 20px 'Cormorant Garamond',Georgia,serif", '#fff1e6', so[2]);
      if (a > .5) { lhits.push({ n: n, x: px, y: py }); lhits.push({ n: n, x: px + so[0] + (so[2] === 'left' ? 28 : -28), y: py + so[1] - 4 }); }
    } else label(n, p.x, p.y, "italic 400 18px 'Cormorant Garamond',Georgia,serif", 'rgba(246,227,176,.92)', 'center');
  }
  ctx.globalAlpha = 1;
}
function drawGround() {
  var a = A.ground * groundK; if (a < .01) return;
  var az0 = Math.atan2(F[0] * HE[0] + F[1] * HE[1] + F[2] * HE[2], F[0] * HN[0] + F[1] * HN[1] + F[2] * HN[2]) / RAD, i, p, n = 0, hy = 0;
  ctx.beginPath();
  for (i = -60; i <= 60; i++) {
    p = proj(horVec(az0 + i * 2, 0)); if (!p.ok) continue;
    if (n++) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
    if (i === 0) hy = p.y;
  }
  for (i = 60; i >= -60; i -= 4) { p = proj(horVec(az0 + i * 2, -62)); if (p.ok) ctx.lineTo(p.x, p.y); }
  ctx.closePath();
  var g = ctx.createLinearGradient(0, hy - 2, 0, hy + H * .5); g.addColorStop(0, '#190a17'); g.addColorStop(.12, '#10060f'); g.addColorStop(1, '#07030a');
  ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fill();
  g = ctx.createLinearGradient(0, hy - 16, 0, hy + 1); g.addColorStop(0, 'rgba(25,10,23,0)'); g.addColorStop(1, 'rgba(25,10,23,.6)');
  ctx.fillStyle = g; ctx.fillRect(0, hy - 16, W, 17); ctx.globalAlpha = 1;
}

/* ---------- частицы для чисел ---------- */
var PN = 760, ppx = new Float32Array(PN), ppy = new Float32Array(PN), ptx = new Float32Array(PN), pty = new Float32Array(PN), psx = new Float32Array(PN), psy = new Float32Array(PN), psp = new Float32Array(PN), pph = new Float32Array(PN), pjx = new Float32Array(PN), pjy = new Float32Array(PN);
var yearStr = '2026', shapes = {}, partShape = null, partRose = false, partCur = '', fontsReady = false, roseA = 0;
(function () { for (var i = 0; i < PN; i++) { psp[i] = 2 + Math.random() * 3.2; pph[i] = Math.random() * TAU; pjx[i] = (Math.random() - .5) * 9; pjy[i] = (Math.random() - .5) * 9; } })();
function scatter() { for (var i = 0; i < PN; i++) { psx[i] = Math.random() * W; psy[i] = Math.random() * H; if (!partCur) { ppx[i] = psx[i]; ppy[i] = psy[i]; } } partCur = ''; }
function shapeCenter(key) { if (key && key.charAt(0) === 'y') return portrait ? [W * .5, H * .16] : [W * .36, H * .17]; return portrait ? [W * .5, H * .33] : [W * .34, H * .5]; }
function sampleText(txt, small) {
  var fs = Math.round(small ? (portrait ? Math.min(H * .17, W * .34) : Math.min(H * .22, W * .12)) : portrait ? Math.min(H * .38, W * .86) : Math.min(H * .6, W * .34)), c = document.createElement('canvas');
  c.width = Math.ceil(fs * (.75 * txt.length + .8)); c.height = Math.ceil(fs * 1.3);
  var g = c.getContext('2d'); g.font = "italic 300 " + fs + "px 'Cormorant Garamond',Georgia,serif"; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = '#fff'; g.fillText(txt, c.width / 2, fs);
  var d = g.getImageData(0, 0, c.width, c.height).data, pts = [], x, y, x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (y = 0; y < c.height; y += 2) for (x = 0; x < c.width; x += 2) if (d[(y * c.width + x) * 4 + 3] > 128) { pts.push([x, y]); if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (!pts.length) return null;
  var out = [], mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  for (var i = 0; i < PN; i++) { var p = pts[(Math.random() * pts.length) | 0]; out.push([p[0] - mx + Math.random() * 2, p[1] - my + Math.random() * 2]); }
  out.sort(function (a, b) { return a[0] - b[0]; });
  return out;
}
function setTargets(key, now) {
  var i, c = shapeCenter(key);
  if (key === 'inf') return;
  if (!key) { for (i = 0; i < PN; i++) { ptx[i] = psx[i]; pty[i] = psy[i]; } return; }
  if (!shapes[key]) shapes[key] = key.charAt(0) === 'y' ? sampleText(key.slice(1), true) : sampleText(key);
  var s = shapes[key]; if (!s) return;
  for (i = 0; i < PN; i++) { ptx[i] = c[0] + s[i][0]; pty[i] = c[1] + s[i][1]; }
}
function drawParticles(now, dt) {
  var want = partShape; if (want && scene.then && now - sceneT0 > 2.6) want = scene.then;
  if (scene.afterT) want = 'y' + yearStr;
  if (want && !fontsReady) want = null;
  if ((want || '') !== partCur) { partCur = want || ''; setTargets(want, now); }
  A.part = chase(A.part, want ? 1 : 0, 1 - Math.exp(-dt * (want ? 2.2 : 3.5)));
  roseA = chase(roseA, partRose ? 1 : 0, 1 - Math.exp(-dt * 2.5));
  if (A.part < .01) { if (!want) for (var j = 0; j < PN; j++) { ppx[j] = psx[j]; ppy[j] = psy[j]; } return; }
  var i, c = shapeCenter(), a = portrait ? Math.min(W * .4, 230) : Math.min(W * .2, 300);
  if (partCur === 'inf') for (i = 0; i < PN; i++) { var th = TAU * (i / PN + now * .04), sn = Math.sin(th), dn = 1 + sn * sn; ptx[i] = c[0] + a * Math.cos(th) / dn + pjx[i]; pty[i] = c[1] + a * sn * Math.cos(th) / dn + pjy[i]; }
  ctx.globalCompositeOperation = 'lighter';
  var cr = Math.round(lerp(246, 255, roseA)), cg = Math.round(lerp(222, 170, roseA)), cb = Math.round(lerp(160, 200, roseA));
  ctx.fillStyle = 'rgb(' + cr + ',' + cg + ',' + cb + ')';
  for (i = 0; i < PN; i++) {
    var r = reduce ? 1 : 1 - Math.exp(-dt * psp[i] * (scene.afterT ? 2.2 : 1));
    ppx[i] += (ptx[i] - ppx[i]) * r; ppy[i] += (pty[i] - ppy[i]) * r;
    var tw2 = .55 + .45 * Math.sin(now * 1.7 + pph[i]), sz = 1.3 + (i % 5 === 0 ? 1.3 : .3);
    ctx.globalAlpha = A.part * tw2; ctx.fillRect(ppx[i] + Math.sin(now * .9 + pph[i]) * .9, ppy[i] + Math.cos(now * .8 + pph[i]) * .9, sz, sz);
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
}

/* ---------- падающие звезды ---------- */
var shoot = [];
function drawShoot(dt) {
  if (reduce) return;
  if (Math.random() < dt * .09 && shoot.length < 1 && A.wheel < .5) shoot.push({ x: Math.random() * W * .8 + W * .1, y: Math.random() * H * .35, vx: -(260 + Math.random() * 260), vy: 130 + Math.random() * 130, l: 1 });
  for (var i = shoot.length - 1; i >= 0; i--) {
    var s = shoot[i], tx = s.x - s.vx * .16, ty = s.y - s.vy * .16, g = ctx.createLinearGradient(s.x, s.y, tx, ty);
    g.addColorStop(0, 'rgba(255,240,215,' + s.l + ')'); g.addColorStop(1, 'rgba(255,240,215,0)');
    ctx.strokeStyle = g; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(tx, ty); ctx.stroke();
    s.x += s.vx * dt; s.y += s.vy * dt; s.l -= dt * .9; if (s.l <= 0) shoot.splice(i, 1);
  }
}

/* ---------- цикл ---------- */
var last = 0, quality = 1, fAcc = 0, fN = 0, running = true;
function has(list, k) { return list && list.indexOf(k) >= 0; }
function frame(ms) {
  if (!running) return;
  requestAnimationFrame(frame);
  var now = ms / 1000, dt = Math.min(.05, now - last || .016); last = now;
  /* активная сцена */
  var y = window.scrollY + H * .5, i, idx = 0;
  for (i = 0; i < tops.length; i++) if (tops[i] <= y) idx = i;
  if (idx !== cur) setScene(idx, now, cur < 0);
  var maxS = document.documentElement.scrollHeight - H; prog.style.transform = 'scaleX(' + (maxS > 0 ? clamp(window.scrollY / maxS, 0, 1) : 0).toFixed(4) + ')';
  /* перемотка */
  var Tprev = T;
  var rollPrev = rollPhi; rollPhi = 0;
  if (Tanim) { var u = clamp((now - Tanim.t0) / Tanim.dur, 0, 1), eu = u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; T = lerp(Tanim.from, Tanim.to, eu); if (Tanim.roll) rollPhi = TAU * Tanim.roll * ease(u); if (u >= 1) { Tanim = null; rollPhi = 0; } }
  rollVel = Tanim || rollPrev ? (rollPhi - rollPrev) / dt : 0; if (Math.abs(rollVel) > 20) rollVel = 0;
  if (look.reset) { var lr = reduce ? 1 : 1 - Math.exp(-dt * 5); look.yaw = Math.atan2(Math.sin(look.yaw), Math.cos(look.yaw)) * (1 - lr); look.pitch *= 1 - lr; look.roll = Math.atan2(Math.sin(look.roll), Math.cos(look.roll)) * (1 - lr); look.zt = 1; if (Math.abs(look.yaw) + Math.abs(look.pitch) + Math.abs(look.roll) + Math.abs(look.zoom - 1) < 2e-3) { look.yaw = look.pitch = look.roll = 0; look.zoom = 1; look.reset = false; } }
  if (!pinching) look.zoom += (look.zt - look.zoom) * (reduce ? 1 : 1 - Math.exp(-dt * 7));
  document.body.classList.toggle('explore', !scene.cam.center);
  Tmoving = Math.abs(T - Tprev) > 1e-5;
  posAt(T);
  yearStr = String(Math.round(2026 - 56 * T)); if (yearEl && yearEl.textContent !== yearStr) yearEl.textContent = yearStr;
  var settled = T > .995;
  if (scene.afterT) sceneEl.classList.toggle('done', settled);
  /* плавные параметры */
  var r = reduce ? 1 : 1 - Math.exp(-dt * 3), since = now - sceneT0;
  A.ground = chase(A.ground, scene.ground || 0, scene.ground ? r * .7 : Math.min(1, r * 4)); A.ecl = chase(A.ecl, scene.ecl || 0, r); A.rib = chase(A.rib, scene.rib || 0, r);
  A.wheel = chase(A.wheel, scene.wheel || 0, reduce ? 1 : 1 - Math.exp(-dt * 1.8)); A.cons = chase(A.cons, scene.cons || 0, r);
  A.stars = chase(A.stars, scene.dim == null ? 1 : scene.dim, r); A.mw = chase(A.mw, scene.mw == null ? 1 : scene.mw, r);
  A.planets = chase(A.planets, scene.planets == null ? 1 : scene.planets, r); A.asc = chase(A.asc, scene.ascHL ? 1 : 0, r);
  for (i = 0; i < NB; i++) {
    var k = KEYS[i], lit = has(scene.hl, k), nm = lit || has(scene.names, k);
    if (scene.seq) for (var j = 0; j < scene.seq.length; j++) if (scene.seq[j][0] === k && since >= scene.seq[j][1]) { lit = true; if (!scene.noNames) nm = true; }
    if (lit && !hlOn[i]) hlOn[i] = now;
    var gl = (scene.glyphs === 'all' || has(scene.glyphs, k)) && (!scene.afterT || settled) && !Tmoving ? 1 : 0;
    glyphA[i] = chase(glyphA[i], gl, r); nameA[i] = chase(nameA[i], nm ? 1 : 0, r); hlA[i] = chase(hlA[i], lit ? 1 : 0, r);
  }
  for (i = 0; i < 12; i++) signA[i] = chase(signA[i], scene.sign === i || (scene.wheel && sel && signOf(P70[IDX[sel]][0]) === i) ? 1 : 0, r);
  if (consTap && now > consTap.until) consTap = null;
  selCons = scene.wheel && sel ? ZCONS[signOf(P70[IDX[sel]][0])] : null; if (selCons && consHL[selCons] == null) consHL[selCons] = 0;
  var id; for (id in consHL) consHL[id] = chase(consHL[id], scene.hlCons === id || selCons === id || (consTap && consTap.id === id) ? 1 : 0, r);
  if (FIGURES) for (id in ART) {
    var wantArt = (scene.hlCons === id && since > 1.6) || (consTap && consTap.id === id && (HERS[id] || scene.wheel)) || selCons === id ? 1 : 0;
    if (wantArt) artLoad(id);
    artA[id] = chase(artA[id] || 0, wantArt, reduce ? 1 : 1 - Math.exp(-dt * 1.8));
  }
  if (scene.hlCons && consHL[scene.hlCons] == null) consHL[scene.hlCons] = 0;
  for (id in starLbl) starLbl[id] = chase(starLbl[id], has(scene.stars, id) && since > 1.2 ? 1 : 0, r);
  if (scene.stars) scene.stars.forEach(function (n) { if (starLbl[n] == null) starLbl[n] = 0; });

  updateCam(now);
  var zx = HZ[0] * R[0] + HZ[1] * R[1] + HZ[2] * R[2], zy = HZ[0] * U[0] + HZ[1] * U[1] + HZ[2] * U[2];
  groundK = clamp(1 - (Math.abs(Math.atan2(zx, zy)) / RAD - 2.5) / 6, 0, 1);
  if (!scene.cam.wheel && !reduce && !tw.from) { cam.cx += Math.sin(now * .23) * 3; cam.cy += Math.cos(now * .19) * 3; }

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H);
  drawGlow(); drawMW(now); drawCons(); drawFigure(); drawStars(now); drawEcliptic(); drawWheel(); drawPlanets(now); drawStarLabels(); drawGround(); drawParticles(now, dt); drawShoot(dt);

  /* если телефон не тянет, снижаем качество */
  fAcc += dt; fN++;
  if (fN >= 90) { var avg = fAcc / fN; fAcc = 0; fN = 0; if (avg > .026 && now > 4) { if (DPR > 1.01) { DPR = Math.max(1, DPR - .5); cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); } else quality = 0; } }
}

var rsT = 0;
function onResize() { clearTimeout(rsT); rsT = setTimeout(function () { var w = window.innerWidth, h = window.innerHeight; if (w === W && h === H) return; layout(); if (!tw.from) retarget(last, true); }, 120); }
window.addEventListener('resize', onResize); window.addEventListener('orientationchange', onResize);
document.addEventListener('visibilitychange', function () { if (document.hidden) sndStop(); else if (snd.on && snd.ctx) sndStart();
  if (document.hidden) running = false; else if (!running) { running = true; last = 0; requestAnimationFrame(frame); } });

DPR = maxDPR; layout();
if (document.fonts && document.fonts.load) {
  Promise.all([document.fonts.load("italic 300 100px 'Cormorant Garamond'", '0123456789'), document.fonts.load("20px 'AstroSym'", '☉♏'), document.fonts.load("500 12px Manrope", 'Солнце')])
    .then(function () { fontsReady = true; shapes = {}; partCur = '\u0000'; }, function () { fontsReady = true; });
  setTimeout(function () { fontsReady = true; }, 2500);
} else fontsReady = true;
requestAnimationFrame(frame);
setTimeout(function () { if (FIGURES) for (var id in HERS) artLoad(id); }, 3500);
window.__snd = { build: sndBuild, schedule: sndSchedule };
window.__sky = { cam: cam, pos: POS, hits: hits, shits: shits, look: look, tap: function (id) { consTap = { id: id, until: last + 60 }; if (consHL[id] == null) consHL[id] = 0; }, scene: function () { return scene; }, state: A };
})();
