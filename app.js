const connectBtn = document.getElementById('connectBtn');
const statusEl = document.getElementById('status');
const midiInfoEl = document.getElementById('midiInfo');
const settingsToggleEl = document.getElementById('settingsToggle');
const settingsPanelEl = document.getElementById('settingsPanel');
const settingsCloseEl = document.getElementById('settingsClose');
const settingsBackdropEl = document.getElementById('settingsBackdrop');
const typingSoundToggleEl = document.getElementById('typingSoundToggle');
const chordNameEl = document.getElementById('chordName');
const inputsListEl = document.getElementById('inputsList');
const staffCanvasEl = document.getElementById('staffCanvas');
const keyboardCanvasEl = document.getElementById('keyboardCanvas');
const startOverlayEl = document.getElementById('startOverlay');

const NOTE_LABELS = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const INVERSION_NAMES = ['1st inversion', '2nd inversion', '3rd inversion', '4th inversion'];
const COLOR_ORDER = [
  '♭9',
  '9',
  '♯9',
  '11',
  '♯11',
  '♭13',
  '13',
  '♭7',
  'Δ7',
  'add9',
  'add11',
  'add13',
  'add2',
  'add4',
  'add6',
  'add♭3',
  'add3',
  'add♭5',
  'add5',
  'add♭6',
  'add♭7',
  'add7'
];
const KEYBOARD_NOTE_START = 36; // C2
const KEYBOARD_NOTE_END = 96; // C7
const WHITE_PITCH_CLASSES = new Set([0, 2, 4, 5, 7, 9, 11]);
const JAZZ_TEXT_FONT_STACK = '"Finale Jazz Text","Finale Jazz","Bravura Text","Noto Music",serif';
const JAZZ_MUSIC_FONT_STACK = '"Finale Jazz","Finale Jazz Text","Bravura Text","Noto Music",serif';
const SIMPLE_INTERVAL_NAMES = new Map([
  [0, 'unison'],
  [1, 'minor 2nd'],
  [2, 'major 2nd'],
  [3, 'minor 3rd'],
  [4, 'major 3rd'],
  [5, 'perfect 4th'],
  [6, 'tritone'],
  [7, 'perfect 5th'],
  [8, 'minor 6th'],
  [9, 'major 6th'],
  [10, 'minor 7th'],
  [11, 'major 7th']
]);
const STAFF_STEP_MAP = {
  0: { stepOffset: 0, accidental: '' }, // C
  1: { stepOffset: 1, accidental: '♭' }, // D♭
  2: { stepOffset: 1, accidental: '' }, // D
  3: { stepOffset: 2, accidental: '♭' }, // E♭
  4: { stepOffset: 2, accidental: '' }, // E
  5: { stepOffset: 3, accidental: '' }, // F
  6: { stepOffset: 3, accidental: '♯' }, // F♯
  7: { stepOffset: 4, accidental: '' }, // G
  8: { stepOffset: 5, accidental: '♭' }, // A♭
  9: { stepOffset: 5, accidental: '' }, // A
  10: { stepOffset: 6, accidental: '♭' }, // B♭
  11: { stepOffset: 6, accidental: '' } // B
};
const LETTER_ORDER = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_TO_PITCH_CLASS = new Map([
  ['C', 0],
  ['D', 2],
  ['E', 4],
  ['F', 5],
  ['G', 7],
  ['A', 9],
  ['B', 11]
]);
const LETTER_TO_STEP_OFFSET = new Map([
  ['C', 0],
  ['D', 1],
  ['E', 2],
  ['F', 3],
  ['G', 4],
  ['A', 5],
  ['B', 6]
]);
const COMPUTER_KEY_SEQUENCE = ['a', 'w', 's', 'e', 'd', 'f', 't', 'g', 'y', 'h', 'u', 'j', 'k', 'o', 'l', 'p'];
const COMPUTER_KEY_BASE_NOTE = 60; // C4

let midiAccess = null;
const noteCounts = new Map();
const heldComputerKeys = new Set();
const computerKeyToNote = new Map(
  COMPUTER_KEY_SEQUENCE.map((key, index) => [key, COMPUTER_KEY_BASE_NOTE + index])
);
const noteToComputerKey = new Map(
  [...computerKeyToNote.entries()].map(([key, noteNumber]) => [noteNumber, key.toUpperCase()])
);
let typingSoundEnabled = false;
let audioContext = null;
const activeTypingVoices = new Map();
let staffSpellingContext = null;
let musicFontReady = false;
let appStarted = typeof document !== 'undefined'
  ? !document.body.classList.contains('app-locked')
  : true;

function normalizePitchClass(value) {
  return ((value % 12) + 12) % 12;
}

function labelPitchClass(pitchClass) {
  return NOTE_LABELS[normalizePitchClass(pitchClass)];
}

function midiNoteToName(noteNumber) {
  const pitchName = labelPitchClass(noteNumber);
  const octave = Math.floor(noteNumber / 12) - 1;
  return `${pitchName}${octave}`;
}

function isBlackKey(pitchClass) {
  return !WHITE_PITCH_CLASSES.has(normalizePitchClass(pitchClass));
}

function midiNoteToStaffDataDefault(noteNumber) {
  const pitchClass = normalizePitchClass(noteNumber);
  const octave = Math.floor(noteNumber / 12) - 1;
  const map = STAFF_STEP_MAP[pitchClass];
  const step = (octave - 4) * 7 + map.stepOffset;
  return { step, accidental: map.accidental };
}

function midiNoteToFrequency(noteNumber) {
  return 440 * Math.pow(2, (noteNumber - 69) / 12);
}

function accidentalCountToSymbols(accidentalCount) {
  if (accidentalCount === 0) {
    return '';
  }

  if (accidentalCount > 0) {
    return '♯'.repeat(accidentalCount);
  }

  return '♭'.repeat(Math.abs(accidentalCount));
}

