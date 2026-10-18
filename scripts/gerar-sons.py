#!/usr/bin/env python3
"""Gera a biblioteca de músicas e efeitos sonoros do VidCut (tudo sintetizado aqui: sem direitos de terceiros).

    python3 scripts/gerar-sons.py        → escreve sons/*.mp3 e sons/sons.json

Precisa de numpy, scipy e do ffmpeg (com libmp3lame) no PATH. O resultado vai para o repositório,
por isso só é preciso voltar a correr isto quando se muda ou acrescenta um som.
"""
import json, os, subprocess, sys, tempfile
import numpy as np
from scipy import signal

SR = 44100
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'sons')
rng = np.random.default_rng(7)

# ------------------------------------------------------------------ utilidades
def t_(d): return np.arange(int(d * SR)) / SR
def midi(n): return 440.0 * 2 ** ((n - 69) / 12)
def env_ad(n, a, d, curve=4.0):
    a = max(1, int(a * SR)); e = np.zeros(n)
    a = min(a, n); e[:a] = np.linspace(0, 1, a)
    rest = n - a
    if rest > 0: e[a:] = np.exp(-curve * np.arange(rest) / max(1, int(d * SR)))
    return e
def adsr(n, a, d, s, r, hold):
    e = np.zeros(n); i = 0
    def seg(k, v0, v1):
        nonlocal i
        k = max(0, min(int(k * SR), n - i)); e[i:i + k] = np.linspace(v0, v1, k, endpoint=False); i += k
    seg(a, 0, 1); seg(d, 1, s); h = max(0, int(hold * SR) - i)
    k = min(h, n - i); e[i:i + k] = s; i += k
    seg(r, s, 0)
    return e
def lp(x, f, order=2):
    b, a = signal.butter(order, min(0.99, f / (SR / 2)), 'low'); return signal.lfilter(b, a, x)
def hp(x, f, order=2):
    b, a = signal.butter(order, min(0.99, f / (SR / 2)), 'high'); return signal.lfilter(b, a, x)
def bp(x, lo, hi, order=2):
    b, a = signal.butter(order, [lo / (SR / 2), min(0.99, hi / (SR / 2))], 'band'); return signal.lfilter(b, a, x)
def _blep(t, dt):
    """PolyBLEP: tira o aliasing das descontinuidades (dentes de serra e quadradas limpas)"""
    dt = np.broadcast_to(np.maximum(dt, 1e-9), t.shape)
    out = np.zeros_like(t)
    a = t < dt; x = t[a] / dt[a]; out[a] = x + x - x * x - 1
    b = t > 1 - dt; x = (t[b] - 1) / dt[b]; out[b] = x * x + x + x + 1
    return out
def saw_ph(ph, dt):
    t = ph % 1.0
    return 2 * t - 1 - _blep(t, dt)
def saw(f, t, phase=0.0):
    return saw_ph(f * t + phase, np.asarray(f / SR, dtype=float))
def square_ph(ph, dt):
    return 0.5 * (saw_ph(ph, dt) - saw_ph(ph + 0.5, dt)) * 2
def square(f, t, duty=0.5): return square_ph(f * t, np.asarray(f / SR, dtype=float))
def sweep(f0, f1, d, kind='exp'):
    t = t_(d)
    if kind == 'exp': f = f0 * (f1 / f0) ** (t / d)
    else: f = f0 + (f1 - f0) * t / d
    return np.sin(2 * np.pi * np.cumsum(f) / SR)
def noise(d): return rng.uniform(-1, 1, int(d * SR))

_ir_cache = {}
def reverb(x, size=1.8, mix=0.25, damp=6000):
    """Reverberação por convolução com ruído decrescente (estéreo)"""
    key = (size, damp)
    if key not in _ir_cache:
        n = int(size * SR); tt = np.arange(n) / SR
        irs = []
        for _ in range(2):
            ir = rng.normal(0, 1, n) * np.exp(-6.9 * tt / size)
            ir = lp(ir, damp); ir[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
            irs.append(ir / np.sqrt(np.sum(ir ** 2)))
        _ir_cache[key] = irs
    irs = _ir_cache[key]
    if x.ndim == 1: x = np.stack([x, x])
    wet = np.stack([signal.fftconvolve(x[c], irs[c])[: x.shape[1]] for c in range(2)])
    return (1 - mix) * x + mix * wet * 0.6

def pan(x, p=0.0):
    l = np.cos((p + 1) * np.pi / 4); r = np.sin((p + 1) * np.pi / 4)
    return np.stack([x * l * 1.41, x * r * 1.41]) if x.ndim == 1 else x

def master(x, target_rms_db=-16.0, ceiling=0.84):
    if x.ndim == 1: x = np.stack([x, x])
    x = hp(x, 28)
    rms = np.sqrt(np.mean(x ** 2)) + 1e-9
    x = x * (10 ** (target_rms_db / 20) / rms)
    x = np.tanh(x * 1.15) / np.tanh(1.15)  # saturação suave = limitador
    pk = np.max(np.abs(x))
    if pk > ceiling: x *= ceiling / pk
    return x

def write_mp3(name, x, kbps=160, mono=False):
    os.makedirs(OUT, exist_ok=True)
    if x.ndim == 1: x = np.stack([x, x])
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f: tmp = f.name
    from scipy.io import wavfile
    wavfile.write(tmp, SR, (np.clip(x.T, -1, 1) * 32767).astype(np.int16))
    out = os.path.join(OUT, name + '.mp3')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', tmp, *(['-ac', '1'] if mono else []), '-c:a', 'libmp3lame', '-b:a', f'{kbps}k', '-metadata', 'artist=VidCut', '-metadata', f'title={name}', out], check=True)
    os.remove(tmp)
    return x.shape[1] / SR

# ------------------------------------------------------------------ instrumentos
def kick(d=0.45, f0=150, f1=45, click=0.6):
    t = t_(d); f = f1 + (f0 - f1) * np.exp(-t * 28)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7.5)
    x[: int(0.004 * SR)] += click * rng.uniform(-1, 1, int(0.004 * SR))
    return np.tanh(x * 1.6)
