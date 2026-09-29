import { createRoot } from 'react-dom/client'
import '@fontsource-variable/fredoka'
import '@fontsource-variable/baloo-bhaijaan-2'
import './styles.css'
import App from './App.jsx'
import { I18nProvider } from './i18n.jsx'

createRoot(document.getElementById('root')).render(
  <I18nProvider>
    <App />
  </I18nProvider>,
)
