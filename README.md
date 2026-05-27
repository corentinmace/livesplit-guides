# LiveSplit Guides

An Electron app that displays your speedrun guide notes in real time, synchronized with your LiveSplit splits.

## Requirements

- [Node.js](https://nodejs.org/) 18+
- LiveSplit with the **LiveSplit Server** component running in WebSocket mode

### Enabling the WebSocket server in LiveSplit

1. Open LiveSplit, right-click and select **Edit Layout**
2. Add the **LiveSplit Server** component (under Control)
3. In its settings, enable **WebSocket** and note the port (default: `16834`)
4. Start the server via right-click **Control > Start Server**

## Installation and running

```bash
npm install
npm start
```

## Usage

### Viewer window

- Select a guide from the dropdown
- The app connects automatically to `ws://localhost:16834/livesplit`
- Notes for the current split are shown on the left (70%); the next split is previewed on the right (30%)
- Each time you split in LiveSplit, the display updates automatically
- Use the arrow buttons in the header to navigate splits manually
- Click an image to zoom in
- If the connection fails 10 times in a row, a Retry button appears next to the status indicator
- Toggle light/dark theme with the sun/moon button
- The Settings panel lets you change the WebSocket URL and the guides folder

### Editor window (pen icon in the toolbar)

- Create a new guide or open an existing one
- Add, rename, reorder (drag and drop) and delete splits
- Write notes for each split using the WYSIWYG editor (bold, italic, underline, strikethrough, font color, headings, lists, images, links)
- Paste images directly from the clipboard (Ctrl+V)
- Import split names from a `.lss` file with the **.lss** button
- Capture the name of the split currently active in LiveSplit with the **Capture split** button
- The split list highlights the active LiveSplit split in green while a run is in progress
- Save with the **Save** button (Ctrl+S equivalent via the button)

### Guides folder

Guides are stored as JSON files. The default location is:

- **Windows:** `%APPDATA%/livesplit-guides/guides/`
- **Linux/macOS:** `~/.config/livesplit-guides/guides/`

You can change this in the Settings panel of the viewer window.

## Building

**Windows**

```bash
npm run build
```

Produces an NSIS installer and a portable `.exe` in `dist/`.

**All platforms**

```bash
npm run build:all
```

Or use the GitHub Actions release workflow by pushing a tag starting with `v` (e.g. `v1.0.0`). Builds for Windows, Linux (AppImage + deb) and macOS (dmg) are attached to the release automatically.
