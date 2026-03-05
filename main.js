var pendingActionType = null;
var pendingTarget = null;
var pendingTargetId = null;

var isSubmitting = false;

if (!window.hasMainJsRun) {
    window.hasMainJsRun = true;
    window.currentEditorMode = 'html';
    window.isWriting = false;
    const BGM_ENABLED_KEY = 'aa_bgm_enabled';
    const BGM_VOLUME_KEY = 'aa_bgm_volume';
    const BGM_OPACITY_KEY = 'aa_bgm_opacity';
    const BGM_TRACK_INDEX_LEGACY_KEY = 'aa_bgm_track_index';
    const BGM_TRACK_INDEX_PREFIX_KEY = 'aa_bgm_track_index_';
    const BGM_LIBRARY_KEY = 'aa_bgm_library';
    const BGM_COLLAPSED_KEY = 'aa_bgm_collapsed';
    const BGM_MINIMIZED_MOBILE_KEY = 'aa_bgm_minimized_mobile';
    const BGM_REPEAT_MODE_KEY = 'aa_bgm_repeat_mode';
    const BGM_REPEAT_MODES = ['off', 'one', 'all'];
    const BGM_COVER_EXTENSIONS = ['jpg', 'png', 'webp'];
    const MEDIA_BASE = (typeof window.__AA_MEDIA_BASE__ === 'string' && window.__AA_MEDIA_BASE__.trim())
        ? window.__AA_MEDIA_BASE__.trim()
        : 'https://bgm.wmner.cloud/';
    const normalizeUrlBase = (value) => {
        const trimmed = typeof value === 'string' ? value.trim() : '';
        if (!trimmed) return '';
        return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
    };
    const R2_MANIFEST_PATH = (typeof window.__AA_MEDIA_MANIFEST_PATH__ === 'string' && window.__AA_MEDIA_MANIFEST_PATH__.trim())
        ? window.__AA_MEDIA_MANIFEST_PATH__.trim()
        : `${normalizeUrlBase(MEDIA_BASE)}manifest.json`;
    const AUDIO_LIBRARY_KEYS = ['bgm', 'ost'];
    const AUDIO_LIBRARY_CONFIG = { 
        bgm: {
            key: 'bgm',
            folder: 'bgm',
            manifestPath: 'assets/bgm/manifest.json',
            manifestGlobalKey: '__BGM_MANIFEST__',
            requiredFallbackFiles: []
        },
        ost: {
            key: 'ost',
            folder: 'OST',
            manifestPath: 'assets/OST/manifest.json',
            manifestGlobalKey: '__OST_MANIFEST__',
            requiredFallbackFiles: []
        }
    };
    const getTrackIndexKey = (libraryKey) => `${BGM_TRACK_INDEX_PREFIX_KEY}${libraryKey}`;
    const resolveMediaUrl = (pathOrKey) => {
        const trimmed = typeof pathOrKey === 'string' ? pathOrKey.trim() : '';
        if (!trimmed) return '';
        if (/^(?:https?:)?\/\//i.test(trimmed) || /^data:/i.test(trimmed) || /^blob:/i.test(trimmed)) {
            return trimmed;
        }
        const normalizedBase = normalizeUrlBase(MEDIA_BASE);
        if (!normalizedBase) return trimmed;
        return `${normalizedBase}${trimmed.replace(/^\/+/, '')}`;
    };
    const parseTrackTitle = (filename, libraryKey) => {
        const withoutExtension = filename.replace(/\.mp3$/i, '');
        const withoutTrackCode = withoutExtension.replace(/^(?:bgm|ost)[_\s-]*\d+\s*/i, '');
        return withoutTrackCode.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    };
    const buildLibraryTracksFromFiles = (libraryKey, files) => {
        const cfg = AUDIO_LIBRARY_CONFIG[libraryKey];
        if (!cfg) return [];
        return files.map((filename) => ({
            filename,
            title: parseTrackTitle(filename, libraryKey),
            src: `assets/${cfg.folder}/${filename}`,
            cover: null
        }));
    };
    const ensureRequiredLibraryTracks = (libraryKey, tracks) => {
        const cfg = AUDIO_LIBRARY_CONFIG[libraryKey];
        const normalizedTracks = Array.isArray(tracks) ? tracks.filter(Boolean) : [];
        const mergedTracks = [...normalizedTracks];
        const existingFiles = new Set(mergedTracks.map((track) => track.filename));
        const requiredFiles = cfg && Array.isArray(cfg.requiredFallbackFiles) ? cfg.requiredFallbackFiles : [];

        requiredFiles.forEach((filename) => {
            if (existingFiles.has(filename)) return;
            mergedTracks.push({
                filename,
                title: parseTrackTitle(filename, libraryKey),
                src: `assets/${cfg.folder}/${filename}`,
                cover: null
            });
        });

        return mergedTracks;
    };
    const buildLibraryFallbackTracks = (libraryKey) => ensureRequiredLibraryTracks(libraryKey, buildLibraryTracksFromFiles(libraryKey, []));
    const sanitizeManifestTrack = (libraryKey, item) => {
        if (!item || typeof item !== 'object') return null;

        const filename = typeof item.filename === 'string' ? item.filename.trim() : '';
        const src = typeof item.src === 'string' ? item.src.trim() : '';
        if (!filename || !src) return null;

        const titleFromManifest = typeof item.title === 'string' ? item.title.trim() : '';
        const normalizedTrack = {
            filename,
            title: titleFromManifest || parseTrackTitle(filename, libraryKey),
            src,
            cover: null
        };

        if (typeof item.cover === 'string') {
            const trimmedCover = item.cover.trim();
            if (trimmedCover) {
                normalizedTrack.cover = trimmedCover;
            }
        }

        return normalizedTrack;
    };
    const getManifestTracksFromWindow = (libraryKey) => {
        const cfg = AUDIO_LIBRARY_CONFIG[libraryKey];
        if (!cfg) return null;
        const globalManifest = window[cfg.manifestGlobalKey];
        if (!Array.isArray(globalManifest)) return null;
        const manifestTracks = ensureRequiredLibraryTracks(
            libraryKey,
            globalManifest.map((item) => sanitizeManifestTrack(libraryKey, item)).filter(Boolean)
        );
        return manifestTracks.length ? manifestTracks : null;
    };
    const AUDIO_TRACKS_BY_LIBRARY = {
        bgm: buildLibraryFallbackTracks('bgm'),
        ost: buildLibraryFallbackTracks('ost')
    };
    let bgmLibrary = 'bgm';
    let BGM_TRACKS = AUDIO_TRACKS_BY_LIBRARY.bgm;

    const loadLibraryTracksFromManifest = async (libraryKey) => {
        const cfg = AUDIO_LIBRARY_CONFIG[libraryKey];
        if (!cfg) return false;

        const manifestFromWindow = getManifestTracksFromWindow(libraryKey);
        if (manifestFromWindow) {
            AUDIO_TRACKS_BY_LIBRARY[libraryKey] = manifestFromWindow;
            return true;
        }

        try {
            const response = await fetch(cfg.manifestPath, { cache: 'no-store' });
            if (!response.ok) throw new Error(`manifest http ${response.status}`);

            const manifest = await response.json();
            if (!Array.isArray(manifest)) throw new Error('manifest is not an array');

            const manifestTracks = ensureRequiredLibraryTracks(
                libraryKey,
                manifest.map((item) => sanitizeManifestTrack(libraryKey, item)).filter(Boolean)
            );

            AUDIO_TRACKS_BY_LIBRARY[libraryKey] = manifestTracks.length
                ? manifestTracks
                : buildLibraryFallbackTracks(libraryKey);
            return manifestTracks.length > 0;
        } catch (_error) {
            AUDIO_TRACKS_BY_LIBRARY[libraryKey] = buildLibraryFallbackTracks(libraryKey);
            return false;
        }
    };

    const sanitizeR2ManifestTrack = (libraryKey, item) => {
        if (!item || typeof item !== 'object') return null;

        const kind = typeof item.kind === 'string' ? item.kind.trim().toLowerCase() : '';
        if (kind !== libraryKey) return null;

        const trackKey = typeof item.trackKey === 'string' ? item.trackKey.trim() : '';
        if (!trackKey) return null;

        const trackId = typeof item.id === 'string' ? item.id.trim() : '';
        const fileFromTrackKey = trackKey.split('?')[0].split('/').pop() || '';
        const filename = fileFromTrackKey || (trackId ? `${trackId}.mp3` : '');
        if (!filename) return null;

        const titleFromManifest = typeof item.title === 'string' ? item.title.trim() : '';
        const src = resolveMediaUrl(trackKey);
        if (!src) return null;

        const normalizedTrack = {
            filename,
            title: titleFromManifest || parseTrackTitle(filename, libraryKey),
            src,
            cover: null
        };

        if (typeof item.coverKey === 'string') {
            const trimmedCoverKey = item.coverKey.trim();
            if (trimmedCoverKey) {
                normalizedTrack.cover = resolveMediaUrl(trimmedCoverKey);
            }
        }

        return normalizedTrack;
    };

    const loadTracksFromR2Manifest = async () => {
        try {
            const response = await fetch(R2_MANIFEST_PATH, { cache: 'no-store' });
            if (!response.ok) throw new Error(`r2 manifest http ${response.status}`);

            const manifest = await response.json();
            if (!Array.isArray(manifest)) throw new Error('r2 manifest is not an array');

            const nextTracksByLibrary = {};
            for (const libraryKey of AUDIO_LIBRARY_KEYS) {
                const mappedTracks = ensureRequiredLibraryTracks(
                    libraryKey,
                    manifest.map((item) => sanitizeR2ManifestTrack(libraryKey, item)).filter(Boolean)
                );
                if (!mappedTracks.length) throw new Error(`r2 manifest has no tracks for ${libraryKey}`);
                nextTracksByLibrary[libraryKey] = mappedTracks;
            }

            AUDIO_LIBRARY_KEYS.forEach((libraryKey) => {
                AUDIO_TRACKS_BY_LIBRARY[libraryKey] = nextTracksByLibrary[libraryKey];
            });
            return true;
        } catch (_error) {
            return false;
        }
    };

    const loadAllAudioTracksFromManifest = async () => {
        const loadedFromR2Manifest = await loadTracksFromR2Manifest();
        if (loadedFromR2Manifest) return;
        await Promise.all(AUDIO_LIBRARY_KEYS.map((libraryKey) => loadLibraryTracksFromManifest(libraryKey)));
    };

    let bgmAudioEl = null;
    let bgmWidgetEl = null;
    let bgmToggleBtn = null;
    let bgmPlayPauseBtn = null;
    let bgmPrevBtn = null;
    let bgmNextBtn = null;
    let bgmCollapseBtn = null;
    let bgmTrackListEl = null;
    let bgmCurrentTrackEl = null;
    let bgmVolumeSlider = null;
    let bgmOpacitySlider = null;
    let bgmSeekSlider = null;
    let bgmTimeDisplayEl = null;
    let bgmRepeatBtn = null;
    let bgmLibraryBgmBtn = null;
    let bgmLibraryOstBtn = null;
    let bgmStatusEl = null;
    let bgmCoverArtEl = null;
    let bgmEnabled = false;
    let bgmCollapsed = false;
    let bgmDesktopCollapsed = false;
    let bgmDesktopMinimized = false;
    let bgmMinimizedMobile = false;
    let bgmWasMobileViewport = false;
    let bgmRepeatMode = 'off';
    let bgmSeekDragging = false;
    let bgmSeekLastClientX = null;
    let bgmSeekMoveListenersArmed = false;
    let bgmSeekDragEndUiTimer = 0;
    let bgmSeekIgnoreSliderCommitUntil = 0;
    let bgmPendingSeekTime = null;
    let bgmSeekRetryTimer = 0;
    let bgmSeekRetryAttempts = 0;
    let bgmSeekRetryStartedAt = 0;
    let bgmPendingSeekStatusShown = false;
    let bgmPendingSeekWasPlaying = false;
    let bgmPendingSeekResumeDeadline = 0;
    let bgmPendingSeekResumeArmed = false;
    let bgmUnlockArmed = false;
    let bgmCurrentTrackHovering = false;
    let bgmHoveredTrackIndex = -1;
    let bgmTrackIndex = 0;
    let bgmTrackIndicesByLibrary = { bgm: 0, ost: 0 };
    let bgmDockMotionRaf = 0;
    let bgmDockShift = 0;
    let bgmDockTargetShift = 0;
    let bgmLastScrollY = 0;
    let bgmCoverRequestToken = 0;
    let bgmMarqueeRaf = 0;
    let bgmProgressRaf = 0;
    let bgmProgressInterval = 0;
    let bgmProgressIntervalStartedAt = 0;
    const BGM_PROGRESS_INTERVAL_MS = 250;
    const BGM_PROGRESS_INTERVAL_MAX_MS = 5000;

    // Seeking can get stuck forever on streaming sources that don't support random access (HTTP Range).
    // Keep retries bounded to avoid log spam / busy loops.
    const BGM_SEEK_RETRY_MAX_ATTEMPTS = 30;
    const BGM_SEEK_RETRY_MAX_MS = 4000;
    const BGM_SEEK_USER_RESUME_WINDOW_MS = 2500;

    const BGM_STATUS_STARTING = '\uC7AC\uC0DD \uC2DC\uC791...';
    const bgmCoverCacheByLibrary = {
        bgm: new Map(),
        ost: new Map()
    };

    const clampVolume = (value) => {
        if (value === null || value === undefined || value === '') return 0.35;
        const numeric = Number(value);
        if (Number.isNaN(numeric)) return 0.35;
        return Math.max(0, Math.min(1, numeric));
    };

    const clampOpacity = (value) => {
        if (value === null || value === undefined || value === '') return 0.9;
        const numeric = Number(value);
        if (Number.isNaN(numeric)) return 0.9;
        return Math.max(0.2, Math.min(1, numeric));
    };

    const clampTrackIndex = (value, libraryKey) => {
        const normalizedLibrary = libraryKey || bgmLibrary;
        const libraryTracks = AUDIO_TRACKS_BY_LIBRARY[normalizedLibrary] || [];
        const numeric = Number(value);
        if (!Number.isFinite(numeric) || !libraryTracks.length) return 0;
        const normalized = Math.trunc(numeric) % libraryTracks.length;
        return normalized < 0 ? normalized + libraryTracks.length : normalized;
    };

    const normalizeBgmLibrary = (value) => (AUDIO_LIBRARY_KEYS.includes(value) ? value : 'bgm');
    const normalizeRepeatMode = (value) => {
        if (!value) return 'off';
        return BGM_REPEAT_MODES.includes(value) ? value : 'off';
    };
    const isStoredTrue = (value) => value === '1' || value === 'true';
    const isStoredBoolean = (value) => value === '1' || value === 'true' || value === '0' || value === 'false';
    const isBgmMobileViewport = () => window.matchMedia('(max-width: 767px)').matches;
    const isBgmHoverCapable = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const syncBgmCollapseStateForViewport = () => {
        if (isBgmMobileViewport()) {
            bgmCollapsed = true;
            return;
        }
        if (!bgmDesktopCollapsed) {
            bgmDesktopMinimized = false;
        }
        bgmCollapsed = bgmDesktopCollapsed;
        bgmMinimizedMobile = false;
    };

    const formatBgmTime = (seconds) => {
        if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
        const totalSeconds = Math.floor(seconds);
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    const getBgmStatusText = () => {
        if (!bgmEnabled) return '꺼짐';
        if (!bgmAudioEl) return '트랙 로딩 중...';
        if (bgmAudioEl.volume === 0) return '음소거';
        return bgmAudioEl.paused ? '일시정지' : '재생 중';
    };

    const bgmDebugEnabled = () => Boolean(window.__AA_BGM_DEBUG__);

    const debugLog = (...args) => {
        if (!bgmDebugEnabled()) return;
        // `console.debug` is often filtered out in DevTools. Use `console.log` for reliability.
        console.log('[BGM]', ...args);
    };

    let bgmDebugLastTimeupdateLogAt = 0;
    const debugLogThrottled = (minIntervalMs, ...args) => {
        if (!bgmDebugEnabled()) return;
        const now = window.performance && typeof window.performance.now === 'function' ? window.performance.now() : Date.now();
        if (now - bgmDebugLastTimeupdateLogAt < minIntervalMs) return;
        bgmDebugLastTimeupdateLogAt = now;
        console.log('[BGM]', ...args);
    };

    const formatTimeRangesForLog = (ranges) => {
        try {
            if (!ranges || typeof ranges.length !== 'number') return [];
            const result = [];
            for (let i = 0; i < ranges.length; i += 1) {
                const start = ranges.start(i);
                const end = ranges.end(i);
                if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
                result.push([Number(start.toFixed(3)), Number(end.toFixed(3))]);
            }
            return result;
        } catch (_error) {
            return [];
        }
    };

    const timeRangesContain = (ranges, targetTime) => {
        if (!ranges || typeof ranges.length !== 'number' || ranges.length <= 0) return false;
        for (let index = 0; index < ranges.length; index += 1) {
            const rangeStart = ranges.start(index);
            const rangeEnd = ranges.end(index);
            if (!Number.isFinite(rangeStart) || !Number.isFinite(rangeEnd)) continue;
            if (targetTime >= rangeStart && targetTime <= rangeEnd) return true;
        }
        return false;
    };

    const canBgmSeekToTime = (targetTime) => {
        if (!bgmAudioEl || !Number.isFinite(targetTime) || targetTime < 0) return false;

        const duration = Number.isFinite(bgmAudioEl.duration) ? bgmAudioEl.duration : 0;
        const clampedTarget = Math.max(0, duration > 0 ? Math.min(targetTime, duration) : targetTime);

        // IMPORTANT: Do not trust `duration` alone for streaming sources.
        // If the server does not support HTTP Range requests, the browser can reject early seeks
        // (often snapping back to 0). Only seek when the element reports a seekable/buffered range.
        if (timeRangesContain(bgmAudioEl.seekable, clampedTarget)) return true;
        if (timeRangesContain(bgmAudioEl.buffered, clampedTarget)) return true;

        return false;
    };

    const stopBgmSeekRetry = () => {
        if (bgmSeekRetryTimer) {
            window.clearTimeout(bgmSeekRetryTimer);
            bgmSeekRetryTimer = 0;
        }
        bgmSeekRetryAttempts = 0;
        bgmSeekRetryStartedAt = 0;
        bgmPendingSeekStatusShown = false;
    };

    const cancelPendingSeek = (reason, options) => {
        if (!Number.isFinite(bgmPendingSeekTime)) return;
        const resolvedOptions = options || {};
        debugLog('cancel pending seek', { reason, pendingSeekTime: bgmPendingSeekTime });
        bgmPendingSeekTime = null;
        bgmPendingSeekWasPlaying = false;
        bgmPendingSeekResumeDeadline = 0;
        bgmPendingSeekResumeArmed = false;
        stopBgmSeekRetry();
        if (resolvedOptions.statusText) {
            setBgmStatus(resolvedOptions.statusText);
        }
        setBgmTimeUi({ force: true });
    };

    const queueBgmSeekRetry = () => {
        if (!bgmAudioEl || !Number.isFinite(bgmPendingSeekTime)) return;
        if (bgmSeekRetryTimer) return;

        const now = window.performance && typeof window.performance.now === 'function'
            ? window.performance.now()
            : Date.now();

        if (!bgmSeekRetryStartedAt) {
            bgmSeekRetryStartedAt = now;
        }

        const attempt = Math.max(0, Math.trunc(bgmSeekRetryAttempts));
        const elapsed = now - bgmSeekRetryStartedAt;

        if (attempt >= BGM_SEEK_RETRY_MAX_ATTEMPTS || elapsed >= BGM_SEEK_RETRY_MAX_MS) {
            cancelPendingSeek('retry limit exceeded', {
                statusText: '이 트랙은 아직 해당 구간으로 이동할 수 없습니다.'
            });
            return;
        }

        // Backoff a little to avoid spamming the media pipeline.
        const delayMs = Math.min(1200, 120 + attempt * 60);

        bgmSeekRetryTimer = window.setTimeout(() => {
            bgmSeekRetryTimer = 0;
            applyPendingSeek();
        }, delayMs);
    };

    const applyPendingSeek = () => {
        if (!bgmAudioEl || !Number.isFinite(bgmPendingSeekTime)) return;

        const duration = Number.isFinite(bgmAudioEl.duration) ? bgmAudioEl.duration : 0;
        const targetTime = Math.max(0, duration > 0 ? Math.min(bgmPendingSeekTime, duration) : bgmPendingSeekTime);

        const perfNow = window.performance && typeof window.performance.now === 'function'
            ? window.performance.now()
            : Date.now();

        if (!bgmSeekRetryStartedAt) {
            bgmSeekRetryStartedAt = perfNow;
        }

        const attempt = Math.max(0, Math.trunc(bgmSeekRetryAttempts));
        const elapsed = perfNow - bgmSeekRetryStartedAt;
        if (attempt >= BGM_SEEK_RETRY_MAX_ATTEMPTS || elapsed >= BGM_SEEK_RETRY_MAX_MS) {
            cancelPendingSeek('retry limit exceeded (apply)', {
                statusText: '이 트랙은 아직 해당 구간으로 이동할 수 없습니다.'
            });
            return;
        }

        debugLogThrottled(400, 'applyPendingSeek attempt', {
            pendingSeekTime: bgmPendingSeekTime,
            targetTime,
            duration,
            attempts: bgmSeekRetryAttempts,
            elapsedMs: Math.round(elapsed),
            currentTime: Number.isFinite(bgmAudioEl.currentTime) ? bgmAudioEl.currentTime : null,
            paused: bgmAudioEl.paused,
            readyState: bgmAudioEl.readyState,
            networkState: bgmAudioEl.networkState,
            seekable: formatTimeRangesForLog(bgmAudioEl.seekable),
            buffered: formatTimeRangesForLog(bgmAudioEl.buffered)
        });

        if (!canBgmSeekToTime(targetTime)) {
            bgmSeekRetryAttempts += 1;

            if (bgmEnabled && !bgmPendingSeekStatusShown) {
                setBgmStatus('버퍼링 중…(시킹 대기)');
                bgmPendingSeekStatusShown = true;
            }

            debugLogThrottled(700, 'seek pending (not seekable yet)', {
                targetTime,
                duration,
                attempts: bgmSeekRetryAttempts,
                readyState: bgmAudioEl.readyState,
                networkState: bgmAudioEl.networkState,
                seekable: formatTimeRangesForLog(bgmAudioEl.seekable),
                buffered: formatTimeRangesForLog(bgmAudioEl.buffered)
            });
            queueBgmSeekRetry();
            setBgmTimeUi({ force: true });
            return;
        }

        // Do NOT clear `bgmPendingSeekTime` until we confirm that the media element
        // actually moved. Some browsers accept the assignment but immediately snap
        // back to 0 while `readyState` is still low.

        try {
            const method = typeof bgmAudioEl.fastSeek === 'function' ? 'fastSeek' : 'currentTime';
            if (method === 'fastSeek') {
                bgmAudioEl.fastSeek(targetTime);
            } else {
                bgmAudioEl.currentTime = targetTime;
            }

            const afterCurrentTime = Number.isFinite(bgmAudioEl.currentTime) ? bgmAudioEl.currentTime : null;
            const delta = Number.isFinite(afterCurrentTime) ? Math.abs(afterCurrentTime - targetTime) : null;
            const stuck = !(Number.isFinite(delta) && delta <= 0.25);

            debugLog('seek applied', {
                method,
                targetTime,
                afterCurrentTime,
                delta,
                readyState: bgmAudioEl.readyState,
                networkState: bgmAudioEl.networkState
            });

            if (stuck) {
                bgmSeekRetryAttempts += 1;
                debugLog('seek pending (seek did not stick yet)', {
                    targetTime,
                    afterCurrentTime,
                    delta,
                    attempts: bgmSeekRetryAttempts,
                    readyState: bgmAudioEl.readyState,
                    networkState: bgmAudioEl.networkState
                });
                // Keep pending seek time and retry via backoff.
                bgmPendingSeekTime = targetTime;
                queueBgmSeekRetry();
            } else {
                stopBgmSeekRetry();
                bgmPendingSeekTime = null;

                if (bgmPendingSeekResumeArmed && bgmPendingSeekWasPlaying && bgmEnabled) {
                    const now = window.performance && typeof window.performance.now === 'function'
                        ? window.performance.now()
                        : Date.now();
                    const withinWindow = bgmPendingSeekResumeDeadline && now <= bgmPendingSeekResumeDeadline;
                    if (withinWindow && bgmAudioEl.paused) {
                        debugLog('resume after seek (user-initiated window)');
                        void bgmAudioEl.play().catch((error) => {
                            debugLog('resume after seek failed', error);
                        });
                    }
                }

                bgmPendingSeekWasPlaying = false;
                bgmPendingSeekResumeDeadline = 0;
                bgmPendingSeekResumeArmed = false;
            }
        } catch (error) {
            bgmSeekRetryAttempts += 1;
            debugLog('seek attempt failed', error);
            // Keep pending seek and retry later.
            bgmPendingSeekTime = targetTime;
            queueBgmSeekRetry();
        }

        setBgmTimeUi({ force: true });
    };

    const setBgmTimeUi = (options) => {
        if (!bgmAudioEl) return;
        const resolvedOptions = options || {};
        const force = Boolean(resolvedOptions.force);
        if (bgmSeekDragging && !force) return;

        const currentTime = Number.isFinite(bgmAudioEl.currentTime) ? bgmAudioEl.currentTime : 0;
        const duration = Number.isFinite(bgmAudioEl.duration) ? bgmAudioEl.duration : 0;
        const hasKnownDuration = duration > 0;
        const sliderPreviewValue = bgmSeekDragging && bgmSeekSlider ? Number(bgmSeekSlider.value) : NaN;
        const pendingValue = !bgmSeekDragging && Number.isFinite(bgmPendingSeekTime) ? bgmPendingSeekTime : NaN;
        const sliderBaseValue = Number.isFinite(sliderPreviewValue)
            ? sliderPreviewValue
            : (Number.isFinite(pendingValue) ? pendingValue : currentTime);
        const sliderMax = hasKnownDuration ? duration : Math.max(300, currentTime + 1, sliderBaseValue + 1);
        const sliderValue = Math.max(0, Math.min(sliderBaseValue, sliderMax));
        const progressPercent = sliderMax > 0 ? Math.max(0, Math.min(100, (sliderValue / sliderMax) * 100)) : 0;

        if (bgmTimeDisplayEl) {
            const displayTime = !bgmSeekDragging && Number.isFinite(bgmPendingSeekTime) ? bgmPendingSeekTime : currentTime;
            bgmTimeDisplayEl.textContent = `${formatBgmTime(displayTime)} / ${formatBgmTime(duration)}`;
        }

        if (bgmSeekSlider) {
            bgmSeekSlider.max = String(sliderMax);
            bgmSeekSlider.value = String(sliderValue);
            bgmSeekSlider.disabled = !BGM_TRACKS.length;
            bgmSeekSlider.style.setProperty('--bgm-progress-percent', `${progressPercent.toFixed(2)}%`);
        }
    };

    const stopBgmProgressRaf = () => {
        if (!bgmProgressRaf) return;
        window.cancelAnimationFrame(bgmProgressRaf);
        bgmProgressRaf = 0;
    };

    const stopBgmProgressInterval = () => {
        if (!bgmProgressInterval) return;
        window.clearInterval(bgmProgressInterval);
        bgmProgressInterval = 0;
        bgmProgressIntervalStartedAt = 0;
    };

    const startBgmProgressInterval = () => {
        if (!bgmAudioEl || bgmAudioEl.paused || bgmAudioEl.ended || bgmProgressInterval) return;
        const duration = Number.isFinite(bgmAudioEl.duration) ? bgmAudioEl.duration : 0;
        if (duration > 0) return;

        bgmProgressIntervalStartedAt = window.performance.now();
        setBgmTimeUi();
        bgmProgressInterval = window.setInterval(() => {
            if (!bgmAudioEl || bgmAudioEl.paused || bgmAudioEl.ended) {
                stopBgmProgressInterval();
                return;
            }

            setBgmTimeUi();
            const knownDuration = Number.isFinite(bgmAudioEl.duration) && bgmAudioEl.duration > 0;
            const elapsed = window.performance.now() - bgmProgressIntervalStartedAt;
            if (knownDuration || elapsed >= BGM_PROGRESS_INTERVAL_MAX_MS) {
                stopBgmProgressInterval();
            }
        }, BGM_PROGRESS_INTERVAL_MS);
    };

    const startBgmProgressRaf = () => {
        if (!bgmAudioEl || bgmProgressRaf) return;

        const run = () => {
            if (!bgmAudioEl || bgmAudioEl.paused || bgmAudioEl.ended) {
                bgmProgressRaf = 0;
                return;
            }

            setBgmTimeUi();
            bgmProgressRaf = window.requestAnimationFrame(run);
        };

        if (bgmAudioEl.paused || bgmAudioEl.ended) return;
        bgmProgressRaf = window.requestAnimationFrame(run);
    };

    const setBgmStatus = (text) => {
        if (bgmStatusEl) bgmStatusEl.textContent = text;
    };

    const setBgmToggleUi = () => {
        if (!bgmToggleBtn) return;
        bgmToggleBtn.textContent = bgmEnabled ? '켜짐' : '꺼짐';
        bgmToggleBtn.classList.toggle('is-on', bgmEnabled);
    };

    const setBgmPlayPauseUi = () => {
        if (!bgmPlayPauseBtn) return;
        const iconEl = bgmPlayPauseBtn.querySelector('i');
        const isPlaying = Boolean(bgmAudioEl && bgmEnabled && !bgmAudioEl.paused);
        if (iconEl) {
            iconEl.classList.toggle('fa-play', !isPlaying);
            iconEl.classList.toggle('fa-pause', isPlaying);
        }
        bgmPlayPauseBtn.setAttribute('aria-label', isPlaying ? '일시정지' : '재생');
        bgmPlayPauseBtn.setAttribute('title', isPlaying ? '일시정지' : '재생');
        bgmPlayPauseBtn.classList.toggle('is-playing', isPlaying);
    };

    const setBgmRepeatUi = () => {
        if (!bgmRepeatBtn) return;
        let textValue = '반복: 끔';
        let title = '반복 모드: 끔';

        if (bgmRepeatMode === 'one') {
            textValue = '반복: 한 곡';
            title = '반복 모드: 한 곡';
        } else if (bgmRepeatMode === 'all') {
            textValue = '반복: 전체';
            title = '반복 모드: 전체';
        }

        bgmRepeatBtn.textContent = textValue;
        bgmRepeatBtn.setAttribute('aria-label', title);
        bgmRepeatBtn.setAttribute('title', title);
        bgmRepeatBtn.classList.toggle('is-repeat-one', bgmRepeatMode === 'one');
        bgmRepeatBtn.classList.toggle('is-repeat-all', bgmRepeatMode === 'all');
    };
    const setBgmLibraryUi = () => {
        if (bgmLibraryBgmBtn) {
            const isBgm = bgmLibrary === 'bgm';
            bgmLibraryBgmBtn.classList.toggle('is-active', isBgm);
            bgmLibraryBgmBtn.setAttribute('aria-selected', isBgm ? 'true' : 'false');
        }
        if (bgmLibraryOstBtn) {
            const isOst = bgmLibrary === 'ost';
            bgmLibraryOstBtn.classList.toggle('is-active', isOst);
            bgmLibraryOstBtn.setAttribute('aria-selected', isOst ? 'true' : 'false');
        }
    };

    const setBgmCollapseUi = () => {
        if (!bgmWidgetEl || !bgmCollapseBtn) return;
        syncBgmCollapseStateForViewport();
        const isMobile = isBgmMobileViewport();
        const isMinimized = isMobile ? bgmMinimizedMobile : bgmDesktopMinimized;

        bgmWidgetEl.classList.toggle('is-collapsed', bgmCollapsed);
        bgmWidgetEl.classList.toggle('is-minimized', isMinimized);

        if (isMinimized) {
            bgmCollapseBtn.setAttribute('aria-expanded', 'false');
            bgmCollapseBtn.setAttribute('aria-label', isMobile ? 'Open mini player' : 'Expand player');
            bgmCollapseBtn.setAttribute('title', isMobile ? 'Open mini player' : 'Expand');
            const minimizedIconEl = bgmCollapseBtn.querySelector('i');
            if (minimizedIconEl) {
                minimizedIconEl.classList.toggle('fa-angles-left', true);
                minimizedIconEl.classList.toggle('fa-angles-right', false);
            }
            queueBgmMarqueeState();
            return;
        }

        if (isMobile) {
            bgmCollapseBtn.setAttribute('aria-expanded', 'false');
            bgmCollapseBtn.setAttribute('aria-label', 'Minimize to handle');
            bgmCollapseBtn.setAttribute('title', 'Minimize to handle');
            const mobileIconEl = bgmCollapseBtn.querySelector('i');
            if (mobileIconEl) {
                mobileIconEl.classList.toggle('fa-angles-left', false);
                mobileIconEl.classList.toggle('fa-angles-right', true);
            }
            queueBgmMarqueeState();
            return;
        }

        if (bgmCollapsed) {
            bgmCollapseBtn.setAttribute('aria-expanded', 'false');
            bgmCollapseBtn.setAttribute('aria-label', 'Minimize to handle');
            bgmCollapseBtn.setAttribute('title', 'Minimize to handle');
        } else {
            bgmCollapseBtn.setAttribute('aria-expanded', 'true');
            bgmCollapseBtn.setAttribute('aria-label', 'Collapse player');
            bgmCollapseBtn.setAttribute('title', 'Collapse');
        }
        const iconEl = bgmCollapseBtn.querySelector('i');
        if (iconEl) {
            iconEl.classList.toggle('fa-angles-left', !bgmCollapsed);
            iconEl.classList.toggle('fa-angles-right', bgmCollapsed);
        }
        queueBgmMarqueeState();
    };

    const BGM_MARQUEE_GAP_TEXT = '   \u2022   ';

    const ensureBgmMarqueeTextNode = (containerEl, nextText) => {
        if (!containerEl) return null;

        const textValue = typeof nextText === 'string'
            ? nextText
            : (containerEl.dataset.bgmMarqueeText || containerEl.textContent || '');
        containerEl.dataset.bgmMarqueeText = textValue;

        let marqueeTextEl = containerEl.querySelector('.bgm-marquee-text');
        const hasLoopNode = Boolean(containerEl.querySelector('.bgm-marquee-inner'));
        if (!marqueeTextEl || hasLoopNode || marqueeTextEl.parentElement !== containerEl) {
            marqueeTextEl = document.createElement('span');
            marqueeTextEl.className = 'bgm-marquee-text';
            containerEl.textContent = '';
            containerEl.appendChild(marqueeTextEl);
        }
        marqueeTextEl.textContent = textValue;
        return marqueeTextEl;
    };

    const createBgmMarqueeLoopNode = (textValue) => {
        const innerEl = document.createElement('span');
        innerEl.className = 'bgm-marquee-inner';

        const firstSegmentEl = document.createElement('span');
        firstSegmentEl.className = 'bgm-marquee-seg';
        firstSegmentEl.textContent = textValue;

        const gapEl = document.createElement('span');
        gapEl.className = 'bgm-marquee-gap';
        gapEl.setAttribute('aria-hidden', 'true');
        gapEl.textContent = BGM_MARQUEE_GAP_TEXT;

        const secondSegmentEl = document.createElement('span');
        secondSegmentEl.className = 'bgm-marquee-seg';
        secondSegmentEl.setAttribute('aria-hidden', 'true');
        secondSegmentEl.textContent = textValue;

        innerEl.appendChild(firstSegmentEl);
        innerEl.appendChild(gapEl);
        innerEl.appendChild(secondSegmentEl);

        return { innerEl, firstSegmentEl, gapEl };
    };

    const clearBgmMarqueeState = (containerEl) => {
        if (!containerEl) return;
        containerEl.classList.remove('is-marquee');
        containerEl.style.removeProperty('--bgm-marquee-distance');
        containerEl.style.removeProperty('--bgm-marquee-duration');
    };

    const updateBgmMarqueeForElement = (containerEl, options) => {
        if (!containerEl) return;
        const resolvedOptions = options || {};
        const allowAnimation = resolvedOptions.allowAnimation !== false;
        const marqueeTextEl = ensureBgmMarqueeTextNode(containerEl);
        if (!marqueeTextEl) return;
        clearBgmMarqueeState(containerEl);
        if (containerEl.clientWidth <= 0) return;

        const overflowThreshold = Number.isFinite(resolvedOptions.overflowThreshold) ? resolvedOptions.overflowThreshold : 10;
        const overflowWidth = marqueeTextEl.scrollWidth - containerEl.clientWidth;
        if (overflowWidth <= overflowThreshold) return;
        if (!allowAnimation) return;

        const textValue = containerEl.dataset.bgmMarqueeText || marqueeTextEl.textContent || '';
        if (!textValue) return;

        const pixelsPerSecond = Number.isFinite(resolvedOptions.pixelsPerSecond) ? resolvedOptions.pixelsPerSecond : 22;
        const minDuration = Number.isFinite(resolvedOptions.minDuration) ? resolvedOptions.minDuration : 7;
        const maxDuration = Number.isFinite(resolvedOptions.maxDuration) ? resolvedOptions.maxDuration : 18;

        const marqueeLoopNode = createBgmMarqueeLoopNode(textValue);
        containerEl.textContent = '';
        containerEl.appendChild(marqueeLoopNode.innerEl);

        const segmentWidth = Math.ceil(marqueeLoopNode.firstSegmentEl.getBoundingClientRect().width);
        const gapWidth = Math.ceil(marqueeLoopNode.gapEl.getBoundingClientRect().width);
        const distance = Math.max(1, segmentWidth + gapWidth);
        const duration = Math.max(minDuration, Math.min(maxDuration, distance / pixelsPerSecond));
        containerEl.style.setProperty('--bgm-marquee-distance', `${distance}px`);
        containerEl.style.setProperty('--bgm-marquee-duration', `${duration.toFixed(2)}s`);
        containerEl.classList.add('is-marquee');
    };

    const updateBgmMarqueeState = () => {
        const isHoverCapable = isBgmHoverCapable();
        updateBgmMarqueeForElement(bgmCurrentTrackEl, {
            pixelsPerSecond: bgmCollapsed ? 18 : 22,
            minDuration: 7,
            maxDuration: 18,
            overflowThreshold: 10,
            allowAnimation: !isHoverCapable || bgmCurrentTrackHovering
        });

        if (!bgmTrackListEl) return;
        bgmTrackListEl.querySelectorAll('.bgm-track-btn').forEach((trackButtonEl) => {
            if (!(trackButtonEl instanceof HTMLElement)) return;
            const trackTextEl = trackButtonEl.querySelector('.bgm-track-text');
            if (!(trackTextEl instanceof HTMLElement)) return;
            const trackIndex = Number(trackButtonEl.dataset.index);
            const isActiveTrack = Number.isFinite(trackIndex) && trackIndex === bgmTrackIndex;
            const isHoveredTrack = Number.isFinite(trackIndex) && trackIndex === bgmHoveredTrackIndex;
            updateBgmMarqueeForElement(trackTextEl, {
                pixelsPerSecond: 24,
                minDuration: 6,
                maxDuration: 14,
                overflowThreshold: 8,
                allowAnimation: isHoverCapable && isActiveTrack && isHoveredTrack
            });
        });
    };

    const queueBgmMarqueeState = () => {
        if (bgmMarqueeRaf) {
            window.cancelAnimationFrame(bgmMarqueeRaf);
        }
        bgmMarqueeRaf = window.requestAnimationFrame(() => {
            bgmMarqueeRaf = 0;
            updateBgmMarqueeState();
        });
    };

    const hashBgmSeed = (seed) => {
        let hash = 2166136261;
        for (let i = 0; i < seed.length; i += 1) {
            hash ^= seed.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    };

    const getBgmCoverBaseName = (track) => {
        if (!track || !track.src) return '';
        const pathPart = track.src.split('?')[0];
        const filename = pathPart.split('/').pop() || '';
        return filename.replace(/\.[^.]+$/, '');
    };

    const applyGeneratedBgmCover = (track) => {
        if (!bgmCoverArtEl) return;
        const seed = `${track?.filename || ''}|${track?.src || ''}`;
        const hash = hashBgmSeed(seed);
        const hueA = hash % 360;
        const hueB = (hueA + 36 + ((hash >>> 8) % 120)) % 360;
        const hueC = (hueA + 170 + ((hash >>> 16) % 130)) % 360;
        const satA = 62 + (hash % 26);
        const satB = 58 + ((hash >>> 6) % 30);
        const satC = 50 + ((hash >>> 12) % 24);
        const litA = 55 + ((hash >>> 4) % 16);
        const litB = 47 + ((hash >>> 10) % 14);
        const litC = 20 + ((hash >>> 18) % 14);

        bgmCoverArtEl.style.setProperty('--bgm-cover-h1', String(hueA));
        bgmCoverArtEl.style.setProperty('--bgm-cover-h2', String(hueB));
        bgmCoverArtEl.style.setProperty('--bgm-cover-h3', String(hueC));
        bgmCoverArtEl.style.setProperty('--bgm-cover-s1', `${satA}%`);
        bgmCoverArtEl.style.setProperty('--bgm-cover-s2', `${satB}%`);
        bgmCoverArtEl.style.setProperty('--bgm-cover-s3', `${satC}%`);
        bgmCoverArtEl.style.setProperty('--bgm-cover-l1', `${litA}%`);
        bgmCoverArtEl.style.setProperty('--bgm-cover-l2', `${litB}%`);
        bgmCoverArtEl.style.setProperty('--bgm-cover-l3', `${litC}%`);
        bgmCoverArtEl.style.setProperty('--bgm-cover-url', 'none');
        bgmCoverArtEl.classList.remove('has-image');
    };

    const applyImageBgmCover = (url) => {
        if (!bgmCoverArtEl) return;
        const escapedUrl = String(url).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        bgmCoverArtEl.style.setProperty('--bgm-cover-url', `url("${escapedUrl}")`);
        bgmCoverArtEl.classList.add('has-image');
    };

    const checkBgmImageExists = (url) => new Promise((resolve) => {
        const img = new Image();
        let settled = false;
        const finalize = (result) => {
            if (settled) return;
            settled = true;
            img.onload = null;
            img.onerror = null;
            resolve(result);
        };
        img.onload = () => finalize(true);
        img.onerror = () => finalize(false);
        img.src = url;
    });

    const resolveBgmCoverUrl = async (track, libraryKey) => {
        if (track && typeof track.cover === 'string' && track.cover.trim()) {
            return encodeURI(track.cover.trim());
        }

        const normalizedLibrary = normalizeBgmLibrary(libraryKey);
        const libraryConfig = AUDIO_LIBRARY_CONFIG[normalizedLibrary];
        const baseName = getBgmCoverBaseName(track);
        const coverCache = bgmCoverCacheByLibrary[normalizedLibrary] || bgmCoverCacheByLibrary.bgm;

        if (baseName && coverCache.has(baseName)) {
            return coverCache.get(baseName);
        }

        if (baseName) {
            for (const ext of BGM_COVER_EXTENSIONS) {
                const rawPath = `assets/${libraryConfig.folder}/covers/${baseName}.${ext}`;
                const candidateUrl = encodeURI(rawPath);
                const exists = await checkBgmImageExists(candidateUrl);
                if (exists) {
                    coverCache.set(baseName, candidateUrl);
                    return candidateUrl;
                }
            }

            coverCache.set(baseName, null);
        }

        return null;
    };

    const updateBgmCoverUi = async (track) => {
        if (!bgmCoverArtEl || !track) return;
        const libraryKey = bgmLibrary;
        const requestToken = ++bgmCoverRequestToken;
        applyGeneratedBgmCover(track);
        const coverUrl = await resolveBgmCoverUrl(track, libraryKey);
        if (requestToken !== bgmCoverRequestToken || !bgmCoverArtEl || libraryKey !== bgmLibrary) return;
        if (coverUrl) {
            applyImageBgmCover(coverUrl);
        }
    };

    const setBgmTrackUi = () => {
        const activeTrack = BGM_TRACKS[bgmTrackIndex];
        if (bgmCurrentTrackEl) {
            const trackTitle = activeTrack ? activeTrack.title : (bgmCurrentTrackEl.textContent || '');
            ensureBgmMarqueeTextNode(bgmCurrentTrackEl, trackTitle);
            bgmCurrentTrackEl.removeAttribute('title');
        }
        queueBgmMarqueeState();
        if (activeTrack) {
            void updateBgmCoverUi(activeTrack);
        } else {
            applyGeneratedBgmCover({ filename: bgmLibrary, src: `library:${bgmLibrary}` });
        }
        if (!bgmTrackListEl) return;
        bgmTrackListEl.querySelectorAll('.bgm-track-btn').forEach((btn) => {
            const btnIndex = Number(btn.dataset.index);
            const isActive = btnIndex === bgmTrackIndex;
            btn.classList.toggle('is-active', isActive);
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
        setBgmTimeUi({ force: true });
        setBgmPlayPauseUi();
    };

    const applyBgmOpacity = (value) => {
        if (!bgmWidgetEl) return;
        bgmWidgetEl.style.setProperty('--bgm-opacity', String(value));
    };

    const runBgmDockMotion = () => {
        if (!bgmWidgetEl) {
            bgmDockMotionRaf = 0;
            return;
        }
        bgmDockShift += (bgmDockTargetShift - bgmDockShift) * 0.18;
        bgmDockTargetShift *= 0.86;

        if (Math.abs(bgmDockShift) < 0.05 && Math.abs(bgmDockTargetShift) < 0.05) {
            bgmDockShift = 0;
            bgmDockTargetShift = 0;
            bgmWidgetEl.style.setProperty('--bgm-scroll-shift', '0px');
            bgmDockMotionRaf = 0;
            return;
        }

        bgmWidgetEl.style.setProperty('--bgm-scroll-shift', `${bgmDockShift.toFixed(2)}px`);
        bgmDockMotionRaf = window.requestAnimationFrame(runBgmDockMotion);
    };

    const handleBgmDockScroll = () => {
        const currentY = window.scrollY || window.pageYOffset || 0;
        const delta = currentY - bgmLastScrollY;
        bgmLastScrollY = currentY;
        if (Math.abs(delta) < 1) return;

        bgmDockTargetShift = Math.max(-14, Math.min(14, bgmDockTargetShift + (delta * 0.12)));
        if (!bgmDockMotionRaf) {
            bgmDockMotionRaf = window.requestAnimationFrame(runBgmDockMotion);
        }
    };

    const renderBgmTrackList = () => {
        if (!bgmTrackListEl) return;
        bgmHoveredTrackIndex = -1;
        bgmTrackListEl.innerHTML = '';
        if (!BGM_TRACKS.length) {
            const emptyItem = document.createElement('li');
            emptyItem.className = 'bgm-track-item bgm-track-item-empty';
            emptyItem.textContent = '사용 가능한 트랙이 없습니다.';
            bgmTrackListEl.appendChild(emptyItem);
            return;
        }
        BGM_TRACKS.forEach((track, index) => {
            const li = document.createElement('li');
            li.className = 'bgm-track-item';

            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'bgm-track-btn';
            button.dataset.index = String(index);
            button.setAttribute('aria-pressed', 'false');

            const trackNo = document.createElement('span');
            trackNo.className = 'bgm-track-num';
            trackNo.textContent = String(index + 1).padStart(2, '0');

            const trackTitle = document.createElement('span');
            trackTitle.className = 'bgm-track-text';
            trackTitle.dataset.bgmMarqueeText = track.title;
            const trackTitleText = document.createElement('span');
            trackTitleText.className = 'bgm-marquee-text';
            trackTitleText.textContent = track.title;
            trackTitle.appendChild(trackTitleText);
            trackTitle.addEventListener('mouseenter', () => {
                bgmHoveredTrackIndex = index;
                queueBgmMarqueeState();
            });
            trackTitle.addEventListener('mouseleave', () => {
                if (bgmHoveredTrackIndex !== index) return;
                bgmHoveredTrackIndex = -1;
                queueBgmMarqueeState();
            });

            button.appendChild(trackNo);
            button.appendChild(trackTitle);
            li.appendChild(button);
            bgmTrackListEl.appendChild(li);
        });
    };

    const setBgmTrack = (index, options) => {
        if (!bgmAudioEl || !BGM_TRACKS.length) return;
        const resolvedOptions = options || {};
        const normalizedIndex = clampTrackIndex(index, bgmLibrary);
        const selectedTrack = BGM_TRACKS[normalizedIndex];
        if (!selectedTrack) return;
        const shouldAutoplay = Boolean(resolvedOptions.autoplay);
        const resetTime = Boolean(resolvedOptions.resetTime);
        bgmPendingSeekTime = null;
        stopBgmSeekRetry();

        bgmTrackIndex = normalizedIndex;
        bgmTrackIndicesByLibrary[bgmLibrary] = bgmTrackIndex;
        const currentTrackIndexKey = getTrackIndexKey(bgmLibrary);
        localStorage.setItem(currentTrackIndexKey, String(bgmTrackIndex));
        if (bgmLibrary === 'bgm') {
            localStorage.setItem(BGM_TRACK_INDEX_LEGACY_KEY, String(bgmTrackIndex));
        }

        const currentSrc = bgmAudioEl.getAttribute('src');
        const srcChanged = currentSrc !== selectedTrack.src;
        if (srcChanged) {
            debugLog('setTrack src change', {
                library: bgmLibrary,
                index: normalizedIndex,
                from: currentSrc,
                to: selectedTrack.src,
                resetTime,
                beforeCurrentTime: Number.isFinite(bgmAudioEl.currentTime) ? bgmAudioEl.currentTime : null
            });
            bgmAudioEl.setAttribute('src', selectedTrack.src);
            debugLog('audio.load() after src change');
            bgmAudioEl.load();
        }
        if (resetTime && !srcChanged) {
            debugLog('setTrack reset currentTime=0 (src unchanged)', {
                library: bgmLibrary,
                index: normalizedIndex,
                src: currentSrc,
                beforeCurrentTime: Number.isFinite(bgmAudioEl.currentTime) ? bgmAudioEl.currentTime : null
            });
            bgmAudioEl.currentTime = 0;
            debugLog('setTrack currentTime set to 0 (src unchanged)', {
                afterCurrentTime: Number.isFinite(bgmAudioEl.currentTime) ? bgmAudioEl.currentTime : null
            });
        }

        setBgmTrackUi();

        if (shouldAutoplay && bgmEnabled) {
            setBgmStatus('재생 시작 중...');
            void tryStartBgm();
        } else if (!bgmEnabled) {
            setBgmStatus('꺼짐');
        } else {
            setBgmStatus(getBgmStatusText());
        }
        setBgmTimeUi({ force: true });
        setBgmPlayPauseUi();
    };

    const switchBgmLibrary = (libraryKey, options) => {
        const normalizedLibrary = normalizeBgmLibrary(libraryKey);
        const resolvedOptions = options || {};
        const shouldAutoplay = Boolean(resolvedOptions.autoplay);
        const resetTime = Boolean(resolvedOptions.resetTime);

        bgmTrackIndicesByLibrary[bgmLibrary] = bgmTrackIndex;
        bgmCoverRequestToken += 1;
        bgmLibrary = normalizedLibrary;
        BGM_TRACKS = AUDIO_TRACKS_BY_LIBRARY[bgmLibrary] || [];
        localStorage.setItem(BGM_LIBRARY_KEY, bgmLibrary);

        const savedIndex = bgmTrackIndicesByLibrary[bgmLibrary];
        bgmTrackIndex = clampTrackIndex(savedIndex, bgmLibrary);
        bgmTrackIndicesByLibrary[bgmLibrary] = bgmTrackIndex;

        setBgmLibraryUi();
        renderBgmTrackList();

        if (!BGM_TRACKS.length) {
            if (bgmAudioEl) {
                debugLog('switchLibrary: no tracks, clearing src');
                bgmAudioEl.pause();
                bgmAudioEl.removeAttribute('src');
                bgmAudioEl.load();
            }
            setBgmTrackUi();
            setBgmStatus('사용 가능한 트랙이 없습니다.');
            return;
        }

        setBgmTrack(bgmTrackIndex, { autoplay: shouldAutoplay, resetTime });
    };

    const syncBgmTrackBeforePlaybackStart = () => {
        if (!bgmAudioEl || !BGM_TRACKS.length) return;
        const normalizedIndex = clampTrackIndex(bgmTrackIndex, bgmLibrary);
        const activeTrack = BGM_TRACKS[normalizedIndex];
        if (!activeTrack) return;

        if (bgmAudioEl.getAttribute('src') !== activeTrack.src) {
            setBgmTrack(normalizedIndex, { autoplay: false, resetTime: true });
            return;
        }

        if (!Number.isFinite(bgmAudioEl.currentTime) || bgmAudioEl.currentTime < 0) {
            debugLog('syncBgmTrackBeforePlaybackStart: currentTime invalid, forcing 0', {
                beforeCurrentTime: Number.isFinite(bgmAudioEl.currentTime) ? bgmAudioEl.currentTime : null
            });
            bgmAudioEl.currentTime = 0;
        }
    };

    const removeBgmUnlockListeners = () => {
        if (!bgmUnlockArmed) return;
        document.removeEventListener('pointerdown', handleBgmUnlock);
        document.removeEventListener('keydown', handleBgmUnlock);
        bgmUnlockArmed = false;
    };

    const addBgmUnlockListeners = () => {
        if (bgmUnlockArmed) return;
        document.addEventListener('pointerdown', handleBgmUnlock);
        document.addEventListener('keydown', handleBgmUnlock);
        bgmUnlockArmed = true;
    };

    const tryStartBgm = async () => {
        if (!bgmAudioEl || !bgmEnabled) return false;
        try {
            await bgmAudioEl.play();
            removeBgmUnlockListeners();
            startBgmProgressRaf();
            startBgmProgressInterval();
            setBgmTimeUi({ force: true });
            setBgmStatus(getBgmStatusText());
            setBgmPlayPauseUi();
            return true;
        } catch (_error) {
            setBgmStatus('자동 재생이 차단되었습니다. 화면을 한 번 터치/클릭한 뒤 재생을 눌러주세요.');
            addBgmUnlockListeners();
            setBgmPlayPauseUi();
            return false;
        }
    };

    function handleBgmUnlock() {
        removeBgmUnlockListeners();
        if (bgmEnabled && bgmAudioEl && bgmAudioEl.paused) {
            setBgmStatus('\uC7AC\uC0DD \uBC84\uD2BC\uC744 \uB20C\uB7EC\uC8FC\uC138\uC694.');
        }
    }

    const handleBgmEnded = () => {
        if (!bgmAudioEl || !BGM_TRACKS.length) return;

        if (bgmRepeatMode === 'one') {
            debugLog('ended: repeat one -> currentTime=0', {
                beforeCurrentTime: Number.isFinite(bgmAudioEl.currentTime) ? bgmAudioEl.currentTime : null
            });
            bgmAudioEl.currentTime = 0;
            if (bgmEnabled) {
                void tryStartBgm();
            }
            return;
        }

        const isLastTrack = bgmTrackIndex >= BGM_TRACKS.length - 1;

        if (bgmRepeatMode === 'all') {
            const nextIndex = isLastTrack ? 0 : (bgmTrackIndex + 1);
            setBgmTrack(nextIndex, { autoplay: bgmEnabled, resetTime: false });
            return;
        }

        if (!isLastTrack) {
            setBgmTrack(bgmTrackIndex + 1, { autoplay: bgmEnabled, resetTime: false });
            return;
        }

        bgmAudioEl.pause();
        setBgmStatus('재생이 종료되었습니다.');
        setBgmPlayPauseUi();
    };

    const initBgmControls = () => {
        debugLog('initBgmControls start');
        if (window.__AA_BGM_INIT__) {
            debugLog('initBgmControls skipped (already initialized)');
            return;
        }
        window.__AA_BGM_INIT__ = true;
        bgmAudioEl = document.getElementById('bgm-audio');
        bgmWidgetEl = document.getElementById('bgm-widget');
        bgmToggleBtn = document.getElementById('bgm-toggle-btn');
        bgmPlayPauseBtn = document.getElementById('bgm-play-pause-btn');
        bgmPrevBtn = document.getElementById('bgm-prev-btn');
        bgmNextBtn = document.getElementById('bgm-next-btn');
        bgmCollapseBtn = document.getElementById('bgm-collapse-btn');
        bgmTrackListEl = document.getElementById('bgm-track-list');
        bgmCurrentTrackEl = document.getElementById('bgm-current-track');
        bgmVolumeSlider = document.getElementById('bgm-volume-slider');
        bgmOpacitySlider = document.getElementById('bgm-opacity-slider');
        bgmSeekSlider = document.getElementById('bgm-seek-slider');
        bgmTimeDisplayEl = document.getElementById('bgm-time-display');
        bgmRepeatBtn = document.getElementById('bgm-repeat-btn');
        bgmLibraryBgmBtn = document.getElementById('bgm-library-bgm-btn');
        bgmLibraryOstBtn = document.getElementById('bgm-library-ost-btn');
        bgmStatusEl = document.getElementById('bgm-status');
        bgmCoverArtEl = document.getElementById('bgm-cover-art');
        if (!bgmAudioEl || !bgmWidgetEl || !bgmToggleBtn || !bgmPlayPauseBtn || !bgmPrevBtn || !bgmNextBtn || !bgmCollapseBtn || !bgmTrackListEl || !bgmCurrentTrackEl || !bgmVolumeSlider || !bgmOpacitySlider || !bgmStatusEl || !bgmSeekSlider || !bgmTimeDisplayEl || !bgmRepeatBtn) return;

        const savedVolume = clampVolume(localStorage.getItem(BGM_VOLUME_KEY));
        const savedOpacity = clampOpacity(localStorage.getItem(BGM_OPACITY_KEY));

        localStorage.removeItem(BGM_TRACK_INDEX_LEGACY_KEY);
        AUDIO_LIBRARY_KEYS.forEach((libraryKey) => {
            bgmTrackIndicesByLibrary[libraryKey] = 0;
            localStorage.removeItem(getTrackIndexKey(libraryKey));
        });
        localStorage.removeItem(BGM_LIBRARY_KEY);

        bgmLibrary = 'bgm';
        BGM_TRACKS = AUDIO_TRACKS_BY_LIBRARY.bgm || [];
        bgmTrackIndex = 0;

        const savedEnabledRaw = localStorage.getItem(BGM_ENABLED_KEY);
        bgmEnabled = isStoredTrue(savedEnabledRaw);
        const savedCollapsedRaw = localStorage.getItem(BGM_COLLAPSED_KEY);
        const savedCollapsed = isStoredTrue(savedCollapsedRaw);
        const savedMinimizedMobileRaw = localStorage.getItem(BGM_MINIMIZED_MOBILE_KEY);
        const hasSavedMinimizedMobile = isStoredBoolean(savedMinimizedMobileRaw);
        bgmDesktopCollapsed = savedCollapsed;
        bgmCollapsed = savedCollapsed;
        bgmDesktopMinimized = false;
        bgmMinimizedMobile = hasSavedMinimizedMobile ? isStoredTrue(savedMinimizedMobileRaw) : false;
        if (isBgmMobileViewport()) {
            bgmMinimizedMobile = true;
        }
        bgmWasMobileViewport = isBgmMobileViewport();
        syncBgmCollapseStateForViewport();
        bgmRepeatMode = normalizeRepeatMode(localStorage.getItem(BGM_REPEAT_MODE_KEY));

        localStorage.setItem(BGM_COLLAPSED_KEY, bgmDesktopCollapsed ? '1' : '0');
        if (hasSavedMinimizedMobile || isBgmMobileViewport()) {
            localStorage.setItem(BGM_MINIMIZED_MOBILE_KEY, bgmMinimizedMobile ? '1' : '0');
        }
        localStorage.setItem(BGM_REPEAT_MODE_KEY, bgmRepeatMode);
        localStorage.setItem(BGM_LIBRARY_KEY, bgmLibrary);

        setBgmCollapseUi();
        setBgmLibraryUi();
        switchBgmLibrary('bgm', { autoplay: false, resetTime: true });

        bgmAudioEl.volume = savedVolume;
        bgmVolumeSlider.value = String(savedVolume);
        bgmOpacitySlider.value = String(savedOpacity);
        applyBgmOpacity(savedOpacity);
        setBgmToggleUi();
        setBgmPlayPauseUi();
        setBgmRepeatUi();
        setBgmTimeUi({ force: true });
        bgmLastScrollY = window.scrollY || window.pageYOffset || 0;

        bgmAudioEl.addEventListener('play', () => {
            debugLog('event: play', {
                currentTime: Number.isFinite(bgmAudioEl.currentTime) ? bgmAudioEl.currentTime : null,
                duration: Number.isFinite(bgmAudioEl.duration) ? bgmAudioEl.duration : null,
                readyState: bgmAudioEl.readyState,
                networkState: bgmAudioEl.networkState,
                src: bgmAudioEl.getAttribute('src')
            });
            startBgmProgressRaf();
            startBgmProgressInterval();
            if (bgmEnabled) setBgmStatus(getBgmStatusText());
            setBgmPlayPauseUi();
        });
        // Some browsers may fire `play` before `currentTime` starts advancing.
        // Ensure the progress UI loop is running once playback actually begins.
        bgmAudioEl.addEventListener('playing', () => {
            debugLog('event: playing', {
                currentTime: Number.isFinite(bgmAudioEl.currentTime) ? bgmAudioEl.currentTime : null,
                duration: Number.isFinite(bgmAudioEl.duration) ? bgmAudioEl.duration : null,
                readyState: bgmAudioEl.readyState,
                networkState: bgmAudioEl.networkState
            });
            startBgmProgressRaf();
            startBgmProgressInterval();
            setBgmTimeUi({ force: true });
        });
        bgmAudioEl.addEventListener('pause', () => {
            debugLog('event: pause', {
                currentTime: Number.isFinite(bgmAudioEl.currentTime) ? bgmAudioEl.currentTime : null,
                duration: Number.isFinite(bgmAudioEl.duration) ? bgmAudioEl.duration : null,
                readyState: bgmAudioEl.readyState,
                networkState: bgmAudioEl.networkState
            });
            stopBgmProgressRaf();
            stopBgmProgressInterval();
            if (bgmEnabled) setBgmStatus(getBgmStatusText());
            setBgmPlayPauseUi();
        });
        bgmAudioEl.addEventListener('loadedmetadata', () => {
            debugLog('event: loadedmetadata', {
                duration: Number.isFinite(bgmAudioEl.duration) ? bgmAudioEl.duration : null,
                currentTime: Number.isFinite(bgmAudioEl.currentTime) ? bgmAudioEl.currentTime : null,
                seekable: formatTimeRangesForLog(bgmAudioEl.seekable),
                buffered: formatTimeRangesForLog(bgmAudioEl.buffered)
            });
            applyPendingSeek();
            setBgmTimeUi({ force: true });
        });
        bgmAudioEl.addEventListener('loadeddata', () => {
            debugLog('event: loadeddata', {
                duration: Number.isFinite(bgmAudioEl.duration) ? bgmAudioEl.duration : null,
                currentTime: Number.isFinite(bgmAudioEl.currentTime) ? bgmAudioEl.currentTime : null,
                readyState: bgmAudioEl.readyState,
                buffered: formatTimeRangesForLog(bgmAudioEl.buffered)
            });
            applyPendingSeek();
            setBgmTimeUi({ force: true });
        });
        bgmAudioEl.addEventListener('canplay', () => {
            debugLog('event: canplay', {
                duration: Number.isFinite(bgmAudioEl.duration) ? bgmAudioEl.duration : null,
                currentTime: Number.isFinite(bgmAudioEl.currentTime) ? bgmAudioEl.currentTime : null,
                readyState: bgmAudioEl.readyState,
                buffered: formatTimeRangesForLog(bgmAudioEl.buffered)
            });
            applyPendingSeek();
            setBgmTimeUi({ force: true });
        });
        bgmAudioEl.addEventListener('durationchange', () => {
            debugLog('event: durationchange', {
                duration: Number.isFinite(bgmAudioEl.duration) ? bgmAudioEl.duration : null,
                currentTime: Number.isFinite(bgmAudioEl.currentTime) ? bgmAudioEl.currentTime : null,
                readyState: bgmAudioEl.readyState
            });
            applyPendingSeek();
            setBgmTimeUi({ force: true });
            if (Number.isFinite(bgmAudioEl.duration) && bgmAudioEl.duration > 0) {
                stopBgmProgressRaf();
                stopBgmProgressInterval();
            }
        });
        bgmAudioEl.addEventListener('seeking', () => {
            debugLog('event: seeking', {
                currentTime: Number.isFinite(bgmAudioEl.currentTime) ? bgmAudioEl.currentTime : null,
                duration: Number.isFinite(bgmAudioEl.duration) ? bgmAudioEl.duration : null,
                readyState: bgmAudioEl.readyState,
                networkState: bgmAudioEl.networkState,
                pendingSeekTime: Number.isFinite(bgmPendingSeekTime) ? bgmPendingSeekTime : null
            });
        });
        bgmAudioEl.addEventListener('seeked', () => {
            debugLog('event: seeked', {
                currentTime: Number.isFinite(bgmAudioEl.currentTime) ? bgmAudioEl.currentTime : null,
                duration: Number.isFinite(bgmAudioEl.duration) ? bgmAudioEl.duration : null,
                readyState: bgmAudioEl.readyState,
                networkState: bgmAudioEl.networkState
            });
        });
        bgmAudioEl.addEventListener('waiting', () => {
            debugLog('event: waiting', {
                currentTime: Number.isFinite(bgmAudioEl.currentTime) ? bgmAudioEl.currentTime : null,
                readyState: bgmAudioEl.readyState,
                networkState: bgmAudioEl.networkState,
                buffered: formatTimeRangesForLog(bgmAudioEl.buffered)
            });
        });
        bgmAudioEl.addEventListener('stalled', () => {
            debugLog('event: stalled', {
                currentTime: Number.isFinite(bgmAudioEl.currentTime) ? bgmAudioEl.currentTime : null,
                readyState: bgmAudioEl.readyState,
                networkState: bgmAudioEl.networkState
            });
        });

        bgmAudioEl.addEventListener('timeupdate', () => {
            debugLogThrottled(500, 'event: timeupdate', {
                currentTime: Number.isFinite(bgmAudioEl.currentTime) ? bgmAudioEl.currentTime : null,
                duration: Number.isFinite(bgmAudioEl.duration) ? bgmAudioEl.duration : null,
                paused: bgmAudioEl.paused,
                readyState: bgmAudioEl.readyState,
                networkState: bgmAudioEl.networkState
            });
            applyPendingSeek();
            setBgmTimeUi();
        });
        bgmAudioEl.addEventListener('progress', () => {
            debugLogThrottled(800, 'event: progress', {
                buffered: formatTimeRangesForLog(bgmAudioEl.buffered),
                seekable: formatTimeRangesForLog(bgmAudioEl.seekable),
                readyState: bgmAudioEl.readyState,
                networkState: bgmAudioEl.networkState
            });
            applyPendingSeek();
        });
        bgmAudioEl.addEventListener('ended', () => {
            debugLog('event: ended', {
                currentTime: Number.isFinite(bgmAudioEl.currentTime) ? bgmAudioEl.currentTime : null,
                duration: Number.isFinite(bgmAudioEl.duration) ? bgmAudioEl.duration : null
            });
            stopBgmProgressRaf();
            stopBgmProgressInterval();
            handleBgmEnded();
        });
        bgmAudioEl.addEventListener('error', () => {
            debugLog('event: error', {
                error: bgmAudioEl.error ? { code: bgmAudioEl.error.code, message: bgmAudioEl.error.message } : null,
                currentSrc: bgmAudioEl.currentSrc,
                src: bgmAudioEl.getAttribute('src'),
                networkState: bgmAudioEl.networkState,
                readyState: bgmAudioEl.readyState
            });
            stopBgmProgressRaf();
            stopBgmProgressInterval();
            setBgmStatus('트랙을 불러오지 못했습니다.');
            setBgmPlayPauseUi();
        });

        bgmToggleBtn.addEventListener('click', async () => {
            bgmEnabled = !bgmEnabled;
            localStorage.setItem(BGM_ENABLED_KEY, bgmEnabled ? '1' : '0');
            setBgmToggleUi();

            if (bgmEnabled) {
                if (!BGM_TRACKS.length) {
                    setBgmStatus('사용 가능한 트랙이 없습니다.');
                    setBgmPlayPauseUi();
                    return;
                }
                setBgmStatus('재생 시작 중...');
                syncBgmTrackBeforePlaybackStart();
                await tryStartBgm();
            } else {
                bgmAudioEl.pause();
                bgmPendingSeekTime = null;
                stopBgmSeekRetry();
                removeBgmUnlockListeners();
                setBgmStatus('꺼짐');
            }
            setBgmPlayPauseUi();
        });

        bgmPlayPauseBtn.addEventListener('click', async () => {
            if (!bgmEnabled) {
                bgmEnabled = true;
                localStorage.setItem(BGM_ENABLED_KEY, '1');
                setBgmToggleUi();
                if (!BGM_TRACKS.length) {
                    setBgmStatus('사용 가능한 트랙이 없습니다.');
                    setBgmPlayPauseUi();
                    return;
                }
                setBgmStatus(BGM_STATUS_STARTING);
                syncBgmTrackBeforePlaybackStart();
                await tryStartBgm();
                return;
            }

            if (bgmAudioEl.paused) {
                // If a seek was pending (e.g. stalled/streaming track), pressing Play should act as
                // an escape hatch: cancel the pending seek and just play from the current position.
                cancelPendingSeek('play pressed', { statusText: null });

                setBgmStatus(BGM_STATUS_STARTING);
                syncBgmTrackBeforePlaybackStart();
                await tryStartBgm();
            } else {
                bgmAudioEl.pause();
                // User explicitly paused; do not auto-resume after a later seek.
                bgmPendingSeekWasPlaying = false;
                bgmPendingSeekResumeDeadline = 0;
                bgmPendingSeekResumeArmed = false;
                setBgmStatus('일시정지');
            }
            setBgmPlayPauseUi();
        });

        bgmCollapseBtn.addEventListener('click', () => {
            if (isBgmMobileViewport()) {
                bgmMinimizedMobile = !bgmMinimizedMobile;
                bgmCollapsed = true;
                localStorage.setItem(BGM_MINIMIZED_MOBILE_KEY, bgmMinimizedMobile ? '1' : '0');
                setBgmCollapseUi();
                return;
            }

            if (bgmDesktopMinimized) {
                bgmDesktopMinimized = false;
                bgmDesktopCollapsed = false;
            } else if (bgmDesktopCollapsed) {
                bgmDesktopMinimized = true;
                bgmDesktopCollapsed = true;
            } else {
                bgmDesktopCollapsed = true;
                bgmDesktopMinimized = false;
            }
            bgmCollapsed = bgmDesktopCollapsed;
            localStorage.setItem(BGM_COLLAPSED_KEY, bgmDesktopCollapsed ? '1' : '0');
            setBgmCollapseUi();
        });

        bgmVolumeSlider.addEventListener('input', () => {
            const volume = clampVolume(bgmVolumeSlider.value);
            bgmAudioEl.volume = volume;
            localStorage.setItem(BGM_VOLUME_KEY, String(volume));

            if (!bgmEnabled) {
                setBgmStatus('꺼짐');
                return;
            }
            if (volume === 0) {
                setBgmStatus('음소거');
                return;
            }
            setBgmStatus(getBgmStatusText());
        });

        if (bgmLibraryBgmBtn) {
            bgmLibraryBgmBtn.addEventListener('click', () => {
                if (bgmLibrary === 'bgm') return;
                const shouldAutoplay = Boolean(bgmEnabled && bgmAudioEl && !bgmAudioEl.paused);
                switchBgmLibrary('bgm', { autoplay: shouldAutoplay, resetTime: false });
            });
        }
        if (bgmLibraryOstBtn) {
            bgmLibraryOstBtn.addEventListener('click', () => {
                if (bgmLibrary === 'ost') return;
                const shouldAutoplay = Boolean(bgmEnabled && bgmAudioEl && !bgmAudioEl.paused);
                switchBgmLibrary('ost', { autoplay: shouldAutoplay, resetTime: false });
            });
        }

        bgmOpacitySlider.addEventListener('input', () => {
            const opacity = clampOpacity(bgmOpacitySlider.value);
            applyBgmOpacity(opacity);
            localStorage.setItem(BGM_OPACITY_KEY, String(opacity));
        });

        bgmPrevBtn.addEventListener('click', () => {
            setBgmTrack(bgmTrackIndex - 1, { autoplay: bgmEnabled, resetTime: true });
        });

        bgmNextBtn.addEventListener('click', () => {
            setBgmTrack(bgmTrackIndex + 1, { autoplay: bgmEnabled, resetTime: true });
        });

        bgmRepeatBtn.addEventListener('click', () => {
            const currentIndex = BGM_REPEAT_MODES.indexOf(bgmRepeatMode);
            const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % BGM_REPEAT_MODES.length : 0;
            bgmRepeatMode = BGM_REPEAT_MODES[nextIndex];
            localStorage.setItem(BGM_REPEAT_MODE_KEY, bgmRepeatMode);
            setBgmRepeatUi();
        });

        const ensureBgmSeekSliderMax = () => {
            if (!bgmSeekSlider || !bgmAudioEl) return;
            const duration = Number.isFinite(bgmAudioEl.duration) ? bgmAudioEl.duration : 0;
            const currentTime = Number.isFinite(bgmAudioEl.currentTime) ? bgmAudioEl.currentTime : 0;
            const sliderMaxRaw = Number(bgmSeekSlider.max);
            const nextMax = duration > 0 ? duration : Math.max(300, currentTime + 1, Number.isFinite(sliderMaxRaw) ? sliderMaxRaw : 0);
            if (!(Number.isFinite(sliderMaxRaw) && sliderMaxRaw > 0)) {
                bgmSeekSlider.max = String(nextMax);
            }
        };

        const logSeekSliderState = (label, event) => {
            if (!bgmDebugEnabled() || !bgmSeekSlider) return;
            const rect = bgmSeekSlider.getBoundingClientRect();
            debugLog(label, {
                type: event && event.type,
                pointerType: event && 'pointerType' in event ? event.pointerType : null,
                clientX: event && 'clientX' in event ? event.clientX : null,
                slider: {
                    min: bgmSeekSlider.min,
                    max: bgmSeekSlider.max,
                    step: bgmSeekSlider.step,
                    value: bgmSeekSlider.value,
                    valueAsNumber: Number.isFinite(bgmSeekSlider.valueAsNumber) ? bgmSeekSlider.valueAsNumber : null
                },
                rect: {
                    left: Number(rect.left.toFixed(2)),
                    width: Number(rect.width.toFixed(2))
                }
            });
        };

        const getTimeFromSeekSliderValue = (event) => {
            if (!bgmAudioEl || !bgmSeekSlider) return null;
            const duration = Number.isFinite(bgmAudioEl.duration) ? bgmAudioEl.duration : 0;
            const raw = event && event.target && typeof event.target.valueAsNumber === 'number'
                ? event.target.valueAsNumber
                : bgmSeekSlider.valueAsNumber;
            const rawNextTime = Number.isFinite(raw) ? raw : Number(bgmSeekSlider.value);
            if (!Number.isFinite(rawNextTime)) return null;
            return Math.max(0, duration > 0 ? Math.min(rawNextTime, duration) : rawNextTime);
        };

        const getSeekClientX = (event) => {
            if (!event) return null;
            if (typeof event.clientX === 'number') return event.clientX;
            const touch = event.changedTouches && event.changedTouches[0]
                ? event.changedTouches[0]
                : (event.touches && event.touches[0] ? event.touches[0] : null);
            if (touch && typeof touch.clientX === 'number') return touch.clientX;
            return null;
        };

        const getTimeFromSeekPointer = (event) => {
            const clientX = getSeekClientX(event);
            if (!bgmAudioEl || !bgmSeekSlider || typeof clientX !== 'number') return null;
            ensureBgmSeekSliderMax();
            const sliderMax = Number(bgmSeekSlider.max);
            if (!(Number.isFinite(sliderMax) && sliderMax > 0)) return null;
            const rect = bgmSeekSlider.getBoundingClientRect();
            if (!(rect.width > 0)) return null;
            const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            const duration = Number.isFinite(bgmAudioEl.duration) ? bgmAudioEl.duration : 0;
            const rawNextTime = ratio * sliderMax;
            return Math.max(0, duration > 0 ? Math.min(rawNextTime, duration) : rawNextTime);
        };

        const updateBgmSeekLastClientX = (event) => {
            const clientX = getSeekClientX(event);
            if (typeof clientX === 'number') bgmSeekLastClientX = clientX;
        };

        const armBgmSeekMoveListeners = () => {
            if (bgmSeekMoveListenersArmed) return;
            bgmSeekMoveListenersArmed = true;
            window.addEventListener('pointermove', updateBgmSeekLastClientX, { passive: true });
            window.addEventListener('mousemove', updateBgmSeekLastClientX, { passive: true });
            window.addEventListener('touchmove', updateBgmSeekLastClientX, { passive: true });
        };

        const disarmBgmSeekMoveListeners = () => {
            if (!bgmSeekMoveListenersArmed) return;
            bgmSeekMoveListenersArmed = false;
            window.removeEventListener('pointermove', updateBgmSeekLastClientX);
            window.removeEventListener('mousemove', updateBgmSeekLastClientX);
            window.removeEventListener('touchmove', updateBgmSeekLastClientX);
        };

        const beginBgmSeekDrag = (event) => {
            bgmSeekDragging = true;
            updateBgmSeekLastClientX(event);
            armBgmSeekMoveListeners();
            ensureBgmSeekSliderMax();
            logSeekSliderState('seek drag begin', event);
        };

        const endBgmSeekDrag = (event) => {
            if (!bgmSeekDragging) return;
            bgmSeekDragging = false;
            updateBgmSeekLastClientX(event);
            disarmBgmSeekMoveListeners();
            logSeekSliderState('seek drag end', event);

            // IMPORTANT: Some browsers dispatch pointerup/mouseup before the final change event.
            // If we force-sync the UI here, we can overwrite the slider's value back to the
            // currentTime (often ~0) and the subsequent change handler will read 0.
            if (bgmSeekDragEndUiTimer) {
                window.clearTimeout(bgmSeekDragEndUiTimer);
                bgmSeekDragEndUiTimer = 0;
            }
            bgmSeekDragEndUiTimer = window.setTimeout(() => {
                bgmSeekDragEndUiTimer = 0;
                setBgmTimeUi({ force: true });
            }, 60);
        };

        const applyBgmSeekToTime = (nextTime, meta) => {
            if (!bgmAudioEl || !Number.isFinite(nextTime)) return;
            const duration = Number.isFinite(bgmAudioEl.duration) ? bgmAudioEl.duration : 0;
            const canSeekNow = canBgmSeekToTime(nextTime);
            debugLog('seek requested', {
                ...meta,
                nextTime,
                duration,
                canSeekNow,
                currentTime: Number.isFinite(bgmAudioEl.currentTime) ? bgmAudioEl.currentTime : null,
                readyState: bgmAudioEl.readyState,
                networkState: bgmAudioEl.networkState
            });
            const perfNow = window.performance && typeof window.performance.now === 'function'
                ? window.performance.now()
                : Date.now();
            const wasPlaying = Boolean(bgmEnabled && bgmAudioEl && !bgmAudioEl.paused);

            bgmPendingSeekTime = nextTime;
            bgmSeekRetryAttempts = 0;
            bgmSeekRetryStartedAt = perfNow;
            bgmPendingSeekStatusShown = false;

            // If the user initiated a seek while the track was already playing, some browsers
            // can briefly pause the media pipeline while the seek resolves. Allow a short
            // resume window after the seek sticks.
            bgmPendingSeekWasPlaying = wasPlaying;
            bgmPendingSeekResumeArmed = wasPlaying;
            bgmPendingSeekResumeDeadline = wasPlaying ? perfNow + BGM_SEEK_USER_RESUME_WINDOW_MS : 0;

            applyPendingSeek();
            setBgmTimeUi({ force: true });
        };

        const applyBgmSeekFromSlider = (event) => {
            if (!bgmAudioEl) return;

            const now = window.performance && typeof window.performance.now === 'function'
                ? window.performance.now()
                : Date.now();
            if (now < bgmSeekIgnoreSliderCommitUntil) {
                logSeekSliderState('seek slider ignored (pointer commit window)', event);
                debugLog('seek slider ignored (pointer commit window)', {
                    type: event && event.type,
                    ignoreUntil: bgmSeekIgnoreSliderCommitUntil
                });
                return;
            }

            ensureBgmSeekSliderMax();
            logSeekSliderState('seek slider input', event);
            const nextTime = getTimeFromSeekSliderValue(event);
            if (!Number.isFinite(nextTime)) return;
            applyBgmSeekToTime(nextTime, {
                source: 'slider',
                rawNextTime: Number.isFinite(event && event.target && event.target.valueAsNumber) ? event.target.valueAsNumber : Number(bgmSeekSlider.value)
            });
        };

        const applyBgmSeekFromPointerCommit = (event) => {
            if (!bgmAudioEl) return;
            ensureBgmSeekSliderMax();
            logSeekSliderState('seek pointer commit', event);

            const nextTime = getTimeFromSeekPointer(event);
            const fallbackTime = !Number.isFinite(nextTime) && Number.isFinite(bgmSeekLastClientX)
                ? getTimeFromSeekPointer({ clientX: bgmSeekLastClientX })
                : null;
            const finalTime = Number.isFinite(nextTime) ? nextTime : fallbackTime;
            if (!Number.isFinite(finalTime)) return;

            // Treat pointer release as the single source of truth for the seek commit.
            // Some browsers fire a trailing `change` event with a stale/zero value,
            // which would otherwise overwrite the intended seek.
            const now = window.performance && typeof window.performance.now === 'function'
                ? window.performance.now()
                : Date.now();
            bgmSeekIgnoreSliderCommitUntil = now + 200;

            // When the slider's value fails to update (e.g. max was 0 at interaction start),
            // fall back to pointer position.
            applyBgmSeekToTime(finalTime, { source: 'pointer' });
        };

        bgmSeekSlider.addEventListener('pointerdown', beginBgmSeekDrag);
        bgmSeekSlider.addEventListener('pointerup', (event) => {
            // Commit seek on pointer release as a fallback for cases where the range input
            // value fails to update (e.g. max=0 during early interaction).
            applyBgmSeekFromPointerCommit(event);
            endBgmSeekDrag(event);
        });
        bgmSeekSlider.addEventListener('pointercancel', endBgmSeekDrag);
        bgmSeekSlider.addEventListener('mousedown', beginBgmSeekDrag);
        bgmSeekSlider.addEventListener('mouseup', (event) => {
            applyBgmSeekFromPointerCommit(event);
            endBgmSeekDrag(event);
        });
        bgmSeekSlider.addEventListener('touchstart', beginBgmSeekDrag, { passive: true });
        bgmSeekSlider.addEventListener('touchend', (event) => {
            applyBgmSeekFromPointerCommit(event);
            endBgmSeekDrag(event);
        }, { passive: true });
        bgmSeekSlider.addEventListener('touchcancel', endBgmSeekDrag, { passive: true });

        bgmSeekSlider.addEventListener('input', (event) => {
            applyBgmSeekFromSlider(event);
        });

        bgmSeekSlider.addEventListener('change', (event) => {
            // Do not treat `change` as a seek commit. Pointer release already commits
            // the intended seek, and `change` can carry a stale/zero value in some browsers.
            logSeekSliderState('seek slider change (ignored for commit)', event);
            endBgmSeekDrag(event);
        });

        bgmSeekSlider.addEventListener('blur', (event) => {
            // Navigation / focus changes can trigger blur. Do not treat blur as a seek commit,
            // otherwise the slider can snap to 0 during SPA view switches.
            endBgmSeekDrag(event);
        });

        bgmTrackListEl.addEventListener('click', (event) => {
            if (!(event.target instanceof Element)) return;
            const targetButton = event.target.closest('.bgm-track-btn');
            if (!targetButton) return;
            const targetIndex = Number(targetButton.dataset.index);
            if (!Number.isFinite(targetIndex)) return;
            setBgmTrack(targetIndex, { autoplay: bgmEnabled, resetTime: true });
        });

        window.addEventListener('scroll', handleBgmDockScroll, { passive: true });
        window.addEventListener('resize', () => {
            const isMobile = isBgmMobileViewport();
            if (isMobile && !bgmWasMobileViewport) {
                bgmMinimizedMobile = true;
                localStorage.setItem(BGM_MINIMIZED_MOBILE_KEY, '1');
            }
            bgmWasMobileViewport = isMobile;
            setBgmCollapseUi();
            queueBgmMarqueeState();
        });
        bgmCurrentTrackEl.addEventListener('mouseenter', () => {
            bgmCurrentTrackHovering = true;
            queueBgmMarqueeState();
        });
        bgmCurrentTrackEl.addEventListener('mouseleave', () => {
            bgmCurrentTrackHovering = false;
            queueBgmMarqueeState();
        });
        window.setTimeout(queueBgmMarqueeState, 120);

        window.addEventListener('aa:navigate', (event) => {
            if (!bgmAudioEl) return;
            // Navigation inside the SPA should not reset BGM state.
            // Ensure UI reflects the *actual* element state after view transitions.
            debugLog('aa:navigate', event && event.detail ? event.detail : {});

            // If a seek drag was in progress, navigation can steal focus/pointer events.
            // Reset transient UI state to avoid desync (slider stuck/pending seek).
            bgmSeekDragging = false;
            bgmPendingSeekTime = null;
            stopBgmSeekRetry();

            setBgmTimeUi({ force: true });
            setBgmPlayPauseUi();
            setBgmStatus(getBgmStatusText());
        });

        if (bgmEnabled && !BGM_TRACKS.length) {
            setBgmStatus('\uC0AC\uC6A9 \uAC00\uB2A5\uD55C \uD2B8\uB799\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.');
            setBgmPlayPauseUi();
        } else if (bgmEnabled) {
            bgmAudioEl.pause();
            removeBgmUnlockListeners();
            setBgmStatus(getBgmStatusText());
            setBgmPlayPauseUi();
        } else {
            setBgmStatus(getBgmStatusText());
            setBgmPlayPauseUi();
        }

        debugLog('initBgmControls end', {
            enabled: bgmEnabled,
            library: bgmLibrary,
            trackIndex: bgmTrackIndex,
            src: bgmAudioEl ? bgmAudioEl.getAttribute('src') : null,
            currentTime: bgmAudioEl && Number.isFinite(bgmAudioEl.currentTime) ? bgmAudioEl.currentTime : null,
            duration: bgmAudioEl && Number.isFinite(bgmAudioEl.duration) ? bgmAudioEl.duration : null
        });
    };

    document.addEventListener('DOMContentLoaded', () => {
        window.addEventListener('beforeunload', (e) => {
            if (window.isWriting) {
                e.preventDefault();
                e.returnValue = '';
            }
        });

        if(typeof configureMarked === 'function') configureMarked();
        
        if(typeof setupPasteHandlers === 'function') {
            setupPasteHandlers(
                (file) => processPostImage(file, currentEditorMode),
                (files) => processCommentImages(files, currentCommentImages, renderCommentImagePreview)
            );
        }
        
        document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
        const loader = document.getElementById('global-loader');
        if(loader) loader.classList.remove('hidden');
        void loadAllAudioTracksFromManifest().finally(() => {
            initBgmControls();
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('#btn-search-type-desktop') && !e.target.closest('#btn-search-type-mobile')) {
                 document.querySelectorAll('[id^="menu-search-type-"]').forEach(el => el.classList.add('hidden'));
            }
            if (!e.target.closest('#btn-font-size')) {
                const menu = document.getElementById('menu-font-size');
                if(menu && !menu.classList.contains('hidden')) {
                    menu.classList.add('hidden');
                }
            }
        });

        if(typeof initSupabase === 'function') {
            initSupabase((event, session) => {
                if (session) {
                    isAdmin = true;
                    if(typeof updateAdminUI === 'function') updateAdminUI(isAdmin, loadSavedNickname);
                    if(typeof updateAdminStats === 'function') updateAdminStats();
                } else {
                    isAdmin = false;
                    if(typeof updateAdminUI === 'function') updateAdminUI(isAdmin, loadSavedNickname);
                }
            });
        }

        if(typeof fetchClientIP === 'function') fetchClientIP();
        if(typeof fetchVersion === 'function') {
            fetchVersion().then(v => {
                const vText = document.getElementById('version-text');
                if (v && vText) vText.innerText = "최신버전  " + v;
            });
        }

        const lbImg = document.getElementById('lightbox-img');
        if(lbImg) {
            lbImg.style.cursor = 'zoom-in';
            lbImg.style.transition = 'transform 0.3s ease';
            let isZoomed = false;
            
            lbImg.onclick = (e) => {
                e.stopPropagation();
                isZoomed = !isZoomed;
                if(isZoomed) {
                    lbImg.style.transform = 'scale(2)';
                    lbImg.style.cursor = 'zoom-out';
                } else {
                    lbImg.style.transform = 'scale(1)';
                    lbImg.style.cursor = 'zoom-in';
                }
            };

            const originalClose = window.closeLightbox;
            window.closeLightbox = function() {
                lbImg.style.transform = 'scale(1)';
                isZoomed = false;
                lbImg.style.cursor = 'zoom-in';
                if(originalClose) originalClose();
                else {
                    const lb = document.getElementById('lightbox');
                    if(lb) {
                        lb.classList.add('hidden');
                        lb.classList.remove('flex');
                    }
                }
            }
        }
    });

    window.onload = () => { 
        const loader = document.getElementById('global-loader');
        if(loader) loader.classList.remove('hidden');

        if(typeof loadLocalPostsData === 'function') loadLocalPostsData(); 
        
        const rawHash = window.location.hash;
        const initialHash = rawHash.startsWith('#') ? decodeURIComponent(rawHash.substring(1)) : '';
        const hashParts = initialHash.split('/');
        const pageCode = hashParts[0];
        const paramId = hashParts[1];

        const realPage = (typeof getPageFromCode === 'function') ? getPageFromCode(pageCode) : 'home'; 
        
        if (realPage === 'write') {
            window.router('write', false);
            if(loader) setTimeout(() => loader.classList.add('hidden'), 300);
            
            if (typeof loadTempPost === 'function') {
                setTimeout(loadTempPost, 100);
            }
        }
        else if (realPage === 'detail') { 
            let targetId = paramId;
            if (!targetId) {
                targetId = localStorage.getItem('aa_current_post_id');
            }

            if (targetId) {
                readPost(targetId).then(() => {
                    if(loader) setTimeout(() => loader.classList.add('hidden'), 300);
                }).catch(() => {
                    window.router('home', false);
                    if(loader) setTimeout(() => loader.classList.add('hidden'), 300);
                });
            } else {
                window.router('home', false);
                if(loader) setTimeout(() => loader.classList.add('hidden'), 300);
            }
        } else {
            window.router(realPage, false);
            if(loader) setTimeout(() => loader.classList.add('hidden'), 300);
        }
        
        if(typeof recordVisit === 'function') recordVisit(); 
    };

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace') {
            const tag = e.target.tagName;
            const isEditable = e.target.isContentEditable;
            if (tag !== 'INPUT' && tag !== 'TEXTAREA' && !isEditable) {
                e.preventDefault();
                window.confirmNavigation('back');
            }
        }
    });

    window.searchBoard = function() {
        fetchPosts(currentBoardType, 1);
    };

    window.readPost = readPost;
    window.changePage = (p) => fetchPosts(currentBoardType, p);
    window.toggleViewMode = (mode) => { errorViewMode = mode; renderBoard(); };
    window.goDownload = () => window.open('https://github.com/Pretsg/Archeage_auto/releases', '_blank');

    window.toggleSearchDropdown = (type) => {
        const id = `menu-search-type-${type}`;
        const menu = document.getElementById(id);
        if (menu) menu.classList.toggle('hidden');
        
        ['desktop', 'mobile'].forEach(t => {
            if(t !== type) {
                const other = document.getElementById(`menu-search-type-${t}`);
                if(other) other.classList.add('hidden');
            }
        });
    };

    window.selectSearchType = (val, label) => {
        const s1 = document.getElementById('searchTypeSelect');
        const s2 = document.getElementById('mobileSearchTypeSelect');
        if(s1) s1.value = val;
        if(s2) s2.value = val;
        
        const t1 = document.getElementById('txt-search-type-desktop');
        const t2 = document.getElementById('txt-search-type-mobile');
        if(t1) t1.innerText = label;
        if(t2) t2.innerText = label;
        
        document.querySelectorAll('[id^="menu-search-type-"]').forEach(el => el.classList.add('hidden'));
    };

    window.searchGlobal = (val) => {
        let keyword = val;
        if(!keyword) {
            const input1 = document.getElementById('globalSearchInput');
            const input2 = document.getElementById('mobileSearchInput');
            keyword = (input1 ? input1.value.trim() : '') || (input2 ? input2.value.trim() : '');
        }
        
        if(!keyword || keyword.length < 2) return showAlert("寃?됱뼱??2湲???댁긽 ?낅젰?댁＜?몄슂.");

        const mBtn = document.getElementById('btn-search-type-mobile');
        let searchType = 'all';
        if(mBtn && window.getComputedStyle(mBtn).display !== 'none' && mBtn.offsetParent !== null) {
            searchType = document.getElementById('mobileSearchTypeSelect').value;
        } else {
            searchType = document.getElementById('searchTypeSelect').value;
        }

        const i1 = document.getElementById('globalSearchInput');
        const i2 = document.getElementById('mobileSearchInput');
        if(i1) i1.value = keyword;
        if(i2) i2.value = keyword;

        performSearch(keyword, searchType);
    };

    window.requestPasswordCheck = function(targetId, actionType) {
        let target = null;
        if(actionType.includes('post')) {
            target = posts.find(p => p.id == targetId);
        } else {
            const currentPost = posts.find(p => p.id == currentPostId);
            target = currentPost.comments.find(c => c.id == targetId || c.created_at == targetId); 
        }

        if (!target) return showAlert("??ぉ??李얠쓣 ???놁뒿?덈떎.");
        if(isAdmin) { executeAction(actionType, targetId, target); return; }
        if(target.author === '???' || target.author === 'Admin') return showAlert("????????????? ??????? ????????? ???????");

        pendingActionType = actionType;
        pendingTargetId = targetId;
        pendingTarget = target; 
        document.getElementById('verificationPw').value = '';
        document.getElementById('passwordModal').classList.remove('hidden');
        document.getElementById('verificationPw').focus();
    }

    window.confirmPasswordAction = async function() {
        const inputPw = document.getElementById('verificationPw').value.trim();
        if(!inputPw) return showAlert("鍮꾨?踰덊샇 ?낅젰 ?꾩슂");
        if (!pendingTarget) return closePasswordModal();
        
        const dbClient = getDbClient();
        if (!dbClient) return showAlert("?ㅽ봽?쇱씤 ?곹깭?먯꽌???뺤씤?????놁뒿?덈떎.");

        const hashedInput = await sha256(inputPw);
        
        let isValid = false;
        
        try {
            if (pendingActionType.includes('post')) {
                const { data, error } = await dbClient.rpc('check_post_pw', { 
                    post_id: pendingTargetId, 
                    input_hash: hashedInput 
                });
                
                if (error) {
                    console.error("Password check error:", error);
                    if(error.code === '42883') return showAlert("DB ?⑥닔 ?ㅻ쪟: 愿由ъ옄?먭쾶 臾몄쓽?섏꽭??");
                    else return showAlert("?ㅻ쪟 諛쒖깮: " + error.message);
                }
                
                if (data === true) isValid = true;
            } else {
                const { data, error } = await dbClient.rpc('check_comment_pw', { 
                    comment_id: pendingTargetId, 
                    input_hash: hashedInput 
                });
                
                if (error) {
                    console.error("Password check error:", error);
                     if(error.code === '42883') return showAlert("DB ?⑥닔 ?ㅻ쪟: 愿由ъ옄?먭쾶 臾몄쓽?섏꽭??");
                     else return showAlert("?ㅻ쪟 諛쒖깮: " + error.message);
                }

                if (data === true) isValid = true;
            }
        } catch (e) {
            console.error("System error:", e);
            return showAlert("?쒖뒪???ㅻ쪟 諛쒖깮");
        }

        if(isValid) {
            const a = pendingActionType;
            const i = pendingTargetId;
            const t = pendingTarget;
            document.getElementById('passwordModal').classList.add('hidden');
            pendingActionType = null;
            setTimeout(() => executeAction(a, i, t), 300);
        } else {
            showAlert("Verification failed.");
            document.getElementById('verificationPw').value = '';
        }
    }

    window.closePasswordModal = () => document.getElementById('passwordModal').classList.add('hidden');
    window.closeConfirm = closeConfirm;
    window.closeAlert = closeAlert;

    function executeAction(type, id, targetObj) {
        if(type === 'delete_post') showConfirm("??젣?섏떆寃좎뒿?덇퉴?", () => deletePost(id), "??젣", "??젣?섍린");
        else if(type === 'edit_post') goEditMode(targetObj);
        else if(type === 'delete_comment') showConfirm("??젣?섏떆寃좎뒿?덇퉴?", () => deleteComment(id), "??젣", "??젣?섍린");
        else if(type === 'edit_comment') loadCommentForEdit(targetObj);
    }
}










