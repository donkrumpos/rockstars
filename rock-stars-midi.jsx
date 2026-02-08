import { useState, useEffect, useCallback, useRef } from "react";

const COLORS = {
  bg: "#1a1a2e",
  stage: "#16213e",
  stageFloor: "#0f3460",
  neon1: "#e94560",
  neon2: "#00d2ff",
  neon3: "#ffd700",
  neon4: "#39ff14",
  crowd: "#533483",
  text: "#ffffff",
  textDim: "#8888aa",
  meter1: "#e94560",
  meter2: "#00d2ff",
  success: "#39ff14",
  fail: "#ff3333",
  dark: "#0a0a1a",
};

const BUTTON_MAP = {
  p1: {
    keys: ["z", "x", "c", "v"],
    labels: ["Z", "X", "C", "V"],
    colors: [COLORS.neon1, COLORS.neon2, COLORS.neon3, COLORS.neon4],
  },
  p2: {
    keys: ["b", "n", "m", ","],
    labels: ["B", "N", "M", ","],
    colors: [COLORS.neon1, COLORS.neon2, COLORS.neon3, COLORS.neon4],
  },
};

const RIVAL = {
  name: "SNEERY PETE",
  title: "The Garage Growler",
  color: "#ff6b35",
  difficulty: 1,
};