def snare(d=0.25, tone=190, bright=4500):
    t = t_(d)
    n = bp(noise(d), 900, bright) * np.exp(-t * 18)
    b = np.sin(2 * np.pi * tone * t) * np.exp(-t * 30)
    return n * 1.1 + b * 0.6
def clap(d=0.3):
    t = t_(d); x = np.zeros_like(t)
    for k, off in enumerate([0, 0.011, 0.023]):
        i = int(off * SR); m = len(t) - i; seg = bp(rng.uniform(-1, 1, m), 900, 2600) * np.exp(-np.arange(m) / SR * (60 if k < 2 else 16))
        x[i:] += seg
    return x * 0.9
def hat(d=0.06, open_=False):
    dd = 0.32 if open_ else d; t = t_(dd)
    return hp(noise(dd), 7000, 3) * np.exp(-t * (9 if open_ else 55)) * 0.55
def shaker(d=0.09):
    t = t_(d); return hp(noise(d), 5000) * np.sin(np.pi * t / d) ** 2 * 0.35
def tom(f=90, d=0.6):
    t = t_(d); ff = f * (1 + 0.6 * np.exp(-t * 14))
    return np.sin(2 * np.pi * np.cumsum(ff) / SR) * np.exp(-t * 5) + 0.15 * lp(noise(d), 800) * np.exp(-t * 20)
def crash(d=2.5):
    t = t_(d); return hp(noise(d), 4000) * np.exp(-t * 1.8) * 0.45
def taiko(d=1.2):
    t = t_(d); f = 55 + 40 * np.exp(-t * 10)
    return np.tanh(1.5 * (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 3.5) + 0.3 * lp(noise(d), 300) * np.exp(-t * 12)))

def epiano(n, d, vel=1.0):
    t = t_(d); f = midi(n)
    mod = np.sin(2 * np.pi * f * t) * 1.2 * np.exp(-t * 3)
    x = np.sin(2 * np.pi * f * t + mod) * np.exp(-t * 1.6) + 0.25 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 4)
    x *= np.minimum(1, t / 0.004)
    x *= np.exp(-np.maximum(0, t - (d - 0.12)) * 30)
    return x * vel * 0.5
def piano(n, d, vel=1.0):
    t = t_(d); f = midi(n); x = np.zeros_like(t)
    for k in range(1, 9):
        fk = f * k * np.sqrt(1 + 0.0004 * k * k)
        if fk > SR / 2.2: break
        x += np.sin(2 * np.pi * fk * t + rng.uniform(0, 6.28)) * (0.7 ** (k - 1)) * np.exp(-t * (1.1 + 0.9 * k))
    x *= np.minimum(1, t / 0.003) * np.exp(-np.maximum(0, t - (d - 0.1)) * 25)
    return x * vel * 0.45
def pluck(n, d, bright=0.5, vel=1.0):
    """Karplus-Strong (guitarra/ukulele)"""
    f = midi(n); N = int(SR / f); total = int(d * SR)
    buf = rng.uniform(-1, 1, N); buf = lp(buf, 1500 + 6000 * bright)
    out = np.zeros(total); i = 0; decay = 0.996
    ring = buf.copy(); prev = 0.0
    for i in range(total):
        j = i % N
        v = ring[j]; out[i] = v
        ring[j] = decay * 0.5 * (v + prev); prev = v
    out *= np.exp(-np.maximum(0, np.arange(total) / SR - (d - 0.08)) * 30)
    return out * vel * 0.6
def bass(n, d, kind='sine', cutoff=900, vel=1.0):
    t = t_(d); f = midi(n)
    if kind == 'sine': x = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t)
    elif kind == 'saw': x = lp(saw(f, t) + saw(f * 1.005, t), cutoff + 1500 * np.exp(-0)) * 0.7
    else: x = np.tanh(2.5 * np.sin(2 * np.pi * f * t))
    e = adsr(len(t), 0.005, 0.08, 0.8, 0.05, d - 0.05)
    x = x * e
    if kind == 'saw': x = lp(x, cutoff, 2)
    return x * vel * 0.55
def pad(notes, d, bright=2200, detune=0.006, voices=4, a=0.8, r=1.2):
    t = t_(d); x = np.zeros_like(t)
    for n in notes:
        f = midi(n)
        for v in range(voices):
            dt = (v - (voices - 1) / 2) * detune
            x += saw(f * (1 + dt), t, rng.uniform(0, 1))
    x = lp(x / (len(notes) * voices) * 2.2, bright, 2)
    x *= adsr(len(t), a, 0.3, 0.85, r, d - r)
    return x * 0.5
def lead(notes_durs, kind='square', vib=5.0, bright=3000, gl=0.0):
    """Linha melódica: [(nota|None, duração s)]"""
    out = []
    for n, d in notes_durs:
        t = t_(d)
        if n is None: out.append(np.zeros_like(t)); continue
        f = midi(n) * (1 + 0.004 * np.sin(2 * np.pi * vib * t) * np.minimum(1, t / 0.25))
        ph = np.cumsum(f) / SR
        x = saw_ph(ph, f / SR) if kind == 'saw' else (square_ph(ph, f / SR) if kind == 'square' else np.sin(2 * np.pi * ph) + 0.2 * np.sin(6 * np.pi * ph))
        x = x * adsr(len(t), 0.01, 0.1, 0.7, 0.06, d - 0.06)
        out.append(x)
    x = np.concatenate(out)
    return lp(x, bright) * 0.35
def strings(notes, d, a=0.6):
    t = t_(d); x = np.zeros_like(t)
    for n in notes:
        f = midi(n)
        for v in range(3):
            fv = f * (1 + (v - 1) * 0.004) * (1 + 0.003 * np.sin(2 * np.pi * (5 + v * 0.3) * t))
            x += saw_ph(np.cumsum(fv) / SR, fv / SR)
    x = lp(x / (len(notes) * 3) * 2, 2600, 2) * adsr(len(t), a, 0.2, 0.9, 0.6, d - 0.6)
    return x * 0.6
