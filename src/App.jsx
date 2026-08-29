import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  LayoutDashboard, Package, ArrowLeftRight, Plus, Trash2, Pencil, Check,
  Search, Wallet, TrendingUp, TrendingDown, Boxes, AlertTriangle, Store,
  Lock, Download, X, Undo2, ShieldAlert, Printer, FileText, LogOut, Settings, User, Upload, Share2,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Legend,
} from "recharts";

/* ---------------------------------------------------------
   NileCore Business Dashboard — v2 (colorful + hardened)
   Brand shell:      Indigo #3730A3 / Indigo light #4338CA
   Backdrop:         #F5F6FB
   Stat accents:     Blue #2563EB · Emerald #059669 · Rose #E11D48 · Amber #D97706
   Card:             #FFFFFF   Line: #E4E4F0
   Display: Space Grotesk | Body: Inter | Numerals: IBM Plex Mono
--------------------------------------------------------- */

const FONT_IMPORT = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
`;

const CURRENCY = "UGX";
const fmt = (n) => `${CURRENCY} ${Math.round(n).toLocaleString("en-UG")}`;
const fmtShort = (n) => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
};

const DEFAULT_PRODUCTS = [
  { id: "p1", name: "Push-up Bra 34B Black", category: "Bras", price: 45000, openingStock: 5 },
  { id: "p2", name: "Ankara Wrap Dress M", category: "Dresses", price: 95000, openingStock: 8 },
  { id: "p3", name: "Gold Hoop Earrings", category: "Jewellery", price: 15000, openingStock: 12 },
  { id: "p4", name: "Ladies Analog Watch", category: "Jewellery", price: 60000, openingStock: 6 },
  { id: "p5", name: "Floral Mist Perfume 100ml", category: "Perfumes", price: 25000, openingStock: 10 },
];

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const DEFAULT_TX = [
  { id: "t1", date: daysAgo(6), type: "Sale", productId: "p1", qty: 1, amount: 45000, notes: "Regular customer" },
  { id: "t2", date: daysAgo(6), type: "Sale", productId: "p3", qty: 2, amount: 30000, notes: "" },
  { id: "t3", date: daysAgo(5), type: "Expense", productId: null, qty: null, amount: 50000, notes: "Shop rent contribution" },
  { id: "t4", date: daysAgo(4), type: "Restock", productId: "p5", qty: 10, amount: 250000, notes: "New delivery from supplier" },
  { id: "t5", date: daysAgo(3), type: "Sale", productId: "p2", qty: 1, amount: 95000, notes: "" },
  { id: "t6", date: daysAgo(2), type: "Sale", productId: "p4", qty: 1, amount: 60000, notes: "" },
  { id: "t7", date: daysAgo(1), type: "Expense", productId: null, qty: null, amount: 20000, notes: "Transport" },
  { id: "t8", date: daysAgo(0), type: "Sale", productId: "p1", qty: 1, amount: 45000, notes: "" },
];

// Uses the browser's own localStorage — matches the live deployed site exactly,
// so this file is always safe to copy-paste straight into GitHub.
async function loadStorage(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
async function saveStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* best effort — e.g. storage full or private browsing mode */
  }
}
function downloadCsv(filename, rows) {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [shopName, setShopName] = useState("Angels Loft Shop");
  const [editingShopName, setEditingShopName] = useState(false);
  const [logoUrl, setLogoUrl] = useState(null);
  const [logoError, setLogoError] = useState("");
  const [products, setProducts] = useState(DEFAULT_PRODUCTS);
  const [tx, setTx] = useState(DEFAULT_TX);
  const [tab, setTab] = useState("overview");

  // Security — username/password login, two roles: admin (full access) and staff (data entry only)
  const [auth, setAuth] = useState(null); // {admin:{username,password}, staff:{username,password}} — null until loaded
  const [role, setRole] = useState(null); // 'admin' | 'staff' — who's currently logged in
  const [loggedIn, setLoggedIn] = useState(false);
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showChangeCreds, setShowChangeCreds] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [ccRole, setCcRole] = useState("admin"); // which account the Change Login modal is editing
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [ccUser, setCcUser] = useState("");
  const [ccPass, setCcPass] = useState("");
  const [ccError, setCcError] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [reportPeriod, setReportPeriod] = useState("month"); // 'month' | 'year' | 'custom'
  const [reportFrom, setReportFrom] = useState(new Date().toISOString().slice(0, 8) + "01");
  const [reportTo, setReportTo] = useState(new Date().toISOString().slice(0, 10));
  const isAdmin = role === "admin";

  // Undo
  const [lastAction, setLastAction] = useState(null); // {type:'addTx'|'deleteTx'|'deleteProduct', payload}

  // Transaction form
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    type: "Sale",
    productId: "",
    qty: "",
    amount: "",
    notes: "",
  });

  // Stock form
  const [stockQuery, setStockQuery] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({});
  const [newProduct, setNewProduct] = useState({ name: "", category: "", price: "", openingStock: "" });

  useEffect(() => {
    (async () => {
      const [sn, pr, tr, savedAuth, rememberedRole, savedLogo] = await Promise.all([
        loadStorage("nilecore-dash:shopName", "Angels Loft Shop"),
        loadStorage("nilecore-dash:products", DEFAULT_PRODUCTS),
        loadStorage("nilecore-dash:tx", DEFAULT_TX),
        loadStorage("nilecore-dash:auth", {
          admin: { username: "admin", password: "User1" },
          staff: { username: "attendant", password: "Staff1" },
        }),
        loadStorage("nilecore-dash:remembered", null),
        loadStorage("nilecore-dash:logo", null),
      ]);
      setShopName(sn);
      setProducts(pr);
      setTx(tr);
      setAuth(savedAuth);
      if (rememberedRole) { setLoggedIn(true); setRole(rememberedRole); }
      setLogoUrl(savedLogo);
      setReady(true);
    })();
  }, []);

  useEffect(() => { if (ready) saveStorage("nilecore-dash:shopName", shopName); }, [shopName, ready]);
  useEffect(() => { if (ready) saveStorage("nilecore-dash:products", products); }, [products, ready]);
  useEffect(() => { if (ready) saveStorage("nilecore-dash:tx", tx); }, [tx, ready]);
  useEffect(() => { if (ready) saveStorage("nilecore-dash:logo", logoUrl); }, [logoUrl, ready]);

  // ---- Derived stock ----
  const stock = useMemo(() => {
    return products.map((p) => {
      const restocked = tx.filter((t) => t.type === "Restock" && t.productId === p.id).reduce((s, t) => s + (t.qty || 0), 0);
      const sold = tx.filter((t) => t.type === "Sale" && t.productId === p.id).reduce((s, t) => s + (t.qty || 0), 0);
      const balance = p.openingStock + restocked - sold;
      return { ...p, restocked, sold, balance };
    });
  }, [products, tx]);

  const totalStockValue = stock.reduce((s, p) => s + p.balance * p.price, 0);
  const lowStock = stock.filter((p) => p.balance <= 3 && p.balance > 0);
  const outOfStock = stock.filter((p) => p.balance <= 0);

  // Profit per Sale = amount received − (that product's stocked cost × qty sold)
  function saleProfit(t) {
    if (t.type !== "Sale") return 0;
    const p = products.find((x) => x.id === t.productId);
    if (!p) return 0;
    return t.amount - p.price * (t.qty || 0);
  }
  const profitOf = (list) => list.reduce((s, t) => s + saleProfit(t), 0);

  const totalSalesAll = tx.filter((t) => t.type === "Sale").reduce((s, t) => s + t.amount, 0);
  const totalExpAll = tx.filter((t) => t.type === "Expense" || t.type === "Restock").reduce((s, t) => s + t.amount, 0);
  const cashBalance = totalSalesAll - totalExpAll;

  const todayKey = new Date().toISOString().slice(0, 10);
  const todaysTx = tx.filter((t) => t.date === todayKey);
  const todaySales = todaysTx.filter((t) => t.type === "Sale").reduce((s, t) => s + t.amount, 0);
  const todayExp = todaysTx.filter((t) => t.type === "Expense" || t.type === "Restock").reduce((s, t) => s + t.amount, 0);
  const todayProfit = profitOf(todaysTx);

  const monthKey = todayKey.slice(0, 7);
  const monthTx = tx.filter((t) => t.date.slice(0, 7) === monthKey);
  const monthSales = monthTx.filter((t) => t.type === "Sale").reduce((s, t) => s + t.amount, 0);
  const monthExpenseOnly = monthTx.filter((t) => t.type === "Expense").reduce((s, t) => s + t.amount, 0);
  const monthRestockOnly = monthTx.filter((t) => t.type === "Restock").reduce((s, t) => s + t.amount, 0);
  const monthExp = monthExpenseOnly + monthRestockOnly;
  const monthProfit = profitOf(monthTx);

  const yearKey = todayKey.slice(0, 4);
  const yearTx = tx.filter((t) => t.date.slice(0, 4) === yearKey);
  const yearSales = yearTx.filter((t) => t.type === "Sale").reduce((s, t) => s + t.amount, 0);
  const yearExpenseOnly = yearTx.filter((t) => t.type === "Expense").reduce((s, t) => s + t.amount, 0);
  const yearRestockOnly = yearTx.filter((t) => t.type === "Restock").reduce((s, t) => s + t.amount, 0);
  const yearExp = yearExpenseOnly + yearRestockOnly;
  const yearProfit = profitOf(yearTx);

  const customTx = tx.filter((t) => t.date >= reportFrom && t.date <= reportTo);
  const customSales = customTx.filter((t) => t.type === "Sale").reduce((s, t) => s + t.amount, 0);
  const customExpenseOnly = customTx.filter((t) => t.type === "Expense").reduce((s, t) => s + t.amount, 0);
  const customRestockOnly = customTx.filter((t) => t.type === "Restock").reduce((s, t) => s + t.amount, 0);
  const customExp = customExpenseOnly + customRestockOnly;
  const customProfit = profitOf(customTx);

  // Whichever period is selected in the Print Report modal
  const reportTx = reportPeriod === "year" ? yearTx : reportPeriod === "custom" ? customTx : monthTx;
  const reportSales = reportPeriod === "year" ? yearSales : reportPeriod === "custom" ? customSales : monthSales;
  const reportExpenseOnly = reportPeriod === "year" ? yearExpenseOnly : reportPeriod === "custom" ? customExpenseOnly : monthExpenseOnly;
  const reportRestockOnly = reportPeriod === "year" ? yearRestockOnly : reportPeriod === "custom" ? customRestockOnly : monthRestockOnly;
  const reportExp = reportPeriod === "year" ? yearExp : reportPeriod === "custom" ? customExp : monthExp;
  const reportProfit = reportPeriod === "year" ? yearProfit : reportPeriod === "custom" ? customProfit : monthProfit;
  const reportLabel = reportPeriod === "year"
    ? yearKey
    : reportPeriod === "custom"
    ? `${reportFrom} to ${reportTo}`
    : new Date(monthKey + "-02").toLocaleDateString("en-UG", { month: "long", year: "numeric" });

  const trend = useMemo(() => {
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const key = daysAgo(i);
      const dayTx = tx.filter((t) => t.date === key);
      const sales = dayTx.filter((t) => t.type === "Sale").reduce((s, t) => s + t.amount, 0);
      const exp = dayTx.filter((t) => t.type === "Expense" || t.type === "Restock").reduce((s, t) => s + t.amount, 0);
      days.push({ label: key.slice(5), Sales: sales, Expenditure: exp, Net: sales - exp });
    }
    return days;
  }, [tx]);

  const monthlyBars = useMemo(() => {
    const map = {};
    tx.forEach((t) => {
      const key = t.date.slice(0, 7);
      if (!map[key]) map[key] = { Sales: 0, Expenditure: 0 };
      if (t.type === "Sale") map[key].Sales += t.amount;
      else map[key].Expenditure += t.amount;
    });
    return Object.entries(map).sort((a, b) => (a[0] > b[0] ? 1 : -1)).slice(-6).map(([key, v]) => ({ label: key, ...v }));
  }, [tx]);

  const recentTx = [...tx].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 30);

  const saleQtyExceedsStock = useMemo(() => {
    if (form.type !== "Sale" || !form.productId || !form.qty) return false;
    const p = stock.find((s) => s.id === form.productId);
    return p ? parseInt(form.qty, 10) > p.balance : false;
  }, [form, stock]);

  function addTransaction() {
    if (!form.amount) return;
    const needsProduct = form.type === "Sale" || form.type === "Restock";
    if (needsProduct && !form.productId) return;
    if (saleQtyExceedsStock) return;
    const record = {
      id: "t" + Date.now(),
      date: form.date,
      type: form.type,
      productId: needsProduct ? form.productId : null,
      qty: needsProduct ? parseInt(form.qty, 10) || 0 : null,
      amount: parseFloat(form.amount) || 0,
      notes: form.notes,
    };
    setTx((prev) => [record, ...prev]);
    setLastAction({ type: "addTx", payload: record });
    setForm({ date: new Date().toISOString().slice(0, 10), type: "Sale", productId: "", qty: "", amount: "", notes: "" });
  }
  function deleteTx(id) {
    const victim = tx.find((t) => t.id === id);
    if (!window.confirm("Delete this transaction? This can't be undone once you leave this screen.")) return;
    setTx((prev) => prev.filter((t) => t.id !== id));
    setLastAction({ type: "deleteTx", payload: victim });
  }
  function undoLast() {
    if (!lastAction) return;
    if (lastAction.type === "addTx") {
      setTx((prev) => prev.filter((t) => t.id !== lastAction.payload.id));
    } else if (lastAction.type === "deleteTx") {
      setTx((prev) => [lastAction.payload, ...prev]);
    } else if (lastAction.type === "deleteProduct") {
      setProducts((prev) => [...prev, lastAction.payload]);
    }
    setLastAction(null);
  }

  function startEdit(p) {
    setEditingId(p.id);
    setEditDraft({ name: p.name, category: p.category, price: p.price, openingStock: p.openingStock });
  }
  function saveEdit(id) {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, name: editDraft.name || p.name, category: editDraft.category || p.category,
              price: parseFloat(editDraft.price) || 0, openingStock: parseInt(editDraft.openingStock, 10) || 0 }
          : p
      )
    );
    setEditingId(null);
  }
  function deleteProduct(id) {
    const victim = products.find((p) => p.id === id);
    if (!window.confirm(`Delete "${victim?.name}"? Its sales history stays in Cashflow, but it will disappear from Stock.`)) return;
    setProducts((prev) => prev.filter((p) => p.id !== id));
    setLastAction({ type: "deleteProduct", payload: victim });
  }
  function addProduct() {
    if (!newProduct.name.trim()) return;
    setProducts((prev) => [...prev, {
      id: "p" + Date.now(), name: newProduct.name.trim(), category: newProduct.category.trim() || "Other",
      price: parseFloat(newProduct.price) || 0, openingStock: parseInt(newProduct.openingStock, 10) || 0,
    }]);
    setNewProduct({ name: "", category: "", price: "", openingStock: "" });
  }

  function exportTransactionsCsv() {
    const rows = [["Date", "Type", "Item", "Qty", "Amount", "Notes"]];
    tx.forEach((t) => {
      const p = products.find((x) => x.id === t.productId);
      rows.push([t.date, t.type, p ? p.name : "", t.qty ?? "", t.amount, t.notes]);
    });
    downloadCsv(`${shopName.replace(/\s+/g, "_")}_transactions.csv`, rows);
  }
  function exportStockCsv() {
    const rows = [["Item", "Category", "Price", "Opening Stock", "Restocked", "Sold", "Balance", "Stock Value"]];
    stock.forEach((p) => rows.push([p.name, p.category, p.price, p.openingStock, p.restocked, p.sold, p.balance, p.balance * p.price]));
    downloadCsv(`${shopName.replace(/\s+/g, "_")}_stock.csv`, rows);
  }

  function buildBackupFile() {
    const backup = {
      backupType: "nilecore-dashboard",
      backupVersion: 1,
      createdAt: new Date().toISOString(),
      shopName,
      products,
      tx,
      logoUrl,
    };
    const filename = `${shopName.replace(/\s+/g, "_")}_backup_${new Date().toISOString().slice(0, 10)}.json`;
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    return { blob, filename };
  }

  function exportFullBackup() {
    const { blob, filename } = buildBackupFile();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function shareBackup() {
    const { blob, filename } = buildBackupFile();
    const file = new File([blob], filename, { type: "application/json" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `${shopName} — Backup`,
          text: `${shopName} data backup — ${new Date().toLocaleDateString("en-UG")}`,
        });
      } catch {
        /* user cancelled the share sheet — nothing to do */
      }
    } else {
      alert("Sharing isn't supported on this browser — use 'Download Full Backup' instead, then attach the file to an email yourself.");
    }
  }

  function importFullBackup(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!Array.isArray(data.products) || !Array.isArray(data.tx)) {
          alert("This doesn't look like a valid backup file.");
          return;
        }
        const ok = window.confirm(
          `Restore this backup from ${data.createdAt ? new Date(data.createdAt).toLocaleString("en-UG") : "an earlier date"}?\n\nThis replaces everything currently in the app — all products, transactions, shop name, and logo. This can't be undone.`
        );
        if (!ok) return;
        setShopName(data.shopName || shopName);
        setProducts(data.products);
        setTx(data.tx);
        setLogoUrl(data.logoUrl || null);
        alert("Backup restored successfully.");
      } catch {
        alert("Couldn't read this file — make sure it's a backup exported from this app.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function handleLogoUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new window.Image();
      img.onload = () => {
        const size = 160;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        const scale = Math.min(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        setLogoUrl(canvas.toDataURL("image/png"));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target
