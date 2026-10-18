/**
 * Homepage-specific logic: timeline filters, reading lamp, and hero conduit animation.
 */
(function () {
    'use strict';

    const LAMP_STORAGE_KEY = 'reading_lamp_lit';

    function getStorage(key, fallback) {
        try {
            const val = localStorage.getItem(key);
            return val !== null ? val : fallback;
        } catch (e) {
            return fallback;
        }
    }

    function setStorage(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (e) {}
    }

    function isReducedMotion() {
        return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    /* -------------------------------------------------------------
     * 1. Timeline Filtering
     * ------------------------------------------------------------- */
    function initTimeline() {
        const timelineSection = document.getElementById('timeline');
        if (!timelineSection) return;

        const filterButtons = Array.from(timelineSection.querySelectorAll('.filter-chip'));
        const timelineEvents = Array.from(timelineSection.querySelectorAll('.timeline-event'));

        function updateTimelineBoundaries() {
            timelineEvents.forEach(function (eventNode) {
                eventNode.classList.remove('first-visible', 'last-visible');
            });
            const visible = timelineEvents.filter(function (eventNode) {
                return !eventNode.classList.contains('is-hidden');
            });
            if (visible.length > 0) {
                visible[0].classList.add('first-visible');
                visible[visible.length - 1].classList.add('last-visible');
            }
        }

        function setFilter(filterType) {
            timelineEvents.forEach(function (eventNode) {
                const show = filterType === 'all' || eventNode.dataset.type === filterType;
                eventNode.classList.toggle('is-hidden', !show);
            });
            filterButtons.forEach(function (btn) {
                const isActive = btn.dataset.filter === filterType;
                btn.classList.toggle('is-active', isActive);
                btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            });
            updateTimelineBoundaries();
        }

        function updateFilterCounts() {
            const counts = { all: timelineEvents.length, work: 0, study: 0 };
            timelineEvents.forEach(function (eventNode) {
                if (eventNode.dataset.type === 'study') {
                    counts.study += 1;
                } else {
                    counts.work += 1;
                }
            });
            const allCount = timelineSection.querySelector('[data-count-for="all"]');
            const workCount = timelineSection.querySelector('[data-count-for="work"]');
            const studyCount = timelineSection.querySelector('[data-count-for="study"]');
            if (allCount) allCount.textContent = String(counts.all);
            if (workCount) workCount.textContent = String(counts.work);
            if (studyCount) studyCount.textContent = String(counts.study);
        }

        updateFilterCounts();
        setFilter('all');

        filterButtons.forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                setFilter(btn.dataset.filter || 'all');
            });
        });
    }

    /* -------------------------------------------------------------
     * 2. Reading Lamp Controller (Lazy AudioContext & Resource Release)
     * ------------------------------------------------------------- */
    function initLamp() {
        const writingSection = document.getElementById('writing');
        const lampBtn = document.getElementById('reading-lamp-btn');
        const lampPullChain = document.getElementById('lamp-pull-chain');
        const nightTooltip = document.getElementById('lamp-night-tooltip');
        const nightSwitchBtn = document.getElementById('lamp-night-switch-btn');

        if (!writingSection || !lampBtn) return;

        let audioCtx = null;
        let nightTooltipTimeout = null;
        let lampPullTimeout = null;

        function getAudioContext() {
            if (!audioCtx) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (AudioCtx) {
                    audioCtx = new AudioCtx();
                }
            }
            if (audioCtx && audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
            return audioCtx;
        }

        function showNightTooltip() {
            if (!nightTooltip) return;
            clearTimeout(nightTooltipTimeout);
            nightTooltip.classList.add('is-visible');
            nightTooltipTimeout = setTimeout(function () {
                hideNightTooltip();
            }, 3200);
        }

        function hideNightTooltip() {
            if (!nightTooltip) return;
            clearTimeout(nightTooltipTimeout);
            nightTooltip.classList.remove('is-visible');
        }

        function playSwitchSound(isOn) {
            try {
                const ctx = getAudioContext();
                if (!ctx) return;
                const now = ctx.currentTime;

                // Crisp mechanical click impulse
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = isOn ? 'triangle' : 'sine';
                osc.frequency.setValueAtTime(isOn ? 1400 : 900, now);
                osc.frequency.exponentialRampToValueAtTime(140, now + 0.024);

                gain.gain.setValueAtTime(0.12, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.024);

                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.onended = function () {
                    try {
                        osc.disconnect();
                        gain.disconnect();
                    } catch (e) {}
                };
                osc.start(now);
                osc.stop(now + 0.024);

                // Rebound spring click
                const osc2 = ctx.createOscillator();
                const gain2 = ctx.createGain();
                osc2.type = 'sine';
                osc2.frequency.setValueAtTime(isOn ? 750 : 500, now + 0.032);
                osc2.frequency.exponentialRampToValueAtTime(90, now + 0.055);

                gain2.gain.setValueAtTime(0.05, now + 0.032);
                gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

                osc2.connect(gain2);
                gain2.connect(ctx.destination);
                osc2.onended = function () {
                    try {
                        osc2.disconnect();
                        gain2.disconnect();
                    } catch (e) {}
                };
                osc2.start(now + 0.032);
                osc2.stop(now + 0.055);
            } catch (e) {
                // AudioContext unavailable or blocked by autoplay policy, silent fallback
            }
        }

        function setLampState(isLit, playSound) {
            const isLight = document.documentElement.classList.contains('light');
            // Reading light strictly works only in dark mode (at night)
            if (isLit && isLight) {
                isLit = false;
            }
            writingSection.classList.toggle('is-lit', isLit);
            lampBtn.setAttribute('aria-checked', isLit ? 'true' : 'false');
            lampBtn.setAttribute('title', isLit ? 'Pull cord to turn off reading lamp' : 'Pull cord to turn on reading lamp');
            setStorage(LAMP_STORAGE_KEY, isLit ? '1' : '0');
            if (playSound) {
                playSwitchSound(isLit);
            }
        }

        function triggerLampPull() {
            if (!writingSection) return;

            if (lampPullChain && !isReducedMotion()) {
                lampPullChain.classList.remove('is-pulling');
                requestAnimationFrame(function () {
                    lampPullChain.classList.add('is-pulling');
                });
                clearTimeout(lampPullTimeout);
                lampPullTimeout = setTimeout(function () {
                    lampPullChain.classList.remove('is-pulling');
                }, 550);
            }

            // If currently in light mode, notify user it only works in dark mode
            if (document.documentElement.classList.contains('light')) {
                playSwitchSound(false);
                showNightTooltip();
                return;
            }

            hideNightTooltip();
            const isLit = !writingSection.classList.contains('is-lit');
            setLampState(isLit, true);
        }

        // Restore initial lamp state
        const savedLamp = getStorage(LAMP_STORAGE_KEY, '0');
        if (savedLamp === '1' && !document.documentElement.classList.contains('light')) {
            setLampState(true, false);
        }

        lampBtn.addEventListener('click', function (e) {
            e.preventDefault();
            triggerLampPull();
        });

        lampBtn.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                triggerLampPull();
            }
        });

        if (nightSwitchBtn) {
            nightSwitchBtn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                hideNightTooltip();
                const themeBtn = document.getElementById('theme-toggle');
                if (themeBtn && document.documentElement.classList.contains('light')) {
                    themeBtn.click();
                }
                setTimeout(function () {
                    setLampState(true, true);
                }, 100);
            });
        }

        document.addEventListener('click', function (e) {
            if (nightTooltip && nightTooltip.classList.contains('is-visible')) {
                if (!e.target.closest('.writing-lamp-fixture')) {
                    hideNightTooltip();
                }
            }
        });

        // Automatically turn off lamp if user switches to light theme
        window.addEventListener('themechange', function (e) {
            if (e.detail && e.detail.isLight) {
                setLampState(false, false);
            }
        });
    }

    /* -------------------------------------------------------------
     * 3. Hero Conduit Animation (Optimized Scheduling, Geometry & Rendering)
     * ------------------------------------------------------------- */
    function initHeroConduit() {
        const hero = document.getElementById('top');
        const track = document.getElementById('conduit-track');
        const node = document.getElementById('conduit-node');
        const ballGroup = document.getElementById('conduit-ball-group');
        const ball = document.getElementById('conduit-ball');
        const ballGlow = document.getElementById('conduit-ball-glow');
        const splashGroup = document.getElementById('conduit-splash-group');
        const card = document.getElementById('now-card') || document.querySelector('.now-card');
        const dot = document.querySelector('.conduit-dot-anchor');
        const ai = document.querySelector('.conduit-ai-anchor');
        const aiI = document.querySelector('.conduit-ai-i');
        const btnCv = document.getElementById('btn-open-cv') || document.querySelector('.hero-actions .btn-primary');

        if (!hero || !track || !dot || !ai || !ballGroup || !ball) return;

        let trackLen = 0;
        let impactPoint = { x: 0, y: 0 };
        let aiEnterRatio = 0.40;
        let animFrameId = null;
        let cycleStartTime = null;
        let hasImpactedThisCycle = false;
        let currentPhase = null; // 'pre-ai' | 'in-ai' | 'post-ai' | 'splash'
        let lastThemeIsLight = null;

        // Condition tracking
        let isPageVisible = document.visibilityState === 'visible';
        let isHeroIntersecting = false;
        let isMotionReduced = isReducedMotion();

        const CYCLE_DURATION = 4370; // ms per complete data cycle
        const TRAVEL_RATIO = 0.72; // 72% travel along path, 28% splash and recharge

        function canAnimate() {
            return isPageVisible && isHeroIntersecting && !isMotionReduced;
        }

        function clearImpact() {
            if (card) card.classList.remove('conduit-impacted');
            if (btnCv) btnCv.classList.remove('conduit-impacted');
        }

        function updateAnimationState() {
            if (canAnimate()) {
                if (!animFrameId && trackLen > 0) {
                    animFrameId = requestAnimationFrame(frame);
                }
            } else {
                if (animFrameId) {
                    cancelAnimationFrame(animFrameId);
                    animFrameId = null;
                }
                clearImpact();
                if (ai) ai.classList.remove('conduit-ai-active');
                if (ballGroup) ballGroup.style.display = 'none';
                currentPhase = null;
            }
        }

        function updatePath() {
            const hRect = hero.getBoundingClientRect();
            const dRect = dot.getBoundingClientRect();
            const aRect = ai.getBoundingClientRect();
            const cRect = card ? card.getBoundingClientRect() : null;
            const iRect = aiI ? aiI.getBoundingClientRect() : null;
            const bRect = btnCv ? btnCv.getBoundingClientRect() : null;

            if (hRect.width === 0 || dRect.width === 0) return false;

            const isMobile = window.innerWidth <= 980;
            const r = 8;
            const xStart = Math.round(dRect.right - hRect.left);
            const yStart = Math.round(dRect.top + dRect.height / 2 - hRect.top);

            const xDropThroughI = iRect
                ? Math.round(iRect.left + iRect.width / 2 - hRect.left)
                : Math.round(aRect.left - hRect.left + 36);

            let xRightTurn, yMidTrace, yBottomTrace, pathD;

            if (isMobile && bRect) {
                xRightTurn = Math.min(Math.round(hRect.width - 16), Math.max(Math.round(xStart + 36), Math.round(aRect.right - hRect.left - 10)));
                yMidTrace = Math.round(aRect.top - hRect.top + 2);
                yBottomTrace = Math.round(aRect.bottom - hRect.top + 12);
                const xTurnDownToBtn = Math.min(
                    Math.round(hRect.width - 24),
                    Math.max(
                        Math.round(xDropThroughI + 24),
                        Math.min(
                            Math.round(bRect.right - hRect.left - 24),
                            Math.round(aRect.right - hRect.left - 4)
                        )
                    )
                );
                const yBtnTop = Math.round(bRect.top - hRect.top);

                pathD = [
                    'M ' + xStart + ' ' + yStart,
                    'H ' + (xRightTurn - r),
                    'A ' + r + ' ' + r + ' 0 0 1 ' + xRightTurn + ' ' + (yStart + r),
                    'V ' + (yMidTrace - r),
                    'A ' + r + ' ' + r + ' 0 0 1 ' + (xRightTurn - r) + ' ' + yMidTrace,
                    'H ' + (xDropThroughI + r),
                    'A ' + r + ' ' + r + ' 0 0 0 ' + xDropThroughI + ' ' + (yMidTrace + r),
                    'V ' + (yBottomTrace - r),
                    'A ' + r + ' ' + r + ' 0 0 0 ' + (xDropThroughI + r) + ' ' + yBottomTrace,
                    'H ' + (xTurnDownToBtn - r),
                    'A ' + r + ' ' + r + ' 0 0 1 ' + xTurnDownToBtn + ' ' + (yBottomTrace + r),
                    'V ' + yBtnTop
                ].join(' ');

                impactPoint = { x: xTurnDownToBtn, y: yBtnTop };
            } else {
                xRightTurn = Math.max(Math.round(xStart + 32), xDropThroughI + 28);
                yMidTrace = Math.round(aRect.top - hRect.top + 2);
                yBottomTrace = Math.round(aRect.bottom - hRect.top + 14);
                const xCard = cRect ? Math.round(cRect.left - hRect.left) : Math.round(hRect.width - 20);

                pathD = [
                    'M ' + xStart + ' ' + yStart,
                    'H ' + (xRightTurn - r),
                    'A ' + r + ' ' + r + ' 0 0 1 ' + xRightTurn + ' ' + (yStart + r),
                    'V ' + (yMidTrace - r),
                    'A ' + r + ' ' + r + ' 0 0 1 ' + (xRightTurn - r) + ' ' + yMidTrace,
                    'H ' + (xDropThroughI + r),
                    'A ' + r + ' ' + r + ' 0 0 0 ' + xDropThroughI + ' ' + (yMidTrace + r),
                    'V ' + (yBottomTrace - r),
                    'A ' + r + ' ' + r + ' 0 0 0 ' + (xDropThroughI + r) + ' ' + yBottomTrace,
                    'H ' + xCard
                ].join(' ');

                impactPoint = { x: xCard, y: yBottomTrace };
            }

            track.setAttribute('d', pathD);
            if (node) {
                node.setAttribute('cx', xStart);
                node.setAttribute('cy', yStart);
            }

            trackLen = track.getTotalLength();

            // Closed-form calculation of length to drop through 'I' from known geometry
            if (trackLen > 0) {
                const arcLength = 0.5 * Math.PI * r;
                const dropLen = (xRightTurn - r - xStart)
                              + arcLength
                              + (yMidTrace - r - (yStart + r))
                              + arcLength
                              + ((xRightTurn - r) - (xDropThroughI + r))
                              + arcLength;
                aiEnterRatio = Math.max(0.1, Math.min(0.9, dropLen / trackLen));
            }

            updateAnimationState();
            return true;
        }

        function triggerSplash() {
            if (splashGroup) {
                splashGroup.setAttribute('transform', 'translate(' + impactPoint.x + ', ' + impactPoint.y + ')');
                const ripples = splashGroup.querySelectorAll('.conduit-ripple');
                ripples.forEach(function (r) {
                    const anims = typeof r.getAnimations === 'function' ? r.getAnimations() : [];
                    if (anims.length > 0) {
                        anims.forEach(function (a) {
                            a.currentTime = 0;
                            a.play();
                        });
                    } else {
                        r.classList.remove('active');
                        requestAnimationFrame(function () {
                            r.classList.add('active');
                        });
                    }
                });

                const sparks = splashGroup.querySelectorAll('.conduit-spark');
                sparks.forEach(function (s) {
                    const anims = typeof s.getAnimations === 'function' ? s.getAnimations() : [];
                    if (anims.length > 0) {
                        anims.forEach(function (a) {
                            a.currentTime = 0;
                            a.play();
                        });
                    } else {
                        s.classList.remove('active');
                        requestAnimationFrame(function () {
                            s.classList.add('active');
                        });
                    }
                });
            }

            const isMobile = window.innerWidth <= 980;
            const impactTarget = isMobile ? btnCv : card;
            if (impactTarget) {
                impactTarget.classList.add('conduit-impacted');
            }
        }

        function frame(timestamp) {
            if (!canAnimate() || trackLen === 0) {
                animFrameId = null;
                updateAnimationState();
                return;
            }

            if (!cycleStartTime) cycleStartTime = timestamp;
            const elapsed = (timestamp - cycleStartTime) % CYCLE_DURATION;
            const progress = elapsed / CYCLE_DURATION;
            const isLight = document.documentElement.classList.contains('light');

            if (progress <= TRAVEL_RATIO) {
                hasImpactedThisCycle = false;
                const pathP = progress / TRAVEL_RATIO;
                const pt = track.getPointAtLength(pathP * trackLen);

                ballGroup.style.display = 'block';
                ballGroup.setAttribute('transform', 'translate(' + pt.x + ', ' + pt.y + ')');

                let nextPhase;
                if (pathP < aiEnterRatio) {
                    nextPhase = 'pre-ai';
                } else if (pathP < 0.98) {
                    nextPhase = 'in-ai';
                } else {
                    nextPhase = 'post-ai';
                }

                // Only touch DOM attributes and classes when entering a new phase or theme changed
                if (nextPhase !== currentPhase || isLight !== lastThemeIsLight) {
                    currentPhase = nextPhase;
                    lastThemeIsLight = isLight;

                    const redColor = isLight ? '#dc2626' : '#ef4444';
                    const blueColor = isLight ? '#2563eb' : '#3b82f6';

                    if (nextPhase === 'pre-ai') {
                        ball.setAttribute('fill', redColor);
                        ballGlow.setAttribute('fill', redColor);
                        ai.classList.remove('conduit-ai-active');
                        clearImpact();
                    } else if (nextPhase === 'in-ai') {
                        ball.setAttribute('fill', blueColor);
                        ballGlow.setAttribute('fill', blueColor);
                        ai.classList.add('conduit-ai-active');
                        clearImpact();
                    } else {
                        ai.classList.remove('conduit-ai-active');
                    }
                }
            } else {
                if (currentPhase !== 'splash') {
                    currentPhase = 'splash';
                    ballGroup.style.display = 'none';
                    ai.classList.remove('conduit-ai-active');
                }

                if (!hasImpactedThisCycle) {
                    hasImpactedThisCycle = true;
                    triggerSplash();
                }

                if (progress > 0.88) {
                    clearImpact();
                }
            }

            animFrameId = requestAnimationFrame(frame);
        }

        // Coalesce resize measurements into one scheduled frame
        let resizeScheduled = false;
        function scheduleUpdatePath() {
            if (!resizeScheduled) {
                resizeScheduled = true;
                requestAnimationFrame(function () {
                    resizeScheduled = false;
                    updatePath();
                });
            }
        }

        window.addEventListener('resize', scheduleUpdatePath, { passive: true });
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(scheduleUpdatePath);
        }

        // Intersection observer: only animate when hero is in viewport
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (entry.target === hero) {
                        isHeroIntersecting = entry.isIntersecting;
                        updateAnimationState();
                    }
                });
            }, { threshold: 0.05 });
            observer.observe(hero);
        } else {
            isHeroIntersecting = true;
        }

        // Visibility listener: pause when tab hidden
        document.addEventListener('visibilitychange', function () {
            isPageVisible = document.visibilityState === 'visible';
            updateAnimationState();
        });

        // Motion preference listener: immediately pause or resume on preference change
        const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        function onMotionChange(e) {
            isMotionReduced = e.matches;
            updateAnimationState();
        }
        if (motionQuery.addEventListener) {
            motionQuery.addEventListener('change', onMotionChange);
        } else if (motionQuery.addListener) {
            motionQuery.addListener(onMotionChange);
        }

        // Theme change listener: update conduit colors immediately
        window.addEventListener('themechange', function () {
            lastThemeIsLight = null; // force color refresh on next tick
        });

        // Expose debug hooks for testing & runtime inspection
        window.__conduitDebug = {
            isAnimating: function () { return Boolean(animFrameId); },
            getCanAnimate: function () { return canAnimate(); },
            isPageVisible: function () { return isPageVisible; },
            isHeroIntersecting: function () { return isHeroIntersecting; },
            isMotionReduced: function () { return isMotionReduced; }
        };

        // Initial setup
        setTimeout(scheduleUpdatePath, 50);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            initTimeline();
            initLamp();
            initHeroConduit();
        });
    } else {
        initTimeline();
        initLamp();
        initHeroConduit();
    }
})();
