const encodeMessage = ({ to, subject, text }) => Buffer.from(`To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${text}`).toString("base64url");
module.exports = async (request, response) => {
  if (request.method !== "POST") return response.status(405).end();
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
  const accessToken = request.body?.accessToken; const tenantId = request.body?.tenantId;
  if (!accessToken || !tenantId || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return response.status(503).json({ error:"Email integration is not configured." });
  const headers = { apikey:SUPABASE_SERVICE_ROLE_KEY, Authorization:`Bearer ${SUPABASE_SERVICE_ROLE_KEY}` };
  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers:{ ...headers, Authorization:`Bearer ${accessToken}` } }); const user = await userResponse.json();
  if (!userResponse.ok || user.email !== "sushmit.gujar@gmail.com") return response.status(403).json({ error:"Only the property administrator can send reminders." });
  const [tenantResponse, utilitiesResponse, credentialResponse] = await Promise.all([fetch(`${SUPABASE_URL}/rest/v1/tenants?id=eq.${tenantId}&select=*`, { headers }), fetch(`${SUPABASE_URL}/rest/v1/utilities?paid=eq.false&select=service,amount`, { headers }), fetch(`${SUPABASE_URL}/rest/v1/gmail_credentials?id=eq.1&select=refresh_token`, { headers })]);
  const [tenant] = await tenantResponse.json(); const utilities = await utilitiesResponse.json(); const [credentials] = await credentialResponse.json();
  if (!tenant?.email) return response.status(400).json({ error:"This tenant does not have an email address." }); if (!credentials?.refresh_token) return response.status(503).json({ error:"Connect Gmail before sending reminders." });
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method:"POST", headers:{ "Content-Type":"application/x-www-form-urlencoded" }, body:new URLSearchParams({ client_id:GOOGLE_CLIENT_ID, client_secret:GOOGLE_CLIENT_SECRET, refresh_token:credentials.refresh_token, grant_type:"refresh_token" }) }); const token = await tokenResponse.json();
  if (!tokenResponse.ok) return response.status(502).json({ error:"Gmail authorization expired. Reconnect Gmail." });
  const pending = utilities.map(item => `${item.service} $${Number(item.amount).toFixed(2)}`).join(", ") || "none"; const text = `Hello ${tenant.full_name},\n\nThis is a reminder from 1179 Bush St. Your monthly rent is $${Number(tenant.monthly_rent).toFixed(2)}. Pending property utilities: ${pending}.\n\nThank you.`;
  const sendResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", { method:"POST", headers:{ Authorization:`Bearer ${token.access_token}`, "Content-Type":"application/json" }, body:JSON.stringify({ raw:encodeMessage({ to:tenant.email, subject:"1179 Bush St rent and utility reminder", text }) }) });
  if (!sendResponse.ok) return response.status(502).json({ error:"Gmail could not send the reminder." });
  return response.status(200).json({ sent:true });
};