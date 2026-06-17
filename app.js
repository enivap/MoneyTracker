// ============================================================
//  DATA LAYER
// ============================================================
const STORAGE_KEY = "moneyTrackerV3";

function getDefaultData() {
  const today = new Date().toISOString().split("T")[0];
  const time = new Date().toTimeString().slice(0, 5);
  return {
    accounts: [
      { id: "acc1", name: "บัญชีหลัก", color: "#2D6A4F" },
      { id: "acc2", name: "บัญชีเงินสด", color: "#F2994A" },
    ],
    transactions: [
      {
        id: "t1",
        accountId: "acc1",
        type: "income",
        amount: 45000,
        category: "เงินเดือน",
        date: today,
        time: "09:00",
        note: "เงินเดือน",
        createdAt: Date.now(),
      },
      {
        id: "t2",
        accountId: "acc1",
        type: "expense",
        amount: 60,
        category: "อาหาร",
        date: today,
        time: "12:30",
        note: "",
        createdAt: Date.now() + 1,
      },
      {
        id: "t3",
        accountId: "acc2",
        type: "expense",
        amount: 200,
        category: "เดินทาง",
        date: today,
        time: "08:15",
        note: "",
        createdAt: Date.now() + 2,
      },
    ],
    currentAccountId: "acc1",
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth() + 1,
    calendarFilter: "all",
    customCategories: [],
  };
}

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const d = getDefaultData();
    saveData(d);
    return d;
  }
  try {
    return JSON.parse(raw);
  } catch {
    const d = getDefaultData();
    saveData(d);
    return d;
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

let appData = loadData();

// Restore custom category icons into the lookup map
(appData.customCategories || []).forEach(c => {
  CATEGORY_ICONS[c.name] = c.icon;
});

// Helpers
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
}
function getAccount(id) {
  return appData.accounts.find((a) => a.id === id);
}
function getToday() {
  return new Date().toISOString().split("T")[0];
}
function getNowTime() {
  return new Date().toTimeString().slice(0, 5);
}
function formatDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
function getMonthName(year, month) {
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString("th-TH", { month: "long", year: "numeric" });
}
function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}
function getFirstDay(year, month) {
  return new Date(year, month - 1, 1).getDay();
}
function pad(n) {
  return String(n).padStart(2, "0");
}

// ===== FORMAT NUMBER WITH COMMAS =====
function formatNumber(n) {
  if (n === undefined || n === null) return "0.00";
  const fixed = Number(n).toFixed(2);
  const parts = fixed.split(".");
  const intPart = parts[0];
  const decPart = parts[1];
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return formattedInt + "." + decPart;
}

// ============================================================
//  TRANSACTION HELPERS
// ============================================================
function getAccountTxns(accountId) {
  return appData.transactions.filter((t) => t.accountId === accountId);
}

function getMonthTxns(accountId, year, month) {
  const prefix = `${year}-${pad(month)}`;
  return getAccountTxns(accountId).filter((t) => t.date.startsWith(prefix));
}

function getDayTxns(accountId, dateStr) {
  return getAccountTxns(accountId).filter((t) => t.date === dateStr);
}

function calcMonthSummary(accountId, year, month) {
  const txns = getMonthTxns(accountId, year, month);
  let income = 0,
    expense = 0;
  txns.forEach((t) => {
    if (t.type === "income") income += t.amount;
    else if (t.type === "expense") expense += t.amount;
  });
  return { income, expense, balance: income - expense };
}

function calcDaySummary(accountId, dateStr) {
  const txns = getDayTxns(accountId, dateStr);
  let income = 0,
    expense = 0;
  txns.forEach((t) => {
    if (t.type === "income") income += t.amount;
    else if (t.type === "expense") expense += t.amount;
  });
  return { income, expense, balance: income - expense };
}

function getAccountBalance(accountId) {
  const txns = getAccountTxns(accountId);
  let balance = 0;
  txns.forEach((t) => {
    if (t.type === "income") balance += t.amount;
    else if (t.type === "expense") balance -= t.amount;
  });
  return Math.round(balance * 100) / 100;
}

// ============================================================
//  DONUT CHART (Canvas)
// ============================================================
function drawDonut(canvas, data, colors) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const centerX = w / 2;
  const centerY = h / 2;
  const radius = Math.min(w, h) * 0.38;
  const lineWidth = Math.min(w, h) * 0.24;

  ctx.clearRect(0, 0, w, h);

  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0 || data.length === 0) {
    // วงกลมว่าง
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = lineWidth;
    ctx.stroke();
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px 'Prompt', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("ไม่มีข้อมูล", centerX, centerY);
    return;
  }

  let startAngle = -Math.PI / 2;
  data.forEach((item, i) => {
    const sliceAngle = (item.value / total) * 2 * Math.PI;
    const endAngle = startAngle + sliceAngle;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.strokeStyle = colors[i % colors.length];
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.stroke();
    startAngle = endAngle;
  });
}

// ============================================================
//  NAVIGATION
// ============================================================
const views = {
  dashboard: document.getElementById("viewDashboard"),
  add: document.getElementById("viewAdd"),
  list: document.getElementById("viewList"),
  stats: document.getElementById("viewStats"),
  calendar: document.getElementById("viewCalendar"),
  accounts: document.getElementById("viewAccounts"),
  detail: document.getElementById("viewDetail"),
};

let editingId = null;
let listFilter = "all";

function showView(viewId) {
  Object.values(views).forEach((v) => v.classList.remove("active"));
  if (views[viewId]) views[viewId].classList.add("active");
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.target === viewId);
  });
  document.getElementById("mainScroll").scrollTop = 0;
}

document.querySelectorAll(".nav-item").forEach((btn) => {
  btn.addEventListener("click", function () {
    const target = this.dataset.target;
    if (target === "accounts") renderAccounts();
    if (target === "stats") {
      setTimeout(() => renderStats(), 50);
    }
    if (target === "list") renderFullList();
    if (target === "calendar") renderCalendar();
    if (target === "dashboard") renderDashboard();
    showView(target);
  });
});

