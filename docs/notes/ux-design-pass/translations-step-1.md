# Build step 1 — interface words and draft translations

Status: **implemented 2026-09-27 on branch `ux-design-pass`, uncommitted;
translations are drafts awaiting review by native speakers.** Part of the
[build plan](build-plan.md) and the [vocabulary](README.md#vocabulary).

## What changed

115 English messages became 110 (some merge into one wording), in all seven
interface dictionaries. The catalog went from 1,381 to 1,366 messages. Source
calls, tests, the tour and the design-system preview use the new wording. No
layout changed, apart from the plus icon on New conversation. Internal identifiers,
stored values (`practiceView = 'drill'`, the `live` mode) and native commands are
unchanged.

## Terms per language

| English | Arabic | French | German | Mandarin | Portuguese | Spanish |
| --- | --- | --- | --- | --- | --- | --- |
| Practice (tab) | تدريب | Entraînement | Übung | 练习 | Treino | Práctica |
| card | بطاقة | carte | Karte | 卡片 | cartão | tarjeta |
| attempt | محاولة | tentative | Versuch | 尝试 | tentativa | intento |
| reference | المرجع | référence | Referenz | 参考音频 | referência | referencia |
| partner | الشريك | partenaire | Gesprächspartner | 伙伴 | parceiro | compañero |
| assessment | تقييم | évaluation | Bewertung | 评估 | avaliação | evaluación |
| XP badge | شارة الخبرة | badge XP | XP-Abzeichen | 经验值徽章 | selo de XP | insignia de XP |

- The Practice tab keeps each language's existing word, which already meant
  practice; only Mandarin changes, from 操练 (drill) to 练习.
- The partner words match the existing “Partners” list title in each language.
- Touched German strings use *du* and touched Portuguese strings use Brazilian
  forms, the majority style in each dictionary.
- “Explain in” is translated as the natural label in each language: لغة الشرح,
  Expliquer en, Erklärungssprache, 解释语言, Explicar em, Explicar en.

## Decisions made while applying the words

- **XP cards became XP badges.** Settings called the reward pop-ups “XP cards”,
  which now collides with Practice cards. The code already calls them reward
  badges.
- **“Target” split in two.** The label on the reference playback and its scrubber
  became “Reference”. The label on the card's words in the word comparison and on
  the phone card counter became “Card”.
- **One label per setting.** Settings' “Auto-speak tutor replies” and “Read persona
  replies aloud” became “Read partner replies aloud”. “Auto-send transcriptions”
  and “Send after stopping the microphone” became “Auto-send”. “My native
  language”, “Explanation language” and “Native language” became “Explain in”.
- **Assessed chat messages.** Progress now says “assessment” where it said
  “attempt”. The coach's edit feedback says “this message”.
- **“✚ New chat”** became the icon set's plus icon with “New conversation”, the
  name used everywhere else.

## Left as they are, on purpose

- AI activity's request “attempts”: an inspection term.
- “Experience” and “effort” inside Progress, and the coach pane's Experience tab
  (Stage 2, C7).
- “Practice surface”, the switch's accessible name: step 3 replaces the switch
  with tabs.
- “Grammar practice”, “Practice selection”, “Let the coach decide” and
  “Customize…” on the start screen: step 6 renames them with the new layout.
- Conversation settings' “Read aloud”: Stage 2 regroups those settings (C5, C8).
- Two internal save errors that mention “persona” are raw error text, not
  catalog messages (`useConversationDetails.ts`).
- The website documentation, which is pending its own content audit.

## Draft translations for review

### Practice and cards

| English (was) | Arabic | French | German | Mandarin | Portuguese | Spanish |
| --- | --- | --- | --- | --- | --- | --- |
| **Practice** (was “Drill”) | تدريب | Entraînement | Übung | 练习 | Treino | Práctica |
| **Loading Practice…** (was “Loading drill…”) | جارٍ تحميل التدريب… | Chargement de l’entraînement… | Übung wird geladen… | 正在加载练习… | Carregando o treino… | Cargando práctica… |
| **Add to Practice** (was “Add to Drill”) | إضافة إلى التدريب | Ajouter à l’entraînement | Zur Übung hinzufügen | 添加到练习 | Adicionar ao treino | Añadir a práctica |
| **Remove from Practice** (was “Remove from Drill”) | إزالة من التدريب | Retirer de l’entraînement | Aus der Übung entfernen | 从练习中移除 | Remover do treino | Quitar de práctica |
| **Cards** (was “Drill targets”) | البطاقات | Cartes | Karten | 卡片 | Cartões | Tarjetas |
| **Card** (was “Drill target”) | البطاقة | Carte | Karte | 卡片 | Cartão | Tarjeta |
| **Add cards…** (was “Add drill targets…”) | إضافة بطاقات… | Ajouter des cartes… | Karten hinzufügen… | 添加卡片… | Adicionar cartões… | Añadir tarjetas… |
| **Your cards** (was “Your drill targets”) | بطاقاتك | Vos cartes | Deine Karten | 你的卡片 | Seus cartões | Tus tarjetas |
| **Previous card** (was “Previous drill target”) | البطاقة السابقة | Carte précédente | Vorherige Karte | 上一张卡片 | Cartão anterior | Tarjeta anterior |
| **Next card** (was “Next drill target”) | البطاقة التالية | Carte suivante | Nächste Karte | 下一张卡片 | Próximo cartão | Tarjeta siguiente |
| **This card** (was “This drill target”) | هذه البطاقة | Cette carte | Diese Karte | 此卡片 | Este cartão | Esta tarjeta |
| **Add a card to start practising.** (was “Add a drill target to start practising.”) | أضف بطاقة للبدء. | Ajoutez une carte pour commencer. | Füge eine Karte hinzu, um zu beginnen. | 添加卡片以开始练习。 | Adicione um cartão para começar. | Añade una tarjeta para empezar. |
| **The transcript is in a different script from the card. This does not change the measurement.** (was “The transcript is in a different script from the drill target. This does not change the measurement.”) | يستخدم النص المنسوخ نظام كتابة مختلفًا عن البطاقة. هذا لا يغير القياس. | La transcription utilise une autre écriture que la carte. Cela ne change pas la mesure. | Das Transkript verwendet eine andere Schrift als die Karte. Dies ändert die Messung nicht. | 转写文本与卡片使用不同的文字系统。这不会改变测量结果。 | A transcrição usa uma escrita diferente da do cartão. Isso não altera a medição. | La transcripción usa una escritura distinta a la de la tarjeta. Esto no cambia la medición. |
| **Aim new cards at a recorded skill, or leave unset for general practice.** (was “Aim new drill targets at a recorded skill, or leave unset for general practice.”) | وجّه البطاقات الجديدة إلى مهارة مسجلة، أو اترك الخيار فارغًا للتدريب العام. | Orientez les nouvelles cartes vers une compétence enregistrée, ou laissez ce choix vide pour un entraînement général. | Richte neue Karten auf eine erfasste Fähigkeit aus oder lasse die Auswahl für allgemeine Übungen leer. | 选择已记录的技能作为新卡片的重点，或留空进行一般练习。 | Direcione os novos cartões a uma habilidade registrada ou deixe em branco para praticar em geral. | Orienta las nuevas tarjetas a una habilidad registrada o deja la opción vacía para una práctica general. |
| **Say the card, pause, and say it again. Each pause ends an attempt.** (was “Say the drill target, pause, and say it again. Each pause ends a take.”) | انطق نص البطاقة، ثم توقف قليلًا وكرره. تنهي كل وقفة محاولة. | Prononcez la carte, faites une pause et répétez. Chaque pause termine une tentative. | Sprich die Karte, mache eine Pause und wiederhole sie. Jede Pause beendet einen Versuch. | 说出卡片内容，停顿后再重复。每次停顿结束一次尝试。 | Diga o texto do cartão, faça uma pausa e repita. Cada pausa encerra uma tentativa. | Di la tarjeta, haz una pausa y repítela. Cada pausa termina un intento. |
| **Repeat the card with pauses. Stop finishes the current attempt; queued attempts keep processing.** (was “Repeat the drill target with pauses. Stop finishes the current take; queued takes keep processing.”) | كرر نص البطاقة مع وقفات. ينهي الإيقاف المحاولة الحالية؛ وتستمر معالجة المحاولات المنتظرة. | Répétez la carte avec des pauses. Arrêter termine la tentative actuelle ; les tentatives en attente continuent d’être traitées. | Wiederhole die Karte mit Pausen. Stopp beendet den aktuellen Versuch; wartende Versuche werden weiter verarbeitet. | 停顿着重复卡片内容。停止会结束当前尝试；排队的尝试仍会继续处理。 | Repita o texto do cartão com pausas. Parar encerra a tentativa atual; as tentativas na fila continuam sendo processadas. | Repite la tarjeta con pausas. Detener termina el intento actual; los intentos en cola siguen procesándose. |
| **You can leave this card; the attempt is stored by the app.** (was “You can leave this drill target; the attempt is stored by the app.”) | يمكنك مغادرة هذه البطاقة؛ يحتفظ التطبيق بالمحاولة. | Vous pouvez quitter cette carte ; l’application conserve la tentative. | Du kannst diese Karte verlassen; die App speichert den Versuch. | 你可以离开此卡片；应用会保存本次尝试。 | Você pode sair deste cartão; o aplicativo armazena a tentativa. | Puedes salir de esta tarjeta; la aplicación guarda el intento. |
| **Saves the message as a card. Press again to remove it.** (was “Saves the message as a drill target. Press again to remove it.”) | يحفظ الرسالة كبطاقة. اضغط مجددًا لإزالتها. | Enregistre le message comme carte. Appuyez à nouveau pour le retirer. | Speichert die Nachricht als Karte. Erneut drücken, um sie zu entfernen. | 将消息保存为卡片。再次点击即可移除。 | Salva a mensagem como cartão. Pressione novamente para removê-la. | Guarda el mensaje como tarjeta. Pulsa de nuevo para quitarlo. |
| **Your saved cards. Select one to practise.** (was “Your saved drill targets. Select one to practise.”) | بطاقاتك المحفوظة. اختر واحدة للتدريب. | Vos cartes enregistrées. Sélectionnez-en une pour vous entraîner. | Deine gespeicherten Karten. Wähle eine zum Üben. | 你保存的卡片。选择一张开始练习。 | Seus cartões salvos. Selecione um para praticar. | Tus tarjetas guardadas. Selecciona una para practicar. |
| **Say the card. Recording settings control how recording starts and stops.** (was “Say the drill target. Recording settings control how recording starts and stops.”) | انطق نص البطاقة. تتحكم إعدادات التسجيل في بدء التسجيل وإيقافه. | Prononcez la carte. Les réglages contrôlent le démarrage et l’arrêt de l’enregistrement. | Sprich die Karte. Die Aufnahmeeinstellungen steuern Start und Stopp. | 说出卡片内容。录音设置控制录音如何开始和停止。 | Diga o texto do cartão. As configurações controlam o início e o fim da gravação. | Di la tarjeta. Los ajustes controlan cómo empieza y termina la grabación. |
| **Deletes the attempts and their recordings for this card. This cannot be undone.** (was “Deletes the takes and their recordings for this drill target. This cannot be undone.”) | يحذف المحاولات وتسجيلاتها لهذه البطاقة. لا يمكن التراجع عن ذلك. | Supprime les tentatives et leurs enregistrements pour cette carte. Cette action est irréversible. | Löscht die Versuche und ihre Aufnahmen für diese Karte. Dies kann nicht rückgängig gemacht werden. | 删除此卡片的尝试及其录音。此操作无法撤销。 | Exclui as tentativas e as gravações deste cartão. Esta ação não pode ser desfeita. | Elimina los intentos y sus grabaciones de esta tarjeta. Esta acción no se puede deshacer. |
| **Random card** (was “Random target”) | بطاقة عشوائية | Carte aléatoire | Zufällige Karte | 随机卡片 | Cartão aleatório | Tarjeta aleatoria |
| **Characters matching the card, after {value0}** (was “Characters matching the target, after {value0}”) | الحروف المطابقة للبطاقة، بعد {value0} | Caractères correspondant à la carte, après {value0} | Zeichen, die der Karte entsprechen, nach {value0} | 与卡片一致的字符，经过{value0} | Caracteres que correspondem ao cartão, após {value0} | Caracteres que coinciden con la tarjeta, tras {value0} |
| **The card's words against what was heard. Coloured words differ from the card.** (was “The target words against what was heard. Coloured words differ from the target.”) | كلمات البطاقة مقارنةً بما سُمع. الكلمات الملوّنة تختلف عن البطاقة. | Les mots de la carte comparés à ce qui a été entendu. Les mots colorés diffèrent de la carte. | Die Wörter der Karte im Vergleich zum Gehörten. Farbig markierte Wörter weichen von der Karte ab. | 卡片词语与实际听到内容的对比。带颜色的词语与卡片不同。 | As palavras do cartão comparadas ao que foi ouvido. Palavras coloridas diferem do cartão. | Las palabras de la tarjeta frente a lo que se escuchó. Las palabras coloreadas difieren de la tarjeta. |
| **Add cards** (was “Add phrases”) | إضافة بطاقات | Ajouter des cartes | Karten hinzufügen | 添加卡片 | Adicionar cartões | Añadir tarjetas |
| **Ask for between {value0} and {value1} cards.** (was “Ask for between {value0} and {value1} phrases.”) | اطلب بين {value0} و{value1} بطاقة. | Demandez entre {value0} et {value1} cartes. | Fordere zwischen {value0} und {value1} Karten an. | 请要求 {value0} 到 {value1} 张卡片。 | Peça entre {value0} e {value1} cartões. | Pide entre {value0} y {value1} tarjetas. |
| **Asking for cards…** (was “Asking for phrases…”) | جارٍ طلب البطاقات… | Demande de cartes… | Karten werden angefordert… | 正在请求卡片… | Pedindo cartões… | Pidiendo tarjetas… |
| **Already in your cards** (was “Already in your phrases”) | موجودة في بطاقاتك | Déjà dans vos cartes | Bereits in deinen Karten | 已在你的卡片中 | Já está nos seus cartões | Ya está en tus tarjetas |

### Reference, modes and attempts

| English (was) | Arabic | French | German | Mandarin | Portuguese | Spanish |
| --- | --- | --- | --- | --- | --- | --- |
| **Play reference** (was “Hear it”) | تشغيل المرجع | Écouter la référence | Referenz abspielen | 播放参考音频 | Reproduzir referência | Reproducir referencia |
| **Play the reference once to draw it here.** (was “Hear it once to draw the reference here.”) | شغّل المرجع مرة لرسمه هنا. | Écoutez la référence une fois pour l’afficher ici. | Spiele die Referenz einmal ab, um sie hier zu zeichnen. | 播放一次参考音频，它会显示在这里。 | Reproduza a referência uma vez para desenhá-la aqui. | Reproduce la referencia una vez para dibujarla aquí. |
| **Auto** (was “Live”) | existing string, unchanged |  |  |  |  |  |
| **“Detect attempts” applies to Auto mode.** (was “Auto detection applies to Live mode.”) | ينطبق «اكتشاف المحاولات» على الوضع التلقائي. | « Détecter les tentatives » s’applique au mode Auto. | „Versuche erkennen“ gilt für den Auto-Modus. | “检测尝试”适用于自动模式。 | “Detectar tentativas” se aplica ao modo Auto. | «Detectar intentos» se aplica al modo Auto. |
| **Listening without making attempts.** (was “Live audio without creating takes.”) | استماع دون إنشاء محاولات. | Écoute sans créer de tentatives. | Zuhören, ohne Versuche zu erstellen. | 仅收听，不创建尝试。 | Ouvindo sem criar tentativas. | Escuchando sin crear intentos. |
| **Detect attempts** (was “Auto detect takes”) | اكتشاف المحاولات | Détecter les tentatives | Versuche erkennen | 检测尝试 | Detectar tentativas | Detectar intentos |
| **Recording an attempt** (was “Recording a take”) | يسجّل محاولة | Enregistrement d’une tentative | Versuch wird aufgenommen | 正在录制尝试 | Gravando uma tentativa | Grabando un intento |
| **Attempt failed** (was “Take failed”) | فشلت المحاولة | Échec de la tentative | Versuch fehlgeschlagen | 尝试失败 | A tentativa falhou | El intento falló |
| **Attempt {value0} clipped →** (was “Take {value0} clipped →”) | المحاولة {value0} مقصوصة ← | Tentative {value0} coupée → | Versuch {value0} abgeschnitten → | 第 {value0} 次尝试已截取 → | Tentativa {value0} cortada → | Intento {value0} recortado → |
| **Attempt {value0}** (was “Take {value0}”) | existing string, unchanged |  |  |  |  |  |
| **End an attempt after silence of** (was “End a take after silence of”) | إنهاء المحاولة بعد صمت مدته | Terminer la tentative après un silence de | Versuch beenden nach Stille von | 静音多久后结束本次尝试 | Encerrar a tentativa após silêncio de | Terminar el intento tras un silencio de |
| **Hold the button, or focus it and hold Space. Letting go ends the attempt.** (was “Hold the button, or focus it and hold Space. Letting go ends the take.”) | اضغط مطولًا على الزر، أو ركّز عليه واضغط مطولًا على المسافة. الإفلات ينهي المحاولة. | Maintenez le bouton, ou sélectionnez-le et maintenez Espace. Relâcher termine la tentative. | Halte die Taste gedrückt oder fokussiere sie und halte die Leertaste. Loslassen beendet den Versuch. | 按住按钮，或聚焦后按住空格键。松开即结束本次尝试。 | Mantenha o botão pressionado, ou foque-o e mantenha a barra de espaço. Soltar encerra a tentativa. | Mantén pulsado el botón, o enfócalo y mantén la barra espaciadora. Al soltar termina el intento. |
| **Last {value0} attempts** (was “Last {value0} takes”) | آخر {value0} محاولات | {value0} dernières tentatives | Letzte {value0} Versuche | 最近 {value0} 次尝试 | Últimas {value0} tentativas | Últimos {value0} intentos |
| **Most often different: {value0}, in {value1} of {value2} attempts.** (was “Most often different: {value0}, in {value1} of {value2} takes.”) | الأكثر اختلافًا: {value0}، في {value1} من {value2} محاولات. | Le plus souvent différent : {value0}, dans {value1} tentatives sur {value2}. | Am häufigsten abweichend: {value0}, in {value1} von {value2} Versuchen. | 最常不同的词：{value0}，{value2} 次尝试中有 {value1} 次。 | Mais vezes diferente: {value0}, em {value1} de {value2} tentativas. | La que más cambia: {value0}, en {value1} de {value2} intentos. |
| **Reference and your attempt** (was “Reference and your take”) | المرجع ومحاولتك | La référence et votre tentative | Referenz und dein Versuch | 参考音频与你的尝试 | A referência e a sua tentativa | La referencia y tu intento |
| **This attempt's recording was not kept.** (was “This take's recording was not kept.”) | لم يُحفظ تسجيل هذه المحاولة. | L’enregistrement de cette tentative n’a pas été conservé. | Die Aufnahme dieses Versuchs wurde nicht behalten. | 这次尝试的录音未被保留。 | A gravação desta tentativa não foi mantida. | La grabación de este intento no se guardó. |
| **This attempt's recording was removed by the storage limit.** (was “This take's recording was removed by the storage limit.”) | أزال حد التخزين تسجيل هذه المحاولة. | L’enregistrement de cette tentative a été supprimé par la limite de stockage. | Die Aufnahme dieses Versuchs wurde durch das Speicherlimit entfernt. | 这次尝试的录音已因存储上限被删除。 | A gravação desta tentativa foi removida pelo limite de armazenamento. | La grabación de este intento se eliminó por el límite de almacenamiento. |
| **Transcript match by attempt, oldest to newest: {value0}** (was “Transcript match by take, oldest to newest: {value0}”) | مطابقة النص لكل محاولة، من الأقدم إلى الأحدث: {value0} | Correspondance de la transcription par tentative, de la plus ancienne à la plus récente : {value0} | Transkript-Übereinstimmung je Versuch, von alt nach neu: {value0} | 每次尝试的转写匹配度，从旧到新：{value0} | Correspondência da transcrição por tentativa, da mais antiga à mais recente: {value0} | Coincidencia de la transcripción por intento, del más antiguo al más reciente: {value0} |
| **{value0}; attempts start above {value1}** (was “{value0}; takes start above {value1}”) | {value0}؛ تبدأ المحاولات فوق {value1} | {value0} ; les tentatives commencent au-dessus de {value1} | {value0}; Versuche beginnen über {value1} | {value0}；高于 {value1} 时开始尝试 | {value0}; as tentativas começam acima de {value1} | {value0}; los intentos empiezan por encima de {value1} |
| **Attempt {value0} · {value1} queued · {value2} ignored** (was “Take {value0} · {value1} queued · {value2} ignored”) | المحاولة {value0} · {value1} في الانتظار · {value2} متجاهَلة | Tentative {value0} · {value1} en attente · {value2} ignorées | Versuch {value0} · {value1} ausstehend · {value2} ignoriert | 第 {value0} 次尝试 · {value1} 个待处理 · 已忽略 {value2} 个 | Tentativa {value0} · {value1} na fila · {value2} ignoradas | Intento {value0} · {value1} en cola · {value2} ignorados |
| **Room noise {value0} · attempts start above {value1}** (was “Room noise {value0} · takes start above {value1}”) | ضجيج الغرفة {value0} · تبدأ المحاولات فوق {value1} | Bruit ambiant {value0} · les tentatives commencent au-dessus de {value1} | Raumrauschen {value0} · Versuche beginnen über {value1} | 环境噪声 {value0} · 高于 {value1} 时开始尝试 | Ruído ambiente {value0} · as tentativas começam acima de {value1} | Ruido ambiente {value0} · los intentos empiezan por encima de {value1} |
| **Clear attempts…** (was “Clear takes…”) | مسح المحاولات… | Effacer des tentatives… | Versuche löschen… | 清除尝试… | Limpar tentativas… | Borrar intentos… |
| **All attempts** (was “All takes”) | كل المحاولات | Toutes les tentatives | Alle Versuche | 全部尝试 | Todas as tentativas | Todos los intentos |
| **Delete attempt {value0}** (was “Delete take {value0}”) | حذف المحاولة {value0} | Supprimer la tentative {value0} | Versuch {value0} löschen | 删除第 {value0} 次尝试 | Apagar tentativa {value0} | Borrar intento {value0} |
| **Attempts start above {value0}** (was “Takes start above {value0}”) | تبدأ المحاولات فوق {value0} | Les tentatives commencent au-dessus de {value0} | Versuche beginnen über {value0} | 高于 {value0} 时开始尝试 | As tentativas começam acima de {value0} | Los intentos empiezan por encima de {value0} |
| **Record an attempt** (was “Record a take”) | existing string, unchanged |  |  |  |  |  |
| **Plays your attempt. Its spectrogram sits under the reference for comparison.** (was “Plays your take. Its spectrogram sits under the reference for comparison.”) | يشغّل محاولتك. يظهر مخططها الطيفي أسفل المرجع للمقارنة. | Lit votre tentative. Son spectrogramme apparaît sous la référence pour comparaison. | Spielt deinen Versuch ab. Sein Spektrogramm liegt zum Vergleich unter der Referenz. | 播放你的尝试。其声谱图会显示在参考录音下方以便比较。 | Reproduz a sua tentativa. O espectrograma dela fica abaixo da referência para comparação. | Reproduce tu intento. Su espectrograma se muestra debajo de la referencia para comparar. |
| **Your attempt** (was “Your take”) | محاولتك | Votre tentative | Dein Versuch | 你的尝试 | Sua tentativa | Tu intento |
| **Select an attempt to inspect its words and timing.** (was “Select a take to inspect its words and timing.”) | اختر محاولة لفحص كلماتها وتوقيتها. | Sélectionnez une tentative pour examiner ses mots et leur chronologie. | Wähle einen Versuch, um seine Wörter und Zeitpunkte zu untersuchen. | 选择一次尝试以查看其词语和时间信息。 | Selecione uma tentativa para examinar as palavras e os tempos. | Selecciona un intento para revisar sus palabras y tiempos. |
| **Auto-send** (was “Auto-send transcriptions”, “Send after stopping the microphone”) | existing string, unchanged |  |  |  |  |  |
| **Automatically dismiss new XP badges** (was “Automatically dismiss new XP cards”) | إغلاق شارات نقاط الخبرة الجديدة تلقائيًا | Fermer automatiquement les nouveaux badges XP | Neue XP-Abzeichen automatisch schließen | 自动关闭新的经验值徽章 | Fechar automaticamente os novos selos de XP | Cerrar automáticamente las nuevas insignias de XP |