// ─── MIDI-STYLE AUDIO ENGINE ───────────────────────────────────
function createAudioEngine() {
  let ctx = null;
  let compressor = null;

  const getCtx = () => {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      // Master compressor to glue the mix
      compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -24;
      compressor.knee.value = 12;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.15;
      compressor.connect(ctx.destination);
    }
    return ctx;
  };

  const getMaster = () => {
    getCtx();
    return compressor;
  };

  // ── Electric Guitar (player) ──
  // Two detuned sawtooths + distortion + filter sweep
  function playGuitar(freq, duration = 0.3, volume = 0.12) {
    const c = getCtx();
    const master = getMaster();
    const now = c.currentTime;

    const gainNode = c.createGain();
    const filter = c.createBiquadFilter();
    const dist = c.createWaveShaper();

    // Distortion curve
    const samples = 512;
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = Math.tanh(x * 3);
    }
    dist.curve = curve;
    dist.oversample = "2x";

    // Filter - bright attack, then mellow
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(4000, now);
    filter.frequency.exponentialRampToValueAtTime(1200, now + duration * 0.6);
    filter.Q.value = 2;

    // Two oscillators slightly detuned for thickness
    const osc1 = c.createOscillator();
    const osc2 = c.createOscillator();
    osc1.type = "sawtooth";
    osc2.type = "sawtooth";
    osc1.frequency.setValueAtTime(freq, now);
    osc2.frequency.setValueAtTime(freq * 1.003, now); // slight detune

    // ADSR envelope
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(volume, now + 0.008); // fast attack
    gainNode.gain.setValueAtTime(volume * 0.8, now + 0.03); // sustain
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc1.connect(dist);
    osc2.connect(dist);
    dist.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(master);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration);
    osc2.stop(now + duration);
  }

  // ── Power Chord (for shred phase) ──
  // Root + fifth + octave
  function playPowerChord(freq, duration = 0.2, volume = 0.1) {
    playGuitar(freq, duration, volume * 0.7);
    playGuitar(freq * 1.498, duration, volume * 0.5); // fifth
    playGuitar(freq * 2, duration, volume * 0.3); // octave
  }

  // ── Bass (rival) ──
  // Triangle + sine sub, warm and round
  function playBass(freq, duration = 0.35, volume = 0.15) {
    const c = getCtx();
    const master = getMaster();
    const now = c.currentTime;

    const gainNode = c.createGain();
    const filter = c.createBiquadFilter();

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.exponentialRampToValueAtTime(400, now + duration * 0.4);
    filter.Q.value = 3;

    const osc1 = c.createOscillator();
    const osc2 = c.createOscillator();
    osc1.type = "triangle";
    osc2.type = "sine";
    osc1.frequency.setValueAtTime(freq, now);
    osc2.frequency.setValueAtTime(freq * 0.5, now); // sub octave

    const g1 = c.createGain();
    const g2 = c.createGain();
    g1.gain.value = 0.7;
    g2.gain.value = 0.5;

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(volume, now + 0.01);
    gainNode.gain.setValueAtTime(volume * 0.9, now + 0.04);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc1.connect(g1);
    osc2.connect(g2);
    g1.connect(filter);
    g2.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(master);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration);
    osc2.stop(now + duration);
  }

  // ── Drums ──
  function playKick() {
    const c = getCtx();
    const master = getMaster();
    const now = c.currentTime;

    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.12);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  function playSnare() {
    const c = getCtx();
    const master = getMaster();
    const now = c.currentTime;

    // Noise burst
    const bufferSize = c.sampleRate * 0.1;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = c.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = c.createBiquadFilter();
    noiseFilter.type = "highpass";
    noiseFilter.frequency.value = 1000;

    const noiseGain = c.createGain();
    noiseGain.gain.setValueAtTime(0.25, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    // Tone body
    const osc = c.createOscillator();
    const oscGain = c.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.04);
    oscGain.gain.setValueAtTime(0.3, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(master);
    osc.connect(oscGain);
    oscGain.connect(master);

    noise.start(now);
    noise.stop(now + 0.12);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  function playHihat(open = false) {
    const c = getCtx();
    const master = getMaster();
    const now = c.currentTime;
    const dur = open ? 0.2 : 0.06;

    const bufferSize = c.sampleRate * dur;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = c.createBufferSource();
    noise.buffer = buffer;

    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 8000;
    filter.Q.value = 1.5;

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    noise.start(now);
    noise.stop(now + dur);
  }

  // ── Musical scales (pentatonic for always-sounds-good) ──
  // E minor pentatonic in different octaves
  const playerNotes = [
    [164.8, 196.0, 220.0, 261.6],   // P1: E3, G3, A3, C4
    [329.6, 392.0, 440.0, 523.3],   // P2: E4, G4, A4, C5
  ];

  const rivalNotes = [146.8, 174.6, 196.0, 233.1]; // D3, F3, G3, Bb3

  // Shred notes - more range for variety
  const shredNotes = [
    164.8, 196.0, 220.0, 261.6,
    329.6, 392.0, 440.0, 523.3,
  ];

  let lastShredNote = 0;

  function playPlayerNote(player, buttonIndex) {
    const p = player === 1 ? 0 : 1;
    playGuitar(playerNotes[p][buttonIndex], 0.3, 0.12);
    // Add hi-hat on every note for rhythm feel
    playHihat();
  }

  function playRivalNote(buttonIndex) {
    playBass(rivalNotes[buttonIndex], 0.35, 0.15);
    // Kick on low notes, snare on high
    if (buttonIndex < 2) {
      playKick();
    } else {
      playSnare();
    }
  }

  function playShredNote(buttonIndex) {
    // Pick from expanded range, add some power chords randomly
    const noteIdx = (lastShredNote + buttonIndex + 1) % shredNotes.length;
    lastShredNote = noteIdx;
    const freq = shredNotes[noteIdx];

    if (Math.random() > 0.7) {
      playPowerChord(freq, 0.15, 0.08);
    } else {
      playGuitar(freq, 0.12, 0.1);
    }
    // Alternating kick/hihat for driving rhythm
    if (Math.random() > 0.5) {
      playKick();
    } else {
      playHihat();
    }
  }

  function playSuccess() {
    // Victory riff: ascending power chords
    const riff = [329.6, 392.0, 440.0, 523.3];
    riff.forEach((f, i) => {
      setTimeout(() => {
        playPowerChord(f, 0.25, 0.1);
        if (i === riff.length - 1) playSnare();
        else playHihat();
      }, i * 120);
    });
  }

  function playFail() {
    // Dissonant low notes
    const c = getCtx();
    const master = getMaster();
    const now = c.currentTime;

    playBass(73.4, 0.5, 0.2); // Low D2
    setTimeout(() => playBass(77.8, 0.4, 0.15), 50); // Slightly detuned = ugly
    playSnare();
  }

  function playCrowdCheer() {
    // Filtered noise burst that sounds like a crowd roar
    const c = getCtx();
    const master = getMaster();
    const now = c.currentTime;

    const bufferSize = c.sampleRate * 0.4;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
    }
    const noise = c.createBufferSource();
    noise.buffer = buffer;

    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1200;
    filter.Q.value = 0.5;

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    noise.start(now);
    noise.stop(now + 0.4);

    // Couple whistles
    [1800, 2200].forEach((f, i) => {
      setTimeout(() => {
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(f, c.currentTime);
        osc.frequency.linearRampToValueAtTime(f * 1.2, c.currentTime + 0.1);
        g.gain.setValueAtTime(0.03, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15);
        osc.connect(g);
        g.connect(master);
        osc.start(c.currentTime);
        osc.stop(c.currentTime + 0.15);
      }, i * 100 + 100);
    });
  }

  function playCrowdBoo() {
    const c = getCtx();
    const master = getMaster();
    const now = c.currentTime;

    const bufferSize = c.sampleRate * 0.5;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = c.createBufferSource();
    noise.buffer = buffer;

    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 500;
    filter.Q.value = 1;

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    noise.start(now);
    noise.stop(now + 0.5);
  }

  return { playPlayerNote, playRivalNote, playShredNote, playSuccess, playFail, playCrowdCheer, playCrowdBoo };
}

