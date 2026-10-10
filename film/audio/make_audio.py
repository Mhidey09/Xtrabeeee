"""Score, sound design and final mix for THE INTERNET COURT.

Everything here is synthesized from scratch with numpy (no samples), then mixed with the
voiceover lines in audio/vo_*.wav. Output: audio/music.wav, audio/sfx.wav, audio/mix.wav
(48 kHz stereo). Usage: python audio/make_audio.py
"""
import json
import os
import numpy as np
import soundfile as sf

SR = 48000
DUR = 80.0
N = int(SR * DUR)
HERE = os.path.dirname(os.path.abspath(__file__))
rng = np.random.default_rng(11)

BPM = 100
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


def music():
    m = buf()
    # chord timeline: (start, end, chord)
    prog = []
    t = 0.0
    # Opening motif up to the freeze
    prog.append((0.0, 3.25, 'D'))
    # after the freeze
    seq_a = ['Bm', 'G', 'D', 'A']
    t = 3.75
    while t < 18.0:
        for c in seq_a:
            if t >= 18.0:
                break
            prog.append((t, min(t + BAR, 18.0), c))
            t += BAR
    prog.append((18.0, 24.2, 'Em'))            # the question: hush
    t = 24.2
    for c in ['D', 'A', 'Bm', 'G', 'D']:        # courtroom reveal
        prog.append((t, min(t + BAR * 1.0 if c != 'D' or t > 30 else t + BAR, 35.0), c)); t += BAR
        if t >= 35.0:
            break
    t = 35.0
    for c in ['Bm', 'G', 'Em', 'Fsm', 'Bm']:    # jury: restrained tension
        prog.append((t, min(t + BAR, 46.4), c)); t += BAR
        if t >= 46.4:
            break
    prog.append((46.4, 49.6, 'Dmaj9'))         # verdict resolves
    t = 49.6
    for c in ['G', 'A', 'Bm', 'G']:
        prog.append((t, min(t + BAR, 59.0), c)); t += BAR
    prog.append((t, 59.0, 'A')) if t < 59.0 else None
    t = 59.0
    for c in ['Gmaj7', 'A', 'Bm', 'G', 'A']:    # the bigger picture
        prog.append((t, min(t + BAR * 1.0, 72.6), c)); t += BAR * 1.0
        if t >= 72.6:
            break
    if t < 72.6:
        prog.append((t, 72.6, 'A'))
    prog.append((72.6, 80.0, 'Dmaj9'))         # end card

    for (a, b, c) in prog:
        if b - a < 0.05:
            continue
        cut = 900 if 18 <= a < 24 else (1200 if a < 35 else 1500)
        lvl = 0.16
        if 18.0 <= a < 24.2:
            lvl = 0.11
        if a >= 59:
            lvl = 0.19
        p = pad([midi(n) for n in CHORDS[c]], b - a + 1.2, a=0.6 if a > 0 else 0.05, r=1.2, cutoff=cut)
        add(m, p, a, lvl)
        # bass
        if not (18.0 <= a < 24.2) and a >= 3.75:
            for k in range(int((b - a) / BEAT + 0.01)):
                if k % 2 == 0:
                    add(m, bass(midi(ROOT[c]), BEAT * 1.6), a + k * BEAT, 0.20)

    # opening motif (playful): D A F# A  D' A F# E
    motif = [74, 69, 66, 69, 78, 76, 74, 69]
    for k, n in enumerate(motif):
        tt = 0.08 + k * BEAT / 2
        if tt < 3.2:
            add(m, pluck(midi(n)), tt, 0.16, pan=-0.3 + 0.6 * (k % 2))

    # pluck arpeggios
    def arps(t0, t1, gain, pattern=(0, 2, 1, 3, 2, 1, 3, 2), step=BEAT / 2):
        tt = t0
        k = 0
        while tt < t1:
            c = next((cc for (a, b, cc) in prog if a <= tt < b), 'D')
            notes = CHORDS[c]
            n = notes[pattern[k % len(pattern)] % len(notes)] + 12
            add(m, pluck(midi(n), 0.9, 0.8), tt, gain * (0.8 + 0.2 * (k % 4 == 0)), pan=0.35 * np.sin(k * 0.9))
            tt += step
            k += 1
    arps(3.75, 17.6, 0.085)
    arps(25.4, 34.6, 0.09)
    arps(49.8, 58.6, 0.08)
    arps(59.2, 72.2, 0.095, pattern=(0, 1, 2, 3, 4, 3, 2, 1))

    # drums
    def drums(t0, t1, kg=0.42, hg=0.05, half=False):
        tt = t0
        k = 0
        while tt < t1:
            if k % 4 == 0 or (not half and k % 4 == 2):
                add(m, kick(), tt, kg)
            if k % 2 == 1:
                add(m, hat(), tt, hg, pan=0.25)
            tt += BEAT / 2
            k += 1
    drums(6.6, 17.8, 0.30, 0.035, half=True)
    drums(27.4, 34.8, 0.34, 0.04)
    drums(49.8, 58.8, 0.34, 0.04)
    drums(61.0, 72.4, 0.38, 0.045)

    # jury pulse: quiet 16ths, rising filter
    tt, k = 37.6, 0
    while tt < 46.2:
        g = 0.035 + 0.04 * (tt - 37.6) / 8.6
        add(m, hat(70), tt, g, pan=0.4 * np.sin(k))
        if k % 4 == 0:
            add(m, kick(), tt, 0.22)
        tt += BEAT / 4
        k += 1

    # final signature: D A F# D (bells)
    for k, n in enumerate([74, 81, 78, 86]):
        add(m, bell(midi(n), 3.5), 73.2 + k * 0.32, 0.11, pan=-0.2 + 0.13 * k)

    # global fade-out at the end and freeze gap
    t = np.arange(N) / SR
    g = np.ones(N)
    g *= np.clip((80.0 - t) / 3.0, 0, 1)
    frz = (t > 3.25) & (t < 3.75)
    g[frz] *= 0.0
    edge = (t >= 3.15) & (t <= 3.25)
    g[edge] *= np.clip((3.25 - t[edge]) / 0.1, 0, 1)
    m *= g[:, None]
    return reverb(m, 2.6, 0.22)


