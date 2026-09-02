const clean = value => (value || "").trim().replace(/^['\"]|['\"]$/g, "").replace(/\s+/g, "");

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function supabaseRequest(path, options = {}) {
  const url = clean(process.env.SUPABASE_URL);
  const serviceRoleKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!url || !serviceRoleKey) throw new Error("Tenant login management is not configured.");
  const response = await fetch(`${url}${path}`, {
    ...options,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = data?.msg || data?.message || data?.error || "Supabase request failed.";
    if (/invalid api key/i.test(message)) throw new Error("SUPABASE_SERVICE_ROLE_KEY must be a Supabase server key for this exact project. Use either the legacy service_role JWT or a Secret key, not the API URL or anon key.");
    throw new Error(message);
  }
  return data;
}

async function verifyAdmin(accessToken) {
  const url = clean(process.env.SUPABASE_URL);
  const anonKey = clean(process.env.SUPABASE_ANON_KEY);
  if (!url || !anonKey) throw new Error("Database configuration is missing.");
  const userResponse = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` } });
  const user = await userResponse.json();
  if (!userResponse.ok || !user?.id) throw new Error("Sign in again before changing tenant logins.");
  if (user.email?.toLowerCase() === "sushmit.gujar@gmail.com") return;
  const profile = await supabaseRequest(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role&limit=1`);
  if (profile?.[0]?.role !== "admin") throw new Error("Only admins can change tenant logins.");
}

async function findTenantProfile(tenantId) {
  const profiles = await supabaseRequest(`/rest/v1/profiles?tenant_id=eq.${encodeURIComponent(tenantId)}&select=id,email&limit=1`);
  return profiles?.[0] || null;
}

module.exports = async (request, response) => {
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed." });
  try {
    const accessToken = request.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!accessToken) return response.status(401).json({ error: "Missing admin session." });
    await verifyAdmin(accessToken);

    const { tenantId, email, password } = await readJson(request);
    if (!tenantId || !email) return response.status(400).json({ error: "Tenant and username are required." });
    if (password && String(password).length < 8) return response.status(400).json({ error: "Password must be at least 8 characters." });

    const existingProfile = await findTenantProfile(tenantId);
    let userId = existingProfile?.id;
    if (userId) {
      const updates = { email, email_confirm: true };
      if (password) updates.password = password;
      await supabaseRequest(`/auth/v1/admin/users/${encodeURIComponent(userId)}`, { method: "PUT", body: JSON.stringify(updates) });
    } else {
      if (!password) return response.status(400).json({ error: "Set a password when creating a tenant login." });
      const user = await supabaseRequest("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email, password, email_confirm: true }) });
      userId = user.id;
    }

    await supabaseRequest(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ email, role: "user", tenant_id: tenantId }) });
    await supabaseRequest(`/rest/v1/tenants?id=eq.${encodeURIComponent(tenantId)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ email }) });
    return response.status(200).json({ ok: true });
  } catch (error) {
    return response.status(400).json({ error: error.message });
  }
};