document.getElementById("addNavBtn").addEventListener("click", function () {
  editingId = null;
  document.getElementById("addTitle").textContent = "เพิ่มรายการ";
  document.getElementById("cancelEdit").style.display = "none";
  document.getElementById("saveTransaction").textContent = "บันทึก";
  resetAddForm();
  renderAddForm();
  showView("add");
});

document.querySelectorAll(".back-btn").forEach((btn) => {
  btn.addEventListener("click", function () {
    showView(this.dataset.back || "dashboard");
  });
});

// ============================================================
//  ACCOUNT SELECTOR
// ============================================================
document
  .getElementById("accountSelector")
  .addEventListener("click", function (e) {
    e.stopPropagation();
    const dropdown = document.getElementById("accountDropdown");
    dropdown.style.display =
      dropdown.style.display === "block" ? "none" : "block";
    if (dropdown.style.display === "block") renderAccountDropdown();
  });

document.addEventListener("click", function (e) {
  const dropdown = document.getElementById("accountDropdown");
  const selector = document.getElementById("accountSelector");
  if (!selector.contains(e.target) && !dropdown.contains(e.target)) {
    dropdown.style.display = "none";
  }
});

function renderAccountDropdown() {
  const container = document.getElementById("accountListDropdown");
  const currentId = appData.currentAccountId;
  container.innerHTML = appData.accounts
    .map(
      (acc) => `
        <div class="account-item ${acc.id === currentId ? "active" : ""}" data-id="${acc.id}">
            <span>${acc.name}</span>
            ${acc.id === currentId ? '<span class="badge">✓</span>' : ""}
        </div>
    `,
    )
    .join("");
  container.querySelectorAll(".account-item").forEach((el) => {
    el.addEventListener("click", function () {
      appData.currentAccountId = this.dataset.id;
      saveData(appData);
      document.getElementById("accountDropdown").style.display = "none";
      renderAll();
    });
  });
}

// ============================================================
//  MONTH NAV
// ============================================================
document.getElementById("monthPrev").addEventListener("click", function () {
  appData.currentMonth--;
  if (appData.currentMonth < 1) {
    appData.currentMonth = 12;
    appData.currentYear--;
  }
  saveData(appData);
  renderAll();
});

document.getElementById("monthNext").addEventListener("click", function () {
  appData.currentMonth++;
  if (appData.currentMonth > 12) {
    appData.currentMonth = 1;
    appData.currentYear++;
  }
  saveData(appData);
  renderAll();
});

// ============================================================
//  STATUS TIME
// ============================================================
function updateStatusTime() {
  const now = new Date();
  document.getElementById("statusTime").textContent =
    String(now.getHours()).padStart(2, "0") +
    ":" +
    String(now.getMinutes()).padStart(2, "0");
}
setInterval(updateStatusTime, 10000);
updateStatusTime();

// ============================================================
//  RENDER: DASHBOARD
// ============================================================
function renderDashboard() {
  const accId = appData.currentAccountId;
  const { currentYear, currentMonth } = appData;
  const summary = calcMonthSummary(accId, currentYear, currentMonth);

  document.getElementById("dashIncome").textContent = formatNumber(
    summary.income,
  );
  document.getElementById("dashExpense").textContent = formatNumber(
    summary.expense,
  );
  document.getElementById("dashBalance").textContent = formatNumber(
    summary.balance,
  );

  const monthName = getMonthName(currentYear, currentMonth);
  document.getElementById("dashMonthLabel").textContent = monthName;
  document.getElementById("currentMonthDisplay").textContent = monthName;

  const acc = getAccount(accId);
  if (acc) document.getElementById("currentAccountName").textContent = acc.name;

  // Recent
  const txns = getMonthTxns(accId, currentYear, currentMonth)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 5);
  const container = document.getElementById("dashRecentList");
  if (txns.length === 0) {
    container.innerHTML =
      '<div style="text-align:center;color:var(--text-muted);padding:20px;">ไม่มีรายการ</div>';
  } else {
    container.innerHTML = txns
      .map((t) => {
        const isIncome = t.type === "income";
        const sign = isIncome ? "+" : "-";
        const cls = isIncome ? "income" : "expense";
        const icon = getCategoryIcon(t.category);
        return `<div class="tx-item ${cls}" data-id="${t.id}">
                <div class="tx-icon ${isIncome ? "green-bg" : "orange-bg"}">${icon}</div>
                <div class="tx-info"><span class="tx-name">${t.category}</span><span class="tx-date">${t.date}</span></div>
                <span class="tx-amount ${cls}">${sign}${formatNumber(t.amount)}</span>
            </div>`;
      })
      .join("");
    container.querySelectorAll(".tx-item").forEach((el) => {
      el.addEventListener("click", function () {
        showDetail(this.dataset.id);
      });
    });
  }

  renderDashDonut(accId, currentYear, currentMonth);

  // Delete current account button
  const delBtn = document.getElementById("dashDeleteAccountBtn");
  if (delBtn) {
    delBtn.onclick = function () {
      if (appData.accounts.length <= 1) {
        alert("ต้องมีอย่างน้อย 1 บัญชี");
        return;
      }
      const acc = getAccount(appData.currentAccountId);
      const txnCount = appData.transactions.filter(t => t.accountId === appData.currentAccountId).length;
      openModal(
        "ลบบัญชี",
        `<div style="text-align:center;padding:8px 0;">
          <div style="font-size:40px;margin-bottom:8px;">🗑️</div>
          <p style="font-weight:600;font-size:16px;margin-bottom:8px;">${acc?.name || ""}</p>
          <p style="color:var(--text-muted);font-size:14px;">บัญชีนี้มี <strong style="color:#ef4444;">${txnCount} รายการ</strong> ที่จะถูกลบด้วย</p>
          <p style="color:var(--text-muted);font-size:13px;margin-top:6px;">การกระทำนี้ไม่สามารถย้อนกลับได้</p>
        </div>`,
        "ลบบัญชี",
        function () {
          const id = appData.currentAccountId;
          appData.accounts = appData.accounts.filter(a => a.id !== id);
          appData.transactions = appData.transactions.filter(t => t.accountId !== id);
          appData.currentAccountId = appData.accounts[0].id;
          saveData(appData);
          renderAll();
          closeModal();
        }
      );
      setTimeout(() => {
        const confirmBtn = document.getElementById("modalConfirm");
        if (confirmBtn) confirmBtn.style.background = "#ef4444";
      }, 50);
    };
  }
}

