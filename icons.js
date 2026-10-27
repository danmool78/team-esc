/* 귀여운 아이콘: 이모티콘 대신 쓰는 알록달록한 SVG (24×24, 진한 밤색 테두리 + 밝은 색 + 작은 하이라이트).
   ic(이름) → 글자 사이에 넣는 <svg> 문자열. iconImage(이름) → 3D 이름표 캔버스에 그릴 그림 */
const O = '#3b2a1a'; // 테두리
const s = (body, vb = '0 0 24 24') => `<svg class="ico" viewBox="${vb}" aria-hidden="true" fill="none" stroke="${O}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const shine = (x, y, r = 1.3) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="none" opacity=".85"/>`;

const ICONS = {
  // 도착: 분홍 핀
  pin: `<path d="M12 22s-7-7.2-7-12.2A7 7 0 0 1 19 9.8C19 14.8 12 22 12 22z" fill="#ff6b9a"/><circle cx="12" cy="9.6" r="2.8" fill="#fff4f7"/>${shine(8.6, 7)}`,
  // 퀴즈: 노란 말풍선에 물음표
  quiz: `<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4h0A2.5 2.5 0 0 1 4 13.5z" fill="#ffd34e"/><path d="M10 7.7a2.1 2.1 0 1 1 3 1.9c-.7.4-1 .9-1 1.6" stroke-width="1.8"/><circle cx="12" cy="13.3" r=".6" fill="${O}"/>${shine(6.8, 5.6, 1)}`,
  // 사진: 하늘색 사진기
  camera: `<path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h2l1.4-2h6.2l1.4 2h2A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z" fill="#5ec8f2"/><circle cx="12" cy="13" r="4" fill="#ffe27a"/><circle cx="12" cy="13" r="1.8" fill="#3b6fd6"/><circle cx="17.6" cy="9" r=".8" fill="#ff6b9a" stroke="none"/>${shine(11, 12, .8)}`,
  // 현장 미션: 민트 깃발
  flag: `<path d="M6 21V3.5" stroke="#f3d79a" stroke-width="2.2"/><path d="M6 4h11.5l-2.6 3.8 2.6 3.7H6z" fill="#3fd6a8"/><circle cx="10.5" cy="7.7" r="1.3" fill="#fff59a"/><circle cx="6" cy="21" r="1.4" fill="#c58b4e"/>`,
  // 해냈음: 초록 동그라미에 체크
  check: `<circle cx="12" cy="12" r="9" fill="#5fd38a"/><path d="M7.8 12.3l2.8 2.8 5.6-5.8" stroke="#fff" stroke-width="2.4"/>${shine(8, 7.4, 1.1)}`,
  // 확인 기다림: 보라 모래시계
  wait: `<path d="M7 3h10M7 21h10" stroke="#e2d0ff" stroke-width="2.2"/><path d="M8 3.5c0 4 4 5.5 4 8.5s-4 4.5-4 8.5h8c0-4-4-5.5-4-8.5s4-4.5 4-8.5z" fill="#c9a8ff"/><path d="M9.6 19.6c.6-1.8 2.4-2.7 2.4-2.7s1.8.9 2.4 2.7z" fill="#ffd34e" stroke="none"/><path d="M10 7h4l-2 2.3z" fill="#ffd34e" stroke="none"/>`,
  // 축하: 폭죽
  party: `<path d="M3.5 20.5l4.2-11.8 7.6 7.6z" fill="#ffa24c"/><path d="M5.6 14.6l3.8 3.8" /><path d="M13 4.5c.4 1.6-.4 2.8-1.8 3.3M19.5 11c-1.6-.4-2.8.4-3.3 1.8" stroke="#ff5f8f"/><circle cx="16.5" cy="5" r="1.2" fill="#4cc3f0"/><circle cx="20" cy="8" r="1" fill="#ffd34e"/><circle cx="11" cy="3" r=".9" fill="#5fd38a"/><path d="M17.5 15.5l1.8.6M14.8 2.6l.4 1.8" stroke="#9b6bff"/>`,
  // 시작: 초록 재생
  play: `<circle cx="12" cy="12" r="9" fill="#5fd38a"/><path d="M10 8.2l6 3.8-6 3.8z" fill="#fff"/>`,
  // 끝내기: 빨간 멈춤
  stop: `<circle cx="12" cy="12" r="9" fill="#ff6b6b"/><rect x="8.6" y="8.6" width="6.8" height="6.8" rx="1.4" fill="#fff"/>`,
  // 알림: 주황 확성기
  megaphone: `<path d="M4 10v4a1.5 1.5 0 0 0 1.5 1.5H7l9 4.5V4L7 8.5H5.5A1.5 1.5 0 0 0 4 10z" fill="#ffa24c"/><path d="M7.5 15.6l1 4.4h2.4l-.8-3.6" fill="#ffd34e"/><path d="M19 9.5c.9.7.9 4.3 0 5M21 7.5c1.8 1.6 1.8 7.4 0 9" stroke="#ff5f8f"/>`,
  // 진행자: 노란 왕관
  crown: `<path d="M3.5 8l4 3.5L12 5l4.5 6.5 4-3.5-1.8 10.5H5.3z" fill="#ffd34e"/><path d="M5.3 18.5h13.4" stroke-width="2"/><circle cx="12" cy="13.6" r="1.4" fill="#ff6b9a"/><circle cx="8" cy="14.4" r=".9" fill="#4cc3f0"/><circle cx="16" cy="14.4" r=".9" fill="#5fd38a"/>`,
  // 다시 뽑기: 주사위
  dice: `<rect x="3.5" y="3.5" width="17" height="17" rx="4.5" fill="#fff4e0"/><circle cx="8.3" cy="8.3" r="1.5" fill="#ff6b9a" stroke="none"/><circle cx="15.7" cy="8.3" r="1.5" fill="#4cc3f0" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="#ffa24c" stroke="none"/><circle cx="8.3" cy="15.7" r="1.5" fill="#5fd38a" stroke="none"/><circle cx="15.7" cy="15.7" r="1.5" fill="#9b6bff" stroke="none"/>`,
  // 내 위치
  locate: `<circle cx="12" cy="12" r="7" fill="#bfe9ff"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" stroke="#8fd8ff" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="#3b8bff"/>${shine(10.9, 10.9, .9)}`,
  // 전체 보기
  expand: `<rect x="4" y="4" width="16" height="16" rx="4" fill="#c4f2dc"/><path d="M9.5 5.5H5.5v4M14.5 18.5h4v-4M5.5 5.5l5 5M18.5 18.5l-5-5" stroke-width="1.9"/>`,
  // 위성/지도, 지역 바꾸기
  map: `<path d="M3 6.5l5.5-2.5 7 2.5 5.5-2.5v13.5L15.5 20l-7-2.5L3 20z" fill="#9be38a"/><path d="M8.5 4v13.5M15.5 6.5V20"/><path d="M8.5 4l7 2.5V20l-7-2.5z" fill="#6fcaf0"/><circle cx="18.2" cy="10" r="1.3" fill="#ff6b9a"/>`,
  // 주머니 모드: 달과 별
  building: `<path d="M3.5 20.5V10l5-3v13.5z" fill="#ffd98a"/><path d="M8.5 20.5V5l7-2.5v18z" fill="#8fd8ff"/><path d="M15.5 20.5v-10l5 2v8z" fill="#ffb3c8"/><path d="M11 8h2M11 11h2M11 14h2M5.5 13h1M5.5 16h1M17.5 15h1M2.5 20.5h19" stroke-width="1.6"/>`,
  // 위치 전송: 가운데 내 점과 양옆 전파 두 겹. 색과 깜빡임은 style.css(.sig)가 정한다
  signal: `<circle class="sg-c" cx="12" cy="12" r="3" stroke="none"/><path class="sg-1" d="M8.2 8.2a5.4 5.4 0 0 0 0 7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6" stroke-width="2.2"/><path class="sg-2" d="M5.1 5.1a9.8 9.8 0 0 0 0 13.8M18.9 5.1a9.8 9.8 0 0 1 0 13.8" stroke-width="2.2"/>`,
  // 로그인 카드: 빛기둥이 선 미션 자리 문장(紋章), 입력칸 아이콘, 구글 로고
  emblem: `<ellipse cx="12" cy="18.5" rx="9.5" ry="2.6" stroke="#f0c76a" stroke-width=".9"/><ellipse cx="12" cy="18.2" rx="6" ry="1.6" stroke="#ffd98a" stroke-width=".9"/><path d="M7 18a5 5 0 0 1 10 0" stroke="#f0c76a" stroke-width="1.1"/><path d="M12 2.5l.9 14h-1.8z" fill="#ffe7a6" stroke="none"/><path d="M5 7l.4.9.9.4-.9.4L5 9.6l-.4-.9-.9-.4.9-.4zM19 5.5l.4.9.9.4-.9.4-.4.9-.4-.9-.9-.4.9-.4z" fill="#ffe7a6" stroke="none"/>`,
  mail: `<rect x="3.5" y="5.5" width="17" height="13" rx="2.5" stroke="#c9cfe0"/><path d="M4 7l8 6 8-6" stroke="#c9cfe0"/>`,
  lock: `<rect x="5" y="10.5" width="14" height="10" rx="2.5" stroke="#c9cfe0"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14.5v2" stroke="#c9cfe0"/>`,
  eye: `<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" stroke="#c9cfe0"/><circle cx="12" cy="12" r="3" fill="#c9cfe0" stroke="none"/>`,
  google: `<path d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z" fill="#4285F4" stroke="none"/><path d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" fill="#34A853" stroke="none"/><path d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2z" fill="#FBBC05" stroke="none"/><path d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10C7.2 7.7 9.4 6 12 6z" fill="#EA4335" stroke="none"/>`,
  mic: `<rect x="8.5" y="2.5" width="7" height="12" rx="3.5" fill="#ff8fb3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5v3.5M8.5 21h7"/><path d="M10.5 6.5h3M10.5 9h3" stroke="#fff" stroke-width="1.3"/>${shine(10.6, 5, .9)}`,
  moon: `<path d="M15.5 3.5a8.5 8.5 0 1 0 5 13.5A7 7 0 0 1 15.5 3.5z" fill="#ffd34e"/><path d="M19 3l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" fill="#fff59a" stroke="none"/><circle cx="9" cy="12.5" r="1" fill="#f0b43a" stroke="none"/><circle cx="12.5" cy="16.5" r=".8" fill="#f0b43a" stroke="none"/>`,
  // 테스트: 분홍 물약 시험관
  flask: `<path d="M9.5 3h5M10.5 3v5.5L5.2 18A2 2 0 0 0 7 21h10a2 2 0 0 0 1.8-3l-5.3-9.5V3" fill="#eaf7ff"/><path d="M7.8 14.5h8.4l2.6 4A1.6 1.6 0 0 1 17.4 21H6.6a1.6 1.6 0 0 1-1.4-2.5z" fill="#ff7fb0"/><circle cx="10.5" cy="17.5" r="1" fill="#fff" stroke="none"/><circle cx="13.6" cy="16" r=".7" fill="#fff" stroke="none"/>`,
  // 찾기: 돋보기
  search: `<circle cx="10.5" cy="10.5" r="6" fill="#bfe9ff"/><path d="M15 15l5 5" stroke="#ffa24c" stroke-width="3"/>${shine(8.6, 8.4, 1.2)}`,
  // 끝나는 시간: 자명종
  clock: `<path d="M5 4.5L3 6.5M19 4.5l2 2" stroke="#ff6b6b" stroke-width="2.2"/><circle cx="12" cy="13" r="7.5" fill="#fff4e0"/><path d="M12 9v4.2l2.8 1.8" stroke="#3b6fd6" stroke-width="2"/><path d="M7 19.5l-1.2 1.6M17 19.5l1.2 1.6"/><circle cx="12" cy="13" r=".9" fill="${O}" stroke="none"/>`,
  // 내 위치 (따라가지 않을 때): 회색 빈 과녁
  locateOff: `<circle cx="12" cy="12" r="7" fill="#4a4038" stroke="#bfb3a3" stroke-width="1.8"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" stroke="#bfb3a3" stroke-width="2"/><circle cx="12" cy="12" r="2.2" fill="none" stroke="#bfb3a3" stroke-width="1.6"/>`,
  // 진행 방향 고정: 파란 동그라미에 흰 화살촉
  nav: `<circle cx="12" cy="12" r="9" fill="#3b8bff"/><path d="M12 6.2l4.2 10.4L12 14.3l-4.2 2.3z" fill="#fff" stroke="#fff" stroke-width="1.2"/>${shine(8, 7.8, 1)}`,
  // 술래잡기: 빨간 동그라미에 잡으려는 손
  tag: `<circle cx="12" cy="12" r="9.5" fill="#ff6b6b"/><path d="M8.2 15.6V10a1 1 0 0 1 2 0v3.2V7.6a1 1 0 0 1 2 0v5.4V7a1 1 0 0 1 2 0v6V8.6a1 1 0 0 1 2 0v6.2a4.4 4.4 0 0 1-4.4 4.4h-.6a4 4 0 0 1-3.3-1.8l-2-3a1 1 0 0 1 1.6-1.2z" fill="#fff" stroke="#3b2a1a" stroke-width="1.1"/>`,
  // 더하기: 민트 동그라미에 흰 십자
  plus: `<circle cx="12" cy="12" r="9" fill="#3fd6a8"/><path d="M12 7.5v9M7.5 12h9" stroke="#fff" stroke-width="2.6"/>${shine(8.2, 7.8, 1.1)}`,
  // 팀: 세 팀 색 머리와 어깨
  team: `<path d="M2.8 20a4.2 4.2 0 0 1 8.4 0z" fill="#ff6b6b"/><circle cx="7" cy="12.3" r="2.6" fill="#ff6b6b"/><path d="M12.8 20a4.2 4.2 0 0 1 8.4 0z" fill="#5fd38a"/><circle cx="17" cy="12.3" r="2.6" fill="#5fd38a"/><path d="M7.4 17.6a4.6 4.6 0 0 1 9.2 0z" fill="#4c9bff"/><circle cx="12" cy="8.6" r="3" fill="#4c9bff"/>${shine(11, 7.6, .8)}`,
  // 단체 버스
  bus: `<rect x="3" y="5" width="18" height="12" rx="3" fill="#ffc93c"/><path d="M3 12h18" stroke="#ff6b6b" stroke-width="2"/><rect x="5.5" y="7.2" width="4" height="3" rx=".8" fill="#bfe9ff"/><rect x="10.5" y="7.2" width="4" height="3" rx=".8" fill="#bfe9ff"/><rect x="15.5" y="7.2" width="3.5" height="3" rx=".8" fill="#bfe9ff"/><circle cx="7.5" cy="18" r="2" fill="#5a4a40"/><circle cx="16.5" cy="18" r="2" fill="#5a4a40"/>`,
  // 결과: 금빛 트로피
  trophy: `<path d="M7 4h10v5a5 5 0 0 1-10 0z" fill="#ffd34e"/><path d="M7 6H4.5a2.5 2.5 0 0 0 2.8 3.6M17 6h2.5a2.5 2.5 0 0 1-2.8 3.6" stroke="#ffb020" stroke-width="1.8"/><path d="M10.5 14h3v3h-3z" fill="#ffb020"/><rect x="7.5" y="17" width="9" height="3.5" rx="1" fill="#c58b4e"/>${shine(9.6, 6.6, 1.1)}`,
  // 등수: 금·은·동 메달
  medal1: `<path d="M8 2.5l2.5 6h3L16 2.5z" fill="#4cc3f0"/><circle cx="12" cy="14.5" r="6.5" fill="#ffd34e"/><path d="M12 11.3v6.4M10.7 12.4l1.3-1.1" stroke="#b07a10" stroke-width="1.8"/>${shine(9.6, 12.2, 1.1)}`,
  medal2: `<path d="M8 2.5l2.5 6h3L16 2.5z" fill="#ff6b9a"/><circle cx="12" cy="14.5" r="6.5" fill="#dfe6ee"/><path d="M10 12.6a2 2 0 1 1 3.4 1.5L10 17.6h4" stroke="#6b7785" stroke-width="1.6"/>${shine(9.6, 12.2, 1.1)}`,
  medal3: `<path d="M8 2.5l2.5 6h3L16 2.5z" fill="#5fd38a"/><circle cx="12" cy="14.5" r="6.5" fill="#e8a46a"/><path d="M10.2 12h3.4l-1.8 2a1.9 1.9 0 1 1-1.8 2.6" stroke="#8a4f22" stroke-width="1.6"/>${shine(9.6, 12.2, 1.1)}`,
  book: `<path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5V6.5z" fill="#6fa8ff"/><path d="M12 6.5c2-1.5 5-2 8.5-1.5v13c-3.5-.5-6.5 0-8.5 1.5V6.5z" fill="#ffd36a"/><path d="M14.5 9.5c1.5-.6 3-.8 4-.7M14.5 12.5c1.5-.6 3-.8 4-.7" stroke-width="1.2"/>`,
  down: `<path d="M6.5 9.5L12 15l5.5-5.5" stroke="currentColor" stroke-width="2.4"/>`,
  up: `<path d="M6.5 14.5L12 9l5.5 5.5" stroke="currentColor" stroke-width="2.4"/>`,
};

export const ic = name => s(ICONS[name] || ICONS.pin);
// 3D 이름표용 그림 (data URL이라 금방 뜨지만 그래도 비동기 — 다 뜨면 world.js가 이름표를 다시 그린다)
const imgs = {};
export function iconImage(name) {
  if (!imgs[name]) {
    const img = new Image(64, 64);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(ic(name).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" '));
    imgs[name] = img;
  }
  return imgs[name];
}
// 입력칸 배경 등 CSS에 넣을 data URL
export const iconURL = name => `url("${iconImage(name).src}")`;
