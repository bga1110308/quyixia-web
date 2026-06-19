/* qyx-seedbox.js — 漂浮「種子櫃」泡泡(全站共用,可拖曳)
   為什麼這樣做:讓使用者在頁面角落隨時看到一個小抽屜櫃(裡面一格一格、種子圖案霧霧看不清),
   點了會打開「我的收集」面板,看自己這一池已收集的種子;點面板裡任一顆,放大顯示像剛抽到那樣,還能分享。
   櫃子可以用滑鼠/手指拖著移動,位置記在瀏覽器(localStorage)下次同位置。
   掛法:在 supabase-init.js 後面加 <script src="qyx-seed-art.js"> 再加 <script src="qyx-seedbox.js">。
   (面板畫種子要用繪圖引擎 qyx-seed-art.js,所以要先載入它)
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
        shadow: 'rgba(47,96,72,0.28)', shadowHi: 'rgba(47,96,72,0.38)', badge: 'linear-gradient(135deg,#5FB58E,#2F6048)',
        main: '#2F6048', soft: '#E8F5EE' }
    : { head: 'linear-gradient(135deg,#FFB84D,#EF9F27)', frame: '#E8C77A', knob: '#D9BE84',
        shadow: 'rgba(186,117,23,0.26)', shadowHi: 'rgba(186,117,23,0.38)', badge: 'linear-gradient(135deg,#FFB84D,#EF9F27)',
        main: '#BA7517', soft: '#FFF4DD' };

  /* 四等級的名稱與標籤配色(放大彈窗的小標籤用) */
  var RARITY = {
    normal: { label: '普通', bg: '#FAEEDA', fg: '#BA7517' },
    fine:   { label: '高級', bg: '#E8F1F8', fg: '#3A7CB8' },
    rare:   { label: '稀有', bg: '#F0E8FA', fg: '#8A52C9' },
    gold:   { label: '金',   bg: '#E0A93C', fg: '#fff' }
  };

  /* 抓回來放著:登入者、推薦碼、各金額整池 weight 總和(算掉落機率用) */
  var _uid = null;
  var _refCode = '';
  var _tierTotalW = {};
  var _shareSeed = null;

  injectStyle();
  var box = buildBox();
  var els = null;   /* 收集面板/放大彈窗等 mount 時(body 已生成)才建,避免腳本掛在 <head> 時 body 還不存在而報錯 */

  /* ---- 樣式 ---- */
  function injectStyle() {
    var css = ''
      /* 小櫃子本體 */
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
      + 'box-shadow:0 2px 6px ' + C.shadow + ';border:1.5px solid #fff;}'
      /* 遮罩(收集面板 / 放大彈窗共用) */
      + '.qsb-mask{position:fixed;inset:0;z-index:10000;background:rgba(61,41,20,0.5);'
      + 'display:none;align-items:flex-end;justify-content:center;}'
      + '.qsb-mask.show{display:flex;}'
      + '@media(min-width:560px){.qsb-mask{align-items:center;}}'
      /* 收集面板(底部抽屜,手機友善) */
      + '.qsb-sheet{background:#fff;border-radius:22px 22px 0 0;width:100%;max-width:520px;'
      + 'max-height:82vh;overflow:auto;padding:1.3rem 1.25rem 1.6rem;box-shadow:0 -10px 40px rgba(0,0,0,0.18);}'
      + '@media(min-width:560px){.qsb-sheet{border-radius:22px;}}'
      + '.qsb-sheet-head{display:flex;align-items:center;justify-content:space-between;}'
      + '.qsb-sheet-title{font-size:1.08rem;font-weight:700;color:#3D2914;}'
      + '.qsb-x{background:none;border:none;font-size:1.5rem;line-height:1;color:#B8A485;cursor:pointer;padding:0 4px;}'
      + '.qsb-sheet-sub{font-size:0.8rem;color:#8B7355;margin-top:0.35rem;}'
      + '.qsb-empty{text-align:center;color:#8B7355;font-size:0.88rem;padding:2.2rem 1rem;line-height:1.7;}'
      + '.qsb-empty a{color:' + C.main + ';font-weight:700;text-decoration:none;}'
      + '.qsb-collection{display:grid;grid-template-columns:repeat(4,1fr);gap:12px 8px;margin-top:1rem;}'
      + '@media(min-width:480px){.qsb-collection{grid-template-columns:repeat(5,1fr);}}'
      + '.qsb-cell{display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;'
      + 'border:none;background:none;font-family:inherit;padding:4px 2px;border-radius:12px;transition:background .15s;}'
      + '.qsb-cell:hover{background:' + C.soft + ';}'
      + '.qsb-cell .art{width:46px;height:46px;}'
      + '.qsb-cell .art svg{width:100%;height:100%;display:block;}'
      + '.qsb-cell .art img{width:100%;height:100%;object-fit:contain;display:block;}'
      + '.qsb-cell .nm{font-size:0.66rem;color:#3D2914;font-weight:600;line-height:1.15;text-align:center;}'
      + '.qsb-cell .xn{font-size:0.6rem;color:' + C.main + ';font-weight:700;}'
      /* 放大彈窗(像剛抽到那樣) */
      + '.qsb-rbox{background:#fff;border-radius:24px;padding:2rem 1.75rem 1.5rem;max-width:340px;width:calc(100% - 2.4rem);'
      + 'margin:0 1.2rem;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.28);}'
      + '.qsb-rart{margin:0 auto;width:120px;height:120px;animation:qsbPop 0.5s ease;}'
      + '.qsb-rart svg{width:100%;height:100%;display:block;}'
      + '.qsb-rart img{width:100%;height:100%;object-fit:contain;display:block;}'
      + '@keyframes qsbPop{0%{transform:scale(0.3) rotate(-12deg);opacity:0;}60%{transform:scale(1.12) rotate(4deg);}100%{transform:scale(1) rotate(0);opacity:1;}}'
      + '.qsb-rtag{display:inline-block;margin-top:0.9rem;font-size:0.72rem;font-weight:700;padding:3px 12px;border-radius:99px;}'
      + '.qsb-rname{font-size:1.45rem;font-weight:700;color:#3D2914;margin-top:0.55rem;}'
      + '.qsb-rmeta{font-size:0.8rem;color:#8B7355;margin-top:0.4rem;font-weight:600;}'
      + '.qsb-rbtns{display:flex;gap:9px;margin-top:1.2rem;}'
      + '.qsb-rbtns button{flex:1;padding:0.82rem;border-radius:13px;font-size:0.92rem;font-weight:700;cursor:pointer;font-family:inherit;}'
      + '.qsb-share{background:#fff;color:' + C.main + ';border:1.5px solid ' + C.main + ';}'
      + '.qsb-rclose{background:' + C.head + ';color:#fff;border:none;}'
      /* 分享列(在放大彈窗裡展開) */
      + '.qsb-sharerow{display:none;grid-template-columns:1fr 1fr;gap:8px;margin-top:0.9rem;}'
      + '.qsb-sharerow.show{display:grid;}'
      + '.qsb-sh{padding:0.7rem;border-radius:11px;border:none;font-size:0.85rem;font-weight:600;cursor:pointer;font-family:inherit;color:#fff;}'
      + '.qsb-sh.fb{background:#1877F2;}.qsb-sh.th{background:#000;}'
      + '.qsb-sh.ig{background:linear-gradient(135deg,#F58529,#DD2A7B,#8134AF);}'
      + '.qsb-sh.cp{background:#fff;color:' + C.main + ';border:1.5px solid ' + C.main + ';}';
    var st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);
  }

  /* ---- 建立小櫃子 ---- */
  function buildBox() {
    var el = document.createElement('div');
    el.className = 'qyx-seedbox';
    el.title = '我的種子櫃(可拖曳·點一下看收集)';
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

  /* ---- 建立收集面板 + 放大彈窗(只建一次,反覆用) ---- */
  function buildOverlays() {
    var panel = document.createElement('div');
    panel.className = 'qsb-mask';
    panel.innerHTML =
      '<div class="qsb-sheet">'
      + '<div class="qsb-sheet-head"><span class="qsb-sheet-title">我的種子收集</span><button class="qsb-x" type="button">×</button></div>'
      + '<div class="qsb-sheet-sub"></div>'
      + '<div class="qsb-collection"></div>'
      + '</div>';

    var reveal = document.createElement('div');
    reveal.className = 'qsb-mask';
    reveal.innerHTML =
      '<div class="qsb-rbox">'
      + '<div class="qsb-rart"></div>'
      + '<div><span class="qsb-rtag"></span></div>'
      + '<div class="qsb-rname"></div>'
      + '<div class="qsb-rmeta"></div>'
      + '<div class="qsb-rbtns">'
      +   '<button class="qsb-share" type="button">炫耀 · 分享</button>'
      +   '<button class="qsb-rclose" type="button">收下</button>'
      + '</div>'
      + '<div class="qsb-sharerow">'
      +   '<button class="qsb-sh fb" type="button">Facebook</button>'
      +   '<button class="qsb-sh th" type="button">Threads(脆)</button>'
      +   '<button class="qsb-sh ig" type="button">IG / 其他</button>'
      +   '<button class="qsb-sh cp" type="button">複製連結</button>'
      + '</div>'
      + '</div>';

    document.body.appendChild(panel);
    document.body.appendChild(reveal);

    /* 關閉:點空白處或叉叉 */
    panel.addEventListener('click', function (e) { if (e.target === panel) hide(panel); });
    panel.querySelector('.qsb-x').addEventListener('click', function () { hide(panel); });
    reveal.addEventListener('click', function (e) { if (e.target === reveal) hide(reveal); });
    reveal.querySelector('.qsb-rclose').addEventListener('click', function () { hide(reveal); });
    reveal.querySelector('.qsb-share').addEventListener('click', function () {
      reveal.querySelector('.qsb-sharerow').classList.toggle('show');
    });
    var sr = reveal.querySelector('.qsb-sharerow');
    sr.querySelector('.fb').addEventListener('click', function () { shareTo('fb'); });
    sr.querySelector('.th').addEventListener('click', function () { shareTo('th'); });
    sr.querySelector('.ig').addEventListener('click', function () { shareTo('native'); });
    sr.querySelector('.cp').addEventListener('click', function () { shareTo('copy'); });

    return {
      panel: panel,
      sub: panel.querySelector('.qsb-sheet-sub'),
      grid: panel.querySelector('.qsb-collection'),
      reveal: reveal,
      rart: reveal.querySelector('.qsb-rart'),
      rtag: reveal.querySelector('.qsb-rtag'),
      rname: reveal.querySelector('.qsb-rname'),
      rmeta: reveal.querySelector('.qsb-rmeta'),
      sharerow: sr
    };
  }

  function show(maskEl) { maskEl.classList.add('show'); }
  function hide(maskEl) { maskEl.classList.remove('show'); }

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
  /* 預設位置:貼在內容卡片(.wrap,寬 720 置中)右側,不再浮在螢幕最右邊空白處。
     她已自己拖過位置(localStorage 有值)就尊重她的,只在第一次/無痕視窗用這個預設。 */
  function defaultLeft() {
    var w = box.offsetWidth || 66;
    var wrap = document.querySelector('.wrap');
    var rightEdge = wrap ? wrap.getBoundingClientRect().right
                         : Math.min(window.innerWidth - 16, (window.innerWidth + 720) / 2);
    return rightEdge + 6;   /* 櫃子左緣貼在卡片右緣外側 6px,看起來像靠在卡片旁邊 */
  }
  function initPos() {
    var saved = loadPos();
    if (saved) { setPos(saved.left, saved.top); return; }
    setPos(defaultLeft(), Math.round(window.innerHeight * 0.40)); /* 垂直維持偏上,跟她畫的高度一致 */
  }

  /* ---- 拖曳 vs 點擊:移動超過 4px 算拖曳,否則算點擊→打開收集面板 ---- */
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
      else openPanel();
    });
    window.addEventListener('resize', function () {
      if (loadPos()) setPos(box.offsetLeft, box.offsetTop);
      else setPos(defaultLeft(), Math.round(window.innerHeight * 0.40));
    });
  }

  /* ---- 抓資料:6 顆種子當霧樣本 + 我已收集幾種 + 推薦碼 ---- */
  function loadData() {
    if (typeof window.sb === 'undefined') return;
    sb.from('seed_catalog').select('emoji').eq('tier', 30).eq('pool', POOL).order('sort').limit(6)
      .then(function (r) { if (r && r.data && r.data.length) fillCells(r.data.map(function (x) { return x.emoji; })); });
    sb.auth.getSession().then(function (s) {
      var u = s && s.data && s.data.session ? s.data.session.user : null;
      if (!u) return;
      _uid = u.id;
      sb.from('users').select('ref_code').eq('id', _uid).maybeSingle()
        .then(function (r) { if (r && r.data) _refCode = r.data.ref_code || ''; });
      sb.from('user_seeds').select('seed_id').eq('pool', POOL).then(function (r) {
        if (r && r.data && r.data.length) {
          var b = box.querySelector('.qsb-badge');
          b.textContent = r.data.length;
          b.style.display = 'flex';
        }
      });
    });
  }

  /* ---- 打開收集面板:抓整池圖鑑 + 我的收集,只列已收集的 ---- */
  function openPanel() {
    if (typeof window.sb === 'undefined') { location.href = '19_seeds.html?as=' + POOL; return; }
    els.sub.textContent = '載入中…';
    els.grid.innerHTML = '';
    show(els.panel);
    fetchCollection().then(renderCollection);
  }

  function fetchCollection() {
    var catP = sb.from('seed_catalog').select('id,name,emoji,rarity,weight,tier,art,sort').eq('pool', POOL).order('tier').order('sort');
    var mineP = sb.from('user_seeds').select('seed_id,cnt').eq('pool', POOL);
    return Promise.all([catP, mineP]).then(function (res) {
      var seeds = (res[0] && res[0].data) ? res[0].data : [];
      var mine = (res[1] && res[1].data) ? res[1].data : [];
      var owned = {};
      mine.forEach(function (r) { owned[r.seed_id] = r.cnt; });
      /* 算各金額整池 weight 總和,放大彈窗顯示掉落機率用 */
      _tierTotalW = {};
      seeds.forEach(function (s) { _tierTotalW[s.tier] = (_tierTotalW[s.tier] || 0) + (s.weight || 0); });
      /* 只回已收集的,帶上收集數 */
      return seeds.filter(function (s) { return owned[s.id] > 0; })
                  .map(function (s) { s.cnt = owned[s.id]; return s; });
    });
  }

  function renderCollection(list) {
    if (!list.length) {
      els.sub.textContent = '';
      els.grid.innerHTML = '<div class="qsb-empty">你還沒有種子。<br>去<a href="19_seeds.html?as=' + POOL + '">打賞平台</a>抽第一顆吧 🌱</div>';
      return;
    }
    els.sub.textContent = '已收集 ' + list.length + ' 種 · 點任一顆放大看';
    els.grid.innerHTML = list.map(function (s, i) {
      return '<button class="qsb-cell" type="button" data-i="' + i + '">'
        +   '<span class="art">' + seedSVG(s, 46) + '</span>'
        +   '<span class="nm">' + esc(s.name || '種子') + '</span>'
        +   (s.cnt > 1 ? '<span class="xn">×' + s.cnt + '</span>' : '')
        + '</button>';
    }).join('');
    var cells = els.grid.querySelectorAll('.qsb-cell');
    for (var i = 0; i < cells.length; i++) {
      (function (seed) {
        cells[i].addEventListener('click', function () { openReveal(seed); });
      })(list[Number(cells[i].getAttribute('data-i'))]);
    }
  }

  /* 一顆種子的圖:有圖片路徑顯圖片,否則用繪圖引擎畫向量 */
  function seedSVG(s, size) {
    var art = s.art || {};
    if (typeof art === 'string') { try { art = JSON.parse(art); } catch (e) { art = {}; } }
    if (art && art.img) { return '<img src="' + esc(art.img) + '" alt="">'; }
    if (typeof window.QyxSeedArt === 'undefined') { return esc(s.emoji || '🌱'); }
    return QyxSeedArt.svg({ art: art, rarity: s.rarity, pool: POOL, tier: s.tier, size: size, got: true });
  }

  /* ---- 放大彈窗:像剛抽到那樣秀一顆種子 + 分享 ---- */
  function openReveal(s) {
    var r = RARITY[s.rarity] ? s.rarity : 'normal';
    var info = RARITY[r];
    els.rart.innerHTML = seedSVG(s, 120);
    els.rname.textContent = s.name || '種子';
    els.rtag.style.background = info.bg;
    els.rtag.style.color = info.fg;
    els.rtag.textContent = (r === 'gold' ? '✨' : r === 'rare' ? '💜' : '') + info.label + '種子';
    var totW = _tierTotalW[s.tier] || 0;
    var rate = totW ? (s.weight / totW * 100).toFixed(1) + '%' : '';
    els.rmeta.textContent = (rate ? '掉落機率 ' + rate + ' · ' : '') + '已收集 ×' + (s.cnt || 1);
    els.sharerow.classList.remove('show');
    _shareSeed = { name: s.name, emoji: s.emoji };
    show(els.reveal);
  }

  /* ---- 分享(帶自己的推薦碼,朋友進來自動綁推薦) ---- */
  function shareUrl() {
    return _refCode
      ? ('https://quyixia-web.vercel.app/14_signup.html?ref=' + encodeURIComponent(_refCode))
      : 'https://quyixia-web.vercel.app/';
  }
  function shareText() {
    var t = '我在「去一下」打賞平台';
    if (_shareSeed && _shareSeed.name) { t += '收集到種子【' + _shareSeed.name + '】' + (_shareSeed.emoji || ''); }
    t += '! 一起來收集種子、支持平台 🌱';
    return t;
  }
  function copyText(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).catch(function () { fallbackCopy(t); });
    } else { fallbackCopy(t); }
  }
  function fallbackCopy(t) {
    var ta = document.createElement('textarea');
    ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
  }
  function shareTo(kind) {
    var url = shareUrl(), text = shareText();
    if (kind === 'fb') {
      window.open('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url), '_blank');
    } else if (kind === 'th') {
      window.open('https://www.threads.net/intent/post?text=' + encodeURIComponent(text + '\n' + url), '_blank');
    } else if (kind === 'native') {
      if (navigator.share) { navigator.share({ title: '去一下', text: text, url: url }).catch(function () {}); }
      else { copyText(text + '\n' + url); alert('已複製連結,貼到 IG 限動或私訊就行。'); }
    } else {
      copyText(text + '\n' + url); alert('已複製連結,可貼到任何地方分享。');
    }
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function mount() {
    els = buildOverlays();
    document.body.appendChild(box);
    initPos();
    bindDrag();
    loadData();
  }
  if (document.readyState !== 'loading') mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
