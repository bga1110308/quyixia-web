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
        return '<div style="background:#fff;border:1px solid rgba(0,0,0,0.08);border-left:4px solid #EF9F27;border-radius:10px;padding:11px 14px;margin-bottom:8px;">'
          + '<div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline;">'
          + '<strong style="font-size:0.92rem;color:#3a3a3a;">'+esc(a.title)+'</strong>'
          + '<span style="font-size:0.7rem;color:#999;white-space:nowrap;">'+esc(d)+'</span></div>'
          + '<div style="font-size:0.82rem;color:#666;line-height:1.6;margin-top:4px;white-space:pre-wrap;">'+esc(a.body)+'</div>'
          + '</div>';
      }).join('');
      box.style.display='';
    }catch(e){ box.style.display='none'; }
  };
})();
