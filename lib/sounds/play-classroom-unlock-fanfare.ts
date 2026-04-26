/**
 * 教室风「开门啦」：低音咚 + 上行琶音 + 回声高音 + 尾音闪星（Web Audio，无外部资源）
 * 需在用户手势后调用，否则部分浏览器会静音 AudioContext。
 */
let sharedCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!C) return null;
  if (!sharedCtx || sharedCtx.state === "closed") {
    sharedCtx = new C();
  }
  return sharedCtx;
}

function scheduleTone(
  ctx: AudioContext,
  base: number,
  opts: { freq: number; dur: number; type: OscillatorType; gain0: number; delay: number }
) {
  const t = base + opts.delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = opts.type;
  o.frequency.setValueAtTime(opts.freq, t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(opts.gain0, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.01, t + opts.dur);
  o.connect(g);
  g.connect(ctx.destination);
  o.start(t);
  o.stop(t + opts.dur + 0.02);
}

export function playClassroomUnlockFanfare(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  void ctx.resume();
  const t0 = ctx.currentTime + 0.001;

  scheduleTone(ctx, t0, { type: "sine", freq: 92, dur: 0.16, gain0: 0.24, delay: 0 });
  {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(175, t0);
    o.frequency.exponentialRampToValueAtTime(340, t0 + 0.12);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.1, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.01, t0 + 0.22);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + 0.24);
  }

  const arp = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99, 1046.5];
  arp.forEach((f, i) => {
    scheduleTone(ctx, t0, {
      type: i % 2 === 0 ? "triangle" : "sine",
      freq: f,
      dur: 0.34,
      gain0: 0.1 - i * 0.0065,
      delay: 0.04 + i * 0.05,
    });
  });

  const echo: number[] = [1046.5, 1318.5, 1567.98, 2093.0];
  const echo0 = 0.42;
  echo.forEach((f, i) => {
    scheduleTone(ctx, t0, { type: "sine", freq: f, dur: 0.2, gain0: 0.055, delay: echo0 + i * 0.038 });
  });

  for (let i = 0; i < 20; i++) {
    const f = 850 + (i * 37 * 17) % 900 + i * 28;
    scheduleTone(ctx, t0, { type: "sine", freq: f, dur: 0.1, gain0: 0.038, delay: 0.52 + i * 0.025 });
  }
}
