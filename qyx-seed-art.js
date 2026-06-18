/* qyx-seed-art.js — 種子寶寶繪圖引擎(全站畫種子都用這支)
 *
 * 為什麼這樣做:350 顆種子若一張張手繪 SVG 不可能好看也養不起。
 * 改成「可組合零件」:身體(body)＋臉表情(face)＋頭飾(hat)＋道具(prop)＋稀有度配色(rarity)＋金額外框(tier)。
 * 每顆種子在 seed_catalog 只存一組精簡設計代碼(art)，這支引擎照代碼組出整隻角色的 SVG。
 * 新增種子＝給一組代碼，不必畫圖。全站(19 圖鑑/揭曉彈窗/漂浮種子櫃)都呼叫 QyxSeedArt.svg()，畫風一致。
 *
 * 用法:QyxSeedArt.svg({ art:{b,f,p,h}, rarity, pool, tier, size, got })
 *   art.b 身體 seed|crystal|ingot|flower   art.f 表情   art.p 道具   art.h 頭飾
 *   rarity normal|fine|rare|gold(等級,決定配色與星星)   pool client|suncar(普通等級的底色)
 *   tier 金額(30..10000,決定外框華麗度)   size 像素   got 是否已收集(false=灰殼問號)
 */
(function(){
  'use strict';

  var INK = '#3D2914';
  var PAL = {
    warm:  { fill:'#C99A63', stroke:'#86572D', hi:'#E6CB9F' },
    green: { fill:'#8FCBA4', stroke:'#3F7E5C', hi:'#D6EEDF' },
    blue:  { fill:'#9CC6E8', stroke:'#3A7CB8', hi:'#E2F0FB' },
    purple:{ fill:'#C3A6E0', stroke:'#8A52C9', hi:'#EEE2F8' },
    gold:  { fill:'#FFD86B', stroke:'#C9962B', hi:'#FFF1C2' },
    lock:  { fill:'#E6DCC6', stroke:'#C9BE9F', hi:'#F2ECDD' }
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
    return '';
  }

  /* ---- 道具(手拿/周圍/腳下) ---- */
  function prop(kind, pal){
    if(kind === 'candy')
      return '<path d="M24,6 L40,-12" stroke="'+pal.stroke+'" stroke-width="2.4" stroke-linecap="round"/>'
           + '<circle cx="43" cy="-16" r="9" fill="#F4A8B8" stroke="#D96A86" stroke-width="1.6"/>'
           + '<path d="M43,-16 m-5,0 a5,5 0 1,1 8,3" fill="none" stroke="#fff" stroke-width="1.4"/>';
    if(kind === 'heart')
      return '<g transform="translate(0,-40) scale(0.7)"><path d="M0,3 C-2,-3 -9,-2 -9,3 C-9,8 -2,11 0,14 C2,11 9,8 9,3 C9,-2 2,-3 0,3 Z" fill="#E8556E"/></g>';
    if(kind === 'umbrella')
      return '<g stroke="#6FA8D8" stroke-width="2" stroke-linecap="round"><line x1="-22" y1="-18" x2="-24" y2="-12"/><line x1="0" y1="-20" x2="-2" y2="-14"/><line x1="22" y1="-18" x2="20" y2="-12"/></g>'
           + '<path d="M-26,-34 A26,26 0 0 1 26,-34 Z" fill="#5E9BD0" stroke="#3A6FA0" stroke-width="1.6"/>'
           + '<path d="M0,-34 L0,-28" stroke="#8B5A2B" stroke-width="2"/><path d="M0,-28 q-4,0 -4,4" fill="none" stroke="#8B5A2B" stroke-width="2"/>';
    if(kind === 'sun')
      return '<circle cx="30" cy="-32" r="8" fill="#FFC83D"/><g stroke="#FFC83D" stroke-width="2" stroke-linecap="round"><line x1="30" y1="-46" x2="30" y2="-42"/><line x1="42" y1="-32" x2="46" y2="-32"/><line x1="39" y1="-41" x2="42" y2="-44"/><line x1="39" y1="-23" x2="42" y2="-20"/></g>';
    if(kind === 'glasses')
      return '<rect x="-14" y="-6" width="11" height="8" rx="3" fill="'+INK+'"/><rect x="3" y="-6" width="11" height="8" rx="3" fill="'+INK+'"/><line x1="-3" y1="-3" x2="3" y2="-3" stroke="'+INK+'" stroke-width="1.6"/>';
    if(kind === 'rainbow')
      return '<g fill="none" stroke-width="3.4"><path d="M-32,8 A32,32 0 0 1 32,8" stroke="#E36B6B"/><path d="M-26,8 A26,26 0 0 1 26,8" stroke="#F2B441"/><path d="M-20,8 A20,20 0 0 1 20,8" stroke="#6FB58E"/></g>';
    if(kind === 'cane')
      return '<path d="M28,-12 C28,-20 40,-20 40,-12 L40,26" fill="none" stroke="#A86B2E" stroke-width="3" stroke-linecap="round"/>';
    if(kind === 'coins')
      return '<g fill="#FFD24D" stroke="#C9962B" stroke-width="1.4"><circle cx="-26" cy="-26" r="6"/><circle cx="0" cy="-36" r="6"/><circle cx="26" cy="-26" r="6"/></g>'
           + '<g fill="#C9962B" font-size="7" text-anchor="middle"><text x="-26" y="-23">$</text><text x="0" y="-33">$</text><text x="26" y="-23">$</text></g>';
    if(kind === 'gem')
      return '<path d="M0,'+(11)+' L8,18 L0,27 L-8,18 Z" fill="#BFE3F2" stroke="#5AA6C9" stroke-width="1.4"/>';
    if(kind === 'pot')
      return '<path d="M-18,18 L18,18 L14,38 L-14,38 Z" fill="#E0A35E" stroke="#A86B2E" stroke-width="2"/>'
           + '<rect x="-20" y="14" width="40" height="6" rx="2" fill="#EBB877" stroke="#A86B2E" stroke-width="1.6"/>';
    return '';
  }

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

  /* 組裝順序:外框 → 頭飾 → 身體 → 臉 → 道具 → 星星。腳下道具(pot)畫在身體前不擋臉 */
  function inner(opts){
    opts = opts || {};
    if(opts.got === false) return lockedInner();
    var art = opts.art || {};
    var rarity = opts.rarity || 'normal';
    var pool = opts.pool || 'client';
    var pal = bodyPal(rarity, pool);
    var shp = bodyShape(art.b || 'seed', pal);
    var pk = art.p || '';
    var s = '';
    s += frame(opts.tier, rarity, pool);
    if(pk === 'pot') s += prop('pot', pal);
    s += hat(art.h || '');
    s += shp.body;
    s += face(art.f || 'happy', shp.faceY);
    if(pk && pk !== 'pot') s += prop(pk, pal);
    s += rarityStars(rarity);
    return s;
  }

  function svg(opts){
    opts = opts || {};
    var size = opts.size || 64;
    return '<svg width="'+size+'" height="'+size+'" viewBox="-50 -52 100 108" xmlns="http://www.w3.org/2000/svg" class="qsa">'
         + inner(opts) + '</svg>';
  }

  var API = { svg: svg, inner: inner, PAL: PAL, bodyPal: bodyPal };
  if(typeof window !== 'undefined') window.QyxSeedArt = API;
  if(typeof module !== 'undefined' && module.exports) module.exports = API;
})();
