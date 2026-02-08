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

// Audio engine using Web Audio API
function createAudioEngine() {
  let ctx = null;

  const getCtx = () => {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  };

  // Musical notes for each button (pentatonic scale - always sounds good)
  const noteFreqs = [
    [196.0, 220.0, 261.6, 293.7], // P1: G3, A3, C4, D4
    [329.6, 392.0, 440.0, 523.3], // P2: E4, G4, A4, C5
  ];

  const rivalFreqs = [174.6, 196.0, 233.1, 261.6]; // F3, G3, Bb3, C4

  function playNote(freq, type = "square", duration = 0.15, gain = 0.15) {
    const c = getCtx();
    const osc = c.createOscillator();
    const g = c.createGain();
    const dist = c.createWaveShaper();

    // Add some grit
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i * 2) / 256 - 1;
      curve[i] = ((3 + 10) * x * (Math.PI / 180)) / (Math.PI + 10 * Math.abs(x));
    }
    dist.curve = curve;

    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime);
    g.gain.setValueAtTime(gain, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);

    osc.connect(dist);
    dist.connect(g);
    g.connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + duration);
  }

  function playPlayerNote(player, buttonIndex) {
    const p = player === 1 ? 0 : 1;
    playNote(noteFreqs[p][buttonIndex], "square", 0.18, 0.12);
  }

  function playRivalNote(buttonIndex) {
    playNote(rivalFreqs[buttonIndex], "sawtooth", 0.2, 0.1);
  }

  function playSuccess() {
    const c = getCtx();
    [523.3, 659.3, 784.0].forEach((f, i) => {
      setTimeout(() => playNote(f, "square", 0.2, 0.1), i * 80);
    });
  }

  function playFail() {
    playNote(130.8, "sawtooth", 0.4, 0.15);
  }

  function playCrowdCheer() {
    const c = getCtx();
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        playNote(800 + Math.random() * 600, "triangle", 0.1, 0.03);
      }, i * 50);
    }
  }

  function playCrowdBoo() {
    playNote(80 + Math.random() * 40, "sawtooth", 0.3, 0.05);
  }

  return { playPlayerNote, playRivalNote, playSuccess, playFail, playCrowdCheer, playCrowdBoo };
}

// Pattern generator
function generatePattern(length) {
  const pattern = [];
  for (let i = 0; i < length; i++) {
    pattern.push(Math.floor(Math.random() * 4));
  }
  return pattern;
}

// Pixel character renderer
function PixelChar({ x, y, color, flip, scale = 1, state = "idle", beat = 0 }) {
  // Simple pixel art character - mohawk punk
  const bounce = state === "singing" ? Math.sin(beat * 0.3) * 2 : 0;
  const sway = state === "fail" ? Math.sin(beat * 0.5) * 4 : 0;

  return (
    <g transform={`translate(${x + sway}, ${y + bounce}) scale(${flip ? -scale : scale}, ${scale})`}>
      {/* Body */}
      <rect x="-8" y="8" width="16" height="20" fill={color} rx="2" />
      {/* Head */}
      <rect x="-7" y="-8" width="14" height="16" fill="#ffcc88" rx="3" />
      {/* Mohawk */}
      <rect x="-2" y="-18" width="4" height="12" fill={color} />
      <rect x="-4" y="-14" width="2" height="6" fill={color} />
      <rect x="2" y="-14" width="2" height="6" fill={color} />
      {/* Eyes */}
      <rect x="-4" y="-4" width="3" height="3" fill="#222" />
      <rect x="1" y="-4" width="3" height="3" fill="#222" />
      {/* Mouth */}
      {state === "singing" ? (
        <ellipse cx="0" cy="3" rx="3" ry="2" fill="#222" />
      ) : state === "fail" ? (
        <rect x="-3" y="2" width="6" height="2" fill="#222" />
      ) : (
        <rect x="-2" y="2" width="4" height="1.5" fill="#222" />
      )}
      {/* Legs */}
      <rect x="-6" y="28" width="5" height="10" fill="#333366" />
      <rect x="1" y="28" width="5" height="10" fill="#333366" />
      {/* Shoes */}
      <rect x="-7" y="36" width="6" height="4" fill="#222" rx="1" />
      <rect x="1" y="36" width="6" height="4" fill="#222" rx="1" />
    </g>
  );
}

