/* qyx-seedbox.js — 漂浮「種子櫃」泡泡(全站共用,可拖曳)
   為什麼這樣做:讓使用者在頁面角落隨時看到一個小抽屜櫃(裡面一格一格、種子圖案霧霧看不清),
   點了去打賞頁 19_seeds;可以用滑鼠/手指拖著移動,位置記在瀏覽器(localStorage)下次同位置。
   掛法:在 supabase-init.js 後面加一行 <script src="qyx-seedbox.js">。
   池別(client/suncar)用頁面檔名判:12_staff* = 順咖(綠),其餘 = 案家(金)。
   顏色寫死色碼,不依賴各頁 :root,確保任何頁掛上去都長一樣。 */
(function () {
  if (window.__qyxSeedbox) return;
  window.__qyxSeedbox = true;

  var POOL = /12_staff|staff_home/.test(location.pathname) ? 'suncar' : 'client';
  var isSun = (POOL === 'suncar');
  var LSKEY = 'qyx_seedbox_pos';

  /* ---- 配色(金=案家 / 綠=順咖) ---- */
  var C = isSun
    ? { head: 'linear-gradient(135deg,#5FB58E,#2F6048)', frame: '#9FCBB4', knob: '#A7C7B6',
        shadow: 'rgba(47,96,72,0.28)', shadowHi: 'rgba(47,96,72,0.38)', badge: 'linear-gradient(135deg,#5FB58E,#2F6048)' }
    : { head: 'linear-gradient(135deg,#FFB84D,#EF9F27)', frame: '#E8C77A', knob: '#D9BE84',
        shadow: 'rgba(186,117,23,0.26)', shadowHi: 'rgba(186,117,23,0.38)', badge: 'linear-gradient(135deg,#FFB84D,#EF9F27)' };

  injectStyle();
  var box = buildBox();

  /* ---- 樣式 ---- */
  function injectStyle() {
    var css = ''
      + '.qyx-seedbox{position:fixed;z-index:60;width:66px;user-select:none;-webkit-user-select:none;'
      + 'touch-action:none;cursor:grab;border-radius:15px;overflow:visible;'
      + 'background:linear-gradient(160deg,#FFFDF7,#FFF4DD);border:1.5px solid ' + C.frame + ';'
      + 'box-shadow:0 8px 22px ' + C.shadow + ';animation:qsbGlow 3.4s ease-in-out infinite;'
      + 'transition:transform .18s,box-shadow .18s;}'
      + '.qyx-seedbox:hover{transform:scale(1.05);box-shadow:0 12px 28px ' + C.shadowHi + ';}'
      + '.qyx-seedbox.qsb-drag{cursor:grabbing;animation:none;transform:none;box-shadow:0 14px 30px ' + C.shadowHi + ';}'
      + '@keyframes qsbGlow{0%,100%{box-shadow:0 8px 22px ' + C.shadow + ';}50%{box-shadow:0 11px 26px ' + C.shadowHi + ';}}'
      + '.qsb-head{font-size:9px;font-weight:700;letter-spacing:2px;text-align:center;color:#fff;'
      + 'padding:3px 0 3px;background:' + C.head + ';border-radius:13px 13px 0 0;}'
      + '.qsb-sprout{position:absolute;top:-14px;left:50%;transform:translateX(-50%);z-index:1;'
      + 'color:#5FB58E;filter:drop-shadow(0 2px 2px rgba(47,96,72,0.22));pointer-events:none;}'
      + '.qsb-sprout svg{width:30px;height:22px;fill:currentColor;display:block;}'
      + '.qsb-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:4px;padding:5px;}'
      + '.qsb-drawer{position:relative;height:19px;border-radius:5px;overflow:hidden;'
      + 'background:linear-gradient(180deg,#fff,#FBF3E0);border:1px solid ' + C.frame + ';'
      + 'display:flex;align-items:center;justify-content:center;}'
      + '.qsb-drawer .e{font-size:12px;line-height:1;filter:blur(1.7px) grayscale(0.4);opacity:0.42;}'
      + '.qsb-drawer .k{position:absolute;bottom:2px;left:50%;transform:translateX(-50%);'
      + 'width:9px;height:2px;border-radius:2px;background:' + C.knob + ';}'
      + '.qsb-badge{position:absolute;top:-7px;right:-7px;min-width:19px;height:19px;padding:0 5px;'
      + 'border-radius:99px;color:#fff;font-size:10px;font-weight:700;display:none;'
      + 'align-items:center;justify-content:center;background:' + C.badge + ';'
      + 'box-shadow:0 2px 6px ' + C.shadow + ';border:1.5px solid #fff;}';
    var st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);
  }

  /* ---- 建立元素 ---- */
  function buildBox() {
    var el = document.createElement('div');
    el.className = 'qyx-seedbox';
    el.title = '我的種子櫃(可拖曳·點一下去打賞)';
    var drawers = '';
    for (var i = 0; i < 6; i++) {
      drawers += '<div class="qsb-drawer"><span class="e">🌱</span><span class="k"></span></div>';
    }
    el.innerHTML =
      '<span class="qsb-sprout"><svg viewBox="0 0 24 24"><path d="M11.2 19c0-3 .2-5 .8-7 .6 2 .8 4 .8 7zM12 12C9.5 7.2 5.2 6 1.8 7.4 2.7 12.2 7.6 13.8 12 12zM12 11.2c2-4.8 6.3-6.2 9.7-4.8C20.9 11 16 12.9 12 11.2z"/></svg></span>'
      + '<div class="qsb-head">種子櫃</div>'
      + '<div class="qsb-grid">' + drawers + '</div>'
      + '<span class="qsb-badge"></span>';
    return el;
  }

  function fillCells(emojis) {
    var cells = box.querySelectorAll('.qsb-drawer .e');
    for (var i = 0; i < cells.length; i++) {
      cells[i].textContent = emojis[i] || '🌱';
    }
  }

  /* ---- 位置(可拖曳 + 記憶) ---- */
  function clampPos(left, top) {
    var w = box.offsetWidth || 66, h = box.offsetHeight || 92;
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
  function initPos() {
    var saved = loadPos();
    if (saved) { setPos(saved.left, saved.top); return; }
    var w = box.offsetWidth || 66;
    setPos(window.innerWidth - w - 18, Math.round(window.innerHeight * 0.40)); /* 預設:右側中間偏上 */
  }

  /* ---- 拖曳 vs 點擊:移動超過 4px 算拖曳,否則算點擊去打賞 ---- */
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
      else location.href = '19_seeds.html?as=' + POOL;
    });
    window.addEventListener('resize', function () { setPos(box.offsetLeft, box.offsetTop); });
  }

  /* ---- 抓資料:6 顆種子當霧樣本 + 我已收集幾種 ---- */
  function loadData() {
    if (typeof window.sb === 'undefined') return;
    sb.from('seed_catalog').select('emoji').eq('tier', 30).order('sort').limit(6)
      .then(function (r) { if (r && r.data && r.data.length) fillCells(r.data.map(function (x) { return x.emoji; })); });
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
