"""Score, sound design and final mix for WHERE SHOULD MOCHI STAKE?

Everything here is synthesized from scratch with numpy (no samples), then mixed with the
voiceover lines in audio/vo_*.wav. Output: audio/music.wav, audio/sfx.wav, audio/mix.wav
(48 kHz stereo). Usage: python audio/make_audio.py
"""
import json
import os
import numpy as np
import soundfile as sf

SR = 48000
DUR = 64.0
N = int(SR * DUR)
HERE = os.path.dirname(os.path.abspath(__file__))
rng = np.random.default_rng(11)

BPM = 112
BEAT = 60 / BPM          # 0.6 s
BAR = BEAT * 4           # 2.4 s


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def buf():
    return np.zeros((N, 2))


def add(dst, sig, t, gain=1.0, pan=0.0):
    """Mix a mono or stereo signal into dst at time t with equal-power pan."""
    i = int(t * SR)
    if i >= N:
        return
    if sig.ndim == 1:
        a = np.cos((pan + 1) * np.pi / 4)
        b = np.sin((pan + 1) * np.pi / 4)
        sig = np.stack([sig * a, sig * b], 1)
    j = min(N, i + len(sig))
    if i < 0:
        sig = sig[-i:]
        i = 0
        j = min(N, len(sig))
    dst[i:j] += sig[: j - i] * gain


def env_adsr(n, a=0.01, d=0.1, s=0.7, r=0.2):
    t = np.arange(n) / SR
    total = n / SR
    e = np.ones(n) * s
    e[t < a] = t[t < a] / a
    m = (t >= a) & (t < a + d)
    e[m] = 1 - (1 - s) * (t[m] - a) / d
    rel = t > total - r
    e[rel] *= np.clip((total - t[rel]) / r, 0, 1)
    return e


def lowpass(x, cutoff):
    """Two cascaded one-pole lowpass responses (12 dB/oct), applied in the frequency domain."""
    a = np.exp(-2 * np.pi * cutoff / SR)
    n = len(x)
    nfft = 1 << (n + SR // 2 - 1).bit_length()
    w = 2 * np.pi * np.fft.rfftfreq(nfft)
    H = ((1 - a) / (1 - a * np.exp(-1j * w))) ** 2
    if x.ndim == 1:
        return np.fft.irfft(np.fft.rfft(x, nfft) * H, nfft)[:n]
    return np.fft.irfft(np.fft.rfft(x, nfft, axis=0) * H[:, None], nfft, axis=0)[:n]


def highpass(x, cutoff):
    return x - lowpass(x, cutoff)


# ------------------------------------------------------------------ instruments
def pluck(f, dur=1.2, bright=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    mod = np.sin(2 * np.pi * f * 3.0 * t) * 1.6 * bright * np.exp(-t * 9)
    car = np.sin(2 * np.pi * f * t + mod)
    car += 0.25 * np.sin(2 * np.pi * f * 2 * t) * np.exp(-t * 6)
    e = np.exp(-t * 4.2) * np.clip(t / 0.003, 0, 1)
    return car * e


def bell(f, dur=3.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = (np.sin(2 * np.pi * f * t) * np.exp(-t * 1.6)
         + 0.45 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 3.2)
         + 0.22 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 6))
    return s * np.clip(t / 0.002, 0, 1)


def pad(freqs, dur, a=1.2, r=1.6, cutoff=1400):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros((n, 2))
    for k, f in enumerate(freqs):
        for d, side in ((-0.09, 0), (0.0, None), (0.09, 1)):
            ff = f * 2 ** (d / 12)
            w = np.zeros(n)
            for h in range(1, 9):  # band-limited saw, soft rolloff
                if ff * h > cutoff * 2.2:
                    break
                w += np.sin(2 * np.pi * ff * h * t + rng.uniform(0, 6.28)) / h * np.exp(-(ff * h) / cutoff)
            if side is None:
                out += w[:, None] * 0.5
            else:
                out[:, side] += w
    e = env_adsr(n, a, 0.3, 0.85, r)
    return out * e[:, None] / max(1, len(freqs))


def bass(f, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t) + 0.08 * np.sin(2 * np.pi * 3 * f * t)
    return s * env_adsr(n, 0.008, 0.25, 0.6, 0.15)


def kick():
    n = int(0.42 * SR)
    t = np.arange(n) / SR
    f = 46 + 90 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 9) * np.clip(t / 0.002, 0, 1)


