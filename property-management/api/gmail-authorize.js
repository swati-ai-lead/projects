module.exports = (_request, response) => {
  const { GOOGLE_CLIENT_ID, VERCEL_URL } = process.env;
  if (!GOOGLE_CLIENT_ID || !VERCEL_URL) return response.status(503).send("Gmail integration is not configured.");
  const redirectUri = `https://${VERCEL_URL}/api/gmail-callback`;
  const params = new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, redirect_uri: redirectUri, response_type: "code", access_type: "offline", prompt: "consent", scope: "https://www.googleapis.com/auth/gmail.send", state: "1179-bush-st" });
  return response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
};