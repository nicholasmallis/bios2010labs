#!/usr/bin/env python3
"""Convert the learnr lab Rmd files into Quarto/WebR lab pages."""

from __future__ import annotations

import html
import ast
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TUTORIALS = ROOT / "tutorials"
OUT = ROOT / "All_Labs"

LAB_PACKAGES = {
    3: ["ggplot2", "labelled"],
    4: ["ggplot2", "labelled", "tableone", "knitr"],
    5: ["ggplot2", "dplyr", "tidyr"],
    6: ["ggplot2", "plotROC", "pROC"],
    8: ["ggplot2"],
    9: ["ggplot2", "dplyr"],
    11: ["ggpubr"],
    12: ["ggplot2", "ggpubr", "datasauRus"],
}

HELPERS = r"""
quiet_library <- function(package) {
  suppressWarnings(suppressMessages(
    try(library(package, character.only = TRUE), silent = TRUE)
  ))
}

if (!exists("label", mode = "function")) {
  label <- function(x) {
    out <- attr(x, "label", exact = TRUE)
    if (is.null(out)) deparse(substitute(x)) else out
  }
}

if (!exists("var_label", mode = "function")) {
  var_label <- function(x) {
    out <- attr(x, "label", exact = TRUE)
    if (is.null(out)) deparse(substitute(x)) else out
  }
}

if (!exists("ggviolin", mode = "function")) {
  ggviolin <- function(data, x, y, fill = NULL, palette = NULL, add = NULL, add.params = list(), ...) {
    quiet_library("ggplot2")
    p <- ggplot2::ggplot(data, ggplot2::aes(x = .data[[x]], y = .data[[y]], fill = .data[[fill %||% x]])) +
      ggplot2::geom_violin(trim = FALSE, alpha = 0.7)
    if (!is.null(add) && "boxplot" %in% add) {
      p <- p + ggplot2::geom_boxplot(width = 0.12, fill = add.params$fill %||% "white", outlier.alpha = 0.35)
    }
    p
  }
}

if (!exists("ggpaired", mode = "function")) {
  ggpaired <- function(data, cond1, cond2, fill = NULL, line.color = "gray", line.size = 0.4, ...) {
    quiet_library("ggplot2")
    df <- data.frame(id = seq_len(nrow(data)), before = data[[cond1]], after = data[[cond2]])
    long <- rbind(
      data.frame(id = df$id, condition = cond1, value = df$before),
      data.frame(id = df$id, condition = cond2, value = df$after)
    )
    ggplot2::ggplot(long, ggplot2::aes(x = condition, y = value, group = id)) +
      ggplot2::geom_line(color = line.color, linewidth = line.size, alpha = 0.6) +
      ggplot2::geom_point(ggplot2::aes(fill = condition), shape = 21, size = 2)
  }
}

`%||%` <- function(x, y) if (is.null(x)) y else x
"""


def split_front_matter(text: str) -> tuple[dict[str, str], str]:
    if not text.startswith("---\n"):
        return {}, text
    end = text.find("\n---", 4)
    if end == -1:
        return {}, text
    raw = text[4:end]
    body = text[text.find("\n", end + 1) + 1 :]
    meta: dict[str, str] = {}
    for line in raw.splitlines():
        match = re.match(r"^([A-Za-z0-9_-]+):\s*['\"]?(.+?)['\"]?\s*$", line)
        if match:
            meta[match.group(1)] = match.group(2)
    return meta, body


def find_matching_paren(text: str, open_pos: int) -> int:
    depth = 0
    quote = None
    escape = False
    for index in range(open_pos, len(text)):
        char = text[index]
        if quote:
            if escape:
                escape = False
            elif char == "\\":
                escape = True
            elif char == quote:
                quote = None
            continue
        if char in ("'", '"'):
            quote = char
        elif char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
            if depth == 0:
                return index
    return -1


def find_calls(text: str, name: str) -> list[str]:
    calls: list[str] = []
    pattern = re.compile(rf"\b{name}\s*\(")
    pos = 0
    while True:
        match = pattern.search(text, pos)
        if not match:
            break
        open_pos = text.find("(", match.start())
        close_pos = find_matching_paren(text, open_pos)
        if close_pos == -1:
            break
        calls.append(text[open_pos + 1 : close_pos])
        pos = close_pos + 1
    return calls


def first_string(text: str) -> str:
    match = re.search(r"""(["'])((?:\\.|(?!\1).)*?)\1""", text, flags=re.S)
    if not match:
        return text.strip().split(",", 1)[0].strip()
    try:
        return ast.literal_eval(match.group(0))
    except (SyntaxError, ValueError):
        return match.group(2)


def named_string(text: str, name: str) -> str:
    match = re.search(rf"""{name}\s*=\s*(["'])((?:\\.|(?!\1).)*?)\1""", text, flags=re.S)
    if not match:
        return ""
    try:
        return ast.literal_eval(match.group(1) + match.group(2) + match.group(1))
    except (SyntaxError, ValueError):
        return match.group(2)


