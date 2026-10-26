/**
 * Automated end-to-end browser test using Headless Chrome & Chrome DevTools Protocol.
 * Validates console errors, desktop/mobile viewports, theme switching, first-paint flash prevention,
 * lamp interaction with AudioContext reuse/cleanup, physical car translation & offscreen freeze,
 * hero conduit scheduling (tab visibility, offscreen guard, duplicate loop prevention),
 * reduced motion coverage, and multi-page integrity.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const PORT = 8089;
const CHROME_PORT = 9223;
const ROOT = path.resolve(__dirname, '..');

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.pdf': 'application/pdf',
    '.webmanifest': 'application/manifest+json'
};

// 1. Static HTTP Server
function createServer() {
    return http.createServer((req, res) => {
        let reqPath = req.url.split('?')[0].split('#')[0];
        if (reqPath === '/') reqPath = '/index.html';
        const filePath = path.join(ROOT, reqPath);

        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath).toLowerCase();
            res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
            fs.createReadStream(filePath).pipe(res);
        } else {
            res.writeHead(404);
            res.end('Not Found');
        }
    });
}

// 2. Cross-platform Chrome Path Resolver
function getChromePath() {
    if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
    if (process.platform === 'win32') {
        const standardWinPath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
        const win32Path = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
        const localAppData = process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe') : '';
        if (fs.existsSync(standardWinPath)) return standardWinPath;
        if (fs.existsSync(win32Path)) return win32Path;
        if (localAppData && fs.existsSync(localAppData)) return localAppData;
        return standardWinPath;
    } else if (process.platform === 'darwin') {
        return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    } else {
        const linuxCandidates = [
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable',
            '/usr/bin/chromium-browser',
            '/usr/bin/chromium'
        ];
        for (const p of linuxCandidates) {
            if (fs.existsSync(p)) return p;
        }
        return '/usr/bin/google-chrome';
    }
}

// 3. CDP Client Helper
class CDPClient {
    constructor(wsUrl) {
        this.wsUrl = wsUrl;
        this.msgId = 1;
        this.callbacks = new Map();
        this.eventListeners = new Map();
    }

    connect() {
        return new Promise((resolve, reject) => {
            const WebSocketImpl = globalThis.WebSocket || (typeof WebSocket !== 'undefined' ? WebSocket : null);
            if (!WebSocketImpl) {
                return reject(new Error('WebSocket is not available in this Node runtime. Run with Node 22+ or --experimental-websocket.'));
            }
            this.ws = new WebSocketImpl(this.wsUrl);
            this.ws.onopen = () => resolve();
            this.ws.onerror = (err) => reject(err);
            this.ws.onmessage = (event) => {
                const msg = JSON.parse(event.data);
                if (msg.id && this.callbacks.has(msg.id)) {
                    const cb = this.callbacks.get(msg.id);
                    this.callbacks.delete(msg.id);
                    if (msg.error) cb.reject(new Error(msg.error.message));
                    else cb.resolve(msg.result);
                } else if (msg.method) {
                    const listeners = this.eventListeners.get(msg.method) || [];
                    listeners.forEach(fn => fn(msg.params));
                }
            };
        });
    }

    send(method, params = {}) {
        return new Promise((resolve, reject) => {
            const id = this.msgId++;
            this.callbacks.set(id, { resolve, reject });
            this.ws.send(JSON.stringify({ id, method, params }));
        });
    }

    on(method, fn) {
        if (!this.eventListeners.has(method)) {
            this.eventListeners.set(method, []);
        }
        this.eventListeners.get(method).push(fn);
    }

    async evaluate(expression) {
        const res = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
        if (res.exceptionDetails) {
            throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text || 'Evaluation error');
        }
        return res.result ? res.result.value : undefined;
    }

    close() {
        if (this.ws) this.ws.close();
    }
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
    console.log('Starting static server on port ' + PORT + '...');
    const server = createServer();
    await new Promise(resolve => server.listen(PORT, resolve));

    const chromePath = getChromePath();
    console.log('Launching headless Chrome from: ' + chromePath);

    const chromeArgs = [
        '--headless=new',
        `--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(), 'site-browser-check-'))}`,
        `--remote-debugging-port=${CHROME_PORT}`,
        '--remote-debugging-address=127.0.0.1',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-background-networking',
        '--disable-sync',
        '--disable-default-apps',
        '--disable-component-update',
        '--no-first-run',
        '--no-default-browser-check',
        '--autoplay-policy=no-user-gesture-required',
        '--mute-audio',
        '--window-size=1280,800'
    ];
    if (process.platform !== 'win32') {
        chromeArgs.push('--no-sandbox', '--disable-dev-shm-usage', '--disable-setuid-sandbox');
    }

    const chrome = spawn(chromePath, chromeArgs);
    chrome.stderr.on('data', (d) => {
        const text = d.toString();
        if (process.env.DEBUG) {
            console.error('[Chrome stderr]', text.trim());
        }
    });
    chrome.on('exit', (code, signal) => {
        if (code !== null && code !== 0) {
            console.error(`[Chrome process exit] code=${code}, signal=${signal}`);
        }
    });

    let passed = 0;
    let failed = 0;

    function assert(condition, desc) {
        if (condition) {
            console.log('  PASS: ' + desc);
            passed++;
        } else {
            console.error('  FAIL: ' + desc);
            failed++;
        }
    }

    try {
        let versionData = null;
        for (let i = 0; i < 60; i++) {
            await sleep(250);
            try {
                const res = await fetch(`http://127.0.0.1:${CHROME_PORT}/json/version`);
                if (res.ok) {
                    versionData = await res.json();
                    break;
                }
            } catch (e) {}
        }

        if (!versionData) throw new Error(`Could not connect to headless Chrome CDP at http://127.0.0.1:${CHROME_PORT}/json/version after 15s`);
        console.log('Connected to Chrome: ' + versionData.Browser);

        const newTarget = await (await fetch(`http://127.0.0.1:${CHROME_PORT}/json/new`, { method: 'PUT' })).json();
        const client = new CDPClient(newTarget.webSocketDebuggerUrl);
        await client.connect();

        await client.send('Page.enable');
        await client.send('Runtime.enable');
        await client.send('DOM.enable');
        await client.send('CSS.enable');
        await client.send('Network.enable');

        // Continuous error monitoring across all interactions and pages
        const consoleErrors = [];
        client.on('Runtime.consoleAPICalled', (params) => {
            if (params.type === 'error') {
                consoleErrors.push(params.args.map(a => a.value || a.description).join(' '));
            }
        });
        client.on('Runtime.exceptionThrown', (params) => {
            consoleErrors.push(params.exceptionDetails.text);
        });

        function assertZeroErrors(contextName) {
            assert(consoleErrors.length === 0, `Zero console errors during ${contextName} (errors: ${consoleErrors.length})`);
            if (consoleErrors.length > 0) {
                console.error(`    Console errors encountered:`, consoleErrors);
            }
        }

        let transferredBytes = 0;
        client.on('Network.loadingFinished', (params) => {
            transferredBytes += params.encodedDataLength || 0;
        });

        // Inject diagnostic spies before any page scripts or paints
        await client.send('Page.addScriptToEvaluateOnNewDocument', {
            source: `
                // 1. First Paint & Theme Tracker
                window.__paintMetrics = {
                    themeAtFirstPaint: null,
                    firstPaintTime: null,
                    readyStates: []
                };

                try {
                    const po = new PerformanceObserver((list) => {
                        for (const entry of list.getEntries()) {
                            if (entry.name === 'first-paint' && window.__paintMetrics.themeAtFirstPaint === null) {
                                window.__paintMetrics.themeAtFirstPaint = document.documentElement.classList.contains('light') ? 'light' : 'dark';
                                window.__paintMetrics.firstPaintTime = entry.startTime;
                            }
                        }
                    });
                    po.observe({ type: 'paint', buffered: true });
                } catch (e) {}

                document.addEventListener('readystatechange', () => {
                    window.__paintMetrics.readyStates.push({
                        state: document.readyState,
                        isLight: document.documentElement.classList.contains('light')
                    });
                });

                // 2. AudioContext & Node Disconnect Spy
                const OriginalAudioContext = window.AudioContext || window.webkitAudioContext;
                if (OriginalAudioContext) {
                    window.__audioSpy = {
                        instancesCreated: 0,
                        nodesCreated: 0,
                        nodesDisconnected: 0
                    };

                    if (window.AudioNode && AudioNode.prototype) {
                        const origDisc = AudioNode.prototype.disconnect;
                        AudioNode.prototype.disconnect = function() {
                            window.__audioSpy.nodesDisconnected++;
                            return origDisc.apply(this, arguments);
                        };
                    }

                    function SpiedAudioContext(...args) {
                        const ctx = new OriginalAudioContext(...args);
                        window.__audioSpy.instancesCreated++;

                        const origCreateOsc = ctx.createOscillator.bind(ctx);
                        ctx.createOscillator = function() {
                            window.__audioSpy.nodesCreated++;
                            return origCreateOsc();
                        };

                        const origCreateGain = ctx.createGain.bind(ctx);
                        ctx.createGain = function() {
                            window.__audioSpy.nodesCreated++;
                            return origCreateGain();
                        };

                        return ctx;
                    }
                    SpiedAudioContext.prototype = OriginalAudioContext.prototype;
                    window.AudioContext = SpiedAudioContext;
                    window.webkitAudioContext = SpiedAudioContext;
                }
            `
        });

        console.log('\n--- Test 1: Desktop Page Load & Console Error Tracking ---');
        await client.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
        await sleep(1000);

        assertZeroErrors('initial homepage load');

        const title = await client.evaluate('document.title');
        assert(title.includes('Lazar Gugleta'), `Page title loaded: "${title}"`);

        const cssLoaded = await client.evaluate(`
            Boolean(document.querySelector('link[href^="css/shared.css"]') && document.querySelector('link[href^="css/home.css"]'))
        `);
        assert(cssLoaded, 'External cacheable CSS links loaded');

        const scriptsDeferred = await client.evaluate(`
            (() => {
                const scripts = Array.from(document.querySelectorAll('script[src]'));
                return scripts.length > 0 && scripts.every(s => s.hasAttribute('defer'));
            })()
        `);
        assert(scriptsDeferred, 'All external JavaScript assets load with defer attribute');

        console.log('\n--- Test 1b: Locked Header & Active Navigation Indicator ---');
        await client.evaluate('window.scrollTo(0, 850)');
        await sleep(250);
        const headerState = await client.evaluate(`
            (() => {
                const header = document.querySelector('.topbar');
                const rect = header.getBoundingClientRect();
                const computed = window.getComputedStyle(header);
                return {
                    top: rect.top,
                    position: computed.position,
                    zIndex: parseInt(computed.zIndex, 10),
                    scrollY: window.scrollY
                };
            })()
        `);
        assert(headerState.scrollY >= 400, `Page scrolled (scrollY=${headerState.scrollY})`);
        assert(headerState.top === 0, `Header is locked at top of viewport (rect.top=${headerState.top})`);
        assert(headerState.position === 'sticky', `Header has position: sticky (got "${headerState.position}")`);
        assert(headerState.zIndex >= 50, `Header has high z-index stacking layer (${headerState.zIndex})`);

        const activeNavState = await client.evaluate(`
            (() => {
                const activeLink = document.querySelector('.nav a.active');
                if (!activeLink) return null;
                const style = window.getComputedStyle(activeLink);
                return {
                    text: activeLink.textContent.trim(),
                    hasBorder: style.borderColor !== 'transparent' && style.borderColor !== 'rgba(0, 0, 0, 0)'
                };
            })()
        `);
        assert(activeNavState !== null, 'Active section link exists while scrolled');
        assert(activeNavState && activeNavState.hasBorder, `Active link "${activeNavState?.text}" renders subtle border indicator`);

        // Return to top
        await client.evaluate('window.scrollTo(0, 0)');
        await sleep(200);

        console.log('\n--- Test 2: Network Transfer & Modern Image Delivery ---');
        console.log(`  Initial total encoded transfer: ${(transferredBytes / 1024).toFixed(1)} KB`);

        // Check image attributes prior to scroll
        const previewAttrs = await client.evaluate(`
            (() => {
                const img = document.querySelector('.writing-preview img');
                return img ? {
                    loading: img.getAttribute('loading'),
                    decoding: img.getAttribute('decoding'),
                    width: img.getAttribute('width'),
                    height: img.getAttribute('height')
                } : null;
            })()
        `);
        assert(previewAttrs && previewAttrs.loading === 'lazy', 'Article preview has loading="lazy"');
        assert(previewAttrs && previewAttrs.decoding === 'async', 'Article preview has decoding="async"');
        assert(previewAttrs && previewAttrs.width === '800' && previewAttrs.height === '460', 'Article preview specifies intrinsic dimensions (800x460)');

        // Scroll to writing section so lazy image loads
        await client.evaluate('document.getElementById("writing").scrollIntoView()');
        await sleep(600);

        const imgCurrentSrc = await client.evaluate(`
            (() => {
                const img = document.querySelector('.writing-preview img');
                return img ? (img.currentSrc || img.src) : null;
            })()
        `);
        console.log(`  Article preview resolved source: ${imgCurrentSrc}`);
        assert(
            imgCurrentSrc && imgCurrentSrc.includes('.avif'),
            `Article preview prefers modern AVIF format (${imgCurrentSrc})`
        );
        const writingOctoColor = await client.evaluate(`
            (() => {
                const el = document.querySelector('.writing-card[data-publisher="octoparse"] .pub-badge.pub-octoparse');
                if (!el) return null;
                const col = window.getComputedStyle(el).color;
                const m = col.match(/oklab\\(([^\\s]+)\\s+([^\\s]+)\\s+([^\\s]+)\\)/);
                if (m) {
                    const b = parseFloat(m[3]);
                    return b < -0.08 ? 'blue' : col;
                }
                return (col.includes('59, 130, 246') || col.includes('37, 99, 235')) ? 'blue' : col;
            })()
        `);
        assert(writingOctoColor === 'blue', 'Octoparse publisher badge in writing card matches brand blue');

        const writingMediumatchColor = await client.evaluate(`
            (() => {
                const el = document.querySelector('.writing-card[data-publisher="mediumatch"] .pub-badge.pub-mediumatch');
                if (!el) return null;
                const col = window.getComputedStyle(el).color;
                const m = col.match(/oklab\\(([^\\s]+)\\s+([^\\s]+)\\s+([^\\s]+)\\)/);
                if (m) {
                    const a = parseFloat(m[2]), b = parseFloat(m[3]);
                    return (a > 0.05 && b < 0) ? 'violet' : col;
                }
                return (col.includes('139, 92, 246') || col.includes('124, 58, 237')) ? 'violet' : col;
            })()
        `);
        assert(writingMediumatchColor === 'violet', 'MediuMatch publisher badge in writing card matches brand violet');

        const writingCardsCount = await client.evaluate('document.querySelectorAll(".writing-grid .writing-card").length');
        assert(writingCardsCount === 6, `Writing section rendered 6 article cards (got ${writingCardsCount})`);
        const mmWritingCount = await client.evaluate('document.querySelectorAll(".writing-grid .writing-card[data-publisher=\\"mediumatch\\"]").length');
        assert(mmWritingCount === 2, `Writing section includes 2 MediuMatch cards (got ${mmWritingCount})`);

        assertZeroErrors('lazy image scroll');

        console.log('\n--- Test 3: Theme Toggle & First Paint Flash Prevention ---');
        const initialIsLight = await client.evaluate('document.documentElement.classList.contains("light")');
        assert(!initialIsLight, 'Default theme is dark');

        await client.evaluate('document.getElementById("theme-toggle").click()');
        await sleep(200);

        const themeAfterClick = await client.evaluate('document.documentElement.classList.contains("light")');
        const storageVal = await client.evaluate('localStorage.getItem("theme")');
        assert(themeAfterClick === true, 'Theme toggles to light on click');
        assert(storageVal === 'light', 'Theme preference saved in localStorage as "light"');

        // Test theme flash prevention on reload with PerformanceObserver
        await client.send('Page.reload');
        await sleep(500);

        const paintMetrics = await client.evaluate('window.__paintMetrics');
        assert(
            paintMetrics.themeAtFirstPaint === 'light',
            `Saved light theme active at PerformanceObserver first-paint (themeAtFirstPaint="${paintMetrics.themeAtFirstPaint}")`
        );
        const allReadyStatesLight = paintMetrics.readyStates.length > 0 && paintMetrics.readyStates.every(s => s.isLight);
        assert(allReadyStatesLight, 'Light theme active across all document readyStates (0ms flash-free)');

        // Switch back to dark for remaining tests
        await client.evaluate('document.getElementById("theme-toggle").click()');
        await sleep(100);
        assertZeroErrors('theme switching and reload');

        console.log('\n--- Test 4: Lamp Interactions, AudioContext Reuse & Node Cleanup ---');
        const lampInitLit = await client.evaluate('document.getElementById("writing").classList.contains("is-lit")');
        assert(!lampInitLit, 'Lamp is initially unlit');

        // Single pull
        await client.evaluate('document.getElementById("reading-lamp-btn").click()');
        await sleep(200);
        const lampLitAfter = await client.evaluate('document.getElementById("writing").classList.contains("is-lit")');
        assert(lampLitAfter === true, 'Lamp turns ON when cord pulled in dark mode');

        // Multiple rapid pulls to test AudioContext reuse and node cleanup
        for (let i = 0; i < 5; i++) {
            await client.evaluate('document.getElementById("reading-lamp-btn").click()');
            await sleep(70);
        }
        await sleep(350); // Allow all sound osc.onended callbacks to complete

        const audioSpy = await client.evaluate('window.__audioSpy');
        assert(
            audioSpy.instancesCreated === 1,
            `AudioContext lazily created once and reused across repeated clicks (instances: ${audioSpy.instancesCreated})`
        );
        assert(
            audioSpy.nodesCreated > 0,
            `Audio oscillator and gain nodes created for mechanical click sound (created: ${audioSpy.nodesCreated})`
        );
        assert(
            audioSpy.nodesDisconnected === audioSpy.nodesCreated,
            `All audio nodes cleanly disconnected on .onended (created: ${audioSpy.nodesCreated}, disconnected: ${audioSpy.nodesDisconnected})`
        );

        // Turn lamp light off
        await client.evaluate(`
            (() => {
                const w = document.getElementById("writing");
                if (w.classList.contains("is-lit")) document.getElementById("reading-lamp-btn").click();
            })()
        `);

        // Switch to light mode and verify lamp does not light up and shows tooltip
        await client.evaluate('document.getElementById("theme-toggle").click()');
        await sleep(100);
        await client.evaluate('document.getElementById("reading-lamp-btn").click()');
        await sleep(100);
        const lampLitInDay = await client.evaluate('document.getElementById("writing").classList.contains("is-lit")');
        const tooltipVisible = await client.evaluate('document.getElementById("lamp-night-tooltip").classList.contains("is-visible")');
        assert(!lampLitInDay, 'Lamp refuses to light in day mode');
        assert(tooltipVisible, 'Day mode lamp pull displays night tooltip');

        await client.evaluate('document.getElementById("theme-toggle").click()');
        await sleep(100);
        assertZeroErrors('lamp interactions and audio');

        console.log('\n--- Test 5: Car Animations - Physical Movement & Offscreen Freezing ---');
        const carTopAnimation = await client.evaluate(`
            (() => {
                const car = document.querySelector('.cv-car-unit.top-1');
                return car ? window.getComputedStyle(car).animationName : null;
            })()
        `);
        const carBottomAnimation = await client.evaluate(`
            (() => {
                const car = document.querySelector('.cv-car-unit.bottom-1');
                return car ? window.getComputedStyle(car).animationName : null;
            })()
        `);
        assert(carTopAnimation === 'drive-left', `Top car unit has animationName "drive-left" (got "${carTopAnimation}")`);
        assert(carBottomAnimation === 'drive-right', `Bottom car unit has animationName "drive-right" (got "${carBottomAnimation}")`);

        // Scroll to projects section and measure physical translation
        await client.evaluate('document.getElementById("projects").scrollIntoView()');
        await sleep(200);

        const projectCardsCount = await client.evaluate('document.querySelectorAll(".projects-grid .project-card").length');
        assert(projectCardsCount === 4, `Projects section rendered 4 cards (got ${projectCardsCount})`);

        const mmProject = await client.evaluate(`
            (() => {
                const card = document.querySelector('.project-card[data-project="mediumatch"]');
                if (!card) return null;
                return {
                    href: card.getAttribute('href'),
                    title: card.querySelector('.project-title')?.textContent.trim(),
                    repo: card.querySelector('.project-repo')?.textContent.trim(),
                    imgSrc: card.querySelector('img')?.getAttribute('src')
                };
            })()
        `);
        assert(mmProject && mmProject.href === 'https://mediumatch.com', 'MediuMatch project card links to https://mediumatch.com');
        assert(mmProject && mmProject.repo === 'mediumatch.com', 'MediuMatch project card displays mediumatch.com');
        assert(mmProject && mmProject.title === 'MediuMatch', 'MediuMatch project card title is "MediuMatch"');
        assert(mmProject && mmProject.imgSrc === 'src/branding/stripe-icon.png', 'MediuMatch project card displays stripe-icon.png');

        // Test brand hover colors on project cards
        await client.evaluate('document.querySelector(".project-card[data-project=\\"octoparse\\"]").scrollIntoView({ block: "center", behavior: "instant" })');
        await sleep(200);
        const octoProjPos = await client.evaluate(`(() => {
            const el = document.querySelector('.project-card[data-project="octoparse"]');
            const r = el.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        })()`);
        await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: octoProjPos.x, y: octoProjPos.y });
        await sleep(300);
        const octoProjectColor = await client.evaluate(`(() => {
            const el = document.querySelector('.project-card[data-project="octoparse"] .project-title');
            if (!el) return null;
            const col = window.getComputedStyle(el).color;
            const m = col.match(/oklab\\(([^\\s]+)\\s+([^\\s]+)\\s+([^\\s]+)\\)/);
            if (m) {
                const b = parseFloat(m[3]);
                return b < -0.08 ? 'blue' : col;
            }
            return (col.includes('59, 130, 246') || col.includes('37, 99, 235')) ? 'blue' : col;
        })()`);
        assert(octoProjectColor === 'blue', 'Octoparse project card hover title is brand blue');

        await client.evaluate('document.querySelector(".project-card[data-project=\\"chat4data\\"]").scrollIntoView({ block: "center", behavior: "instant" })');
        await sleep(200);
        const c4dProjPos = await client.evaluate(`(() => {
            const el = document.querySelector('.project-card[data-project="chat4data"]');
            const r = el.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        })()`);
        await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c4dProjPos.x, y: c4dProjPos.y });
        await sleep(300);
        const c4dProjectColor = await client.evaluate(`(() => {
            const el = document.querySelector('.project-card[data-project="chat4data"] .project-title');
            if (!el) return null;
            const col = window.getComputedStyle(el).color;
            const m = col.match(/oklab\\(([^\\s]+)\\s+([^\\s]+)\\s+([^\\s]+)\\)/);
            if (m) {
                const a = parseFloat(m[2]), b = parseFloat(m[3]);
                return (a > 0.05 && b > 0.05) ? 'orange' : col;
            }
            return (col.includes('251, 146, 60') || col.includes('234, 88, 12')) ? 'orange' : col;
        })()`);
        assert(c4dProjectColor === 'orange', 'Chat4Data project card hover title is brand orange');

        const initialCarLeft = await client.evaluate('document.querySelector(".cv-car-unit.top-1").getBoundingClientRect().left');
        await sleep(150);
        const movedCarLeft = await client.evaluate('document.querySelector(".cv-car-unit.top-1").getBoundingClientRect().left');
        const deltaMoving = Math.abs(movedCarLeft - initialCarLeft);
        assert(deltaMoving > 0.5, `Car physically translated over 150ms while in viewport (delta: ${deltaMoving.toFixed(2)}px)`);

        // Scroll back to top: project card leaves viewport
        await client.evaluate('window.scrollTo(0, 0)');
        await sleep(250);

        const cardPaused = await client.evaluate('document.querySelector(".project-card-cv").classList.contains("anim-paused")');
        assert(cardPaused, 'Project card receives .anim-paused class when scrolled out of viewport');

        const offscreenLeft1 = await client.evaluate('document.querySelector(".cv-car-unit.top-1").getBoundingClientRect().left');
        await sleep(150);
        const offscreenLeft2 = await client.evaluate('document.querySelector(".cv-car-unit.top-1").getBoundingClientRect().left');
        const deltaPaused = Math.abs(offscreenLeft2 - offscreenLeft1);
        assert(deltaPaused === 0, `Car animation strictly suspended (0.00px translation) while offscreen (delta: ${deltaPaused}px)`);
        assertZeroErrors('car animation and scrolling');

        console.log('\n--- Test 6: Hero Conduit Scheduling (Tab Visibility & Duplicate Loop Prevention) ---');
        const conduitActiveAtHero = await client.evaluate('window.__conduitDebug.isAnimating()');
        assert(conduitActiveAtHero === true, 'Hero conduit is actively animating when visible at top');

        // 1. Emulate backgrounding the tab while at hero
        await client.evaluate(`
            (() => {
                Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
                document.dispatchEvent(new Event('visibilitychange'));
            })()
        `);
        await sleep(100);
        const animatingWhenHidden = await client.evaluate('window.__conduitDebug.isAnimating()');
        assert(animatingWhenHidden === false, 'Conduit frame loop cancelled when page is hidden');

        // 2. Restore visibility while still at hero: resumes
        await client.evaluate(`
            (() => {
                Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
                document.dispatchEvent(new Event('visibilitychange'));
            })()
        `);
        await sleep(100);
        const animatingResumedAtHero = await client.evaluate('window.__conduitDebug.isAnimating()');
        assert(animatingResumedAtHero === true, 'Conduit animation resumes when tab is visible at hero');

        // 3. Scroll hero out of view while tab is visible
        await client.evaluate('document.getElementById("writing").scrollIntoView()');
        await sleep(250);
        const heroIntersectingOffscreen = await client.evaluate('window.__conduitDebug.isHeroIntersecting()');
        assert(!heroIntersectingOffscreen, 'Hero is confirmed offscreen');
        const animatingWhenOffscreen = await client.evaluate('window.__conduitDebug.isAnimating()');
        assert(animatingWhenOffscreen === false, 'Conduit frame loop cancelled when hero scrolled offscreen');

        // 4. Background tab while hero is offscreen
        await client.evaluate(`
            (() => {
                Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
                document.dispatchEvent(new Event('visibilitychange'));
            })()
        `);
        await sleep(100);

        // 5. Return to tab while hero is STILL offscreen
        await client.evaluate(`
            (() => {
                Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
                document.dispatchEvent(new Event('visibilitychange'));
            })()
        `);
        await sleep(100);
        const animatingWhenReturningOffscreen = await client.evaluate('window.__conduitDebug.isAnimating()');
        assert(
            animatingWhenReturningOffscreen === false,
            'Returning to tab does NOT resume animation when hero is offscreen'
        );

        // 6. Scroll back to hero: should resume automatically
        await client.evaluate('window.scrollTo(0, 0)');
        await sleep(250);
        const animatingWhenBackAtHero = await client.evaluate('window.__conduitDebug.isAnimating()');
        assert(animatingWhenBackAtHero === true, 'Animation automatically resumes when hero re-enters viewport');

        // 7. Test rapid tab switches and duplicate loop prevention
        await client.evaluate(`
            (() => {
                window.__rafCount = 0;
                const origRaf = window.requestAnimationFrame.bind(window);
                window.requestAnimationFrame = function(cb) {
                    window.__rafCount++;
                    return origRaf(cb);
                };

                // Rapidly flip visibilityState 10 times
                for (let i = 0; i < 10; i++) {
                    const state = (i % 2 === 0) ? 'hidden' : 'visible';
                    Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
                    document.dispatchEvent(new Event('visibilitychange'));
                }
                // Final state: visible
                Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
                document.dispatchEvent(new Event('visibilitychange'));
            })()
        `);
        await sleep(250);

        const rafMetrics = await client.evaluate(`
            (() => {
                return {
                    isAnimating: window.__conduitDebug.isAnimating(),
                    rafCount: window.__rafCount
                };
            })()
        `);
        assert(rafMetrics.isAnimating === true, 'Animation is running after rapid tab switches');
        // Over 250ms at 60fps, 1 loop requests ~15 frames. Multiple stacked loops would trigger 40+ frames.
        assert(
            rafMetrics.rafCount >= 8 && rafMetrics.rafCount <= 25,
            `Exactly one animation loop running after repeated switches (${rafMetrics.rafCount} frames in ~250ms)`
        );
        assertZeroErrors('conduit visibility and loop scheduling');

        console.log('\n--- Test 7: Reduced Motion Emulation Across Components ---');
        await client.send('Emulation.setEmulatedMedia', {
            media: 'page',
            features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
        });
        await sleep(300);

        const heroAnimatingReduced = await client.evaluate('window.__conduitDebug.isAnimating()');
        const heroBallDisplay = await client.evaluate(`
            (() => {
                const bg = document.getElementById('conduit-ball-group');
                return bg ? window.getComputedStyle(bg).display : null;
            })()
        `);
        assert(heroAnimatingReduced === false, 'Hero conduit loop cancelled under prefers-reduced-motion: reduce');
        assert(heroBallDisplay === 'none', 'Hero conduit moving elements hidden under reduced motion');

        const carReducedAnim = await client.evaluate(`
            (() => {
                const car = document.querySelector('.cv-car-unit.top-1');
                return car ? window.getComputedStyle(car).animationName : null;
            })()
        `);
        assert(carReducedAnim === 'none', `Car animations disabled under reduced motion (animationName="${carReducedAnim}")`);

        const lampChainReducedAnim = await client.evaluate(`
            (() => {
                const chain = document.querySelector('.lamp-chain-pull');
                return chain ? window.getComputedStyle(chain).animationName : null;
            })()
        `);
        assert(lampChainReducedAnim === 'none', `Lamp pull chain animation disabled under reduced motion (animationName="${lampChainReducedAnim}")`);

        // Test theme toggle button animation disabled under reduced motion
        await client.evaluate('document.getElementById("theme-toggle").click()');
        const themeBtnAnimClass = await client.evaluate(`
            (() => {
                const btn = document.getElementById("theme-toggle");
                return btn.classList.contains('anim-put-out-light') || btn.classList.contains('anim-take-light-in');
            })()
        `);
        assert(!themeBtnAnimClass, 'Theme toggle animation class omitted under reduced motion');
        await client.evaluate('document.getElementById("theme-toggle").click()');

        // Restore standard motion
        await client.send('Emulation.setEmulatedMedia', { features: [] });
        await sleep(200);
        assertZeroErrors('reduced motion emulation');

        console.log('\n--- Test 8: Mobile Viewport & Navigation ---');
        await client.send('Emulation.setDeviceMetricsOverride', {
            width: 390,
            height: 844,
            deviceScaleFactor: 3,
            mobile: true
        });
        await sleep(300);

        const menuToggleVisible = await client.evaluate(`
            (() => {
                const btn = document.getElementById('menu-toggle');
                return btn ? (window.getComputedStyle(btn).display !== 'none') : false;
            })()
        `);
        assert(menuToggleVisible, 'Mobile menu hamburger button visible on mobile viewport');

        await client.evaluate('document.getElementById("menu-toggle").click()');
        const navOpen = await client.evaluate('document.querySelector(".nav").classList.contains("is-open")');
        assert(navOpen, 'Mobile navigation opens on click');

        await client.evaluate('document.querySelector(".nav a").click()');
        const navClosedAfterLink = await client.evaluate('!document.querySelector(".nav").classList.contains("is-open")');
        assert(navClosedAfterLink, 'Mobile navigation closes when link clicked');
        assertZeroErrors('mobile viewport & navigation');

        console.log('\n--- Test 9: Blog Index & Article Subpage Navigation ---');
        await client.send('Emulation.setDeviceMetricsOverride', {
            width: 1280,
            height: 800,
            deviceScaleFactor: 1,
            mobile: false
        });

        await client.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/blog.html` });
        await sleep(800);
        const blogHeading = await client.evaluate('document.querySelector("h1").textContent.trim()');
        assert(blogHeading === 'Blogs', `Blog page heading is "${blogHeading}" (expected "Blogs")`);

        const blogCardsCount = await client.evaluate('document.querySelectorAll(".blog-card").length');
        assert(blogCardsCount >= 5, `Blog page rendered ${blogCardsCount} article cards`);

        // Test MediuMatch external profile link position and attributes
        const extProfiles = await client.evaluate(`
            (() => {
                const links = Array.from(document.querySelectorAll('.author-publications .pub-ext-link'));
                return links.map(l => ({
                    href: l.getAttribute('href'),
                    className: l.className,
                    text: l.textContent.trim(),
                    imgSrc: l.querySelector('img')?.getAttribute('src') || null
                }));
            })()
        `);
        assert(extProfiles.length === 4, `External profiles has 4 links (got ${extProfiles.length})`);
        assert(extProfiles[1] && extProfiles[1].className.includes('pub-ext-mediumatch'), 'MediuMatch is second in External Profiles');
        assert(extProfiles[1] && extProfiles[1].href === 'https://mediumatch.com', 'MediuMatch external link points to https://mediumatch.com');
        assert(extProfiles[1] && extProfiles[1].imgSrc === 'src/branding/stripe-icon.png', 'MediuMatch uses stripe-icon.png branding logo');

        // Test Technical Writing filter chip active color is all blue (matches var(--accent))
        await client.evaluate('document.querySelector(".filter-chip[data-filter=\\"technical-writing\\"]").click()');
        await sleep(200);
        const twChipColor = await client.evaluate(`
            (() => {
                const chip = document.querySelector('.filter-chip[data-filter=\\"technical-writing\\"]');
                const chipCol = window.getComputedStyle(chip).color;
                const countCol = window.getComputedStyle(chip.querySelector('.filter-count')).color;
                return { chipCol, countCol, isActive: chip.classList.contains('is-active') };
            })()
        `);
        assert(twChipColor.isActive, 'Technical Writing filter chip is active when clicked');
        assert(twChipColor.chipCol === twChipColor.countCol, 'Technical Writing active chip text and count share identical blue color');

        // Test category filter interactivity
        await client.evaluate('document.querySelector(".filter-chip[data-filter=\\"ai-mcp\\"]").click()');
        await sleep(200);
        const aiMcpVisible = await client.evaluate(`
            (() => {
                const cards = Array.from(document.querySelectorAll('.blog-card'));
                const visible = cards.filter(c => window.getComputedStyle(c).display !== 'none');
                return visible.length;
            })()
        `);
        assert(aiMcpVisible === 9, `Filtering by ai-mcp displays 9 cards (got ${aiMcpVisible})`);

        await client.evaluate('document.querySelector(".filter-chip[data-filter=\\"all\\"]").click()');
        await sleep(200);
        const allVisible = await client.evaluate(`
            (() => {
                const cards = Array.from(document.querySelectorAll('.blog-card'));
                const visible = cards.filter(c => window.getComputedStyle(c).display !== 'none');
                return visible.length;
            })()
        `);
        assert(allVisible === 10, `Filtering by all displays 10 paginated cards on page 1 (got ${allVisible})`);

        // Test pagination navigation
        const paginationActive = await client.evaluate(`
            (() => {
                const nav = document.getElementById('blog-pagination');
                const isNavVisible = nav && !nav.hidden && window.getComputedStyle(nav).display !== 'none';
                const nextBtn = document.getElementById('pagination-next');
                return isNavVisible && nextBtn && !nextBtn.disabled;
            })()
        `);
        assert(paginationActive, 'Blog pagination nav is active with next button enabled');

        await client.evaluate('document.getElementById("pagination-next").click()');
        await sleep(200);
        const page2Visible = await client.evaluate(`
            (() => {
                const cards = Array.from(document.querySelectorAll('.blog-card'));
                const visible = cards.filter(c => window.getComputedStyle(c).display !== 'none');
                return visible.length;
            })()
        `);
        assert(page2Visible === 10, `Page 2 displays 10 cards (got ${page2Visible})`);

        await client.evaluate('document.getElementById("pagination-prev").click()');
        await sleep(200);

        const blogActive = await client.evaluate(`
            (() => {
                const link = document.querySelector('.nav a.active');
                if (!link) return null;
                const style = window.getComputedStyle(link);
                return {
                    text: link.textContent.trim(),
                    hasBorder: style.borderColor !== 'transparent' && style.borderColor !== 'rgba(0, 0, 0, 0)'
                };
            })()
        `);
        assert(blogActive && blogActive.text === 'Blog', 'Blog nav link is marked active on blog.html');
        assert(blogActive && blogActive.hasBorder, 'Active Blog link displays subtle border indicator');

        // Test publisher-specific hover colors
        // Filter by ai-mcp so chat4data and octoparse cards are visible on active page
        await client.evaluate('document.querySelector(".filter-chip[data-filter=\\"ai-mcp\\"]").click()');
        await sleep(200);

        const c4dCardPos = await client.evaluate(`(() => {
            const el = document.querySelector('.blog-card[data-publisher="chat4data"]:not(.is-hidden)');
            el.scrollIntoView({ block: 'center', behavior: 'instant' });
            const r = el.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        })()`);
        await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c4dCardPos.x, y: c4dCardPos.y });
        await sleep(150);
        const c4dHoverColor = await client.evaluate(`window.getComputedStyle(document.querySelector('.blog-card[data-publisher="chat4data"]:not(.is-hidden) .blog-card-title')).color`);
        const c4dIsOrange = await client.evaluate(`(() => {
            const col = window.getComputedStyle(document.querySelector('.blog-card[data-publisher="chat4data"]:not(.is-hidden) .blog-card-title')).color;
            const m = col.match(/oklab\\(([^\\s]+)\\s+([^\\s]+)\\s+([^\\s]+)\\)/);
            if (m) {
                const a = parseFloat(m[2]), b = parseFloat(m[3]);
                return a > 0.05 && b > 0.08;
            }
            return col.includes('251, 146, 60') || col.includes('234, 88, 12');
        })()`);
        assert(c4dIsOrange, 'Chat4Data article card hover title is single orange');

        const octoCardPos = await client.evaluate(`(() => {
            const el = document.querySelector('.blog-card[data-publisher="octoparse"]:not(.is-hidden)');
            el.scrollIntoView({ block: 'center', behavior: 'instant' });
            const r = el.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        })()`);
        await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: octoCardPos.x, y: octoCardPos.y });
        await sleep(150);
        const octoIsBlue = await client.evaluate(`(() => {
            const col = window.getComputedStyle(document.querySelector('.blog-card[data-publisher="octoparse"]:not(.is-hidden) .blog-card-title')).color;
            const m = col.match(/oklab\\(([^\\s]+)\\s+([^\\s]+)\\s+([^\\s]+)\\)/);
            if (m) {
                const b = parseFloat(m[3]);
                return b < -0.08;
            }
            return col.includes('59, 130, 246') || col.includes('37, 99, 235');
        })()`);
        assert(octoIsBlue, 'Octoparse article card hover title is brand blue');

        // Filter by all so mediumatch card is visible on page 1
        await client.evaluate('document.querySelector(".filter-chip[data-filter=\\"all\\"]").click()');
        await sleep(200);

        const mmCardPos = await client.evaluate(`(() => {
            const el = document.querySelector('.blog-card[data-publisher="mediumatch"]:not(.is-hidden)');
            el.scrollIntoView({ block: 'center', behavior: 'instant' });
            const r = el.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        })()`);
        await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: mmCardPos.x, y: mmCardPos.y });
        await sleep(150);
        const mmIsViolet = await client.evaluate(`(() => {
            const col = window.getComputedStyle(document.querySelector('.blog-card[data-publisher="mediumatch"]:not(.is-hidden) .blog-card-title')).color;
            const m = col.match(/oklab\\(([^\\s]+)\\s+([^\\s]+)\\s+([^\\s]+)\\)/);
            if (m) {
                const a = parseFloat(m[2]), b = parseFloat(m[3]);
                return a > 0.05 && b < 0;
            }
            return col.includes('139, 92, 246') || col.includes('124, 58, 237');
        })()`);
        assert(mmIsViolet, 'MediuMatch article card hover title is brand violet');

        assertZeroErrors('blog.html navigation');

        await client.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/404.html` });
        await sleep(500);
        const notFoundHeading = await client.evaluate('document.querySelector("h1").textContent');
        assert(notFoundHeading.includes('digital garden'), `404 page rendered: "${notFoundHeading}"`);
        assertZeroErrors('404.html navigation');

        console.log('\n--- Test 10: Cumulative Suite Integrity ---');
        assertZeroErrors('all combined interactions and page transitions');

        client.close();
    } finally {
        chrome.kill();
        server.close();
    }

    console.log('\n=======================================');
    console.log(`Browser tests completed: ${passed} passed, ${failed} failed.`);
    if (failed > 0) process.exit(1);
    else process.exit(0);
}

runTests().catch(err => {
    console.error('Test runner fatal error:', err);
    process.exit(1);
});
