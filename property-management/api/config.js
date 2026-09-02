module.exports = (_request, response) => {
  const clean = value => (value || "").trim().replace(/^['\"]|['\"]$/g, "");
  const SUPABASE_URL = clean(process.env.SUPABASE_URL);
  const SUPABASE_ANON_KEY = clean(process.env.SUPABASE_ANON_KEY);
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return response.status(503).json({ error: "Database configuration is missing." });
  }
  response.setHeader("Cache-Control", "no-store");
  return response.status(200).json({ url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY });
};