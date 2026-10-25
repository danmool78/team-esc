# 시작 화면 효과음: 바람이 휘익 불어 올라오고(밴드패스 노이즈, 왼→오른쪽), 제목이 뜰 때 금빛 반짝임(작은 종소리) — 2.3초
# 만들기: python3 _src/whoosh.py → whoosh.wav, 그다음 ffmpeg -i whoosh.wav -b:a 96k assets/whoosh.mp3
import numpy as np, wave
sr, T = 44100, 2.3
n = int(sr * T); t = np.arange(n) / sr
rng = np.random.default_rng(7)
noise = rng.standard_normal(n)
# 바람: 중심 주파수를 300→1600→500Hz로 훑는 밴드패스(바이쿼드)를 직접 돌린다
fc = np.interp(t, [0, 0.9, 1.6, T], [300, 1600, 900, 500])
y = np.zeros(n); x1 = x2 = y1 = y2 = 0.0
for i in range(n):
    w0 = 2 * np.pi * fc[i] / sr; q = 1.6
    al = np.sin(w0) / (2 * q); b0, b2, a0, a1, a2 = al, -al, 1 + al, -2 * np.cos(w0), 1 - al
    xi = noise[i]
    yi = (b0 * xi + b2 * x2 - a1 * y1 - a2 * y2) / a0
    x2, x1, y2, y1 = x1, xi, y1, yi
    y[i] = yi
env = np.interp(t, [0, 0.85, 1.25, T], [0, 1, 0.55, 0]) ** 1.5
wind = y / np.abs(y).max() * env * 0.55
pan = np.interp(t, [0, T], [0.15, 0.85])
L, R = wind * np.sqrt(1 - pan), wind * np.sqrt(pan)
# 반짝임: 0.75초쯤부터 높은 종소리 몇 개가 빠르게 이어진다
for k, (at, f) in enumerate([(0.72, 1568), (0.80, 2093), (0.88, 2637), (0.98, 3136), (1.10, 2093)]):
    m = t >= at; tt = t[m] - at
    s = (np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(2 * np.pi * f * 2.01 * tt)) * np.exp(-tt * 4.2) * 0.16
    p = 0.3 + 0.1 * k
    L[m] += s * np.sqrt(1 - p); R[m] += s * np.sqrt(p)
out = np.stack([L, R], 1)
out = out / np.abs(out).max() * 0.85
out[:200] *= np.linspace(0, 1, 200)[:, None]; out[-2000:] *= np.linspace(1, 0, 2000)[:, None]
with wave.open('whoosh.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr)
    w.writeframes((out * 32767).astype('<i2').tobytes())