### XP, Progress and assessments

| English (was) | Arabic | French | German | Mandarin | Portuguese | Spanish |
| --- | --- | --- | --- | --- | --- | --- |
| **XP** (was “Practice XP”) | نقاط الخبرة | XP | XP | 经验值 | XP | XP |
| **Total XP** (was “Total practice XP”) | إجمالي نقاط الخبرة | Total des XP | Gesamte XP | 总经验值 | Total de XP | XP totales |
| **{value0} XP** (was “{value0} practice XP”) | نقاط خبرة {value0} | XP de {value0} | XP für {value0} | {value0} 经验值 | XP de {value0} | XP de {value0} |
| **Progress** (was “Practice progress”) | existing string, unchanged |  |  |  |  |  |
| **Use this in a conversation** (was “Practise this in conversation”) | استخدم هذا في محادثة | Utiliser ceci dans une conversation | In einem Gespräch verwenden | 在对话中使用 | Usar isto em uma conversa | Usar esto en una conversación |
| **Dates with assessments (UTC)** (was “Practice dates (UTC)”) | تواريخ التقييمات (UTC) | Dates avec évaluations (UTC) | Tage mit Bewertungen (UTC) | 有评估的日期（UTC） | Datas com avaliações (UTC) | Fechas con evaluaciones (UTC) |
| **XP, saved conversations, assessed messages and dates with assessments across all languages.** (was “Practice XP, saved conversations, recorded attempts and practice dates across all languages.”) | نقاط الخبرة، والمحادثات المحفوظة، والرسائل المقيَّمة، وتواريخ التقييمات عبر جميع اللغات. | XP, conversations enregistrées, messages évalués et dates avec évaluations, toutes langues confondues. | XP, gespeicherte Unterhaltungen, bewertete Nachrichten und Tage mit Bewertungen über alle Sprachen hinweg. | 所有语言的经验值、已保存对话、已评估消息和有评估的日期。 | XP, conversas salvas, mensagens avaliadas e datas com avaliações em todos os idiomas. | XP, conversaciones guardadas, mensajes evaluados y fechas con evaluaciones en todos los idiomas. |
| **Opens your XP and skills.** (was “Opens your practice XP and skills.”) | يفتح نقاط خبرتك ومهاراتك. | Ouvre vos XP et vos compétences. | Öffnet deine XP und Fähigkeiten. | 打开你的经验值和技能。 | Abre o seu XP e as suas habilidades. | Abre tus XP y tus habilidades. |
| **Nothing recorded in this selection yet.** (was “No recorded practice in this selection yet.”) | لا يوجد شيء مسجل لهذا الاختيار بعد. | Rien d’enregistré dans cette sélection. | Für diese Auswahl wurde noch nichts erfasst. | 此选择范围内尚无记录。 | Ainda não há nada registrado nesta seleção. | Todavía no hay nada registrado en esta selección. |
| **Exclude assessment** (was “Exclude attempt”) | استبعاد التقييم | Exclure l’évaluation | Bewertung ausschließen | 排除评估 | Excluir avaliação | Excluir evaluación |
| **Exclude assessment from progress** (was “Exclude attempt from progress”) | استبعاد التقييم من التقدم | Exclure l’évaluation de la progression | Bewertung vom Fortschritt ausschließen | 从进度中排除此评估 | Excluir avaliação do progresso | Excluir evaluación del progreso |
| **Excluded · restore assessment** (was “Excluded · restore attempt”) | مستبعد · استعادة التقييم | Exclue · rétablir l’évaluation | Ausgeschlossen · Bewertung wiederherstellen | 已排除 · 恢复评估 | Excluída · restaurar avaliação | Excluida · restaurar evaluación |
| **Restore assessment** (was “Restore attempt”) | استعادة التقييم | Rétablir l’évaluation | Bewertung wiederherstellen | 恢复评估 | Restaurar avaliação | Restaurar evaluación |
| **No feedback was saved for this message.** (was “No feedback was saved for this attempt.”) | existing string, unchanged |  |  |  |  |  |
| **The coach is still reviewing this message.** (was “The coach is still reviewing this attempt.”) | لا يزال المدرب يراجع هذه الرسالة. | Le coach examine encore ce message. | Der Coach prüft diese Nachricht noch. | 教练仍在评估此消息。 | O coach ainda está avaliando esta mensagem. | El coach sigue revisando este mensaje. |
| **Only current saved evidence and current criteria count. Editing, deleting or excluding assessments can reduce totals. Previous criteria remain in history. Your language total includes other conversations. Text transcripts do not establish pronunciation, listening or retention.** (was “Only current saved evidence and current criteria count. Editing, deleting or excluding attempts can reduce totals. Previous criteria remain in history. Your language total includes other conversations. Text transcripts do not establish pronunciation, listening or retention.”) | تُحتسب الأدلة المحفوظة والمعايير الحالية فقط. قد يخفض تعديل التقييمات أو حذفها أو استبعادها المجاميع. تبقى المعايير السابقة في السجل. يشمل إجمالي اللغة محادثات أخرى. النصوص المفرغة لا تثبت النطق أو الاستماع أو الاحتفاظ. | Seules les preuves enregistrées et les critères actuels comptent. Modifier, supprimer ou exclure des évaluations peut réduire les totaux. Les anciens critères restent dans l’historique. Le total de la langue inclut d’autres conversations. Les transcriptions ne prouvent ni prononciation, ni écoute, ni rétention. | Nur aktuelle gespeicherte Belege und Kriterien zählen. Bearbeiten, Löschen oder Ausschließen von Bewertungen kann Summen senken. Frühere Kriterien bleiben im Verlauf. Die Sprachsumme enthält andere Gespräche. Transkripte belegen weder Aussprache noch Hörverstehen oder Behalten. | 仅计入当前保存的证据和当前标准。编辑、删除或排除评估可能降低总数。旧标准保留在历史中。语言总数包含其他对话。文本转写不能证明发音、听力或记忆保持能力。 | Somente evidências salvas e critérios atuais contam. Editar, excluir ou desconsiderar avaliações pode reduzir os totais. Critérios anteriores permanecem no histórico. O total do idioma inclui outras conversas. Transcrições não comprovam pronúncia, compreensão auditiva ou retenção. | Solo cuentan las evidencias guardadas y los criterios actuales. Editar, eliminar o excluir evaluaciones puede reducir los totales. Los criterios anteriores siguen en el historial. El total del idioma incluye otras conversaciones. Las transcripciones no demuestran pronunciación, escucha ni retención. |
| **Global XP is the sum of separate language accounts, not a combined proficiency score. Activity counts cover retained records: conversations with learner text, assessed messages, and distinct UTC dates with assessments. Deleted records can reduce these counts.** (was “Global XP is the sum of separate language accounts, not a combined proficiency score. Activity counts cover retained records: conversations with learner text, assessment attempts, and distinct UTC dates with attempts. Deleted records can reduce these counts.”) | الخبرة العامة مجموع حسابات لغات منفصلة وليست درجة كفاءة موحدة. تشمل الأعداد السجلات المحفوظة: محادثات بنص المتعلم والرسائل المقيَّمة وتواريخ UTC المختلفة للتقييمات. قد يخفض حذف السجلات هذه الأعداد. | Les XP globaux additionnent des comptes par langue, pas un score global de maîtrise. Les comptes couvrent les conversations conservées avec texte de l’apprenant, les messages évalués et les dates UTC distinctes avec évaluations. Supprimer des données peut réduire ces comptes. | Globale XP summieren getrennte Sprachkonten, keine gemeinsame Kompetenzbewertung. Aktivitätszahlen umfassen aufbewahrte Gespräche mit Lerntext, bewertete Nachrichten und unterschiedliche UTC-Daten mit Bewertungen. Gelöschte Datensätze können diese Zahlen senken. | 全局经验值是各语言账户之和，并非综合能力分数。活动计数涵盖保留记录：含学习者文本的对话、已评估消息及有评估的不同 UTC 日期。删除记录可能降低计数。 | Os XP globais somam contas separadas por idioma, não formam uma pontuação conjunta de proficiência. As contagens abrangem registros mantidos: conversas com texto do aprendiz, mensagens avaliadas e datas UTC distintas com avaliações. Exclusões podem reduzir as contagens. | Los XP globales suman cuentas separadas por idioma, no una competencia conjunta. Los recuentos incluyen conversaciones conservadas con texto del aprendiz, mensajes evaluados y fechas UTC distintas con evaluaciones. Eliminar registros puede reducirlos. |
| **No current credit. An unchanged retry does not add credit; excluded assessments do not contribute to totals.** (was “No current credit. An unchanged retry does not add credit; excluded attempts do not contribute to totals.”) | لا نقاط محتسبة حاليًا. لا تضيف إعادة المحاولة دون تعديل نقاطًا، ولا تدخل التقييمات المستبعدة في المجاميع. | Aucun crédit actuel. Un nouvel essai sans modification n’ajoute aucun crédit ; les évaluations exclues ne contribuent pas aux totaux. | Derzeit keine Anrechnung. Eine unveränderte Wiederholung bringt keine weiteren Punkte; ausgeschlossene Bewertungen zählen nicht zu den Summen. | 当前未计分。未修改的重试不增加积分；被排除的评估不计入总数。 | Sem crédito atual. Um reenvio sem alterações não acrescenta crédito; avaliações excluídas não contribuem para os totais. | Sin crédito actual. Un reintento sin cambios no suma crédito; las evaluaciones excluidas no contribuyen a los totales. |
| **Fast mode · dismiss XP badges automatically** (was “Fast mode · dismiss XP cards automatically”) | الوضع السريع · إخفاء شارات الخبرة تلقائياً | Mode rapide · fermer automatiquement les badges XP | Schnellmodus · XP-Abzeichen automatisch schließen | 快速模式 · 自动关闭经验值徽章 | Modo rápido · dispensar selos de XP automaticamente | Modo rápido · cerrar insignias de XP automáticamente |
| **Show XP badges, progress bars and reward sounds** (was “Show XP cards, progress bars and reward sounds”) | عرض شارات نقاط الخبرة وأشرطة التقدم وأصوات المكافآت | Afficher les badges XP, les barres de progression et les sons de récompense | XP-Abzeichen, Fortschrittsbalken und Belohnungstöne anzeigen | 显示经验值徽章、进度条和奖励音效 | Mostrar selos de XP, barras de progresso e sons de recompensa | Mostrar insignias de XP, barras de progreso y sonidos de recompensa |

