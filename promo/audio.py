# 영상 소리: 배경음악을 마무리(두둥!)까지 깔고, 두둥 두 번(직접 만든 북소리), 뒤에 음악을 작게 다시 깔아 끝낸다
import subprocess, numpy as np, wave, sys, os
D = os.path.dirname(os.path.abspath(__file__))
SR, BEAT = 44100, 60 / 143.55
END = BEAT * 72  # 9장면 (2마디씩)
TOTAL = round(END + 4.3, 2)
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f'{D}/audio/bgm.mp3', '-t', str(TOTAL + 2), '-ac', '2', '-ar', str(SR), '-f', 's16le', '-'], capture_output=True, check=True).stdout
m = np.frombuffer(raw, dtype=np.int16).astype(np.float32).reshape(-1, 2) / 32768
n = int(TOTAL * SR)
out = np.zeros((n, 2), np.float32)
t = np.arange(n) / SR
# 1) 음악: 시작 0.15초 들어오고, 두둥 직전 0.3초에 줄인다
env = np.clip(t / 0.15, 0, 1) * np.clip((END - t) / 0.3, 0, 1)
out += m[:n] * env[:, None] * 0.9
# 2) 두둥: 낮게 떨어지는 북 + 짧은 딱 소리 + 낮은 울림
def boom(at, gain=1.0):
    k = np.arange(int(1.6 * SR)) / SR
    f = 40 + 110 * np.exp(-k * 9)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-k * 3.2)
    s += 0.5 * np.random.default_rng(1).standard_normal(len(k)) * np.exp(-k * 40)  # 딱
    s += 0.35 * np.sin(2 * np.pi * 55 * k) * np.exp(-k * 1.6)  # 울림
    i = int(at * SR); j = min(n, i + len(s))
    out[i:j] += (s[:j - i] * gain)[:, None]
boom(END, 0.95); boom(END + 0.55, 1.1)
# 3) COMING SOON: 음악을 두둥 뒤 1.3초부터 작게 다시 (끝 1초 동안 줄인다)
st = END + 1.3
seg = (t >= st)
env2 = np.clip((t - st) / 0.6, 0, 1) * np.clip((TOTAL - t) / 1.0, 0, 1) * 0.45
idx = np.clip(((t - st) + END - 2.0) * SR, 0, len(m) - 1).astype(int)
out += m[idx] * (env2 * seg)[:, None]
out = np.tanh(out * 1.1) * 0.92  # 부드럽게 눌러 찢어지지 않게
with wave.open(f'{D}/audio/final.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((out * 32767).astype(np.int16).tobytes())
print('final.wav', TOTAL, 'END', round(END, 3))
