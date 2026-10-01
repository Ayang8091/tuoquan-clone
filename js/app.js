/* ============================================================
 * 乐道AI · 复刻系统 —— 用户端逻辑（SPA · hash 路由）
 * ============================================================ */
(function () {
  'use strict';

  var S = window.Store;
  var phone = document.getElementById('phone');

  /* ---------------- UI 工具 ---------------- */
  var UI = window.UI = {
    toast: function (msg) {
      var t = document.getElementById('toast');
      t.textContent = msg; t.style.display = 'block';
      clearTimeout(t._h);
      t._h = setTimeout(function () { t.style.display = 'none'; }, 1600);
    },
    openSheet: function (id) {
      document.getElementById('mask').style.display = 'block';
      document.getElementById(id).style.display = 'block';
    },
    closeSheet: function () {
      document.getElementById('mask').style.display = 'none';
      document.querySelectorAll('.sheet').forEach(function (s) { s.style.display = 'none'; });
    },
    copy: function (text) {
      if (navigator.clipboard) navigator.clipboard.writeText(text);
      UI.toast('已复制');
    },
    go: function (hash) { location.hash = hash; }
  };
  document.getElementById('mask').onclick = UI.closeSheet;

  /* 假二维码（确定性图案，仅演示） */
  function qrSVG(seedStr, size) {
    var h = 0; for (var i = 0; i < seedStr.length; i++) { h = (h * 31 + seedStr.charCodeAt(i)) >>> 0; }
    var n = 21, cell = 100 / n, rects = '';
    function rnd() { h = (h * 1103515245 + 12345) >>> 0; return h / 4294967296; }
    function finder(x, y) {
      rects += '<rect x="' + x * cell + '%" y="' + y * cell + '%" width="' + cell * 7 + '%" height="' + cell * 7 + '%" fill="#000"/>' +
        '<rect x="' + (x + 1) * cell + '%" y="' + (y + 1) * cell + '%" width="' + cell * 5 + '%" height="' + cell * 5 + '%" fill="#fff"/>' +
        '<rect x="' + (x + 2) * cell + '%" y="' + (y + 2) * cell + '%" width="' + cell * 3 + '%" height="' + cell * 3 + '%" fill="#000"/>';
    }
    finder(0, 0); finder(n - 7, 0); finder(0, n - 7);
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
      var inF = (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9);
      if (!inF && rnd() > 0.52) rects += '<rect x="' + x * cell + '%" y="' + y * cell + '%" width="' + cell + '%" height="' + cell + '%" fill="#000"/>';
    }
    return '<svg viewBox="0 0 100 100" width="' + (size || '100%') + '" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#fff"/>' + rects + '</svg>';
  }
  window.qrSVG = qrSVG;

  var ICONS = {
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M16 2v4M8 2v4M3 9h18"/><path d="M12 12.5l3 2-1 3-4-2z"/></svg>',
    circle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.73 15.8A8.4 8.4 0 1 1 9.83 19.71L4.4 21.4z"/></svg>',
    briefcase: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/></svg>',
    person: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
    back: '‹', chev: '›'
  };

  function pagebar(title, backHash, right) {
    return '<div class="pagebar"><span class="back" onclick="UI.go(\'' + (backHash || '#/') + '\')">' + ICONS.back + '</span>' +
      '<span class="ptitle">' + title + '</span>' + (right || '') + '</div>';
  }

  function tabbar(active) {
    /* 原站底部导航：沙龙 / 圈子 / 老板 / 我的（4 个 Tab，图标同源） */
    var tabs = [['salon', '沙龙', ICONS.calendar], ['circle', '圈子', ICONS.circle], ['boss', '老板', ICONS.briefcase], ['me', '我的', ICONS.person]];
    return '<div class="tabbar">' + tabs.map(function (t) {
      return '<a class="tab ' + (active === t[0] ? 'on' : '') + '" href="#/' + t[0] + '">' + t[2] + '<span>' + t[1] + '</span></a>';
    }).join('') + '</div>';
  }

  /* 会员开通悬浮按钮（原站规格：左缘金色书签，仅非会员可见） */
  function vipFabHtml() {
    var db = S.get();
    if (db.user && db.user.role === '会员') return '';
    return '<div class="vip-fab" onclick="UI.go(\'#/member\')">' +
      '<span class="fab-t">开</span><span class="fab-t">通</span><span class="fab-t">会</span><span class="fab-t">员</span></div>';
  }

  /* 登录入口：顶部胶囊链接（未登录→登录/注册，已登录→切换账号） */
  function loginChip() {
    var on = window.Auth && Auth.isLoggedIn();
    return '<a class="login-chip" href="#/login" aria-label="前往登录">' +
      (on ? '切换账号' : '登录 / 注册') + '</a>';
  }

  function coverStyle(key, title) {
    var grads = {
      codex: 'linear-gradient(135deg,#0b1530 0%,#14306e 55%,#0b1530 100%)',
      sea: 'linear-gradient(135deg,#0e4d5c,#12718a)',
      'class': 'linear-gradient(135deg,#c9b48a,#8f7b52)',
      boss: 'linear-gradient(135deg,#3a3f4a,#22262e)',
      party: 'linear-gradient(135deg,#7a4a3a,#4a2c22)'
    };
    var g = grads[key] || grads.boss;
    return 'background:' + g + ';';
  }

  /* ================= 页面：沙龙 ================= */
  function pageSalon() {
    var db = S.get();
    var open = db.salons.filter(function (s) { return s.status === '报名中'; });
    var banners = [
      { t1: '老板引荐 · 对接资源', t2: '认识靠谱的上下游老板', bg: 'party' },
      { t1: '合作对接', t2: '联系我们·快速合作', bg: 'boss' }
    ];
    var html = '' +
      '<div class="home-head"><div class="lh-left"><div class="logo-sq gold">沙</div>' +
      '<div><div class="lh-title">沙龙活动</div><div class="lh-sub">打破AI信息差，让创业更简单</div></div></div>' +
      '<span class="hh-right">' + (db.user.distributeEnabled ? '<span class="badge-dist">分销员</span>' : '') + loginChip() + '</span></div>' +

      '<div class="carousel" id="carousel"><div class="track">' +
      banners.map(function (b, i) {
        return '<div class="slide" style="' + coverStyle(b.bg) + '" onclick="' + (i === 1 ? 'UI.go(\'#/coop\')' : 'UI.go(\'#/boss\')') + '">' +
          '<div class="st1">' + b.t1 + '</div><div class="st2">' + b.t2 + '</div></div>';
      }).join('') + '</div>' +
      '<div class="dots">' + banners.map(function (_, i) { return '<i class="' + (i === 0 ? 'on' : '') + '"></i>'; }).join('') + '</div></div>' +

      (open.length ? open.map(salonCard).join('') :
        '<div class="empty-salon"><div class="ico">🗓️</div><p>暂无可报名活动 · 敬请期待<br>主理人正在筹备下一场沙龙</p></div>') +

      '<div class="float-vip" onclick="UI.go(\'#/member\')">开通会员</div>' +
      vipFabHtml() + tabbar('salon');

    phone.innerHTML = html;
    startCarousel();
  }

  function salonCard(s) {
    return '<div class="boss-list"><div class="boss-card" onclick="UI.go(\'#/salon-detail/' + s.id + '\')">' +
      '<div class="boss-cover" style="' + coverStyle(s.banner) + ';height:150px"><span style="position:absolute;left:14px;bottom:12px;color:#fff;font-weight:700">' + s.title + '</span></div>' +
      '<div class="boss-inner"><div class="b-desc" style="margin:0">' + s.desc + '</div>' +
      '<div class="b-foot"><span class="matched">🗓️ ' + s.date + ' · ' + s.city + ' · 余位 ' + Math.max(0, s.seats - s.joined) + '</span>' +
      '<span class="price" style="color:var(--blue)">报名<small></small></span></div></div></div></div>';
  }

  function startCarousel() {
    var car = document.getElementById('carousel');
    if (!car) return;
    var idx = 0, track = car.querySelector('.track'), dots = car.querySelectorAll('.dots i');
    setInterval(function () {
      if (!document.body.contains(track)) return clearInterval(this);
      idx = (idx + 1) % 2;
      track.style.transform = 'translateX(-' + idx * 88 + '%)';
      dots.forEach(function (d, i) { d.classList.toggle('on', i === idx); });
    }, 3500);
  }

  /* ================= 页面：老板列表 ================= */
  function pageBoss() {
    var db = S.get();
    var kw = (window._bossKw || '').trim();
    var list = db.bosses.filter(function (b) {
      return b.onShelf && (!kw || (b.name + b.tag + b.title + b.desc + b.badges.join()).indexOf(kw) >= 0);
    });
    var html = '' +
      '<div class="home-head"><div class="lh-left"><div class="logo-sq green">板</div>' +
      '<div><div class="lh-title">老板资源</div><div class="lh-sub">探访实拍老板 · 平台引荐对接</div></div></div>' +
      '<span class="hh-right">' + (db.user.distributeEnabled ? '<span class="badge-dist">分销员</span>' : '') + loginChip() + '</span></div>' +

      '<div class="search-wrap"><div class="search-box">🔍' +
      '<input id="bossKw" placeholder="搜索老板 / 行业 / 关键词..." value="' + kw + '">' +
      (kw ? '<span onclick="window._bossKw=\'\';render()" style="color:#bbb">✕</span>' : '') + '</div></div>' +

      '<div class="boss-list">' + list.map(bossCard).join('') +
      (list.length ? '' : '<div class="empty-salon"><div class="ico">🔍</div><p>没有找到相关老板</p></div>') + '</div>' +
      '<div class="hint-line">引荐期间 ' + S.get().config.refundHours + ' 小时内为你对接 · 超时未对接自动退款 · 信息由老板本人提供</div>' +
      vipFabHtml() + tabbar('boss');
    phone.innerHTML = html;
    var input = document.getElementById('bossKw');
    input.oninput = function () { window._bossKw = input.value; render(true); };
  }

  function bossCoverHtml(b) {
    /* 视频封面：后台上传/自动抓取的封面图 → 点击直接跳转视频号播放；否则回退渐变样式 */
    if (b.videoCover) {
      return '<div class="boss-cover" style="height:190px" onclick="User.openVideo(\'' + b.id + '\')">' +
        '<img src="' + b.videoCover + '" style="width:100%;height:100%;object-fit:cover;display:block">' +
        '<div class="play"></div>' +
        (b.videoUrl ? '<div style="position:absolute;left:10px;bottom:10px;background:rgba(0,0,0,.45);color:#fff;font-size:10px;border-radius:10px;padding:2px 8px">视频号 ▶</div>' : '') +
        '</div>';
    }
    if (b.video && b.cover) {
      return '<div class="boss-cover" style="' + coverStyle(b.cover) + '" onclick="User.openVideo(\'' + b.id + '\')">' +
        '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:17px;text-shadow:0 1px 6px rgba(0,0,0,.5)">' +
        (b.cover === 'codex' ? 'Codex · AI时代的超级助手' : b.cover === 'sea' ? '所有国内生意<br>都值得用海外社媒再做一遍' : '') + '</div>' +
        '<div class="play"></div></div>';
    }
    /* 兜底：有视频链接但没抓到/没上传封面 → 默认视频窗口（深色渐变 + 播放按钮） */
    if (b.videoUrl) {
      return '<div class="boss-cover" style="height:190px;background:linear-gradient(135deg,#0e1a3a 0%,#1c2f66 55%,#33508f 100%)" onclick="User.openVideo(\'' + b.id + '\')">' +
        '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">' +
        '<div class="play"></div>' +
        '<div style="margin-top:10px;color:rgba(255,255,255,.72);font-size:11px;letter-spacing:1px">视频封面待更新 · 点击观看</div></div>' +
        '<div style="position:absolute;left:10px;bottom:10px;background:rgba(0,0,0,.45);color:#fff;font-size:10px;border-radius:10px;padding:2px 8px">视频号 ▶</div>' +
        '</div>';
    }
    return '';
  }

  function avaHtml(b, size) {
    return b.avatarImg
      ? '<img class="boss-ava" src="' + b.avatarImg + '" style="width:' + size + 'px;height:' + size + 'px;object-fit:cover">'
      : '<div class="boss-ava"' + (size !== 46 ? ' style="width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size * .5) + 'px"' : '') + '>' + b.name[0] + '</div>';
  }

  function bossCard(b) {
    return '<div class="boss-card">' +
      bossCoverHtml(b) +
      '<div class="boss-inner">' +
      '<div class="boss-top" onclick="UI.go(\'#/boss/' + b.id + '\')">' +
      avaHtml(b, 46) +
      '<div><div class="boss-name">' + b.name + '</div><div class="boss-title">' + b.title + '</div></div>' +
      '<span class="arrow">›</span></div>' +
      '<div><span class="tag">' + b.tag + '</span></div>' +
      '<div class="b-badges">' + b.badges.map(function (x) { return '<span class="b-badge">🏆 ' + x + '</span>'; }).join('') + '</div>' +
      '<div class="b-desc">' + b.desc + '</div>' +
      '<div class="b-foot"><span class="matched">👋 ' + b.matched + ' 人已对接' + (b.salons ? ' · 已参加 ' + b.salons + ' 期沙龙' : '') + ' · 平台认证老板</span>' +
      '<span class="price">引荐 <small>¥</small>' + b.price + '</span></div>' +
      '</div></div>';
  }

  /* ================= 页面：老板名片 ================= */
  function pageBossDetail(id) {
    var db = S.get();
    var b = db.bosses.find(function (x) { return x.id === id; });
    if (!b) { phone.innerHTML = pagebar('老板名片', '#/boss') + '<div class="empty-salon">老板不存在</div>'; return; }
    var html = pagebar('老板名片', '#/boss') +
      '<div class="boss-detail">' +
      bossCoverHtml(b) +
      '<div class="bd-card"><div style="display:flex;gap:12px;align-items:center;margin-bottom:14px">' +
      avaHtml(b, 60) +
      '<div><div class="boss-name" style="font-size:19px">' + b.name + '</div><div class="boss-title" style="margin-top:4px">' + b.title + '</div></div></div>' +
      '<span class="tag">' + b.tag + '</span>' +
      '<div class="b-badges" style="margin-bottom:12px">' + b.badges.map(function (x) { return '<span class="b-badge">🏆 ' + x + '</span>'; }).join('') + '</div>' +
      '<div class="bd-text">' + b.detail + '</div>' +
      '<div class="bd-note">信息由老板本人提供</div></div>' +

      '<div class="bd-card"><h4>💬 客户真实反馈</h4><div class="hint" style="font-size:11px;color:var(--txt3);margin-bottom:10px">聊天记录截图 · 客户授权展示</div>' +
      '<div class="img-grid">' +
      '<div class="ph fb"><span>成交反馈截图</span></div><div class="ph"><span>后台数据截图</span></div>' +
      '</div></div>' +

      '<div class="bd-card"><h4>📸 沙龙现场</h4><div class="img-grid">' +
      ((b.photos && b.photos.length)
        ? b.photos.map(function (src) { return '<div class="ph"><img src="' + src + '" style="width:100%;height:100%;object-fit:cover;border-radius:8px"></div>'; }).join('')
        : '<div class="ph"><span>沙龙分享现场</span></div><div class="ph"><span>现场对接交流</span></div>') +
      '</div></div>' +

      '<div class="bd-card"><h4>如何引荐</h4><div class="how-steps">' +
      '① 点击下方按钮填写引荐信息并提交<br>' +
      '② 你的引荐照顾 <b>' + db.config.refundHours + ' 小时</b>内为你对接（付款后可在凭证页扫码联系顾问）<br>' +
      '③ 群内自加好友、约见面沟通</div>' +
      '<div class="how-warn">引荐费买的是顾问对接服务，不承诺老板回复与成交结果 · ' + db.config.refundHours + ' 小时未对接自动退款</div></div>' +

      '<div style="padding:2px 0 14px"><button class="btn-primary" onclick="UI.go(\'#/refer/' + b.id + '\')">立即引荐 ¥' + b.price + '</button></div>' +
      '<div class="bd-foot-hint">平台认证老板 · 后续成交另有合作协议保障</div>' +
      '</div>';
    phone.innerHTML = html;
  }

  /* ================= 页面：编辑引荐（提交引荐信息） ================= */
  function pageRefer(id) {
    var db = S.get();
    var b = db.bosses.find(function (x) { return x.id === id; });
    if (!b) return;
    phone.innerHTML = pagebar('引荐 · ' + b.name, '#/boss/' + b.id) +
      '<div class="form-page">' +
      '<div class="coop-hero"><b>提交引荐意向</b><br>提交后 ' + db.config.refundHours + ' 小时内平台为你对接 ' + b.name + '（' + b.title + '）<br>超时未对接自动全额退款</div>' +
      '<div class="form-card"><div class="f-label">你希望怎么对接 <span class="req">*</span></div>' +
      '<div class="chips blue" id="meetChips">' +
      ['微信线上沟通', '线下见面详谈', '都可以'].map(function (c, i) {
        return '<span class="chip' + (i === 0 ? ' on' : '') + '" data-v="' + c + '">' + c + '</span>';
      }).join('') + '</div>' +
      '<div class="f-label">你的业务一句话 <span class="opt">选填</span></div>' +
      '<textarea class="f-textarea" id="referNote" placeholder="例：我是做亚马逊的，想对接他的海外仓资源"></textarea>' +
      '</div>' +
      '<div class="form-card"><div class="f-label">引荐费用</div>' +
      '<div style="font-size:22px;font-weight:800;color:var(--gold-deep)">¥' + b.price + ' <span style="font-size:12px;color:var(--txt2);font-weight:400">超时未对接自动退款</span></div></div>' +
      '<button class="btn-save" onclick="User.submitRefer(\'' + b.id + '\')">确认引荐并支付 ¥' + b.price + '</button>' +
      '</div>';
    bindChips('meetChips');
  }

  function bindChips(id) {
    var box = document.getElementById(id);
    box.querySelectorAll('.chip').forEach(function (c) {
      c.onclick = function () {
        box.querySelectorAll('.chip').forEach(function (x) { x.classList.remove('on'); });
        c.classList.add('on');
      };
    });
  }

  /* ================= 页面：我的 ================= */
  function pageMe() {
    var db = S.get(), u = db.user;
    var items = [
      ['🙋', '获取微信头像昵称', u.wxNicknameBound ? '已绑定微信' : '', 'wxprofile'],
      ['👑', '会员中心 / 续费', '', '#/member'],
      ['🎫', '我的沙龙凭证', '', '#/tickets'],
      ['🤝', '我的引荐凭证', '', '#/refvouchers'],
      ['💰', '分销中心', u.distributeEnabled ? '已开通' : '', '#/distribute', u.distributeEnabled],
      ['🧾', '我的支付记录', '', '#/payments'],
      ['💼', '商务合作', u.profile.hasResource ? '有资源' : '有资源 / 有预算 · 找乐道谈', '#/coop'],
      ['💬', '联系客服', '', 'service'],
      ['🔑', '登录 / 切换账号', '', '#/login'],
      ['⚙️', '设置', '', '#/settings']
    ];
    phone.innerHTML = pagebar('我的', '#/salon') +
      '<div class="me-wrap">' +
      '<div class="me-card">' +
      '<div class="me-ava" style="' + (u.avatar ? 'background-image:url(' + u.avatar + ')' : '') + '">' + (u.avatar ? '' : '👤') + '</div>' +
      '<div class="me-info"><div class="me-name">' + (u.nickname || '微信用户') + '</div>' +
      '<div class="me-sub">' + u.role + '</div></div>' +
      '<button class="btn-edit" onclick="UI.go(\'#/profile\')">编辑</button></div>' +
      '<div class="menu-card">' + items.map(function (it) {
        return '<div class="menu-item" onclick="User.menuClick(\'' + it[3] + '\')">' +
          '<div class="menu-ico">' + it[0] + '</div><span class="mi-t">' + it[1] + '</span>' +
          (it[2] ? '<span class="mi-s' + (it[4] ? ' gold' : '') + '">· ' + it[2] + '</span>' : '') +
          '<span class="arrow">›</span></div>';
      }).join('') + '</div></div>' + vipFabHtml() + tabbar('me');
  }

  /* ================= 页面：会员中心（暗金长页） ================= */
  function pageMember() {
    var c = S.get().config;
    phone.innerHTML = '' +
      '<div class="member-page">' + pagebar('年度老板会员', '#/me') +
      '<div class="member-body">' +
      '<div class="mp-kicker">' + c.siteName + ' · 出海会员</div>' +
      '<div class="mp-title">AI出海<br><span class="g">年度老板会员</span></div>' +
      '<div class="mp-price">¥<span class="n">' + c.memberPrice + '</span> <span class="u">/年</span></div>' +
      '<div class="mp-limit">全年权益一次解锁 · 名额有限</div>' +
      '<div class="mp-desc">专为出海、AI 创业、跨境老板打造的「线下资源对接圈子」。<br>买的不是课程，是<b>人脉 · 资源 · 曝光 · 行业信息 · 企业游学资格</b>。</div>' +
      '<button class="btn-gold" onclick="UI.openSheet(\'paySheet\')">立即开通年度会员</button>' +
      '<div class="mp-org">主办方：' + c.organizer + ' · ' + c.salonHeld + ' · ' + c.privatePool + '<br>开通后由主理人一对一对接，不是买完就没人管。</div>' +
      '</div>' +

      '<div class="mp-sec"><div class="mp-num">01</div><div class="mp-h2">为什么值得加入乐道·出海会员圈子？</div>' +
      '<div class="mp-p">我们深耕 AI 出海自媒体赛道，持续落地线下沙龙、长期实地探访出海工厂、跨境公司、AI 标杆企业。所有资源均为线下实拍、真人对接、亲自筛选，不是网络杂牌资源。</div>' +
      '<div class="mp-grid2">' +
      [['01', '真实一手资源', '所有老板资源全部实地探访、当面筛选，真实靠谱可对接'],
       ['02', '高频线下场景', '常态化沙龙、会员闭门茶会、未来企业游学，以线下深度链接为主'],
       ['03', '垂直精准圈子', '只聚焦 AI、出海、跨境电商赛道，人群纯净、无杂流量'],
       ['04', '一对一行业咨询', '一线落地经验，可线下一对一拆解赛道、分享最新行业动态']
      ].map(function (x) { return '<div class="mp-cell"><div class="cnum">' + x[0] + '</div><div class="ct">' + x[1] + '</div><div class="cd">' + x[2] + '</div></div>'; }).join('') +
      '</div></div>' +

      '<div class="mp-sec"><div class="mp-num">02</div><div class="mp-h2">年度会员｜全年完整权益清单</div>' +
      '<span class="mp-chip">已落地 · 即刻可用</span>' +
      [['权益 1', '全年沙龙免费参与', '全年所有 AI / 出海主题沙龙，会员<b>全部免门票、不限次数参加</b>。'],
       ['权益 2', '优质老板精准引荐', '平台积累所有探访老板资源，根据你的业务需求，<b>精准匹配、双向引荐对接</b>。'],
       ['权益 3', '赠送 1 条个人业务曝光视频', '免费拍摄一条个人业务探访短视频。1 年内随时可拍、可延后、可保留名额。仅基础拍摄剪辑，不含重拍、精修、付费投流。'],
       ['权益 4', '每月 1 次线下一对一行业咨询', '每月可线下预约 1 次，单次 1 小时，仅信息咨询。当月名额有限，先约先得。'],
       ['权益 5', '会员专属闭门茶话交流会', '定期举办<b>仅会员可参与</b>的小型闭门茶会，同频老板深度交流、互换资源。']
      ].map(function (x) { return '<div class="right-item"><div class="rt"><span class="tagx">' + x[0] + '</span>' + x[1] + '</div><div class="rd">' + x[2] + '</div></div>'; }).join('') +
      '<div style="margin-top:16px"><span class="mp-chip" style="background:#2a2415;color:#888">未来筹备 · 会员优先</span>' +
      '<div class="right-item"><div class="rt"><span class="tagx">权益 6</span>标杆企业 / 工厂闭门游学参访</div><div class="rd">后续持续落地：出海标杆工厂、跨境头部公司、AI 优质企业实地走访游学。会员<b>免费报名、优先参与</b>。（交通、食宿自理）</div></div></div>' +
      '</div>' +

      '<div class="mp-sec"><div class="mp-num">03</div><div class="mp-h2">会员服务规则｜透明公开</div><div class="mp-p">' +
      '1. 会员有效期：开通日起一整年有效，到期可续费。<br>' +
      '2. 所有咨询、茶会、活动均为预约制、名额有限、先约先得。<br>' +
      '3. 资源引荐为「牵线匹配」，不承诺成交、不保证收益。<br>' +
      '4. 曝光视频为基础模板成片，不含无限次修改、投流推广。<br>' +
      '5. 标杆企业游学为后续规划项目，暂未上线。</div></div>' +

      '<div class="mp-sec"><div class="mp-num">04</div><div class="mp-h2">常见问题</div>' +
      [['1980 能享多久？', '有效期一整年，到期可续费。续费是续新的 1 年，不是永久会员。'],
       ['所有权益付款后马上能用吗？', '沙龙、资源引荐、咨询、茶会权益即刻生效；企业游学为后续落地权益。'],
       ['会员可以退款吗？', '7 天内未使用任何会员权益可申请退款；一旦使用任意一项权益，不支持退款。'],
       ['开通后怎么对接？', '支付成功后按页面指引添加主理人微信、填写会员信息登记表，之后所有预约与引荐都由主理人一对一对接。']
      ].map(function (x) { return '<div class="faq-item" onclick="this.classList.toggle(\'open\')"><div class="q">' + x[0] + '</div><div class="a">' + x[1] + '</div></div>'; }).join('') +
      '</div>' +

      '<div class="mp-sec" style="text-align:center"><div class="mp-h2">加入 AI 出海 高端老板私董圈</div>' +
      '<div class="mp-p">从「单打独斗」→「圈子资源共赢」</div>' +
      '<button class="btn-gold" onclick="UI.openSheet(\'paySheet\')">立即开通 年度 会员</button>' +
      '<div class="mp-org" style="text-align:center">点击开通即表示已阅读并同意上方《会员服务规则》</div></div>' +
      '</div>';
    var priceEl = document.getElementById('payPrice');
    priceEl.textContent = '¥' + c.memberPrice + ' / 年';
  }

  /* ================= 页面：分销中心 ================= */
  function pageDistribute() {
    var db = S.get(), u = db.user, c = db.config;
    var link = location.origin + location.pathname + '?d=' + u.inviteCode;
    var pending = db.commissions.filter(function (x) { return x.status === '待结算'; }).reduce(function (a, b) { return a + b.amount; }, 0);
    var settling = db.commissions.filter(function (x) { return x.status === '结算中'; }).reduce(function (a, b) { return a + b.amount; }, 0);
    var settled = db.commissions.filter(function (x) { return x.status === '已结算'; }).reduce(function (a, b) { return a + b.amount; }, 0);
    var locked = db.clients.filter(function (x) { return x.locked && x.owner === u.nickname; }).length;
    var unlocked = db.clients.filter(function (x) { return !x.locked && x.owner === u.nickname; }).length;
    var notice = db.notices[0];

    phone.innerHTML = pagebar('分销中心', '#/me') +
      '<div class="dist-wrap">' +
      '<div class="dist-hero"><div class="dh-hi">您好，' + u.nickname + '</div>' +
      '<div class="dh-sub">分销员 · 会员佣金 ' + c.memberCommissionRate + '% · 沙龙 ' + c.salonCommissionRate + '%</div>' +
      '<div class="dist-stats">' +
      '<div class="ds"><div class="v o">¥' + pending.toFixed(2) + '</div><div class="k">待结算</div></div>' +
      '<div class="ds"><div class="v b">¥' + settling.toFixed(2) + '</div><div class="k">结算中</div></div>' +
      '<div class="ds"><div class="v g">¥' + settled.toFixed(2) + '</div><div class="k">已结算</div></div>' +
      '</div></div>' +

      '<div class="panel"><div class="p-title">📊 我的业绩看板</div>' +
      '<div class="kanban-row">' +
      [['今日成交', '¥0'], ['今日锁客', '0 人'], ['累计客户', db.clients.length + ' 人'], ['累计佣金', '¥' + (pending + settled)]].map(function (x) {
        return '<div class="kb"><div class="v">' + x[1] + '</div><div class="k">' + x[0] + '</div></div>';
      }).join('') + '</div></div>' +

      '<div class="panel"><div class="p-title">📇 我的企业微信码</div>' +
      '<div class="qr-area"><div class="qr-box">' + qrSVG(c.wecomQRText) + '</div>' +
      '<div><div class="qr-ok">✔ 已通过 · 客户凭证页可见此码</div>' +
      '<div class="p-sub" style="margin-top:6px">客户付款/报名后扫码直接进群</div></div></div>' +
      '<button class="btn-ghost" onclick="UI.toast(\'已发起更换（演示）\')">更换二维码</button></div>' +

      '<div class="panel lock-panel"><div class="p-title">🔒 我的专属链接（锁粉）</div>' +
      '<div class="lock-tip">客户首次点你的链接进入即锁定到你名下，锁定 <b>' + c.lockDays + ' 天</b>内有效——他买任何产品（会员 / 沙龙）佣金都归你</div>' +
      '<div class="link-box" onclick="UI.copy(this.textContent.replace(/ · 点击复制/,\'\'))">' + link + ' · 点击复制</div>' +
      '<div class="gen-btns">' +
      '<div class="gen-btn b1" onclick="UI.go(\'#/share\')">↗ 生成转发卡片（点开即锁粉）</div>' +
      '<div class="gen-btn b2" onclick="UI.toast(\'已生成沙龙排期海报（演示）\')">🗓️ 生成沙龙排期海报</div>' +
      '<div class="gen-btn b3" onclick="UI.toast(\'已生成单期主题海报（演示）\')">🎯 生成单期主题海报（扫码直达报名页）</div>' +
      '<div class="gen-btn b4" onclick="UI.go(\'#/poster\')">🤝 生成商务合作海报（扫码锁粉 + 直达合作申请）</div>' +
      '</div></div>' +

      '<div class="menu-card dist-menu">' +
      '<div class="menu-item" onclick="UI.go(\'#/notices\')"><div class="menu-ico">📢</div><span class="mi-t">公告与规则</span>' +
      (notice ? '<span class="mi-s">· ' + notice.content.slice(0, 14) + '…</span>' : '') + '<span class="arrow">›</span></div>' +
      '<div class="menu-item" onclick="UI.go(\'#/clients\')"><div class="menu-ico">👥</div><span class="mi-t">我的客户（' + db.clients.length + '）</span><span class="mi-s">锁定中 ' + locked + ' 位 · 已解锁 ' + unlocked + ' 位</span><span class="arrow">›</span></div>' +
      '<div class="menu-item" onclick="UI.go(\'#/commission\')"><div class="menu-ico">💵</div><span class="mi-t">佣金明细</span><span class="mi-s">待结算 ' + db.commissions.filter(function (x) { return x.status === '待结算'; }).length + ' 笔</span><span class="arrow">›</span></div>' +
      '<div class="menu-item" onclick="UI.go(\'#/referrals\')"><div class="menu-ico">🤝</div><span class="mi-t">我的引荐</span><span class="mi-s">客户引荐单对接 · ' + c.refundHours + 'h 内提交、公司确认后佣金生效</span><span class="arrow">›</span></div>' +
      '<div class="menu-item" onclick="UI.go(\'#/leads\')"><div class="menu-ico">🧲</div><span class="mi-t">我的合作线索</span><span class="mi-s">客户扫你的合作海报提交，谈成后给你分佣</span><span class="arrow">›</span></div>' +
      '</div></div>';
  }

  /* ================= 页面：转发给好友 ================= */
  function pageShare() {
    var c = S.get().config, u = S.get().user;
    phone.innerHTML = '' +
      '<div class="share-page">' +
      '<div class="sp-t">转发给好友</div><div class="sp-s">微信小程序卡片 · 链接自动携带分销参数</div>' +
      '<div class="share-card"><img class="share-logo" src="img/logo-icon.png?v=103" alt=""><div><div class="sc-t">乐道AI · AI 老板资源圈</div><div class="sc-s">AI 自媒体老板圈子 · 会员 · 沙龙</div></div></div>' +
      '<div class="share-tip">✅ 好友点开这个链接就自动锁粉到 <b>' + u.nickname + '</b> 名下，他买任何产品（会员/沙龙）佣金都归你 —— 无需海报，转发即分销</div>' +
      '<button class="btn-wechat" onclick="UI.toast(\'已复制链接，去微信粘贴给好友即可\')">复制链接 · 发给好友</button>' +
      '<button class="btn-plain" onclick="UI.go(\'#/distribute\')">关闭</button>' +
      '</div>';
  }

  /* ================= 页面：商务合作海报 ================= */
  function pagePoster() {
    var u = S.get().user;
    phone.innerHTML = '' +
      '<div class="poster-page">' +
      '<div class="pp-t">商务合作海报</div>' +
      '<div class="pp-s">二维码是你的专属锁粉链接 · 谁扫谁就是你的客户 · 长按图片保存到相册</div>' +
      '<div class="poster">' +
      '<div class="po-k">' + S.get().config.organizer.replace('市', '市 ') + ' · 商务合作</div>' +
      '<div class="po-big">跟乐道牵手合作</div>' +
      '<div class="po-sub">深圳 AI 自媒体 MCN · 16000+ 私域老板</div>' +
      '<div class="po-sec">合作流程</div>' +
      '<div class="po-step"><div class="n">1</div><div><div class="t">扫码填表</div><div class="d">30 秒，说清你是做什么的</div></div></div>' +
      '<div class="po-step"><div class="n">2</div><div><div class="t">主理人联系</div><div class="d">24 小时内，直接跟你谈</div></div></div>' +
      '<div class="po-step"><div class="n">3</div><div><div class="t">谈成即合作</div><div class="d">供货 / 分销 / 联名都能谈</div></div></div>' +
      '<div class="qr-wrap"><div class="qbox">' + qrSVG('coop-' + u.inviteCode) + '</div>' +
      '<div class="qt">扫码填写合作意向</div><div class="qd">主理人 24 小时内联系你 · 不收费</div></div>' +
      '</div>' +
      '<button class="btn-plain" style="margin-top:14px" onclick="UI.go(\'#/distribute\')">关闭</button>' +
      '</div>';
  }

  /* ================= 页面：公告与规则 ================= */
  function pageNotices() {
    var db = S.get();
    phone.innerHTML = pagebar('公告与规则', '#/distribute') +
      '<div class="notice-card"><div class="n-h">💡 ' + (db.notices[0] ? db.notices[0].type : '公告') + '（' + db.notices.length + '）</div>' +
      db.notices.map(function (n) {
        return '<div class="notice-item" onclick="UI.toast(\'打开公告详情（演示）\')">' +
          '<div class="n-ico">📣</div><div style="flex:1"><div class="n-t">📌 ' + n.title + '</div>' +
          '<div class="n-b">' + n.content + '</div><div class="n-d">' + n.date + '</div></div><span class="chev">›</span></div>';
      }).join('') + '</div>';
  }

  /* ================= 页面：我的引荐 ================= */
  function pageReferrals() {
    var db = S.get(), c = db.config;
    phone.innerHTML = pagebar('我的引荐', '#/distribute') +
      (db.referrals.length ?
        '<div class="boss-list">' + db.referrals.map(function (r) {
          return '<div class="lead-card"><div class="lc-top"><span class="lc-name">引荐 · ' + r.boss + '</span>' +
            '<span class="lc-status ' + (r.status === '已对接' ? 'done' : 'wait') + '">' + r.status + '</span></div>' +
            '<div class="lc-row">客户：' + r.client + ' · 佣金 ¥' + r.commission + '</div>' +
            '<div class="lc-row">' + r.submitTime + '</div></div>';
        }).join('') + '</div>'
        :
        '<div class="empty-panel">暂无引荐单 · 客户通过你的链接付费引荐后会出现在这里</div>') +
      '<div class="flow-tip">对接流程：找公司拿老板微信 → 推给客户 → 点「提交对接完成」→ 公司确认后佣金生效 · ' + c.refundHours + ' 小时未提交系统自动退款</div>';
  }

  /* ================= 页面：我的合作线索 ================= */
  function pageLeads() {
    var db = S.get();
    var mine = db.leads.filter(function (l) { return l.from.indexOf(db.user.nickname) >= 0; });
    var wait = mine.filter(function (l) { return l.status === '待跟进'; }).length;
    var done = mine.filter(function (l) { return l.status === '已合作'; }).length;
    phone.innerHTML = pagebar('我的合作线索', '#/distribute') +
      '<div class="lead-hero"><div class="lt">🧲 我的合作线索</div><div class="ls">共 ' + mine.length + ' 条 · 待跟进 ' + wait + ' · 已合作 ' + done + '</div></div>' +
      '<div class="lead-info">这是你的客户通过你的海报 / 链接扫码提交的商务合作申请。<br>谁扫过你的码，提交时就自动算你的（在锁粉有效期内）。' +
      '<div class="gen" onclick="UI.go(\'#/poster\')">🧲 生成商务合作海报去获客</div></div>' +
      '<div style="padding:12px 16px 0;font-size:11px;color:var(--txt2)">点卡片展开客户填写的完整内容 · 预算档只有主理人能看到</div>' +
      '<span class="filter-chip">全部 ' + mine.length + '</span>' +
      (mine.length ? mine.map(function (l) {
        return '<div class="lead-card" onclick="UI.toast(\'展开线索详情（演示）\')">' +
          '<div class="lc-top"><span class="lc-name">' + l.name + '</span><span class="lc-status ' + (l.status === '已合作' ? 'done' : 'wait') + '">' + l.status + '</span></div>' +
          '<div class="lc-row">' + l.biz + '</div><div class="lc-row">想合作：<b>' + l.coopTypes.join(' / ') + '</b> · 来自 ' + l.from + '</div>' +
          '<div class="lc-row">' + l.time + '</div></div>';
      }).join('') :
        '<div class="empty-panel">还没有合作线索<br>把你的专属合作海报发出去，客户扫码提交后这里就有记录</div>');
  }

  /* ================= 页面：我的客户 + 详情 ================= */
  function pageClients() {
    var db = S.get();
    phone.innerHTML = pagebar('我的客户', '#/distribute') +
      '<div class="boss-list">' + db.clients.map(function (cl) {
        return '<div class="boss-card" style="padding:14px 16px" onclick="UI.go(\'#/client/' + cl.id + '\')">' +
          '<div class="boss-top"><div class="boss-ava" style="background:#eef0f3;color:#9aa5b1">👤</div>' +
          '<div><div class="boss-name" style="font-size:15px">' + cl.nickname + '</div>' +
          '<div class="boss-title">首次锁定 ' + cl.firstLock + ' · ' + (cl.locked ? '锁定至 ' + cl.lockUntil : '已解锁') + '</div></div>' +
          '<span class="arrow">›</span></div></div>';
      }).join('') + '</div>';
  }

  function pageClient(id) {
    var db = S.get();
    var cl = db.clients.find(function (x) { return x.id === id; });
    if (!cl) return;
    phone.innerHTML = pagebar(cl.nickname, '#/clients') +
      '<div class="client-head"><div class="cava">👤</div><div style="flex:1">' +
      '<div class="cn">' + cl.nickname + ' <span class="pill-lock ' + (cl.locked ? 'locked' : 'unlocked') + '">' + (cl.locked ? '🔒 锁定中 · ' + cl.lockUntil + ' 到期' : '✔ 已解锁') + '</span></div>' +
      '<div class="cid">🆔 ' + cl.openid + ' · 首次锁定 ' + cl.firstLock + '</div></div></div>' +
      '<div style="padding:0 18px;font-size:12px;color:var(--txt2)">' + cl.consume + '</div>' +
      '<div class="boss-list">' +
      '<div class="boss-card" style="padding:16px"><div class="p-title">📈 升单记录（0）</div><div class="p-sub" style="margin-top:6px">暂无升单</div></div>' +
      '<div class="boss-card" style="padding:16px"><div class="p-title">🎫 报名过的沙龙（' + cl.salons + '）</div><div class="p-sub" style="margin-top:6px">' + (cl.salons ? 'AI自动化实战沙龙（第100期）' : '还没参加过你的沙龙') + '</div></div>' +
      '<div class="boss-card" style="padding:16px"><div class="p-title">💰 佣金明细（' + (cl.commissionTotal ? 1 : 0) + '）</div><div class="p-sub" style="margin-top:6px">' + (cl.commissionTotal ? '累计佣金 ¥' + cl.commissionTotal : '暂无佣金记录') + '</div></div>' +
      '<div class="boss-card" style="padding:16px"><div class="p-title">🕘 归属历史（1）</div>' +
      '<div class="p-sub" style="margin-top:8px">' + cl.firstLock + ' · 归属 <b style="color:#333">' + cl.owner + '</b> · 到期 ' + cl.lockUntil + ' <span style="color:#2c8a4e;font-weight:600">当前归属</span></div></div>' +
      '</div>' +
      '<div class="privacy-tip">🔒 你已获授权查看客户完整信息，仅限用于对接成交 · 请勿外传或私下加人</div>';
  }

  /* ================= 页面：佣金明细 / 支付记录 / 凭证 ================= */
  function pageCommission() {
    var db = S.get();
    phone.innerHTML = pagebar('佣金明细', '#/distribute') +
      '<div class="boss-list">' + db.commissions.map(function (cm) {
        var st = { '待结算': 'wait', '结算中': 'wait', '已结算': 'done' }[cm.status] || 'wait';
        return '<div class="lead-card"><div class="lc-top"><span class="lc-name">' + cm.type + '佣金 · ' + cm.order + '</span>' +
          '<span class="lc-status ' + st + '">' + cm.status + '</span></div>' +
          '<div class="lc-row">金额 <b>¥' + cm.amount + '</b> · ' + cm.time + '</div></div>';
      }).join('') + '</div>';
  }

  function pagePayments() {
    var db = S.get();
    phone.innerHTML = pagebar('我的支付记录', '#/me') +
      '<div class="boss-list">' + db.payments.map(function (p) {
        return '<div class="lead-card"><div class="lc-top"><span class="lc-name">' + p.title + '</span>' +
          '<span class="lc-status done">' + p.status + '</span></div>' +
          '<div class="lc-row">¥' + p.amount + ' · ' + p.time + '</div></div>';
      }).join('') + (db.payments.length ? '' : '<div class="empty-panel">暂无支付记录</div>') + '</div>';
  }

  function pageTickets() {
    var db = S.get();
    phone.innerHTML = pagebar('我的沙龙凭证', '#/me') +
      '<div class="boss-list">' + db.salonTickets.map(function (t) {
        return '<div class="lead-card"><div class="lc-top"><span class="lc-name">' + t.salon + '</span>' +
          '<span class="lc-status done">' + t.status + '</span></div>' +
          '<div class="lc-row">' + t.date + ' · 凭证码 <b>' + t.code + '</b></div></div>';
      }).join('') + (db.salonTickets.length ? '' : '<div class="empty-panel">暂无沙龙凭证</div>') + '</div>';
  }

  function pageRefVouchers() {
    var db = S.get();
    phone.innerHTML = pagebar('我的引荐凭证', '#/me') +
      '<div class="boss-list">' + db.referrals.map(function (r) {
        return '<div class="lead-card"><div class="lc-top"><span class="lc-name">引荐 · ' + r.boss + '</span>' +
          '<span class="lc-status ' + (r.status === '已对接' ? 'done' : 'wait') + '">' + r.status + '</span></div>' +
          '<div class="lc-row">¥' + r.amount + ' · ' + r.submitTime + ' · 付款后可扫码联系顾问</div></div>';
      }).join('') + (db.referrals.length ? '' : '<div class="empty-panel">暂无引荐凭证</div>') + '</div>';
  }

  /* ================= 页面：我的资料 ================= */
  function pageProfile() {
    var db = S.get(), p = db.user.profile;
    var ageOpts = ['20-30岁', '30-40岁', '40-50岁', '50岁+'];
    var tagOpts = ['跨境电商', 'AI应用', '工厂/供应链', '自媒体', '外贸/出海', '游戏科技', '本地服务', '其他'];
    phone.innerHTML = pagebar('我的资料', '#/me', '<span class="save-top" style="position:absolute;right:16px;font-size:14px;cursor:pointer" onclick="User.saveProfile()">保存</span>') +
      '<div class="form-page">' +
      '<div class="form-card"><div class="f-label">年龄区间</div><div class="chips blue" id="ageChips">' +
      ageOpts.map(function (a) { return '<span class="chip' + (p.ageRange === a ? ' on' : '') + '" data-v="' + a + '">' + a + '</span>'; }).join('') + '</div>' +
      '<div class="f-label">行业标签 <span class="opt">多选，显示在你发布名片时给子好名片边</span></div>' +
      '<div class="chips blue" id="tagChips">' +
      tagOpts.map(function (a) { return '<span class="chip' + (p.industryTags.indexOf(a) >= 0 ? ' on' : '') + '" data-v="' + a + '">' + a + '</span>'; }).join('') + '</div>' +
      '<div class="f-label">一句话介绍</div>' +
      '<textarea class="f-textarea" id="pIntro" placeholder="例：做亚马逊选品，正在找包清关渠道">' + (p.intro || '') + '</textarea>' +
      '</div>' +
      '<div class="form-card"><h4>入驻档案 <span class="opt">仅平台内部可见，不对外开放</span></h4>' +
      '<div class="f-label">姓名 / 称呼 <span class="req">*</span></div><input class="f-input" id="pName" placeholder="例：王建国" value="' + (p.name || '') + '">' +
      '<div class="f-label">微信号</div><input class="f-input" id="pWechat" placeholder="例：wang_1988" value="' + (p.wechat || '') + '">' +
      '<div class="f-label">公司 <span class="req">*</span></div><input class="f-input" id="pCompany" placeholder="例：深圳市某某科技有限公司" value="' + (p.company || '') + '">' +
      '<div class="f-label">行业 <span class="req">*</span></div><input class="f-input" id="pIndustry" placeholder="例：跨境电商" value="' + (p.industry || '') + '">' +
      '<div class="f-label">主营</div><input class="f-input" id="pMainBiz" placeholder="例：亚马逊选品卖家，年销 2000 万" value="' + (p.mainBiz || '') + '">' +
      '<div class="f-label">想对接什么资源</div><input class="f-input" id="pWant" placeholder="例：东南亚物流渠道、TikTok 运营操盘手" value="' + (p.wantResource || '') + '">' +
      '<div class="f-label">现有资源</div><input class="f-input" id="pHas" placeholder="例：深圳仓 2000 平、清关资质、2 个抖音号" value="' + (p.hasResource || '') + '">' +
      '</div>' +
      '<button class="btn-save" onclick="User.saveProfile()">保存资料</button></div>';
    bindChips('ageChips');
    var tagBox = document.getElementById('tagChips');
    tagBox.querySelectorAll('.chip').forEach(function (c) { c.onclick = function () { c.classList.toggle('on'); }; });
  }

  /* ================= 页面：设置 ================= */
  function pageSettings() {
    var u = S.get().user;
    phone.innerHTML = pagebar('设置', '#/me') +
      '<div class="form-page">' +
      '<div class="form-card">' +
      '<div class="f-label">昵称</div><input class="f-input" id="setNick" value="' + u.nickname + '">' +
      '<div class="f-label">身份角色</div><input class="f-input" value="' + u.role + '" disabled><div class="hint">分销员身份由平台开通，如需升级请联系主理人</div>' +
      '<div class="f-label">消息设定</div><input class="f-input" placeholder="接收活动提醒 · 已开启" disabled>' +
      '</div>' +
      '<div class="form-card"><h4>👤 个人资料</h4><div class="hint">头像、一句话介绍、入驻档案</div>' +
      '<button class="btn-ghost" style="margin-top:6px" onclick="UI.go(\'#/profile\')">编辑个人资料</button></div>' +
      '<button class="btn-save" onclick="User.saveSettings()">保存资料</button>' +
      '<button class="btn-plain" style="margin-top:12px;color:var(--red);border-color:#f5d5d5" onclick="User.logout()">退出登录</button>' +
      '<div style="text-align:center;color:var(--txt3);font-size:11px;margin-top:16px">乐道AI 复刻系统 · 演示版本 v1.0</div></div>';
  }

  /* ================= 页面：商务合作表单 ================= */
  function pageCoop() {
    phone.innerHTML = pagebar('商务合作', '#/salon') +
      '<div class="form-page">' +
      '<div class="coop-hero">填完提交，主理人会直接看到<br><b>我们通常 24 小时内联系你</b></div>' +
      '<div class="form-card"><div class="f-label">你的称呼 / 公司名 <span class="req">*</span></div>' +
      '<input class="f-input" id="coName" value="' + S.get().user.nickname + '"></div>' +
      '<div class="form-card"><div class="f-label">你是做什么的 <span class="req">*</span></div>' +
      '<textarea class="f-textarea" id="coBiz" placeholder="一行业务 + 一行客户，比如：做企业财税代账，客户是深圳中小制造业老板"></textarea>' +
      '<div class="f-label">目前拿到的结果 <span class="opt">选填</span></div>' +
      '<textarea class="f-textarea" id="coResult" placeholder="有数字最好，比如：小红书 8 万粉 / 月流水 30 万 / 服务过 200 家企业"></textarea></div>' +
      '<div class="form-card"><div class="f-label">想怎么合作 <span class="req">*</span><div class="hint">先勾类型，再写具体想法（可多选）</div></div>' +
      '<div class="chips" id="coopChips">' +
      ['供货', '渠道分销', '内容联名', '流量互推', '资源置换', '其他'].map(function (c) {
        return '<span class="chip" data-v="' + c + '">' + c + '</span>';
      }).join('') + '</div>' +
      '<div class="f-label" style="margin-top:16px">具体怎么合作</div>' +
      '<textarea class="f-textarea" id="coDetail" placeholder="具体怎么合作，比如：我有供应链，想给乐道的老板供货分成"></textarea></div>' +
      '<div class="form-card"><div class="f-label">有没有预算 <span class="opt">选填</span></div>' +
      '<div class="chips" id="budgetChips">' +
      ['1万内', '1-5万', '5-10万', '10万+'].map(function (c) { return '<span class="chip" data-v="' + c + '">' + c + '</span>'; }).join('') + '</div></div>' +
      '<button class="btn-save" onclick="User.submitCoop()">提交合作意向</button>' +
      '<div style="text-align:center;font-size:11px;color:var(--txt3);margin-top:12px">提交后主理人 24 小时内联系你 · 不收费</div></div>';
    bindChips('coopChips');
    bindChips('budgetChips');
  }

  /* ================= 页面：沙龙详情 ================= */
  function pageSalonDetail(id) {
    var db = S.get();
    var s = db.salons.find(function (x) { return x.id === id; });
    if (!s) return;
    var seat = Math.max(0, (s.seats || 0) - (s.joined || 0));
    var hot = s.seats ? (s.joined / s.seats) >= 0.8 : false;
    var html = pagebar('沙龙详情', '#/salon') +
      '<div class="boss-detail">' +
      '<div class="bd-card"><div class="boss-name" style="font-size:19px">' + s.title + '</div>' +
      '<div style="margin-top:10px;font-size:13.5px;color:#555;line-height:2">🗓️ ' + s.date + '<br>📍 ' + s.city + ' · ' + s.place + '<br>👥 名额 ' + s.seats + ' · 已报名 ' + s.joined + '</div>' +
      '<div style="margin-top:10px"><span class="tag">' + s.status + '</span></div>' +
      '<div class="bd-text" style="margin-top:12px">' + s.desc + '</div></div>' +

      /* 名额提示条（原站规格：设了名额且未满才出现） */
      ((s.seats && seat > 0)
        ? '<div class="bd-card" style="display:flex;align-items:center;gap:10px">' +
          '<div style="font-size:15px;font-weight:800;color:' + (hot ? 'var(--warn)' : 'var(--green)') + ';flex-shrink:0">剩 ' + seat + ' 个名额</div>' +
          '<div style="font-size:11px;color:var(--txt3)">' + (hot ? '名额紧张，报满即止' : '本期名额有限，报满即止') + '</div></div>'
        : '') +

      /* 沙龙简介 */
      (s.desc ? '<div class="bd-card"><h4>📝 沙龙简介</h4><div style="font-size:12px;color:var(--txt2);line-height:1.8;white-space:pre-wrap">' + s.desc + '</div></div>' : '') +

      /* 沙龙预告视频（原站规格：粉底卡片 + 跳转播放） */
      (s.videoUrl
        ? '<div class="bd-card"><h4>🎬 沙龙预告视频</h4>' +
          '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#fdeaea;border-radius:10px" onclick="window.open(\'' + s.videoUrl + '\',\'_blank\')">' +
          '<div style="width:36px;height:36px;border-radius:10px;background:#fff;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">🎬</div>' +
          '<div style="flex:1;min-width:0"><div style="font-size:12.5px;font-weight:700;color:#a3741b">查看沙龙预告视频</div>' +
          '<div style="font-size:11px;color:var(--txt3);margin-top:1px">视频号实拍 · 点击跳转观看</div></div>' +
          '<span style="color:#a3741b">›</span></div></div>'
        : '') +

      /* 分享要点（原站规格：序号列表） */
      ((s.sharePoints && s.sharePoints.filter(function (x) { return String(x || '').trim(); }).length)
        ? '<div class="bd-card"><h4>📌 分享要点</h4>' +
          s.sharePoints.filter(function (x) { return String(x || '').trim(); }).map(function (x, i) {
            return '<div style="display:flex;gap:8px;font-size:12px;color:var(--txt2);line-height:1.7;margin-bottom:5px">' +
              '<span style="flex-shrink:0;color:var(--blue);font-weight:700">' + (i + 1) + '.</span><span style="white-space:pre-wrap">' + x + '</span></div>';
          }).join('') + '</div>'
        : '') +

      /* 适合人群 */
      (s.audience ? '<div class="bd-card"><h4>🎯 适合人群</h4><div style="font-size:12px;color:var(--txt2);line-height:1.8;white-space:pre-wrap">' + s.audience + '</div></div>' : '') +

      /* 报名须知 */
      (s.notice ? '<div class="bd-card"><h4>📋 报名须知</h4><div style="font-size:12px;color:var(--txt2);line-height:1.8;white-space:pre-wrap">' + s.notice + '</div></div>' : '') +

      /* 沙龙现场照片 */
      ((s.photos && s.photos.length)
        ? '<div class="bd-card"><h4>📸 沙龙现场</h4><div class="img-grid">' +
          s.photos.map(function (src) { return '<div class="ph"><img src="' + src + '" style="width:100%;height:100%;object-fit:cover;border-radius:8px"></div>'; }).join('') +
          '</div></div>' : '') +

      ((s.status === '报名中')
        ? '<div style="padding:2px 0 14px"><button class="btn-primary" onclick="User.joinSalon(\'' + s.id + '\')">立即报名</button></div>' +
          '<div class="bd-foot-hint">会员享专属价与优先锁座 · 到场出示报名凭证入场</div>'
        : '<div class="bd-foot-hint">当前' + s.status + '，暂不可报名</div>') +
      '</div>';
    phone.innerHTML = html;
  }

  /* ================= 页面：登录（微信授权即登录） ================= */
  function pageLogin() {
    var inWx = Auth.isWeChat();
    phone.innerHTML = '' +
      '<div class="login-page">' +
      '<img class="lp-logo" src="img/logo-icon.png?v=103" alt="乐道AI">' +
      '<div class="lp-name">乐道AI</div>' +
      '<div class="lp-slogan">AI 出海 · 年度老板会员圈子</div>' +
      '<button class="lp-wx" onclick="User.wxLogin()">' +
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><path d="M9.5 4C5.9 4 3 6.5 3 9.6c0 1.8 1 3.4 2.5 4.5l-.7 2.1 2.4-1.2c.7.2 1.5.3 2.3.3h.4A5.6 5.6 0 0 1 9.6 13c0-3 2.9-5.4 6.4-5.4h.3C15.6 5.5 12.8 4 9.5 4zm-2 3.5a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8zm4.5 0a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8zM16 8.6c-3.2 0-5.8 2.1-5.8 4.7s2.6 4.7 5.8 4.7c.6 0 1.2-.1 1.8-.3l2 1-.6-1.7c1.3-.9 2.2-2.2 2.2-3.7 0-2.6-2.6-4.7-5.4-4.7zm-1.8 2.9a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5zm3.6 0a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5z"/></svg>' +
      (inWx ? '微信授权一键登录' : '微信登录（未配置则模拟授权）') + '</button>' +
      '<div class="lp-tip">登录即代表同意《用户协议》与《隐私政策》<br>' +
      (inWx ? '已识别微信环境 · 正在自动授权登录…' : '未检测到微信环境 · 演示模式：点击按钮即完成模拟授权登录') + '</div>' +
      '</div>';
  }

  /* ================= 路由 ================= */
  /* ================= 页面：圈子（会员动态，原站第 2 个 Tab） ================= */
  var CCL_CATS = [['all', '全部'], ['res', '我有资源'], ['need', '我要找资源'], ['coop', '合作招募'], ['idea', '创业随想']];

  function cclAvatar(a, size) {
    var ch = String((a && (a.nickname || a.name)) || '会').charAt(0);
    return a && a.avatarUrl
      ? '<img src="' + a.avatarUrl + '" style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;object-fit:cover;flex-shrink:0">'
      : '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:linear-gradient(135deg,#0F6E56,#2ecc71);color:#fff;display:flex;align-items:center;justify-content:center;font-size:' + Math.round(size * 0.4) + 'px;font-weight:800;flex-shrink:0">' + ch + '</div>';
  }
  function cclAgo(ts) {
    if (!ts) return '';
    var t = typeof ts === 'number' ? ts : Date.parse(String(ts).replace(/-/g, '/'));
    if (!t) return ts;
    var d = Math.floor((Date.now() - t) / 1000);
    if (d < 60) return '刚刚';
    if (d < 3600) return Math.floor(d / 60) + ' 分钟前';
    if (d < 86400) return Math.floor(d / 3600) + ' 小时前';
    if (d < 604800) return Math.floor(d / 86400) + ' 天前';
    var dt = new Date(t);
    return (dt.getMonth() + 1) + '月' + dt.getDate() + '日';
  }
  /* 门槛条：非会员提示开通（原站文案） */
  function cclGateBarHtml() {
    var db = S.get();
    var member = db.user && db.user.role === '会员';
    var logged = window.Auth && Auth.isLoggedIn();
    if (logged && member) return '';
    return '<div class="ccl-gate" onclick="UI.go(\'' + (logged ? '#/member' : '#/login') + '\')">' +
      '<div style="flex:1">' +
      '<div style="font-size:12.5px;font-weight:700;color:var(--green);line-height:1.5">' +
      (logged ? '开通会员，才能发自己的动态' : '成为会员，圈子才能发动态') + '</div>' +
      '<div style="font-size:10.5px;color:#5f6368;margin-top:3px;line-height:1.6">游客可以浏览全部动态；想联系发布人，点动态里的「申请平台引荐」由客服免费拉群。</div>' +
      '</div><span style="font-size:11px;color:var(--green);font-weight:700;flex-shrink:0">' + (logged ? '去开通 ›' : '登录 ›') + '</span></div>';
  }
  function cclCardHtml(p) {
    var a = p.author || {};
    var imgs = p.images || [];
    var imgHtml = '';
    if (imgs.length === 1) {
      imgHtml = '<div style="margin-top:10px"><img src="' + imgs[0] + '" style="width:100%;max-height:220px;object-fit:cover;border-radius:10px;background:#eef0f3"></div>';
    } else if (imgs.length > 1) {
      imgHtml = '<div class="ccl-imgs">' + imgs.map(function (u) { return '<img src="' + u + '">'; }).join('') + '</div>';
    }
    var videoHtml = p.videoUrl
      ? '<div class="ccl-video" onclick="event.stopPropagation();window.open(\'' + p.videoUrl + '\',\'_blank\')">' +
        '<span style="font-size:14px">🎬</span><span style="flex:1">探访视频 · 点开看看这家公司</span><span style="font-size:11px;color:#a3741b">播放 ›</span></div>'
      : '';
    var catName = (CCL_CATS.filter(function (c) { return c[0] === p.cat; })[0] || [])[1] || '分享';
    return '<div class="ccl-card" onclick="UI.go(\'#/circle-detail/' + p.id + '\')">' +
      '<div class="ccl-head">' + cclAvatar(a, 38) +
      '<div style="flex:1;min-width:0">' +
      '<div style="font-size:13.5px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (a.nickname || '会员') +
      (a.industry ? '<span style="font-size:10.5px;font-weight:400;color:#9aa0a6;margin-left:6px">' + a.industry + '</span>' : '') + '</div>' +
      '<div style="font-size:10.5px;color:#9aa0a6;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (a.company || '') + '</div>' +
      '</div>' +
      (p.pinned ? '<span class="ccl-chip" style="background:#fdf3e2;color:#a3741b">📌 置顶</span>' : '') +
      '<span class="ccl-chip" style="background:var(--brand-l);color:var(--blue)">' + catName + '</span>' +
      '</div>' +
      (p.content ? '<div class="ccl-body">' + String(p.content).replace(/</g, '&lt;').replace(/\n/g, '<br>') + '</div>' : '') +
      imgHtml + videoHtml +
      '<div class="ccl-foot"><span>' + cclAgo(p.createdAt) + '</span>' +
      '<span style="color:var(--green);font-weight:700">' + (p.mine ? '我发的 · 看看 ›' : '想联系 TA ›') + '</span></div>' +
      '</div>';
  }

  function pageCircle() {
    var db = S.get();
    var cat = window._cclCat || 'all';
    var list = (db.posts || []).filter(function (p) { return cat === 'all' || p.cat === cat; });
    list = list.slice().sort(function (a, b) { return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || String(b.createdAt).localeCompare(String(a.createdAt)); });
    var html = pagebar('圈子', '#/circle', '<span class="top-act" onclick="UI.go(\'#/circle-pub\')">发动态</span>') +
      cclGateBarHtml() +
      '<div class="ccl-cats">' + CCL_CATS.map(function (c) {
        return '<span class="ccl-cat ' + (cat === c[0] ? 'on' : '') + '" onclick="window._cclCat=\'' + c[0] + '\';render()">' + c[1] + '</span>';
      }).join('') + '</div>' +
      '<div class="ccl-list">' +
      (list.length
        ? list.map(cclCardHtml).join('') + '<div class="ccl-end">— 到底了 —</div>'
        : '<div class="empty-salon"><div class="ico">○</div><p>' + (cat === 'all' ? '圈子里还没有动态' : '这个分类下还没有动态') + '</p><div style="font-size:11px;color:#b0b5bb;margin-top:8px">会员发布的供需/资源动态会显示在这里</div></div>') +
      '</div>' + vipFabHtml() + tabbar('circle');
    phone.innerHTML = html;
  }

  function pageCircleDetail(id) {
    var db = S.get();
    var p = (db.posts || []).filter(function (x) { return x.id === id; })[0];
    if (!p) { phone.innerHTML = pagebar('动态详情', '#/circle') + '<div class="empty-salon">动态不存在</div>'; return; }
    var catName = (CCL_CATS.filter(function (c) { return c[0] === p.cat; })[0] || [])[1] || '分享';
    phone.innerHTML = pagebar('动态详情', '#/circle') +
      '<div class="ccl-list">' + cclCardHtml(p) +
      '<div class="bd-card" style="margin-top:10px"><h4>想联系 TA？</h4>' +
      '<div class="hint" style="font-size:12px;color:var(--txt2);line-height:1.7">' +
      '点下方按钮申请平台引荐，客服免费拉群对接。会员每月有免费引荐额度，超出后按平台标准计费。</div>' +
      '<div style="margin-top:12px"><button class="btn-primary" onclick="User.cclRefer(\'' + p.id + '\')">申请平台引荐</button></div>' +
      '<div class="bd-foot-hint">分类：' + catName + ' · 信息由发布人本人提供 · 联系方式由平台打码保护</div></div></div>';
  }

  function pageCirclePub() {
    var db = S.get();
    if (!db.user || db.user.role !== '会员') {
      phone.innerHTML = pagebar('发布动态', '#/circle') +
        cclGateBarHtml() +
        '<div class="empty-salon"><div class="ico">👑</div><p>开通会员后即可发布动态</p>' +
        '<div style="margin-top:14px"><button class="btn-primary" onclick="UI.go(\'#/member\')">开通年度老板会员</button></div></div>';
      return;
    }
    var cat = window._cclPubCat || 'res';
    if (!window._cclPubImgs) window._cclPubImgs = [];
    if (!window._cclPubAgree) window._cclPubAgree = false;
    phone.innerHTML = pagebar('发布动态', '#/circle') +
      '<div class="ccl-pub">' +
      '<div class="fld"><div class="lb">昵称（前台只显示微信头像与昵称）</div>' +
      '<input id="cclNick" maxlength="20" value="' + (db.user.nickname || '') + '" placeholder="例如：老王 · 跨境电商"></div>' +
      '<div class="fld"><div class="lb">分类</div><div class="ccl-chips">' +
      CCL_CATS.filter(function (c) { return c[0] !== 'all'; }).map(function (c) {
        return '<span class="chip ' + (cat === c[0] ? 'on' : '') + '" onclick="window._cclPubCat=\'' + c[0] + '\';render()">' + c[1] + '</span>';
      }).join('') + '</div></div>' +
      '<div class="fld"><div class="lb">说点什么</div>' +
      '<textarea id="cclContent" placeholder="说说你的资源、需求或合作计划…">' + (window._cclPubText || '') + '</textarea></div>' +
      '<div class="fld"><div class="lb">配图 <span style="font-weight:400;color:#9aa0a6">（选填，最多 9 张）</span></div>' +
      '<div class="ccl-picks">' +
      window._cclPubImgs.map(function (u, i) {
        return '<span class="pk"><img src="' + u + '"><span class="x" onclick="User.cclDelImg(' + i + ')">✕</span></span>';
      }).join('') +
      (window._cclPubImgs.length < 9 ? '<div class="ccl-pick-add" onclick="User.cclPickImgs()"><span style="font-size:20px;color:#b0b5bb">+</span><span style="font-size:10px;color:#b0b5bb">添加图片</span></div>' : '') +
      '</div></div>' +
      '<div class="fld"><div class="ccl-agree" onclick="window._cclPubAgree=!window._cclPubAgree;render()">' +
      '<span class="box ' + (window._cclPubAgree ? 'on' : '') + '">✓</span>' +
      '<span>我已阅读并同意《圈子发布规范》：不发布违法违规内容，联系方式由平台自动打码，首条动态需平台审核。</span></div></div>' +
      '<div style="padding:2px 0 14px"><button class="btn-primary" onclick="User.cclPublish()">发布动态</button></div>' +
      '</div>' + tabbar('circle');
  }

  function pageCircleMine() {
    var db = S.get();
    var mine = (db.posts || []).filter(function (p) { return p.mine; });
    phone.innerHTML = pagebar('我的动态', '#/circle') +
      '<div class="ccl-list">' +
      (mine.length ? mine.map(cclCardHtml).join('') : '<div class="empty-salon"><div class="ico">○</div><p>你还没有发布动态</p></div>') +
      '</div>'; return;
  }

  var routes = {
    'circle': pageCircle,
    'circle-pub': pageCirclePub,
    'circle-mine': pageCircleMine,
    'salon': pageSalon,
    'boss': pageBoss,
    'me': pageMe,
    'member': pageMember,
    'distribute': pageDistribute,
    'share': pageShare,
    'poster': pagePoster,
    'notices': pageNotices,
    'referrals': pageReferrals,
    'leads': pageLeads,
    'clients': pageClients,
    'commission': pageCommission,
    'payments': pagePayments,
    'tickets': pageTickets,
    'refvouchers': pageRefVouchers,
    'profile': pageProfile,
    'settings': pageSettings,
    'coop': pageCoop,
    'login': pageLogin
  };

  function render(keepScroll) {
    var h = location.hash.replace('#/', '') || 'salon';
    /* 路由守卫：未登录统一进入微信授权登录页 */
    if (!Auth.isLoggedIn() && h !== 'login') h = 'login';
    var y = window.scrollY;
    if (h.indexOf('boss/') === 0) { pageBossDetail(h.split('/')[1]); }
    else if (h.indexOf('refer/') === 0) { pageRefer(h.split('/')[1]); }
    else if (h.indexOf('client/') === 0) { pageClient(h.split('/')[1]); }
    else if (h.indexOf('salon-detail/') === 0) { pageSalonDetail(h.split('/')[1]); }
    else if (h.indexOf('circle-detail/') === 0) { pageCircleDetail(h.split('/')[1]); }
    else if (routes[h]) { routes[h](); }
    else { pageSalon(); }
    if (keepScroll) window.scrollTo(0, y); else window.scrollTo(0, 0);
  }
  /* 暴露给内联事件（分类筛选/搜索清空等）—— 内联 onclick 在全局作用域执行 */
  window.render = render;

  window.addEventListener('hashchange', function () { render(); });

  /* 云端数据初始化：拉取最新内容（后台在其他设备改的数据），有变化则刷新当前页 */
  if (S.initSync) {
    S.initSync(function () { render(true); }, function () {
      /* 云端暂不可达：静默沿用本地缓存 */
    });
  }

  /* 启动：处理微信授权回调 → 同步登录态 → 微信内自动授权登录 → 首次渲染 */
  Auth.handleCallback()
    .then(function () { Auth.syncToStore(); })
    .catch(function () { /* 授权失败则回到登录页 */ Auth.logout(); })
    .then(function () {
      var auto = Auth.tryAutoLogin(); // 微信内：自动授权，无需点击
      if (auto && typeof auto.then === 'function') {
        auto.then(function (s) {
          if (s) { Auth.syncToStore(); UI.toast('微信授权成功，欢迎 ' + (s.nickname || '')); }
          render();
        }).catch(function () { render(); });
      } else { render(); }
    });

  /* ================= 用户操作 ================= */
  var User = window.User = {
    menuClick: function (target) {
      if (target === 'service') { UI.toast('客服微信：' + S.get().config.serviceWechat + '（已复制）'); UI.copy(S.get().config.serviceWechat); return; }
      if (target === 'wxprofile') { User.fetchWxProfile(); return; }
      UI.go(target || '#/me');
    },
    /* 获取微信头像昵称：真实授权走微信网页授权；演示模式同步身份并刷新头像 */
    fetchWxProfile: function () {
      var p = Auth.fetchProfile();
      if (!p) return; // 真实授权模式：已跳转微信，回调后自动更新
      p.then(function (s) {
        Auth.syncToStore();
        UI.toast('已获取微信头像昵称' + (s.demo ? '（演示模式）' : ''));
        render();
      }).catch(function (e) { UI.toast(e.message || '获取失败'); });
    },
    payMember: function () {
      var db = S.get(), c = db.config;
      db.payments.unshift({ id: S.uid('p'), title: 'AI出海年度老板会员', amount: c.memberPrice, status: '已支付', time: S.today() + ' ' + new Date().toTimeString().slice(0, 5) });
      db.user.role = '会员';
      db.orders.unshift({ id: S.uid('o'), type: '会员', product: 'AI出海年度老板会员', user: '微信用户（本人）', amount: c.memberPrice, distributor: '梓', commission: c.memberPrice * c.memberCommissionRate / 100, status: '已完成', time: S.today() });
      db.commissions.unshift({ id: S.uid('cm'), order: db.orders[0].id, type: '会员', amount: c.memberPrice * c.memberCommissionRate / 100, status: '待结算', time: S.today() });
      S.save(); UI.closeSheet();
      UI.toast('开通成功！主理人将一对一对接');
      setTimeout(function () { UI.go('#/me'); }, 900);
    },
    submitRefer: function (bossId) {
      var db = S.get(), b = db.bosses.find(function (x) { return x.id === bossId; });
      var meet = document.querySelector('#meetChips .chip.on');
      var note = document.getElementById('referNote').value;
      db.referrals.unshift({ id: S.uid('r'), boss: b.name, client: db.user.nickname + '（本人）', amount: b.price, commission: Math.round(b.price * 0.3), status: '待对接', submitTime: S.today() + ' ' + new Date().toTimeString().slice(0, 5), note: (meet ? meet.dataset.v : '') + (note ? ' · ' + note : '') });
      db.payments.unshift({ id: S.uid('p'), title: '引荐 · ' + b.name, amount: b.price, status: '已支付', time: S.today() });
      db.orders.unshift({ id: S.uid('o'), type: '引荐', boss: b.name, user: '微信用户（本人）', amount: b.price, distributor: db.user.nickname, commission: Math.round(b.price * 0.3), status: '待对接', time: S.today() });
      S.save();
      UI.toast('提交成功！' + db.config.refundHours + ' 小时内为你对接');
      setTimeout(function () { UI.go('#/refvouchers'); }, 900);
    },
    joinSalon: function (sid) {
      var db = S.get(), s = db.salons.find(function (x) { return x.id === sid; });
      s.joined += 1;
      db.salonTickets.unshift({ id: S.uid('t'), salon: s.title, date: s.date, status: '已报名', code: 'TQ-' + S.today().replace(/-/g, '').slice(4) + '-' + Math.floor(1000 + Math.random() * 9000) });
      S.save();
      UI.toast('报名成功！凭证已生成');
      setTimeout(function () { UI.go('#/tickets'); }, 900);
    },
    /* 点击视频封面 → 跳转视频号播放；未配置链接时进名片详情 */
    openVideo: function (bid) {
      var db = S.get(), b = db.bosses.find(function (x) { return x.id === bid; });
      if (!b) return;
      if (b.videoUrl) {
        UI.toast('正在打开视频号...');
        window.open(b.videoUrl, '_blank');
      } else {
        UI.go('#/boss/' + bid);
      }
    },
    saveProfile: function () {
      var db = S.get(), p = db.user.profile;
      p.name = document.getElementById('pName').value;
      var wEl = document.getElementById('pWechat'); if (wEl) p.wechat = wEl.value;
      p.company = document.getElementById('pCompany').value;
      p.industry = document.getElementById('pIndustry').value;
      p.mainBiz = document.getElementById('pMainBiz').value;
      p.wantResource = document.getElementById('pWant').value;
      p.hasResource = document.getElementById('pHas').value;
      p.intro = document.getElementById('pIntro').value;
      var age = document.querySelector('#ageChips .chip.on'); if (age) p.ageRange = age.dataset.v;
      p.industryTags = Array.prototype.map.call(document.querySelectorAll('#tagChips .chip.on'), function (c) { return c.dataset.v; });
      S.save(); UI.toast('已保存');
      setTimeout(function () { UI.go('#/me'); }, 700);
    },
    saveSettings: function () {
      var db = S.get();
      db.user.nickname = document.getElementById('setNick').value || db.user.nickname;
      S.save(); UI.toast('已保存');
    },
    submitCoop: function () {
      var db = S.get();
      var name = document.getElementById('coName').value;
      var biz = document.getElementById('coBiz').value;
      if (!name || !biz) { UI.toast('请填写称呼和你是做什么的'); return; }
      var types = Array.prototype.map.call(document.querySelectorAll('#coopChips .chip.on'), function (c) { return c.dataset.v; });
      var budgetChip = document.querySelector('#budgetChips .chip.on');
      db.leads.unshift({
        id: S.uid('l'), name: name, biz: biz,
        result: document.getElementById('coResult').value,
        coopTypes: types.length ? types : ['其他'],
        coopDetail: document.getElementById('coDetail').value,
        budget: budgetChip ? budgetChip.dataset.v : '未填',
        contact: db.user.phone,
        status: '待跟进', from: '官方二维码', time: S.today() + ' ' + new Date().toTimeString().slice(0, 5)
      });
      S.save();
      UI.toast('提交成功！主理人 24 小时内联系你');
      setTimeout(function () { UI.go('#/salon'); }, 1000);
    },

    /* ---------- 登录（微信授权即登录，授权成功锁定身份） ---------- */
    wxLogin: function () {
      var p = Auth.isWeChat() ? Auth.wxMpLogin() : Auth.wxOpenLogin();
      if (p) p.then(function (wxUser) {
        if (!wxUser) return; // 真实授权模式：已跳转微信页，等待回调
        Auth.setSession(wxUser);
        Auth.syncToStore();
        UI.toast('微信授权成功，欢迎你（' + (wxUser.label || '演示模式') + '）');
        if (location.hash.replace('#/', '') !== 'salon') UI.go('#/salon');
        else render();
      }).catch(function (e) { UI.toast(e.message || '微信授权失败'); });
    },
    logout: function () {
      Auth.logout();
      UI.toast('已退出登录');
      setTimeout(function () { UI.go('#/login'); render(); }, 600);
    },

    /* ---------- 圈子：发帖 / 配图 / 引荐 ---------- */
    cclPickImgs: function () {
      if (!window.ImgUp) { UI.toast('图片组件未加载'); return; }
      ImgUp.pick({ ratio: 0, max: 1200, quality: 0.75, multiple: true }, function (urls) {
        window._cclPubImgs = (window._cclPubImgs || []).concat(urls).slice(0, 9);
        User.cclKeepDraft();
        render();
        UI.toast('已添加 ' + urls.length + ' 张');
      });
    },
    cclDelImg: function (i) {
      window._cclPubImgs.splice(i, 1);
      User.cclKeepDraft();
      render();
    },
    cclKeepDraft: function () {
      var el = document.getElementById('cclContent');
      var nk = document.getElementById('cclNick');
      if (el) window._cclPubText = el.value;
      if (nk) window._cclPubNick = nk.value;
    },
    cclPublish: function () {
      var db = S.get();
      var content = (document.getElementById('cclContent') || {}).value || '';
      var nick = (document.getElementById('cclNick') || {}).value || db.user.nickname;
      var imgs = window._cclPubImgs || [];
      if (!content.trim() && !imgs.length) { UI.toast('说点什么，或至少配一张图'); return; }
      if (!window._cclPubAgree) { UI.toast('请先勾选《圈子发布规范》'); return; }
      db.user.nickname = nick || db.user.nickname;
      db.posts.unshift({
        id: S.uid('p'), cat: window._cclPubCat || 'res', content: content.trim(),
        images: imgs.slice(), mine: true, pinned: false,
        createdAt: new Date().toISOString(),
        author: { nickname: db.user.nickname, avatarUrl: db.user.avatar, company: db.user.profile.company || '', industry: db.user.profile.industry || '' }
      });
      S.save();
      window._cclPubText = ''; window._cclPubImgs = []; window._cclPubAgree = false;
      UI.toast('发布成功，已进入平台审核');
      setTimeout(function () { UI.go('#/circle'); }, 700);
    },
    cclRefer: function (id) {
      var db = S.get();
      var p = (db.posts || []).filter(function (x) { return x.id === id; })[0] || {};
      db.referrals.unshift({
        id: S.uid('r'), boss: (p.author && p.author.nickname) || '圈子会员', client: '平台引荐（圈子）',
        amount: 0, commission: 0, status: '待对接', submitTime: S.today() + ' ' + new Date().toTimeString().slice(0, 5),
        note: '圈子动态引荐 · 客服免费拉群'
      });
      S.save();
      UI.toast('已提交申请，客服将免费拉群对接');
      setTimeout(function () { UI.go('#/circle'); }, 800);
    }
  };
})();
