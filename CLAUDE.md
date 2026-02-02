# Markdown Viewer

A Chrome extension that renders Markdown files beautifully in the browser.

## Tech Stack

- TypeScript
- Vite (for building/bundling the extension)
- Chrome Extension Manifest V3
- marked (for markdown parsing)

## Development

```bash
npm install     # Install dependencies
npm run dev     # Development mode with hot reload
npm run build   # Build for production
```

## Installation

1. Run `npm run build` to build the extension
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked" and select the `dist` folder
5. For local files, click "Details" on the extension and enable "Allow access to file URLs"

## Usage

- **Auto-render**: Opens `.md` or `.markdown` files and automatically renders them
- **Context menu**: Right-click on any page and select "Open in Markdown Viewer"
- **Toolbar icon**: Click the extension icon to render the current page as markdown

## Project Structure

```
src/
  background.ts   # Service worker - handles context menu
  content.ts      # Content script - renders markdown
  styles.css      # GitHub-inspired markdown styles
  vite-env.d.ts   # TypeScript declarations
```
