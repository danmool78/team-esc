# 시작 화면 그림: 공중에 뜬 전주 한옥마을 땅 조각 + 미션 빛기둥 + 세 팀 미니미
# 만들기: python3 _src/hero.py assets/hero.svg
import math, sys
U = (1.0, 0.5); V = (-1.0, 0.5)          # 등각: 동쪽(오른쪽 뒤→앞), 남쪽(왼쪽 앞)
def P(x, y, a=0, b=0, h=0): return (x + U[0]*a + V[0]*b, y + U[1]*a + V[1]*b - h)
def pts(*ps): return ' '.join(f'{p[0]:.1f},{p[1]:.1f}' for p in ps)
out = []
W = out.append
CX, CY, R = 200, 226, 128   # 땅 가운데, 반 너비(동쪽 축 길이)
def G(a, b, h=0): return P(CX, CY - R*0.5 - 0, a, b, h)  # 땅 북쪽 꼭짓점 기준
# 땅 꼭짓점: 북 (0,0) 동 (R,0) 남 (R,R) 서 (0,R)
N, E, S, Wst = G(0,0), G(R,0), G(R,R), G(0,R)
D = 22  # 두께
def hanok(a, b, w, d, h, s=1.0):
    # 바닥 네 귀퉁이
    p0, p1, p2, p3 = G(a,b), G(a+w,b), G(a+w,b+d), G(a,b+d)
    up = lambda p, hh: (p[0], p[1]-hh)
    W(f'<ellipse cx="{(p0[0]+p2[0])/2:.1f}" cy="{(p0[1]+p2[1])/2+3:.1f}" rx="{w*1.15:.1f}" ry="{w*0.5:.1f}" fill="#000" opacity=".22"/>')
    # 기단(돌)
    st = 4
    W(f'<polygon points="{pts(p3, p2, up(p2,st), up(p3,st))}" fill="#9a8f7d"/>')
    W(f'<polygon points="{pts(p2, p1, up(p1,st), up(p2,st))}" fill="#7c7262"/>')
    q0,q1,q2,q3 = [up(p,st) for p in (p0,p1,p2,p3)]
    # 벽: 앞(남) 흰 벽 + 나무 기둥, 옆(동)
    W(f'<polygon points="{pts(q3, q2, up(q2,h), up(q3,h))}" fill="#f1e6cc"/>')
    W(f'<polygon points="{pts(q2, q1, up(q1,h), up(q2,h))}" fill="#d6c7a6"/>')
    for t in (0, 0.33, 0.66, 1):
        x = q3[0] + (q2[0]-q3[0])*t; y = q3[1] + (q2[1]-q3[1])*t
        W(f'<line x1="{x:.1f}" y1="{y:.1f}" x2="{x:.1f}" y2="{y-h:.1f}" stroke="#7a4a26" stroke-width="2.4"/>')
    for t in (0.5, 1):
        x = q2[0] + (q1[0]-q2[0])*t; y = q2[1] + (q1[1]-q2[1])*t
        W(f'<line x1="{x:.1f}" y1="{y:.1f}" x2="{x:.1f}" y2="{y-h:.1f}" stroke="#6a3f20" stroke-width="2.2"/>')
    # 문살 창 (앞벽 가운데 칸)
    m0 = (q3[0]+(q2[0]-q3[0])*0.4, q3[1]+(q2[1]-q3[1])*0.4); m1 = (q3[0]+(q2[0]-q3[0])*0.6, q3[1]+(q2[1]-q3[1])*0.6)
    W(f'<polygon points="{pts((m0[0],m0[1]-h*0.15),(m1[0],m1[1]-h*0.15),(m1[0],m1[1]-h*0.8),(m0[0],m0[1]-h*0.8))}" fill="#ffd98a" stroke="#7a4a26" stroke-width="1.4"/>')
    # 지붕: 처마를 내밀고 끝을 들어 올린 기와지붕 (팔작 비슷하게)
    o = 7*s; rh = h*0.95
    e0, e1, e2, e3 = G(a-o, b-o*0.6), G(a+w+o, b-o*0.6), G(a+w+o, b+d+o*0.6), G(a-o, b+d+o*0.6)
    e0,e1,e2,e3 = [up(p, st+h) for p in (e0,e1,e2,e3)]
    r0 = up(G(a+w*0.18, b+d/2), st+h+rh); r1 = up(G(a+w*0.82, b+d/2), st+h+rh)
    lift = 7*s
    # 앞 지붕면 (남쪽 처마 e3→e2, 용마루 r0→r1) — 처마 끝을 들어 올림
    W(f'<path d="M{e3[0]:.1f},{e3[1]-lift:.1f} Q{(e3[0]+e2[0])/2:.1f},{(e3[1]+e2[1])/2+4:.1f} {e2[0]:.1f},{e2[1]-lift:.1f} L{r1[0]:.1f},{r1[1]:.1f} L{r0[0]:.1f},{r0[1]:.1f} Z" fill="#3b3f4a"/>')
    # 동쪽 지붕면 (합각)
    W(f'<path d="M{e2[0]:.1f},{e2[1]-lift:.1f} Q{(e2[0]+e1[0])/2:.1f},{(e2[1]+e1[1])/2+3:.1f} {e1[0]:.1f},{e1[1]-lift:.1f} L{r1[0]:.1f},{r1[1]:.1f} Z" fill="#2a2d36"/>')
    # 기와 골
    for t in (0.2, 0.4, 0.6, 0.8):
        x0 = e3[0]+(e2[0]-e3[0])*t; y0 = e3[1]+(e2[1]-e3[1])*t
        x1 = r0[0]+(r1[0]-r0[0])*t; y1 = r0[1]+(r1[1]-r0[1])*t
        W(f'<line x1="{x0:.1f}" y1="{y0+1:.1f}" x2="{x1:.1f}" y2="{y1:.1f}" stroke="#555b6a" stroke-width="1.2" opacity=".8"/>')
    W(f'<line x1="{r0[0]:.1f}" y1="{r0[1]:.1f}" x2="{r1[0]:.1f}" y2="{r1[1]:.1f}" stroke="#1c1e25" stroke-width="4" stroke-linecap="round"/>')
    W(f'<path d="M{e3[0]:.1f},{e3[1]-lift:.1f} Q{(e3[0]+e2[0])/2:.1f},{(e3[1]+e2[1])/2+4:.1f} {e2[0]:.1f},{e2[1]-lift:.1f}" fill="none" stroke="#8a93a6" stroke-width="1.6" opacity=".7"/>')
