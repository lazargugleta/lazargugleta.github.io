/**
 * Minimal static preview server: node scripts/serve.js [port]
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const port = Number(process.argv[2] || process.env.PORT || 8765);
const types = {
    '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
    '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml',
    '.txt': 'text/plain', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.pdf': 'application/pdf'
};

http.createServer((req, res) => {
    let rel;
    try {
        rel = decodeURIComponent(req.url.split('?')[0]);
    } catch (e) {
        res.writeHead(400);
        return res.end('400');
    }
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.join(root, rel);
    if (file !== root && !file.startsWith(root + path.sep)) {
        res.writeHead(403);
        return res.end('403');
    }
    fs.readFile(file, (err, data) => {
        if (err) {
            // Mirror GitHub Pages: unknown paths get the custom 404 page
            return fs.readFile(path.join(root, '404.html'), (e404, page) => {
                res.writeHead(404, { 'Content-Type': types['.html'] });
                res.end(e404 ? '404' : page);
            });
        }
        res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
        res.end(data);
    });
}).listen(port, '127.0.0.1', () => console.log(`Serving ${root} at http://localhost:${port}`));
