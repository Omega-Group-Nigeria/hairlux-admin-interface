/**
 * beauticians/ui.js — DOM rendering and presentation helpers
 */
(function (global) {
    'use strict';

    var BP = (global.BeauticiansPage = global.BeauticiansPage || {});
    var State = BP.State;
    var Utils = BP.Utils;
    var bootstrap = global.tabler && global.tabler.bootstrap;

    // Local aliases so extracted functions keep their original bare call style
    var showAlert = Utils.showAlert;
    var setSaveButtonState = Utils.setSaveButtonState;
    var canAccessSection = Utils.canAccessSection;
    var escHtml = Utils.escHtml;
    var detailField = Utils.detailField;
    var detailHeading = Utils.detailHeading;
    var detailCard = Utils.detailCard;
    var detailLight = Utils.detailLight;
    var detailHeavy = Utils.detailHeavy;
    var formatCommissionLabel = Utils.formatCommissionLabel;
    var isPdfUrl = Utils.isPdfUrl;
    var renderPortfolioUrl = Utils.renderPortfolioUrl;
    var commissionRateToPercent = Utils.commissionRateToPercent;
    var commissionPercentToRate = Utils.commissionPercentToRate;
    var formatScoringWeight = Utils.formatScoringWeight;
    var sanitizePercentInputValue = Utils.sanitizePercentInputValue;
    var applyDailyLimitInputs = Utils.applyDailyLimitInputs;
    var onUnlimitedToggle = Utils.onUnlimitedToggle;
    var readDailyLimitFromInputs = Utils.readDailyLimitFromInputs;
    var applyDispatchTierValue = Utils.applyDispatchTierValue;
    var payoutsCountLabel = Utils.payoutsCountLabel;
    var formatEarningsCell = Utils.formatEarningsCell;
    var getServiceCatalogPrice = Utils.getServiceCatalogPrice;
    var svcBeauticianSearchHaystack = Utils.svcBeauticianSearchHaystack;
    var scrServiceSearchHaystack = Utils.scrServiceSearchHaystack;

function initSettingsFieldHints() {
    document.querySelectorAll('#section-settings [data-field-hint], #section-service-rates [data-field-hint]').forEach(function (el) {
        if (el.dataset.hintReady === '1') return;
        var hint = State.SETTINGS_FIELD_HINTS[el.dataset.fieldHint];
        if (!hint) return;

        if (el.classList.contains('form-check-label')) {
            el.classList.add('d-inline-flex', 'align-items-center', 'gap-1', 'flex-wrap');
        } else if (el.classList.contains('form-label') || el.classList.contains('settings-scoring-label')) {
            el.classList.add('d-flex', 'align-items-center', 'gap-1');
        }

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-link btn-sm p-0 lh-1 settings-hint-btn';
        btn.setAttribute('aria-label', 'Show field hint');
        btn.innerHTML = State.SETTINGS_HINT_ICON;
        el.appendChild(btn);

        bootstrap.Popover.getOrCreateInstance(btn, {
            trigger: 'focus',
            placement: 'top',
            container: 'body',
            customClass: 'settings-field-popover',
            content: hint,
            sanitize: true,
        });

        el.dataset.hintReady = '1';
    });
}
function applyTabVisibility() {
    document.querySelectorAll('#section-tabs .nav-item').forEach(function (li) {
        var tab = li.querySelector('a[data-section]');
        if (!tab) return;
        li.style.display = canAccessSection(tab.dataset.section) ? '' : 'none';
    });
}
function applyPerformanceVisibility() {
    var el = document.getElementById('perf-summary');
    if (!el) return;
    el.classList.toggle('d-none', !RBAC.can('beauticians:read'));
}
function firstAccessibleSection() {
    for (var i = 0; i < State.VALID_SECTIONS.length; i++) {
        if (canAccessSection(State.VALID_SECTIONS[i])) return State.VALID_SECTIONS[i];
    }
    return 'list';
}
function renderPagination(prefix, meta) {
    var total = meta.total || 0;
    var page = meta.page || 1;
    var limit = meta.limit || 20;
    var pages = meta.totalPages || 1;
    var from = total ? (page - 1) * limit + 1 : 0;
    var to = Math.min(page * limit, total);
    document.getElementById(prefix + '-pagination-info').textContent = total ? 'Showing ' + from + '–' + to + ' of ' + total : 'No results';
    var ul = document.getElementById(prefix + '-pagination-btns');
    ul.innerHTML = '';
    ul.insertAdjacentHTML('beforeend',
        '<li class="page-item ' + (page <= 1 ? 'disabled' : '') + '"><a class="page-link" href="#" data-page="' + (page - 1) + '">«</a></li>');
    var start = Math.max(1, page - 2), end = Math.min(pages, start + 4);
    for (var p = start; p <= end; p++) {
        ul.insertAdjacentHTML('beforeend',
            '<li class="page-item ' + (p === page ? 'active' : '') + '"><a class="page-link" href="#" data-page="' + p + '">' + p + '</a></li>');
    }
    ul.insertAdjacentHTML('beforeend',
        '<li class="page-item ' + (page >= pages ? 'disabled' : '') + '"><a class="page-link" href="#" data-page="' + (page + 1) + '">»</a></li>');
}
function renderListTable(rows, meta) {
    var tbody = document.getElementById('list-tbody');
    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center text-secondary py-5">No beauticians found.</td></tr>';
        return;
    }
    tbody.innerHTML = rows.map(function (b, i) {
        var name = Beauticians.fullName(b);
        var email = (b.user && b.user.email) || '';
        var phone = (b.user && b.user.phone) || '';
        var dob = Beauticians.formatDateOfBirth(b);
        var contactMeta = [email, phone, dob !== '—' ? dob : ''].filter(Boolean).join(' · ');
        var rating = b.ratingAverage != null ? b.ratingAverage.toFixed(1) : '—';
        var jobs = b.totalJobsCompleted ?? '—';
        var earnings = Beauticians.formatMoney(b.totalEarnings);
        return '<tr class="beautician-row" data-id="' + b.id + '">' +
            '<td class="text-secondary small">' + ((State.list.page - 1) * State.list.limit + i + 1) + '</td>' +
            '<td><div class="fw-semibold">' + name + '</div><div class="text-secondary small">' + (contactMeta || '—') + '</div></td>' +
            '<td>' + Beauticians.kycBadge(b.kycStatus) + '</td>' +
            '<td>' + Beauticians.profileBadge(b.profileStatus) + '</td>' +
            '<td>' + Beauticians.availabilityBadge(b.availabilityStatus) + '</td>' +
            '<td class="fw-semibold">' + rating + '</td>' +
            '<td>' + jobs + '</td>' +
            '<td class="fw-semibold text-success">' + earnings + '</td>' +
            '<td>' + Beauticians.statusBadge(b.isActive) + '</td>' +
            '<td><button class="btn btn-sm btn-ghost-secondary px-2 open-detail-btn" data-id="' + b.id + '" title="View details">' +
            '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"/><path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6"/></svg>' +
            '</button></td>' +
            '</tr>';
    }).join('');
}
function openPhotoPreview(url, name) {
    if (!url) return;
    document.getElementById('modal-photo-img').src = url;
    document.getElementById('modal-photo-img').alt = name || 'Profile photo';
    document.getElementById('modal-photo-title').textContent = (name || 'Beautician') + ' — Profile Photo';
    document.getElementById('modal-photo-open').href = url;
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modal-photo-preview')).show();
}
function setCertPreviewLoading(loading) {
    var loadingEl = document.getElementById('modal-cert-loading');
    var img = document.getElementById('modal-cert-img');
    var frame = document.getElementById('modal-cert-frame');
    if (loading) {
        loadingEl.classList.remove('d-none');
        img.classList.add('d-none');
        frame.classList.add('d-none');
    } else {
        loadingEl.classList.add('d-none');
    }
}
function openCertificationPreview(url, title) {
    if (!url) return;
    var img = document.getElementById('modal-cert-img');
    var frame = document.getElementById('modal-cert-frame');
    var modalEl = document.getElementById('modal-cert-preview');
    document.getElementById('modal-cert-title').textContent = title || 'Certification';
    document.getElementById('modal-cert-open').href = url;

    img.onload = null;
    img.onerror = null;
    frame.onload = null;
    setCertPreviewLoading(true);

    function revealPreview(showEl) {
        setCertPreviewLoading(false);
        if (showEl) showEl.classList.remove('d-none');
    }

    if (isPdfUrl(url)) {
        frame.onload = function () {
            if (frame.getAttribute('src') !== url) return;
            frame.onload = null;
            revealPreview(frame);
        };
        frame.setAttribute('src', url);
    } else {
        img.onload = function () {
            img.onload = null;
            revealPreview(img);
        };
        img.onerror = function () {
            img.onerror = null;
            revealPreview(img);
        };
        img.alt = title || 'Certification';
        img.src = url;
    }

    bootstrap.Modal.getOrCreateInstance(modalEl).show();
}
function renderProfileReviewer(reviewer) {
    if (!reviewer || typeof reviewer !== 'object') {
        return '<span class="text-secondary">—</span>';
    }
    var name = [reviewer.firstName, reviewer.lastName].filter(Boolean).join(' ');
    var parts = [];
    if (name) parts.push('<div class="fw-semibold">' + escHtml(name) + '</div>');
    if (reviewer.email) parts.push('<div class="text-secondary small">' + escHtml(reviewer.email) + '</div>');
    return parts.length ? parts.join('') : '<span class="text-secondary">—</span>';
}
function renderCertifications(certifications) {
    if (!Array.isArray(certifications) || !certifications.length) {
        return '<div class="text-secondary small">No certifications uploaded</div>';
    }
    return '<div class="detail-cert-list">' + certifications.map(function (url, index) {
        var safeUrl = escHtml(url);
        var title = 'Certification ' + (index + 1);
        return '<button type="button" class="btn btn-sm btn-outline-secondary btn-view-certification" ' +
            'data-url="' + safeUrl + '" data-title="' + escHtml(title) + '">' + escHtml(title) + '</button>';
    }).join('') + '</div>';
}

/**
 * Allow only bare http(s) media URLs for the in-app KYC video player.
 * Rejects credentialed URLs and non-http schemes.
 */
function sanitizeMediaUrl(rawUrl) {
    if (rawUrl == null || String(rawUrl).trim() === '') return null;
    try {
        var parsed = new URL(String(rawUrl).trim());
        if ((parsed.protocol === 'https:' || parsed.protocol === 'http:') && !parsed.username && !parsed.password) {
            return parsed.href;
        }
    } catch (e) {
        return null;
    }
    return null;
}

/**
 * Public R2 URL from GET /admin/beauticians/:id → kycVideo.url
 * (public r2.dev URL; no signing / Cloudinary).
 */
function resolveKycVideoUrl(kycVideoOrUrl) {
    if (kycVideoOrUrl == null) return null;
    if (typeof kycVideoOrUrl === 'string') return sanitizeMediaUrl(kycVideoOrUrl);
    if (typeof kycVideoOrUrl === 'object') {
        return sanitizeMediaUrl(kycVideoOrUrl.url || kycVideoOrUrl.downloadUrl || '');
    }
    return null;
}

/**
 * Load full file bytes via XHR (handles R2 200 and 206 Partial Content).
 * fetch() + res.ok can still leave awkward partial responses; XHR blob is reliable.
 */
function fetchKycVideoBlob(url) {
    return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'blob';
        xhr.withCredentials = false;
        // Do not send Range — we want the full object when possible
        xhr.onload = function () {
            // 200 OK and 206 Partial Content are both usable when the body is present
            if (xhr.status !== 200 && xhr.status !== 206) {
                reject(new Error('Download failed (HTTP ' + xhr.status + ')'));
                return;
            }
            var blob = xhr.response;
            if (!blob || !blob.size) {
                reject(new Error('Downloaded file is empty'));
                return;
            }
            // Normalize type for save dialogs
            if (!blob.type || blob.type === 'application/octet-stream') {
                blob = new Blob([blob], { type: 'video/mp4' });
            }
            resolve(blob);
        };
        xhr.onerror = function () {
            reject(new Error('Network error while downloading video (check R2 CORS for this origin)'));
        };
        xhr.onabort = function () {
            reject(new Error('Download was cancelled'));
        };
        xhr.send();
    });
}