def hat(dec=40):
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    x = highpass(rng.standard_normal(n), 7000)
    return x * np.exp(-t * dec)


def noise_sweep(dur, f0, f1, shape='swell'):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = rng.standard_normal(n)
    # crude moving band: mix of lowpassed versions
    lo = lowpass(x, f0)
    hi = lowpass(x, f1)
    k = t / dur
    y = lo * (1 - k) + hi * k
    if shape == 'swell':
        e = np.sin(np.pi * k) ** 1.5
    elif shape == 'in':
        e = k ** 2
    else:
        e = (1 - k) ** 2
    return y * e


def click(f=2400, dur=0.03):
    n = int(dur * SR)
    t = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * t) * 0.6 + rng.standard_normal(n) * 0.4) * np.exp(-t * 180)


def thud(f=70, dur=0.35):
    n = int(dur * SR)
    t = np.arange(n) / SR
    ff = f * (1 + 0.6 * np.exp(-t * 30))
    return np.sin(2 * np.pi * np.cumsum(ff) / SR) * np.exp(-t * 14) + lowpass(rng.standard_normal(n), 400) * np.exp(-t * 30) * 0.5


def reverb(x, seconds=2.4, mix=0.25, predelay=0.02):
    """Stereo FFT convolution with a decaying-noise impulse response."""
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal((n, 2)) * np.exp(-t * 6.9 / seconds)[:, None]
    ir = lowpass(ir, 5000)
    ir[: int(predelay * SR)] = 0
    ir /= np.sqrt((ir ** 2).sum(0))
    L = len(x) + n
    nfft = 1 << (L - 1).bit_length()
    wet = np.stack([np.fft.irfft(np.fft.rfft(x[:, c], nfft) * np.fft.rfft(ir[:, c], nfft), nfft)[: len(x)] for c in range(2)], 1)
    return x * (1 - mix) + wet * mix * 3.0


# ------------------------------------------------------------------ score
D3, Fs3, A3 = 50, 54, 57
CHORDS = {
    'D': [62, 66, 69, 74], 'Bm': [59, 62, 66, 71], 'G': [55, 59, 62, 67], 'A': [57, 61, 64, 69],
    'Em': [52, 55, 59, 64], 'Fsm': [54, 57, 61, 66], 'Dmaj9': [62, 66, 69, 73, 76], 'Gmaj7': [55, 59, 62, 66],
}
ROOT = {'D': 38, 'Bm': 35, 'G': 43, 'A': 45, 'Em': 40, 'Fsm': 42, 'Dmaj9': 38, 'Gmaj7': 43}


# ------------------------------------------------------------------ score (bright, bouncy, D major)
CHORDS = {'D': [62, 66, 69, 74], 'G': [55, 59, 62, 67], 'A': [57, 61, 64, 69], 'Bm': [59, 62, 66, 71],
          'Em': [52, 55, 59, 64], 'Dadd9': [62, 66, 69, 76], 'Gmaj7': [55, 59, 62, 66]}
ROOT = {'D': 38, 'G': 43, 'A': 45, 'Bm': 35, 'Em': 40, 'Dadd9': 38, 'Gmaj7': 43}


