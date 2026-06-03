/* 去一下 · 重新同意閘門（共用小工具）
   為什麼要這支：同意書（服務條款、隱私權、個資告知）集中存在資料庫 legal_documents，
   每份有版本號。會員登入後，這支比對「他同意過的版本」與「目前最新版本」，
   只要有任何一份比他簽過的新（或他從沒簽過），就蓋一層全螢幕擋住，
   要他把每份拉到最底、勾同意、送出，才放行並把同意紀錄寫進 user_consents。
   後台發布「重大修改」會把版本號 +1，全員下次登入就會被擋下重簽。
   用法：頁面載入這支檔後，呼叫 qyxConsentGate({ color:'#EF9F27' })（案家端金色、順咖端綠色 #5FB58E）。
   只寫這一份，各頁載同一支，不散落。 */
(function () {
  var OVERLAY_ID = 'qyx-consent-overlay';
  var running = false;

  function el(tag, css, text) {
    var n = document.createElement(tag);
    if (css) n.style.cssText = css;
    if (text != null) n.textContent = text;
    return n;
  }

  function removeOverlay() {
    var ov = document.getElementById(OVERLAY_ID);
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
  }

  // 取得目前登入者；先 getSession（LINE 內建瀏覽器較可靠），getUser 當備援。沒登入回 null。
  function getUser() {
    return window.sb.auth.getSession().then(function (r) {
      var u = r && r.data && r.data.session ? r.data.session.user : null;
      if (u) return u;
      return window.sb.auth.getUser().then(function (r2) {
        return r2 && r2.data ? r2.data.user : null;
      });
    });
  }

  // 算出這個人「該簽、但還沒簽到最新版」的文件清單
  function getPendingDocs(user) {
    // 1. 他的有效身分（順咖/案家），決定 audience=suncar/client 的文件要不要簽
    return window.sb.from('user_roles')
      .select('role').eq('user_id', user.id).eq('status', 'active')
      .then(function (rr) {
        var roles = (rr && rr.data) ? rr.data.map(function (x) { return x.role; }) : [];
        // 2. 所有文件（表很小，全抓回來再過濾，邏輯單純）
        return window.sb.from('legal_documents')
          .select('doc_key,title,content,version,audience')
          .then(function (dr) {
            var docs = (dr && dr.data) ? dr.data : [];
            docs = docs.filter(function (d) {
              return d.audience === 'all' || roles.indexOf(d.audience) >= 0;
            });
            // 3. 他已簽過的版本
            return window.sb.from('user_consents')
              .select('doc_key,agreed_version').eq('user_id', user.id)
              .then(function (cr) {
                var agreed = {};
                if (cr && cr.data) cr.data.forEach(function (c) { agreed[c.doc_key] = c.agreed_version; });
                // 沒簽過、或簽的版本比現行舊 → 要重簽
                return docs.filter(function (d) {
                  return agreed[d.doc_key] == null || agreed[d.doc_key] < d.version;
                });
              });
          });
      });
  }

  // 蓋上全螢幕閘門。看完每份、勾同意、送出才放行（resolve）
  function showGate(pending, user, color, resolve) {
    color = color || '#555';
    var scrolled = {};

    var overlay = el('div', 'position:fixed;inset:0;z-index:100000;background:#fff;' +
      'display:flex;flex-direction:column;font-family:inherit;color:#333;');
    overlay.id = OVERLAY_ID;

    overlay.appendChild(el('div',
      'padding:16px 20px;border-bottom:1px solid #eee;font-size:17px;font-weight:700;color:' + color + ';',
      '條款已更新，請重新閱讀並同意'));
    overlay.appendChild(el('div',
      'padding:8px 20px 0;font-size:13px;color:#777;line-height:1.6;',
      '為保障你的權益，以下文件有更新。請將每份拉到最底後，勾選並送出。'));

    var boxes = el('div', 'flex:1;overflow-y:auto;padding:12px 20px;');

    pending.forEach(function (d) {
      var card = el('div', 'margin-bottom:16px;border:1px solid #eee;border-radius:10px;overflow:hidden;');
      card.appendChild(el('div', 'padding:10px 14px;background:#fafafa;font-weight:700;font-size:15px;', d.title));
      var body = el('div', 'max-height:240px;overflow-y:auto;padding:12px 14px;font-size:13px;' +
        'line-height:1.8;white-space:pre-wrap;', d.content);
      var mark = el('div', 'padding:6px 14px;font-size:12px;color:#aaa;', '請往下拉閱讀…');

      function check() {
        var atBottom = body.scrollTop + body.clientHeight >= body.scrollHeight - 4;
        var notScrollable = body.scrollHeight <= body.clientHeight + 4;
        if (atBottom || notScrollable) {
          scrolled[d.doc_key] = true;
          mark.textContent = '✓ 已讀完';
          mark.style.color = color;
          refresh();
        }
      }
      body.addEventListener('scroll', check);
      setTimeout(check, 0); // 內容太短、不需捲動的，直接算讀完

      card.appendChild(body);
      card.appendChild(mark);
      boxes.appendChild(card);
    });
    overlay.appendChild(boxes);

    var foot = el('div', 'padding:14px 20px;border-top:1px solid #eee;');

    var label = el('label', 'display:flex;align-items:flex-start;gap:8px;font-size:14px;' +
      'line-height:1.6;color:#bbb;cursor:pointer;');
    var cb = document.createElement('input');
    cb.type = 'checkbox'; cb.disabled = true; cb.style.marginTop = '3px';
    var cbText = el('span', '', '我已閱讀並同意以上文件');
    label.appendChild(cb); label.appendChild(cbText);

    var hint = el('div', 'font-size:12px;color:#c00;margin-top:6px;min-height:16px;', '');

    var btn = el('button', 'width:100%;margin-top:12px;border:none;border-radius:10px;' +
      'padding:13px;font-size:16px;font-weight:700;color:#fff;cursor:not-allowed;background:#ccc;', '送出');
    btn.type = 'button'; btn.disabled = true;

    var logout = el('a', 'display:block;text-align:center;margin-top:12px;font-size:13px;' +
      'color:#999;text-decoration:underline;cursor:pointer;', '暫不同意，登出');
    logout.onclick = function () {
      window.sb.auth.signOut().then(function () { location.href = '13_login.html'; })
        .catch(function () { location.href = '13_login.html'; });
    };

    function refresh() {
      var allRead = pending.every(function (d) { return scrolled[d.doc_key]; });
      cb.disabled = !allRead;
      label.style.color = allRead ? '#444' : '#bbb';
      var ready = allRead && cb.checked;
      btn.disabled = !ready;
      btn.style.cursor = ready ? 'pointer' : 'not-allowed';
      btn.style.background = ready ? color : '#ccc';
    }
    cb.addEventListener('change', refresh);

    btn.onclick = function () {
      btn.disabled = true; btn.textContent = '處理中…'; hint.textContent = '';
      var now = new Date().toISOString();
      var rows = pending.map(function (d) {
        return { user_id: user.id, doc_key: d.doc_key, agreed_version: d.version, agreed_at: now };
      });
      window.sb.from('user_consents').upsert(rows, { onConflict: 'user_id,doc_key' })
        .then(function (res) {
          if (res && res.error) {
            hint.textContent = '送出失敗，請重試。';
            btn.disabled = false; btn.textContent = '送出';
            if (window.console) console.error('[qyxConsentGate] 寫入失敗', res.error);
            return;
          }
          removeOverlay();
          resolve();
        });
    };

    foot.appendChild(label);
    foot.appendChild(hint);
    foot.appendChild(btn);
    foot.appendChild(logout);
    overlay.appendChild(foot);

    document.body.appendChild(overlay);
  }

  /* 呼叫入口。回傳 Promise，放行時 resolve（頁面可 await 再跑自己的 init，也可不理它）。
     opts.color：主色（案家端 #EF9F27、順咖端 #5FB58E）。 */
  window.qyxConsentGate = function (opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      if (running || document.getElementById(OVERLAY_ID)) { resolve(); return; }
      if (!window.sb) { resolve(); return; }
      running = true;
      getUser()
        .then(function (user) {
          if (!user) { resolve(); return; } // 沒登入：交給該頁自己的守門導去登入
          return getPendingDocs(user).then(function (pending) {
            if (!pending.length) { resolve(); return; } // 都簽過最新版，放行
            showGate(pending, user, opts.color, resolve);
          });
        })
        .catch(function (e) {
          if (window.console) console.error('[qyxConsentGate] 失敗', e);
          resolve(); // 閘門本身出錯不要把人鎖死在外，放行，下次載入再檢查
        })
        .then(function () { running = false; });
    });
  };
})();