// Crowd silhouette
function Crowd({ energy, side }) {
  const heads = [];
  for (let i = 0; i < 20; i++) {
    const x = 30 + i * 27;
    const baseY = 320 + Math.sin(i * 1.5) * 5;
    const jump = energy > 60 ? Math.abs(Math.sin(Date.now() / 200 + i)) * 8 : 0;
    heads.push(
      <g key={i}>
        <circle cx={x} cy={baseY - jump} r="8" fill={COLORS.crowd} opacity="0.7" />
        <rect x={x - 5} y={baseY - jump + 6} width="10" height="14" fill={COLORS.crowd} opacity="0.5" />
      </g>
    );
  }
  return <g>{heads}</g>;
}

// Stage lights
function StageLights({ intensity }) {
  return (
    <g>
      <ellipse cx="150" cy="30" rx="80" ry="200" fill={COLORS.neon1} opacity={0.03 * intensity} />
      <ellipse cx="420" cy="30" rx="80" ry="200" fill={COLORS.neon2} opacity={0.03 * intensity} />
      <ellipse cx="285" cy="20" rx="60" ry="180" fill={COLORS.neon3} opacity={0.02 * intensity} />
    </g>
  );
}

// Main Game Component
export default function RockStars() {
  const [gameState, setGameState] = useState("title"); // title, intro, respond, shred, result, win, lose
  const [crowdMeter, setCrowdMeter] = useState(50); // 0-100, 50 is neutral
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
  const [scores, setScores] = useState({ p1: 0, p2: 0 });
  const [vsMode, setVsMode] = useState(false);
  const [shredTimeLeft, setShredTimeLeft] = useState(0);
  const [inputFlash, setInputFlash] = useState(-1);
  const [rivalState, setRivalState] = useState("idle");
  const [playerState, setPlayerState] = useState("idle");
  const [lastHit, setLastHit] = useState(null); // "perfect", "miss"
  const [comboCount, setComboCount] = useState(0);
  const audioRef = useRef(null);
  const shredIntervalRef = useRef(null);
  const patternTimeoutRef = useRef(null);

  // Initialize audio
  useEffect(() => {
    audioRef.current = createAudioEngine();
  }, []);

  // Beat counter for animations
  useEffect(() => {
    const interval = setInterval(() => setBeat((b) => b + 1), 100);
    return () => clearInterval(interval);
  }, []);

  // Feedback timer
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

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (shredIntervalRef.current) clearInterval(shredIntervalRef.current);
      if (patternTimeoutRef.current) clearTimeout(patternTimeoutRef.current);
    };
  }, []);

  // Start a respond phase
  const startRespondPhase = useCallback(
    (roundNum) => {
      const len = Math.min(3 + roundNum, 8);
      const pattern = generatePattern(len);
      setCurrentPattern(pattern);
      setPlayerInput([]);
      setPatternIndex(0);
      setShowingPattern(true);
      setPatternShowIndex(-1);
      setGameState("respond");
      setRivalState("singing");
      setPlayerState("idle");
      setLastHit(null);

      // Show pattern one note at a time
      let idx = 0;
      const showNext = () => {
        if (idx < pattern.length) {
          setPatternShowIndex(idx);
          audioRef.current?.playRivalNote(pattern[idx]);
          idx++;
          patternTimeoutRef.current = setTimeout(showNext, 500);
        } else {
          setPatternShowIndex(-1);
          setShowingPattern(false);
          setRivalState("idle");
          setPlayerState("idle");
          showFeedback("YOUR TURN!", 10);
        }
      };
      patternTimeoutRef.current = setTimeout(showNext, 600);
    },
    []
  );

  // Start shred phase
  const startShredPhase = useCallback(() => {
    setGameState("shred");
    setShredPower(0);
    const target = 15 + round * 8;
    setShredTarget(target);
    setShredTimeLeft(40); // 4 seconds
    setPlayerState("singing");
    setRivalState("idle");
    showFeedback("SHRED IT! TAP FAST!", 15);

    if (shredIntervalRef.current) clearInterval(shredIntervalRef.current);
    shredIntervalRef.current = setInterval(() => {
      setShredTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(shredIntervalRef.current);
          shredIntervalRef.current = null;
          // Evaluate shred after a tick
          setTimeout(() => evaluateShred(), 50);
          return 0;
        }
        return t - 1;
      });
    }, 100);
  }, [round]);

  // Evaluate shred result
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
          const gain = 3;
          setCrowdMeter((m) => Math.min(100, m + gain));
          showFeedback("DECENT!", 10);
        } else {
          const loss = 5 + round;
          setCrowdMeter((m) => Math.max(0, m - loss));
          audioRef.current?.playFail();
          audioRef.current?.playCrowdBoo();
          showFeedback("WEAK...", 10);
          setPlayerState("fail");
        }

        // Check win/lose then advance
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

  // Handle key input
  useEffect(() => {
    const handleKey = (e) => {
      const key = e.key.toLowerCase();

      // Title screen
      if (gameState === "title") {
        if (key === "enter" || key === " ") {
          setGameState("modeselect");
        }
        return;
      }

      // Mode select
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

      // Win/lose screen
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

      // Respond phase - match the pattern
      if (gameState === "respond" && !showingPattern) {
        const btnIdx = pKeys.indexOf(key);
        if (btnIdx === -1) return;

        setInputFlash(btnIdx);
        setTimeout(() => setInputFlash(-1), 150);
        audioRef.current?.playPlayerNote(activePlayer, btnIdx);
        setPlayerState("singing");

        setPatternIndex((idx) => {
          if (btnIdx === currentPattern[idx]) {
            // Correct
            setLastHit("perfect");
            setComboCount((c) => c + 1);
            const newInput = [...playerInput, btnIdx];
            setPlayerInput(newInput);

            if (idx + 1 >= currentPattern.length) {
              // Pattern complete!
              const gain = 5 + Math.floor(comboCount / 3) * 2;
              setCrowdMeter((m) => Math.min(100, m + gain));
              audioRef.current?.playSuccess();
              audioRef.current?.playCrowdCheer();
              showFeedback("PERFECT! 🎸", 12);
              setTimeout(() => startShredPhase(), 800);
            }
            return idx + 1;
          } else {
            // Wrong!
            setLastHit("miss");
            setComboCount(0);
            const loss = 5 + round * 2;
            setCrowdMeter((m) => Math.max(0, m - loss));
            audioRef.current?.playFail();
            audioRef.current?.playCrowdBoo();
            setPlayerState("fail");
            showFeedback("MISS!", 10);

            // Check for loss
            setTimeout(() => {
              setCrowdMeter((meter) => {
                if (meter <= 15) {
                  setGameState("lose");
                  showFeedback("YOU LOSE...", 30);
                  return meter;
                }
                // Skip to shred phase as penalty
                startShredPhase();
                return meter;
              });
            }, 800);
            return 0;
          }
        });
      }

      // Shred phase - tap fast!
      if (gameState === "shred" && shredTimeLeft > 0) {
        const btnIdx = pKeys.indexOf(key);
        if (btnIdx === -1) return;

        setInputFlash(btnIdx);
        setTimeout(() => setInputFlash(-1), 100);
        audioRef.current?.playPlayerNote(activePlayer, btnIdx);
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
        {/* Background */}
        <rect width="570" height="420" fill={COLORS.bg} />

        {/* Title Screen */}
        {gameState === "title" && (
          <g>
            <rect width="570" height="420" fill={COLORS.dark} />
            <StageLights intensity={8 + Math.sin(beat * 0.2) * 4} />
            {/* Title */}
            <text x="285" y="100" textAnchor="middle" fill={COLORS.neon1} fontSize="48" fontWeight="900" fontFamily="monospace">
              ROCK
            </text>
            <text x="285" y="155" textAnchor="middle" fill={COLORS.neon3} fontSize="48" fontWeight="900" fontFamily="monospace">
              STARS
            </text>
            {/* Guitar emoji decoration */}
            <text x="285" y="200" textAnchor="middle" fontSize="30">🎸</text>
            {/* Subtitle */}
            <text x="285" y="260" textAnchor="middle" fill={COLORS.textDim} fontSize="14" fontFamily="monospace">
              A MUSIC BATTLE GAME
            </text>
            {/* Two characters */}
            <PixelChar x={180} y={300} color={COLORS.neon1} flip={false} scale={1.5} state="idle" beat={beat} />
            <PixelChar x={390} y={300} color={COLORS.neon2} flip={true} scale={1.5} state="idle" beat={beat} />
            <text x="285" y="390" textAnchor="middle" fill={COLORS.text} fontSize="14" fontFamily="monospace"
              opacity={0.5 + Math.sin(beat * 0.3) * 0.5}>
              PRESS ENTER TO START
            </text>
          </g>
        )}

        {/* Mode Select */}
        {gameState === "modeselect" && (
          <g>
            <rect width="570" height="420" fill={COLORS.dark} />
            <text x="285" y="100" textAnchor="middle" fill={COLORS.neon3} fontSize="28" fontWeight="bold" fontFamily="monospace">
              SELECT MODE
            </text>
            <rect x="100" y="140" width="370" height="70" rx="6" fill={COLORS.stage} stroke={COLORS.neon1} strokeWidth="2" />
            <text x="285" y="170" textAnchor="middle" fill={COLORS.neon1} fontSize="20" fontWeight="bold" fontFamily="monospace">
              [1] VS SNEERY PETE
            </text>
            <text x="285" y="195" textAnchor="middle" fill={COLORS.textDim} fontSize="12" fontFamily="monospace">
              Battle the Garage Growler! (Keys: Z X C V)
            </text>
            <rect x="100" y="240" width="370" height="70" rx="6" fill={COLORS.stage} stroke={COLORS.neon2} strokeWidth="2" />
            <text x="285" y="270" textAnchor="middle" fill={COLORS.neon2} fontSize="20" fontWeight="bold" fontFamily="monospace">
              [2] VS PLAYER 2
            </text>
            <text x="285" y="295" textAnchor="middle" fill={COLORS.textDim} fontSize="12" fontFamily="monospace">
              P1: Z X C V — P2: B N M ,
            </text>
            <PixelChar x={70} y={350} color={COLORS.neon1} flip={false} scale={1.2} state="idle" beat={beat} />
            <PixelChar x={500} y={350} color={COLORS.neon2} flip={true} scale={1.2} state="idle" beat={beat} />
          </g>
        )}

        {/* Intro */}
        {gameState === "intro" && (
          <g>
            <rect width="570" height="420" fill={COLORS.dark} />
            <text x="285" y="120" textAnchor="middle" fill={COLORS.text} fontSize="16" fontFamily="monospace">
              THE GARAGE — ROUND 1
            </text>
            <text x="285" y="180" textAnchor="middle" fill={RIVAL.color} fontSize="28" fontWeight="bold" fontFamily="monospace">
              {RIVAL.name}
            </text>
            <text x="285" y="215" textAnchor="middle" fill={COLORS.textDim} fontSize="14" fontFamily="monospace">
              "{RIVAL.title}"
            </text>
            <PixelChar x={285} y={290} color={RIVAL.color} flip={false} scale={2} state="idle" beat={beat} />
            <text x="285" y="385" textAnchor="middle" fill={COLORS.textDim} fontSize="12" fontFamily="monospace"
              opacity={0.5 + Math.sin(beat * 0.3) * 0.5}>
              GET READY...
            </text>
          </g>
        )}

        {/* Battle Screen */}
        {(gameState === "respond" || gameState === "shred") && (
          <g>
            {/* Stage background */}
            <rect width="570" height="420" fill={COLORS.bg} />
            <rect x="0" y="250" width="570" height="170" fill={COLORS.stage} />
            <rect x="0" y="245" width="570" height="8" fill={COLORS.stageFloor} />
            <StageLights intensity={3 + crowdIntensity * 8} />

            {/* Crowd */}
            <Crowd energy={crowdMeter} />

            {/* Crowd Meter */}
            <rect x="60" y="15" width="450" height="24" rx="12" fill="#222244" stroke="#444466" strokeWidth="2" />
            <rect x="62" y="17" width={Math.max(0, (crowdMeter / 100) * 446)} height="20" rx="10"
              fill={crowdMeter > 60 ? COLORS.success : crowdMeter < 40 ? COLORS.fail : COLORS.neon3} />
            <line x1={60 + 225} y1="12" x2={60 + 225} y2="42" stroke="white" strokeWidth="2" opacity="0.5" />
            <text x="35" y="32" textAnchor="middle" fill={COLORS.neon1} fontSize="10" fontWeight="bold" fontFamily="monospace">YOU</text>
            <text x="535" y="32" textAnchor="middle" fill={RIVAL.color} fontSize="10" fontWeight="bold" fontFamily="monospace">RIVAL</text>

            {/* Round */}
            <text x="285" y="60" textAnchor="middle" fill={COLORS.textDim} fontSize="11" fontFamily="monospace">
              ROUND {round}
            </text>

            {/* Player character */}
            <PixelChar x={140} y={190} color={COLORS.neon1} flip={false} scale={2} state={playerState} beat={beat} />
            {/* VS text */}
            <text x="285" y="215" textAnchor="middle" fill={COLORS.textDim} fontSize="16" fontWeight="bold" fontFamily="monospace" opacity="0.4">
              VS
            </text>
            {/* Rival character */}
            <PixelChar x={430} y={190} color={RIVAL.color} flip={true} scale={2} state={rivalState} beat={beat} />

            {/* Phase indicator */}
            <rect x="170" y="68" width="230" height="28" rx="4" fill={gameState === "respond" ? "#331122" : "#112233"} />
            <text x="285" y="87" textAnchor="middle" fill={gameState === "respond" ? COLORS.neon1 : COLORS.neon2}
              fontSize="14" fontWeight="bold" fontFamily="monospace">
              {gameState === "respond" ? (showingPattern ? "♪ LISTEN... ♪" : "♪ REPEAT THE PATTERN ♪") : "⚡ SHRED IT! ⚡"}
            </text>

            {/* Pattern display */}
            {gameState === "respond" && (
              <g>
                {currentPattern.map((note, i) => (
                  <g key={i}>
                    <rect
                      x={285 - (currentPattern.length * 22) / 2 + i * 22}
                      y="102"
                      width="18"
                      height="18"
                      rx="3"
                      fill={showingPattern && i === patternShowIndex ? pConfig.colors[note] :
                        !showingPattern && i < patternIndex ? COLORS.success :
                          "#333355"}
                      opacity={showingPattern && i === patternShowIndex ? 1 : 0.6}
                      stroke={!showingPattern && i === patternIndex ? "#ffffff" : "none"}
                      strokeWidth="2"
                    />
                    {(showingPattern && i === patternShowIndex) && (
                      <text x={285 - (currentPattern.length * 22) / 2 + i * 22 + 9} y="115"
                        textAnchor="middle" fill="white" fontSize="10" fontFamily="monospace" fontWeight="bold">
                        {pConfig.labels[note]}
                      </text>
                    )}
                  </g>
                ))}
              </g>
            )}

            {/* Shred power bar */}
            {gameState === "shred" && (
              <g>
                <rect x="160" y="105" width="250" height="18" rx="4" fill="#222244" />
                <rect x="162" y="107" width={Math.min(246, (shredPower / shredTarget) * 246)} height="14" rx="3"
                  fill={shredPower >= shredTarget ? COLORS.success : COLORS.neon2} />
                <text x="285" y="117" textAnchor="middle" fill="white" fontSize="10" fontFamily="monospace" fontWeight="bold">
                  {shredPower} / {shredTarget}
                </text>
                {/* Timer */}
                <text x="420" y="117" textAnchor="start" fill={shredTimeLeft < 15 ? COLORS.fail : COLORS.textDim}
                  fontSize="10" fontFamily="monospace">
                  {(shredTimeLeft / 10).toFixed(1)}s
                </text>
              </g>
            )}

            {/* Combo counter */}
            {comboCount > 2 && (
              <text x="140" y="165" textAnchor="middle" fill={COLORS.neon3} fontSize="14" fontWeight="bold" fontFamily="monospace">
                {comboCount}x COMBO!
              </text>
            )}

            {/* Feedback */}
            {feedback && (
              <text x="285" y="155" textAnchor="middle" fill={COLORS.neon3} fontSize="22" fontWeight="900" fontFamily="monospace"
                opacity={feedbackTimer / 8}>
                {feedback}
              </text>
            )}

            {/* Button prompts */}
            <g>
              {pConfig.labels.map((label, i) => (
                <g key={i}>
                  <rect
                    x={200 + i * 48}
                    y="370"
                    width="36"
                    height="36"
                    rx="6"
                    fill={inputFlash === i ? pConfig.colors[i] : "#222244"}
                    stroke={pConfig.colors[i]}
                    strokeWidth="2"
                  />
                  <text
                    x={218 + i * 48}
                    y="394"
                    textAnchor="middle"
                    fill={inputFlash === i ? "#000" : pConfig.colors[i]}
                    fontSize="16"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    {label}
                  </text>
                </g>
              ))}
            </g>
          </g>
        )}

        {/* Win Screen */}
        {gameState === "win" && (
          <g>
            <rect width="570" height="420" fill={COLORS.dark} />
            <StageLights intensity={10} />
            <text x="285" y="100" textAnchor="middle" fill={COLORS.neon3} fontSize="42" fontWeight="900" fontFamily="monospace">
              YOU WIN!
            </text>
            <text x="285" y="140" textAnchor="middle" fill={COLORS.text} fontSize="16" fontFamily="monospace">
              {RIVAL.name} has been defeated!
            </text>
            <PixelChar x={285} y={240} color={COLORS.neon1} flip={false} scale={2.5} state="singing" beat={beat} />
            <text x="285" y="340" textAnchor="middle" fill={COLORS.textDim} fontSize="20" fontFamily="monospace">
              🎸 ROCK STAR! 🎸
            </text>
            <text x="285" y="390" textAnchor="middle" fill={COLORS.textDim} fontSize="12" fontFamily="monospace"
              opacity={0.5 + Math.sin(beat * 0.3) * 0.5}>
              PRESS ENTER TO CONTINUE
            </text>
          </g>
        )}

        {/* Lose Screen */}
        {gameState === "lose" && (
          <g>
            <rect width="570" height="420" fill={COLORS.dark} />
            <text x="285" y="100" textAnchor="middle" fill={COLORS.fail} fontSize="36" fontWeight="900" fontFamily="monospace">
              GAME OVER
            </text>
            <text x="285" y="140" textAnchor="middle" fill={COLORS.textDim} fontSize="14" fontFamily="monospace">
              {RIVAL.name} wins this round...
            </text>
            <PixelChar x={285} y={240} color={RIVAL.color} flip={false} scale={2.5} state="singing" beat={beat} />
            <text x="285" y="340" textAnchor="middle" fill={COLORS.textDim} fontSize="16" fontFamily="monospace">
              TRY AGAIN?
            </text>
            <text x="285" y="390" textAnchor="middle" fill={COLORS.textDim} fontSize="12" fontFamily="monospace"
              opacity={0.5 + Math.sin(beat * 0.3) * 0.5}>
              PRESS ENTER
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}