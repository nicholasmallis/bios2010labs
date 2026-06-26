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
- 2026-06-12: Started the Lab 3 polish pass. Added the shared guided-lab layout, fixed quiz numbering, removed the leftover Shiny migration callouts, and replaced the grouped boxplot Shiny app with a browser-side boxplot widget.
- 2026-06-12: Started the Lab 4 polish pass. Added the shared guided-lab layout, fixed select-all quiz behavior for Questions 1-9, converted the remaining learnr question blocks, corrected quiz numbering through Question 16, and cleaned up a few student-facing typos.
- 2026-06-13: Started the Lab 5 polish pass. Added the shared guided-lab layout, converted the three Shiny plot activities into browser-side line chart widgets, exported the survival table to CSV for JavaScript plotting, and fixed quiz numbering through Question 10.
- 2026-06-14: Started the Lab 6 polish pass. Added the shared guided-lab layout, exported the diagnostic test data to CSV, replaced the ROC selector and cutoff slider Shiny activities with browser-side JavaScript widgets, fixed the select-all quiz behavior for Question 1, and corrected quiz numbering through Question 12.
- 2026-06-14: Cleaned up Lab 6 figure rendering by explicitly including the image resources and formatting the reference images as standalone centered figures.
- 2026-06-14: Fixed Lab 6 ROC and cutoff widget markup so Quarto renders the controls as real HTML instead of printing the nested controls as code text.
- 2026-06-14: Started the Lab 7 polish pass. Added the shared guided-lab layout, replaced the binomial and Poisson Shiny calculators with browser-side JavaScript distribution widgets, fixed select-all quiz behavior for Questions 7-8, corrected quiz numbering through Question 12, and restored the summary image.
- 2026-06-15: Began review pass starting with Lab 2. Made unsubmitted multi-answer quiz selections visibly blue so select-all questions show immediate feedback before the Check Answers button is used.
- 2026-06-15: During Lab 3 review, adjusted the browser-side grouped boxplot to better match the original Shiny style: white boxes, dark whiskers/median, small filled outlier dots, cleaner labels, and no extra in-plot title.
- 2026-06-15: During Lab 4 review, added a stable rendered Table 1 reference output after Exercise 4 so the tableone example matches the original browser experience even when the WebR output is inconsistent.
- 2026-06-15: Refined the Lab 4 Table 1 styling and fixed quiz feedback so answers with generic feedback no longer display duplicated "Correct." or "Try again." text.
- 2026-06-15: Removed generic Lab 4 answer-level feedback attributes so cached browsers cannot show duplicate "Correct." or "Try again." messages.
- 2026-06-15: Started the Lab 8 polish pass. Added the shared guided-lab layout, replaced the three normal distribution Shiny activities with browser-side JavaScript widgets, removed the Shiny migration callouts, corrected quiz numbering through Question 11, and removed generic answer-level feedback attributes.
- 2026-06-16: Refined Lab 8 Exercise 1 so the normal curve controls more closely match the original Shiny layout: three colored parameter panels, a separate X-axis panel, and a cleaner legend-under-plot display.
- 2026-06-22: Removed the leftover Lab 8 conversion tip callout from the top of the page for consistency with the other polished labs.
- 2026-06-22: Started the Lab 9 polish pass. Added the shared guided-lab layout, exported the UGA18 data and exact sample-summary data to CSV, replaced the distribution review, random sampling, varying sample-size, and CLT Shiny activities with browser-side JavaScript widgets, removed the Shiny migration callouts, corrected quiz numbering through Question 17, and removed generic answer-level feedback attributes.
- 2026-06-23: Started the Lab 10 polish pass. Added the shared guided-lab layout, replaced the NurseDiet Shiny summary app with a browser-side histogram/table/summary widget, removed the Shiny migration callouts, corrected quiz numbering through Question 13, removed generic answer-level feedback attributes, and cleaned up the summary image.
- 2026-06-23: Cleaned up Lab 10 Exercise 5 so hidden setup code for the ExcFat variable no longer appears as extra student-facing code cells.
- 2026-06-23: Started the Lab 11 polish pass. Added the shared guided-lab layout, exported the cleaned Tennis3 data for browser use, replaced the Tennis3 Shiny summary app with a browser-side histogram/table/summary widget, fixed the select-all quiz behavior, removed Shiny migration callouts, corrected quiz numbering through Question 10, removed generic answer-level feedback attributes, and cleaned up the summary image.
- 2026-06-24: Started the Lab 12 polish pass. Added the shared guided-lab layout, exported the Calf and Datasaurus data to CSV, replaced the calf feed summary and Datasaurus Shiny activities with browser-side JavaScript widgets, removed Shiny migration callouts, corrected quiz numbering through Question 10, removed generic answer-level feedback attributes, and cleaned up the summary image.
- 2026-06-25: Started the Lab 13 polish pass. Added the shared guided-lab layout, replaced the low birth weight and prison-data Shiny summary activities with browser-side JavaScript widgets, removed Shiny migration callouts, corrected quiz numbering through Question 11, removed generic answer-level feedback attributes, corrected the final two-proportion hypothesis labels, and cleaned up the summary image.

## Lab Inventory

| Lab | Title | WebR cells | Quiz blocks | Shiny migration blocks |
| --- | --- | ---: | ---: | ---: |
| 1 | Getting Started | 6 | 20 | 0 |
| 2 | Histograms | 8 | 8 | 0 |
| 3 | Box Plots | 5 | 14 | 0 |
| 4 | Basic Data Analysis | 9 | 16 | 0 |
| 5 | Life Tables | 0 | 10 | 0 |
| 6 | Diagnostic and Screening Tests | 2 | 12 | 0 |
| 7 | Discrete Distributions | 2 | 12 | 0 |
| 8 | Normal Distribution | 0 | 11 | 0 |
| 9 | Random Sampling and Central Limit Theorem | 0 | 17 | 0 |
| 10 | One Sample T Methods | 7 | 13 | 0 |
| 11 | Paired t Test | 3 | 10 | 0 |
| 12 | Two Sample *t* Test | 4 | 10 | 0 |
| 13 | Hypothesis Tests and Confidence Intervals for Proportions | 2 | 11 | 0 |

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
