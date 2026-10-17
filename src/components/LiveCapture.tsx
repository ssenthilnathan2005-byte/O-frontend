import { useEffect, useRef, useState } from 'react';

type Props = {
  /** `extraFrames` are the other frames grabbed just after focus lock, used to vote on hard-to-read digits. */
  onCapture: (blob: Blob, canvas: HTMLCanvasElement, extraFrames: HTMLCanvasElement[]) => void;
  onClose?: () => void;
};

const W = 320, H = 240;          // analysis resolution (cheap)
const FRAME_COUNT = 4;           // frames grabbed once focus is confirmed
const FRAME_GAP_MS = 180;        // pause between those frames
const STEADY_FRAMES = 5;         // ~0.75 s at 150 ms per check
const MOTION_MAX = 4;            // mean pixel change between frames (0-255)
const SHARP_MIN = 25;            // absolute floor for Laplacian variance
const SHARP_RATIO = 0.8;         // must be within 80% of the best sharpness seen

// Variance of a simple Laplacian: high when edges are crisp (focused), low when blurry.
function sharpness(g: Uint8ClampedArray) {
  let sum = 0, sum2 = 0, n = 0;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      const l = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - W] - g[i + W];
      sum += l; sum2 += l * l; n++;
    }
  }
  const mean = sum / n;
  return sum2 / n - mean * mean;
}

export default function LiveCapture({ onCapture, onClose }: Props) {
  const onCaptureRef = useRef(onCapture);
  onCaptureRef.current = onCapture;
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState('Starting camera…');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const captureRef = useRef<() => void>(() => {});

  useEffect(() => {
    let alive = true;
    let timer: number | undefined;
    let prev: Uint8ClampedArray | null = null;
    let best = 0, steady = 0, done = false;
    const probe = document.createElement('canvas');
    probe.width = W; probe.height = H;
    const pctx = probe.getContext('2d', { willReadFrequently: true })!;

    const stop = () => {
      window.clearInterval(timer);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };

    const grayOf = (v: HTMLVideoElement) => {
      pctx.drawImage(v, 0, 0, W, H);
      const px = pctx.getImageData(0, 0, W, H).data;
      const g = new Uint8ClampedArray(W * H);
      for (let i = 0; i < g.length; i++) g[i] = (px[i * 4] * 0.299 + px[i * 4 + 1] * 0.587 + px[i * 4 + 2] * 0.114) | 0;
      return g;
    };

    // Grab a few frames (the phone is steady now) and keep the sharpest as the main photo.
    const capture = async () => {
      const v = videoRef.current;
      if (!v || done || !v.videoWidth) return;
      done = true;
      window.clearInterval(timer);
      setStatus('Captured – hold still for a moment…');
      const frames: { c: HTMLCanvasElement; s: number }[] = [];
      for (let i = 0; i < FRAME_COUNT; i++) {
        const c = document.createElement('canvas');
        c.width = v.videoWidth; c.height = v.videoHeight;
        c.getContext('2d')!.drawImage(v, 0, 0);
        frames.push({ c, s: sharpness(grayOf(v)) });
        if (i < FRAME_COUNT - 1) await new Promise((r) => setTimeout(r, FRAME_GAP_MS));
      }
      stop();
      frames.sort((a, b) => b.s - a.s);
      const main = frames[0].c;
      main.toBlob((b) => { if (b) onCaptureRef.current(b, main, frames.slice(1).map((f) => f.c)); }, 'image/jpeg', 0.92);
    };

    captureRef.current = () => { void capture(); };

    const tick = () => {
      const v = videoRef.current;
      if (!v || v.readyState < 2 || done) return;
      const g = grayOf(v);

      const sharp = sharpness(g);
      best = Math.max(best, sharp);
      let motion = 255;
      if (prev) {
        let d = 0;
        for (let i = 0; i < g.length; i += 4) d += Math.abs(g[i] - prev[i]);
        motion = d / (g.length / 4);
      }
      prev = g;

      const focused = sharp >= SHARP_MIN && sharp >= best * SHARP_RATIO;
      const still = motion < MOTION_MAX;
      if (focused && still) steady++; else steady = 0;

      setProgress(Math.min(steady / STEADY_FRAMES, 1));
      setStatus(!still ? 'Hold steady…' : !focused ? 'Focusing… move closer to the screen' : 'Focused – hold still…');
      if (steady >= STEADY_FRAMES) void capture();
    };

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (!alive) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];

        // Best-effort: continuous focus and lower exposure so bright screens don't blow out.
        // A web page cannot change the phone's screen brightness; this only affects the camera.
        try {
          const caps: any = track.getCapabilities?.() ?? {};
          const adv: any = {};
          if (caps.focusMode?.includes('continuous')) adv.focusMode = 'continuous';
          if (caps.exposureMode?.includes('continuous')) adv.exposureMode = 'continuous';
          if (caps.exposureCompensation) {
            const { min, max } = caps.exposureCompensation;
            adv.exposureCompensation = min + (max - min) * 0.25; // darker than default
          }
          if (Object.keys(adv).length) await track.applyConstraints({ advanced: [adv] } as any);
        } catch { /* unsupported on this browser: ignore */ }

        const v = videoRef.current!;
        v.srcObject = stream;
        await v.play();
        setReady(true);
        setStatus('Point at the monitor…');
        timer = window.setInterval(tick, 150);
      } catch (e: any) {
        setError(e?.name === 'NotAllowedError' ? 'Camera permission denied.' : 'Could not start the camera.');
      }
    })();

    return () => { alive = false; done = true; stop(); };
  }, []);

  return (
    <div>
    <div style={{ position: 'relative', background: '#000', borderRadius: 12, overflow: 'hidden' }}>
      <video ref={videoRef} playsInline muted style={{ width: '100%', display: 'block', maxHeight: '55vh', objectFit: 'cover' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12, background: 'linear-gradient(transparent, rgba(0,0,0,.75))', color: '#fff' }}>
        <div style={{ fontSize: 14, marginBottom: 6 }}>{error || status}</div>
        <div style={{ height: 6, background: 'rgba(255,255,255,.25)', borderRadius: 3 }}>
          <div style={{ height: 6, width: `${progress * 100}%`, background: '#10b981', borderRadius: 3, transition: 'width .15s' }} />
        </div>
      </div>
      {onClose && (
        <button onClick={onClose} aria-label="Close" style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,.5)', color: '#fff', border: 0, borderRadius: 16, width: 32, height: 32 }}>×</button>
      )}
    </div>
    <button
      type="button"
      onClick={() => captureRef.current()}
      disabled={!ready || !!error}
      style={{ width: '100%', marginTop: 8, padding: 12, borderRadius: 10, border: 0, background: '#0d9488', color: '#fff', fontWeight: 600, fontSize: 16, opacity: !ready || error ? 0.5 : 1 }}
    >
      Capture Photo
    </button>
    </div>
  );
}
