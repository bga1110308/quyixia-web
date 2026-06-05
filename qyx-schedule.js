/* ============================================================
   去一下 · 全站共用排班表單 (qyx-schedule.js)
   為什麼有這支:03 申請頁與 15 編輯頁的「可上班時段」要永遠一致。
   兩頁都載入這一支、各放一個空容器、呼叫 QYXSchedule.mount() 生成。
   改班表(時段、預設、樣式、一鍵按鈕)只改這一支,兩頁自動連動,不會散成兩份。

   資料格式:scheduleData[時段索引 0..3][星期索引 0..6] = true/false
   時段:0上午 1下午 2晚上 3深夜   星期:0週一 .. 6週日
   存進 user_roles.role_data.schedule(03 送出、15 儲存都用同一個欄位)。
   ============================================================ */
(function(){
  var SLOTS = [
    { name: '上午', range: '6-12' },
    { name: '下午', range: '12-18' },
    { name: '晚上', range: '18-22' },
    { name: '深夜', range: '22-6' }
  ];
  var DAYS = ['週一','週二','週三','週四','週五','週六','週日'];

  // 預設:除深夜外全部可接(上午/下午/晚上 週一到日都勾,深夜不勾)
  function defaultData(){
    return [
      [true,  true,  true,  true,  true,  true,  true ],
      [true,  true,  true,  true,  true,  true,  true ],
      [true,  true,  true,  true,  true,  true,  true ],
      [false, false, false, false, false, false, false]
    ];
  }
  function blankData(){
    return [
      [false,false,false,false,false,false,false],
      [false,false,false,false,false,false,false],
      [false,false,false,false,false,false,false],
      [false,false,false,false,false,false,false]
    ];
  }

  var data = defaultData();
  var containerId = null;

  // 樣式只注入一次。色值寫死(順咖端綠色系),不依賴各頁 CSS 變數,確保兩頁長得一模一樣
  function injectCSS(){
    if(document.getElementById('qyx-schedule-css')) return;
    var css =
      '.qyx-schedule-grid{display:grid;grid-template-columns:auto repeat(7,1fr);gap:6px;margin-top:6px;}'+
      '.qyx-sch-head{font-size:0.74rem;color:#1F4A36;text-align:center;padding:4px 2px;font-weight:600;}'+
      '.qyx-sch-day{font-size:0.78rem;color:#3D2914;font-weight:600;padding:8px 4px;display:flex;align-items:center;gap:4px;white-space:nowrap;}'+
      '.qyx-sch-range{color:#8B7355;font-size:0.66rem;font-weight:400;}'+
      '.qyx-sch-cell{background:#fff;border:1.5px solid rgba(95,181,142,0.3);border-radius:8px;padding:6px 2px;font-size:0.7rem;color:#8B7355;cursor:pointer;text-align:center;transition:all 0.2s;user-select:none;min-height:34px;display:flex;align-items:center;justify-content:center;}'+
      '.qyx-sch-cell:hover{border-color:#2F6048;background:#E8F5EE;}'+
      '.qyx-sch-cell.on{background:linear-gradient(135deg,#5FB58E,#2F6048);border-color:#2F6048;color:#fff;font-weight:600;}'+
      '.qyx-sch-apply-row{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px;}'+
      '.qyx-sch-apply-btn{font-size:0.74rem;padding:6px 12px;background:#fff;border:1.5px solid rgba(95,181,142,0.3);border-radius:99px;color:#2F6048;cursor:pointer;font-family:inherit;font-weight:600;transition:all 0.2s;}'+
      '.qyx-sch-apply-btn:hover{background:#E8F5EE;border-color:#2F6048;}'+
      '@media(max-width:480px){.qyx-schedule-grid{gap:3px;}.qyx-sch-cell{padding:5px 1px;font-size:0.6rem;min-height:28px;}.qyx-sch-head{font-size:0.66rem;padding:3px 1px;}.qyx-sch-day{font-size:0.68rem;padding:4px 2px;}}';
    var st = document.createElement('style');
    st.id = 'qyx-schedule-css';
    st.textContent = css;
    document.head.appendChild(st);
  }

  // 把整個容器(表格 + 一鍵按鈕列)畫出來
  function render(){
    var box = document.getElementById(containerId);
    if(!box) return;
    var html = '<div class="qyx-schedule-grid"><div class="qyx-sch-head"></div>';
    DAYS.forEach(function(d){ html += '<div class="qyx-sch-head">' + d + '</div>'; });
    SLOTS.forEach(function(s, si){
      html += '<div class="qyx-sch-day">' + s.name + ' <span class="qyx-sch-range">' + s.range + '</span></div>';
      DAYS.forEach(function(d, di){
        var on = data[si][di];
        html += '<div class="qyx-sch-cell' + (on ? ' on' : '') + '" data-slot="' + si + '" data-day="' + di + '" onclick="QYXSchedule.toggle(this)">' + (on ? '✓' : '') + '</div>';
      });
    });
    html += '</div>';
    html += '<div class="qyx-sch-apply-row">' +
      '<button type="button" class="qyx-sch-apply-btn" onclick="QYXSchedule.apply(\'all-day\')">全天可接</button>' +
      '<button type="button" class="qyx-sch-apply-btn" onclick="QYXSchedule.apply(\'except-night\')">除深夜可接</button>' +
      '<button type="button" class="qyx-sch-apply-btn" onclick="QYXSchedule.apply(\'weekday-night\')">平日晚上</button>' +
      '<button type="button" class="qyx-sch-apply-btn" onclick="QYXSchedule.apply(\'weekend-day\')">週末白天</button>' +
      '<button type="button" class="qyx-sch-apply-btn" onclick="QYXSchedule.apply(\'clear\')">全部清除</button>' +
      '</div>';
    box.innerHTML = html;
  }

  window.QYXSchedule = {
    // 進頁呼叫:cid=容器 id;initial=DB 存的班表(沒有就用預設除深夜可接)
    mount: function(cid, initial){
      injectCSS();
      containerId = cid;
      // 有帶 DB 班表就用它;沒帶(null)就保留目前的 data(首次=預設除深夜可接),
      // 這樣「切順咖視角」先 mount(null)、之後「載入完 DB」再 mount(真資料) 不會互相洗掉。
      if(Array.isArray(initial) && initial.length === 4){ data = initial.map(function(r){ return r.slice(); }); }
      render();
    },
    // 點一格切換,只改那一格,不重畫整張
    toggle: function(el){
      var si = parseInt(el.dataset.slot, 10);
      var di = parseInt(el.dataset.day, 10);
      data[si][di] = !data[si][di];
      el.classList.toggle('on');
      el.textContent = data[si][di] ? '✓' : '';
    },
    // 一鍵套用
    apply: function(preset){
      if(preset === 'all-day'){ data = [[true,true,true,true,true,true,true],[true,true,true,true,true,true,true],[true,true,true,true,true,true,true],[true,true,true,true,true,true,true]]; }
      else if(preset === 'except-night'){ data = defaultData(); }
      else if(preset === 'weekday-night'){ data = [[false,false,false,false,false,false,false],[false,false,false,false,false,false,false],[true,true,true,true,true,false,false],[false,false,false,false,false,false,false]]; }
      else if(preset === 'weekend-day'){ data = [[false,false,false,false,false,true,true],[false,false,false,false,false,true,true],[false,false,false,false,false,false,false],[false,false,false,false,false,false,false]]; }
      else if(preset === 'clear'){ data = blankData(); }
      render();
    },
    // 送出/儲存時拿目前選的(回傳深拷貝,存進 role_data.schedule)
    get: function(){ return data.map(function(r){ return r.slice(); }); },
    // 外部要灌入資料時用(會重畫)
    set: function(d){ if(Array.isArray(d) && d.length === 4){ data = d.map(function(r){ return r.slice(); }); render(); } }
  };
})();
