/* qyx-wishbubble.js — 漂浮「心願樹小木牌」(全站共用,可拖曳)
   為什麼這樣做:頁面角落放一個小木牌氣泡(寫「心願樹」),點一下直接帶到心願樹頁(27_wishtree);
   做法仿 qyx-seedbox.js(漂浮種子櫃):可拖曳、位置記在 localStorage、移動超過 4px 算拖曳否則算點擊。
   外觀用裁好的木牌圖(wish/tag_rounded.webp)＋疊一個「心願樹」字。
   掛法:在 supabase-init.js 後面加一行 <script src="qyx-wishbubble.js">。
   池別(client/suncar)用頁面檔名判:12_staff* = 順咖綠,其餘 = 案家金,只影響連結帶的 ?as=。 */
(function () {
  if (window.__qyxWishbubble) return;
  window.__qyxWishbubble = true;

  var POOL = /12_staff|staff_home/.test(location.pathname) ? 'suncar' : 'client';
  var LSKEY = 'qyx_wishbubble_pos';
  var IMG = 'wish/tag_rounded.webp';   /* 木牌圖,跟心願樹卡片同一套 */

  injectStyle();
  var box = buildBox();

  function injectStyle() {
    var css = ''
      + '.qyx-wishbubble{position:fixed;z-index:60;width:76px;user-select:none;-webkit-user-select:none;'
      + 'touch-action:none;cursor:grab;filter:drop-shadow(0 6px 12px rgba(0,0,0,0.22));'
      + 'animation:qwbBob 3.8s ease-in-out infinite;transition:transform .18s;}'
      + '.qyx-wishbubble:hover{transform:scale(1.07);}'
      + '.qyx-wishbubble.qwb-drag{cursor:grabbing;animation:none;}'
      + '@keyframes qwbBob{0%,100%{transform:translateY(0);}50%{transform:translateY(-4px);}}'
      + '.qyx-wishbubble img{width:100%;height:auto;display:block;pointer-events:none;}'
      + '.qwb-label{position:absolute;left:0;right:0;top:55%;text-align:center;pointer-events:none;'
      + 'font-family:"LXGW WenKai TC","Noto Sans TC",sans-serif;font-weight:700;font-size:14px;'
      + 'color:#6B4A22;text-shadow:0 1px 2px rgba(255,250,235,0.9);letter-spacing:1px;}';
    var st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);
  }

  function buildBox() {
    var el = document.createElement('div');
    el.className = 'qyx-wishbubble';
    el.title = '心願樹(可拖曳·點一下去許願)';
    el.innerHTML =
      '<img src="' + IMG + '" alt="心願樹" loading="lazy" decoding="async">'
      + '<span class="qwb-label">心願樹</span>';
    return el;
  }

  /* ---- 位置(可拖曳 + 記憶) ---- */
  function clampPos(left, top) {
    var w = box.offsetWidth || 76, h = box.offsetHeight || 96;
    left = Math.max(6, Math.min(left, window.innerWidth - w - 6));
    top = Math.max(6, Math.min(top, window.innerHeight - h - 6));
    return { left: left, top: top };
  }
  function setPos(left, top) {
    var p = clampPos(left, top);
    box.style.left = p.left + 'px';
    box.style.top = p.top + 'px';
    box.style.right = 'auto';
    box.style.bottom = 'auto';
  }
  function loadPos() {
    try { var v = JSON.parse(localStorage.getItem(LSKEY)); if (v && typeof v.left === 'number') return v; } catch (e) {}
    return null;
  }
  function savePos() {
    try { localStorage.setItem(LSKEY, JSON.stringify({ left: box.offsetLeft, top: box.offsetTop })); } catch (e) {}
  }
  /* 預設位置:貼在內容卡片(.wrap)右側、比種子櫃低一些(0.58 高),避免兩個浮標疊在一起 */
  function defaultLeft() {
    var wrap = document.querySelector('.wrap');
    var rightEdge = wrap ? wrap.getBoundingClientRect().right
                         : Math.min(window.innerWidth - 16, (window.innerWidth + 720) / 2);
    return rightEdge + 6;
  }
  function initPos() {
    var saved = loadPos();
    if (saved) { setPos(saved.left, saved.top); return; }
    setPos(defaultLeft(), Math.round(window.innerHeight * 0.58));
  }

  /* ---- 拖曳 vs 點擊:移動超過 4px 算拖曳,否則算點擊→去心願樹頁 ---- */
  function bindDrag() {
    var start = null, moved = false;
    box.addEventListener('pointerdown', function (e) {
      start = { x: e.clientX, y: e.clientY, bx: box.offsetLeft, by: box.offsetTop };
      moved = false;
      box.classList.add('qwb-drag');
      try { box.setPointerCapture(e.pointerId); } catch (_) {}
    });
    box.addEventListener('pointermove', function (e) {
      if (!start) return;
      var dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
      if (moved) setPos(start.bx + dx, start.by + dy);
    });
    box.addEventListener('pointerup', function (e) {
      if (!start) return;
      var wasMoved = moved;
      start = null;
      box.classList.remove('qwb-drag');
      try { box.releasePointerCapture(e.pointerId); } catch (_) {}
      if (wasMoved) savePos();
      else location.href = '27_wishtree.html?as=' + POOL;   /* 點一下→去心願樹頁 */
    });
    window.addEventListener('resize', function () {
      if (loadPos()) setPos(box.offsetLeft, box.offsetTop);
      else setPos(defaultLeft(), Math.round(window.innerHeight * 0.58));
    });
  }

  function mount() {
    document.body.appendChild(box);
    initPos();
    bindDrag();
  }
  if (document.readyState !== 'loading') mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
