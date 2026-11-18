(function () {
  "use strict";

  const MONTHS_NOMINATIVE = [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
  ];

  const MONTHS_GENITIVE = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря"
  ];

  const MONTHS_SHORT = [
    "янв", "фев", "мар", "апр", "май", "июн",
    "июл", "авг", "сен", "окт", "ноя", "дек"
  ];

  const WEEKDAYS_SHORT = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

  function pad2(value) {
    return value < 10 ? "0" + value : String(value);
  }

  function toISO(date) {
    return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate());
  }

  function parseISO(iso) {
    const parts = iso.split("-");
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  function isValidISODate(iso) {
    if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      return false;
    }
    const date = parseISO(iso);
    return toISO(date) === iso;
  }

  function todayISO() {
    return toISO(new Date());
  }

  function addDays(iso, days) {
    const date = parseISO(iso);
    date.setDate(date.getDate() + days);
    return toISO(date);
  }

  function daysInRange(range) {
    const start = parseISO(range.start);
    const end = parseISO(range.end);
    return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  }

  function startOfWeek(iso) {
    const date = parseISO(iso);
    const weekday = date.getDay();
    const offset = weekday === 0 ? -6 : 1 - weekday;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset);
  }

  function getRange(mode, anchorISO) {
    const anchor = parseISO(anchorISO);
    if (mode === "week") {
      const start = startOfWeek(anchorISO);
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
      return { start: toISO(start), end: toISO(end) };
    }
    if (mode === "year") {
      return { start: anchor.getFullYear() + "-01-01", end: anchor.getFullYear() + "-12-31" };
    }
    return {
      start: toISO(new Date(anchor.getFullYear(), anchor.getMonth(), 1)),
      end: toISO(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0))
    };
  }

  function rangeFromDates(start, end) {
    return { start, end };
  }

  function shiftAnchor(mode, anchorISO, delta) {
    const anchor = parseISO(anchorISO);
    if (mode === "week") {
      return addDays(anchorISO, delta * 7);
    }
    if (mode === "year") {
      return anchor.getFullYear() + delta + "-01-01";
    }
    return toISO(new Date(anchor.getFullYear(), anchor.getMonth() + delta, 1));
  }

  function previousRange(mode, range) {
    if (mode === "custom") {
      const length = daysInRange(range);
      const end = addDays(range.start, -1);
      return { start: addDays(end, 1 - length), end };
    }
    return getRange(mode, shiftAnchor(mode, range.start, -1));
  }

  function filterByRange(transactions, range) {
    return transactions.filter((transaction) => transaction.date >= range.start && transaction.date <= range.end);
  }

  function sumKopecks(transactions) {
    return transactions.reduce((total, transaction) => total + transaction.amountKopecks, 0);
  }

  function groupByCategory(transactions) {
    const totals = new Map();
    let total = 0;
    for (const transaction of transactions) {
      totals.set(transaction.category, (totals.get(transaction.category) || 0) + transaction.amountKopecks);
      total += transaction.amountKopecks;
    }
    const groups = [];
    totals.forEach((amount, id) => {
      groups.push({ id, amount, share: total > 0 ? amount / total : 0 });
    });
    groups.sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id));
    return groups;
  }

  function buildBuckets(range, transactions) {
    const useDays = daysInRange(range) <= 62;
    if (useDays) {
      const totals = new Map();
      for (const transaction of transactions) {
        totals.set(transaction.date, (totals.get(transaction.date) || 0) + transaction.amountKopecks);
      }
      const labels = [];
      const longLabels = [];
      const values = [];
      let cursor = range.start;
      while (cursor <= range.end) {
        const date = parseISO(cursor);
        labels.push(String(date.getDate()));
        longLabels.push(date.getDate() + " " + MONTHS_GENITIVE[date.getMonth()] + ", " + WEEKDAYS_SHORT[date.getDay()]);
        values.push(totals.get(cursor) || 0);
        cursor = addDays(cursor, 1);
      }
      return { labels, longLabels, values, unit: "day" };
    }

    const totals = new Map();
    for (const transaction of transactions) {
      const key = transaction.date.slice(0, 7);
      totals.set(key, (totals.get(key) || 0) + transaction.amountKopecks);
    }
    const endKey = range.end.slice(0, 7);
    const labels = [];
    const longLabels = [];
    const values = [];
    let year = Number(range.start.slice(0, 4));
    let month = Number(range.start.slice(5, 7)) - 1;
    while (true) {
      const key = year + "-" + pad2(month + 1);
      if (key > endKey) {
        break;
      }
      labels.push(MONTHS_SHORT[month]);
      longLabels.push(MONTHS_NOMINATIVE[month] + " " + year);
      values.push(totals.get(key) || 0);
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
    }
    return { labels, longLabels, values, unit: "month" };
  }

  function compare(currentTotal, previousTotal) {
    const diff = currentTotal - previousTotal;
    if (previousTotal <= 0) {
      return { diff, percent: null, direction: currentTotal > 0 ? "up" : "flat" };
    }
    return {
      diff,
      percent: (diff / previousTotal) * 100,
      direction: diff > 0 ? "up" : diff < 0 ? "down" : "flat"
    };
  }

  function formatShortDate(iso) {
    return iso.slice(8, 10) + "." + iso.slice(5, 7) + "." + iso.slice(0, 4);
  }

  function formatRangeLabel(mode, range) {
    const start = parseISO(range.start);
    const end = parseISO(range.end);
    if (mode === "year") {
      return String(start.getFullYear());
    }
    if (mode === "month") {
      return MONTHS_NOMINATIVE[start.getMonth()] + " " + start.getFullYear();
    }
    if (mode === "custom") {
      if (range.start === range.end) {
        return formatShortDate(range.start);
      }
      return formatShortDate(range.start) + " – " + formatShortDate(range.end);
    }
    const sameYear = start.getFullYear() === end.getFullYear();
    const sameMonth = sameYear && start.getMonth() === end.getMonth();
    if (sameMonth) {
      return start.getDate() + "–" + end.getDate() + " " + MONTHS_GENITIVE[start.getMonth()] + " " + start.getFullYear();
    }
    if (sameYear) {
      return (
        start.getDate() + " " + MONTHS_GENITIVE[start.getMonth()] + " – " +
        end.getDate() + " " + MONTHS_GENITIVE[end.getMonth()] + " " + start.getFullYear()
      );
    }
    return (
      start.getDate() + " " + MONTHS_GENITIVE[start.getMonth()] + " " + start.getFullYear() + " – " +
      end.getDate() + " " + MONTHS_GENITIVE[end.getMonth()] + " " + end.getFullYear()
    );
  }

  function isInRange(range, iso) {
    return iso >= range.start && iso <= range.end;
  }

  window.Budget = window.Budget || {};
  window.Budget.periods = {
    todayISO,
    parseISO,
    toISO,
    isValidISODate,
    addDays,
    daysInRange,
    getRange,
    rangeFromDates,
    shiftAnchor,
    previousRange,
    filterByRange,
    sumKopecks,
    groupByCategory,
    buildBuckets,
    compare,
    formatShortDate,
    formatRangeLabel,
    isInRange
  };
})();