/**
 * Force a same-tab file download for cross-origin R2 URLs.
 * Plain <a download> is ignored for other origins and opens a new tab instead.
 */
function downloadKycVideo(url, fileName) {
    var safeUrl = sanitizeMediaUrl(url);
    if (!safeUrl) {
        if (typeof showAlert === 'function') showAlert('Video URL unavailable.', 'danger');
        return Promise.reject(new Error('Video URL unavailable.'));
    }
    var name = (fileName && String(fileName).trim()) || 'intro-video.mp4';
    name = name.replace(/[^\w.\-]+/g, '_') || 'intro-video.mp4';

    return fetchKycVideoBlob(safeUrl).then(function (blob) {
        var objectUrl = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = objectUrl;
        a.download = name;
        a.rel = 'noopener';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(function () {
            try { URL.revokeObjectURL(objectUrl); } catch (e) { /* ignore */ }
        }, 2000);
        if (typeof showAlert === 'function') {
            showAlert('Download started (' + name + ').', 'success');
        }
    });
}

// ── ffmpeg.wasm: re-encode broken mobile AAC so Chrome can play with audio ──
var _kycFfmpeg = null;
var _kycFfmpegLoadPromise = null;
var _kycBlobUrl = null;
var KYC_FFMPEG_SCRIPT = 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js';
var KYC_FFMPEG_CORE_BASE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';

function loadScriptOnce(src) {
    return new Promise(function (resolve, reject) {
        var existing = document.querySelector('script[data-kyc-src="' + src + '"]');
        if (existing) {
            if (existing.dataset.loaded === '1') resolve();
            else existing.addEventListener('load', function () { resolve(); });
            existing.addEventListener('error', function () { reject(new Error('Failed to load script')); });
            return;
        }
        var s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.dataset.kycSrc = src;
        s.onload = function () {
            s.dataset.loaded = '1';
            resolve();
        };
        s.onerror = function () {
            reject(new Error('Failed to load FFmpeg library'));
        };
        document.head.appendChild(s);
    });
}

function kycToBlobURL(url, mimeType) {
    return fetch(url)
        .then(function (res) {
            if (!res.ok) throw new Error('Could not download FFmpeg core (' + res.status + ')');
            return res.arrayBuffer();
        })
        .then(function (buf) {
            return URL.createObjectURL(new Blob([buf], { type: mimeType || 'application/octet-stream' }));
        });
}

function revokeKycBlobUrl() {
    if (_kycBlobUrl) {
        try {
            URL.revokeObjectURL(_kycBlobUrl);
        } catch (e) { /* ignore */ }
        _kycBlobUrl = null;
    }
}

/**
 * Lazy-load ffmpeg.wasm (single-thread core). Cached after first open.
 * First load downloads ~25–30 MB core; later opens reuse the instance.
 * Safe to call repeatedly — concurrent callers share one load promise.
 */
function getKycFfmpeg(onStatus) {
    if (_kycFfmpeg && _kycFfmpeg.loaded) {
        return Promise.resolve(_kycFfmpeg);
    }
    if (_kycFfmpegLoadPromise) return _kycFfmpegLoadPromise;

    if (typeof onStatus === 'function') {
        onStatus('Downloading video engine in the background (first time only)…');
    }

    _kycFfmpegLoadPromise = loadScriptOnce(KYC_FFMPEG_SCRIPT)
        .then(function () {
            var FFmpegCtor = (window.FFmpegWASM && window.FFmpegWASM.FFmpeg) || (window.FFmpeg && window.FFmpeg.FFmpeg);
            if (!FFmpegCtor) throw new Error('FFmpeg WASM failed to initialize');
            if (typeof onStatus === 'function') {
                onStatus('Loading video engine core…');
            }
            var ffmpeg = new FFmpegCtor();
            return Promise.all([
                kycToBlobURL(KYC_FFMPEG_CORE_BASE + '/ffmpeg-core.js', 'text/javascript'),
                kycToBlobURL(KYC_FFMPEG_CORE_BASE + '/ffmpeg-core.wasm', 'application/wasm'),
            ]).then(function (urls) {
                return ffmpeg.load({
                    coreURL: urls[0],
                    wasmURL: urls[1],
                }).then(function () {
                    _kycFfmpeg = ffmpeg;
                    return ffmpeg;
                });
            });
        })
        .catch(function (err) {
            _kycFfmpegLoadPromise = null;
            throw err;
        });

    return _kycFfmpegLoadPromise;
}

/**
 * Kick off engine download without blocking (first Play click).
 * Subsequent getKycFfmpeg() calls reuse the same in-flight promise.
 */
function warmKycFfmpegInBackground() {
    if (_kycFfmpeg && _kycFfmpeg.loaded) return;
    if (_kycFfmpegLoadPromise) return;
    getKycFfmpeg(null).catch(function () {
        // Errors surface when prepareKycVideoForPlayback awaits the same promise
    });
}

/**
 * Fetch public R2 video while engine loads (in parallel on first open),
 * re-encode audio to AAC 44.1 kHz (copy video), return blob: URL.
 */
function prepareKycVideoForPlayback(remoteUrl, onStatus) {
    var status = typeof onStatus === 'function' ? onStatus : function () {};
    var engineReady = false;
    var videoReady = false;

    function syncStatus() {
        if (!engineReady && !videoReady) {
            status('Downloading video engine & video in the background…');
        } else if (!engineReady && videoReady) {
            status('Video ready — finishing video engine download…');
        } else if (engineReady && !videoReady) {
            status('Engine ready — downloading video…');
        } else {
            status('Fixing audio for browser playback…');
        }
    }

    // Start both immediately so the ~30 MB engine does not block the R2 fetch
    warmKycFfmpegInBackground();
    syncStatus();

    var engineP = getKycFfmpeg(function (msg) {
        if (!engineReady) status(msg || 'Downloading video engine in the background…');
    }).then(function (ffmpeg) {
        engineReady = true;
        syncStatus();
        return ffmpeg;
    });

    var videoP = fetch(remoteUrl, {
        mode: 'cors',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        cache: 'no-store',
    }).then(function (res) {
        if (!res.ok && res.status !== 206) {
            throw new Error('Storage returned HTTP ' + res.status);
        }
        return res.arrayBuffer();
    }).then(function (buf) {
        if (!buf || !buf.byteLength) throw new Error('Downloaded video is empty');
        videoReady = true;
        syncStatus();
        return buf;
    });

    return Promise.all([engineP, videoP]).then(function (results) {
        var ffmpeg = results[0];
        var buf = results[1];
        status('Fixing audio for browser playback…');
        var input = new Uint8Array(buf);
        return ffmpeg.writeFile('input.mp4', input).then(function () {
            return ffmpeg.exec([
                '-i', 'input.mp4',
                '-c:v', 'copy',
                '-c:a', 'aac',
                '-b:a', '128k',
                '-ar', '44100',
                '-ac', '1',
                '-movflags', '+faststart',
                'output.mp4',
            ]);
        }).then(function () {
            return ffmpeg.readFile('output.mp4');
        }).then(function (data) {
            try { ffmpeg.deleteFile('input.mp4'); } catch (e1) { /* ignore */ }
            try { ffmpeg.deleteFile('output.mp4'); } catch (e2) { /* ignore */ }
            var bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
            var blob = new Blob([bytes], { type: 'video/mp4' });
            revokeKycBlobUrl();
            _kycBlobUrl = URL.createObjectURL(blob);
            return _kycBlobUrl;
        });
    });
}

