from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER

OUTPUT = "Subspace-Resonator-Transmission-Quality.pdf"

BG       = colors.HexColor("#0E0E10")
SURFACE  = colors.HexColor("#161618")
BORDER   = colors.HexColor("#2a2a2e")
ACCENT   = colors.HexColor("#7c5cfc")
DIM      = colors.HexColor("#555560")
WHITE    = colors.HexColor("#E8E8F0")
SUBTEXT  = colors.HexColor("#9090a0")
GREEN    = colors.HexColor("#22c55e")

doc = SimpleDocTemplate(
    OUTPUT,
    pagesize=A4,
    leftMargin=18*mm, rightMargin=18*mm,
    topMargin=18*mm, bottomMargin=18*mm,
)

def bg_canvas(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(BG)
    canvas.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)
    canvas.restoreState()

title_style = ParagraphStyle("title",
    fontName="Helvetica-Bold", fontSize=18, textColor=WHITE,
    spaceAfter=2*mm, leading=22)

sub_style = ParagraphStyle("sub",
    fontName="Helvetica", fontSize=9, textColor=SUBTEXT,
    spaceAfter=6*mm, leading=13)

label_style = ParagraphStyle("label",
    fontName="Helvetica-Bold", fontSize=8, textColor=ACCENT,
    spaceBefore=8*mm, spaceAfter=3*mm, leading=12)

note_style = ParagraphStyle("note",
    fontName="Helvetica", fontSize=8, textColor=SUBTEXT,
    spaceAfter=3*mm, leading=13)

highlight_style = ParagraphStyle("highlight",
    fontName="Helvetica-Bold", fontSize=8, textColor=GREEN, leading=12)

COL_HEADER = colors.HexColor("#1a1a1e")

def make_table(headers, rows, col_widths, highlight_col=None):
    data = [headers] + rows
    t = Table(data, colWidths=col_widths, repeatRows=1)

    base = [
        ("BACKGROUND",    (0,0), (-1,0),  COL_HEADER),
        ("BACKGROUND",    (0,1), (-1,-1), SURFACE),
        ("TEXTCOLOR",     (0,0), (-1,0),  ACCENT),
        ("TEXTCOLOR",     (0,1), (-1,-1), WHITE),
        ("FONTNAME",      (0,0), (-1,0),  "Helvetica-Bold"),
        ("FONTNAME",      (0,1), (-1,-1), "Helvetica"),
        ("FONTSIZE",      (0,0), (-1,-1), 8),
        ("ALIGN",         (0,0), (-1,-1), "CENTER"),
        ("ALIGN",         (0,0), (0,-1),  "LEFT"),
        ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
        ("TOPPADDING",    (0,0), (-1,-1), 5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ("LEFTPADDING",   (0,0), (-1,-1), 5),
        ("RIGHTPADDING",  (0,0), (-1,-1), 5),
        ("GRID",          (0,0), (-1,-1), 0.4, BORDER),
        ("ROWBACKGROUNDS",(0,1), (-1,-1), [SURFACE, colors.HexColor("#131315")]),
    ]

    if highlight_col is not None:
        base += [
            ("BACKGROUND",  (highlight_col,0), (highlight_col,-1), colors.HexColor("#1c1830")),
            ("TEXTCOLOR",   (highlight_col,1), (highlight_col,-1), GREEN),
            ("FONTNAME",    (highlight_col,1), (highlight_col,-1), "Helvetica-Bold"),
        ]

    t.setStyle(TableStyle(base))
    return t

story = []

story.append(Paragraph("SUBSPACE RESONATOR", title_style))
story.append(Paragraph("Transmission Quality Reference  -  June 2026", sub_style))

story.append(Paragraph("CORE COMPARISON", label_style))

h1 = ["", "SR Opus", "MP3 128k", "MP3 320k", "AAC 128k", "FLAC", "WAV"]
r1 = [
    ["Codec",            "Opus",          "MP3",    "MP3",         "AAC-LC",       "FLAC",         "PCM"],
    ["Type",             "Lossy",         "Lossy",  "Lossy",       "Lossy",        "Lossless",     "Lossless"],
    ["Bitrate",          "40-128 kbps",   "128k",   "320k",        "128k",         "400-1400k",    "1411k"],
    ["Sample Rate",      "48,000 Hz",     "44,100", "44,100",      "44,100",       "up to 192k",   "up to 192k"],
    ["Bit Depth",        "16-bit",        "16-bit", "16-bit",      "16-bit",       "16 or 24-bit", "16 or 24-bit"],
    ["File / 1 min",     "~1 MB",         "~1 MB",  "~2.4 MB",     "~1 MB",        "~8-15 MB",     "~10 MB (CD)"],
    ["Perceptual Qual.", "Near-WAV",      "Audible artifacts", "Near-transparent", "Better than MP3 128k", "Identical to source", "Identical to source"],
    ["Live / Real-time", "Yes (WebRTC)",  "No",     "No",          "No",           "No",           "No"],
    ["Latency",          "0.5 - 2 s",     "0 (file)", "0 (file)", "0 (file)",     "0 (file)",     "Not practical"],
    ["Loss Resilience",  "FEC + AIMD",    "No",     "No",          "No",           "No",           "No"],
    ["Streaming",        "Excellent",     "OK",     "Poor (bw)",   "Good",         "Poor (bw)",    "Not practical"],
]
cw1 = [36*mm, 26*mm, 21*mm, 21*mm, 21*mm, 21*mm, 21*mm]
story.append(make_table(h1, r1, cw1, highlight_col=1))

story.append(Paragraph("ADAPTIVE QUALITY PRESETS", label_style))

h2 = ["Preset", "Bitrate Ceiling", "Adaptive Floor", "Label", "Equivalent To"]
r2 = [
    ["STABLE",   "64 kbps",  "40 kbps", "HI-FI BROADCAST",  "FM Radio quality (stereo Opus)"],
    ["BALANCED", "96 kbps",  "40 kbps", "CD-GRADE STREAM",  "Better than MP3 320k at half the bitrate"],
    ["HQ",       "128 kbps", "40 kbps", "NEAR-WAV QUALITY", "Matches / beats MP3 320k perceptually"],
]
cw2 = [24*mm, 28*mm, 28*mm, 36*mm, 51*mm]
story.append(make_table(h2, r2, cw2, highlight_col=None))

story.append(Paragraph("ADAPTIVE BACKOFF (AIMD)", label_style))

h3 = ["Packet Loss",  "Action",              "Result"]
r3 = [
    ["> 5%",          "Bitrate x 0.6 (hard cut)", "Drops fast, stays audible"],
    ["2 - 5%",        "Bitrate x 0.8 (ease off)", "Gradual reduction"],
    ["< 0.5%",        "Bitrate +12 kbps",          "Slow recovery toward ceiling"],
    ["0.5 - 2%",      "Hold current bitrate",       "Stable hold"],
    ["At floor 40k",  "Never drops lower",          "Stream survives severe congestion"],
]
cw3 = [32*mm, 56*mm, 79*mm]
story.append(make_table(h3, r3, cw3))

story.append(Spacer(1, 8*mm))
story.append(Paragraph(
    "KEY INSIGHT:  Opus 128k matches MP3 320k perceptually while streaming at 2.5x less bandwidth. "
    "Unlike MP3 / AAC / FLAC streams, packet loss triggers graceful adaptive backoff with inband FEC "
    "rather than a hard drop-out. The stream degrades gracefully; it never just cuts.",
    note_style))

doc.build(story, onFirstPage=bg_canvas, onLaterPages=bg_canvas)
print(f"Written: {OUTPUT}")
