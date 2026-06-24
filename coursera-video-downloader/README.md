# Coursera Video Downloader

A Tampermonkey/Greasemonkey userscript that downloads Coursera lecture videos and English subtitles into an organized folder structure.

## Output Structure

```
~/Downloads/
└── Coursera/
    └── {course-slug}/
        └── {module-name}/
            ├── 01_Lecture Title.mp4
            └── 01_Lecture Title.vtt
```

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) for your browser.
2. Click **[Install Script](./coursera-video-downloader.user.js)** — or open the `.user.js` file and Tampermonkey will prompt you automatically.
3. Navigate to any Coursera lecture page (`/learn/*/lecture/*` or `/learn/*/item/*`).

## Usage

1. Open a Coursera lecture video page.
2. Wait for the video to load.
3. A panel appears in the **bottom-right corner** showing the detected course, module, and file name.
4. Click **⬇ Download Video + Subtitle**.
5. Both files will be saved to `Downloads/Coursera/{course}/{module}/`.

## How It Works

| Step | Detail |
|---|---|
| Video URL | Extracted from `<video source>` — prefers 540p, falls back to 360p or `currentSrc` |
| Subtitle URL | Found via `<a href*="subtitleAssetProxy.v1">` anchor; script auto-clicks the download panel if the anchor isn't visible |
| Folder structure | Video uses `GM_download` with full path. Subtitle is fetched as text, encoded as `data:` URI, then passed to `GM_download` — this is required because `blob:` object URLs cause `GM_download` to ignore the subfolder path |
| Filename | `{sequence}_{sanitized-title}.mp4` / `.vtt` |

## Known Limitations

- **DRM-protected videos** cannot be downloaded (the video URL won't be available in the DOM).
- Subtitle language priority is English (`[download*="en"]`). If the English subtitle anchor isn't found, it falls back to any available subtitle.
- Folder structure inside `Downloads/` depends on Tampermonkey's `GM_download` behaviour. On some browsers/OS configurations, the subfolder may not be created automatically — you may need to enable **"Allow access to file URLs"** in your Tampermonkey settings.

## Requirements

- Tampermonkey v4.13+ (or Greasemonkey v4+)
- Browser: Chrome, Firefox, Edge, or any Chromium-based browser
- Coursera account with access to the course

## Changelog

### v3.0
- **Fix:** Subtitle now correctly saved to the target subfolder. Root cause: `blob:` object URLs passed to `GM_download` are stripped of their path by the browser; switched to `data:` base64 URI which preserves the full path.
- Added per-download error states (red progress bar on failure).
- Subtitle failure is now non-fatal — video download continues independently.
- Button color reflects final status: green (success), orange (subtitle failed), red (video failed).

### v2.1
- Added `GM_xmlhttpRequest` fetch + `blob:` object URL workaround for CORS on subtitle proxy endpoint.

### v2.0
- Added subtitle download support.
- Added dual progress bars.