function renderDashDonut(accountId, year, month) {
  const txns = getMonthTxns(accountId, year, month).filter(
    (t) => t.type === "expense",
  );
  const total = txns.reduce((s, t) => s + t.amount, 0);
  const catMap = {};
  txns.forEach((t) => {
    catMap[t.category] = (catMap[t.category] || 0) + t.amount;
  });
  const entries = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  const colors = [
    "#F25C5C",
    "#FFB156",
    "#D178FF",
    "#6B8AFD",
    "#BDBDBD",
    "#6495ED",
    "#45D18C",
    "#FF8FB1",
  ];

  const legend = document.getElementById("dashLegend");
  if (entries.length === 0) {
    legend.innerHTML =
      '<div style="color:var(--text-muted);font-size:12px;">ไม่มีข้อมูล</div>';
  } else {
    legend.innerHTML = entries
      .slice(0, 5)
      .map(([cat, amt], i) => {
        const pct = total > 0 ? Math.round((amt / total) * 100) : 0;
        return `<div class="legend-item"><span class="dot" style="background:${colors[i % colors.length]};"></span> ${cat} <span class="legend-amount">${formatNumber(amt)} (${pct}%)</span></div>`;
      })
      .join("");
  }

  const canvas = document.getElementById("dashDonutCanvas");
  if (!canvas) return;
  const data = entries
    .slice(0, 6)
    .map(([cat, amt]) => ({ label: cat, value: amt }));
  drawDonut(canvas, data, colors);
}

// ============================================================
//  RENDER: ADD FORM
// ============================================================
const DEFAULT_CATEGORIES = {
  income: ["เงินเดือน", "ธุรกิจ", "ลงทุน", "อื่น ๆ"],
  expense: [
    "อาหาร",
    "เดินทาง",
    "ช้อปปิ้ง",
    "บ้าน",
    "บัตรเครดิต",
    "สุขภาพ",
    "การศึกษา",
    "อื่น ๆ",
  ],
};

const CATEGORY_ICONS = {
  เงินเดือน: "💰",
  ธุรกิจ: "📊",
  ลงทุน: "📈",
  "อื่น ๆ": "📦",
  อาหาร: "🍜",
  เดินทาง: "🚗",
  ช้อปปิ้ง: "🛍️",
  บ้าน: "🏠",
  บัตรเครดิต: "💳",
  สุขภาพ: "❤️",
  การศึกษา: "📚",
  โอนเงิน: "🔄",
};

function getCategoryIcon(category) {
  if (CATEGORY_ICONS[category]) return CATEGORY_ICONS[category];
  // Check custom categories for a saved icon
  const allCustom = (appData.customCategories || []);
  const found = allCustom.find(c => c.name === category);
  return found ? found.icon : "📌";
}

function getCategories() {
  const custom = appData.customCategories || [];
  const incomeCustom = custom.filter(c => c.type === "income").map(c => c.name);
  const expenseCustom = custom.filter(c => c.type === "expense").map(c => c.name);
  return {
    income: [...DEFAULT_CATEGORIES.income.filter(n => n !== "อื่น ๆ"), ...incomeCustom, "อื่น ๆ"],
    expense: [...DEFAULT_CATEGORIES.expense.filter(n => n !== "อื่น ๆ"), ...expenseCustom, "อื่น ๆ"],
  };
}

function resetAddForm() {
  document.getElementById("addAmount").value = "";
  document.getElementById("addNote").value = "";
  document.getElementById("addDate").value = getToday();
  document.getElementById("addTime").value = getNowTime();
  document
    .querySelectorAll(".cat-item")
    .forEach((c) => c.classList.remove("selected"));
}

function renderAddForm() {
  const type =
    document.querySelector(".toggle-btn.active")?.dataset.type || "expense";
  const grid = document.getElementById("categoryGrid");
  const categorySection = document.getElementById("categorySection");
  const transferSection = document.getElementById("transferSection");

  if (type === "transfer") {
    if (categorySection) categorySection.style.display = "none";
    if (transferSection) {
      transferSection.style.display = "block";
      const accounts = appData.accounts;
      const opts = accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join("");
      transferSection.innerHTML = `
        <div class="input-group">
          <label>บัญชีต้นทาง</label>
          <select id="transferFrom" class="input-field">${opts}</select>
        </div>
        <div class="input-group">
          <label>บัญชีปลายทาง</label>
          <select id="transferTo" class="input-field">${opts}</select>
        </div>`;
      // Default to different accounts
      if (accounts.length >= 2) {
        document.getElementById("transferFrom").value = accounts[0].id;
        document.getElementById("transferTo").value = accounts[1].id;
      }
    }
  } else {
    if (categorySection) categorySection.style.display = "block";
    if (transferSection) transferSection.style.display = "none";

    const cats = getCategories()[type] || getCategories().expense;
    grid.innerHTML = cats
      .map(
        (c) => `
          <div class="cat-item" data-cat="${c}">
              <span class="cat-icon" style="background:#F0F0F0;">${getCategoryIcon(c)}</span>
              <span>${c}</span>
          </div>
      `,
      )
      .join("") +
      `<div class="cat-item cat-item-add" id="addCustomCatBtn">
          <span class="cat-icon" style="background:#F0F0F0;">➕</span>
          <span>เพิ่ม</span>
      </div>`;

    grid.querySelectorAll(".cat-item:not(.cat-item-add)").forEach((el) => {
      el.addEventListener("click", function () {
        grid
          .querySelectorAll(".cat-item")
          .forEach((c) => c.classList.remove("selected"));
        this.classList.add("selected");
      });
    });

    document.getElementById("addCustomCatBtn")?.addEventListener("click", function () {
      openAddCustomCategoryModal(type);
    });
  }

  document.querySelectorAll(".toggle-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      document
        .querySelectorAll(".toggle-btn")
        .forEach((b) => b.classList.remove("active"));
      this.classList.add("active");
      renderAddForm();
    });
  });

  if (!document.getElementById("addDate").value)
    document.getElementById("addDate").value = getToday();
  if (!document.getElementById("addTime").value)
    document.getElementById("addTime").value = getNowTime();
}

