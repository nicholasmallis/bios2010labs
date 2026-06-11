# BIOS 2010 Labs

This repository contains a Quarto/WebR version of the BIOS 2010 computer labs at the University of Georgia. The project is converting older Shiny/learnR lab apps into a static website where students can read lab instructions, run R code in the browser, and answer interactive quiz questions without needing a Shiny server or local R installation.

## Preview

Public preview site:

https://nicholasmallis.github.io/bios2010labs/

Current prototype:

https://nicholasmallis.github.io/bios2010labs/All_Labs/lab1.html

Experimental unfinished labs are linked from the homepage.

## Current Status

Lab 1 is the current polished prototype for colleague review. Labs 2-13 are also included on the public preview site under an "Experimental / Unfinished Labs" section so collaborators can peek at the broader migration, but those labs have not yet received the same hand-polishing as Lab 1.

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
