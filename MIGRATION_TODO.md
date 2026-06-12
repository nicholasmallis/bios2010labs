# Lab Site Migration TODO

This file is generated from `scripts/convert_labs.py` and should be updated as hand fixes are made.

## Current Pass

- Installed and vendored the `r-wasm/quarto-live` extension.
- Converted learnr exercise chunks into editable `{webr}` cells.
- Converted learnr quiz blocks into static HTML quizzes with immediate feedback.
- Preserved original Shiny render/server code in collapsed migration callouts where an exact static replacement still needs to be built.
- Preloaded local `www` assets into WebR using the extension resource mechanism.
- Replaced Lab 1 Shiny widgets with static browser-side JavaScript widgets: the Old Faithful histogram and the heart failure filter/sort table.

## Hand Fix Log

- 2026-06-10: Tweaked Lab 1 to better match the original Shiny lab:
  removed the extra WebR/quiz tip at the top of the page, renumbered quiz cards so they match eLC Questions 1-10, hid the Old Faithful bandwidth slider until density is selected, and made the heart failure table count/sort cues closer to the original DT table.
- 2026-06-11: Adjusted the desktop guided-lab layout so Lab 1 content is centered within the available page area while keeping the topic navigation sidebar. A later wider-layout experiment was reverted because it stretched the content too far right.
- 2026-06-11: Added a wide-screen-only layout adjustment so full-screen desktop views start the Lab 1 content a bit farther left without changing the normal laptop-width layout.
- 2026-06-11: Nudged the wide-screen Lab 1 content another step left and tightened sidebar topic button wrapping so long labels stay inside their boxes.
- 2026-06-11: Removed the wide-screen fixed topic sidebar. The guided lab topic navigation now stays as a sticky top bar at all screen sizes, which restores the centered content layout and avoids cramped sidebar labels.
- 2026-06-11: Updated WebR exercise editor syntax colors so regular R code appears black and comments after `#` appear green, matching the original learnr style more closely.
- 2026-06-11: Connected the project to `nicholasmallis/bios2010labs` on GitHub. Initial GitHub Actions publishing failed during the remote Quarto render, so publishing was switched to the simpler GitHub Pages `main` branch `/docs` workflow for colleague review.
- 2026-06-11: Limited the published colleague preview to the homepage, about page, and Lab 1 only. Source files for Labs 2-13 remain in `All_Labs/` and `tutorials/` for later polishing.
- 2026-06-11: Added Labs 2-13 back to the published site as a clearly labeled "Experimental / Unfinished Labs" section while keeping Lab 1 identified as the prototype.
- 2026-06-12: Fixed guided lab topic navigation so Next/Previous topic changes scroll to the start of the newly displayed topic instead of sometimes leaving the reader mid-page.
- 2026-06-12: Started the Lab 2 polish pass. Converted the remaining learnr quiz code into static feedback cards, added select-all quiz behavior for Question 1, removed the leftover Shiny migration callouts, and replaced the bin-selection Shiny app with a browser-side histogram widget for the heart failure data.

## Lab Inventory

| Lab | Title | WebR cells | Quiz blocks | Shiny migration blocks |
| --- | --- | ---: | ---: | ---: |
| 1 | Getting Started | 6 | 20 | 0 |
| 2 | Histograms | 8 | 8 | 0 |
| 3 | Box Plots | 5 | 28 | 2 |
| 4 | Basic Data Analysis | 9 | 28 | 0 |
| 5 | Life Tables | 0 | 20 | 6 |
| 6 | Diagnostic and Screening Tests | 2 | 24 | 4 |
| 7 | Discrete Distributions | 2 | 24 | 4 |
| 8 | Normal Distribution | 0 | 22 | 6 |
| 9 | Random Sampling and Central Limit Theorem | 0 | 34 | 7 |
| 10 | One Sample T Methods | 7 | 26 | 2 |
| 11 | Paired t Test | 3 | 20 | 2 |
| 12 | Two Sample *t* Test | 4 | 20 | 4 |
| 13 | Hypothesis Tests and Confidence Intervals for Proportions | 2 | 22 | 4 |

## Remaining TODO

- Replace collapsed Shiny migration callouts with native WebR/JavaScript controls for full parity.
- Keep Lab 1 hand edits if `scripts/convert_labs.py` is run again, or fold the Lab 1 widget replacements back into the converter.
- Browser-test package-heavy labs, especially labs using `ggplot2`, `tableone`, `plotROC`, `pROC`, `ggpubr`, and `datasauRus`.
- Add custom WebR grading blocks for code exercises where answer validation should go beyond successful execution.
- Confirm GitHub Pages deployment path and resource loading after publishing.

## Raw Conversion Summary

```json
[
  {
    "lab": 1,
    "title": "Getting Started",
    "quizzes": 20,
    "webr_cells": 6,
    "shiny_blocks": 0
  },
  {
    "lab": 2,
    "title": "Histograms",
    "quizzes": 4,
    "webr_cells": 13,
    "shiny_blocks": 2
  },
  {
    "lab": 3,
    "title": "Box Plots",
    "quizzes": 28,
    "webr_cells": 5,
    "shiny_blocks": 2
  },
  {
    "lab": 4,
    "title": "Basic Data Analysis",
    "quizzes": 28,
    "webr_cells": 9,
    "shiny_blocks": 0
  },
  {
    "lab": 5,
    "title": "Life Tables",
    "quizzes": 20,
    "webr_cells": 0,
    "shiny_blocks": 6
  },
  {
    "lab": 6,
    "title": "Diagnostic and Screening Tests",
    "quizzes": 24,
    "webr_cells": 2,
    "shiny_blocks": 4
  },
  {
    "lab": 7,
    "title": "Discrete Distributions",
    "quizzes": 24,
    "webr_cells": 2,
    "shiny_blocks": 4
  },
  {
    "lab": 8,
    "title": "Normal Distribution",
    "quizzes": 22,
    "webr_cells": 0,
    "shiny_blocks": 6
  },
  {
    "lab": 9,
    "title": "Random Sampling and Central Limit Theorem",
    "quizzes": 34,
    "webr_cells": 0,
    "shiny_blocks": 7
  },
  {
    "lab": 10,
    "title": "One Sample T Methods",
    "quizzes": 26,
    "webr_cells": 7,
    "shiny_blocks": 2
  },
  {
    "lab": 11,
    "title": "Paired t Test",
    "quizzes": 20,
    "webr_cells": 3,
    "shiny_blocks": 2
  },
  {
    "lab": 12,
    "title": "Two Sample *t* Test",
    "quizzes": 20,
    "webr_cells": 4,
    "shiny_blocks": 4
  },
  {
    "lab": 13,
    "title": "Hypothesis Tests and Confidence Intervals for Proportions",
    "quizzes": 22,
    "webr_cells": 2,
    "shiny_blocks": 4
  }
]
```