// ============================================================
//  CUSTOM CATEGORIES
// ============================================================

function openAddCustomCategoryModal(type) {
  const typeLabel = type === "income" ? "รายรับ" : "รายจ่าย";
  openModal(
    `เพิ่มหมวดหมู่ (${typeLabel})`,
    `<div class="input-group">
       <label>ชื่อหมวดหมู่</label>
       <input type="text" id="newCatName" class="input-field" placeholder="เช่น ท่องเที่ยว" />
     </div>
     <div class="input-group">
       <label>ไอคอน (Emoji)</label>
       <div style="display:flex;align-items:center;gap:10px;margin-top:6px;">
         <div id="emojiPreview" style="font-size:32px;width:48px;height:48px;display:flex;align-items:center;justify-content:center;background:#f0f0f0;border-radius:12px;">🏷️</div>
         <input type="text" id="newCatEmoji" class="input-field" placeholder="วาง emoji ที่นี่ เช่น 🎯 🏖️ 🎸"
           style="flex:1;"
           maxlength="8" />
       </div>
       <div style="font-size:11px;color:var(--text-muted);margin-top:6px;">
         💡 เปิดแป้นพิมพ์ emoji: Windows = Win+. &nbsp;|&nbsp; Mac = Cmd+Ctrl+Space &nbsp;|&nbsp; มือถือ = กดปุ่ม 😊
       </div>
     </div>`,
    "เพิ่มหมวดหมู่",
    function () {
      const name = document.getElementById("newCatName").value.trim();
      if (!name) { alert("กรุณาใส่ชื่อหมวดหมู่"); return; }
      const rawEmoji = document.getElementById("newCatEmoji").value.trim();
      // Extract the first grapheme cluster (emoji or char) from input
      const icon = extractFirstEmoji(rawEmoji) || "📌";
      if (!appData.customCategories) appData.customCategories = [];
      if (appData.customCategories.find(c => c.name === name && c.type === type)) {
        alert("มีหมวดหมู่นี้แล้ว"); return;
      }
      appData.customCategories.push({ name, icon, type });
      CATEGORY_ICONS[name] = icon;
      saveData(appData);
      renderAddForm();
      setTimeout(() => {
        document.querySelectorAll(".cat-item").forEach(el => {
          if (el.dataset.cat === name) el.classList.add("selected");
        });
      }, 50);
      closeModal();
    }
  );
  // Live preview as user types emoji
  setTimeout(() => {
    document.getElementById("newCatEmoji")?.addEventListener("input", function() {
      const first = extractFirstEmoji(this.value.trim());
      document.getElementById("emojiPreview").textContent = first || "🏷️";
    });
    // Focus name field
    document.getElementById("newCatName")?.focus();
  }, 50);
}

// Extract the first emoji / grapheme from a string
function extractFirstEmoji(str) {
  if (!str) return "";
  // Use Intl.Segmenter if available (modern browsers), else fallback
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const seg = new Intl.Segmenter([], { granularity: "grapheme" });
    const first = [...seg.segment(str)][0];
    return first ? first.segment : str[0];
  }
  // Fallback: grab first character(s) via spread (handles surrogate pairs)
  return [...str][0] || "";
}

// ============================================================
//  SAVE TRANSACTION
// ============================================================
document
  .getElementById("saveTransaction")
  .addEventListener("click", function () {
    const type =
      document.querySelector(".toggle-btn.active")?.dataset.type || "expense";

    // ---- Transfer ----
    if (type === "transfer") {
      const amount = parseFloat(document.getElementById("addAmount").value);
      const fromId = document.getElementById("transferFrom")?.value;
      const toId = document.getElementById("transferTo")?.value;
      const date = document.getElementById("addDate").value;
      const time = document.getElementById("addTime").value || getNowTime();
      const note = document.getElementById("addNote").value.trim();

      if (!amount || amount <= 0) { alert("กรุณาใส่จำนวนเงิน"); return; }
      if (!fromId || !toId) { alert("กรุณาเลือกบัญชี"); return; }
      if (fromId === toId) { alert("บัญชีต้นทางและปลายทางต้องไม่เหมือนกัน"); return; }
      if (!date) { alert("กรุณาเลือกวันที่"); return; }

      const fromAcc = getAccount(fromId);
      const toAcc = getAccount(toId);
      const pairId = genId();

      appData.transactions.push({
        id: genId(), accountId: fromId, type: "expense",
        amount, category: "โอนเงิน", date, time,
        note: `โอนไป ${toAcc?.name || ""}${note ? " · " + note : ""}`,
        createdAt: Date.now(), transferPair: pairId,
      });
      appData.transactions.push({
        id: genId(), accountId: toId, type: "income",
        amount, category: "โอนเงิน", date, time,
        note: `รับโอนจาก ${fromAcc?.name || ""}${note ? " · " + note : ""}`,
        createdAt: Date.now() + 1, transferPair: pairId,
      });

      saveData(appData);
      renderAll();
      editingId = null;
      document.getElementById("addTitle").textContent = "เพิ่มรายการ";
      document.getElementById("cancelEdit").style.display = "none";
      document.getElementById("saveTransaction").textContent = "บันทึก";
      showView("dashboard");
      return;
    }

    // ---- Normal income / expense ----
    const amount = parseFloat(document.getElementById("addAmount").value);
    const category =
      document.querySelector(".cat-item.selected")?.dataset.cat ||
      (type === "income" ? "อื่น ๆ" : "อื่น ๆ");
    const date = document.getElementById("addDate").value;
    const time = document.getElementById("addTime").value || getNowTime();
    const note = document.getElementById("addNote").value.trim();
    const accountId = appData.currentAccountId;

    if (!amount || amount <= 0) {
      alert("กรุณาใส่จำนวนเงิน");
      return;
    }
    if (!date) {
      alert("กรุณาเลือกวันที่");
      return;
    }

    if (editingId) {
      const idx = appData.transactions.findIndex((t) => t.id === editingId);
      if (idx === -1) {
        alert("ไม่พบรายการ");
        return;
      }
      appData.transactions[idx] = {
        ...appData.transactions[idx],
        type,
        amount,
        category,
        date,
        time,
        note,
      };
    } else {
      appData.transactions.push({
        id: genId(),
        accountId,
        type,
        amount,
        category,
        date,
        time,
        note,
        createdAt: Date.now(),
      });
    }

    saveData(appData);
    renderAll();
    editingId = null;
    document.getElementById("addTitle").textContent = "เพิ่มรายการ";
    document.getElementById("cancelEdit").style.display = "none";
    document.getElementById("saveTransaction").textContent = "บันทึก";
    showView("dashboard");
  });

