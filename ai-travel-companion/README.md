# AtlasGo — AI Travel Companion MVP

## Live demo
https://thanawat150.github.io/satelliteproject/ai-travel-companion/

Current status: **functional public preview, not a live AI service**.

## What has been implemented
- Mobile-first Thai travel-planning interface.
- Form for origin, ordered destinations, last destination, date, 1–10 days, traveler count, budget, fuel type, preferences and notes.
- Rule-based automatic timetable using a starter catalog covering 14 Thailand travel hubs, with Google Maps links for manual verification.
- Editable itinerary: add, reorder or remove a stop; switch days.
- Budget calculation: group lodging, per-person food, miscellaneous and estimated fuel.
- Fuel prices from ../trip-huahin-2026/fuel-prices.json, with dated fallback values.
- Simple command parser for a small number of instructions. Not an LLM.
- Trip save and retrieval using localStorage on the current browser.
- Sharing through a URL encoding input parameters; anyone with the link can read the input.
- Automated Chromium smoke tests for desktop, mobile, trips, budget and storage.

## Known limitations
- No actual generative AI, Google Places/Routes integration, live hotel availability or bookings.
- No user accounts, cloud database, or multi-device sync yet.
- Distance estimation uses great-circle distances between city centers, multiplied by 1.35, plus 20 km/day. **It is not driving distance.**
- Times and attraction listings are suggestions; opening hours/admission must be verified directly.
- Unknown destinations show an honest fallback to manual Google Maps search, not invented attraction information.
- Never enter personal secrets in shared plans or notes.
- This prototype is temporarily hosted within satelliteproject because GitHub connector does not expose repository creation.

## Public MVP next development steps
1. Create a new standalone GitHub repository and build the frontend using React + Vite + TypeScript.
2. Create a separate Supabase project for travel data: Auth, PostgreSQL and locked-down RLS.
3. Create versioned trip and places schemas, server-side CRUD and safe public read-only sharing.
4. Connect commercially appropriate Places, Routing and Weather APIs; add provider source timestamps and attribution.
5. Connect an LLM via authenticated Supabase Edge Functions with structured JSON output.
6. Apply deterministic validation to all AI-generated itineraries (travel times, city order, dates, budgets and place authenticity).
7. Add rate limits, abuse prevention, quotas, privacy policy, telemetry and cost controls before a wider public launch.

## Production API interface (planned, not yet live)
- POST /v1/trips/plan — validated request -> draft itinerary + uncertainties.
- POST /v1/trips/{id}/revise — proposed AI revision, awaiting user approval.
- POST /v1/trips/{id}/accept — persist approved changes.
- GET /v1/trips/{id} — owner-only trip retrieval.
- POST /v1/trips/{id}/share — revocable, opaque share token.
- GET /v1/shares/{token} — a limited read-only view.

A Supabase SQL baseline is maintained in backend/schema.sql. Do not apply to the existing forestry or affiliate projects.