// ─── GAME LOGIC ────────────────────────────────────────────────

function generatePattern(length) {
  const pattern = [];
  for (let i = 0; i < length; i++) {
    pattern.push(Math.floor(Math.random() * 4));
  }
  return pattern;
}

function PixelChar({ x, y, color, flip, scale = 1, state = "idle", beat = 0 }) {
  const bounce = state === "singing" ? Math.sin(beat * 0.3) * 3 : 0;
  const sway = state === "fail" ? Math.sin(beat * 0.5) * 5 : 0;

  return (
    <g transform={`translate(${x + sway}, ${y + bounce}) scale(${flip ? -scale : scale}, ${scale})`}>
      <rect x="-8" y="8" width="16" height="20" fill={color} rx="2" />
      <rect x="-7" y="-8" width="14" height="16" fill="#ffcc88" rx="3" />
      <rect x="-2" y="-18" width="4" height="12" fill={color} />
      <rect x="-4" y="-14" width="2" height="6" fill={color} />
      <rect x="2" y="-14" width="2" height="6" fill={color} />
      <rect x="-4" y="-4" width="3" height="3" fill="#222" />
      <rect x="1" y="-4" width="3" height="3" fill="#222" />
      {state === "singing" ? (
        <ellipse cx="0" cy="3" rx="3" ry={2 + Math.sin(beat * 0.5)} fill="#222" />
      ) : state === "fail" ? (
        <path d="M-3,4 Q0,1 3,4" stroke="#222" strokeWidth="1.5" fill="none" />
      ) : (
        <rect x="-2" y="2" width="4" height="1.5" fill="#222" />
      )}
      <rect x="-6" y="28" width="5" height="10" fill="#333366" />
      <rect x="1" y="28" width="5" height="10" fill="#333366" />
      <rect x="-7" y="36" width="6" height="4" fill="#222" rx="1" />
      <rect x="1" y="36" width="6" height="4" fill="#222" rx="1" />
    </g>
  );
}

function Crowd({ energy, beat }) {
  const heads = [];
  for (let i = 0; i < 20; i++) {
    const x = 30 + i * 27;
    const baseY = 320 + Math.sin(i * 1.5) * 5;
    const jump = energy > 60 ? Math.abs(Math.sin(beat * 0.15 + i * 0.8)) * (energy - 50) * 0.15 : 0;
    const armUp = energy > 70 && Math.sin(beat * 0.2 + i) > 0.3;
    heads.push(
      <g key={i}>
        <circle cx={x} cy={baseY - jump} r="8" fill={COLORS.crowd} opacity="0.7" />
        <rect x={x - 5} y={baseY - jump + 6} width="10" height="14" fill={COLORS.crowd} opacity="0.5" />
        {armUp && (
          <line x1={x + 3} y1={baseY - jump + 2} x2={x + 8} y2={baseY - jump - 10}
            stroke={COLORS.crowd} strokeWidth="2" opacity="0.6" />
        )}
      </g>
    );
  }
  return <g>{heads}</g>;
}

function StageLights({ intensity, beat }) {
  const flicker1 = 0.5 + Math.sin(beat * 0.13) * 0.3;
  const flicker2 = 0.5 + Math.sin(beat * 0.17 + 2) * 0.3;
  return (
    <g>
      <ellipse cx="120" cy="20" rx="90" ry="220" fill={COLORS.neon1} opacity={0.02 * intensity * flicker1} />
      <ellipse cx="450" cy="20" rx="90" ry="220" fill={COLORS.neon2} opacity={0.02 * intensity * flicker2} />
      <ellipse cx="285" cy="15" rx="50" ry="180" fill={COLORS.neon3} opacity={0.015 * intensity} />
    </g>
  );
}

