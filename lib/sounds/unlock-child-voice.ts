/**
 * 预录童声「妈妈，我爱你哟」：预取 decode 后缓存在内存，在解锁用户手势内用 BufferSource.start(t+delay) 调度，
 * 避免约 1s 后的 HTMLAudioElement.play() 在 Safari 上被拦截。
 */
import { getSharedAudioContext } from "@/lib/sounds/play-classroom-unlock-fanfare";

const VOICE_URL = "/sounds/unlock-mama-love.mp3";

let cached: AudioBuffer | null = null;
let inflight: Promise<AudioBuffer | null> | null = null;

export function preloadUnlockChildVoice(): void {
  if (typeof window === "undefined") return;
  void loadUnlockChildVoiceBuffer();
}

export async function loadUnlockChildVoiceBuffer(): Promise<AudioBuffer | null> {
  if (cached) return cached;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await fetch(VOICE_URL);
      if (!res.ok) {
        console.warn(`unlock child voice: fetch ${VOICE_URL} → ${res.status}`);
        return null;
      }
      const raw = await res.arrayBuffer();
      const ctx = getSharedAudioContext();
      if (!ctx) return null;
      const copy = raw.slice(0);
      cached = await ctx.decodeAudioData(copy);
      return cached;
    } catch (e) {
      console.warn("unlock child voice: decode failed", e);
      return null;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/**
 * 须在用户手势触发的同步调用栈内执行；仅当 buffer 已就绪时播放（未就绪则静默跳过）。
 */
export function scheduleUnlockChildVoice(delaySec: number): void {
  const ctx = getSharedAudioContext();
  if (!ctx || !cached) return;
  void ctx.resume();

  const src = ctx.createBufferSource();
  src.buffer = cached;
  const gain = ctx.createGain();
  gain.gain.value = 0.92;
  src.connect(gain);
  gain.connect(ctx.destination);
  const when = Math.max(0, ctx.currentTime + delaySec);
  src.start(when);
}
