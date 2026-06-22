/* qyx-seedbox.js — 漂浮「種子櫃」(全站共用,可拖曳)
   為什麼這樣做:頁面角落放一個小小的種子收集櫃插圖,點一下直接帶到「抽種子」頁(19_seeds);
   外觀改用林慧怡畫的櫃子圖(案家木色 seedbox_client / 順咖綠色 seedbox_suncar 各一張),
   不再用程式畫的小抽屜泡泡(舊的 head/drawer/sprout 已整段刪掉重寫)。
   櫃子可用滑鼠/手指拖著移動,位置記在瀏覽器(localStorage)下次同位置。
   掛法:在 supabase-init.js 後面加一行 <script src="qyx-seedbox.js">。
   池別(client/suncar)用頁面檔名判:12_staff* = 順咖,其餘 = 案家。 */
(function () {
  if (window.__qyxSeedbox) return;
  window.__qyxSeedbox = true;

  var POOL = /12_staff|staff_home/.test(location.pathname) ? 'suncar' : 'client';
  var LSKEY = 'qyx_seedbox_pos';
  /* 圖檔放 GitHub /seeds/,相對路徑從任何根目錄頁面都指得到(跟 19 頁種子圖同一套) */
  var IMG = (POOL === 'suncar') ? 'seeds/seedbox_suncar.webp' : 'seeds/seedbox_client.webp';
  /* 右上角「已收集幾種」徽章底色,跟著池別走(綠=順咖 / 金=案家) */
  var BADGE = (POOL === 'suncar')
    ? 'linear-gradient(135deg,#5FB58E,#2F6048)'
    : 'linear-gradient(135deg,#FFB84D,#EF9F27)';

  injectStyle();
  var box = buildBox();

  /* ---- 樣式:櫃子圖本體＋浮動微動畫＋右上角數量徽章 ---- */
  function injectStyle() {
    var css = ''
      + '.qyx-seedbox{position:fixed;z-index:60;width:84px;user-select:none;-webkit-user-select:none;'
      + 'touch-action:none;cursor:grab;filter:drop-shadow(0 6px 12px rgba(0,0,0,0.22));'
      + 'animation:qsbBob 3.6s ease-in-out infinite;transition:transform .18s;}'
      + '.qyx-seedbox:hover{transform:scale(1.06);}'
      + '.qyx-seedbox.qsb-drag{cursor:grabbing;animation:none;}'
      + '@keyframes qsbBob{0%,100%{transform:translateY(0);}50%{transform:translateY(-4px);}}'
      + '.qyx-seedbox img{width:100%;height:auto;display:block;pointer-events:none;}'
      + '.qsb-badge{position:absolute;top:-6px;right:-6px;min-width:20px;height:20px;padding:0 5px;'
      + 'border-radius:99px;color:#fff;font-size:11px;font-weight:700;display:none;'
      + 'align-items:center;justify-content:center;background:' + BADGE + ';'
      + 'box-shadow:0 2px 6px rgba(0,0,0,0.25);border:1.5px solid #fff;}';
    var st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);
  }

  /* ---- 建立櫃子(一張圖＋一個數量徽章) ---- */
  function buildBox() {
    var el = document.createElement('div');
    el.className = 'qyx-seedbox';
    el.title = '我的種子櫃(可拖曳·點一下去抽種子)';
    el.innerHTML =
      '<img src="' + IMG + '" alt="種子收集櫃" loading="lazy" decoding="async">'
      + '<span class="qsb-badge"></span>';
    return el;
  }

  /* ---- 位置(可拖曳 + 記憶) ---- */
  function clampPos(left, top) {
    var w = box.offsetWidth || 84, h = box.offsetHeight || 84;
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
  /* 預設位置:貼在內容卡片(.wrap,寬 720 置中)右側,不浮在螢幕最右邊空白處。
     她已自己拖過位置(localStorage 有值)就尊重她的,只在第一次/無痕視窗用這個預設。 */
  function defaultLeft() {
    var wrap = document.querySelector('.wrap');
    var rightEdge = wrap ? wrap.getBoundingClientRect().right
                         : Math.min(window.innerWidth - 16, (window.innerWidth + 720) / 2);
    return rightEdge + 6;
  }
  function initPos() {
    var saved = loadPos();
    if (saved) { setPos(saved.left, saved.top); return; }
    setPos(defaultLeft(), Math.round(window.innerHeight * 0.40));
  }

  /* ---- 拖曳 vs 點擊:移動超過 4px 算拖曳,否則算點擊→去 19 打賞頁 ---- */
  function bindDrag() {
    var start = null, moved = false;
    box.addEventListener('pointerdown', function (e) {
      start = { x: e.clientX, y: e.clientY, bx: box.offsetLeft, by: box.offsetTop };
      moved = false;
      box.classList.add('qsb-drag');
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
      box.classList.remove('qsb-drag');
      try { box.releasePointerCapture(e.pointerId); } catch (_) {}
      if (wasMoved) savePos();
      else location.href = '19_seeds.html?as=' + POOL;   /* 點一下→去抽種子打賞頁 */
    });
    window.addEventListener('resize', function () {
      if (loadPos()) setPos(box.offsetLeft, box.offsetTop);
      else setPos(defaultLeft(), Math.round(window.innerHeight * 0.40));
    });
  }

  /* ---- 抓資料:我已收集幾種(右上角徽章);沒登入就不顯示 ---- */
  function loadData() {
    if (typeof window.sb === 'undefined') return;
    sb.auth.getSession().then(function (s) {
      var u = s && s.data && s.data.session ? s.data.session.user : null;
      if (!u) return;
      sb.from('user_seeds').select('seed_id').eq('pool', POOL).then(function (r) {
        if (r && r.data && r.data.length) {
          var b = box.querySelector('.qsb-badge');
          b.textContent = r.data.length;
          b.style.display = 'flex';
        }
      });
    });
  }

  function mount() {
    document.body.appendChild(box);
    initPos();
    bindDrag();
    loadData();
  }
  if (document.readyState !== 'loading') mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
