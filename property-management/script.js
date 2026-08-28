import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const monthName = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date());
const monthKey = `${new Date().toISOString().slice(0, 7)}-01`;
const money = value => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(value || 0));
let supabase;
let session;
let isAdmin = false;
let authMode = "signin";
let state = { units: [], maintenance: [], utilities: [], expenses: [], rentHistory: [], utilityHistory: [], tenants: [] };

async function getClient() {
  const response = await fetch("/api/config");
  if (!response.ok) throw new Error("The secure database configuration is not available yet.");
  const config = await response.json();
  return createClient(config.url, config.anonKey, { auth: { storage: sessionStorage, persistSession: true, autoRefreshToken: true } });
}
function currentMonthExpenses() { return state.expenses.reduce((sum, item) => sum + Number(item.amount), 0) + state.utilities.reduce((sum, item) => sum + Number(item.amount), 0); }
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
function selectedTenantMonth() { return document.querySelector("#tenant-month").value || monthKey; }
function selectedUtilityMonth() { return `${document.querySelector("#utility-month").value || monthKey.slice(0, 7)}-01`; }
function monthEndDue(month) { return new Intl.DateTimeFormat("en-US", { month:"short", day:"numeric", timeZone:"UTC" }).format(new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0))); }
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
function renderExpenses() { const supplies = state.expenses.filter(item => item.category === "Supplies").reduce((sum, item) => sum + Number(item.amount), 0); document.querySelector("#supplies-total").textContent = money(supplies); document.querySelector("#expense-table").innerHTML = state.expenses.map(item => `<tr><td>${item.date}</td><td><span class="status paid">${item.category}</span></td><td>${item.description}</td><td>${money(item.amount)}</td><td>${isAdmin ? `<button class="small-button" data-delete-expense="${item.id}">Delete</button>` : ""}</td></tr>`).join(""); }
function tenantReminder(tenant) { const pending = state.utilities.filter(item => !item.paid).map(item => `${item.service} ${money(item.amount)}`).join(", "); return `1179 Bush St reminder: your monthly rent is ${money(tenant.monthly_rent)}. Pending property utilities: ${pending || "none"}.`; }
const EXTRA_LEASE_TERMS = { asif: [{ start: "2025-09-01", end: "2026-09-30" }] };
function leaseTermsFor(tenant) {
  const terms = [];
  const add = (start, end) => { if (start && end && !terms.some(term => term.start === start && term.end === end)) terms.push({ start, end }); };
  add(tenant.lease_start, tenant.lease_end);
  const extras = Object.entries(EXTRA_LEASE_TERMS).find(([name]) => (tenant.full_name || "").toLowerCase().includes(name))?.[1] || [];
  extras.forEach(term => add(term.start, term.end));
  return terms.sort((a, b) => b.start.localeCompare(a.start));
}
function renderTenants() {
  const select = document.querySelector("#tenant-month");
  const months = ledgerMonths();
  const month = months.includes(select.value) ? select.value : monthKey;
  select.innerHTML = months.map(item => `<option value="${item}">${monthLabel(item)}</option>`).join("");
  select.value = month;
  const isCurrentMonth = month === monthKey;
  const billed = service => { const item = state.utilities.find(entry => entry.service === service); if (!item) return null; const record = state.utilityHistory.find(entry => entry.month === month && entry.utility_id === item.id); return Number(record ? record.amount : item.amount); };
  const peco = billed("PECO"); const water = billed("Water"); const trash = billed("Trash"); const sewer = billed("Sewer");
  document.querySelector("#tenant-table").innerHTML = state.tenants.map(item => {
    const record = state.rentHistory.find(entry => entry.month === month && entry.unit_id === item.unit_id);
    const unit = state.units.find(entry => entry.id === item.unit_id);
    const rent = record ? record.rent : item.monthly_rent;
    const paid = record ? record.paid : isCurrentMonth && unit?.paid;
    const received = record ? record.received : isCurrentMonth ? unit?.received : "";
    const terms = leaseTermsFor(item);
    const activeTerm = `${item.lease_start}|${item.lease_end}`;
    const leaseCell = isAdmin
      ? `<select class="inline-select" data-lease-tenant="${item.id}">${terms.map(term => `<option value="${term.start}|${term.end}"${`${term.start}|${term.end}` === activeTerm ? " selected" : ""}>${shortMonthLabel(term.start)} \u2013 ${shortMonthLabel(term.end)}</option>`).join("")}</select>`
      : `${shortMonthLabel(item.lease_start)} \u2013 ${shortMonthLabel(item.lease_end)}`;
    return `<tr>
      <td><strong>${item.unit_name}</strong><br><small class="status ${item.status === "Active" ? "paid" : ""}">${item.status}</small></td>
      <td><strong>${item.full_name}</strong><br><small>${item.email || "-"}</small><br><small>${item.phone || "-"}</small></td>
      <td>${leaseCell}</td>
      <td>${money(rent)}${isAdmin ? `<br><button class="small-button" data-edit-rent="${item.id}">Edit</button>` : ""}</td>
      <td><span class="status ${paid ? "paid" : ""}">${paid ? "Received" : "Pending"}</span><br><small>${received || "Cash"}</small>${isAdmin ? `<br><button class="small-button" data-rent-id="${item.unit_id}">${paid ? "Undo" : "Record cash"}</button>` : ""}</td>
      <td>${peco === null ? "-" : `${money(peco / 4)}<br><small>bill / 4</small>`}</td>
      <td>${water === null ? "-" : `${money(water / 4)}<br><small>bill / 4</small>`}</td>
      <td>${trash === null ? "-" : money(trash)}</td>
      <td>${sewer === null ? "-" : money(sewer)}</td>
      <td><div class="tenant-actions">${item.lease_url ? `<a class="text-link" href="${item.lease_url}" target="_blank" rel="noreferrer">Lease</a>` : ""}${isAdmin ? `<button class="small-button" data-edit-tenant="${item.id}">Details</button>${item.phone ? `<button class="small-button" data-copy-reminder="${item.id}">Copy reminder</button>` : ""}${item.email ? `<button class="small-button" data-email-reminder="${item.id}">Send email</button>` : ""}` : ""}</div></td>
    </tr>`;
  }).join("") || "<tr><td colspan='10'>No tenants have been added yet.</td></tr>";
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
  renderOverview(); renderMaintenance(); renderUtilities(); renderUnits(); renderExpenses(); renderHistory(); renderTenants();
  document.querySelectorAll("[data-open-modal]").forEach(button => button.hidden = !isAdmin);
  document.querySelectorAll(".read-only-note").forEach(note => note.remove());
  if (!isAdmin) document.querySelectorAll(".view").forEach(view => view.insertAdjacentHTML("afterbegin", "<p class='read-only-note'>View-only access. Contact the property administrator to update records.</p>"));
}
async function loadData() {
  const [units, maintenance, utilities, expenses, tenants] = await Promise.all([
    supabase.from("units").select("*").order("name"),
    supabase.from("maintenance").select("*").order("created_at", { ascending: false }),
    supabase.from("utilities").select("*").order("service"),
    supabase.from("expenses").select("*").order("date", { ascending: false }),
    supabase.from("tenants").select("*").order("unit_name")
  ]);
  const error = [units, maintenance, utilities, expenses].find(result => result.error)?.error;
  if (error) throw error;
  const [rentHistory, utilityHistory] = await Promise.all([supabase.from("rent_history").select("*").order("month", { ascending: false }), supabase.from("utility_history").select("*").order("month", { ascending: false })]);
  const hydratedTenants = await Promise.all((tenants.error ? [] : tenants.data).map(async tenant => {
    if (!tenant.lease_document || tenant.lease_document.startsWith("/")) return { ...tenant, lease_url: tenant.lease_document };
    const { data } = await supabase.storage.from("leases").createSignedUrl(tenant.lease_document, 3600);
    return { ...tenant, lease_url: data?.signedUrl || null };
  }));
  state = { units: units.data, maintenance: maintenance.data, utilities: utilities.data, expenses: expenses.data, rentHistory: rentHistory.error ? [] : rentHistory.data, utilityHistory: utilityHistory.error ? [] : utilityHistory.data, tenants: hydratedTenants };
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
    rent: { title: "Edit monthly rent", fields: `<div class="form-grid"><label>Monthly rent<input name="rent" type="number" min="0" step="0.01" required></label></div>` },
    rentHistory: { title: "Correct rent history", fields: `<div class="form-grid"><label>Monthly rent<input name="rent" type="number" min="0" step="0.01" required></label></div>` },
    utilityEdit: { title: "Edit utility bill", fields: `<div class="form-grid"><label>Amount<input name="amount" type="number" min="0" step="0.01" required></label></div>` },
    utilityHistory: { title: "Correct utility history", fields: `<div class="form-grid"><label>Amount<input name="amount" type="number" min="0" step="0.01" required></label></div>` },
    tenant: { title: "Tenant and lease", fields: `<div class="form-grid"><label>Unit<select name="unit_id" required>${state.units.map(item => `<option value="${item.id}">${item.name}</option>`).join("")}</select></label><label>Tenant name<input name="full_name" required></label><label>Email<input name="email" type="email"></label><label>Phone<input name="phone" type="tel"></label><label>Lease start<input name="lease_start" type="date" required></label><label>Lease end<input name="lease_end" type="date" required></label><label>Monthly lease<input name="monthly_rent" type="number" min="0" step="0.01" required></label><label>Status<select name="status"><option>Active</option><option>Upcoming</option><option>Ended</option></select></label><label class="full">Lease PDF<input name="lease_file" type="file" accept="application/pdf"></label></div>` },
    maintenance: { title: "New maintenance request", fields: `<div class="form-grid"><label>Title<input name="title" required placeholder="e.g. Replace hallway bulb"></label><label>Unit<select name="unit"><option>Unit 1</option><option>Unit 2</option><option>Both units</option></select></label><label>Priority<select name="priority"><option>Routine</option><option>Attention</option></select></label><label class="full">Details<textarea name="detail" required placeholder="Describe the work needed"></textarea></label></div>` },
    utility: { title: "Add utility bill", fields: `<div class="form-grid"><label>Service<select name="service"><option>PECO</option><option>WiFi</option><option>Trash</option><option>Sewer</option><option>Water</option></select></label><label>Amount<input name="amount" type="number" min="0" step="0.01" required></label></div>` },
    expense: { title: "Add supply expense", fields: `<div class="form-grid"><label>Date<input name="date" type="date" value="${new Date().toISOString().slice(0, 10)}" required></label><label>Amount<input name="amount" type="number" min="0" step="0.01" required></label><label class="full">Description<input name="description" required placeholder="e.g. Paint and drop cloths"></label></div>` }
  };
  document.querySelector("#modal-title").textContent = forms[type].title;
  document.querySelector("#modal-eyebrow").textContent = type.toUpperCase();
  document.querySelector("#form-fields").innerHTML = forms[type].fields;
  document.querySelector("#entry-form").dataset.type = type;
  delete document.querySelector("#entry-form").dataset.id;
  delete document.querySelector("#entry-form").dataset.leaseDocument;
  modal.showModal();
}
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
  if (viewLink) { event.preventDefault(); const target = viewLink.dataset.view; document.querySelectorAll(".view").forEach(view => view.classList.toggle("active", view.id === target)); document.querySelectorAll(".nav-link").forEach(link => link.classList.toggle("active", link.dataset.view === target)); document.querySelector("#page-title").textContent = target === "overview" ? "Property overview" : target.charAt(0).toUpperCase() + target.slice(1); window.scrollTo({ top: 0, behavior: "smooth" }); }
  if (event.target.closest("#auth-mode-button")) setAuthMode(authMode === "signin" ? "signup" : "signin");
  if (event.target.closest("#sign-out-button")) await supabase.auth.signOut();
  if (!isAdmin) return;
  const modalButton = event.target.closest("[data-open-modal]"); if (modalButton) openModal(modalButton.dataset.openModal);
  const editUtility = event.target.closest("[data-edit-utility]"); if (editUtility) { const item = state.utilities.find(entry => entry.id === editUtility.dataset.editUtility); const record = state.utilityHistory.find(entry => entry.month === selectedUtilityMonth() && entry.utility_id === item.id); openModal("utilityEdit"); document.querySelector("[name=amount]").value = record ? record.amount : item.amount; document.querySelector("#entry-form").dataset.id = item.id; }
  const editRent = event.target.closest("[data-edit-rent]"); if (editRent) { const tenant = state.tenants.find(entry => entry.id === editRent.dataset.editRent); const record = state.rentHistory.find(entry => entry.month === selectedTenantMonth() && entry.unit_id === tenant.unit_id); openModal("rent"); document.querySelector("[name=rent]").value = record ? record.rent : tenant.monthly_rent; document.querySelector("#entry-form").dataset.id = tenant.id; }
  const editRentHistory = event.target.closest("[data-edit-rent-history]"); if (editRentHistory) { const item = state.rentHistory.find(entry => entry.id === editRentHistory.dataset.editRentHistory); openModal("rentHistory"); document.querySelector("[name=rent]").value = item.rent; document.querySelector("#entry-form").dataset.id = item.id; }
  const editUtilityHistory = event.target.closest("[data-edit-utility-history]"); if (editUtilityHistory) { const item = state.utilityHistory.find(entry => entry.id === editUtilityHistory.dataset.editUtilityHistory); openModal("utilityHistory"); document.querySelector("[name=amount]").value = item.amount; document.querySelector("#entry-form").dataset.id = item.id; }
  const editTenant = event.target.closest("[data-edit-tenant]"); if (editTenant) { const item = state.tenants.find(entry => entry.id === editTenant.dataset.editTenant); openModal("tenant"); Object.entries(item).forEach(([key, value]) => { const input = document.querySelector(`[name=${key}]`); if (input) input.value = value || ""; }); document.querySelector("#entry-form").dataset.id = item.id; document.querySelector("#entry-form").dataset.leaseDocument = item.lease_document || ""; }
  const copyReminder = event.target.closest("[data-copy-reminder]"); if (copyReminder) { const tenant = state.tenants.find(item => item.id === copyReminder.dataset.copyReminder); const reminder = tenantReminder(tenant); try { await navigator.clipboard.writeText(reminder); alert(`Reminder copied for ${tenant.full_name}. Paste it into a text message to ${tenant.phone}.`); } catch { prompt(`Copy this reminder for ${tenant.full_name}:`, reminder); } }
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
document.addEventListener("change", async event => {
  const leaseSelect = event.target.closest("[data-lease-tenant]");
  if (!leaseSelect || !isAdmin) return;
  const [lease_start, lease_end] = leaseSelect.value.split("|");
  const { error } = await supabase.from("tenants").update({ lease_start, lease_end }).eq("id", leaseSelect.dataset.leaseTenant);
  if (error) alert(error.message); else await loadData();
});
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
    const query = form.dataset.id ? supabase.from("tenants").update(record).eq("id", form.dataset.id) : supabase.from("tenants").insert(record);
    const { error } = await query; if (error) { alert(error.message); return; }
    syncTenantRentWithUnit(record);
    await supabase.from("units").update({ tenant: record.full_name, rent: Number(record.monthly_rent) }).eq("id", record.unit_id);
    const activeRentRecord = state.rentHistory.find(entry => entry.month === monthKey && entry.unit_id === record.unit_id);
    if (activeRentRecord) await supabase.from("rent_history").update({ rent: Number(record.monthly_rent) }).eq("id", activeRentRecord.id);
    modal.close(); await loadData(); return;
  }
  if (type === "utilityEdit") {
    const id = form.dataset.id; const month = selectedUtilityMonth(); const utility = state.utilities.find(item => item.id === id); const existing = state.utilityHistory.find(entry => entry.month === month && entry.utility_id === id); const updates = { amount:Number(data.get("amount")) }; const due = monthEndDue(month);
    const { error } = await supabase.from("utility_history").upsert({ month, utility_id:id, service:utility.service, amount:updates.amount, due, paid:existing?.paid || false }, { onConflict:"month,utility_id" });
    if (error) { alert(error.message); return; }
    if (month === monthKey) await supabase.from("utilities").update({ ...updates, due }).eq("id", id);
    modal.close(); await loadData(); return;
  }
  if (type === "rent") {
    const tenant = state.tenants.find(item => item.id === form.dataset.id);
    const unit = state.units.find(item => item.id === tenant.unit_id);
    const month = selectedTenantMonth();
    const existing = state.rentHistory.find(entry => entry.month === month && entry.unit_id === tenant.unit_id);
    const rent = Number(data.get("rent"));
    const { error } = await supabase.from("rent_history").upsert({ month, unit_id:tenant.unit_id, unit_name:unit?.name || tenant.unit_name, rent, paid:existing?.paid || false, received:existing?.received || "" }, { onConflict:"month,unit_id" });
    if (error) { alert(error.message); return; }
    if (month === monthKey) { await supabase.from("tenants").update({ monthly_rent: rent }).eq("id", tenant.id); await supabase.from("units").update({ rent }).eq("id", tenant.unit_id); }
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
    const { error } = await supabase.from("utility_history").update({ amount: Number(data.get("amount")), due: monthEndDue(historicalUtility.month) }).eq("id", id);
    if (error) { alert(error.message); return; }
    modal.close(); await loadData(); return;
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