### Partner

| English (was) | Arabic | French | German | Mandarin | Portuguese | Spanish |
| --- | --- | --- | --- | --- | --- | --- |
| **+ New partner…** (was “+ New persona…”) | + شريك جديد… | + Nouveau partenaire… | + Neuer Gesprächspartner… | + 新建伙伴… | + Novo parceiro… | + Nuevo compañero… |
| **· Changes apply to this partner’s next replies across conversations.** (was “· Changes apply to this contact’s next replies across conversations.”) |  · تنطبق التغييرات على ردود هذا الشريك التالية عبر المحادثات. |  · Les modifications s’appliquent aux prochaines réponses de ce partenaire dans toutes les conversations. |  · Änderungen gelten für die nächsten Antworten dieses Gesprächspartners in allen Gesprächen. |  · 更改适用于此伙伴在所有对话中的后续回复。 |  · As alterações valem para as próximas respostas deste parceiro em todas as conversas. |  · Los cambios se aplican a las próximas respuestas de este compañero en todas las conversaciones. |
| **Partner** (was “Contact”, “Persona”) | الشريك | Partenaire | Gesprächspartner | 伙伴 | Parceiro | Compañero |
| **Partners** (was “Contacts”) | existing string, unchanged |  |  |  |  |  |
| **Edit partner** (was “Edit persona”) | تعديل الشريك | Modifier le partenaire | Gesprächspartner bearbeiten | 编辑伙伴 | Editar parceiro | Editar compañero |
| **Generating a partner** (was “Generating a persona”) | جارٍ إنشاء الشريك | Génération du partenaire | Gesprächspartner wird generiert | 正在生成伙伴 | Gerando parceiro | Generando compañero |
| **Generating a partner…** (was “Generating a persona…”) | جارٍ إنشاء الشريك… | Génération du partenaire… | Gesprächspartner wird generiert… | 正在生成伙伴… | Gerando parceiro… | Generando compañero… |
| **New partner** (was “New persona”) | شريك جديد | Nouveau partenaire | Neuer Gesprächspartner | 新建伙伴 | Novo parceiro | Nuevo compañero |
| **New partner…** (was “New persona…”) | شريك جديد… | Nouveau partenaire… | Neuer Gesprächspartner… | 新建伙伴… | Novo parceiro… | Nuevo compañero… |
| **No partner** (was “No persona”) | لا شريك | Aucun partenaire | Kein Gesprächspartner | 无伙伴 | Sem parceiro | Sin compañero |
| **No recorded partner generations.** (was “No recorded persona generations.”) | لا عمليات إنشاء شركاء مسجلة. | Aucune génération de partenaire enregistrée. | Keine Gesprächspartner-Generierungen erfasst. | 暂无伙伴生成记录。 | Nenhuma geração de parceiro registrada. | No hay generaciones de compañero registradas. |
| **Partner generation · Global** (was “Persona generation · Global”) | إنشاء الشريك · عام | Génération de partenaire · Global | Gesprächspartner-Generierung · Global | 伙伴生成 · 全局 | Geração de parceiro · Global | Generación de compañero · Global |
| **Partner profile** (was “Persona profile”) | ملف الشريك | Profil du partenaire | Profil des Gesprächspartners | 伙伴档案 | Perfil do parceiro | Perfil del compañero |
| **Read partner replies aloud** (was “Read persona replies aloud”, “Auto-speak tutor replies”) | قراءة ردود الشريك بصوت عالٍ | Lire les réponses du partenaire à voix haute | Antworten des Gesprächspartners vorlesen | 朗读伙伴回复 | Ler respostas do parceiro em voz alta | Leer respuestas del compañero en voz alta |
| **Saving partner** (was “Saving persona”) | جارٍ حفظ الشريك | Enregistrement du partenaire | Gesprächspartner wird gespeichert | 正在保存伙伴 | Salvando parceiro | Guardando compañero |
| **No partner for this language yet** (was “No contact for this language yet”) | لا شريك لهذه اللغة بعد | Aucun partenaire pour cette langue | Noch kein Gesprächspartner für diese Sprache | 此语言暂无伙伴 | Ainda não há parceiro para este idioma | Aún no hay compañero para este idioma |
| **Translate partner message** (was “Translate persona message”) | ترجمة رسالة الشريك | Traduire le message du partenaire | Nachricht des Gesprächspartners übersetzen | 翻译伙伴消息 | Traduzir mensagem do parceiro | Traducir mensaje del compañero |
| **Use partner details** (was “Use persona details”) | استخدم تفاصيل الشريك | Utiliser les détails du partenaire | Details des Gesprächspartners verwenden | 使用伙伴详情 | Usar detalhes do parceiro | Usar detalles del compañero |
| **Partner background** (was “Persona background”) | خلفية الشريك | Contexte du partenaire | Hintergrund des Gesprächspartners | 伙伴背景 | Contexto do parceiro | Trasfondo del compañero |
| **Let the partner decide** (was “Let the persona decide”) | دع الشريك يقرر | Laisser le partenaire décider | Den Gesprächspartner entscheiden lassen | 让伙伴决定 | Deixar o parceiro decidir | Que decida el compañero |

