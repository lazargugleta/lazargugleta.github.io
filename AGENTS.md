# Project Guidelines & Agent Instructions

## Design Guidelines
- **Typography-First & Refined Elegance**: Let typography, structural rhythm, and clever whitespace do the heavy lifting (inspired by Frank Chimero, Linus Rogge, Low-Tech Magazine, and Digital Gardens). It should feel like reading a beautifully crafted book.
- **No Flashy Bloat or Heavy Decorations**: Avoid flashy Webflow-style templates, heavy industrial shadows, or unnecessary animation bloat. Prioritize speed, legibility, snappy performance, and clean vanilla CSS.
- **Maintain High Craft**: Sleek, clean, modern, and professional (dark/light theme with subtle gradients, intentional grid layouts, and high-quality image previews).

## Deployment & CI/CD Guidelines
- **GitHub Pages Workflow**: Use explicit GitHub Actions workflows (`.github/workflows/pages.yml`) for deployment to prevent `deployment_queued` timeouts.

## Browser Test Runner

- Scroll a target card into view before deriving coordinates for CDP hover tests. New article groups can move existing publisher cards below the viewport; offscreen mouse coordinates do not exercise hover styles.
- When testing hover states on paginated article grids, filter to a category containing the target publisher or navigate to their active page; off-page cards have display: none and report (0, 0) bounding boxes.
- Chrome remote debugging requires a non-default `--user-data-dir`. Use a fresh temporary profile for each browser test run; default profiles can cause CDP startup timeouts in GitHub Actions.