def music():
    m = buf()
    prog = []
    cyc = ['D', 'G', 'Bm', 'A']
    t, k = 0.0, 0
    while t < 60.6:
        c = cyc[k % 4]
        if 43.4 <= t < 49.4:          # the tilt: unresolved, a little uneasy
            c = ['Em', 'Bm', 'Em', 'A'][k % 4]
        prog.append((t, min(t + BAR, 60.6), c)); t += BAR; k += 1
    prog.append((60.6, DUR, 'Dadd9'))

    for (a, b, c) in prog:
        p = pad([midi(n) for n in CHORDS[c]], b - a + 1.0, a=0.2 if a > 0 else 0.02, r=0.9, cutoff=1500)
        add(m, p, a, 0.10)
        for j in range(int((b - a) / BEAT + 0.01)):
            if j % 2 == 0 or (49.4 <= a < 60.6):
                add(m, bass(midi(ROOT[c]), BEAT * 0.9), a + j * BEAT, 0.20)

    # bouncy pluck melody / arps
    def arps(t0, t1, gain, pattern=(0, 2, 3, 2, 1, 2, 3, 2), step=BEAT / 2, octave=12):
        tt, j = t0, 0
        while tt < t1:
            c = next((cc for (a, b, cc) in prog if a <= tt < b), 'D')
            notes = CHORDS[c]
            add(m, pluck(midi(notes[pattern[j % len(pattern)] % len(notes)] + octave), 0.7, 1.0), tt, gain, pan=0.3 * np.sin(j * 1.1))
            tt += step; j += 1
    # Mochi's motif: D F# A F# | B A F# D (playful)
    motif = [74, 78, 81, 78, 83, 81, 78, 74]
    for j, n in enumerate(motif):
        add(m, pluck(midi(n + 12), 0.6, 0.6), 0.1 + j * BEAT / 2, 0.11, pan=-0.25 + 0.5 * (j % 2))
    arps(2.5, 19.4, 0.06)
    arps(19.6, 30.4, 0.055, step=BEAT)
    arps(30.6, 43.2, 0.065)
    arps(49.4, 60.4, 0.07, pattern=(0, 1, 2, 3, 2, 1, 2, 3))
    for j, n in enumerate(motif):
        add(m, pluck(midi(n + 12), 0.6, 0.6), 54.7 + j * BEAT / 2, 0.1, pan=-0.25 + 0.5 * (j % 2))

    def drums(t0, t1, kg=0.32, hg=0.035, snap=True):
        tt, j = t0, 0
        while tt < t1:
            if j % 4 == 0:
                add(m, kick(), tt, kg)
            if j % 4 == 2 and snap:
                n = int(0.12 * SR); x = highpass(rng.standard_normal(n), 1800) * np.exp(-np.arange(n) / SR * 30)
                add(m, x, tt, 0.05)
            if j % 2 == 1:
                add(m, hat(), tt, hg, pan=0.2)
            tt += BEAT / 2; j += 1
    drums(7.6, 19.4)
    drums(30.6, 43.2)
    drums(49.4, 60.4, 0.36, 0.04)
    # end chord bells
    for j, n in enumerate([74, 78, 81, 86]):
        add(m, bell(midi(n), 3.0), 60.8 + j * 0.18, 0.09, pan=-0.2 + 0.13 * j)
    t = np.arange(N) / SR
    m *= np.clip((DUR - t) / 2.5, 0, 1)[:, None]
    return reverb(m, 1.8, 0.18)


def boop(f0=600, f1=900, dur=0.14):
    n = int(dur * SR); t = np.arange(n) / SR
    f = f0 + (f1 - f0) * t / dur
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 18) * np.clip(t / 0.004, 0, 1)


def coin(f=2600):
    n = int(0.35 * SR); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * t) + 0.6 * np.sin(2 * np.pi * f * 1.5 * t)) * np.exp(-t * 14) * np.clip(t / 0.002, 0, 1)


