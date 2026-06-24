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
  const prefix = isCorrect ? "Correct." : "Try again.";
  const detail = (answer.dataset.feedback || "").trim();
  const lowerDetail = detail.toLowerCase();
  const lowerPrefix = prefix.toLowerCase();
  feedback.textContent = lowerDetail === lowerPrefix
    ? prefix
    : lowerDetail.startsWith(`${lowerPrefix} `)
      ? detail
      : `${prefix} ${detail}`.trim();
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
    sex: "Sex of the patient",
    fbs: "Fasting blood sugar > 120 mg/dl",
    exang: "Exercise induced angina",
  },
  variable: {
    age: "Age (years)",
    chol: "Serum cholesterol (mg/dl)",
    trestbps: "Resting Blood Pressure (mm Hg)",
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
  const margin = { top: 28, right: 28, bottom: 76, left: 74 };
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
    svg.appendChild(svgEl("rect", {
      x: margin.left,
      y: margin.top,
      width: plotWidth,
      height: plotHeight,
      class: "lab-plot-frame",
    }));

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
        const jitterSeed = Math.sin((Number(summary.group) + 1) * 17.13 + value * 0.37 + outlierIndex * 4.91);
        const jitter = jitterSeed * Math.min(boxWidth * 0.04, 3);
        svg.appendChild(svgEl("circle", { cx: x + jitter, cy: yScale(value), r: 2.1, class: "lab-box-outlier" }));
      });

      const label = heartPlotLabels.values[groupColumn]?.[summary.group] || summary.group;
      svg.appendChild(svgEl("text", { x, y: height - 34, "text-anchor": "middle", class: "lab-axis-label" })).textContent = label;
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

const diagnosticTests = ["test1", "test2", "test3"];

const isDiseasePresent = (row) => row.disease_statusC === "Disease Present" || row.disease_status === "0";

const confusionForCutoff = (data, test, cutoff) => {
  const result = { tp: 0, fp: 0, fn: 0, tn: 0 };
  data.forEach((row) => {
    const value = Number(row[test]);
    if (!Number.isFinite(value)) return;
    const predictedDisease = value <= cutoff;
    const diseasePresent = isDiseasePresent(row);
    if (predictedDisease && diseasePresent) result.tp += 1;
    if (predictedDisease && !diseasePresent) result.fp += 1;
    if (!predictedDisease && diseasePresent) result.fn += 1;
    if (!predictedDisease && !diseasePresent) result.tn += 1;
  });
  return result;
};

const diagnosticMetrics = (confusion) => {
  const { tp, fp, fn, tn } = confusion;
  return {
    sensitivity: tp + fn > 0 ? tp / (tp + fn) : 0,
    specificity: tn + fp > 0 ? tn / (tn + fp) : 0,
    accuracy: tp + tn + fp + fn > 0 ? (tp + tn) / (tp + tn + fp + fn) : 0,
  };
};

const rocPointsForTest = (data, test) => {
  const values = [...new Set(data.map((row) => Number(row[test])).filter(Number.isFinite))].sort((a, b) => a - b);
  if (values.length === 0) return [];
  const thresholds = [values[0] - 0.01, ...values, values[values.length - 1] + 0.01];
  return thresholds.map((cutoff) => {
    const metrics = diagnosticMetrics(confusionForCutoff(data, test, cutoff));
    return {
      x: 1 - metrics.specificity,
      y: metrics.sensitivity,
      cutoff,
    };
  }).sort((a, b) => a.x - b.x || a.y - b.y);
};

const aucFromPoints = (points) => points.slice(1).reduce((area, point, index) => {
  const previous = points[index];
  return area + (point.x - previous.x) * ((point.y + previous.y) / 2);
}, 0);

const drawRocPlot = (svg, series) => {
  const width = 760;
  const height = 420;
  const margin = { top: 42, right: 32, bottom: 84, left: 70 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const xScale = (value) => margin.left + value * plotWidth;
  const yScale = (value) => margin.top + plotHeight - value * plotHeight;
  const axisColor = "#2f3944";

  svg.replaceChildren();
  svg.appendChild(svgEl("rect", { x: 0, y: 0, width, height, fill: "#fff" }));
  svg.appendChild(svgEl("text", { x: width / 2, y: 24, "text-anchor": "middle", class: "lab-plot-title" })).textContent =
    series.length === 1 ? `ROC Curve for ${series[0].label}` : "ROC Curves for Selected Tests";

  svg.appendChild(svgEl("line", { x1: margin.left, x2: width - margin.right, y1: margin.top + plotHeight, y2: margin.top + plotHeight, stroke: axisColor }));
  svg.appendChild(svgEl("line", { x1: margin.left, x2: margin.left, y1: margin.top, y2: margin.top + plotHeight, stroke: axisColor }));
  svg.appendChild(svgEl("line", { x1: xScale(0), x2: xScale(1), y1: yScale(0), y2: yScale(1), class: "lab-reference-line" }));

  for (let index = 0; index <= 5; index += 1) {
    const value = index / 5;
    svg.appendChild(svgEl("line", { x1: xScale(value), x2: xScale(value), y1: margin.top + plotHeight, y2: margin.top + plotHeight + 5, stroke: axisColor }));
    svg.appendChild(svgEl("text", { x: xScale(value), y: height - 50, "text-anchor": "middle", class: "lab-axis-label" })).textContent = value.toFixed(1);
    svg.appendChild(svgEl("line", { x1: margin.left - 5, x2: margin.left, y1: yScale(value), y2: yScale(value), stroke: axisColor }));
    svg.appendChild(svgEl("text", { x: margin.left - 10, y: yScale(value) + 4, "text-anchor": "end", class: "lab-axis-label" })).textContent = value.toFixed(1);
  }

  series.forEach((item, index) => {
    const color = lineColors[index % lineColors.length];
    svg.appendChild(svgEl("path", {
      d: linePath(item.points, xScale, yScale),
      class: "lab-line-path",
      stroke: color,
    }));

    const pointStep = Math.max(Math.ceil(item.points.length / 90), 1);
    item.points.forEach((point, pointIndex) => {
      if (pointIndex % pointStep !== 0 && pointIndex !== item.points.length - 1) return;
      const circle = svgEl("circle", {
        cx: xScale(point.x),
        cy: yScale(point.y),
        r: 2.7,
        class: "lab-line-point",
        fill: color,
      });
      circle.appendChild(svgEl("title")).textContent =
        `${item.label} cutoff ${point.cutoff.toFixed(1)}; sensitivity ${point.y.toFixed(2)}; specificity ${(1 - point.x).toFixed(2)}`;
      svg.appendChild(circle);
    });

    if (series.length === 1) {
      const thresholds = item.points.map((point) => point.cutoff);
      const min = Math.min(...thresholds);
      const max = Math.max(...thresholds);
      const targets = [
        ...Array.from({ length: 8 }, (_, targetIndex) => min + ((max - min) * targetIndex) / 7),
        19.6,
        20.4,
        21.2,
        22.8,
        22.9,
      ];
      const used = new Set();
      targets.forEach((target) => {
        const nearestIndex = item.points.reduce((best, point, pointIndex) => (
          Math.abs(point.cutoff - target) < Math.abs(item.points[best].cutoff - target) ? pointIndex : best
        ), 0);
        if (used.has(nearestIndex)) return;
        used.add(nearestIndex);
        const point = item.points[nearestIndex];
        svg.appendChild(svgEl("text", {
          x: xScale(point.x) + 6,
          y: yScale(point.y) - 6,
          class: "lab-roc-label",
        })).textContent = point.cutoff.toFixed(1);
      });
    }
  });

  svg.appendChild(svgEl("text", { x: width / 2, y: height - 24, "text-anchor": "middle", class: "lab-axis-title" })).textContent = "1-Specificity";
  const yTitleElement = svgEl("text", { x: 18, y: height / 2, "text-anchor": "middle", class: "lab-axis-title", transform: `rotate(-90 18 ${height / 2})` });
  yTitleElement.textContent = "Sensitivity";
  svg.appendChild(yTitleElement);

  const legend = svgEl("g", { class: "lab-legend" });
  series.forEach((item, index) => {
    const x = margin.left + index * 190;
    const y = height - 68;
    const color = lineColors[index % lineColors.length];
    legend.appendChild(svgEl("line", { x1: x, x2: x + 22, y1: y - 4, y2: y - 4, stroke: color, "stroke-width": 3 }));
    legend.appendChild(svgEl("text", { x: x + 28, y, class: "lab-axis-label" })).textContent =
      `${item.label} AUC ${item.auc.toFixed(3)}`;
  });
  svg.appendChild(legend);
};

const initRocWidget = async (root) => {
  const data = await fetchCsv(root.dataset.csv);
  const svg = root.querySelector("svg");
  const inputs = Array.from(root.querySelectorAll("[data-roc-test]"));
  const allSeries = Object.fromEntries(diagnosticTests.map((test) => {
    const points = rocPointsForTest(data, test);
    return [test, { label: test, points, auc: aucFromPoints(points) }];
  }));

  const draw = () => {
    const selected = inputs.filter((input) => input.checked).map((input) => input.value);
    if (selected.length === 0) {
      svg.replaceChildren(svgEl("text", { x: 380, y: 210, "text-anchor": "middle", class: "lab-plot-title" }));
      svg.firstChild.textContent = "Select at least one test.";
      return;
    }
    drawRocPlot(svg, selected.map((test) => allSeries[test]));
  };

  inputs.forEach((input) => input.addEventListener("input", draw));
  draw();
};

const drawDiagnosticDistribution = (svg, data, test, cutoff) => {
  const values = data.map((row) => Number(row[test])).filter(Number.isFinite);
  const width = 760;
  const height = 360;
  const margin = { top: 38, right: 24, bottom: 62, left: 60 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = 1.2;
  const xMin = Math.floor(min - pad);
  const xMax = Math.ceil(max + pad);
  const binCount = 24;
  const binWidth = (xMax - xMin) / binCount;
  const groups = [
    { label: "Disease Present", className: "lab-disease-bar", rows: data.filter(isDiseasePresent) },
    { label: "No Disease", className: "lab-no-disease-bar", rows: data.filter((row) => !isDiseasePresent(row)) },
  ];
  const binsByGroup = groups.map((group) => ({
    ...group,
    bins: Array.from({ length: binCount }, (_, index) => ({
      x0: xMin + index * binWidth,
      x1: xMin + (index + 1) * binWidth,
      count: 0,
    })),
  }));

  binsByGroup.forEach((group) => {
    group.rows.forEach((row) => {
      const value = Number(row[test]);
      if (!Number.isFinite(value)) return;
      const index = Math.min(Math.floor((value - xMin) / binWidth), binCount - 1);
      group.bins[Math.max(index, 0)].count += 1;
    });
  });

  const densities = binsByGroup.flatMap((group) => group.bins.map((bin) => bin.count / (group.rows.length * binWidth)));
  const yMax = Math.max(...densities, 0.01) * 1.18;
  const xScale = (x) => margin.left + ((x - xMin) / (xMax - xMin)) * plotWidth;
  const yScale = (y) => margin.top + plotHeight - (y / yMax) * plotHeight;

  svg.replaceChildren();
  svg.appendChild(svgEl("rect", { x: 0, y: 0, width, height, fill: "#fff" }));
  svg.appendChild(svgEl("text", { x: width / 2, y: 24, "text-anchor": "middle", class: "lab-plot-title" })).textContent =
    "Density Curves for Diseased and Non-diseased";

  binsByGroup.forEach((group) => {
    group.bins.forEach((bin) => {
      const density = bin.count / (group.rows.length * binWidth);
      const x = xScale(bin.x0) + 1;
      const y = yScale(density);
      svg.appendChild(svgEl("rect", {
        x,
        y,
        width: Math.max(xScale(bin.x1) - xScale(bin.x0) - 2, 1),
        height: margin.top + plotHeight - y,
        class: group.className,
      }));
    });
  });

  svg.appendChild(svgEl("line", {
    x1: xScale(cutoff),
    x2: xScale(cutoff),
    y1: margin.top,
    y2: margin.top + plotHeight,
    class: "lab-cutoff-line",
  }));

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
    xTitle: `Values for ${test}`,
    yTitle: "Density",
    xFormat: (value) => value.toFixed(0),
    yFormat: (value) => value.toFixed(2),
  });

  const legend = svgEl("g", { class: "lab-legend" });
  groups.forEach((group, index) => {
    const x = margin.left + index * 190;
    const y = height - 28;
    legend.appendChild(svgEl("rect", { x, y: y - 11, width: 14, height: 10, class: group.className }));
    legend.appendChild(svgEl("text", { x: x + 20, y, class: "lab-axis-label" })).textContent = group.label;
  });
  svg.appendChild(legend);
};

