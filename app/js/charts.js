(function () {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const NBSP = "\u00A0";

  function groupThousands(value) {
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  }

  function formatMoney(kopecks) {
    const value = Math.round(Number(kopecks) || 0);
    const sign = value < 0 ? "−" : "";
    const abs = Math.abs(value);
    const rubles = Math.floor(abs / 100);
    const cents = abs % 100;
    return sign + groupThousands(rubles) + (cents ? "," + String(cents).padStart(2, "0") : "") + NBSP + "₽";
  }

  function formatCompact(kopecks) {
    const value = Math.round(Number(kopecks) || 0);
    const sign = value < 0 ? "−" : "";
    const rubles = Math.abs(value) / 100;
    const decimal = (number) => String(Math.round(number * 10) / 10).replace(".", ",");
    if (rubles >= 1000000) {
      return sign + decimal(rubles / 1000000) + NBSP + "млн" + NBSP + "₽";
    }
    if (rubles >= 1000) {
      return sign + decimal(rubles / 1000) + NBSP + "тыс." + NBSP + "₽";
    }
    return formatMoney(value);
  }

  function formatPercent(value, signed) {
    const rounded = Math.round(Number(value) * 10) / 10;
    const prefix = signed ? (rounded > 0 ? "+" : rounded < 0 ? "−" : "") : "";
    return prefix + String(Math.abs(rounded)).replace(".", ",") + NBSP + "%";
  }

  function svgElement(name, attributes) {
    const element = document.createElementNS(NS, name);
    if (attributes) {
      Object.keys(attributes).forEach((key) => {
        element.setAttribute(key, attributes[key]);
      });
    }
    return element;
  }

  function renderDonut(container, segments, total, ariaLabel) {
    container.replaceChildren();
    const size = 190;
    const stroke = 24;
    const radius = (size - stroke) / 2;
    const center = size / 2;
    const circumference = 2 * Math.PI * radius;

    const svg = svgElement("svg", {
      viewBox: "0 0 " + size + " " + size,
      role: "img",
      "aria-label": ariaLabel
    });
    const ring = svgElement("g", { transform: "rotate(-90 " + center + " " + center + ")" });
    let offset = 0;

    segments.forEach((segment) => {
      const length = circumference * segment.share;
      const visible = Math.max(length - 2, 0.6);
      const circle = svgElement("circle", {
        cx: center,
        cy: center,
        r: radius,
        fill: "none",
        "stroke-width": stroke,
        stroke: "var(--cat-" + segment.id + ")",
        "stroke-dasharray": visible + " " + (circumference - visible),
        "stroke-dashoffset": String(-offset)
      });
      const title = svgElement("title");
      title.textContent = segment.label + ": " + formatMoney(segment.amount);
      circle.appendChild(title);
      ring.appendChild(circle);
      offset += length;
    });

    const totalText = svgElement("text", {
      x: center,
      y: center,
      "text-anchor": "middle",
      "dominant-baseline": "central",
      class: "donut-total"
    });
    totalText.textContent = formatCompact(total);

    svg.appendChild(ring);
    svg.appendChild(totalText);
    container.appendChild(svg);
  }

  function niceMax(value) {
    if (!(value > 0)) {
      return 1;
    }
    const exponent = Math.pow(10, Math.floor(Math.log(value) / Math.LN10));
    const fraction = value / exponent;
    let nice;
    if (fraction <= 1) {
      nice = 1;
    } else if (fraction <= 2) {
      nice = 2;
    } else if (fraction <= 5) {
      nice = 5;
    } else {
      nice = 10;
    }
    return nice * exponent;
  }

  function renderBars(container, buckets, ariaLabel) {
    container.replaceChildren();
    const values = buckets.values;
    if (!values.length) {
      return;
    }

    const width = Math.max(container.clientWidth || 0, 300);
    const height = 244;
    const padLeft = 62;
    const padRight = 10;
    const padTop = 16;
    const padBottom = 34;
    const plotWidth = width - padLeft - padRight;
    const plotHeight = height - padTop - padBottom;
    const max = niceMax(Math.max.apply(null, values));

    const svg = svgElement("svg", {
      viewBox: "0 0 " + width + " " + height,
      role: "img",
      "aria-label": ariaLabel,
      class: "chart-svg"
    });

    for (let step = 0; step <= 4; step += 1) {
      const lineY = padTop + plotHeight - (plotHeight * step) / 4;
      svg.appendChild(
        svgElement("line", {
          x1: padLeft,
          y1: lineY,
          x2: width - padRight,
          y2: lineY,
          class: "grid-line"
        })
      );
      const label = svgElement("text", {
        x: padLeft - 8,
        y: lineY,
        "text-anchor": "end",
        "dominant-baseline": "middle",
        class: "chart-text"
      });
      label.textContent = formatCompact((max * step) / 4);
      svg.appendChild(label);
    }

    const slot = plotWidth / values.length;
    const barWidth = Math.min(30, Math.max(3, slot * 0.62));
    let labelStep = 1;
    if (values.length > 12) {
      labelStep = Math.ceil(values.length / 8);
    }
    let lastLabelIndex = -Infinity;

    values.forEach((value, index) => {
      if (value > 0) {
        const barHeight = Math.max((value / max) * plotHeight, 1.5);
        const x = padLeft + slot * index + (slot - barWidth) / 2;
        const y = padTop + plotHeight - barHeight;
        const bar = svgElement("rect", {
          x,
          y,
          width: barWidth,
          height: barHeight,
          rx: Math.min(3, barWidth / 2),
          class: "bar"
        });
        const title = svgElement("title");
        title.textContent = buckets.longLabels[index] + ": " + formatMoney(value);
        bar.appendChild(title);
        svg.appendChild(bar);
      }

      const isEdgeLabel = index === values.length - 1 && index - lastLabelIndex >= 2;
      if (index % labelStep === 0 || isEdgeLabel) {
        const text = svgElement("text", {
          x: padLeft + slot * index + slot / 2,
          y: height - 12,
          "text-anchor": "middle",
          class: "chart-text"
        });
        text.textContent = buckets.labels[index];
        svg.appendChild(text);
        lastLabelIndex = index;
      }
    });

    container.appendChild(svg);
  }

  window.Budget = window.Budget || {};
  window.Budget.charts = {
    formatMoney,
    formatCompact,
    formatPercent,
    renderDonut,
    renderBars
  };
})();
