# BIOS 2010 Labs

This repository contains a Quarto/WebR version of the BIOS 2010 computer labs at the University of Georgia. The project converts older Shiny/learnR lab apps into a static website where students can read lab instructions, run R code in the browser, and answer interactive quiz questions without needing a Shiny server or local R installation.

## Preview

Public preview site:

https://nicholasmallis.github.io/bios2010labs/

All converted labs are linked from the homepage.

## Current Status

Labs 1-13 have been converted and hand-polished for course-team review. Remaining work is mainly final content checking against the original browser labs and small wording or style refinements found during review.

## Project Structure

- `All_Labs/`: Quarto lab pages.
- `tutorials/`: Original lab materials and data assets.
- `docs/`: Rendered GitHub Pages preview site.
- `styles.css`: Shared site styling.
- `lab-interactions.js`: Browser-side interactions for quizzes and static lab widgets.
- `MIGRATION_TODO.md`: Migration notes, status, and remaining tasks.

## Publishing

The public preview is served with GitHub Pages from the `main` branch using the `/docs` folder.

To update the published preview, render the Quarto site locally and push the updated `docs/` folder to GitHub.
