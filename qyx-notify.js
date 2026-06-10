/* ============================================================
   去一下 · 全站共用站內通知 (qyx-notify.js)
   為什麼有這支:接單/開始/回報完成/確認完成/取消/退單 都要通知對方。
   通知本體由資料庫觸發器 trg_notify_order_change 自動寫進 notifications 表
   (不管哪一頁改的訂單狀態都會通知,前端不負責產生通知、也無法偽造)。
   這支只負責「讀通知、畫鈴鐺、標已讀」,讓 11/12/10 三頁共用同一份,不散開。

   用法:
   1) 首頁鈴鐺(11/12):放一個 <span data-qyx-notify data-color="#EF9F27"></span>,
      載入本檔即自動掛上(DOMContentLoaded 掃描 data-qyx-notify)。
   2) 單頁通知列(10):放 <div id="feed-list"></div>(包在 #feed-section 內),
      呼叫 QYXNotify.mountFeed('feed-list', orderId)。
   ============================================================ */
(function(){
  'use strict';

  var POLL_MS = 30000;       // 每 30 秒輪詢一次(LINE 內建瀏覽器對即時訂閱不穩,用輪詢最可靠)
  var SB_WAIT_MS = 6000;     // 等 window.sb 就緒最多 6 秒

  // 事件類型 → 小圖示(inline svg,不依賴各頁的 symbol 定義,三頁長一樣)
  function iconFor(type){
    var path;
    if(type === 'order_started')        path = '<path d="M8 5v14l11-7z"/>';                 // 播放=開始服務
    else if(type === 'order_cancelled' || type === 'order_released')
      path = '<path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>'; // 叉=取消/退單
    else if(type === 'order_await_confirm')
      path = '<path d="M12 8v5M12 16h.01" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/>'; // 待確認
    else // accepted / done / 其他 → 打勾
      path = '<path d="M20 6L9 17l-5-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>';
    return '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">'+path+'</svg>';
  }

  // 相對時間:剛剛 / N 分鐘前 / N 小時前 / N 天前 / 月-日
  function timeAgo(iso){
    if(!iso) return '';
    var t = new Date(iso).getTime();
    if(isNaN(t)) return '';
    var diff = Math.floor((Date.now() - t) / 1000);
    if(diff < 60)     return '剛剛';
    if(diff < 3600)   return Math.floor(diff/60) + ' 分鐘前';
    if(diff < 86400)  return Math.floor(diff/3600) + ' 小時前';
    if(diff < 604800) return Math.floor(diff/86400) + ' 天前';
    var d = new Date(t);
    return (d.getMonth()+1) + '-' + d.getDate();
  }

  function esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  // 等 window.sb 就緒(本檔可能比 supabase-init.js 早跑)
  function whenReady(cb){
    var waited = 0;
    (function poll(){
      if(typeof window.sb !== 'undefined' && window.sb){ cb(); return; }
      waited += 150;
      if(waited >= SB_WAIT_MS) return;   // 放棄:沒有 sb 就不顯示通知(不報錯、不擋頁面)
      setTimeout(poll, 150);
    })();
  }

  // 取目前登入者 id(沿用全站守門標準:先 getSession,LINE webview 較可靠)
  function currentUid(){
    return window.sb.auth.getSession().then(function(r){
      return (r && r.data && r.data.session && r.data.session.user) ? r.data.session.user.id : null;
    }).catch(function(){ return null; });
  }

  // 讀通知:opts.orderId 有值=只撈該訂單(給 10 用);沒值=撈全部(給鈴鐺用)
  function fetchNotifs(uid, orderId){
    var q = window.sb.from('notifications').select('*').eq('user_id', uid)
      .order('created_at', { ascending:false }).limit(30);
    if(orderId) q = q.eq('order_id', orderId);
    return q.then(function(r){ return (r && r.data) ? r.data : []; })
            .catch(function(){ return []; });
  }

  function markRead(ids){
    if(!ids || !ids.length) return Promise.resolve();
    return window.sb.from('notifications').update({ is_read:true }).in('id', ids)
      .then(function(){}).catch(function(){});
  }

  // 開到 10 詳情頁(通知都帶 order_id)
  function gotoOrder(orderId){
    if(orderId) window.location.href = '10_order_detail.html?id=' + orderId;
  }

  /* ---------- 樣式(只注一次,鈴鐺與下拉用,色系吃 data-color) ---------- */
  function injectCSS(){
    if(document.getElementById('qyx-notify-css')) return;
    var css =
      '.qn-wrap{position:relative;display:inline-flex;}'+
      '.qn-bell{position:relative;width:32px;height:32px;border-radius:99px;border:1px solid var(--border,#e5ddd0);background:#fff;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:0;color:#6b5b45;transition:all .2s;}'+
      '.qn-bell:hover{background:#faf6ef;}'+
      '.qn-bell svg{width:17px;height:17px;}'+
      '.qn-badge{position:absolute;top:-5px;right:-5px;min-width:17px;height:17px;padding:0 4px;border-radius:99px;background:#e0563f;color:#fff;font-size:0.66rem;font-weight:700;line-height:17px;text-align:center;display:none;box-shadow:0 0 0 2px #fff;}'+
      '.qn-badge.show{display:block;}'+
      '.qn-panel{position:absolute;top:40px;right:0;width:300px;max-width:84vw;max-height:64vh;overflow-y:auto;background:#fff;border:1px solid var(--border,#e5ddd0);border-radius:14px;box-shadow:0 10px 30px rgba(60,40,15,0.18);z-index:9999;display:none;}'+
      '.qn-panel.show{display:block;}'+
      '.qn-head{display:flex;align-items:center;justify-content:space-between;padding:11px 14px;border-bottom:1px solid #f0e9dd;position:sticky;top:0;background:#fff;}'+
      '.qn-head-title{font-size:0.84rem;font-weight:700;color:#3D2914;}'+
      '.qn-readall{font-size:0.72rem;color:var(--qn-accent,#c5862a);background:none;border:none;cursor:pointer;font-family:inherit;padding:2px 4px;}'+
      '.qn-readall:hover{text-decoration:underline;}'+
      '.qn-list{padding:5px;}'+
      '.qn-empty{padding:26px 14px;text-align:center;color:#9b8b75;font-size:0.8rem;}'+
      '.qn-item{display:flex;gap:10px;align-items:flex-start;padding:10px 11px;border-radius:10px;cursor:pointer;transition:background .15s;}'+
      '.qn-item:hover{background:#faf6ef;}'+
      '.qn-item.unread{background:var(--qn-soft,#fdf6ea);}'+
      '.qn-ic{width:28px;height:28px;border-radius:9px;background:#f5efe4;color:var(--qn-accent,#c5862a);display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;}'+
      '.qn-item.unread .qn-ic{background:var(--qn-accent,#c5862a);color:#fff;}'+
      '.qn-bd{flex:1;min-width:0;}'+
      '.qn-ti{font-size:0.82rem;font-weight:600;color:#3D2914;}'+
      '.qn-tx{font-size:0.76rem;color:#6b5b45;line-height:1.55;margin-top:1px;word-break:break-word;}'+
      '.qn-tm{font-size:0.68rem;color:#a89880;margin-top:3px;}'+
      '.qn-dot{width:7px;height:7px;border-radius:99px;background:#e0563f;flex-shrink:0;margin-top:7px;}';
    var st = document.createElement('style');
    st.id = 'qyx-notify-css';
    st.textContent = css;
    document.head.appendChild(st);
  }

  /* ---------- 鈴鐺(11/12 首頁) ---------- */
  function setupBell(host){
    if(host.dataset.qyxMounted === '1') return;   // 防重複掛載
    host.dataset.qyxMounted = '1';
    injectCSS();

    var accent = host.getAttribute('data-color') || '#c5862a';
    host.style.setProperty('--qn-accent', accent);
    host.style.setProperty('--qn-soft', accent + '14');  // 加 alpha 當淡底(#RRGGBBAA)

    host.classList.add('qn-wrap');
    host.innerHTML =
      '<button type="button" class="qn-bell" title="通知" aria-label="通知">'+
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>'+
        '<span class="qn-badge">0</span>'+
      '</button>'+
      '<div class="qn-panel">'+
        '<div class="qn-head"><span class="qn-head-title">通知</span><button type="button" class="qn-readall">全部已讀</button></div>'+
        '<div class="qn-list"><div class="qn-empty">載入中…</div></div>'+
      '</div>';

    var bell  = host.querySelector('.qn-bell');
    var badge = host.querySelector('.qn-badge');
    var panel = host.querySelector('.qn-panel');
    var list  = host.querySelector('.qn-list');
    var readAllBtn = host.querySelector('.qn-readall');

    var uid = null;
    var items = [];

    function renderBadge(){
      var n = items.filter(function(x){ return !x.is_read; }).length;
      badge.textContent = n > 99 ? '99+' : n;
      badge.classList.toggle('show', n > 0);
    }

    function renderList(){
      if(!items.length){ list.innerHTML = '<div class="qn-empty">目前沒有通知</div>'; return; }
      list.innerHTML = items.map(function(x){
        return '<div class="qn-item'+(x.is_read?'':' unread')+'" data-id="'+esc(x.id)+'" data-order="'+esc(x.order_id||'')+'">'+
          '<div class="qn-ic">'+iconFor(x.type)+'</div>'+
          '<div class="qn-bd">'+
            '<div class="qn-ti">'+esc(x.title)+'</div>'+
            (x.body ? '<div class="qn-tx">'+esc(x.body)+'</div>' : '')+
            '<div class="qn-tm">'+timeAgo(x.created_at)+'</div>'+
          '</div>'+
          (x.is_read ? '' : '<span class="qn-dot"></span>')+
        '</div>';
      }).join('');
    }

    function refresh(){
      if(!uid) return Promise.resolve();
      return fetchNotifs(uid, null).then(function(rows){
        items = rows;
        renderBadge();
        if(panel.classList.contains('show')) renderList();
      });
    }

    // 點一則:標已讀 → 開該訂單詳情
    list.addEventListener('click', function(e){
      var row = e.target.closest('.qn-item');
      if(!row) return;
      var id = row.getAttribute('data-id');
      var oid = row.getAttribute('data-order');
      var it = items.filter(function(x){ return String(x.id)===String(id); })[0];
      if(it && !it.is_read){ it.is_read = true; markRead([id]); renderBadge(); }
      gotoOrder(oid);
    });

    readAllBtn.addEventListener('click', function(){
      var unreadIds = items.filter(function(x){ return !x.is_read; }).map(function(x){ return x.id; });
      items.forEach(function(x){ x.is_read = true; });
      renderBadge(); renderList();
      markRead(unreadIds);
    });

    bell.addEventListener('click', function(e){
      e.stopPropagation();
      var open = panel.classList.toggle('show');
      if(open){ renderList(); refresh(); }
    });
    // 點面板外關閉
    document.addEventListener('click', function(e){
      if(!host.contains(e.target)) panel.classList.remove('show');
    });

    whenReady(function(){
      currentUid().then(function(id){
        uid = id;
        if(!uid){ list.innerHTML = '<div class="qn-empty">請先登入</div>'; return; }
        refresh();
        setInterval(refresh, POLL_MS);
        window.addEventListener('focus', refresh);
      });
    });
  }

  /* ---------- 單頁通知列(10 訂單詳情,沿用該頁既有 .live-feed/.feed-item 樣式) ---------- */
  function mountFeed(listId, orderId){
    var box = document.getElementById(listId);
    if(!box || !orderId) return;
    var section = document.getElementById('feed-section');

    function render(rows){
      if(!rows.length){ if(section) section.style.display = 'none'; return; }
      if(section) section.style.display = '';
      box.innerHTML = rows.map(function(x){
        return '<div class="feed-item'+(x.is_read?'':' new')+'">'+
          '<div class="feed-icon">'+iconFor(x.type)+'</div>'+
          '<div class="feed-body">'+
            '<div class="feed-text"><strong>'+esc(x.title)+'</strong>'+(x.body?'　'+esc(x.body):'')+'</div>'+
            '<div class="feed-time">'+timeAgo(x.created_at)+'</div>'+
          '</div>'+
        '</div>';
      }).join('');
    }

    whenReady(function(){
      currentUid().then(function(uid){
        if(!uid) return;
        function load(){
          fetchNotifs(uid, orderId).then(function(rows){
            render(rows);
            // 看了這張單的通知就標已讀(這頁本來就在看這張單)
            var unread = rows.filter(function(x){ return !x.is_read; }).map(function(x){ return x.id; });
            if(unread.length) markRead(unread);
          });
        }
        load();
        setInterval(load, POLL_MS);
        window.addEventListener('focus', load);
      });
    });
  }

  window.QYXNotify = { mountBell: setupBell, mountFeed: mountFeed };

  // 自動掛載首頁鈴鐺:掃描所有 data-qyx-notify 容器
  document.addEventListener('DOMContentLoaded', function(){
    var hosts = document.querySelectorAll('[data-qyx-notify]');
    for(var i=0; i<hosts.length; i++){ setupBell(hosts[i]); }
  });
})();
