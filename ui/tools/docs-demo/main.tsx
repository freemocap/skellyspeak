import { createRoot } from 'react-dom/client'
import { I18nProvider } from '../../src/components/localization/i18n'
import { DemoApp } from './DemoApp'
import '../../src/styles/index.css'
import './demo.css'

createRoot(document.getElementById('root')!).render(<I18nProvider locale="english"><DemoApp /></I18nProvider>)
