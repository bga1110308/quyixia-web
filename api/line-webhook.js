// 去一下 QU YI XIA：LINE 官方帳號訊息中轉的「收件兼轉發員」
// 放在 Vercel 的 /api 資料夾，網址即 https://quyixia-web.vercel.app/api/line-webhook
//
// 為什麼用純 Node、不裝任何套件：好維護、部署快、不被第三方套件版本綁住。
// 它做三件事：
//   1. 用 channel secret 驗證這則訊息「真的來自 LINE」，擋掉偽造的灌訊息。
//   2. 有人加官方帳號好友(follow)時，回一句歡迎詞（也用來驗證整條有沒有通）。
//   3. 收到文字訊息，呼叫資料庫的 line_relay_route 決定要轉給誰，再用官方帳號送出。
// 所有「轉給誰」的判斷都集中在資料庫那支函式，這支程式只負責驗章與收發，邏輯不散落。

const crypto = require('crypto');

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
const ACCESS_TOKEN   = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const SUPABASE_URL   = process.env.SUPABASE_URL;
const SERVICE_KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY;

const WELCOME =
  '歡迎加入「去一下 QU YI XIA」官方帳號。\n' +
  '媒合成功後，請到訂單頁按「用 LINE 聯絡」，就能透過這裡和對方傳訊息。\n' +
  '雙方都看不到彼此的私人 LINE，對話也會留存在平台，保障你我。';

// 收集原始內容：驗章一定要用「原封不動」的內容，不能先被解析過，
// 否則重新組出來的字串會跟 LINE 算的對不起來。這支程式全程不碰 req.body，
// 直接讀串流，這是 Vercel 官方知識庫指定的取得原始內容做法。
function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// 用 channel secret 重算簽章，跟 LINE 帶來的 x-line-signature 比對
function verifySignature(rawBody, signature) {
  if (!signature || !CHANNEL_SECRET) return false;
  const expected = crypto
    .createHmac('sha256', CHANNEL_SECRET)
    .update(rawBody)
    .digest('base64');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  // 先比長度，再用等時間比較，避免被用回應時間差猜出簽章
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// 回覆給「傳訊息來的那個人」（免費、用一次性的 replyToken）
async function lineReply(replyToken, text) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + ACCESS_TOKEN,
    },
    body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
  });
}

// 主動推送給「對方」（轉達訊息用，對方不是發事件的人，只能用 push）
async function linePush(to, text) {
  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + ACCESS_TOKEN,
    },
    body: JSON.stringify({ to, messages: [{ type: 'text', text }] }),
  });
}

// 呼叫資料庫的路由函式（用 service role 金鑰，跨權限讀寫，找出該轉給誰）
async function routeMessage(lineUserId, body) {
  const resp = await fetch(SUPABASE_URL + '/rest/v1/rpc/line_relay_route', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_KEY,
      Authorization: 'Bearer ' + SERVICE_KEY,
    },
    body: JSON.stringify({ p_line_user_id: lineUserId, p_body: body }),
  });
  if (!resp.ok) return null;
  return await resp.json();
}

module.exports = async (req, res) => {
  // 瀏覽器直接打開或健康檢查走這裡，回 OK 就好
  if (req.method !== 'POST') {
    res.status(200).send('OK');
    return;
  }

  const rawBody = await readRawBody(req);

  // 驗不過＝不是 LINE 發來的，直接擋掉
  if (!verifySignature(rawBody, req.headers['x-line-signature'])) {
    res.status(401).send('bad signature');
    return;
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch (e) {
    res.status(200).send('OK');
    return;
  }

  const events = payload.events || [];
  for (const ev of events) {
    try {
      if (ev.type === 'follow') {
        await lineReply(ev.replyToken, WELCOME);
      } else if (ev.type === 'message' && ev.message && ev.message.type === 'text') {
        const lineUserId = ev.source && ev.source.userId;
        if (!lineUserId) continue;
        const result = await routeMessage(lineUserId, ev.message.text);
        if (!result) {
          await lineReply(ev.replyToken, '系統忙線，請稍後再傳一次。');
        } else if (result.action === 'reply') {
          await lineReply(ev.replyToken, result.text);
        } else if (result.action === 'push') {
          await linePush(result.to, result.text);
        }
      }
    } catch (e) {
      // 單一事件出錯不影響其他事件；無論如何最後都要回 200 給 LINE，否則它會一直重送
    }
  }

  res.status(200).send('OK');
};
