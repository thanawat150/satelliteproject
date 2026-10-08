# Ken Affiliate AI Studio v6.1 — ใช้ง่ายขึ้น + Email-first Login (8 ต.ค. 2026)

**เว็บไซต์ที่เผยแพร่:** https://thanawat150.github.io/satelliteproject/affiliate-studio/

หน้าแรกใหม่เหลือ 3 ขั้นตอน: เพิ่มสินค้า → เลือกรูปแบบ → สร้างคลิป; เครื่องมือขั้นสูงถูกซ่อนไว้ในเมนูพับเก็บได้. เมื่อตั้งค่า Supabase Auth จริง หน้าล็อกอินจะให้อีเมลก่อนและส่งลิงก์เข้าเมล (Magic Link) ได้; ตอนนี้ config.js ยังว่าง แสดงโหมด Local-only อย่างตรงไปตรงมา ไม่สามารถส่งอีเมลได้จนกว่าจะมี backend

คู่มือการเปิดใช้ Email Login: `EMAIL_LOGIN_SETUP.md`

---

# Ken Affiliate AI Studio v5 — Data-First and WebM exports (8 October 2026)

A source-first affiliate workspace with a working import / review / ranking / character / campaign / audit UI. Built as static web assets for GitHub Pages (no frontend build step). The project starts with **zero fabricated products and zero fabricated metrics**.

## Features implemented

- Product import: UTF-8 CSV/TSV with row validation, Thai/English column aliases, numeric parsing, source URL, observed time, original file name, per-row validation errors, duplicate upsert by `platform::product_id`.
- Data Gate: a product only becomes campaign-eligible if it has ID, price, commission rate/amount, source URL, observation timestamp within 48 hours, seller/product URL, positive availability (if present), AND explicit operator review. **Imported files are labeled as user-uploaded exports, never authenticated API results.**
- Product ranking: descending *computed commission THB per sale*, **not** imaginary sales potential or marketplace popularity. Missing numbers display `—`, never `0`.
- Character Factory: custom names, persona, rules, optional reference PNG/JPG/WEBP (local mode: browser localStorage, Supabase mode: private object storage, signed URLs).
- Auto Pilot: produces 1-12 creative **drafts** with hooks, scripts, storyboards, captions and a planned day schedule; configurable time spacing (default 2 days). No false claims that products were tested.
- Metrics CSV import and overview. Example metrics headers: `platform,post_url,observed_at,views,likes,comments,shares,orders,commission_thb`. Missing values remain null.
- Audit log and full JSON backup/restore. No sample products or sample sales figures.
- Conditional Supabase Auth (Google / Facebook / Magic link) + single-user Supabase sync with Postgres RLS. No platform passwords stored by this app.
- Connections page with honest platform statuses and developer documentation links.

## Quick start (local)

Run a static local server from the folder, **not** by double-clicking `index.html`, because browser ES modules need HTTP(S).

```
python -m http.server 8765
```

Open `http://localhost:8765/`. Without a configured Supabase project the app runs in **Local Only** mode and explicitly says there is no real login. All data is private to this browser profile, but not protected by authentication.

## Data template

Use **Products → Download empty template**, fill it using your own authorized source exports, then import the CSV. The template contains header fields only. Source fields:

`product_id,name,platform,price,commission_rate,commission_amount,sales_count,sales_period,rating,stock,product_url,affiliate_url,category,source_url,observed_at,description,claims`

The `observed_at` field should be ISO 8601 with an explicit timezone, e.g. `YYYY-MM-DDTHH:mm:ss+07:00`; this is a **format example**, not a record. Do not convert missing values to 0. Historical data can be stored but not used in the campaign eligibility gate after 48h.

**Evidence policy**: An uploaded CSV is not independent verification. `source_url` is user-provided and can point to wrong content; pressing review is a recorded user attestation. A future official marketplace connector must establish OAuth, token permissions, and verified server-side ingestion before a `verified_api` status can be used. This implementation never marks a CSV as Official API.

## Enable a real login + per-user persistence

1. Create a **separate** Supabase project for Ken Affiliate Studio. Do not reuse existing Forestry/OCR project databases without permission. Choose owner organization and review any cost before project creation.
2. Open its SQL Editor and run `supabase/schema.sql`. Verify the RLS policies, the `workspace_data` table, and the **private** `character-assets` bucket.
3. In Supabase → Auth → Providers, enable Google and Facebook with their provider-side client IDs/secrets. Email/Magic Link can be enabled as needed. Set the correct provider callback URLs following official Supabase guides.
4. Set Supabase Auth URL configuration: Site URL `https://thanawat150.github.io/satelliteproject/affiliate-studio/` (only after deployment) and Redirect URLs including the exact production URL and your development URL.
5. Edit `config.js` and set **only** the project URL and **publishable** client key (safe in browser):
   ```js
   window.KEN_CONFIG={supabaseUrl:'https://YOUR_PROJECT.supabase.co',supabasePublishableKey:'sb_publishable_...'};
   ```
