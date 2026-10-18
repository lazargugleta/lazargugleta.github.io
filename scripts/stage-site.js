/**
 * Stages only public site files into _site for GitHub Pages deployment.
 * Strictly excludes legacy application sources (portfolio/), dev tools, and git artifacts.
 */
const fs = require('fs');
const path = require('path');

const targetDir = path.resolve(__dirname, '..', '_site');

// Clean and recreate _site directory
if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
}
fs.mkdirSync(targetDir, { recursive: true });

const filesToCopy = [
    'index.html',
    'blog.html',
    'apple-touch-icon.png',
    'favicon-16x16.png',
    'favicon-32x32.png',
    'favicon.ico',
    'favicon.svg',
    'site.webmanifest',
    'robots.txt',
    'sitemap.xml',
    '_headers',
    '_redirects'
];

const dirsToCopy = [
    'blog',
    'css',
    'js',
    'src'
];

function copyFile(relPath) {
    const srcPath = path.resolve(__dirname, '..', relPath);
    const destPath = path.resolve(targetDir, relPath);
    if (fs.existsSync(srcPath)) {
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.copyFileSync(srcPath, destPath);
    }
}

function copyDir(relDir) {
    const srcDir = path.resolve(__dirname, '..', relDir);
    const destDir = path.resolve(targetDir, relDir);
    if (!fs.existsSync(srcDir)) return;

    fs.mkdirSync(destDir, { recursive: true });
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });

    for (const entry of entries) {
        const srcEntry = path.join(srcDir, entry.name);
        const destEntry = path.join(destDir, entry.name);

        if (entry.isDirectory()) {
            copyDir(path.join(relDir, entry.name));
        } else if (entry.isFile()) {
            fs.copyFileSync(srcEntry, destEntry);
        }
    }
}

filesToCopy.forEach(copyFile);
dirsToCopy.forEach(copyDir);

function getDirStats(dir) {
    let count = 0;
    let totalBytes = 0;

    function walk(d) {
        const entries = fs.readdirSync(d, { withFileTypes: true });
        for (const entry of entries) {
            const p = path.join(d, entry.name);
            if (entry.isDirectory()) {
                walk(p);
            } else if (entry.isFile()) {
                count++;
                totalBytes += fs.statSync(p).size;
            }
        }
    }

    walk(dir);
    return { count, totalBytes };
}

const stats = getDirStats(targetDir);
console.log(`Public site staged to: ${targetDir}`);
console.log(`Total files staged: ${stats.count}`);
console.log(`Total staged size: ${(stats.totalBytes / 1024).toFixed(1)} KB`);
