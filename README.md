# BIOS 2010 Labs

This repository contains a Quarto/WebR version of the BIOS 2010 computer labs at the University of Georgia. The project is converting older Shiny/learnR lab apps into a static website where students can read lab instructions, run R code in the browser, and answer interactive quiz questions without needing a Shiny server or local R installation.

## Preview

Public preview site:

https://nicholasmallis.github.io/bios2010labs/

Current prototype:

https://nicholasmallis.github.io/bios2010labs/All_Labs/lab1.html

## Current Status

Lab 1 is the current prototype for colleague review. The remaining lab source files are preserved in the repository, but Labs 2-13 are not part of the public preview yet.

## Project Structure

- `All_Labs/`: Quarto lab pages.
- `tutorials/`: Original lab materials and data assets.
- `docs/`: Rendered GitHub Pages preview site.
- `styles.css`: Shared site styling.
- `lab-interactions.js`: Browser-side interactions for quizzes and Lab 1 widgets.
- `MIGRATION_TODO.md`: Migration notes, status, and remaining tasks.

## Publishing

The public preview is served with GitHub Pages from the `main` branch using the `/docs` folder.

To update the published preview, render the Quarto site locally and push the updated `docs/` folder to GitHub.
