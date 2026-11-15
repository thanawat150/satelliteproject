# Ken LINE Bot — Central LINE Notification

One LINE Official Account (the existing "Ken Affiliate Alert" OA) receives
notifications from every system. LINE credentials live only in this Vercel project.

## Endpoints
| Path | Purpose |
|---|---|
| `POST /api/notify` | Central push API for all systems |
| `POST /api/line/webhook` | LINE webhook (signature checked; `userid`, `เมนู`) |
| `GET /api/health` | Health check |
| `/api/cron/morning`, `/api/line/send` | Retired affiliate alerts (return 410) |

## Vercel environment variables
| Name | Used by |
|---|---|
| `LINE_CHANNEL_ACCESS_TOKEN` | push + reply |
| `LINE_CHANNEL_SECRET` | webhook signature |
| `LINE_USER_ID` | push recipient |
| `MAP_NOTIFY_SECRET` | auth for `/api/notify` (random, never the LINE token) |

No longer used (safe to remove later): `CRON_SECRET`, `LINE_REMINDER_SECRET`.

## Adding a new system
No LINE setup is needed. Call the API with the shared secret and your system's name:

```bash
curl -X POST https://satelliteproject-line-affiliate-bot.vercel.app/api/notify \
  -H "Authorization: Bearer $MAP_NOTIFY_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"source":"Satellite Monitoring","title":"ประมวลผลเสร็จ","text":"...","level":"success"}'
```

Fields: `source` (required), `title`, `text`, `level` (`info|success|warning|error`),
`image_url` / `preview_url` (public HTTPS only; LINE cannot receive PDFs or local files).
Shown in LINE as `<icon> [source] title` followed by the text.

Python helper (stdlib only): `D:\createmap\OpenAreas_AI\ai_model\line_notify.py`
— `send_line(text, source="...", title="...", level="...")`, reads
`LINE_NOTIFY_URL` and `MAP_NOTIFY_SECRET` from the environment.
