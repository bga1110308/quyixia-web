/* 前台公告顯示(共用一支,index/11/12 各引一行+一個容器+一次呼叫)。
   為什麼共用:同一功能不要散落多處,改一次三頁一起對。
   權限:announcements_public_read 已放行 anon 讀 is_active=true,未登入首頁也讀得到。
   audiences:首頁 ['all']、案家 ['all','client']、順咖 ['all','suncar']。 */
(function(){
  function esc(s){
    return String(s==null?'':s).replace(/[&<>"]/g,function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];
    });
  }
  window.qyxAnnounce = async function(containerId, audiences){
    var box = document.getElementById(containerId);
    if(!box || typeof window.sb === 'undefined') return;
    audiences = audiences || ['all'];
    try{
      var q = await sb.from('announcements')
        .select('title,body,audience,created_at')
        .eq('is_active', true)
        .in('audience', audiences)
        .order('created_at', { ascending:false })
        .limit(5);
      if(q.error || !q.data || !q.data.length){ box.style.display='none'; return; }
      box.innerHTML = q.data.map(function(a){
        var d = (a.created_at||'').slice(0,10);
        return ''
          + '<div style="display:flex;gap:12px;align-items:flex-start;background:rgba(255,255,255,0.72);'
          +   'backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border:1px solid rgba(239,159,39,0.18);'
          +   'border-radius:16px;padding:13px 16px;margin-bottom:10px;box-shadow:0 6px 22px rgba(180,140,60,0.10);">'
          +   '<span style="flex:none;width:32px;height:32px;border-radius:50%;background:rgba(239,159,39,0.12);'
          +     'display:flex;align-items:center;justify-content:center;">'
          +     '<svg viewBox="0 0 24 24" width="16" height="16" fill="#EF9F27" aria-hidden="true">'
          +     '<path d="M18 11v2h3v-2h-3zm-1.5 6.6 2.4 1.8 1.2-1.6-2.4-1.8-1.2 1.6zM19.9 5.2 18.7 3.6l-2.4 1.8 1.2 1.6 2.4-1.8zM4 9c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h1v4h2v-4l9 5V4L7 9H4z"/></svg>'
          +   '</span>'
          +   '<span style="flex:1;min-width:0;">'
          +     '<span style="display:flex;justify-content:space-between;gap:10px;align-items:baseline;">'
          +       '<strong style="font-size:0.9rem;color:#4a3b22;">'+esc(a.title)+'</strong>'
          +       '<span style="font-size:0.68rem;color:#b3a079;white-space:nowrap;">'+esc(d)+'</span>'
          +     '</span>'
          +     '<span style="display:block;font-size:0.8rem;color:#7a6b52;line-height:1.65;margin-top:3px;white-space:pre-wrap;">'+esc(a.body)+'</span>'
          +   '</span>'
          + '</div>';
      }).join('');
      box.style.display='';
    }catch(e){ box.style.display='none'; }
  };
})();