# ------------------------------------------------------------------ sound design
def sfx():
    s = buf()
    for k in range(4):                                    # Mochi hops in
        add(s, boop(500 + 60 * k, 820 + 60 * k), 0.05 + k * 0.32, 0.12)
    add(s, boop(700, 1200, 0.18), 3.8, 0.12)              # curious head tilt
    add(s, pluck(midi(88), 0.5, 0.4), 4.3, 0.08)          # thought bubble pop
    add(s, noise_sweep(1.0, 800, 3000), 9.4, 0.04)        # task card arrives
    for k in range(5):
        add(s, noise_sweep(0.5, 1500, 4000), 11.6 + k * 0.06, 0.012)
    for k in range(5):                                    # votes
        add(s, bell(midi(81 + [0, 2, 4, 5, 7][k]), 0.8), 15.2 + k * 0.4, 0.06, -0.6 + 0.3 * k)
    add(s, bell(midi(86), 1.6), 18.05, 0.1)               # merged check
    for k in range(5):                                    # stake drops in
        add(s, coin(2300 + 90 * k), 20.75 + k * 0.28, 0.07)
    add(s, click(1500, 0.05), 21.95, 0.12)                # seat lights up
    add(s, coin(3000), 25.6, 0.09); add(s, bell(midi(93), 0.8), 25.6, 0.05)  # reward
    add(s, noise_sweep(0.7, 2000, 6000, 'in'), 28.0, 0.05)  # slash blade
    add(s, thud(180, 0.25), 28.6, 0.12)
    add(s, pluck(midi(64), 0.6, 0.5), 28.75, 0.07); add(s, pluck(midi(60), 0.7, 0.5), 28.95, 0.07)
    for k in range(7):                                    # Mochi walks
        add(s, boop(520, 760, 0.1), 31.0 + k * 0.46, 0.07)
    for k in range(3):                                    # delegates
        add(s, coin(2500 + 120 * k), 36.1 + k * 0.32, 0.08)
    add(s, coin(3100), 38.7, 0.09); add(s, boop(800, 1300, 0.16), 38.75, 0.1)  # reward back, happy
    n = int(1.2 * SR); tt = np.arange(n) / SR                 # risk ripple
    add(s, np.sin(2 * np.pi * 220 * tt) * np.sin(2 * np.pi * 6 * tt) * np.exp(-tt * 2.5), 39.4, 0.08)
    for k in range(6):
        add(s, boop(400, 700, 0.1), 42.6 + k * 0.1, 0.05)  # holders pop in
    for k in range(12):
        add(s, coin(2200 + 50 * k), 44.4 + k * 0.3, 0.05)
    add(s, lowpass(rng.standard_normal(int(3.5 * SR)), 140) * np.sin(np.linspace(0, np.pi, int(3.5 * SR))), 44.4, 0.45)  # creak / lean
    for k in range(10):
        add(s, coin(2600 + 40 * k), 50.15 + k * 0.17, 0.045)
    for k in range(3):
        add(s, coin(2900 + 100 * k), 51.7 + k * 0.35, 0.06)
    add(s, thud(90, 0.35), 52.2, 0.12)                    # network settles level
    add(s, bell(midi(86), 1.4), 52.3, 0.06)
    add(s, boop(600, 1100, 0.18), 54.9, 0.12)             # Mochi squish
    add(s, boop(900, 1500, 0.12), 55.9, 0.1)              # wink
    return s


def voiceover():
    v = buf()
    place = {'m1a': 0.45, 'm1b': 1.9, 'm2a': 7.9, 'm2b': 11.3, 'm3a': 19.9, 'm3b': 24.3, 'm4a': 30.9, 'm4b': 35.1,
             'm5a': 41.6, 'm5b': 43.4, 'm5c': 49.2, 'm6a': 54.8, 'm6b': 56.9}
    spans = []
    for key, _ in json.load(open(os.path.join(HERE, 'vo_lines.json'))):
        x, sr = sf.read(os.path.join(HERE, f'vo_{key}.wav'))
        if x.ndim > 1:
            x = x.mean(1)
        x = np.interp(np.arange(int(len(x) * SR / sr)) / SR, np.arange(len(x)) / sr, x)
        idx = np.where(np.abs(x) > 0.01)[0]
        x = x[max(0, idx[0] - 600): idx[-1] + 2400]
        x = highpass(x, 90); x = x + 0.25 * highpass(x, 3000)
        x /= np.max(np.abs(x)) + 1e-9
        add(v, x * 0.9, place[key], 1.0)
        spans.append((place[key], place[key] + len(x) / SR, key))
    return v, spans


def duck_curve(spans):
    t = np.arange(N) / SR
    g = np.ones(N)
    for a, b, _ in spans:
        g = np.minimum(g, np.where((t > a - 0.25) & (t < b + 0.3), 0.45, 1.0))
    return lowpass(g, 3.0)


if __name__ == '__main__':
    mus = music(); fx = sfx(); vo, spans = voiceover(); duck = duck_curve(spans)
    mix = mus * duck[:, None] * 0.9 + fx * (0.6 + 0.4 * duck[:, None]) + vo * 0.95
    mix = mix / np.max(np.abs(mix)) * 0.89
    sf.write(os.path.join(HERE, 'mix.wav'), mix.astype(np.float32), SR)
    json.dump([{'start': round(a, 2), 'end': round(b, 2), 'line': k} for a, b, k in spans], open(os.path.join(HERE, 'vo_timing.json'), 'w'), indent=1)
    for a, b, k in spans:
        print(f'{k:4s} {a:6.2f} -> {b:6.2f}')
