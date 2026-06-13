document.addEventListener("click", (event) => {
  const answer = event.target.closest(".lab-answer");
  const check = event.target.closest("[data-check-answers]");
  if (!answer && !check) return;

  const quiz = (answer || check).closest("[data-lab-quiz]");
  const feedback = quiz.querySelector(".lab-feedback");
  const isMulti = quiz.dataset.multiQuiz === "true";

  if (check) {
    const answers = Array.from(quiz.querySelectorAll(".lab-answer"));
    const selected = answers.filter((button) => button.classList.contains("selected"));
    const correct = answers.filter((button) => button.dataset.correct === "true");
    const isCorrect = selected.length === correct.length
      && correct.every((button) => button.classList.contains("selected"));

    answers.forEach((button) => {
      const selectedButton = button.classList.contains("selected");
      button.classList.toggle("correct", selectedButton && button.dataset.correct === "true");
      button.classList.toggle("incorrect", selectedButton && button.dataset.correct !== "true");
    });

    feedback.textContent = isCorrect
      ? (quiz.dataset.correctFeedback || "Correct. You selected all of the correct answers.")
      : (quiz.dataset.incorrectFeedback || "Try again. Select all of the correct answers and leave the incorrect answers unselected.");
    feedback.classList.toggle("correct", isCorrect);
    feedback.classList.toggle("incorrect", !isCorrect);
    return;
  }

  const isCorrect = answer.dataset.correct === "true";

  if (isMulti) {
    const selected = !answer.classList.contains("selected");
    answer.classList.toggle("selected", selected);
    answer.classList.remove("correct", "incorrect");
    answer.setAttribute("aria-pressed", selected ? "true" : "false");
    feedback.textContent = "Selection updated. Use Check Answers when you are ready.";
    feedback.classList.remove("correct", "incorrect");
    return;
  }

  quiz.querySelectorAll(".lab-answer").forEach((button) => {
    button.classList.remove("selected", "correct", "incorrect");
    button.setAttribute("aria-pressed", "false");
  });

  answer.classList.add("selected", isCorrect ? "correct" : "incorrect");
  answer.setAttribute("aria-pressed", "true");
  feedback.textContent = `${isCorrect ? "Correct." : "Try again."} ${answer.dataset.feedback || ""}`.trim();
  feedback.classList.toggle("correct", isCorrect);
  feedback.classList.toggle("incorrect", !isCorrect);
});

const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }

  const headers = rows.shift() || [];
  return rows.map((cells) => Object.fromEntries(headers.map((header, index) => [header || "x", cells[index] ?? ""])));
};

