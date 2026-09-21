/** Font review only: real reading components, no IPC or generated content. */
import { createRoot } from 'react-dom/client'
import { useEffect, useState, type CSSProperties } from 'react'
import { TargetText } from '../src/components/reading/TargetText'
import { SavedGlossText } from '../src/components/reading/SavedGlossText'
import '../src/styles/index.css'

const samples = [
  ['ja', 'Japanese', 'こんにちは。日本語、学校、音楽。が か\u3099 コーヒー。', 1],
  ['ko', 'Korean', '안녕하세요. 한국어와 음악. 한 한', 1],
  ['vi', 'Vietnamese', 'Xin chào. Tiếng Việt, cảm ơn. ệ e\u0323\u0302', 1],
  ['id', 'Indonesian', 'Halo. Terima kasih. Makanan dan minuman.', 1],
  ['tr', 'Turkish', 'Merhaba. Teşekkür ederim. İ i I ı ç ğ ö ş ü', 1],
  ['ru', 'Russian', 'Здравствуйте. Семья, музыка, ёлка. Ъ ь й', 1],
  ['uk', 'Ukrainian', 'Добрий день. Україна, ґанок, сім’я. Ґ Є І Ї', 1],
  ['chr', 'Cherokee', 'ᎣᏏᏲ. ᏩᏙ. ᏣᎳᎩ. ꮳꮃꭹ', 1],
  ['ar', 'Arabic · Conversation example', 'شُفْتُ بَاب قَدِيم أَزْرَق فِي الْمَشْيَة. هَلْ بِتْحِبّ الْأَبْوَاب الْقَدِيمَة؟', 1.5],
  ['ar', 'Arabic · Diacritic positioning test', 'إِنَّ الشَّمْسَ مُشْرِقَةٌ. هٰذَا كِتَابٌ. مُدَرِّسٌ، بَيْتٌ، قُوَّةٌ، شُكْرًا.', 1.5],
  ['hi', 'Hindi · Devanagari', 'नमस्ते! क्या आप हिंदी पढ़ सकते हैं? क्ष त्र ज्ञ श्र क़ फ़', 1],
  ['ml', 'Malayalam', 'നമസ്കാരം! നിങ്ങൾക്ക് മലയാളം വായിക്കാൻ കഴിയുമോ? ൻ ൽ ൾ ർ ക്ഷ', 1],
  ['zh-Hans', 'Mandarin · Simplified Chinese', '你好！你喜欢读书吗？汉语学习，音乐与朋友。', 1.3],
  ['en', 'English', 'The quick brown fox jumps over the lazy dog.', 1],
  ['es', 'Spanish', '¡Buenos días! ¿Dónde está la biblioteca? Niño, pingüino.', 1],
  ['fr', 'French', 'À bientôt ! Où est la bibliothèque ? Cœur, français.', 1],
  ['de', 'German', 'Grüße! Können wir über Bücher sprechen? Ä Ö Ü ß.', 1],
  ['pt', 'Portuguese', 'Olá! Você gosta de música? Coração, manhã, avó.', 1],
  ['it', 'Italian', 'Ciao! Perché non prendiamo un caffè in città?', 1],
  ['ga', 'Irish', 'Dia duit! Tá Gaeilge á foghlaim agam. É í ó ú.', 1],
  ['gd', 'Scottish Gaelic', 'Halò! Ciamar a tha thu? Tha Gàidhlig agam. À è ì ò ù.', 1],
] as const
const reportedArabic = 'فِكْرِت أَرْسُم بَاب شِفْتُه الْيَوْم. إِنْت بِتِرْسُم كَمَان؟'
const reportedSegments = Array.from(reportedArabic.matchAll(/[^\s]+/gu), match => ({ start: match.index!, end: match.index! + match[0].length, kind: 'gloss' as const, gloss: 'word', romanization: 'reading' }))
const arabic = 'إِنَّ الشَّمْسَ مُشْرِقَةٌ.'
const oldFonts = { '--font-serif': "'Newsreader', Georgia, 'Times New Roman', serif" } as CSSProperties

