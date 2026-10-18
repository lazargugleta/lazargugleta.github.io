/**
 * Site verification script: checks local links, missing assets, JS syntax, and regression safety.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

let errors = [];

function assert(condition, message) {
    if (!condition) {
        errors.push(message);
        console.error('FAIL: ' + message);
    } else {
        console.log('PASS: ' + message);
    }
}

console.log('--- 1. Testing JavaScript Files ---');
const jsFiles = ['js/site.js', 'js/home.js'];
jsFiles.forEach(file => {
    try {
        execSync(`node --check "${file}"`, { stdio: 'pipe' });
        assert(true, `Syntax check passed for ${file}`);
    } catch (e) {
        assert(false, `Syntax check failed for ${file}: ${e.message}`);
    }
});

console.log('\n--- 2. Validating HTML Pages & Local References ---');
const htmlFiles = [
    'index.html',
    'blog.html',
    'blog/browser-automation-pipeline.html',
    '404.html'
];

htmlFiles.forEach(relPath => {
    assert(fs.existsSync(relPath), `HTML file exists: ${relPath}`);
    const content = fs.readFileSync(relPath, 'utf8');
    const dir = path.dirname(relPath);

    // Flash-prevention script check
    assert(
        content.includes('localStorage.getItem("theme") === "light"'),
        `Flash-prevention script present in ${relPath}`
    );

    // Obsolete tag checks
    assert(
        !content.includes('UA-123154622-2'),
        `No obsolete Universal Analytics in ${relPath}`
    );
    assert(
        !content.includes('fonts.googleapis.com'),
        `No external Google Fonts render-blocking calls in ${relPath}`
    );

    // UI elements check
    assert(
        content.includes('id="theme-toggle"'),
        `Theme toggle button present in ${relPath}`
    );

    // Check stylesheet and script references
    const linkRegex = /<link\s+[^>]*href=["']([^"']+)["'][^>]*>/gi;
    let match;
    while ((match = linkRegex.exec(content)) !== null) {
        const href = match[1];
        if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('#')) continue;
        const cleanHref = href.split('?')[0];
        const targetPath = path.resolve(dir, cleanHref);
        assert(fs.existsSync(targetPath), `Link target exists in ${relPath}: ${cleanHref}`);
    }

    const scriptRegex = /<script\s+[^>]*src=["']([^"']+)["'][^>]*>/gi;
    while ((match = scriptRegex.exec(content)) !== null) {
        const src = match[1];
        if (src.startsWith('http://') || src.startsWith('https://')) continue;
        const cleanSrc = src.split('?')[0];
        const targetPath = path.resolve(dir, cleanSrc);
        assert(fs.existsSync(targetPath), `Script target exists in ${relPath}: ${cleanSrc}`);
    }

    // Check image and source tags
    const imgRegex = /<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi;
    while ((match = imgRegex.exec(content)) !== null) {
        const src = match[1];
        if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) continue;
        const cleanSrc = src.split('?')[0];
        const targetPath = path.resolve(dir, cleanSrc);
        assert(fs.existsSync(targetPath), `Image source exists in ${relPath}: ${cleanSrc}`);
    }

    const sourceRegex = /<source\s+[^>]*srcset=["']([^"']+)["'][^>]*>/gi;
    while ((match = sourceRegex.exec(content)) !== null) {
        const srcset = match[1];
        const parts = srcset.split(',').map(s => s.trim().split(/\s+/)[0]);
        parts.forEach(src => {
            if (src.startsWith('http://') || src.startsWith('https://')) return;
            const cleanSrc = src.split('?')[0];
            const targetPath = path.resolve(dir, cleanSrc);
            assert(fs.existsSync(targetPath), `Source srcset target exists in ${relPath}: ${cleanSrc}`);
        });
    }

    // Check local internal navigation links (<a href="...">)
    const anchorRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi;
    while ((match = anchorRegex.exec(content)) !== null) {
        const href = match[1];
        if (
            href.startsWith('http://') ||
            href.startsWith('https://') ||
            href.startsWith('mailto:') ||
            href.startsWith('tel:') ||
            href.startsWith('#')
        ) continue;

        const pathOnly = href.split('#')[0].split('?')[0];
        if (pathOnly.length > 0) {
            const targetPath = path.resolve(dir, pathOnly);
            assert(fs.existsSync(targetPath), `Local link target exists in ${relPath}: ${href}`);
        }
    }
});

console.log('\n--- 2b. Validating SEO & Indexing Assets ---');
assert(fs.existsSync('robots.txt'), 'robots.txt exists');
assert(fs.readFileSync('robots.txt', 'utf8').includes('sitemap.xml'), 'robots.txt references sitemap.xml');
assert(fs.existsSync('sitemap.xml'), 'sitemap.xml exists');
assert(fs.readFileSync('sitemap.xml', 'utf8').includes('https://lazargugleta.github.io/'), 'sitemap.xml references canonical home URL');

console.log('\n--- 3. Validating CSS Stylesheets & Assets ---');
const cssFiles = ['css/shared.css', 'css/home.css', 'css/blog.css'];
cssFiles.forEach(relPath => {
    assert(fs.existsSync(relPath), `CSS file exists: ${relPath}`);
    const content = fs.readFileSync(relPath, 'utf8');
    const dir = path.dirname(relPath);

    // Verify reduced motion handling
    if (relPath === 'css/shared.css' || relPath === 'css/home.css') {
        assert(
            content.includes('prefers-reduced-motion: reduce'),
            `Reduced motion coverage present in ${relPath}`
        );
    }

    // Verify url(...) asset paths
    const urlRegex = /url\(["']?([^"')]+)["']?\)/gi;
    let match;
    while ((match = urlRegex.exec(content)) !== null) {
        const assetUrl = match[1];
        if (
            assetUrl.startsWith('#') ||
            assetUrl.startsWith('data:') ||
            assetUrl.startsWith('http://') ||
            assetUrl.startsWith('https://')
        ) continue;

        const cleanUrl = assetUrl.split('?')[0].split('#')[0];
        const targetPath = path.resolve(dir, cleanUrl);
        assert(fs.existsSync(targetPath), `CSS url() target exists in ${relPath}: ${cleanUrl}`);
    }
});

console.log('\n--- 4. Checking Animation Keyframes & References ---');
const definedKeyframes = new Set();
const referencedAnimations = [];

cssFiles.forEach(relPath => {
    const content = fs.readFileSync(relPath, 'utf8');
    const kfRegex = /@keyframes\s+([a-zA-Z0-9_-]+)/g;
    let kfMatch;
    while ((kfMatch = kfRegex.exec(content)) !== null) {
        definedKeyframes.add(kfMatch[1]);
    }
});

const cssKeywords = new Set([
    'none', 'inherit', 'initial', 'unset', 'revert', 'linear', 'ease', 'ease-in', 'ease-out',
    'ease-in-out', 'step-start', 'step-end', 'infinite', 'forwards', 'backwards', 'both',
    'normal', 'reverse', 'alternate', 'alternate-reverse', 'running', 'paused'
]);

cssFiles.forEach(relPath => {
    const content = fs.readFileSync(relPath, 'utf8');
    const animRegex = /(?:^|[^-])\banimation(?:-name)?\s*:\s*([^;]+);/gm;
    let animMatch;
    while ((animMatch = animRegex.exec(content)) !== null) {
        const val = animMatch[1].trim();
        if (val === 'none' || val.includes('!important') && val.startsWith('none')) continue;

        let sanitized = val.replace(/[a-z-]+\([^)]*\)/gi, '');
        const tokens = sanitized.split(/\s+/).map(t => t.replace(/!important/, '').trim());
        tokens.forEach(tok => {
            if (!tok) return;
            if (/^-?\d+(\.\d+)?(s|ms)?$/.test(tok)) return;
            if (cssKeywords.has(tok.toLowerCase())) return;

            referencedAnimations.push({ name: tok, file: relPath });
        });
    }
});

referencedAnimations.forEach(({ name, file }) => {
    assert(
        definedKeyframes.has(name),
        `Animation "${name}" referenced in ${file} is defined in @keyframes`
    );
});

console.log('\n--- 5. Checking Responsive Asset Delivery ---');
const responsiveImages = [
    'src/polars-vs-pandas.png',
    'src/polars-vs-pandas.webp',
    'src/polars-vs-pandas-400.webp',
    'src/polars-vs-pandas.avif',
    'src/polars-vs-pandas-400.avif'
];
responsiveImages.forEach(img => {
    assert(fs.existsSync(img), `Responsive image asset exists: ${img}`);
    const size = fs.statSync(img).size;
    assert(size > 0 && size < 500000, `Image asset ${img} is reasonably sized (${size} bytes)`);
});

console.log('\n=======================================');
if (errors.length > 0) {
    console.error(`Verification FAILED with ${errors.length} error(s).`);
    process.exit(1);
} else {
    console.log('All verification checks PASSED successfully!');
    process.exit(0);
}
