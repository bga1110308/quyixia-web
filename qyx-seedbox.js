/* qyx-seedbox.js — 漂浮「種子櫃」泡泡(全站共用)
   為什麼這樣做:讓使用者在首頁角落隨時看到一個小櫃子(裡面一格一格、種子圖案霧霧看不清),
   點了就帶去打賞頁 19_seeds。掛法:在 supabase-init.js 後面加一行 <script src="qyx-seedbox.js">。
   池別(client/suncar)用頁面檔名判:12_staff* = 順咖(綠),其餘 = 案家(金)。
   顏色用寫死的色碼,不依賴各頁 :root,確保任何頁掛上去都長一樣。 */
(function () {
  if (window.__qyxSeedbox) return;
  window.__qyxSeedbox = true;

  var POOL = /12_staff|staff_home/.test(location.pathname) ? 'suncar' : 'client';
  var isSun = (POOL === 'suncar');

  var css = ''
    + '.qyx-seedbox{position:fixed;left:14px;bottom:16px;z-index:60;width:54px;text-decoration:none;'
    + 'background:#fff;border:1.5px solid ' + (isSun ? 'rgba(95,181,142,0.45)' : '#FFE9B8') + ';'
    + 'border-radius:16px;padding:5px 5px 6px;'
    + 'box-shadow:0 6px 18px ' + (isSun ? 'rgba(47,96,72,0.22)' : 'rgba(186,117,23,0.22)') + ';'
    + 'display:flex;flex-direction:column;align-items:center;gap:3px;'
    + 'animation:qsbFloat 3.6s ease-in-out infinite;transition:transform .2s,box-shadow .2s;}'
    + '.qyx-seedbox:hover{animation-play-state:paused;transform:translateY(-3px) scale(1.05);'
    + 'box-shadow:0 11px 26px ' + (isSun ? 'rgba(47,96,72,0.3)' : 'rgba(186,117,23,0.32)') + ';}'
    + '@keyframes qsbFloat{0%,100%{transform:translateY(0);}50%{transform:translateY(-5px);}}'
    + '.qsb-cap{font-size:9px;font-weight:700;letter-spacing:1px;line-height:1;'
    + 'color:' + (isSun ? '#2F6048' : '#BA7517') + ';}'
    + '.qsb-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:2px;'
    + 'background:#F3EEE3;padding:3px;border-radius:8px;}'
    + '.qsb-cell{width:16px;height:16px;display:flex;align-items:center;justify-content:center;'
    + 'font-size:11px;background:#fff;border-radius:4px;filter:blur(1.5px) grayscale(0.35);opacity:0.5;}'
    + '.qsb-badge{position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;padding:0 4px;'
    + 'border-radius:99px;color:#fff;font-size:10px;font-weight:700;display:none;'
    + 'align-items:center;justify-content:center;'
    + 'background:' + (isSun ? 'linear-gradient(135deg,#5FB58E,#2F6048)' : 'linear-gradient(135deg,#FFB84D,#EF9F27)') + ';'
    + 'box-shadow:0 2px 6px ' + (isSun ? 'rgba(47,96,72,0.4)' : 'rgba(239,159,39,0.4)') + ';}';
  var st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  var box = document.createElement('a');
  box.className = 'qyx-seedbox';
  box.href = '19_seeds.html?as=' + POOL;
  box.title = '我的種子櫃';
  box.style.position = 'fixed';
  box.innerHTML =
    '<div class="qsb-cap">種子櫃</div>' +
    '<div class="qsb-grid" id="qsb-grid"></div>' +
    '<span class="qsb-badge" id="qsb-badge"></span>';

  function fillCells(emojis) {
    var grid = box.querySelector('#qsb-grid');
    var h = '';
    for (var i = 0; i < 6; i++) {
      h += '<span class="qsb-cell">' + (emojis[i] || '🌱') + '</span>';
    }
    grid.innerHTML = h;
  }

  /* 先放佔位的霧種子,資料抓到再換成真的(一樣霧) */
  function mount() {
    document.body.appendChild(box);
    fillCells([]);
    loadData();
  }

  function loadData() {
    if (typeof window.sb === 'undefined') return;
    sb.from('seed_catalog').select('emoji').eq('tier', 30).order('sort').limit(6)
      .then(function (r) {
        if (r && r.data && r.data.length) {
          fillCells(r.data.map(function (x) { return x.emoji; }));
        }
      });
    sb.auth.getSession().then(function (s) {
      var u = s && s.data && s.data.session ? s.data.session.user : null;
      if (!u) return;
      sb.from('user_seeds').select('seed_id').eq('pool', POOL)
        .then(function (r) {
          if (r && r.data && r.data.length) {
            var b = box.querySelector('#qsb-badge');
            b.textContent = r.data.length;
            b.style.display = 'flex';
          }
        });
    });
  }

  if (document.readyState !== 'loading') mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
