import { loadSupabaseClient, DEFAULTS } from "./config.js";

const $ = (id) => document.getElementById(id);

const authMsg = $("authMsg");
const appBox = $("appBox");
const rolePill = $("rolePill");

const loginBtn = $("loginBtn");
const logoutBtn = $("logoutBtn");

const jointEl = $("joint");
const dateEl = $("date");

const resultEl = $("result");
const debtBox = $("debtBox");
const saveBtn = $("saveBtn");

// Delivery UI
const toggleDeliveryBtn = $("toggleDeliveryBtn");
const deliveryBox = $("deliveryBox");
const deliveryType = $("deliveryType");
const deliveryQty = $("deliveryQty");
const addDeliveryBtn = $("addDeliveryBtn");
const clearDeliveryBtn = $("clearDeliveryBtn");

let CURRENT_ROLE = "foreman";
let supabase = null;

const fields = {
  startTable: $("startTable"),
  givenLocal: $("givenLocal"),
  givenAgric: $("givenAgric"),
  transferIn: $("transferIn"),
  transferOut: $("transferOut"),
  salesGhs: $("salesGhs"),
  broken: $("broken"),
  paidCash: $("paidCash"),
  paidMoMo: $("paidMoMo"),
  paidTotal: $("paidTotal"),
  momoRef: $("momoRef"),
  sellPrice: $("sellPrice"),
  duePer: $("duePer"),
  bonusPct: $("bonusPct"),
};

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function calcBonus(paidGiven, bonusPct) {
  return Math.round(paidGiven * (bonusPct / 100));
}

function syncPaidTotal() {
  const paidCash = Number(fields.paidCash.value) || 0;
  const paidMoMo = Number(fields.paidMoMo.value) || 0;
  fields.paidTotal.value = (paidCash + paidMoMo).toFixed(2);
}

function compute() {
  const sellPrice = Number(fields.sellPrice.value) || DEFAULTS.sellPrice;
  const duePer = Number(fields.duePer.value) || DEFAULTS.duePer;
  const bonusPct = Number(fields.bonusPct.value) || DEFAULTS.bonusPct;

  const startTable = Number(fields.startTable.value) || 0;
  const givenLocal = Number(fields.givenLocal.value) || 0;
  const givenAgric = Number(fields.givenAgric.value) || 0;
  const transferIn = Number(fields.transferIn.value) || 0;
  const transferOut = Number(fields.transferOut.value) || 0;
  const salesGhs = Number(fields.salesGhs.value) || 0;
  const broken = Number(fields.broken.value) || 0; // KPI only
  const paidCash = Number(fields.paidCash.value) || 0;
  const paidMoMo = Number(fields.paidMoMo.value) || 0;
  const paidGhs = paidCash + paidMoMo;
  const momoRef = (fields.momoRef.value || "").trim();

  const paidGiven = givenLocal + givenAgric;
  const bonus = calcBonus(paidGiven, bonusPct);

  // Sold derived from sales money
  const sold = sellPrice > 0 ? Math.floor(salesGhs / sellPrice) : 0;

  const ownerDueGiven = paidGiven * duePer;
  const ownerDueSales = sold * duePer;

  // Stock logic: Broken is KPI only (Option 1) -> not reducing stock.
  const available = startTable + paidGiven + bonus + transferIn - transferOut;
  const remaining = available - sold;

  const deltaGiven = paidGhs - ownerDueGiven;

  return {
    sellPrice, duePer, bonusPct,
    startTable, givenLocal, givenAgric, transferIn, transferOut,
    salesGhs, broken,
    paidCash, paidMoMo, paidGhs, momoRef,
    paidGiven, bonus, sold,
    ownerDueGiven, ownerDueSales,
    remaining, deltaGiven
  };
}

