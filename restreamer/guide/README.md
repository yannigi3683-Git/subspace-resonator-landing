# Host Quick Guide PDF

`Voicemeeter-Broadcast-Guide.pdf` is the printable host operation manual (5 pages):

1. A. Wire Voicemeeter + B. Go-Live flow
2. C. Preflight checklist
3. D. Spotify desktop-app routing
4. E. Deep-buffer restreamer routine + DJ-from-any-device notes
5. F. Leaving the PC while on air: lock is safe, switch-user goes silent, logout/sleep ends the show

## Rebuild

`build_guide.py` generates the whole PDF (reportlab, A4). Edit the text/steps in that script,
then:

```
pip install reportlab
python build_guide.py          # writes Voicemeeter-Broadcast-Guide.pdf next to the script
```

The working copy lives on the desktop; copy the rebuilt file there after editing. Keep this
README, `build_guide.py`, and the PDF in sync when the broadcast flow changes.
