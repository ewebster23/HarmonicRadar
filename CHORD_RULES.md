# Chord Naming Rules (Practical Jazz/Pop)

This project now uses a rule-based chord parser designed to prioritize readable lead-sheet names.

## Naming priorities

1. Prefer common chart spellings over exotic-but-possible parses.
2. Treat slash chords as intentional upper-structure voicings when there is a clear upper chord.
3. Use extension numbers (`9`, `11`, `13`) when musically justified.
4. Keep alternative valid names available, but rank the most practical one first.

## Core rules

1. All detection is interval-based and transposition invariant (no note-specific logic).
2. A `1-3-5` structure is major quality regardless of key center.
3. Base quality is identified first (`major`, `minor`, `aug`, `dim`, `sus4`, `sus2`, `power`).
4. Seventh quality (`7`, `Δ7`, `ø7`, `°7`) is added when present.
5. `9/11/13` are preferred for upper extensions when:
   - a seventh quality exists, or
   - the note is voiced above the octave relative to the root.
6. Without seventh context, extension colors are written with `add` (`add9`, `add11`, `add13`) unless a strict suspension is clearer.
7. Symbols use glyphs: `Δ`, `ø`, `°`, `♭`, `♯`.

## Slash-chord rules

1. If the bass is not the root, slash notation is used.
2. If removing the bass reveals a clear upper triad, that upper-structure slash reading is ranked strongly.
3. Inversions are labeled only when the bass is a chord tone; otherwise the label is `slash bass (...)`.
4. Ambiguous suspended dominant reads are de-prioritized when they require omitted essential tones and a simpler spelling exists.

## Root detection for inversions

1. Root choice is not bass-first; it is scored by tertian completeness (`root-3rd-5th-7th`) across all candidate roots.
2. Following standard theory guidance, candidates that form stacked thirds are ranked above non-tertian spellings.
3. Bass note still matters, but only as a secondary readability signal after harmonic completeness.
4. This is why `G-B-C-E` is ranked as `CΔ7/G` (2nd inversion) instead of `G6(add4)`.

## Example: `C, G, D` vs `D7/C`

For `C-G-D` voicings, the parser favors a `C`-root reading (`Cadd9`/`Csus2` depending register cues) and de-prioritizes `D7/C`-style interpretations unless the dominant quality is more explicit.

## References consulted

- Open Music Theory, chord symbol conventions:
  - https://viva.pressbooks.pub/openmusictheory/chapter/chord-symbols/
- Open Music Theory, alternate chord symbol chapter:
  - https://viva.pressbooks.pub/openmusictheory/chapter/chord-symbols-version-2/
- music21 chord root heuristic (root with the most thirds above):
  - https://www.music21.org/music21docs/moduleReference/moduleChord.html
- MusicXML chord-kind vocabulary (industry chord symbol taxonomy):
  - https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/kind/
