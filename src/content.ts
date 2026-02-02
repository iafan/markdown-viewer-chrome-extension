import { marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js'
import { mermaidExtension, renderMermaidDiagrams } from 'marked-mermaid-flowchart'
import { treeExtension, renderTreeBlocks } from 'marked-tree-to-html'
import styles from './styles.css?inline'

// Configure marked with mermaid and tree support
// Order matters: these must be registered before highlight
marked.use({ extensions: [mermaidExtension, treeExtension] })

marked.use(markedHighlight({
  langPrefix: 'hljs language-',
  highlight(code, lang) {
    const language = hljs.getLanguage(lang) ? lang : 'plaintext'
    return hljs.highlight(code, { language }).value
  }
}))

marked.setOptions({
  gfm: true,
  breaks: true,
})

// Store original page state for reverting
let originalHTML: string | null = null
let rawMarkdown: string | null = null
let isPrettified = false

// Key for storing view preference in chrome.storage.session (persists across reloads within session)
const VIEW_PREF_KEY = 'markdown-viewer-raw-mode'

// Storage helpers that use message passing to background script
// This avoids "Access to storage is not allowed from this context" errors on restricted URLs
async function storageGet(storageType: 'local' | 'session', keys: string | string[]): Promise<Record<string, unknown>> {
  return chrome.runtime.sendMessage({ action: 'storage-get', storageType, keys })
}

async function storageSet(storageType: 'local' | 'session', data: Record<string, unknown>): Promise<void> {
  await chrome.runtime.sendMessage({ action: 'storage-set', storageType, data })
}

async function storageRemove(storageType: 'local' | 'session', keys: string | string[]): Promise<void> {
  await chrome.runtime.sendMessage({ action: 'storage-remove', storageType, keys })
}

function isMarkdownFile(): boolean {
  const url = window.location.href.toLowerCase()
  return url.endsWith('.md') || url.endsWith('.markdown')
}

function isRawTextPage(): boolean {
  const body = document.body
  const pre = body.querySelector('pre')

  if (pre && body.children.length === 1) {
    return true
  }

  const contentType = document.contentType
  if (contentType && (contentType.includes('text/plain') || contentType.includes('text/markdown'))) {
    return true
  }

  return false
}

function getMarkdownContent(): string {
  const pre = document.body.querySelector('pre')
  if (pre) {
    return pre.textContent || ''
  }
  return document.body.textContent || ''
}

async function prettifyMarkdown(): Promise<void> {
  if (isPrettified) return

  // Store original state if not already stored
  if (originalHTML === null) {
    originalHTML = document.documentElement.innerHTML
    rawMarkdown = getMarkdownContent()
  }

  const markdown = rawMarkdown || getMarkdownContent()
  if (!markdown.trim()) return

  const html = marked.parse(markdown) as string

  const titleMatch = markdown.match(/^#\s+(.+)$/m)
  const title = titleMatch ? titleMatch[1] : document.title || 'Markdown Viewer'

  const storage = await storageGet('local', 'theme')
  const savedTheme = storage.theme as string | undefined

  document.documentElement.innerHTML = `
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>${styles}</style>
    </head>
    <body>
      <button class="theme-toggle" aria-label="Toggle theme">
        <svg class="icon-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
        <svg class="icon-moon" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      </button>
      <div class="markdown-viewer">
        <article class="markdown-body">
          ${html}
        </article>
      </div>
    </body>
  `

  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme)
  }

  const toggleBtn = document.querySelector('.theme-toggle')
  toggleBtn?.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme')
    let newTheme: string

    if (!currentTheme) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      newTheme = prefersDark ? 'light' : 'dark'
    } else {
      newTheme = currentTheme === 'dark' ? 'light' : 'dark'
    }

    document.documentElement.setAttribute('data-theme', newTheme)
    storageSet('local', { theme: newTheme })
  })

  // Render any mermaid diagrams and tree structures
  await renderMermaidDiagrams()
  renderTreeBlocks()

  isPrettified = true
  storageRemove('session', VIEW_PREF_KEY)
  chrome.runtime.sendMessage({ action: 'set-prettified' })
}

function showRawMarkdown(): void {
  if (!isPrettified || !originalHTML) return

  document.documentElement.innerHTML = originalHTML
  isPrettified = false
  storageSet('session', { [VIEW_PREF_KEY]: true })
  chrome.runtime.sendMessage({ action: 'set-raw' })
}

// Auto-prettify markdown files on load (unless user prefers raw for this tab)
async function init(): Promise<void> {
  if (isMarkdownFile() && isRawTextPage()) {
    const storage = await storageGet('session', VIEW_PREF_KEY)
    const prefersRaw = storage[VIEW_PREF_KEY] === true
    if (!prefersRaw) {
      prettifyMarkdown()
    }
  }
}

init()

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'prettify') {
    prettifyMarkdown()
    sendResponse({ success: true })
  } else if (message.action === 'show-raw') {
    showRawMarkdown()
    sendResponse({ success: true })
  }
  return true
})