document.getElementById("cancelEdit").addEventListener("click", function () {
  editingId = null;
  document.getElementById("addTitle").textContent = "เพิ่มรายการ";
  this.style.display = "none";
  document.getElementById("saveTransaction").textContent = "บันทึก";
  resetAddForm();
  renderAddForm();
  showView("list");
});

// ============================================================
//  RENDER: FULL LIST (with filter & summary)
// ============================================================
function renderFullList() {
  const accId = appData.currentAccountId;
  const { currentYear, currentMonth } = appData;

  let allTxns = getMonthTxns(accId, currentYear, currentMonth).sort(
    (a, b) => b.createdAt - a.createdAt,
  );

  let filtered = allTxns;
  if (listFilter === "income") {
    filtered = allTxns.filter((t) => t.type === "income");
  } else if (listFilter === "expense") {
    filtered = allTxns.filter((t) => t.type === "expense");
  }

  let incomeTotal = 0,
    expenseTotal = 0;
  filtered.forEach((t) => {
    if (t.type === "income") incomeTotal += t.amount;
    else if (t.type === "expense") expenseTotal += t.amount;
  });
  document.getElementById("listIncomeTotal").textContent =
    formatNumber(incomeTotal);
  document.getElementById("listExpenseTotal").textContent =
    formatNumber(expenseTotal);

  const container = document.getElementById("fullListContainer");
  if (filtered.length === 0) {
    container.innerHTML =
      '<div style="text-align:center;color:var(--text-muted);padding:30px;">ไม่มีรายการ</div>';
    return;
  }

  const groups = {};
  filtered.forEach((t) => {
    if (!groups[t.date]) groups[t.date] = [];
    groups[t.date].push(t);
  });

  let html = "";
  for (const [date, items] of Object.entries(groups)) {
    html += `<div class="list-date">${formatDate(date)}</div>`;
    items.forEach((t) => {
      const isIncome = t.type === "income";
      const sign = isIncome ? "+" : "-";
      const cls = isIncome ? "income" : "expense";
      const icon = getCategoryIcon(t.category);
      html += `<div class="tx-item ${cls}" data-id="${t.id}">
                <div class="tx-icon ${isIncome ? "green-bg" : "orange-bg"}">${icon}</div>
                <div class="tx-info"><span class="tx-name">${t.category}</span><span class="tx-date">${t.time || ""}</span></div>
                <span class="tx-amount ${cls}">${sign}${formatNumber(t.amount)}</span>
            </div>`;
    });
  }
  container.innerHTML = html;
  container.querySelectorAll(".tx-item").forEach((el) => {
    el.addEventListener("click", function () {
      showDetail(this.dataset.id);
    });
  });
}

// Event listeners for list filter tabs
document.querySelectorAll(".list-filter-btn").forEach((btn) => {
  btn.addEventListener("click", function () {
    document
      .querySelectorAll(".list-filter-btn")
      .forEach((b) => b.classList.remove("active"));
    this.classList.add("active");
    listFilter = this.dataset.filter;
    renderFullList();
  });
});

// ============================================================
//  RENDER: STATISTICS
// ============================================================
function renderStats() {
  const accId = appData.currentAccountId;
  const { currentYear, currentMonth } = appData;
  const type =
    document.querySelector(".stats-tab.active")?.dataset.stats || "expense";
  const isExpense = type === "expense";

  const txns = getMonthTxns(accId, currentYear, currentMonth).filter(
    (t) => t.type === (isExpense ? "expense" : "income"),
  );
  const total = txns.reduce((s, t) => s + t.amount, 0);

  document.getElementById("statsTotal").textContent = formatNumber(total);
  document.getElementById("statsLabel").textContent = isExpense
    ? "รายจ่ายรวม"
    : "รายรับรวม";
  document.getElementById("statsTotal").className =
    "stats-value " + (isExpense ? "expense" : "income");
  if (document.getElementById("statsCenterVal"))
    document.getElementById("statsCenterVal").textContent = formatNumber(total);
  document.getElementById("statsMonthLabel").textContent = getMonthName(
    currentYear,
    currentMonth,
  );

  const catMap = {};
  txns.forEach((t) => {
    catMap[t.category] = (catMap[t.category] || 0) + t.amount;
  });
  const entries = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  const colors = [
    "#6495ED",
    "#F25C5C",
    "#9B86D3",
    "#999999",
    "#DDDDDD",
    "#45D18C",
    "#FFB347",
    "#FF8FB1",
  ];
  const totalVal = total || 1;

  const legend = document.getElementById("statsLegend");
  if (entries.length === 0) {
    legend.innerHTML =
      '<div style="color:var(--text-muted);font-size:14px;text-align:center;padding:12px 0;">ไม่มีข้อมูล</div>';
  } else {
    legend.innerHTML = entries
      .map(([cat, amt], i) => {
        const pct = Math.round((amt / totalVal) * 100);
        return `<div class="legend-item"><span class="dot" style="background:${colors[i % colors.length]};"></span> ${cat} <span class="legend-amount">${formatNumber(amt)} (${pct}%)</span></div>`;
      })
      .join("");
  }

  setTimeout(() => {
    const canvas = document.getElementById("statsDonutCanvas");
    if (!canvas) return;
    const data = entries
      .slice(0, 6)
      .map(([cat, amt]) => ({ label: cat, value: amt }));
    drawDonut(canvas, data, colors);
  }, 50);

  document.querySelectorAll(".stats-tab").forEach((tab) => {
    tab.removeEventListener("click", statsTabHandler);
    tab.addEventListener("click", statsTabHandler);
  });
}