const fetchCsv = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url}`);
  return parseCsv(await response.text());
};

const svgEl = (name, attrs = {}) => {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
};

const initFaithfulHistogram = async (root) => {
  const data = await fetchCsv(root.dataset.csv);
  const values = data.map((row) => Number(row.eruptions)).filter(Number.isFinite);
  const svg = root.querySelector("svg");
  const binsSelect = root.querySelector("[data-hist-bins]");
  const rugInput = root.querySelector("[data-hist-rug]");
  const densityInput = root.querySelector("[data-hist-density]");
  const bandwidthInput = root.querySelector("[data-hist-bandwidth]");
  const bandwidthOutput = root.querySelector("[data-hist-bandwidth-value]");
  const densityControl = root.querySelector("[data-density-control]");

  const width = 760;
  const height = 360;
  const margin = { top: 34, right: 24, bottom: 54, left: 60 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = 0.08;
  const xMin = min - pad;
  const xMax = max + pad;
  const xScale = (x) => margin.left + ((x - xMin) / (xMax - xMin)) * plotWidth;
  const gaussian = (x) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);

  const draw = () => {
    const binCount = Number(binsSelect.value);
    const showRug = rugInput.checked;
    const showDensity = densityInput.checked;
    const bandwidthAdjust = Number(bandwidthInput.value);
    if (bandwidthOutput) bandwidthOutput.value = bandwidthAdjust.toFixed(1);
    if (densityControl) densityControl.hidden = !showDensity;
    svg.replaceChildren();

    const binWidth = (xMax - xMin) / binCount;
    const bins = Array.from({ length: binCount }, (_, index) => ({
      x0: xMin + index * binWidth,
      x1: xMin + (index + 1) * binWidth,
      count: 0,
    }));

    values.forEach((value) => {
      const index = Math.min(Math.floor((value - xMin) / binWidth), binCount - 1);
      bins[Math.max(index, 0)].count += 1;
    });

    const densities = bins.map((bin) => bin.count / (values.length * binWidth));
    const baseBandwidth = 1.06 * standardDeviation(values) * values.length ** -0.2;
    const bandwidth = Math.max(baseBandwidth * bandwidthAdjust, 0.03);
    const densityPoints = Array.from({ length: 180 }, (_, index) => {
      const x = xMin + (index / 179) * (xMax - xMin);
      const y = values.reduce((sum, value) => sum + gaussian((x - value) / bandwidth), 0) / (values.length * bandwidth);
      return { x, y };
    });

    const yMax = Math.max(...densities, showDensity ? Math.max(...densityPoints.map((point) => point.y)) : 0) * 1.12;
    const yScale = (y) => margin.top + plotHeight - (y / yMax) * plotHeight;

    svg.appendChild(svgEl("rect", { x: 0, y: 0, width, height, fill: "#fff" }));
    svg.appendChild(svgEl("text", { x: width / 2, y: 22, "text-anchor": "middle", class: "lab-plot-title" })).textContent =
      "Geyser eruption duration";

    bins.forEach((bin) => {
      const density = bin.count / (values.length * binWidth);
      const x = xScale(bin.x0) + 1;
      const y = yScale(density);
      const rectWidth = Math.max(xScale(bin.x1) - xScale(bin.x0) - 2, 1);
      svg.appendChild(svgEl("rect", {
        x,
        y,
        width: rectWidth,
        height: margin.top + plotHeight - y,
        class: "lab-hist-bar",
      }));
    });

    if (showDensity) {
      const path = densityPoints.map((point, index) => `${index === 0 ? "M" : "L"} ${xScale(point.x).toFixed(2)} ${yScale(point.y).toFixed(2)}`).join(" ");
      svg.appendChild(svgEl("path", { d: path, class: "lab-density-line" }));
    }

    if (showRug) {
      values.forEach((value) => {
        svg.appendChild(svgEl("line", {
          x1: xScale(value),
          x2: xScale(value),
          y1: margin.top + plotHeight,
          y2: margin.top + plotHeight + 8,
          class: "lab-rug-line",
        }));
      });
    }

    drawAxes(svg, { width, height, margin, plotWidth, plotHeight, xMin, xMax, yMax, xScale, yScale });
  };

  [binsSelect, rugInput, densityInput, bandwidthInput].forEach((control) => control.addEventListener("input", draw));
  draw();
};

const standardDeviation = (values) => {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
};

const quantile = (values, probability) => {
  const sorted = values.slice().sort((a, b) => a - b);
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const weight = position - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
};

const drawAxes = (svg, scales) => {
  const {
    width,
    height,
    margin,
    plotHeight,
    xMin,
    xMax,
    yMax,
    xScale,
    yScale,
    xTitle = "Duration (minutes)",
    yTitle = "Density",
    xFormat = (value) => value.toFixed(1),
    yFormat = (value) => value.toFixed(2),
  } = scales;
  const axisColor = "#2f3944";
  svg.appendChild(svgEl("line", { x1: margin.left, x2: width - margin.right, y1: margin.top + plotHeight, y2: margin.top + plotHeight, stroke: axisColor }));
  svg.appendChild(svgEl("line", { x1: margin.left, x2: margin.left, y1: margin.top, y2: margin.top + plotHeight, stroke: axisColor }));

  for (let index = 0; index <= 5; index += 1) {
    const x = xMin + ((xMax - xMin) * index) / 5;
    const screenX = xScale(x);
    svg.appendChild(svgEl("line", { x1: screenX, x2: screenX, y1: margin.top + plotHeight, y2: margin.top + plotHeight + 5, stroke: axisColor }));
    svg.appendChild(svgEl("text", { x: screenX, y: height - 28, "text-anchor": "middle", class: "lab-axis-label" })).textContent = xFormat(x);
  }

  for (let index = 0; index <= 4; index += 1) {
    const y = (yMax * index) / 4;
    const screenY = yScale(y);
    svg.appendChild(svgEl("line", { x1: margin.left - 5, x2: margin.left, y1: screenY, y2: screenY, stroke: axisColor }));
    svg.appendChild(svgEl("text", { x: margin.left - 10, y: screenY + 4, "text-anchor": "end", class: "lab-axis-label" })).textContent = yFormat(y);
  }

  svg.appendChild(svgEl("text", { x: width / 2, y: height - 7, "text-anchor": "middle", class: "lab-axis-title" })).textContent = xTitle;
  const yTitleElement = svgEl("text", { x: 16, y: height / 2, "text-anchor": "middle", class: "lab-axis-title", transform: `rotate(-90 16 ${height / 2})` });
  yTitleElement.textContent = yTitle;
  svg.appendChild(yTitleElement);
};

const initHeartHistogram = async (root) => {
  const data = await fetchCsv(root.dataset.csv);
  const svg = root.querySelector("svg");
  const binsInput = root.querySelector("[data-heart-hist-bins]");
  const binsOutput = root.querySelector("[data-heart-hist-bins-value]");
  const variableSelect = root.querySelector("[data-heart-hist-variable]");
  const columns = Object.keys(data[0] || {}).filter((column) => (
    data.some((row) => Number.isFinite(Number(row[column])))
  ));

  variableSelect.replaceChildren(...columns.map((column) => new Option(column, column)));
  variableSelect.value = columns.includes("age") ? "age" : columns[0];

  const width = 760;
  const height = 360;
  const margin = { top: 34, right: 24, bottom: 54, left: 60 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const draw = () => {
    const variable = variableSelect.value;
    const values = data.map((row) => Number(row[variable])).filter(Number.isFinite);
    const binCount = Number(binsInput.value);
    if (binsOutput) binsOutput.value = binCount;
    svg.replaceChildren();

    let min = Math.min(...values);
    let max = Math.max(...values);
    if (!Number.isFinite(min) || !Number.isFinite(max)) return;
    if (min === max) {
      min -= 0.5;
      max += 0.5;
    }

    const pad = (max - min) * 0.04;
    const xMin = min - pad;
    const xMax = max + pad;
    const binWidth = (xMax - xMin) / binCount;
    const bins = Array.from({ length: binCount }, (_, index) => ({
      x0: xMin + index * binWidth,
      x1: xMin + (index + 1) * binWidth,
      count: 0,
    }));

    values.forEach((value) => {
      const index = Math.min(Math.floor((value - xMin) / binWidth), binCount - 1);
      bins[Math.max(index, 0)].count += 1;
    });

    const yMax = Math.max(...bins.map((bin) => bin.count), 1) * 1.12;
    const xScale = (x) => margin.left + ((x - xMin) / (xMax - xMin)) * plotWidth;
    const yScale = (y) => margin.top + plotHeight - (y / yMax) * plotHeight;

    svg.appendChild(svgEl("rect", { x: 0, y: 0, width, height, fill: "#fff" }));
    svg.appendChild(svgEl("text", { x: width / 2, y: 22, "text-anchor": "middle", class: "lab-plot-title" })).textContent =
      `Heart failure data: ${variable}`;

    bins.forEach((bin) => {
      const x = xScale(bin.x0) + 1;
      const y = yScale(bin.count);
      const rectWidth = Math.max(xScale(bin.x1) - xScale(bin.x0) - 2, 1);
      svg.appendChild(svgEl("rect", {
        x,
        y,
        width: rectWidth,
        height: margin.top + plotHeight - y,
        class: "lab-hist-bar",
      }));
    });

    drawAxes(svg, {
      width,
      height,
      margin,
      plotHeight,
      xMin,
      xMax,
      yMax,
      xScale,
      yScale,
      xTitle: variable,
      yTitle: "Count",
      xFormat: (value) => Number.isInteger(value) ? String(value) : value.toFixed(1),
      yFormat: (value) => String(Math.round(value)),
    });
  };

  [binsInput, variableSelect].forEach((control) => control.addEventListener("input", draw));
  draw();
};

const heartPlotLabels = {
  group: {
    sex: "Sex",
    fbs: "Fasting blood sugar > 120 mg/dl",
    exang: "Exercise induced angina",
  },
  variable: {
    age: "Age (years)",
    chol: "Serum cholesterol (mg/dl)",
    trestbps: "Resting blood pressure (mm Hg)",
    thalach: "Maximum heart rate achieved",
    oldpeak: "ST depression induced by exercise relative to rest",
  },
  values: {
    sex: { 0: "Female", 1: "Male" },
    fbs: { 0: "No", 1: "Yes" },
    exang: { 0: "No", 1: "Yes" },
  },
};

const boxStats = (values) => {
  const sorted = values.slice().sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25);
  const median = quantile(sorted, 0.5);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;
  const nonOutliers = sorted.filter((value) => value >= lowerFence && value <= upperFence);

  return {
    min: nonOutliers[0] ?? sorted[0],
    q1,
    median,
    q3,
    max: nonOutliers[nonOutliers.length - 1] ?? sorted[sorted.length - 1],
    outliers: sorted.filter((value) => value < lowerFence || value > upperFence),
  };
};

const initHeartBoxplot = async (root) => {
  const data = await fetchCsv(root.dataset.csv);
  const svg = root.querySelector("svg");
  const groupSelect = root.querySelector("[data-heart-boxplot-group]");
  const variableSelect = root.querySelector("[data-heart-boxplot-variable]");

  const width = 760;
  const height = 380;
  const margin = { top: 42, right: 28, bottom: 78, left: 74 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const draw = () => {
    const groupColumn = groupSelect.value;
    const variable = variableSelect.value;
    const groups = [...new Set(data.map((row) => row[groupColumn]))].sort((a, b) => Number(a) - Number(b));
    const summaries = groups.map((group) => {
      const values = data
        .filter((row) => row[groupColumn] === group)
        .map((row) => Number(row[variable]))
        .filter(Number.isFinite);
      return { group, values, stats: boxStats(values) };
    }).filter((summary) => summary.values.length > 0);

    const allValues = summaries.flatMap((summary) => [...summary.values, ...summary.stats.outliers]);
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const pad = Math.max((max - min) * 0.08, 1);
    const yMin = min - pad;
    const yMax = max + pad;
    const yScale = (value) => margin.top + plotHeight - ((value - yMin) / (yMax - yMin)) * plotHeight;
    const xStep = plotWidth / summaries.length;
    const xFor = (index) => margin.left + xStep * index + xStep / 2;
    const axisColor = "#2f3944";

    svg.replaceChildren();
    svg.appendChild(svgEl("rect", { x: 0, y: 0, width, height, fill: "#fff" }));
    svg.appendChild(svgEl("text", { x: width / 2, y: 24, "text-anchor": "middle", class: "lab-plot-title" })).textContent =
      `${heartPlotLabels.variable[variable]} by ${heartPlotLabels.group[groupColumn]}`;

    svg.appendChild(svgEl("line", { x1: margin.left, x2: width - margin.right, y1: margin.top + plotHeight, y2: margin.top + plotHeight, stroke: axisColor }));
    svg.appendChild(svgEl("line", { x1: margin.left, x2: margin.left, y1: margin.top, y2: margin.top + plotHeight, stroke: axisColor }));

    for (let index = 0; index <= 5; index += 1) {
      const value = yMin + ((yMax - yMin) * index) / 5;
      const y = yScale(value);
      svg.appendChild(svgEl("line", { x1: margin.left - 5, x2: margin.left, y1: y, y2: y, stroke: axisColor }));
      svg.appendChild(svgEl("text", { x: margin.left - 10, y: y + 4, "text-anchor": "end", class: "lab-axis-label" })).textContent =
        Math.abs(value) >= 10 ? value.toFixed(0) : value.toFixed(1);
    }

    summaries.forEach((summary, index) => {
      const x = xFor(index);
      const boxWidth = Math.min(120, xStep * 0.42);
      const whiskerWidth = boxWidth * 0.55;
      const { min: whiskerMin, q1, median, q3, max: whiskerMax, outliers } = summary.stats;

      svg.appendChild(svgEl("line", { x1: x, x2: x, y1: yScale(whiskerMin), y2: yScale(whiskerMax), class: "lab-box-whisker" }));
      svg.appendChild(svgEl("line", { x1: x - whiskerWidth / 2, x2: x + whiskerWidth / 2, y1: yScale(whiskerMin), y2: yScale(whiskerMin), class: "lab-box-whisker" }));
      svg.appendChild(svgEl("line", { x1: x - whiskerWidth / 2, x2: x + whiskerWidth / 2, y1: yScale(whiskerMax), y2: yScale(whiskerMax), class: "lab-box-whisker" }));
      svg.appendChild(svgEl("rect", {
        x: x - boxWidth / 2,
        y: yScale(q3),
        width: boxWidth,
        height: Math.max(yScale(q1) - yScale(q3), 1),
        class: "lab-box-rect",
      }));
      svg.appendChild(svgEl("line", { x1: x - boxWidth / 2, x2: x + boxWidth / 2, y1: yScale(median), y2: yScale(median), class: "lab-box-median" }));

      outliers.forEach((value, outlierIndex) => {
        const jitter = ((outlierIndex % 5) - 2) * 4;
        svg.appendChild(svgEl("circle", { cx: x + jitter, cy: yScale(value), r: 3.5, class: "lab-box-outlier" }));
      });

      const label = heartPlotLabels.values[groupColumn]?.[summary.group] || summary.group;
      svg.appendChild(svgEl("text", { x, y: height - 46, "text-anchor": "middle", class: "lab-axis-label" })).textContent = label;
      svg.appendChild(svgEl("text", { x, y: height - 30, "text-anchor": "middle", class: "lab-axis-label" })).textContent = `n=${summary.values.length}`;
    });

    const yTitle = svgEl("text", { x: 18, y: height / 2, "text-anchor": "middle", class: "lab-axis-title", transform: `rotate(-90 18 ${height / 2})` });
    yTitle.textContent = heartPlotLabels.variable[variable];
    svg.appendChild(yTitle);
    svg.appendChild(svgEl("text", { x: width / 2, y: height - 8, "text-anchor": "middle", class: "lab-axis-title" })).textContent =
      heartPlotLabels.group[groupColumn];
  };

  [groupSelect, variableSelect].forEach((control) => control.addEventListener("input", draw));
  draw();
};

const lineColors = [
  "#1455a0",
  "#b42318",
  "#177245",
  "#7c3aed",
  "#b45309",
  "#0f766e",
  "#be123c",
  "#4b5563",
  "#2563eb",
  "#9333ea",
  "#15803d",
  "#c2410c",
];

const linePath = (points, xScale, yScale) => points
  .map((point, index) => `${index === 0 ? "M" : "L"} ${xScale(point.x).toFixed(2)} ${yScale(point.y).toFixed(2)}`)
  .join(" ");

const drawLinePlot = (svg, config) => {
  const {
    title,
    xTitle,
    yTitle,
    series,
    xMin,
    xMax,
    yMin,
    yMax,
    xFormat = (value) => String(Math.round(value)),
    yFormat = (value) => value.toFixed(2),
  } = config;
  const width = 760;
  const height = Number(svg.getAttribute("viewBox")?.split(" ")[3]) || 420;
  const margin = { top: 42, right: 28, bottom: 92, left: 70 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const xSpan = xMax === xMin ? 1 : xMax - xMin;
  const ySpan = yMax === yMin ? 1 : yMax - yMin;
  const xScale = (value) => margin.left + ((value - xMin) / xSpan) * plotWidth;
  const yScale = (value) => margin.top + plotHeight - ((value - yMin) / ySpan) * plotHeight;
  const axisColor = "#2f3944";

  svg.replaceChildren();
  svg.appendChild(svgEl("rect", { x: 0, y: 0, width, height, fill: "#fff" }));
  svg.appendChild(svgEl("text", { x: width / 2, y: 24, "text-anchor": "middle", class: "lab-plot-title" })).textContent = title;
  svg.appendChild(svgEl("line", { x1: margin.left, x2: width - margin.right, y1: margin.top + plotHeight, y2: margin.top + plotHeight, stroke: axisColor }));
  svg.appendChild(svgEl("line", { x1: margin.left, x2: margin.left, y1: margin.top, y2: margin.top + plotHeight, stroke: axisColor }));

  for (let index = 0; index <= 5; index += 1) {
    const x = xMin + (xSpan * index) / 5;
    const screenX = xScale(x);
    svg.appendChild(svgEl("line", { x1: screenX, x2: screenX, y1: margin.top + plotHeight, y2: margin.top + plotHeight + 5, stroke: axisColor }));
    svg.appendChild(svgEl("text", { x: screenX, y: height - 58, "text-anchor": "middle", class: "lab-axis-label" })).textContent = xFormat(x);
  }

  for (let index = 0; index <= 4; index += 1) {
    const y = yMin + (ySpan * index) / 4;
    const screenY = yScale(y);
    svg.appendChild(svgEl("line", { x1: margin.left - 5, x2: margin.left, y1: screenY, y2: screenY, stroke: axisColor }));
    svg.appendChild(svgEl("text", { x: margin.left - 10, y: screenY + 4, "text-anchor": "end", class: "lab-axis-label" })).textContent = yFormat(y);
  }

  series.forEach((item, index) => {
    const color = lineColors[index % lineColors.length];
    svg.appendChild(svgEl("path", {
      d: linePath(item.points, xScale, yScale),
      class: "lab-line-path",
      stroke: color,
    }));
    item.points.forEach((point) => {
      svg.appendChild(svgEl("circle", {
        cx: xScale(point.x),
        cy: yScale(point.y),
        r: 2.6,
        class: "lab-line-point",
        fill: color,
      }));
    });
  });

  svg.appendChild(svgEl("text", { x: width / 2, y: height - 30, "text-anchor": "middle", class: "lab-axis-title" })).textContent = xTitle;
  const yTitleElement = svgEl("text", { x: 18, y: height / 2, "text-anchor": "middle", class: "lab-axis-title", transform: `rotate(-90 18 ${height / 2})` });
  yTitleElement.textContent = yTitle;
  svg.appendChild(yTitleElement);

  const legend = svgEl("g", { class: "lab-legend" });
  series.slice(0, 8).forEach((item, index) => {
    const x = margin.left + (index % 2) * 315;
    const y = height - 74 + Math.floor(index / 2) * 16;
    const color = lineColors[index % lineColors.length];
    legend.appendChild(svgEl("line", { x1: x, x2: x + 20, y1: y - 4, y2: y - 4, stroke: color, "stroke-width": 3 }));
    legend.appendChild(svgEl("text", { x: x + 26, y, class: "lab-axis-label" })).textContent = item.label;
  });
  svg.appendChild(legend);
};

const initLifeExpectancy = async (root) => {
  const data = await fetchCsv(root.dataset.csv);
  const svg = root.querySelector("svg");
  const startInput = root.querySelector("[data-life-start]");
  const endInput = root.querySelector("[data-life-end]");
  const startOutput = root.querySelector("[data-life-start-value]");
  const endOutput = root.querySelector("[data-life-end-value]");
  const seriesInputs = Array.from(root.querySelectorAll("[data-life-series]"));

  const draw = () => {
    let start = Number(startInput.value);
    let end = Number(endInput.value);
    if (start > end) [start, end] = [end, start];
    startOutput.value = start;
    endOutput.value = end;
    const selected = seriesInputs.filter((input) => input.checked).map((input) => input.value);
    const rows = data
      .map((row) => ({ ...row, Year: Number(row.Year) }))
      .filter((row) => row.Year >= start && row.Year <= end);

    if (selected.length === 0 || rows.length === 0) {
      svg.replaceChildren(svgEl("text", { x: 380, y: 210, "text-anchor": "middle", class: "lab-plot-title" }));
      svg.firstChild.textContent = "Select at least one life expectancy series.";
      return;
    }

    const series = selected.map((column) => ({
      label: column,
      points: rows.map((row) => ({ x: row.Year, y: Number(row[column]) })).filter((point) => Number.isFinite(point.y)),
    }));
    const allY = series.flatMap((item) => item.points.map((point) => point.y));
    const yMin = Math.floor(Math.min(...allY) / 5) * 5;
    const yMax = Math.ceil(Math.max(...allY) / 5) * 5;

    drawLinePlot(svg, {
      title: `Life Expectancy at Birth in the US (${start}-${end})`,
      xTitle: "Year",
      yTitle: "Life Expectancy at Birth (years)",
      series,
      xMin: start,
      xMax: end,
      yMin,
      yMax,
      yFormat: (value) => value.toFixed(0),
    });
  };

  [startInput, endInput, ...seriesInputs].forEach((control) => control.addEventListener("input", draw));
  draw();
};

const checkboxControl = (name, value, checked) => {
  const label = document.createElement("label");
  label.className = "lab-check";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.name = name;
  input.value = value;
  input.checked = checked;
  label.append(input, ` ${value}`);
  return label;
};

const initLifeTableCurve = async (root) => {
  const data = (await fetchCsv(root.dataset.csv)).map((row) => ({
    ...row,
    Age: Number(row.Age),
    Year: Number(row.Year),
    SurvivalP: Number(row.SurvivalP),
    qx: Number(row.qx),
  }));
  const svg = root.querySelector("svg");
  const controls = root.querySelector("[data-life-table-controls]");
  const years = [...new Set(data.map((row) => row.Year))].sort((a, b) => a - b);
  const strata = [...new Set(data.map((row) => row["Race.Sex"]))];

  const yearBox = document.createElement("fieldset");
  yearBox.className = "lab-check-group";
  yearBox.appendChild(Object.assign(document.createElement("legend"), { textContent: "Years" }));
  years.forEach((year) => yearBox.appendChild(checkboxControl("year", year, year === 1900 || year === 2015)));

  const strataBox = document.createElement("fieldset");
  strataBox.className = "lab-check-group";
  strataBox.appendChild(Object.assign(document.createElement("legend"), { textContent: "Groups" }));
  strata.forEach((group) => strataBox.appendChild(checkboxControl("strata", group, group === "All")));
  controls.append(yearBox, strataBox);

  const draw = () => {
    const selectedYears = Array.from(yearBox.querySelectorAll("input:checked")).map((input) => Number(input.value));
    const selectedStrata = Array.from(strataBox.querySelectorAll("input:checked")).slice(0, 6).map((input) => input.value);
    const yColumn = root.dataset.yColumn;
    const rows = data.filter((row) => selectedYears.includes(row.Year) && selectedStrata.includes(row["Race.Sex"]));

    if (rows.length === 0) {
      svg.replaceChildren(svgEl("text", { x: 380, y: 220, "text-anchor": "middle", class: "lab-plot-title" }));
      svg.firstChild.textContent = "Select at least one year and one group.";
      return;
    }

    const keys = [...new Set(rows.map((row) => `${row.Year}|${row["Race.Sex"]}`))];
    const series = keys.map((key) => {
      const [year, group] = key.split("|");
      return {
        label: `${year} ${group}`,
        points: rows
          .filter((row) => row.Year === Number(year) && row["Race.Sex"] === group)
          .sort((a, b) => a.Age - b.Age)
          .map((row) => ({ x: row.Age, y: row[yColumn] })),
      };
    });
    const allY = series.flatMap((item) => item.points.map((point) => point.y));
    const yMax = Math.max(...allY) * 1.08;

    drawLinePlot(svg, {
      title: root.dataset.title,
      xTitle: "Age",
      yTitle: root.dataset.yTitle,
      series,
      xMin: 0,
      xMax: 100,
      yMin: 0,
      yMax: yColumn === "SurvivalP" ? 1 : yMax,
      yFormat: (value) => yColumn === "SurvivalP" ? value.toFixed(2) : value.toFixed(3),
    });
  };

  controls.querySelectorAll("input").forEach((input) => input.addEventListener("input", draw));
  draw();
};

const initHeartTable = async (root) => {
  const data = await fetchCsv(root.dataset.csv);
  const columns = ["age", "sex", "trestbps", "chol", "fbs", "thalach", "exang", "oldpeak"];
  const filters = Array.from(root.querySelectorAll("[data-heart-filter]"));
  const count = root.querySelector("[data-heart-count]");
  const thead = root.querySelector("thead");
  const tbody = root.querySelector("tbody");
  const state = { sort: "age", direction: "desc" };

  filters.forEach((select) => {
    const column = select.dataset.heartFilter;
    const values = [...new Set(data.map((row) => row[column]))].sort((a, b) => Number(a) - Number(b));
    select.replaceChildren(new Option("All", "All"), ...values.map((value) => new Option(value, value)));
    select.addEventListener("change", render);
  });

  const headerRow = document.createElement("tr");
  columns.forEach((column) => {
    const th = document.createElement("th");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "lab-sort-button";
    button.textContent = column;
    button.title = `Sort by ${column}`;
    button.addEventListener("click", () => {
      if (state.sort === column) {
        state.direction = state.direction === "asc" ? "desc" : "asc";
      } else {
        state.sort = column;
        state.direction = "asc";
      }
      render();
    });
    th.appendChild(button);
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  function render() {
    const activeFilters = Object.fromEntries(filters.map((select) => [select.dataset.heartFilter, select.value]));
    const filtered = data
      .filter((row) => Object.entries(activeFilters).every(([column, value]) => value === "All" || row[column] === value))
      .sort((a, b) => {
        const left = Number(a[state.sort]);
        const right = Number(b[state.sort]);
        const result = Number.isFinite(left) && Number.isFinite(right)
          ? left - right
          : String(a[state.sort]).localeCompare(String(b[state.sort]));
        return state.direction === "asc" ? result : -result;
      });

    count.textContent = filtered.length === 0
      ? `Showing 0 of ${data.length} entries`
      : `Showing 1 to ${filtered.length} of ${data.length} entries`;
    root.querySelectorAll(".lab-sort-button").forEach((button) => {
      const active = button.textContent === state.sort;
      button.dataset.direction = active ? state.direction : "";
      button.setAttribute("aria-sort", active ? (state.direction === "asc" ? "ascending" : "descending") : "none");
    });

    tbody.replaceChildren(...filtered.map((row) => {
      const tr = document.createElement("tr");
      columns.forEach((column) => {
        const td = document.createElement("td");
        td.textContent = row[column];
        tr.appendChild(td);
      });
      return tr;
    }));
  }

  render();
};

const slugify = (value) => value
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/(^-|-$)/g, "");

const initGuidedLab = (marker) => {
  const content = marker.closest("main") || marker.parentElement;
  if (!content || marker.dataset.guidedReady === "true") return;
  marker.dataset.guidedReady = "true";

  const getTopicHeading = (candidate) => {
    if (candidate.tagName === "H2") return candidate;
    if (candidate.matches("section.level2")) return candidate.querySelector(":scope > h2");
    return null;
  };

  const topics = [];
  let node = marker.nextElementSibling;

  while (node) {
    const heading = getTopicHeading(node);

    if (heading && node.matches("section.level2")) {
      const section = node;
      section.classList.add("lab-topic");
      section.dataset.topicTitle = heading.textContent.trim();
      node = section.nextElementSibling;
      topics.push(section);
    } else if (heading) {
      const section = document.createElement("section");
      section.className = "lab-topic";
      section.dataset.topicTitle = heading.textContent.trim();
      section.id = `topic-${heading.id || slugify(section.dataset.topicTitle)}`;
      content.insertBefore(section, heading);

      let cursor = heading;
      do {
        const nextSibling = cursor.nextElementSibling;
        section.appendChild(cursor);
        cursor = nextSibling;
      } while (cursor && !getTopicHeading(cursor));

      node = cursor;
      topics.push(section);
    } else {
      node = node.nextElementSibling;
    }
  }

  if (topics.length < 2) return;

  document.body.classList.add("lab-guided-page");

  const guide = document.createElement("nav");
  guide.className = "lab-guide";
  guide.setAttribute("aria-label", "Lab topics");

  const status = document.createElement("div");
  status.className = "lab-guide-status";

  const title = document.createElement("strong");
  title.textContent = marker.dataset.labTitle || "Lab";

  const progressText = document.createElement("span");
  const progressTrack = document.createElement("div");
  progressTrack.className = "lab-guide-progress";
  const progressBar = document.createElement("div");
  progressTrack.appendChild(progressBar);
  status.append(title, progressText, progressTrack);

  const topicList = document.createElement("div");
  topicList.className = "lab-topic-list";

  const buttons = topics.map((section, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "lab-topic-button";
    button.textContent = section.dataset.topicTitle;
    button.addEventListener("click", () => showTopic(index, true));
    topicList.appendChild(button);
    return button;
  });

  const footer = document.createElement("div");
  footer.className = "lab-topic-footer";
  const previous = document.createElement("button");
  previous.type = "button";
  previous.className = "lab-topic-nav";
  previous.textContent = "Previous Topic";
  const next = document.createElement("button");
  next.type = "button";
  next.className = "lab-topic-nav primary";
  next.textContent = "Next Topic";
  footer.append(previous, next);

  guide.append(status, topicList);
  marker.replaceWith(guide);

  const visited = new Set();
  let current = 0;

  function scrollToTopicStart(section) {
    const heading = section.querySelector("h2") || section;
    const navbar = document.querySelector("#quarto-header");
    const offset = (navbar?.offsetHeight || 0) + guide.offsetHeight + 20;
    const top = heading.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(top, 0), behavior: "smooth" });
  }

  function showTopic(index, updateHash = false) {
    current = Math.min(Math.max(index, 0), topics.length - 1);
    visited.add(current);

    topics.forEach((section, topicIndex) => {
      section.hidden = topicIndex !== current;
      section.classList.toggle("active", topicIndex === current);
    });

    buttons.forEach((button, topicIndex) => {
      const active = topicIndex === current;
      button.classList.toggle("active", active);
      button.classList.toggle("visited", visited.has(topicIndex));
      button.setAttribute("aria-current", active ? "step" : "false");
    });

    progressText.textContent = `Topic ${current + 1} of ${topics.length}`;
    progressBar.style.width = `${((visited.size) / topics.length) * 100}%`;
    previous.disabled = current === 0;
    next.textContent = current === topics.length - 1 ? "Finish Lab" : "Next Topic";
    topics[current].appendChild(footer);

    if (updateHash) {
      const heading = topics[current].querySelector("h2");
      history.replaceState(null, "", `#${heading.id || topics[current].id}`);
      requestAnimationFrame(() => scrollToTopicStart(topics[current]));
    }
  }

  previous.addEventListener("click", () => showTopic(current - 1, true));
  next.addEventListener("click", () => {
    if (current === topics.length - 1) {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    } else {
      showTopic(current + 1, true);
    }
  });

  const hash = decodeURIComponent(window.location.hash.replace(/^#/, ""));
  const normalizedHash = hash.replace(/^section-/, "");
  const initialIndex = topics.findIndex((section) => {
    const heading = section.querySelector("h2");
    return heading && (heading.id === hash || heading.id === normalizedHash || section.id === hash);
  });

  showTopic(initialIndex >= 0 ? initialIndex : 0, false);
};

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-guided-lab]").forEach(initGuidedLab);

  document.querySelectorAll("[data-faithful-histogram]").forEach((root) => {
    initFaithfulHistogram(root).catch((error) => root.insertAdjacentHTML("beforeend", `<p class="lab-widget-error">${error.message}</p>`));
  });

  document.querySelectorAll("[data-heart-table]").forEach((root) => {
    initHeartTable(root).catch((error) => root.insertAdjacentHTML("beforeend", `<p class="lab-widget-error">${error.message}</p>`));
  });

  document.querySelectorAll("[data-heart-histogram]").forEach((root) => {
    initHeartHistogram(root).catch((error) => root.insertAdjacentHTML("beforeend", `<p class="lab-widget-error">${error.message}</p>`));
  });

  document.querySelectorAll("[data-heart-boxplot]").forEach((root) => {
    initHeartBoxplot(root).catch((error) => root.insertAdjacentHTML("beforeend", `<p class="lab-widget-error">${error.message}</p>`));
  });

  document.querySelectorAll("[data-life-expectancy]").forEach((root) => {
    initLifeExpectancy(root).catch((error) => root.insertAdjacentHTML("beforeend", `<p class="lab-widget-error">${error.message}</p>`));
  });

  document.querySelectorAll("[data-life-table-curve]").forEach((root) => {
    initLifeTableCurve(root).catch((error) => root.insertAdjacentHTML("beforeend", `<p class="lab-widget-error">${error.message}</p>`));
  });
});
