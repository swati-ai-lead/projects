module.exports = (_request, response) => {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return response.status(503).json({ error: "Database configuration is missing." });
  }
  response.setHeader("Cache-Control", "no-store");
  return response.status(200).json({ url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY });
};