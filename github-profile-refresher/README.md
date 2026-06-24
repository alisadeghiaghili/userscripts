# GitHub Profile Auto Refresher

A Tampermonkey userscript that auto-refreshes your GitHub profile page with full **Start / Pause / Stop** controls and a configurable refresh count — no hardcoding required.

## Features

- **▶ Start** — begin refreshing (or resume after pause)
- **⏸ Pause** — freeze the timer; counter is preserved
- **⏹ Stop** — cancel and reset the counter to zero
- **Configurable count** — set max refreshes directly from the on-page panel
- **Progress bar** — visual feedback with color states (green = running, orange = paused, red = stopped)
- **Auto-resume** — if the page reloads mid-run (which is the whole point), `sessionStorage` restores state and continues automatically

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) for your browser.
2. Open the raw `.user.js` file:  
   👉 [`github-profile-refresher.user.js`](./github-profile-refresher.user.js)
3. Tampermonkey will detect the `@match` header and prompt you to install.
4. Navigate to [github.com/alisadeghiaghili](https://github.com/alisadeghiaghili) — the panel will appear in the top-right corner.

## Usage

| Step | Action |
|---|---|
| 1 | Set **Max refreshes** in the input field (default: 100) |
| 2 | Click **▶ Start** |
| 3 | Click **⏸ Pause** to pause without losing progress |
| 4 | Click **▶ Start** again to resume from where you left off |
| 5 | Click **⏹ Stop** to cancel and reset completely |

## Panel States

| Color | Meaning |
|---|---|
| 🟢 Green bar | Running |
| 🟠 Orange bar | Paused |
| ⚫ Gray bar | Stopped |
| 🟢 Green bar (full) | Completed |

## Configuration

| Constant | Default | Description |
|---|---|---|
| `DEFAULT_MAX` | `100` | Default max refreshes if input is not changed |
| `DELAY_MS` | `5000` | Delay between refreshes in milliseconds (5s) |

To change the delay permanently, edit `DELAY_MS` in the script header.

## Technical Notes

- State is persisted via `sessionStorage` — survives page reloads but clears when the browser tab is closed.
- The input field is **locked** while running to prevent accidental changes mid-session.
- Only targets `https://github.com/alisadeghiaghili` — will not run on other pages.

## Version History

| Version | Changes |
|---|---|
| v2.0 | Added Start / Pause / Stop controls, configurable count input, progress bar, auto-resume |
| v1.0 | Basic auto-refresher with hardcoded count |
