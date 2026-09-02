# 1179 Bush St Property Management

Secure two-unit property dashboard with Supabase authentication and database storage. `sushmit.gujar@gmail.com` is the only account that can receive the admin role; all other registered accounts are read-only.

## One-time Supabase setup

1. Create a free project at [Supabase](https://supabase.com/dashboard), then open **SQL Editor** and run [supabase-schema.sql](supabase-schema.sql).
2. For owner mortgage schedules and bill uploads, run [supabase-owner-bills-migration.sql](supabase-owner-bills-migration.sql) after the history migrations.
3. In **Authentication > Providers > Email**, leave email/password enabled and enable email confirmation.
4. In **Authentication > URL Configuration**, add your Vercel URL as the Site URL and redirect URL.
5. In Vercel, create `SUPABASE_URL` and `SUPABASE_ANON_KEY` environment variables from Supabase **Settings > API**, then redeploy.

Bill uploads are stored in the private `bills` Supabase storage bucket. PDF and text bills are parsed locally in the browser to suggest an amount, but the editable amount field is always the final saved value.

The first person to register with `sushmit.gujar@gmail.com` is prompted in the website to choose a password. Choose at least 12 characters containing uppercase, lowercase, a number, and a symbol. Do not share it in source control or chat.