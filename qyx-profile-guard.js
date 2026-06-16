/* 去一下 · 個人資料關卡 共用檔 (qyx-profile-guard.js)
   為什麼抽成一支:判斷「資料填齊沒、缺哪一格、身分證號格式對不對」這件事,
   登入後(13)、進首頁守門(11/12)、補資料頁(18)、編輯頁(15)都要用同一套規則。
   散在各頁會改一頁漏一頁、判斷不一致。集中一支,以後改規則只動這裡一處。 */
(function (global) {
  'use strict';

  // 全站「正式帳號」必填欄位(對應 users 表的欄位名)。改必填規則只動這一行。
  var REQUIRED = ['display_name', 'phone', 'email', 'id_number'];

  // 各欄位缺漏時給人看的中文名(湊提示訊息用)
  var LABELS = {
    display_name: '暱稱',
    phone: '電話',
    email: '信箱',
    id_number: '身分證號'
  };

  // 回傳「還缺哪些必填欄位」的陣列(空陣列=已填齊)。
  // 管理員一律視為填齊,不被守門擋。
  function missingFields(u) {
    if (!u) return REQUIRED.slice();
    if (u.is_admin || u.is_super_admin) return [];
    var miss = [];
    for (var i = 0; i < REQUIRED.length; i++) {
      var k = REQUIRED[i];
      var v = u[k];
      if (v === null || v === undefined || String(v).trim() === '') miss.push(k);
    }
    return miss;
  }

  function isComplete(u) {
    return missingFields(u).length === 0;
  }

  // 台灣身分證字號檢查(1 英文字母 + 1 位性別碼(1/2) + 8 數字,含官方檢查碼)
  function validTwId(s) {
    s = (s || '').trim().toUpperCase();
    if (!/^[A-Z][12]\d{8}$/.test(s)) return false;
    // 字母對應的兩位數(各縣市代碼,官方對照表)
    var codes = {
      A: 10, B: 11, C: 12, D: 13, E: 14, F: 15, G: 16, H: 17, I: 34, J: 18,
      K: 19, L: 20, M: 21, N: 22, O: 35, P: 23, Q: 24, R: 25, S: 26, T: 27,
      U: 28, V: 29, W: 32, X: 30, Y: 31, Z: 33
    };
    var n = codes[s.charAt(0)];
    var sum = Math.floor(n / 10) + (n % 10) * 9; // 字母十位 ×1、個位 ×9
    var weights = [8, 7, 6, 5, 4, 3, 2, 1];      // 中間 8 碼權重
    for (var i = 1; i <= 8; i++) {
      sum += parseInt(s.charAt(i), 10) * weights[i - 1];
    }
    sum += parseInt(s.charAt(9), 10);            // 最後一碼為檢查碼 ×1
    return sum % 10 === 0;
  }

  // 居留證號(新式統一證號:2 英文字母 + 8 數字)。
  // 外籍/居留證版本分歧大,這裡只擋格式、不算檢查碼,避免擋掉合法居留證。
  function validArc(s) {
    s = (s || '').trim().toUpperCase();
    return /^[A-Z]{2}\d{8}$/.test(s);
  }

  // 對外:本國身分證號 或 居留證號,任一格式通過即算有效。
  function validIdNumber(s) {
    return validTwId(s) || validArc(s);
  }

  global.QyxProfile = {
    REQUIRED: REQUIRED,
    LABELS: LABELS,
    missingFields: missingFields,
    isComplete: isComplete,
    validIdNumber: validIdNumber
  };
})(window);
