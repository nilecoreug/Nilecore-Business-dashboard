import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  LayoutDashboard, Package, ArrowLeftRight, Plus, Trash2, Pencil, Check,
  Search, Wallet, TrendingUp, TrendingDown, Boxes, AlertTriangle, Store,
  Lock, Download, X, Undo2, ShieldAlert, Printer, FileText, LogOut, Settings, User, Upload,
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

async function loadStorage(key, fallback) {
  try {
    const res = await window.storage.get(key, false);
    return res ? JSON.parse(res.value) : fallback;
  } catch {
    return fallback;
  }
}
async function saveStorage(key, value) {
  try {
    await window.storage.set(key, JSON.stringify(value), false);
  } catch {
    /* best effort */
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
  const [ccRole, setCcRole] = useState("admin"); // which account the Change Login modal is editing
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [ccUser, setCcUser] = useState("");
  const [ccPass, setCcPass] = useState("");
  const [ccError, setCcError] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [reportPeriod, setReportPeriod] = useState("month"); // 'month' | 'year'
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

  const totalSalesAll = tx.filter((t) => t.type === "Sale").reduce((s, t) => s + t.amount, 0);
  const totalExpAll = tx.filter((t) => t.type === "Expense" || t.type === "Restock").reduce((s, t) => s + t.amount, 0);
  const cashBalance = totalSalesAll - totalExpAll;

  const todayKey = new Date().toISOString().slice(0, 10);
  const todaysTx = tx.filter((t) => t.date === todayKey);
  const todaySales = todaysTx.filter((t) => t.type === "Sale").reduce((s, t) => s + t.amount, 0);
  const todayExp = todaysTx.filter((t) => t.type === "Expense" || t.type === "Restock").reduce((s, t) => s + t.amount, 0);

  const monthKey = todayKey.slice(0, 7);
  const monthTx = tx.filter((t) => t.date.slice(0, 7) === monthKey);
  const monthSales = monthTx.filter((t) => t.type === "Sale").reduce((s, t) => s + t.amount, 0);
  const monthExpenseOnly = monthTx.filter((t) => t.type === "Expense").reduce((s, t) => s + t.amount, 0);
  const monthRestockOnly = monthTx.filter((t) => t.type === "Restock").reduce((s, t) => s + t.amount, 0);
  const monthExp = monthExpenseOnly + monthRestockOnly;

  const yearKey = todayKey.slice(0, 4);
  const yearTx = tx.filter((t) => t.date.slice(0, 4) === yearKey);
  const yearSales = yearTx.filter((t) => t.type === "Sale").reduce((s, t) => s + t.amount, 0);
  const yearExpenseOnly = yearTx.filter((t) => t.type === "Expense").reduce((s, t) => s + t.amount, 0);
  const yearRestockOnly = yearTx.filter((t) => t.type === "Restock").reduce((s, t) => s + t.amount, 0);
  const yearExp = yearExpenseOnly + yearRestockOnly;

  // Whichever period is selected in the Print Report modal
  const reportTx = reportPeriod === "year" ? yearTx : monthTx;
  const reportSales = reportPeriod === "year" ? yearSales : monthSales;
  const reportExpenseOnly = reportPeriod === "year" ? yearExpenseOnly : monthExpenseOnly;
  const reportRestockOnly = reportPeriod === "year" ? yearRestockOnly : monthRestockOnly;
  const reportExp = reportPeriod === "year" ? yearExp : monthExp;
  const reportLabel = reportPeriod === "year"
    ? yearKey
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
    e.target.value = "";
  }
  function removeLogo() {
    setLogoUrl(null);
  }

  function resetToDefaultLogin() {
    const defaults = {
      admin: { username: "admin", password: "User1" },
      staff: { username: "attendant", password: "Staff1" },
    };
    setAuth(defaults);
    saveStorage("nilecore-dash:auth", defaults);
    setShowForgotPassword(false);
    setLoginUser("admin");
    setLoginPass("User1");
  }

  function printReport() {
    const periodLabel = reportPeriod === "year" ? "Annual Report" : "Monthly Report";
    const rowsHtml = (type, label) => {
      const rows = reportTx.filter((t) => t.type === type).sort((a, b) => (a.date > b.date ? 1 : -1));
      const subtotal = rows.reduce((s, t) => s + t.amount, 0);
      const body = rows.length
        ? rows.map((t) => {
            const p = products.find((x) => x.id === t.productId);
            const desc = (p ? p.name : t.notes || "—") + (t.qty ? ` ×${t.qty}` : "");
            return `<tr><td>${t.date.slice(5)}</td><td>${desc}</td><td style="text-align:right">${fmt(t.amount)}</td></tr>`;
          }).join("")
        : `<tr><td colspan="3" style="text-align:center;color:#9CA3AF;padding:8px 0">No ${label.toLowerCase()} this period.</td></tr>`;
      return `
        <div style="margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:600;text-transform:uppercase;color:#6B7280;margin-bottom:4px">
            <span>${label}</span><span>${fmt(subtotal)}</span>
          </div>
          <table style="width:100%;font-size:12px;border-collapse:collapse">
            <thead><tr style="text-align:left;border-bottom:1px solid #E4E4F0">
              <th style="padding:4px 8px 4px 0">Date</th><th style="padding:4px 8px 4px 0">Item / Notes</th><th style="padding:4px 0;text-align:right">Amount</th>
            </tr></thead>
            <tbody>${body}</tbody>
          </table>
        </div>`;
    };
    const stockRows = stock.map((p) =>
      `<tr><td>${p.name}</td><td style="text-align:right">${p.balance}</td><td style="text-align:right">${fmt(p.balance * p.price)}</td></tr>`
    ).join("");

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${shopName} — ${periodLabel}</title>
      <style>
        body { font-family: -apple-system, Arial, sans-serif; color: #1E1B4B; max-width: 480px; margin: 24px auto; padding: 0 16px; }
        td, th { padding: 4px 0; }
        table { margin-bottom: 4px; }
      </style></head><body>
      <div style="text-align:center;margin-bottom:16px">
        <div style="font-weight:700;font-size:18px">${shopName}</div>
        <div style="font-size:11px;color:#6B7280">Powered by NileCore Technologies</div>
        <div style="font-weight:600;font-size:15px;margin-top:8px">${periodLabel} — ${reportLabel}</div>
        <div style="font-size:11px;color:#6B7280">Generated ${new Date().toLocaleString("en-UG")}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
        <div style="text-align:center;background:#ECFDF5;border-radius:8px;padding:8px"><div style="font-size:10px;text-transform:uppercase;color:#6B7280">Sales</div><div style="font-weight:600;color:#059669">${fmt(reportSales)}</div></div>
        <div style="text-align:center;background:#FFF1F2;border-radius:8px;padding:8px"><div style="font-size:10px;text-transform:uppercase;color:#6B7280">Expenses</div><div style="font-weight:600;color:#E11D48">${fmt(reportExpenseOnly)}</div></div>
        <div style="text-align:center;background:#FFFBEB;border-radius:8px;padding:8px"><div style="font-size:10px;text-transform:uppercase;color:#6B7280">Restock Cost</div><div style="font-weight:600;color:#D97706">${fmt(reportRestockOnly)}</div></div>
        <div style="text-align:center;background:#EFF6FF;border-radius:8px;padding:8px"><div style="font-size:10px;text-transform:uppercase;color:#6B7280">Net</div><div style="font-weight:600;color:#1E3A8A">${fmt(reportSales - reportExp)}</div></div>
      </div>
      ${rowsHtml("Sale", "Sales")}
      ${rowsHtml("Expense", "Expenses")}
      ${rowsHtml("Restock", "Restocks")}
      <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:600;text-transform:uppercase;color:#6B7280;margin-bottom:4px">
        <span>Stock Snapshot</span><span>${fmt(totalStockValue)}</span>
      </div>
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <thead><tr style="text-align:left;border-bottom:1px solid #E4E4F0"><th>Item</th><th style="text-align:right">Balance</th><th style="text-align:right">Value</th></tr></thead>
        <tbody>${stockRows}</tbody>
      </table>
      <script>window.onload = function(){ window.print(); };</script>
      </body></html>`;

    const w = window.open("", "_blank");
    if (!w) {
      alert("Your browser blocked the print window. Please allow pop-ups for this site and try again.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  function handleLogin() {
    if (loginUser === auth.admin.username && loginPass === auth.admin.password) {
      setLoggedIn(true);
      setRole("admin");
      setLoginError("");
      setLoginUser("");
      setLoginPass("");
      saveStorage("nilecore-dash:remembered", rememberMe ? "admin" : null);
    } else if (loginUser === auth.staff.username && loginPass === auth.staff.password) {
      setLoggedIn(true);
      setRole("staff");
      setLoginError("");
      setLoginUser("");
      setLoginPass("");
      saveStorage("nilecore-dash:remembered", rememberMe ? "staff" : null);
    } else {
      setLoginError("Incorrect username or password.");
    }
  }
  function handleLogout() {
    setLoggedIn(false);
    setRole(null);
    saveStorage("nilecore-dash:remembered", null);
  }
  function openChangeCreds(forRole) {
    setCcRole(forRole);
    setCcUser(auth[forRole].username);
    setCcPass("");
    setCcError("");
    setShowChangeCreds(true);
  }
  function handleChangeCreds() {
    if (!ccUser.trim() || ccPass.length < 4) {
      setCcError("Username can't be empty and password needs at least 4 characters.");
      return;
    }
    const next = { ...auth, [ccRole]: { username: ccUser.trim(), password: ccPass } };
    setAuth(next);
    saveStorage("nilecore-dash:auth", next);
    setShowChangeCreds(false);
    setCcUser("");
    setCcPass("");
    setCcError("");
  }

  const filteredStock = stock.filter((p) => p.name.toLowerCase().includes(stockQuery.toLowerCase()));

  if (!ready) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif" }} className="min-h-screen flex items-center justify-center bg-[#F5F6FB] text-[#1E1B4B]">
        Loading dashboard…
      </div>
    );
  }

  // ---- Login screen ----
  if (!loggedIn) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif" }} className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#14315C] via-[#1B3A6B] to-[#0D2340] px-4 relative overflow-hidden">
        <style>{FONT_IMPORT}</style>
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-[#17ABA0]/25 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-[#17ABA0]/15 blur-3xl" />

        <div className="bg-white/95 backdrop-blur rounded-2xl shadow-2xl p-7 w-full max-w-sm relative">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="relative mb-3">
              <label
                htmlFor="login-logo-upload"
                className={`w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg overflow-hidden cursor-pointer ${logoUrl ? "" : "border-2 border-dashed"}`}
                style={logoUrl ? { backgroundColor: "#0E3358" } : { borderColor: "#C7CBE0", backgroundColor: "#F5F6FB" }}
                title={logoUrl ? "Tap to change your logo" : "Tap to upload your company logo"}
              >
                <input id="login-logo-upload" type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                {logoUrl ? (
                  <img src={logoUrl} alt="Company logo" className="w-full h-full object-contain p-1" />
                ) : (
                  <span className="text-[10px] text-center leading-tight text-[#9CA3AF] font-medium">
                    ADD<br />LOGO
                  </span>
                )}
              </label>
              {!logoUrl && (
                <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-white shadow flex items-center justify-center border border-[#E4E4F0] pointer-events-none">
                  <Upload size={11} className="text-[#14315C]" />
                </div>
              )}
            </div>
            {logoUrl && (
              <button onClick={removeLogo} className="text-[10px] text-[#9CA3AF] hover:text-[#E11D48] underline mb-2">
                Remove logo
              </button>
            )}
            <div className="display text-2xl font-bold text-[#14315C] tracking-tight">{shopName}</div>
            <div className="display text-xs font-semibold tracking-[0.2em] text-[#3FA9F5] mt-1">BUSINESS DASHBOARD</div>
            <div className="text-xs text-[#6B7280] italic mt-2">Connecting Opportunities. Delivering Excellence.</div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-[#6B7280] block mb-1">Username</label>
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                <input
                  value={loginUser}
                  onChange={(e) => setLoginUser(e.target.value)}
                  autoFocus
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-[#E4E4F0] outline-none focus:ring-2 focus:ring-[#17ABA0]/50 text-sm"
                  placeholder="admin"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-[#6B7280] block mb-1">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                <input
                  type="password"
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-[#E4E4F0] outline-none focus:ring-2 focus:ring-[#17ABA0]/50 text-sm mono"
                  placeholder="••••••••"
                />
              </div>
            </div>
            <label className="flex items-center justify-between text-xs text-[#6B7280] cursor-pointer">
              <span className="flex items-center gap-1.5">
                <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="accent-[#17ABA0]" />
                Remember me
              </span>
              <button onClick={() => setShowForgotPassword(true)} className="hover:underline" style={{ color: "#0E7C74" }} type="button">
                Forgot password?
              </button>
            </label>
            {loginError && <div className="text-xs text-[#E11D48] flex items-center gap-1"><AlertTriangle size={12} /> {loginError}</div>}
            <button
              onClick={handleLogin}
              style={{ backgroundColor: "#0E7C74", color: "#FFFFFF" }}
              className="w-full py-3 rounded-lg text-sm font-bold tracking-wide hover:opacity-90 transition-opacity shadow-md"
            >
              LOG IN
            </button>
          </div>

          <div className="text-center text-[11px] text-[#9CA3AF] mt-5">
            Default login: <span className="mono">admin</span> / <span className="mono">User1</span> — change it after logging in.
          </div>
          <div className="text-center text-[11px] font-medium tracking-wide text-[#6B7280] mt-3">
            Powered by <span style={{ color: "#3FA9F5" }} className="font-semibold">NileCore</span> Technologies
          </div>
        </div>

        {showForgotPassword && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-5 w-full max-w-xs text-center">
              <div className="w-10 h-10 rounded-full bg-[#FFFBEB] flex items-center justify-center mx-auto mb-3">
                <AlertTriangle size={18} className="text-[#D97706]" />
              </div>
              <h3 className="display font-semibold text-sm mb-2">Reset Login?</h3>
              <p className="text-xs text-[#6B7280] mb-4">
                This resets your username and password back to the default (<span className="mono">admin</span> / <span className="mono">User1</span>).
                Your sales, stock, and cashflow data are stored separately and will <span className="font-semibold">not</span> be affected.
              </p>
              <button onClick={resetToDefaultLogin} style={{ backgroundColor: "#D97706", color: "#FFFFFF" }} className="w-full py-2 rounded-lg text-sm font-semibold hover:opacity-90 mb-2">
                Reset to Default Login
              </button>
              <button onClick={() => setShowForgotPassword(false)} className="w-full py-2 rounded-lg border border-[#E4E4F0] text-sm font-medium hover:bg-[#F5F6FB]">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }


  const StatCard = ({ icon: Icon, label, value, accent }) => {
    const accents = {
      blue: { bg: "#EFF6FF", ic: "#2563EB", text: "#1E3A8A" },
      green: { bg: "#ECFDF5", ic: "#059669", text: "#065F46" },
      rose: { bg: "#FFF1F2", ic: "#E11D48", text: "#9F1239" },
      amber: { bg: "#FFFBEB", ic: "#D97706", text: "#92400E" },
    };
    const a = accents[accent];
    return (
      <div className="bg-white rounded-xl border border-[#E4E4F0] p-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: a.ic }} />
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: a.bg }}>
            <Icon size={14} style={{ color: a.ic }} />
          </div>
          <span className="text-[11px] uppercase tracking-wide text-[#6B7280]">{label}</span>
        </div>
        <div className="text-xl sm:text-2xl font-semibold" style={{ fontFamily: "IBM Plex Mono, monospace", color: a.text }}>{value}</div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F5F6FB] text-[#1E1B4B]" style={{ fontFamily: "Inter, sans-serif" }}>
      <style>{`
        ${FONT_IMPORT}
        .display { font-family: 'Space Grotesk', sans-serif; }
        .mono { font-family: 'IBM Plex Mono', monospace; }
      `}</style>

      {/* Report modal */}
      {showReport && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl my-8">
            <div className="flex justify-center gap-1 pt-4 no-print">
              <div className="inline-flex bg-[#F5F6FB] rounded-full p-1">
                <button
                  onClick={() => setReportPeriod("month")}
                  style={reportPeriod === "month" ? { backgroundColor: "#3730A3", color: "#FFFFFF" } : {}}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium ${reportPeriod === "month" ? "" : "text-[#6B7280]"}`}
                >
                  This Month
                </button>
                <button
                  onClick={() => setReportPeriod("year")}
                  style={reportPeriod === "year" ? { backgroundColor: "#3730A3", color: "#FFFFFF" } : {}}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium ${reportPeriod === "year" ? "" : "text-[#6B7280]"}`}
                >
                  Full Year
                </button>
              </div>
            </div>
            <div id="monthly-report-print" className="p-6">
              <div className="text-center mb-4">
                <div className="display text-lg font-semibold">{shopName}</div>
                <div className="text-xs text-[#6B7280]">Powered by NileCore Technologies</div>
                <div className="display text-base font-semibold mt-3">
                  {reportPeriod === "year" ? "Annual Report" : "Monthly Report"} — {reportLabel}
                </div>
                <div className="text-[11px] text-[#6B7280]">Generated {new Date().toLocaleString("en-UG")}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="text-center bg-[#ECFDF5] rounded-lg py-2">
                  <div className="text-[10px] uppercase text-[#6B7280]">Sales</div>
                  <div className="mono text-sm font-semibold text-[#059669]">{fmt(reportSales)}</div>
                </div>
                <div className="text-center bg-[#FFF1F2] rounded-lg py-2">
                  <div className="text-[10px] uppercase text-[#6B7280]">Expenses</div>
                  <div className="mono text-sm font-semibold text-[#E11D48]">{fmt(reportExpenseOnly)}</div>
                </div>
                <div className="text-center bg-[#FFFBEB] rounded-lg py-2">
                  <div className="text-[10px] uppercase text-[#6B7280]">Restock Cost</div>
                  <div className="mono text-sm font-semibold text-[#D97706]">{fmt(reportRestockOnly)}</div>
                </div>
                <div className="text-center bg-[#EFF6FF] rounded-lg py-2">
                  <div className="text-[10px] uppercase text-[#6B7280]">Net (Sales − Exp − Restock)</div>
                  <div className="mono text-sm font-semibold text-[#1E3A8A]">{fmt(reportSales - reportExp)}</div>
                </div>
              </div>

              {[
                { label: "Sales", type: "Sale", tone: "text-[#059669]" },
                { label: "Expenses", type: "Expense", tone: "text-[#E11D48]" },
                { label: "Restocks", type: "Restock", tone: "text-[#D97706]" },
              ].map(({ label, type, tone }) => {
                const rows = reportTx.filter((t) => t.type === type).sort((a, b) => (a.date > b.date ? 1 : -1));
                const subtotal = rows.reduce((s, t) => s + t.amount, 0);
                return (
                  <div key={type} className="mb-4">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">{label}</div>
                      <div className={`mono text-xs font-semibold ${tone}`}>{fmt(subtotal)}</div>
                    </div>
                    <table className="w-full text-xs mono">
                      <thead>
                        <tr className="text-left border-b border-[#E4E4F0]">
                          <th className="py-1 pr-2">Date</th><th className="py-1 pr-2">Item / Notes</th><th className="py-1 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((t) => {
                          const p = products.find((x) => x.id === t.productId);
                          return (
                            <tr key={t.id} className="border-b border-[#F0F0F7]">
                              <td className="py-1 pr-2">{t.date.slice(5)}</td>
                              <td className="py-1 pr-2">{p ? p.name : t.notes || "—"}{t.qty ? ` ×${t.qty}` : ""}</td>
                              <td className="py-1 text-right">{fmt(t.amount)}</td>
                            </tr>
                          );
                        })}
                        {rows.length === 0 && (
                          <tr><td colSpan={3} className="py-2 text-center text-[#9CA3AF]">No {label.toLowerCase()} this month.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                );
              })}

              <div className="flex items-center justify-between mb-1">
                <div className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Stock Snapshot</div>
                <div className="mono text-xs font-semibold text-[#D97706]">{fmt(totalStockValue)}</div>
              </div>
              <table className="w-full text-xs mono">
                <thead>
                  <tr className="text-left border-b border-[#E4E4F0]">
                    <th className="py-1 pr-2">Item</th><th className="py-1 pr-2 text-right">Balance</th><th className="py-1 text-right">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {stock.map((p) => (
                    <tr key={p.id} className="border-b border-[#F0F0F7]">
                      <td className="py-1 pr-2">{p.name}</td>
                      <td className="py-1 pr-2 text-right">{p.balance}</td>
                      <td className="py-1 text-right">{fmt(p.balance * p.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 p-3 border-t border-[#E4E4F0] no-print">
              <button onClick={printReport} style={{ backgroundColor: "#3730A3", color: "#FFFFFF" }} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium hover:opacity-90">
                <Printer size={14} /> Print / Save as PDF
              </button>
              <button onClick={() => setShowReport(false)} className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-[#E4E4F0] text-sm font-medium hover:bg-[#F5F6FB]">
                <X size={14} /> Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change credentials modal */}
      {showChangeCreds && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-5 w-full max-w-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="display font-semibold text-sm">Change Login</h3>
              <button onClick={() => setShowChangeCreds(false)}><X size={16} /></button>
            </div>
            <div className="flex gap-1 mb-3 bg-[#F5F6FB] rounded-lg p-1">
              <button
                onClick={() => openChangeCreds("admin")}
                style={ccRole === "admin" ? { backgroundColor: "#3730A3", color: "#FFFFFF" } : {}}
                className={`flex-1 py-1.5 rounded-md text-xs font-medium ${ccRole === "admin" ? "" : "text-[#6B7280]"}`}
              >
                Admin
              </button>
              <button
                onClick={() => openChangeCreds("staff")}
                style={ccRole === "staff" ? { backgroundColor: "#3730A3", color: "#FFFFFF" } : {}}
                className={`flex-1 py-1.5 rounded-md text-xs font-medium ${ccRole === "staff" ? "" : "text-[#6B7280]"}`}
              >
                Attendant
              </button>
            </div>
            <p className="text-xs text-[#6B7280] mb-3">
              Set the username and password for the {ccRole === "admin" ? "Admin" : "Attendant"} account.
            </p>
            <label className="text-xs text-[#6B7280] block mb-1">Username</label>
            <input
              value={ccUser}
              onChange={(e) => setCcUser(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#E4E4F0] outline-none focus:ring-2 focus:ring-[#4338CA]/40 mb-2 text-sm"
            />
            <label className="text-xs text-[#6B7280] block mb-1">New Password</label>
            <input
              type="password"
              value={ccPass}
              onChange={(e) => setCcPass(e.target.value)}
              placeholder="At least 4 characters"
              className="mono w-full px-3 py-2 rounded-lg border border-[#E4E4F0] outline-none focus:ring-2 focus:ring-[#4338CA]/40 mb-2 text-sm"
            />
            {ccError && <div className="text-xs text-[#E11D48] mb-2">{ccError}</div>}
            <button onClick={handleChangeCreds} style={{ backgroundColor: "#3730A3", color: "#FFFFFF" }} className="w-full py-2 rounded-lg text-sm font-semibold hover:opacity-90">
              Save Login
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header style={{ background: "linear-gradient(to right, #3730A3, #4338CA)", color: "#FFFFFF" }} className="px-4 sm:px-6 py-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              {editingShopName && isAdmin ? (
                <input
                  autoFocus value={shopName} onChange={(e) => setShopName(e.target.value)}
                  onBlur={() => setEditingShopName(false)} onKeyDown={(e) => e.key === "Enter" && setEditingShopName(false)}
                  className="display text-2xl sm:text-3xl font-bold bg-transparent border-b border-white/40 outline-none w-full"
                />
              ) : isAdmin ? (
                <button onClick={() => setEditingShopName(true)} className="display text-2xl sm:text-3xl font-bold flex items-center gap-2 truncate hover:opacity-80">
                  <span className="truncate">{shopName}</span>
                  <Pencil size={16} className="opacity-60 shrink-0" />
                </button>
              ) : (
                <div className="display text-2xl sm:text-3xl font-bold truncate">{shopName}</div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={() => setTab("cashflow")}
              style={{ backgroundColor: "#F59E0B", color: "#1E1B4B" }}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
              title="Jump to Cashflow to add or manage transactions"
            >
              <ArrowLeftRight size={13} /> Manage Feed
            </button>
            {isAdmin && (
              <button
                onClick={() => openChangeCreds("admin")}
                className="flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/20 px-2.5 py-1.5 rounded-lg"
                title="Change username/password"
              >
                <Settings size={12} />
              </button>
            )}
            <button
              onClick={handleLogout}
              style={{ backgroundColor: "#E11D48", color: "#FFFFFF" }}
              className="flex items-center gap-1.5 text-xs font-semibold hover:opacity-90 px-3 py-1.5 rounded-lg transition-opacity"
              title="Log out"
            >
              <LogOut size={12} /> Log Out
            </button>
          </div>
        </div>
      </header>

      {/* Nav */}
      <nav style={{ backgroundColor: "#1E1B4B", color: "#FFFFFF" }}>
        <div className="max-w-6xl mx-auto flex overflow-x-auto">
          {[
            { id: "overview", label: "Overview", icon: LayoutDashboard },
            { id: "cashflow", label: "Cashflow", icon: ArrowLeftRight },
            { id: "stock", label: "Stock", icon: Package },
          ].map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 sm:px-5 py-3 text-sm font-medium border-b-2 shrink-0 transition-colors ${
                tab === id ? "border-[#F59E0B] text-white" : "border-transparent text-white/50 hover:text-white/90"
              }`}>
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>
      </nav>

      {lastAction && (
        <div className="bg-[#FEF3C7] border-b border-[#FDE68A] text-[#92400E] text-xs px-4 py-2 flex items-center justify-between max-w-6xl mx-auto">
          <span className="flex items-center gap-1.5"><ShieldAlert size={13} /> Last action can be undone.</span>
          <button onClick={undoLast} className="flex items-center gap-1 font-semibold hover:underline">
            <Undo2 size={13} /> Undo
          </button>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {(tab === "overview" || tab === "cashflow") && (
          <div className="flex justify-center mb-6">
            <div className="inline-flex bg-white border border-[#E4E4F0] rounded-full p-1 shadow-sm">
              <button
                onClick={() => setTab("overview")}
                style={tab === "overview" ? { backgroundColor: "#3730A3", color: "#FFFFFF" } : {}}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  tab === "overview" ? "" : "text-[#6B7280] hover:text-[#1E1B4B]"
                }`}
              >
                <LayoutDashboard size={14} /> Overview
              </button>
              <button
                onClick={() => setTab("cashflow")}
                style={tab === "cashflow" ? { backgroundColor: "#3730A3", color: "#FFFFFF" } : {}}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  tab === "cashflow" ? "" : "text-[#6B7280] hover:text-[#1E1B4B]"
                }`}
              >
                <ArrowLeftRight size={14} /> Feed
              </button>
            </div>
          </div>
        )}
        {tab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard icon={Wallet} label="Cash Balance" value={fmt(cashBalance)} accent="blue" />
              <StatCard icon={TrendingUp} label="Sales (This Month)" value={fmt(monthSales)} accent="green" />
              <StatCard icon={TrendingDown} label="Expenditure (This Month)" value={fmt(monthExp)} accent="rose" />
              <StatCard icon={Boxes} label="Stock Value" value={fmt(totalStockValue)} accent="amber" />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="col-span-2 lg:col-span-1 bg-white rounded-xl border border-[#E4E4F0] p-4">
                <div className="text-[11px] uppercase tracking-wide text-[#6B7280] mb-1">Today's Sales</div>
                <div className="mono text-lg font-semibold text-[#059669]">{fmt(todaySales)}</div>
              </div>
              <div className="col-span-2 lg:col-span-1 bg-white rounded-xl border border-[#E4E4F0] p-4">
                <div className="text-[11px] uppercase tracking-wide text-[#6B7280] mb-1">Today's Expenditure</div>
                <div className="mono text-lg font-semibold text-[#E11D48]">{fmt(todayExp)}</div>
              </div>
              <div className={`col-span-2 lg:col-span-1 rounded-xl border p-4 ${lowStock.length > 0 ? "bg-[#FFFBEB] border-[#FDE68A]" : "bg-white border-[#E4E4F0]"}`}>
                <div className="text-[11px] uppercase tracking-wide text-[#6B7280] mb-1 flex items-center gap-1"><AlertTriangle size={12} /> Low Stock</div>
                <div className="mono text-lg font-semibold text-[#D97706]">{lowStock.length} item(s)</div>
              </div>
              <div className={`col-span-2 lg:col-span-1 rounded-xl border p-4 ${outOfStock.length > 0 ? "bg-[#FFF1F2] border-[#FECDD3]" : "bg-white border-[#E4E4F0]"}`}>
                <div className="text-[11px] uppercase tracking-wide text-[#6B7280] mb-1">Out of Stock</div>
                <div className="mono text-lg font-semibold text-[#E11D48]">{outOfStock.length} item(s)</div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-[#E4E4F0] p-4">
              <h3 className="display font-semibold text-sm mb-4">Cashflow — Last 14 Days</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E4E4F0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6B7280" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} tickFormatter={fmtShort} />
                  <Tooltip formatter={(v) => fmt(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E4E4F0" }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="Sales" stroke="#059669" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Expenditure" stroke="#E11D48" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Net" stroke="#D97706" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl border border-[#E4E4F0] p-4">
              <h3 className="display font-semibold text-sm mb-4">Sales vs Expenditure — Last 6 Months</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyBars} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E4E4F0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6B7280" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} tickFormatter={fmtShort} />
                  <Tooltip formatter={(v) => fmt(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E4E4F0" }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Sales" fill="#059669" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Expenditure" fill="#E11D48" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {tab === "cashflow" && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="display text-lg font-semibold">Recent Transactions</h2>
                {isAdmin && (
                  <div className="flex gap-2">
                    <button onClick={() => setShowReport(true)} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-[#E4E4F0] bg-white hover:bg-[#F5F6FB]">
                      <FileText size={13} /> Print Report
                    </button>
                    <button onClick={exportTransactionsCsv} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-[#E4E4F0] bg-white hover:bg-[#F5F6FB]">
                      <Download size={13} /> Export CSV
                    </button>
                  </div>
                )}
              </div>
              {recentTx.length === 0 ? (
                <div className="text-center py-16 text-[#6B7280] text-sm border border-dashed border-[#E4E4F0] rounded-xl">
                  No transactions yet — add your first one on the right.
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-[#E4E4F0] divide-y divide-[#F0F0F7]">
                  {recentTx.map((t) => {
                    const product = products.find((p) => p.id === t.productId);
                    const tone = t.type === "Sale" ? "text-[#059669]" : t.type === "Expense" ? "text-[#E11D48]" : "text-[#D97706]";
                    const badge = t.type === "Sale" ? "bg-[#ECFDF5] text-[#059669]" : t.type === "Expense" ? "bg-[#FFF1F2] text-[#E11D48]" : "bg-[#FFFBEB] text-[#D97706]";
                    const sign = t.type === "Sale" ? "+" : "−";
                    return (
                      <div key={t.id} className="px-4 py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium flex items-center gap-2">
                            <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${badge}`}>{t.type}</span>
                            <span className="truncate">{product ? product.name : t.notes || "—"}</span>
                          </div>
                          <div className="text-xs text-[#6B7280] mt-0.5">
                            {t.date}{product && t.qty ? ` · qty ${t.qty}` : ""}{t.notes && product ? ` · ${t.notes}` : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`mono text-sm font-semibold ${tone}`}>{sign} {fmt(t.amount)}</span>
                          {isAdmin && <button onClick={() => deleteTx(t.id)} className="text-[#6B7280] hover:text-[#E11D48]"><Trash2 size={14} /></button>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <aside className="bg-white rounded-xl border border-[#E4E4F0] p-4 h-fit sticky top-4">
              <h3 className="display font-semibold text-sm mb-3">Add Transaction</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-[#6B7280] block mb-1">Date</label>
                  <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#E4E4F0] text-sm outline-none focus:ring-2 focus:ring-[#4338CA]/40" />
                </div>
                <div>
                  <label className="text-xs text-[#6B7280] block mb-1">Type</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, productId: "", qty: "" })}
                    className="w-full px-3 py-2 rounded-lg border border-[#E4E4F0] text-sm outline-none focus:ring-2 focus:ring-[#4338CA]/40">
                    <option>Sale</option><option>Expense</option><option>Restock</option>
                  </select>
                </div>
                {(form.type === "Sale" || form.type === "Restock") && (
                  <>
                    <div>
                      <label className="text-xs text-[#6B7280] block mb-1">Item</label>
                      <select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-[#E4E4F0] text-sm outline-none focus:ring-2 focus:ring-[#4338CA]/40">
                        <option value="">Choose item…</option>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-[#6B7280] block mb-1">Qty</label>
                      <input type="number" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })}
                        className="mono w-full px-3 py-2 rounded-lg border border-[#E4E4F0] text-sm outline-none focus:ring-2 focus:ring-[#4338CA]/40" />
                      {saleQtyExceedsStock && (
                        <div className="text-xs text-[#E11D48] mt-1 flex items-center gap-1">
                          <AlertTriangle size={12} /> Only {stock.find((s) => s.id === form.productId)?.balance} left in stock.
                        </div>
                      )}
                    </div>
                  </>
                )}
                <div>
                  <label className="text-xs text-[#6B7280] block mb-1">Amount</label>
                  <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="mono w-full px-3 py-2 rounded-lg border border-[#E4E4F0] text-sm outline-none focus:ring-2 focus:ring-[#4338CA]/40" />
                </div>
                <div>
                  <label className="text-xs text-[#6B7280] block mb-1">Notes</label>
                  <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#E4E4F0] text-sm outline-none focus:ring-2 focus:ring-[#4338CA]/40" />
                </div>
                <button onClick={addTransaction} disabled={saleQtyExceedsStock}
                  style={saleQtyExceedsStock ? { backgroundColor: "#E4E4F0", color: "#9CA3AF" } : { backgroundColor: "#3730A3", color: "#FFFFFF" }}
                  className={`w-full py-2.5 rounded-lg text-sm font-semibold ${saleQtyExceedsStock ? "cursor-not-allowed" : "hover:opacity-90"}`}>
                  Add Transaction
                </button>
              </div>
            </aside>
          </div>
        )}

        {tab === "stock" && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h2 className="display text-lg font-semibold">Stock List</h2>
              <div className="flex gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                  <input value={stockQuery} onChange={(e) => setStockQuery(e.target.value)} placeholder="Search stock…"
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#E4E4F0] bg-white text-sm outline-none focus:ring-2 focus:ring-[#4338CA]/40" />
                </div>
                {isAdmin && (
                  <button onClick={exportStockCsv} className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-[#E4E4F0] bg-white hover:bg-[#F5F6FB] shrink-0">
                    <Download size={13} /> CSV
                  </button>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-[#E4E4F0] overflow-hidden mb-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#F5F6FB] text-left text-xs uppercase tracking-wide text-[#6B7280]">
                      <th className="px-4 py-2.5 font-medium">Item</th>
                      <th className="px-4 py-2.5 font-medium">Category</th>
                      <th className="px-4 py-2.5 font-medium text-right">Price</th>
                      <th className="px-4 py-2.5 font-medium text-right">Opening</th>
                      <th className="px-4 py-2.5 font-medium text-right">Restocked</th>
                      <th className="px-4 py-2.5 font-medium text-right">Sold</th>
                      <th className="px-4 py-2.5 font-medium text-right">Balance</th>
                      <th className="px-4 py-2.5 font-medium w-20"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStock.map((p) => {
                      const editing = editingId === p.id;
                      const low = p.balance > 0 && p.balance <= 3;
                      return (
                        <tr key={p.id} className="border-t border-[#F0F0F7]">
                          {editing ? (
                            <>
                              <td className="px-4 py-2"><input value={editDraft.name} onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })} className="w-full px-2 py-1 rounded border border-[#E4E4F0]" /></td>
                              <td className="px-4 py-2"><input value={editDraft.category} onChange={(e) => setEditDraft({ ...editDraft, category: e.target.value })} className="w-full px-2 py-1 rounded border border-[#E4E4F0]" /></td>
                              <td className="px-4 py-2"><input type="number" value={editDraft.price} onChange={(e) => setEditDraft({ ...editDraft, price: e.target.value })} className="w-24 px-2 py-1 rounded border border-[#E4E4F0] text-right mono" /></td>
                              <td className="px-4 py-2"><input type="number" value={editDraft.openingStock} onChange={(e) => setEditDraft({ ...editDraft, openingStock: e.target.value })} className="w-16 px-2 py-1 rounded border border-[#E4E4F0] text-right mono" /></td>
                              <td className="px-4 py-2 text-right mono text-[#6B7280]">{p.restocked}</td>
                              <td className="px-4 py-2 text-right mono text-[#6B7280]">{p.sold}</td>
                              <td className="px-4 py-2 text-right mono">{p.balance}</td>
                              <td className="px-4 py-2"><button onClick={() => saveEdit(p.id)} className="text-[#059669]"><Check size={16} /></button></td>
                            </>
                          ) : (
                            <>
                              <td className="px-4 py-2.5 font-medium">{p.name}</td>
                              <td className="px-4 py-2.5 text-[#6B7280]">{p.category}</td>
                              <td className="px-4 py-2.5 text-right mono">{fmt(p.price)}</td>
                              <td className="px-4 py-2.5 text-right mono text-[#6B7280]">{p.openingStock}</td>
                              <td className="px-4 py-2.5 text-right mono text-[#6B7280]">{p.restocked}</td>
                              <td className="px-4 py-2.5 text-right mono text-[#6B7280]">{p.sold}</td>
                              <td className="px-4 py-2.5 text-right">
                                <span className={`mono px-2 py-0.5 rounded text-xs font-medium ${p.balance <= 0 ? "bg-[#FFF1F2] text-[#E11D48]" : low ? "bg-[#FFFBEB] text-[#D97706]" : "text-[#1E1B4B]"}`}>{p.balance}</span>
                              </td>
                              <td className="px-4 py-2.5">
                                {isAdmin && (
                                  <div className="flex items-center gap-2 justify-end">
                                    <button onClick={() => startEdit(p)} className="text-[#6B7280] hover:text-[#4338CA]"><Pencil size={14} /></button>
                                    <button onClick={() => deleteProduct(p.id)} className="text-[#6B7280] hover:text-[#E11D48]"><Trash2 size={14} /></button>
                                  </div>
                                )}
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                    {filteredStock.length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-10 text-center text-[#6B7280] text-sm">No stock yet — add your first item below.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {isAdmin && (
              <div className="bg-white rounded-xl border border-[#E4E4F0] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Plus size={16} className="text-[#4338CA]" />
                  <h3 className="display font-semibold text-sm">Add New Stock Item</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <input placeholder="Item name" value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} className="col-span-2 sm:col-span-1 px-3 py-2 rounded-lg border border-[#E4E4F0] text-sm outline-none focus:ring-2 focus:ring-[#4338CA]/40" />
                  <input placeholder="Category" value={newProduct.category} onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })} className="px-3 py-2 rounded-lg border border-[#E4E4F0] text-sm outline-none focus:ring-2 focus:ring-[#4338CA]/40" />
                  <input type="number" placeholder="Price" value={newProduct.price} onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })} className="px-3 py-2 rounded-lg border border-[#E4E4F0] text-sm outline-none focus:ring-2 focus:ring-[#4338CA]/40 mono" />
                  <input type="number" placeholder="Opening stock" value={newProduct.openingStock} onChange={(e) => setNewProduct({ ...newProduct, openingStock: e.target.value })} className="px-3 py-2 rounded-lg border border-[#E4E4F0] text-sm outline-none focus:ring-2 focus:ring-[#4338CA]/40 mono" />
                </div>
                <button onClick={addProduct} style={{ backgroundColor: "#3730A3", color: "#FFFFFF" }} className="mt-3 px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90">Add Item</button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
