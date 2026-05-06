/**
 * Microwave Games — Platform Shell
 *
 * Manages screen transitions, random game selection, the countdown timer,
 * and the postMessage bridge with the game iframe.
 */

const App = (() => {
  // ── State ──────────────────────────────────────────────────────────────────

  let registry        = null;
  let currentGame     = null;
  let currentDuration = 0;
  let timerInterval   = null;
  let timeLeft        = 0;
  let pendingScore    = null;
  let readyTimeout    = null;

  const $ = id => document.getElementById(id);

  // ── Screen management ──────────────────────────────────────────────────────

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(id).classList.add('active');
  }

  // ── Timer ──────────────────────────────────────────────────────────────────

  function formatTime(s) {
    const m   = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  function startTimer() {
    clearInterval(timerInterval);
    timeLeft = currentDuration;
    renderTimer();

    timerInterval = setInterval(() => {
      timeLeft = Math.max(0, timeLeft - 1);
      renderTimer();
      if (timeLeft === 0) {
        clearInterval(timerInterval);
        timerInterval = null;
        handleTimeUp();
      }
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  function renderTimer() {
    const el = $('timer-display');
    el.textContent = formatTime(timeLeft);
    // Flash red for the last 5 seconds
    el.classList.toggle('urgent', timeLeft <= 5 && timeLeft > 0);
  }

  // ── Game selection ─────────────────────────────────────────────────────────

  async function selectTime(seconds) {
    hideError();
    await registry.load();

    const game = registry.pickRandom(seconds);
    if (!game) {
      showError('NO GAMES AVAILABLE FOR THIS DURATION');
      return;
    }

    currentGame     = game;
    currentDuration = seconds;
    pendingScore    = null;
    startLoading(game);
  }

  // ── Loading screen ─────────────────────────────────────────────────────────

  function startLoading(game) {
    $('loading-game-name').textContent = game.title.toUpperCase() + '...';

    // Restart the CSS fill animation
    const fill = $('loading-fill');
    fill.classList.remove('run');
    fill.getBoundingClientRect(); // force reflow so animation restarts
    fill.classList.add('run');

    showScreen('loading-screen');
    setTimeout(() => launchGame(game), 1500);
  }

  // ── Game launch ────────────────────────────────────────────────────────────

  function launchGame(game) {
    $('game-title').textContent = game.title;
    timeLeft = currentDuration;
    renderTimer();

    // Load game into iframe
    const frame = $('game-frame');
    frame.src = game.path;

    showScreen('game-screen');

    // If the game doesn't send MICROWAVE_READY within 4 s, auto-start anyway
    clearTimeout(readyTimeout);
    readyTimeout = setTimeout(sendStart, 4000);
  }

  function sendStart() {
    clearTimeout(readyTimeout);
    try {
      $('game-frame').contentWindow.postMessage({
        type:     'MICROWAVE_START',
        duration: currentDuration,
      }, '*');
    } catch (_) { /* iframe not yet accessible */ }
    startTimer();
  }

  // ── Time up ────────────────────────────────────────────────────────────────

  function handleTimeUp() {
    try {
      $('game-frame').contentWindow.postMessage({ type: 'MICROWAVE_TIME_UP' }, '*');
    } catch (_) {}

    // Give the game ~1.2 s to play a "DING" animation before we navigate away
    setTimeout(showGameOver, 1200);
  }

  function showGameOver() {
    $('game-over-title').textContent = currentGame?.title ?? '';

    if (pendingScore) {
      $('final-score').textContent =
        `${pendingScore.score} ${pendingScore.label}`;
    } else {
      $('final-score').textContent = '';
    }

    $('game-frame').src = '';
    showScreen('gameover-screen');
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  function goHome() {
    stopTimer();
    clearTimeout(readyTimeout);
    $('game-frame').src = '';
    $('custom-input').classList.add('hidden');
    hideError();
    showScreen('start-screen');
  }

  // ── Error helpers ──────────────────────────────────────────────────────────

  function showError(msg) {
    const el = $('no-games-msg');
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  function hideError() {
    $('no-games-msg').classList.add('hidden');
  }

  // ── postMessage bridge ─────────────────────────────────────────────────────

  function handleMessage(event) {
    const data = event.data;
    if (!data || typeof data !== 'object') return;

    switch (data.type) {
      case 'MICROWAVE_READY':
        // Game is loaded and ready — start the session
        sendStart();
        break;

      case 'MICROWAVE_SCORE':
        // Store latest score; displayed on the Game Over screen
        pendingScore = {
          score: data.score  ?? 0,
          label: (data.label ?? 'POINTS').toUpperCase(),
        };
        break;
    }
  }

  // ── Event binding ──────────────────────────────────────────────────────────

  function bindEvents() {
    // Preset duration buttons
    document.querySelectorAll('.time-btn[data-seconds]').forEach(btn => {
      btn.addEventListener('click', () =>
        selectTime(parseInt(btn.dataset.seconds, 10))
      );
    });

    // Toggle custom time input
    $('custom-btn').addEventListener('click', () => {
      $('custom-input').classList.toggle('hidden');
      hideError();
    });

    // Start with custom time
    $('start-custom-btn').addEventListener('click', () => {
      const min   = Math.max(0, parseInt($('custom-min').value, 10) || 0);
      const sec   = Math.max(0, parseInt($('custom-sec').value, 10) || 0);
      const total = min * 60 + sec;
      if (total < 5) {
        showError('MINIMUM 5 SECONDS REQUIRED');
        return;
      }
      selectTime(total);
    });

    // Also allow pressing Enter inside the custom inputs
    [$('custom-min'), $('custom-sec')].forEach(input => {
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') $('start-custom-btn').click();
      });
    });

    // HUD: stop button
    $('back-btn').addEventListener('click', goHome);

    // Game Over: replay or home
    $('play-again-btn').addEventListener('click', () => {
      pendingScore = null;
      startLoading(currentGame);
    });
    $('home-btn').addEventListener('click', goHome);

    // postMessage from game iframe
    window.addEventListener('message', handleMessage);
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  function init() {
    registry = new GameRegistry();
    bindEvents();
    // Prefetch registry in the background so the first tap is instant
    registry.load().catch(() => {});
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
