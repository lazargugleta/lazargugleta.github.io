# Lazar Gugleta - Portfolio & Blog

Personal portfolio website and engineering blog for Lazar Gugleta, Data Architect and AI Engineer. Designed with a typography-first approach, high craft, fast loading times, and native dark/light theme switching.

## Overview

- **Live Site**: [https://lazargugleta.github.io/](https://lazargugleta.github.io/)
- **Tech Stack**: Vanilla HTML5, CSS3 (oklch colors & dynamic themes), Vanilla JavaScript, GitHub Pages.
- **Design Philosophy**: Typography-first, clean aesthetics, subtle gradients, high legibility, and zero heavy framework bloat.

## Repository Structure

```
.
├── index.html                           # Portfolio homepage (Hero, Timeline, Writing, Projects, Contact)
├── blog.html                            # Blog listing page
├── 404.html                             # Custom 404 error page
├── _headers                             # Security and cache headers (Netlify mirror at lazargugleta.com)
├── _redirects                           # Apex-to-www redirect (Netlify mirror)
├── css/                                 # Stylesheets (shared tokens, home, blog)
├── js/                                  # Vanilla JavaScript (site navigation, theme, animations)
├── src/                                 # Media assets & documents (CV, responsive WebP/AVIF images)
│   ├── Lazar_Gugleta_CV.pdf
│   └── polars-vs-pandas.png
├── .github/workflows/
│   └── pages.yml                        # GitHub Actions deployment workflow to GitHub Pages
├── AGENTS.md                            # Design & deployment guidelines
├── robots.txt                           # Search engine crawling rules
└── sitemap.xml                          # Canonical XML sitemap
```

## Features

- **Theme Toggle**: Smooth switching between dark and light themes using CSS custom properties (`oklch`) and localStorage persistence.
- **Interactive Timeline**: Work and education timeline with category filtering (`All`, `Work`, `Study`).
- **Responsive Layout**: Fluid CSS Grid and Flexbox layouts optimized for mobile, tablet, and desktop viewports.
- **SEO & Social Cards**: Semantic HTML, JSON-LD structured data (`WebSite`, `Person`), Open Graph, and Twitter metadata.

## Local Development

Preview the site locally with the bundled static server (no dependencies):

```bash
node scripts/serve.js
```

Open `http://localhost:8765` in your browser.

## Deployment

### MediuMatch article links

After building the sibling `medium_scraper/website` project, run `node scripts/sync-mediumatch.js` here. This imports its generated `dist/blog/articles.json` into the existing blog grid as linked summaries and updates category counts. An explicit feed path can be passed as the first argument. No full article is duplicated and no personal authorship is asserted. Rerun after new articles, domain changes, or actual publication dates are recorded. Deploy these links after the original MediuMatch article URLs are live. Medium copies should declare those original article URLs as canonical.

Automated deployment is configured via GitHub Actions in `.github/workflows/pages.yml`. Commits pushed to the `main` branch automatically deploy to GitHub Pages.
