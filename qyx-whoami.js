/* 去一下 · 目前登入者識別小標(共用小工具)
   為什麼要這支:截圖或測試時,光看畫面分不出是「哪個帳號」在用。這支在每頁右下角放一個小膠囊,
   顯示目前登入者的暱稱＋會員編號(滑過顯示完整 user id 給對帳),沒登入就不顯示。
   全站載同一支、樣式統一,不要每頁各寫一份。顏色一律吃設計規範的 :root 變數(帶 fallback 防萬一)。 */
(function () {
  if (window.__qyxWhoamiLoaded) return;        // 防重複載入
  window.__qyxWhoamiLoaded = true;

  function start() {
    if (!window.sb || !window.sb.auth) return;  // 沒接 Supabase 的頁(如純靜態)直接略過
    window.sb.auth.getSession().then(function (r) {
      var u = (r && r.data && r.data.session) ? r.data.session.user : null;
      if (!u) return;                            // 沒登入:不顯示
      window.sb.from('users')
        .select('display_name,member_no,is_admin')
        .eq('id', u.id).maybeSingle()
        .then(function (res) {
          var d = (res && res.data) ? res.data : {};
          render(u.id, d.display_name || '未命名', d.member_no || '未發編號', !!d.is_admin);
        })
        .catch(function () { render(u.id, '已登入', '', false); }); // 讀不到資料也至少標示有人登入
    }).catch(function () {});
  }

  function render(uid, name, no, isAdmin) {
    if (document.getElementById('qyx-whoami')) return;
    var firstChar = Array.from(String(name))[0] || '?';

    var chip = document.createElement('div');
    chip.id = 'qyx-whoami';
    chip.title = '目前登入帳號 ID:' + uid;       // 滑過顯示完整 id,方便跟後台對帳
    chip.style.cssText =
      'position:fixed;right:12px;bottom:12px;z-index:60;' +
      'display:inline-flex;align-items:center;gap:7px;max-width:70vw;' +
      'padding:5px 12px 5px 5px;border-radius:99px;background:#fff;' +
      'border:1px solid var(--border,#FFE9B8);' +
      'box-shadow:0 4px 14px rgba(186,117,23,0.15);' +
      'font-family:inherit;color:var(--ink,#3D2914);line-height:1.25;';

    var avatar = document.createElement('div');
    avatar.textContent = firstChar;
    avatar.style.cssText =
      'width:22px;height:22px;border-radius:50%;flex-shrink:0;background:#fff;' +
      'display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:600;' +
      'color:' + (isAdmin ? 'var(--amber-deep,#BA7517)' : 'var(--forest,#2F6048)') + ';' +
      'box-shadow:inset 0 0 0 1px var(--border,#FFE9B8);';

    var text = document.createElement('div');
    text.style.cssText = 'display:flex;flex-direction:column;min-width:0;';

    var l1 = document.createElement('span');
    l1.textContent = name + (isAdmin ? ' · 管理員' : '');
    l1.style.cssText = 'font-size:0.72rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';

    text.appendChild(l1);
    if (no) {
      var l2 = document.createElement('span');
      l2.textContent = no;
      l2.style.cssText = 'font-size:0.64rem;font-weight:500;color:var(--ink-soft,#8B7355);white-space:nowrap;';
      text.appendChild(l2);
    }

    chip.appendChild(avatar);
    chip.appendChild(text);
    (document.body || document.documentElement).appendChild(chip);

    // 管理員專屬:只有 is_admin 的帳號(也就是負責人本人)登入才出現「管理後台」按鈕,
    // 放在身分膠囊正上方,點下去跳管理頁。非管理員看不到;就算有人硬連 08_admin.html,
    // 該頁自己也會再驗一次 is_admin 並擋掉,這顆只是方便入口、不是權限關卡。
    if (isAdmin) renderAdminBtn();
  }

  function renderAdminBtn() {
    if (document.getElementById('qyx-admin-btn')) return;   // 防重複
    var btn = document.createElement('a');
    btn.id = 'qyx-admin-btn';
    btn.href = '08_admin.html';
    btn.textContent = '🛠 管理後台';
    btn.title = '進入後台管理頁';
    btn.style.cssText =
      'position:fixed;right:12px;bottom:50px;z-index:61;' +   // bottom:50 = 疊在膠囊(bottom:12)上方
      'display:inline-flex;align-items:center;gap:6px;' +
      'padding:7px 14px;border-radius:99px;text-decoration:none;' +
      'background:var(--amber-deep,#BA7517);color:#fff;' +
      'font-family:inherit;font-size:0.74rem;font-weight:700;line-height:1;' +
      'box-shadow:0 4px 14px rgba(186,117,23,0.30);';
    (document.body || document.documentElement).appendChild(btn);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
