// Run after building MediuMatch. Generates linked summaries, never duplicate articles.
const fs = require('fs');
const path = require('path');
const source = path.resolve(process.argv[2] || path.join(__dirname, '../../medium_scraper/website/dist/blog/articles.json'));
const target = path.join(__dirname, '../blog.html');
const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const feed = JSON.parse(fs.readFileSync(source, 'utf8'));
if (!Array.isArray(feed.articles) || !feed.articles.length) throw new Error('Expected a nonempty MediuMatch article feed.');
const origin = new URL(feed.site).origin;
if (!origin.startsWith('https://')) throw new Error('The original site must use HTTPS.');
const cards = feed.articles.map(article => {
    const url = new URL(article.url);
    if (url.origin !== origin || !url.pathname.startsWith('/blog/')) throw new Error('Unexpected article URL.');
    const date = article.publishedAt ? new Date(article.publishedAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'Europe/Vienna' }) : 'Oct 2026';
    return `            <a class="blog-card" data-publisher="mediumatch" data-category="technical-writing" data-date="2026-10" target="_blank" rel="noopener" href="${escape(url.href)}">
                <div class="blog-card-top"><span class="pub-badge pub-mediumatch">MediuMatch</span><span class="blog-card-date">${escape(date)}</span></div>
                <div class="blog-card-title">${escape(article.title)}</div>
                <div class="blog-card-desc">${escape(article.description)}</div>
            </a>`;
}).join('\n');
let html = fs.readFileSync(target, 'utf8');
const start = '<!-- MEDIUMATCH ARTICLES START -->';
const end = '<!-- MEDIUMATCH ARTICLES END -->';
const block = `${start}\n${cards}\n            ${end}`;
if (html.includes(start)) html = html.replace(/<!-- MEDIUMATCH ARTICLES START -->[\s\S]*?<!-- MEDIUMATCH ARTICLES END -->/, () => block);
else html = html.replace('<div class="blog-grid" id="articles-grid">', () => `<div class="blog-grid" id="articles-grid">\n            ${block}`);
if (!html.includes('data-filter="technical-writing"')) html = html.replace(/(<button class="filter-chip" data-filter="essays"[^\n]+<\/button>)/, '$1\n                    <button class="filter-chip" data-filter="technical-writing" type="button">Technical Writing <span class="filter-count">0</span></button>');
const allCards = [...html.matchAll(/<a class="blog-card"[^>]*data-category="([^"]+)"/g)];
html = html.replace(/(data-filter="([^"]+)"[^>]*>[\s\S]*?<span class="filter-count">)\d+(<\/span>)/g, (match, before, category, after) => before + (category === 'all' ? allCards.length : allCards.filter(card => card[1] === category).length) + after);
fs.writeFileSync(target, html);
console.log(`Synced ${feed.articles.length} linked MediuMatch summaries; ${allCards.length} total article cards.`);