def tree(a, b, r=11, c='#4f8a3a'):
    x, y = G(a, b)
    W(f'<ellipse cx="{x:.1f}" cy="{y+2:.1f}" rx="{r:.1f}" ry="{r*0.45:.1f}" fill="#000" opacity=".22"/>')
    W(f'<rect x="{x-2:.1f}" y="{y-10:.1f}" width="4" height="10" fill="#6b4524"/>')
    W(f'<circle cx="{x:.1f}" cy="{y-r-6:.1f}" r="{r:.1f}" fill="{c}"/>')
    W(f'<circle cx="{x-r*0.35:.1f}" cy="{y-r-8-r*0.25:.1f}" r="{r*0.45:.1f}" fill="#8cc265" opacity=".7"/>')
def person(a, b, col, dark, s=1.0, hair='#2b1a0e'):
    x, y = G(a, b)
    W(f'<ellipse cx="{x:.1f}" cy="{y+1:.1f}" rx="{9*s:.1f}" ry="{4*s:.1f}" fill="#000" opacity=".3"/>')
    # 몸(도포) — 팀 색, 금빛 띠
    W(f'<path d="M{x-9*s:.1f},{y:.1f} Q{x-8*s:.1f},{y-20*s:.1f} {x:.1f},{y-24*s:.1f} Q{x+8*s:.1f},{y-20*s:.1f} {x+9*s:.1f},{y:.1f} Q{x:.1f},{y+3*s:.1f} {x-9*s:.1f},{y:.1f} Z" fill="{col}"/>')
    W(f'<path d="M{x+1*s:.1f},{y-23*s:.1f} Q{x+8*s:.1f},{y-19*s:.1f} {x+9*s:.1f},{y:.1f} Q{x+5*s:.1f},{y+2*s:.1f} {x+2*s:.1f},{y+2*s:.1f} Z" fill="{dark}" opacity=".55"/>')
    W(f'<path d="M{x-7*s:.1f},{y-11*s:.1f} Q{x:.1f},{y-8*s:.1f} {x+7*s:.1f},{y-11*s:.1f}" stroke="#ffd34e" stroke-width="{2.2*s:.1f}" fill="none"/>')
    # 머리
    W(f'<circle cx="{x:.1f}" cy="{y-31*s:.1f}" r="{8.5*s:.1f}" fill="#f6d6b4"/>')
    W(f'<path d="M{x-8.5*s:.1f},{y-32*s:.1f} Q{x:.1f},{y-45*s:.1f} {x+8.5*s:.1f},{y-32*s:.1f} Q{x+3*s:.1f},{y-36*s:.1f} {x-8.5*s:.1f},{y-32*s:.1f} Z" fill="{hair}"/>')
    W(f'<circle cx="{x-3*s:.1f}" cy="{y-30*s:.1f}" r="{1.2*s:.1f}" fill="#2b1a0e"/><circle cx="{x+3*s:.1f}" cy="{y-30*s:.1f}" r="{1.2*s:.1f}" fill="#2b1a0e"/>')
    W(f'<circle cx="{x-5*s:.1f}" cy="{y-27*s:.1f}" r="{1.6*s:.1f}" fill="#ff9a8a" opacity=".6"/><circle cx="{x+5*s:.1f}" cy="{y-27*s:.1f}" r="{1.6*s:.1f}" fill="#ff9a8a" opacity=".6"/>')