def brass(notes, d):
    t = t_(d); x = np.zeros_like(t)
    for n in notes:
        x += saw(midi(n), t) + saw(midi(n) * 1.003, t)
    env = adsr(len(t), 0.06, 0.2, 0.8, 0.3, d - 0.3)
    cut = 800 + 2500 * env
    y = np.zeros_like(x)
    # filtro com corte variável (por blocos)
    B = 512
    for i in range(0, len(x), B):
        y[i:i + B] = lp(x[max(0, i - 2048):i + B], float(cut[i]))[-len(x[i:i + B]):]
    return y * env / len(notes) * 0.35

# ------------------------------------------------------------------ arranjo
class Song:
    def __init__(self, bpm, bars, tail=2.5, beats_per_bar=4):
        self.bpm = bpm; self.bars = bars; self.bpb = beats_per_bar
        self.spb = 60 / bpm
        self.len = bars * beats_per_bar * self.spb + tail
        self.buf = np.zeros((2, int(self.len * SR) + SR))
    def at(self, bar, beat=0.0): return (bar * self.bpb + beat) * self.spb
    def add(self, x, time, gain=1.0, p=0.0):
        if x.ndim == 1: x = pan(x, p)
        i = int(time * SR); j = min(self.buf.shape[1], i + x.shape[1])
        if i >= self.buf.shape[1]: return
        self.buf[:, i:j] += x[:, : j - i] * gain
    def beats(self, first_bar=0, last_bar=None):
        lb = self.bars if last_bar is None else last_bar
        return [round(self.at(b, k), 3) for b in range(first_bar, lb) for k in range(self.bpb)]
    def render(self): return self.buf[:, : int(self.len * SR)]

def sidechain(x, song, depth=0.6, bars=None):
    env = np.ones(x.shape[-1])
    for b in range(song.bars if bars is None else bars):
        for k in range(song.bpb):
            i = int(song.at(b, k) * SR); n = int(song.spb * SR)
            seg = 1 - depth * np.exp(-np.arange(n) / SR * 9)
            j = min(len(env), i + n); env[i:j] = seg[: j - i]
    return x * env

def chord(root, kind='maj', inv=0):
    iv = {'maj': [0, 4, 7], 'min': [0, 3, 7], 'maj7': [0, 4, 7, 11], 'min7': [0, 3, 7, 10], '7': [0, 4, 7, 10], 'sus2': [0, 2, 7], 'sus4': [0, 5, 7], 'add9': [0, 4, 7, 14]}[kind]
    ns = [root + i for i in iv]
    for _ in range(inv): ns = ns[1:] + [ns[0] + 12]
    return ns

def stereo_mix(*parts):
    n = max(p.shape[-1] for p in parts)
    out = np.zeros((2, n))
    for p in parts:
        if p.ndim == 1: p = pan(p)
        out[:, : p.shape[1]] += p
    return out

