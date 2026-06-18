/* 未送出草稿單·全站浮動提醒
   目的:案家有暫存草稿(order_drafts)時,不管從哪一頁進來都第一時間看到、可一鍵去發布,
        避免他沒看到舊單又重下一張新單。
   掛法:在頁面的 <script src="supabase-init.js"></script> 後面加一行
        <script src="qyx-draft-reminder.js"></script> 即可,不依賴各頁的變數或樣式。
   不顯示的情境:①11 案家首頁(已經有完整草稿卡,不重複) ②正在 04?draft=1 發布草稿時。 */
(function(){
  var path = location.pathname || '';
  var qs = location.search || '';
  if (path.indexOf('11_client_home') > -1) return;          // 首頁本來就有草稿卡
  if (path.indexOf('04_order_form') > -1 && qs.indexOf('draft=1') > -1) return; // 正在發布,不打擾

  var tries = 0;
  function start(){
    if (typeof window.sb === 'undefined') { if (tries++ < 40) { setTimeout(start, 250); } return; }
    run();
  }

  async function run(){
    try {
      var sres = await sb.auth.getSession();
      var user = (sres.data && sres.data.session) ? sres.data.session.user : null;
      if (!user) return;
      var d = await sb.from('order_drafts').select('payload').eq('user_id', user.id).maybeSingle();
      var p = (d && d.data && d.data.payload) ? d.data.payload : null;
      if (!p) return;
      showBanner(p);
    } catch (e) { /* 靜默,提醒壞掉也不能影響頁面 */ }
  }

  function showBanner(p){
    if (document.getElementById('qyx-draft-reminder')) return;
    var stype = p.service_type || '服務單';

    if (!document.getElementById('qyx-draft-kf')) {
      var st = document.createElement('style');
      st.id = 'qyx-draft-kf';
      st.textContent = '@keyframes qyxDraftPulse{0%,100%{box-shadow:0 8px 22px rgba(239,159,39,0.35);}50%{box-shadow:0 10px 32px rgba(239,159,39,0.65);}}';
      document.head.appendChild(st);
    }

    var bar = document.createElement('div');
    bar.id = 'qyx-draft-reminder';
    bar.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:9998;max-width:94vw;display:flex;align-items:center;gap:10px;background:linear-gradient(135deg,#FFB84D,#EF9F27);color:#fff;padding:9px 10px 9px 15px;border-radius:14px;box-shadow:0 8px 22px rgba(239,159,39,0.4);font-family:inherit;font-size:0.85rem;font-weight:600;animation:qyxDraftPulse 1.3s ease-in-out infinite;';

    var txt = document.createElement('span');
    txt.textContent = '✏️ 你有一張未送出的草稿單(' + stype + ')';
    txt.style.cssText = 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:48vw;';

    var go = document.createElement('button');
    go.textContent = '去發布';
    go.style.cssText = 'background:#fff;color:#BA7517;border:none;border-radius:99px;padding:6px 14px;font-weight:700;font-family:inherit;cursor:pointer;flex-shrink:0;';
    go.onclick = function(){ location.href = '11_client_home.html'; };

    var x = document.createElement('button');
    x.textContent = '×';
    x.setAttribute('aria-label', '關閉');
    x.style.cssText = 'background:transparent;color:#fff;border:none;font-size:1.25rem;line-height:1;cursor:pointer;padding:0 4px;flex-shrink:0;';
    x.onclick = function(){ bar.remove(); };

    bar.appendChild(txt);
    bar.appendChild(go);
    bar.appendChild(x);
    document.body.appendChild(bar);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
