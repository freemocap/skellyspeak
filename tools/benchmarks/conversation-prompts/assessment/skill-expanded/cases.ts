/** Authored multilingual challenge cases. Translations share a resampling cluster. */
export type Pair = [
    string,
    string?
];
type Row = [
    string,
    string,
    string,
    string,
    Pair,
    Pair,
    Pair,
    string?,
    boolean?
];
const rows: Row[] = [
    ['ownership_book', 'possession', 'direct', 'successful', ['Este libro es mío.'], ['هالكتاب إلي.'], ['هذا الكتاب لي.']],
    ['kinship', 'possession', 'direct', 'successful', ['Ella es mi tía.'], ['هي خالتي.'], ['هي خالتي.']],
    ['assigned_seat', 'possession', 'direct', 'successful', ['Ese es mi asiento.'], ['هدا مقعدي.'], ['ذلك مقعدي.']],
    ['named_bag', 'possession', 'direct', 'successful', ['La bolsa de Omar.'], ['شنطة عمر.'], ['حقيبة عمر.']],
    ['pronoun_owner', 'possession', 'direct', 'successful', ['Es de él.'], ['إله.'], ['إنه له.'], 'Identity unknown; relationship can still be expressed.', true],
    ['name_context', 'possession', 'contextual', 'successful', ['Marta.', '¿De quién es la llave?'], ['مريم.', 'المفتاح لمين؟'], ['مريم.', 'لمن المفتاح؟'], 'Short answer relies on the question.', true],
    ['name_context', 'possession', 'absent', 'not_applicable', ['Marta.'], ['مريم.'], ['مريم.']],
    ['greeting_control', 'possession', 'absent', 'not_applicable', ['Buenos días.', '¿De quién es la llave?'], ['صباح الخير.', 'المفتاح لمين؟'], ['صباح الخير.', 'لمن المفتاح؟']],
    ['unfinished_owner', 'possession', 'direct', 'partial', ['Es de…', '¿De quién es?'], ['هدا تبع…', 'هدا لمين؟'], ['إنه ملك…', 'لمن هذا؟']],
    ['broken_owner', 'possession', 'direct', 'unsuccessful', ['De mi de de.', '¿De quién es?'], ['تبع تبع إلي تبع.', 'هدا لمين؟'], ['ملك لي ملك ملك.', 'لمن هذا؟'], 'Deliberately broken attempt; direct versus unclear is disputed.', true],
    ['quoted_owner', 'possession', 'direct', 'successful', ['Omar dijo: «El coche es mío».'], ['عمر قال: «السيارة إلي».'], ['قال عمر: «السيارة لي».'], 'Possession is reported, not independently asserted ownership.'],
    ['hypothetical_owner', 'possession', 'direct', 'successful', ['Si fuera mío, lo vendería.'], ['لو كان إلي، كنت بعته.'], ['لو كان لي لبعته.'], 'Hypothetical relationship; temporal interpretation differs across forms.', true],
    ['shared_house', 'possession', 'direct', 'successful', ['La casa es de los dos.'], ['البيت لإلنا نحنا الاتنين.'], ['البيت لنا نحن الاثنين.']],
    ['borrowed_bike', 'possession', 'direct', 'successful', ['Uso la bicicleta de Lucía; no es mía.'], ['بستعمل بسكليت ليلى، مو إلي.'], ['أستخدم دراجة ليلى؛ ليست لي.']],
    ['nested_kinship', 'possession', 'direct', 'successful', ['El teléfono del hermano de Ana.'], ['تلفون أخو آنا.'], ['هاتف أخي آنا.']],
    ['past_ownership', 'possession', 'direct', 'successful', ['Esta casa era de mi abuelo.'], ['هالبيت كان لجدي.'], ['كان هذا البيت لجدي.'], 'Also directly expresses past reference.'],
    ['ownership_book', 'possession', 'direct', 'successful', ['Este libro no es mío.'], ['هالكتاب مو إلي.'], ['هذا الكتاب ليس لي.']],
    ['greeting_control', 'possession', 'absent', 'not_applicable', ['Gracias.', 'Este libro es de mi hermano.'], ['شكراً.', 'هالكتاب لأخي.'], ['شكراً.', 'هذا الكتاب لأخي.']],
    ['yesterday_arrival', 'past', 'direct', 'successful', ['Llegué ayer.'], ['وصلت مبارح.'], ['وصلت أمس.']],
    ['implicit_past', 'past', 'direct', 'successful', ['Se cerró la puerta.'], ['تسكر الباب.'], ['أُغلق الباب.']],
    ['ongoing_past', 'past', 'direct', 'successful', ['Estaba cocinando cuando sonó el teléfono.'], ['كنت عم اطبخ لما رن التلفون.'], ['كنت أطبخ عندما رن الهاتف.']],
    ['negated_past', 'past', 'direct', 'successful', ['No salí ayer.'], ['ما طلعت مبارح.'], ['لم أخرج أمس.']],
    ['day_context', 'past', 'contextual', 'successful', ['El martes.', '¿Cuándo llegaste?'], ['يوم التلاتا.', 'إيمتى وصلت؟'], ['يوم الثلاثاء.', 'متى وصلت؟'], 'Context supplies past orientation.', true],
    ['day_context', 'past', 'unclear', 'unclear', ['El martes.'], ['يوم التلاتا.'], ['يوم الثلاثاء.'], 'Absent versus unclear is a rubric boundary.', true],
    ['future_only', 'past', 'absent', 'not_applicable', ['Viajaré mañana.'], ['رح سافر بكرا.'], ['سأسافر غداً.']],
    ['present_only', 'past', 'absent', 'not_applicable', ['Vivo aquí.'], ['أنا ساكن هون.'], ['أسكن هنا.']],
    ['unfinished_past', 'past', 'direct', 'partial', ['Ayer…', '¿Qué hiciste?'], ['مبارح…', 'شو عملت؟'], ['أمس…', 'ماذا فعلت؟'], 'Past anchor present; direct/contextual and completeness are disputed.', true],
    ['imperfect_form', 'past', 'direct', 'successful', ['Ayer yo ir al mercado.'], ['مبارح أنا يروح عالسوق.'], ['أمس أنا يذهب إلى السوق.'], 'Meaning versus grammar accuracy contrast; success label is provisional.', true],
    ['broken_past', 'past', 'direct', 'unsuccessful', ['Ayer de yo que.', '¿Qué pasó ayer?'], ['مبارح من أنا اللي.', 'شو صار مبارح؟'], ['أمس من أنا الذي.', 'ماذا حدث أمس؟'], 'Broken attempt; partial versus unsuccessful is disputed.', true],
    ['reported_past', 'past', 'direct', 'successful', ['Me dijeron que el tren salió temprano.'], ['قالولي إنو القطار طلع بكير.'], ['أخبروني أن القطار غادر مبكراً.']],
    ['future_reference', 'past', 'unclear', 'unclear', ['Para el viernes ya habré terminado.'], ['للجمعة بكون خلصت.'], ['بحلول الجمعة سأكون قد انتهيت.'], 'Earlier than a future reference time, not necessarily before now; unresolved skill boundary.', true],
    ['past_partner_control', 'past', 'absent', 'not_applicable', ['Hola.', 'Ayer fui al cine.'], ['مرحبا.', 'مبارح رحت عالسينما.'], ['مرحباً.', 'أمس ذهبت إلى السينما.']],
    ['age_state', 'past', 'direct', 'successful', ['Cuando era niña, vivía cerca del mar.'], ['لما كنت صغيرة، كنت ساكنة حد البحر.'], ['عندما كنت صغيرة، كنت أسكن قرب البحر.']],
    ['sequence', 'past', 'direct', 'successful', ['Primero cenamos y después salimos.'], ['بالأول تعشينا وبعدين طلعنا.'], ['تناولنا العشاء أولاً ثم خرجنا.']],
    ['past_ownership', 'past', 'direct', 'successful', ['Ayer vendí mi coche.'], ['مبارح بعت سيارتي.'], ['أمس بعت سيارتي.'], 'Also expresses possession.'],
    ['quoted_word', 'past', 'absent', 'not_applicable', ['La palabra «ayer» tiene cuatro letras.'], ['كلمة «مبارح» فيها خمس حروف.'], ['كلمة «أمس» تتكون من ثلاثة أحرف.'], 'Mention of a time word without placing an event in the past.'],
];
export function cases() {
    const langs = [['Spanish', 'Mexico'], ['Arabic', 'Levantine'], ['Arabic', 'MSA']];
    return rows.flatMap((row, i) => langs.map(([language, variety], j) => {
        const [cluster, which, evidence, expression] = row;
        const [learner, partner] = row[4 + j] as Pair;
        const focal = which === 'past' ? 'past_reference' : 'possession_relationships';
        const absent = { evidence: 'absent', expression: 'not_applicable' };
        const targets: any = { possession_relationships: { ...absent }, past_reference: { ...absent } };
        targets[focal] = { evidence, expression };
        if (cluster === 'past_ownership' || cluster === 'quoted_owner')
            targets.past_reference = { evidence: 'direct', expression: 'successful' };
        if (cluster === 'past_ownership')
            targets.possession_relationships = { evidence: 'direct', expression: 'successful' };
        if (cluster === 'hypothetical_owner')
            targets.past_reference = { evidence: 'unclear', expression: 'unclear' };
        return { id: `s${String(i + 1).padStart(2, '0')}-${j}`, cluster, focal, language, variety, input: { learner, ...(partner ? { preceding_partner: partner } : {}) }, targets, contested: row[8] ?? false, review_note: row[7] ?? '', referenceStatus: 'AI-authored provisional reference; not independent linguistic review' };
    }));
}