const renderCutoffMetrics = (root, confusion, metrics, auc) => {
  root.replaceChildren();

  const tableWrap = document.createElement("div");
  tableWrap.className = "lab-confusion-table";
  tableWrap.innerHTML = `
    <table>
      <thead>
        <tr><th></th><th>Disease Present</th><th>No Disease</th></tr>
      </thead>
      <tbody>
        <tr><th>Test Disease Present</th><td class="lab-cell-tp">${confusion.tp}</td><td class="lab-cell-fp">${confusion.fp}</td></tr>
        <tr><th>Test No Disease</th><td class="lab-cell-fn">${confusion.fn}</td><td class="lab-cell-tn">${confusion.tn}</td></tr>
      </tbody>
    </table>`;

  const metricGrid = document.createElement("div");
  metricGrid.className = "lab-metric-grid";
  [
    ["AUC", auc],
    ["Accuracy", metrics.accuracy],
    ["Sensitivity", metrics.sensitivity],
    ["Specificity", metrics.specificity],
  ].forEach(([label, value]) => {
    const card = document.createElement("div");
    card.className = "lab-metric";
    card.innerHTML = `<strong>${label}</strong><span>${value.toFixed(3)}</span>`;
    metricGrid.appendChild(card);
  });

  root.append(tableWrap, metricGrid);
};

const initCutoffWidget = async (root) => {
  const data = await fetchCsv(root.dataset.csv);
  const svg = root.querySelector("svg");
  const testSelect = root.querySelector("[data-cutoff-test]");
  const cutoffInput = root.querySelector("[data-cutoff-value]");
  const cutoffOutput = root.querySelector("[data-cutoff-output]");
  const metricsRoot = root.querySelector("[data-cutoff-metrics]");
  const aucs = Object.fromEntries(diagnosticTests.map((test) => {
    const points = rocPointsForTest(data, test);
    return [test, aucFromPoints(points)];
  }));

  const draw = () => {
    const test = testSelect.value;
    const cutoff = Number(cutoffInput.value);
    cutoffOutput.value = cutoff.toFixed(1);
    const confusion = confusionForCutoff(data, test, cutoff);
    const metrics = diagnosticMetrics(confusion);
    drawDiagnosticDistribution(svg, data, test, cutoff);
    renderCutoffMetrics(metricsRoot, confusion, metrics, aucs[test]);
  };

  [testSelect, cutoffInput].forEach((control) => control.addEventListener("input", draw));
  draw();
};

const logGamma = (value) => {
  const coefficients = [
    676.5203681218851,
    -1259.1392167224028,
    771.3234287776531,
    -176.6150291621406,
    12.507343278686905,
    -0.13857109526572012,
    9.984369578019572e-6,
    1.5056327351493116e-7,
  ];

  if (value < 0.5) {
    return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
  }

  let x = 0.9999999999998099;
  const z = value - 1;
  coefficients.forEach((coefficient, index) => {
    x += coefficient / (z + index + 1);
  });
  const t = z + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
};

const binomialPmf = (x, n, p) => {
  if (x < 0 || x > n || !Number.isInteger(x)) return 0;
  if (p === 0) return x === 0 ? 1 : 0;
  if (p === 1) return x === n ? 1 : 0;
  const logChoose = logGamma(n + 1) - logGamma(x + 1) - logGamma(n - x + 1);
  return Math.exp(logChoose + x * Math.log(p) + (n - x) * Math.log1p(-p));
};

const binomialCdf = (x, n, p) => {
  const upper = Math.min(Math.floor(x), n);
  if (upper < 0) return 0;
  let total = 0;
  for (let value = 0; value <= upper; value += 1) total += binomialPmf(value, n, p);
  return Math.min(total, 1);
};

const binomialQuantile = (probability, n, p) => {
  let cumulative = 0;
  for (let value = 0; value <= n; value += 1) {
    cumulative += binomialPmf(value, n, p);
    if (cumulative >= probability) return value;
  }
  return n;
};

const poissonPmf = (x, lambda) => {
  if (x < 0 || !Number.isInteger(x)) return 0;
  if (lambda === 0) return x === 0 ? 1 : 0;
  return Math.exp(-lambda + x * Math.log(lambda) - logGamma(x + 1));
};

const poissonCdf = (x, lambda) => {
  const upper = Math.floor(x);
  if (upper < 0) return 0;
  let total = 0;
  for (let value = 0; value <= upper; value += 1) total += poissonPmf(value, lambda);
  return Math.min(total, 1);
};

const poissonQuantile = (probability, lambda) => {
  let cumulative = 0;
  const max = Math.max(100, Math.ceil(lambda + 10 * Math.sqrt(lambda + 1)));
  for (let value = 0; value <= max; value += 1) {
    cumulative += poissonPmf(value, lambda);
    if (cumulative >= probability) return value;
  }
  return max;
};

