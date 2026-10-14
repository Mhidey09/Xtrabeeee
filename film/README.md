# THE INTERNET COURT: Internet Court × GenLayer product film

An 80-second, 16:9, 1920×1080 / 30 fps animated film. It explains how **MetaMask** permissions, **Internet Court** and **GenLayer's AI jury** relate to one another, built around one question:

> **"The agent followed the rules. So why was it wrong?"**

## What is in this folder

| Path | What it is | Status |
|---|---|---|
| `build/the-internet-court.mp4` | Finished film: picture, voiceover, music and sound design mixed | **Rendered** |
| `index.html`, `src/film.js` | The film itself: a deterministic Three.js scene with an HTML type layer. `renderAt(t)` draws any frame. | Source |
| `audio/make_audio.py` | Synthesized score, sound design and final mix (numpy, no samples) | Source |
| `audio/vo_*.wav`, `audio/vo_lines.json` | Voiceover lines, neural TTS (Kokoro, voice `af_heart`) | **Rendered** |
| `audio/mix.flac`, `music.flac`, `sfx.flac` | Final stereo mix plus music and SFX stems, 48 kHz (`make_audio.py` writes the `.wav` working copies) | **Rendered** |
| `assets/logos/` | The official MetaMask and GenLayer logos, used unmodified. The one exception is the GenLayer mark, keyed from white to transparent with its geometry unchanged. Internet Court appears as typography only, because no official Internet Court logo was supplied. | Assets |
| `tools/` | Still renderer, full-film renderer and contact-sheet helper | Tooling |
| `PRODUCTION.md` | Shot list, timing plan, script, fact sheet and QA review | Docs |

## Re-rendering

```bash
cd film
npm install                      # three, fonts, playwright (uses the preinstalled Chromium)
python audio/make_audio.py       # needs numpy + soundfile; writes audio/mix.wav
node tools/render.mjs 3 30       # 3 parallel workers at 30 fps -> build/the-internet-court.mp4
FRAMES=1480:1620 node tools/render.mjs 3 30   # re-render just a frame range (build/seg*.mp4) to splice in
node tools/stills.mjs out 4.6 21.6 47.8   # spot-check individual frames
```

To preview the film in a browser, open `index.html?preview` from a static server (`npx serve film`). To jump to a time, use `index.html?t=47.8`.

To regenerate the voiceover, run Kokoro-82M (`kokoro-onnx`) with voice `af_heart` at speed 0.97 over `audio/vo_lines.json`.