function loadKycVideoSource(video, src, loadToken) {
    if (!video || !src) return;
    video.dataset.kycLoadToken = loadToken || video.dataset.kycLoadToken || '';
    video.setAttribute('playsinline', '');
    video.setAttribute('preload', 'auto');
    video.setAttribute('controlslist', 'nodownload noremoteplayback');
    video.setAttribute('disablepictureinpicture', '');
    video.setAttribute('referrerpolicy', 'no-referrer');
    video.controls = false;
    video.autoplay = false;
    video.src = src;
    try {
        video.load();
    } catch (e) { /* ignore */ }
}

function formatMediaTime(seconds) {
    if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '0:00';
    var total = Math.floor(seconds);
    var m = Math.floor(total / 60);
    var s = total % 60;
    return m + ':' + String(s).padStart(2, '0');
}

function getKycVideoEl() {
    return document.getElementById('modal-kyc-video');
}

function setKycVideoPlayUi(isPlaying) {
    var playIcon = document.getElementById('kyc-video-icon-play');
    var pauseIcon = document.getElementById('kyc-video-icon-pause');
    var btn = document.getElementById('kyc-video-play-pause');
    if (playIcon) playIcon.classList.toggle('d-none', !!isPlaying);
    if (pauseIcon) pauseIcon.classList.toggle('d-none', !isPlaying);
    if (btn) btn.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
}

function setKycVideoMuteUi(muted) {
    var onIcon = document.getElementById('kyc-video-icon-volume');
    var offIcon = document.getElementById('kyc-video-icon-mute');
    var btn = document.getElementById('kyc-video-mute');
    if (onIcon) onIcon.classList.toggle('d-none', !!muted);
    if (offIcon) offIcon.classList.toggle('d-none', !muted);
    if (btn) btn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
}

function setKycVideoControlsEnabled(enabled) {
    var controls = document.getElementById('kyc-video-controls');
    var playBtn = document.getElementById('kyc-video-play-pause');
    var muteBtn = document.getElementById('kyc-video-mute');
    var seek = document.getElementById('kyc-video-seek');
    var volume = document.getElementById('kyc-video-volume');
    if (controls) controls.classList.toggle('is-disabled', !enabled);
    if (playBtn) playBtn.disabled = !enabled;
    if (muteBtn) muteBtn.disabled = !enabled;
    if (volume) volume.disabled = !enabled;
    if (seek) {
        var video = getKycVideoEl();
        var hasDuration = video && Number.isFinite(video.duration) && video.duration > 0;
        seek.disabled = !enabled || !hasDuration;
    }
}

function setKycVideoLoading(isLoading, message) {
    var loadingEl = document.getElementById('kyc-video-loading');
    var msgEl = document.getElementById('kyc-video-loading-msg');
    var video = getKycVideoEl();
    if (loadingEl) loadingEl.classList.toggle('d-none', !isLoading);
    if (msgEl && message) msgEl.textContent = message;
    if (msgEl && isLoading && !message) msgEl.textContent = 'Preparing video…';
    if (video) video.classList.toggle('is-hidden', !!isLoading);
    if (isLoading) {
        setKycVideoControlsEnabled(false);
        hideKycVideoError();
    }
}

function hideKycVideoError() {
    var errEl = document.getElementById('kyc-video-error');
    if (!errEl) return;
    errEl.classList.add('d-none');
    var titleEl = document.getElementById('kyc-video-error-title');
    var msgEl = document.getElementById('kyc-video-error-msg');
    if (titleEl) titleEl.textContent = 'Could not load video';
    if (msgEl) msgEl.textContent = 'Something went wrong while fetching this intro video.';
}

function showKycVideoError(title, message) {
    var loadingEl = document.getElementById('kyc-video-loading');
    var errEl = document.getElementById('kyc-video-error');
    var titleEl = document.getElementById('kyc-video-error-title');
    var msgEl = document.getElementById('kyc-video-error-msg');
    var video = getKycVideoEl();
    if (loadingEl) loadingEl.classList.add('d-none');
    if (video) video.classList.add('is-hidden');
    if (titleEl) titleEl.textContent = title || 'Could not load video';
    if (msgEl) msgEl.textContent = message || 'Something went wrong while fetching this intro video.';
    if (errEl) errEl.classList.remove('d-none');
    setKycVideoPlayUi(false);
    setKycVideoControlsEnabled(false);
}

function kycVideoErrorMessageFromMedia(video) {
    var code = video && video.error ? video.error.code : null;
    // MEDIA_ERR_* constants: 1 aborted, 2 network, 3 decode, 4 src not supported
    if (code === 2) {
        return {
            title: 'Network error',
            message: 'The video could not be loaded from storage. Check the public R2 URL and your connection.',
        };
    }
    if (code === 3) {
        return {
            title: 'Playback error',
            message: 'This file could not be decoded. Ask the beautician to re-upload as MP4 (H.264 + AAC) if the problem continues.',
        };
    }
    if (code === 4) {
        return {
            title: 'Could not load video',
            message: 'The browser could not open this stream. Confirm the public R2 object URL is reachable and the file is a valid MP4.',
        };
    }
    if (code === 1) {
        return {
            title: 'Load cancelled',
            message: 'Video loading was interrupted. Close and open the player again to retry.',
        };
    }
    return {
        title: 'Could not load video',
        message: 'The intro video failed to load from the public storage URL.',
    };
}

function markKycVideoReady() {
    var video = getKycVideoEl();
    var errEl = document.getElementById('kyc-video-error');
    if (errEl && !errEl.classList.contains('d-none')) return;
    setKycVideoLoading(false);
    if (video) video.classList.remove('is-hidden');
    setKycVideoControlsEnabled(true);
    syncKycVideoProgress();
}

function syncKycVideoProgress() {
    var video = getKycVideoEl();
    if (!video) return;
    var seek = document.getElementById('kyc-video-seek');
    var currentEl = document.getElementById('kyc-video-current');
    var durationEl = document.getElementById('kyc-video-duration');
    var duration = Number.isFinite(video.duration) ? video.duration : 0;
    var current = Number.isFinite(video.currentTime) ? video.currentTime : 0;
    var controls = document.getElementById('kyc-video-controls');
    var controlsOn = controls && !controls.classList.contains('is-disabled');
    if (seek && seek.dataset.seeking !== '1') {
        seek.max = duration > 0 ? String(duration) : '0';
        seek.value = String(current);
        seek.disabled = !controlsOn || duration <= 0;
    }
    if (currentEl) currentEl.textContent = formatMediaTime(current);
    if (durationEl) durationEl.textContent = formatMediaTime(duration);
}

/**
 * Stop playback and clear the media element source (including blob URLs from ffmpeg).
 */
function stopKycVideoPlayer() {
    var video = getKycVideoEl();
    if (!video) return;
    video.dataset.kycLoadToken = '';
    try {
        video.pause();
    } catch (e) { /* ignore */ }
    video.removeAttribute('src');
    while (video.firstChild) video.removeChild(video.firstChild);
    try {
        video.load();
    } catch (e2) { /* ignore */ }
    revokeKycBlobUrl();
    setKycVideoPlayUi(false);
    setKycVideoControlsEnabled(false);
    var seek = document.getElementById('kyc-video-seek');
    if (seek) {
        seek.value = '0';
        seek.max = '0';
        seek.disabled = true;
        seek.dataset.seeking = '0';
    }
    var currentEl = document.getElementById('kyc-video-current');
    var durationEl = document.getElementById('kyc-video-duration');
    if (currentEl) currentEl.textContent = '0:00';
    if (durationEl) durationEl.textContent = '0:00';
    hideKycVideoError();
    setKycVideoLoading(false);
    if (video) video.classList.remove('is-hidden');
}

/**
 * Open intro video: fetch public R2 URL → ffmpeg.wasm re-encode audio → play blob.
 * Keeps H.264 video as-is; rewrites AAC so Chrome can decode with sound.
 */
function openKycVideoModal(url, opts) {
    opts = opts || {};
    var remoteUrl = resolveKycVideoUrl(url);
    var video = getKycVideoEl();
    var modalEl = document.getElementById('modal-kyc-video-preview');
    var titleEl = document.getElementById('modal-kyc-video-title');
    if (!video || !modalEl) return;

    if (titleEl) titleEl.textContent = opts.title || 'Intro video';

    stopKycVideoPlayer();
    // First Play: start ~30 MB engine download immediately (shared promise; does not block R2 fetch)
    warmKycFfmpegInBackground();
    setKycVideoLoading(true, 'Downloading video engine & video in the background…');
    bootstrap.Modal.getOrCreateInstance(modalEl).show();

    if (!remoteUrl) {
        showKycVideoError(
            'Video unavailable',
            'No public video URL is available for this intro video.'
        );
        return;
    }

    var loadToken = String(Date.now()) + '-' + Math.random().toString(36).slice(2, 8);
    video.dataset.kycLoadToken = loadToken;

    var volume = document.getElementById('kyc-video-volume');
    if (volume) {
        var vol = parseFloat(volume.value);
        if (!Number.isFinite(vol)) vol = 0.85;
        volume.value = String(vol);
        video.volume = Math.min(1, Math.max(0, vol));
        video.muted = vol <= 0;
        setKycVideoMuteUi(video.muted);
    }

    prepareKycVideoForPlayback(remoteUrl, function (msg) {
        if (video.dataset.kycLoadToken !== loadToken) return;
        setKycVideoLoading(true, msg);
    })
        .then(function (blobUrl) {
            if (video.dataset.kycLoadToken !== loadToken) {
                // Modal was closed mid-process; drop this blob if we created a new one
                if (blobUrl && blobUrl === _kycBlobUrl) return;
                return;
            }
            setKycVideoLoading(true, 'Starting player…');
            loadKycVideoSource(video, blobUrl, loadToken);
        })
        .catch(function (err) {
            if (video.dataset.kycLoadToken !== loadToken) return;
            var message = (err && err.message) ? String(err.message) : 'Processing failed.';
            // Common when SharedArrayBuffer is blocked without COOP/COEP on some hosts
            if (/SharedArrayBuffer|cross-origin|security/i.test(message)) {
                message = 'Video engine needs a secure context. Serve admin over HTTPS with Cross-Origin-Opener-Policy: same-origin and Cross-Origin-Embedder-Policy: require-corp, or open via a host that sets those headers.';
            }
            showKycVideoError('Could not prepare video', message);
        });

    window.setTimeout(function () {
        if (video.dataset.kycLoadToken !== loadToken) return;
        var errVisible = document.getElementById('kyc-video-error');
        var stillLoading = document.getElementById('kyc-video-loading');
        if (errVisible && !errVisible.classList.contains('d-none')) return;
        if (stillLoading && stillLoading.classList.contains('d-none')) return;
        if (video.readyState >= 2) {
            markKycVideoReady();
            return;
        }
        showKycVideoError(
            'Taking too long',
            'Preparing the video is taking longer than expected. First open downloads the video engine (~30 MB) in the background. Try again on a faster connection.'
        );
    }, 120000);
}

