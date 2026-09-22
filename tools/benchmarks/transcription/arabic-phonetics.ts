import type { Phrase } from './corpus.ts';
/** Authored drills; phonetic distinctions reviewed against [@levantine_sound_drills_20260921]. */
const rows: [string, string, string, string, string, string][] = [
  ['s-pair', 'Levantine Arabic', 'صيف، سيف.', 'Summer; sword.', 'ṣēf, sēf', 'ص / س · ṣ versus s. Keep the vowel length similar; ṣ is an emphatic s, not sh and not simply louder.'],
  ['t-pair', 'Levantine Arabic', 'طين، تين.', 'Mud; figs.', 'ṭīn, tīn', 'ط / ت · ṭ versus t. The dot marks an emphatic consonant; both words have a long ī.'],
  ['summer', 'Levantine Arabic', 'بالصيف بشرب عصير.', 'In summer I drink juice.', 'biṣ-ṣēf bashrab ʿaṣīr', 'ص + ع · Two emphatic ṣ sounds plus ʿayn. Listen for the effect on the neighboring vowels.'],
  ['plate', 'Levantine Arabic', 'حط الصحن عالطاولة.', 'Put the plate on the table.', 'ḥuṭṭ iṣ-ṣaḥn ʿaṭ-ṭāwle', 'ح + ط + ص + ع · Addressed to one man. Hold doubled ṭ; keep ḥ distinct from ordinary h.'],
  ['potatoes', 'Levantine Arabic', 'بدي بطاطا مع سلطة.', 'I want potatoes with salad.', 'biddī baṭāṭa maʿ salaṭa', 'ط + ع · Three emphatic ṭ sounds in ordinary food words. ʿ at the end of maʿ is a consonant.'],
  ['road', 'Levantine Arabic', 'الطريق طويل.', 'The road is long.', 'iṭ-ṭarīʾ ṭawīl', 'ط · Emphatic ṭ repeated. This urban Levantine reading uses a glottal stop for ق; use the formal q drill below for a uvular q.'],
  ['light', 'Levantine Arabic', 'ضو الغرفة ضعيف.', 'The light in the room is weak.', 'ḍaw il-ghurfe ḍaʿīf', 'ض + غ + ع · ḍ is emphatic d. gh is voiced friction farther back in the mouth, not g followed by h.'],
  ['eggs', 'Levantine Arabic', 'بدي بيض وخبز.', 'I want eggs and bread.', 'biddī bēḍ w-khubiz', 'ض + خ · Hold the long ē; end eggs with emphatic ḍ. kh is one friction sound, not k plus h.'],
  ['juice', 'Levantine Arabic', 'بحب عصير العنب.', 'I like grape juice.', 'baḥibb ʿaṣīr il-ʿinab', 'ح + ع + ص · Contrast breathy ḥ with voiced ʿayn. Neither is an ordinary English h.'],
  ['hot-bread', 'Levantine Arabic', 'بدي خبز سخن.', 'I want hot bread.', 'biddī khubiz sikhin', 'خ · Repeat kh in bread and hot. Compare it with the breathy ح in the juice phrase.'],
  ['small-room', 'Levantine Arabic', 'الغرفة صغيرة.', 'The room is small.', 'il-ghurfe ṣghīre', 'غ + ص · gh is voiced; kh is unvoiced. ṣghīre begins with a consonant cluster.'],
  ['ice-cream', 'Levantine Arabic', 'بدي بوظة.', 'I want ice cream.', 'biddī būẓa', 'ظ · Here ẓ is a Levantine emphatic z. The formal Arabic ظ drill below instead targets emphatic voiced th.'],
  ['q-k', 'Modern Standard Arabic', 'قلب، كلب.', 'Heart; dog.', 'qalb, kalb', 'ق / ك · Formal sound drill: q is made farther back than k. This is intentionally not the urban Levantine glottal-stop reading.'],
  ['h-pair', 'Modern Standard Arabic', 'حَلّ، هَلْ.', 'A solution; whether (question particle).', 'ḥall, hal', 'ح / ه · Formal word drill, not a sentence. ḥ is pharyngeal and breathy; h is ordinary h. The first word also has a doubled l, so this is not a minimal pair.'],
  ['ayn-hamza', 'Modern Standard Arabic', 'عَلَم، أَلَم.', 'A flag; pain.', 'ʿalam, ʾalam', 'ع / ء · Formal contrast: ʿ is a voiced pharyngeal consonant; ʾ is the glottal stop in uh-oh.'],
  ['dhad', 'Modern Standard Arabic', 'ضوء الشمس قوي.', 'The sunlight is strong.', 'ḍawʾ ash-shams qawī', 'ض + ق · Formal Arabic: emphatic d and uvular q. Reading aid uses pause-style endings rather than full case endings.'],
  ['dha', 'Modern Standard Arabic', 'هذا ظل شجرة.', 'This is the shadow of a tree.', 'hādhā ẓill shajara', 'ذ / ظ · Formal Arabic: dh is voiced th as in this; ẓ is its emphatic counterpart. Levantine realizations may differ.'],
  ['th', 'Modern Standard Arabic', 'ثلاثة أطفال.', 'Three children.', 'thalātha aṭfāl', 'ث + ط · Formal Arabic: th is unvoiced as in thin, contrasting with emphatic ṭ. Do not substitute the common Levantine t here.'],
];
export const arabicPhonetics: Phrase[] = rows.map(([id, variety, text, english, pronunciation, tip]) => ({
  id: `arabic-sounds-${id}`, language: 'ar', variety, text, english, pronunciation, tip,
  focus: tip.split(' · ')[0],
}));
