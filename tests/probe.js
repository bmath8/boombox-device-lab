// Runs inside the page. Same checks as the Playwright sweep, so results line up across engines.
module.exports = function probe() {
  const vw = window.innerWidth;
  const se = document.scrollingElement;
  const overflowX = se.scrollWidth - vw;
  const wide = [];
  if (overflowX > 1) for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width && r.right > vw + 1 && getComputedStyle(el).position !== 'fixed') {
      wide.push(el.tagName.toLowerCase() + '.' + String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className).split(' ').slice(0, 2).join('.') + ' r=' + Math.round(r.right));
      if (wide.length > 4) break;
    }
  }
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05; };
  const smallFont = [...document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=hidden]):not([type=file]),textarea,select')]
    .filter(vis).filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16).map((el) => el.tagName.toLowerCase() + '[' + (el.name || el.getAttribute('aria-label') || el.type) + '] ' + getComputedStyle(el).fontSize);
  const fixedTop = [...document.querySelectorAll('header,nav,[class*=sticky],[class*=fixed]')].filter(vis).map((el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return { tag: el.tagName.toLowerCase(), pos: s.position, top: Math.round(r.top), bottom: Math.round(r.bottom), pt: s.paddingTop, pb: s.paddingBottom }; }).filter((x) => x.pos === 'fixed' || x.pos === 'sticky').slice(0, 4);
  const brokenImg = [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.src).map((i) => i.src.slice(-60));
  return { url: location.pathname, title: document.title, h1: (document.querySelector('h1') || {}).textContent || null, vw, vh: innerHeight, dpr: devicePixelRatio,
    overflowX, wide, smallFont, brokenImg, fixedTop,
    standalone: navigator.standalone === true || matchMedia('(display-mode: standalone)').matches,
    safeTop: getComputedStyle(document.documentElement).getPropertyValue('--sat') || null, ua: navigator.userAgent };
};
