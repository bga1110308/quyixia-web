// 去一下 QU YI XIA · Supabase 共用連線設定
// 用法：每個 HTML 在自己的 script 前先載入這兩行
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
//   <script src="supabase-init.js"></script>
// 之後全站都用 window.sb 來操作資料庫。
//
// 重要：這裡只能放 publishable key（前端公開金鑰）。
// 資料安全是靠六張表的 RLS 在擋，不是靠藏金鑰。
// secret key（service_role）會繞過所有 RLS，絕對不可放進這個檔。

const SUPABASE_URL = 'https://zqtvkjijmsumtmkigggk.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_9iwwv2tGhM8vfQEI4NO0VQ_PQeMTwP-';

// 建立全站共用的連線，後面各頁都用 window.sb
window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
