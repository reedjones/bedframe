import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Layout } from '@/components/Layout'
import { App } from '@/components/App'
import 'unfonts.css'
import '@/styles/style.css'

chrome.devtools.panels.create(
  'Bedframe (Panel)',
  'assets/icons/icon-128x128.png',
  'pages/devtools/index.html',
)

chrome.devtools.panels.elements.createSidebarPane(
  'Bedframe (Side Panel)',
  function (panel) {
    panel.setPage('pages/devtools/panel.html')
    panel.setHeight('8ex')
    panel.setObject({
      data: 'Some data to show',
    })
  },
)

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <Layout>
      <App />
    </Layout>
  </StrictMode>,
)