# ------------------------------------------------------------------ sound design
def sfx():
    s = buf()
    # 0.05 transaction confirmation
    add(s, bell(midi(88), 1.2), 0.05, 0.10, 0.3); add(s, bell(midi(93), 1.2), 0.17, 0.08, 0.35)
    # 3.25 discrepancy: soft low detuned tone under the freeze
    n = int(1.4 * SR); t = np.arange(n) / SR
    tone = (np.sin(2 * np.pi * 110 * t) + np.sin(2 * np.pi * 116.5 * t)) * np.exp(-t * 2.2) * np.clip(t / 0.01, 0, 1)
    add(s, tone, 3.25, 0.14)
    # 6.6 panel rotates in
    add(s, noise_sweep(0.8, 600, 3000, 'swell'), 6.55, 0.05)
    # 11.35 permission boundary: soft click + glass slide
    add(s, click(1800), 11.35, 0.16); add(s, noise_sweep(0.55, 400, 1800), 11.38, 0.06)
    # 13.05 token into terminal + 13.55 confirmation
    add(s, click(3200, 0.02), 13.48, 0.12); add(s, bell(midi(88), 1.0), 13.55, 0.08, 0.3); add(s, bell(midi(93), 1.0), 13.67, 0.06, 0.3)
    add(s, noise_sweep(0.5, 400, 1500), 13.4, 0.04)  # gate closes behind
    # 15.4 discrepancy highlight (smaller)
    n = int(1.0 * SR); t = np.arange(n) / SR
    add(s, (np.sin(2 * np.pi * 147 * t) + np.sin(2 * np.pi * 155 * t)) * np.exp(-t * 3) * np.clip(t / 0.01, 0, 1), 15.4, 0.08)
    # 16.9 cards slide together (paper)
    add(s, noise_sweep(1.2, 1500, 5000, 'swell'), 16.9, 0.035)
    # 20.2 courtroom door: quiet mechanical movement
    add(s, lowpass(rng.standard_normal(int(1.9 * SR)), 180) * np.sin(np.linspace(0, np.pi, int(1.9 * SR))) ** 1.2, 20.2, 0.5)
    for k in range(4):
        add(s, click(900 + 120 * k, 0.04), 20.25 + k * 0.45, 0.07)
    add(s, thud(60, 0.4), 22.0, 0.12)
    # 22.4 cards swing open like doors
    add(s, noise_sweep(1.0, 800, 3000), 22.4, 0.04)
    # 23.4 flight to the court
    add(s, noise_sweep(2.8, 300, 2600, 'swell'), 23.3, 0.08)
    # 28.6 evidence lands
    add(s, click(1400, 0.05), 28.7, 0.09, -0.3); add(s, click(1500, 0.05), 28.85, 0.09, 0.3)
    # 34.6 core separates
    for k in range(3):
        add(s, click(700 + 200 * k, 0.06), 34.6 + k * 0.38, 0.1)
    add(s, lowpass(rng.standard_normal(int(1.8 * SR)), 260) * np.sin(np.linspace(0, np.pi, int(1.8 * SR))), 34.6, 0.35)
    # 35.4 validators rise (staggered soft tones)
    for i, n_ in enumerate([62, 66, 69, 73, 76]):
        add(s, pluck(midi(n_ + 12), 1.0, 0.4), 35.9 + i * 0.22, 0.05, -0.6 + 0.3 * i)
    # 43.0 results converge
    for i, n_ in enumerate([69, 71, 73, 74, 76]):
        add(s, bell(midi(n_ + 12), 1.4), 43.5 + i * 0.32, 0.045, -0.6 + 0.3 * i)
    # 46.4 verdict: distinctive but understated
    add(s, bell(midi(50), 4.0), 46.5, 0.12); add(s, bell(midi(62), 4.0), 46.5, 0.08); add(s, bell(midi(69), 3.5), 46.62, 0.06)
    # 49.9 seal flies out
    add(s, noise_sweep(3.0, 300, 2200, 'swell'), 49.9, 0.07)
    # 53.3 stamp + status flips
    add(s, thud(90, 0.3), 53.3, 0.18); add(s, click(2600, 0.03), 53.45, 0.1)
    # 54.75 delegation revoked: lock slides home, clean click
    add(s, noise_sweep(0.4, 500, 2500, 'in'), 54.75, 0.06); add(s, click(1200, 0.06), 55.15, 0.2); add(s, thud(110, 0.25), 55.15, 0.12)
    # 55.85 payment bumps the closed boundary
    add(s, thud(150, 0.25), 55.85, 0.16)
    # 56.0 rejection label: soft two-note down
    add(s, pluck(midi(69), 0.8, 0.5), 56.0, 0.06); add(s, pluck(midi(64), 0.9, 0.5), 56.18, 0.06)
    # 63 dispute travels across the world
    add(s, noise_sweep(6.0, 400, 1400, 'swell'), 63.2, 0.03)
    return s