function parseSpelledRoot(text) {
  if (!text) {
    return null;
  }

  const match = text.match(/^([A-Ga-g])([♭♯b#]{0,4})/u);
  if (!match) {
    return null;
  }

  const letter = match[1].toUpperCase();
  const accidentalText = match[2] || '';
  let accidentalCount = 0;
  for (const symbol of accidentalText) {
    if (symbol === '♭' || symbol === 'b') {
      accidentalCount -= 1;
    } else if (symbol === '♯' || symbol === '#') {
      accidentalCount += 1;
    }
  }

  const pitchClass = normalizePitchClass(LETTER_TO_PITCH_CLASS.get(letter) + accidentalCount);
  return { letter, accidentalCount, pitchClass };
}

function chooseAccidentalCountForLetter(targetPitchClass, letter, preferredAccidentalCount) {
  const naturalPitchClass = LETTER_TO_PITCH_CLASS.get(letter);
  const base = normalizePitchClass(targetPitchClass - naturalPitchClass);
  let signedBase = base > 6 ? base - 12 : base;
  let best = signedBase;
  let bestDistance = Math.abs(best - preferredAccidentalCount);

  for (const octaveShift of [-12, 0, 12]) {
    const candidate = signedBase + octaveShift;
    if (Math.abs(candidate) > 4) {
      continue;
    }
    const distance = Math.abs(candidate - preferredAccidentalCount);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }

  return best;
}

function getIntervalSpellingSpec(intervalClass, context) {
  if (intervalClass === 0) {
    return { degree: 1, accidentalCount: 0 };
  }
  if (intervalClass === 1) {
    return { degree: 2, accidentalCount: -1 };
  }
  if (intervalClass === 2) {
    return { degree: 2, accidentalCount: 0 };
  }
  if (intervalClass === 3) {
    if (context.hasMajorThird) {
      return { degree: 2, accidentalCount: 1 };
    }
    return { degree: 3, accidentalCount: -1 };
  }
  if (intervalClass === 4) {
    return { degree: 3, accidentalCount: 0 };
  }
  if (intervalClass === 5) {
    return { degree: 4, accidentalCount: 0 };
  }
  if (intervalClass === 6) {
    if (context.preferSharpEleven) {
      return { degree: 4, accidentalCount: 1 };
    }
    return { degree: 5, accidentalCount: -1 };
  }
  if (intervalClass === 7) {
    return { degree: 5, accidentalCount: 0 };
  }
  if (intervalClass === 8) {
    if (context.preferSharpFive) {
      return { degree: 5, accidentalCount: 1 };
    }
    return { degree: 6, accidentalCount: -1 };
  }
  if (intervalClass === 9) {
    if (context.preferDoubleFlatSeven) {
      return { degree: 7, accidentalCount: -2 };
    }
    return { degree: 6, accidentalCount: 0 };
  }
  if (intervalClass === 10) {
    return { degree: 7, accidentalCount: -1 };
  }
  return { degree: 7, accidentalCount: 0 };
}

function midiNoteToStaffDataWithContext(noteNumber, context) {
  if (!context || !context.rootLetter) {
    return midiNoteToStaffDataDefault(noteNumber);
  }

  const notePitchClass = normalizePitchClass(noteNumber);
  const intervalClass = normalizePitchClass(notePitchClass - context.rootPitchClass);
  const spec = getIntervalSpellingSpec(intervalClass, context);
  const rootLetterIndex = LETTER_ORDER.indexOf(context.rootLetter);
  const targetLetter = LETTER_ORDER[(rootLetterIndex + spec.degree - 1) % 7];
  const accidentalCount = chooseAccidentalCountForLetter(notePitchClass, targetLetter, spec.accidentalCount);
  const accidental = accidentalCountToSymbols(accidentalCount);
  const naturalPitchClass = LETTER_TO_PITCH_CLASS.get(targetLetter);
  const naturalMidi = noteNumber - accidentalCount;
  const octave = Math.floor((naturalMidi - naturalPitchClass) / 12) - 1;
  const stepOffset = LETTER_TO_STEP_OFFSET.get(targetLetter);
  const step = (octave - 4) * 7 + stepOffset;

  return { step, accidental };
}

function buildStaffSpellingContext(activeNotes, primaryCandidate = null) {
  if (!activeNotes.length) {
    return null;
  }

  let rootPitchClass = null;
  let parsedRoot = null;

  if (primaryCandidate && typeof primaryCandidate.rootPitchClass === 'number') {
    rootPitchClass = normalizePitchClass(primaryCandidate.rootPitchClass);
  }

  if (primaryCandidate && primaryCandidate.fullName) {
    parsedRoot = parseSpelledRoot(primaryCandidate.fullName);
    if (rootPitchClass === null && parsedRoot) {
      rootPitchClass = parsedRoot.pitchClass;
    }
  }

  if (rootPitchClass === null) {
    rootPitchClass = normalizePitchClass(activeNotes[0]);
  }

  if (!parsedRoot) {
    parsedRoot = parseSpelledRoot(labelPitchClass(rootPitchClass));
  }

  if (!parsedRoot) {
    return null;
  }

  const pitchClasses = getPitchClasses(activeNotes);
  const intervals = new Set(getIntervalsFromRoot(rootPitchClass, pitchClasses));
  const family = chooseFamily(intervals);
  const hasMajorThird = intervals.has(4);
  const hasPerfectFifth = intervals.has(7);
  const hasSharpFive = intervals.has(8);
  const hasFlatFive = intervals.has(6);

  return {
    rootPitchClass,
    rootLetter: parsedRoot.letter,
    hasMajorThird,
    preferSharpEleven: hasPerfectFifth && !hasFlatFive,
    preferSharpFive: family === 'aug' || (hasMajorThird && hasSharpFive && !hasPerfectFifth),
    preferDoubleFlatSeven: family === 'dim' && intervals.has(9) && !intervals.has(10)
  };
}

function formatTwoNoteInterval(noteA, noteB) {
  const lowNote = Math.min(noteA, noteB);
  const highNote = Math.max(noteA, noteB);
  const rootName = labelPitchClass(lowNote);
  const semitoneDistance = highNote - lowNote;
  const intervalClass = normalizePitchClass(semitoneDistance);

  if (semitoneDistance === 0) {
    return `${rootName} unison`;
  }

  if (intervalClass === 0) {
    return `${rootName} octave`;
  }

  const intervalName = SIMPLE_INTERVAL_NAMES.get(intervalClass) || `${intervalClass} semitones`;
  return `${rootName} ${intervalName}`;
}

function resizeCanvasForDisplay(canvas) {
  if (!canvas) {
    return;
  }
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.floor(canvas.clientWidth * ratio));
  const height = Math.max(1, Math.floor(canvas.clientHeight * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function setStatus(text, ok = false) {
  if (!statusEl) {
    return;
  }
  statusEl.textContent = text;
  statusEl.classList.toggle('ok', ok);
  statusEl.classList.toggle('warn', !ok);
}

function setMidiInfo(text) {
  if (!midiInfoEl) {
    return;
  }
  midiInfoEl.textContent = text;
}

function ensureAudioContext() {
  if (typeof window === 'undefined') {
    return null;
  }

  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) {
    return null;
  }

  if (!audioContext) {
    audioContext = new AudioCtor();
  }

  return audioContext;
}

function startTypingSound(noteNumber) {
  if (!typingSoundEnabled || activeTypingVoices.has(noteNumber)) {
    return;
  }

  const ctx = ensureAudioContext();
  if (!ctx) {
    return;
  }

  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  const now = ctx.currentTime;
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(midiNoteToFrequency(noteNumber), now);
  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(0.07, now + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.05, now + 0.09);

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);
  oscillator.start(now);

  activeTypingVoices.set(noteNumber, { oscillator, gainNode });
}

function stopTypingSound(noteNumber) {
  const voice = activeTypingVoices.get(noteNumber);
  if (!voice) {
    return;
  }

  const ctx = ensureAudioContext();
  if (!ctx) {
    activeTypingVoices.delete(noteNumber);
    return;
  }

  const now = ctx.currentTime;
  const currentGain = Math.max(voice.gainNode.gain.value, 0.0001);
  voice.gainNode.gain.cancelScheduledValues(now);
  voice.gainNode.gain.setValueAtTime(currentGain, now);
  voice.gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);
  voice.oscillator.stop(now + 0.095);
  voice.oscillator.onended = () => {
    voice.oscillator.disconnect();
    voice.gainNode.disconnect();
  };

  activeTypingVoices.delete(noteNumber);
}

function stopAllTypingSound() {
  for (const noteNumber of [...activeTypingVoices.keys()]) {
    stopTypingSound(noteNumber);
  }
}

function setTypingSoundEnabled(enabled) {
  typingSoundEnabled = enabled;
  if (typingSoundEnabled) {
    const ctx = ensureAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  } else {
    stopAllTypingSound();
  }
}

function refreshMusicFontReady() {
  if (!document.fonts || typeof document.fonts.check !== 'function') {
    musicFontReady = true;
    return;
  }
  musicFontReady = document.fonts.check('64px "Finale Jazz"', '\uE050')
    && document.fonts.check('48px "Finale Jazz"', '\uE0A2')
    && document.fonts.check('58px "Finale Jazz"', '\uE062');
}

function primeMusicFonts() {
  refreshMusicFontReady();
  if (musicFontReady || !document.fonts || typeof document.fonts.load !== 'function') {
    return;
  }

  Promise.all([
    document.fonts.load('64px "Finale Jazz"', '\uE050'),
    document.fonts.load('58px "Finale Jazz"', '\uE062'),
    document.fonts.load('48px "Finale Jazz"', '\uE0A2')
  ]).then(() => {
    refreshMusicFontReady();
    renderVisualizers();
  }).catch(() => {});

  if (typeof document.fonts.ready?.then === 'function') {
    document.fonts.ready.then(() => {
      refreshMusicFontReady();
      renderVisualizers();
    }).catch(() => {});
  }
}

function startApp() {
  appStarted = true;
  if (startOverlayEl) {
    startOverlayEl.hidden = true;
    startOverlayEl.setAttribute('aria-hidden', 'true');
  }
  if (typeof document !== 'undefined' && document.body) {
    document.body.classList.remove('app-locked');
  }
}

function showStartOverlay() {
  appStarted = false;
  if (startOverlayEl) {
    startOverlayEl.hidden = false;
    startOverlayEl.setAttribute('aria-hidden', 'false');
  }
  if (typeof document !== 'undefined' && document.body) {
    document.body.classList.add('app-locked');
  }
  closeSettingsPanel();
  releaseComputerKeys();
  stopAllTypingSound();
}

function renderInputs() {
  if (!inputsListEl) {
    return;
  }
  if (!midiAccess) {
    inputsListEl.innerHTML = '<li>Not connected.</li>';
    return;
  }
  const inputs = [...midiAccess.inputs.values()];
  if (!inputs.length) {
    inputsListEl.innerHTML = '<li>No MIDI inputs detected.</li>';
    return;
  }

  inputsListEl.innerHTML = inputs
    .map((input) => `<li><strong>${input.name || 'Unknown input'}</strong> <em>(${input.manufacturer || 'Unknown manufacturer'})</em></li>`)
    .join('');
}

function formatMidiError(error) {
  if (!error) {
    return 'Unknown MIDI error.';
  }

  const name = error.name ? `${error.name}: ` : '';
  const message = error.message || String(error);
  return `${name}${message}`;
}

async function requestMidiAccess() {
  try {
    return await navigator.requestMIDIAccess({ sysex: false });
  } catch (error) {
    if (error && error.name === 'TypeError') {
      return navigator.requestMIDIAccess();
    }
    throw error;
  }
}

function updateConnectionStatus() {
  const inputCount = midiAccess ? midiAccess.inputs.size : 0;
  if (!inputCount) {
    setStatus('Connected, but no MIDI inputs are visible.', false);
    setMidiInfo('Laptop keyboard is active. Hardware MIDI input was not detected.');
    return;
  }
  setStatus(`Connected. ${inputCount} MIDI input${inputCount === 1 ? '' : 's'} ready.`, true);
  setMidiInfo('Laptop keyboard and MIDI input are both active.');
}

function pseudoRandom(seed) {
  const value = Math.sin(seed * 12.9898) * 43758.5453123;
  return value - Math.floor(value);
}

function drawSketchLine(ctx, x1, y1, x2, y2, seed) {
  const midX = (x1 + x2) / 2;
  const wobble = (pseudoRandom(seed) - 0.5) * 2.2;

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(midX, y1 + wobble, x2, y2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x1 + 0.35, y1 + 0.18);
  ctx.quadraticCurveTo(midX + 0.25, y1 + wobble + 0.2, x2 - 0.35, y2 + 0.14);
  ctx.stroke();
}

function drawSketchRect(ctx, x, y, width, height, seed) {
  const wobble = (pseudoRandom(seed) - 0.5) * 0.9;
  ctx.beginPath();
  ctx.moveTo(x, y + wobble);
  ctx.lineTo(x + width, y - wobble);
  ctx.lineTo(x + width + wobble, y + height);
  ctx.lineTo(x - wobble, y + height + wobble);
  ctx.closePath();
  ctx.stroke();
}

function drawKeyboardTriggerLabel(ctx, text, centerX, centerY, ratio, isBlackKeyColor, seed) {
  ctx.save();
  ctx.font = `${10 * ratio}px ${JAZZ_TEXT_FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const textWidth = ctx.measureText(text).width;
  const padX = 4 * ratio;
  const boxWidth = textWidth + padX * 2;
  const boxHeight = 12 * ratio;
  const boxX = centerX - boxWidth / 2;
  const boxY = centerY - boxHeight / 2;

  ctx.fillStyle = isBlackKeyColor ? 'rgba(255, 247, 230, 0.95)' : '#f4e2bf';
  ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
  ctx.strokeStyle = isBlackKeyColor ? '#ceb78f' : '#9a8768';
  ctx.lineWidth = 1;
  drawSketchRect(ctx, boxX, boxY, boxWidth, boxHeight, seed);

  ctx.fillStyle = isBlackKeyColor ? '#1a2636' : '#2e3d53';
  ctx.fillText(text, centerX, centerY + 0.3 * ratio);
  ctx.restore();
}

function drawSketchWholeNote(ctx, x, y, ratio, seed) {
  if (musicFontReady) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${52 * ratio}px ${JAZZ_MUSIC_FONT_STACK}`;
    ctx.fillStyle = '#233247';
    ctx.fillText('\uE0A2', x, y); // SMuFL whole-note notehead
    ctx.restore();
    return;
  }

  const outerRx = 9.7 * ratio;
  const outerRy = 6.9 * ratio;
  const points = 18;

  function drawJitteredOval(radiusX, radiusY, jitterScale, passSeed, fill) {
    ctx.beginPath();
    for (let i = 0; i <= points; i += 1) {
      const t = (i / points) * Math.PI * 2;
      const jitter = (pseudoRandom(passSeed + i * 0.91) - 0.5) * jitterScale * ratio;
      const px = Math.cos(t) * (radiusX + jitter);
      const py = Math.sin(t) * (radiusY + jitter * 0.72);
      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.closePath();
    if (fill) {
      ctx.fill();
    }
    ctx.stroke();
  }

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.28 + (pseudoRandom(seed * 0.07) - 0.5) * 0.08);
  ctx.lineWidth = 1.45 * ratio;
  ctx.strokeStyle = '#233247';
  ctx.fillStyle = '#fff7ea';

  drawJitteredOval(outerRx, outerRy, 0.58, seed + 1.1, true);
  drawJitteredOval(outerRx - 0.25 * ratio, outerRy - 0.22 * ratio, 0.42, seed + 2.7, false);

  ctx.restore();
}

function drawStaffLineSet(ctx, yValues, left, right) {
  ctx.strokeStyle = '#6f7d90';
  ctx.lineWidth = 1.2;
  for (const y of yValues) {
    drawSketchLine(ctx, left, y, right, y, y * 0.17);
  }
}

function drawGrandStaff(activeNotes) {
  if (!staffCanvasEl || typeof staffCanvasEl.getContext !== 'function') {
    return;
  }

  resizeCanvasForDisplay(staffCanvasEl);
  const ctx = staffCanvasEl.getContext('2d');
  if (!ctx) {
    return;
  }

  const ratio = window.devicePixelRatio || 1;
  const width = staffCanvasEl.width;
  const height = staffCanvasEl.height;
  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = '#fff8eb';
  ctx.fillRect(0, 0, width, height);

  const marginX = Math.round(64 * ratio);
  const left = marginX;
  const right = width - marginX;
  const middleCY = Math.round(height * 0.5);
  const stepHeight = 10.1 * ratio;

  const trebleLines = [2, 4, 6, 8, 10].map((step) => middleCY - step * stepHeight);
  const bassLines = [-10, -8, -6, -4, -2].map((step) => middleCY - step * stepHeight);

  drawStaffLineSet(ctx, trebleLines, left, right);
  drawStaffLineSet(ctx, bassLines, left, right);

  const clefX = left + 18 * ratio;
  const trebleCenterY = (trebleLines[0] + trebleLines[4]) / 2;
  const bassCenterY = (bassLines[0] + bassLines[4]) / 2;

  ctx.fillStyle = '#2f4057';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${62 * ratio}px ${JAZZ_MUSIC_FONT_STACK}`;
  ctx.fillText(musicFontReady ? '\uE050' : '𝄞', clefX, trebleCenterY + 1.5 * ratio);
  ctx.font = `${58 * ratio}px ${JAZZ_MUSIC_FONT_STACK}`;
  ctx.fillText(musicFontReady ? '\uE062' : '𝄢', clefX, bassCenterY + 1.5 * ratio);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  if (!activeNotes.length) {
    return;
  }

  const sortedNotes = [...activeNotes].sort((a, b) => a - b);
  const baseX = Math.round((left + right) * 0.52);
  const collisionOffset = 14 * ratio;
  const notePositions = [];

  for (const note of sortedNotes) {
    const { step, accidental } = midiNoteToStaffDataWithContext(note, staffSpellingContext);
    let x = baseX;
    const previous = notePositions[notePositions.length - 1];

    // If two notes are a second apart on the staff, offset the higher one.
    if (previous && step - previous.step === 1) {
      x = previous.x === baseX ? baseX + collisionOffset : baseX;
    }

    notePositions.push({ note, step, accidental, x });
  }

  const accidentalColumnX = notePositions.reduce((minX, noteData) => (
    Math.min(minX, noteData.x)
  ), baseX) - 15 * ratio;

  for (const noteData of notePositions) {
    const { step, accidental, x } = noteData;
    const y = middleCY - step * stepHeight;

    // Ledger lines above treble, below bass, and middle-C area.
    ctx.strokeStyle = '#6f7d90';
    ctx.lineWidth = 1.1;

    if (step > 10) {
      for (let s = 12; s <= step; s += 2) {
        const ledgerY = middleCY - s * stepHeight;
        drawSketchLine(ctx, x - 10 * ratio, ledgerY, x + 10 * ratio, ledgerY, s + x * 0.01);
      }
    }

    if (step < -10) {
      for (let s = -12; s >= step; s -= 2) {
        const ledgerY = middleCY - s * stepHeight;
        drawSketchLine(ctx, x - 10 * ratio, ledgerY, x + 10 * ratio, ledgerY, s + x * 0.015);
      }
    }

    if (step >= -2 && step <= 2 && step % 2 === 0) {
      const ledgerY = middleCY - step * stepHeight;
      drawSketchLine(ctx, x - 10 * ratio, ledgerY, x + 10 * ratio, ledgerY, step + x * 0.02);
    }

    if (accidental) {
      ctx.fillStyle = '#2d3e57';
      ctx.font = `${14 * ratio}px ${JAZZ_MUSIC_FONT_STACK}`;
      ctx.textAlign = 'right';
      ctx.fillText(accidental, accidentalColumnX, y + 5 * ratio);
      ctx.textAlign = 'left';
    }

    // Whole notehead (hollow) without stem, hand-drawn style.
    drawSketchWholeNote(ctx, x, y, ratio, noteData.note * 0.37 + step * 0.19);
  }
}

function getWhiteKeyCount(start, end) {
  let count = 0;
  for (let note = start; note <= end; note += 1) {
    if (!isBlackKey(note)) {
      count += 1;
    }
  }
  return count;
}

function drawKeyboard(activeNotes) {
  if (!keyboardCanvasEl || typeof keyboardCanvasEl.getContext !== 'function') {
    return;
  }

  resizeCanvasForDisplay(keyboardCanvasEl);
  const ctx = keyboardCanvasEl.getContext('2d');
  if (!ctx) {
    return;
  }

  const ratio = window.devicePixelRatio || 1;
  const width = keyboardCanvasEl.width;
  const height = keyboardCanvasEl.height;
  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = '#fff8eb';
  ctx.fillRect(0, 0, width, height);

  const whiteCount = getWhiteKeyCount(KEYBOARD_NOTE_START, KEYBOARD_NOTE_END);
  const whiteWidth = width / whiteCount;
  const blackWidth = whiteWidth * 0.62;
  const blackHeight = height * 0.57;

  const activeSet = new Set(activeNotes);
  const keyLabelPositions = new Map();
  let whiteIndex = 0;
  for (let note = KEYBOARD_NOTE_START; note <= KEYBOARD_NOTE_END; note += 1) {
    if (isBlackKey(note)) {
      continue;
    }
    const x = whiteIndex * whiteWidth;
    keyLabelPositions.set(note, { x: x + whiteWidth / 2 });
    ctx.fillStyle = activeSet.has(note) ? '#efbb6f' : '#fffdf7';
    ctx.fillRect(x, 0, whiteWidth, height);
    ctx.strokeStyle = '#8a7860';
    ctx.lineWidth = 1;
    drawSketchRect(ctx, x, 0, whiteWidth, height, note * 0.13);

    if (normalizePitchClass(note) === 0) {
      ctx.fillStyle = '#7c6a4d';
      ctx.font = `${9 * ratio}px ${JAZZ_TEXT_FONT_STACK}`;
      ctx.fillText(`C${Math.floor(note / 12) - 1}`, x + 2 * ratio, height - 5 * ratio);
    }

    const triggerKey = noteToComputerKey.get(note);
    if (triggerKey) {
      drawKeyboardTriggerLabel(
        ctx,
        triggerKey,
        x + whiteWidth / 2,
        height - 16 * ratio,
        ratio,
        false,
        note * 0.31
      );
    }

    whiteIndex += 1;
  }

  for (let note = KEYBOARD_NOTE_START; note <= KEYBOARD_NOTE_END; note += 1) {
    if (!isBlackKey(note)) {
      continue;
    }
    const nextWhiteIndex = getWhiteKeyCount(KEYBOARD_NOTE_START, note);
    const x = nextWhiteIndex * whiteWidth - blackWidth / 2;
    keyLabelPositions.set(note, { x: x + blackWidth / 2 });
    ctx.fillStyle = activeSet.has(note) ? '#de7a42' : '#1a2636';
    ctx.fillRect(x, 0, blackWidth, blackHeight);
    ctx.strokeStyle = '#131c2c';
    ctx.lineWidth = 1;
    drawSketchRect(ctx, x, 0, blackWidth, blackHeight, note * 0.17);

    const triggerKey = noteToComputerKey.get(note);
    if (triggerKey) {
      drawKeyboardTriggerLabel(
        ctx,
        triggerKey,
        x + blackWidth / 2,
        blackHeight - 12 * ratio,
        ratio,
        true,
        note * 0.39
      );
    }
  }

  if (!activeNotes.length) {
    return;
  }

  const labels = activeNotes
    .filter((note) => keyLabelPositions.has(note))
    .map((note) => ({
      note,
      x: keyLabelPositions.get(note).x,
      text: midiNoteToName(note)
    }))
    .sort((left, right) => left.x - right.x);

  ctx.font = `${10 * ratio}px ${JAZZ_TEXT_FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const minSpacing = 30 * ratio;
  let previousX = -Infinity;
  let previousRow = 0;

  for (const label of labels) {
    let row = 0;
    if (label.x - previousX < minSpacing) {
      row = Math.min(previousRow + 1, 2);
    }

    const y = (10 + row * 12) * ratio;
    const textWidth = ctx.measureText(label.text).width;
    const padX = 4 * ratio;
    const padY = 3 * ratio;
    const boxWidth = textWidth + padX * 2;
    const boxHeight = 12 * ratio;
    const boxX = label.x - boxWidth / 2;
    const boxY = y - boxHeight / 2;

    ctx.fillStyle = '#fff7e7';
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
    ctx.strokeStyle = '#9c8b72';
    ctx.lineWidth = 1;
    drawSketchRect(ctx, boxX, boxY, boxWidth, boxHeight, label.note * 0.21);

    ctx.fillStyle = '#2c3a4f';
    ctx.fillText(label.text, label.x, y + 0.4 * ratio);

    previousX = label.x;
    previousRow = row;
  }
}

function renderVisualizers() {
  const activeNotes = getSortedActiveNotes();
  drawGrandStaff(activeNotes);
  drawKeyboard(activeNotes);
}

function getSortedActiveNotes() {
  return [...noteCounts.keys()].sort((a, b) => a - b);
}

function getPitchClasses(noteNumbers) {
  return [...new Set(noteNumbers.map((noteNumber) => normalizePitchClass(noteNumber)))].sort((a, b) => a - b);
}

function getIntervalsFromRoot(rootPitchClass, pitchClasses) {
  return pitchClasses.map((pitchClass) => normalizePitchClass(pitchClass - rootPitchClass)).sort((a, b) => a - b);
}

function getRootReference(rootPitchClass, activeNotes) {
  const rootNotes = activeNotes.filter((noteNumber) => normalizePitchClass(noteNumber) === rootPitchClass);
  if (rootNotes.length) {
    return rootNotes[0];
  }

  const bassNote = activeNotes[0];
  const distanceDown = normalizePitchClass(bassNote - rootPitchClass);
  return bassNote - distanceDown;
}

function hasUpperExtension(rootPitchClass, intervalClass, activeNotes) {
  const targetPitchClass = normalizePitchClass(rootPitchClass + intervalClass);
  const reference = getRootReference(rootPitchClass, activeNotes);

  return activeNotes.some((noteNumber) => {
    if (normalizePitchClass(noteNumber) !== targetPitchClass) {
      return false;
    }
    return noteNumber - reference >= 12;
  });
}

function sortColorTokens(tokens) {
  const order = new Map(COLOR_ORDER.map((token, index) => [token, index]));
  return [...new Set(tokens)].sort((left, right) => {
    const leftOrder = order.has(left) ? order.get(left) : 999;
    const rightOrder = order.has(right) ? order.get(right) : 999;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return left.localeCompare(right);
  });
}

function chooseFamily(intervals) {
  const hasM3 = intervals.has(4);
  const hasm3 = intervals.has(3);
  const hasP5 = intervals.has(7);
  const hasDim5 = intervals.has(6);
  const hasAug5 = intervals.has(8);
  const hasP4 = intervals.has(5);
  const has2 = intervals.has(2);

  if (hasM3 && hasAug5) {
    return 'aug';
  }

  if (hasm3 && hasDim5) {
    return 'dim';
  }

  if (hasM3) {
    return 'major';
  }

  if (hasm3) {
    return 'minor';
  }

  if (hasP4 && hasP5) {
    return 'sus4';
  }

  if (has2 && hasP5) {
    return 'sus2';
  }

  if (hasP5) {
    return 'power';
  }

  return null;
}

function detectSeventh(intervals, family) {
  const hasb7 = intervals.has(10);
  const hasM7 = intervals.has(11);
  const hasDim7 = intervals.has(9);

  if (family === 'dim') {
    if (hasDim7 && !hasb7) {
      return 'dim7';
    }
    if (hasb7) {
      return 'b7';
    }
  }

  if (hasb7) {
    return 'b7';
  }

  if (hasM7) {
    return 'M7';
  }

  return 'none';
}

function getFamilyCoreIntervals(family, seventhKind, useSix) {
  const core = new Set([0]);

  if (family === 'major') {
    core.add(4);
    core.add(7);
    if (useSix) {
      core.add(9);
    } else if (seventhKind === 'b7') {
      core.add(10);
    } else if (seventhKind === 'M7') {
      core.add(11);
    }
  }

  if (family === 'minor') {
    core.add(3);
    core.add(7);
    if (useSix) {
      core.add(9);
    } else if (seventhKind === 'b7') {
      core.add(10);
    } else if (seventhKind === 'M7') {
      core.add(11);
    }
  }

  if (family === 'dim') {
    core.add(3);
    core.add(6);
    if (seventhKind === 'dim7') {
      core.add(9);
    } else if (seventhKind === 'b7') {
      core.add(10);
    }
  }

  if (family === 'aug') {
    core.add(4);
    core.add(8);
    if (seventhKind === 'b7') {
      core.add(10);
    } else if (seventhKind === 'M7') {
      core.add(11);
    }
  }

  if (family === 'sus4') {
    core.add(5);
    core.add(7);
    if (seventhKind === 'b7') {
      core.add(10);
    } else if (seventhKind === 'M7') {
      core.add(11);
    }
  }

  if (family === 'sus2') {
    core.add(2);
    core.add(7);
    if (seventhKind === 'b7') {
      core.add(10);
    } else if (seventhKind === 'M7') {
      core.add(11);
    }
  }

  if (family === 'power') {
    core.add(7);
  }

  return core;
}

function baseSymbolForFamily(family, seventhKind, useSix) {
  if (family === 'major') {
    if (useSix) {
      return '6';
    }
    if (seventhKind === 'b7') {
      return '7';
    }
    if (seventhKind === 'M7') {
      return 'Δ7';
    }
    return '';
  }

  if (family === 'minor') {
    if (useSix) {
      return 'm6';
    }
    if (seventhKind === 'b7') {
      return 'm7';
    }
    if (seventhKind === 'M7') {
      return 'mΔ7';
    }
    return 'm';
  }

  if (family === 'dim') {
    if (seventhKind === 'dim7') {
      return '°7';
    }
    if (seventhKind === 'b7') {
      return 'ø7';
    }
    return '°';
  }

  if (family === 'aug') {
    if (seventhKind === 'b7') {
      return '7♯5';
    }
    if (seventhKind === 'M7') {
      return 'Δ7♯5';
    }
    return '+';
  }

  if (family === 'sus4') {
    if (seventhKind === 'b7') {
      return '7sus';
    }
    if (seventhKind === 'M7') {
      return 'Δ7sus';
    }
    return 'sus';
  }

  if (family === 'sus2') {
    if (seventhKind === 'b7') {
      return '7sus2';
    }
    if (seventhKind === 'M7') {
      return 'Δ7sus2';
    }
    return 'sus2';
  }

  return '5';
}

function getInversionLabel(rootPitchClass, bassPitchClass, coreIntervals, family) {
  if (bassPitchClass === rootPitchClass) {
    return 'root position';
  }

  const bassInterval = normalizePitchClass(bassPitchClass - rootPitchClass);
  const orderedToneIntervals = [];

  if (family === 'major' || family === 'aug') {
    orderedToneIntervals.push(4);
  }
  if (family === 'minor' || family === 'dim') {
    orderedToneIntervals.push(3);
  }
  if (family === 'sus2') {
    orderedToneIntervals.push(2);
  }
  if (family === 'sus4') {
    orderedToneIntervals.push(5);
  }

  for (const candidate of [6, 7, 8]) {
    if (coreIntervals.has(candidate) && !orderedToneIntervals.includes(candidate)) {
      orderedToneIntervals.push(candidate);
    }
  }

  for (const candidate of [9, 10, 11]) {
    if (coreIntervals.has(candidate)) {
      orderedToneIntervals.push(candidate);
    }
  }

  const inversionIndex = orderedToneIntervals.indexOf(bassInterval);
  if (inversionIndex === -1) {
    return `slash bass (${labelPitchClass(bassPitchClass)})`;
  }

  return INVERSION_NAMES[inversionIndex] || `${inversionIndex + 1}th inversion`;
}

function hasSeventhFromCore(coreIntervals, family) {
  if (family === 'dim' && coreIntervals.has(9)) {
    return true;
  }

  return coreIntervals.has(10) || coreIntervals.has(11);
}

function promoteExtensionSymbol(symbol, family, highestNatural) {
  if (symbol === '7') {
    return String(highestNatural);
  }

  if (symbol === 'm7') {
    return `m${highestNatural}`;
  }

  if (symbol === 'Δ7') {
    return `Δ${highestNatural}`;
  }

  if (symbol === 'mΔ7') {
    return `mΔ${highestNatural}`;
  }

  if (symbol === '7sus') {
    if (highestNatural === 13) {
      return '13sus';
    }
    if (highestNatural === 11) {
      return '11sus';
    }
    return '9sus';
  }

  if (symbol === '7sus2') {
    return `${highestNatural}sus2`;
  }

  if (family === 'power' && highestNatural === 9) {
    return '5(add9)';
  }

  return symbol;
}

function classifyNonCoreInterval(interval, context) {
  const {
    family,
    hasSeventh,
    hasMajorThird,
    high9,
    high11,
    high13
  } = context;

  if (interval === 1) {
    return { type: 'altered', token: '♭9' };
  }

  if (interval === 2) {
    if (high9) {
      if (hasSeventh) {
        return { type: 'natural', token: 9 };
      }
      return { type: 'add', token: 'add9' };
    }
    return { type: 'add', token: 'add2' };
  }

  if (interval === 3) {
    if (hasMajorThird) {
      return { type: 'altered', token: '♯9' };
    }
    if (family === 'minor' || family === 'dim') {
      return { type: 'add', token: 'add3' };
    }
    return { type: 'add', token: 'add♭3' };
  }

  if (interval === 4) {
    return { type: 'add', token: 'add3' };
  }

  if (interval === 5) {
    if (high11) {
      if (hasSeventh) {
        return { type: 'natural', token: 11 };
      }
      if (family === 'sus4') {
        return { type: 'add', token: 'add11' };
      }
      return { type: 'add', token: 'add11' };
    }
    return { type: 'add', token: 'add4' };
  }

  if (interval === 6) {
    if (family === 'dim') {
      return { type: 'add', token: 'add♭5' };
    }
    return { type: 'altered', token: '♯11' };
  }

  if (interval === 7) {
    return { type: 'add', token: 'add5' };
  }

  if (interval === 8) {
    if (family === 'aug') {
      return { type: 'add', token: 'add♭6' };
    }
    return { type: 'altered', token: '♭13' };
  }

  if (interval === 9) {
    if (high13) {
      if (hasSeventh) {
        return { type: 'natural', token: 13 };
      }
      return { type: 'add', token: 'add13' };
    }
    return { type: 'add', token: 'add6' };
  }

  if (interval === 10) {
    if (hasSeventh) {
      return { type: 'altered', token: '♭7' };
    }
    return { type: 'add', token: 'add♭7' };
  }

  if (interval === 11) {
    if (hasSeventh) {
      return { type: 'altered', token: 'Δ7' };
    }
    return { type: 'add', token: 'add7' };
  }

  return null;
}

function getFallbackFamily(intervals) {
  if (intervals.has(4)) {
    return 'major-shell';
  }
  if (intervals.has(3)) {
    return 'minor-shell';
  }
  if (intervals.has(5)) {
    return 'sus4-shell';
  }
  if (intervals.has(2)) {
    return 'sus2-shell';
  }
  if (intervals.has(7)) {
    return 'power-shell';
  }
  return 'cluster';
}

function buildFallbackCoreAndSymbol(fallbackFamily, intervals) {
  const coreIntervals = new Set([0]);
  let symbol = '';
  let inversionFamily = 'power';

  if (fallbackFamily === 'major-shell') {
    coreIntervals.add(4);
    inversionFamily = 'major';

    if (intervals.has(10)) {
      coreIntervals.add(10);
      symbol = '7';
    } else if (intervals.has(11)) {
      coreIntervals.add(11);
      symbol = 'Δ7';
    }
  } else if (fallbackFamily === 'minor-shell') {
    coreIntervals.add(3);
    inversionFamily = 'minor';

    if (intervals.has(10)) {
      coreIntervals.add(10);
      symbol = 'm7';
    } else if (intervals.has(11)) {
      coreIntervals.add(11);
      symbol = 'mΔ7';
    } else {
      symbol = 'm';
    }
  } else if (fallbackFamily === 'sus4-shell') {
    coreIntervals.add(5);
    inversionFamily = 'sus4';

    if (intervals.has(10)) {
      coreIntervals.add(10);
      symbol = '7sus';
    } else if (intervals.has(11)) {
      coreIntervals.add(11);
      symbol = 'Δ7sus';
    } else {
      symbol = 'sus';
    }
  } else if (fallbackFamily === 'sus2-shell') {
    coreIntervals.add(2);
    inversionFamily = 'sus2';

    if (intervals.has(10)) {
      coreIntervals.add(10);
      symbol = '7sus2';
    } else if (intervals.has(11)) {
      coreIntervals.add(11);
      symbol = 'Δ7sus2';
    } else {
      symbol = 'sus2';
    }
  } else if (fallbackFamily === 'power-shell') {
    coreIntervals.add(7);
    inversionFamily = 'power';
    symbol = '5';
  }

  return { coreIntervals, symbol, inversionFamily };
}

function buildIntervalFallbackCandidate(rootPitchClass, activeNotes, pitchClasses, bassPitchClass) {
  const intervalValues = getIntervalsFromRoot(rootPitchClass, pitchClasses);
  const intervals = new Set(intervalValues);
  if (!intervals.has(0)) {
    return null;
  }

  const fallbackFamily = getFallbackFamily(intervals);
  const { coreIntervals, symbol: baseSymbol, inversionFamily } = buildFallbackCoreAndSymbol(fallbackFamily, intervals);
  const high9 = hasUpperExtension(rootPitchClass, 2, activeNotes);
  const high11 = hasUpperExtension(rootPitchClass, 5, activeNotes);
  const high13 = hasUpperExtension(rootPitchClass, 9, activeNotes);
  const hasMajorThird = intervals.has(4);
  const hasSeventh = coreIntervals.has(10) || coreIntervals.has(11) || intervals.has(10) || intervals.has(11);
  const naturalExtensions = [];
  const alteredExtensions = [];
  const addExtensions = [];

  for (const interval of intervalValues) {
    if (coreIntervals.has(interval)) {
      continue;
    }

    const tokenInfo = classifyNonCoreInterval(interval, {
      family: inversionFamily,
      hasSeventh,
      hasMajorThird,
      high9,
      high11,
      high13
    });
    if (!tokenInfo) {
      continue;
    }

    if (tokenInfo.type === 'natural') {
      naturalExtensions.push(tokenInfo.token);
    } else if (tokenInfo.type === 'altered') {
      alteredExtensions.push(tokenInfo.token);
    } else if (tokenInfo.type === 'add') {
      addExtensions.push(tokenInfo.token);
    }
  }

  let symbol = baseSymbol;
  let naturalTokens = [...new Set(naturalExtensions)].sort((a, b) => a - b).map(String);
  const alteredTokens = [...new Set(alteredExtensions)];
  const addTokens = [...new Set(addExtensions)];

  if (symbol && symbol.includes('7') && alteredTokens.length === 0 && addTokens.length === 0 && naturalTokens.length > 0) {
    const highestNatural = naturalTokens.includes('13') ? 13 : naturalTokens.includes('11') ? 11 : 9;
    symbol = promoteExtensionSymbol(symbol, inversionFamily, highestNatural);
    naturalTokens = [];
  }

  const colorTokens = sortColorTokens([...naturalTokens, ...alteredTokens, ...addTokens]);
  const rootName = labelPitchClass(rootPitchClass);
  const bassName = labelPitchClass(bassPitchClass);
  const slash = bassPitchClass === rootPitchClass ? '' : `/${bassName}`;
  let fullName = `${rootName}${symbol}`;

  if (colorTokens.length) {
    if (!symbol && colorTokens.length === 1 && colorTokens[0].startsWith('add')) {
      fullName = `${rootName}${colorTokens[0]}`;
    } else {
      fullName += `(${colorTokens.join(',')})`;
    }
  }
  fullName += slash;

  const hasThird = intervals.has(3) || intervals.has(4);
  const hasFifthLike = intervals.has(6) || intervals.has(7) || intervals.has(8);
  const hasUpperColor = intervals.has(1) || intervals.has(2) || intervals.has(5) || intervals.has(9);
  const bassInterval = normalizePitchClass(bassPitchClass - rootPitchClass);

  let score = 34;
  score += hasThird ? 10 : 0;
  score += hasFifthLike ? 7 : 0;
  score += hasSeventh ? 8 : 0;
  score += hasUpperColor ? 2 : 0;
  score += bassPitchClass === rootPitchClass ? 10 : coreIntervals.has(bassInterval) ? -2 : -10;
  score -= colorTokens.length;

  if (fallbackFamily === 'major-shell' || fallbackFamily === 'minor-shell') {
    score += 6;
  }

  const inversionLabel = bassPitchClass === rootPitchClass
    ? 'root position'
    : getInversionLabel(rootPitchClass, bassPitchClass, coreIntervals, inversionFamily);

  return {
    fullName,
    inversionLabel,
    score,
    source: 'interval-fallback',
    rootPitchClass
  };
}

function computeTertianRootStrength(intervals, family) {
  const hasThird = intervals.has(3) || intervals.has(4);
  let hasFifth = false;
  if (family === 'dim') {
    hasFifth = intervals.has(6);
  } else if (family === 'aug') {
    hasFifth = intervals.has(8);
  } else {
    hasFifth = intervals.has(7);
  }
  const hasSeventh = intervals.has(10) || intervals.has(11) || (family === 'dim' && intervals.has(9));

  let strength = 0;
  if (hasThird) {
    strength += 12;
  }
  if (hasFifth) {
    strength += 14;
  }
  if (hasSeventh) {
    strength += 10;
  }
  if (hasThird && hasFifth) {
    strength += 8;
  }
  if (hasThird && hasFifth && hasSeventh) {
    strength += 8;
  }

  if (intervals.has(5) && !hasThird) {
    strength -= 4;
  }

  return { strength, hasFifth };
}

function buildRootCandidate(rootPitchClass, activeNotes, pitchClasses, bassPitchClass) {
  const intervalValues = getIntervalsFromRoot(rootPitchClass, pitchClasses);
  const intervals = new Set(intervalValues);
  if (!intervals.has(0)) {
    return [];
  }

  const family = chooseFamily(intervals);
  if (!family) {
    const fallbackCandidate = buildIntervalFallbackCandidate(rootPitchClass, activeNotes, pitchClasses, bassPitchClass);
    return fallbackCandidate ? [fallbackCandidate] : [];
  }

  const seventhKind = detectSeventh(intervals, family);
  const useSix = (family === 'major' || family === 'minor') && seventhKind === 'none' && intervals.has(9);
  const coreIntervals = getFamilyCoreIntervals(family, seventhKind, useSix);

  const hasSeventh = hasSeventhFromCore(coreIntervals, family);
  const hasMajorThird = intervals.has(4);
  const high9 = hasUpperExtension(rootPitchClass, 2, activeNotes);
  const high11 = hasUpperExtension(rootPitchClass, 5, activeNotes);
  const high13 = hasUpperExtension(rootPitchClass, 9, activeNotes);

  const naturalExtensions = [];
  const alteredExtensions = [];
  const addExtensions = [];

  for (const interval of intervalValues) {
    if (coreIntervals.has(interval)) {
      continue;
    }

    const tokenInfo = classifyNonCoreInterval(interval, {
      family,
      hasSeventh,
      hasMajorThird,
      high9,
      high11,
      high13
    });
    if (!tokenInfo) {
      continue;
    }

    if (tokenInfo.type === 'natural') {
      naturalExtensions.push(tokenInfo.token);
    } else if (tokenInfo.type === 'altered') {
      alteredExtensions.push(tokenInfo.token);
    } else if (tokenInfo.type === 'add') {
      addExtensions.push(tokenInfo.token);
    }
  }

  let symbol = baseSymbolForFamily(family, seventhKind, useSix);

  let naturalTokens = [...new Set(naturalExtensions)].sort((a, b) => a - b).map(String);
  let addTokens = [...new Set(addExtensions)];
  const alteredTokens = [...new Set(alteredExtensions)];

  if (!hasSeventh && alteredTokens.length === 0) {
    const hasAdd9 = addTokens.includes('add9');
    const hasAdd13 = addTokens.includes('add13');
    const hasAdd11 = addTokens.includes('add11') || addTokens.includes('add4');

    if ((symbol === '' || symbol === 'm') && hasAdd9 && hasAdd13 && !hasAdd11) {
      symbol = `${symbol}69`;
      addTokens = addTokens.filter((token) => token !== 'add9' && token !== 'add13');
    }
  }

  if (hasSeventh && alteredTokens.length === 0 && addTokens.length === 0 && naturalTokens.length > 0) {
    const highestNatural = naturalTokens.includes('13') ? 13 : naturalTokens.includes('11') ? 11 : 9;
    symbol = promoteExtensionSymbol(symbol, family, highestNatural);
    naturalTokens = [];
  }

  const colorTokens = sortColorTokens([...naturalTokens, ...alteredTokens, ...addTokens]);

  const rootName = labelPitchClass(rootPitchClass);
  const bassName = labelPitchClass(bassPitchClass);
  const slash = bassPitchClass === rootPitchClass ? '' : `/${bassName}`;
  let fullName = `${rootName}${symbol}`;
  if (colorTokens.length) {
    if (symbol === '' && colorTokens.length === 1 && colorTokens[0].startsWith('add')) {
      fullName = `${rootName}${colorTokens[0]}`;
    } else {
      fullName += `(${colorTokens.join(',')})`;
    }
  }
  fullName += slash;

  const bassInterval = normalizePitchClass(bassPitchClass - rootPitchClass);
  const bassInCore = coreIntervals.has(bassInterval);
  const hasThird = intervals.has(3) || intervals.has(4);
  const noteCount = intervalValues.length;
  const tertian = computeTertianRootStrength(intervals, family);

  let score = 72;
  score += tertian.strength;
  score += bassPitchClass === rootPitchClass ? 18 : bassInCore ? -6 : -14;
  score += hasThird ? 7 : -2;
  score += hasSeventh ? 4 : 0;
  score += colorTokens.length * -1;

  if (family === 'major' || family === 'minor') {
    score += 6;
  }

  if (bassPitchClass !== rootPitchClass) {
    score -= 4;
  }

  if (useSix && bassPitchClass !== rootPitchClass) {
    score -= 10;
  }

  if (noteCount <= 3 && bassPitchClass !== rootPitchClass && hasThird && !hasSeventh) {
    score -= 8;
  }

  if (family === 'sus2' && high9 && !hasSeventh) {
    score += 4;
  }

  if (family === 'sus4' && high11 && !hasSeventh) {
    score += 3;
  }

  if (family.startsWith('sus') && hasThird) {
    score -= 18;
  }

  if (bassPitchClass !== rootPitchClass && hasSeventh && !hasThird) {
    score -= 16;
  }

  if (symbol === '7sus2') {
    score -= 8;
  }

  if ((family === 'major' || family === 'minor') && !tertian.hasFifth) {
    if (hasSeventh) {
      score -= 8;
    } else {
      score -= 26;
    }
  }

  const inversionLabel = getInversionLabel(rootPitchClass, bassPitchClass, coreIntervals, family);
  const candidates = [
    {
      fullName,
      inversionLabel,
      score,
      source: 'root-analysis',
      rootPitchClass
    }
  ];

  // Heuristic: if the voicing clearly reads as a 9/11 color above the octave but omits the 3rd,
  // many players prefer add9/add11-style labels over sus2/sus4.
  if (family === 'sus2' && !hasSeventh && high9) {
    candidates.push({
      fullName: `${rootName}add9${slash}`,
      inversionLabel,
      score: score + 6,
      source: 'add9-heuristic',
      rootPitchClass
    });
  }

  if (family === 'sus4' && !hasSeventh && high11) {
    candidates.push({
      fullName: `${rootName}add11${slash}`,
      inversionLabel,
      score: score + 5,
      source: 'add11-heuristic',
      rootPitchClass
    });
  }

  return candidates;
}

function detectSimpleUpperChord(intervals) {
  if (intervals.has(0) && intervals.has(4) && intervals.has(7)) {
    return '';
  }
  if (intervals.has(0) && intervals.has(3) && intervals.has(7)) {
    return 'm';
  }
  if (intervals.has(0) && intervals.has(3) && intervals.has(6)) {
    return '°';
  }
  if (intervals.has(0) && intervals.has(4) && intervals.has(8)) {
    return '+';
  }
  if (intervals.has(0) && intervals.has(5) && intervals.has(7)) {
    return 'sus';
  }
  if (intervals.has(0) && intervals.has(2) && intervals.has(7)) {
    return 'sus2';
  }

  return null;
}

function buildUpperStructureSlashCandidates(activeNotes, pitchClasses, bassPitchClass) {
  const upperPitchClasses = pitchClasses.filter((pitchClass) => pitchClass !== bassPitchClass);
  // Keep this strict so upper-structure labels do not overshadow clearer root names.
  if (upperPitchClasses.length !== 3) {
    return [];
  }

  const candidates = [];
  for (const rootPitchClass of upperPitchClasses) {
    const intervals = new Set(getIntervalsFromRoot(rootPitchClass, upperPitchClasses));
    const upperSymbol = detectSimpleUpperChord(intervals);
    if (upperSymbol === null) {
      continue;
    }

    const bassInterval = normalizePitchClass(bassPitchClass - rootPitchClass);
    if (intervals.has(bassInterval)) {
      continue;
    }

    const rootName = labelPitchClass(rootPitchClass);
    const bassName = labelPitchClass(bassPitchClass);

    let score = 108;
    if ([2, 5].includes(bassInterval)) {
      score += 10;
    }
    if (upperSymbol === '' || upperSymbol === 'm') {
      score += 5;
    }

    candidates.push({
      fullName: `${rootName}${upperSymbol}/${bassName}`,
      inversionLabel: `slash bass (${bassName})`,
      score,
      source: 'upper-structure'
    });
  }

  return candidates;
}

function getChordCandidates(activeNotes) {
  const pitchClasses = getPitchClasses(activeNotes);
  if (!pitchClasses.length) {
    return [];
  }

  if (pitchClasses.length === 1) {
    const pitchClass = pitchClasses[0];
    return [{
      fullName: labelPitchClass(pitchClass),
      inversionLabel: 'single note',
      score: 1,
      source: 'single-note',
      rootPitchClass: pitchClass
    }];
  }

  const bassPitchClass = normalizePitchClass(activeNotes[0]);
  const candidates = [];
  const rootCandidates = [];

  for (const rootPitchClass of pitchClasses) {
    rootCandidates.push(...buildRootCandidate(rootPitchClass, activeNotes, pitchClasses, bassPitchClass));
  }

  candidates.push(...rootCandidates);

  const strongBassRoot = rootCandidates.some((candidate) => (
    candidate.rootPitchClass === bassPitchClass && candidate.score >= 92
  ));

  if (!strongBassRoot) {
    candidates.push(...buildUpperStructureSlashCandidates(activeNotes, pitchClasses, bassPitchClass));
  }

  candidates.sort((left, right) => right.score - left.score);

  const deduped = [];
  const seen = new Set();
  for (const candidate of candidates) {
    if (seen.has(candidate.fullName)) {
      continue;
    }
    deduped.push(candidate);
    seen.add(candidate.fullName);
  }

  return deduped;
}

function updateChordDisplay() {
  const activeNotes = getSortedActiveNotes();
  if (!activeNotes.length) {
    staffSpellingContext = null;
    chordNameEl.textContent = 'Tickle the keys';
    renderVisualizers();
    return;
  }

  if (activeNotes.length === 2) {
    staffSpellingContext = buildStaffSpellingContext(activeNotes);
    chordNameEl.textContent = formatTwoNoteInterval(activeNotes[0], activeNotes[1]);
    renderVisualizers();
    return;
  }

  const candidates = getChordCandidates(activeNotes);

  if (!candidates.length) {
    staffSpellingContext = buildStaffSpellingContext(activeNotes);
    chordNameEl.textContent = '(unrecognized)';
    renderVisualizers();
    return;
  }

  const primary = candidates[0];
  staffSpellingContext = buildStaffSpellingContext(activeNotes, primary);
  chordNameEl.textContent = primary.fullName;
  renderVisualizers();
}

function incrementNote(noteNumber) {
  const current = noteCounts.get(noteNumber) || 0;
  noteCounts.set(noteNumber, current + 1);
}

function decrementNote(noteNumber) {
  const current = noteCounts.get(noteNumber);
  if (!current) {
    return;
  }

  if (current <= 1) {
    noteCounts.delete(noteNumber);
    return;
  }

  noteCounts.set(noteNumber, current - 1);
}

function handleMidiMessage(event) {
  const [status, noteNumber, velocity] = event.data;
  const messageType = status & 0xf0;

  if (messageType === 0x90 && velocity > 0) {
    incrementNote(noteNumber);
    updateChordDisplay();
    return;
  }

  if (messageType === 0x80 || (messageType === 0x90 && velocity === 0)) {
    decrementNote(noteNumber);
    updateChordDisplay();
  }
}

function bindInputs() {
  for (const input of midiAccess.inputs.values()) {
    input.onmidimessage = handleMidiMessage;
  }
}

async function connectMidi() {
  if (!('requestMIDIAccess' in navigator)) {
    setStatus('Web MIDI is not supported in this browser.', false);
    setMidiInfo('Use desktop Chrome or Edge on Windows for Web MIDI.');
    return;
  }

  if (connectBtn) {
    connectBtn.disabled = true;
  }
  setStatus('Requesting MIDI permission...', false);
  setMidiInfo('Allow permission in your browser prompt.');

  try {
    midiAccess = await requestMidiAccess();
    bindInputs();
    renderInputs();
    updateConnectionStatus();

    midiAccess.onstatechange = () => {
      bindInputs();
      renderInputs();
      updateConnectionStatus();
    };
  } catch (error) {
    setStatus('MIDI connection failed.', false);
    setMidiInfo(formatMidiError(error));
  } finally {
    if (connectBtn) {
      connectBtn.disabled = false;
    }
  }
}

function setSettingsOpen(nextOpen) {
  if (!settingsPanelEl) {
    return;
  }
  settingsPanelEl.classList.toggle('open', nextOpen);
  settingsPanelEl.setAttribute('aria-hidden', nextOpen ? 'false' : 'true');

  if (settingsBackdropEl) {
    settingsBackdropEl.hidden = !nextOpen;
  }
}

function toggleSettingsPanel() {
  if (!settingsPanelEl) {
    return;
  }
  const isOpen = settingsPanelEl.classList.contains('open');
  setSettingsOpen(!isOpen);
}

function closeSettingsPanel() {
  setSettingsOpen(false);
}

function handleTypingSoundToggleChange() {
  if (!typingSoundToggleEl) {
    return;
  }
  setTypingSoundEnabled(typingSoundToggleEl.checked);
}

function isTypingTarget(target) {
  if (!target) {
    return false;
  }
  const tagName = typeof target.tagName === 'string' ? target.tagName.toLowerCase() : '';
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return true;
  }
  return Boolean(target.isContentEditable);
}

function handleComputerKeyDown(event) {
  if (event.key === 'Escape') {
    closeSettingsPanel();
    return;
  }

  if (!appStarted) {
    return;
  }

  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }

  if (isTypingTarget(event.target)) {
    return;
  }

  const key = event.key.toLowerCase();
  const noteNumber = computerKeyToNote.get(key);
  if (typeof noteNumber !== 'number') {
    return;
  }

  event.preventDefault();
  if (heldComputerKeys.has(key)) {
    return;
  }

  heldComputerKeys.add(key);
  incrementNote(noteNumber);
  startTypingSound(noteNumber);
  updateChordDisplay();
}