function renderCalc(c, newDebt = null) {
  const payCls = c.deltaGiven < 0 ? "danger" : "ok";

  resultEl.innerHTML = `
    <div>Paid Given: <b>${c.paidGiven}</b> | Bonus: <b>${c.bonus}</b> | Sold: <b>${c.sold}</b></div>
    <div>Owner Due (Given*${c.duePer}): <b>${c.ownerDueGiven.toFixed(2)} GHS</b></div>
    <div>Kontrolle (Sold*${c.duePer}): <b>${c.ownerDueSales.toFixed(2)} GHS</b></div>
    <div class="${payCls}">
      Paid Total: <b>${c.paidGhs.toFixed(2)} GHS</b>
      (Cash ${c.paidCash.toFixed(2)} / MoMo ${c.paidMoMo.toFixed(2)}) |
      Paid - Due(Given): <b>${c.deltaGiven.toFixed(2)} GHS</b>
    </div>
    <div>Soll-Rest (Kontrolle): <b>${c.remaining}</b></div>
    <div class="muted">Broken (KPI only): ${c.broken}</div>
  `;

  if (newDebt !== null) {
    const cls = newDebt > 0 ? "danger" : "ok";
    debtBox.innerHTML = `Current Debt (offen): <span class="${cls}"><b>${newDebt.toFixed(2)} GHS</b></span>`;
  }
}

async function loadRole(session) {
  // Fallback: if profiles table / RLS not ready -> foreman
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (error) throw error;
    CURRENT_ROLE = data?.role || "foreman";
  } catch {
    CURRENT_ROLE = "foreman";
  }

  rolePill.style.display = "inline-block";
  rolePill.textContent = `role: ${CURRENT_ROLE}`;
}

async function loadJoints() {
  const { data, error } = await supabase.from("joints").select("id,name").order("name");
  if (error) {
    authMsg.textContent = "Fehler joints: " + error.message;
    return;
  }
  jointEl.innerHTML = (data || []).map(j => `<option value="${j.id}">${j.name}</option>`).join("");
  await refreshDebt();
}

async function refreshDebt() {
  const jointId = jointEl.value;
  if (!jointId) return;

  const { data, error } = await supabase
    .from("joint_balances")
    .select("debt_ghs")
    .eq("joint_id", jointId)
    .maybeSingle();

  if (error) return;

  const debt = data?.debt_ghs ? Number(data.debt_ghs) : 0;
  const cls = debt > 0 ? "danger" : "ok";
  debtBox.innerHTML = `Current Debt (offen): <span class="${cls}"><b>${debt.toFixed(2)} GHS</b></span>`;
}

async function upsertDebt(jointId, debtDelta) {
  const { data: bal } = await supabase
    .from("joint_balances")
    .select("debt_ghs")
    .eq("joint_id", jointId)
    .maybeSingle();

  const current = bal?.debt_ghs ? Number(bal.debt_ghs) : 0;
  const next = current + debtDelta;

  const { error } = await supabase.from("joint_balances").upsert({
    joint_id: jointId,
    debt_ghs: next,
    updated_at: new Date().toISOString()
  });

  if (error) throw error;
  return next;
}

async function saveEntry() {
  syncPaidTotal();
  const c = compute();
  renderCalc(c);

  const jointId = jointEl.value;
  const entryDate = dateEl.value || todayISO();

  // Debt increases if due > paid (positive delta)
  const debtDelta = c.ownerDueGiven - c.paidGhs;
  let newDebt = null;

  try {
    newDebt = await upsertDebt(jointId, debtDelta);
  } catch (e) {
    authMsg.textContent = "Debt Update Fehler: " + (e?.message || String(e));
    return;
  }

  const payload = {
    entry_date: entryDate,
    joint_id: jointId,

    start_table: c.startTable,
    given_local: c.givenLocal,
    given_agric: c.givenAgric,
    transfer_in: c.transferIn,
    transfer_out: c.transferOut,
    sales_ghs: c.salesGhs,
    broken: c.broken,

    paid_cash_ghs: c.paidCash,
    paid_momo_ghs: c.paidMoMo,
    momo_ref: c.momoRef || null,
    paid_ghs: c.paidGhs,

    paid_given: c.paidGiven,
    bonus: c.bonus,
    sold: c.sold,
    owner_due_given: c.ownerDueGiven,
    owner_due_sales: c.ownerDueSales,
    remaining: c.remaining
  };

  const { error } = await supabase.from("entries").insert(payload);
  if (error) {
    authMsg.textContent = "Save Fehler: " + error.message;
    return;
  }

  authMsg.textContent = "Gespeichert.";
  renderCalc(c, newDebt);

  // Reset daily input fields (not stock base)
  fields.salesGhs.value = 0;
  fields.paidCash.value = 0;
  fields.paidMoMo.value = 0;
  fields.momoRef.value = "";
  syncPaidTotal();
  fields.paidCash.focus();
}

