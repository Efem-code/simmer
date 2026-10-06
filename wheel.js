/* The spinning wheel, borrowed from Craving. Plain canvas, no libraries.
   Spin holds the sound/vibration and the shake detector so app.js only has
   to say what to do when a spin is wanted. */

const COLORS = ['#e84a27', '#f2b134', '#2f9e8f', '#7b4bc4', '#e2739b', '#3c7dd9', '#f08a24', '#5aa64a'];

const Spin = {
  sound: true, buzz: true, ac: null,
  audio() { try { this.ac = this.ac || new (window.AudioContext || window.webkitAudioContext)(); if (this.ac.state === 'suspended') this.ac.resume(); } catch (e) {} },
  tick() {
    if (this.buzz) navigator.vibrate?.(6);
    const ac = this.ac; if (!this.sound || !ac) return;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'square'; o.frequency.value = 1400;
    g.gain.setValueAtTime(.05, ac.currentTime); g.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + .03);
    o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + .035);
  },
  ding() {
    if (this.buzz) navigator.vibrate?.([40, 60, 120]);
    const ac = this.ac; if (!this.sound || !ac) return;
    [660, 880, 1320].forEach((f, i) => { const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + i * .09;
      o.frequency.value = f; g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.0001, t + .35);
      o.connect(g).connect(ac.destination); o.start(t); o.stop(t + .36); });
  },

  /* Shake = three strong movements inside a second (acceleration without
     gravity above 12 m/s²; walking bumps are 2–5). */
  gotMotion: false,
  needPerm: typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function',
  onShake: null, onFirstMotion: null, hits: [], last: 0,
  listen() {
    addEventListener('devicemotion', e => {
      const a = e.acceleration && e.acceleration.x != null ? e.acceleration : null, g = e.accelerationIncludingGravity;
      if (!a && (!g || g.x == null)) return;
      if (!this.gotMotion) { this.gotMotion = true; this.onFirstMotion?.(); }
      const force = a ? Math.hypot(a.x, a.y, a.z) : Math.abs(Math.hypot(g.x, g.y, g.z) - 9.81), now = Date.now();
      if (force > 12 && (!this.hits.length || now - this.hits[this.hits.length - 1] > 90)) { this.hits = this.hits.filter(t => now - t < 1000); this.hits.push(now); }
      if (this.hits.length >= 3 && now - this.last > 1500 && document.visibilityState === 'visible') { this.last = now; this.hits = []; this.onShake?.(); }
    });
  },
  async askPermission() {
    try { const r = await DeviceMotionEvent.requestPermission(); if (r === 'granted') { this.needPerm = false; return true; } } catch (e) {}
    return false;
  },
};
Spin.listen();

class Wheel {
  constructor(canvas, { ticks = false, labels = true } = {}) {
    this.c = canvas; this.ticks = ticks; this.labels = labels; this.items = []; this.rot = 0; this.busy = false;
  }
  setItems(items) { this.items = items; this.draw(); }
  segAt(rot) { const n = this.items.length, seg = 2 * Math.PI / n;
    /* Which segment is under the pointer at the top (-π/2). */
    let a = ((-Math.PI / 2 - rot) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI); return Math.floor(a / seg) % n; }
  draw() {
    const c = this.c, w = c.clientWidth; if (!w) return;
    const dpr = window.devicePixelRatio || 1, px = Math.round(w * dpr);
    if (c.width !== px) { c.width = px; c.height = px; }
    const x = c.getContext('2d'), r = px / 2, n = this.items.length;
    x.clearRect(0, 0, px, px);
    if (!n) return;
    const seg = 2 * Math.PI / n;
    const dark = matchMedia('(prefers-color-scheme: dark)').matches;
    for (let i = 0; i < n; i++) {
      const a0 = this.rot + i * seg, it = this.items[i];
      x.beginPath(); x.moveTo(r, r); x.arc(r, r, r - 4 * dpr, a0, a0 + seg); x.closePath();
      /* The last slice touches the first; if they'd share a colour, borrow another. */
      x.fillStyle = it.color || (i === n - 1 && n > 1 && i % COLORS.length === 0 ? COLORS[3] : COLORS[i % COLORS.length]);
      x.fill();
      x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 1.5 * dpr; x.stroke();
      if (!this.labels) continue;
      /* Labels on the left half are turned the other way so none read upside down. */
      const mid = a0 + seg / 2, flip = Math.cos(mid) < 0;
      x.save(); x.translate(r, r); x.rotate(flip ? mid + Math.PI : mid);
      const fs = Math.max(9 * dpr, Math.min(17 * dpr, r * seg * 0.5));
      x.font = `700 ${fs}px system-ui, -apple-system, sans-serif`; x.textAlign = flip ? 'left' : 'right'; x.textBaseline = 'middle';
      x.fillStyle = '#fff'; x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = 3 * dpr;
      let label = flip ? it.label + (it.emoji ? ' ' + it.emoji : '') : (it.emoji ? it.emoji + ' ' : '') + it.label;
      const maxW = r * 0.68;
      while (x.measureText(label).width > maxW && label.length > 4) label = label.slice(0, -2) + '…';
      x.fillText(label, flip ? -(r - 14 * dpr) : r - 14 * dpr, 0);
      x.restore();
    }
    /* hub */
    x.beginPath(); x.arc(r, r, r * 0.12, 0, 2 * Math.PI); x.fillStyle = dark ? '#1b201d' : '#fff'; x.fill();
    x.lineWidth = 3 * dpr; x.strokeStyle = dark ? '#e9ece8' : '#1d2420'; x.stroke();
    x.beginPath(); x.arc(r, r, r - 2 * dpr, 0, 2 * Math.PI); x.lineWidth = 4 * dpr; x.strokeStyle = dark ? '#e9ece8' : '#1d2420'; x.stroke();
  }
  /* Spin so that segment i ends under the pointer. A random offset inside the
     segment stops it landing dead-centre every time, which looks rigged. */
  spinTo(i, ms, turns = 5) {
    const n = this.items.length, seg = 2 * Math.PI / n;
    const jitter = (Math.random() - .5) * seg * 0.7;
    const target = -Math.PI / 2 - (i + .5) * seg + jitter;
    const delta = ((target - this.rot) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) + turns * 2 * Math.PI;
    const start = this.rot, t0 = performance.now();
    this.busy = true;
    let lastSeg = this.segAt(start);
    return new Promise(done => {
      const step = now => {
        const t = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - t, 4);
        this.rot = start + delta * e; this.draw();
        if (this.ticks) { const s = this.segAt(this.rot); if (s !== lastSeg) { lastSeg = s; Spin.tick(); } }
        if (t < 1) requestAnimationFrame(step);
        else { this.rot %= 2 * Math.PI; this.busy = false; done(); }
      };
      requestAnimationFrame(step);
    });
  }
  /* Snap straight to a segment (for locked wheels). */
  show(i) { const seg = 2 * Math.PI / this.items.length; this.rot = -Math.PI / 2 - (i + .5) * seg; this.draw(); }
}
