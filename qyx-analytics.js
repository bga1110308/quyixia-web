// qyx-analytics.js · Google Analytics(GA4) 全站訪客分析
// 為什麼獨立成一支共用檔：追蹤編號只放這裡一處，
// 以後要換帳號或停用，只改這一行，不必動每一頁。
(function () {
  var GA_ID = 'G-H0NSPQKLXT'; // 去一下網站的 GA4 評估 ID

  // 動態載入 Google 官方 gtag.js（async 不擋網頁顯示）
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
  document.head.appendChild(s);

  // gtag 初始化（照 Google 官方寫法）
  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', GA_ID);
})();