def markdownish(value: str) -> str:
    value = value.replace("__", "**")
    return value


def inline_html(value: str) -> str:
    value = html.escape(value)
    value = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", value)
    return value


def quiz_to_html(code: str) -> str:
    blocks = []
    for q_index, q_body in enumerate(find_calls(code, "question"), start=1):
        question = markdownish(first_string(q_body))
        answers = []
        for a_body in find_calls(q_body, "answer"):
            answers.append(
                {
                    "text": markdownish(first_string(a_body)),
                    "message": named_string(a_body, "message"),
                    "correct": bool(re.search(r"correct\s*=\s*T(RUE)?\b", a_body)),
                }
            )
        if not answers:
            continue
        correct_count = sum(1 for answer in answers if answer["correct"])
        answer_buttons = []
        for answer in answers:
            feedback = answer["message"] or ("Correct." if answer["correct"] else "Try again.")
            answer_buttons.append(
                "<button type=\"button\" class=\"lab-answer\" "
                f"data-correct=\"{str(answer['correct']).lower()}\" "
                f"data-feedback=\"{html.escape(feedback, quote=True)}\">"
                f"{inline_html(answer['text'])}</button>"
            )
        multi = " Select all correct answers." if correct_count > 1 else ""
        note = f"<p class=\"quiz-note\">{multi}</p>" if multi else ""
        blocks.append(
            "<section class=\"lab-quiz\" data-lab-quiz>"
            f"<h4>Question {q_index}</h4>"
            f"<p>{inline_html(question)}</p>"
            f"{note}"
        )
        blocks.append("<div class=\"lab-answers\">" + "\n".join(answer_buttons) + "</div>")
        blocks.append("<div class=\"lab-feedback\" aria-live=\"polite\"></div></section>")
    return "\n".join(blocks) if blocks else "::: {.callout-warning}\nCould not convert this quiz automatically.\n:::"


CHUNK_RE = re.compile(r"^```\{r([^}]*)\}\s*\n(.*?)^```\s*$", re.M | re.S)


def transform_paths(code: str, lab: int) -> str:
    code = code.replace("./www/", f"tutorials/Lab{lab}/www/")
    code = code.replace('"www/', f'"tutorials/Lab{lab}/www/')
    code = code.replace("'www/", f"'tutorials/Lab{lab}/www/")
    code = code.replace("./images/", f"../tutorials/Lab{lab}/images/")
    return code


def convert_chunk(options: str, code: str, lab: int, setup_chunks: list[str]) -> str:
    opt = options.strip()
    code = transform_paths(code, lab).strip("\n")

    if "quiz(" in code:
        return quiz_to_html(code)

    image_match = re.search(r'knitr::include_graphics\(["\'](.+?)["\']\)', code)
    if image_match:
        image_path = image_match.group(1).replace("./images/", f"../tutorials/Lab{lab}/images/")
        return f"![]({image_path})"

    if "include=FALSE" in opt or 'context="data"' in opt or "context='data'" in opt:
        cleaned = re.sub(r"library\(iblir\)\s*", "", code)
        cleaned = re.sub(r"knitr::opts_chunk\$set\(.*?\)\s*", "", cleaned, flags=re.S)
        if cleaned.strip():
            setup_chunks.append(cleaned.strip())
        return ""

    if 'context="server"' in opt or "context='server'" in opt:
        return (
            "\n\n::: {.callout-note collapse=\"true\"}\n"
            "## Original Shiny server logic\n\n"
            "This code is retained for migration reference. The static replacement should run in the browser without a Shiny server.\n\n"
            "```r\n"
            f"{code}\n"
            "```\n"
            ":::\n\n"
        )

    if 'context="render"' in opt or "context='render'" in opt or 'contex="render"' in opt:
        return (
            "\n\n::: {.callout-note collapse=\"true\"}\n"
            "## Original Shiny interface\n\n"
            "This widget needs a browser-side replacement in WebR or JavaScript.\n\n"
            "```r\n"
            f"{code}\n"
            "```\n"
            ":::\n\n"
        )

    is_exercise = "exercise=TRUE" in opt or "exercise = TRUE" in opt
    is_eval_false = "eval=FALSE" in opt or "eval = FALSE" in opt
    engine = "webr" if is_exercise or not is_eval_false else "r"
    if engine == "webr":
        lines = ["```{webr}", "#| edit: true", "#| min-lines: 4"]
        if not is_exercise:
            lines.append("#| autorun: false")
        return "\n".join(lines) + f"\n{code}\n```"
    return f"```r\n{code}\n```"


