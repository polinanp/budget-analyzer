(function () {
  "use strict";

  const STORAGE_KEY = "budget.transactions.v1";

  const CATEGORIES = [
    { id: "food", label: "Еда" },
    { id: "transport", label: "Транспорт" },
    { id: "housing", label: "Жильё" },
    { id: "fun", label: "Развлечения" },
    { id: "health", label: "Здоровье" },
    { id: "clothes", label: "Одежда" },
    { id: "subs", label: "Подписки" },
    { id: "other", label: "Прочее" }
  ];

  const CATEGORY_IDS = CATEGORIES.map((category) => category.id);

  function getCategory(id) {
    for (const category of CATEGORIES) {
      if (category.id === id) {
        return category;
      }
    }
    return null;
  }

  function isValidTransaction(item) {
    return Boolean(
      item &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        item.id.length > 0 &&
        typeof item.amountKopecks === "number" &&
        isFinite(item.amountKopecks) &&
        Math.floor(item.amountKopecks) === item.amountKopecks &&
        item.amountKopecks > 0 &&
        typeof item.category === "string" &&
        CATEGORY_IDS.indexOf(item.category) !== -1 &&
        typeof item.date === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(item.date) &&
        typeof item.note === "string"
    );
  }

  function load() {
    let raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      return [];
    }
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.filter(isValidTransaction);
    } catch (error) {
      return [];
    }
  }

  function save(transactions) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
      return true;
    } catch (error) {
      return false;
    }
  }

  function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return "tx-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function add(data) {
    const transactions = load();
    const transaction = {
      id: makeId(),
      amountKopecks: data.amountKopecks,
      category: data.category,
      date: data.date,
      note: data.note || ""
    };
    transactions.push(transaction);
    save(transactions);
    return transaction;
  }

  function update(id, patch) {
    const transactions = load();
    let changed = false;
    for (const transaction of transactions) {
      if (transaction.id === id) {
        if (typeof patch.amountKopecks === "number") {
          transaction.amountKopecks = patch.amountKopecks;
        }
        if (getCategory(patch.category)) {
          transaction.category = patch.category;
        }
        if (typeof patch.date === "string") {
          transaction.date = patch.date;
        }
        if (typeof patch.note === "string") {
          transaction.note = patch.note;
        }
        changed = true;
        break;
      }
    }
    if (changed) {
      save(transactions);
    }
    return changed;
  }

  function remove(id) {
    const transactions = load();
    const next = transactions.filter((transaction) => transaction.id !== id);
    if (next.length === transactions.length) {
      return false;
    }
    save(next);
    return true;
  }

  function shiftDate(days) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + days);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return date.getFullYear() + "-" + (month < 10 ? "0" + month : month) + "-" + (day < 10 ? "0" + day : day);
  }

  function seedDemo() {
    if (load().length > 0) {
      return false;
    }
    const demo = [
      { amountKopecks: 45200, category: "food", date: shiftDate(0), note: "Обед в столовой" },
      { amountKopecks: 6000, category: "transport", date: shiftDate(0), note: "Метро" },
      { amountKopecks: 120000, category: "fun", date: shiftDate(-1), note: "Кино с друзьями" },
      { amountKopecks: 89350, category: "food", date: shiftDate(-1), note: "Продукты на неделю" },
      { amountKopecks: 54000, category: "health", date: shiftDate(-2), note: "Аптека" },
      { amountKopecks: 25000, category: "transport", date: shiftDate(-3), note: "Такси" },
      { amountKopecks: 349990, category: "clothes", date: shiftDate(-5), note: "Куртка" },
      { amountKopecks: 1800000, category: "housing", date: shiftDate(-8), note: "Аренда квартиры" },
      { amountKopecks: 112000, category: "food", date: shiftDate(-10), note: "Продукты" },
      { amountKopecks: 29900, category: "subs", date: shiftDate(-12), note: "Подписка на музыку" },
      { amountKopecks: 78000, category: "fun", date: shiftDate(-15), note: "Кафе" },
      { amountKopecks: 1800000, category: "housing", date: shiftDate(-38), note: "Аренда квартиры" },
      { amountKopecks: 156000, category: "food", date: shiftDate(-41), note: "Продукты" },
      { amountKopecks: 65000, category: "other", date: shiftDate(-70), note: "Подарок" },
      { amountKopecks: 89900, category: "clothes", date: shiftDate(-85), note: "Кроссовки" }
    ];
    const transactions = demo.map((item) => ({
      id: makeId(),
      amountKopecks: item.amountKopecks,
      category: item.category,
      date: item.date,
      note: item.note
    }));
    save(transactions);
    return true;
  }

  window.Budget = window.Budget || {};
  window.Budget.store = {
    CATEGORIES,
    STORAGE_KEY,
    getCategory,
    load,
    save,
    add,
    update,
    remove,
    seedDemo
  };
})();
