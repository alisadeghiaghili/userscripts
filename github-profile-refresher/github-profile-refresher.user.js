// ==UserScript==
// @name         GitHub Profile Auto Refresher — alisadeghiaghili
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Auto-refresh with Start / Pause / Stop controls and configurable count
// @author       Ali Sadeghi Aghili
// @match        https://github.com/alisadeghiaghili
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const STORAGE_COUNT_KEY  = 'tm_refresh_count';
  const STORAGE_MAX_KEY    = 'tm_refresh_max';
  const STORAGE_STATE_KEY  = 'tm_refresh_state'; // 'running' | 'paused' | 'stopped'
  const DEFAULT_MAX        = 100;
  const DELAY_MS           = 5000;

  let count = parseInt(sessionStorage.getItem(STORAGE_COUNT_KEY) || '0', 10);
  let max   = parseInt(sessionStorage.getItem(STORAGE_MAX_KEY)   || DEFAULT_MAX, 10);
  let state = sessionStorage.getItem(STORAGE_STATE_KEY) || 'stopped';

  let timer = null;

  /* ─── Build Panel ──────────────────────────────────────────────── */
  const panel = document.createElement('div');
  panel.id = 'tm-refresher';
  panel.innerHTML = `
    <style>
      #tm-refresher {
        position: fixed; top: 12px; right: 12px; z-index: 99999;
        background: #161b22; color: #c9d1d9;
        border: 1px solid #30363d; border-radius: 10px;
        padding: 14px 16px 12px;
        font-family: -apple-system, 'Segoe UI', sans-serif;
        font-size: 13px; width: 230px;
        box-shadow: 0 8px 24px rgba(0,0,0,.55);
        user-select: none;
      }
      #tm-refresher .tm-title {
        font-weight: 600; font-size: 12px;
        text-transform: uppercase; letter-spacing: .06em;
        color: #8b949e; margin-bottom: 10px;
      }
      #tm-refresher .tm-row {
        display: flex; align-items: center; gap: 6px; margin-bottom: 8px;
      }
      #tm-refresher label { color: #8b949e; font-size: 12px; white-space: nowrap; }
      #tm-refresher input[type="number"] {
        background: #0d1117; border: 1px solid #30363d; border-radius: 6px;
        color: #c9d1d9; padding: 3px 7px; font-size: 13px; width: 68px; outline: none;
      }
      #tm-refresher input[type="number"]:focus { border-color: #388bfd; }
      #tm-refresher .tm-progress { font-size: 13px; color: #c9d1d9; margin-bottom: 10px; }
      #tm-refresher .tm-bar-wrap {
        background: #21262d; border-radius: 4px; height: 5px;
        margin-bottom: 10px; overflow: hidden;
      }
      #tm-refresher .tm-bar {
        height: 100%; background: #238636; border-radius: 4px;
        transition: width .4s ease, background .3s;
      }
      #tm-refresher .tm-status {
        font-size: 11px; color: #8b949e; margin-bottom: 10px; min-height: 16px;
      }
      #tm-refresher .tm-btns { display: flex; gap: 6px; }
      #tm-refresher button {
        flex: 1; border: none; border-radius: 6px; padding: 5px 0;
        font-size: 12px; font-weight: 600; cursor: pointer;
        transition: opacity .15s, filter .15s;
      }
      #tm-refresher button:disabled { opacity: .35; cursor: default; }
      #tm-refresher #tm-btn-start { background: #238636; color: #fff; }
      #tm-refresher #tm-btn-pause { background: #9e6a03; color: #fff; }
      #tm-refresher #tm-btn-stop  { background: #da3633; color: #fff; }
      #tm-refresher button:not(:disabled):hover { filter: brightness(1.15); }
    </style>

    <div class="tm-title">🔄 Auto Refresher</div>
    <div class="tm-row">
      <label for="tm-input-max">Max refreshes:</label>
      <input id="tm-input-max" type="number" min="1" max="9999" value="${max}" />
    </div>
    <div class="tm-progress">
      Refresh <span id="tm-count">${count}</span> / <span id="tm-max">${max}</span>
    </div>
    <div class="tm-bar-wrap">
      <div class="tm-bar" id="tm-bar" style="width:${max > 0 ? (count/max*100).toFixed(1) : 0}%"></div>
    </div>
    <div class="tm-status" id="tm-status">—</div>
    <div class="tm-btns">
      <button id="tm-btn-start">▶ Start</button>
      <button id="tm-btn-pause">⏸ Pause</button>
      <button id="tm-btn-stop">⏹ Stop</button>
    </div>
  `;
  document.body.appendChild(panel);

  /* ─── DOM refs ─────────────────────────────────────────────────── */
  const inputMax = document.getElementById('tm-input-max');
  const elCount  = document.getElementById('tm-count');
  const elMax    = document.getElementById('tm-max');
  const bar      = document.getElementById('tm-bar');
  const statusEl = document.getElementById('tm-status');
  const btnStart = document.getElementById('tm-btn-start');
  const btnPause = document.getElementById('tm-btn-pause');
  const btnStop  = document.getElementById('tm-btn-stop');

  /* ─── Helpers ──────────────────────────────────────────────────── */
  function save() {
    sessionStorage.setItem(STORAGE_COUNT_KEY, count);
    sessionStorage.setItem(STORAGE_MAX_KEY,   max);
    sessionStorage.setItem(STORAGE_STATE_KEY, state);
  }

  function updateUI() {
    elCount.textContent = count;
    elMax.textContent   = max;
    const pct = max > 0 ? (count / max * 100).toFixed(1) : 0;
    bar.style.width = pct + '%';

    if (state === 'running') {
      bar.style.background = '#238636';
      statusEl.textContent = `Next refresh in ~${DELAY_MS / 1000}s…`;
      btnStart.disabled = true; btnPause.disabled = false; btnStop.disabled = false;
      inputMax.disabled = true;
    } else if (state === 'paused') {
      bar.style.background = '#9e6a03';
      statusEl.textContent = '⏸ Paused — press Start to resume';
      btnStart.disabled = false; btnPause.disabled = true; btnStop.disabled = false;
      inputMax.disabled = false;
    } else {
      bar.style.background = count >= max && max > 0 ? '#238636' : '#30363d';
      statusEl.textContent = count >= max && max > 0
        ? `✅ Done — ${max} refreshes completed` : 'Stopped';
      btnStart.disabled = false; btnPause.disabled = true; btnStop.disabled = true;
      inputMax.disabled = false;
    }
  }

  function scheduleNext() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      if (state !== 'running') return;
      if (count >= max) { state = 'stopped'; save(); updateUI(); return; }
      count++; save(); location.reload();
    }, DELAY_MS);
  }

  function startRefreshing() {
    if (count >= max) { count = 0; save(); }
    state = 'running'; save(); updateUI(); scheduleNext();
  }

  function pauseRefreshing() {
    if (timer) { clearTimeout(timer); timer = null; }
    state = 'paused'; save(); updateUI();
  }

  function stopRefreshing() {
    if (timer) { clearTimeout(timer); timer = null; }
    state = 'stopped'; count = 0; save(); updateUI();
  }

  /* ─── Events ───────────────────────────────────────────────────── */
  inputMax.addEventListener('change', () => {
    const val = parseInt(inputMax.value, 10);
    if (!isNaN(val) && val > 0) { max = val; save(); updateUI(); }
  });

  btnStart.addEventListener('click', startRefreshing);
  btnPause.addEventListener('click', pauseRefreshing);
  btnStop.addEventListener('click',  stopRefreshing);

  /* ─── Auto-resume after page reload ───────────────────────────── */
  updateUI();
  if (state === 'running') scheduleNext();

})();