def convert_lab(lab: int) -> tuple[str, dict[str, object]]:
    src = TUTORIALS / f"Lab{lab}" / f"Lab{lab}.Rmd"
    meta, body = split_front_matter(src.read_text())
    title = meta.get("title", f"Lab {lab}")
    subtitle = meta.get("subtitle", "")
    setup_chunks: list[str] = []
    report = {"lab": lab, "title": title, "quizzes": 0, "webr_cells": 0, "shiny_blocks": 0}

    body = re.sub(r"\s*\{data-progressive=TRUE\}", "", body)

    def repl(match: re.Match[str]) -> str:
        options = match.group(1)
        code = match.group(2)
        converted = convert_chunk(options, code, lab, setup_chunks)
        if "lab-quiz" in converted:
            report["quizzes"] = int(report["quizzes"]) + converted.count("lab-quiz")
        if "```{webr}" in converted:
            report["webr_cells"] = int(report["webr_cells"]) + 1
        if "Original Shiny" in converted:
            report["shiny_blocks"] = int(report["shiny_blocks"]) + 1
        return converted

    converted_body = CHUNK_RE.sub(repl, body)
    converted_body = converted_body.replace('src="./images/', f'src="../tutorials/Lab{lab}/images/')
    converted_body = converted_body.replace("src='./images/", f"src='../tutorials/Lab{lab}/images/")
    converted_body = re.sub(r"\n{3,}", "\n\n", converted_body).strip() + "\n"

    packages = LAB_PACKAGES.get(lab, [])
    pkg_yaml = "\n".join(f"    - {pkg}" for pkg in packages)
    resources = sorted(str(p.relative_to(ROOT)) for p in (TUTORIALS / f"Lab{lab}" / "www").glob("*"))
    res_yaml = "\n".join(f"    - ../{resource}" for resource in resources)

    setup_code = "\n\n".join(setup_chunks)
    if packages:
        setup_code = "\n".join([f'quiet_library("{pkg}")' for pkg in packages]) + "\n\n" + setup_code
    setup_code = HELPERS.strip() + "\n\n" + setup_code

    header_lines = [
        "---",
        f'title: "Lab {lab}: {title}"',
    ]
    if subtitle:
        header_lines.append(f'subtitle: "{subtitle}"')
    header_lines.extend(
        [
            "format:",
            "  live-html:",
            "    include-after-body:",
            "      - ../lab-interactions-lab.html",
            "engine: knitr",
            "live:",
            "  show-hints: true",
            "  show-solutions: true",
            "webr:",
            "  render-df: paged-table",
        ]
    )
    if packages:
        header_lines.append("  packages:")
        header_lines.append(pkg_yaml)
    if resources:
        header_lines.append("  resources:")
        header_lines.append(res_yaml)
    header_lines.append("---")

    qmd = "\n".join(header_lines)
    qmd += "\n\n{{< include ../_extensions/r-wasm/live/_knitr.qmd >}}\n\n"
    qmd += "```{webr}\n#| edit: false\n#| output: false\n#| autorun: true\n"
    qmd += setup_code.strip() + "\n```\n\n"
    qmd += (
        "::: {.callout-tip}\n"
        "Run the R code cells directly in your browser. Use the quiz buttons for immediate feedback, then record your answers in eLC.\n"
        ":::\n\n"
    )
    qmd += converted_body
    return qmd, report


def main() -> None:
    OUT.mkdir(exist_ok=True)
    reports = []
    for lab in range(1, 14):
        qmd, report = convert_lab(lab)
        (OUT / f"lab{lab}.qmd").write_text(qmd)
        reports.append(report)

    report_lines = [
        "# Lab Site Migration TODO",
        "",
        "This file is generated from `scripts/convert_labs.py` and should be updated as hand fixes are made.",
        "",
        "## Current Pass",
        "",
        "- Installed and vendored the `r-wasm/quarto-live` extension.",
        "- Converted learnr exercise chunks into editable `{webr}` cells.",
        "- Converted learnr quiz blocks into static HTML quizzes with immediate feedback.",
        "- Preserved original Shiny render/server code in collapsed migration callouts where an exact static replacement still needs to be built.",
        "- Preloaded local `www` assets into WebR using the extension resource mechanism.",
        "",
        "## Lab Inventory",
        "",
        "| Lab | Title | WebR cells | Quiz blocks | Shiny migration blocks |",
        "| --- | --- | ---: | ---: | ---: |",
    ]
    for item in reports:
        report_lines.append(
            f"| {item['lab']} | {item['title']} | {item['webr_cells']} | {item['quizzes']} | {item['shiny_blocks']} |"
        )
    report_lines.extend(
        [
            "",
            "## Remaining TODO",
            "",
            "- Replace collapsed Shiny migration callouts with native WebR/JavaScript controls for full parity.",
            "- Browser-test package-heavy labs, especially labs using `ggplot2`, `tableone`, `plotROC`, `pROC`, `ggpubr`, and `datasauRus`.",
            "- Add custom WebR grading blocks for code exercises where answer validation should go beyond successful execution.",
            "- Confirm GitHub Pages deployment path and resource loading after publishing.",
            "",
            "## Raw Conversion Summary",
            "",
            "```json",
            json.dumps(reports, indent=2),
            "```",
        ]
    )
    (ROOT / "MIGRATION_TODO.md").write_text("\n".join(report_lines) + "\n")


if __name__ == "__main__":
    main()