def voiceover():
    v = buf()
    place = {'s1a': 0.6, 's1b': 3.75, 's2a': 7.4, 's2b': 11.0, 's3': 18.4, 's4': 25.0, 's5a': 35.6,
             's5b': 40.6, 's6a': 48.6, 's6b': 52.7, 's7a': 59.6, 's7b': 66.4, 's8': 74.0}
    spans = []
    for key, _ in json.load(open(os.path.join(HERE, 'vo_lines.json'))):
        x, sr = sf.read(os.path.join(HERE, f'vo_{key}.wav'))
        if x.ndim > 1:
            x = x.mean(1)
        assert sr == 24000
        x = np.interp(np.arange(int(len(x) * SR / sr)) / SR, np.arange(len(x)) / sr, x)  # to 48 kHz
        # trim leading/trailing silence
        a = np.abs(x)
        idx = np.where(a > 0.01)[0]
        x = x[max(0, idx[0] - 600): idx[-1] + 2400]
        # gentle presence: high-shelf-ish lift + low cut
        x = highpass(x, 90)
        x = x + 0.25 * highpass(x, 3000)
        x /= np.max(np.abs(x)) + 1e-9
        add(v, x * 0.9, place[key], 1.0)
        spans.append((place[key], place[key] + len(x) / SR, key))
    return v, spans


def duck_curve(spans):
    t = np.arange(N) / SR
    g = np.ones(N)
    for a, b, _ in spans:
        g = np.minimum(g, np.where((t > a - 0.25) & (t < b + 0.3), 0.42, 1.0))
    return lowpass(g, 3.0)


if __name__ == '__main__':
    mus = music()
    fx = sfx()
    vo, spans = voiceover()
    duck = duck_curve(spans)
    mix = mus * duck[:, None] * 0.9 + fx * (0.55 + 0.45 * duck[:, None]) + vo * 0.95
    peak = np.max(np.abs(mix))
    mix = mix / peak * 0.89
    sf.write(os.path.join(HERE, 'music.wav'), (mus / np.max(np.abs(mus)) * 0.89).astype(np.float32), SR)
    sf.write(os.path.join(HERE, 'sfx.wav'), (fx / np.max(np.abs(fx)) * 0.89).astype(np.float32), SR)
    sf.write(os.path.join(HERE, 'mix.wav'), mix.astype(np.float32), SR)
    json.dump([{'start': round(a, 2), 'end': round(b, 2), 'line': k} for a, b, k in spans],
              open(os.path.join(HERE, 'vo_timing.json'), 'w'), indent=1)
    for a, b, k in spans:
        print(f'{k:4s} {a:6.2f} -> {b:6.2f}')
    print('peak before norm', peak)
