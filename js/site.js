/**
 * Shared site-wide scripts: theme controls, navigation, and motion handling.
 */
(function () {
    'use strict';

    const STORAGE_KEY = 'theme';

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

    function applyTheme(theme) {
        const isLight = theme === 'light';
        document.documentElement.classList.toggle('light', isLight);
        if (document.body) {
            document.body.classList.toggle('light', isLight);
        }
        const toggle = document.getElementById('theme-toggle');
        if (toggle) toggle.setAttribute('aria-pressed', String(isLight));
        const themeMeta = document.querySelectorAll('meta[name="theme-color"]');
        themeMeta.forEach(function (m) {
            m.setAttribute('content', isLight ? '#fafaf9' : '#171923');
        });
        window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: theme, isLight: isLight } }));
    }

    // Apply saved theme immediately
    const initialTheme = getStorage(STORAGE_KEY, 'dark');
    applyTheme(initialTheme);

    function initThemeToggle() {
        const themeToggleBtn = document.getElementById('theme-toggle');
        if (!themeToggleBtn) return;

        let themeAnimTimeout = null;

        themeToggleBtn.addEventListener('click', function (e) {
            e.preventDefault();
            const currentIsLight = document.documentElement.classList.contains('light');
            const nextTheme = currentIsLight ? 'dark' : 'light';

            if (!isReducedMotion()) {
                themeToggleBtn.classList.remove('anim-put-out-light', 'anim-take-light-in');
                requestAnimationFrame(function () {
                    themeToggleBtn.classList.add(currentIsLight ? 'anim-take-light-in' : 'anim-put-out-light');
                });

                clearTimeout(themeAnimTimeout);
                themeAnimTimeout = setTimeout(function () {
                    themeToggleBtn.classList.remove('anim-put-out-light', 'anim-take-light-in');
                }, 650);
            }

            setStorage(STORAGE_KEY, nextTheme);
            applyTheme(nextTheme);
        });
    }

    function initNavigation() {
        const menuToggleBtn = document.getElementById('menu-toggle');
        const navNode = document.querySelector('.nav');
        if (!menuToggleBtn || !navNode) return;

        menuToggleBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            const isOpen = navNode.classList.toggle('is-open');
            menuToggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });

        navNode.querySelectorAll('a').forEach(function (link) {
            link.addEventListener('click', function () {
                navNode.classList.remove('is-open');
                menuToggleBtn.setAttribute('aria-expanded', 'false');
            });
        });

        document.addEventListener('click', function (e) {
            if (navNode.classList.contains('is-open')) {
                if (!navNode.contains(e.target) && !menuToggleBtn.contains(e.target)) {
                    navNode.classList.remove('is-open');
                    menuToggleBtn.setAttribute('aria-expanded', 'false');
                }
            }
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && navNode.classList.contains('is-open')) {
                navNode.classList.remove('is-open');
                menuToggleBtn.setAttribute('aria-expanded', 'false');
                menuToggleBtn.focus();
            }
        });
    }

    function initProjectCardCars() {
        const cvCard = document.querySelector('.project-card-cv');
        if (!cvCard) return;

        if ('IntersectionObserver' in window) {
            const cvObserver = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    cvCard.classList.toggle('anim-paused', !entry.isIntersecting);
                });
            }, { threshold: 0.05 });
            cvObserver.observe(cvCard);
        }
    }

    function initScrollSpy() {
        const navLinks = Array.from(document.querySelectorAll('.nav a[href^="#"]'));
        if (navLinks.length === 0) return;

        const sectionIds = navLinks.map(function (link) {
            return link.getAttribute('href').slice(1);
        });
        const sections = sectionIds.map(function (id) {
            return document.getElementById(id);
        }).filter(Boolean);
        if (sections.length === 0) return;

        function updateActiveLink() {
            const scrollPos = window.scrollY + 140; // offset for locked header
            let currentSectionId = null;

            if (window.scrollY < 180) {
                // Near top / hero
                navLinks.forEach(function (link) {
                    link.classList.remove('active');
                    link.removeAttribute('aria-current');
                });
                return;
            }

            const atBottom = (window.innerHeight + window.scrollY) >= (document.documentElement.scrollHeight - 60);
            if (atBottom) {
                currentSectionId = sectionIds[sectionIds.length - 1];
            } else {
                for (let i = sections.length - 1; i >= 0; i--) {
                    const section = sections[i];
                    if (section.offsetTop <= scrollPos) {
                        currentSectionId = section.id;
                        break;
                    }
                }
            }

            navLinks.forEach(function (link) {
                const targetId = link.getAttribute('href').slice(1);
                const active = targetId === currentSectionId;
                link.classList.toggle('active', active);
                if (active) link.setAttribute('aria-current', 'location');
                else link.removeAttribute('aria-current');
            });
        }

        let scrollTimer = null;
        window.addEventListener('scroll', function () {
            if (!scrollTimer) {
                scrollTimer = requestAnimationFrame(function () {
                    scrollTimer = null;
                    updateActiveLink();
                });
            }
        }, { passive: true });

        updateActiveLink();
    }

    // Umami events. No-op when the tracker is blocked or not yet loaded.
    function track(name, data) {
        if (window.umami && typeof window.umami.track === 'function') window.umami.track(name, data);
    }

    function initAnalytics() {
        document.addEventListener('click', function (e) {
            const el = e.target.closest('a[href], button');
            if (!el) return;
            const area = el.closest('section[id], aside[class], header, footer');
            const section = area ? (area.id || area.className.split(' ')[0] || area.tagName.toLowerCase()) : 'page';

            if (el.matches('.filter-chip')) {
                track('filter-click', { filter: el.dataset.profile || el.dataset.filter || el.textContent.trim().slice(0, 40) });
            } else if (el.id === 'theme-toggle') {
                track('theme-toggle');
            } else if (el.tagName === 'A') {
                const href = el.getAttribute('href');
                if (href.startsWith('mailto:')) {
                    track('email-click', { section: section });
                } else if (/\.pdf($|[?#])/i.test(href)) {
                    track('cv-download', { section: section });
                } else if (el.hostname && el.hostname !== location.hostname) {
                    track('outbound-click', { url: el.href.split('?')[0].slice(0, 500), section: section });
                }
            }
        });

        document.addEventListener('submit', function (e) {
            if (e.target.closest('.newsletter')) track('newsletter-submit', { page: location.pathname });
        });

        const search = document.getElementById('article-search');
        if (search) {
            search.addEventListener('change', function () {
                const q = search.value.trim();
                if (q) track('blog-search', { query: q.slice(0, 100) });
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            initAnalytics();
            initThemeToggle();
            initNavigation();
            initProjectCardCars();
            initScrollSpy();
        });
    } else {
        initAnalytics();
        initThemeToggle();
        initNavigation();
        initProjectCardCars();
        initScrollSpy();
    }
})();