/**
 * KYC intro video from GET /admin/beauticians/:id → data.kycVideo
 * Shape: { fileKey, url } (public R2.dev URL).
 */
function renderKycVideo(kycVideo) {
    if (!kycVideo || typeof kycVideo !== 'object') {
        return '<div class="text-secondary small">No intro video submitted</div>';
    }
    var safeHref = resolveKycVideoUrl(kycVideo);
    var fileName = 'intro-video.mp4';
    if (kycVideo.fileKey) {
        var keyParts = String(kycVideo.fileKey).split('/');
        var last = keyParts[keyParts.length - 1];
        if (last) fileName = last.replace(/[^\w.\-]+/g, '_') || fileName;
    }
    var actions = safeHref
        ? '<div class="d-flex flex-wrap align-items-center gap-2">' +
            '<button type="button" class="btn btn-sm btn-primary btn-view-kyc-video" data-url="' + escHtml(safeHref) + '" data-title="Intro video">' +
            '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-inline me-1" aria-hidden="true"><path d="M7 4v16l13 -8z"/></svg>' +
            'Play intro video' +
            '</button>' +
            '<button type="button" class="btn btn-sm btn-outline-secondary btn-download-kyc-video" data-url="' + escHtml(safeHref) + '" data-filename="' + escHtml(fileName) + '">' +
            '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-inline me-1" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2"/><path d="M7 11l5 5l5 -5"/><path d="M12 4l0 12"/></svg>' +
            'Download video' +
            '</button>' +
          '</div>'
        : '<span class="text-secondary small">Video URL unavailable.</span>';
    return '<div class="row g-3">' +
        detailField('Status', '<span class="badge bg-success-lt">Submitted</span>') +
        (kycVideo.fileKey
            ? detailField('File', '<span class="font-monospace small text-break">' + escHtml(kycVideo.fileKey) + '</span>', 'col-12')
            : '') +
        '<div class="col-12 mt-1">' +
        actions +
        '</div></div>';
}

/** Wire modal player controls once (idempotent). */
function initKycVideoModal() {
    var modalEl = document.getElementById('modal-kyc-video-preview');
    var video = getKycVideoEl();
    if (!modalEl || !video || modalEl.dataset.kycVideoReady === '1') return;
    modalEl.dataset.kycVideoReady = '1';

    var playBtn = document.getElementById('kyc-video-play-pause');
    var muteBtn = document.getElementById('kyc-video-mute');
    var seek = document.getElementById('kyc-video-seek');
    var volume = document.getElementById('kyc-video-volume');

    if (playBtn) {
        playBtn.addEventListener('click', function () {
            if (!video.src || playBtn.disabled) return;
            if (video.paused || video.ended) {
                var p = video.play();
                if (p && typeof p.catch === 'function') {
                    p.catch(function () {
                        setKycVideoPlayUi(false);
                        showKycVideoError(
                            'Could not start playback',
                            'The browser blocked or failed to start playback. Try again.'
                        );
                    });
                }
            } else {
                video.pause();
            }
        });
    }

    if (muteBtn) {
        muteBtn.addEventListener('click', function () {
            if (muteBtn.disabled) return;
            video.muted = !video.muted;
            if (!video.muted && video.volume === 0 && volume) {
                volume.value = '0.5';
                video.volume = 0.5;
            }
            setKycVideoMuteUi(video.muted);
            if (volume && !video.muted) volume.value = String(video.volume);
            if (volume && video.muted) volume.value = '0';
        });
    }

    if (seek) {
        seek.addEventListener('pointerdown', function () { seek.dataset.seeking = '1'; });
        seek.addEventListener('pointerup', function () { seek.dataset.seeking = '0'; });
        seek.addEventListener('pointercancel', function () { seek.dataset.seeking = '0'; });
        seek.addEventListener('input', function () {
            if (seek.disabled) return;
            var t = parseFloat(seek.value);
            if (Number.isFinite(t)) video.currentTime = t;
            var currentEl = document.getElementById('kyc-video-current');
            if (currentEl) currentEl.textContent = formatMediaTime(t);
        });
        seek.addEventListener('change', function () {
            seek.dataset.seeking = '0';
            syncKycVideoProgress();
        });
    }

    if (volume) {
        volume.addEventListener('input', function () {
            if (volume.disabled) return;
            var v = parseFloat(volume.value);
            if (!Number.isFinite(v)) return;
            video.volume = Math.min(1, Math.max(0, v));
            video.muted = video.volume === 0;
            setKycVideoMuteUi(video.muted);
        });
    }

    video.addEventListener('play', function () { setKycVideoPlayUi(true); });
    video.addEventListener('pause', function () { setKycVideoPlayUi(false); });
    video.addEventListener('ended', function () { setKycVideoPlayUi(false); });
    video.addEventListener('timeupdate', syncKycVideoProgress);
    video.addEventListener('durationchange', syncKycVideoProgress);
    video.addEventListener('loadedmetadata', function () {
        syncKycVideoProgress();
        // Metadata alone is enough to enable seek; keep spinner until canplay if still buffering
        if (video.readyState >= 3) markKycVideoReady();
    });
    video.addEventListener('canplay', function () {
        markKycVideoReady();
    });
    video.addEventListener('canplaythrough', function () {
        markKycVideoReady();
    });
    video.addEventListener('waiting', function () {
        // Mid-playback buffer stall: subtle loading without full error state
        if (!video.paused && video.currentTime > 0) return;
        var errEl = document.getElementById('kyc-video-error');
        if (errEl && !errEl.classList.contains('d-none')) return;
        setKycVideoLoading(true);
    });
    video.addEventListener('playing', function () {
        markKycVideoReady();
    });
    video.addEventListener('error', function () {
        var info = kycVideoErrorMessageFromMedia(video);
        showKycVideoError(info.title, info.message);
    });

    modalEl.addEventListener('hidden.bs.modal', function () {
        stopKycVideoPlayer();
    });
    // Pause immediately when hide starts (before animation ends)
    modalEl.addEventListener('hide.bs.modal', function () {
        try { video.pause(); } catch (e) { /* ignore */ }
    });
}
function renderBeauticianBankDetails(b) {
    var bank = b.payoutBankAccount || b.bankAccount || b.payoutDetails || {};
    var bankName = b.bankName || bank.bankName || b.bankCode || bank.bankCode || '';
    var accountNumber = b.accountNumber || bank.accountNumber || '';
    var accountName = b.accountName || bank.accountName || '';
    if (!bankName && !accountNumber && !accountName) {
        return '<div class="text-secondary small">No payout bank details on file</div>';
    }
    return '<div class="row g-3">' +
        detailField('Bank', escHtml(bankName || '—'), 'col-sm-6') +
        detailField('Account Number', '<span class="font-monospace">' + escHtml(accountNumber || '—') + '</span>', 'col-sm-6') +
        detailField('Account Name', escHtml(accountName || '—'), 'col-sm-12') +
        '</div>';
}

function detailMetric(label, valueHtml, valueClass) {
    return '<div class="col-6 col-md-4">' +
        '<div class="detail-metric">' +
        '<div class="detail-metric-label">' + escHtml(label) + '</div>' +
        '<div class="detail-metric-value' + (valueClass ? ' ' + valueClass : '') + '">' + valueHtml + '</div>' +
        '</div></div>';
}

function renderStarRating(rating) {
    var n = Math.round(Number(rating) || 0);
    if (n < 0) n = 0;
    if (n > 5) n = 5;
    var html = '<span class="detail-review-stars" aria-label="' + n + ' out of 5">';
    for (var i = 1; i <= 5; i++) {
        html += i <= n ? '★' : '<span class="star-empty">★</span>';
    }
    html += '</span>';
    return html;
}

function reviewCustomerName(r) {
    if (!r || typeof r !== 'object') return 'Customer';
    var c = r.customer || r.user || r.reviewer || {};
    var parts = [c.firstName || r.customerFirstName, c.lastName || r.customerLastName].filter(Boolean);
    if (parts.length) return parts.join(' ');
    return c.name || r.customerName || r.userName || 'Customer';
}

function reviewCommentText(r) {
    if (!r || typeof r !== 'object') return '';
    return r.comment || r.notes || r.reviewNotes || r.body || r.text || r.feedback || '';
}

function renderCustomerReviewItem(r) {
    var rating = r.rating != null ? r.rating : r.score;
    var comment = reviewCommentText(r);
    var when = r.createdAt || r.reviewedAt || r.updatedAt;
    var booking = r.reservationCode || (r.booking && (r.booking.reservationCode || r.booking.id)) || r.bookingId || '';
    return '<article class="detail-review-item">' +
        '<div class="detail-review-item-top">' +
        '<div class="fw-semibold text-truncate" title="' + escHtml(reviewCustomerName(r)) + '">' + escHtml(reviewCustomerName(r)) + '</div>' +
        (when ? '<div class="text-secondary small text-nowrap">' + escHtml(Beauticians.formatDateTime(when)) + '</div>' : '') +
        '</div>' +
        '<div class="mt-1">' + renderStarRating(rating) +
        (rating != null ? ' <span class="text-secondary small">' + escHtml(Number(rating).toFixed(1)) + '</span>' : '') +
        '</div>' +
        (comment
            ? '<div class="detail-prose detail-review-comment mt-2">' + escHtml(comment) + '</div>'
            : '<div class="text-secondary small mt-2">No written comment</div>') +
        (booking
            ? '<div class="text-secondary small mt-auto pt-2">Booking <span class="font-monospace">' + escHtml(booking) + '</span></div>'
            : '') +
        '</article>';
}

