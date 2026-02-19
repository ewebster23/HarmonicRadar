# Harmonic Radar (WSL-Friendly Web MIDI)

A browser-based MIDI monitor that now includes:

- live MIDI input detection
- last note display (for example `E♭4`)
- jazz/lead-sheet chord symbols (`Δ`, `ø`, `°`, `♭`, `♯`)
- upper extensions (`9`, `11`, `13`) and alterations
- inversion + slash-bass labeling
- ranked alternative chord names
- interval-based, key-agnostic chord logic (transposition invariant)
- real-time musical staff display
- real-time virtual keyboard display

## Quick start

1. From WSL in this folder, run:

```bash
python3 -m http.server 5173
```

2. In Windows Chrome or Edge, open:

```text
http://localhost:5173
```

3. Click `Connect MIDI` and allow permission.
4. Play or hold voicings on your keyboard/controller.
5. Staff and keyboard visualizers are shown by default.

## Notes for WSL

Web MIDI runs inside the browser process. If you use Chrome/Edge on Windows, MIDI hardware access happens through Windows directly while WSL just serves files.

## Chord rules

The chord naming/ranking rules are documented in:

- `CHORD_RULES.md`
