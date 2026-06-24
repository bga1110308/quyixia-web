// api/og-image.js
// 用途：伺服器即時把資料畫成 1200x630 的分享卡 PNG。
// 為什麼要伺服器畫：①FB／LINE 貼「連結」時要抓得到專屬預覽圖（每顆種子／每則心願都不同）；
//                  ②自動發文機器人不需真人按分享，純伺服器就能生出種子卡。
// v1 先做「文字卡」（品牌＋名稱／內容＋配色），不嵌種子圖片，先確保線上一定畫得出來。
//
// 呼叫方式（網址參數）：
//   /api/og-image?t=seed&name=梅芽&pool=client            → 種子卡
//   /api/og-image?t=seed&name=台灣&pool=client&champ=1    → 制霸徽章卡
//   /api/og-image?t=wish&text=希望順利&nick=小美           → 心願卡
//   加 &debug=1 → 不畫圖,改回傳診斷 JSON(字型抓到幾位元組、格式對不對),出問題時用。

import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

// 組 satori 要的元素樹。不用 JSX（純物件），這支檔就不需要任何轉譯建置。
function el(type, style, children) {
  return { type, props: { style, children } };
}

// 中文字型：只跟 Google Fonts 要「這張卡會用到的那幾個字」的子集，又輕又快。
// 為什麼不設假的舊瀏覽器標記：用 edge 預設的抓取標記，Google 會直接回產圖器能用的 TTF/OTF；
// 之前誤設成 IE6,Google 改回老格式(EOT),產圖器吃不下,圖就空了。這裡只認 truetype/opentype。
async function loadFont(text) {
  const api = 'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@700&text=' + encodeURIComponent(text);
  const css = await (await fetch(api)).text();
  const m = css.match(/src:\s*url\((.+?)\)\s*format\('(?:opentype|truetype)'\)/);
  if (!m) throw new Error('font subset url not found in css');
  const res = await fetch(m[1]);
  if (res.status !== 200) throw new Error('font file fetch failed: ' + res.status);
  const buf = await res.arrayBuffer();
  if (!buf || buf.byteLength < 1000) throw new Error('font file too small: ' + (buf && buf.byteLength));
  return buf;
}

const CREAM = '#F3E7CE';
const CARD = '#FFFCF5';

// 去掉表情符號等 BMP 以外字元(產圖器沒有 emoji 字型,遇到會整張畫失敗)。
function safeText(s, n) {
  s = (s || '').toString().replace(/[\u{1F000}-\u{1FFFF}\u{2190}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}]/gu, '');
  s = s.replace(/[\uD800-\uDFFF]/g, ''); // 落單的代理字元也清掉
  return s.length > n ? s.slice(0, n) : s;
}

// 種子卡：品牌字 + 圓盤上放種子名 + 一句邀請。配色依池別（順咖綠／案家金）。
function seedCard(name, pool, champ) {
  const suncar = pool === 'suncar';
  const accent = suncar ? '#3E9D72' : '#BA7517';
  const plate = suncar ? '#E9F6EF' : '#FBEFD7';
  const lead = champ ? '集滿種子庫拿到徽章' : '我抽到一顆種子';

  return el('div', {
    width: '1200px', height: '630px', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', backgroundColor: CREAM, padding: '40px',
  }, [
    el('div', {
      width: '1100px', height: '540px', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', backgroundColor: CARD,
      border: '6px solid ' + accent, borderRadius: '36px',
    }, [
      el('div', { display: 'flex', fontSize: '40px', color: accent, marginBottom: '6px' }, '去一下 種子收集'),
      el('div', { display: 'flex', fontSize: '26px', color: '#7A6A52', marginBottom: '28px' }, lead),
      el('div', {
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '320px', height: '320px', borderRadius: '160px', backgroundColor: plate, marginBottom: '24px',
      }, [
        el('div', { display: 'flex', fontSize: '80px', color: '#3D2914' }, name),
      ]),
      el('div', { display: 'flex', fontSize: '30px', color: '#3E9D72' }, '一起來收集種子 支持平台'),
    ]),
  ]);
}

// 心願卡：品牌字 + 願望內容 + 暱稱 + 一句邀請。
function wishCard(text, nick) {
  const big = text.length <= 16 ? '64px' : (text.length <= 32 ? '48px' : '36px');
  return el('div', {
    width: '1200px', height: '630px', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', backgroundColor: CREAM, padding: '40px',
  }, [
    el('div', {
      width: '1100px', height: '540px', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', backgroundColor: CARD,
      border: '6px solid #3E9D72', borderRadius: '36px', padding: '50px',
    }, [
      el('div', { display: 'flex', fontSize: '36px', color: '#3E9D72', marginBottom: '30px' }, '去一下 心願樹'),
      el('div', {
        display: 'flex', fontSize: big, color: '#3D2914',
        lineHeight: '1.4', maxWidth: '960px', textAlign: 'center', marginBottom: '28px',
      }, text),
      el('div', { display: 'flex', fontSize: '30px', color: '#7A6A52', marginBottom: '20px' }, (nick || '一位朋友')),
      el('div', { display: 'flex', fontSize: '28px', color: '#3E9D72' }, '在心願樹許了一個願 來幫我打氣'),
    ]),
  ]);
}

export default async function handler(req) {
  const q = new URL(req.url).searchParams;
  const t = q.get('t') === 'wish' ? 'wish' : 'seed';
  const debug = q.get('debug') === '1';

  // 卡片用字 + 字型子集要涵蓋的所有字（含品牌固定字，避免缺字畫失敗）。
  let tree, fontText;
  if (t === 'wish') {
    const text = safeText(q.get('text'), 60) || '我許了一個願望';
    const nick = safeText(q.get('nick'), 12);
    tree = wishCard(text, nick);
    fontText = text + nick + '去一下 心願樹在許了一個願來幫我打氣位朋友我';
  } else {
    const name = safeText(q.get('name'), 12) || '我的種子';
    const pool = q.get('pool') === 'suncar' ? 'suncar' : 'client';
    const champ = q.get('champ') === '1';
    tree = seedCard(name, pool, champ);
    fontText = name + '去一下 種子收集集滿庫拿到徽章我抽一顆一起來支持平台';
  }

  try {
    const font = await loadFont(fontText);
    if (debug) {
      const head = new Uint8Array(font.slice(0, 4));
      return new Response(JSON.stringify({
        ok: true, type: t, fontBytes: font.byteLength,
        fontHead: Array.from(head), fontText,
      }), { headers: { 'content-type': 'application/json' } });
    }
    return new ImageResponse(tree, {
      width: 1200, height: 630,
      fonts: [{ name: 'Noto Sans TC', data: font, weight: 700, style: 'normal' }],
    });
  } catch (e) {
    return new Response('og-image error: ' + (e && e.message), { status: 500 });
  }
}