6. Reload the page. With config present, the app requires real authentication; it no longer offers Local Only. All workspace mutations use the `workspace_data` RLS-protected table. Character images are stored in the private Storage bucket using user-scoped paths.
7. RLS security should be checked in Supabase security advisor, and log in with two test users to ensure they cannot read each other's workspaces.

**Never** put any of these in `config.js` or GitHub Pages: `service_role`, `secret`, Gemini API key, marketplace OAuth client secret, social refresh token, or private email/password. Hosted GitHub Pages is a public static website.

## Publish as a GitHub Pages link

Use a **new** GitHub repository named `thanawat150/ken-affiliate-studio` (this archive does not modify the existing `satelliteproject` repository). Upload all project root files, including `logic.js`, `app.js`, `style.css`, `config.js`, `index.html`, and `supabase/schema.sql`, to `main`. GitHub → Settings → Pages → Deploy from a branch → `main`, root (`/`). After GitHub Pages reports successful deployment, you can open:

`https://thanawat150.github.io/satelliteproject/affiliate-studio/?tab=hunter`

This URL is **a proposed future address, not a verified live deployment**.

## External marketplace and AI APIs — **not implemented**

- TikTok Shop / Shopee affiliate live product discovery: needs approved API credentials and permitted scopes. No raw scraping or session-cookie workarounds.
- TikTok Direct Post and Meta/Facebook/Instagram Reels: require their own OAuth / posting scopes and platform approval. This UI does **not** publish, auto-tag baskets, or claim to connect to them.
- Google Flow has a manual creator workflow; Gemini Veo is the intended programmatic production service via **future backend**, not an in-browser API key. Meta AI Vibes is for manual creative workflows unless an official compatible public API is confirmed.
- No automatic AI images or MP4 renders are claimed. Generated text here is a **deterministic creative template** from real product metadata, not a generative model call.

## Planned secure backend modules

- `product-sync`: marketplace OAuth & scheduled ingestion, rate-limit, idempotent upsert, source payload store and data freshness.
- `ai-jobs`: authenticated server-side LLM / image / video generation, actual cost estimate before launching, user budget limits, queued workers, safe media storage.
- `publish`: explicit approvals, creators' consent and content disclosures, platform-specific scope checks and post-status polling, optional manual basket task when API disallows tagging.
- `commission-sync`: order/commission statements with cancellation/refund adjustment, observable unit economics, source-verified profit metrics.

The v5 workspace uses a single JSON document per account for simplicity. For multi-user teams, audit immutability, large asset libraries or concurrent edits, migrate to normalized tables with RLS, optimistic locking, and append-only audit records.

## Run tests

`node --test tests/*.test.mjs`

No real product claims or sample sales data are included in tests. Tests use synthetic fixtures **only inside test code**, not the application or user dashboard.

## New in v5: immediately usable features

- **Manual factual capture:** Products → Add a product from observed source fields. Requires the actual product ID, product link, evidence URL, price, commission and observation time. This records a `manual_entered` source and still requires the human attestation; it is not an API result.
- **One-click WebM motion rendering:** Campaigns → open draft → Download motion WebM. The browser creates a 720 × 1280 vertical 10-second WebM from product metadata and disclosure. It uses no AI models, makes no test/endorsement claim, does not include product photos or voice, and has no real publish action. Chrome desktop recommended.
- **Source freshness:** for all imports and video exports, source observed time must be within 48h and reviewed.
- **Secure login:** remains optional Supabase integration until a separate project is created and configured; the public static site cannot independently supply true private login.
- **Cloud publishing:** static assets can be hosted at a subfolder under an existing published GitHub Pages repository (without modifying the existing site root), or in a new repo once made.

## Current published subfolder

The static frontend is deployed into a new, isolated `docs/affiliate-studio/` folder in the user's existing GitHub Pages portal repository. This preserves the portal's existing root pages and makes the app available at `https://thanawat150.github.io/satelliteproject/affiliate-studio/`. In this static hosting configuration all business data remains local to the browser unless a separately created Supabase project is configured. There is no data API connection by default.