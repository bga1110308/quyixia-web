// api/share.js
// 用途：分享連結的「落地頁」。FB／LINE 等平台抓這頁的 og 標籤顯示預覽卡；
//       真人打開則自動導到目的頁（種子→註冊頁帶推薦碼；心願→心願樹該則願望）。
// 預覽卡圖＝使用者按分享時,瀏覽器把種子卡／心願卡畫好上傳到 Supabase 的那張 PNG。
// 為什麼不在伺服器畫：種子圖是 webp,伺服器產圖器(@vercel/og)解不了 webp;瀏覽器讀 webp 沒問題,
//                  所以直接用瀏覽器畫好的真卡,預覽看到的就跟 App 內一致。
// 這支不裝任何套件(純字串),跟 line-webhook 同級。
//
// 呼叫方式：
//   /api/share?t=seed&name=梅芽&pool=client&ref=ABC123&img=seed/172....png
//   /api/share?t=wish&text=希望順利&id=123&ref=ABC123&img=wish/172....png

export const config = { runtime: 'edge' };

// Supabase 公開儲存桶 share-cards 的網址前綴（公開讀,可寫進檔）。
const CARD_BASE = 'https://zqtvkjijmsumtmkigggk.supabase.co/storage/v1/object/public/share-cards/';

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

  // 預覽卡圖：只接受 share-cards 桶裡的 png 路徑,組成公開網址,擋掉外部網址。
  const imgPath = q.get('img') || '';
  const ogImg = /^(seed|wish)\/[\w.-]+\.png$/.test(imgPath) ? (CARD_BASE + imgPath) : '';

  let title, desc, dest;
  if (t === 'wish') {
    const text = q.get('text') || '我許了一個願望';
    const id = q.get('id') || '';
    title = '去一下 · 心願樹';
    desc = '「' + text + '」— 來幫我打氣 🌿';
    dest = origin + '/27_wishtree.html' + (id ? ('?wish=' + encodeURIComponent(id)) : '');
    if (ref) dest += (id ? '&' : '?') + 'ref=' + encodeURIComponent(ref);
  } else {
    const name = q.get('name') || '我的種子';
    const champ = q.get('champ') === '1';
    title = '去一下 · 種子收集';
    desc = (champ ? '我集滿種子庫拿到【' + name + '】徽章！' : '我抽到種子【' + name + '】！') + ' 一起來收集、支持平台 🌱';
    dest = ref ? (origin + '/14_signup.html?ref=' + encodeURIComponent(ref)) : (origin + '/');
  }

  // 有卡片圖才放 og:image;沒有就只給標題敘述(連結照樣能用,只是沒專屬預覽圖)。
  const ogImageTags = ogImg
    ? ('<meta property="og:image" content="' + esc(ogImg) + '">' +
       '<meta name="twitter:image" content="' + esc(ogImg) + '">' +
       '<meta name="twitter:card" content="summary_large_image">')
    : '<meta name="twitter:card" content="summary">';

  const html =
    '<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + esc(title) + '</title>' +
    '<meta property="og:type" content="website">' +
    '<meta property="og:title" content="' + esc(title) + '">' +
    '<meta property="og:description" content="' + esc(desc) + '">' +
    ogImageTags +
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
