import { arabicPhonetics } from './arabic-phonetics.ts';
/** Authored practice material, not a validated linguistic benchmark. */
export type Language = 'en' | 'es' | 'ar' | 'zh';
export interface Phrase { focus?: string; id: string; language: Language; variety: string; text: string; english: string; pronunciation: string; tip: string }
const rows: [Language, string, string, string, string, string][] = [
  ['en', 'US English', 'Water, please.', 'Water, please.', 'WAW-ter, pleez', 'Start with the short phrase, then try a full sentence.'],
  ['en', 'US English', 'I would like a glass of water.', 'I would like a glass of water.', 'eye wood like uh glass uhv WAW-ter', 'Keep your normal speaking pace.'],
  ['en', 'US English', 'Could you say that again more slowly?', 'Could you say that again more slowly?', 'kood yoo say that uh-GEN mor SLOH-lee', 'Leave a little silence before and after speaking.'],
  ['es', 'Mexican Spanish', 'Agua, por favor.', 'Water, please.', 'AH-gwah, por fah-VOR', 'The vowels stay clear and steady; this is an approximate English reading aid.'],
  ['es', 'Mexican Spanish', 'Quiero un vaso de agua.', 'I want a glass of water.', 'KYEH-roh oon BAH-soh deh AH-gwah', 'Try the short phrase and the sentence as separate takes.'],
  ['es', 'Mexican Spanish', '¿Puedes repetirlo más despacio?', 'Can you repeat it more slowly?', 'PWEH-dehs reh-peh-TEER-loh mahs dehs-PAH-syoh', 'Stress TEER in repetirlo and PAH in despacio.'],
  ['ar', 'Levantine Arabic', 'مي، لو سمحت.', 'Water, please.', 'mayy, law samaḥt', 'ḥ is a breathy sound deep in the throat. Double y in mayy is held briefly.'],
  ['ar', 'Levantine Arabic', 'بدي كاسة مي.', 'I want a glass of water.', 'biddī kāset mayy', 'Double d in biddī is held; ī and ā are long vowels. Dialect spelling can vary.'],
  ['ar', 'Levantine Arabic', 'ممكن تحكي شوي شوي؟', 'Could you speak slowly?', 'mumkin tiḥki shwayy shwayy?', 'sh sounds like ship. This is colloquial Levantine, not formal Arabic.'],
  ['zh', 'Mandarin Chinese', '请给我水。', 'Please give me water.', 'Qǐng gěi wǒ shuǐ.', 'Pinyin marks tones: ˉ level, ˊ rising, ˇ low/dipping, ˋ falling. Tone changes occur in connected speech.'],
  ['zh', 'Mandarin Chinese', '我想喝一杯水。', 'I would like to drink a glass of water.', 'Wǒ xiǎng hē yì bēi shuǐ.', '一 is pronounced yì here. Listen to the phrase rhythm as well as each syllable.'],
  ['zh', 'Mandarin Chinese', '你可以说慢一点吗？', 'Could you speak a little more slowly?', 'Nǐ kěyǐ shuō màn yìdiǎn ma?', 'ma is a light neutral tone. Pinyin is a reading system, not English spelling.'],
  // Append new rows to preserve the IDs used by existing recordings.
  ['en', 'US English', 'Hello, how are you?', 'Hello, how are you?', 'heh-LOH, how ar yoo?', 'Use this greeting as a short baseline.'],
  ['en', 'US English', 'I do not understand.', 'I do not understand.', 'eye doo not un-der-STAND', 'Keep the negative word not audible.'],
  ['en', 'US English', 'Where is the bathroom?', 'Where is the bathroom?', 'wair iz thuh BATH-room?', 'Try it once naturally and once with a short pause after where.'],
  ['en', 'US English', 'How much does this cost?', 'How much does this cost?', 'how much duhz this kost?', 'Listen for whether the recognizer retains the full question.'],
  ['en', 'US English', 'I want tea without sugar.', 'I want tea without sugar.', 'eye wont tee with-OUT SHOO-ger', 'Check whether without is preserved rather than changed to with.'],
  ['en', 'US English', 'Today I want to go to the market and buy bread.', 'Today I want to go to the market and buy bread.', 'tuh-DAY eye wont tuh goh tuh thuh MAR-kit and buy bred', 'A longer sentence adds context; keep the same microphone distance.'],
  ['es', 'Mexican Spanish', 'Hola, ¿cómo estás?', 'Hello, how are you?', 'OH-lah, KOH-moh ehs-TAHS?', 'The h in hola is silent.'],
  ['es', 'Mexican Spanish', 'No entiendo.', 'I do not understand.', 'noh ehn-TYEHN-doh', 'Try to keep the two words connected at a comfortable pace.'],
  ['es', 'Mexican Spanish', '¿Dónde está el baño?', 'Where is the bathroom?', 'DOHN-deh ehs-TAH ehl BAH-nyoh?', 'ñ is a single sound, roughly like ny in canyon.'],
  ['es', 'Mexican Spanish', '¿Cuánto cuesta esto?', 'How much does this cost?', 'KWAHN-toh KWEHS-tah EHS-toh?', 'Both cuánto and cuesta start with a kw sound.'],
  ['es', 'Mexican Spanish', 'Quiero té sin azúcar.', 'I want tea without sugar.', 'KYEH-roh teh seen ah-SOO-kar', 'In Mexican Spanish, the z in azúcar sounds like s.'],
  ['es', 'Mexican Spanish', 'Hoy quiero ir al mercado y comprar pan.', 'Today I want to go to the market and buy bread.', 'oy KYEH-roh eer ahl mehr-KAH-doh ee kohm-PRAR pahn', 'The h in hoy is silent. Keep the final r in comprar audible.'],
  ['ar', 'Levantine Arabic', 'مرحبا، كيفك؟', 'Hello, how are you?', 'marḥaba, kīfak?', 'kīfak addresses a man; kīfik addresses a woman. ḥ is a breathy throat sound.'],
  ['ar', 'Levantine Arabic', 'ما فهمت.', 'I did not understand.', 'mā fhimit', 'ā is a long vowel. This is a common colloquial way to ask for clarification.'],
  ['ar', 'Levantine Arabic', 'وين الحمام؟', 'Where is the bathroom?', 'wēn il-ḥammām?', 'Hold the doubled m briefly; the final ā is long.'],
  ['ar', 'Levantine Arabic', 'قديش حقه؟', 'How much does it cost?', 'ʾaddēsh ḥaʾʾo?', 'This reading uses an urban Levantine glottal stop for ق, like the break in uh-oh.'],
  ['ar', 'Levantine Arabic', 'بدي شاي بلا سكر.', 'I want tea without sugar.', 'biddī shāy bala sukkar', 'Hold the doubled d and k briefly. sh sounds like ship.'],
  ['ar', 'Levantine Arabic', 'اليوم بدي روح عالسوق واشتري خبز.', 'Today I want to go to the market and buy bread.', 'il-yōm biddī rūḥ ʿas-sūʾ w-ishtiri khubiz', 'ʿ is a voiced throat sound; kh is like the ch in Scottish loch. Dialect pronunciation and spelling vary.'],
  ['zh', 'Mandarin Chinese', '你好，你好吗？', 'Hello, how are you?', 'Nǐ hǎo, nǐ hǎo ma?', 'Before another third tone, a third tone is normally pronounced with a rising tone. ma is neutral.'],
  ['zh', 'Mandarin Chinese', '我听不懂。', 'I do not understand what I hear.', 'Wǒ tīng bù dǒng.', 'Keep tīng high and level; dǒng has a low third tone.'],
  ['zh', 'Mandarin Chinese', '洗手间在哪里？', 'Where is the bathroom?', 'Xǐshǒujiān zài nǎlǐ?', 'Pinyin x is a light, forward sh-like sound; it is not English ks.'],
  ['zh', 'Mandarin Chinese', '这个多少钱？', 'How much does this cost?', 'Zhège duōshao qián?', 'ge and shao are light neutral syllables here; qián rises.'],
  ['zh', 'Mandarin Chinese', '我想喝茶，不加糖。', 'I would like tea without added sugar.', 'Wǒ xiǎng hē chá, bù jiā táng.', 'chá and táng both rise. Check whether 不, the negative word, survives transcription.'],
  ['zh', 'Mandarin Chinese', '今天我想去市场买面包。', 'Today I want to go to the market and buy bread.', 'Jīntiān wǒ xiǎng qù shìchǎng mǎi miànbāo.', 'Try a natural pause after 今天. Third-tone sequences change in connected speech.'],

];
const starterPhrases: Phrase[] = rows.map(([language, variety, text, english, pronunciation, tip], i) => ({ id: `practice-${i + 1}`, language, variety, text, english, pronunciation, tip }));
export const phrases: Phrase[] = [...starterPhrases, ...arabicPhonetics];
export const languageNames: Record<Language, string> = { en: 'English', es: 'Spanish', ar: 'Arabic · Levantine & sound drills', zh: 'Chinese · Mandarin' };
