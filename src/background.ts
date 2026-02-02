// Track which tabs are in prettified mode
const prettifiedTabs = new Set<number>()

// Create context menu item on extension install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'toggle-markdown-view',
    title: 'Prettify Markdown',
    contexts: ['page'],
  })
})

// Update context menu title based on tab state
function updateContextMenu(tabId: number) {
  const isPrettified = prettifiedTabs.has(tabId)
  chrome.contextMenus.update('toggle-markdown-view', {
    title: isPrettified ? 'View raw Markdown' : 'Prettify Markdown',
  })
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'toggle-markdown-view' && tab?.id) {
    const isPrettified = prettifiedTabs.has(tab.id)
    chrome.tabs.sendMessage(tab.id, {
      action: isPrettified ? 'show-raw' : 'prettify',
    })
  }
})

// Handle toolbar icon click - toggle view
chrome.action.onClicked.addListener((tab) => {
  if (tab?.id) {
    const isPrettified = prettifiedTabs.has(tab.id)
    chrome.tabs.sendMessage(tab.id, {
      action: isPrettified ? 'show-raw' : 'prettify',
    })
  }
})

// Listen for state updates and storage requests from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.tab?.id) {
    const tabId = sender.tab.id
    if (message.action === 'set-prettified') {
      prettifiedTabs.add(tabId)
      updateContextMenu(tabId)
    } else if (message.action === 'set-raw') {
      prettifiedTabs.delete(tabId)
      updateContextMenu(tabId)
    }
  }

  // Handle storage operations from content script
  if (message.action === 'storage-get') {
    const { storageType, keys } = message
    const storage = storageType === 'session' ? chrome.storage.session : chrome.storage.local
    storage.get(keys).then(sendResponse)
    return true // Keep channel open for async response
  } else if (message.action === 'storage-set') {
    const { storageType, data } = message
    const storage = storageType === 'session' ? chrome.storage.session : chrome.storage.local
    storage.set(data).then(() => sendResponse({ success: true }))
    return true
  } else if (message.action === 'storage-remove') {
    const { storageType, keys } = message
    const storage = storageType === 'session' ? chrome.storage.session : chrome.storage.local
    storage.remove(keys).then(() => sendResponse({ success: true }))
    return true
  }
})

// Update context menu when switching tabs
chrome.tabs.onActivated.addListener((activeInfo) => {
  updateContextMenu(activeInfo.tabId)
})

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  prettifiedTabs.delete(tabId)
})
