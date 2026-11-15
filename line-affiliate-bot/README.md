# Ken LINE Bot — Central LINE Notification

One LINE Official Account (the existing "Ken Affiliate Alert" OA) receives
notifications from every system. LINE credentials live only in this Vercel project.

## Endpoints
| Path | Purpose |
|---|---|
| `POST /api/notify` | Central push API for all systems |
| `POST /api/line/webhook` | LINE webhook: file intake to Drive, tap-to-ask menus, owner assistant |
| `POST /api/setup-richmenu` | One-off: create the bottom rich menus (Bearer `MAP_NOTIFY_SECRET`) |
| `GET /api/health` | Health check |
| `/api/cron/morning`, `/api/line/send` | Retired affiliate alerts (return 410) |

## Vercel environment variables
| Name | Used by |
|---|---|
| `LINE_CHANNEL_ACCESS_TOKEN` | push + reply |
| `LINE_CHANNEL_SECRET` | webhook signature |
| `LINE_USER_ID` | push recipient |
| `MAP_NOTIFY_SECRET` | auth for `/api/notify` and `/api/setup-richmenu` (random, never the LINE token) |
| `DRIVE_UPLOAD_URL` | Apps Script web app URL (`apps-script/line-intake.gs`) |
| `DRIVE_UPLOAD_SECRET` | shared secret with the Apps Script (Script Properties) |
| `ANTHROPIC_API_KEY` | optional: AI answers for the owner (falls back to plain summaries) |

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

## File intake (LINE → Google Drive)
1. Anyone sends a file (PDF, image, zip… up to 20 MB) to the bot in a 1:1 chat or a group.
2. The file is staged in `ข้อมูลรอตรวจ/_รอเลือกหัวข้อ`; the bot asks once per batch which job it is.
   Buttons = subfolders of `ข้อมูลรอตรวจ` whose names don't start with `_` (max 13).
3. On tap, files move to `<topic>/<พ.ศ. date>/`, zip files are extracted next to the zip, and every
   file is logged in the `_LINE ส่งงาน (log)` spreadsheet. The sender gets one reply, with a
   "📅 เปลี่ยนวันที่" date picker. Nobody else is notified.
4. Group chat text is ignored; the bot only reacts to files there.

## Menus and owner assistant
- Rich menu (bottom): everyone gets วิธีส่งงาน / หัวข้องาน / งานที่ฉันส่ง; the owner (`LINE_USER_ID`)
  gets ใครส่งงาน / ปฏิทิน / ถาม AI / หัวข้องาน / งานวันนี้ / วิธีส่งงาน. Each tap sends that text.
- Owner commands: `ใครส่งงาน [หัวข้อ]`, `งานวันนี้`, `ปฏิทิน [2569-10]` (Flex month view),
  `ถาม AI`, or any question → Claude (`claude-opus-5-5`, effort low) answers from the log.
  File names and sender names in the log are sent to the Anthropic API for those answers.
- Rich menu images: `assets/richmenu-*.jpg` (regenerate with `python assets/make_richmenu.py`,
  or replace with designed images of the same size: owner 2500×1686 in a 3×2 grid, user 2500×843 in a 3×1 grid).
