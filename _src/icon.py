# 앱 아이콘: 시작 화면 그림(assets/hero.svg)을 어두운 금빛 바탕에 얹는다. 만들기: python3 _src/icon.py (그다음 PNG는 _src/icon-png.cjs)
import re, sys
hero = open('assets/hero.svg').read()
inner = re.search(r'<svg[^>]*>(.*)</svg>', hero, re.S).group(1)
def icon(size, x, y, bg=True):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<defs><radialGradient id="ibg" cx="50%" cy="42%" r="70%"><stop offset="0" stop-color="#5a3f1c"/><stop offset=".55" stop-color="#241a10"/><stop offset="1" stop-color="#0e0b08"/></radialGradient>
<radialGradient id="ihalo" cx="56%" cy="30%" r="40%"><stop offset="0" stop-color="#ffd98a" stop-opacity=".45"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient></defs>
<rect width="512" height="512" fill="url(#ibg)"/><rect width="512" height="512" fill="url(#ihalo)"/>
<g fill="#fff3c8"><circle cx="96" cy="110" r="3" opacity=".8"/><circle cx="420" cy="86" r="2.4" opacity=".7"/><circle cx="440" cy="300" r="2" opacity=".5"/><circle cx="70" cy="330" r="2" opacity=".5"/></g>
<svg x="{x}" y="{y}" width="{size}" height="{size}" viewBox="0 0 400 400">{inner}</svg>
</svg>'''
open('assets/icon.svg', 'w').write(icon(560, -24, -8))
open('_src/icon-maskable.svg', 'w').write(icon(470, 21, 30))  # 둥글게 잘려도 안전 구역(가운데 80%) 안에
