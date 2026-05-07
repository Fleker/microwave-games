# Adding a Game to Microwave Games

Microwave Games is an offline-first PWA platform for short, session-limited games. Each game is a self-contained HTML page loaded in a sandboxed `<iframe>`. The platform shell handles the timer, screen transitions, and optional score display — your game only needs to respond to a small postMessage API.

---

## Directory structure

Every game lives in its own folder under `games/`:

```
games/
└── your-game/
    ├── index.html      ← entry point (required)
    ├── meta.json       ← game metadata (required)
    ├── game.js         ← your game logic
    └── style.css       ← your game styles
    └── assets/         ← images, audio, etc.
```

The folder name should match the `id` in `meta.json` and `registry.json`. Your `index.html` file should be using absolute paths.

---

## Step 1 — Create `meta.json`

`meta.json` documents your game for other developers. It is not loaded by the platform at runtime, but keeping it accurate is good practice.

```json
{
  "id": "your-game",
  "title": "Your Game Title",
  "description": "One sentence describing the game.",
  "author": "Your Name",
  "version": "1.0.0",
  "minTime": 15,
  "maxTime": 300
}
```

| Field         | Type   | Required | Description                                         |
|---------------|--------|----------|-----------------------------------------------------|
| `id`          | string | yes      | Unique slug; must match the folder name             |
| `title`       | string | yes      | Display name shown in the HUD                       |
| `description` | string | yes      | Short description (one sentence)                    |
| `author`      | string | no       | Your name or handle                                 |
| `version`     | string | no       | Semver string                                       |
| `minTime`     | number | yes      | Minimum session length this game supports (seconds) |
| `maxTime`     | number | yes      | Maximum session length this game supports (seconds) |

`minTime` / `maxTime` control which preset durations can randomly select your game:

| Preset | Eligible when                   |
|--------|---------------------------------|
| 30 s   | `minTime ≤ 30 ≤ maxTime`        |
| 1 m    | `minTime ≤ 60 ≤ maxTime`        |
| 2 m    | `minTime ≤ 120 ≤ maxTime`       |
| Custom | `minTime ≤ chosen ≤ maxTime`    |

---

## Step 2 — Register in `games/registry.json`

Add an entry to the `games` array. This is the file the platform actually reads.

```json
{
  "games": [
    {
      "id": "your-game",
      "title": "Your Game Title",
      "description": "One sentence describing the game.",
      "minTime": 15,
      "maxTime": 300,
      "path": "games/your-game/index.html",
      "cacheFiles": [
        "games/your-game/index.html",
        "games/your-game/game.js",
        "games/your-game/style.css",
        "games/your-game/assets/spritesheet.png"
      ]
    }
  ]
}
```

| Field        | Type     | Required | Description                                                         |
|--------------|----------|----------|---------------------------------------------------------------------|
| `id`         | string   | yes      | Must be unique across all games                                     |
| `title`      | string   | yes      | Display name                                                        |
| `description`| string   | yes      | Short description                                                   |
| `minTime`    | number   | yes      | Minimum seconds (same as `meta.json`)                               |
| `maxTime`    | number   | yes      | Maximum seconds (same as `meta.json`)                               |
| `path`       | string   | yes      | Relative path from the project root to `index.html`                 |
| `cacheFiles` | string[] | yes      | Every file the game needs — the service worker pre-caches these     |

**Do not omit any file from `cacheFiles`.** If a file is missing, the game will break when the user is offline.

---

## Step 3 — Implement the Platform API

Your game talks to the platform shell via `window.postMessage`. This is the only integration point required.

### Session lifecycle

```
Platform loads your game in an <iframe>
         │
         ▼
   Your game initialises
         │
         ▼
   Your game  →  MICROWAVE_READY       (signal: ready to play)
         │
         ▼
   Platform   →  MICROWAVE_START       (signal: go! timer has started)
         │
         ▼
   [ player plays ... ]
         │
         ▼
   Platform   →  MICROWAVE_TIME_UP     (signal: time is up)
         │
         ▼
   Your game shows a brief "DING" state (~1.2 s)
         │
         ▼
   Platform navigates to the Game Over screen
```

> If your game does not send `MICROWAVE_READY` within 4 seconds, the platform auto-starts the timer anyway. Always send it as early as possible.

---

### Messages: Platform → Game

#### `MICROWAVE_START`

Sent when the platform is ready for gameplay to begin. Start accepting input here.

```js
window.addEventListener('message', e => {
  if (!e.data || e.data.type !== 'MICROWAVE_START') return;

  const { duration } = e.data; // total session length in seconds
  startGame(duration);
});
```

| Property   | Type     | Description                      |
|------------|----------|----------------------------------|
| `type`     | string   | `'MICROWAVE_START'`              |
| `duration` | number   | Session length in seconds        |

