from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.lib.colors import HexColor

PAGE_W, PAGE_H = A4

INK = HexColor("#151922")
MUTED = HexColor("#5B6472")
LINE = HexColor("#C7CDD6")
BOX_BG = HexColor("#F2F5F8")
BOX_BG_ALT = HexColor("#EAF3EE")
ACCENT = HexColor("#1F6F54")
ACCENT2 = HexColor("#B24A2C")
WHITE = HexColor("#FFFFFF")

FONT = "Helvetica"
FONT_B = "Helvetica-Bold"

TOTAL_PAGES = 5

def wrap(c, text, font, size, max_w):
    c.setFont(font, size)
    words = text.split(" ")
    lines, cur = [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if stringWidth(trial, font, size) <= max_w:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines

def box(c, x, y, w, h, title, body, fill=BOX_BG, title_color=INK, num=None, num_color=ACCENT):
    c.setFillColor(fill)
    c.setStrokeColor(LINE)
    c.roundRect(x, y, w, h, 4*mm, fill=1, stroke=1)
    pad = 4*mm
    tx = x + pad
    ty = y + h - pad - 3*mm

    if num is not None:
        r = 4.2*mm
        cx, cy = x + pad + r, y + h - pad - r + 0.5*mm
        c.setFillColor(num_color)
        c.circle(cx, cy, r, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont(FONT_B, 9)
        c.drawCentredString(cx, cy - 3.1, str(num))
        tx = cx + r + 3*mm

    c.setFillColor(title_color)
    c.setFont(FONT_B, 10.5)
    c.drawString(tx, ty, title)

    c.setFillColor(MUTED)
    lines = wrap(c, body, FONT, 8.6, w - (tx - x) - pad)
    ly = ty - 5.2*mm
    for ln in lines:
        c.setFont(FONT, 8.6)
        c.drawString(tx, ly, ln)
        ly -= 3.9*mm

def arrow_down(c, x, y_top, y_bottom, color=ACCENT):
    c.setStrokeColor(color)
    c.setLineWidth(1.4)
    c.line(x, y_top, x, y_bottom + 3*mm)
    c.setFillColor(color)
    p = c.beginPath()
    p.moveTo(x - 1.6*mm, y_bottom + 3*mm)
    p.lineTo(x + 1.6*mm, y_bottom + 3*mm)
    p.lineTo(x, y_bottom)
    p.close()
    c.drawPath(p, fill=1, stroke=0)

def section_header(c, x, y, label, color=ACCENT):
    c.setFillColor(color)
    c.setFont(FONT_B, 12.5)
    c.drawString(x, y, label)
    c.setStrokeColor(color)
    c.setLineWidth(1.2)
    c.line(x, y - 2.2*mm, PAGE_W - 18*mm, y - 2.2*mm)

def header_bar(c, subtitle):
    c.setFillColor(INK)
    c.rect(0, PAGE_H - 24*mm, PAGE_W, 24*mm, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont(FONT_B, 16)
    c.drawString(18*mm, PAGE_H - 12.5*mm, "SUBSPACE RESONATOR RADIO")
    c.setFillColor(HexColor("#9FD9BE"))
    c.setFont(FONT_B, 10.5)
    c.drawString(18*mm, PAGE_H - 18.5*mm, subtitle)

def footer(c, page_n):
    c.setFillColor(MUTED)
    c.setFont(FONT, 7.5)
    c.drawString(18*mm, 10*mm, "Open this before every broadcast  •  subspaceresonator.com/radio")
    c.drawRightString(PAGE_W - 18*mm, 10*mm, f"Page {page_n} / {TOTAL_PAGES}")

def callout(c, x, y_top, w, title, body, min_h=20*mm):
    body_lines = wrap(c, body, FONT, 8.8, w - 10*mm)
    h = max(min_h, 13*mm + len(body_lines)*4*mm)
    c.setFillColor(BOX_BG_ALT)
    c.roundRect(x, y_top - h, w, h, 4*mm, fill=1, stroke=0)
    c.setFillColor(ACCENT2)
    c.setFont(FONT_B, 10)
    c.drawString(x + 5*mm, y_top - 8*mm, title)
    c.setFillColor(MUTED)
    c.setFont(FONT, 8.8)
    for i, ln in enumerate(body_lines):
        c.drawString(x + 5*mm, y_top - 13*mm - i*4*mm, ln)
    return h

c = canvas.Canvas("Voicemeeter-Broadcast-Guide.pdf", pagesize=A4)
bx, bw = 18*mm, PAGE_W - 36*mm

# ---------------- PAGE 1 ----------------
header_bar(c, "Host Quick Guide  –  Voicemeeter Wiring + Go Live Flow")

y = PAGE_H - 32*mm
section_header(c, 18*mm, y, "A.  Wire Voicemeeter Before You Play")
c.setFillColor(MUTED)
c.setFont(FONT, 8.8)
c.drawString(18*mm, y - 7*mm, "One-time setup. Quick check every time before you open the console.")

bh = 17*mm
y1 = y - 15*mm
box(c, bx, y1 - bh, bw, bh, "Rekordbox output device",
    "Preferences > Audio > set output device to “Voicemeeter Input” (same name on Standard, Banana, and Potato).",
    num=1)

arrow_down(c, PAGE_W/2, y1 - bh, y1 - bh - 9*mm)

y2 = y1 - bh - 9*mm
box(c, bx, y2 - bh, bw, bh, "Voicemeeter mixer",
    "That strip's fader is up (not muted) and routed to bus B1.",
    fill=BOX_BG_ALT, num=2, num_color=ACCENT2)

arrow_down(c, PAGE_W/2, y2 - bh, y2 - bh - 9*mm)

y3 = y2 - bh - 9*mm
box(c, bx, y3 - bh, bw, bh, "Browser AUDIO INPUT dropdown",
    "On the host console, pick “Voicemeeter Output (VB-Audio Voicemeeter VAIO)”, this is what listeners will hear.",
    num=3)

# ---------------- Section B ----------------
y = y3 - bh - 16*mm
section_header(c, 18*mm, y, "B.  Go-Live Flow")
c.setFillColor(MUTED)
c.setFont(FONT, 8.8)
c.drawString(18*mm, y - 7*mm, "Follow top to bottom on the host console at /radio.html#admin.")

steps = [
    "Open /radio.html#admin and log in as host.",
    "Click ENABLE AUDIO ACCESS (first time only).",
    "Pick Voicemeeter Output in the AUDIO INPUT dropdown.",
    "Play a test track in Rekordbox, confirm the INPUT LEVEL meter moves.",
    "Adjust GAIN if the meter is too quiet or clipping red.",
    "Type in the BROADCAST TITLE.",
    "Leave LISTENER BUFFER on default unless you've had cuts before.",
    "Click GO LIVE and wait for CONNECTING...",
    "Confirm ON AIR badge + OUTPUT LEVEL meter + listener count.",
    "When finished, click END BROADCAST.",
]

col_w = (bw - 10*mm) / 2
row_h = 20*mm
top = y - 14*mm
for i, s in enumerate(steps):
    col = i // 5
    row = i % 5
    sx = bx + col * (col_w + 10*mm)
    sy = top - row * (row_h + 4*mm)
    box(c, sx, sy - row_h, col_w, row_h, f"Step {i+1}", s, num=i+1,
        fill=BOX_BG_ALT if i == 7 else BOX_BG,
        num_color=ACCENT2 if i == 7 else ACCENT)
    if row < 4:
        arrow_down(c, sx + col_w/2, sy - row_h, sy - row_h - 4*mm, color=LINE)

footer(c, 1)
c.showPage()

# ---------------- PAGE 2 ----------------
header_bar(c, "Preflight Checklist")
y = PAGE_H - 34*mm
section_header(c, 18*mm, y, "C.  Tick Every Box Before You Announce")

checklist = [
    "Rekordbox output device = Voicemeeter Input",
    "Voicemeeter fader for that strip is up, routed to B1",
    "Browser AUDIO INPUT dropdown = Voicemeeter Output",
    "Test track playing, INPUT LEVEL meter moves in host console",
    "Broadcast title typed in",
    "DJ device and restreamer PC on power, Windows sleep set to Never",
    "Internet stable, no VPN, no other big uploads running",
    "Clicked GO LIVE, ON AIR badge confirmed before announcing",
]

item_h = 14*mm
cy = y - 13*mm
for i, item in enumerate(checklist):
    box_size = 6.5*mm
    c.setStrokeColor(ACCENT)
    c.setLineWidth(1.4)
    c.setFillColor(WHITE)
    c.roundRect(18*mm, cy - item_h + (item_h-box_size)/2, box_size, box_size, 1.2*mm, fill=1, stroke=1)
    c.setFillColor(INK)
    c.setFont(FONT, 11)
    lines = wrap(c, item, FONT, 11, PAGE_W - 18*mm - 30*mm - 18*mm)
    ly = cy - item_h/2 + (len(lines)-1)*2.6*mm
    for ln in lines:
        c.drawString(30*mm, ly, ln)
        ly -= 5.2*mm
    if i < len(checklist) - 1:
        c.setStrokeColor(LINE)
        c.setLineWidth(0.6)
        c.line(18*mm, cy - item_h, PAGE_W - 18*mm, cy - item_h)
    cy -= item_h

note_y = cy - 6*mm
callout(c, bx, note_y, bw, "If it cuts out mid-broadcast:",
        "On plain WebRTC (restreamer off), a listener's phone screen-lock or sleep stops their audio. "
        "That is a known platform limit, not a bug. Run the deep-buffer restreamer (section E) and "
        "listeners ride through screen-lock and weak signal. Either way keep the DJ device and the "
        "restreamer PC awake and on power for the whole set.",
        min_h=26*mm)

footer(c, 2)
c.showPage()

# ---------------- PAGE 3 : Spotify ----------------
header_bar(c, "Host Quick Guide  –  Spotify Desktop App Setup")
y = PAGE_H - 32*mm
section_header(c, 18*mm, y, "D.  Stream Spotify Desktop App to Voicemeeter")
c.setFillColor(MUTED)
c.setFont(FONT, 8.8)
c.drawString(18*mm, y - 7*mm,
    "Own tracks, non-commercial community radio use. Windows 11 only (per-app output routing). One-time setup, then reuse.")

d_steps = [
    ("Windows Volume Mixer, per-app output",
     "Settings > System > Sound > Volume mixer > find Spotify > Output device dropdown > set to “Voicemeeter "
     "Input (VB-Audio Voicemeeter VAIO)”. Only Spotify moves to Voicemeeter, headphones and everything else "
     "stay on your normal output device."),
    ("Voicemeeter mixer",
     "Strip receiving Spotify: fader up, not muted, routed to bus B1. Optional: also route to A1 to monitor "
     "locally through headphones while broadcasting."),
    ("Host console AUDIO INPUT dropdown",
     "On the host console at /radio.html#admin, pick “Voicemeeter Output (VB-Audio Voicemeeter VAIO)”, "
     "same device as the Rekordbox flow. This is what listeners will hear."),
    ("Test before going live",
     "Play a track in Spotify, confirm the INPUT LEVEL meter moves in the host console. Open /radio in a second "
     "browser/tab as a listener and confirm you hear it before clicking GO LIVE for real."),
]
dh = 21*mm
dy = y - 14*mm
for i, (t, b) in enumerate(d_steps):
    box(c, bx, dy - dh, bw, dh, t, b, num=i+1,
        fill=BOX_BG_ALT if i == 3 else BOX_BG,
        num_color=ACCENT2 if i == 3 else ACCENT)
    if i < len(d_steps) - 1:
        arrow_down(c, PAGE_W/2, dy - dh, dy - dh - 6*mm)
    dy = dy - dh - 6*mm

callout(c, bx, dy - 4*mm, bw, "Windows 10 note",
        "Per-app output device picker is Windows 11 only. On Windows 10, set the system default playback device "
        "to Voicemeeter Input instead, headphones/system sounds will also route through Voicemeeter until you "
        "switch it back.", min_h=22*mm)

footer(c, 3)
c.showPage()

# ---------------- PAGE 4 : Deep-buffer restreamer ----------------
header_bar(c, "Host Quick Guide  –  Deep-Buffer Restreamer")
y = PAGE_H - 32*mm
section_header(c, 18*mm, y, "E.  Deep-Buffer Restreamer (recommended)")
c.setFillColor(MUTED)
c.setFont(FONT, 8.8)
c.drawString(18*mm, y - 7*mm,
    "Gives listeners a smooth stream that survives weak signal and a phone screen-lock. Off = plain WebRTC, site unchanged.")

e_steps = [
    ("Before Go Live: start the restreamer",
     "Double-click start-restreamer.bat. A black window opens and stays open. Leave it open the whole show."),
    ("Go Live as normal",
     "Run the Voicemeeter + Go-Live flow on pages 1-2 exactly as always."),
    ("Wait for the deep buffer to turn on",
     "Watch the DEEP BUFFER badge beside ON AIR in the console: amber STARTING, then green ON, about 30 "
     "seconds after Go Live. Green reads the same from any device, so you do not need to be at that PC."),
    ("Now send the guest link",
     "Guests get instant sound and then upgrade to the deep buffer on their own. Anyone already waiting upgrades too."),
    ("End of show",
     "Click END BROADCAST, then close the black window. Everyone falls back to plain WebRTC, no site change."),
]
eh = 17*mm
ey = y - 14*mm
for i, (t, b) in enumerate(e_steps):
    box(c, bx, ey - eh, bw, eh, t, b, num=i+1,
        fill=BOX_BG_ALT if i == 4 else BOX_BG,
        num_color=ACCENT2 if i == 4 else ACCENT)
    if i < len(e_steps) - 1:
        arrow_down(c, PAGE_W/2, ey - eh, ey - eh - 5*mm, color=LINE)
    ey = ey - eh - 5*mm

h1 = callout(c, bx, ey - 4*mm, bw, "DJ from your phone or another computer",
        "The restreamer PC and the DJ device are separate. Go Live from any device with internet (phone browser, "
        "second laptop). The restreamer finds your show by its Cloudflare session id, not by which device you are on. "
        "Only rule: one PC must run the black window the whole show. Someone else switching Windows users on that PC "
        "is safe, it uses no sound card; signing you out or shutting down is not.", min_h=26*mm)

callout(c, bx, ey - 4*mm - h1 - 5*mm, bw, "What the DEEP BUFFER badge means",
        "Grey OFF = no deep-buffer stream, listeners on plain WebRTC. Amber STARTING = coming up, wait. "
        "Green ON = listeners have the deep buffer, send the guest link. Amber STALLED = the restreamer PC died or "
        "slept; listeners fall back to plain WebRTC on their own, never silence. Set Windows sleep to Never while "
        "plugged in. The badge re-checks the stream every 10s, so green never lies.",
        min_h=28*mm)

footer(c, 4)
c.showPage()

# ---------------- PAGE 5 : Leaving the PC while on air ----------------
header_bar(c, "Host Quick Guide  -  Leaving The PC While On Air")
y = PAGE_H - 32*mm
section_header(c, 18*mm, y, "F.  What You May And May Not Do Mid-Show")
c.setFillColor(MUTED)
c.setFont(FONT, 8.8)
c.drawString(18*mm, y - 7*mm,
    "Tested on the live site. The proof is always a listener device, never the host meters.")

f_steps = [
    ("Lock the screen (Windows key + L).  SAFE",
     "Proven on air: a listener on mobile data kept hearing the music for over 7 minutes with the host PC "
     "locked. Your Windows session stays alive and audio keeps flowing. This is the only safe way to walk "
     "away from the PC.", True),
    ("Switch to another Windows user.  SILENT SHOW",
     "Windows hands the sound card to whoever logs in next. Voicemeeter goes quiet, but the console still "
     "reads ON AIR and no warning appears anywhere. Listeners get silence and you will not know. Do not do it.",
     False),
    ("Log out of Windows.  SHOW OVER",
     "Logging out closes everything in your session: the browser, Voicemeeter and the restreamer window. "
     "Listeners immediately get a connection error. Nothing can survive this, there is no setting that helps.",
     False),
    ("Let the PC sleep or hibernate.  SHOW OVER",
     "Same result as logging out. Set Windows sleep to Never while plugged in before the show starts.", False),
]
fh = 21*mm
fy = y - 14*mm
for i, (t, b, safe) in enumerate(f_steps):
    box(c, bx, fy - fh, bw, fh, t, b, num=i+1,
        fill=BOX_BG_ALT if safe else BOX_BG,
        num_color=ACCENT if safe else ACCENT2)
    fy = fy - fh - 5*mm

h1 = callout(c, bx, fy - 2*mm, bw, "Never refresh the host tab",
        "Reloading or closing the broadcast tab ends the show instantly, the same as clicking END BROADCAST. "
        "If something looks wrong on screen, leave the tab alone and check a listener device first.",
        min_h=22*mm)

callout(c, bx, fy - 2*mm - h1 - 5*mm, bw, "If you logged out by mistake",
        "1. Log back into Windows.  2. Start Voicemeeter first, then the browser.  3. Open the host console and "
        "click DOWNLOAD CHAT LOG to save the chat.  4. Click END BROADCAST to clear the stuck session.  "
        "5. Go Live again as normal. Listeners rejoin from the guest link.", min_h=26*mm)

footer(c, 5)
c.showPage()
c.save()
print("done")
