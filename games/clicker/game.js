/**
 * Speed Clicker — Game Logic
 *
 * Platform API used:
 *   send   MICROWAVE_READY       → platform starts the session timer
 *   recv   MICROWAVE_START       → gameplay begins
 *   recv   MICROWAVE_TIME_UP     → gameplay ends
 *   send   MICROWAVE_SCORE       → report click count to platform
 */

const ClickerGame = (() => {
  let clicks   = 0;
  let active   = false;
  let startMs  = 0;
  let rafId    = null;

  const $ = id => document.getElementById(id);

  // ── Init ──────────────────────────────────────────────────────

  function init() {
    const btn = $('click-btn');

    // Single pointerdown covers mouse, touch, and pen with no 300ms delay
    btn.addEventListener('pointerdown', e => {
      e.preventDefault();
      handleClick();
    });

    // Keyboard: Space and Enter
    document.addEventListener('keydown', e => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        handleClick();
      }
    });
    console.log('init')

    // Notify the platform we are ready
    window.parent.postMessage({ type: 'MICROWAVE_READY' }, '*');

    // Listen for platform control messages
    window.addEventListener('message', e => {
      if (!e.data || typeof e.data !== 'object') return;
      if (e.data.type === 'MICROWAVE_START')    start();
      if (e.data.type === 'MICROWAVE_TIME_UP')  end();
    });
  }

  // ── Lifecycle ─────────────────────────────────────────────────

  function start() {
    console.log('game start')
    clicks  = 0;
    active  = true;
    startMs = performance.now();

    $('overlay').classList.add('hidden');
    updateDisplay();
    tick();
  }

  function end() {
    active = false;
    cancelAnimationFrame(rafId);
    reportScore(); // send final tally before platform navigates away

    // Show the "DING" overlay with final count
    $('overlay-label').textContent = 'DING!';
    $('final-count').textContent   = clicks;
    $('final-count').style.display = '';
    $('overlay-unit').style.display = '';
    $('overlay-sub').style.display  = 'none';
    $('overlay').classList.remove('hidden');
  }

  // ── Input ─────────────────────────────────────────────────────

  function handleClick() {
    if (!active) return;
    console.log('click')
    clicks++;
    flash();
    updateDisplay();
    reportScore();
  }

  function flash() {
    const btn = $('click-btn');
    btn.classList.add('flash');
    setTimeout(() => btn.classList.remove('flash'), 80);
  }

  // ── Display ───────────────────────────────────────────────────

  function tick() {
    if (!active) return;
    updateCPS();
    rafId = requestAnimationFrame(tick);
  }

  function updateDisplay() {
    $('click-count').textContent = clicks;
    updateCPS();
  }

  function updateCPS() {
    const elapsed = (performance.now() - startMs) / 1000;
    const cps = elapsed > 0.2 ? (clicks / elapsed).toFixed(1) : '0.0';
    $('cps').textContent = `${cps} CPS`;
  }

  // ── Platform communication ────────────────────────────────────

  function reportScore() {
    window.parent.postMessage({
      type:  'MICROWAVE_SCORE',
      score: clicks,
      label: clicks === 1 ? 'CLICK' : 'CLICKS',
    }, '*');
  }

  // ── Bootstrap ─────────────────────────────────────────────────
  console.log('bootstrap')
  document.addEventListener('DOMContentLoaded', init);
})();

console.log('game.js')