// Delivery UI
function toggleDelivery() {
  deliveryBox.style.display = (deliveryBox.style.display === "none") ? "block" : "none";
}

function addDelivery() {
  const qty = Number(deliveryQty.value) || 0;
  if (qty <= 0) return;

  const type = deliveryType.value;
  if (type === "local") fields.givenLocal.value = Number(fields.givenLocal.value || 0) + qty;
  if (type === "agric") fields.givenAgric.value = Number(fields.givenAgric.value || 0) + qty;

  deliveryQty.value = 0;
}

function clearDelivery() {
  fields.givenLocal.value = 0;
  fields.givenAgric.value = 0;
  deliveryQty.value = 0;
}

// Events (minimal: load approved + pending for admin)
async function loadApprovedEvents() {
  const { data, error } = await supabase
    .from("joint_event_requests")
    .select("id, title, kind, event_date, rule, qty_extra, status, active, joint_id")
    .eq("status", "approved")
    .eq("active", true);

  if (error) { $("eventsList").textContent = "Events load error: " + error.message; return; }

  const { data: joints } = await supabase.from("joints").select("id,name");
  const map = new Map((joints || []).map(j => [j.id, j.name]));

  const rows = (data || []).map(e => {
    const jname = map.get(e.joint_id) || "Unknown";
    const when = e.kind === "one_time" ? e.event_date : e.rule;
    return `• ${jname}: ${e.title} | ${when} | +${e.qty_extra}`;
  });

  $("eventsList").textContent = rows.length ? rows.join("\n") : "No approved events yet.";
}

async function loadPendingApprovals() {
  const container = $("adminApprovals");
  if (CURRENT_ROLE !== "admin") { container.textContent = ""; return; }

  const { data, error } = await supabase
    .from("joint_event_requests")
    .select("id, title, kind, event_date, rule, qty_extra, note, joint_id, status")
    .eq("status", "pending");

  if (error) { container.textContent = "Pending load error: " + error.message; return; }

  const { data: joints } = await supabase.from("joints").select("id,name");
  const map = new Map((joints || []).map(j => [j.id, j.name]));

  if (!data?.length) { container.textContent = "No pending event requests."; return; }

  container.innerHTML = "<b>Pending Event Requests (Admin)</b>\n";

  const user = (await supabase.auth.getUser()).data.user;

  data.forEach(e => {
    const jname = map.get(e.joint_id) || "Unknown";
    const when = e.kind === "one_time" ? e.event_date : e.rule;

    const line = document.createElement("div");
    line.style.marginTop = "8px";
    line.innerHTML = `
      ${jname}: ${e.title} | ${when} | +${e.qty_extra}${e.note ? " | " + e.note : ""}
      <button class="btn" data-id="${e.id}" data-act="approve">Approve</button>
      <button class="btn" data-id="${e.id}" data-act="reject">Reject</button>
    `;
    container.appendChild(line);

    line.querySelectorAll("button").forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute("data-id");
        const act = btn.getAttribute("data-act");

        const update = (act === "approve")
          ? { status: "approved", approved_by: user.id, approved_at: new Date().toISOString() }
          : { status: "rejected", approved_by: user.id, approved_at: new Date().toISOString() };

        const { error } = await supabase.from("joint_event_requests").update(update).eq("id", id);
        if (error) { alert(error.message); return; }

        await loadPendingApprovals();
        await loadApprovedEvents();
      };
    });
  });
}