const distributionRange = (type, parameters, mode) => {
  if (type === "binomial") {
    const { n, p } = parameters;
    if (mode === "none" || n <= 10) return { low: 0, high: n };
    const sd = Math.sqrt(n * p * (1 - p));
    return {
      low: Math.max(0, Math.round(n * p - 4 * sd)),
      high: Math.min(n, Math.round(n * p + 4 * sd)),
    };
  }

  const lambda = parameters.lambda;
  const sd = Math.sqrt(lambda);
  return {
    low: Math.max(0, Math.round(lambda - 3 * sd)),
    high: Math.max(8, Math.round(lambda + 5 * sd)),
  };
};

const drawDiscreteDistribution = (svg, config) => {
  const { title, xTitle, values, probabilities, highlighted = new Set(), resultText } = config;
  const width = 760;
  const height = 390;
  const margin = { top: 46, right: 26, bottom: 64, left: 66 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const minX = values[0] ?? 0;
  const maxX = values[values.length - 1] ?? 1;
  const xSpan = Math.max(maxX - minX, 1);
  const yMax = Math.max(...probabilities, 0.01) * 1.18;
  const xScale = (value) => margin.left + ((value - minX) / xSpan) * plotWidth;
  const yScale = (value) => margin.top + plotHeight - (value / yMax) * plotHeight;

  svg.replaceChildren();
  svg.appendChild(svgEl("rect", { x: 0, y: 0, width, height, fill: "#fff" }));
  svg.appendChild(svgEl("text", { x: width / 2, y: 24, "text-anchor": "middle", class: "lab-plot-title" })).textContent = title;
  if (resultText) {
    svg.appendChild(svgEl("text", { x: width / 2, y: 42, "text-anchor": "middle", class: "lab-plot-subtitle" })).textContent = resultText;
  }

  const axisColor = "#2f3944";
  svg.appendChild(svgEl("line", { x1: margin.left, x2: width - margin.right, y1: margin.top + plotHeight, y2: margin.top + plotHeight, stroke: axisColor }));
  svg.appendChild(svgEl("line", { x1: margin.left, x2: margin.left, y1: margin.top, y2: margin.top + plotHeight, stroke: axisColor }));

  const barStep = plotWidth / Math.max(values.length - 1, 1);
  const strokeWidth = Math.max(Math.min(barStep * 0.55, 5), 1);
  values.forEach((value, index) => {
    const x = xScale(value);
    svg.appendChild(svgEl("line", {
      x1: x,
      x2: x,
      y1: margin.top + plotHeight,
      y2: yScale(probabilities[index]),
      class: highlighted.has(value) ? "lab-distribution-bar highlighted" : "lab-distribution-bar",
      "stroke-width": strokeWidth,
    }));
  });

  for (let index = 0; index <= 5; index += 1) {
    const value = minX + (xSpan * index) / 5;
    const x = xScale(value);
    svg.appendChild(svgEl("line", { x1: x, x2: x, y1: margin.top + plotHeight, y2: margin.top + plotHeight + 5, stroke: axisColor }));
    svg.appendChild(svgEl("text", { x, y: height - 34, "text-anchor": "middle", class: "lab-axis-label" })).textContent = Math.round(value);
  }

  for (let index = 0; index <= 4; index += 1) {
    const value = (yMax * index) / 4;
    const y = yScale(value);
    svg.appendChild(svgEl("line", { x1: margin.left - 5, x2: margin.left, y1: y, y2: y, stroke: axisColor }));
    svg.appendChild(svgEl("text", { x: margin.left - 10, y: y + 4, "text-anchor": "end", class: "lab-axis-label" })).textContent = value.toFixed(2);
  }

  svg.appendChild(svgEl("text", { x: width / 2, y: height - 8, "text-anchor": "middle", class: "lab-axis-title" })).textContent = xTitle;
  const yTitle = svgEl("text", { x: 18, y: height / 2, "text-anchor": "middle", class: "lab-axis-title", transform: `rotate(-90 18 ${height / 2})` });
  yTitle.textContent = "Probability";
  svg.appendChild(yTitle);
};

const initDistributionWidget = (root) => {
  const type = root.dataset.distribution;
  const svg = root.querySelector("svg");
  const modeSelect = root.querySelector("[data-dist-mode]");
  const lowerInput = root.querySelector("[data-dist-lower]");
  const upperInput = root.querySelector("[data-dist-upper]");
  const percentileInput = root.querySelector("[data-dist-percentile]");
  const result = root.querySelector("[data-dist-result]");
  const probabilityControls = Array.from(root.querySelectorAll("[data-dist-probability-control]"));
  const percentileControls = Array.from(root.querySelectorAll("[data-dist-percentile-control]"));

  const draw = () => {
    const mode = modeSelect.value;
    probabilityControls.forEach((control) => { control.hidden = mode !== "probability"; });
    percentileControls.forEach((control) => { control.hidden = mode !== "percentile"; });

    let parameters;
    let pmf;
    let cdf;
    let quantile;
    let title;
    let xTitle;

    if (type === "binomial") {
      const n = Number(root.querySelector("[data-dist-n]").value);
      const p = Number(root.querySelector("[data-dist-p]").value);
      root.querySelector("[data-dist-n-output]").value = n;
      root.querySelector("[data-dist-p-output]").value = p.toFixed(2);
      parameters = { n, p };
      pmf = (value) => binomialPmf(value, n, p);
      cdf = (value) => binomialCdf(value, n, p);
      quantile = (probability) => binomialQuantile(probability, n, p);
      title = `Binomial Distribution: n = ${n}, p = ${p.toFixed(2)}`;
      xTitle = "Possible Number of Successes";
      lowerInput.max = n;
      upperInput.max = n;
    } else {
      const lambda = Number(root.querySelector("[data-dist-lambda]").value);
      root.querySelector("[data-dist-lambda-output]").value = lambda.toFixed(2);
      parameters = { lambda };
      pmf = (value) => poissonPmf(value, lambda);
      cdf = (value) => poissonCdf(value, lambda);
      quantile = (probability) => poissonQuantile(probability, lambda);
      title = `Poisson Distribution: lambda = ${lambda.toFixed(2)}`;
      xTitle = "Observable Values";
    }

    const { low, high } = distributionRange(type, parameters, mode);
    const values = Array.from({ length: high - low + 1 }, (_, index) => low + index);
    const probabilities = values.map(pmf);
    const highlighted = new Set();
    let resultText = "";

    if (mode === "probability") {
      let lower = Math.round(Number(lowerInput.value));
      let upper = Math.round(Number(upperInput.value));
      if (Number.isNaN(lower)) lower = 0;
      if (Number.isNaN(upper)) upper = type === "binomial" ? parameters.n : high;
      if (lower > upper) [lower, upper] = [upper, lower];
      const probability = cdf(upper) - cdf(lower - 1);
      for (let value = Math.max(lower, low); value <= Math.min(upper, high); value += 1) highlighted.add(value);
      resultText = `P(${lower} <= X <= ${upper}) = ${probability.toFixed(6)}`;
    } else if (mode === "percentile") {
      const probability = Math.min(Math.max(Number(percentileInput.value), 0), 1);
      const value = quantile(probability);
      for (let index = 0; index <= Math.min(value, high); index += 1) {
        if (index >= low) highlighted.add(index);
      }
      resultText = `The ${probability.toFixed(2)} percentile = ${value}`;
    }

    result.textContent = resultText;
    result.hidden = !resultText;
    drawDiscreteDistribution(svg, { title, xTitle, values, probabilities, highlighted, resultText });
  };

  root.querySelectorAll("input, select").forEach((control) => control.addEventListener("input", draw));
  draw();
};

const normalPdf = (x, mean, sd) => {
  if (sd <= 0) return 0;
  const z = (x - mean) / sd;
  return Math.exp(-0.5 * z * z) / (sd * Math.sqrt(2 * Math.PI));
};

const erf = (x) => {
  const sign = Math.sign(x) || 1;
  const abs = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * abs);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-abs * abs);
  return sign * y;
};

const normalCdf = (x, mean, sd) => 0.5 * (1 + erf((x - mean) / (sd * Math.SQRT2)));

const standardNormalQuantile = (p) => {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const plow = 0.02425;
  const phigh = 1 - plow;

  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;

  if (p < plow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }

  if (p <= phigh) {
    const q = p - 0.5;
    const r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }

  const q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
};

const normalQuantile = (p, mean, sd) => mean + sd * standardNormalQuantile(p);