function handleComputerKeyUp(event) {
  if (!appStarted) {
    return;
  }

  const key = event.key.toLowerCase();
  const noteNumber = computerKeyToNote.get(key);
  if (typeof noteNumber !== 'number') {
    return;
  }

  event.preventDefault();
  if (!heldComputerKeys.has(key)) {
    return;
  }

  heldComputerKeys.delete(key);
  decrementNote(noteNumber);
  stopTypingSound(noteNumber);
  updateChordDisplay();
}

function releaseComputerKeys() {
  if (!heldComputerKeys.size) {
    return;
  }

  for (const key of [...heldComputerKeys]) {
    const noteNumber = computerKeyToNote.get(key);
    if (typeof noteNumber === 'number') {
      decrementNote(noteNumber);
      stopTypingSound(noteNumber);
    }
  }
  heldComputerKeys.clear();
  updateChordDisplay();
}

if (connectBtn) {
  connectBtn.addEventListener('click', connectMidi);
}

if (settingsToggleEl) {
  settingsToggleEl.addEventListener('click', toggleSettingsPanel);
}

if (settingsCloseEl) {
  settingsCloseEl.addEventListener('click', closeSettingsPanel);
}

if (settingsBackdropEl) {
  settingsBackdropEl.addEventListener('click', closeSettingsPanel);
}

if (typingSoundToggleEl) {
  const supportsWebAudio = typeof window !== 'undefined' && Boolean(window.AudioContext || window.webkitAudioContext);
  typingSoundToggleEl.checked = false;
  typingSoundToggleEl.disabled = !supportsWebAudio;
  if (!supportsWebAudio) {
    typingSoundToggleEl.title = 'Web Audio is not available in this browser.';
  }
  setTypingSoundEnabled(typingSoundToggleEl.checked);
  typingSoundToggleEl.addEventListener('change', handleTypingSoundToggleChange);
}

if (typeof document !== 'undefined') {
  document.addEventListener('harmonicradar:start', startApp);
  document.addEventListener('harmonicradar:show-start', showStartOverlay);
}

if (typeof window !== 'undefined') {
  window.addEventListener('resize', renderVisualizers);
  window.addEventListener('keydown', handleComputerKeyDown);
  window.addEventListener('keyup', handleComputerKeyUp);
  window.addEventListener('blur', releaseComputerKeys);
}

if (!appStarted && startOverlayEl) {
  startOverlayEl.setAttribute('aria-hidden', 'false');
}

renderInputs();
setSettingsOpen(false);
if (typeof document !== 'undefined') {
  primeMusicFonts();
}
updateChordDisplay();
