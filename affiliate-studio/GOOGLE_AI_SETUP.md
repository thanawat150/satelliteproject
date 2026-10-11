# Ken Affiliate AI Studio v7 — Google + Gmail + AI Director

**Current live deployment: GitHub Pages static frontend.** Google Login, Gmail and Gemini API are real integration paths but need Google OAuth configuration, dedicated Supabase project, and paid API key before activation. Never label these as connected until authorized and tested. The v7 web pages intentionally disable unavailable buttons.

## A. Set up dedicated Supabase project

1. Choose the intended Supabase organization and approve its current pricing. Create a **new** project (do not reuse forestry/OCR databases).
2. In the **new** project run `supabase/schema.sql` (RLS applies to workspace_data, private character bucket, and ai_usage_events).
3. Enable Auth > Providers > Google. Create a Web OAuth Client ID/secret in Google Cloud Console; use Supabase's `/auth/v1/callback` as the *Google Cloud OAuth redirect URI* and set your app URL as a Supabase Auth **Redirect URL**: `https://thanawat150.github.io/satelliteproject/affiliate-studio/`.
4. In GitHub's public `docs/affiliate-studio/config.js`, set only Supabase project URL and publishable key. These are public. **Never** include Google Client Secret, Gemini API Key, service_role, access or refresh tokens.
5. For Gmail, enable the **Gmail API** in Google Cloud and configure OAuth consent screen; `gmail.readonly` is a restricted scope and may require verification. Set public OAuth Web Client ID as `googleClientId` in `config.js`; register `https://thanawat150.github.io` in Authorized JavaScript Origins. Gmail consent is requested only by clicking Connect Gmail. Access token stays in tab memory, only up to ten subject/sender/date metadata items are fetched and never passed to Gemini.

## B. AI Director function

1. Set Supabase Edge Function secret `GEMINI_API_KEY` (and optional `GEMINI_MODEL`, default `gemini-2.5-flash`). Secrets stay server-side.
2. Deploy `supabase/functions/ai-director/index.ts` as Edge Function `ai-director` with JWT verification enabled.
3. AI Director requires login. It reads **the logged-in user's** workspace with RLS and **server-side** rejects missing/unreviewed/stale products. It never fetches or fabricates external product metrics.
4. AI brainstorm/character modes require login but no verified product. Character mode creates text profile / prompt, not an actual image. Campaign mode creates draft script, caption, storyboard and Veo/Flow brief, not a rendered AI film; video export remains the existing browser WebM motion draft.
5. Production hardening still needed: atomic server-side rate limits, billing quota, abuse protection, consent/privacy controls, and platform OAuth approvals before public/multiuser launch. Do not change the strict Data Gate or silently publish drafts.

## Security notes

- **Google Login != Gmail permissions**. Gmail requires an explicit independent consent and only gets read-only temporary credentials. Gmail data is not copied to workspace or sent to Gemini.
- Google OAuth restricted `gmail.readonly` scope requires additional compliance checks outside personal testing.
- The old Email Magic Link remains as an optional fallback. Google Login is now primary.
- TikTok/Shopee Affiliate APIs, automated baskets, full AI video rendering (Veo), and Facebook/Instagram publishing require additional approval and integration and are **not implemented** by this change.

Docs:
- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/guides/functions/auth
- https://ai.google.dev/api/generate-content
- https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list