# Cancer Study Registry: GitHub → Railway + Supabase

## Status and safety

This repository supports a **new empty Supabase database and new Supabase Auth
accounts**, as requested. It does not migrate Clerk users, passwords or clinical
records, and must not be used to erase an existing project.

The current Replit deployment is not changed by these files. Replit's existing
build remains on Clerk by default. The separate Railway build explicitly selects
Supabase; the server must select the same provider with `AUTH_PROVIDER=supabase`.
No live Supabase sign-in or database connection has been verified without the
project credentials. Do not treat compilation as a completed migration.

## 1. Prepare the existing Supabase project

1. Confirm this is the intended project, and inspect its existing tables first.
2. In SQL Editor, run `deployment/supabase-schema.sql` **once**. It creates the
   three registry tables atomically and stops on naming conflicts. Do not delete
   tables to work around a conflict.
3. Enable email/password sign-in in Authentication. Configure email confirmation
   and a production-capable email sender/SMTP appropriate for your study.
   Supabase's default mail service has restrictions and is not a production mail
   plan. Google/other OAuth login is not part of this first Supabase adapter.
4. From API Keys and the Connect dialog, obtain the project URL and **publishable**
   key (or legacy **anon** key), never a secret/service_role key.
5. From Connect, select the IPv4-compatible **Session pooler** PostgreSQL URI and
   replace the password placeholder. URL-encode reserved password characters.

The SQL deliberately enables RLS and revokes direct access by browser roles.
The browser uses Supabase Auth only; clinical data continues through the Express
API. The backend database connection must use a role permitted to access these
tables (the Supabase project `postgres` connection works). Never put this URI or
a privileged Supabase key in `VITE_*` or GitHub.

## 2. Upload to a private GitHub repository

Use a private repository such as `cancer-study-registry` in your chosen account.
Do not publish credentials, `.env` files, database exports or clinical records.
The accompanying source package omits Git history, local settings, agent notes,
compiled output, dependencies, and the design mockup sandbox.

If uploading the ZIP manually, extract it first: GitHub needs the files, not a ZIP
committed inside the repository. Keep `railway.json`, `package.json` and
`pnpm-workspace.yaml` at repository root, and enable display of hidden files to
include `.npmrc`, `.gitignore` and the non-secret `.env.example`.

## 3. Create the Railway service manually

No Railway integration is required.

1. Create a Railway project/service from the private GitHub repository.
2. Use the **repository root** as the service root. Railway reads `railway.json`.
3. The project pins Node 24 and pnpm 10.26.1. The build command is
   `pnpm run build:railway`; start is `pnpm run start:railway`.
   The Railway start command enforces Supabase mode and same-origin web serving;
   it cannot silently start with the managed Replit database.
4. Keep build/dev dependencies available during the build (do not use a
   production-only pnpm install).
5. Add these **runtime variables/secrets in Railway**, not in source control:

   | Name | Value |
   |---|---|
   | `AUTH_PROVIDER` | `supabase` |
   | `SERVE_WEB` | `true` |
   | `NODE_ENV` | `production` |
   | `SUPABASE_URL` | Supabase project origin |
   | `SUPABASE_PUBLISHABLE_KEY` | Publishable or legacy anon key |
   | `SUPABASE_DATABASE_URL` | Session pooler PostgreSQL connection URI |

   Railway supplies `PORT`. Do not override it with Replit's port. Do not copy
   Clerk, Replit session, or connector secrets. The app will refuse to fall back
   to the Replit database in Supabase mode.
6. Publish only after checking these settings. Generate a public Railway domain
   in the service's Networking settings. Confirm the actual assigned URL there;
   do not infer it from the project name.
7. In Supabase Authentication URL Configuration, set **Site URL** to the actual
   Railway HTTPS origin and allow the exact redirect URLs:
   - `https://YOUR_ACTUAL_RAILWAY_HOST/sign-in`
   - `https://YOUR_ACTUAL_RAILWAY_HOST/sign-in?recovery=1`

   Replace the example host; these are not active URLs. When testing PKCE email
   confirmation/recovery, open the email link in the browser that requested it.
   Configure additional domains explicitly rather than broad wildcard redirects.

Railway runs the API and static web app on one origin, including SPA deep links.
Only the public project URL and public key are exposed by `/api/auth/config`.
Database TLS certificate verification stays enabled. If your environment needs a
specific CA, configure the official CA trust; never disable certificate checks.
Startup validates the application tables before listening and does not execute
automatic external schema DDL. It also requires RLS and rejects direct clinical
table grants to the anon/authenticated browser roles.

## 4. Required verification before switching users

- Sign up, confirm email if enabled, sign in, reload, sign out, and reset password.
- With two physician accounts, create/edit/delete a synthetic coded case:
  - Renal: only the owner's cases are visible/editable.
  - Breast: both physicians can view coded records, hospital and author;
    only the author can edit or delete.
- Confirm author names and ownership come from the verified account, not the
  submitted case payload. Rejected/expired tokens must return 401.
- Confirm subtype/setting-specific treatment lists and dates survive reload.
- Confirm direct anon/authenticated Data API requests cannot read clinical tables.
- Confirm API and SPA deep links work on the assigned Railway domain.

Use synthetic cases, not real patient data, for these tests. Keep the Replit app
available until this checklist passes and the user explicitly approves cutover.
Do not delete the Replit database or unpublish it as part of initial setup.

## Local checks

```sh
node --test tests/breast-regimen-catalog.test.ts tests/supabase-auth.test.ts
pnpm run build:railway
```

To regenerate the source-only ZIP without Git history or local configuration:

```sh
python3 deployment/export-source.py
```

It writes `generated-artifacts/cancer-study-registry-source.zip`. It performs a
limited credential-pattern check, not a full security audit; review the archive
before sharing it. You can download that file from the workspace file tree.

For a configured external local process, set the same runtime secrets securely
and supply `PORT`; the app does **not** automatically load `.env` files.
For Replit preview, leave the Supabase provider flags unset until the new
configuration is ready. Shared `AUTH_PROVIDER` changes affect preview too.
