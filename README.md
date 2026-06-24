# userscripts

My collection of Tampermonkey / Greasemonkey userscripts for browser automation and productivity.

## Scripts

| Script | Description | Version |
|---|---|---|
| [coursera-video-downloader](./coursera-video-downloader/) | Download Coursera lecture videos + subtitles into organized folders | v3.0 |

## Structure

Each script lives in its own folder with a dedicated `README.md`:

```
userscripts/
├── README.md                          ← this file
├── template/                          ← starter template for new scripts
└── {script-name}/
    ├── {script-name}.user.js
    └── README.md
```

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) (Chrome/Edge) or [Greasemonkey](https://addons.mozilla.org/en-US/firefox/addon/greasemonkey/) (Firefox).
2. Navigate to the script folder you want.
3. Open the `.user.js` file — Tampermonkey will detect it and prompt for installation.

## Contributing / Adding a New Script

1. Copy the `template/` folder and rename it.
2. Edit the `@metadata` block in the `.user.js` file.
3. Update this `README.md` table with the new script.