function statsTabHandler() {
  document
    .querySelectorAll(".stats-tab")
    .forEach((t) => t.classList.remove("active"));
  this.classList.add("active");
  renderStats();
}

// Attach stats tab listeners once on load
document.querySelectorAll(".stats-tab").forEach((tab) => {
  tab.addEventListener("click", statsTabHandler);
});

// ============================================================
//  RENDER: CALENDAR
// ============================================================
function renderCalendar() {
  const accId = appData.currentAccountId;
  const { currentYear, currentMonth } = appData;
  const filter = appData.calendarFilter || "all";

  const firstDay = getFirstDay(currentYear, currentMonth);
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const today = getToday();

  const grid = document.getElementById("calendarGrid");
  const weekdays = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
  let html = weekdays
    .map((d) => `<div class="cal-weekday">${d}</div>`)
    .join("");

  for (let i = 0; i < firstDay; i++) {
    html += `<div class="cal-day disabled"></div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${currentYear}-${pad(currentMonth)}-${pad(d)}`;
    const isToday = dateStr === today;
    const daySummary = calcDaySummary(accId, dateStr);
    const hasTxn = daySummary.income > 0 || daySummary.expense > 0;

    let cls = "cal-day";
    if (isToday) cls += " today";
    if (hasTxn && !isToday) cls += " has-txn";

    let amountHtml = "";
    if (filter === "all") {
      const net = daySummary.income - daySummary.expense;
      if (daySummary.income > 0 || daySummary.expense > 0) {
        const netCls = net >= 0 ? "positive" : "negative";
        const netSign = net >= 0 ? "+" : "";
        amountHtml = `<div class="day-amount ${netCls}">${netSign}${formatNumber(net)}</div>`;
      }
    } else if (filter === "income") {
      if (daySummary.income > 0)
        amountHtml += `<div class="day-amount positive">+${formatNumber(daySummary.income)}</div>`;
    } else if (filter === "expense") {
      if (daySummary.expense > 0)
        amountHtml += `<div class="day-amount negative">-${formatNumber(daySummary.expense)}</div>`;
    }

    html += `<div class="${cls}" data-date="${dateStr}">
            <span class="day-number">${d}</span>
            ${amountHtml}
        </div>`;
  }

  grid.innerHTML = html;

  grid.querySelectorAll(".cal-day:not(.disabled)").forEach((el) => {
    el.addEventListener("click", function () {
      grid
        .querySelectorAll(".cal-day")
        .forEach((d) => d.classList.remove("selected"));
      this.classList.add("selected");
      const date = this.dataset.date;
      showCalendarDayDetail(accId, date);
    });
  });

  const todayEl = grid.querySelector(`.cal-day[data-date="${today}"]`);
  if (todayEl) {
    todayEl.classList.add("selected");
    showCalendarDayDetail(accId, today);
  } else {
    const first = grid.querySelector(".cal-day:not(.disabled)");
    if (first) {
      first.classList.add("selected");
      showCalendarDayDetail(accId, first.dataset.date);
    }
  }

  document.querySelectorAll(".cal-filter-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      document
        .querySelectorAll(".cal-filter-btn")
        .forEach((b) => b.classList.remove("active"));
      this.classList.add("active");
      appData.calendarFilter = this.dataset.filter;
      saveData(appData);
      renderCalendar();
    });
  });

  document.querySelectorAll(".cal-filter-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.filter === filter);
  });
}

function showCalendarDayDetail(accountId, dateStr) {
  const container = document.getElementById("calDayDetail");
  const filter = appData.calendarFilter || "all";
  let txns = getDayTxns(accountId, dateStr).sort((a, b) =>
    (a.time || "00:00").localeCompare(b.time || "00:00"),
  );

  // Apply filter
  if (filter === "income") txns = txns.filter(t => t.type === "income");
  else if (filter === "expense") txns = txns.filter(t => t.type === "expense");

  if (txns.length === 0) {
    container.innerHTML = `<div class="cal-day-label">ไม่มีรายการวันที่ ${formatDate(dateStr)}</div>`;
    return;
  }

  let html = `<div class="cal-day-label">รายการวันที่ ${formatDate(dateStr)}</div>`;
  txns.forEach((t) => {
    const isIncome = t.type === "income";
    const sign = isIncome ? "+" : "-";
    const cls = isIncome ? "income" : "expense";
    const icon = getCategoryIcon(t.category);
    html += `<div class="tx-item ${cls}" data-id="${t.id}">
            <div class="tx-icon ${isIncome ? "green-bg" : "orange-bg"}">${icon}</div>
            <div class="tx-info"><span class="tx-name">${t.category}</span><span class="tx-date">${t.time || ""}</span></div>
            <span class="tx-amount ${cls}">${sign}${formatNumber(t.amount)}</span>
        </div>`;
  });
  container.innerHTML = html;
  container.querySelectorAll(".tx-item").forEach((el) => {
    el.addEventListener("click", function () {
      showDetail(this.dataset.id);
    });
  });
}

