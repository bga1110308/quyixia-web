// 去一下 QU YI XIA：LINE 官方帳號訊息中轉 ＋ AI 客服的「收件兼轉發員」
// 放在 Vercel 的 /api 資料夾，網址即 https://quyixia-web.vercel.app/api/line-webhook
//
// 為什麼用純 Node、不裝任何套件：好維護、部署快、不被第三方套件版本綁住。
// 它做五件事：
//   1. 用 channel secret 驗證這則訊息「真的來自 LINE」，擋掉偽造的灌訊息。
//   2. 有人加官方帳號好友(follow)時，回一句歡迎詞（也用來驗證整條有沒有通）。
//   3. 收到文字訊息，先看是不是「四季限定」關鍵字、再看是不是「客服」開頭；
//      是客服就交給 AI 回答常見問題，都不是才走中轉 line_relay_intake。
//   4. 收到中轉訊息，呼叫 line_relay_intake 決定要直接送、給提示、或跳按鈕。
//   5. 收到按鈕(postback)，呼叫 line_relay_pick 把剛剛暫存的那句送到使用者選中的那張單。
// 所有「轉給誰」的判斷都集中在資料庫那幾支函式，這支程式只負責驗章、收發、與呼叫 AI，邏輯不散落。

const crypto = require('crypto');

const CHANNEL_SECRET   = process.env.LINE_CHANNEL_SECRET;
const ACCESS_TOKEN     = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const SUPABASE_URL     = process.env.SUPABASE_URL;
const SERVICE_KEY      = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// AI 客服用哪個模型：Haiku 便宜又快，客服問答夠用。之後想換更聰明的模型只改這一行。
const AI_MODEL = 'claude-haiku-4-5-20251001';

// 客服觸發字：訊息開頭是這個字就進 AI 客服。
// 為什麼只留「客服」一個、不放「請問/問題」這類：官方帳號主要功能是「中轉配對」，
// 中轉對話裡常出現「請問你到了嗎」這種句子，若拿它當觸發字會把要傳給對方的話
// 誤吃成客服問題、還讓 AI 亂答。日常對話幾乎沒人用「客服」當句子開頭傳給對方，
// 用它當唯一入口誤攔風險趨近零；使用者靠歡迎詞就知道要打「客服」。
const CS_TRIGGERS = ['客服'];

const WELCOME =
  '歡迎加入「去一下 QU YI XIA」官方帳號。\n' +
  '媒合成功後，請到訂單頁按「用 LINE 聯絡」，就能透過這裡和對方傳訊息。\n' +
  '同時接多張單時，打字後我會請你點一下這句要傳給哪張單，避免傳錯。\n' +
  '雙方都看不到彼此的私人 LINE，對話也會留存在平台，保障你我。\n' +
  '\n' +
  '有平台使用問題？直接打「客服」再加上你的問題，例如：客服 怎麼儲值點數。';

// ── AI 客服的背景知識：只教它「去一下平台怎麼用」的正確規則 ──
// 為什麼寫死在這裡：客服只需回答固定的平台規則，不必每次查資料庫，最省成本也最穩。
// 規則若有調整（例如開始收費、改價），回來改這段文字就好，這是單一真相來源。
const FAQ_KNOWLEDGE = `
你是「去一下 QU YI XIA」平台的 LINE 客服助理。請用繁體中文、親切簡短地回答使用者的平台使用問題。

【平台是什麼】
- 去一下是「自費服務的資訊媒合平台」，協助「案家」（需要服務的人）和「順咖」（提供服務的人）互相聯繫。
- 它不是人力派遣，也不是仲介。平台賣的是「資訊」和「平台功能點數」，不從服務報酬抽成。
- 順咖是真人服務者。服務內容、時間、報酬由案家和順咖雙方自行約定，平台不介入、不擔保服務結果。
- 服務類型包含長照居家服務，以及生活服務（打掃、備餐、跑腿、陪同就醫等）。

【用詞規則（你回答時務必遵守）】
- 提供服務的人一律叫「順咖」，不要叫服務員、員工、外送員。
- 需要服務的人一律叫「案家」，不要叫客戶、客人。
- 絕對不要用這些字：派遣、派工、介紹費、人力仲介。

【點數】
- 點數是平台內購買資訊和使用功能的代幣，1 點等於新臺幣 1 元。
- 點數分兩種且完全分開、不能互轉：案家點數給案家用、順咖點數給順咖用。
- 目前是推廣期，全站免費試用中，很多功能暫時免費。

【下單與接單】
- 案家在平台上刊登需求（下單），附近的順咖看到後主動接單、聯繫。
- 媒合成功後，雙方到訂單頁按「用 LINE 聯絡」，就能透過官方帳號中轉傳訊息，看不到彼此的私人 LINE。
- 案家下單付的是「媒合費」，這是平台協助媒合的費用，不是順咖的服務報酬。

【退款規則】
- 還沒有順咖接單前，案家取消訂單：媒合費全額退回點數。
- 系統因「服務時間已過仍無順咖接單」自動取消：媒合費退回點數。
- 已經有順咖接單後案家才取消：媒合費不退（媒合已經完成）。
- 用金幣（回饋幣）折抵的部分，一律不退。

【資格與法律】
- 一般實名（填身分證號）的順咖可以接生活服務類（A 池）。
- 涉及身體照顧的服務（B 池）必須有照顧服務員證照，這是法律規定，沒有證照不能接。
- 涉及成人的服務，未滿 18 歲不能使用。

【回答準則】
- 只回答平台使用相關問題。答案要簡短、口語、好懂，一般兩三句話。
- 不確定、或問題超出平台範圍（例如個人訂單糾紛、醫療、法律專業問題），不要亂猜，請對方來信客服信箱 bga1110308@gmail.com；若涉及人身安全或緊急狀況，請對方直接撥打 110。
- 不要承諾平台沒有的功能，也不要報未定的價格（推廣期免費，未來收費規則未定）。
- 不要提供投資、醫療、法律的專業建議。
`;

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

