// 去一下 QU YI XIA：LINE 官方帳號訊息中轉的「收件兼轉發員」
// 放在 Vercel 的 /api 資料夾，網址即 https://quyixia-web.vercel.app/api/line-webhook
//
// 為什麼用純 Node、不裝任何套件：好維護、部署快、不被第三方套件版本綁住。
// 它做四件事：
//   1. 用 channel secret 驗證這則訊息「真的來自 LINE」，擋掉偽造的灌訊息。
//   2. 有人加官方帳號好友(follow)時，回一句歡迎詞（也用來驗證整條有沒有通）。
//   3. 收到文字訊息，呼叫資料庫的 line_relay_intake 決定要直接送、給提示、或跳按鈕。
//   4. 收到按鈕(postback)，呼叫 line_relay_pick 把剛剛暫存的那句送到使用者選中的那張單。
// 所有「轉給誰」的判斷都集中在資料庫那幾支函式，這支程式只負責驗章與收發，邏輯不散落。

const crypto = require('crypto');

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
const ACCESS_TOKEN   = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const SUPABASE_URL   = process.env.SUPABASE_URL;
const SERVICE_KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY;

const WELCOME =
  '歡迎加入「去一下 QU YI XIA」官方帳號。\n' +
  '媒合成功後，請到訂單頁按「用 LINE 聯絡」，就能透過這裡和對方傳訊息。\n' +
  '同時接多張單時，打字後我會請你點一下這句要傳給哪張單，避免傳錯。\n' +
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

// 回覆並附上「快速按鈕」：讓使用者一點就選定要傳給哪張單
// items = [{ id, label }]，每顆按鈕點下去會回傳 postback data = 'pick:訂單id'
function buildQuickReply(items) {
  const buttons = (items || []).slice(0, 13).map((it) => ({
    type: 'action',
    action: {
      type: 'postback',
      label: it.label,                 // 按鈕上看到的字（LINE 上限 20 字，SQL 端已截斷）
      data: 'pick:' + it.id,           // 點下去回傳這串，webhook 用來認是哪張單
      displayText: '傳給：' + it.label, // 點完後在聊天室顯示這句，讓使用者知道選了哪張
    },
  }));
  return { items: buttons };
}

async function lineReplyWithButtons(replyToken, text, items) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + ACCESS_TOKEN,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: 'text', text, quickReply: buildQuickReply(items) }],
    }),
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

// 呼叫資料庫函式（用 service role 金鑰，跨權限讀寫）
async function callRpc(fnName, args) {
  const resp = await fetch(SUPABASE_URL + '/rest/v1/rpc/' + fnName, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_KEY,
      Authorization: 'Bearer ' + SERVICE_KEY,
    },
    body: JSON.stringify(args),
  });
  if (!resp.ok) return null;
  return await resp.json();
}

// 收到文字訊息：問資料庫要直接送、給提示、還是跳按鈕
async function handleTextMessage(ev) {
  const lineUserId = ev.source && ev.source.userId;
  if (!lineUserId) return;
  const result = await callRpc('line_relay_intake', {
    p_line_user_id: lineUserId,
    p_body: ev.message.text,
  });
  if (!result) {
    await lineReply(ev.replyToken, '系統忙線，請稍後再傳一次。');
  } else if (result.action === 'reply') {
    await lineReply(ev.replyToken, result.text);
  } else if (result.action === 'push') {
    await linePush(result.to, result.text);
  } else if (result.action === 'pick') {
    // 名下有多張進行中的單：跳按鈕讓他選這句要傳給哪一張
    await lineReplyWithButtons(ev.replyToken, result.prompt, result.items);
  }
}

// 收到按鈕：把剛剛暫存的那句送到使用者選中的那張單
async function handlePostback(ev) {
  const lineUserId = ev.source && ev.source.userId;
  const data = (ev.postback && ev.postback.data) || '';
  if (!lineUserId || !data.startsWith('pick:')) return;
  const orderId = data.slice('pick:'.length);
  const result = await callRpc('line_relay_pick', {
    p_line_user_id: lineUserId,
    p_order_id: orderId,
  });
  if (!result) {
    await lineReply(ev.replyToken, '系統忙線，請稍後再試一次。');
  } else if (result.action === 'reply') {
    await lineReply(ev.replyToken, result.text);
  } else if (result.action === 'deliver') {
    // 送一份給對方、回一句確認給寄件者
    await linePush(result.to, result.text);
    await lineReply(ev.replyToken, result.confirm);
  }
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
        await handleTextMessage(ev);
      } else if (ev.type === 'postback') {
        await handlePostback(ev);
      }
    } catch (e) {
      // 單一事件出錯不影響其他事件；無論如何最後都要回 200 給 LINE，否則它會一直重送
    }
  }

  res.status(200).send('OK');
};