// ============================================================
//  RENDER: ACCOUNTS
// ============================================================
function renderAccounts() {
  const container = document.getElementById("accountList");
  if (appData.accounts.length === 0) {
    container.innerHTML =
      '<div style="text-align:center;color:var(--text-muted);padding:30px;">ยังไม่มีบัญชี</div>';
  } else {
    container.innerHTML = appData.accounts
      .map((acc) => {
        const balance = getAccountBalance(acc.id);
        const isActive = acc.id === appData.currentAccountId;
        return `<div class="account-item" style="border-left: 4px solid ${acc.color || "#2D6A4F"};${isActive ? "background:rgba(0,102,255,0.05);" : ""}">
              <div class="account-color-dot" style="background:${acc.color || "#2D6A4F"};"></div>
              <div class="account-info">
                  <span class="account-name">${acc.name}${isActive ? ' <span class="acc-active-badge">ใช้งาน</span>' : ""}</span>
                  <span class="account-balance">${balance >= 0 ? "" : ""}${formatNumber(balance)} บาท</span>
              </div>
              <button class="account-delete" data-id="${acc.id}" title="ลบบัญชี">
                <span class="material-symbols-outlined" style="font-size:20px;color:#ef4444;">delete</span>
              </button>
          </div>`;
      })
      .join("");

    container.querySelectorAll(".account-delete").forEach((btn) => {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        const id = this.dataset.id;
        if (appData.accounts.length <= 1) {
          alert("ต้องมีอย่างน้อย 1 บัญชี");
          return;
        }
        const acc = getAccount(id);
        const txnCount = appData.transactions.filter(t => t.accountId === id).length;
        openModal(
          "ลบบัญชี",
          `<div style="text-align:center;padding:8px 0;">
            <div style="font-size:40px;margin-bottom:8px;">🗑️</div>
            <p style="font-weight:600;font-size:16px;margin-bottom:8px;">${acc?.name || ""}</p>
            <p style="color:var(--text-muted);font-size:14px;">บัญชีนี้มี <strong style="color:#ef4444;">${txnCount} รายการ</strong> ที่จะถูกลบด้วย</p>
            <p style="color:var(--text-muted);font-size:13px;margin-top:6px;">การกระทำนี้ไม่สามารถย้อนกลับได้</p>
          </div>`,
          "ลบบัญชี",
          function () {
            appData.accounts = appData.accounts.filter((a) => a.id !== id);
            appData.transactions = appData.transactions.filter(
              (t) => t.accountId !== id,
            );
            if (appData.currentAccountId === id)
              appData.currentAccountId = appData.accounts[0].id;
            saveData(appData);
            renderAll();
            closeModal();
          }
        );
        // Make confirm button red for destructive action
        setTimeout(() => {
          const confirmBtn = document.getElementById("modalConfirm");
          if (confirmBtn) confirmBtn.style.background = "#ef4444";
        }, 50);
      });
    });
  }

  // ---- Custom Categories Section ----
  renderCustomCategoriesSection();
}

function renderCustomCategoriesSection() {
  // Find or create the custom-cat container below accountList
  let section = document.getElementById("customCatSection");
  if (!section) {
    section = document.createElement("div");
    section.id = "customCatSection";
    document.getElementById("viewAccounts").appendChild(section);
  }

  const customs = appData.customCategories || [];
  if (customs.length === 0) {
    section.innerHTML = `
      <div class="custom-cat-header">
        <span class="accounts-title" style="font-size:16px;">หมวดหมู่ที่กำหนดเอง</span>
      </div>
      <div style="text-align:center;color:var(--text-muted);font-size:13px;padding:16px 0;">ยังไม่มีหมวดหมู่ที่กำหนดเอง<br>เพิ่มได้เมื่อบันทึกรายการ</div>`;
    return;
  }

  const groupedIncome = customs.filter(c => c.type === "income");
  const groupedExpense = customs.filter(c => c.type === "expense");

  function renderGroup(label, items) {
    if (!items.length) return "";
    return `<div class="custom-cat-group-label">${label}</div>` +
      items.map(c => `
        <div class="custom-cat-item">
          <span class="custom-cat-icon">${c.icon}</span>
          <span class="custom-cat-name">${c.name}</span>
          <button class="custom-cat-delete" data-name="${c.name}" data-type="${c.type}" title="ลบหมวดหมู่">
            <span class="material-symbols-outlined" style="font-size:18px;color:#ef4444;">delete</span>
          </button>
        </div>`).join("");
  }

  section.innerHTML = `
    <div class="custom-cat-header">
      <span class="accounts-title" style="font-size:16px;">หมวดหมู่ที่กำหนดเอง</span>
    </div>
    <div class="glass-card" style="padding:8px 12px;">
      ${renderGroup("รายรับ 💰", groupedIncome)}
      ${renderGroup("รายจ่าย 💸", groupedExpense)}
    </div>`;

  section.querySelectorAll(".custom-cat-delete").forEach(btn => {
    btn.addEventListener("click", function () {
      const name = this.dataset.name;
      const type = this.dataset.type;
      const txnCount = appData.transactions.filter(t => t.category === name).length;
      openModal(
        "ลบหมวดหมู่",
        `<div style="text-align:center;padding:8px 0;">
          <div style="font-size:36px;margin-bottom:8px;">${getCategoryIcon(name)}</div>
          <p style="font-weight:600;font-size:16px;margin-bottom:8px;">${name}</p>
          ${txnCount > 0
            ? `<p style="color:var(--text-muted);font-size:14px;">มี <strong style="color:#f59e0b;">${txnCount} รายการ</strong> ที่ใช้หมวดหมู่นี้<br><span style="font-size:13px;">รายการเหล่านั้นจะยังคงอยู่ แต่จะแสดงไอคอน 📌</span></p>`
            : `<p style="color:var(--text-muted);font-size:14px;">ยังไม่มีรายการที่ใช้หมวดหมู่นี้</p>`}
        </div>`,
        "ลบหมวดหมู่",
        function () {
          appData.customCategories = (appData.customCategories || [])
            .filter(c => !(c.name === name && c.type === type));
          delete CATEGORY_ICONS[name];
          saveData(appData);
          renderAll();
          closeModal();
        }
      );
      setTimeout(() => {
        const confirmBtn = document.getElementById("modalConfirm");
        if (confirmBtn) confirmBtn.style.background = "#ef4444";
      }, 50);
    });
  });
}

