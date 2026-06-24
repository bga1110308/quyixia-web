// api/og-image.js
// 用途：伺服器即時把資料畫成 1200x630 的分享卡 PNG。
// 為什麼要伺服器畫：①FB／LINE 貼「連結」時要抓得到專屬預覽圖（每顆種子／每則心願都不同）；
//                  ②自動發文機器人不需真人按分享，純伺服器就能生出種子卡。
// v1 先做「文字卡」（品牌＋名稱／內容＋配色），不嵌種子圖片，先確保線上一定畫得出來；
// 種子圖片留 v2 再加（隔離 webp 解碼風險，第一次部署好抓問題）。
//
// 呼叫方式（網址參數）：
//   /api/og-image?t=seed&name=梅芽&pool=client            → 種子卡
//   /api/og-image?t=seed&name=台灣&pool=client&champ=1    → 制霸徽章卡
//   /api/og-image?t=wish&text=希望順利&nick=小美           → 心願卡

import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

// 組 satori 要的元素樹。不用 JSX（純物件），這樣這支檔不需要任何轉譯建置。
function el(type, style, children) {
  return { type, props: { style, children } };
}

// 中文字型：不塞整顆幾 MB 的字型檔，只跟 Google Fonts 要「這張卡會用到的那幾個字」的子集，又輕又快。
// 關鍵：用很舊的 User-Agent，Google 才會回 satori 能用的 TTF；新版瀏覽器會被回 satori 不支援的 woff2。
async function loadFont(text) {
  const api = 'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@700&text=' + encodeURIComponent(text);
  const css = await (await fetch(api, {
    headers: { 'User-Agent': 'Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1)' },
  })).text();
  const m = css.match(/src:\s*url\(([^)]+)\)/);
  if (!m) throw new Error('font subset not found');
  return await (await fetch(m[1])).arrayBuffer();
}

const CREAM = '#F3E7CE';
const CARD = '#FFFCF5';

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
      el('div', { display: 'flex', fontSize: '40px', color: accent, marginBottom: '6px' }, '去一下 · 種子收集'),
      el('div', { display: 'flex', fontSize: '26px', color: '#7A6A52', marginBottom: '28px' }, lead),
      el('div', {
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '300px', height: '300px', borderRadius: '150px', backgroundColor: plate, marginBottom: '24px',
      }, [
        el('div', { display: 'flex', fontSize: '84px', color: '#3D2914', textAlign: 'center' }, name),
      ]),
      el('div', { display: 'flex', fontSize: '30px', color: '#3E9D72' }, '一起來收集種子、支持平台'),
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
      el('div', { display: 'flex', fontSize: '36px', color: '#3E9D72', marginBottom: '30px' }, '去一下 · 心願樹'),
      el('div', {
        display: 'flex', fontSize: big, color: '#3D2914', textAlign: 'center',
        lineHeight: 1.4, maxWidth: '960px', marginBottom: '28px',
      }, text),
      el('div', { display: 'flex', fontSize: '30px', color: '#7A6A52', marginBottom: '20px' }, '— ' + (nick || '一位朋友')),
      el('div', { display: 'flex', fontSize: '28px', color: '#3E9D72' }, '在心願樹許了一個願，來幫我打氣'),
    ]),
  ]);
}

function clip(s, n) { s = (s || '').toString(); return s.length > n ? s.slice(0, n) : s; }

export default async function handler(req) {
  try {
    const q = new URL(req.url).searchParams;
    const t = q.get('t') || 'seed';

    let tree, fontText;
    if (t === 'wish') {
      const text = clip(q.get('text'), 60) || '我許了一個願望';
      const nick = clip(q.get('nick'), 12);
      tree = wishCard(text, nick);
      fontText = text + nick + '去一下心願樹許了一個願來幫我打氣一位朋友';
    } else {
      const name = clip(q.get('name'), 12) || '我的種子';
      const pool = q.get('pool') === 'suncar' ? 'suncar' : 'client';
      const champ = q.get('champ') === '1';
      tree = seedCard(name, pool, champ);
      fontText = name + '去一下種子收集我抽到一顆集滿庫拿徽章一起來支持平台';
    }

    const font = await loadFont(fontText);
    return new ImageResponse(tree, {
      width: 1200, height: 630,
      fonts: [{ name: 'Noto Sans TC', data: font, weight: 700, style: 'normal' }],
    });
  } catch (e) {
    return new Response('og-image error: ' + (e && e.message), { status: 500 });
  }
}
