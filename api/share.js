// api/share.js
// 用途：分享連結的「落地頁」。FB／LINE 等平台抓這頁的 og 標籤顯示預覽卡；
//       真人打開則自動導到目的頁（種子→註冊頁帶推薦碼；心願→心願樹該則願望）。
// 為什麼分兩支：產圖（og-image.js，重、要套件）與落地頁（這支，輕、純字串）分開，
//             各司其職、好維護；爬蟲只讀這頁 head 的 meta，不會跑 JS，所以 JS 導向只影響真人。
//
// 呼叫方式：
//   /api/share?t=seed&name=梅芽&pool=client&ref=ABC123
//   /api/share?t=wish&text=希望順利&nick=小美&id=123&ref=ABC123

export const config = { runtime: 'edge' };

// 把值塞進 HTML 屬性前先跳脫，避免使用者字串破壞標籤或被注入。
function esc(s) {
  return (s || '').toString()
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
// 放進 JS 字串（location.replace 的目的網址）前的跳脫。
function jsStr(s) {
  return (s || '').toString().replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/</g, '\\u003c');
}

export default function handler(req) {
  const url = new URL(req.url);
  const q = url.searchParams;
  const origin = url.origin;
  const t = q.get('t') === 'wish' ? 'wish' : 'seed';
  const ref = q.get('ref') || '';

  // 預覽圖：把顯示用參數原樣轉給產圖器（不帶 ref）。
  const img = new URLSearchParams();
  img.set('t', t);
  let title, desc, dest;

  if (t === 'wish') {
    const text = q.get('text') || '我許了一個願望';
    const nick = q.get('nick') || '';
    const id = q.get('id') || '';
    img.set('text', text);
    if (nick) img.set('nick', nick);
    title = '去一下 · 心願樹';
    desc = '「' + text + '」— 來幫我打氣 🌿';
    dest = id ? (origin + '/27_wishtree.html?wish=' + encodeURIComponent(id)) : (origin + '/27_wishtree.html');
  } else {
    const name = q.get('name') || '我的種子';
    const pool = q.get('pool') === 'suncar' ? 'suncar' : 'client';
    const champ = q.get('champ') === '1';
    img.set('name', name);
    img.set('pool', pool);
    if (champ) img.set('champ', '1');
    title = '去一下 · 種子收集';
    desc = (champ ? '我集滿種子庫拿到【' + name + '】徽章！' : '我抽到種子【' + name + '】！') + ' 一起來收集、支持平台 🌱';
    dest = ref ? (origin + '/14_signup.html?ref=' + encodeURIComponent(ref)) : (origin + '/');
  }

  const ogImg = origin + '/api/og-image?' + img.toString();

  const html =
    '<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + esc(title) + '</title>' +
    '<meta property="og:type" content="website">' +
    '<meta property="og:title" content="' + esc(title) + '">' +
    '<meta property="og:description" content="' + esc(desc) + '">' +
    '<meta property="og:image" content="' + esc(ogImg) + '">' +
    '<meta property="og:image:width" content="1200">' +
    '<meta property="og:image:height" content="630">' +
    '<meta name="twitter:card" content="summary_large_image">' +
    '<meta name="twitter:image" content="' + esc(ogImg) + '">' +
    '</head><body style="font-family:sans-serif;text-align:center;padding:40px;background:#F3E7CE;color:#3D2914">' +
    '<p>正在帶你前往去一下…</p>' +
    '<p><a href="' + esc(dest) + '">如果沒有自動跳轉，請點這裡</a></p>' +
    "<script>location.replace('" + jsStr(dest) + "');</script>" +
    '</body></html>';

  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' },
  });
}
