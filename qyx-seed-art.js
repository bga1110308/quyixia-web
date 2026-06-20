/* qyx-seed-art.js — 種子寶寶繪圖引擎(全站畫種子都用這支)
 *
 * 為什麼這樣做:350 顆種子若一張張手繪 SVG 不可能好看也養不起。
 * 改成「可組合零件」:身體(body)＋臉表情(face)＋頭飾(hat)＋配件(acc)＋稀有度配色(rarity)＋金額外框(tier)。
 * 每顆種子在 seed_catalog 只存一組精簡設計代碼(art)，這支引擎照代碼組出整隻角色的 SVG。
 * 新增種子＝給一組代碼，不必畫圖。全站(19 圖鑑/揭曉彈窗/漂浮種子櫃)都呼叫 QyxSeedArt.svg()，畫風一致。
 *
 * 用法:QyxSeedArt.svg({ art:{b,f,p,h}, rarity, pool, tier, size, got })
 *   art.b 身體 seed|crystal|ingot|flower   art.f 表情   art.p 配件(道具/場景)   art.h 頭飾
 *   rarity normal|fine|rare|gold(等級,決定配色與星星)   pool client|suncar(普通等級的底色)
 *   tier 金額(30..10000,決定外框華麗度)   size 像素   got 是否已收集(false=灰殼問號)
 *
 * 配件(art.p)分兩層:有些畫在身體後面(場景:船/杯/箱/雲/熱氣球…),有些畫在身體前面(手拿的道具)。
 * 每個配件是一支小函式,回傳 {b:身體後要畫的, f:身體前要畫的};只有手拿道具就只回 f。
 * 要加新配件＝在 ACC 加一支函式即可,不必動組裝流程(符合「新增只給代碼」原則)。
 */