const drawNormalAxes = (svg, config) => {
  const {
    width,
    height,
    margin,
    xMin,
    xMax,
    yMax,
    xScale,
    yScale,
    title,
    xTitle,
    yTitle,
    xTickCount = 6,
    yTickCount = 4,
    yLabelFormat = (value) => value.toFixed(2),
  } = config;
  const axisColor = "#2f3944";
  const plotHeight = height - margin.top - margin.bottom;
  if (title) {
    svg.appendChild(svgEl("text", { x: width / 2, y: 24, "text-anchor": "middle", class: "lab-plot-title" })).textContent = title;
  }
  svg.appendChild(svgEl("line", { x1: margin.left, x2: width - margin.right, y1: margin.top + plotHeight, y2: margin.top + plotHeight, stroke: axisColor }));
  svg.appendChild(svgEl("line", { x1: margin.left, x2: margin.left, y1: margin.top, y2: margin.top + plotHeight, stroke: axisColor }));

  for (let index = 0; index <= xTickCount; index += 1) {
    const value = xMin + ((xMax - xMin) * index) / xTickCount;
    const x = xScale(value);
    svg.appendChild(svgEl("line", { x1: x, x2: x, y1: margin.top + plotHeight, y2: margin.top + plotHeight + 5, stroke: axisColor }));
    svg.appendChild(svgEl("text", { x, y: height - 42, "text-anchor": "middle", class: "lab-axis-label" })).textContent =
      Math.abs(value) >= 10 ? value.toFixed(0) : value.toFixed(1);
  }

  for (let index = 0; index <= yTickCount; index += 1) {
    const value = (yMax * index) / yTickCount;
    const y = yScale(value);
    svg.appendChild(svgEl("line", { x1: margin.left - 5, x2: margin.left, y1: y, y2: y, stroke: axisColor }));
    svg.appendChild(svgEl("text", { x: margin.left - 10, y: y + 4, "text-anchor": "end", class: "lab-axis-label" })).textContent = yLabelFormat(value);
  }

  svg.appendChild(svgEl("text", { x: width / 2, y: height - 12, "text-anchor": "middle", class: "lab-axis-title" })).textContent = xTitle;
  const yTitleElement = svgEl("text", { x: 18, y: height / 2, "text-anchor": "middle", class: "lab-axis-title", transform: `rotate(-90 18 ${height / 2})` });
  yTitleElement.textContent = yTitle;
  svg.appendChild(yTitleElement);
};

const normalPoints = (mean, sd, xMin, xMax, count = 240) => (
  Array.from({ length: count }, (_, index) => {
    const x = xMin + ((xMax - xMin) * index) / (count - 1);
    return { x, y: normalPdf(x, mean, sd) };
  })
);

const drawNormalPath = (svg, points, xScale, yScale, color, className = "lab-line-path") => {
  svg.appendChild(svgEl("path", {
    d: linePath(points, xScale, yScale),
    class: className,
    stroke: color,
  }));
};

const initNormalCurvesWidget = (root) => {
  const svg = root.querySelector("svg");
  const controls = ["green", "blue", "red"].map((name) => ({
    name,
    color: name === "green" ? "#006b12" : name === "blue" ? "#0000ff" : "#ff0000",
    mean: root.querySelector(`[data-normal-mean="${name}"]`),
    sd: root.querySelector(`[data-normal-sd="${name}"]`),
    meanOutput: root.querySelector(`[data-normal-mean-output="${name}"]`),
    sdOutput: root.querySelector(`[data-normal-sd-output="${name}"]`),
  }));
  const xMinInput = root.querySelector("[data-normal-x-min]");
  const xMaxInput = root.querySelector("[data-normal-x-max]");
  const xMinOutput = root.querySelector("[data-normal-x-min-output]");
  const xMaxOutput = root.querySelector("[data-normal-x-max-output]");
  const formatControlValue = (value) => Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);

  const draw = () => {
    let xMin = Number(xMinInput.value);
    let xMax = Number(xMaxInput.value);
    if (xMin > xMax) [xMin, xMax] = [xMax, xMin];
    xMinOutput.value = xMin.toFixed(0);
    xMaxOutput.value = xMax.toFixed(0);

    const series = controls.map((control) => {
      const mean = Number(control.mean.value);
      const sd = Math.max(Number(control.sd.value), 0.1);
      control.meanOutput.value = formatControlValue(mean);
      control.sdOutput.value = formatControlValue(sd);
      return {
        label: `N(\u03bc = ${formatControlValue(mean)}, \u03c3 = ${formatControlValue(sd)})`,
        color: control.color,
        points: normalPoints(mean, sd, xMin, xMax),
      };
    });

    const width = 760;
    const height = 470;
    const margin = { top: 28, right: 18, bottom: 104, left: 58 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const peak = Math.max(...series.flatMap((item) => item.points.map((point) => point.y)), 0.01);
    const yMax = Math.max(Math.ceil(peak * 10) / 10, 0.1);
    const xScale = (value) => margin.left + ((value - xMin) / (xMax - xMin || 1)) * plotWidth;
    const yScale = (value) => margin.top + plotHeight - (value / yMax) * plotHeight;

    svg.replaceChildren(svgEl("rect", { x: 0, y: 0, width, height, fill: "#fff" }));
    drawNormalAxes(svg, {
      width,
      height,
      margin,
      xMin,
      xMax,
      yMax,
      xScale,
      yScale,
      title: "",
      xTitle: "Possible Values",
      yTitle: "Probability",
      xTickCount: 3,
      yTickCount: 4,
      yLabelFormat: (value) => value.toFixed(1),
    });
    series.forEach((item) => drawNormalPath(svg, item.points, xScale, yScale, item.color));

    const legend = svgEl("g", { class: "lab-legend" });
    const legendY = height - 36;
    legend.appendChild(svgEl("text", { x: margin.left + 78, y: legendY, "text-anchor": "end", class: "lab-axis-title" })).textContent =
      "Distribution Parameters";
    series.forEach((item, index) => {
      const x = margin.left + 92 + index * 188;
      const y = legendY;
      legend.appendChild(svgEl("line", { x1: x, x2: x + 24, y1: y - 4, y2: y - 4, stroke: item.color, "stroke-width": 3 }));
      legend.appendChild(svgEl("text", { x: x + 30, y, class: "lab-axis-label" })).textContent = item.label;
    });
    svg.appendChild(legend);
  };

  root.querySelectorAll("input").forEach((input) => input.addEventListener("input", draw));
  draw();
};

const initNormalCalculatorWidget = (root) => {
  const svg = root.querySelector("svg");
  const meanInput = root.querySelector("[data-normal-calc-mean]");
  const sdInput = root.querySelector("[data-normal-calc-sd]");
  const modeSelect = root.querySelector("[data-normal-calc-mode]");
  const lowerInput = root.querySelector("[data-normal-calc-lower]");
  const upperInput = root.querySelector("[data-normal-calc-upper]");
  const percentileInput = root.querySelector("[data-normal-calc-percentile]");
  const result = root.querySelector("[data-normal-calc-result]");
  const probabilityControls = Array.from(root.querySelectorAll("[data-normal-probability-control]"));
  const percentileControls = Array.from(root.querySelectorAll("[data-normal-percentile-control]"));

  const draw = () => {
    const mean = Number(meanInput.value);
    const sd = Math.max(Number(sdInput.value), 0.01);
    const mode = modeSelect.value;
    probabilityControls.forEach((control) => { control.hidden = mode !== "probability"; });
    percentileControls.forEach((control) => { control.hidden = mode !== "percentile"; });

    const xMin = mean - 4 * sd;
    const xMax = mean + 4 * sd;
    const points = normalPoints(mean, sd, xMin, xMax, 300);
    const yMax = Math.max(...points.map((point) => point.y), 0.01) * 1.18;
    const width = 760;
    const height = 420;
    const margin = { top: 54, right: 28, bottom: 72, left: 70 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const xScale = (value) => margin.left + ((value - xMin) / (xMax - xMin || 1)) * plotWidth;
    const yScale = (value) => margin.top + plotHeight - (value / yMax) * plotHeight;
    let resultText = "";
    let shadeLow = null;
    let shadeHigh = null;
    let markerX = null;

    if (mode === "probability") {
      const lowerRaw = lowerInput.value.trim();
      const upperRaw = upperInput.value.trim();
      let lower = lowerRaw === "" ? -Infinity : Number(lowerRaw);
      let upper = upperRaw === "" ? Infinity : Number(upperRaw);
      if (!Number.isFinite(lower) && lowerRaw !== "") lower = -Infinity;
      if (!Number.isFinite(upper) && upperRaw !== "") upper = Infinity;
      if (lower > upper) [lower, upper] = [upper, lower];
      const probability = normalCdf(upper, mean, sd) - normalCdf(lower, mean, sd);
      const leftText = Number.isFinite(lower) ? lower.toFixed(2) : "-Infinity";
      const rightText = Number.isFinite(upper) ? upper.toFixed(2) : "Infinity";
      resultText = `P(${leftText} < X < ${rightText}) = ${probability.toFixed(4)}`;
      shadeLow = Math.max(lower, xMin);
      shadeHigh = Math.min(upper, xMax);
    } else if (mode === "percentile") {
      const percentile = Math.min(Math.max(Number(percentileInput.value), 0.0001), 0.9999);
      const value = normalQuantile(percentile, mean, sd);
      resultText = `The ${percentile.toFixed(2)} percentile is ${value.toFixed(4)}`;
      shadeLow = xMin;
      shadeHigh = Math.min(value, xMax);
      markerX = value;
    }

    result.textContent = resultText;
    result.hidden = !resultText;

    svg.replaceChildren(svgEl("rect", { x: 0, y: 0, width, height, fill: "#fff" }));
    drawNormalAxes(svg, {
      width,
      height,
      margin,
      xMin,
      xMax,
      yMax,
      xScale,
      yScale,
      title: `Normal Distribution with X ~ N(${mean.toFixed(2)}, ${sd.toFixed(2)})`,
      xTitle: "Possible Values",
      yTitle: "Probability Density",
    });

    if (shadeLow !== null && shadeHigh !== null && shadeHigh > shadeLow) {
      const shadePoints = normalPoints(mean, sd, shadeLow, shadeHigh, 180);
      const baseline = margin.top + plotHeight;
      const shadePath = [
        `M ${xScale(shadeLow).toFixed(2)} ${baseline.toFixed(2)}`,
        ...shadePoints.map((point) => `L ${xScale(point.x).toFixed(2)} ${yScale(point.y).toFixed(2)}`),
        `L ${xScale(shadeHigh).toFixed(2)} ${baseline.toFixed(2)}`,
        "Z",
      ].join(" ");
      svg.appendChild(svgEl("path", { d: shadePath, class: "lab-normal-shade" }));
    }

    drawNormalPath(svg, points, xScale, yScale, "#b42318");
    if (markerX !== null && markerX >= xMin && markerX <= xMax) {
      svg.appendChild(svgEl("line", { x1: xScale(markerX), x2: xScale(markerX), y1: margin.top, y2: margin.top + plotHeight, class: "lab-normal-marker" }));
    }
    if (resultText) {
      svg.appendChild(svgEl("text", { x: width / 2, y: 44, "text-anchor": "middle", class: "lab-plot-subtitle" })).textContent = resultText;
    }
  };

  root.querySelectorAll("input, select").forEach((control) => control.addEventListener("input", draw));
  draw();
};

const ugaVariableLabels = {
  sex: "Sex",
  age: "Age",
  weight: "Weight",
  height: "Height",
  classes: "Classes",
};

const ugaStatisticLabels = {
  sex: "Proportion Male",
  age: "Mean Age",
  weight: "Mean Weight",
  height: "Mean Height",
  classes: "Mean Number of Classes",
};

const formatUgaValue = (value, digits = 3) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return Number.isInteger(number) ? String(number) : number.toFixed(digits).replace(/0+$/, "").replace(/\.$/, "");
};