### Conversation, Explain in, AI activity, Auto-send

| English (was) | Arabic | French | German | Mandarin | Portuguese | Spanish |
| --- | --- | --- | --- | --- | --- | --- |
| **Assessed messages** (was “Recorded attempts”) | الرسائل المقيَّمة | Messages évalués | Bewertete Nachrichten | 已评估消息 | Mensagens avaliadas | Mensajes evaluados |
| **New conversation** (was “✚ New chat”) | existing string, unchanged |  |  |  |  |  |
| **Conversation** (was “Chat”) | محادثة  | Conversation  | Gespräch  | 对话  | Conversa  | Conversación  |
| **Hide conversation settings** (was “Hide chat settings”) | إخفاء إعدادات المحادثة | Masquer les paramètres de la conversation | Gesprächseinstellungen ausblenden | 隐藏对话设置 | Ocultar configurações da conversa | Ocultar ajustes de la conversación |
| **Show conversation settings** (was “Show chat settings”) | عرض إعدادات المحادثة | Afficher les paramètres de la conversation | Gesprächseinstellungen anzeigen | 显示对话设置 | Mostrar configurações da conversa | Mostrar ajustes de la conversación |
| **From your conversations** (was “From your chats”) | من محادثاتك | De vos conversations | Aus deinen Gesprächen | 来自你的对话 | Das suas conversas | De tus conversaciones |
| **Taken from your conversations, exactly as written there.** (was “Taken from your chats, exactly as written there.”) | مأخوذة من محادثاتك كما كُتبت تمامًا. | Tirées de vos conversations, exactement telles qu’écrites. | Aus deinen Gesprächen übernommen, genau wie dort geschrieben. | 取自你的对话，与原文完全一致。 | Retiradas das suas conversas, tal como estão escritas. | Tomadas de tus conversaciones, tal como están escritas allí. |
| **Lines from your conversations** (was “Lines from your chats”) | جمل من محادثاتك | Phrases de vos conversations | Zeilen aus deinen Gesprächen | 来自你的对话的句子 | Frases das suas conversas | Frases de tus conversaciones |
| **Explain in** (was “My native language”, “Explanation language”, “Native language”) | لغة الشرح | Expliquer en | Erklärungssprache | 解释语言 | Explicar em | Explicar en |
| **AI activity** (was “AI activity & tools”) | existing string, unchanged |  |  |  |  |  |
| **AI activity view** (was “AI view mode”) | عرض نشاط الذكاء الاصطناعي | Vue de l’activité IA | Ansicht der KI-Aktivität | AI 活动视图 | Visualização da atividade de IA | Vista de la actividad de IA |

