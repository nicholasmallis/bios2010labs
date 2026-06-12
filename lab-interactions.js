document.addEventListener("click", (event) => {
  const answer = event.target.closest(".lab-answer");
  if (!answer) return;

  const quiz = answer.closest("[data-lab-quiz]");
  const feedback = quiz.querySelector(".lab-feedback");
  const isCorrect = answer.dataset.correct === "true";

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

const drawAxes = (svg, scales) => {
  const { width, height, margin, plotHeight, xMin, xMax, yMax, xScale, yScale } = scales;
  const axisColor = "#2f3944";
  svg.appendChild(svgEl("line", { x1: margin.left, x2: width - margin.right, y1: margin.top + plotHeight, y2: margin.top + plotHeight, stroke: axisColor }));
  svg.appendChild(svgEl("line", { x1: margin.left, x2: margin.left, y1: margin.top, y2: margin.top + plotHeight, stroke: axisColor }));

  for (let index = 0; index <= 5; index += 1) {
    const x = xMin + ((xMax - xMin) * index) / 5;
    const screenX = xScale(x);
    svg.appendChild(svgEl("line", { x1: screenX, x2: screenX, y1: margin.top + plotHeight, y2: margin.top + plotHeight + 5, stroke: axisColor }));
    svg.appendChild(svgEl("text", { x: screenX, y: height - 28, "text-anchor": "middle", class: "lab-axis-label" })).textContent = x.toFixed(1);
  }

  for (let index = 0; index <= 4; index += 1) {
    const y = (yMax * index) / 4;
    const screenY = yScale(y);
    svg.appendChild(svgEl("line", { x1: margin.left - 5, x2: margin.left, y1: screenY, y2: screenY, stroke: axisColor }));
    svg.appendChild(svgEl("text", { x: margin.left - 10, y: screenY + 4, "text-anchor": "end", class: "lab-axis-label" })).textContent = y.toFixed(2);
  }

  svg.appendChild(svgEl("text", { x: width / 2, y: height - 7, "text-anchor": "middle", class: "lab-axis-title" })).textContent =
    "Duration (minutes)";
  const yTitle = svgEl("text", { x: 16, y: height / 2, "text-anchor": "middle", class: "lab-axis-title", transform: `rotate(-90 16 ${height / 2})` });
  yTitle.textContent = "Density";
  svg.appendChild(yTitle);
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
});