(function(){
  'use strict';

  var INK = '#3D2914';
  var PAL = {
    warm:  { fill:'#E0C29A', stroke:'#B58E5A', hi:'#F4E6CE' },
    green: { fill:'#8FCBA4', stroke:'#3F7E5C', hi:'#D6EEDF' },
    blue:  { fill:'#9CC6E8', stroke:'#3A7CB8', hi:'#E2F0FB' },
    purple:{ fill:'#C3A6E0', stroke:'#8A52C9', hi:'#EEE2F8' },
    gold:  { fill:'#FFD86B', stroke:'#C9962B', hi:'#FFF1C2' },
    lock:  { fill:'#E6DCC6', stroke:'#C9BE9F', hi:'#F2ECDD' }
  };

  /* 常用顏色(配件共用,集中一處好維護) */
  var C = {
    red:'#E8556E', pink:'#F4A8B8', blue:'#6FA8D8', sky:'#9CC6E8', yellow:'#FFC83D',
    green:'#7FBE96', leaf:'#5FB58E', brown:'#A86B2E', wood:'#C58A4A', white:'#fff',
    purple:'#B79AD8', gray:'#9AA0A6', dark:'#4A4A52', coin:'#FFD24D'
  };

  /* 等級決定底色:普通用池色(案家暖/順咖綠)，其餘等級各有專色 */
  function bodyPal(rarity, pool){
    if(rarity === 'fine')  return PAL.blue;
    if(rarity === 'rare')  return PAL.purple;
    if(rarity === 'gold')  return PAL.gold;
    return (pool === 'suncar') ? PAL.green : PAL.warm;
  }

  function sparkle(x, y, s, c){
    var a = s * 0.28;
    return '<path d="M'+x+','+(y-s)+' L'+(x+a)+','+(y-a)+' L'+(x+s)+','+y+' L'+(x+a)+','+(y+a)
         + ' L'+x+','+(y+s)+' L'+(x-a)+','+(y+a)+' L'+(x-s)+','+y+' L'+(x-a)+','+(y-a)+' Z" fill="'+c+'"/>';
  }
  /* 音符(配件常用,抽出來重用) */
  function mnote(x, y, c){
    c = c || '#7A5CC0';
    return '<g fill="'+c+'"><ellipse cx="'+x+'" cy="'+y+'" rx="3.1" ry="2.5" transform="rotate(-18 '+x+' '+y+')"/>'
         + '<rect x="'+(x+2.1)+'" y="'+(y-11)+'" width="1.5" height="11"/>'
         + '<path d="M'+(x+3.6)+','+(y-11)+' q4.5,1 3.5,5.5 q-.6,-2.8 -3.5,-2.8 Z"/></g>';
  }
  /* 氣球(可帶字) */
  function balloon(x, y, c, label){
    var s = '<path d="M'+x+','+(y+29)+' Q'+(x-3)+','+(y+15)+' '+x+','+(y+13)+'" fill="none" stroke="#C9BBA0" stroke-width="1.1"/>'
          + '<ellipse cx="'+x+'" cy="'+y+'" rx="11" ry="13" fill="'+c+'" stroke="rgba(0,0,0,.12)" stroke-width="1"/>'
          + '<path d="M'+(x-5)+','+(y-3)+' a5,6 0 0 1 5,-5" fill="none" stroke="#fff" stroke-width="1.6" opacity=".55"/>'
          + '<path d="M'+x+','+(y+13)+' l-2.4,3 l4.8,0 Z" fill="'+c+'"/>';
    if(label) s += '<text x="'+x+'" y="'+(y+2.6)+'" font-size="5.2" text-anchor="middle" fill="#fff" font-weight="700">'+label+'</text>';
    return s;
  }
  /* 蒸氣(溫泉/木桶/熱飲用) */
  function steam(x, y){
    return '<g fill="none" stroke="#CFE3EE" stroke-width="1.6" stroke-linecap="round" opacity=".85">'
         + '<path d="M'+x+','+y+' q-3,-4 0,-8 q3,-4 0,-8"/>'
         + '<path d="M'+(x+9)+','+y+' q-3,-4 0,-8 q3,-4 0,-8"/></g>';
  }

  /* ---- 身體 ---- 回傳 {body, faceY} faceY=臉要往下移多少 */
  function bodyShape(kind, pal){
    if(kind === 'crystal'){
      return {
        body: '<path d="M0,-30 L16,-6 L9,28 L-9,28 L-16,-6 Z" fill="'+pal.fill+'" stroke="'+pal.stroke+'" stroke-width="2.2"/>'
            + '<path d="M0,-30 L0,28 M-16,-6 L16,-6" stroke="#fff" stroke-width="1.1" opacity="0.45" fill="none"/>',
        faceY: 6
      };
    }
    if(kind === 'ingot'){
      /* 金元寶(船型本體＋左右翹角＋頂部橢圓凸脊),臉畫在船身、往下移 */
      return {
        body: '<path d="M-30,2 C-30,13 -17,17 0,17 C17,17 30,13 30,2 C30,-5 22,-7 14,-8 L-14,-8 C-22,-7 -30,-5 -30,2 Z" fill="'+pal.fill+'" stroke="'+pal.stroke+'" stroke-width="2.2"/>'
            + '<path d="M-14,-8 C-18,-14 -24,-18 -28,-16 C-26,-11 -20,-8 -14,-8 Z" fill="'+pal.fill+'" stroke="'+pal.stroke+'" stroke-width="1.8"/>'
            + '<path d="M14,-8 C18,-14 24,-18 28,-16 C26,-11 20,-8 14,-8 Z" fill="'+pal.fill+'" stroke="'+pal.stroke+'" stroke-width="1.8"/>'
            + '<ellipse cx="0" cy="-8" rx="12" ry="5.5" fill="'+pal.hi+'" stroke="'+pal.stroke+'" stroke-width="1.6"/>',
        faceY: 8
      };
    }
    if(kind === 'flower'){
      var petals = '<g stroke="'+pal.stroke+'" stroke-width="1.8" fill="'+pal.fill+'">'
        + '<ellipse cx="0" cy="-28" rx="8" ry="12"/>'
        + '<ellipse cx="23" cy="-13" rx="8" ry="12" transform="rotate(72 23 -13)"/>'
        + '<ellipse cx="15" cy="15" rx="8" ry="12" transform="rotate(144 15 15)"/>'
        + '<ellipse cx="-15" cy="15" rx="8" ry="12" transform="rotate(216 -15 15)"/>'
        + '<ellipse cx="-23" cy="-13" rx="8" ry="12" transform="rotate(288 -23 -13)"/></g>'
        + '<circle r="18" fill="'+pal.hi+'" stroke="'+pal.stroke+'" stroke-width="2"/>';
      return { body: petals, faceY: 0 };
    }
    /* 預設 seed:胖胖的種子身體(咖啡色種子,左上加柔光澤) */
    return {
      body: '<path d="M0,-28 C22,-26 28,-4 26,10 C24,24 13,30 0,30 C-13,30 -24,24 -26,10 C-28,-4 -22,-26 0,-28 Z" fill="'+pal.fill+'" stroke="'+pal.stroke+'" stroke-width="2"/>'
          + '<ellipse cx="-10" cy="-13" rx="7" ry="10" fill="'+pal.hi+'" opacity="0.5"/>',
      faceY: 0
    };
  }

  /* ---- 表情 ---- */
  function dotEye(cx, cy){
    return '<circle cx="'+cx+'" cy="'+cy+'" r="3.6" fill="'+INK+'"/><circle cx="'+(cx+1.2)+'" cy="'+(cy-1.2)+'" r="1.3" fill="#fff"/>';
  }
  function arcEye(cx, cy){
    return '<path d="M'+(cx-4)+','+cy+' Q'+cx+','+(cy-5)+' '+(cx+4)+','+cy+'" fill="none" stroke="'+INK+'" stroke-width="2" stroke-linecap="round"/>';
  }
  function heartEye(cx, cy){
    return '<g transform="translate('+cx+','+cy+') scale(0.42)"><path d="M0,3 C-2,-3 -9,-2 -9,3 C-9,8 -2,11 0,14 C2,11 9,8 9,3 C9,-2 2,-3 0,3 Z" fill="#E8556E"/></g>';
  }
  function blush(fy, strong){
    var ry = strong ? 3.4 : 2.6, op = strong ? 0.85 : 0.75;
    return '<ellipse cx="-15" cy="'+(6+fy)+'" rx="4.5" ry="'+ry+'" fill="#F29CA8" opacity="'+op+'"/>'
         + '<ellipse cx="15" cy="'+(6+fy)+'" rx="4.5" ry="'+ry+'" fill="#F29CA8" opacity="'+op+'"/>';
  }
  function smile(fy){ return '<path d="M-5,'+(7+fy)+' Q0,'+(12+fy)+' 5,'+(7+fy)+'" fill="none" stroke="'+INK+'" stroke-width="1.8" stroke-linecap="round"/>'; }
  function openMouth(fy){ return '<path d="M-6,'+(7+fy)+' Q0,'+(15+fy)+' 6,'+(7+fy)+' Z" fill="#C2543F"/>'; }
  function angryBrows(){ return '<path d="M-12,-7 L-4,-4" stroke="'+INK+'" stroke-width="1.8" stroke-linecap="round"/><path d="M12,-7 L4,-4" stroke="'+INK+'" stroke-width="1.8" stroke-linecap="round"/>'; }
  /* 生氣青筋符號(類似 💢) */
  function angerMark(x, y){
    return '<g stroke="#D9534F" stroke-width="1.5" fill="none" stroke-linecap="round">'
         + '<path d="M'+x+','+y+' q3,-1 4.5,2"/><path d="M'+(x+6)+','+y+' q-1.5,3 -4.5,2"/>'
         + '<path d="M'+x+','+(y+6)+' q3,1 4.5,-2"/><path d="M'+(x+6)+','+(y+6)+' q-1.5,-3 -4.5,-2"/></g>';
  }

  function face(kind, fy){
    var ey = -2 + fy;
    if(kind === 'wink')
      return dotEye(-8, ey) + '<path d="M4,'+ey+' Q8,'+(ey-4)+' 12,'+ey+'" fill="none" stroke="'+INK+'" stroke-width="2" stroke-linecap="round"/>' + blush(fy) + smile(fy);
    if(kind === 'joy')
      return arcEye(-8, ey) + arcEye(8, ey) + blush(fy) + openMouth(fy);
    if(kind === 'shy')
      return dotEye(-8, ey) + dotEye(8, ey) + blush(fy, true) + '<path d="M-3,'+(9+fy)+' Q0,'+(12+fy)+' 3,'+(9+fy)+'" fill="none" stroke="'+INK+'" stroke-width="1.6" stroke-linecap="round"/>';
    if(kind === 'surprise')
      return '<circle cx="-8" cy="'+ey+'" r="4.2" fill="'+INK+'"/><circle cx="8" cy="'+ey+'" r="4.2" fill="'+INK+'"/><circle cx="-6.6" cy="'+(ey-1.4)+'" r="1.4" fill="#fff"/><circle cx="9.4" cy="'+(ey-1.4)+'" r="1.4" fill="#fff"/>' + blush(fy) + '<ellipse cx="0" cy="'+(10+fy)+'" rx="3" ry="3.6" fill="'+INK+'"/>';
    if(kind === 'content')
      return dotEye(-8, ey) + dotEye(8, ey) + blush(fy) + '<path d="M-5,'+(8+fy)+' Q-2.5,'+(11+fy)+' 0,'+(8+fy)+' Q2.5,'+(11+fy)+' 5,'+(8+fy)+'" fill="none" stroke="'+INK+'" stroke-width="1.6" stroke-linecap="round"/>';
    if(kind === 'heart_eyes')
      return heartEye(-8, ey) + heartEye(8, ey) + blush(fy) + smile(fy);
    if(kind === 'sleepy')
      return '<path d="M-12,'+ey+' Q-8,'+(ey+4)+' -4,'+ey+'" fill="none" stroke="'+INK+'" stroke-width="2" stroke-linecap="round"/><path d="M4,'+ey+' Q8,'+(ey+4)+' 12,'+ey+'" fill="none" stroke="'+INK+'" stroke-width="2" stroke-linecap="round"/>' + blush(fy) + '<path d="M-3,'+(9+fy)+' Q0,'+(11+fy)+' 3,'+(9+fy)+'" fill="none" stroke="'+INK+'" stroke-width="1.4" stroke-linecap="round"/>';
    if(kind === 'cry')
      return dotEye(-8, ey) + dotEye(8, ey) + '<path d="M-8,'+(ey+4)+' q-2,6 0,9 q2,-3 0,-9 Z" fill="#6FB7E8"/>' + blush(fy) + '<ellipse cx="0" cy="'+(10+fy)+'" rx="2.6" ry="3.2" fill="'+INK+'"/>';
    if(kind === 'angry')
      return angryBrows() + dotEye(-8, ey+1) + dotEye(8, ey+1) + blush(fy)
        + '<path d="M-5,'+(13+fy)+' Q0,'+(9+fy)+' 5,'+(13+fy)+'" fill="none" stroke="'+INK+'" stroke-width="1.8" stroke-linecap="round"/>'
        + angerMark(16, -14);
    if(kind === 'mad')   /* 脹紅臉:漲紅+青筋+冒氣 */
      return angryBrows() + dotEye(-8, ey+1) + dotEye(8, ey+1)
        + '<ellipse cx="-15" cy="'+(6+fy)+'" rx="6.5" ry="4.3" fill="#E0564F" opacity="0.55"/><ellipse cx="15" cy="'+(6+fy)+'" rx="6.5" ry="4.3" fill="#E0564F" opacity="0.55"/>'
        + '<path d="M-6,'+(8+fy)+' Q0,'+(15+fy)+' 6,'+(8+fy)+' Z" fill="#C2543F"/>'
        + angerMark(16, -14)
        + '<path d="M-23,-14 q-3,-4 0,-7 M-18,-16 q-3,-4 0,-7" fill="none" stroke="#C9A24B" stroke-width="1.4" stroke-linecap="round" opacity="0.8"/>';
    if(kind === 'hmph')  /* 哼:嘟嘴別過頭 */
      return arcEye(-8, ey) + arcEye(8, ey)
        + '<ellipse cx="-16" cy="'+(6+fy)+'" rx="5.5" ry="3.6" fill="#F29CA8" opacity="0.85"/><ellipse cx="15" cy="'+(6+fy)+'" rx="4" ry="2.4" fill="#F29CA8" opacity="0.7"/>'
        + '<path d="M-3,'+(11+fy)+' Q0,'+(8+fy)+' 3,'+(11+fy)+'" fill="none" stroke="'+INK+'" stroke-width="1.8" stroke-linecap="round"/>'
        + '<path d="M18,'+(2+fy)+' q5,-2 7,1" fill="none" stroke="#B8A485" stroke-width="1.4" stroke-linecap="round"/>';
    if(kind === 'grit')  /* 韌性:咬牙撐住 */
      return '<path d="M-12,-6 L-4,-5" stroke="'+INK+'" stroke-width="1.8" stroke-linecap="round"/><path d="M12,-6 L4,-5" stroke="'+INK+'" stroke-width="1.8" stroke-linecap="round"/>'
        + dotEye(-8, ey+1) + dotEye(8, ey+1) + blush(fy)
        + '<rect x="-7" y="'+(8+fy)+'" width="14" height="5.5" rx="1.6" fill="#fff" stroke="'+INK+'" stroke-width="1.4"/>'
        + '<path d="M-2.5,'+(8+fy)+' L-2.5,'+(13.5+fy)+' M2.5,'+(8+fy)+' L2.5,'+(13.5+fy)+'" stroke="'+INK+'" stroke-width="1.1"/>';
    if(kind === 'tremble')  /* 發抖:兩側抖動線＋冷汗 */
      return dotEye(-7, ey) + dotEye(7, ey) + blush(fy)
        + '<path d="M-5,'+(10+fy)+' q2.5,-3 5,0 q2.5,3 5,0" fill="none" stroke="'+INK+'" stroke-width="1.6" stroke-linecap="round"/>'
        + '<path d="M-31,-4 q-4,5 0,9 M31,-4 q4,5 0,9" fill="none" stroke="#B8A485" stroke-width="1.6" stroke-linecap="round"/>'
        + '<path d="M15,-9 q-2,4 0,6 q2,-2 0,-6 Z" fill="#6FB7E8"/>';
    if(kind === 'bounce')  /* 蹦蹦跳跳:腳下彈跳弧線 */
      return arcEye(-8, ey) + arcEye(8, ey) + blush(fy) + openMouth(fy)
        + '<path d="M-30,30 q4,6 8,1 M22,30 q4,6 8,1" fill="none" stroke="#B8A485" stroke-width="1.6" stroke-linecap="round"/>';
    if(kind === 'star_eyes')  /* 星星眼:崇拜閃亮 */
      return sparkle(-8, ey, 4.6, '#F2C04B') + sparkle(8, ey, 4.6, '#F2C04B') + blush(fy) + openMouth(fy);
    if(kind === 'dizzy')  /* 頭暈冒星:XX 眼＋頭頂繞星 */
      return '<path d="M-11,'+(ey-3)+' l6,6 M-5,'+(ey-3)+' l-6,6" stroke="'+INK+'" stroke-width="1.6" stroke-linecap="round"/>'
        + '<path d="M5,'+(ey-3)+' l6,6 M11,'+(ey-3)+' l-6,6" stroke="'+INK+'" stroke-width="1.6" stroke-linecap="round"/>'
        + blush(fy) + '<ellipse cx="0" cy="'+(10+fy)+'" rx="2.6" ry="3" fill="'+INK+'"/>'
        + sparkle(-14, -30, 3.4, '#F2C04B') + sparkle(2, -34, 3, '#F2C04B') + sparkle(15, -30, 3.4, '#F2C04B');
    /* 預設 happy */
    return dotEye(-8, ey) + dotEye(8, ey) + blush(fy) + smile(fy);
  }

  /* ---- 頭飾(長在頭頂) ---- */
  function hat(kind){
    if(kind === 'sprout')
      return '<path d="M0,-28 C-3,-40 -13,-42 -15,-36 C-9,-34 -3,-32 0,-28 Z" fill="#7FBE96" stroke="#3F7E5C" stroke-width="1.3"/>'
           + '<path d="M0,-28 C3,-40 13,-42 15,-36 C9,-34 3,-32 0,-28 Z" fill="#8FCBA4" stroke="#3F7E5C" stroke-width="1.3"/>';
    if(kind === 'leaf')
      return '<path d="M0,-26 C16,-34 22,-30 20,-24 C12,-24 4,-24 0,-26 Z" fill="#8FCBA4" stroke="#3F7E5C" stroke-width="1.3"/>';
    if(kind === 'flower')
      return '<g stroke="#8A52C9" stroke-width="1.5" fill="#D7C0EE"><ellipse cx="0" cy="-30" rx="6" ry="9"/><ellipse cx="13" cy="-24" rx="6" ry="9" transform="rotate(60 13 -24)"/><ellipse cx="-13" cy="-24" rx="6" ry="9" transform="rotate(-60 -13 -24)"/></g><circle cx="0" cy="-26" r="3.4" fill="#FBE6B0"/>';
    if(kind === 'crown')
      return '<path d="M-16,-26 L-10,-37 L0,-29 L10,-37 L16,-26 Z" fill="#FFE08A" stroke="#C9962B" stroke-width="1.6"/>'
           + '<circle cx="-10" cy="-36" r="2" fill="#fff"/><circle cx="0" cy="-29" r="2" fill="#fff"/><circle cx="10" cy="-36" r="2" fill="#fff"/>';
    if(kind === 'beret')   /* 畫家貝雷帽 */
      return '<ellipse cx="0" cy="-30" rx="17" ry="8" fill="#C2547A" stroke="#8E3A58" stroke-width="1.6"/>'
           + '<circle cx="0" cy="-39" r="2.6" fill="#8E3A58"/>'
           + '<path d="M-16,-29 q16,5 32,0" fill="none" stroke="#8E3A58" stroke-width="1" opacity=".5"/>';
    if(kind === 'schoolcap')  /* 黃色學生帽(鴨舌) */
      return '<path d="M-16,-28 q16,-12 32,0 Z" fill="#FFC83D" stroke="#C99320" stroke-width="1.6"/>'
           + '<path d="M-15,-28 q-7,1 -9,4 q11,2 13,-2 Z" fill="#FFC83D" stroke="#C99320" stroke-width="1.4"/>'
           + '<circle cx="0" cy="-43" r="2.4" fill="#E8A21C"/><line x1="0" y1="-43" x2="0" y2="-39" stroke="#C99320" stroke-width="1.4"/>';
    if(kind === 'tophat')   /* 魔術師禮帽 */
      return '<rect x="-17" y="-31" width="34" height="5" rx="2.5" fill="#2C2C36" stroke="#1A1A22" stroke-width="1.2"/>'
           + '<rect x="-12" y="-46" width="24" height="17" rx="2" fill="#2C2C36" stroke="#1A1A22" stroke-width="1.4"/>'
           + '<rect x="-12" y="-35" width="24" height="4" fill="#C0392B"/>';
    if(kind === 'nightcap')  /* 睡帽 */
      return '<path d="M-15,-27 Q-6,-50 18,-44 Q4,-40 -2,-28 Z" fill="#7EA8D8" stroke="#4E7AB0" stroke-width="1.6"/>'
           + '<circle cx="19" cy="-44" r="3.6" fill="#fff" stroke="#4E7AB0" stroke-width="1.2"/>'
           + '<path d="M-15,-27 q9,4 14,-1" fill="none" stroke="#fff" stroke-width="2.4"/>';
    if(kind === 'headband')  /* 跑步頭巾 */
      return '<path d="M-17,-25 q17,-9 34,0 q-17,4 -34,0 Z" fill="#E0564F" stroke="#B23A34" stroke-width="1.4"/>'
           + '<path d="M16,-24 l9,-3 m-9,5 l9,2" stroke="#E0564F" stroke-width="2.4" stroke-linecap="round"/>';
    if(kind === 'wreath')   /* 花環 */
      return '<g><path d="M-17,-23 A18,18 0 0 1 17,-23" fill="none" stroke="#5FB58E" stroke-width="3.4"/>'
           + '<circle cx="-15" cy="-22" r="3.2" fill="#F7A8C0"/><circle cx="-4" cy="-31" r="3.2" fill="#FFD24D"/>'
           + '<circle cx="8" cy="-31" r="3.2" fill="#F7A8C0"/><circle cx="16" cy="-22" r="3.2" fill="#FFD24D"/>'
           + '<circle cx="2" cy="-33" r="3" fill="#fff"/></g>';
    if(kind === 'hardhat')  /* 工地安全帽 */
      return '<path d="M-17,-26 q17,-13 34,0 Z" fill="#F2B01E" stroke="#C28510" stroke-width="1.6"/>'
           + '<rect x="-19" y="-27" width="38" height="3.4" rx="1.7" fill="#F2B01E" stroke="#C28510" stroke-width="1.2"/>'
           + '<rect x="-3" y="-40" width="6" height="14" rx="1" fill="#FFD05A"/>';
    if(kind === 'partyhat')  /* 慶祝錐形帽 */
      return '<path d="M0,-50 L-11,-26 L11,-26 Z" fill="#FF7AA2" stroke="#D14E78" stroke-width="1.6"/>'
           + '<path d="M-8,-31 l16,0 M-9,-37 l13,0" stroke="#fff" stroke-width="1.6"/>'
           + '<circle cx="0" cy="-50" r="3.2" fill="#FFD24D"/>';
    if(kind === 'ninja')   /* 忍者頭巾＋面罩 */
      return '<path d="M-18,-22 q18,-12 36,0 q-18,3 -36,0 Z" fill="#3A3F4B" stroke="#23262F" stroke-width="1.4"/>'
           + '<path d="M16,-21 l11,-2 m-11,5 l10,3" stroke="#3A3F4B" stroke-width="3" stroke-linecap="round"/>';
    if(kind === 'headphones')  /* 耳機 */
      return '<path d="M-21,2 V-8 A21,21 0 0 1 21,-8 V2" fill="none" stroke="#3A3F4B" stroke-width="3.2" stroke-linecap="round"/>'
           + '<rect x="-26" y="0" width="9" height="13" rx="3.5" fill="#5B6472" stroke="#3A3F4B" stroke-width="1.4"/>'
           + '<rect x="17" y="0" width="9" height="13" rx="3.5" fill="#5B6472" stroke="#3A3F4B" stroke-width="1.4"/>';
    return '';
  }

  /* ============ 配件(art.p) ============
   * 每支回傳 {b, f}:b=畫在身體後面(場景:把種子裝進去/背景),f=畫在身體前面(手拿/臉上).
   * 只有手拿道具的,只回 {f}.  pal=當顆種子的配色(少數配件要跟身體同色,如忍者鏢/皇袍).
   * ⚠ 臉上類(墨鏡/愛心眼鏡/潛水鏡/3D 眼鏡/圓眼鏡)放 f,會蓋在臉之後＝壓在眼睛上,正確.
   */
  var ACC = {
    /* —— 既有道具(沿用,保留向下相容) —— */
    candy: function(p){ return { f:
        '<path d="M24,6 L40,-12" stroke="'+p.stroke+'" stroke-width="2.4" stroke-linecap="round"/>'
      + '<circle cx="43" cy="-16" r="9" fill="#F4A8B8" stroke="#D96A86" stroke-width="1.6"/>'
      + '<path d="M43,-16 m-5,0 a5,5 0 1,1 8,3" fill="none" stroke="#fff" stroke-width="1.4"/>' }; },
    heart: function(){ return { f:
        '<g transform="translate(0,-40) scale(0.7)"><path d="M0,3 C-2,-3 -9,-2 -9,3 C-9,8 -2,11 0,14 C2,11 9,8 9,3 C9,-2 2,-3 0,3 Z" fill="#E8556E"/></g>' }; },
    umbrella: function(){ return { f:
        '<g stroke="#6FA8D8" stroke-width="2" stroke-linecap="round"><line x1="-22" y1="-18" x2="-24" y2="-12"/><line x1="0" y1="-20" x2="-2" y2="-14"/><line x1="22" y1="-18" x2="20" y2="-12"/></g>'
      + '<path d="M-26,-34 A26,26 0 0 1 26,-34 Z" fill="#5E9BD0" stroke="#3A6FA0" stroke-width="1.6"/>'
      + '<path d="M0,-34 L0,-28" stroke="#8B5A2B" stroke-width="2"/><path d="M0,-28 q-4,0 -4,4" fill="none" stroke="#8B5A2B" stroke-width="2"/>' }; },
    sun: function(){ return { f:
        '<circle cx="30" cy="-32" r="8" fill="#FFC83D"/><g stroke="#FFC83D" stroke-width="2" stroke-linecap="round"><line x1="30" y1="-46" x2="30" y2="-42"/><line x1="42" y1="-32" x2="46" y2="-32"/><line x1="39" y1="-41" x2="42" y2="-44"/><line x1="39" y1="-23" x2="42" y2="-20"/></g>' }; },
    glasses: function(){ return { f:
        '<rect x="-14" y="-6" width="11" height="8" rx="3" fill="'+INK+'"/><rect x="3" y="-6" width="11" height="8" rx="3" fill="'+INK+'"/><line x1="-3" y1="-3" x2="3" y2="-3" stroke="'+INK+'" stroke-width="1.6"/>' }; },
    rainbow: function(){ return { f:
        '<g fill="none" stroke-width="3.4"><path d="M-32,8 A32,32 0 0 1 32,8" stroke="#E36B6B"/><path d="M-26,8 A26,26 0 0 1 26,8" stroke="#F2B441"/><path d="M-20,8 A20,20 0 0 1 20,8" stroke="#6FB58E"/></g>' }; },
    cane: function(){ return { f:
        '<path d="M28,-12 C28,-20 40,-20 40,-12 L40,26" fill="none" stroke="#A86B2E" stroke-width="3" stroke-linecap="round"/>' }; },
    coins: function(){ return { f:
        '<g fill="#FFD24D" stroke="#C9962B" stroke-width="1.4"><circle cx="-26" cy="-26" r="6"/><circle cx="0" cy="-36" r="6"/><circle cx="26" cy="-26" r="6"/></g>'
      + '<g fill="#C9962B" font-size="7" text-anchor="middle"><text x="-26" y="-23">$</text><text x="0" y="-33">$</text><text x="26" y="-23">$</text></g>' }; },
    gem: function(){ return { f:
        '<path d="M0,11 L8,18 L0,27 L-8,18 Z" fill="#BFE3F2" stroke="#5AA6C9" stroke-width="1.4"/>' }; },
    pot: function(){ return { b:
        '<path d="M-18,18 L18,18 L14,38 L-14,38 Z" fill="#E0A35E" stroke="#A86B2E" stroke-width="2"/>'
      + '<rect x="-20" y="14" width="40" height="6" rx="2" fill="#EBB877" stroke="#A86B2E" stroke-width="1.6"/>' }; },

    /* —— 手拿 / 臉上類 —— */
    magnifier: function(){ return { f:
        '<line x1="30" y1="20" x2="40" y2="32" stroke="#7A5230" stroke-width="3.4" stroke-linecap="round"/>'
      + '<circle cx="26" cy="12" r="11" fill="#D9F0FA" fill-opacity=".55" stroke="#5A7A8A" stroke-width="3"/>'
      + '<path d="M20,8 a8,8 0 0 1 6,-4" fill="none" stroke="#fff" stroke-width="1.6" opacity=".7"/>' }; },
    newspaper: function(){ return { f:
        '<g transform="rotate(-6 30 6)"><rect x="15" y="-6" width="32" height="24" rx="1.5" fill="#FBF7EC" stroke="#C9B98A" stroke-width="1.4"/>'
      + '<line x1="31" y1="-6" x2="31" y2="18" stroke="#C9B98A" stroke-width="1"/>'
      + '<g stroke="#9AA0A6" stroke-width="1"><line x1="18" y1="0" x2="28" y2="0"/><line x1="18" y1="4" x2="28" y2="4"/><line x1="18" y1="8" x2="28" y2="8"/><line x1="18" y1="12" x2="28" y2="12"/>'
      + '<line x1="34" y1="0" x2="44" y2="0"/><line x1="34" y1="4" x2="44" y2="4"/><line x1="34" y1="8" x2="44" y2="8"/><line x1="34" y1="12" x2="44" y2="12"/></g>'
      + '<rect x="18" y="-4" width="11" height="2.6" fill="#5B6472"/></g>' }; },
    heartglasses: function(){ return { f:
        '<g stroke="#E8556E" stroke-width="1.6" fill="#F8B9C4"><path d="M-13,-3 C-13,-7 -7,-7 -7,-3 C-7,-7 -1,-7 -1,-3 C-1,1 -7,4 -7,5 C-7,4 -13,1 -13,-3 Z"/>'
      + '<path d="M1,-3 C1,-7 7,-7 7,-3 C7,-7 13,-7 13,-3 C13,1 7,4 7,5 C7,4 1,1 1,-3 Z"/></g>'
      + '<line x1="-1" y1="-3" x2="1" y2="-3" stroke="#E8556E" stroke-width="1.6"/>' }; },
    camera: function(){ return { f:
        '<rect x="14" y="-14" width="26" height="18" rx="3" fill="#4A4F5A" stroke="#2C2F38" stroke-width="1.4"/>'
      + '<rect x="20" y="-18" width="9" height="5" rx="1.5" fill="#4A4F5A" stroke="#2C2F38" stroke-width="1.2"/>'
      + '<circle cx="27" cy="-5" r="6" fill="#9CC6E8" stroke="#fff" stroke-width="1.4"/><circle cx="27" cy="-5" r="2.6" fill="#3A6FA0"/>'
      + '<circle cx="37" cy="-11" r="1.6" fill="#FFD24D"/>'
      + sparkle(44, -16, 3.4, '#FFE08A') }; },
    flag: function(p){ return { f:
        '<line x1="22" y1="-30" x2="22" y2="22" stroke="#8B5A2B" stroke-width="2.4" stroke-linecap="round"/>'
      + '<path d="M22,-30 L44,-25 L22,-14 Z" fill="'+p.stroke+'" stroke="'+p.stroke+'" stroke-width="1"/>' }; },
    prideflag: function(){ return { f:
        '<line x1="20" y1="-30" x2="20" y2="22" stroke="#7A5230" stroke-width="2.4" stroke-linecap="round"/>'
      + '<g stroke-width="2.6"><path d="M20,-27 h22" stroke="#E36B6B"/><path d="M20,-24 h22" stroke="#EE8B3C"/><path d="M20,-21 h22" stroke="#F2C744"/><path d="M20,-18 h22" stroke="#6FB58E"/><path d="M20,-15 h22" stroke="#5E9BD0"/><path d="M20,-12 h22" stroke="#9B6FC0"/></g>' }; },
    scarf: function(){ return { f:
        '<path d="M-16,15 q16,9 32,0 q-3,7 -16,8 q-13,-1 -16,-8 Z" fill="#E0564F" stroke="#B23A34" stroke-width="1.4"/>'
      + '<path d="M14,21 l7,14 l5,-2 l-6,-14 Z" fill="#E0564F" stroke="#B23A34" stroke-width="1.4"/>'
      + '<path d="M15,27 l8,2 m-9,2 l8,2" stroke="#fff" stroke-width="1" opacity=".6"/>' }; },
    sing: function(){ return { f:
        mnote(30, -16, '#7A5CC0') + mnote(40, -26, '#E8826E') + mnote(22, -28, '#3A7CB8') }; },
    mic: function(){ return { f:
        '<line x1="34" y1="22" x2="26" y2="2" stroke="#3A3F4B" stroke-width="3" stroke-linecap="round"/>'
      + '<circle cx="24" cy="-4" r="8" fill="#5B6472" stroke="#2C2F38" stroke-width="1.4"/>'
      + '<path d="M20,-7 h8 M19,-4 h10 M20,-1 h8" stroke="#2C2F38" stroke-width="1"/>'
      + mnote(40, -16, '#7A5CC0') }; },
    notes: function(){ return { f: mnote(28, -20, '#7A5CC0') + mnote(40, -10, '#E8826E') }; },
    painting: function(){ return { f:
        '<path d="M-40,12 a13,11 0 1 0 0,-2 Z" fill="#F2E4C8" stroke="#B79B6E" stroke-width="1.6"/>'
      + '<circle cx="-44" cy="3" r="2.4" fill="#E36B6B"/><circle cx="-37" cy="0" r="2.4" fill="#5E9BD0"/><circle cx="-46" cy="11" r="2.4" fill="#F2C744"/><circle cx="-37" cy="11" r="2.4" fill="#6FB58E"/>'
      + '<line x1="30" y1="22" x2="44" y2="-6" stroke="#A86B2E" stroke-width="2.4" stroke-linecap="round"/><path d="M44,-6 l3,-5 l-5,2 Z" fill="#E36B6B"/>' }; },
    rabbit: function(){ return { f:
        '<g fill="#fff" stroke="#C9B9A6" stroke-width="1.4"><ellipse cx="2" cy="22" rx="11" ry="9"/>'
      + '<ellipse cx="-3" cy="9" rx="2.6" ry="6"/><ellipse cx="4" cy="9" rx="2.6" ry="6"/></g>'
      + '<path d="M-3,8 v4 M4,8 v4" stroke="#F4A8B8" stroke-width="1.4"/>'
      + '<circle cx="-1" cy="21" r="1.4" fill="'+INK+'"/><circle cx="6" cy="21" r="1.4" fill="'+INK+'"/><circle cx="2.5" cy="24" r="1.6" fill="#F4A8B8"/>' }; },
    cat: function(){ return { f:
        '<g fill="#F2B24C" stroke="#C98A2E" stroke-width="1.4"><ellipse cx="2" cy="23" rx="11" ry="9"/>'
      + '<path d="M-6,17 l-1,-6 l5,3 Z"/><path d="M10,17 l1,-6 l-5,3 Z"/></g>'
      + '<circle cx="-2" cy="22" r="1.4" fill="'+INK+'"/><circle cx="6" cy="22" r="1.4" fill="'+INK+'"/>'
      + '<path d="M2,24 l0,2 M-3,25 h-4 M7,25 h4" stroke="'+INK+'" stroke-width="0.9"/>' }; },
    dumbbell: function(){ return { f:
        '<g stroke="#3A3F4B" stroke-width="2.2" stroke-linecap="round"><line x1="-40" y1="-30" x2="40" y2="-30"/></g>'
      + '<g fill="#5B6472" stroke="#2C2F38" stroke-width="1.2"><rect x="-44" y="-37" width="6" height="14" rx="2"/><rect x="-37" y="-35" width="5" height="10" rx="2"/>'
      + '<rect x="38" y="-37" width="6" height="14" rx="2"/><rect x="32" y="-35" width="5" height="10" rx="2"/></g>' }; },
    idea: function(){ return { f:
        '<circle cx="0" cy="-40" r="8.5" fill="#FFF1B8" stroke="#E5B93C" stroke-width="1.6"/>'
      + '<rect x="-3.5" y="-33" width="7" height="4" rx="1" fill="#9AA0A6"/>'
      + '<path d="M-2,-42 q2,3 4,0" fill="none" stroke="#E5B93C" stroke-width="1.2"/>'
      + '<g stroke="#FFC83D" stroke-width="1.8" stroke-linecap="round"><line x1="-13" y1="-46" x2="-16" y2="-49"/><line x1="13" y1="-46" x2="16" y2="-49"/><line x1="0" y1="-52" x2="0" y2="-55"/></g>' }; },
    clover: function(){ return { f:
        '<g fill="#5FB58E" stroke="#3F7E5C" stroke-width="1.2"><path d="M30,-20 q-7,-7 0,-9 q7,2 0,9 Z"/><path d="M30,-20 q7,-7 9,0 q-2,7 -9,0 Z"/>'
      + '<path d="M30,-20 q7,7 0,9 q-7,-2 0,-9 Z"/><path d="M30,-20 q-7,7 -9,0 q2,-7 9,0 Z"/></g>'
      + '<line x1="30" y1="-20" x2="33" y2="2" stroke="#3F7E5C" stroke-width="1.6"/>' }; },
    divemask: function(){ return { f:
        '<rect x="-15" y="-9" width="30" height="14" rx="7" fill="#BFE9F5" fill-opacity=".5" stroke="#2C7DA0" stroke-width="2.4"/>'
      + '<path d="M-17,-2 h-4 M17,-2 h4" stroke="#2C7DA0" stroke-width="2.4" stroke-linecap="round"/>' }; },
    snorkel: function(){ return { f:
        '<rect x="-15" y="-9" width="30" height="14" rx="7" fill="#BFE9F5" fill-opacity=".5" stroke="#2C7DA0" stroke-width="2.4"/>'
      + '<path d="M15,-6 q9,-2 9,-12 v-8" fill="none" stroke="#E0564F" stroke-width="3" stroke-linecap="round"/>'
      + '<rect x="22" y="-30" width="4.5" height="6" rx="2" fill="#E0564F"/>' }; },
    drink: function(){ return { f:
        '<path d="M22,-2 l4,24 q1,4 5,4 q4,0 5,-4 l4,-24 Z" fill="#FBE3A0" stroke="#D9A93C" stroke-width="1.4"/>'
      + '<path d="M22,-2 h18" stroke="#D9A93C" stroke-width="1.4"/>'
      + '<line x1="36" y1="-12" x2="33" y2="2" stroke="#E36B6B" stroke-width="2.2" stroke-linecap="round"/>'
      + '<ellipse cx="31" cy="3" rx="6" ry="2" fill="#fff" opacity=".5"/>' }; },
    balloon: function(){ return { f: balloon(34, -30, '#E8556E') }; },
    starballoon: function(){ return { f:
        '<path d="M34,-43 Q31,-30 34,-28" fill="none" stroke="#C9BBA0" stroke-width="1.1"/>'
      + sparkle(34, -36, 13, '#F2C744') + sparkle(34, -36, 9, '#FFE08A') }; },
    mirror: function(){ return { f:
        '<ellipse cx="30" cy="-8" rx="11" ry="13" fill="#DFF1FA" stroke="#9AA0A6" stroke-width="2.4"/>'
      + '<path d="M24,-12 a7,8 0 0 1 6,-5" fill="none" stroke="#fff" stroke-width="2" opacity=".8"/>'
      + '<line x1="30" y1="5" x2="30" y2="24" stroke="#B07A3C" stroke-width="3.4" stroke-linecap="round"/>'
      + sparkle(40, -16, 3.4, '#fff') }; },
    letter: function(){ return { f:
        '<rect x="18" y="-8" width="26" height="18" rx="2" fill="#FFFDF5" stroke="#C9B98A" stroke-width="1.4"/>'
      + '<path d="M18,-7 L31,3 L44,-7" fill="none" stroke="#C9B98A" stroke-width="1.2"/>'
      + '<g transform="translate(31,1) scale(0.34)"><path d="M0,3 C-2,-3 -9,-2 -9,3 C-9,8 -2,11 0,14 C2,11 9,8 9,3 C9,-2 2,-3 0,3 Z" fill="#E8556E"/></g>' }; },
    cookie: function(){ return { f:
        '<circle cx="30" cy="2" r="11" fill="#E0B060" stroke="#B07A3C" stroke-width="1.6"/>'
      + '<g fill="#5A3A22"><circle cx="26" cy="-2" r="1.6"/><circle cx="33" cy="-1" r="1.6"/><circle cx="28" cy="5" r="1.6"/><circle cx="34" cy="6" r="1.6"/><circle cx="30" cy="1" r="1.4"/></g>'
      + '<path d="M19,3 a11,11 0 0 0 6,9" fill="#C99A52"/>' }; },
    pompom: function(){ return { f:
        '<g fill="#FF7AA2" stroke="#D14E78" stroke-width="1"><circle cx="-30" cy="-24" r="3"/><circle cx="-36" cy="-22" r="3"/><circle cx="-33" cy="-29" r="3"/><circle cx="-27" cy="-29" r="3"/><circle cx="-31" cy="-19" r="3"/></g>'
      + '<line x1="-31" y1="-24" x2="-26" y2="-12" stroke="#D14E78" stroke-width="2"/>'
      + '<g fill="#5E9BD0" stroke="#3A6FA0" stroke-width="1"><circle cx="32" cy="-24" r="3"/><circle cx="38" cy="-22" r="3"/><circle cx="35" cy="-29" r="3"/><circle cx="29" cy="-29" r="3"/><circle cx="33" cy="-19" r="3"/></g>'
      + '<line x1="33" y1="-24" x2="28" y2="-12" stroke="#3A6FA0" stroke-width="2"/>' }; },
    popcorn: function(){ return { f:
        /* 3D 眼鏡(臉上)＋爆米花桶(手邊) */
        '<rect x="-14" y="-6" width="11" height="8" rx="1.5" fill="#E0564F" fill-opacity=".75" stroke="'+INK+'" stroke-width="1.4"/>'
      + '<rect x="3" y="-6" width="11" height="8" rx="1.5" fill="#3A7CB8" fill-opacity=".75" stroke="'+INK+'" stroke-width="1.4"/>'
      + '<line x1="-3" y1="-3" x2="3" y2="-3" stroke="'+INK+'" stroke-width="1.6"/>'
      + '<path d="M24,2 l3,22 h14 l3,-22 Z" fill="#fff" stroke="#D14E78" stroke-width="1.4"/>'
      + '<path d="M24,2 v22 M31,2 v22 M38,2 v22" stroke="#E0564F" stroke-width="2"/>'
      + '<g fill="#FBE3A0" stroke="#E5C264" stroke-width="0.8"><circle cx="27" cy="-1" r="3"/><circle cx="33" cy="-3" r="3"/><circle cx="39" cy="-1" r="3"/><circle cx="31" cy="2" r="2.6"/><circle cx="36" cy="2" r="2.6"/></g>' }; },
    megaphone: function(){ return { f:
        '<path d="M24,-2 L42,-12 L42,12 L24,6 Z" fill="#E0564F" stroke="#B23A34" stroke-width="1.6"/>'
      + '<rect x="20" y="-3" width="6" height="8" rx="2" fill="#C04A44"/>'
      + '<line x1="32" y1="-7" x2="32" y2="3" stroke="#fff" stroke-width="1" opacity=".5"/>'
      + '<g stroke="#FFC83D" stroke-width="1.8" stroke-linecap="round"><line x1="45" y1="-6" x2="50" y2="-9"/><line x1="46" y1="0" x2="51" y2="0"/><line x1="45" y1="6" x2="50" y2="9"/></g>' }; },
    blueprint: function(){ return { f:
        '<rect x="18" y="-8" width="26" height="18" rx="1.5" fill="#3A6FA0" stroke="#27507A" stroke-width="1.4"/>'
      + '<g stroke="#BFD8EE" stroke-width="1" fill="none"><rect x="22" y="-4" width="9" height="9"/><path d="M33,-4 h7 M33,0 h7 M33,4 h5"/></g>' }; },
    robe: function(){ return { b:
        '<path d="M-26,6 Q-40,30 -34,44 L-22,40 Q-26,22 -20,10 Z" fill="#9B2D3A" stroke="#6E1E28" stroke-width="1.6"/>'
      + '<path d="M26,6 Q40,30 34,44 L22,40 Q26,22 20,10 Z" fill="#9B2D3A" stroke="#6E1E28" stroke-width="1.6"/>'
      + '<g fill="#fff"><circle cx="-30" cy="40" r="1.5"/><circle cx="-24" cy="42" r="1.5"/><circle cx="30" cy="40" r="1.5"/><circle cx="24" cy="42" r="1.5"/></g>' }; },
    hiking: function(){ return { f:
        '<rect x="22" y="-2" width="16" height="20" rx="4" fill="#5FB58E" stroke="#3F7E5C" stroke-width="1.6"/>'
      + '<rect x="25" y="2" width="10" height="6" rx="2" fill="#3F7E5C"/>'
      + '<path d="M22,2 q-6,2 -6,12" fill="none" stroke="#3F7E5C" stroke-width="2"/>'
      + '<line x1="-26" y1="-6" x2="-30" y2="26" stroke="#8B5A2B" stroke-width="2.4" stroke-linecap="round"/>' }; },
    star: function(){ return { f:
        '<line x1="30" y1="22" x2="34" y2="-8" stroke="#C9962B" stroke-width="2.4" stroke-linecap="round"/>'
      + sparkle(34, -16, 12, '#F2C744') + sparkle(34, -16, 8, '#FFE08A') }; },
    guitar: function(){ return { f:
        '<line x1="14" y1="14" x2="40" y2="-22" stroke="#7A5230" stroke-width="2.4" stroke-linecap="round"/>'
      + '<rect x="38" y="-30" width="6" height="10" rx="1.5" fill="#5A3A22"/>'
      + '<path d="M14,8 a9,11 0 1 0 8,10 a7,8 0 1 0 -8,-10 Z" fill="#C58A4A" stroke="#8B5A2B" stroke-width="1.6"/>'
      + '<circle cx="17" cy="14" r="3" fill="#5A3A22"/>'
      + mnote(40, -8, '#7A5CC0') + mnote(46, -20, '#E8826E') }; },
    bouquet: function(){ return { f:
        '<g stroke="#3F7E5C" stroke-width="1.6"><line x1="30" y1="20" x2="30" y2="-6"/><line x1="30" y1="6" x2="24" y2="-4"/><line x1="30" y1="6" x2="36" y2="-4"/></g>'
      + '<g fill="#F7A8C0" stroke="#D14E78" stroke-width="1"><circle cx="24" cy="-8" r="4.5"/><circle cx="36" cy="-8" r="4.5"/><circle cx="30" cy="-13" r="4.8"/></g>'
      + '<circle cx="30" cy="-10" r="1.8" fill="#FFD24D"/>'
      + '<g transform="translate(42,-20) scale(0.3)"><path d="M0,3 C-2,-3 -9,-2 -9,3 C-9,8 -2,11 0,14 C2,11 9,8 9,3 C9,-2 2,-3 0,3 Z" fill="#E8556E"/></g>'
      + '<g transform="translate(18,-16) scale(0.26)"><path d="M0,3 C-2,-3 -9,-2 -9,3 C-9,8 -2,11 0,14 C2,11 9,8 9,3 C9,-2 2,-3 0,3 Z" fill="#E8556E"/></g>' }; },
    question: function(){ return { f:
        '<text x="34" y="-14" font-size="26" font-weight="800" fill="#5E9BD0" font-family="sans-serif">?</text>' }; },
    donut: function(){ return { f:
        '<circle cx="30" cy="2" r="11" fill="#E8A36A" stroke="#C07A3C" stroke-width="1.4"/>'
      + '<path d="M20,-1 a11,11 0 0 1 20,0 a11,11 0 0 1 -20,0 Z" fill="#F7B5C8"/>'
      + '<circle cx="30" cy="2" r="4" fill="#FFFDF5" stroke="#C07A3C" stroke-width="1.2"/>'
      + '<g stroke-width="1.6" stroke-linecap="round"><line x1="24" y1="-3" x2="25" y2="-5" stroke="#FFD24D"/><line x1="35" y1="-3" x2="36" y2="-5" stroke="#6FB58E"/><line x1="33" y1="8" x2="34" y2="10" stroke="#5E9BD0"/><line x1="26" y1="7" x2="25" y2="9" stroke="#E36B6B"/></g>' }; },
    shuriken: function(){ return { f:
        '<g transform="translate(34,-14)" fill="#9AA0A6" stroke="#5B6472" stroke-width="1.2">'
      + '<path d="M0,-10 L3,-3 L10,0 L3,3 L0,10 L-3,3 L-10,0 L-3,-3 Z"/></g>'
      + '<circle cx="34" cy="-14" r="2.2" fill="#3A3F4B"/>' }; },
    pencil: function(){ return { f:
        '<g transform="rotate(35 32 0)"><rect x="28" y="-22" width="8" height="34" rx="1.5" fill="#FFC83D" stroke="#D9A93C" stroke-width="1.2"/>'
      + '<path d="M28,-22 L32,-30 L36,-22 Z" fill="#F2D9B0" stroke="#C9A24B" stroke-width="1"/>'
      + '<path d="M30,-26 L32,-29 L34,-26 Z" fill="#3A3F4B"/>'
      + '<rect x="28" y="9" width="8" height="4" fill="#F4A8B8"/></g>' }; },
    conductor: function(){ return { f:
        /* 圓眼鏡(臉上)＋指揮棒(手邊) */
        '<circle cx="-8" cy="-2" r="6" fill="none" stroke="'+INK+'" stroke-width="1.8"/>'
      + '<circle cx="8" cy="-2" r="6" fill="none" stroke="'+INK+'" stroke-width="1.8"/>'
      + '<line x1="-2" y1="-2" x2="2" y2="-2" stroke="'+INK+'" stroke-width="1.6"/>'
      + '<line x1="24" y1="14" x2="44" y2="-12" stroke="#C9B98A" stroke-width="2" stroke-linecap="round"/><circle cx="24" cy="14" r="2.6" fill="#7A5230"/>'
      + mnote(44, -20, '#7A5CC0') }; },
    spin: function(){ return { f:
        '<path d="M-32,8 a30,18 0 0 1 64,0" fill="none" stroke="#C9BBA0" stroke-width="2" stroke-linecap="round" stroke-dasharray="3 4"/>'
      + '<path d="M30,4 l4,4 l-5,3 Z" fill="#C9BBA0"/>'
      + mnote(34, -26, '#7A5CC0') + mnote(-32, -20, '#E8826E') }; },
    loveballoon: function(){ return { f:
        '<path d="M34,-25 Q31,-12 34,-10" fill="none" stroke="#C9BBA0" stroke-width="1.1"/>'
      + '<g transform="translate(34,-32) scale(1.6)"><path d="M0,3 C-2,-3 -9,-2 -9,3 C-9,8 -2,11 0,14 C2,11 9,8 9,3 C9,-2 2,-3 0,3 Z" fill="#E8556E"/></g>'
      + '<text x="34" y="-28" font-size="5" text-anchor="middle" fill="#fff" font-weight="700">LOVE</text>' }; },
    trophy: function(){ return { f:
        '<path d="M22,-22 h20 v6 a10,10 0 0 1 -20,0 Z" fill="#FFD24D" stroke="#C9962B" stroke-width="1.6"/>'
      + '<path d="M22,-19 q-6,0 -6,-6 M42,-19 q6,0 6,-6" fill="none" stroke="#C9962B" stroke-width="1.6"/>'
      + '<rect x="29" y="-7" width="6" height="6" fill="#E5B93C"/><rect x="24" y="-1" width="16" height="4" rx="1" fill="#C9962B"/>'
      + '<text x="32" y="-12" font-size="7" text-anchor="middle" fill="#C9962B" font-weight="700">1</text>'
      + sparkle(46, -22, 3.4, '#FFF1C2') }; },
    confetti: function(){ return { f:
        '<g><rect x="-34" y="-30" width="4" height="4" fill="#E36B6B" transform="rotate(20 -32 -28)"/>'
      + '<rect x="34" y="-26" width="4" height="4" fill="#5E9BD0" transform="rotate(-15 36 -24)"/>'
      + '<rect x="-28" y="-12" width="4" height="4" fill="#6FB58E" transform="rotate(30 -26 -10)"/>'
      + '<rect x="38" y="-8" width="4" height="4" fill="#FFC83D" transform="rotate(10 40 -6)"/>'
      + '<rect x="-40" y="2" width="4" height="4" fill="#9B6FC0" transform="rotate(-20 -38 4)"/>'
      + '<path d="M30,8 l3,3 M-32,-2 l3,3 M28,-20 l3,3" stroke="#FFD24D" stroke-width="1.6" stroke-linecap="round"/></g>' }; },

    /* —— 場景類(身體裝進去 / 背景) —— */
    parachute: function(){ return {
      b: '<path d="M-34,-30 A34,30 0 0 1 34,-30 Z" fill="#E07A66" stroke="#B7503C" stroke-width="1.8"/>'
       + '<path d="M-34,-30 q11,8 11,0 M-11,-30 q11,8 11,0 M12,-30 q11,8 10,0" fill="#EE9A86" stroke="#B7503C" stroke-width="1.4"/>',
      f: '<g stroke="#B7503C" stroke-width="1.4"><line x1="-30" y1="-28" x2="-14" y2="-2"/><line x1="-10" y1="-30" x2="-6" y2="-4"/><line x1="11" y1="-30" x2="6" y2="-4"/><line x1="30" y1="-28" x2="14" y2="-2"/></g>' }; },
    hotspring: function(){ return {
      b: '<ellipse cx="0" cy="22" rx="40" ry="16" fill="#B7E3EF" stroke="#79B6C9" stroke-width="2"/>'
       + steam(-12, 0) + steam(12, 0),
      f: '<path d="M-37,18 a37,12 0 0 0 74,0 a37,16 0 0 1 -74,0 Z" fill="#9BD4E5" opacity=".88"/>'
       + '<path d="M-30,16 q6,3 12,0 q6,-3 12,0 q6,3 12,0" fill="none" stroke="#fff" stroke-width="1.4" opacity=".6"/>'
       + '<g fill="#F2B5C4" stroke="#D98AA0" stroke-width="0.8"><circle cx="-22" cy="16" r="2.4"/></g>' }; },
    egg: function(){ return {
      b: '<path d="M-22,38 Q-26,8 0,8 Q26,8 22,38 Z" fill="#FFFBF0" stroke="#D9C8A0" stroke-width="2"/>',
      f: '<path d="M-22,20 l6,-6 l5,6 l6,-7 l5,7 l6,-6 l5,6 l5,-5 v23 h-49 Z" fill="#FFFBF0" stroke="#D9C8A0" stroke-width="2"/>'
       + '<g fill="#E9D9B0"><circle cx="-10" cy="30" r="1.6"/><circle cx="8" cy="32" r="1.6"/></g>' }; },
    boat: function(){ return {
      b: '<line x1="0" y1="-6" x2="0" y2="-34" stroke="#8B5A2B" stroke-width="2.4"/>'
       + '<path d="M2,-34 L2,-14 L20,-22 Z" fill="#EFD9A0" stroke="#C9A24B" stroke-width="1.4"/>',
      f: '<path d="M-34,20 L34,20 L26,40 Q0,46 -26,40 Z" fill="#C58A4A" stroke="#8B5A2B" stroke-width="2"/>'
       + '<path d="M-34,20 L34,20" stroke="#8B5A2B" stroke-width="1.4"/>'
       + '<path d="M-40,42 q8,5 16,0 M8,42 q8,5 16,0" fill="none" stroke="#79B6C9" stroke-width="1.8" stroke-linecap="round"/>' }; },
    surf: function(){ return {
      b: '<path d="M-44,30 q14,-10 26,0 q-14,8 -26,0 Z" fill="#79B6C9" opacity=".8"/>'
       + '<path d="M-44,28 q8,-8 16,-4" fill="none" stroke="#fff" stroke-width="2"/>',
      f: '<ellipse cx="2" cy="36" rx="30" ry="8" fill="#E0564F" stroke="#B23A34" stroke-width="1.8"/>'
       + '<line x1="-26" y1="36" x2="30" y2="36" stroke="#fff" stroke-width="1.4"/>'
       + '<path d="M30,38 q10,3 18,-2" fill="none" stroke="#79B6C9" stroke-width="2" stroke-linecap="round"/>' }; },
    beachchair: function(){ return {
      b: '<circle cx="34" cy="-32" r="7" fill="#FFC83D"/><g stroke="#FFC83D" stroke-width="1.8" stroke-linecap="round"><line x1="34" y1="-44" x2="34" y2="-41"/><line x1="44" y1="-32" x2="47" y2="-32"/><line x1="41" y1="-39" x2="43" y2="-41"/></g>',
      f: '<path d="M-34,40 L-6,40 L-22,16 Z" fill="#5E9BD0" stroke="#3A6FA0" stroke-width="1.8"/>'
       + '<line x1="-34" y1="40" x2="20" y2="40" stroke="#3A6FA0" stroke-width="2.4" stroke-linecap="round"/>'
       + '<line x1="-6" y1="40" x2="20" y2="34" stroke="#5E9BD0" stroke-width="4" stroke-linecap="round"/>' }; },
    campfire: function(){ return {
      b: '<g fill="#F2A03C"><path d="M0,40 C-8,30 -8,22 0,14 C8,22 8,30 0,40 Z"/></g>'
       + '<path d="M0,38 C-4,32 -4,26 0,20 C4,26 4,32 0,38 Z" fill="#F2D04C"/>',
      f: '<g stroke="#8B5A2B" stroke-width="3" stroke-linecap="round"><line x1="-12" y1="42" x2="12" y2="38"/><line x1="12" y1="42" x2="-12" y2="38"/></g>'
       + '<line x1="26" y1="36" x2="6" y2="22" stroke="#A86B2E" stroke-width="2" stroke-linecap="round"/>'
       + '<circle cx="6" cy="22" r="4.5" fill="#FFF3DD" stroke="#E5C99A" stroke-width="1.2"/>' }; },
    bike: function(){ return {
      b: '<path d="M-22,38 L22,38 L14,16 L-14,16 Z" fill="#FFD24D" stroke="#C9962B" stroke-width="1.6"/>'
       + '<g fill="#FFD24D" stroke="#C9962B" stroke-width="1"><circle cx="-14" cy="14" r="3"/><circle cx="0" cy="11" r="3"/><circle cx="14" cy="14" r="3"/></g>',
      f: '<g fill="none" stroke="#3A3F4B" stroke-width="2.4"><circle cx="-22" cy="40" r="9"/><circle cx="22" cy="40" r="9"/></g>'
       + '<g stroke="#5B6472" stroke-width="2" stroke-linecap="round"><path d="M-22,40 L0,40 L18,40 M0,40 L-6,26 M0,40 L8,26 L18,40 M-6,26 L2,26"/></g>' }; },
    tub: function(){ return {
      b: '<path d="M-26,16 L26,16 L22,40 Q0,44 -22,40 Z" fill="#C58A4A" stroke="#7A5230" stroke-width="2"/>'
       + steam(-10, 4) + steam(12, 4),
      f: '<path d="M-26,16 L26,16 L24,24 Q0,28 -24,24 Z" fill="#9BD4E5" stroke="#79B6C9" stroke-width="1.4"/>'
       + '<path d="M-26,16 v24 M-18,16 v24 M-9,16 v24 M0,16 v24 M9,16 v24 M18,16 v24 M26,16 v24" stroke="#7A5230" stroke-width="0.8" opacity=".5"/>'
       + '<path d="M-12,-26 q9,4 14,-1" fill="none" stroke="#fff" stroke-width="2.6"/>'
       + '<path d="M-15,-27 Q-2,-34 4,-26 Z" fill="#fff" stroke="#D9C8A0" stroke-width="1.4"/>' }; },
    cup: function(){ return {
      b: '<path d="M-24,8 L24,8 L20,34 Q0,40 -20,34 Z" fill="#FFFDF7" stroke="#D9A93C" stroke-width="2"/>'
       + steam(-8, -4) + steam(10, -4),
      f: '<path d="M-24,8 L24,8 L22,18 Q0,23 -22,18 Z" fill="#C98A4E" opacity=".9"/>'
       + '<path d="M22,14 q12,2 12,12 q0,9 -10,10" fill="none" stroke="#D9A93C" stroke-width="3"/>'
       + '<g transform="translate(0,26) scale(0.5)"><path d="M0,3 C-2,-3 -9,-2 -9,3 C-9,8 -2,11 0,14 C2,11 9,8 9,3 C9,-2 2,-3 0,3 Z" fill="#E8556E"/></g>' }; },
    box: function(){ return {
      b: '<path d="M-26,12 L26,12 L24,42 L-24,42 Z" fill="#D9A86A" stroke="#9E743E" stroke-width="2"/>',
      f: '<path d="M-27,12 L27,12 L26,20 L-26,20 Z" fill="#E8BE84" stroke="#9E743E" stroke-width="1.6"/>'
       + '<path d="M-26,20 L24,20 L23,42 L-24,42 Z" fill="none" stroke="#9E743E" stroke-width="1"/>'
       + '<path d="M-12,12 q12,-7 24,0" fill="#C99A5E" stroke="#9E743E" stroke-width="1.2"/>'
       + '<line x1="0" y1="20" x2="0" y2="42" stroke="#9E743E" stroke-width="0.8" opacity=".5"/>' }; },
    moon: function(){ return {
      b: '<path d="M-38,28 A26,26 0 1 0 6,40 A20,20 0 1 1 -38,28 Z" fill="#FBE89A" stroke="#E5C75A" stroke-width="2"/>'
       + sparkle(-30, 6, 4, '#FFF1C2') + sparkle(18, 30, 3.2, '#FFF1C2') }; },
    cloud: function(){ return {
      b: '<g fill="#FFFFFF" stroke="#D8E4EE" stroke-width="2"><ellipse cx="0" cy="34" rx="30" ry="13"/>'
       + '<circle cx="-20" cy="30" r="11"/><circle cx="0" cy="26" r="14"/><circle cx="20" cy="30" r="11"/></g>'
       + '<text x="26" y="6" font-size="11" fill="#9CC6E8" font-weight="700">z</text><text x="33" y="-2" font-size="8" fill="#BFD8EE" font-weight="700">z</text>' }; },
    gift: function(){ return {
      b: '<rect x="-22" y="14" width="44" height="26" rx="2" fill="#E36B6B" stroke="#B23A34" stroke-width="1.8"/>'
       + '<rect x="-3" y="14" width="6" height="26" fill="#FFD24D"/>'
       + '<path d="M-22,22 h44" stroke="#FFD24D" stroke-width="3"/>'
       + '<path d="M0,14 C-10,4 -18,12 0,14 C18,12 10,4 0,14 Z" fill="#FFD24D" stroke="#E5B93C" stroke-width="1.2"/>',
      f: '' }; },
    door: function(){ return {
      f: '<rect x="14" y="-34" width="30" height="76" rx="2" fill="#C58A4A" stroke="#7A5230" stroke-width="2"/>'
       + '<rect x="19" y="-28" width="20" height="30" rx="1.5" fill="none" stroke="#7A5230" stroke-width="1.4"/>'
       + '<rect x="19" y="6" width="20" height="30" rx="1.5" fill="none" stroke="#7A5230" stroke-width="1.4"/>'
       + '<circle cx="20" cy="4" r="2.4" fill="#FFD24D" stroke="#C9962B" stroke-width="1"/>' }; },
    rain: function(){ return {
      f: '<path d="M-26,-14 A26,16 0 0 1 26,-14 Z" fill="#5E9BD0" stroke="#3A6FA0" stroke-width="1.6"/>'
       + '<path d="M-26,-14 q6,5 13,0 q6,5 13,0 q6,5 13,0" fill="none" stroke="#3A6FA0" stroke-width="1.2"/>'
       + '<line x1="0" y1="-14" x2="0" y2="6" stroke="#8B5A2B" stroke-width="2"/><path d="M0,6 q-4,0 -4,4" fill="none" stroke="#8B5A2B" stroke-width="2"/>'
       + '<g stroke="#79B6C9" stroke-width="1.6" stroke-linecap="round"><line x1="-20" y1="6" x2="-22" y2="12"/><line x1="20" y1="6" x2="18" y2="12"/><line x1="-28" y1="0" x2="-30" y2="6"/><line x1="28" y1="0" x2="26" y2="6"/></g>' }; },
    angel: function(){ return {
      b: '<g fill="#FFFFFF" stroke="#D8E4EE" stroke-width="1.6"><path d="M-22,2 Q-44,-14 -40,8 Q-34,18 -22,14 Z"/><path d="M22,2 Q44,-14 40,8 Q34,18 22,14 Z"/></g>',
      f: '<ellipse cx="0" cy="-40" rx="13" ry="4.5" fill="none" stroke="#FFD24D" stroke-width="3"/>' }; },
    devil: function(){ return {
      b: '<g fill="#7A3340" stroke="#511F29" stroke-width="1.4"><path d="M-22,4 Q-42,-6 -38,14 Q-30,16 -22,12 Z"/><path d="M22,4 Q42,-6 38,14 Q30,16 22,12 Z"/></g>'
       + '<path d="M-38,14 l-3,6 l5,-2 Z M38,14 l3,6 l-5,-2 Z" fill="#7A3340"/>',
      f: '<path d="M-12,-28 q-3,-10 3,-12 q-1,7 3,10 Z" fill="#C0392B" stroke="#8E2A20" stroke-width="1.2"/>'
       + '<path d="M12,-28 q3,-10 -3,-12 q1,7 -3,10 Z" fill="#C0392B" stroke="#8E2A20" stroke-width="1.2"/>'
       + '<line x1="30" y1="20" x2="36" y2="-12" stroke="#8E2A20" stroke-width="2.4" stroke-linecap="round"/>'
       + '<path d="M36,-12 l-5,-4 m5,4 l5,-4 m-5,4 v-6" stroke="#C0392B" stroke-width="2.4" stroke-linecap="round"/>' }; },
    hotairballoon: function(){ return {
      b: '<path d="M-22,-18 Q-26,-50 0,-50 Q26,-50 22,-18 Q12,-6 0,-6 Q-12,-6 -22,-18 Z" fill="#E8556E" stroke="#B23A34" stroke-width="1.8"/>'
       + '<path d="M-8,-49 Q-12,-20 -3,-7 M8,-49 Q12,-20 3,-7" fill="none" stroke="#FFD24D" stroke-width="2.4"/>'
       + '<path d="M0,-50 Q-22,-30 -22,-18 M0,-50 Q22,-30 22,-18" fill="none" stroke="#fff" stroke-width="1" opacity=".4"/>',
      f: '<g stroke="#8B5A2B" stroke-width="1.2"><line x1="-12" y1="-8" x2="-14" y2="22"/><line x1="12" y1="-8" x2="14" y2="22"/></g>'
       + '<path d="M-16,22 h32 l-3,14 h-26 Z" fill="#C58A4A" stroke="#7A5230" stroke-width="1.6"/>' }; }
  };

  /* ---- 金額外框(金額越高越華麗) ---- */
  var TIER_LVL = { 30:0, 50:0, 100:1, 500:2, 1000:3, 5000:4, 10000:5 };
  function frame(tier, rarity, pool){
    var lvl = TIER_LVL[tier] || 0;
    var pal = bodyPal(rarity, pool);
    var st = pal.stroke, out = '';
    if(rarity === 'gold') out += '<circle r="37" fill="'+PAL.gold.fill+'" opacity="0.18"/>';
    if(lvl >= 4){
      out += '<g stroke="'+(rarity==='gold'?'#E0A93C':st)+'" stroke-width="2.2" stroke-linecap="round" opacity="0.8">'
        + '<line x1="30" y1="0" x2="42" y2="0"/><line x1="-30" y1="0" x2="-42" y2="0"/>'
        + '<line x1="18" y1="26" x2="24" y2="35"/><line x1="-18" y1="26" x2="-24" y2="35"/>'
        + '<line x1="18" y1="-26" x2="24" y2="-35"/><line x1="-18" y1="-26" x2="-24" y2="-35"/></g>';
    }
    if(lvl >= 1) out += '<circle r="34" fill="none" stroke="'+st+'" stroke-width="1.2" opacity="'+(0.32 + lvl*0.04)+'"/>';
    if(lvl >= 3){
      out += '<circle cx="0" cy="-34" r="2" fill="'+st+'"/><circle cx="34" cy="0" r="2" fill="'+st+'"/>'
           + '<circle cx="0" cy="34" r="2" fill="'+st+'"/><circle cx="-34" cy="0" r="2" fill="'+st+'"/>';
    }
    return out;
  }

  /* ---- 稀有度星星 ---- */
  function rarityStars(rarity){
    if(rarity === 'fine')  return sparkle(20, -22, 5, '#7FB0D8');
    if(rarity === 'rare')  return sparkle(20, -22, 5, '#B79AD8') + sparkle(-21, -16, 4, '#B79AD8');
    if(rarity === 'gold')  return sparkle(18, -19, 6, '#ffffff');
    return '';
  }

  function lockedInner(){
    var p = PAL.lock;
    return '<path d="M0,-28 C22,-26 28,-4 26,10 C24,24 13,30 0,30 C-13,30 -24,24 -26,10 C-28,-4 -22,-26 0,-28 Z" fill="'+p.fill+'" stroke="'+p.stroke+'" stroke-width="2"/>'
         + '<text x="0" y="9" font-size="22" text-anchor="middle" fill="'+p.stroke+'" font-weight="700">?</text>';
  }

  /* ---- 金種子專屬華麗零件(只有 gold 等級會用,讓金種子最吸睛) ---- */
  function goldHalo(){
    return '<circle r="38" fill="#FFE9A8" opacity="0.12"><animate attributeName="opacity" values="0.06;0.32;0.06" dur="2.4s" repeatCount="indefinite"/></circle>'
         + '<g><animateTransform attributeName="transform" attributeType="XML" type="rotate" from="0 0 0" to="360 0 0" dur="7s" repeatCount="indefinite"/>'
         +   sparkle(0, -44, 4.5, '#ffffff') + sparkle(44, 0, 4, '#FFD86B')
         +   sparkle(0, 44, 4.5, '#ffffff') + sparkle(-44, 0, 4, '#FFD86B')
         + '</g>';
  }
  function limbs(pal){
    return '<g stroke="'+pal.stroke+'" stroke-width="3.4" stroke-linecap="round" fill="none">'
         +   '<path d="M-24,9 q-9,3 -13,11"/><path d="M24,9 q9,3 13,11"/>'
         +   '<path d="M-11,28 l-3,12"/><path d="M11,28 l3,12"/></g>'
         + '<g fill="'+pal.fill+'" stroke="'+pal.stroke+'" stroke-width="1.6">'
         +   '<circle cx="-38" cy="20" r="4.5"/><circle cx="38" cy="20" r="4.5"/>'
         +   '<ellipse cx="-15" cy="41" rx="5.5" ry="3.4"/><ellipse cx="15" cy="41" rx="5.5" ry="3.4"/></g>';
  }
  function sheen(){
    return '<ellipse cx="-8" cy="-12" rx="8" ry="12" fill="#fff" opacity="0.5"/>'
         + '<circle cx="6" cy="-16" r="3" fill="#fff" opacity="0.7"/>';
  }

  /* 組裝順序:外框 →(金光環/手腳)→ 配件後層 → 頭飾 → 身體 →(亮面)→ 臉 → 配件前層 → 星星 */
  function inner(opts){
    opts = opts || {};
    if(opts.got === false) return lockedInner();
    var art = opts.art || {};
    var rarity = opts.rarity || 'normal';
    var pool = opts.pool || 'client';
    var pal = bodyPal(rarity, pool);
    var shp = bodyShape(art.b || 'seed', pal);
    var gold = (rarity === 'gold');
    var acc = (art.p && ACC[art.p]) ? ACC[art.p](pal) : null;
    var s = '';
    s += frame(opts.tier, rarity, pool);
    if(gold) s += goldHalo();                       // 轉圈星環(背景)
    if(gold) s += limbs(pal);                        // 手腳(身體後)
    if(acc && acc.b) s += acc.b;                     // 配件後層(場景把種子裝進去/背景)
    s += hat(art.h || (gold ? 'crown' : ''));        // 金種子沒指定頭飾就自動戴皇冠
    s += shp.body;
    if(gold) s += sheen();
    s += face(art.f || 'happy', shp.faceY);
    if(acc && acc.f) s += acc.f;
    s += rarityStars(rarity);
    return s;
  }
  function svg(opts){
    opts = opts || {};
    var size = opts.size || 64;
    return '<svg width="'+size+'" height="'+size+'" viewBox="-50 -52 100 108" xmlns="http://www.w3.org/2000/svg" class="qsa">'
         + inner(opts) + '</svg>';
  }
  var API = { svg: svg, inner: inner, PAL: PAL, bodyPal: bodyPal, ACC: ACC };
  if(typeof window !== 'undefined') window.QyxSeedArt = API;
  if(typeof module !== 'undefined' && module.exports) module.exports = API;
})();