function renderDetailReviewsListHtml(rows) {
    if (!rows || !rows.length) {
        return '<div class="text-secondary text-center py-4">No customer reviews yet.</div>';
    }
    return '<div class="detail-reviews-grid">' + rows.map(renderCustomerReviewItem).join('') + '</div>';
}

function renderDetailReviewsPagination(meta) {
    meta = meta || {};
    var total = meta.total != null ? Number(meta.total) : 0;
    var page = meta.page || State.detailReviews.page || 1;
    var limit = meta.limit || State.detailReviews.limit || 10;
    var pages = meta.totalPages || State.detailReviews.totalPages || 1;
    if (!total && pages <= 1) {
        return '';
    }
    var from = total ? (page - 1) * limit + 1 : 0;
    var to = total ? Math.min(page * limit, total) : 0;
    var info = total ? 'Showing ' + from + '–' + to + ' of ' + total : 'Page ' + page;

    var btns = '';
    btns += '<li class="page-item ' + (page <= 1 ? 'disabled' : '') + '">' +
        '<a class="page-link" href="#" data-detail-reviews-page="' + (page - 1) + '" aria-label="Previous">«</a></li>';
    var start = Math.max(1, page - 2);
    var end = Math.min(pages, start + 4);
    for (var p = start; p <= end; p++) {
        btns += '<li class="page-item ' + (p === page ? 'active' : '') + '">' +
            '<a class="page-link" href="#" data-detail-reviews-page="' + p + '">' + p + '</a></li>';
    }
    btns += '<li class="page-item ' + (page >= pages ? 'disabled' : '') + '">' +
        '<a class="page-link" href="#" data-detail-reviews-page="' + (page + 1) + '" aria-label="Next">»</a></li>';

    return '<div class="detail-reviews-footer">' +
        '<p class="m-0 text-secondary small" id="detail-reviews-pagination-info">' + escHtml(info) + '</p>' +
        (pages > 1
            ? '<ul class="pagination pagination-sm m-0" id="detail-reviews-pagination-btns">' + btns + '</ul>'
            : '') +
        '</div>';
}

function updateDetailReviewsPanel(rows, meta, opts) {
    opts = opts || {};
    var list = document.getElementById('detail-reviews-list');
    var footer = document.getElementById('detail-reviews-footer-wrap');
    var errEl = document.getElementById('detail-reviews-error');
    if (!list) return;

    if (errEl) {
        if (opts.error) {
            errEl.textContent = opts.error;
            errEl.classList.remove('d-none');
        } else {
            errEl.textContent = '';
            errEl.classList.add('d-none');
        }
    }

    if (opts.loading) {
        list.innerHTML = '<div class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary" role="status"></div></div>';
        if (footer) footer.innerHTML = '';
        return;
    }

    list.innerHTML = renderDetailReviewsListHtml(rows || []);
    if (footer) footer.innerHTML = renderDetailReviewsPagination(meta || {});
}

