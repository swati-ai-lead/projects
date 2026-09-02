import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsPDF } from "https://esm.sh/jspdf@2.5.2";
import * as pdfjsLib from "https://esm.sh/pdfjs-dist@4.10.38/build/pdf.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = "https://esm.sh/pdfjs-dist@4.10.38/build/pdf.worker.mjs";

const monthName = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date());
const monthKey = `${new Date().toISOString().slice(0, 7)}-01`;
const money = value => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(value || 0));
let supabase;
let session;
let isAdmin = false;
let authMode = "signin";
let state = { units: [], maintenance: [], utilities: [], expenses: [], rentHistory: [], utilityHistory: [], tenants: [], mortgageSchedule: [] };

async function getClient() {
  const response = await fetch("/api/config");
  if (!response.ok) throw new Error("The secure database configuration is not available yet.");
  const config = await response.json();
  return createClient(config.url, config.anonKey, { auth: { storage: sessionStorage, persistSession: true, autoRefreshToken: true } });
}
function expenseMonth(item) { return item.date ? `${item.date.slice(0, 7)}-01` : monthKey; }
function expensesForMonth(month) { return state.expenses.filter(item => expenseMonth(item) === month); }
function mortgageEntryForMonth(month) { return state.mortgageSchedule.filter(item => item.effective_month <= month).sort((a, b) => b.effective_month.localeCompare(a.effective_month))[0]; }
function mortgageForMonth(month) { return Number(mortgageEntryForMonth(month)?.amount || 0); }
function utilityForMonth(utility, month) { const record = state.utilityHistory.find(entry => entry.month === month && entry.utility_id === utility.id); return { amount:Number(record ? record.amount : utility.amount), paid:record ? record.paid : month === monthKey && utility.paid, due:record ? record.due : utility.due, bill_document:record?.bill_document, bill_url:record?.bill_url }; }
function currentMonthExpenses() { return expensesForMonth(monthKey).filter(item => item.category !== "Mortgage").reduce((sum, item) => sum + Number(item.amount), 0) + mortgageForMonth(monthKey) + state.utilities.reduce((sum, item) => sum + Number(utilityForMonth(item, monthKey).amount), 0); }
const HISTORY_START = "2025-04-01";
function monthLabel(month) { return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}T00:00:00Z`)); }
function shortMonthLabel(date) { return date ? new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date.slice(0, 10)}T00:00:00Z`)) : "?"; }
function ledgerMonths() {
  const months = []; let year = Number(HISTORY_START.slice(0, 4)); let month = Number(HISTORY_START.slice(5, 7));
  const endYear = Number(monthKey.slice(0, 4)); const endMonth = Number(monthKey.slice(5, 7));
  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${String(month).padStart(2, "0")}-01`);
    month += 1; if (month > 12) { month = 1; year += 1; }
  }
  return months.reverse();
}
function ownerMonths() {
  const months = new Set(ledgerMonths());
  const start = new Date(`${monthKey}T00:00:00Z`);
  for (let offset = 1; offset <= 24; offset += 1) {
    const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + offset, 1));
    months.add(date.toISOString().slice(0, 10));
  }
  return [...months].sort().reverse();
}
function selectedTenantMonth() { return document.querySelector("#tenant-month").value || monthKey; }
function selectedUtilityMonth() { return `${document.querySelector("#utility-month").value || monthKey.slice(0, 7)}-01`; }
function selectedOwnerMonth() { return document.querySelector("#owner-month").value || monthKey; }
function monthEndDue(month) { return new Intl.DateTimeFormat("en-US", { month:"short", day:"numeric", timeZone:"UTC" }).format(new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0))); }
function parseAmountFromBillText(text) {
  const normalized = text.replace(/\s+/g, " ");
  const patterns = [/total\s+(?:amount\s+)?due\D{0,30}\$?([0-9,]+\.\d{2})/i, /amount\s+due\D{0,30}\$?([0-9,]+\.\d{2})/i, /new\s+charges\D{0,30}\$?([0-9,]+\.\d{2})/i, /payment\s+due\D{0,30}\$?([0-9,]+\.\d{2})/i, /mortgage\s+payment\D{0,30}\$?([0-9,]+\.\d{2})/i, /\$\s*([0-9,]+\.\d{2})/];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) return Number(match[1].replace(/,/g, ""));
  }
  return null;
}
async function readBillText(file) {
  if (!(file instanceof File) || !file.size) return "";
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data:buffer }).promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map(item => item.str).join(" "));
    }
    return pages.join("\n");
  }
  if (file.type.startsWith("text/") || /\.(csv|txt)$/i.test(file.name)) return file.text();
  return "";
}
async function parseBillFile(file) { const text = await readBillText(file); return text ? parseAmountFromBillText(text) : null; }
async function uploadBillFile(file, folder) {
  if (!(file instanceof File) || !file.size) return null;
  const filename = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${folder}/${Date.now()}-${filename}`;
  const { error } = await supabase.storage.from("bills").upload(path, file, { contentType:file.type || "application/octet-stream", upsert:false });
  if (error) throw error;
  return path;
}
async function signedBillUrl(path) {
  if (!path) return null;
  const { data } = await supabase.storage.from("bills").createSignedUrl(path, 3600);
  return data?.signedUrl || null;
}
function tenantExpenseCharges(month) {
  const activeTenants = state.tenants.filter(item => item.status !== "Ended");
  const activeTenantIds = activeTenants.map(item => item.id);
  const charges = new Map(activeTenantIds.map(id => [id, { total:0, lines:[] }]));
  expensesForMonth(month).filter(item => item.category !== "Mortgage" && item.allocation !== "owner").forEach(expense => {
    const tenantIds = expense.allocation === "all_tenants" ? activeTenantIds : expense.tenant_ids || [];
    if (!tenantIds.length) return;
    const share = Number(expense.amount || 0) / tenantIds.length;
    tenantIds.forEach(id => {
      if (!charges.has(id)) charges.set(id, { total:0, lines:[] });
      const entry = charges.get(id);
      entry.total += share;
      entry.lines.push({ description:expense.description, category:expense.category, amount:share, bill_url:expense.bill_url });
    });
  });
  return charges;
}
function tenantMonthlyLedger(month) {
  const isCurrentMonth = month === monthKey;
  const expenseCharges = tenantExpenseCharges(month);
  const utilityAmount = service => {
    const utility = state.utilities.find(entry => entry.service === service);
    return utility ? utilityForMonth(utility, month).amount : 0;
  };
  const pecoShare = utilityAmount("PECO") / 4;
  const waterShare = utilityAmount("Water") / 4;
  const trash = utilityAmount("Trash");
  const sewer = utilityAmount("Sewer");
  return state.tenants.filter(item => item.status !== "Ended").map(item => {
    const record = state.rentHistory.find(entry => entry.month === month && entry.unit_id === item.unit_id);
    const unit = state.units.find(entry => entry.id === item.unit_id);
    const rent = Number(record ? record.rent : item.monthly_rent || 0);
    const paid = record ? record.paid : isCurrentMonth && unit?.paid;
    const utilityCharges = pecoShare + waterShare + trash + sewer + WIFI_PER_TENANT;
    const extraExpenses = expenseCharges.get(item.id)?.total || 0;
    const extraExpenseLines = expenseCharges.get(item.id)?.lines || [];
    return { ...item, rent, paid, utilityCharges, extraExpenses, extraExpenseLines, totalDue:rent + utilityCharges + extraExpenses };
  });
}
function tenantBillDetails(tenant, month) {
  const utilityAmount = service => {
    const utility = state.utilities.find(entry => entry.service === service);
    return utility ? utilityForMonth(utility, month).amount : 0;
  };
  const pecoShare = utilityAmount("PECO") / 4;
  const waterShare = utilityAmount("Water") / 4;
  const utilityLines = [
    { label:"PECO", note:"Split by 4", amount:pecoShare },
    { label:"Water", note:"Split by 4", amount:waterShare },
    { label:"Trash", note:"Charged to tenant", amount:utilityAmount("Trash") },
    { label:"Sewer", note:"Charged to tenant", amount:utilityAmount("Sewer") },
    { label:"WiFi", note:"Flat monthly charge", amount:WIFI_PER_TENANT }
  ];
  const expenseLines = tenant.extraExpenseLines || [];
  return { utilityLines, expenseLines };
}
function drawBillRow(doc, y, label, note, amount, shaded = false) {
  if (shaded) { doc.setFillColor(244, 239, 226); doc.rect(18, y - 6, 174, 13, "F"); }
  doc.setTextColor(23, 51, 61);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(label, 24, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(98, 116, 122);
  doc.setFontSize(8);
  if (note) doc.text(note, 24, y + 4.5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(23, 51, 61);
  doc.text(money(amount), 184, y, { align:"right" });
}
function generateTenantBill(tenantId) {
  const month = selectedTenantMonth();
  const tenant = tenantMonthlyLedger(month).find(item => item.id === tenantId);
  if (!tenant) { alert("Tenant bill details are not available for this month."); return; }
  const { utilityLines, expenseLines } = tenantBillDetails(tenant, month);
  const doc = new jsPDF({ unit:"mm", format:"letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(23, 51, 61);
  doc.rect(0, 0, pageWidth, 54, "F");
  doc.setFillColor(184, 225, 213);
  doc.rect(18, 16, 14, 14, "F");
  doc.setTextColor(33, 78, 92);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("B", 25, 25.5, { align:"center" });
  doc.setTextColor(255, 254, 250);
  doc.setFontSize(22);
  doc.text("1179 Bush St", 38, 21);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Tenant Monthly Bill", 38, 29);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text(money(tenant.totalDue), pageWidth - 18, 25, { align:"right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Total due for ${monthLabel(month)}`, pageWidth - 18, 33, { align:"right" });

  doc.setFillColor(255, 254, 250);
  doc.roundedRect(18, 66, 174, 34, 2, 2, "F");
  doc.setDrawColor(217, 222, 216);
  doc.roundedRect(18, 66, 174, 34, 2, 2, "S");
  doc.setTextColor(237, 114, 88);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("BILL TO", 24, 77);
  doc.setTextColor(23, 51, 61);
  doc.setFontSize(15);
  doc.text(tenant.full_name, 24, 86);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(98, 116, 122);
  doc.text(`${tenant.unit_name} | ${tenant.email || "No email on file"}`, 24, 93);
  doc.text(`Generated ${new Intl.DateTimeFormat("en-US", { month:"short", day:"numeric", year:"numeric" }).format(new Date())}`, 184, 77, { align:"right" });

  let y = 118;
  doc.setTextColor(237, 114, 88);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("CHARGES", 18, y);
  y += 12;
  drawBillRow(doc, y, "Base rent", "Monthly lease rent", tenant.rent, true); y += 16;
  utilityLines.forEach((line, index) => { drawBillRow(doc, y, line.label, line.note, line.amount, index % 2 === 0); y += 14; });
  if (expenseLines.length) {
    doc.setTextColor(237, 114, 88);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("OTHER EXPENSES", 18, y + 3);
    y += 15;
    expenseLines.forEach((line, index) => { drawBillRow(doc, y, line.category, line.description, line.amount, index % 2 === 0); y += 14; });
  }
  doc.setFillColor(33, 78, 92);
  doc.roundedRect(18, y + 5, 174, 20, 2, 2, "F");
  doc.setTextColor(255, 254, 250);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Total due", 24, y + 18);
  doc.setFontSize(18);
  doc.text(money(tenant.totalDue), 184, y + 18, { align:"right" });
  doc.setTextColor(98, 116, 122);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Manual ledger edits remain the source of truth for rent, utilities, and expense assignments.", 18, 267);
  const filename = `${tenant.full_name}-${month.slice(0, 7)}-bill.pdf`.replace(/[^a-zA-Z0-9._-]/g, "-");
  doc.save(filename);
}
function renderOwnerDashboard() {
  const select = document.querySelector("#owner-month");
  const months = [...new Set([...ownerMonths(), ...state.rentHistory.map(item => item.month), ...state.utilityHistory.map(item => item.month), ...state.expenses.map(expenseMonth), ...state.mortgageSchedule.map(item => item.effective_month)])].sort().reverse();
  const month = months.includes(select.value) ? select.value : monthKey;
  select.innerHTML = months.map(item => `<option value="${item}">${monthLabel(item)}</option>`).join("");
  select.value = month;
  const tenants = tenantMonthlyLedger(month);
  const rentIncome = tenants.reduce((sum, item) => sum + item.rent, 0);
  const utilityIncome = tenants.reduce((sum, item) => sum + item.utilityCharges, 0);
  const tenantExpenseIncome = tenants.reduce((sum, item) => sum + item.extraExpenses, 0);
  const utilitiesExpense = state.utilities.reduce((sum, item) => sum + utilityForMonth(item, month).amount, 0);
  const otherExpenses = expensesForMonth(month).filter(item => item.category !== "Mortgage").reduce((sum, item) => sum + Number(item.amount), 0);
  const mortgageExpense = mortgageForMonth(month);
  const income = rentIncome + utilityIncome + tenantExpenseIncome;
  const expenses = mortgageExpense + utilitiesExpense + otherExpenses;
  const net = income - expenses;
  document.querySelector("#owner-income-total").textContent = money(income);
  document.querySelector("#owner-expense-total").textContent = money(expenses);
  document.querySelector("#owner-net-total").textContent = money(net);
  document.querySelector("#owner-net-note").textContent = net >= 0 ? "Projected monthly surplus" : "Projected monthly shortfall";
  const mortgage = mortgageEntryForMonth(month);
  document.querySelector("#owner-expense-list").innerHTML = `<div class="owner-line"><span>Mortgage<small>${mortgage ? `Effective ${monthLabel(mortgage.effective_month)}` : "No mortgage set yet"}</small>${mortgage?.bill_url ? `<a class="text-link" href="${mortgage.bill_url}" target="_blank" rel="noreferrer">Bill</a>` : ""}</span><strong>${money(mortgageExpense)}</strong></div>${state.utilities.map(item => { const record = utilityForMonth(item, month); return `<div class="owner-line"><span>${item.service}<small>Due ${record.due || monthEndDue(month)}</small>${record.bill_url ? `<a class="text-link" href="${record.bill_url}" target="_blank" rel="noreferrer">Bill</a>` : ""}</span><strong>${money(record.amount)}</strong></div>`; }).join("")}<div class="owner-line"><span>Other expenses<small>Cleaning, supplies, repairs, and owner-only costs</small></span><strong>${money(otherExpenses)}</strong></div>`;
  document.querySelector("#owner-income-list").innerHTML = `<div class="owner-line"><span>Rent charged</span><strong>${money(rentIncome)}</strong></div><div class="owner-line"><span>Utilities charged<small>PECO/Water split by 4, WiFi flat, Trash/Sewer charged per tenant</small></span><strong>${money(utilityIncome)}</strong></div><div class="owner-line"><span>Tenant expense charges<small>Cleaning and other expenses assigned to tenants</small></span><strong>${money(tenantExpenseIncome)}</strong></div><div class="owner-line total"><span>Total rent + utilities + expenses</span><strong>${money(income)}</strong></div>`;
  document.querySelector("#owner-tenant-table").innerHTML = tenants.map(item => `<tr><td><strong>${item.full_name}</strong></td><td>${item.unit_name}</td><td>${money(item.rent)}</td><td>${money(item.utilityCharges)}</td><td>${money(item.extraExpenses)}</td><td><strong>${money(item.totalDue)}</strong></td><td><span class="status ${item.paid ? "paid" : ""}">${item.paid ? "Received" : "Pending"}</span></td></tr>`).join("") || "<tr><td colspan='7'>No active tenants for this month.</td></tr>";
}
function renderOverview() {
  const due = state.units.reduce((sum, item) => sum + Number(item.rent), 0);
  const collected = state.units.filter(item => item.paid).reduce((sum, item) => sum + Number(item.rent), 0);
  document.querySelector("#due-total").textContent = money(due);
  document.querySelector("#collected-total").textContent = money(collected);
  document.querySelector("#collection-note").textContent = `${state.units.filter(item => item.paid).length} of ${state.units.length} units recorded`;
  document.querySelector("#open-maintenance").textContent = state.maintenance.filter(item => !item.done).length;
  document.querySelector("#expense-total").textContent = money(currentMonthExpenses());
  document.querySelector("#unit-cards").innerHTML = state.units.map(item => `<article class="unit-card"><p class="eyebrow">${item.name.toUpperCase()}</p><h3>${item.tenant || "Available to assign"}</h3><p>Monthly cash rent</p><div class="unit-card-bottom"><strong>${money(item.rent)}</strong><span class="status ${item.paid ? "paid" : ""}">${item.paid ? "Received" : "Pending"}</span></div></article>`).join("");
  const openItems = state.maintenance.filter(item => !item.done).slice(0, 3);
  document.querySelector("#overview-maintenance").innerHTML = openItems.length ? openItems.map(item => `<div class="list-row"><div><strong>${item.title}</strong><small>${item.unit} · ${item.priority}</small></div><span class="status">Open</span></div>`).join("") : "<div class='list-row'><strong>All caught up.</strong></div>";
  document.querySelector("#overview-utilities").innerHTML = state.utilities.slice(0, 3).map(item => `<div class="list-row"><div><strong>${item.service}</strong><small>Due ${item.due}</small></div><strong>${money(item.amount)}</strong></div>`).join("");
}
function renderMaintenance() { document.querySelector("#maintenance-list").innerHTML = state.maintenance.map(item => `<article class="maintenance-card ${item.priority === "Attention" && !item.done ? "priority" : ""}"><span class="status ${item.done ? "done" : ""}">${item.done ? "Completed" : item.priority}</span><h3>${item.title}</h3><p>${item.detail}</p><div class="card-footer"><span>${item.unit}</span>${isAdmin ? `<button class="small-button" data-maintenance-id="${item.id}">${item.done ? "Reopen" : "Complete"}</button>` : ""}</div></article>`).join(""); }
function renderUtilities() { const month = selectedUtilityMonth(); const isCurrentMonth = month === monthKey; document.querySelector("#utility-list").innerHTML = state.utilities.map(item => { const record = state.utilityHistory.find(entry => entry.month === month && entry.utility_id === item.id); const amount = record ? record.amount : item.amount; const paid = record ? record.paid : isCurrentMonth && item.paid; return `<article class="utility-card"><span class="service">${item.service}</span><strong>${money(amount)}</strong><p>Due ${monthEndDue(month)}</p><div class="card-footer"><span class="status ${paid ? "paid" : ""}">${paid ? "Paid" : "Unpaid"}</span>${isAdmin ? `<span><button class="small-button" data-edit-utility="${item.id}">Edit</button><button class="small-button" data-utility-id="${item.id}">${paid ? "Mark unpaid" : "Mark paid"}</button></span>` : ""}</div></article>`; }).join(""); }
function renderHistory() {
  const select = document.querySelector("#history-month");
  const months = [...new Set([...ledgerMonths(), ...state.rentHistory.map(item => item.month), ...state.utilityHistory.map(item => item.month)])].sort().reverse();
  const selected = months.includes(select.value) ? select.value : monthKey;
  select.innerHTML = months.map(month => `<option value="${month}">${monthLabel(month)}</option>`).join("");
  select.value = selected;
  const rents = state.rentHistory.filter(item => item.month === selected);
  const utilities = state.utilityHistory.filter(item => item.month === selected);
  document.querySelector("#history-rent-table").innerHTML = rents.map(item => `<tr><td>${item.unit_name}</td><td>${money(item.rent)}</td><td>${isAdmin ? `<button class="small-button" data-edit-rent-history="${item.id}">Edit</button>` : ""}</td></tr>`).join("") || "<tr><td colspan='3'>No rent records for this month.</td></tr>";
  document.querySelector("#history-utility-table").innerHTML = utilities.map(item => `<tr><td>${item.service}</td><td>${money(item.amount)}</td><td>${item.due}</td><td><span class="status ${item.paid ? "paid" : ""}">${item.paid ? "Paid" : "Unpaid"}</span></td><td>${isAdmin ? `<button class="small-button" data-edit-utility-history="${item.id}">Edit</button>` : ""}</td></tr>`).join("") || "<tr><td colspan='5'>No utility records for this month.</td></tr>";
}
function renderUnits() {
  const unitDetails = {
    "Unit 1": {
      furnishings: ["Queen sized bed and mattress", "TV 34 inch", "TV stand", "Walk-in closet", "Larger unit"],
      photos: []
    },
    "Unit 2": {
      furnishings: ["65 inch TV", "Full size bed white", "Nice workstation", "Good chair", "Larger closet"],
      photos: []
    }
  };
  document.querySelector("#units-list").innerHTML = state.units.map(item => {
    const details = unitDetails[item.name] || { furnishings: [], photos: [] };
    return `<article class="unit-detail-card">
      <div class="unit-header"><h3>${item.name}</h3><span class="tenant-info">${item.tenant || "Available"}</span></div>
      <div class="unit-furnishings"><p class="eyebrow">Furnishings & Amenities</p><ul>${details.furnishings.map(f => `<li>${f}</li>`).join("")}</ul></div>
      <div class="unit-photos"><p class="eyebrow">Move-in Photos</p><div class="photos-container" id="photos-${item.id}">${details.photos.length ? details.photos.map(p => `<img src="${p.url}" alt="Move-in photo from ${p.date}" title="${p.date}"><span class="photo-date">${p.date}</span>`).join("") : "<p class='no-photos'>No photos uploaded yet.</p>"}</div>${isAdmin ? `<label class="photo-upload"><span class="small-button">+ Upload photo</span><input type="file" id="photo-${item.id}" accept="image/*" style="display:none;" data-unit-id="${item.id}"></label>` : ""}</div>
    </article>`;
  }).join("");
}
function renderExpenses() { const supplies = expensesForMonth(monthKey).filter(item => item.category === "Supplies").reduce((sum, item) => sum + Number(item.amount), 0); document.querySelector("#supplies-total").textContent = money(supplies); document.querySelector("#expense-table").innerHTML = state.expenses.map(item => `<tr><td>${item.date}</td><td><span class="status paid">${item.category}</span></td><td>${item.description}</td><td>${money(item.amount)}</td><td>${isAdmin ? `<button class="small-button" data-delete-expense="${item.id}">Delete</button>` : ""}</td></tr>`).join(""); }
const WIFI_PER_TENANT = 20;
function renderTenants() {
  const select = document.querySelector("#tenant-month");
  const months = ledgerMonths();
  const month = months.includes(select.value) ? select.value : monthKey;
  select.innerHTML = months.map(item => `<option value="${item}">${monthLabel(item)}</option>`).join("");
  select.value = month;
  const isCurrentMonth = month === monthKey;
  const expenseCharges = tenantExpenseCharges(month);
  const billed = service => { const item = state.utilities.find(entry => entry.service === service); if (!item) return null; const record = state.utilityHistory.find(entry => entry.month === month && entry.utility_id === item.id); return Number(record ? record.amount : item.amount); };
  const peco = billed("PECO"); const water = billed("Water"); const trash = billed("Trash"); const sewer = billed("Sewer");
  document.querySelector("#tenant-table").innerHTML = state.tenants.map(item => {
    const record = state.rentHistory.find(entry => entry.month === month && entry.unit_id === item.unit_id);
    const unit = state.units.find(entry => entry.id === item.unit_id);
    const rent = record ? record.rent : item.monthly_rent;
    const paid = record ? record.paid : isCurrentMonth && unit?.paid;
    const received = record ? record.received : isCurrentMonth ? unit?.received : "";
    const pecoShare = peco === null ? 0 : peco / 4;
    const waterShare = water === null ? 0 : water / 4;
    const extraExpenses = expenseCharges.get(item.id)?.total || 0;
    const expenseLines = expenseCharges.get(item.id)?.lines || [];
    const totalDue = Number(rent || 0) + pecoShare + waterShare + Number(trash || 0) + Number(sewer || 0) + WIFI_PER_TENANT + extraExpenses;
    return `<tr>
      <td><strong>${item.unit_name}</strong><br><small class="status ${item.status === "Active" ? "paid" : ""}">${item.status}</small></td>
      <td><strong>${item.full_name}</strong><br><small>${item.email || "-"}</small><br><small>${item.phone || "-"}</small></td>
      <td>${shortMonthLabel(item.lease_start)} \u2013 ${shortMonthLabel(item.lease_end)}</td>
      <td>${money(rent)}</td>
      <td>${peco === null ? "-" : `${money(pecoShare)}<br><small>bill / 4</small>`}</td>
      <td>${water === null ? "-" : `${money(waterShare)}<br><small>bill / 4</small>`}</td>
      <td>${trash === null ? "-" : money(trash)}</td>
      <td>${sewer === null ? "-" : money(sewer)}</td>
      <td>${money(WIFI_PER_TENANT)}<br><small>flat</small></td>
      <td>${money(extraExpenses)}${expenseLines.length ? `<br><small>${expenseLines.map(expense => expense.category).join(", ")}</small>` : ""}</td>
      <td><strong>${money(totalDue)}</strong></td>
      <td><span class="status ${paid ? "paid" : ""}">${paid ? "Received" : "Pending"}</span><br><small>${received || "Cash"}</small></td>
      <td><div class="tenant-actions">${item.lease_url ? `<a class="text-link" href="${item.lease_url}" target="_blank" rel="noreferrer">Lease</a>` : ""}<button class="small-button" data-generate-bill="${item.id}">Generate bill</button>${isAdmin ? `<button class="small-button" data-edit-tenant="${item.id}">Edit</button>${item.email ? `<button class="small-button" data-email-reminder="${item.id}">Send email</button>` : ""}<button class="small-button" data-rent-id="${item.unit_id}">${paid ? "Undo cash" : "Record cash"}</button>` : ""}</div></td>
    </tr>`;
  }).join("") || "<tr><td colspan='13'>No tenants have been added yet.</td></tr>";
}
function syncTenantRentWithUnit(tenant) {
  if (!tenant || !tenant.unit_id) return;
  const rent = Number(tenant.monthly_rent || 0);
  state.units = state.units.map(unit => unit.id === tenant.unit_id ? { ...unit, tenant: tenant.full_name || unit.tenant, rent } : unit);
  state.rentHistory = state.rentHistory.map(record => record.unit_id === tenant.unit_id && record.month === monthKey ? { ...record, rent } : record);
}
function syncTenantRentsToUnits() {
  state.units = state.units.map(unit => {
    const tenant = state.tenants.find(item => item.unit_id === unit.id);
    if (!tenant) return unit;
    return { ...unit, tenant: tenant.full_name || unit.tenant, rent: Number(tenant.monthly_rent || unit.rent) };
  });
}
function renderAll() {
  document.querySelector("#utility-month").value ||= monthKey.slice(0, 7);
  renderOwnerDashboard(); renderOverview(); renderMaintenance(); renderUtilities(); renderUnits(); renderExpenses(); renderHistory(); renderTenants();
  document.querySelectorAll("[data-open-modal]").forEach(button => button.hidden = !isAdmin);
  document.querySelectorAll(".read-only-note").forEach(note => note.remove());
  if (!isAdmin) document.querySelectorAll(".view").forEach(view => view.insertAdjacentHTML("afterbegin", "<p class='read-only-note'>View-only access. Contact the property administrator to update records.</p>"));
}
async function loadData() {
  const [units, maintenance, utilities, expenses, tenants, mortgageSchedule] = await Promise.all([
    supabase.from("units").select("*").order("name"),
    supabase.from("maintenance").select("*").order("created_at", { ascending: false }),
    supabase.from("utilities").select("*").order("service"),
    supabase.from("expenses").select("*").order("date", { ascending: false }),
    supabase.from("tenants").select("*").order("unit_name"),
    supabase.from("mortgage_schedule").select("*").order("effective_month", { ascending: false })
  ]);
  const error = [units, maintenance, utilities, expenses].find(result => result.error)?.error;
  if (error) throw error;
  const [rentHistory, utilityHistory] = await Promise.all([supabase.from("rent_history").select("*").order("month", { ascending: false }), supabase.from("utility_history").select("*").order("month", { ascending: false })]);
  const hydratedMortgageSchedule = await Promise.all((mortgageSchedule.error ? [] : mortgageSchedule.data).map(async item => ({ ...item, bill_url:await signedBillUrl(item.bill_document) })));
  const hydratedUtilityHistory = await Promise.all((utilityHistory.error ? [] : utilityHistory.data).map(async item => ({ ...item, bill_url:await signedBillUrl(item.bill_document) })));
  const hydratedExpenses = await Promise.all((expenses.error ? [] : expenses.data).map(async item => ({ ...item, allocation:item.allocation || "owner", tenant_ids:item.tenant_ids || [], bill_url:await signedBillUrl(item.bill_document) })));
  const hydratedTenants = await Promise.all((tenants.error ? [] : tenants.data).map(async tenant => {
    if (!tenant.lease_document || tenant.lease_document.startsWith("/")) return { ...tenant, lease_url: tenant.lease_document };
    const { data } = await supabase.storage.from("leases").createSignedUrl(tenant.lease_document, 3600);
    return { ...tenant, lease_url: data?.signedUrl || null };
  }));
  state = { units: units.data, maintenance: maintenance.data, utilities: utilities.data, expenses: hydratedExpenses, rentHistory: rentHistory.error ? [] : rentHistory.data, utilityHistory: hydratedUtilityHistory, tenants: hydratedTenants, mortgageSchedule: hydratedMortgageSchedule };
  syncTenantRentsToUnits();
  renderAll();
}
function setAuthMessage(message, error = false) { const element = document.querySelector("#auth-message"); element.textContent = message; element.style.color = error ? "#a63b2d" : ""; }
async function setSession(nextSession) {
  session = nextSession;
  if (!session) { document.body.classList.remove("authenticated"); document.querySelector("#auth-screen").hidden = false; return; }
  const { data, error } = await supabase.from("profiles").select("role").eq("id", session.user.id).single();
  if (error) throw error;
  isAdmin = data.role === "admin";
  document.body.classList.add("authenticated");
  document.querySelector("#auth-screen").hidden = true;
  document.querySelector("#account-label").textContent = `${session.user.email} · ${isAdmin ? "Admin" : "View only"}`;
  await loadData();
}
function strongPassword(password) { return password.length >= 12 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password); }
function setAuthMode(mode) {
  authMode = mode;
  const creating = mode === "signup";
  document.querySelector("#auth-title").textContent = creating ? "Create access" : "Property access";
  document.querySelector("#auth-submit").textContent = creating ? "Create account" : "Sign in";
  document.querySelector("#auth-mode-button").textContent = creating ? "I already have an account" : "Create a user account";
  document.querySelector("#auth-password").autocomplete = creating ? "new-password" : "current-password";
  setAuthMessage(creating ? "Use the owner email only to create the administrator account. Other accounts are view-only." : "Sign in to open the property ledger.");
}
const modal = document.querySelector("#entry-modal");
function openModal(type) {
  const forms = {
    rentHistory: { title: "Correct rent history", fields: `<div class="form-grid"><label>Monthly rent<input name="rent" type="number" min="0" step="0.01" required></label></div>` },
    utilityEdit: { title: "Edit utility bill", fields: `<div class="form-grid"><label>Amount<input name="amount" type="number" min="0" step="0.01" required></label><label class="full">Bill PDF or text file<input name="bill_file" type="file" accept="application/pdf,text/plain,.txt,.csv,image/*"></label><p class="form-message full" data-parse-status>Upload a bill to try filling the amount from the document. You can edit the amount before saving.</p></div>` },
    utilityHistory: { title: "Correct utility history", fields: `<div class="form-grid"><label>Amount<input name="amount" type="number" min="0" step="0.01" required></label><label class="full">Bill PDF or text file<input name="bill_file" type="file" accept="application/pdf,text/plain,.txt,.csv,image/*"></label><p class="form-message full" data-parse-status>Upload a bill to try filling the amount from the document. You can edit the amount before saving.</p></div>` },
    mortgage: { title: `Set mortgage from ${monthLabel(selectedOwnerMonth())} forward`, fields: `<div class="form-grid"><label>Monthly mortgage<input name="amount" type="number" min="0" step="0.01" value="${mortgageForMonth(selectedOwnerMonth())}" required></label><label class="full">Mortgage bill PDF or text file<input name="bill_file" type="file" accept="application/pdf,text/plain,.txt,.csv,image/*"></label><p class="form-message full" data-parse-status>This amount carries forward until you set a newer month. Upload can prefill the amount, and manual edits win.</p></div>` },
    tenant: { title: "Tenant and lease", fields: `<div class="form-grid"><label>Unit<select name="unit_id" required>${state.units.map(item => `<option value="${item.id}">${item.name}</option>`).join("")}</select></label><label>Tenant name<input name="full_name" required></label><label>Email<input name="email" type="email"></label><label>Phone<input name="phone" type="tel"></label><label>Lease start<input name="lease_start" type="date" required></label><label>Lease end<input name="lease_end" type="date" required></label><label>Rent for ${monthLabel(selectedTenantMonth())}<input name="monthly_rent" type="number" min="0" step="0.01" required></label><label>Status<select name="status"><option>Active</option><option>Upcoming</option><option>Ended</option></select></label><label class="full">Lease PDF<input name="lease_file" type="file" accept="application/pdf"></label></div>` },
    maintenance: { title: "New maintenance request", fields: `<div class="form-grid"><label>Title<input name="title" required placeholder="e.g. Replace hallway bulb"></label><label>Unit<select name="unit"><option>Unit 1</option><option>Unit 2</option><option>Both units</option></select></label><label>Priority<select name="priority"><option>Routine</option><option>Attention</option></select></label><label class="full">Details<textarea name="detail" required placeholder="Describe the work needed"></textarea></label></div>` },
    utility: { title: "Add utility bill", fields: `<div class="form-grid"><label>Service<select name="service"><option>PECO</option><option>WiFi</option><option>Trash</option><option>Sewer</option><option>Water</option></select></label><label>Amount<input name="amount" type="number" min="0" step="0.01" required></label><label class="full">Bill PDF or text file<input name="bill_file" type="file" accept="application/pdf,text/plain,.txt,.csv,image/*"></label><p class="form-message full" data-parse-status>Upload a bill to try filling the amount from the document. You can edit the amount before saving.</p></div>` },
    expense: { title: "Add expense", fields: `<div class="form-grid"><label>Date<input name="date" type="date" value="${new Date().toISOString().slice(0, 10)}" required></label><label>Category<select name="category"><option>Cleaning</option><option>Supplies</option><option>Repairs</option><option>Maintenance</option><option>Other</option></select></label><label>Amount<input name="amount" type="number" min="0" step="0.01" required></label><label>Who pays?<select name="allocation"><option value="owner">Owner only</option><option value="all_tenants">All tenants</option><option value="selected_tenants">Selected tenants</option></select></label><div class="tenant-picker full" data-tenant-picker hidden><p class="eyebrow">TENANTS</p>${state.tenants.filter(item => item.status !== "Ended").map(item => `<label><input name="tenant_ids" type="checkbox" value="${item.id}">${item.full_name} (${item.unit_name})</label>`).join("") || "<p class='form-message'>No active tenants available.</p>"}</div><label class="full">Receipt or bill<input name="bill_file" type="file" accept="application/pdf,text/plain,.txt,.csv,image/*"></label><p class="form-message full" data-parse-status>Upload can prefill the amount, and manual edits win.</p><label class="full">Description<input name="description" required placeholder="e.g. Cleaning after move-out"></label></div>` }
  };
  document.querySelector("#modal-title").textContent = forms[type].title;
  document.querySelector("#modal-eyebrow").textContent = type.toUpperCase();
  document.querySelector("#form-fields").innerHTML = forms[type].fields;
  document.querySelector("#entry-form").dataset.type = type;
  delete document.querySelector("#entry-form").dataset.id;
  delete document.querySelector("#entry-form").dataset.leaseDocument;
  modal.showModal();
}
document.querySelector("#entry-form").addEventListener("change", async event => {
  const allocation = event.target.closest("[name=allocation]");
  if (allocation) {
    const picker = document.querySelector("[data-tenant-picker]");
    if (picker) picker.hidden = allocation.value !== "selected_tenants";
  }
  const input = event.target.closest("[name=bill_file]");
  if (!input?.files?.length) return;
  const form = document.querySelector("#entry-form");
  const status = form.querySelector("[data-parse-status]");
  const amount = form.querySelector("[name=amount]");
  status.textContent = "Reading bill...";
  try {
    const parsed = await parseBillFile(input.files[0]);
    if (parsed === null) { status.textContent = "Stored on save. I could not read an amount from this file, so keep the manual amount."; return; }
    amount.value = parsed.toFixed(2);
    status.textContent = `Found ${money(parsed)}. Review or edit the amount before saving.`;
  } catch (error) { status.textContent = `Stored on save. Parser could not read this file: ${error.message}`; }
});
document.querySelector("#auth-form").addEventListener("submit", async event => {
  event.preventDefault();
  const email = document.querySelector("#auth-email").value.trim().toLowerCase();
  const password = document.querySelector("#auth-password").value;
  try {
    if (authMode === "signup") {
      if (!strongPassword(password)) throw new Error("Choose a stronger password: 12+ characters with uppercase, lowercase, number, and symbol.");
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      setAuthMessage("Account created. Confirm the email we sent, then sign in.");
      setAuthMode("signin");
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await setSession(data.session);
    }
  } catch (error) { setAuthMessage(error.message, true); }
});
document.addEventListener("click", async event => {
  const viewLink = event.target.closest("[data-view]");
  if (viewLink) { event.preventDefault(); const target = viewLink.dataset.view; document.querySelectorAll(".view").forEach(view => view.classList.toggle("active", view.id === target)); document.querySelectorAll(".nav-link").forEach(link => link.classList.toggle("active", link.dataset.view === target)); document.querySelector("#page-title").textContent = target === "owner" ? "Owner dashboard" : target === "overview" ? "Property overview" : target.charAt(0).toUpperCase() + target.slice(1); window.scrollTo({ top: 0, behavior: "smooth" }); }
  if (event.target.closest("#auth-mode-button")) setAuthMode(authMode === "signin" ? "signup" : "signin");
  if (event.target.closest("#sign-out-button")) await supabase.auth.signOut();
  const generateBill = event.target.closest("[data-generate-bill]"); if (generateBill) generateTenantBill(generateBill.dataset.generateBill);
  if (!isAdmin) return;
  const modalButton = event.target.closest("[data-open-modal]"); if (modalButton) openModal(modalButton.dataset.openModal);
  const editUtility = event.target.closest("[data-edit-utility]"); if (editUtility) { const item = state.utilities.find(entry => entry.id === editUtility.dataset.editUtility); const record = state.utilityHistory.find(entry => entry.month === selectedUtilityMonth() && entry.utility_id === item.id); openModal("utilityEdit"); document.querySelector("[name=amount]").value = record ? record.amount : item.amount; document.querySelector("#entry-form").dataset.id = item.id; }
  const editRentHistory = event.target.closest("[data-edit-rent-history]"); if (editRentHistory) { const item = state.rentHistory.find(entry => entry.id === editRentHistory.dataset.editRentHistory); openModal("rentHistory"); document.querySelector("[name=rent]").value = item.rent; document.querySelector("#entry-form").dataset.id = item.id; }
  const editUtilityHistory = event.target.closest("[data-edit-utility-history]"); if (editUtilityHistory) { const item = state.utilityHistory.find(entry => entry.id === editUtilityHistory.dataset.editUtilityHistory); openModal("utilityHistory"); document.querySelector("[name=amount]").value = item.amount; document.querySelector("#entry-form").dataset.id = item.id; }
  const editTenant = event.target.closest("[data-edit-tenant]"); if (editTenant) { const item = state.tenants.find(entry => entry.id === editTenant.dataset.editTenant); openModal("tenant"); Object.entries(item).forEach(([key, value]) => { const input = document.querySelector(`[name=${key}]`); if (input) input.value = value || ""; }); const monthRent = state.rentHistory.find(entry => entry.month === selectedTenantMonth() && entry.unit_id === item.unit_id); if (monthRent) document.querySelector("[name=monthly_rent]").value = monthRent.rent; document.querySelector("#entry-form").dataset.id = item.id; document.querySelector("#entry-form").dataset.leaseDocument = item.lease_document || ""; }
  const emailReminder = event.target.closest("[data-email-reminder]"); if (emailReminder) { const tenant = state.tenants.find(item => item.id === emailReminder.dataset.emailReminder); const status = document.querySelector("#reminder-status"); status.textContent = "Sending email reminder..."; try { const response = await fetch("/api/send-reminder", { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ tenantId:tenant.id, accessToken:session.access_token }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Unable to send reminder."); status.textContent = `Email reminder sent to ${tenant.email}.`; } catch (error) { status.textContent = error.message; } }
  const rentButton = event.target.closest("[data-rent-id]"); if (rentButton) { const item = state.units.find(entry => entry.id === rentButton.dataset.rentId); const month = selectedTenantMonth(); const existing = state.rentHistory.find(entry => entry.month === month && entry.unit_id === item.id); const paid = !(existing ? existing.paid : month === monthKey && item.paid); const received = paid ? new Intl.DateTimeFormat("en-US", { month:"short", day:"numeric", year:"numeric" }).format(new Date()) : ""; const { error } = await supabase.from("rent_history").upsert({ month, unit_id:item.id, unit_name:item.name, rent:existing ? existing.rent : item.rent, paid, received }, { onConflict:"month,unit_id" }); if (error) alert(error.message); else { if (month === monthKey) await supabase.from("units").update({ paid, received }).eq("id", item.id); await loadData(); } }
  const maintenanceButton = event.target.closest("[data-maintenance-id]"); if (maintenanceButton) { const item = state.maintenance.find(entry => entry.id === maintenanceButton.dataset.maintenanceId); const { error } = await supabase.from("maintenance").update({ done: !item.done }).eq("id", item.id); if (error) alert(error.message); else await loadData(); }
  const utilityButton = event.target.closest("[data-utility-id]"); if (utilityButton) { const item = state.utilities.find(entry => entry.id === utilityButton.dataset.utilityId); const month = selectedUtilityMonth(); const existing = state.utilityHistory.find(entry => entry.month === month && entry.utility_id === item.id); const paid = !(existing ? existing.paid : month === monthKey && item.paid); const due = monthEndDue(month); const { error } = await supabase.from("utility_history").upsert({ month, utility_id:item.id, service:item.service, amount:existing ? existing.amount : item.amount, due, paid }, { onConflict:"month,utility_id" }); if (error) alert(error.message); else { if (month === monthKey) await supabase.from("utilities").update({ paid, due }).eq("id", item.id); await loadData(); } }
  const deleteButton = event.target.closest("[data-delete-expense]"); if (deleteButton) { const { error } = await supabase.from("expenses").delete().eq("id", deleteButton.dataset.deleteExpense); if (error) alert(error.message); else await loadData(); }
  if (event.target.closest("#export-button")) { const data = new Blob([JSON.stringify(state, null, 2)], { type:"application/json" }); const link = document.createElement("a"); link.href = URL.createObjectURL(data); link.download = "1179-bush-st-ledger.json"; link.click(); URL.revokeObjectURL(link.href); }
});
document.querySelector("#history-month").addEventListener("change", renderHistory);
document.querySelector("#tenant-month").addEventListener("change", renderTenants);
document.querySelector("#utility-month").addEventListener("change", renderUtilities);
document.querySelector("#owner-month").addEventListener("change", renderOwnerDashboard);
document.querySelectorAll("[data-close-modal]").forEach(button => button.addEventListener("click", () => modal.close()));
document.querySelector("#entry-form").addEventListener("submit", async event => {
  const form = event.target; event.preventDefault();
  const data = new FormData(form); const type = form.dataset.type;
  if (type === "tenant") {
    const unit = state.units.find(item => item.id === data.get("unit_id"));
    const leaseFile = data.get("lease_file"); let leaseDocument = form.dataset.leaseDocument || null;
    if (leaseFile instanceof File && leaseFile.size) {
      if (leaseFile.type !== "application/pdf") { alert("Upload a PDF lease document."); return; }
      const filename = leaseFile.name.replace(/[^a-zA-Z0-9._-]/g, "-"); const path = `${unit.id}/${Date.now()}-${filename}`;
      const { error: uploadError } = await supabase.storage.from("leases").upload(path, leaseFile, { contentType:"application/pdf", upsert:false });
      if (uploadError) { alert(uploadError.message); return; }
      leaseDocument = path;
    }
    const record = { unit_id:data.get("unit_id"), unit_name:unit.name, full_name:data.get("full_name"), email:data.get("email") || null, phone:data.get("phone") || null, lease_start:data.get("lease_start"), lease_end:data.get("lease_end"), monthly_rent:Number(data.get("monthly_rent")), status:data.get("status"), lease_document:leaseDocument };
    const month = selectedTenantMonth();
    // Editing a past month should not overwrite the tenant's current rent.
    const tenantWrite = month === monthKey ? record : { ...record, monthly_rent: state.tenants.find(item => item.id === form.dataset.id)?.monthly_rent ?? record.monthly_rent };
    const query = form.dataset.id ? supabase.from("tenants").update(tenantWrite).eq("id", form.dataset.id) : supabase.from("tenants").insert(tenantWrite);
    const { error } = await query; if (error) { alert(error.message); return; }
    syncTenantRentWithUnit(tenantWrite);
    const existingRent = state.rentHistory.find(entry => entry.month === month && entry.unit_id === record.unit_id);
    await supabase.from("rent_history").upsert({ month, unit_id:record.unit_id, unit_name:unit.name, rent:Number(record.monthly_rent), paid:existingRent?.paid || false, received:existingRent?.received || "" }, { onConflict:"month,unit_id" });
    if (month === monthKey) await supabase.from("units").update({ tenant: record.full_name, rent: Number(record.monthly_rent) }).eq("id", record.unit_id);
    else await supabase.from("units").update({ tenant: record.full_name }).eq("id", record.unit_id);
    modal.close(); await loadData(); return;
  }
  if (type === "utilityEdit") {
    const id = form.dataset.id; const month = selectedUtilityMonth(); const utility = state.utilities.find(item => item.id === id); const existing = state.utilityHistory.find(entry => entry.month === month && entry.utility_id === id); const updates = { amount:Number(data.get("amount")) }; const due = monthEndDue(month);
    let billDocument = existing?.bill_document || null;
    try { billDocument = await uploadBillFile(data.get("bill_file"), `utilities/${utility.service}/${month}`) || billDocument; } catch (error) { alert(error.message); return; }
    const { error } = await supabase.from("utility_history").upsert({ month, utility_id:id, service:utility.service, amount:updates.amount, due, paid:existing?.paid || false, bill_document:billDocument }, { onConflict:"month,utility_id" });
    if (error) { alert(error.message); return; }
    if (month === monthKey) await supabase.from("utilities").update({ ...updates, due }).eq("id", id);
    modal.close(); await loadData(); return;
  }
  if (type === "rentHistory") {
    const record = state.rentHistory.find(item => item.id === form.dataset.id);
    const rent = Number(data.get("rent"));
    const { error } = await supabase.from("rent_history").update({ rent }).eq("id", form.dataset.id);
    if (error) { alert(error.message); return; }
    if (record?.month === monthKey) await supabase.from("units").update({ rent }).eq("id", record.unit_id);
    modal.close(); await loadData(); return;
  }
  if (type === "utilityHistory") {
    const id = form.dataset.id;
    const historicalUtility = state.utilityHistory.find(item => item.id === id);
    let billDocument = historicalUtility.bill_document || null;
    try { billDocument = await uploadBillFile(data.get("bill_file"), `utilities/${historicalUtility.service}/${historicalUtility.month}`) || billDocument; } catch (error) { alert(error.message); return; }
    const { error } = await supabase.from("utility_history").update({ amount: Number(data.get("amount")), due: monthEndDue(historicalUtility.month), bill_document:billDocument }).eq("id", id);
    if (error) { alert(error.message); return; }
    modal.close(); await loadData(); return;
  }
  if (type === "mortgage") {
    const month = selectedOwnerMonth();
    const existing = state.mortgageSchedule.find(item => item.effective_month === month);
    let billDocument = existing?.bill_document || null;
    try { billDocument = await uploadBillFile(data.get("bill_file"), `mortgage/${month}`) || billDocument; } catch (error) { alert(error.message); return; }
    const record = { effective_month:month, amount:Number(data.get("amount")), bill_document:billDocument };
    const { error } = await supabase.from("mortgage_schedule").upsert(record, { onConflict:"effective_month" });
    if (error) { alert(error.message); return; }
    modal.close(); await loadData(); return;
  }
  if (type === "utility") {
    let billDocument = null;
    try { billDocument = await uploadBillFile(data.get("bill_file"), `utilities/${data.get("service")}/${monthKey}`); } catch (error) { alert(error.message); return; }
    const { data:utility, error } = await supabase.from("utilities").insert({ service:data.get("service"), amount:Number(data.get("amount")), due:monthEndDue(monthKey), paid:false }).select().single();
    if (error) { alert(error.message); return; }
    const { error: historyError } = await supabase.from("utility_history").upsert({ month:monthKey, utility_id:utility.id, service:utility.service, amount:utility.amount, due:utility.due, paid:false, bill_document:billDocument }, { onConflict:"month,utility_id" });
    if (historyError) { alert(historyError.message); return; }
    modal.close(); await loadData(); return;
  }
  if (type === "expense") {
    const allocation = data.get("allocation") || "owner";
    const tenantIds = allocation === "selected_tenants" ? data.getAll("tenant_ids") : [];
    if (allocation === "selected_tenants" && !tenantIds.length) { alert("Choose at least one tenant or switch Who pays to Owner only."); return; }
    let billDocument = null;
    try { billDocument = await uploadBillFile(data.get("bill_file"), `expenses/${data.get("category")}/${data.get("date")}`); } catch (error) { alert(error.message); return; }
    const record = { date:data.get("date"), category:data.get("category"), description:data.get("description"), amount:Number(data.get("amount")), allocation, tenant_ids:tenantIds, bill_document:billDocument };
    const { error } = await supabase.from("expenses").insert(record);
    if (error) alert(error.message); else { modal.close(); await loadData(); }
    return;
  }
  const table = { maintenance: "maintenance", utility: "utilities", expense: "expenses" }[type];
  const record = type === "maintenance" ? { title:data.get("title"), unit:data.get("unit"), priority:data.get("priority"), detail:data.get("detail") } : type === "utility" ? { service:data.get("service"), amount:Number(data.get("amount")), due:monthEndDue(monthKey), paid:false } : { date:data.get("date"), category:"Supplies", description:data.get("description"), amount:Number(data.get("amount")) };
  const { error } = await supabase.from(table).insert(record); if (error) alert(error.message); else { modal.close(); await loadData(); }
});
document.querySelector("#today").textContent = monthName.toUpperCase();
try {
  supabase = await getClient();
  const { data } = await supabase.auth.getSession();
  await setSession(data.session);
  supabase.auth.onAuthStateChange((_event, nextSession) => { if (!nextSession) setSession(null); });
} catch (error) { setAuthMessage(`${error.message} Ask the administrator to finish database setup.`, true); }