#### `MICROWAVE_TIME_UP`

Sent when the platform timer reaches zero. Stop accepting input and show a final state.

```js
if (e.data.type === 'MICROWAVE_TIME_UP') {
  endGame(); // show "DING!", freeze UI, etc.
}
```

---

### Messages: Game → Platform

Send via `window.parent.postMessage(payload, '*')`.

#### `MICROWAVE_READY`

Signals that your game has fully loaded and is ready to start. The platform responds with `MICROWAVE_START`.

```js
// Send after all async init work is complete
window.parent.postMessage({ type: 'MICROWAVE_READY' }, '*');
```

#### `MICROWAVE_SCORE` *(optional)*

Reports the player's current score. The platform displays this on the Game Over screen. Send it as often as the score changes; the platform uses the last received value.

```js
window.parent.postMessage({
  type:  'MICROWAVE_SCORE',
  score: 42,          // number
  label: 'POINTS',   // unit label shown after the number
}, '*');
```

| Property | Type   | Description                                             |
|----------|--------|---------------------------------------------------------|
| `type`   | string | `'MICROWAVE_SCORE'`                                     |
| `score`  | number | The score value                                         |
| `label`  | string | Display unit (e.g. `'POINTS'`, `'CLICKS'`, `'METERS'`) |

---

## Minimal game template

Copy this as your starting point:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>My Game</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%; height: 100%; overflow: hidden;
      background: #0a0a0a; color: #fff;
      font-family: 'Courier New', monospace;
      user-select: none; -webkit-user-select: none;
      touch-action: none;
    }
  </style>
</head>
<body>

  <script>
    let score = 0;
    let active = false;

    // ── 1. Signal ready ──────────────────────────────────────────
    window.parent.postMessage({ type: 'MICROWAVE_READY' }, '*');

    // ── 2. Listen for platform messages ─────────────────────────
    window.addEventListener('message', e => {
      if (!e.data || typeof e.data !== 'object') return;

      if (e.data.type === 'MICROWAVE_START') {
        const { duration } = e.data; // total seconds, if you need it
        startGame(duration);
      }

      if (e.data.type === 'MICROWAVE_TIME_UP') {
        endGame();
      }
    });

    // ── 3. Your game logic ───────────────────────────────────────
    function startGame(duration) {
      active = true;
      score = 0;
      // ... set up your game world
    }

    function addPoint() {
      if (!active) return;
      score++;
      window.parent.postMessage({
        type: 'MICROWAVE_SCORE',
        score,
        label: 'POINTS',
      }, '*');
    }

    function endGame() {
      active = false;
      // Show a brief "DING!" or freeze the final frame.
      // The platform navigates away after ~1.2 s.
    }
  </script>

</body>
</html>
```

---

## Tips and requirements

### Mobile-first
Games are played on phones. Design for portrait orientation and touch controls.

- Use `pointerdown` instead of `click` or `touchstart` — it fires immediately with no 300 ms delay and covers mouse, touch, and pen in one handler.
- Set `touch-action: none` on interactive elements to prevent scroll interference.

### No scrolling
The iframe has a fixed size. Set `overflow: hidden` on `html` and `body`.

### No external CDNs
The platform is offline-first. Load everything locally and list every file in `cacheFiles`. External CDN requests will fail when the user is offline.

### Do not manage your own countdown
The platform manages the timer. You receive `duration` in `MICROWAVE_START` if you need to display it, but you should not create your own `setInterval` countdown unless your game logic specifically requires it (e.g. internal countdowns within a session).

### The DING window
After `MICROWAVE_TIME_UP`, you have approximately **1.2 seconds** before the platform navigates to the Game Over screen. Use this window for a brief animation (a flash, a sound, a score reveal).

### localStorage is available
Because the iframe uses `allow-same-origin`, your game can read and write `localStorage` for persistent high scores.

### Audio
Autoplay of audio is blocked in most browsers without user interaction. Unlock audio in your first `pointerdown` handler:

```js
btn.addEventListener('pointerdown', () => {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  // ...
}, { once: true });
```

---

## Checklist

- [ ] `games/your-game/` folder created
- [ ] `games/your-game/index.html` implemented
- [ ] `games/your-game/meta.json` filled in
- [ ] Entry added to `games/registry.json`
- [ ] All asset files listed in `cacheFiles`
- [ ] Game sends `MICROWAVE_READY` after init
- [ ] Game handles `MICROWAVE_START` → gameplay begins
- [ ] Game handles `MICROWAVE_TIME_UP` → gameplay ends
- [ ] `MICROWAVE_SCORE` sent on score change (optional but recommended)
- [ ] Tested at 375 × 667 px (iPhone SE) in portrait
- [ ] Tested offline (DevTools → Network → Offline)
