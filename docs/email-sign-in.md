# Email magic-link sign-in

BootVerse keeps Auth.js 5 (`next-auth` 5.0.0-beta.32), its Nodemailer SMTP provider, and the custom Prisma adapter based on `@auth/prisma-adapter`. No password or OAuth Account model is needed for the current email-only flow. User, UserProfile, Session, VerificationToken and RateLimit tables are required.

Next.js loads root `.env.local` before `.env`; shell variables take precedence. Keep credentials out of source control. Prisma CLI currently loads `.env` through dotenv, so keep database configuration there when running the existing database scripts.

Configure locally (placeholders only):

```dotenv
DATABASE_URL="postgresql://USER:PASSWORD@NEON_HOST/neondb?sslmode=verify-full"
AUTH_SECRET="GENERATE_A_NEW_RANDOM_SECRET_AT_LEAST_32_CHARACTERS"
AUTH_URL="http://localhost:3000"
EMAIL_SERVER="smtps://resend:YOUR_RESEND_API_KEY@smtp.resend.com:465"
EMAIL_FROM="BootVerse <noreply@YOUR_VERIFIED_DOMAIN>"
```

Resend uses username `resend` and the API key as the SMTP password. URL-encode credentials if they contain URL delimiters. Use a Resend-verified sending domain; `.local` is only for the local SMTP capture tool. SMTP setup: https://resend.com/docs/send-with-smtp

Before using the new Neon database, inspect migration status and review the existing migrations. All six were pending during the read-only setup check. Do not use `migrate reset` or `db push`. Apply reviewed migrations with `npm run db:deploy`, first on an isolated test database/Neon branch. No production migration was applied by this authentication configuration check.

Restart the app after editing environment variables:

```sh
npm run dev
```

Open http://localhost:3000/login (use localhost consistently, not 127.0.0.1). Submit an inbox you control, check inbox/spam and Resend delivery logs, and open the magic link on the same localhost setup within 15 minutes. Confirm redirect to account, session persistence on refresh, and logout. The link must fail on reuse and after expiry. Do not share the link/token or log credentials.

The current automated integration suite exercises HTTP, PostgreSQL and a captured local SMTP mailbox using a disposable local database. It refuses remote database URLs. It does not establish Resend deliverability; verify that manually after fixing credentials and applying reviewed migrations.
