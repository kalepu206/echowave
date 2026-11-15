# EchoWave: production version

EchoWave is a real-time local broadcast app. Anyone can post a short update about their area (traffic, rain, power cuts, deals, lost & found, safety alerts). People nearby see it live, like it, comment on it, and the most-liked posts trend. AI checks every post for safety, tags its topics, writes photo descriptions for blind users, and summarizes what's trending.

This is a full rebuild of the Firebase Studio prototype as a real multi-user app. It runs on **Cloudflare** with your own domain, and can be packaged for the **Google Play Store**.

---

## What changed from the Firebase Studio prototype

| Prototype (Firebase Studio) | This version |
|---|---|
| Posts lived only in your browser's memory, so other people couldn't see them | Real database (Cloudflare D1): everyone sees the same live feed |
| Login and sign-up screens only, with nothing behind them | Real accounts with "Continue with Google", sessions stored securely on Cloudflare (no Firebase) |
| Images stored as text inside the page | Photos compressed on the phone and stored in Cloudflare R2 |
| Messages with a "negative tone" were blocked, which also blocked useful alerts like "accident on the highway" | AI blocks *harmful* content (abuse, hate, scams, spam, private info) and lets bad *news* through |
| Gemini key used in Genkit flows | Gemini is called only from the server, so the key never reaches users. Uses the new auth-key format |
| Lat/long shown on posts | Location is rounded to about 1 km before it's saved. Users only see "2.3 km away" |
| Sample posts (User123, Walmart…) | Removed |
| — | **Near me** filter (2–50 km), search, and "N new broadcasts" live updates |
| — | Report, block, auto-hide after 3 reports, admin moderation page, user bans |
| — | Urgent safety alerts (AI confirms before showing the Urgent badge) |
| — | Rate limits (5 posts/hour), duplicate and spam checks |
| — | Posts expire after 48 hours and are cleaned up automatically |
| — | In-app account deletion, privacy policy, terms, guidelines (all required by Google Play) |
| — | Installable app (PWA), offline shell, app icons and Play Store graphics |

**Tech:** React + Tailwind (website) · Cloudflare Workers + Hono (API) · Cloudflare D1 (database) · Cloudflare R2 (photos) · Sign in with Google · Google Gemini (AI).

---

## What you need