async function createEventRequest() {
  const jointId = jointEl.value;

  const title = prompt("Event title (e.g. 'Monthly Bulk Order'):");
  if (!title) return;

  const kind = prompt("Type: one_time or recurring ?", "one_time");
  if (!kind || !["one_time","recurring"].includes(kind)) { alert("Invalid type"); return; }

  let event_date = null;
  let rule = null;

  if (kind === "one_time") {
    event_date = prompt("Event date (YYYY-MM-DD):");
    if (!event_date) return;
  } else {
    rule = prompt("Rule (e.g. LAST_SATURDAY):", "LAST_SATURDAY");
    if (!rule) return;
  }

  const qty = Number(prompt("Extra coconuts needed (e.g. 100):", "100") || "0");
  const note = prompt("Note (optional):", "") || null;

  const user = (await supabase.auth.getUser()).data.user;

  const payload = {
    joint_id: jointId,
    title,
    kind,
    event_date,
    rule,
    qty_extra: qty,
    note,
    requested_by: user.id
  };

  const { error } = await supabase.from("joint_event_requests").insert(payload);
  if (error) { alert(error.message); return; }

  alert("Event request submitted (pending admin approval).");
  await loadPendingApprovals();
  await loadApprovedEvents();
}

// Auth handlers
async function login() {
  authMsg.textContent = "Login…";
  const email = $("email").value;
  const password = $("password").value;

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) authMsg.textContent = "Login Fehler: " + error.message;
}

async function logout() {
  await supabase.auth.signOut();
}

async function handleSession(session) {
  if (session) {
    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";
    appBox.style.display = "block";
    dateEl.value = todayISO();

    await loadRole(session);
    await loadJoints();

    // Wire buttons
    toggleDeliveryBtn.onclick = toggleDelivery;
    addDeliveryBtn.onclick = addDelivery;
    clearDeliveryBtn.onclick = clearDelivery;

    $("addEventBtn").onclick = createEventRequest;
    $("loadEventsBtn").onclick = async () => { await loadApprovedEvents(); await loadPendingApprovals(); };

    // Initial loads
    await loadApprovedEvents();
    await loadPendingApprovals();

    // Events + totals
    syncPaidTotal();
    authMsg.textContent = "Eingeloggt.";
  } else {
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
    appBox.style.display = "none";
    rolePill.style.display = "none";
    CURRENT_ROLE = "foreman";
    authMsg.textContent = "Bitte einloggen.";
  }
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && appBox.style.display !== "none") saveEntry();
});
saveBtn.onclick = saveEntry;

// Boot
fields.sellPrice.value = DEFAULTS.sellPrice;
fields.duePer.value = DEFAULTS.duePer;
fields.bonusPct.value = DEFAULTS.bonusPct;

try {
  supabase = loadSupabaseClient();

  jointEl.addEventListener("change", refreshDebt);
  fields.paidCash.addEventListener("input", syncPaidTotal);
  fields.paidMoMo.addEventListener("input", syncPaidTotal);

  loginBtn.onclick = login;
  logoutBtn.onclick = logout;

  supabase.auth.onAuthStateChange(async (_event, session) => {
    await handleSession(session);
  });

  const { data: { session } } = await supabase.auth.getSession();
  await handleSession(session);
} catch (error) {
  console.error("[boot] Failed to start app", error);
  loginBtn.style.display = "none";
  logoutBtn.style.display = "none";
  appBox.style.display = "none";
  authMsg.textContent = `Konfigurationsfehler: ${error.message}`;
}