const renderSimpleTable = (table, columns, rows, headings = columns) => {
  const thead = table.querySelector("thead") || table.createTHead();
  const tbody = table.querySelector("tbody") || table.createTBody();
  const headerRow = document.createElement("tr");
  headings.forEach((heading) => {
    const th = document.createElement("th");
    th.textContent = heading;
    headerRow.appendChild(th);
  });
  thead.replaceChildren(headerRow);
  tbody.replaceChildren(...rows.map((row) => {
    const tr = document.createElement("tr");
    columns.forEach((column) => {
      const td = document.createElement("td");
      td.textContent = row[column] ?? "";
      tr.appendChild(td);
    });
    return tr;
  }));
};

const ugaNumericRows = (rows, variable) => rows
  .map((row) => Number(row[variable]))
  .filter(Number.isFinite);

const ugaPopulationParameter = (rows, variable) => {
  if (variable === "sex") return rows.filter((row) => row.sex === "Male").length / rows.length;
  const values = ugaNumericRows(rows, variable);
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const drawUgaBarPlot = (svg, counts, config) => {
  const width = 760;
  const height = 420;
  const margin = { top: 42, right: 24, bottom: 76, left: 76 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const keys = Object.keys(counts);
  const yMax = Math.max(...Object.values(counts), 1) * 1.12;
  const yScale = (value) => margin.top + plotHeight - (value / yMax) * plotHeight;
  const band = plotWidth / keys.length;
  const axisColor = "#2f3944";

  svg.replaceChildren(svgEl("rect", { x: 0, y: 0, width, height, fill: "#fff" }));
  svg.appendChild(svgEl("text", { x: width / 2, y: 24, "text-anchor": "middle", class: "lab-plot-title" })).textContent = config.title;
  svg.appendChild(svgEl("line", { x1: margin.left, x2: width - margin.right, y1: margin.top + plotHeight, y2: margin.top + plotHeight, stroke: axisColor }));
  svg.appendChild(svgEl("line", { x1: margin.left, x2: margin.left, y1: margin.top, y2: margin.top + plotHeight, stroke: axisColor }));

  keys.forEach((key, index) => {
    const barWidth = Math.min(band * 0.68, 86);
    const x = margin.left + index * band + (band - barWidth) / 2;
    const y = yScale(counts[key]);
    svg.appendChild(svgEl("rect", {
      x,
      y,
      width: barWidth,
      height: margin.top + plotHeight - y,
      class: "lab-hist-bar",
    }));
    svg.appendChild(svgEl("text", { x: margin.left + index * band + band / 2, y: height - 46, "text-anchor": "middle", class: "lab-axis-label" })).textContent = key;
  });

  for (let index = 0; index <= 4; index += 1) {
    const value = (yMax * index) / 4;
    const y = yScale(value);
    svg.appendChild(svgEl("line", { x1: margin.left - 5, x2: margin.left, y1: y, y2: y, stroke: axisColor }));
    svg.appendChild(svgEl("text", { x: margin.left - 10, y: y + 4, "text-anchor": "end", class: "lab-axis-label" })).textContent = value.toFixed(0);
  }

  svg.appendChild(svgEl("text", { x: width / 2, y: height - 14, "text-anchor": "middle", class: "lab-axis-title" })).textContent = config.xTitle;
  const yTitle = svgEl("text", { x: 18, y: height / 2, "text-anchor": "middle", class: "lab-axis-title", transform: `rotate(-90 18 ${height / 2})` });
  yTitle.textContent = "Count";
  svg.appendChild(yTitle);
};

const drawUgaHistogram = (svg, values, config) => {
  const width = 760;
  const height = 420;
  const margin = { top: 42, right: 24, bottom: 76, left: 76 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const binCount = Math.max(8, Math.min(40, Math.round((max - min) / (3.5 * (standardDeviation(values) / values.length ** (1 / 3)))) || 15));
  const binWidth = (max - min) / binCount || 1;
  const bins = Array.from({ length: binCount }, (_, index) => ({ x0: min + index * binWidth, x1: min + (index + 1) * binWidth, count: 0 }));
  values.forEach((value) => {
    const index = Math.min(Math.floor((value - min) / binWidth), binCount - 1);
    bins[Math.max(index, 0)].count += 1;
  });
  const yMax = Math.max(...bins.map((bin) => bin.count), 1) * 1.12;
  const xScale = (value) => margin.left + ((value - min) / (max - min || 1)) * plotWidth;
  const yScale = (value) => margin.top + plotHeight - (value / yMax) * plotHeight;
  const axisColor = "#2f3944";

  svg.replaceChildren(svgEl("rect", { x: 0, y: 0, width, height, fill: "#fff" }));
  svg.appendChild(svgEl("text", { x: width / 2, y: 24, "text-anchor": "middle", class: "lab-plot-title" })).textContent = config.title;
  svg.appendChild(svgEl("line", { x1: margin.left, x2: width - margin.right, y1: margin.top + plotHeight, y2: margin.top + plotHeight, stroke: axisColor }));
  svg.appendChild(svgEl("line", { x1: margin.left, x2: margin.left, y1: margin.top, y2: margin.top + plotHeight, stroke: axisColor }));

  bins.forEach((bin) => {
    const x = xScale(bin.x0) + 1;
    const y = yScale(bin.count);
    svg.appendChild(svgEl("rect", {
      x,
      y,
      width: Math.max(xScale(bin.x1) - xScale(bin.x0) - 2, 1),
      height: margin.top + plotHeight - y,
      class: "lab-hist-bar",
    }));
  });

  for (let index = 0; index <= 5; index += 1) {
    const value = min + ((max - min) * index) / 5;
    const x = xScale(value);
    svg.appendChild(svgEl("line", { x1: x, x2: x, y1: margin.top + plotHeight, y2: margin.top + plotHeight + 5, stroke: axisColor }));
    svg.appendChild(svgEl("text", { x, y: height - 46, "text-anchor": "middle", class: "lab-axis-label" })).textContent = formatUgaValue(value, 1);
  }
  for (let index = 0; index <= 4; index += 1) {
    const value = (yMax * index) / 4;
    const y = yScale(value);
    svg.appendChild(svgEl("line", { x1: margin.left - 5, x2: margin.left, y1: y, y2: y, stroke: axisColor }));
    svg.appendChild(svgEl("text", { x: margin.left - 10, y: y + 4, "text-anchor": "end", class: "lab-axis-label" })).textContent = value.toFixed(0);
  }

  svg.appendChild(svgEl("text", { x: width / 2, y: height - 14, "text-anchor": "middle", class: "lab-axis-title" })).textContent = config.xTitle;
  const yTitle = svgEl("text", { x: 18, y: height / 2, "text-anchor": "middle", class: "lab-axis-title", transform: `rotate(-90 18 ${height / 2})` });
  yTitle.textContent = "Count";
  svg.appendChild(yTitle);
};

const initUgaDistributionWidget = async (root) => {
  const data = await fetchCsv(root.dataset.csv);
  const select = root.querySelector("[data-uga-variable]");
  const svg = root.querySelector("svg");
  const count = root.querySelector("[data-uga-count]");
  const dataTable = root.querySelector(".lab-table-wrap table:not([data-uga-summary])");
  const summaryTable = root.querySelector("[data-uga-summary]");
  const columns = ["sex", "age", "weight", "height", "classes"];

  const draw = () => {
    const variable = select.value;
    count.textContent = `Showing first 5 of ${data.length.toLocaleString()} entries`;
    renderSimpleTable(dataTable, columns, data.slice(0, 5), columns);

    if (variable === "sex" || variable === "age" || variable === "classes") {
      const counts = {};
      data.forEach((row) => { counts[row[variable]] = (counts[row[variable]] || 0) + 1; });
      const sortedCounts = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => Number.isFinite(Number(a)) ? Number(a) - Number(b) : a.localeCompare(b)));
      drawUgaBarPlot(svg, sortedCounts, { title: variable, xTitle: variable });
      renderSimpleTable(summaryTable, ["Level", "Count", "Percent"], Object.entries(sortedCounts).map(([level, value]) => ({
        Level: level,
        Count: value.toLocaleString(),
        Percent: `${((value / data.length) * 100).toFixed(1)}%`,
      })));
    } else {
      const values = ugaNumericRows(data, variable);
      drawUgaHistogram(svg, values, { title: variable, xTitle: variable });
      const summary = [
        { Statistic: "Min.", Value: formatUgaValue(Math.min(...values), 2) },
        { Statistic: "1st Qu.", Value: formatUgaValue(quantile(values, 0.25), 2) },
        { Statistic: "Median", Value: formatUgaValue(quantile(values, 0.5), 2) },
        { Statistic: "Mean", Value: formatUgaValue(ugaPopulationParameter(data, variable), 2) },
        { Statistic: "3rd Qu.", Value: formatUgaValue(quantile(values, 0.75), 2) },
        { Statistic: "Max.", Value: formatUgaValue(Math.max(...values), 2) },
      ];
      renderSimpleTable(summaryTable, ["Statistic", "Value"], summary);
    }
  };

  select.addEventListener("change", draw);
  draw();
};

const initUgaSampleWidget = async (root) => {
  const rows = await fetchCsv(root.dataset.summaryCsv);
  const input = root.querySelector("[data-uga-sample-size]");
  const table = root.querySelector("table");
  const headings = ["Variables", "Population Parameter Values", "Sample Statistic Values", "Absolute Difference"];
  const columns = ["Variables", "Population_Parameter_Values", "Sample_Statistic_Values", "Absolute_Difference"];
  const bySize = rows.reduce((map, row) => {
    const key = row.sample_size;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
    return map;
  }, new Map());

  const draw = () => {
    const n = Math.min(Math.max(Math.round(Number(input.value) || 1), 1), 10000);
    input.value = n;
    renderSimpleTable(table, columns, bySize.get(String(n)) || [], headings);
  };

  input.addEventListener("input", draw);
  draw();
};

const drawUgaSampleSizePlot = (svg, rows, variable, xLow, xUp) => {
  const selected = rows
    .filter((row) => row.variable === variable && row.sample_size >= xLow && row.sample_size <= xUp)
    .sort((a, b) => a.sample_size - b.sample_size);
  if (selected.length === 0) return;

  const width = 760;
  const height = 460;
  const margin = { top: 42, right: 28, bottom: 98, left: 78 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const values = selected.flatMap((row) => [row.estimate, row.smooth, row.parameter]).filter(Number.isFinite);
  const pad = (Math.max(...values) - Math.min(...values) || 1) * 0.08;
  const yMin = Math.min(...values) - pad;
  const yMax = Math.max(...values) + pad;
  const xScale = (value) => margin.left + ((value - xLow) / (xUp - xLow || 1)) * plotWidth;
  const yScale = (value) => margin.top + plotHeight - ((value - yMin) / (yMax - yMin || 1)) * plotHeight;
  const axisColor = "#2f3944";
  const label = selected[0].label;

  svg.replaceChildren(svgEl("rect", { x: 0, y: 0, width, height, fill: "#fff" }));
  svg.appendChild(svgEl("text", { x: width / 2, y: 24, "text-anchor": "middle", class: "lab-plot-title" })).textContent = "Random Samples of Varying Size";
  svg.appendChild(svgEl("line", { x1: margin.left, x2: width - margin.right, y1: margin.top + plotHeight, y2: margin.top + plotHeight, stroke: axisColor }));
  svg.appendChild(svgEl("line", { x1: margin.left, x2: margin.left, y1: margin.top, y2: margin.top + plotHeight, stroke: axisColor }));

  for (let index = 0; index <= 5; index += 1) {
    const value = xLow + ((xUp - xLow) * index) / 5;
    const x = xScale(value);
    svg.appendChild(svgEl("line", { x1: x, x2: x, y1: margin.top + plotHeight, y2: margin.top + plotHeight + 5, stroke: axisColor }));
    svg.appendChild(svgEl("text", { x, y: height - 58, "text-anchor": "middle", class: "lab-axis-label" })).textContent = value.toFixed(0);
  }
  for (let index = 0; index <= 4; index += 1) {
    const value = yMin + ((yMax - yMin) * index) / 4;
    const y = yScale(value);
    svg.appendChild(svgEl("line", { x1: margin.left - 5, x2: margin.left, y1: y, y2: y, stroke: axisColor }));
    svg.appendChild(svgEl("text", { x: margin.left - 10, y: y + 4, "text-anchor": "end", class: "lab-axis-label" })).textContent = formatUgaValue(value, 2);
  }

  const parameter = selected[0].parameter;
  svg.appendChild(svgEl("line", { x1: margin.left, x2: width - margin.right, y1: yScale(parameter), y2: yScale(parameter), stroke: "darkgreen", "stroke-width": 3 }));
  svg.appendChild(svgEl("path", { d: linePath(selected.map((row) => ({ x: row.sample_size, y: row.estimate })), xScale, yScale), class: "lab-line-path", stroke: "blue" }));
  svg.appendChild(svgEl("path", { d: linePath(selected.map((row) => ({ x: row.sample_size, y: row.smooth })), xScale, yScale), class: "lab-line-path", stroke: "red" }));

  svg.appendChild(svgEl("text", { x: width / 2, y: height - 30, "text-anchor": "middle", class: "lab-axis-title" })).textContent = "Size of Random Samples";
  const yTitle = svgEl("text", { x: 18, y: height / 2, "text-anchor": "middle", class: "lab-axis-title", transform: `rotate(-90 18 ${height / 2})` });
  yTitle.textContent = variable === "sex" ? "Estimated Proportion of Males" : `Estimated Mean (${variable})`;
  svg.appendChild(yTitle);

  const legend = svgEl("g", { class: "lab-legend" });
  [
    ["Parameter Value", "darkgreen"],
    [label === "Proportion Male" ? "Proportion Male for each Sample Size" : "Mean for each Sample Size", "blue"],
    [label === "Proportion Male" ? "Smoothed Proportion" : "Smoothed Mean", "red"],
  ].forEach(([text, color], index) => {
    const x = margin.left + index * 220;
    const y = height - 72;
    legend.appendChild(svgEl("line", { x1: x, x2: x + 22, y1: y - 4, y2: y - 4, stroke: color, "stroke-width": 3 }));
    legend.appendChild(svgEl("text", { x: x + 28, y, class: "lab-axis-label" })).textContent = text;
  });
  svg.appendChild(legend);
};

const initUgaSampleSizeWidget = async (root) => {
  const rows = (await fetchCsv(root.dataset.pathCsv)).map((row) => ({
    variable: row.variable,
    label: row.label,
    sample_size: Number(row.sample_size),
    estimate: Number(row.estimate),
    smooth: Number(row.smooth),
    parameter: Number(row.parameter),
  }));
  const variableSelect = root.querySelector("[data-uga-path-variable]");
  const lowInput = root.querySelector("[data-uga-x-low]");
  const upInput = root.querySelector("[data-uga-x-up]");
  const svg = root.querySelector("svg");

  const draw = () => {
    let xLow = Math.min(Math.max(Math.round(Number(lowInput.value) || 1), 1), 5000);
    let xUp = Math.min(Math.max(Math.round(Number(upInput.value) || 5000), 1), 5000);
    if (xLow > xUp) [xLow, xUp] = [xUp, xLow];
    if (xLow === xUp) {
      if (xUp < 5000) xUp += 1;
      else xLow -= 1;
    }
    lowInput.value = xLow;
    upInput.value = xUp;
    drawUgaSampleSizePlot(svg, rows, variableSelect.value, xLow, xUp);
  };

  [variableSelect, lowInput, upInput].forEach((control) => control.addEventListener("input", draw));
  draw();
};

const seededRandom = (seed) => {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const repeatedSampleMeans = (rows, variable, sampleSize, reps) => {
  const values = variable === "sex"
    ? rows.map((row) => row.sex === "Male" ? 1 : 0)
    : rows.map((row) => Number(row[variable])).filter(Number.isFinite);
  const rng = seededRandom(1987 + variable.length * 1009 + sampleSize * 17 + reps);
  const sampleN = Math.min(sampleSize, values.length);
  const means = [];

  for (let rep = 0; rep < reps; rep += 1) {
    const seen = new Set();
    let sum = 0;
    while (seen.size < sampleN) {
      const index = Math.floor(rng() * values.length);
      if (seen.has(index)) continue;
      seen.add(index);
      sum += values[index];
    }
    means.push(sum / sampleN);
  }
  return means;
};

const drawUgaCltPlot = (svg, means, parameter, variable) => {
  const width = 760;
  const height = 430;
  const margin = { top: 42, right: 28, bottom: 72, left: 76 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const min = Math.min(...means, parameter);
  const max = Math.max(...means, parameter);
  const span = max - min || 1;
  const xMin = min - span * 0.08;
  const xMax = max + span * 0.08;
  const rawSd = standardDeviation(means);
  const sd = Number.isFinite(rawSd) ? rawSd : 0;
  const binCount = Math.max(5, Math.min(45, Math.round(span / (3.5 * (sd / means.length ** (1 / 3)))) || 12));
  const binWidth = (xMax - xMin) / binCount;
  const bins = Array.from({ length: binCount }, (_, index) => ({ x0: xMin + index * binWidth, x1: xMin + (index + 1) * binWidth, count: 0 }));
  means.forEach((value) => {
    const index = Math.min(Math.floor((value - xMin) / binWidth), binCount - 1);
    bins[Math.max(index, 0)].count += 1;
  });
  const densities = bins.map((bin) => bin.count / (means.length * binWidth));
  const meanOfMeans = means.reduce((sum, value) => sum + value, 0) / means.length;
  const densityPoints = normalPoints(meanOfMeans, Math.max(sd, 0.0001), xMin, xMax, 180);
  const yMax = Math.max(...densities, ...densityPoints.map((point) => point.y), 1) * 1.12;
  const xScale = (value) => margin.left + ((value - xMin) / (xMax - xMin || 1)) * plotWidth;
  const yScale = (value) => margin.top + plotHeight - (value / yMax) * plotHeight;

  svg.replaceChildren(svgEl("rect", { x: 0, y: 0, width, height, fill: "#fff" }));
  drawNormalAxes(svg, {
    width,
    height,
    margin,
    xMin,
    xMax,
    yMax,
    xScale,
    yScale,
    title: "Distribution of Sample Means",
    xTitle: variable === "sex" ? "Proportion Male" : "Means",
    yTitle: "Density",
    yLabelFormat: (value) => value.toFixed(2),
  });

  bins.forEach((bin) => {
    const density = bin.count / (means.length * binWidth);
    const x = xScale(bin.x0) + 1;
    const y = yScale(density);
    svg.appendChild(svgEl("rect", {
      x,
      y,
      width: Math.max(xScale(bin.x1) - xScale(bin.x0) - 2, 1),
      height: margin.top + plotHeight - y,
      fill: "rgba(31, 111, 235, 0.62)",
      stroke: "#1455a0",
    }));
  });

  drawNormalPath(svg, densityPoints, xScale, yScale, "red");
  svg.appendChild(svgEl("line", {
    x1: xScale(parameter),
    x2: xScale(parameter),
    y1: margin.top,
    y2: margin.top + plotHeight,
    stroke: "darkgreen",
    "stroke-width": 3,
  }));
};

const initUgaCltWidget = async (root) => {
  const data = await fetchCsv(root.dataset.csv);
  const variableSelect = root.querySelector("[data-uga-clt-variable]");
  const sizeInput = root.querySelector("[data-uga-clt-size]");
  const repsInput = root.querySelector("[data-uga-clt-reps]");
  const svg = root.querySelector("svg");
  const note = root.querySelector("[data-uga-clt-note]");

  const draw = () => {
    const sampleSize = Math.min(Math.max(Math.round(Number(sizeInput.value) || 40), 1), 1000);
    const reps = Math.min(Math.max(Math.round(Number(repsInput.value) || 100), 1), 10000);
    sizeInput.value = sampleSize;
    repsInput.value = reps;
    const variable = variableSelect.value;
    const means = repeatedSampleMeans(data, variable, sampleSize, reps);
    const parameter = ugaPopulationParameter(data, variable);
    drawUgaCltPlot(svg, means, parameter, variable);
    note.textContent = `${reps.toLocaleString()} repeated samples of size ${sampleSize}; population ${ugaStatisticLabels[variable].toLowerCase()} = ${formatUgaValue(parameter, 3)}.`;
  };

  [variableSelect, sizeInput, repsInput].forEach((control) => control.addEventListener("input", draw));
  draw();
};

const initNurseDietSummaryWidget = async (root) => {
  const data = await fetchCsv(root.dataset.csv);
  const select = root.querySelector("[data-nurse-variable]");
  const svg = root.querySelector("svg");
  const count = root.querySelector("[data-nurse-count]");
  const dataTable = root.querySelector(".lab-table-wrap table:not([data-nurse-summary])");
  const summaryTable = root.querySelector("[data-nurse-summary]");
  const columns = ["SatFat", "TotalFat", "Calories"];

  const draw = () => {
    const variable = select.value;
    const values = data.map((row) => Number(row[variable])).filter(Number.isFinite);
    count.textContent = `Showing first 5 of ${data.length.toLocaleString()} entries`;
    renderSimpleTable(dataTable, columns, data.slice(0, 5), columns);
    drawUgaHistogram(svg, values, { title: variable, xTitle: variable });

    const summary = [
      { Statistic: "Min.", Value: formatUgaValue(Math.min(...values), 2) },
      { Statistic: "1st Qu.", Value: formatUgaValue(quantile(values, 0.25), 2) },
      { Statistic: "Median", Value: formatUgaValue(quantile(values, 0.5), 2) },
      { Statistic: "Mean", Value: formatUgaValue(values.reduce((sum, value) => sum + value, 0) / values.length, 2) },
      { Statistic: "3rd Qu.", Value: formatUgaValue(quantile(values, 0.75), 2) },
      { Statistic: "Max.", Value: formatUgaValue(Math.max(...values), 2) },
    ];
    renderSimpleTable(summaryTable, ["Statistic", "Value"], summary);
  };

  select.addEventListener("change", draw);
  draw();
};

const initTennisSummaryWidget = async (root) => {
  const data = await fetchCsv(root.dataset.csv);
  const select = root.querySelector("[data-tennis-variable]");
  const svg = root.querySelector("svg");
  const count = root.querySelector("[data-tennis-count]");
  const dataTable = root.querySelector(".lab-table-wrap table:not([data-tennis-summary])");
  const summaryTable = root.querySelector("[data-tennis-summary]");
  const columns = ["Age", "Motrin1", "Motrin2", "Motrin3", "Placebo1", "Placebo2", "Placebo3", "Delta1", "Delta2", "Delta3"];

  const draw = () => {
    const variable = select.value;
    const values = data.map((row) => Number(row[variable])).filter(Number.isFinite);
    count.textContent = `Showing first 5 of ${data.length.toLocaleString()} entries`;
    renderSimpleTable(dataTable, columns, data.slice(0, 5), columns);
    drawUgaHistogram(svg, values, { title: variable, xTitle: variable });

    const summary = [
      { Statistic: "Min.", Value: formatUgaValue(Math.min(...values), 2) },
      { Statistic: "1st Qu.", Value: formatUgaValue(quantile(values, 0.25), 2) },
      { Statistic: "Median", Value: formatUgaValue(quantile(values, 0.5), 2) },
      { Statistic: "Mean", Value: formatUgaValue(values.reduce((sum, value) => sum + value, 0) / values.length, 2) },
      { Statistic: "3rd Qu.", Value: formatUgaValue(quantile(values, 0.75), 2) },
      { Statistic: "Max.", Value: formatUgaValue(Math.max(...values), 2) },
    ];
    renderSimpleTable(summaryTable, ["Statistic", "Value"], summary);
  };

  select.addEventListener("change", draw);
  draw();
};

const initCalfSummaryWidget = async (root) => {
  const data = await fetchCsv(root.dataset.csv);
  const select = root.querySelector("[data-calf-feed]");
  const svg = root.querySelector("svg");
  const count = root.querySelector("[data-calf-count]");
  const dataTable = root.querySelector(".lab-table-wrap table:not([data-calf-summary])");
  const summaryTable = root.querySelector("[data-calf-summary]");
  const columns = ["Feed", "Weight_Gain"];

  const displayRows = data.slice(0, 10).map((row) => ({
    Feed: row.Feed,
    Weight_Gain: formatUgaValue(row.Weight_Gain, 2),
  }));

  const draw = () => {
    const feed = select.value;
    const values = data
      .filter((row) => row.Feed === feed)
      .map((row) => Number(row.Weight_Gain))
      .filter(Number.isFinite);

    count.textContent = `Showing first 10 of ${data.length.toLocaleString()} entries`;
    renderSimpleTable(dataTable, columns, displayRows, ["Feed", "Weight_Gain"]);
    drawUgaHistogram(svg, values, { title: feed, xTitle: "Weight_Gain" });

    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const summary = [
      { Statistic: "Min.", Value: formatUgaValue(Math.min(...values), 2) },
      { Statistic: "1st Qu.", Value: formatUgaValue(quantile(values, 0.25), 2) },
      { Statistic: "Median", Value: formatUgaValue(quantile(values, 0.5), 2) },
      { Statistic: "Mean", Value: formatUgaValue(mean, 2) },
      { Statistic: "3rd Qu.", Value: formatUgaValue(quantile(values, 0.75), 2) },
      { Statistic: "Max.", Value: formatUgaValue(Math.max(...values), 2) },
    ];
    renderSimpleTable(summaryTable, ["Statistic", "Value"], summary);
  };

  select.addEventListener("change", draw);
  draw();
};

const drawDatasaurusScatter = (svg, rows, title) => {
  const width = 760;
  const height = 420;
  const margin = { top: 42, right: 24, bottom: 76, left: 76 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const xValues = rows.map((row) => row.x);
  const yValues = rows.map((row) => row.y);
  const xMinRaw = Math.min(...xValues);
  const xMaxRaw = Math.max(...xValues);
  const yMinRaw = Math.min(...yValues);
  const yMaxRaw = Math.max(...yValues);
  const xPad = (xMaxRaw - xMinRaw) * 0.08 || 1;
  const yPad = (yMaxRaw - yMinRaw) * 0.08 || 1;
  const xMin = xMinRaw - xPad;
  const xMax = xMaxRaw + xPad;
  const yMin = yMinRaw - yPad;
  const yMax = yMaxRaw + yPad;
  const xScale = (value) => margin.left + ((value - xMin) / (xMax - xMin)) * plotWidth;
  const yScale = (value) => margin.top + plotHeight - ((value - yMin) / (yMax - yMin)) * plotHeight;
  const axisColor = "#2f3944";

  svg.replaceChildren(svgEl("rect", { x: 0, y: 0, width, height, fill: "#fff" }));
  svg.appendChild(svgEl("text", { x: width / 2, y: 24, "text-anchor": "middle", class: "lab-plot-title" })).textContent = title;
  svg.appendChild(svgEl("line", { x1: margin.left, x2: width - margin.right, y1: margin.top + plotHeight, y2: margin.top + plotHeight, stroke: axisColor }));
  svg.appendChild(svgEl("line", { x1: margin.left, x2: margin.left, y1: margin.top, y2: margin.top + plotHeight, stroke: axisColor }));

  for (let index = 0; index <= 5; index += 1) {
    const value = xMin + ((xMax - xMin) * index) / 5;
    const x = xScale(value);
    svg.appendChild(svgEl("line", { x1: x, x2: x, y1: margin.top + plotHeight, y2: margin.top + plotHeight + 5, stroke: axisColor }));
    svg.appendChild(svgEl("text", { x, y: height - 46, "text-anchor": "middle", class: "lab-axis-label" })).textContent = formatUgaValue(value, 1);
  }

  for (let index = 0; index <= 4; index += 1) {
    const value = yMin + ((yMax - yMin) * index) / 4;
    const y = yScale(value);
    svg.appendChild(svgEl("line", { x1: margin.left - 5, x2: margin.left, y1: y, y2: y, stroke: axisColor }));
    svg.appendChild(svgEl("text", { x: margin.left - 10, y: y + 4, "text-anchor": "end", class: "lab-axis-label" })).textContent = formatUgaValue(value, 1);
  }

  rows.forEach((row) => {
    svg.appendChild(svgEl("circle", {
      cx: xScale(row.x),
      cy: yScale(row.y),
      r: 3.5,
      fill: "#2563eb",
      opacity: 0.82,
    }));
  });

  svg.appendChild(svgEl("text", { x: width / 2, y: height - 14, "text-anchor": "middle", class: "lab-axis-title" })).textContent = "x";
  const yTitle = svgEl("text", { x: 18, y: height / 2, "text-anchor": "middle", class: "lab-axis-title", transform: `rotate(-90 18 ${height / 2})` });
  yTitle.textContent = "y";
  svg.appendChild(yTitle);
};

const initDatasaurusWidget = async (root) => {
  const data = (await fetchCsv(root.dataset.csv)).map((row) => ({
    dataset: row.dataset,
    x: Number(row.x),
    y: Number(row.y),
  })).filter((row) => Number.isFinite(row.x) && Number.isFinite(row.y));
  const select = root.querySelector("[data-datasaurus-dataset]");
  const svg = root.querySelector("svg");
  const table = root.querySelector("[data-datasaurus-summary]");

  const draw = () => {
    const selected = select.value;
    const rows = data.filter((row) => row.dataset === selected);
    const xValues = rows.map((row) => row.x);
    const yValues = rows.map((row) => row.y);
    drawDatasaurusScatter(svg, rows, `Scatter Plot of ${selected}`);
    renderSimpleTable(table, ["Statistic", "x", "y"], [
      {
        Statistic: "Mean",
        x: formatUgaValue(xValues.reduce((sum, value) => sum + value, 0) / xValues.length, 4),
        y: formatUgaValue(yValues.reduce((sum, value) => sum + value, 0) / yValues.length, 4),
      },
      {
        Statistic: "SD",
        x: formatUgaValue(standardDeviation(xValues), 4),
        y: formatUgaValue(standardDeviation(yValues), 4),
      },
    ]);
  };

  select.addEventListener("change", draw);
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

  document.querySelectorAll("[data-roc-widget]").forEach((root) => {
    initRocWidget(root).catch((error) => root.insertAdjacentHTML("beforeend", `<p class="lab-widget-error">${error.message}</p>`));
  });

  document.querySelectorAll("[data-cutoff-widget]").forEach((root) => {
    initCutoffWidget(root).catch((error) => root.insertAdjacentHTML("beforeend", `<p class="lab-widget-error">${error.message}</p>`));
  });

  document.querySelectorAll("[data-distribution-widget]").forEach(initDistributionWidget);

  document.querySelectorAll("[data-normal-curves]").forEach(initNormalCurvesWidget);

  document.querySelectorAll("[data-normal-calculator]").forEach(initNormalCalculatorWidget);

  document.querySelectorAll("[data-uga-distribution]").forEach((root) => {
    initUgaDistributionWidget(root).catch((error) => root.insertAdjacentHTML("beforeend", `<p class="lab-widget-error">${error.message}</p>`));
  });

  document.querySelectorAll("[data-uga-sample]").forEach((root) => {
    initUgaSampleWidget(root).catch((error) => root.insertAdjacentHTML("beforeend", `<p class="lab-widget-error">${error.message}</p>`));
  });

  document.querySelectorAll("[data-uga-sample-size]").forEach((root) => {
    initUgaSampleSizeWidget(root).catch((error) => root.insertAdjacentHTML("beforeend", `<p class="lab-widget-error">${error.message}</p>`));
  });

  document.querySelectorAll("[data-uga-clt]").forEach((root) => {
    initUgaCltWidget(root).catch((error) => root.insertAdjacentHTML("beforeend", `<p class="lab-widget-error">${error.message}</p>`));
  });

  document.querySelectorAll("[data-nurse-diet-summary]").forEach((root) => {
    initNurseDietSummaryWidget(root).catch((error) => root.insertAdjacentHTML("beforeend", `<p class="lab-widget-error">${error.message}</p>`));
  });

  document.querySelectorAll("[data-tennis-summary]").forEach((root) => {
    initTennisSummaryWidget(root).catch((error) => root.insertAdjacentHTML("beforeend", `<p class="lab-widget-error">${error.message}</p>`));
  });

  document.querySelectorAll("[data-calf-widget]").forEach((root) => {
    initCalfSummaryWidget(root).catch((error) => root.insertAdjacentHTML("beforeend", `<p class="lab-widget-error">${error.message}</p>`));
  });

  document.querySelectorAll("[data-datasaurus-widget]").forEach((root) => {
    initDatasaurusWidget(root).catch((error) => root.insertAdjacentHTML("beforeend", `<p class="lab-widget-error">${error.message}</p>`));
  });
});