// ============================================================
//  DETAIL VIEW
// ============================================================
function showDetail(id) {
  const txn = appData.transactions.find((t) => t.id === id);
  if (!txn) {
    alert("ไม่พบรายการ");
    return;
  }
  const isIncome = txn.type === "income";
  const sign = isIncome ? "+" : "-";
  const cls = isIncome ? "income" : "expense";
  const icon = getCategoryIcon(txn.category);

  const container = document.getElementById("detailContainer");
  container.innerHTML = `
        <div class="detail-summary">
            <div class="detail-icon ${isIncome ? "green-bg" : "orange-bg"}" style="width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:32px;margin:0 auto 10px;background:${isIncome ? "#E8F5E9" : "#FFF3E0"};">${icon}</div>
            <h2 class="detail-category">${txn.category}</h2>
            <span class="detail-amount ${cls}">${sign}${formatNumber(txn.amount)}</span>
            <span class="detail-type">${isIncome ? "รายรับ" : "รายจ่าย"}</span>
        </div>
        <div class="detail-info-list">
            <div class="detail-row"><span class="detail-label">หมวดหมู่</span><span class="detail-value">${txn.category}</span></div>
            <div class="detail-row"><span class="detail-label">วันที่</span><span class="detail-value">${formatDate(txn.date)}</span></div>
            <div class="detail-row"><span class="detail-label">เวลา</span><span class="detail-value">${txn.time || "-"}</span></div>
            <div class="detail-row"><span class="detail-label">โน้ต</span><span class="detail-value">${txn.note || "-"}</span></div>
        </div>
        <div class="detail-actions">
            <button class="btn-edit" id="detailEditAction">แก้ไข</button>
            <button class="btn-delete" id="detailDeleteAction">ลบรายการ</button>
        </div>
    `;

  document
    .getElementById("detailEditAction")
    .addEventListener("click", function () {
      editTransaction(id);
    });
  document
    .getElementById("detailDeleteAction")
    .addEventListener("click", function () {
      if (!confirm("ลบรายการนี้?")) return;
      appData.transactions = appData.transactions.filter((t) => t.id !== id);
      saveData(appData);
      renderAll();
      showView("list");
    });
  document
    .getElementById("detailEditBtn")
    .addEventListener("click", function () {
      editTransaction(id);
    });
  showView("detail");
}

function editTransaction(id) {
  const txn = appData.transactions.find((t) => t.id === id);
  if (!txn) return;
  editingId = id;
  document.getElementById("addTitle").textContent = "แก้ไขรายการ";
  document.getElementById("cancelEdit").style.display = "block";
  document.getElementById("saveTransaction").textContent = "อัปเดต";

  document.querySelectorAll(".toggle-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.type === txn.type);
  });
  document.getElementById("addAmount").value = txn.amount;
  renderAddForm();
  setTimeout(() => {
    document.querySelectorAll(".cat-item").forEach((el) => {
      if (el.dataset.cat === txn.category) el.classList.add("selected");
    });
  }, 50);
  document.getElementById("addDate").value = txn.date || getToday();
  document.getElementById("addTime").value = txn.time || getNowTime();
  document.getElementById("addNote").value = txn.note || "";
  showView("add");
}

// ============================================================
//  MODAL (Add Account)
// ============================================================
let modalCallback = null;

function openModal(title, bodyHTML, confirmText, callback) {
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalBody").innerHTML = bodyHTML;
  document.getElementById("modalConfirm").textContent = confirmText || "ยืนยัน";
  document.getElementById("modalOverlay").style.display = "flex";
  modalCallback = callback;
}

function closeModal() {
  document.getElementById("modalOverlay").style.display = "none";
  modalCallback = null;
}

document.getElementById("modalCancel").addEventListener("click", closeModal);
document.getElementById("modalConfirm").addEventListener("click", function () {
  if (modalCallback) modalCallback();
});
document.getElementById("modalOverlay").addEventListener("click", function (e) {
  if (e.target === this) closeModal();
});

function openAddAccountModal() {
  openModal(
    "เพิ่มบัญชี",
    `
        <div class="input-group"><label>ชื่อบัญชี</label><input type="text" id="newAccName" class="input-field" placeholder="เช่น บัญชีหลัก" /></div>
        <div class="input-group"><label>สี</label>
            <select id="newAccColor" class="input-field">
                <option value="#2D6A4F">เขียว</option>
                <option value="#F2994A">ส้ม</option>
                <option value="#6495ED">น้ำเงิน</option>
                <option value="#9B86D3">ม่วง</option>
                <option value="#F25C5C">แดง</option>
                <option value="#45D18C">เขียวอ่อน</option>
            </select>
        </div>
    `,
    "สร้างบัญชี",
    function () {
      const name = document.getElementById("newAccName").value.trim();
      const color = document.getElementById("newAccColor").value;
      if (!name) {
        alert("กรุณาใส่ชื่อบัญชี");
        return;
      }
      const newAcc = { id: genId(), name, color };
      appData.accounts.push(newAcc);
      appData.currentAccountId = newAcc.id;
      saveData(appData);
      renderAll();
      closeModal();
    },
  );
}

document
  .getElementById("addAccountBtn")
  .addEventListener("click", openAddAccountModal);
document
  .getElementById("addAccountFromDropdown")
  .addEventListener("click", openAddAccountModal);

// ============================================================
//  RENDER ALL & INIT
// ============================================================
function renderAll() {
  renderDashboard();
  renderFullList();
  setTimeout(() => renderStats(), 100);
  renderCalendar();
  renderAccounts();
  renderAddForm();
  saveData(appData);
}

renderAll();
showView("dashboard");