# ------------------------------------------------------------------ músicas
def m_lofi():
    s = Song(80, 24, tail=3)
    prog = [(chord(53, 'maj7'), 41), (chord(52, 'min7'), 40), (chord(50, 'min7'), 38), (chord(48, 'maj7'), 36)]
    swing = 0.07
    for bar in range(s.bars):
        ch, root = prog[bar % 4]
        for k, n in enumerate(ch):
            s.add(epiano(n, s.spb * 3.6, 0.7), s.at(bar) + k * 0.012, 0.9, p=-0.3 + 0.2 * k)
        if bar >= 2:
            s.add(bass(root, s.spb * 1.8, 'sine'), s.at(bar), 0.9)
            s.add(bass(root + 7, s.spb * 0.9, 'sine'), s.at(bar, 2.5), 0.7)
        if 2 <= bar < s.bars - 1:
            s.add(kick(0.4, 120, 42, 0.2), s.at(bar, 0), 0.9); s.add(kick(0.4, 120, 42, 0.2), s.at(bar, 2.5), 0.7)
            s.add(lp(snare(0.25, 180, 3500), 3000), s.at(bar, 1), 0.55); s.add(lp(snare(0.25, 180, 3500), 3000), s.at(bar, 3), 0.55)
            for e in range(8):
                s.add(lp(hat(0.05), 6500), s.at(bar, e / 2 + (swing if e % 2 else 0)), 0.45 if e % 2 else 0.6, p=0.3)
        if 6 <= bar < 22 and bar % 2 == 0:
            mel = [72, 69, 67, 64] if (bar // 2) % 2 == 0 else [74, 72, 69, 67]
            for k, n in enumerate(mel):
                s.add(piano(n, s.spb * 1.2, 0.5), s.at(bar, k * 1.5 + 0.5), 0.6, p=0.25)
    x = s.render()
    # vinil: estalidos e chiado
    cr = np.zeros(x.shape[1]); idx = rng.integers(0, len(cr), int(len(cr) / SR * 6)); cr[idx] = rng.uniform(-0.6, 0.6, len(idx))
    x = x + pan(lp(cr, 3000) + 0.012 * lp(noise(len(cr) / SR), 4000))[:, : x.shape[1]] * 0.25
    x = lp(x, 7000)
    return master(reverb(x, 1.6, 0.22, 4500)), s

def m_pop():
    s = Song(118, 32, tail=2.5)
    prog = [(chord(60, 'maj'), 48), (chord(55, 'maj', 1), 43), (chord(57, 'min', 1), 45), (chord(53, 'maj', 2), 41)]
    hook = [(76, .5), (76, .5), (74, .5), (72, 1.0), (None, .5), (72, .5), (74, .5), (76, .5), (79, 1.0), (76, 1.0), (None, 1.0), (74, .5), (72, .5), (69, 1.0), (72, 1.5), (None, 1.5)]
    for bar in range(s.bars):
        ch, root = prog[bar % 4]
        sec = 'intro' if bar < 4 else 'out' if bar >= 28 else 'chorus' if 12 <= bar < 20 else 'verse'
        for e in range(8):
            for n in ch:
                s.add(pluck(n + 12, s.spb * 0.5, 0.7, 0.5), s.at(bar, e / 2), 0.45 if e % 2 else 0.6, p=-0.35)
        if sec != 'intro':
            for e in range(8):
                s.add(bass(root, s.spb * 0.45, 'saw', 700), s.at(bar, e / 2), 0.8)
            for k in range(4): s.add(kick(), s.at(bar, k), 1.0)
            s.add(clap(), s.at(bar, 1), 0.6); s.add(clap(), s.at(bar, 3), 0.6)
            for e in range(8): s.add(hat(open_=e % 2 == 1), s.at(bar, e / 2), 0.16 if e % 2 else 0.22, p=0.35)
        if sec == 'chorus':
            s.add(pad(ch + [ch[0] + 12], s.spb * 4), s.at(bar), 0.5)
            if bar % 4 == 0:
                s.add(lead([(n + 0 if n else None, d * s.spb) for n, d in hook], 'square', bright=3500), s.at(bar), 0.6, p=0.15)
        if sec == 'verse' and bar % 4 == 0 and bar >= 6:
            s.add(lead([(n - 12 + 12 if n else None, d * s.spb) for n, d in hook[:8]], 'sine', bright=4000), s.at(bar), 0.55, p=0.1)
    s.add(crash(), s.at(12), 0.6); s.add(crash(), s.at(20), 0.5); s.add(crash(), s.at(28), 0.5)
    s.add(pad(chord(60, 'maj') + [72], 3.0, a=0.02, r=2.0), s.at(32), 0.8); s.add(kick(), s.at(32), 1.0); s.add(crash(), s.at(32), 0.6)
    x = lp(s.render(), 12000)
    return master(reverb(x, 1.4, 0.18)), s

def m_corporate():
    s = Song(100, 28, tail=3)
    prog = [(chord(55, 'add9'), 43), (chord(52, 'min7'), 40), (chord(48, 'maj7'), 36), (chord(50, 'sus4'), 38)]
    for bar in range(s.bars):
        ch, root = prog[bar % 4]
        arp = sorted(ch) + [ch[0] + 12]
        for e in range(8):
            n = arp[[0, 1, 2, 3, 2, 1, 3, 2][e]] + 12
            s.add(piano(n, s.spb * 0.9, 0.8 if e % 2 == 0 else 0.6), s.at(bar, e / 2), 0.7, p=-0.2 + 0.1 * (e % 3))
        if bar >= 4:
            s.add(pad(ch, s.spb * 4, bright=1800), s.at(bar), 0.55)
            s.add(bass(root, s.spb * 4, 'sine'), s.at(bar), 0.7)
        if 8 <= bar < 26:
            for k in range(4): s.add(kick(0.4, 130, 45, 0.3), s.at(bar, k), 0.75)
            s.add(clap(), s.at(bar, 1), 0.45); s.add(clap(), s.at(bar, 3), 0.45)
            for e in range(16): s.add(shaker(), s.at(bar, e / 4), 0.6 if e % 4 == 2 else 0.35, p=0.4)
        if 16 <= bar < 24:
            s.add(strings([ch[0] + 24, ch[1] + 24], s.spb * 4), s.at(bar), 0.4)
    s.add(crash(), s.at(8), 0.4); s.add(crash(), s.at(16), 0.45)
    s.add(piano(55 + 12, 3, 0.9), s.at(28), 0.8); s.add(pad(chord(55, 'add9'), 3, a=0.02, r=2.5), s.at(28), 0.6)
    return master(reverb(s.render(), 2.0, 0.25)), s

def m_ambient():
    s = Song(70, 20, tail=5)
    prog = [chord(50, 'min7'), chord(46, 'maj7'), chord(53, 'maj7'), chord(48, 'sus2')]
    for bar in range(0, s.bars, 2):
        ch = prog[(bar // 2) % 4]
        s.add(pad(ch + [ch[0] + 12], s.spb * 8 + 1.2, bright=1400, voices=5, a=2.0, r=2.5), s.at(bar), 0.8)
        s.add(bass(ch[0] - 12, s.spb * 8, 'sine'), s.at(bar), 0.4)
    pent = [62, 65, 67, 69, 72, 74, 77]
    for k in range(int(s.bars * 4 / 1.5)):
        if rng.random() < 0.55:
            n = int(rng.choice(pent)) + 12
            s.add(epiano(n, 3.0, 0.4), k * 1.5 * s.spb, 0.5, p=float(rng.uniform(-0.7, 0.7)))
    x = s.render()
    return master(reverb(x, 4.0, 0.45, 5000), -17), s

def m_hiphop():
    s = Song(90, 24, tail=2.5)
    prog = [(chord(57, 'min7'), 45), (chord(53, 'maj7'), 41), (chord(50, 'min7'), 38), (chord(52, '7'), 40)]
    for bar in range(s.bars):
        ch, root = prog[bar % 4]
        s.add(piano(ch[0] + 12, s.spb * 0.7, 0.8), s.at(bar, 0), 0.6); s.add(piano(ch[2] + 12, s.spb * 0.7, 0.7), s.at(bar, 0.75), 0.5)
        for n in ch: s.add(epiano(n, s.spb * 2, 0.5), s.at(bar, 2), 0.5, p=-0.3)
        if bar >= 2 and bar < s.bars - 1:
            for b in [0, 1.75, 2.5]: s.add(kick(0.5, 110, 40, 0.5), s.at(bar, b), 1.0)
            s.add(snare(0.3, 200, 5000), s.at(bar, 1), 0.85); s.add(snare(0.3, 200, 5000), s.at(bar, 3), 0.85)
            for e in range(8): s.add(hat(0.04), s.at(bar, e / 2 + (0.06 if e % 2 else 0)), 0.5 if e % 2 else 0.7, p=0.3)
            s.add(bass(root, s.spb * 1.5, 'dist'), s.at(bar, 0), 0.6); s.add(bass(root, s.spb * 0.8, 'dist'), s.at(bar, 2.5), 0.5)
        if 8 <= bar < 20 and bar % 2 == 1:
            s.add(lead([(81, s.spb), (79, s.spb * 0.5), (76, s.spb * 0.5), (74, s.spb * 2)], 'sine', vib=4, bright=5000), s.at(bar), 0.4, p=0.3)
    return master(reverb(lp(s.render(), 9000), 1.2, 0.15)), s

def m_edm():
    s = Song(128, 32, tail=3)
    prog = [(chord(57, 'min'), 45), (chord(53, 'maj'), 41), (chord(48, 'maj'), 36), (chord(55, 'maj'), 43)]
    padbus = np.zeros((2, s.buf.shape[1]))
    for bar in range(s.bars):
        ch, root = prog[bar % 4]
        drop = 16 <= bar < 28
        build = 12 <= bar < 16
        if bar >= 4 and not build:
            for k in range(4): s.add(kick(0.4, 160, 48, 0.8), s.at(bar, k), 1.0)
        if bar >= 8:
            for e in range(8): s.add(hat(open_=e % 2 == 1), s.at(bar, e / 2), 0.18 if e % 2 else 0.18, p=0.3)
        if bar >= 4: s.add(clap(), s.at(bar, 1), 0.5 if not build else 0); s.add(clap(), s.at(bar, 3), 0.5)
        if build:
            n = [4, 4, 8, 16][bar - 12]
            for e in range(n): s.add(snare(0.15, 220, 6000), s.at(bar, e * 4 / n), 0.3 + 0.15 * (bar - 12))
        p_ = pad(ch + [ch[0] + 12], s.spb * 4, bright=3500 if drop else 1500)
        i = int(s.at(bar) * SR); padbus[:, i:i + len(p_)] += pan(p_)[:, : padbus.shape[1] - i] * (0.6 if drop else 0.45)
        arp = ch + [ch[1] + 12, ch[0] + 12, ch[2], ch[1]]
        if bar >= 8:
            for e in range(16):
                s.add(lead([(arp[e % len(arp)] + 12, s.spb / 4)], 'saw', vib=0, bright=4500 if drop else 2500), s.at(bar, e / 4), 0.45, p=-0.2 if e % 2 else 0.2)
        if bar >= 4:
            for e in range(8):
                if e % 2: s.add(bass(root, s.spb * 0.45, 'saw', 1200 if drop else 600), s.at(bar, e / 2), 0.9)
    padbus = sidechain(padbus, s, 0.7)
    s.buf += padbus
    s.add(crash(), s.at(16), 0.7); s.add(crash(), s.at(28), 0.5)
    s.add(kick(0.8), s.at(32), 1.0); s.add(pad(chord(57, 'min') + [69], 3, a=0.01, r=2.5), s.at(32), 0.7)
    return master(reverb(s.render(), 1.6, 0.2), -14.5), s

def m_epic():
    s = Song(90, 24, tail=4)
    prog = [(chord(50, 'min'), 38), (chord(46, 'maj'), 34), (chord(48, 'maj'), 36), (chord(45, 'maj'), 33)]
    for bar in range(s.bars):
        ch, root = prog[bar % 4]
        s.add(strings([n + 12 for n in ch] + [ch[0] + 24], s.spb * 4 + 0.3, a=0.8 if bar < 8 else 0.15), s.at(bar), 0.7)
        s.add(bass(root, s.spb * 4, 'saw', 400), s.at(bar), 0.6)
        if bar >= 4:
            for b in ([0, 2] if bar < 12 else [0, 1.5, 2, 3, 3.5]): s.add(taiko(), s.at(bar, b), 0.9 if b in (0, 2) else 0.6)
        if bar >= 8:
            for e in range(8): s.add(lp(snare(0.12, 250, 3000), 2500), s.at(bar, e / 2), 0.15 + 0.1 * (e % 2), p=0.4)
        if 12 <= bar < 22:
            s.add(brass([ch[0] + 12, ch[2] + 12], s.spb * 2), s.at(bar), 0.7); s.add(brass([ch[1] + 12, ch[0] + 24], s.spb * 2), s.at(bar, 2), 0.7)
        if bar % 4 == 0 and bar >= 4: s.add(crash(3), s.at(bar), 0.4)
    s.add(taiko(2), s.at(24), 1.2); s.add(brass([50, 57, 62], 3.5), s.at(24), 0.9); s.add(strings([62, 69, 74], 3.5, a=0.05), s.at(24), 0.8)
    return master(reverb(s.render(), 2.8, 0.3, 5000), -14.5), s

def m_acoustic():
    s = Song(110, 28, tail=2.5)
    prog = [(chord(60, 'maj'), 48), (chord(57, 'min'), 45), (chord(53, 'maj'), 41), (chord(55, 'maj'), 43)]
    strum = [0, 1, 1.5, 2.5, 3, 3.5]
    whistle = [(79, 1), (76, .5), (77, .5), (79, 1), (84, 1), (81, 1.5), (79, .5), (77, 1), (76, 1)]
    for bar in range(s.bars):
        ch, root = prog[bar % 4]
        voicing = [ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[0] + 24]
        for k, b in enumerate(strum):
            down = k % 2 == 0
            for j, n in enumerate(voicing if down else voicing[::-1]):
                s.add(pluck(n, s.spb * 1.2, 0.6, 0.55 if down else 0.35), s.at(bar, b) + j * 0.008, 0.7, p=-0.25)
        if bar >= 4:
            s.add(bass(root, s.spb * 0.9, 'sine'), s.at(bar, 0), 0.7); s.add(bass(root + 7, s.spb * 0.9, 'sine'), s.at(bar, 2), 0.6)
            s.add(kick(0.35, 120, 50, 0.2), s.at(bar, 0), 0.6); s.add(kick(0.35, 120, 50, 0.2), s.at(bar, 2), 0.6)
            s.add(clap(), s.at(bar, 1), 0.55); s.add(clap(), s.at(bar, 3), 0.55)
            for e in range(8): s.add(shaker(), s.at(bar, e / 2), 0.4, p=0.4)
        if 8 <= bar < 24 and bar % 4 == 0:
            s.add(lead([(n, d * s.spb) for n, d in whistle] + [(None, s.spb * 4)], 'sine', vib=5.5, bright=6000), s.at(bar), 0.45, p=0.2)
    s.add(pluck(60 + 12, 2.5, 0.6, 0.8), s.at(28), 0.7); s.add(pluck(64 + 12, 2.5, 0.6, 0.8), s.at(28) + 0.02, 0.7); s.add(pluck(67 + 12, 2.5, 0.6, 0.8), s.at(28) + 0.04, 0.7)
    return master(reverb(s.render(), 1.3, 0.16)), s

def m_suspense():
    s = Song(96, 20, tail=4)
    for bar in range(s.bars):
        root = [38, 38, 39, 37][bar % 4]
        for e in range(8): s.add(bass(root, s.spb * 0.4, 'saw', 500 + 40 * bar), s.at(bar, e / 2), 0.7)
        if bar >= 4:
            s.add(kick(0.6, 90, 35, 0.2), s.at(bar, 0), 0.9)
            if bar % 2: s.add(tom(70, 0.8), s.at(bar, 2.5), 0.5)
        if bar >= 8: s.add(strings([root + 24, root + 27], s.spb * 4, a=1.5), s.at(bar), 0.5)
        if bar >= 12:
            for e in range(16): s.add(hat(0.03), s.at(bar, e / 4), 0.25, p=0.5)
        if bar % 4 == 3: s.add(epiano(root + 36 + 6, 2.5, 0.4), s.at(bar, 2), 0.5, p=0.4)
    s.add(taiko(2.5), s.at(20), 1.2); s.add(strings([38 + 12, 41 + 12, 44 + 12], 3.5, a=0.05), s.at(20), 0.7)
    return master(reverb(s.render(), 3.0, 0.3, 4000), -15.5), s

def m_funk():
    s = Song(105, 24, tail=2.5)
    prog = [(chord(52, 'min7'), 40), (chord(57, '7'), 45)]
    for bar in range(s.bars):
        ch, root = prog[(bar // 2) % 2]
        gtr = [0, 0.75, 1.5, 2, 2.75, 3.5]
        for b in gtr:
            for j, n in enumerate([ch[1] + 12, ch[2] + 12, ch[3] + 12]):
                s.add(hp(pluck(n, 0.12, 0.9, 0.5), 300), s.at(bar, b) + j * 0.005, 0.6, p=0.35)
        if bar >= 2:
            line = [(0, root), (0.75, root + 12), (1.5, root), (2, root + 10), (2.5, root + 7), (3.25, root + 5)]
            for b, n in line: s.add(bass(n, s.spb * 0.35, 'dist'), s.at(bar, b), 0.65)
            for b in [0, 1.75, 2.5]: s.add(kick(0.35), s.at(bar, b), 0.9)
            s.add(snare(), s.at(bar, 1), 0.7); s.add(snare(), s.at(bar, 3), 0.7)
            for e in range(16): s.add(hat(0.03), s.at(bar, e / 4), 0.45 if e % 2 == 0 else 0.25, p=0.3)
        if 8 <= bar < 20:
            s.add(brass([ch[0] + 12, ch[2] + 12], s.spb * 0.3), s.at(bar, 1.5), 0.7); s.add(brass([ch[0] + 12, ch[2] + 12], s.spb * 0.6), s.at(bar, 3.5), 0.7)
    s.add(brass([52, 59, 64], 2.0), s.at(24), 0.9); s.add(crash(), s.at(24), 0.5); s.add(kick(), s.at(24), 1.0)
    return master(reverb(s.render(), 1.2, 0.14)), s

MUSICAS = [
    ('tarde-tranquila', 'Tarde tranquila', m_lofi, ['lo-fi', 'calma', 'estudo', 'vlog']),
    ('dia-de-sol', 'Dia de sol', m_pop, ['pop', 'alegre', 'energia', 'redes']),
    ('ideias-em-movimento', 'Ideias em movimento', m_corporate, ['empresa', 'inspirador', 'apresentação']),
    ('horizonte', 'Horizonte', m_ambient, ['ambiente', 'calma', 'natureza', 'fundo']),
    ('rua', 'Rua', m_hiphop, ['hip-hop', 'urbano', 'batida']),
    ('pulso', 'Pulso', m_edm, ['eletrónica', 'dança', 'energia', 'desporto']),
    ('conquista', 'Conquista', m_epic, ['épico', 'cinema', 'trailer', 'drama']),
    ('estrada-fora', 'Estrada fora', m_acoustic, ['acústica', 'viagem', 'alegre', 'ukulele']),
    ('misterio', 'Mistério', m_suspense, ['suspense', 'tensão', 'escuro']),
    ('ginga', 'Ginga', m_funk, ['funk', 'groove', 'divertido', 'vlog']),
]

# ------------------------------------------------------------------ efeitos sonoros
def fx_whoosh(d=0.9):
    t = t_(d); n = noise(d); f = 300 + 3500 * np.sin(np.pi * t / d) ** 2
    y = np.zeros_like(n); B = 256
    for i in range(0, len(n), B):
        y[i:i + B] = bp(n[max(0, i - 2048):i + B], max(100, f[i] * 0.6), f[i] * 1.4)[-len(n[i:i + B]):]
    y *= np.sin(np.pi * t / d) ** 2
    return reverb(pan(y), 0.8, 0.2)
def fx_swoosh(): return fx_whoosh(0.38)
def fx_pop():
    x = sweep(1000, 260, 0.12) * env_ad(int(0.12 * SR), 0.002, 0.03, 3)
    return x
def fx_bubble():
    x = np.concatenate([sweep(300 + 200 * k, 900 + 300 * k, 0.07) * env_ad(int(0.07 * SR), 0.002, 0.03) for k in range(3)])
    return reverb(pan(x), 0.5, 0.15)
def fx_click():
    x = bp(noise(0.03), 1500, 6000) * env_ad(int(0.03 * SR), 0.0005, 0.004, 1)
    return x + 0.4 * np.sin(2 * np.pi * 2200 * t_(0.03)) * np.exp(-t_(0.03) * 300)
def bell(f, d=2.0):
    t = t_(d); x = np.zeros_like(t)
    for ratio, amp, dec in [(1, 1, 1.5), (2.76, 0.5, 3), (5.4, 0.25, 5), (8.93, 0.12, 8)]:
        x += amp * np.sin(2 * np.pi * f * ratio * t) * np.exp(-t * dec)
    return x * np.minimum(1, t / 0.002) * 0.4
def fx_ding(): return reverb(pan(bell(1318)), 1.5, 0.25)
def fx_notification():
    x = np.zeros(int(1.2 * SR)); a = bell(1046, 1.0); b = bell(1568, 1.0)
    x[: len(a)] += a; i = int(0.14 * SR); x[i:i + len(b)] += b[: len(x) - i]
    return reverb(pan(x), 1.2, 0.2)
def fx_success():
    x = np.zeros(int(1.6 * SR))
    for k, n in enumerate([72, 76, 79, 84]):
        y = piano(n, 1.2, 0.9) + 0.4 * bell(midi(n), 1.2); i = int(k * 0.09 * SR); x[i:i + len(y)] += y[: len(x) - i]
    return reverb(pan(x), 1.4, 0.25)
def fx_error():
    x = np.concatenate([lp(square(150, t_(0.18)), 1200) * env_ad(int(0.18 * SR), 0.005, 0.15, 1), np.zeros(int(0.05 * SR)), lp(square(110, t_(0.3)), 1000) * env_ad(int(0.3 * SR), 0.005, 0.25, 1)])
    return x * 0.5
def fx_impact():
    d = 2.2; t = t_(d)
    x = np.sin(2 * np.pi * np.cumsum(30 + 90 * np.exp(-t * 8)) / SR) * np.exp(-t * 2.2) + 0.5 * lp(noise(d), 1200) * np.exp(-t * 6)
    return reverb(pan(np.tanh(1.8 * x)), 2.5, 0.3, 3000)
def fx_riser():
    d = 3.0; t = t_(d); n = noise(d); f = 200 * (40 ** (t / d))
    y = np.zeros_like(n); B = 256
    for i in range(0, len(n), B): y[i:i + B] = bp(n[max(0, i - 2048):i + B], f[i] * 0.7, min(18000, f[i] * 1.5))[-len(n[i:i + B]):]
    fr = 110 * (8 ** (t / d)); tone = saw_ph(np.cumsum(fr) / SR, fr / SR) * 0.25
    x = (y + lp(tone, 4000)) * (t / d) ** 2
    x[-int(0.02 * SR):] *= np.linspace(1, 0, int(0.02 * SR))
    return reverb(pan(x), 1.5, 0.25)
def fx_downer():
    x = fx_riser()[:, ::-1].copy(); return x
def fx_typing():
    x = np.zeros(int(2.4 * SR)); tt = 0.0
    while tt < 1.9:
        k = fx_click() * rng.uniform(0.5, 1.0); i = int(tt * SR); x[i:i + len(k)] += k[: len(x) - i]
        tt += rng.uniform(0.07, 0.16)
    b = bell(2100, 0.6) * 0.7; i = int(2.0 * SR); x[i:i + len(b)] += b[: len(x) - i]
    return reverb(pan(x), 0.4, 0.1)
def fx_shutter():
    a = bp(noise(0.05), 1000, 7000) * env_ad(int(0.05 * SR), 0.001, 0.01, 2)
    x = np.zeros(int(0.3 * SR)); x[: len(a)] += a; i = int(0.11 * SR); x[i:i + len(a)] += a * 0.8
    return x
def fx_coin():
    x = np.concatenate([square(midi(83), t_(0.08)) * 0.3, square(midi(88), t_(0.5)) * 0.3 * np.exp(-t_(0.5) * 6)])
    return lp(x, 6000)
def fx_zap():
    return sweep(2500, 120, 0.35) * env_ad(int(0.35 * SR), 0.002, 0.2, 2) * 0.7 + 0.2 * square_ph(np.cumsum(np.linspace(1800, 80, int(0.35 * SR))) / SR, np.linspace(1800, 80, int(0.35 * SR)) / SR) * np.exp(-t_(0.35) * 8)
def fx_glitch():
    parts = []
    for _ in range(12):
        d = rng.uniform(0.02, 0.07); kind = rng.integers(0, 3)
        if kind == 0: parts.append(square(rng.uniform(100, 2000), t_(d)) * 0.3)
        elif kind == 1: parts.append(noise(d) * 0.4)
        else: parts.append(np.zeros(int(d * SR)))
    x = np.concatenate(parts); x = np.round(x * 6) / 6
    return x
def fx_tada():
    x = np.zeros((2, int(3.2 * SR)))
    for k in range(int(1.0 / 0.035)):
        y = pan(snare(0.08) * (0.3 + 0.7 * k / 28) * 0.6); i = int(k * 0.035 * SR); x[:, i:i + y.shape[1]] += y
    i = int(1.05 * SR)
    for y in [pan(crash(2.0)), pan(kick()), pan(brass([60, 64, 67, 72], 1.8) * 1.6)]:
        x[:, i:i + y.shape[1]] += y[:, : x.shape[1] - i]
    return reverb(x, 1.6, 0.2)
def fx_heartbeat():
    x = np.zeros(int(2.6 * SR))
    for k in range(3):
        for off, g in [(0, 1.0), (0.22, 0.7)]:
            y = lp(kick(0.25, 70, 40, 0.0), 300) * g; i = int((k * 0.85 + off) * SR); x[i:i + len(y)] += y[: len(x) - i]
    return x
def fx_tick():
    x = np.zeros(int(4.0 * SR))
    for k in range(8):
        f = 3000 if k % 2 == 0 else 2400
        y = bp(noise(0.02), f * 0.8, f * 1.2) * env_ad(int(0.02 * SR), 0.0005, 0.004, 1); i = int(k * 0.5 * SR); x[i:i + len(y)] += y * 1.5
    return reverb(pan(x), 0.5, 0.15)
def fx_applause():
    d = 4.0; x = np.zeros((2, int(d * SR)))
    for _ in range(900):
        tt = rng.uniform(0, d - 0.2); y = clap(0.12) * rng.uniform(0.2, 0.8); i = int(tt * SR); p = rng.uniform(-0.8, 0.8)
        x[:, i:i + len(y)] += pan(y, p)
    e = np.minimum(1, t_(d) / 0.4) * np.minimum(1, (d - t_(d)) / 1.2)
    return reverb(x * e * 0.3, 1.5, 0.3)
def fx_rimshot():
    x = np.zeros((2, int(2.4 * SR)))
    for tt, y in [(0, snare(0.2)), (0.18, snare(0.2)), (0.5, crash(1.8))]:
        y = pan(y); i = int(tt * SR); x[:, i:i + y.shape[1]] += y[:, : x.shape[1] - i]
    return reverb(x, 1.0, 0.15)
def fx_cash():
    a = fx_coin(); b = bell(2637, 1.2) * 0.8
    x = np.zeros(int(1.4 * SR)); x[: len(a)] += a; i = int(0.12 * SR); x[i:i + len(b)] += b[: len(x) - i]
    return reverb(pan(x), 0.8, 0.15)

EFEITOS = [
    ('whoosh', 'Whoosh', fx_whoosh, 'Transições', ['passagem', 'vento', 'transição']),
    ('swoosh', 'Swoosh rápido', fx_swoosh, 'Transições', ['passagem', 'rápido']),
    ('subida', 'Subida (riser)', fx_riser, 'Transições', ['tensão', 'antes do corte', 'riser']),
    ('descida', 'Descida', fx_downer, 'Transições', ['queda', 'fim']),
    ('impacto', 'Impacto', fx_impact, 'Transições', ['boom', 'pancada', 'drop']),
    ('glitch', 'Glitch', fx_glitch, 'Transições', ['digital', 'falha']),
    ('pop', 'Pop', fx_pop, 'Interface', ['aparecer', 'balão']),
    ('bolha', 'Bolhas', fx_bubble, 'Interface', ['aparecer', 'água']),
    ('clique', 'Clique', fx_click, 'Interface', ['botão', 'rato']),
    ('ding', 'Ding', fx_ding, 'Interface', ['sino', 'ideia']),
    ('notificacao', 'Notificação', fx_notification, 'Interface', ['mensagem', 'alerta']),
    ('sucesso', 'Sucesso', fx_success, 'Interface', ['certo', 'conseguido', 'vitória']),
    ('erro', 'Erro', fx_error, 'Interface', ['errado', 'falhou']),
    ('moeda', 'Moeda', fx_coin, 'Interface', ['jogo', 'pontos']),
    ('caixa-registadora', 'Caixa registadora', fx_cash, 'Interface', ['dinheiro', 'venda', 'preço']),
    ('zap', 'Zap', fx_zap, 'Interface', ['laser', 'jogo']),
    ('teclado', 'Teclado', fx_typing, 'Objetos', ['escrever', 'computador', 'máquina de escrever']),
    ('obturador', 'Fotografia', fx_shutter, 'Objetos', ['câmara', 'foto', 'obturador']),
    ('relogio', 'Tique-taque', fx_tick, 'Objetos', ['relógio', 'tempo', 'espera']),
    ('coracao', 'Batimento cardíaco', fx_heartbeat, 'Objetos', ['coração', 'tensão']),
    ('ta-da', 'Ta-dá!', fx_tada, 'Reações', ['revelação', 'surpresa', 'rufar']),
    ('aplausos', 'Aplausos', fx_applause, 'Reações', ['palmas', 'público']),
    ('ba-dum-tss', 'Ba-dum-tss', fx_rimshot, 'Reações', ['piada', 'humor', 'bateria']),
]

def main():
    only = set(sys.argv[1:])
    manifest = {'musicas': [], 'efeitos': []}
    for sid, name, fn, tags in MUSICAS:
        if only and sid not in only: continue
        print('♪', name, flush=True)
        x, song = fn()
        dur = write_mp3(sid, x, 160)
        manifest['musicas'].append({'id': sid, 'name': name, 'file': sid + '.mp3', 'durationSec': round(dur, 2), 'bpm': song.bpm, 'beats': song.beats(), 'tags': tags})
    for sid, name, fn, cat, tags in EFEITOS:
        if only and sid not in only: continue
        print('·', name, flush=True)
        x = fn()
        x = master(x if x.ndim == 2 else pan(x * 0.7), -18, 0.8)
        # corta o silêncio no fim
        a = np.max(np.abs(x), axis=0); last = np.nonzero(a > 0.002)[0]
        x = x[:, : (last[-1] + int(0.05 * SR)) if len(last) else x.shape[1]]
        dur = write_mp3(sid, x, 128)
        manifest['efeitos'].append({'id': sid, 'name': name, 'file': sid + '.mp3', 'durationSec': round(dur, 2), 'category': cat, 'tags': tags})
    path = os.path.join(OUT, 'sons.json')
    if only and os.path.exists(path):
        old = json.load(open(path))
        for k in ('musicas', 'efeitos'):
            ids = {m['id'] for m in manifest[k]}
            order = [m[0] for m in (MUSICAS if k == 'musicas' else EFEITOS)]
            merged = {m['id']: m for m in old[k]}; merged.update({m['id']: m for m in manifest[k]})
            manifest[k] = [merged[i] for i in order if i in merged]
    json.dump(manifest, open(path, 'w'), ensure_ascii=False, indent=1)
    print('ok →', os.path.normpath(OUT))

if __name__ == '__main__':
    main()
