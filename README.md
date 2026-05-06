# Microwave Games

Bite-sized browser games for any spare moment — 30 seconds, 1 minute, or 2.

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

---

## Description

Microwave Games is an offline-first Progressive Web App (PWA) game platform built with no framework and no build step. You pick a cook time, the platform randomly selects a compatible game from a registry, loads it in a sandboxed iframe, and manages the countdown. When the timer hits zero, the game is over.

Key characteristics:

- **Preset durations** — 30 s, 1 m, 2 m, or a custom time of your choosing
- **Random game selection** — the platform picks a game compatible with the chosen duration from `games/registry.json`
- **Platform-managed timer** — games never run their own countdown; the platform sends `MICROWAVE_START` and `MICROWAVE_TIME_UP` via `postMessage`
- **Offline-first** — a service worker pre-caches the app shell and all registered game assets on first load
- **Installable PWA** — add to home screen on Android and iOS for a standalone app experience
- **Amber LCD aesthetic** — dark background, monospace font, retro microwave UI chrome

---

## Screenshot

```
┌─────────────────────────────┐
│                             │
│         MICROWAVE           │
│     G  A  M  E  S           │
│  BITE-SIZED FUN • ANYWHERE  │
│                             │
│      SELECT COOK TIME       │
│                             │
│  [ 30s ]  [ 1m ]  [ 2m ]   │
│         [CUSTOM]            │
│                             │
└─────────────────────────────┘
```

---

## Prerequisites

- A static file server that can serve files over **HTTPS or `localhost`**.
  Service workers require a secure context; opening `index.html` directly as a
  `file://` URL will not work.
- No runtime dependencies, build tools, or package manager required.

Any of the following servers work:

| Option | Command |
|---|---|
| Node.js `serve` | `npx serve .` |
| Python 3 | `python3 -m http.server 8080` |
| Node.js `http-server` | `npx http-server -p 8080` |
| Any web server | Point the document root at the project folder |

---

## Installation

```bash
git clone https://github.com/your-org/microwave-games.git
cd microwave-games
```

No `npm install` or compilation step is needed. The project is plain HTML, CSS,
and JavaScript.

---

## Running Locally

```bash
# Option A — Node.js (recommended; handles MIME types correctly)
npx serve .

# Option B — Python 3
python3 -m http.server 8080
```

Then open [http://localhost:3000](http://localhost:3000) (for `serve`) or
[http://localhost:8080](http://localhost:8080) (for Python) in your browser.

On the first load the service worker installs and pre-caches all assets. After
that the app works fully offline.

### Installing as a PWA

In a Chromium-based browser, look for the "Install" icon in the address bar, or
use the browser menu to "Add to Home Screen". On iOS Safari, tap the share
sheet and choose "Add to Home Screen".

---

## Project Structure

```
microwave-games/
├── index.html              # Platform shell — all four screens live here
├── manifest.json           # PWA manifest (name, icons, theme colour)
├── sw.js                   # Service worker (cache-first app shell, network-first registry)
│
├── css/
│   └── main.css            # Global styles — amber LCD / retro microwave theme
│
├── js/
│   ├── app.js              # Platform logic: screen flow, timer, postMessage bridge
│   └── game-registry.js    # GameRegistry class — loads and queries registry.json
│
├── games/
│   ├── registry.json       # Central game manifest (read by the platform at runtime)
│   └── clicker/            # Example game: Speed Clicker
│       ├── index.html
│       ├── game.js
│       └── style.css
│
├── icons/
│   ├── icon.svg            # PWA icon
│   └── icon-maskable.svg   # Maskable icon for Android adaptive icons
│
├── ADDING_GAMES.md         # Full guide for creating and registering new games
├── LICENSE
└── README.md
```

---

## postMessage API

Games communicate with the platform shell exclusively through `window.postMessage`.
The platform owns the timer; games only need to react to the messages they receive.

### Platform to game

| Message type | When sent | Payload |
|---|---|---|
| `MICROWAVE_START` | Timer is about to begin; start accepting input | `{ type, duration }` — `duration` is total seconds |
| `MICROWAVE_TIME_UP` | Timer has reached zero; stop accepting input | `{ type }` |

### Game to platform

| Message type | When to send | Payload |
|---|---|---|
| `MICROWAVE_READY` | After all async init is complete | `{ type }` |
| `MICROWAVE_SCORE` | Any time the score changes (optional) | `{ type, score, label }` |

The platform displays the last received `MICROWAVE_SCORE` value on the Game Over
screen. If the game never sends `MICROWAVE_READY`, the platform auto-starts the
timer after 4 seconds.

### Session lifecycle

```
Platform loads game in <iframe>
        |
        v
Game initialises  -->  MICROWAVE_READY  -->  Platform
        |
        v
Platform  -->  MICROWAVE_START  -->  Game (timer starts)
        |
        v
    [ player plays ]
        |
        v
Platform  -->  MICROWAVE_TIME_UP  -->  Game (~1.2 s DING window)
        |
        v
Platform shows Game Over screen
```

---

## Adding a New Game

Each game is a self-contained folder under `games/` with its own `index.html`.
The short version:

1. Create `games/your-game/` with at minimum `index.html`.
2. Add an entry to `games/registry.json` with `id`, `title`, `minTime`,
   `maxTime`, `path`, and `cacheFiles`.
3. Implement the postMessage API (signal `MICROWAVE_READY`, handle
   `MICROWAVE_START` and `MICROWAVE_TIME_UP`).
4. List every file your game needs in `cacheFiles` — the service worker
   pre-caches this list for offline play.

For full details, a minimal game template, and a submission checklist, see
[ADDING_GAMES.md](ADDING_GAMES.md).

---

## Configuration

The service worker cache is versioned by the `CACHE_NAME` constant at the top of
`sw.js`:

```js
const CACHE_NAME = 'microwave-games-v1';
```

Bump this string whenever you deploy changes that require a cache bust (new CSS,
updated JS, new game assets). The old cache is automatically deleted on the next
service worker activation.

---

## Contributing

1. Fork the repository and create a branch from `main`.
2. Follow the conventions in the existing source files (vanilla JS, no build
   step, no external dependencies).
3. If you are adding a game, work through the checklist in
   [ADDING_GAMES.md](ADDING_GAMES.md) before opening a pull request.
4. Open a pull request with a clear description of what the change does.

All contributions are welcome — new games, platform improvements, accessibility
fixes, and documentation updates.

---

## License

This project is licensed under the [Apache-2.0 License](LICENSE).
