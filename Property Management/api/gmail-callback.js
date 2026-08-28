module.exports = async (request, response) => {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VERCEL_URL } = process.env;
  if (!request.query.code || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !VERCEL_URL) return response.status(400).send("Gmail configuration is incomplete.");
  const redirectUri = `https://${VERCEL_URL}/api/gmail-callback`;
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method:"POST", headers:{ "Content-Type":"application/x-www-form-urlencoded" }, body:new URLSearchParams({ code:request.query.code, client_id:GOOGLE_CLIENT_ID, client_secret:GOOGLE_CLIENT_SECRET, redirect_uri:redirectUri, grant_type:"authorization_code" }) });
  const tokens = await tokenResponse.json(); if (!tokenResponse.ok || !tokens.refresh_token) return response.status(400).send("Google authorization did not return a refresh token. Reconnect and approve access.");
  const dbResponse = await fetch(`${SUPABASE_URL}/rest/v1/gmail_credentials?on_conflict=id`, { method:"POST", headers:{ apikey:SUPABASE_SERVICE_ROLE_KEY, Authorization:`Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type":"application/json", Prefer:"resolution=merge-duplicates" }, body:JSON.stringify({ id:1, refresh_token:tokens.refresh_token }) });
  if (!dbResponse.ok) return response.status(500).send("Google authorized, but the token could not be stored.");
  return response.redirect("/");
};