function Preview() {
  const [size, setSize] = useState(100)
  const [fonts, setFonts] = useState('Loading fonts…')
  useEffect(() => { void document.fonts.ready.then(() => setFonts(Array.from(document.fonts).filter(font => font.status === 'loaded').map(font => font.family).filter((family, index, all) => all.indexOf(family) === index).join(', '))) }, [])
  return <main style={{ maxWidth: 1100, margin: 'auto', padding: 24, height: '100vh', overflow: 'auto', '--reading-scale': size / 100 } as CSSProperties}>
    <h1>Language fonts</h1>
    <p>Local bundled fonts. Left: previous device fallback. Right: current production styles. Same font size.</p>
    <p>Both Arabic examples use the same font rules. The second tests combinations of marks on a letter; it is not a different dialect or writing mode.</p>
    <label>Reading size <input type="range" min="75" max="200" step="25" value={size} onChange={e => setSize(Number(e.target.value))} /> {size}%</label>
    <button onClick={() => { document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark' }}>Toggle theme</button>
    <section style={{ '--script-scale': 1, '--type-reading': '20px' } as CSSProperties}>
      <h2>Arabic font reference · 20px</h2>
      <p>Noto Sans Arabic reference (not the active reading font)</p><div className="msg bot chat-message rtl" style={{ '--font-serif': "'Noto Sans Arabic', serif" } as CSSProperties}><TargetText text="شُفْت بَاب حِلْوَة كْتِير الْيَوْم. صَوَّرْتُه. بُ تِ ثَ شْ يِ نُ مُدَرِّسٌ" /></div>
    </section>
    <section lang="ar" style={{ '--script-scale': 1.5 } as CSSProperties}>
      <h2 lang="en">Arabic message baseline · plain / saved word help</h2>
      <div className="msg bot chat-message rtl"><TargetText text={reportedArabic} /></div>
      <div className="msg bot chat-message rtl"><SavedGlossText text={reportedArabic} segments={reportedSegments} /></div>
    </section>
    {samples.map(([lang, title, text, scale]) => <section key={title} lang={lang} style={{ marginBlock: 24, '--script-scale': scale } as CSSProperties}>
      <h2 lang="en" style={{ fontSize: 16 }}>{title}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 16 }}>
        <div className="msg bot chat-message" data-font-version="old" style={{ ...oldFonts, maxWidth: '100%' }}><TargetText text={text} /></div>
        <div className="msg bot chat-message" data-font-version="new" style={{ maxWidth: '100%' }}><TargetText text={text} /></div>
      </div>
    </section>)}
    <p role="status">Loaded: {fonts}</p>
    <h2>Mixed scripts</h2><p data-font-sample="mixed"><TargetText text="Arabic: مُدَرِّسٌ · Hindi: हिंदी · Malayalam: മലയാളം · Chinese: 中文 · Latin: café" /></p>
    <h2>Reading aids</h2><p className="wroman" data-font-sample="romanization">ḥ ṣ ḍ ṭ ẓ ā ī ū ‘ ’ ʿ ʹ ṅ ñ ṇ ṛ ṝ ḷ ḹ ḻ ṟ ṯ ś ṣ ṃ ḥ ǎ ǐ ǒ ǔ ǚ ḍh — marḥaban, qāḍin, nǐ hǎo</p>
    <h2>Saved word help · shaping and marks</h2>
    <div className="msg bot chat-message" lang="ar" style={{ '--script-scale': 1.5 } as CSSProperties}>
      <SavedGlossText text={arabic} segments={[{ start: 6, end: 14, kind: 'gloss', gloss: 'the sun', romanization: 'al-shams' }]} />
    </div>
    <h2>Composer</h2><textarea className="field composer-input" lang="ar" dir="auto" defaultValue={arabic} style={{ '--script-scale': 1.5 } as CSSProperties} />
  </main>
}
createRoot(document.getElementById('root')!).render(<Preview />)