function renderBeauticianDetailContent(b, settings) {
    var user = b.user || {};
    var name = Beauticians.fullName(b);
    var email = user.email || '—';
    var phone = user.phone || '—';
    var dateOfBirth = Beauticians.formatDateOfBirth(b);
    var walletBalance = b.walletBalance != null ? Beauticians.formatMoney(b.walletBalance) : '—';
    var totalEarnings = b.totalEarnings != null ? Beauticians.formatMoney(b.totalEarnings) : '—';
    var ratingAverage = b.ratingAverage != null ? Number(b.ratingAverage).toFixed(1) : '—';
    var platformCommission = settings ? formatCommissionLabel(settings.commissionRate) : null;
    // Per-beautician commissionRateOverride is no longer applied to job offers / payouts / wallet credit.
    // Pay is platform default + per-service overrides (Beauticians → Service Rates).
    var commissionDisplay = platformCommission
        ? platformCommission + '% <span class="text-secondary small fw-normal">(platform default; per-service overrides may apply)</span>'
        : '—';
    var payoutMode = settings && settings.payoutMode
        ? escHtml(String(settings.payoutMode).replace(/_/g, ' '))
        : '—';

    var specialties = Array.isArray(b.specialties) && b.specialties.length
        ? b.specialties.map(function (s) { return '<span class="badge bg-azure-lt me-1 mb-1">' + escHtml(s) + '</span>'; }).join('')
        : '<span class="text-secondary">None listed</span>';

    var assignedSvc = Array.isArray(b.assignedServices) && b.assignedServices.length
        ? b.assignedServices.map(function (as) {
            var svc = as.service || {};
            return '<div class="service-row d-flex justify-content-between align-items-start gap-3 py-1 border-bottom">' +
                '<span>' + escHtml(svc.name || 'Service') + '</span>' +
                '<span class="text-secondary text-nowrap">' + Beauticians.formatMoney(svc.homeServicePrice) + '</span></div>';
        }).join('')
        : '<div class="text-secondary py-2">No services assigned</div>';

    var assignedCount = Array.isArray(b.assignedServices) ? b.assignedServices.length : 0;
    var recentCount = Array.isArray(b.recentJobs) ? b.recentJobs.length : 0;

    var recentJobsHtml = recentCount
        ? b.recentJobs.slice(0, 5).map(function (j) {
            return '<div class="detail-job-row d-flex justify-content-between align-items-start gap-2 py-2 border-bottom small">' +
                '<span class="font-monospace">' + escHtml(j.reservationCode || '—') + '</span>' +
                '<span class="text-secondary">' + escHtml(Beauticians.formatDate(j.bookingDate)) + '</span>' +
                '<span class="text-nowrap">' + Beauticians.formatMoney(j.totalAmount) + '</span></div>';
        }).join('')
        : '<div class="text-secondary small py-2">No recent jobs</div>';

    var photoUrl = b.profilePhotoUrl || '';
    var initials = ((user.firstName || '?')[0] + (user.lastName || '')[0]).toUpperCase() || '?';
    var safePhotoUrl = escHtml(photoUrl);
    var safeName = escHtml(name);
    var avatarHtml = photoUrl
        ? '<span class="avatar avatar-lg rounded btn-view-photo-avatar btn-view-photo" role="button" tabindex="0" title="View photo" data-url="' + safePhotoUrl + '" data-name="' + safeName + '"><img src="' + safePhotoUrl + '" alt="' + safeName + '"></span>'
        : '<span class="avatar avatar-lg rounded-circle bg-primary-lt fw-bold fs-4">' + escHtml(initials) + '</span>';
    var viewPhotoHtml = photoUrl
        ? '<button type="button" class="btn btn-sm btn-ghost-primary px-0 mt-1 btn-view-photo" data-url="' + safePhotoUrl + '" data-name="' + safeName + '">View photo</button>'
        : '';

    var dispatchUntil = Beauticians.dispatchSuspendedUntil(b);
    var dispatchReason = Beauticians.dispatchSuspendedReason(b);

    var heroCard = detailCard(null,
        '<div class="detail-hero-layout">' +
        avatarHtml +
        '<div class="detail-hero-meta">' +
        '<div class="d-flex align-items-center gap-2 flex-wrap">' +
        '<div class="fw-bold fs-3 lh-sm mb-0">' + escHtml(name) + '</div>' +
        Beauticians.statusBadge(b.isActive) +
        '</div>' +
        '<div class="text-secondary mt-1">' + escHtml(email) + '</div>' +
        '<div class="text-secondary">' + escHtml(phone) + '</div>' +
        '<div class="text-secondary small">Born ' + escHtml(dateOfBirth) + '</div>' +
        viewPhotoHtml +
        '</div>' +
        '<div class="detail-hero-side">' +
        '<div class="detail-field-label">Profile ID</div>' +
        '<div class="font-monospace text-secondary small text-break">' + escHtml(b.id) + '</div>' +
        '</div></div>',
        { className: 'detail-card-hero' });

    var statusBody =
        '<div class="row g-3">' +
        detailField('KYC', Beauticians.kycBadge(b.kycStatus)) +
        detailField('Profile', Beauticians.profileBadge(b.profileStatus)) +
        detailField('Account', Beauticians.statusBadge(b.isActive)) +
        detailField('Availability', Beauticians.availabilityBadge(b.availabilityStatus)) +
        detailField('Dispatch Matching', Beauticians.dispatchSuspendedBadge(!!b.dispatchSuspended, dispatchUntil), 'col-12') +
        (b.dispatchSuspended && dispatchUntil
            ? detailField('Dispatch Suspended Until', escHtml(Beauticians.formatDateTime(dispatchUntil)))
            : '') +
        (b.dispatchSuspended && dispatchReason
            ? detailField('Dispatch Suspend Reason', escHtml(dispatchReason), 'col-12')
            : '') +
        '</div>';

    var reviewNotesRaw = b.reviewNotes || b.profileReviewNotes || b.adminReviewNotes || '';
    var performanceBody =
        '<div class="row g-2">' +
        detailMetric('Avg rating', escHtml(ratingAverage)) +
        detailMetric('Jobs completed', escHtml(b.totalJobsCompleted != null ? b.totalJobsCompleted : '—')) +
        detailMetric('Wallet', escHtml(walletBalance), 'text-success') +
        '</div>' +
        '<div class="mt-3 pt-3 border-top">' +
        '<div class="detail-field-label">Profile reviewed by</div>' +
        '<div class="detail-field-value">' + renderProfileReviewer(b.profileReviewedBy) + '</div>' +
        (b.profileReviewedAt
            ? '<div class="text-secondary small mt-1">Reviewed ' + escHtml(Beauticians.formatDateTime(b.profileReviewedAt)) + '</div>'
            : '') +
        '</div>' +
        (reviewNotesRaw
            ? '<div class="mt-3 pt-3 border-top">' +
                '<div class="detail-field-label">Review notes</div>' +
                '<div class="detail-prose">' + escHtml(String(reviewNotesRaw)) + '</div>' +
              '</div>'
            : '');

    var profileBody =
        (b.yearsOfExperience != null
            ? '<div class="mb-3"><div class="detail-field-label">Experience</div><div class="detail-field-value">' + escHtml(b.yearsOfExperience) + ' yrs</div></div>'
            : '') +
        (b.bio
            ? '<div class="mb-3"><div class="detail-field-label">Bio</div><div class="detail-prose">' + escHtml(b.bio) + '</div></div>'
            : '<div class="mb-3 text-secondary small">No bio provided</div>') +
        '<div class="mb-3"><div class="detail-field-label">Specialties</div><div>' + specialties + '</div></div>' +
        '<div><div class="detail-field-label">Certifications</div>' + renderCertifications(b.certifications) + '</div>';

    var moneyBody =
        '<div class="row g-3 mb-3">' +
        detailField('Wallet balance', '<span class="fw-semibold text-success">' + escHtml(walletBalance) + '</span>') +
        detailField('Total earnings', '<span class="fw-semibold">' + escHtml(totalEarnings) + '</span>') +
        detailField('Beautician share', commissionDisplay) +
        detailField('Payout mode', payoutMode) +
        '</div>' +
        '<div class="pt-3 border-top">' +
        '<div class="detail-field-label mb-2">Payout bank details</div>' +
        renderBeauticianBankDetails(b) +
        '</div>';

    var dr = State.detailReviews || {};
    var reviewsToolbar =
        '<div class="detail-reviews-toolbar">' +
        '<div>' +
        '<label class="form-label" for="detail-reviews-sort">Sort</label>' +
        '<select class="form-select form-select-sm" id="detail-reviews-sort" style="min-width:10rem">' +
        '<option value="createdAt:desc"' + (dr.sortBy === 'createdAt' && dr.sortOrder !== 'asc' ? ' selected' : '') + '>Newest first</option>' +
        '<option value="createdAt:asc"' + (dr.sortBy === 'createdAt' && dr.sortOrder === 'asc' ? ' selected' : '') + '>Oldest first</option>' +
        '<option value="rating:desc"' + (dr.sortBy === 'rating' && dr.sortOrder !== 'asc' ? ' selected' : '') + '>Highest rating</option>' +
        '<option value="rating:asc"' + (dr.sortBy === 'rating' && dr.sortOrder === 'asc' ? ' selected' : '') + '>Lowest rating</option>' +
        '</select></div>' +
        '<div class="ms-auto">' +
        '<button type="button" class="btn btn-sm btn-outline-secondary" id="detail-reviews-refresh">Refresh</button>' +
        '</div></div>' +
        '<div class="alert alert-danger d-none py-2" id="detail-reviews-error" role="alert"></div>' +
        '<div class="detail-reviews-list" id="detail-reviews-list">' +
        '<div class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary" role="status"></div></div>' +
        '</div>' +
        '<div id="detail-reviews-footer-wrap"></div>';

    var kycRefsHtml = b.kycReferences
        ? '<div class="mt-3 pt-3 border-top">' +
            '<div class="detail-field-label mb-2">QoreID references</div>' +
            '<dl class="row g-2 small mb-0">' +
            '<dt class="col-sm-5 text-secondary fw-normal">QoreID Customer</dt>' +
            '<dd class="col-sm-7 mb-0 font-monospace">' + escHtml(b.kycReferences.qoreIdCustomerId || '—') + '</dd>' +
            '<dt class="col-sm-5 text-secondary fw-normal">QoreID Session</dt>' +
            '<dd class="col-sm-7 mb-0 font-monospace">' + escHtml(b.kycReferences.qoreIdSessionId || '—') + '</dd>' +
            '</dl></div>'
        : '';
    var kycBody =
        '<div class="row g-3">' +
        detailField('Status', Beauticians.kycBadge(b.kycStatus)) +
        detailField('Portfolio URL', renderPortfolioUrl(b.portfolioUrl), 'col-12') +
        '</div>' +
        kycRefsHtml;

    var kycVideoBody = renderKycVideo(b.kycVideo);

    return '<div class="detail-stack" data-beautician-id="' + escHtml(b.id) + '">' +
        heroCard +
        '<div class="detail-grid detail-grid-2">' +
        detailCard('Account status', statusBody) +
        detailCard('Performance & review', performanceBody) +
        '</div>' +
        '<div class="detail-grid detail-grid-2">' +
        detailCard('Profile', profileBody) +
        detailCard('Intro video', kycVideoBody) +
        '</div>' +
        '<div class="detail-grid detail-grid-2">' +
        detailCard('Earnings & payouts', moneyBody) +
        detailCard('KYC', kycBody) +
        '</div>' +
        detailCard('Customer reviews', reviewsToolbar) +
        '<div class="detail-grid detail-grid-2">' +
        detailCard('Assigned services', '<div class="detail-services-scroll">' + assignedSvc + '</div>', { count: assignedCount }) +
        detailCard('Recent jobs', recentJobsHtml, { count: recentCount }) +
        '</div>' +
        '</div>';
}
function buildDetailActions(b) {
    var html = '<button class="btn btn-link link-secondary me-auto" data-bs-dismiss="offcanvas">Close</button>';
    var id = (b.id || '').replace(/'/g, "\\'");
    var kyc = (b.kycStatus || '').toUpperCase();
    var profile = (b.profileStatus || '').toUpperCase();

    if (RBAC.can('beauticians:review') && (kyc === 'NEEDS_REVIEW' || kyc === 'PENDING')) {
        html += '<button class="btn btn-success btn-sm" onclick="handleKycApprove(\'' + id + '\')">Approve KYC</button>';
        html += '<button class="btn btn-danger btn-sm" onclick="handleKycReject(\'' + id + '\')">Reject KYC</button>';
    }
    if (RBAC.can('beauticians:review') && profile === 'PENDING_REVIEW' && kyc === 'VERIFIED') {
        html += '<button class="btn btn-success btn-sm" onclick="handleProfileApprove(\'' + id + '\')">Approve Profile &amp; Video</button>';
        html += '<button class="btn btn-danger btn-sm" onclick="handleProfileReject(\'' + id + '\')">Reject</button>';
    }
    // Account / dispatch suspend only for fully approved profiles (not mid-onboarding)
    if (RBAC.can('beauticians:manage') && profile === 'APPROVED') {
        html += '<button class="btn btn-outline-secondary btn-sm" onclick="openSuspendModal(\'' + id + '\',\'' + (b.isActive ? 'true' : 'false') + '\')">' + (b.isActive ? 'Suspend Account' : 'Reactivate Account') + '</button>';
        var dispatchSuspended = b.dispatchSuspended ? 'true' : 'false';
        html += '<button class="btn btn-outline-warning btn-sm" onclick="toggleDispatchSuspended(\'' + id + '\',\'' + dispatchSuspended + '\')">' +
            (b.dispatchSuspended ? 'Resume Dispatch Matching' : 'Suspend Dispatch Matching') + '</button>';
    }
    return html;
}
function renderReviewsTable(rows, meta) {
    var tbody = document.getElementById('reviews-tbody');
    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-secondary py-5">No pending profile reviews.</td></tr>';
        return;
    }
    tbody.innerHTML = rows.map(function (b, i) {
        var name = Beauticians.fullName(b);
        var dob = Beauticians.formatDateOfBirth(b);
        var specs = Array.isArray(b.specialties) ? b.specialties.join(', ') : '—';
        var exp = b.yearsOfExperience ? b.yearsOfExperience + ' yrs' : '—';
        var submitted = Beauticians.formatDateTime(b.profileSubmittedAt || b.updatedAt || b.createdAt);
        return '<tr>' +
            '<td class="text-secondary small">' + ((State.reviews.page - 1) * State.reviews.limit + i + 1) + '</td>' +
            '<td><div class="fw-semibold">' + name + '</div></td>' +
            '<td class="text-secondary small">' + dob + '</td>' +
            '<td class="text-secondary small">' + specs + '</td>' +
            '<td>' + exp + '</td>' +
            '<td>' + Beauticians.kycBadge(b.kycStatus) + '</td>' +
            '<td class="small">' + renderPortfolioUrl(b.portfolioUrl) + '</td>' +
            '<td class="text-secondary small">' + submitted + '</td>' +
            '<td><button class="btn btn-sm btn-ghost-primary open-detail-btn" data-id="' + b.id + '" title="View beautician information">View information</button></td>' +
            '</tr>';
    }).join('');
}
function getSvcBeauticianId() {
    return document.getElementById('svc-beautician-select').value;
}
function setSvcBeauticianLabel(text, isPlaceholder) {
    var label = document.getElementById('svc-beautician-label');
    label.textContent = text;
    label.classList.toggle('text-secondary', !!isPlaceholder);
    label.classList.toggle('text-body', !isPlaceholder);
}
function setSvcBeauticianSelection(id) {
    document.getElementById('svc-beautician-select').value = id || '';
    if (!id) {
        setSvcBeauticianLabel('— Select a beautician —', true);
        return;
    }
    var row = State.svcBeauticianRows.find(function (b) { return b.id === id; });
    setSvcBeauticianLabel(row ? Beauticians.fullName(row) : '— Select a beautician —', !row);
}
function renderSvcBeauticianPicker(query) {
    var list = document.getElementById('svc-beautician-list');
    var selected = getSvcBeauticianId();
    var q = String(query || '').trim().toLowerCase();

    if (State.svcBeauticianOptionsLoading) {
        list.innerHTML = '<div class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary" role="status"></div></div>';
        return;
    }
    if (!State.beauticianOptionsLoaded) {
        list.innerHTML = '<div class="text-center text-secondary py-3 small">Loading beauticians…</div>';
        return;
    }
    if (!State.svcBeauticianRows.length) {
        list.innerHTML = '<div class="text-center text-secondary py-3 small">No approved beauticians</div>';
        return;
    }

    var filtered = q
        ? State.svcBeauticianRows.filter(function (b) { return svcBeauticianSearchHaystack(b).indexOf(q) !== -1; })
        : State.svcBeauticianRows.slice();

    if (!filtered.length) {
        list.innerHTML = '<div class="text-center text-secondary py-3 small">No beauticians match your search</div>';
        return;
    }

    list.innerHTML = filtered.map(function (b) {
        var user = b.user || {};
        var dob = Beauticians.formatDateOfBirth(b);
        var metaParts = [user.email, user.phone];
        if (dob !== '—') metaParts.push('Born ' + dob);
        var meta = metaParts.filter(Boolean).join(' · ');
        var active = b.id === selected ? ' active' : '';
        return '<button type="button" class="dropdown-item svc-beautician-option' + active + '" data-id="' + escHtml(b.id) + '">' +
            '<div class="fw-medium">' + escHtml(Beauticians.fullName(b)) + '</div>' +
            (meta ? '<div class="option-meta">' + escHtml(meta) + '</div>' : '') +
            '</button>';
    }).join('');
}
function updateSvcSelectedCount() {
    var checkboxes = document.querySelectorAll('.svc-checkbox');
    var count = document.querySelectorAll('.svc-checkbox:checked').length;
    document.getElementById('svc-count-label').textContent = count + ' selected';
    var selectAll = document.getElementById('svc-select-all');
    if (selectAll) {
        var total = checkboxes.length;
        selectAll.checked = total > 0 && count === total;
        selectAll.indeterminate = count > 0 && count < total;
    }
}
function showScrDefaultAlert(type, message) {
    var ok = document.getElementById('scr-default-success');
    var err = document.getElementById('scr-default-error');
    ok.classList.add('d-none');
    err.classList.add('d-none');
    if (!message) return;
    var el = type === 'success' ? ok : err;
    el.textContent = message;
    el.classList.remove('d-none');
    if (type === 'success') {
        setTimeout(function () { ok.classList.add('d-none'); }, 3000);
    }
}
function showScrAlert(type, message) {
    var ok = document.getElementById('scr-success');
    var err = document.getElementById('scr-error');
    ok.classList.add('d-none');
    err.classList.add('d-none');
    if (!message) return;
    var el = type === 'success' ? ok : err;
    el.textContent = message;
    el.classList.remove('d-none');
    if (type === 'success') {
        setTimeout(function () { ok.classList.add('d-none'); }, 3000);
    }
}
function showBcrAlert(type, message) {
    var ok = document.getElementById('bcr-success');
    var err = document.getElementById('bcr-error');
    if (!ok || !err) return;
    ok.classList.add('d-none');
    err.classList.add('d-none');
    if (!message) return;
    var el = type === 'success' ? ok : err;
    el.textContent = message;
    el.classList.remove('d-none');
    if (type === 'success') {
        setTimeout(function () { ok.classList.add('d-none'); }, 3000);
    }
}
function renderBeauticianRateRows(rows, byUserId) {
    var tbody = document.getElementById('bcr-tbody');
    var canManage = RBAC.can('settings:manage');
    if (!rows || !rows.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-secondary py-5">No beauticians found.</td></tr>';
        return;
    }
    tbody.innerHTML = rows.map(function (b, i) {
        var userId = Beauticians.beauticianUserId(b);
        var name = Beauticians.fullName(b);
        var email = (b.user && b.user.email) || '';
        var phone = (b.user && b.user.phone) || '';
        var meta = [email, phone].filter(Boolean).join(' · ');
        var override = userId ? (byUserId || {})[userId] : null;
        var rateLabel;
        if (override && override.commissionRate != null) {
            var pct = formatCommissionLabel(override.commissionRate);
            rateLabel = '<span class="badge bg-azure-lt" title="Personal override">' + escHtml(pct != null ? pct + '%' : '—') + '</span>';
        } else {
            rateLabel = '<span class="text-secondary">Platform default</span>';
        }
        var updated = override && override.updatedAt
            ? escHtml(Beauticians.formatDateTime(override.updatedAt))
            : '<span class="text-secondary">—</span>';

        var actions;
        if (!userId) {
            actions = '<span class="text-secondary small">No user id</span>';
        } else if (canManage) {
            actions = '<div class="btn-list flex-nowrap justify-content-end">' +
                '<button type="button" class="btn btn-sm btn-ghost-primary btn-bcr-set"' +
                ' data-user-id="' + escHtml(userId) + '"' +
                ' data-name="' + escHtml(name) + '"' +
                ' data-rate="' + escHtml(override && override.commissionRate != null ? String(override.commissionRate) : '') + '"' +
                '>' + (override ? 'Edit Rate' : 'Set Rate') + '</button>' +
                (override
                    ? '<button type="button" class="btn btn-sm btn-ghost-danger btn-bcr-remove"' +
                        ' data-user-id="' + escHtml(userId) + '"' +
                        ' data-name="' + escHtml(name) + '">Remove</button>'
                    : '') +
              '</div>';
        } else {
            actions = '';
        }
        return '<tr>' +
            '<td class="text-secondary small">' + ((State.bcr.page - 1) * State.bcr.limit + i + 1) + '</td>' +
            '<td><div class="fw-semibold">' + escHtml(name) + '</div>' +
            (meta ? '<div class="text-secondary small">' + escHtml(meta) + '</div>' : '') +
            (userId ? '<div class="font-monospace text-secondary small">' + escHtml(userId) + '</div>' : '') +
            '</td>' +
            '<td>' + Beauticians.kycBadge(b.kycStatus) + '</td>' +
            '<td class="text-nowrap">' + rateLabel + '</td>' +
            '<td class="text-secondary text-nowrap small">' + updated + '</td>' +
            '<td class="text-end">' + actions + '</td>' +
            '</tr>';
    }).join('');
}
function renderServiceCommissionRows(rows) {
    var tbody = document.getElementById('scr-tbody');
    var canManage = RBAC.can('settings:manage');
    if (!rows || !rows.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-secondary py-4">' +
            'No overrides yet. All services use the platform default beautician share.</td></tr>';
        return;
    }
    tbody.innerHTML = rows.map(function (row) {
        var pct = formatCommissionLabel(row.commissionRate);
        var pctLabel = pct != null ? pct + '%' : '—';
        var updated = row.updatedAt ? Beauticians.formatDateTime(row.updatedAt) : '—';
        var price = getServiceCatalogPrice(row.serviceId);
        var actions = canManage
            ? '<div class="btn-list flex-nowrap justify-content-end">' +
                '<button type="button" class="btn btn-sm btn-ghost-primary btn-scr-edit"' +
                ' data-service-id="' + escHtml(row.serviceId) + '"' +
                ' data-service-name="' + escHtml(row.serviceName || '') + '"' +
                ' data-rate="' + escHtml(String(row.commissionRate)) + '"' +
                (price != null ? ' data-service-price="' + escHtml(String(price)) + '"' : '') +
                '>Edit</button>' +
                '<button type="button" class="btn btn-sm btn-ghost-danger btn-scr-remove" data-service-id="' + escHtml(row.serviceId) + '" data-service-name="' + escHtml(row.serviceName || '') + '">Remove</button>' +
              '</div>'
            : '';
        return '<tr data-service-id="' + escHtml(row.serviceId) + '">' +
            '<td><div class="fw-semibold">' + escHtml(row.serviceName || '—') + '</div></td>' +
            '<td class="text-nowrap"><span class="badge bg-azure-lt">' + escHtml(pctLabel) + '</span></td>' +
            '<td>' + formatEarningsCell(price, row.commissionRate) + '</td>' +
            '<td class="text-secondary text-nowrap small">' + escHtml(updated) + '</td>' +
            '<td class="text-end">' + actions + '</td></tr>';
    }).join('');
}
function getScrServiceId() {
    return document.getElementById('scr-service-select').value;
}
function setScrServiceLabel(text, isPlaceholder) {
    var label = document.getElementById('scr-service-label');
    label.textContent = text;
    label.classList.toggle('text-secondary', !!isPlaceholder);
    label.classList.toggle('text-body', !isPlaceholder);
}
function setScrServiceSelection(id) {
    document.getElementById('scr-service-select').value = id || '';
    if (!id) {
        setScrServiceLabel('— Select a service —', true);
        updateScrEarningsPreview();
        return;
    }
    var row = (State.scr.catalogServices || []).find(function (s) { return s.id === id; });
    setScrServiceLabel(row ? (row.name || id) : '— Select a service —', !row);
    updateScrEarningsPreview();
}
function getScrModalServicePrice() {
    var editId = document.getElementById('scr-edit-service-id').value.trim();
    var serviceId = editId || getScrServiceId();
    if (!serviceId) return null;
    // Prefer catalog lookup
    var catalogPrice = getServiceCatalogPrice(serviceId);
    if (catalogPrice != null) return catalogPrice;
    // Fallback from edit button data stored on modal open
    if (State.scr.editServicePrice != null) return State.scr.editServicePrice;
    return null;
}
function updateScrEarningsPreview() {
    var box = document.getElementById('scr-earnings-preview');
    var amountEl = document.getElementById('scr-preview-amount');
    var earnEl = document.getElementById('scr-preview-earn');
    var pctEl = document.getElementById('scr-preview-pct');
    if (!box) return;

    var price = getScrModalServicePrice();
    var pctRaw = document.getElementById('scr-rate-input').value;
    var rate = commissionPercentToRate(pctRaw);
    var hasPct = pctRaw !== '' && rate != null;

    if (price == null && !hasPct) {
        box.classList.add('d-none');
        return;
    }

    box.classList.remove('d-none');
    amountEl.textContent = price != null ? Services.formatMoney(price) : '— (select a service)';
    if (price != null && hasPct && rate >= 0 && rate <= 1) {
        var earn = Math.round(price * rate * 100) / 100;
        earnEl.textContent = Services.formatMoney(earn);
        var pctLabel = formatCommissionLabel(rate);
        pctEl.textContent = pctLabel != null ? ' (' + pctLabel + '%)' : '';
    } else if (hasPct && price == null) {
        earnEl.textContent = '—';
        pctEl.textContent = ' (select a service)';
    } else {
        earnEl.textContent = '—';
        pctEl.textContent = '';
    }
}
function getScrAvailableServices() {
    var overridden = {};
    (State.scr.overrides || []).forEach(function (r) { overridden[r.serviceId] = true; });
    return (State.scr.catalogServices || []).filter(function (s) {
        return s && s.id && !overridden[s.id];
    });
}
function renderScrServicePicker(query) {
    var list = document.getElementById('scr-service-list');
    var selected = getScrServiceId();
    var q = String(query || '').trim().toLowerCase();

    if (State.scr.catalogLoading) {
        list.innerHTML = '<div class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary" role="status"></div></div>';
        return;
    }
    if (!State.scr.catalogLoaded) {
        list.innerHTML = '<div class="text-center text-secondary py-3 small">Loading services…</div>';
        return;
    }

    var available = getScrAvailableServices();
    if (!available.length) {
        list.innerHTML = '<div class="text-center text-secondary py-3 small">All services already have overrides</div>';
        return;
    }

    var filtered = q
        ? available.filter(function (s) { return scrServiceSearchHaystack(s).indexOf(q) !== -1; })
        : available.slice();

    if (!filtered.length) {
        list.innerHTML = '<div class="text-center text-secondary py-3 small">No services match your search</div>';
        return;
    }

    list.innerHTML = filtered.map(function (s) {
        var metaParts = [];
        if (s.homeServicePrice != null) metaParts.push(Services.formatMoney(s.homeServicePrice));
        if (s.category && s.category.name) metaParts.push(s.category.name);
        var meta = metaParts.join(' · ');
        var active = s.id === selected ? ' active' : '';
        return '<button type="button" class="dropdown-item scr-service-option' + active + '" data-id="' + escHtml(s.id) + '">' +
            '<div class="fw-medium">' + escHtml(s.name || s.id) + '</div>' +
            (meta ? '<div class="option-meta">' + escHtml(meta) + '</div>' : '') +
            '</button>';
    }).join('');
}
function openScrModalForAdd() {
    document.getElementById('scr-modal-title').textContent = 'Add Service Override';
    document.getElementById('scr-edit-service-id').value = '';
    document.getElementById('scr-rate-input').value = '';
    document.getElementById('scr-modal-error').classList.add('d-none');
    document.getElementById('scr-service-select-wrap').classList.remove('d-none');
    document.getElementById('scr-service-name-wrap').classList.add('d-none');
    State.scr.editServicePrice = null;
    setScrServiceSelection('');
    document.getElementById('scr-service-search').value = '';
    // Force refresh of available list against current overrides
    if (State.scr.catalogLoaded) renderScrServicePicker('');
    updateScrEarningsPreview();
}
function openScrModalForEdit(serviceId, serviceName, rate, servicePrice) {
    document.getElementById('scr-modal-title').textContent = 'Edit Service Override';
    document.getElementById('scr-edit-service-id').value = serviceId || '';
    document.getElementById('scr-rate-input').value = sanitizePercentInputValue(String(commissionRateToPercent(rate)));
    document.getElementById('scr-modal-error').classList.add('d-none');
    document.getElementById('scr-service-select-wrap').classList.add('d-none');
    document.getElementById('scr-service-name-wrap').classList.remove('d-none');
    document.getElementById('scr-service-name-display').textContent = serviceName || serviceId || '—';
    document.getElementById('scr-service-select').value = '';
    var price = servicePrice != null && servicePrice !== ''
        ? Number(servicePrice)
        : getServiceCatalogPrice(serviceId);
    State.scr.editServicePrice = Number.isFinite(price) ? price : null;
    updateScrEarningsPreview();
}
function renderDailyPoolStats(pool) {
    var unlimited = !!(pool.unlimited || pool.limit === null || pool.limit === undefined);
    var used = Number(pool.used) || 0;
    var limit = unlimited ? null : Number(pool.limit);
    var remaining = unlimited ? null : (pool.remaining === null || pool.remaining === undefined
        ? Math.max(0, (limit || 0) - used)
        : Number(pool.remaining));

    document.getElementById('daily-pool-used').textContent = Beauticians.formatMoney(used);

    if (unlimited) {
        document.getElementById('daily-pool-remaining').textContent = 'Unlimited';
        document.getElementById('daily-pool-remaining').className = 'stat-value text-success';
        document.getElementById('daily-pool-limit').textContent = 'No cap';
        document.getElementById('daily-pool-status-badge').innerHTML =
            '<span class="badge bg-success-lt">Unlimited</span>';
        document.getElementById('daily-pool-progress-wrap').classList.remove('near-cap', 'at-cap');
        document.getElementById('daily-pool-progress-bar').style.width = '0%';
        document.getElementById('daily-pool-progress-wrap').setAttribute('aria-valuenow', '0');
    } else {
        document.getElementById('daily-pool-remaining').textContent = Beauticians.formatMoney(remaining);
        document.getElementById('daily-pool-remaining').className =
            remaining <= 0 ? 'stat-value text-danger' : 'stat-value text-success';
        document.getElementById('daily-pool-limit').textContent = Beauticians.formatMoney(limit);

        var pct = limit > 0
            ? Math.min(100, Math.round((used / limit) * 100))
            : (remaining <= 0 ? 100 : 0);
        var wrap = document.getElementById('daily-pool-progress-wrap');
        wrap.classList.remove('near-cap', 'at-cap');
        if (remaining <= 0 || pct >= 100) {
            wrap.classList.add('at-cap');
            document.getElementById('daily-pool-status-badge').innerHTML =
                '<span class="badge bg-danger-lt">Cap reached</span>';
            pct = 100;
        } else if (pct >= 80) {
            wrap.classList.add('near-cap');
            document.getElementById('daily-pool-status-badge').innerHTML =
                '<span class="badge bg-warning-lt">' + pct + '% used</span>';
        } else {
            document.getElementById('daily-pool-status-badge').innerHTML =
                '<span class="badge bg-primary-lt">' + pct + '% used</span>';
        }
        document.getElementById('daily-pool-progress-bar').style.width = pct + '%';
        wrap.setAttribute('aria-valuenow', String(pct));
    }

    var dayMeta = 'Timezone: ' + (pool.timezone || 'Africa/Lagos');
    if (pool.dayStartsAt) {
        dayMeta += ' · Day started ' + Beauticians.formatDateTime(pool.dayStartsAt);
    }
    document.getElementById('daily-pool-day-meta').textContent = dayMeta;

    var canManage = RBAC.can('settings:manage');
    var manageEl = document.getElementById('daily-pool-manage');
    manageEl.classList.toggle('d-none', !canManage);
    if (canManage) {
        var inputEl = document.getElementById('pool-limit-input');
        var unlimitedEl = document.getElementById('pool-limit-unlimited');
        unlimitedEl.disabled = false;
        applyDailyLimitInputs(inputEl, unlimitedEl, unlimited ? null : limit, true);
    }
}

    BP.UI = {
        initSettingsFieldHints: initSettingsFieldHints,
        applyTabVisibility: applyTabVisibility,
        applyPerformanceVisibility: applyPerformanceVisibility,
        firstAccessibleSection: firstAccessibleSection,
        renderPagination: renderPagination,
        renderListTable: renderListTable,
        openPhotoPreview: openPhotoPreview,
        setCertPreviewLoading: setCertPreviewLoading,
        openCertificationPreview: openCertificationPreview,
        openKycVideoModal: openKycVideoModal,
        downloadKycVideo: downloadKycVideo,
        stopKycVideoPlayer: stopKycVideoPlayer,
        initKycVideoModal: initKycVideoModal,
        renderProfileReviewer: renderProfileReviewer,
        renderCertifications: renderCertifications,
        renderKycVideo: renderKycVideo,
        renderBeauticianBankDetails: renderBeauticianBankDetails,
        renderBeauticianDetailContent: renderBeauticianDetailContent,
        updateDetailReviewsPanel: updateDetailReviewsPanel,
        renderDetailReviewsListHtml: renderDetailReviewsListHtml,
        buildDetailActions: buildDetailActions,
        renderReviewsTable: renderReviewsTable,
        getSvcBeauticianId: getSvcBeauticianId,
        setSvcBeauticianLabel: setSvcBeauticianLabel,
        setSvcBeauticianSelection: setSvcBeauticianSelection,
        renderSvcBeauticianPicker: renderSvcBeauticianPicker,
        updateSvcSelectedCount: updateSvcSelectedCount,
        showScrDefaultAlert: showScrDefaultAlert,
        showScrAlert: showScrAlert,
        showBcrAlert: showBcrAlert,
        renderBeauticianRateRows: renderBeauticianRateRows,
        renderServiceCommissionRows: renderServiceCommissionRows,
        getScrServiceId: getScrServiceId,
        setScrServiceLabel: setScrServiceLabel,
        setScrServiceSelection: setScrServiceSelection,
        getScrModalServicePrice: getScrModalServicePrice,
        updateScrEarningsPreview: updateScrEarningsPreview,
        getScrAvailableServices: getScrAvailableServices,
        renderScrServicePicker: renderScrServicePicker,
        openScrModalForAdd: openScrModalForAdd,
        openScrModalForEdit: openScrModalForEdit,
        renderDailyPoolStats: renderDailyPoolStats
    };
})(window);