// ─── MAIN COMPONENT ────────────────────────────────────────────

export default function RockStars() {
  const [gameState, setGameState] = useState("title");
  const [crowdMeter, setCrowdMeter] = useState(50);
  const [currentPattern, setCurrentPattern] = useState([]);
  const [patternIndex, setPatternIndex] = useState(0);
  const [playerInput, setPlayerInput] = useState([]);
  const [shredPower, setShredPower] = useState(0);
  const [shredTarget, setShredTarget] = useState(30);
  const [round, setRound] = useState(1);
  const [showingPattern, setShowingPattern] = useState(false);
  const [patternShowIndex, setPatternShowIndex] = useState(-1);
  const [feedback, setFeedback] = useState("");
  const [feedbackTimer, setFeedbackTimer] = useState(0);
  const [beat, setBeat] = useState(0);
  const [activePlayer, setActivePlayer] = useState(1);
  const [twoPlayer, setTwoPlayer] = useState(false);
  const [vsMode, setVsMode] = useState(false);
  const [shredTimeLeft, setShredTimeLeft] = useState(0);
  const [inputFlash, setInputFlash] = useState(-1);
  const [rivalState, setRivalState] = useState("idle");
  const [playerState, setPlayerState] = useState("idle");
  const [comboCount, setComboCount] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const audioRef = useRef(null);
  const shredIntervalRef = useRef(null);
  const patternTimeoutRef = useRef(null);

  useEffect(() => {
    audioRef.current = createAudioEngine();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setBeat((b) => b + 1), 100);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (feedbackTimer > 0) {
      const t = setTimeout(() => setFeedbackTimer((f) => f - 1), 100);
      return () => clearTimeout(t);
    } else {
      setFeedback("");
    }
  }, [feedbackTimer]);

  const showFeedback = (msg, duration = 8) => {
    setFeedback(msg);
    setFeedbackTimer(duration);
  };

  useEffect(() => {
    return () => {
      if (shredIntervalRef.current) clearInterval(shredIntervalRef.current);
      if (patternTimeoutRef.current) clearTimeout(patternTimeoutRef.current);
    };
  }, []);

  const startRespondPhase = useCallback((roundNum) => {
    const len = Math.min(3 + roundNum, 8);
    const pattern = generatePattern(len);
    setCurrentPattern(pattern);
    setPlayerInput([]);
    setPatternIndex(0);
    setShowingPattern(true);
    setPatternShowIndex(-1);
    setGameState("respond");
    setRivalState("idle");
    setPlayerState("idle");

    // Countdown 3, 2, 1 before rival plays
    setCountdown(3);
    setTimeout(() => setCountdown(2), 700);
    setTimeout(() => setCountdown(1), 1400);
    setTimeout(() => {
      setCountdown(0);
      setRivalState("singing");

      // Now show the pattern
      let idx = 0;
      const showNext = () => {
        if (idx < pattern.length) {
          setPatternShowIndex(idx);
          audioRef.current?.playRivalNote(pattern[idx]);
          idx++;
          patternTimeoutRef.current = setTimeout(showNext, 550);
        } else {
          setPatternShowIndex(-1);
          setShowingPattern(false);
          setRivalState("idle");
          showFeedback("YOUR TURN!", 10);
        }
      };
      patternTimeoutRef.current = setTimeout(showNext, 300);
    }, 2100);
  }, []);

  const startShredPhase = useCallback(() => {
    setGameState("shred");
    setShredPower(0);
    const target = 15 + round * 8;
    setShredTarget(target);
    setShredTimeLeft(40);
    setPlayerState("singing");
    setRivalState("idle");
    showFeedback("SHRED IT!", 15);

    if (shredIntervalRef.current) clearInterval(shredIntervalRef.current);
    shredIntervalRef.current = setInterval(() => {
      setShredTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(shredIntervalRef.current);
          shredIntervalRef.current = null;
          setTimeout(() => evaluateShred(), 50);
          return 0;
        }
        return t - 1;
      });
    }, 100);
  }, [round]);

  const evaluateShred = () => {
    setShredPower((power) => {
      setShredTarget((target) => {
        const ratio = power / Math.max(target, 1);
        if (ratio >= 0.8) {
          const gain = 8 + round * 2;
          setCrowdMeter((m) => Math.min(100, m + gain));
          audioRef.current?.playSuccess();
          audioRef.current?.playCrowdCheer();
          showFeedback("🔥 EPIC SHRED!", 12);
        } else if (ratio >= 0.5) {
          setCrowdMeter((m) => Math.min(100, m + 3));
          showFeedback("DECENT!", 10);
        } else {
          const loss = 5 + round;
          setCrowdMeter((m) => Math.max(0, m - loss));
          audioRef.current?.playFail();
          audioRef.current?.playCrowdBoo();
          showFeedback("WEAK...", 10);
          setPlayerState("fail");
        }

        setTimeout(() => {
          setCrowdMeter((meter) => {
            if (meter >= 85) {
              setGameState("win");
              showFeedback("YOU WIN!", 30);
              return meter;
            } else if (meter <= 15) {
              setGameState("lose");
              showFeedback("YOU LOSE...", 30);
              return meter;
            } else {
              setRound((r) => {
                startRespondPhase(r + 1);
                return r + 1;
              });
              return meter;
            }
          });
        }, 1200);

        return target;
      });
      return power;
    });
  };

  useEffect(() => {
    const handleKey = (e) => {
      const key = e.key.toLowerCase();

      if (gameState === "title") {
        if (key === "enter" || key === " ") setGameState("modeselect");
        return;
      }

      if (gameState === "modeselect") {
        if (key === "1") {
          setVsMode(false);
          setTwoPlayer(false);
          setCrowdMeter(50);
          setRound(1);
          setComboCount(0);
          setGameState("intro");
          setTimeout(() => startRespondPhase(1), 2000);
        } else if (key === "2") {
          setVsMode(true);
          setTwoPlayer(true);
          setCrowdMeter(50);
          setRound(1);
          setComboCount(0);
          setActivePlayer(1);
          setGameState("intro");
          setTimeout(() => startRespondPhase(1), 2000);
        }
        return;
      }

      if (gameState === "win" || gameState === "lose") {
        if (key === "enter" || key === " ") {
          setGameState("title");
          setCrowdMeter(50);
          setRound(1);
          setComboCount(0);
        }
        return;
      }

      const pKeys = activePlayer === 1 ? BUTTON_MAP.p1.keys : BUTTON_MAP.p2.keys;

      if (gameState === "respond" && !showingPattern) {
        const btnIdx = pKeys.indexOf(key);
        if (btnIdx === -1) return;

        setInputFlash(btnIdx);
        setTimeout(() => setInputFlash(-1), 150);
        setPlayerState("singing");

        setPatternIndex((idx) => {
          if (btnIdx === currentPattern[idx]) {
            // Correct — play the matching rival note so you're recreating the melody
            audioRef.current?.playRivalNote(currentPattern[idx]);
            setComboCount((c) => c + 1);
            const newInput = [...playerInput, btnIdx];
            setPlayerInput(newInput);

            if (idx + 1 >= currentPattern.length) {
              const gain = 5 + Math.floor(comboCount / 3) * 2;
              setCrowdMeter((m) => Math.min(100, m + gain));
              audioRef.current?.playSuccess();
              audioRef.current?.playCrowdCheer();
              showFeedback("PERFECT! 🎸", 12);
              setTimeout(() => startShredPhase(), 800);
            }
            return idx + 1;
          } else {
            setComboCount(0);
            const loss = 5 + round * 2;
            setCrowdMeter((m) => Math.max(0, m - loss));
            audioRef.current?.playFail();
            audioRef.current?.playCrowdBoo();
            setPlayerState("fail");
            showFeedback("MISS!", 10);

            setTimeout(() => {
              setCrowdMeter((meter) => {
                if (meter <= 15) {
                  setGameState("lose");
                  showFeedback("YOU LOSE...", 30);
                  return meter;
                }
                startShredPhase();
                return meter;
              });
            }, 800);
            return 0;
          }
        });
      }

      if (gameState === "shred" && shredTimeLeft > 0) {
        const btnIdx = pKeys.indexOf(key);
        if (btnIdx === -1) return;

        setInputFlash(btnIdx);
        setTimeout(() => setInputFlash(-1), 100);
        // Use the shred-specific note player for variety
        audioRef.current?.playShredNote(btnIdx);
        setPlayerState("singing");
        setShredPower((p) => p + 1);
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [gameState, showingPattern, currentPattern, patternIndex, playerInput, activePlayer, shredTimeLeft, round, comboCount, startRespondPhase, startShredPhase]);

  const pConfig = activePlayer === 1 ? BUTTON_MAP.p1 : BUTTON_MAP.p2;
  const crowdIntensity = Math.abs(crowdMeter - 50) / 50;

  return (
    <div style={{ background: COLORS.dark, borderRadius: 8, overflow: "hidden", userSelect: "none" }}>
      <svg viewBox="0 0 570 420" style={{ display: "block", width: "100%", maxWidth: 570 }}>
        <rect width="570" height="420" fill={COLORS.bg} />

        {/* ── TITLE ── */}
        {gameState === "title" && (
          <g>
            <rect width="570" height="420" fill={COLORS.dark} />
            <StageLights intensity={8 + Math.sin(beat * 0.2) * 4} beat={beat} />
            <text x="285" y="100" textAnchor="middle" fill={COLORS.neon1} fontSize="48" fontWeight="900" fontFamily="monospace">ROCK</text>
            <text x="285" y="155" textAnchor="middle" fill={COLORS.neon3} fontSize="48" fontWeight="900" fontFamily="monospace">STARS</text>
            <text x="285" y="200" textAnchor="middle" fontSize="30">🎸</text>
            <text x="285" y="250" textAnchor="middle" fill={COLORS.textDim} fontSize="13" fontFamily="monospace">A MUSIC BATTLE GAME</text>
            <PixelChar x={180} y={300} color={COLORS.neon1} flip={false} scale={1.5} state="idle" beat={beat} />
            <PixelChar x={390} y={300} color={COLORS.neon2} flip={true} scale={1.5} state="idle" beat={beat} />
            <text x="285" y="395" textAnchor="middle" fill={COLORS.text} fontSize="13" fontFamily="monospace"
              opacity={0.4 + Math.sin(beat * 0.3) * 0.4}>PRESS ENTER TO START</text>
          </g>
        )}

        {/* ── MODE SELECT ── */}
        {gameState === "modeselect" && (
          <g>
            <rect width="570" height="420" fill={COLORS.dark} />
            <StageLights intensity={5} beat={beat} />
            <text x="285" y="80" textAnchor="middle" fill={COLORS.neon3} fontSize="26" fontWeight="bold" fontFamily="monospace">SELECT MODE</text>
            <rect x="100" y="120" width="370" height="70" rx="6" fill={COLORS.stage} stroke={COLORS.neon1} strokeWidth="2" />
            <text x="285" y="152" textAnchor="middle" fill={COLORS.neon1} fontSize="18" fontWeight="bold" fontFamily="monospace">[1] VS SNEERY PETE</text>
            <text x="285" y="177" textAnchor="middle" fill={COLORS.textDim} fontSize="11" fontFamily="monospace">Battle the Garage Growler! (Keys: Z X C V)</text>
            <rect x="100" y="220" width="370" height="70" rx="6" fill={COLORS.stage} stroke={COLORS.neon2} strokeWidth="2" />
            <text x="285" y="252" textAnchor="middle" fill={COLORS.neon2} fontSize="18" fontWeight="bold" fontFamily="monospace">[2] VS PLAYER 2</text>
            <text x="285" y="277" textAnchor="middle" fill={COLORS.textDim} fontSize="11" fontFamily="monospace">P1: Z X C V — P2: B N M ,</text>
            <PixelChar x={60} y={350} color={COLORS.neon1} flip={false} scale={1.3} state="idle" beat={beat} />
            <PixelChar x={510} y={350} color={COLORS.neon2} flip={true} scale={1.3} state="idle" beat={beat} />
          </g>
        )}

        {/* ── INTRO ── */}
        {gameState === "intro" && (
          <g>
            <rect width="570" height="420" fill={COLORS.dark} />
            <StageLights intensity={6} beat={beat} />
            <text x="285" y="100" textAnchor="middle" fill={COLORS.textDim} fontSize="14" fontFamily="monospace">THE GARAGE — ROUND 1</text>
            <text x="285" y="160" textAnchor="middle" fill={RIVAL.color} fontSize="30" fontWeight="bold" fontFamily="monospace">{RIVAL.name}</text>
            <text x="285" y="195" textAnchor="middle" fill={COLORS.textDim} fontSize="13" fontFamily="monospace">"{RIVAL.title}"</text>
            <PixelChar x={285} y={280} color={RIVAL.color} flip={false} scale={2.2} state="singing" beat={beat} />
            <text x="285" y="385" textAnchor="middle" fill={COLORS.textDim} fontSize="12" fontFamily="monospace"
              opacity={0.4 + Math.sin(beat * 0.4) * 0.4}>GET READY...</text>
          </g>
        )}

        {/* ── BATTLE ── */}
        {(gameState === "respond" || gameState === "shred") && (
          <g>
            <rect width="570" height="420" fill={COLORS.bg} />
            <rect x="0" y="250" width="570" height="170" fill={COLORS.stage} />
            <rect x="0" y="245" width="570" height="8" fill={COLORS.stageFloor} />
            <StageLights intensity={3 + crowdIntensity * 8} beat={beat} />
            <Crowd energy={crowdMeter} beat={beat} />

            {/* Crowd meter */}
            <rect x="60" y="15" width="450" height="24" rx="12" fill="#222244" stroke="#444466" strokeWidth="2" />
            <rect x="62" y="17" width={Math.max(0, (crowdMeter / 100) * 446)} height="20" rx="10"
              fill={crowdMeter > 60 ? COLORS.success : crowdMeter < 40 ? COLORS.fail : COLORS.neon3}
              opacity={0.8 + Math.sin(beat * 0.2) * 0.2} />
            <line x1={60 + 225} y1="12" x2={60 + 225} y2="42" stroke="white" strokeWidth="2" opacity="0.5" />
            <text x="35" y="32" textAnchor="middle" fill={COLORS.neon1} fontSize="10" fontWeight="bold" fontFamily="monospace">YOU</text>
            <text x="535" y="32" textAnchor="middle" fill={RIVAL.color} fontSize="10" fontWeight="bold" fontFamily="monospace">RIVAL</text>

            <text x="285" y="58" textAnchor="middle" fill={COLORS.textDim} fontSize="10" fontFamily="monospace">ROUND {round}</text>

            {/* Phase banner */}
            <rect x="160" y="65" width="250" height="26" rx="4" fill={gameState === "respond" ? "#331122" : "#112233"} />
            <text x="285" y="83" textAnchor="middle" fill={gameState === "respond" ? COLORS.neon1 : COLORS.neon2}
              fontSize="12" fontWeight="bold" fontFamily="monospace">
              {gameState === "respond" ? (countdown > 0 ? "GET READY..." : showingPattern ? "♪ LISTEN... ♪" : "♪ REPEAT THE PATTERN ♪") : "⚡ SHRED IT! TAP FAST! ⚡"}
            </text>

            {/* Countdown overlay */}
            {countdown > 0 && (
              <g>
                <rect x="235" y="130" width="100" height="80" rx="10" fill="#000000" opacity="0.7" />
                <text x="285" y="185" textAnchor="middle" fill={COLORS.neon3} fontSize="48" fontWeight="900" fontFamily="monospace">
                  {countdown}
                </text>
              </g>
            )}

            {/* Pattern dots */}
            {gameState === "respond" && (
              <g>
                {currentPattern.map((note, i) => {
                  const bw = 24;
                  const totalW = currentPattern.length * bw;
                  const sx = 285 - totalW / 2 + i * bw;
                  const active = showingPattern && i === patternShowIndex;
                  const done = !showingPattern && i < patternIndex;
                  const current = !showingPattern && i === patternIndex;
                  return (
                    <g key={i}>
                      <rect x={sx} y="98" width="20" height="20" rx="4"
                        fill={active ? pConfig.colors[note] : done ? COLORS.success : "#333355"}
                        stroke={current ? "#ffffff" : "transparent"} strokeWidth="2"
                        opacity={active ? 1 : 0.7} />
                      {active && (
                        <text x={sx + 10} y="112" textAnchor="middle" fill="#000" fontSize="10" fontFamily="monospace" fontWeight="bold">
                          {pConfig.labels[note]}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            )}

            {/* Shred bar */}
            {gameState === "shred" && (
              <g>
                <rect x="140" y="100" width="290" height="20" rx="5" fill="#222244" stroke="#444466" strokeWidth="1" />
                <rect x="142" y="102" width={Math.min(286, (shredPower / shredTarget) * 286)} height="16" rx="4"
                  fill={shredPower >= shredTarget ? COLORS.success : COLORS.neon2} />
                <text x="285" y="114" textAnchor="middle" fill="white" fontSize="10" fontFamily="monospace" fontWeight="bold">
                  {shredPower} / {shredTarget}
                </text>
                <text x="440" y="114" textAnchor="start" fill={shredTimeLeft < 15 ? COLORS.fail : COLORS.textDim}
                  fontSize="10" fontFamily="monospace">
                  {(shredTimeLeft / 10).toFixed(1)}s
                </text>
              </g>
            )}

            {/* Characters */}
            <PixelChar x={140} y={190} color={COLORS.neon1} flip={false} scale={2} state={playerState} beat={beat} />
            <text x="285" y="220" textAnchor="middle" fill={COLORS.textDim} fontSize="14" fontWeight="bold" fontFamily="monospace" opacity="0.3">VS</text>
            <PixelChar x={430} y={190} color={RIVAL.color} flip={true} scale={2} state={rivalState} beat={beat} />

            {/* Combo */}
            {comboCount > 2 && (
              <text x="140" y="160" textAnchor="middle" fill={COLORS.neon3} fontSize="14" fontWeight="bold" fontFamily="monospace">
                {comboCount}x COMBO!
              </text>
            )}

            {/* Feedback */}
            {feedback && (
              <text x="285" y="150" textAnchor="middle" fill={COLORS.neon3} fontSize="24" fontWeight="900" fontFamily="monospace"
                opacity={Math.min(1, feedbackTimer / 5)}>
                {feedback}
              </text>
            )}

            {/* Button prompts */}
            {pConfig.labels.map((label, i) => (
              <g key={i}>
                <rect x={195 + i * 50} y="370" width="38" height="38" rx="6"
                  fill={inputFlash === i ? pConfig.colors[i] : "#1a1a33"}
                  stroke={pConfig.colors[i]} strokeWidth="2" />
                <text x={214 + i * 50} y="395" textAnchor="middle"
                  fill={inputFlash === i ? "#000" : pConfig.colors[i]}
                  fontSize="16" fontWeight="bold" fontFamily="monospace">{label}</text>
              </g>
            ))}
          </g>
        )}

        {/* ── WIN ── */}
        {gameState === "win" && (
          <g>
            <rect width="570" height="420" fill={COLORS.dark} />
            <StageLights intensity={12} beat={beat} />
            <text x="285" y="90" textAnchor="middle" fill={COLORS.neon3} fontSize="44" fontWeight="900" fontFamily="monospace">YOU WIN!</text>
            <text x="285" y="125" textAnchor="middle" fill={COLORS.text} fontSize="14" fontFamily="monospace">{RIVAL.name} has been defeated!</text>
            <PixelChar x={285} y={230} color={COLORS.neon1} flip={false} scale={2.5} state="singing" beat={beat} />
            <text x="285" y="330" textAnchor="middle" fill={COLORS.neon3} fontSize="22" fontFamily="monospace">🎸 ROCK STAR! 🎸</text>
            <text x="285" y="395" textAnchor="middle" fill={COLORS.textDim} fontSize="12" fontFamily="monospace"
              opacity={0.4 + Math.sin(beat * 0.3) * 0.4}>PRESS ENTER TO CONTINUE</text>
          </g>
        )}

        {/* ── LOSE ── */}
        {gameState === "lose" && (
          <g>
            <rect width="570" height="420" fill={COLORS.dark} />
            <text x="285" y="90" textAnchor="middle" fill={COLORS.fail} fontSize="38" fontWeight="900" fontFamily="monospace">GAME OVER</text>
            <text x="285" y="125" textAnchor="middle" fill={COLORS.textDim} fontSize="14" fontFamily="monospace">{RIVAL.name} wins this round...</text>
            <PixelChar x={285} y={230} color={RIVAL.color} flip={false} scale={2.5} state="singing" beat={beat} />
            <text x="285" y="330" textAnchor="middle" fill={COLORS.textDim} fontSize="18" fontFamily="monospace">TRY AGAIN?</text>
            <text x="285" y="395" textAnchor="middle" fill={COLORS.textDim} fontSize="12" fontFamily="monospace"
              opacity={0.4 + Math.sin(beat * 0.3) * 0.4}>PRESS ENTER</text>
          </g>
        )}
      </svg>
    </div>
  );
}