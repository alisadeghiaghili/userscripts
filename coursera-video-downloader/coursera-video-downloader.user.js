// ==UserScript==
// @name         Coursera Video Downloader
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Download Coursera videos with English subtitles into organized folders
// @author       Ali Sadeghi Aghili
// @match        https://www.coursera.org/learn/*/lecture/*
// @match        https://www.coursera.org/learn/*/item/*
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// @connect      *
// ==/UserScript==

(function () {
    'use strict';

    const BASE_FOLDER = 'Coursera';

    // ─── Helpers ──────────────────────────────────────────────────────────────

    function sanitizeFilename(name) {
        return name
            .replace(/(\d)([A-Z])/g, '$1 - $2')
            .replace(/([a-z])([A-Z])/g, '$1 - $2')
            .replace(/[!?¿¡…،؟。！？、。「」【】《》]/g, '')
            .replace(/[\/\\%*:|"<>]/g, '')
            .replace(/\s{2,}/g, ' ')
            .replace(/-{2,}/g, '-')
            .replace(/\s*-\s*/g, ' - ')
            .trim();
    }

    function getCourseInfo() {
        const courseMatch = window.location.pathname.match(/\/learn\/([^/]+)/);
        const courseName = courseMatch ? courseMatch[1] : 'Unknown_Course';

        const candidates = [
            '[data-e2e="module-title"]',
            '.WeekSingleItemDisplay h2',
            '[class*="week-title"]',
            '[class*="module-title"]',
            'nav [aria-current="true"]',
        ];

        let moduleName = null;
        for (const sel of candidates) {
            const el = document.querySelector(sel);
            if (el && el.textContent.trim()) {
                moduleName = sanitizeFilename(el.textContent.trim());
                break;
            }
        }

        if (!moduleName) {
            for (const h of document.querySelectorAll('h2, h3, h4')) {
                const txt = h.textContent.trim();
                if (/module|week/i.test(txt) && txt.length < 80) {
                    moduleName = sanitizeFilename(txt);
                    break;
                }
            }
        }

        return { courseName, moduleName: moduleName || 'Module_Unknown' };
    }

    function getVideoInfo() {
        const titleEl =
            document.querySelector('h1[data-e2e="item-title"]') ||
            document.querySelector('.item-title') ||
            document.querySelector('h1');
        const title = titleEl ? sanitizeFilename(titleEl.textContent.trim()) : 'video';

        const itemsList = Array.from(document.querySelectorAll('[data-e2e="item-link"]'));
        const currentUrl = window.location.href;
        const idx = itemsList.findIndex(item => item.href === currentUrl);
        const sequence = idx >= 0 ? String(idx + 1).padStart(2, '0') : '00';

        return { title, sequence };
    }

    function getVideoUrl() {
        const sources = Array.from(document.querySelectorAll('video source'));
        const preferred = sources.find(s => s.src.includes('540') || s.src.includes('360'));
        if (preferred) return preferred.src;
        const video = document.querySelector('video');
        return video ? (video.src || video.currentSrc || null) : null;
    }

    function findSubtitleAnchor() {
        const selectors = [
            'a[href*="subtitleAssetProxy.v1"][download*="en"]',
            'a[href*="subtitleAssetProxy.v1"][download]',
            'a[href*="subtitleAssetProxy.v1"]',
        ];
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) return el;
        }
        return null;
    }

    function waitForSubtitleAnchor(maxMs = 8000) {
        return new Promise((resolve) => {
            const found = findSubtitleAnchor();
            if (found) return resolve(found);
            let elapsed = 0;
            const timer = setInterval(() => {
                elapsed += 300;
                const el = findSubtitleAnchor();
                if (el) { clearInterval(timer); resolve(el); return; }
                if (elapsed >= maxMs) { clearInterval(timer); resolve(null); }
            }, 300);
        });
    }

    function buildSubtitleUrl(anchor) {
        const href = anchor.getAttribute('href');
        if (!href) return null;
        return href.startsWith('http') ? href : 'https://www.coursera.org' + href;
    }

    // ─── Download helpers ─────────────────────────────────────────────────────

    function downloadFile(url, filename, folder, onProgress) {
        return new Promise((resolve, reject) => {
            const fullPath = `${BASE_FOLDER}/${folder}/${filename}`;
            GM_download({
                url,
                name: fullPath,
                saveAs: false,
                onprogress: (p) => { if (p.total > 0) onProgress(Math.round((p.loaded / p.total) * 100)); },
                onload: () => { onProgress(100); resolve(fullPath); },
                onerror: (err) => { console.error('[Coursera DL] GM_download failed:', filename, err); reject(err); }
            });
        });
    }

    /**
     * Download subtitle using data: URI to preserve folder structure.
     *
     * Root cause: GM_download with blob: objectURLs ignores the `name` path,
     * dropping the file in the root download folder instead of the intended subfolder.
     *
     * Fix: Fetch subtitle text via GM_xmlhttpRequest, encode as base64 data: URI,
     * then pass to GM_download. data: URIs respect the full `name` path including subfolders.
     */
    function downloadSubtitle(url, filename, folder, onProgress) {
        return new Promise((resolve, reject) => {
            const fullPath = `${BASE_FOLDER}/${folder}/${filename}`;
            onProgress(5);

            GM_xmlhttpRequest({
                method: 'GET',
                url,
                headers: { 'Referer': 'https://www.coursera.org/' },
                onprogress: (p) => {
                    if (p.total > 0) onProgress(5 + Math.round((p.loaded / p.total) * 80));
                },
                onload: (resp) => {
                    if (resp.status < 200 || resp.status >= 300) {
                        console.error('[Coursera DL] Subtitle fetch status:', resp.status);
                        return reject(new Error(`HTTP ${resp.status}`));
                    }

                    onProgress(88);

                    const text = resp.responseText || '';
                    const base64 = btoa(unescape(encodeURIComponent(text)));
                    const dataUri = `data:text/vtt;base64,${base64}`;

                    GM_download({
                        url: dataUri,
                        name: fullPath,
                        saveAs: false,
                        onload: () => { onProgress(100); resolve(fullPath); },
                        onerror: (err) => {
                            console.error('[Coursera DL] Subtitle GM_download failed:', err);
                            // Fallback: anchor click (no folder support, but saves the file)
                            try {
                                const blob = new Blob([text], { type: 'text/vtt' });
                                const a = document.createElement('a');
                                a.href = URL.createObjectURL(blob);
                                a.download = filename;
                                a.click();
                                setTimeout(() => URL.revokeObjectURL(a.href), 5000);
                                onProgress(100);
                                resolve(fullPath + ' (fallback)');
                            } catch (e) {
                                reject(err);
                            }
                        }
                    });
                },
                onerror: (err) => {
                    console.error('[Coursera DL] GM_xmlhttpRequest failed:', err);
                    reject(err);
                }
            });
        });
    }

    // ─── UI ───────────────────────────────────────────────────────────────────

    function createUI() {
        const panel = document.createElement('div');
        panel.style.cssText = `
            position:fixed; bottom:20px; right:20px; z-index:9999;
            width:290px; background:#1a1a2e; border-radius:10px;
            box-shadow:0 4px 20px rgba(0,0,0,.5); font-family:sans-serif;
            overflow:hidden; border:1px solid #2a2a4e;
        `;

        const infoLabel = document.createElement('div');
        infoLabel.style.cssText = `
            padding:9px 14px; font-size:11px; color:#aaa;
            background:#12122a; white-space:pre-wrap; word-break:break-all;
            border-bottom:1px solid #2a2a4e; line-height:1.6;
        `;
        infoLabel.textContent = 'Loading info...';

        const refreshInfo = () => {
            const { courseName, moduleName } = getCourseInfo();
            const { title, sequence } = getVideoInfo();
            const anchor = findSubtitleAnchor();
            infoLabel.textContent =
                `📁 ${BASE_FOLDER}/${courseName}/${moduleName}\n` +
                `📄 ${sequence}_${title}\n` +
                `💬 Subtitle: ${anchor ? '✅ found' : '⏳ not yet loaded'}`;
        };
        refreshInfo();
        setInterval(refreshInfo, 1500);

        const button = document.createElement('button');
        button.textContent = '⬇ Download Video + Subtitle';
        button.style.cssText = `
            width:100%; padding:14px; background:#0056D2; color:white;
            border:none; cursor:pointer; font-weight:bold; font-size:14px;
            transition:background .2s;
        `;
        button.onmouseenter = () => { button.style.background = '#0047b3'; };
        button.onmouseleave = () => { if (!button.disabled) button.style.background = '#0056D2'; };

        const progressSection = document.createElement('div');
        progressSection.style.cssText = 'display:none; padding:12px 14px; background:#1a1a2e;';

        function makeRow(label) {
            const wrap = document.createElement('div');
            wrap.style.marginBottom = '10px';
            const meta = document.createElement('div');
            meta.style.cssText = 'display:flex; justify-content:space-between; color:#ccc; font-size:12px; margin-bottom:4px;';
            const lbl = document.createElement('span'); lbl.textContent = label;
            const pct = document.createElement('span'); pct.textContent = '0%';
            meta.append(lbl, pct);
            const track = document.createElement('div');
            track.style.cssText = 'background:#333; border-radius:4px; height:8px; overflow:hidden;';
            const fill = document.createElement('div');
            fill.style.cssText = 'height:100%; width:0%; background:#0056D2; border-radius:4px; transition:width .2s ease;';
            track.appendChild(fill);
            wrap.append(meta, track);
            return {
                element: wrap,
                update(v) {
                    fill.style.width = `${v}%`;
                    pct.textContent = `${v}%`;
                    if (v >= 100) { fill.style.background = '#28a745'; pct.style.color = '#28a745'; }
                },
                setError() {
                    fill.style.background = '#dc3545';
                    pct.textContent = '✗';
                    pct.style.color = '#dc3545';
                },
                reset() {
                    fill.style.width = '0%';
                    fill.style.background = '#0056D2';
                    pct.textContent = '0%';
                    pct.style.color = '';
                }
            };
        }

        const videoRow = makeRow('🎬 Video');
        const subtitleRow = makeRow('💬 Subtitle');
        progressSection.append(videoRow.element, subtitleRow.element);
        panel.append(infoLabel, button, progressSection);
        document.body.appendChild(panel);

        button.onclick = async () => {
            button.disabled = true;
            button.style.background = '#555';
            videoRow.reset();
            subtitleRow.reset();
            progressSection.style.display = 'block';

            const { courseName, moduleName } = getCourseInfo();
            const { title, sequence } = getVideoInfo();
            const folder = `${courseName}/${moduleName}`;
            const baseName = `${sequence}_${title}`;

            const videoUrl = getVideoUrl();
            if (!videoUrl) {
                alert('❌ Video URL not found — may be DRM-protected or not yet loaded.\nTry waiting for the video to start playing.');
                button.disabled = false;
                button.style.background = '#0056D2';
                progressSection.style.display = 'none';
                return;
            }

            button.textContent = '⏳ Looking for subtitle...';
            let anchor = findSubtitleAnchor();

            if (!anchor) {
                const panelBtn = document.querySelector(
                    '[data-track-component="focused_lex_download_subtitle"],' +
                    'button[aria-label*="download" i],' +
                    'button[aria-label*="files" i],' +
                    '[data-e2e="item-files-button"]'
                );
                if (panelBtn) {
                    panelBtn.click();
                    console.log('[Coursera DL] Opened download panel, waiting...');
                }
                anchor = await waitForSubtitleAnchor(8000);
            }

            const subtitleUrl = anchor ? buildSubtitleUrl(anchor) : null;
            if (!subtitleUrl) console.warn('[Coursera DL] No subtitle found.');

            button.textContent = '⬇ Downloading...';

            const tasks = [
                downloadFile(videoUrl, `${baseName}.mp4`, folder, p => videoRow.update(p))
                    .catch(err => { videoRow.setError(); throw err; })
            ];

            if (subtitleUrl) {
                tasks.push(
                    downloadSubtitle(subtitleUrl, `${baseName}.vtt`, folder, p => subtitleRow.update(p))
                        .catch(err => { subtitleRow.setError(); return null; })
                );
            }

            const results = await Promise.allSettled(tasks);
            const videoOk = results[0]?.status === 'fulfilled';
            const subtitleOk = subtitleUrl && results[1]?.status === 'fulfilled';

            if (!videoOk) {
                button.textContent = '✗ Video failed';
                button.style.background = '#dc3545';
            } else if (!subtitleUrl) {
                button.textContent = '✓ Done (no subtitle found)';
                button.style.background = '#28a745';
            } else if (!subtitleOk) {
                button.textContent = '⚠ Done (subtitle failed)';
                button.style.background = '#e67e22';
            } else {
                button.textContent = '✓ Done!';
                button.style.background = '#28a745';
            }

            setTimeout(() => {
                button.textContent = '⬇ Download Video + Subtitle';
                button.style.background = '#0056D2';
                button.disabled = false;
                progressSection.style.display = 'none';
                videoRow.reset();
                subtitleRow.reset();
            }, 4000);
        };
    }

    window.addEventListener('load', () => setTimeout(createUI, 2000));
})();