## Added in step 4

Drafts for native review, like the tables above. Plural labels for the list
and panel became “Practice cards” at Jon's request; a single card stays “card”
(Previous card, Next card, Random card, This card, “Card 1 / 2”). Removed: ““Detect
attempts” applies to Auto mode.”, now shown by the control's place in the panel.

| English (was) | Arabic | French | German | Mandarin | Portuguese | Spanish |
| --- | --- | --- | --- | --- | --- | --- |
| **Type** (new) | كتابة | Écrire | Schreiben | 输入 | Digitar | Escribir |
| **Press the microphone to start** (new) | اضغط على الميكروفون للبدء | Appuyez sur le micro pour commencer | Drücke auf das Mikrofon, um zu beginnen | 按下麦克风开始 | Pressione o microfone para começar | Pulsa el micrófono para empezar |
| **Coming soon** (new) | قريبًا | Bientôt disponible | Demnächst verfügbar | 即将推出 | Em breve | Próximamente |
| **Resize the reference** (new) | تغيير حجم المرجع | Redimensionner la référence | Referenzbereich anpassen | 调整参考区域大小 | Redimensionar a referência | Cambiar el tamaño de la referencia |
| **Resize the attempt** (new) | تغيير حجم المحاولة | Redimensionner la tentative | Versuchsbereich anpassen | 调整尝试区域大小 | Redimensionar a tentativa | Cambiar el tamaño del intento |
| **Practice cards** (was “Cards”) | بطاقات التدريب | Cartes d’entraînement | Übungskarten | 练习卡片 | Cartões de treino | Tarjetas de práctica |
| **Add practice cards…** (was “Add cards…”) | إضافة بطاقات تدريب… | Ajouter des cartes d’entraînement… | Übungskarten hinzufügen… | 添加练习卡片… | Adicionar cartões de treino… | Añadir tarjetas de práctica… |
| **Add practice cards** (was “Add cards”) | إضافة بطاقات تدريب | Ajouter des cartes d’entraînement | Übungskarten hinzufügen | 添加练习卡片 | Adicionar cartões de treino | Añadir tarjetas de práctica |
| **Your practice cards** (was “Your cards”) | بطاقات تدريبك | Vos cartes d’entraînement | Deine Übungskarten | 你的练习卡片 | Seus cartões de treino | Tus tarjetas de práctica |
| **Your saved practice cards. Select one to practise.** (was “Your saved cards. Select one to practise.”) | بطاقات تدريبك المحفوظة. اختر واحدة للتدريب. | Vos cartes d’entraînement enregistrées. Sélectionnez-en une pour vous entraîner. | Deine gespeicherten Übungskarten. Wähle eine zum Üben. | 你保存的练习卡片。选择一张开始练习。 | Seus cartões de treino salvos. Selecione um para praticar. | Tus tarjetas de práctica guardadas. Selecciona una para practicar. |
| **Aim new practice cards at a recorded skill, or leave unset for general practice.** (was “Aim new cards at a recorded skill, or leave unset for general practice.”) | وجّه بطاقات التدريب الجديدة إلى مهارة مسجلة، أو اترك الخيار فارغًا للتدريب العام. | Orientez les nouvelles cartes d’entraînement vers une compétence enregistrée, ou laissez ce choix vide pour un entraînement général. | Richte neue Übungskarten auf eine erfasste Fähigkeit aus oder lasse die Auswahl für allgemeine Übungen leer. | 选择已记录的技能作为新练习卡片的重点，或留空进行一般练习。 | Direcione os novos cartões de treino a uma habilidade registrada ou deixe em branco para praticar em geral. | Orienta las nuevas tarjetas de práctica a una habilidad registrada o deja la opción vacía para una práctica general. |
| **Ask for between {value0} and {value1} practice cards.** (was “Ask for between {value0} and {value1} cards.”) | اطلب بين {value0} و{value1} بطاقة تدريب. | Demandez entre {value0} et {value1} cartes d’entraînement. | Fordere zwischen {value0} und {value1} Übungskarten an. | 请要求 {value0} 到 {value1} 张练习卡片。 | Peça entre {value0} e {value1} cartões de treino. | Pide entre {value0} y {value1} tarjetas de práctica. |
| **Asking for practice cards…** (was “Asking for cards…”) | جارٍ طلب بطاقات التدريب… | Demande de cartes d’entraînement… | Übungskarten werden angefordert… | 正在请求练习卡片… | Pedindo cartões de treino… | Pidiendo tarjetas de práctica… |
| **Already in your practice cards** (was “Already in your cards”) | موجودة في بطاقات تدريبك | Déjà dans vos cartes d’entraînement | Bereits in deinen Übungskarten | 已在你的练习卡片中 | Já está nos seus cartões de treino | Ya está en tus tarjetas de práctica |
