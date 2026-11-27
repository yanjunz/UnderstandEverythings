"use strict";

const primeDemo = document.getElementById("prime-demo");
const limitInput = document.getElementById("prime-limit");
const limitValue = document.getElementById("limit-value");
const actualValue = document.getElementById("actual-value");
const basicValue = document.getElementById("basic-value");
const integralValue = document.getElementById("integral-value");
const primeReading = document.getElementById("prime-reading");
const presets = primeDemo.querySelectorAll("[data-limit]");
const chart = document.getElementById("prime-chart");
const context = chart.getContext("2d");
const maxLimit = Number(limitInput.max);
const integer = new Intl.NumberFormat("zh-CN");
const decimal = new Intl.NumberFormat("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Sieve all possible limits once. The arrays store values at each integer x.
const composite = new Uint8Array(maxLimit + 1);
for (let candidate = 2; candidate * candidate <= maxLimit; candidate += 1) {
  if (composite[candidate]) continue;
  for (let multiple = candidate * candidate; multiple <= maxLimit; multiple += candidate) {
    composite[multiple] = 1;
  }
}

const primeCounts = new Uint16Array(maxLimit + 1);
const basicEstimates = new Float64Array(maxLimit + 1);
const integralEstimates = new Float64Array(maxLimit + 1);
for (let x = 2; x <= maxLimit; x += 1) {
  primeCounts[x] = primeCounts[x - 1] + Number(!composite[x]);
  basicEstimates[x] = x / Math.log(x);
}

// Simpson's rule on four quarter-intervals between consecutive integers.
const density = (t) => 1 / Math.log(t);
for (let x = 3; x <= maxLimit; x += 1) {
  const interval = density(x - 1) + 4 * density(x - .75) + 2 * density(x - .5)
    + 4 * density(x - .25) + density(x);
  integralEstimates[x] = integralEstimates[x - 1] + interval / 12;
}

const palette = getComputedStyle(primeDemo);
const series = [
  { values: basicEstimates, color: palette.getPropertyValue("--basic"), dash: [6, 5] },
  { values: integralEstimates, color: palette.getPropertyValue("--integral"), dash: [2, 4] },
  { values: primeCounts, color: palette.getPropertyValue("--actual"), dash: [], steps: true },
];

function drawChart() {
  if (!context) return;
  const { width, height } = chart.getBoundingClientRect();
  if (width === 0 || height === 0) return;
  const scale = window.devicePixelRatio || 1;
  chart.width = Math.round(width * scale);
  chart.height = Math.round(height * scale);
  context.scale(scale, scale);

  const limit = Number(limitInput.value);
  const maxValue = Math.max(primeCounts[limit], basicEstimates[limit], integralEstimates[limit]);
  const tickSize = maxValue <= 10 ? 2 : maxValue <= 40 ? 10 : 50;
  const topValue = Math.ceil(maxValue / tickSize) * tickSize;
  const left = 35;
  const right = width - 19;
  const top = 29;
  const bottom = height - 32;
  const plotX = (x) => left + (x - 2) / (limit - 2) * (right - left);
  const plotY = (y) => bottom - y / topValue * (bottom - top);

  context.font = '12px system-ui, "Noto Sans CJK SC", sans-serif';
  context.fillStyle = "#4f5872";
  context.textAlign = "left";
  context.fillText("个数", left, 19);
  context.textAlign = "right";
  context.textBaseline = "middle";
  context.strokeStyle = "#e1e6f2";
  for (let value = 0; value <= topValue; value += tickSize) {
    const y = plotY(value);
    context.beginPath();
    context.moveTo(left, y);
    context.lineTo(right, y);
    context.stroke();
    context.fillText(integer.format(value), left - 7, y);
  }

  context.strokeStyle = "#9aa7c2";
  context.beginPath();
  context.moveTo(left, top);
  context.lineTo(left, bottom);
  context.lineTo(right, bottom);
  context.stroke();
  context.textAlign = "center";
  context.fillText("2", left, bottom + 16);
  const midpoint = Math.round((limit + 2) / 2);
  context.fillText(integer.format(midpoint), plotX(midpoint), bottom + 16);
  context.textAlign = "right";
  context.fillText(`x = ${integer.format(limit)}`, right, bottom + 16);

  for (const { values, color, dash, steps } of series) {
    context.beginPath();
    context.strokeStyle = color;
    context.lineWidth = steps ? 2.5 : 1.8;
    context.setLineDash(dash);
    context.moveTo(left, plotY(values[2]));
    for (let x = 3; x <= limit; x += 1) {
      const position = plotX(x);
      if (steps) context.lineTo(position, plotY(values[x - 1]));
      context.lineTo(position, plotY(values[x]));
    }
    context.stroke();
  }
}

function renderPrimeCount() {
  const limit = Number(limitInput.value);
  const actual = primeCounts[limit];
  const integral = integralEstimates[limit];
  const distance = decimal.format(Math.abs(integral - actual));
  limitValue.value = integer.format(limit);
  actualValue.textContent = integer.format(actual);
  basicValue.textContent = decimal.format(basicEstimates[limit]);
  integralValue.textContent = decimal.format(integral);
  primeReading.textContent = `在 ${integer.format(limit)} 以内有 ${actual} 个素数。Li₂ 的估计${integral >= actual ? "偏高" : "偏低"}约 ${distance} 个。`;
  for (const preset of presets) {
    preset.setAttribute("aria-pressed", String(Number(preset.dataset.limit) === limit));
  }
  drawChart();
}

for (const preset of presets) {
  preset.addEventListener("click", () => {
    limitInput.value = preset.dataset.limit;
    renderPrimeCount();
  });
}
limitInput.addEventListener("input", renderPrimeCount);
primeDemo.hidden = false;
renderPrimeCount();
new ResizeObserver(drawChart).observe(chart);

const zeroDemo = document.getElementById("zero-demo");
const zeroGuide = document.getElementById("zero-guide");
const zeroReading = document.getElementById("zero-reading");
const zeroDots = zeroDemo.querySelectorAll("[data-zero]");
for (const option of zeroDemo.querySelectorAll('input[name="zero"]')) {
  option.addEventListener("change", () => {
    const selected = zeroDots[Number(option.value)];
    for (const dot of zeroDots) dot.classList.toggle("selected", dot === selected);
    zeroGuide.style.setProperty("--height", selected.style.getPropertyValue("--height"));
    const height = option.labels[0].querySelector(".decimal").textContent;
    zeroReading.textContent = `ρ ≈ 0.5 + ${height}i`;
  });
}
zeroDemo.hidden = false;
