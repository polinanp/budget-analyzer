(function () {
  "use strict";

  const Store = window.Budget.store;
  const Periods = window.Budget.periods;
  const Charts = window.Budget.charts;

  const THEME_KEY = "budget.theme";
  const MAX_KOPECKS = 10000000000;
  const MAX_NOTE_LENGTH = 100;

  const state = {
    mode: "month",
    anchor: Periods.todayISO(),
    customStart: "",
    customEnd: "",
    editingId: null,
    transactions: []
  };

  const dom = {};

  function byId(id) {
    return document.getElementById(id);
  }

  function cacheDom() {
    dom.themeToggle = byId("theme-toggle");
    dom.themeToggleLabel = byId("theme-toggle-label");
    dom.emptyBanner = byId("empty-banner");
    dom.emptyAddButton = byId("empty-add-button");
    dom.demoButton = byId("demo-button");
    dom.periodTabs = byId("period-tabs");
    dom.periodNav = byId("period-nav");
    dom.periodPrev = byId("period-prev");
    dom.periodNext = byId("period-next");
    dom.periodLabel = byId("period-label");
    dom.periodError = byId("period-error");
    dom.customRange = byId("custom-range");
    dom.customStart = byId("custom-start");
    dom.customEnd = byId("custom-end");
    dom.statTotal = byId("stat-total");
    dom.statTotalHint = byId("stat-total-hint");
    dom.statAverage = byId("stat-average");
    dom.statAverageHint = byId("stat-average-hint");
    dom.statCategory = byId("stat-category");
    dom.statCategoryHint = byId("stat-category-hint");
    dom.statCompareCard = byId("stat-compare-card");
    dom.statCompare = byId("stat-compare");
    dom.statCompareHint = byId("stat-compare-hint");
    dom.donut = byId("donut");
    dom.donutLegend = byId("donut-legend");
    dom.donutEmpty = byId("donut-empty");
    dom.donutSubtitle = byId("donut-subtitle");
    dom.bars = byId("bars");
    dom.barsEmpty = byId("bars-empty");
    dom.barsSubtitle = byId("bars-subtitle");
    dom.categoryList = byId("category-list");
    dom.categoryEmpty = byId("category-empty");
    dom.categoriesSubtitle = byId("categories-subtitle");
    dom.txTable = byId("tx-table");
    dom.txBody = byId("tx-body");
    dom.txEmpty = byId("tx-empty");
    dom.txCount = byId("tx-count");
    dom.form = byId("tx-form");
    dom.formTitle = byId("form-title");
    dom.amount = byId("amount");
    dom.amountError = byId("amount-error");
    dom.category = byId("category");
    dom.categoryError = byId("category-error");
    dom.date = byId("date");
    dom.dateError = byId("date-error");
    dom.note = byId("note");
    dom.noteError = byId("note-error");
    dom.submitButton = byId("submit-button");
    dom.cancelEdit = byId("cancel-edit");
    dom.formError = byId("form-error");
    dom.status = byId("status");
  }

  function plural(count, one, few, many) {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) {
      return one;
    }
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
      return few;
    }
    return many;
  }

  function categoryLabel(id) {
    const category = Store.getCategory(id);
    return category ? category.label : "Прочее";
  }

  function currentRange() {
    if (state.mode === "custom") {
      return Periods.rangeFromDates(state.customStart, state.customEnd);
    }
    return Periods.getRange(state.mode, state.anchor);
  }

  function fillCategories() {
    const fragment = document.createDocumentFragment();
    Store.CATEGORIES.forEach((category) => {
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = category.label;
      fragment.appendChild(option);
    });
    dom.category.replaceChildren(fragment);
    dom.category.value = "food";
  }

  function getTheme() {
    return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  }

  function updateThemeButton() {
    const isDark = getTheme() === "dark";
    dom.themeToggle.setAttribute("aria-pressed", isDark ? "true" : "false");
    dom.themeToggleLabel.textContent = isDark ? "Тёмная тема" : "Светлая тема";
  }

  function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    updateThemeButton();
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (error) {
      return;
    }
  }

  function toggleTheme() {
    setTheme(getTheme() === "dark" ? "light" : "dark");
  }

  function announce(message) {
    dom.status.textContent = "";
    dom.status.textContent = message;
  }

  function showPeriodError(message) {
    dom.periodError.textContent = message;
    dom.periodError.hidden = false;
  }

  function hidePeriodError() {
    dom.periodError.textContent = "";
    dom.periodError.hidden = true;
  }

  function setFieldError(input, errorElement, message) {
    input.setAttribute("aria-invalid", "true");
    errorElement.textContent = message;
    errorElement.hidden = false;
  }

  function clearFieldError(input, errorElement) {
    input.removeAttribute("aria-invalid");
    errorElement.textContent = "";
    errorElement.hidden = true;
  }

  function clearAllErrors() {
    clearFieldError(dom.amount, dom.amountError);
    clearFieldError(dom.category, dom.categoryError);
    clearFieldError(dom.date, dom.dateError);
    clearFieldError(dom.note, dom.noteError);
    dom.formError.textContent = "";
    dom.formError.hidden = true;
  }

  function parseAmount(raw) {
    const cleaned = String(raw || "")
      .trim()
      .replace(/\u00A0/g, " ")
      .replace(/\s+/g, "")
      .replace(",", ".");
    if (!cleaned) {
      return { error: "Введите сумму." };
    }
    const normalized = /^\d+[.,]$/.test(cleaned) ? cleaned.slice(0, -1) : cleaned;
    if (!/^\d+(\.\d+)?$/.test(normalized)) {
      return { error: "Сумма должна быть числом, например 1250,50." };
    }
    const parts = normalized.split(".");
    if (parts[1] && parts[1].length > 2) {
      return { error: "Не больше двух знаков после запятой." };
    }
    const rubles = Number(parts[0]);
    const cents = parts[1] ? Number((parts[1] + "00").slice(0, 2)) : 0;
    const kopecks = rubles * 100 + cents;
    if (!(kopecks > 0)) {
      return { error: "Сумма должна быть больше нуля." };
    }
    if (kopecks > MAX_KOPECKS) {
      return { error: "Слишком большая сумма." };
    }
    return { kopecks };
  }

  function kopecksToInput(kopecks) {
    const rubles = Math.floor(kopecks / 100);
    const cents = kopecks % 100;
    return cents ? rubles + "," + String(cents).padStart(2, "0") : String(rubles);
  }

  function validateForm() {
    clearAllErrors();
    let firstInvalid = null;

    const amount = parseAmount(dom.amount.value);
    if (amount.error) {
      setFieldError(dom.amount, dom.amountError, amount.error);
      firstInvalid = firstInvalid || dom.amount;
    }

    if (!Store.getCategory(dom.category.value)) {
      setFieldError(dom.category, dom.categoryError, "Выберите категорию.");
      firstInvalid = firstInvalid || dom.category;
    }

    const dateValue = dom.date.value;
    if (!dateValue) {
      setFieldError(dom.date, dom.dateError, "Укажите дату.");
      firstInvalid = firstInvalid || dom.date;
    } else if (!Periods.isValidISODate(dateValue)) {
      setFieldError(dom.date, dom.dateError, "Некорректная дата.");
      firstInvalid = firstInvalid || dom.date;
    } else if (dateValue > Periods.todayISO()) {
      setFieldError(dom.date, dom.dateError, "Дата не может быть в будущем.");
      firstInvalid = firstInvalid || dom.date;
    }

    if (dom.note.value.trim().length > MAX_NOTE_LENGTH) {
      setFieldError(dom.note, dom.noteError, "Комментарий длиннее " + MAX_NOTE_LENGTH + " символов.");
      firstInvalid = firstInvalid || dom.note;
    }

    if (firstInvalid) {
      firstInvalid.focus();
      return false;
    }
    return true;
  }

  function setEditingMode(isEditing) {
    dom.formTitle.textContent = isEditing ? "Изменить трату" : "Новая трата";
    dom.submitButton.textContent = isEditing ? "Сохранить" : "Добавить трату";
    dom.cancelEdit.hidden = !isEditing;
  }

  function resetForm(dateValue) {
    state.editingId = null;
    dom.form.reset();
    dom.category.value = "food";
    dom.date.value = dateValue || Periods.todayISO();
    clearAllErrors();
    setEditingMode(false);
  }

  function startEdit(transaction) {
    state.editingId = transaction.id;
    dom.amount.value = kopecksToInput(transaction.amountKopecks);
    dom.category.value = transaction.category;
    dom.date.value = transaction.date;
    dom.note.value = transaction.note;
    clearAllErrors();
    setEditingMode(true);
    const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    dom.form.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
    dom.amount.focus();
  }

  function handleFormSubmit(event) {
    event.preventDefault();
    if (!validateForm()) {
      return;
    }
    const amountKopecks = parseAmount(dom.amount.value).kopecks;
    const category = dom.category.value;
    const date = dom.date.value;
    const note = dom.note.value.trim();

    if (state.editingId) {
      Store.update(state.editingId, { amountKopecks, category, date, note });
      announce("Трата изменена.");
    } else {
      Store.add({ amountKopecks, category, date, note });
      announce("Трата добавлена.");
    }

    state.transactions = Store.load();

    if (state.mode !== "custom" && !Periods.isInRange(Periods.getRange(state.mode, state.anchor), date)) {
      state.anchor = date;
    }

    resetForm(date);
    render();
  }

  function handleDelete(transaction) {
    const label = transaction.note ? "«" + transaction.note + "»" : categoryLabel(transaction.category);
    const question =
      "Удалить трату " + label + " на " + Charts.formatMoney(transaction.amountKopecks) + "?";
    if (!window.confirm(question)) {
      return;
    }
    Store.remove(transaction.id);
    state.transactions = Store.load();
    if (state.editingId === transaction.id) {
      resetForm(Periods.todayISO());
    }
    announce("Трата удалена.");
    render();
  }

  function handleCustomSubmit(event) {
    event.preventDefault();
    const start = dom.customStart.value;
    const end = dom.customEnd.value;
    const today = Periods.todayISO();
    let message = "";
    if (!start || !end) {
      message = "Укажите обе даты.";
    } else if (!Periods.isValidISODate(start) || !Periods.isValidISODate(end)) {
      message = "Некорректная дата.";
    } else if (start > end) {
      message = "Дата начала не может быть позже даты окончания.";
    } else if (end > today) {
      message = "Период не может заканчиваться в будущем.";
    }
    if (message) {
      showPeriodError(message);
      return;
    }
    hidePeriodError();
    state.customStart = start;
    state.customEnd = end;
    render();
  }

  function handleTabClick(event) {
    const target = event.target.closest(".period-tab");
    if (!target || !dom.periodTabs.contains(target)) {
      return;
    }
    const mode = target.dataset.mode;
    if (!mode || mode === state.mode) {
      return;
    }
    if (mode === "custom") {
      const range = currentRange();
      const today = Periods.todayISO();
      state.customStart = range.start;
      state.customEnd = range.end > today ? today : range.end;
    }
    state.mode = mode;
    hidePeriodError();
    render();
  }

  function shiftPeriod(delta) {
    if (state.mode === "custom") {
      return;
    }
    const nextAnchor = Periods.shiftAnchor(state.mode, state.anchor, delta);
    if (delta > 0) {
      const nextRange = Periods.getRange(state.mode, nextAnchor);
      if (nextRange.start > Periods.todayISO()) {
        return;
      }
    }
    state.anchor = nextAnchor;
    render();
  }

  function handleDemo() {
    if (!Store.seedDemo()) {
      return;
    }
    state.transactions = Store.load();
    state.anchor = Periods.todayISO();
    announce("Добавлены примеры трат.");
    render();
  }

  function focusForm() {
    const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    dom.form.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
    dom.amount.focus();
  }

  function bindEvents() {
    dom.themeToggle.addEventListener("click", toggleTheme);
    dom.periodTabs.addEventListener("click", handleTabClick);
    dom.periodPrev.addEventListener("click", () => shiftPeriod(-1));
    dom.periodNext.addEventListener("click", () => shiftPeriod(1));
    dom.customRange.addEventListener("submit", handleCustomSubmit);
    dom.form.addEventListener("submit", handleFormSubmit);
    dom.demoButton.addEventListener("click", handleDemo);
    dom.emptyAddButton.addEventListener("click", focusForm);
    dom.cancelEdit.addEventListener("click", () => resetForm(Periods.todayISO()));

    dom.amount.addEventListener("input", () => clearFieldError(dom.amount, dom.amountError));
    dom.category.addEventListener("change", () => clearFieldError(dom.category, dom.categoryError));
    dom.date.addEventListener("input", () => clearFieldError(dom.date, dom.dateError));
    dom.note.addEventListener("input", () => clearFieldError(dom.note, dom.noteError));

    dom.customStart.addEventListener("input", hidePeriodError);
    dom.customEnd.addEventListener("input", hidePeriodError);

    let resizeTimer = 0;
    window.addEventListener("resize", () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(render, 150);
    });
  }

  function renderSummary(total, transactions, grouped, previousTotal, days) {
    dom.statTotal.textContent = Charts.formatMoney(total);
    dom.statTotalHint.textContent = transactions.length
      ? transactions.length + " " + plural(transactions.length, "трата", "траты", "трат")
      : "трат нет";

    dom.statAverage.textContent = Charts.formatMoney(days > 0 ? Math.round(total / days) : 0);
    dom.statAverageHint.textContent = "за " + days + " " + plural(days, "день", "дня", "дней");

    if (grouped.length) {
      const top = grouped[0];
      dom.statCategory.textContent = categoryLabel(top.id);
      dom.statCategoryHint.textContent =
        Charts.formatMoney(top.amount) + " · " + Charts.formatPercent(top.share * 100, false);
    } else {
      dom.statCategory.textContent = "—";
      dom.statCategoryHint.textContent = "трат нет";
    }

    const comparison = Periods.compare(total, previousTotal);
    if (previousTotal > 0) {
      dom.statCompare.textContent = Charts.formatPercent(comparison.percent, true);
      dom.statCompareHint.textContent = "было " + Charts.formatMoney(previousTotal);
      dom.statCompareCard.dataset.trend = comparison.direction;
    } else {
      dom.statCompare.textContent = "—";
      dom.statCompareHint.textContent = "нет данных за прошлый период";
      dom.statCompareCard.removeAttribute("data-trend");
    }
  }

  function renderDonut(grouped, total) {
    if (total <= 0) {
      dom.donut.hidden = true;
      dom.donutLegend.hidden = true;
      dom.donutEmpty.hidden = false;
      dom.donutSubtitle.textContent = "";
      return;
    }
    dom.donut.hidden = false;
    dom.donutLegend.hidden = false;
    dom.donutEmpty.hidden = true;
    dom.donutSubtitle.textContent = "доли от суммы за период";

    const segments = grouped.map((item) => ({
      id: item.id,
      label: categoryLabel(item.id),
      amount: item.amount,
      share: item.share
    }));

    Charts.renderDonut(
      dom.donut,
      segments,
      total,
      "Кольцевая диаграмма расходов по категориям, всего " + Charts.formatMoney(total)
    );

    const fragment = document.createDocumentFragment();
    grouped.forEach((item) => {
      const row = document.createElement("li");
      row.dataset.category = item.id;
      const dot = document.createElement("span");
      dot.className = "legend-dot";
      dot.setAttribute("aria-hidden", "true");
      const name = document.createElement("span");
      name.className = "legend-name";
      name.textContent = categoryLabel(item.id);
      const share = document.createElement("span");
      share.className = "legend-share";
      share.textContent = Charts.formatPercent(item.share * 100, false);
      row.append(dot, name, share);
      fragment.appendChild(row);
    });
    dom.donutLegend.replaceChildren(fragment);
  }

  function renderBars(transactions, range, total, periodLabel) {
    if (total <= 0) {
      dom.bars.hidden = true;
      dom.barsEmpty.hidden = false;
      dom.barsSubtitle.textContent = "";
      return;
    }
    const buckets = Periods.buildBuckets(range, transactions);
    dom.bars.hidden = false;
    dom.barsEmpty.hidden = true;
    dom.barsSubtitle.textContent = buckets.unit === "day" ? "по дням" : "по месяцам";
    Charts.renderBars(
      dom.bars,
      buckets,
      "График расходов " +
        (buckets.unit === "day" ? "по дням" : "по месяцам") +
        " за период " +
        periodLabel
    );
  }

  function renderCategories(grouped) {
    if (!grouped.length) {
      dom.categoryList.hidden = true;
      dom.categoryEmpty.hidden = false;
      dom.categoriesSubtitle.textContent = "";
      return;
    }
    dom.categoryList.hidden = false;
    dom.categoryEmpty.hidden = true;
    dom.categoriesSubtitle.textContent =
      grouped.length + " " + plural(grouped.length, "категория", "категории", "категорий");

    const fragment = document.createDocumentFragment();
    grouped.forEach((item) => {
      const row = document.createElement("li");
      row.className = "category-row";
      row.dataset.category = item.id;

      const dot = document.createElement("span");
      dot.className = "category-dot";
      dot.setAttribute("aria-hidden", "true");

      const name = document.createElement("span");
      name.className = "category-name";
      name.textContent = categoryLabel(item.id);

      const share = document.createElement("span");
      share.className = "category-share";
      share.textContent = Charts.formatPercent(item.share * 100, false);

      const amount = document.createElement("span");
      amount.className = "category-amount";
      amount.textContent = Charts.formatMoney(item.amount);

      const track = document.createElement("span");
      track.className = "category-track";
      track.setAttribute("aria-hidden", "true");
      const fill = document.createElement("span");
      fill.className = "category-fill";
      fill.style.width = Math.max(item.share * 100, 2).toFixed(1) + "%";
      track.appendChild(fill);

      row.append(dot, name, share, amount, track);
      fragment.appendChild(row);
    });
    dom.categoryList.replaceChildren(fragment);
  }

  function renderTable(transactions) {
    dom.txCount.textContent = transactions.length
      ? transactions.length + " " + plural(transactions.length, "трата", "траты", "трат")
      : "";

    if (!transactions.length) {
      dom.txTable.hidden = true;
      dom.txEmpty.hidden = false;
      dom.txBody.replaceChildren();
      return;
    }
    dom.txTable.hidden = false;
    dom.txEmpty.hidden = true;

    const sorted = transactions.slice().sort((a, b) => b.date.localeCompare(a.date));
    const fragment = document.createDocumentFragment();

    sorted.forEach((transaction) => {
      const row = document.createElement("tr");

      const dateCell = document.createElement("td");
      dateCell.textContent = Periods.formatShortDate(transaction.date);

      const categoryCell = document.createElement("td");
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.dataset.category = transaction.category;
      chip.textContent = categoryLabel(transaction.category);
      categoryCell.appendChild(chip);

      const noteCell = document.createElement("td");
      noteCell.className = "tx-note";
      noteCell.textContent = transaction.note || "—";

      const amountCell = document.createElement("td");
      amountCell.className = "num";
      amountCell.textContent = Charts.formatMoney(transaction.amountKopecks);

      const actionsCell = document.createElement("td");
      const actions = document.createElement("div");
      actions.className = "row-actions";
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "link-button";
      editButton.textContent = "Изменить";
      editButton.setAttribute("aria-label", "Изменить трату от " + Periods.formatShortDate(transaction.date));
      editButton.addEventListener("click", () => startEdit(transaction));
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "link-button danger";
      deleteButton.textContent = "Удалить";
      deleteButton.setAttribute("aria-label", "Удалить трату от " + Periods.formatShortDate(transaction.date));
      deleteButton.addEventListener("click", () => handleDelete(transaction));
      actions.append(editButton, deleteButton);
      actionsCell.appendChild(actions);

      row.append(dateCell, categoryCell, noteCell, amountCell, actionsCell);
      fragment.appendChild(row);
    });

    dom.txBody.replaceChildren(fragment);
  }

  function renderPeriodControls(range) {
    dom.periodLabel.textContent = Periods.formatRangeLabel(state.mode, range);
    dom.periodNav.hidden = state.mode === "custom";
    dom.customRange.hidden = state.mode !== "custom";

    dom.periodTabs.querySelectorAll(".period-tab").forEach((tab) => {
      tab.setAttribute("aria-pressed", tab.dataset.mode === state.mode ? "true" : "false");
    });

    if (state.mode === "custom") {
      if (document.activeElement !== dom.customStart) {
        dom.customStart.value = state.customStart;
      }
      if (document.activeElement !== dom.customEnd) {
        dom.customEnd.value = state.customEnd;
      }
      dom.periodNext.disabled = false;
      dom.periodPrev.disabled = false;
      return;
    }

    const nextStart = Periods.getRange(state.mode, Periods.shiftAnchor(state.mode, state.anchor, 1)).start;
    dom.periodNext.disabled = nextStart > Periods.todayISO();
    dom.periodPrev.disabled = false;
  }

  function render() {
    const range = currentRange();
    const transactions = Periods.filterByRange(state.transactions, range);
    const total = Periods.sumKopecks(transactions);
    const grouped = Periods.groupByCategory(transactions);
    const days = Periods.daysInRange(range);
    const previousTotal = Periods.sumKopecks(Periods.filterByRange(state.transactions, Periods.previousRange(state.mode, range)));

    dom.emptyBanner.hidden = state.transactions.length > 0;
    renderPeriodControls(range);
    renderSummary(total, transactions, grouped, previousTotal, days);
    renderDonut(grouped, total);
    renderBars(transactions, range, total, dom.periodLabel.textContent);
    renderCategories(grouped);
    renderTable(transactions);
  }

  function init() {
    cacheDom();
    fillCategories();
    state.transactions = Store.load();
    const monthRange = Periods.getRange("month", state.anchor);
    state.customStart = monthRange.start;
    state.customEnd = Periods.todayISO();

    dom.date.max = Periods.todayISO();
    dom.customStart.max = Periods.todayISO();
    dom.customEnd.max = Periods.todayISO();
    dom.date.value = Periods.todayISO();

    bindEvents();
    updateThemeButton();
    render();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