W('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">')
W('''<defs>
<linearGradient id="grass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9cc65a"/><stop offset=".6" stop-color="#6e9a3e"/><stop offset="1" stop-color="#4c7429"/></linearGradient>
<linearGradient id="soilL" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a5f36"/><stop offset=".25" stop-color="#6b4626"/><stop offset="1" stop-color="#2e1d10"/></linearGradient>
<linearGradient id="soilR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a4626"/><stop offset=".25" stop-color="#4e331b"/><stop offset="1" stop-color="#1e130a"/></linearGradient>
<linearGradient id="beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3c8" stop-opacity="0"/><stop offset=".5" stop-color="#ffe29a" stop-opacity=".55"/><stop offset="1" stop-color="#fffbea"/></linearGradient>
<linearGradient id="core" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".6" stop-color="#fff" stop-opacity=".8"/><stop offset="1" stop-color="#fff"/></linearGradient>
<radialGradient id="glow"><stop offset="0" stop-color="#fff0b8" stop-opacity=".95"/><stop offset=".5" stop-color="#ffd36a" stop-opacity=".45"/><stop offset="1" stop-color="#ffcf6b" stop-opacity="0"/></radialGradient>
<radialGradient id="halo"><stop offset="0" stop-color="#ffd98a" stop-opacity=".42"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient>
<linearGradient id="path" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#d9c49a"/><stop offset="1" stop-color="#efdcb2"/></linearGradient>
</defs>''')
# 뒤쪽 빛무리

# 땅 두께: 아래로 둥글게 처진 흙덩이 (가운데 세로선에서 밝은 왼쪽·어두운 오른쪽으로 나눈다)
BOT = S[1] + D + 34
W(f'<path d="M{Wst[0]},{Wst[1]} L{S[0]},{S[1]} L{S[0]},{BOT} C{S[0]-50},{BOT} {Wst[0]+10},{Wst[1]+D+22} {Wst[0]+4},{Wst[1]+D} Z" fill="url(#soilL)"/>')
W(f'<path d="M{S[0]},{S[1]} L{E[0]},{E[1]} L{E[0]-4},{E[1]+D} C{E[0]-10},{E[1]+D+22} {S[0]+50},{BOT} {S[0]},{BOT} Z" fill="url(#soilR)"/>')
# 흙 속 돌멩이
for (x, y, r, c) in ((-70, 14, 4, '#8a6a48'), (-36, 32, 3.5, '#7a5a3a'), (34, 26, 4, '#5a4028'), (72, 10, 3.5, '#5a4028')):
    W(f'<ellipse cx="{S[0]+x}" cy="{S[1]+y}" rx="{r*1.4}" ry="{r}" fill="{c}"/>')
# 아래로 매달린 바위 덩이
for (ox, w, h) in ((-22, 12, 16), (0, 16, 26), (20, 10, 14)):
    x0, y0 = S[0]+ox, BOT - 10 + abs(ox) * -0.2
    W(f'<path d="M{x0-w},{y0} L{x0},{y0+h} L{x0+w},{y0} Z" fill="#3a2614"/>')
    W(f'<path d="M{x0},{y0} L{x0},{y0+h} L{x0+w},{y0} Z" fill="#24170b"/>')