// 用「Flex 訊息」回覆選單：把選單按鈕做進訊息泡泡裡面
// 為什麼不用快速回覆(quick reply)：那種按鈕官方只在手機 iOS/Android 顯示，
// 桌機等其他用戶端常常看不到。Flex 是訊息本身的一部分，手機、桌機、各版本都穩定顯示，
// 而且過一陣子回頭還能點、不會消失。
// items = [{ id, label }]，每顆按鈕點下去會回傳 postback data = 'pick:訂單id'
function buildPickerFlex(promptText, items) {
  const buttons = (items || []).slice(0, 12).map((it) => ({
    type: 'button',
    style: 'primary',
    height: 'sm',
    color: '#5FB58E', // 順咖綠，符合站內設計
    action: {
      type: 'postback',
      label: it.label,                 // 按鈕上看到的字（SQL 端已截到 20 字內）
      data: 'pick:' + it.id,           // 點下去回傳這串，webhook 用來認是哪張單
      displayText: '傳給：' + it.label, // 點完後在聊天室顯示這句，讓使用者知道選了哪張
    },
  }));
  return {
    type: 'flex',
    altText: '請選擇這句要傳給哪張單',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          { type: 'text', text: promptText, wrap: true, weight: 'bold', size: 'sm' },
          ...buttons,
        ],
      },
    },
  };
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
      messages: [buildPickerFlex(text, items)],
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

// ── AI 客服：把使用者問題＋平台知識丟給 Claude，拿回一句白話回答 ──
// 為什麼把問題長度與回答長度都設上限：AI 按用量收費，
// 限制輸入＋限制輸出＝把每一則的花費壓在可預期的小範圍，避免被灌爆帳單。
async function askFaqAI(question) {
  if (!ANTHROPIC_API_KEY) return null;          // 沒設金鑰＝AI 客服未啟用，交給呼叫端處理
  const q = String(question || '').slice(0, 300); // 問題超過 300 字截斷，控成本
  if (!q.trim()) return null;
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        max_tokens: 500,          // 回答長度上限，控成本；夠寫兩三句白話
        system: FAQ_KNOWLEDGE,
        messages: [{ role: 'user', content: q }],
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    // Claude 回的內容在 content 陣列裡，取所有 text 段落接起來
    const parts = (data && data.content) || [];
    const text = parts.filter((p) => p && p.type === 'text').map((p) => p.text).join('').trim();
    return text || null;
  } catch (e) {
    return null;
  }
}

// 判斷這則訊息是不是要找客服：開頭是 CS_TRIGGERS 任一個就算。
// 回傳「去掉觸發字後的實際問題」；不是客服訊息就回 null。
function extractCsQuestion(text) {
  const t = String(text || '').trim();
  for (const kw of CS_TRIGGERS) {
    if (t.startsWith(kw)) {
      // 去掉開頭關鍵字與後面緊接的標點/空白，留下真正的問題
      return t.slice(kw.length).replace(/^[\s，,、：:！!？?。.]+/, '').trim();
    }
  }
  return null;
}

// 收到文字訊息：季節關鍵字 → 客服關鍵字 → 中轉，三層依序判斷
async function handleTextMessage(ev) {
  const lineUserId = ev.source && ev.source.userId;
  if (!lineUserId) return;
  const text = ev.message.text;

  // 第一層：四季限定領取關鍵字。有對到就回領取連結並結束,不進後面。
  // 關鍵字/連結/開關全在 app_config,由 season_claim_reply 一支函式決定,邏輯不散落。
  const kw = await callRpc('season_claim_reply', { p_text: text });
  if (kw && kw.match) {
    if (kw.reply) await lineReply(ev.replyToken, kw.reply);
    return;
  }

  // 第二層：客服關鍵字。開頭是「客服/請問/我要問/問題」就交給 AI 回答，不進中轉。
  const csQuestion = extractCsQuestion(text);
  if (csQuestion !== null) {
    if (!csQuestion) {
      // 只打了關鍵字、沒有實際問題：引導怎麼問
      await lineReply(ev.replyToken, '請直接打「客服」再加上你的問題，例如：\n客服 怎麼儲值點數\n客服 順咖是什麼');
      return;
    }
    const answer = await askFaqAI(csQuestion);
    if (answer) {
      await lineReply(ev.replyToken, answer + '\n\n（以上為 AI 客服自動回覆。若沒解決，請來信 bga1110308@gmail.com）');
    } else {
      // AI 未啟用或暫時失敗：給人工客服信箱，不讓使用者卡住
      await lineReply(ev.replyToken, '不好意思，客服暫時無法回覆。\n請來信 bga1110308@gmail.com，我們會儘快處理。');
    }
    return;
  }

  // 第三層：都不是，照舊走中轉。
  const result = await callRpc('line_relay_intake', {
    p_line_user_id: lineUserId,
    p_body: text,
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
    // 只把訊息送給對方，不再回確認句給寄件者
    // 為什麼：點按鈕當下聊天室已顯示「傳給：…」當確認，再補一句會干擾對話
    await linePush(result.to, result.text);
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
