/* 去一下 · 載入逾時保護(共用小工具)
   為什麼要這支:Supabase 免費方案會休眠、網路偶爾會慢,頁面在跟資料庫要資料時
   若卡住,畫面會永遠停在「載入中…」,使用者只能乾等。這支小工具給每頁的載入流程
   包一層保險:超過設定秒數還沒載完、或載入途中出錯,就蓋一層「載入較慢,請點此重試」
   加一顆重試鈕(按了=重新整理本頁);若只是慢、但最後有載完,會自動把這層收掉露出內容。
   用法:把該頁原本呼叫 init 的那一行改成 qyxGuard(init, { color:'顏色' })。
   同一套邏輯只寫這一份,每頁載這支檔即可,不散落各頁。 */
(function () {
  var OVERLAY_ID = 'qyx-load-overlay';

  // 蓋上「載入較慢」重試層。color:重試鈕顏色(案家端金色、順咖端綠色);msg:提示文字
  function showOverlay(color, msg) {
    if (document.getElementById(OVERLAY_ID)) return; // 已經蓋了就不重複
    var box = document.createElement('div');
    box.id = OVERLAY_ID;
    box.style.cssText =
      'position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;' +
      'align-items:center;justify-content:center;gap:18px;padding:24px;' +
      'background:rgba(255,255,255,0.97);font-family:inherit;text-align:center;color:#444;';

    var text = document.createElement('div');
    text.textContent = msg;
    text.style.cssText = 'font-size:16px;line-height:1.7;max-width:300px;';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '點此重試';
    btn.style.cssText =
      'border:none;border-radius:10px;padding:12px 30px;font-size:16px;' +
      'font-weight:700;color:#fff;cursor:pointer;background:' + (color || '#555') + ';';
    btn.onclick = function () { location.reload(); };

    box.appendChild(text);
    box.appendChild(btn);
    document.body.appendChild(box);
  }

  function removeOverlay() {
    var ov = document.getElementById(OVERLAY_ID);
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
  }

  /* initFn:該頁原本的載入函式(可以是 async)
     opts.timeout:幾毫秒算逾時,預設 8000(8 秒)
     opts.color:重試鈕顏色 */
  window.qyxGuard = function (initFn, opts) {
    opts = opts || {};
    var timeout = opts.timeout || 8000;
    var color = opts.color;
    var finished = false;

    // 逾時:時間到了還沒載完,就蓋重試層
    var timer = setTimeout(function () {
      if (!finished) {
        showOverlay(color, '載入較慢,可能是網路或伺服器正在喚醒。請點下方按鈕重試。');
      }
    }, timeout);

    // 用 Promise 包,不管 initFn 是不是 async 都能接住成功與失敗
    Promise.resolve()
      .then(function () { return initFn(); })
      .then(function () {
        finished = true;
        clearTimeout(timer);
        removeOverlay(); // 慢但有載完:把重試層收掉,露出內容
      })
      .catch(function (err) {
        finished = true;
        clearTimeout(timer);
        showOverlay(color, '載入時發生問題,請點下方按鈕重試。');
        if (window.console) console.error('[qyxGuard] 載入失敗', err);
      });
  };
})();