- A computer with **Node.js 20 or newer** (download the LTS version from nodejs.org)
- A free **Cloudflare** account (you'll also buy your domain there)
- A free **Google Cloud** project (for the "Continue with Google" button)
- A **Gemini API key** from Google AI Studio
- For Android: a **Google Play developer account** (one-time US$25)

On Windows, run every command below in **PowerShell** inside the `echowave` folder.

---

## Step 1: Install

```bash
npm install
```

## Step 2: Google sign-in (no Firebase)

Sign-in is "Continue with Google", handled by the app itself on Cloudflare.

1. Go to **console.cloud.google.com** → create a project called `echowave` (or pick one).
2. **APIs & Services → OAuth consent screen** (or **Google Auth Platform → Branding**): app name `EchoWave`, your support email, app domain `echowaveai.com`, privacy policy `https://echowaveai.com/privacy`, terms `https://echowaveai.com/terms`. Audience: **External**. Then **Publish app** so anyone can sign in.
3. **Clients → Create client** (or **Credentials → Create credentials → OAuth client ID**): type **Web application**.
   - Authorized JavaScript origins: `https://echowaveai.com`
   - Authorized redirect URIs: `https://echowaveai.com/api/auth/google/callback`
4. Copy the **Client ID** into `wrangler.jsonc` → `"GOOGLE_CLIENT_ID"` (it is public).
5. Put the **Client secret** in Cloudflare → Workers & Pages → echowave → Settings → Variables and Secrets → Add → Type **Secret**, name `GOOGLE_CLIENT_SECRET`.

For local testing also add `http://localhost:5173` as an origin and `http://localhost:5173/api/auth/google/callback` as a redirect URI, and put `APP_ORIGIN=http://localhost:5173`, `GOOGLE_CLIENT_SECRET=...` in `.dev.vars`.

## Step 3: Gemini API key

1. Go to aistudio.google.com → **Get API key → Create API key**.
2. Keep the key somewhere safe. Never put it in `.env` or in the code.

Old "standard" Gemini keys stopped working in September 2026. If your Firebase Studio app's AI stopped working, that's why. Keys created now are the new type.

In Google Cloud Console → Billing, **set a budget alert** (for example ₹500/month) so a spike in usage can't surprise you.

## Step 4: Try it on your computer (optional)

```bash
# 1. a file for local secrets (not uploaded anywhere)
echo GEMINI_API_KEY=your-key-here > .dev.vars

# 2. build once and create the local database
npm run build
npm run db:migrate:local

# 3. start the API (terminal 1) and the website (terminal 2)
npm run dev:api
npm run dev
```

Open http://localhost:5173. Sign up, verify your email, pick a username, and broadcast.

## Step 5: Put it on Cloudflare

```bash
npx wrangler login                       # opens the browser to connect your Cloudflare account
npx wrangler d1 create echowave          # prints a database_id: paste it into wrangler.jsonc
```

In the Cloudflare dashboard, open **R2 Object Storage** and click **Enable R2**. It has a free allowance, but Cloudflare may ask for a payment method. Then:

```bash
npx wrangler r2 bucket create echowave-images
npx wrangler secret put GEMINI_API_KEY   # paste your Gemini key when asked
npm run db:migrate                       # creates the tables in the live database
npm run deploy                           # builds and uploads everything
```

The last command prints a URL like `https://echowave.yourname.workers.dev`. Your app is live.

**Every time you change the code, run `npm run deploy` again.** Run `npm run db:migrate` only if you add a new file in `migrations/`.

## Step 6: Your own domain

1. **Check the name first.** Search the Play Store and the web for "EchoWave" so you don't pick a name someone else already uses. Change it now if needed, because renaming later is painful.
2. Cloudflare dashboard → **Domain Registration → Register Domains**. Buy your domain, e.g. `echowave.app` or `getechowave.com`. Cloudflare sells domains at cost.
3. **Workers & Pages → echowave → Settings → Domains & Routes → Add → Custom domain** → type your domain. Cloudflare sets up HTTPS automatically.
4. Set `"APP_ORIGIN"` in `wrangler.jsonc` to your domain and make sure the same domain is in your Google OAuth client (step 2).

## Step 7: Make yourself the admin

1. Sign up on your live site and pick a username.
2. In Cloudflare → Storage & Databases → D1 → echowave → Console, run `SELECT user_id, email FROM identities;` and copy your `user_id` (looks like `google:1234…`).
3. In `wrangler.jsonc`, set `"ADMIN_UIDS": "your-uid"` (separate several with commas) and run `npm run deploy`.
4. A 🛡 shield icon now appears in the header. It opens the moderation queue (reported, auto-hidden and unchecked posts) where you can keep, remove or ban.

## Step 8: Google Play Store

The Play Store app is your website wrapped as a **Trusted Web Activity**: a real Android app that shows your site full-screen without a browser bar. Updates to the website appear in the app instantly, with no new upload needed.

1. **Developer account:** play.google.com/console → sign up (US$25 one-time, plus ID verification).
2. **Package the app:** go to **pwabuilder.com**, enter your domain → **Package for stores → Android → Google Play**.
   - Package ID: e.g. `app.echowave.twa` (permanent, can never change)
   - App name: EchoWave · Signing key: **Create new**
   - Download the zip. It contains the `.aab` file to upload **and your signing key**. Back up the key and its passwords in two safe places. If you lose it you can never update the app.
3. **Link the app to your domain:** open `assetlinks.json` from the zip, copy the `package_name` and the `sha256_cert_fingerprints` value into `wrangler.jsonc`:
   ```
   "ANDROID_PACKAGE": "app.echowave.twa",
   "ANDROID_SHA256": "AB:CD:...:EF"
   ```
   Then run `npm run deploy` and check `https://yourdomain/.well-known/assetlinks.json` shows them.
4. **Create the app in Play Console** and upload the `.aab` to **Testing → Closed testing**.
5. After upload, go to **Test and release → App integrity → App signing**. Copy the **App signing key certificate SHA-256** too, and add it to `ANDROID_SHA256` with a comma between the two values. Deploy again. Skip this and the app shows a browser address bar.
6. Fill in the store listing and the **App content** forms. All the answers and text are ready in [`android/PLAY_STORE.md`](android/PLAY_STORE.md), and the icon and feature graphic are in `android/store-graphics/`.
7. **The 14-day rule:** new personal developer accounts must run a closed test with **at least 12 testers who stay opted in for 14 days in a row** before you can apply for production. Recruit 15–20 people with Android phones and Gmail addresses so dropouts don't reset the clock. Then click **Apply for production**.

Expect about 3 weeks from first upload to public release.

---

## Settings you can change (`wrangler.jsonc` → `vars`)

| Setting | Default | What it does |
|---|---|---|
| `POST_TTL_HOURS` | 48 | How long a broadcast stays in the feed |
| `REPORT_HIDE_THRESHOLD` | 3 | Reports needed to auto-hide a post |
| `GEMINI_MODEL` | gemini-flash-latest | AI model for moderation and summaries |
| `ADMIN_UIDS` | (empty) | Who can use the moderation page |

Limits like characters per post (280) and posts per hour (5) are at the top of `worker/index.ts`.

## Costs (small launch)

- **Cloudflare Workers, D1, R2:** free tiers cover an early-stage app.
- **Domain:** yearly fee, depending on the ending (.com, .app, .in…).
- **Gemini:** charged per request (one call per post or comment, one per trending summary, cached for 10 minutes). Flash models are among the cheapest; check current prices at ai.google.dev/pricing and keep the budget alert from step 3.
- **Google sign-in:** free.
- **Google Play:** US$25 once.

## If something goes wrong

- **Google says "redirect_uri_mismatch"**: the redirect URI in your Google OAuth client must be exactly `https://echowaveai.com/api/auth/google/callback`.
- **Posts go through but without topics or the Urgent badge**: the Gemini key is missing or wrong. Run `npx wrangler secret put GEMINI_API_KEY` again. Posts made while AI was down show in the admin queue as "AI check skipped".
- **See live errors:** `npx wrangler tail`, or Cloudflare dashboard → Workers → echowave → Logs.
- **Address bar visible in the Android app**: the SHA-256 fingerprints in step 8.3 or 8.5 are missing or wrong.

## Before you launch

- [ ] Read `src/pages/Legal.tsx` (privacy policy, terms, guidelines) and have a lawyer review it. These are templates, not legal advice. Fill in your real contact email and grievance officer name.
- [ ] Post 5–10 real broadcasts yourself so the first visitors don't see an empty feed.
- [ ] Test on a real Android phone: sign up, verify email, post with photo and location, like, comment, report, block, delete account.
