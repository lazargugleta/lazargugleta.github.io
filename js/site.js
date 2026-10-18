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
                link.classList.toggle('active', targetId === currentSectionId);
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

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            initThemeToggle();
            initNavigation();
            initProjectCardCars();
            initScrollSpy();
        });
    } else {
        initThemeToggle();
        initNavigation();
        initProjectCardCars();
        initScrollSpy();
    }
})();
