# -*- coding: utf-8 -*-
"""แสดง "งานที่จด" จากบอท LINE น้องโกงกาง ตอนล็อกอิน Windows

ดึงรายการงานที่ยังไม่เสร็จจาก Apps Script (ชีต "งานที่ต้องทำ") แล้วเปิดเป็นหน้าเว็บในเครื่อง
ถ้าไม่มีงานค้าง จะไม่เปิดอะไร
ใช้ env: DRIVE_UPLOAD_SECRET (มีอยู่แล้วใน Windows User env), DRIVE_UPLOAD_URL (ไม่ตั้งก็ได้)
รันมือ:  python show_line_notes.py          (เปิดหน้าแม้ไม่มีงาน: --always)
ตั้งให้รันตอนล็อกอิน: python show_line_notes.py --install   (ยกเลิก: --uninstall)
ใช้แค่ไลบรารีมาตรฐาน
"""
import os, sys, json, time, html, urllib.request, urllib.error, datetime

DEFAULT_URL = "https://script.google.com/macros/s/AKfycbwtrn80kEfj0XHAHH_0Tq2ghRnlHsw22ZN98Gk9wT14aAg4qtpWH5liooTsd5BurAgu/exec"
OUT_DIR = os.path.join(os.environ.get("LOCALAPPDATA", os.path.expanduser("~")), "nong-kongkang")
STARTUP = os.path.join(os.environ.get("APPDATA", ""), r"Microsoft\Windows\Start Menu\Programs\Startup", "น้องโกงกาง งานที่จด.vbs")


def secret():
    s = os.environ.get("DRIVE_UPLOAD_SECRET")
    if not s and sys.platform == "win32":
        import winreg
        try:
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, "Environment") as k:
                s = winreg.QueryValueEx(k, "DRIVE_UPLOAD_SECRET")[0]
        except OSError:
            s = None
    return s


def fetch_notes(retries=6):
    body = json.dumps({"action": "listNotes", "secret": secret()}).encode("utf-8")
    url = os.environ.get("DRIVE_UPLOAD_URL") or DEFAULT_URL
    last = None
    for i in range(retries):  # network may not be ready right after login
        try:
            req = urllib.request.Request(url, data=body, method="POST", headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=40) as r:
                data = json.loads(r.read().decode("utf-8"))
            if not data.get("ok"):
                raise RuntimeError(data.get("error", "unknown"))
            return data.get("notes", [])
        except Exception as e:
            last = e
            time.sleep(10)
    raise RuntimeError(f"ดึงงานที่จดไม่ได้: {last}")


def render(notes):
    now = datetime.datetime.now().strftime("%d/%m/%Y %H:%M")
    items = "\n".join(
        f'<li><span class="n">{i}</span><div><div class="t">{html.escape(n["text"])}</div>'
        f'<div class="m">จดเมื่อ {html.escape(n["at"].replace("T", " "))}</div></div></li>'
        for i, n in enumerate(notes, 1)
    ) or '<li class="empty">ไม่มีงานค้าง 🎉</li>'
    return f"""<!doctype html><html lang="th"><head><meta charset="utf-8">
<title>งานที่จด — น้องโกงกาง</title><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root{{--bg:#f3f8f4;--card:#fff;--ink:#16302a;--muted:#5b6f68;--green:#06c755;--line:#dfeae3}}
@media (prefers-color-scheme:dark){{:root{{--bg:#0f1a16;--card:#17241f;--ink:#e6f2ec;--muted:#9bb0a8;--line:#24352e}}}}
body{{margin:0;background:var(--bg);color:var(--ink);font-family:"Leelawadee UI","Segoe UI",sans-serif}}
main{{max-width:760px;margin:0 auto;padding:28px 16px}}
h1{{margin:0 0 4px;font-size:26px}} .sub{{color:var(--muted);margin:0 0 20px}}
ol{{list-style:none;padding:0;margin:0;display:grid;gap:10px}}
li{{display:flex;gap:14px;align-items:flex-start;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px}}
.n{{flex:none;width:30px;height:30px;border-radius:50%;background:var(--green);color:#fff;display:grid;place-items:center;font-weight:700}}
.t{{font-size:18px;line-height:1.5}} .m{{color:var(--muted);font-size:13px;margin-top:2px}}
.empty{{justify-content:center;color:var(--muted)}}
.tip{{margin-top:20px;color:var(--muted);font-size:14px}}
</style></head><body><main>
<h1>📋 งานที่จดไว้ ({len(notes)} งาน)</h1>
<p class="sub">จากบอท LINE น้องโกงกาง · อัปเดต {now}</p>
<ol>{items}</ol>
<p class="tip">ทำเสร็จแล้ว พิมพ์ <b>เสร็จ &lt;เลข&gt;</b> ในแชตน้องโกงกาง หรือกดปุ่ม ✅ ใน "งานที่จด"</p>
</main></body></html>"""


def install():
    pyw = os.path.join(os.path.dirname(sys.executable), "pythonw.exe")
    if not os.path.exists(pyw):
        pyw = sys.executable
    script = os.path.abspath(__file__)
    vbs = ('Set sh = CreateObject("WScript.Shell")\r\n'
           'WScript.Sleep 20000\r\n'
           f'sh.Run """{pyw}"" ""{script}""", 0, False\r\n')
    with open(STARTUP, "w", encoding="utf-16") as f:
        f.write(vbs)
    print("ตั้งให้รันตอนล็อกอินแล้ว:", STARTUP)


def main():
    if "--install" in sys.argv:
        return install()
    if "--uninstall" in sys.argv:
        if os.path.exists(STARTUP):
            os.remove(STARTUP)
        return print("ยกเลิกแล้ว")
    if not secret():
        raise SystemExit("ไม่พบ DRIVE_UPLOAD_SECRET ใน environment")
    notes = fetch_notes()
    if not notes and "--always" not in sys.argv:
        return
    os.makedirs(OUT_DIR, exist_ok=True)
    out = os.path.join(OUT_DIR, "งานที่จด.html")
    with open(out, "w", encoding="utf-8") as f:
        f.write(render(notes))
    os.startfile(out) if sys.platform == "win32" else print(out)


if __name__ == "__main__":
    main()
