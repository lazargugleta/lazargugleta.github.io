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
├── blog/                                # Blog post pages
│   └── browser-automation-pipeline.html # Example internal post page
├── src/                                 # Shared media assets & documents (CV, images, icons)
│   ├── Lazar_Gugleta_CV.pdf
│   └── polars-vs-pandas.png
├── .github/workflows/
│   └── pages.yml                        # GitHub Actions deployment workflow to GitHub Pages
├── AGENTS.md                            # Design & deployment guidelines
├── _headers                             # Web server headers configuration
└── portfolio/                           # Legacy Next.js application codebase
```

## Features

- **Theme Toggle**: Smooth switching between dark and light themes using CSS custom properties (`oklch`) and localStorage persistence.
- **Interactive Timeline**: Work and education timeline with category filtering (`All`, `Work`, `Study`).
- **Responsive Layout**: Fluid CSS Grid and Flexbox layouts optimized for mobile, tablet, and desktop viewports.
- **SEO & Social Cards**: Semantic HTML, JSON-LD structured data (`WebSite`, `Person`), Open Graph, and Twitter metadata.

## Local Development

You can preview the site locally using any standard static file server:

```bash
# Using Python
python3 -m http.server 8000

# Using Node.js http-server
npx http-server . -p 8000
```

Open `http://localhost:8000` in your browser.

## Deployment

Automated deployment is configured via GitHub Actions in `.github/workflows/pages.yml`. Commits pushed to the `main` branch automatically deploy to GitHub Pages.
