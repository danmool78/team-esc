# 비전 퀘스트 — 홍보 쇼츠

`vision-quest-shorts.mp4` — 1080×1920, 31초, 30fps. 장면은 배경음악 박자(143.6 BPM)에 맞춰 2마디마다 바뀐다.

1. 전주 한옥마을이 게임판이 된다 (직접 그린 한옥·홍살문·은행나무 + 앱의 미니미)
2. 팀을 나누고 폰 하나씩
3. 친구들 위치가 3D 지도에 실시간 (앱 화면)
4. 미션 지점 도착 — 도착·퀴즈·사진·현장 미션
5. 점수가 바로바로 쑥
6. 다 같이 움직이면 오픈버스 탑승 (45명)
7. 차 타고 미션 장소로 부릉 → 도착하면 현장 미션
8. 남은 시간 째깍째깍 → 누가 1등?! (결과 화면)
9. 두둥! 비전 퀘스트 — COMING SOON

## 다시 만들기
```sh
python3 -m http.server 8765 &        # 저장소 맨 위에서
mkdir -p promo/audio && curl -o promo/audio/bgm.mp3 "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Pixel%20Peeker%20Polka%20-%20faster.mp3"
node promo/capture.js                 # 앱 데모 화면 촬영 → promo/cap
node promo/avatars.js                 # 미니미 그림
python3 promo/audio.py                # 음악 + 두둥 → promo/audio/final.wav
node promo/render.js                  # shorts.html을 30fps로 찍어 mp4로 (node promo/render.js 3 15 처럼 주면 그 초의 정지 화면만)
```

## 음악
"Pixel Peeker Polka - faster" Kevin MacLeod (incompetech.com)
Licensed under Creative Commons: By Attribution 4.0 License — http://creativecommons.org/licenses/by/4.0/
영상 끝에 출처를 넣었고, 올릴 때 설명란에도 위 두 줄을 적는다. "두둥" 북소리는 `audio.py`가 직접 만든 소리.