# 풀 가장자리 (앞쪽 두 변에 풀이 늘어진 띠)
W(f'<path d="M{Wst[0]},{Wst[1]} L{S[0]},{S[1]} L{S[0]},{S[1]+6} L{Wst[0]},{Wst[1]+6} Z" fill="#5d8a33"/>')
W(f'<path d="M{S[0]},{S[1]} L{E[0]},{E[1]} L{E[0]},{E[1]+6} L{S[0]},{S[1]+6} Z" fill="#46702a"/>')
# 땅 윗면
W(f'<polygon points="{pts(N,E,S,Wst)}" fill="url(#grass)"/>')
# 돌담길 (서쪽 앞 → 빛기둥)
pa = [G(14,112), G(44,104), G(66,100), G(84,80), G(100,62)]
d = f'M{pa[0][0]:.1f},{pa[0][1]:.1f} C{pa[1][0]:.1f},{pa[1][1]:.1f} {pa[2][0]:.1f},{pa[2][1]:.1f} {pa[3][0]:.1f},{pa[3][1]:.1f} S{pa[4][0]+4:.1f},{pa[4][1]+6:.1f} {pa[4][0]:.1f},{pa[4][1]:.1f}'
W(f'<path d="{d}" fill="none" stroke="#c8b285" stroke-width="18" stroke-linecap="round" opacity=".9"/>')
W(f'<path d="{d}" fill="none" stroke="url(#path)" stroke-width="13" stroke-linecap="round"/>')
W(f'<path d="{d}" fill="none" stroke="#fff3c8" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="1 9" opacity=".9"/>')
# 한옥들·나무 (뒤에서 앞으로 그린다)
hanok(14, 8, 34, 20, 15)
hanok(64, 6, 28, 18, 13, 0.85)
tree(108, 18, 10, '#5c9a40')
tree(6, 40, 9)
hanok(28, 46, 30, 18, 13, 0.9)
# 미션 빛기둥 + 반경 고리
bx, by = G(100, 62)
W(f'<ellipse cx="{bx:.1f}" cy="{by:.1f}" rx="44" ry="22" fill="url(#glow)"/>')
W(f'<ellipse cx="{bx:.1f}" cy="{by:.1f}" rx="30" ry="15" fill="none" stroke="#ffd34e" stroke-width="3.5"><animate attributeName="rx" values="22;38" dur="2.4s" repeatCount="indefinite"/><animate attributeName="ry" values="11;19" dur="2.4s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0" dur="2.4s" repeatCount="indefinite"/></ellipse>')
W(f'<ellipse cx="{bx:.1f}" cy="{by:.1f}" rx="26" ry="13" fill="none" stroke="#ffe9a8" stroke-width="2.5"/>')
W(f'<rect x="{bx-11:.1f}" y="4" width="22" height="{by-4:.1f}" rx="11" fill="url(#beam)"><animate attributeName="opacity" values=".85;1;.85" dur="2s" repeatCount="indefinite"/></rect>')
W(f'<rect x="{bx-3.5:.1f}" y="30" width="7" height="{by-30:.1f}" rx="3.5" fill="url(#core)"/>')
W(f'<circle cx="{bx:.1f}" cy="{by:.1f}" r="6" fill="#fffdf2"/>')
# 반짝이 입자
for i,(dx,dy,r) in enumerate([(-18,-60,2.2),(14,-96,1.8),(-8,-140,1.6),(20,-40,1.4),(-22,-110,1.3)]):
    W(f'<circle cx="{bx+dx:.1f}" cy="{by+dy:.1f}" r="{r}" fill="#fff6d0"><animate attributeName="cy" values="{by+dy:.1f};{by+dy-30:.1f}" dur="{2.2+i*0.4:.1f}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;0" dur="{2.2+i*0.4:.1f}s" repeatCount="indefinite"/></circle>')
# 세 팀 미니미 (길을 따라 빛기둥으로)
person(34, 108, '#3d7be0', '#1f4a9a')
person(56, 102, '#e0503d', '#9a2a1c', hair='#4a2a14')
person(76, 88, '#3fae5a', '#1f6a32')
tree(124, 112, 11)
tree(124, 44, 8, '#5c9a40')
# 깃발 (출발점)
fx, fy = G(10, 118)
W(f'<line x1="{fx:.1f}" y1="{fy:.1f}" x2="{fx:.1f}" y2="{fy-34:.1f}" stroke="#6b4524" stroke-width="2.5"/>')
W(f'<path d="M{fx:.1f},{fy-34:.1f} L{fx+18:.1f},{fy-28:.1f} L{fx:.1f},{fy-21:.1f} Z" fill="#ffd34e"/>')
W('</svg>')
open(sys.argv[1], 'w').write('\n'.join(out))
