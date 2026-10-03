/* ============================================================
 * 乐道AI · 复刻系统 —— 用户端逻辑（SPA · hash 路由）
 * 路由总表：
 *   salon / salon-detail/:id        沙龙列表 / 详情
 *   boss / boss/:id                 老板资源列表 / 名片
 *   refer/:id                       引荐提交
 *   circle / circle-pub / circle-mine / circle-detail/:id
 *   me / settings / myprofile       我的 / 设置 / 我的资料
 *   vip                             会员落地页（10 屏）
 *   pay/:kind/:id                   收银台（沙龙报名 / 老板引荐）
 *   ticket / ticket/:id             沙龙报名凭证
 *   refer-ticket                    我的引荐凭证
 *   my-pay                          我的支付记录
 *   advisor                         会员专属顾问
 *   coop-apply / coop-ok            商务合作申请 / 成功
 *   notifs                          消息通知中心
 *   verify                          核销台
 *   distro*                         分销中心（js/distro.js）
 *   boss-*                          老板工作台（js/workbench.js）
 * ============================================================ */
(function () {
  'use strict';

  var S = window.Store;
  var phone = document.getElementById('phone');
  function $(id) { return document.getElementById(id); }

  /* ---------------- UI 工具 ---------------- */
  var UI = window.UI = {
    toast: function (msg) {
      var t = document.getElementById('toast');
      t.textContent = msg; t.style.display = 'block';
      clearTimeout(t._h);
      t._h = setTimeout(function () { t.style.display = 'none'; }, 1800);
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

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function money(n) { return '¥' + (Math.round((+n || 0) * 100) / 100).toLocaleString('zh-CN'); }
  function nowStr() { return S.today() + ' ' + new Date().toTimeString().slice(0, 5); }

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
    /* 原站底部导航：沙龙 / 圈子 / 老板 / 我的（4 个 Tab；老板可配置隐藏圈子/老板） */
    var db = S.get();
    var hidden = (db.config.hiddenTabs || []);
    var u = db.user || {};
    var isBoss = (u.role === 'boss' || u.superadmin);
    var tabs = [['salon', '沙龙', ICONS.calendar, 'salons'], ['circle', '圈子', ICONS.circle, 'circle'], ['boss', '老板', ICONS.briefcase, 'bosses'], ['me', '我的', ICONS.person, 'mine']];
    return '<div class="tabbar">' + tabs.map(function (t) {
      var hid = hidden.indexOf(t[3]) >= 0;
      if (hid && !isBoss) return '';
      return '<a class="tab ' + (active === t[0] ? 'on' : '') + (hid ? ' is-hid' : '') + '" href="#/' + t[0] + '">' + t[2] +
        '<span>' + t[1] + (hid ? ' · 隐' : '') + '</span></a>';
    }).join('') + '</div>';
  }

  /* 会员开通悬浮按钮（原站规格：左缘金色书签，仅非会员可见） */
  function vipFabHtml() {
    var u = S.get().user;
    if (u && u.member) return '';
    return '<div class="vip-fab" onclick="UI.go(\'#/vip\')">' +
      '<span class="fab-t">开</span><span class="fab-t">通</span><span class="fab-t">会</span><span class="fab-t">员</span></div>';
  }

  function loginChip() {
    var on = window.Auth && Auth.isLoggedIn();
    return '<a class="login-chip" href="#/login" aria-label="前往登录">' + (on ? '切换账号' : '登录 / 注册') + '</a>';
  }

  function coverStyle(key, title) {
    var grads = {
      codex: 'linear-gradient(135deg,#0b1530 0%,#14306e 55%,#0b1530 100%)',
      sea: 'linear-gradient(135deg,#0e4d5c,#12718a)',
      'class': 'linear-gradient(135deg,#c9b48a,#8f7b52)',
      boss: 'linear-gradient(135deg,#3a3f4a,#22262e)',
      party: 'linear-gradient(135deg,#7a4a3a,#4a2c22)'
    };
    return 'background:' + (grads[key] || grads.boss) + ';';
  }

  /* 暴露给子模块（workbench.js / distro.js）与内联事件 */
  /* ================= 门票调整：前后端联动（仅数据与交互，不改布局/样式/元素位置） ================= */
  var API_BASE = (window.WX_CONFIG && window.WX_CONFIG.apiBase) || '/api';

  /* 本地兜底计算：规则与后端 ticketCalc 保持一致（后端不可达时使用） */
  function ticketLocal(s, isMember, db) {
    var tk = s.ticketAdjust || {};
    var today = S.today();
    var base = isMember ? (s.mprice || 0) : (s.price || 0);
    var winOk = (!tk.from || today >= String(tk.from)) && (!tk.to || today <= String(tk.to));
    var active = !!tk.enabled && winOk;
    var bought = (db.signups || []).filter(function (x) {
      return x.kind === 'salon' && x.evId === s.id && x.phone === (db.user || {}).phone && x.paid && !x.refunded;
    }).length;
    var limit = +tk.limit || 0;
    return {
      active: active, windowOk: winOk, basePrice: base,
      originPrice: tk.originPrice != null ? +tk.originPrice : (s.price || 0),
      adjustPrice: +tk.adjustPrice || 0,
      finalPrice: active ? (+tk.adjustPrice || 0) : base,
      limit: limit, bought: bought, remaining: limit ? Math.max(0, limit - bought) : -1,
      limitOk: !limit || bought < limit, hint: tk.hint || '', note: tk.note || ''
    };
  }

  function apiPost(path, payload, cb) {
    try {
      fetch(API_BASE + path, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload || {})
      }).then(function (r) { return r.json(); }).then(function (d) { cb(d); })
        .catch(function () { cb(null); });
    } catch (e) { cb(null); }
  }

  /* 圈子发布：敏感信息打码（与后端 server.js maskSensitive 同一套规则，接口不可达时本地兜底） */
  function cclMask(text) {
    var s = String(text || '');
    var flags = [];
    if (/1[3-9]\d{9}/.test(s)) { flags.push('phone'); s = s.replace(/1[3-9]\d{9}/g, '［手机号已隐藏］'); }
    if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(s)) { flags.push('email'); s = s.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '［邮箱已隐藏］'); }
    if (/(?:QQ|qq|ＱＱ)[：:\s]*\d{5,12}/.test(s)) { flags.push('qq'); s = s.replace(/(?:QQ|qq|ＱＱ)[：:\s]*\d{5,12}/g, '［QQ已隐藏］'); }
    if (/(?:微信号|微信|加v|加V|加VX|加vx|wx|WX|vx|VX)[：:\s]*[A-Za-z][A-Za-z0-9_-]{5,19}/.test(s)) { flags.push('wechat'); s = s.replace(/(?:微信号|微信|加v|加V|加VX|加vx|wx|WX|vx|VX)[：:\s]*[A-Za-z][A-Za-z0-9_-]{5,19}/g, '［微信号已隐藏］'); }
    return { text: s, flags: flags };
  }

  /* 向后端查询门票最终应付价与限购状态；先立即回调本地结果，后端返回后再回调一次 */
  function ticketQuote(s, isMember, done) {
    var db = S.get();
    var local = ticketLocal(s, isMember, db);
    if (done) done(local, false);
    if (!s || !s.id) return;
    apiPost('/ticket/quote', {
      salonId: s.id, title: s.title || '', price: s.price || 0, mprice: s.mprice || 0,
      isMember: !!isMember, ticketAdjust: s.ticketAdjust || null,
      boughtCount: local.bought, phone: (db.user || {}).phone || '', today: S.today()
    }, function (res) {
      if (!res || !res.ok || !done) return;
      res.fromServer = true;
      done(res, true);
    });
  }

  window.HUI = {
    pagebar: pagebar, tabbar: tabbar, ICONS: ICONS, qrSVG: qrSVG,
    vipFabHtml: vipFabHtml, loginChip: loginChip, coverStyle: coverStyle,
    esc: esc, money: money, toast: UI.toast, go: UI.go, copy: UI.copy
  };

  /* ================= 页面：沙龙 ================= */
  function pageSalon() {
    var db = S.get();
    var open = db.salons.filter(function (s) { return s.status === '报名中' && !s.deleted; });
    var banners = (db.banners || []).filter(function (b) { return b.on; });
    var slides = banners.length ? banners.map(function (b) {
      return { t1: b.title || '乐道AI', t2: b.sub || '', bg: 'boss', img: b.img || '', link: bnLink(b) };
    }) : [
      { t1: '老板引荐 · 对接资源', t2: '认识靠谱的上下游老板', bg: 'party', link: '#/boss' },
      { t1: '合作对接', t2: '联系我们·快速合作', bg: 'boss', link: '#/coop-apply' }
    ];
    var html = '' +
      '<div class="home-head"><div class="lh-left"><div class="logo-sq gold">沙</div>' +
      '<div><div class="lh-title">沙龙活动</div><div class="lh-sub">打破AI信息差，让创业更简单</div></div></div>' +
      '<span class="hh-right">' + (db.user.role === 'boss' || db.user.role === 'distributor' ? '<span class="badge-dist">分销员</span>' : '') + loginChip() + '</span></div>' +

      '<div class="carousel" id="carousel"><div class="track">' +
      slides.map(function (b) {
        var sty = b.img ? 'background:#22262e url(' + b.img + ') center/cover no-repeat;' : coverStyle(b.bg);
        return '<div class="slide" style="' + sty + '" onclick="UI.go(\'' + b.link + '\')">' +
          '<div class="st1">' + esc(b.t1) + '</div><div class="st2">' + esc(b.t2) + '</div></div>';
      }).join('') + '</div>' +
      '<div class="dots">' + slides.map(function (_, i) {
        return '<i class="' + (i === 0 ? 'on' : '') + '" onclick="event.stopPropagation();HUI.bnGo(' + i + ')"></i>';
      }).join('') + '</div></div>' +

      (open.length ? '<div class="salon-scroll">' + open.map(salonCard).join('') + '</div>' :
        '<div class="salon-scroll"><div class="empty-salon"><div class="ico">🗓️</div><p>暂无可报名活动 · 敬请期待<br>主理人正在筹备下一场沙龙</p></div></div>') +

      vipFabHtml() + tabbar('salon');

    phone.innerHTML = html;
    phone.classList.add('salon-fix');
    startCarousel(slides.length);

    /* 门票调整：后端 /api/ticket/quote 校准卡片价与信息条（本地结果已即时渲染；
       接口异常时保留本地值，不影响页面；元素已随切页销毁则静默跳过） */
    open.forEach(function (s) {
      ticketQuote(s, db.user.member, function (q2, fromServer) {
        if (!fromServer || !q2) return;
        var p = document.getElementById('tkp-' + s.id);
        if (!p) return;
        p.textContent = '门票 ' + (q2.finalPrice ? money(q2.finalPrice) : '免费');
        var t = tkFlagText(q2);
        var f = document.getElementById('tkflag-' + s.id);
        if (f && t) { f.textContent = t; return; }
        if (f && !t) { f.remove(); return; }
        if (!f && t) {
          var inner = p.closest('.boss-inner');
          if (inner) {
            var d = document.createElement('div');
            d.className = 'tk-flag'; d.id = 'tkflag-' + s.id; d.textContent = t;
            inner.insertBefore(d, inner.querySelector('.b-foot'));
          }
        }
      });
    });
  }

  function bnLink(b) {
    if (b.linkType === 'salon' && b.linkValue) return '#/salon-detail/' + b.linkValue;
    return ({ vip: '#/vip', bosses: '#/boss', mypay: '#/my-pay', distro: '#/distro' })[b.linkType] || '#/boss';
  }

  /* 门票调整信息条文本：由 quote 结果（本地或后端）生成，active 才显示 */
  function tkFlagText(q) {
    if (!q || !q.active) return '';
    var bits = [];
    if (q.hint) bits.push(String(q.hint));
    if (q.originPrice && q.originPrice !== q.finalPrice) bits.push('原价 ¥' + q.originPrice);
    if (q.limit) bits.push('限购 ' + q.limit + ' 张/人' + (q.remaining >= 0 && q.remaining < q.limit ? ' · 可再购 ' + q.remaining + ' 张' : ''));
    return bits.join(' · ');
  }

  function salonCard(s) {
    var seat = Math.max(0, (s.seats || 0) - (s.joined || 0));
    var hot = s.seats ? (s.joined / s.seats) >= 0.8 : false;
    var statusTxt = !s.seats ? '报名中' : (seat <= 0 ? '已满员' : (hot ? '仅剩 ' + seat + ' 人' : '报名中 · 限 ' + s.seats + ' 人'));
    /* 门票调整：卡片票价与展示同步（生效期内显示调整后价格 + 调整信息条） */
    var q = ticketLocal(s, (S.get().user || {}).member, S.get());
    var ft = tkFlagText(q);
    return '<div class="boss-list"><div class="boss-card" onclick="UI.go(\'#/salon-detail/' + s.id + '\')">' +
      '<div class="boss-cover" style="' + (s.videoCover ? 'background:#1c2129 url(' + s.videoCover + ') center/cover no-repeat;' : coverStyle(s.banner)) + ';height:150px">' +
      '<span style="position:absolute;left:14px;bottom:12px;color:#fff;font-weight:700">' + esc(s.title) + '</span>' +
      '<span class="s-status ' + (hot ? 'hot' : '') + '" style="position:absolute;right:12px;top:12px">' + statusTxt + '</span></div>' +
      '<div class="boss-inner"><div class="b-desc" style="margin:0">' + esc(s.desc) + '</div>' +
      (ft ? '<div class="tk-flag" id="tkflag-' + s.id + '">' + esc(ft) + '</div>' : '') +
      '<div class="b-foot"><span class="matched">🗓️ ' + s.date + ' ' + (s.time || '') + ' · ' + s.city + '</span>' +
      '<span class="price" id="tkp-' + s.id + '" style="color:var(--blue)">门票 ' + (q.finalPrice ? money(q.finalPrice) : '免费') + '</span></div></div></div></div>';
  }

  function startCarousel(n) {
    var car = document.getElementById('carousel');
    if (!car) return;
    var dots = car.querySelectorAll('.dots i');
    if (n <= 1) { if (dots.length) dots[0].parentNode.style.display = 'none'; return; }
    var track = car.querySelector('.track');
    /* 步长 = slide 实宽 + 右边距（88% + 8px），跳转/吸附按同一步长 → 精确对齐 */
    var s0 = track.querySelector('.slide');
    var step = s0 ? s0.getBoundingClientRect().width + (parseFloat(getComputedStyle(s0).marginRight) || 0) : track.clientWidth;
    var idx = 0, lastUser = 0, timer = null;

    function sync() {
      idx = Math.min(n - 1, Math.max(0, Math.round(track.scrollLeft / Math.max(1, step))));
      dots.forEach(function (d, i) { d.classList.toggle('on', i === idx); });
    }
    function go(i, smooth) {
      idx = ((i % n) + n) % n;
      var left = idx * step;
      if (track.scrollTo) { try { track.scrollTo({ left: left, behavior: smooth ? 'smooth' : 'auto' }); } catch (e) { track.scrollLeft = left; } }
      else track.scrollLeft = left;
      sync();
    }
    /* 导航点 → 平滑滚动到对应栏目（与栏目一一对应） */
    window.HUI = window.HUI || {};
    window.HUI.bnGo = function (i) { lastUser = Date.now(); go(i, true); };
    /* 手势滑动时同步导航点，并暂停自动跳转 */
    track.addEventListener('scroll', sync, { passive: true });
    ['touchstart', 'pointerdown', 'wheel'].forEach(function (ev) {
      track.addEventListener(ev, function () { lastUser = Date.now(); }, { passive: true });
    });
    /* 自动跳转：整屏平滑滚动到下一栏，精确对齐（scroll-snap 兜底） */
    timer = setInterval(function () {
      if (!document.body.contains(track)) return clearInterval(timer);
      if (Date.now() - lastUser < 4500) return;
      go(idx + 1, true);
    }, 4000);
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
      '<span class="hh-right">' + (db.user.role === 'boss' || db.user.role === 'distributor' ? '<span class="badge-dist">分销员</span>' : '') + loginChip() + '</span></div>' +

      '<div class="search-wrap"><div class="search-box">🔍' +
      '<input id="bossKw" placeholder="搜索老板 / 行业 / 关键词..." value="' + esc(kw) + '">' +
      (kw ? '<span onclick="window._bossKw=\'\';render()" style="color:#bbb">✕</span>' : '') + '</div></div>' +

      '<div class="boss-list">' + list.map(bossCard).join('') +
      (list.length ? '' : '<div class="empty-salon"><div class="ico">🤝</div><p>暂无老板资源 · 敬请期待<br>' + (kw ? '换个关键词试试，比如「AI」「跨境」' : '主理人正在探访更多老板') + '</p></div>') + '</div>' +
      '<div class="hint-line">引荐顾问 ' + S.get().config.refundHours + ' 小时内为你对接 · 超时未对接自动退款 · 信息由老板本人提供</div>' +
      vipFabHtml() + tabbar('boss');
    phone.innerHTML = html;
    var input = document.getElementById('bossKw');
    input.oninput = function () { window._bossKw = input.value; render(true); };
  }

  function bossCoverHtml(b) {
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
        (b.cover === 'codex' ? 'Codex · AI时代的超级助手' : b.cover === 'sea' ? '所有国内生意<br>都值得用海外社媒再做一遍' : '') +
        '</div><div class="play"></div></div>';
    }
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
    var left = '👋 ' + b.matched + ' 人已对接' + (b.salons ? ' · 已参加 ' + b.salons + ' 期沙龙' : ((b.eventIds || []).length ? ' · 已参加 ' + b.eventIds.length + ' 期沙龙' : ' · 平台认证老板'));
    var full = b.quotaLeft != null && b.quotaLeft <= 0;
    var price = full ? '⚠ 引荐名额已满'
      : (b.quotaLeft != null && b.quotaLeft <= 3 ? '引荐 ¥' + b.price + ' · 仅剩 ' + b.quotaLeft + ' 个名额' : '引荐 ¥' + b.price);
    return '<div class="boss-card">' +
      bossCoverHtml(b) +
      '<div class="boss-inner">' +
      '<div class="boss-top" onclick="UI.go(\'#/boss/' + b.id + '\')">' +
      avaHtml(b, 46) +
      '<div><div class="boss-name">' + esc(b.name) + '</div><div class="boss-title">' + esc(b.title) + '</div></div>' +
      '<span class="arrow">›</span></div>' +
      '<div><span class="tag">' + esc(b.tag) + '</span></div>' +
      '<div class="b-badges">' + b.badges.slice(0, 3).map(function (x) { return '<span class="b-badge">🏆 ' + esc(x) + '</span>'; }).join('') + '</div>' +
      '<div class="b-desc">' + esc(b.desc) + '</div>' +
      '<div class="b-foot"><span class="matched">' + left + '</span>' +
      '<span class="price" style="' + (full ? 'color:var(--warn)' : '') + '">' + price + '</span></div>' +
      '</div></div>';
  }

  /* ================= 页面：老板名片 ================= */
  function pageBossDetail(id) {
    var db = S.get();
    var b = db.bosses.filter(function (x) { return x.id === id; })[0];
    if (!b) { phone.innerHTML = pagebar('老板名片', '#/boss') + '<div class="empty-salon">老板不存在</div>'; return; }
    var mySg = db.signups.filter(function (s) { return s.kind === 'refer' && s.bossId === b.id; })[0];
    var full = b.quotaLeft != null && b.quotaLeft <= 0;
    var btn;
    if (full) btn = '<button class="btn-primary" style="background:#b0b5bb" onclick="UI.toast(\'该老板引荐名额已满，可关注后续开放\')">⚠ 引荐名额已满</button>';
    else if (!Auth.isLoggedIn()) btn = '<button class="btn-primary" onclick="UI.toast(\'请先登录\');UI.go(\'#/login\')">立即引荐 ¥' + b.price + '</button>';
    else if (mySg && mySg.referred) btn = '<button class="btn-primary" style="background:#0F6E56">✓ 已完成对接</button>';
    else if (mySg && mySg.dock !== 'pending') btn = '<button class="btn-primary" style="background:#a3741b">引荐中 · 等待顾问对接</button>';
    else btn = '<button class="btn-primary" onclick="UI.go(\'#/pay/refer/' + b.id + '\')">立即引荐 ¥' + b.price + '</button>';

    phone.innerHTML = pagebar('老板名片', '#/boss') +
      '<div class="boss-detail">' +
      bossCoverHtml(b) +
      '<div class="bd-card"><div style="display:flex;gap:12px;align-items:center;margin-bottom:14px">' +
      avaHtml(b, 60) +
      '<div><div class="boss-name" style="font-size:19px">' + esc(b.name) + '</div><div class="boss-title" style="margin-top:4px">' + esc(b.title) + '</div></div></div>' +
      '<span class="tag">' + esc(b.tag) + '</span>' +
      '<div class="b-badges" style="margin-bottom:12px">' + b.badges.map(function (x) { return '<span class="b-badge">🏆 ' + esc(x) + '</span>'; }).join('') + '</div>' +
      '<div class="bd-text">' + esc(b.detail) + '</div>' +
      '<div class="bd-note">信息由老板本人提供</div></div>' +

      '<div class="bd-card" style="display:flex;justify-content:space-between;align-items:center;background:#E1F5EE">' +
      '<span style="font-size:12.5px;color:#0F6E56;font-weight:700">🤝 已有 ' + b.matched + ' 人成功对接</span>' +
      '<span style="font-size:12px;font-weight:700;color:' + (full ? 'var(--warn)' : 'var(--green)') + '">' +
      (full ? '⚠ 引荐名额已满' : '⚡ 剩余 ' + b.quotaLeft + ' 个名额') + '</span></div>' +

      '<div class="bd-card"><h4>💬 客户真实反馈</h4><div class="hint" style="font-size:11px;color:var(--txt3);margin-bottom:10px">聊天记录截图 · 客户授权展示</div>' +
      '<div class="img-grid"><div class="ph fb"><span>成交反馈截图</span></div><div class="ph"><span>后台数据截图</span></div></div></div>' +

      '<div class="bd-card"><h4>📸 沙龙现场</h4><div class="img-grid">' +
      ((b.photos && b.photos.length)
        ? b.photos.map(function (src) { return '<div class="ph"><img src="' + src + '" style="width:100%;height:100%;object-fit:cover;border-radius:8px"></div>'; }).join('')
        : '<div class="ph"><span>沙龙分享现场</span></div><div class="ph"><span>现场对接交流</span></div>') +
      '</div></div>' +

      ((b.eventIds && b.eventIds.length) ? '<div class="bd-card"><h4>TA 参加过的沙龙</h4>' +
        b.eventIds.map(function (eid) {
          var ev = db.salons.filter(function (x) { return x.id === eid; })[0];
          if (!ev) return '';
          return '<div class="ds-kv" onclick="UI.go(\'#/salon-detail/' + ev.id + '\')"><span class="k">' + esc(ev.title) + '</span><span class="v">' + ev.date + '</span></div>';
        }).join('') + '</div>' : '') +

      '<div class="bd-card"><h4>如何引荐</h4><div class="how-steps">' +
      '① 点击下方按钮填写引荐信息并提交<br>' +
      '② 你的引荐顾问 <b>' + db.config.refundHours + ' 小时</b>内为你对接（付款后可在凭证页扫码联系顾问）<br>' +
      '③ 群内自加好友、约见面沟通</div>' +
      '<div class="how-warn">引荐费买的是顾问对接服务，不承诺老板回复与成交结果 · ' + db.config.refundHours + ' 小时未对接自动退款</div></div>' +

      '<div style="padding:2px 0 14px">' + btn + '</div>' +
      '<div class="bd-foot-hint">平台认证老板 · 后续成交另有合作协议保障</div>' +
      '</div>';
  }

  function bindChips(id) {
    var box = document.getElementById(id);
    if (!box) return;
    box.querySelectorAll('.chip').forEach(function (c) {
      c.onclick = function () {
        box.querySelectorAll('.chip').forEach(function (x) { x.classList.remove('on'); });
        c.classList.add('on');
      };
    });
  }
  function multiChips(id) {
    var box = document.getElementById(id);
    if (!box) return;
    box.querySelectorAll('.chip').forEach(function (c) { c.onclick = function () { c.classList.toggle('on'); }; });
  }

  /* ================= 页面：我的 ================= */
  function pageMe() {
    var db = S.get(), u = db.user;
    var isBoss = (u.role === 'boss' || u.superadmin);
    var items = [
      ['🙋', '获取微信头像昵称', u.wxNicknameBound ? '已绑定微信' : '', 'wxprofile', false],
      ['👑', '会员中心 / 续费', u.member ? '有效期至 ' + u.memberExpire : '未开通', '#/vip', !u.member],
      ['🎫', '我的沙龙凭证', '', '#/ticket', false],
      ['🤝', '我的引荐凭证', '', '#/refer-ticket', false],
      ['💰', '分销中心', isBoss ? '老板 · 亲自分销' : (u.distributeEnabled ? '已开通' : '可申请'), '#/distro', isBoss],
      ['🧾', '我的支付记录', '', '#/my-pay', false],
      /* HIDDEN-v132 入口隐藏、代码保留（恢复：取消下面两行注释）
      ['💳', '收款设置', '微信/支付宝收款码 · 金额 · 说明', 'paysetup', isBoss, isBoss],
      end HIDDEN-v132 */
      /* HIDDEN-v132 入口隐藏、代码保留（恢复：取消本行与下一行注释）
      ['🏢', '老板工作台', isBoss ? '管理后台入口' : '', '#/boss-dash', isBoss, isBoss],
      end HIDDEN-v132 */
      ['🎓', '会员专属顾问', u.advisorAdded ? '已添加' : '开通会员后可加', '#/advisor', u.member && !u.advisorAdded],
      ['💼', '商务合作', '有资源 / 有预算 · 找乐道谈', '#/coop-apply', false],
      ['🔔', '消息通知', '', '#/notifs', false],
      ['💬', '联系客服', '', 'service', false],
      ['⚙️', '设置', '', '#/settings', false],
      ['🔑', '登录 / 切换账号', '', '#/login', false]
    ];
    phone.innerHTML = pagebar('我的', '#/salon') +
      '<div class="me-wrap">' +
      '<div class="me-card">' +
      '<div class="me-ava" style="' + (u.avatar ? 'background-image:url(' + u.avatar + ')' : '') + '">' + (u.avatar ? '' : '👤') + '</div>' +
      '<div class="me-info"><div class="me-name">' + esc(u.nickname || '微信用户') + '</div>' +
      '<div class="me-sub">' + roleLabel() + '</div></div>' +
      '<button class="btn-edit" onclick="UI.go(\'#/myprofile\')">编辑</button></div>' +
      '<div class="menu-card">' + items.map(function (it) {
        if (it[5] === false && it[6] === false) return '';
        return '<div class="menu-item" onclick="User.menuClick(\'' + it[3] + '\')">' +
          '<div class="menu-ico">' + it[0] + '</div><span class="mi-t">' + it[1] + '</span>' +
          (it[2] ? '<span class="mi-s' + (it[4] ? ' gold' : '') + '">· ' + it[2] + '</span>' : '') +
          '<span class="arrow">›</span></div>';
      }).join('') + '</div></div>' + vipFabHtml() + tabbar('me');
  }

  function roleLabel() {
    var u = S.get().user;
    if (u.superadmin) return '超级管理员';
    if (u.role === 'boss') return '主理人';
    if (u.role === 'distributor') return '分销员';
    if (u.member) return '圈内会员';
    return '用户';
  }

  /* ================= 页面：会员落地页（原站黑金 10 屏） ================= */
  function pageVip() {
    var db = S.get(), c = db.config, u = db.user;
    var sec = (db.vipPage && db.vipPage.sections) || {};
    var on = function (k) { return sec[k] !== false; };
    var isMember = !!u.member;

    var bodyHtml = pagebar('年度老板会员', '#/me', '<span class="top-act" onclick="UI.toast(\'已生成会员海报（演示）\')">生成海报</span>') +
      '<div class="member-page"><div class="member-body">' +

      /* 第 1 屏 · 封面 */
      (isMember ? '<div class="vp-status">👑 您已是圈内会员 · 有效期至 ' + u.memberExpire +
        '<div class="vp-status-sub">沙龙免门票 · 免费引荐老板 · 每月 1 次一对一咨询 · 闭门茶会</div></div>' : '') +
      '<div class="mp-kicker">AI 出海 · 年度老板会员圈子</div>' +
      '<div class="mp-title">AI出海<br><span class="g">年度老板会员</span></div>' +
      '<div class="mp-price">¥<span class="n">' + c.memberPrice + '</span> <span class="u">/年</span></div>' +
      '<div class="mp-limit">全年权益一次解锁 · 名额有限</div>' +
      '<div class="mp-desc">专为出海、AI 创业、跨境老板打造的「线下资源对接圈子」。<br>买的不是课程，是<b>人脉 · 资源 · 曝光 · 行业信息 · 企业游学资格</b>。</div>' +
      '<button class="btn-gold" onclick="User.payVip()">' + (isMember ? '立即续费（再享一年）' : '立即开通年度会员') + '</button>' +
      (isMember ? '<div class="mp-limit">会员将于 ' + u.memberExpire + ' 到期 · 到期前续费，时长自动顺延。</div>' : '') +
      '<div class="mp-org">主办方：' + c.organizer + ' · ' + c.salonHeld + ' · ' + c.privatePool + '<br>开通后由主理人一对一对接，不是买完就没人管。</div>' +

      /* 第 2 屏 · 痛点 */
      '<div class="mp-sec"><div class="mp-num">01</div><div class="mp-h2">为什么你做出海、做 AI 创业很难做大？</div>' +
      ['圈子杂乱，接触不到真正靠谱的同频老板', '单次沙龙门票贵，长期学习对接成本极高', '手里有业务、没人看见，缺官方曝光渠道',
        '想对接供应链、对标企业，没有正规走访渠道', '行业变化太快，没有稳定的一线信息来源'].map(function (x) {
        return '<div class="mp-pain">' + x + '</div>';
      }).join('') + '</div>' +

      /* 第 3 屏 · 为什么值得加入 */
      '<div class="mp-sec"><div class="mp-num">02</div><div class="mp-h2">为什么值得加入我的会员圈？</div>' +
      '<div class="mp-p">深耕 AI 自媒体 + 出海赛道，持续落地线下沙龙、长期实地走访出海工厂、跨境公司、AI 标杆企业。所有资源均为线下实拍、真人对接、亲自筛选，不是网络杂牌资源。</div>' +
      '<div class="mp-grid2">' +
      [['01', '真实一手资源', '所有老板资源全部实地探访、当面筛选，真实靠谱可对接'],
       ['02', '高频线下场景', '常态化沙龙、会员闭门茶会、未来企业游学，以线下深度链接为主'],
       ['03', '垂直精准圈子', '只聚焦 AI、出海、跨境赛道，人群纯净、无杂流量'],
       ['04', '一对一行业咨询', '一线落地经验，可线下一对一拆解赛道、分享最新行业动态']
      ].map(function (x) { return '<div class="mp-cell"><div class="cnum">' + x[0] + '</div><div class="ct">' + x[1] + '</div><div class="cd">' + x[2] + '</div></div>'; }).join('') +
      '</div></div>' +

      /* 第 4 屏 · 圈子老板资源 */
      (on('s4') ? '<div class="mp-sec"><div class="mp-num">03</div><div class="mp-h2">圈子内可对接的优质老板资源</div>' +
        '<div class="mp-p">成为会员，即可匹配对接以下赛道的创业者、企业主（资源持续新增）。</div>' +
        db.bosses.filter(function (b) { return b.onShelf; }).slice(0, 8).map(function (b) {
          return '<div class="mp-res"><div class="nm">' + esc(b.name) + '</div><div class="tk">' + esc(b.title) + '</div><div class="ds">' + esc(b.tag) + '</div></div>';
        }).join('') +
        '<div class="mp-org">资源池会持续更新，资源引荐仅做信息牵线匹配；不保证一定达成合作。</div></div>' : '') +

      /* 第 5 屏 · 权益清单 */
      '<div class="mp-sec"><div class="mp-num">04</div><div class="mp-h2">年度会员｜全年完整权益清单</div>' +
      '<span class="mp-chip">已落地 · 即刻可用</span>' +
      [['权益 1', '全年沙龙免费畅进', '全年所有 AI / 出海主题沙龙，会员<b>全部免门票、不限次数参加</b>。'],
       ['权益 2', '优质老板精准引荐', '平台积累所有探访老板资源，根据你的业务需求，<b>精准匹配、双向引荐对接</b>。'],
       ['权益 3', '赠送 1 条个人业务曝光视频', '免费拍摄一条个人业务探访短视频，用于个人业务曝光、资源引流、圈子展示。1 年内随时可拍、可延后、可保留名额。'],
       ['权益 4', '每月 1 次线下一对一行业咨询', '每月可线下预约 1 次，单次 1 小时，仅信息咨询。当月名额有限，先约先得。'],
       ['权益 5', '会员专属闭门茶话交流会', '定期举办<b>仅会员可参与</b>的小型闭门茶会，同频老板深度交流、互换资源、对接合作。']
      ].map(function (x) { return '<div class="right-item"><div class="rt"><span class="tagx">' + x[0] + '</span>' + x[1] + '</div><div class="rd">' + x[2] + '</div></div>'; }).join('') +
      '<div style="margin-top:16px"><span class="mp-chip" style="background:#2a2415;color:#999">未来筹备 · 会员优先</span>' +
      '<div class="right-item"><div class="rt"><span class="tagx">权益 6</span>标杆企业 / 工厂闭门游学参访</div><div class="rd">后续持续落地：出海标杆工厂、跨境头部公司、AI 优质企业实地走访游学。会员<b>免费报名、优先参与</b>。（交通、食宿自理）</div></div></div>' +
      '</div>' +

      /* 第 6 屏 · 增值深度合作 */
      (on('s6') ? '<div class="mp-sec"><div class="mp-num">05</div><div class="mp-h2">额外增值｜会员专属深度共赢合作</div>' +
        '<div class="mp-p">若会员有：长期 IP 打造、持续流量获客、短视频长线运营需求，可单独洽谈深度流量合作。</div>' +
        '<div class="mp-p">采用后端分成共赢模式，不属于会员权益，自愿升级、单独合作。</div></div>' : '') +

      /* 第 7 屏 · 服务规则 */
      '<div class="mp-sec"><div class="mp-num">06</div><div class="mp-h2">会员服务规则｜透明公开</div><div class="mp-p">' +
      '1. 会员有效期：开通日起一整年有效，到期可续费。<br>' +
      '2. 所有咨询、茶会、活动均为预约制、名额有限、先约先得。<br>' +
      '3. 资源引荐为「牵线匹配」，不承诺成交、不保证收益。<br>' +
      '4. 曝光视频为基础模板成片，不含无限次修改、投流推广。<br>' +
      '5. 标杆企业游学为后续规划项目，暂未上线，不承诺固定频次。</div></div>' +

      /* 第 8 屏 · FAQ */
      (on('s8') ? '<div class="mp-sec"><div class="mp-num">07</div><div class="mp-h2">常见问题</div>' +
        [[c.memberPrice + ' 能享多久？', '有效期一整年，到期可续费。续费是续新的 1 年，不是永久会员。'],
         ['所有权益付款后马上能用吗？', '沙龙、资源引荐、咨询、茶会权益即刻生效；企业游学为后续落地权益。'],
         ['视频暂时不拍可以吗？', '可以，名额保留 1 年，随时启用。'],
         ['会员可以退款吗？', '7 天内未使用任何会员权益可申请退款；一旦使用任意一项权益，不支持退款。'],
         ['开通后怎么对接？', '支付成功后按页面指引添加主理人微信、填写会员信息登记表，之后所有预约与引荐都由主理人一对一对接。']
        ].map(function (x) { return '<div class="faq-item" onclick="this.classList.toggle(\'open\')"><div class="q">' + x[0] + '</div><div class="a">' + x[1] + '</div></div>'; }).join('') +
        '</div>' : '') +

      /* 第 9 屏 · 最终成交 */
      '<div class="mp-sec" style="text-align:center"><div class="mp-h2">加入 AI 出海高端老板私董圈</div>' +
      '<div class="mp-p">从「单打独斗」→「圈子资源共赢」</div>' +
      '<button class="btn-gold" onclick="User.payVip()">立即开通 年度 会员</button>' +
      '<div class="mp-org" style="text-align:center">点击开通即表示已阅读并同意上方《会员服务规则》</div></div>' +

      /* 第 10 屏 · 支付成功（已开通时显示） */
      (isMember ? '<div class="mp-sec"><div class="mp-h2" style="text-align:center">✓ 恭喜！会员开通成功</div>' +
        '<div class="mp-p" style="text-align:center">您已成功开通【AI 出海年度老板会员】请完成下面两步，解锁全部会员权益</div>' +
        '<div class="vp-step"><div class="st">第一步 · 添加主理人微信</div><div class="qbox">' + qrSVG('advisor-' + c.serviceWechat) + '</div>' +
        '<div class="rd">请扫码添加主理人微信，备注：会员+姓名。我会拉你进入会员专属社群，同步活动排期、预约通道。</div></div>' +
        '<div class="vp-step"><div class="st">第二步 · 填写会员信息登记表</div>' +
        '<div class="rd">信息用于帮你匹配老板资源、预约咨询和活动名额，信息仅内部会员服务使用，严格保密。</div>' +
        '<button class="btn-gold" style="margin-top:10px" onclick="UI.go(\'#/myprofile\')">填写会员信息登记表</button></div>' +
        '<div class="mp-org" style="text-align:left">✅ 提交表单 + 添加主理人微信，才算会员资格正式激活<br>✅ 所有沙龙预约、资源引荐、咨询预约，均通过主理人对接<br>✅ 会员权益从开通当日起，有效期 1 年</div></div>' : '') +

      '</div></div>';
    phone.innerHTML = bodyHtml;
  }

  /* ================= 页面：收银台（沙龙报名 / 老板引荐） ================= */
  function pagePayForm(kind, id) {
    var db = S.get();
    if (kind === 'salon') {
      var ev = db.salons.filter(function (x) { return x.id === id; })[0];
      if (!ev) { phone.innerHTML = pagebar('确认支付', '#/salon') + '<div class="empty-salon">活动不存在</div>'; return; }
      var isMember = db.user.member;
      var price = isMember ? (ev.mprice || 0) : (ev.price || 0);
      phone.innerHTML = pagebar('沙龙报名', '#/salon-detail/' + ev.id) +
        '<div class="form-page">' +
        '<div class="pay-box"><h4>🎫 沙龙报名</h4>' +
        row('活动', esc(ev.title)) + row('时间', ev.date + ' ' + (ev.time || '')) +
        row('地点', esc(ev.place)) +
        (db.user.role === 'distributor' || db.user.role === 'boss' ? row('🔒 渠道归属', esc(db.user.nickname) + ' · 佣金自动归属') : '') +
        row('身份', isMember ? '会员价' : '非会员价') +
        (!isMember && ev.mprice < ev.price ? row('开通会员可省', money(ev.price - ev.mprice)) : '') +
        '<div class="p-row"><span class="k">金额</span><span class="v big" id="payAmt">' + (price ? money(price) + '.00' : '免费') + '</span></div></div>' +
        '<div class="form-card"><h4>报名信息</h4>' +
        '<div class="f-label">姓名 <span class="req">*</span></div><input class="f-input" id="pfName" value="' + esc(db.user.nickname) + '">' +
        '<div class="f-label">手机号 <span class="req">*</span></div><input class="f-input" id="pfPhone" value="' + esc(db.user.phone || '') + '">' +
        '<div class="f-label">希望通过沙龙获得什么 <span class="opt">选填</span></div>' +
        '<textarea class="f-textarea" id="pfWant" placeholder="例：找东南亚物流渠道"></textarea></div>' +
        (price ? '<button class="btn-wechat" style="width:100%" id="payBtn" onclick="User.confirmSalonPay(\'' + ev.id + '\')">微信支付 · 立即报名 ' + money(price) + '</button>' +
          '<div style="text-align:center;font-size:11px;color:var(--txt3);margin-top:8px">微信支付安全收款 · 由微信支付提供技术支持</div>'
          : '<button class="btn-primary" id="payBtn" onclick="User.confirmSalonPay(\'' + ev.id + '\',0)">免费领取报名凭证</button>' +
          '<div style="text-align:center;font-size:11px;color:var(--txt3);margin-top:8px">免费票提交后立即出票</div>') +
        '</div>';
      /* 门票调整：以后端返回的应付价回填既有金额/按钮（同元素、同位置、同样式） */
      ticketQuote(ev, isMember, function (q) {
        var amt = document.getElementById('payAmt');
        if (amt) amt.textContent = q.finalPrice ? money(q.finalPrice) + '.00' : '免费';
        var bt = document.getElementById('payBtn');
        if (bt) {
          bt.setAttribute('data-price', q.finalPrice);
          bt.textContent = q.finalPrice ? '微信支付 · 立即报名 ' + money(q.finalPrice) : '免费领取报名凭证';
        }
      });
      return;
    }
    /* 老板引荐 */
    var b = db.bosses.filter(function (x) { return x.id === id; })[0];
    if (!b) { phone.innerHTML = pagebar('确认支付', '#/boss') + '<div class="empty-salon">老板不存在</div>'; return; }
    var isMem = db.user.member;
    var amount = isMem ? 0 : (b.price || 0);
    phone.innerHTML = pagebar('老板引荐', '#/boss/' + b.id) +
      '<div class="form-page">' +
      '<div class="pay-box"><h4>🤝 老板引荐</h4>' +
      row('服务', '引荐顾问一对一对接') + row('老板', esc(b.name) + ' · ' + esc(b.title)) +
      row('时效', S.get().config.refundHours + ' 小时内完成对接 · 超时自动退款') +
      (db.user.role === 'distributor' || db.user.role === 'boss' ? row('🔒 渠道归属', esc(db.user.nickname)) : '') +
      '<div class="p-row"><span class="k">金额</span><span class="v big">' + (amount ? money(amount) + '.00' : '会员免费') + '</span></div>' +
      '<div class="p-sub">引荐费仅含顾问对接服务，不承诺老板回复与成交结果</div></div>' +
      '<div class="form-card"><h4>引荐信息</h4>' +
      '<div class="f-label">姓名 <span class="req">*</span></div><input class="f-input" id="rfName" value="' + esc(db.user.nickname) + '">' +
      '<div class="f-label">微信号 <span class="opt">选填，方便顾问加你</span></div><input class="f-input" id="rfWx" value="' + esc((db.user.profile || {}).wechat || '') + '">' +
      '<div class="f-label">你的引荐诉求 <span class="req">*</span></div>' +
      '<textarea class="f-textarea" id="rfNeed" placeholder="例：想对接他的海外仓资源"></textarea>' +
      '<div class="hint">引荐顾问将根据您的诉求为您对接，请如实填写</div></div>' +
      (amount ? '<button class="btn-wechat" style="width:100%" onclick="User.confirmReferPay(\'' + b.id + '\',' + amount + ')">微信支付 · 立即引荐 ' + money(amount) + '</button>'
        : '<button class="btn-primary" onclick="User.confirmReferPay(\'' + b.id + '\',0)">会员免费 · 提交引荐</button>' +
        '<div style="text-align:center;font-size:11px;color:var(--txt3);margin-top:8px">会员免费引荐 · 提交后引荐顾问 ' + S.get().config.refundHours + ' 小时内为你对接</div>') +
      '</div>';
  }
  function row(k, v) { return '<div class="p-row"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>'; }

  /* ================= 页面：沙龙报名凭证 ================= */
  function pageTicket(id) {
    var db = S.get();
    var all = db.signups.filter(function (s) { return s.kind === 'salon'; });
    if (!id) {
      if (!all.length) { phone.innerHTML = pagebar('沙龙报名凭证', '#/me') + '<div class="empty-salon"><div class="ico">🎫</div><p>暂无报名凭证</p></div>'; return; }
      var g = function (f) { return all.filter(f); };
      var groups = [['✅ 已支付', g(function (s) { return s.paid && !s.refunded; })],
        ['💰 待支付', g(function (s) { return !s.paid && !s.refunded; })],
        ['↩️ 已退款', g(function (s) { return s.refunded; })]];
      phone.innerHTML = pagebar('沙龙报名凭证', '#/me') +
        groups.filter(function (x) { return x[1].length; }).map(function (x) {
          return '<div class="d-block"><div class="wt">' + x[0] + '（' + x[1].length + '）</div>' +
            x[1].map(function (s) {
              var ev = db.salons.filter(function (e) { return e.id === s.evId; })[0] || {};
              var st = s.refunded ? '已退款 · 凭证已失效' : s.paid ? '已支付' : '待支付';
              return '<div class="wb-card" onclick="UI.go(\'#/ticket/' + s.id + '\')">' +
                '<div class="wc-top">' + esc(s.title) + '</div>' +
                '<div class="wc-sub">' + (ev.date || s.createdAt) + ' · ' + esc(ev.place || '') + ' · ' + st + '</div>' +
                '<div class="wc-sub">凭证编号 ' + esc(s.code) + '</div></div>';
            }).join('') + '</div>';
        }).join('');
      return;
    }
    var s = all.filter(function (x) { return x.id === id; })[0];
    if (!s) { phone.innerHTML = pagebar('报名凭证', '#/ticket') + '<div class="empty-salon">凭证不存在</div>'; return; }
    var ev = db.salons.filter(function (e) { return e.id === s.evId; })[0] || {};
    var stTxt = s.refunded ? '已退款 · 凭证已失效' : s.paid ? '请向工作人员出示报名凭证' : '待支付';
    var dist = db.distTeam.filter(function (d) { return d.phone === s.dist; })[0];
    phone.innerHTML = pagebar('沙龙报名凭证', '#/ticket') +
      '<div class="boss-detail"><div class="ticket">' +
      '<div class="tk-head"><div class="a">' + esc(s.title) + '</div><div class="b">乐道AI · 沙龙报名凭证</div><div class="tk-ico">🎫</div></div>' +
      '<div class="tk-body"><div class="tk-title">' + stTxt + '</div>' +
      '<div class="tk-row">📌 主题：' + esc(s.title) + '</div>' +
      '<div class="tk-row">📅 日期：' + (ev.date || '—') + ' ' + (ev.time || '') + '</div>' +
      '<div class="tk-row">📍 地点：' + esc(ev.place || '—') + '</div>' +
      '<div class="tk-row">🎫 门票：' + (s.amount ? money(s.amount) : '免费') + '（' + (s.type === 'vip' ? '会员价' : '标准') + '）</div>' +
      '<div class="tk-code">凭证编号：' + esc(s.code) + '</div>' +
      (s.refunded ? '<div class="tk-warn">⚠️ 该报名已退款，凭证已失效</div>' : '') +
      (s.refunded ? '' :
        '<div class="pay-box"><h4>📝 报名信息</h4>' +
        Object.keys(s.formData || {}).filter(function (k) { return String(s.formData[k] || '').trim(); }).map(function (k) {
          return '<div class="p-row"><span class="k">' + esc(k) + '</span><span class="v">' + esc(s.formData[k]) + '</span></div>';
        }).join('') +
        '<div class="p-row"><span class="k">报名时间</span><span class="v">' + esc(s.createdAt) + '</span></div></div>') +
      (!s.paid && !s.refunded ? '<button class="btn-primary" onclick="UI.go(\'#/pay/salon/' + s.evId + '\')">去支付' + (s.amount ? ' · ' + money(s.amount) : '') + '</button>' : '') +
      '<div class="ticket-group"><div class="ghead">添加销售客服，拉你进群</div>' +
      (dist && dist.wxQrStatus === 'approved'
        ? '<div class="qbox">' + qrSVG('wxqr-' + dist.phone) + '</div><div class="gsub">长按识别二维码添加销售客服，并提供报名凭证截图，拉你进群</div>'
        : '<div class="gsub">报名成功后请等待销售客服联系你进群</div>') + '</div>' +
      '</div></div></div>' +
      '<div class="bd-foot-hint">到场出示报名凭证入场 · 会员享专属价与优先锁座</div>';
  }

  /* ================= 页面：我的引荐凭证 ================= */
  function pageReferTicket(id) {
    var db = S.get();
    var all = db.signups.filter(function (s) { return s.kind === 'refer'; });
    if (!all.length) { phone.innerHTML = pagebar('我的引荐凭证', '#/me') + '<div class="empty-salon"><div class="ico">🤝</div><p>还没有引荐凭证 · 去老板资源页引荐</p></div>'; return; }
    if (!id) {
      var groups = [
        ['💰 待支付', all.filter(function (s) { return !s.paid; })],
        ['⏳ 对接中', all.filter(function (s) { return s.paid && !s.referred && !s.refunded; })],
        ['✅ 已完成', all.filter(function (s) { return s.referred && !s.refunded; })],
        ['↩️ 已退款', all.filter(function (s) { return s.refunded; })]
      ];
      phone.innerHTML = pagebar('我的引荐凭证', '#/me') +
        '<div class="wb-body">' + groups.filter(function (x) { return x[1].length; }).map(function (x) {
          return '<div class="d-block"><div class="wt">' + x[0] + '（' + x[1].length + '）</div>' +
            x[1].map(function (s) {
              var st = s.refunded ? '已退款' : s.referred ? '已完成对接' : s.dock === 'submitted' ? '对接确认中' : s.paid ? '等待对接' : '待支付';
              return '<div class="wb-card" onclick="UI.go(\'#/refer-ticket/' + s.id + '\')">' +
                '<div class="wc-top">🤝 ' + esc(s.bossName || '') + ' <span class="wb-tag" style="background:#eef1ff;color:#3a4a9f">' + st + '</span></div>' +
                '<div class="wc-sub">' + (s.amount ? '引荐费 ' + money(s.amount) : '免费引荐') + ' · ' + esc(s.createdAt || '') + '</div></div>';
            }).join('') + '</div>';
        }).join('') + '</div>';
      return;
    }
    var s = all.filter(function (x) { return x.id === id; })[0];
    if (!s) { phone.innerHTML = pagebar('引荐凭证', '#/refer-ticket') + '<div class="empty-salon">凭证不存在</div>'; return; }
    var b = db.bosses.filter(function (x) { return x.id === s.bossId; })[0] || { name: s.bossName, title: '' };
    var stLine = s.refunded ? '已退款' : s.referred ? '已完成对接' : s.dock === 'submitted' ? '顾问已对接 · 待确认' : '等待引荐顾问对接';
    phone.innerHTML = pagebar('老板引荐凭证', '#/refer-ticket') +
      '<div class="wb-body">' +
      '<div class="refer-hero"><div class="rh1">🤝 老板引荐凭证</div>' +
      '<div class="rh2">' + (s.amount ? '引荐费 ' + money(s.amount) : '免费引荐') + ' · ' + stLine + '</div></div>' +
      '<div class="d-block"><div class="wt">引荐对象</div>' +
      '<div class="wb-card" onclick="UI.go(\'#/boss/' + (s.bossId || '') + '\')"><div class="wc-top">' + esc(b.name) + '</div><div class="wc-sub">' + esc(b.title || '') + '</div></div></div>' +
      '<div class="d-block"><div class="wt">对接进度</div>' +
      ['提交引荐信息', '支付成功', '引荐顾问已对接', '公司确认 · 对接完成'].map(function (t, i) {
        var done = i <= (s.referred ? 3 : s.dock === 'submitted' ? 2 : s.paid ? 1 : 0);
        return '<div class="ds-kv"><span class="k">' + (done ? '✓ ' : '○ ') + t + '</span><span class="v">' + (done ? '已完成' : '待完成') + '</span></div>';
      }).join('') + '</div>' +
      '<div class="d-block"><div class="wt">📝 我填写的引荐信息</div>' +
      Object.keys(s.formData || {}).map(function (k) {
        return '<div class="ds-kv"><span class="k">' + esc(k) + '</span><span class="v">' + esc(s.formData[k]) + '</span></div>';
      }).join('') + '</div>' +
      (s.refunded ? '<div class="wb-note">⚠️ 该引荐已退款，凭证已失效</div>' : '') +
      '<div class="member-tip">💡 服务保障：引荐顾问将在 ' + db.config.refundHours + ' 小时内为你完成对接；超时未对接，款项将自动原路退回，无需任何操作。</div>' +
      '</div>';
  }

  /* ================= 页面：我的支付记录 ================= */
  function pageMyPay(tab) {
    var db = S.get();
    var t = tab || 'all';
    var all = db.signups.filter(function (s) { return s.paid || s.refunded; })
      .slice().sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
    var list = t === 'paid' ? all.filter(function (s) { return s.paid && !s.refunded; })
      : t === 'refunded' ? all.filter(function (s) { return s.refunded; }) : all;
    var paidSum = all.filter(function (s) { return s.paid && !s.refunded; }).reduce(function (a, b) { return a + (+b.amount || 0); }, 0);
    var refSum = all.filter(function (s) { return s.refunded; }).reduce(function (a, b) { return a + (+b.amount || 0); }, 0);
    phone.innerHTML = pagebar('我的支付记录', '#/me') +
      '<div class="wb-body">' +
      '<div class="wb-2x2" style="padding:12px 14px 0">' +
      '<div class="wb-stat green"><div class="n">' + money(paidSum) + '</div><div class="l">💰 已支付</div></div>' +
      '<div class="wb-stat red"><div class="n">' + money(refSum) + '</div><div class="l">↩️ 已退款</div></div></div>' +
      '<div class="chip-row">' + [['all', '全部 ' + all.length], ['paid', '已支付'], ['refunded', '已退款']].map(function (c) {
        return '<span class="chip ' + (t === c[0] ? 'on' : '') + '" onclick="UI.go(\'#/my-pay/' + c[0] + '\')">' + c[1] + '</span>';
      }).join('') + '</div>' +
      '<div class="d-block"><div class="wt">支付记录（' + list.length + '）</div>' +
      (list.length ? list.map(function (s) {
        var ic = s.kind === 'member' ? '👑' : s.kind === 'refer' ? '🤝' : '🧾';
        var st = s.refunded ? '已退款' : '已支付';
        return '<div class="wb-rev"><div class="ri">' + ic + '</div>' +
          '<div class="rt"><div class="rs">' + esc(s.title) + '</div>' +
          '<div class="elapsed">' + esc(s.createdAt) + ' · ' + st + ' · ' + esc(s.payMethod || '微信支付') + (s.kind === 'refer' ? ' · ' + (s.referred ? '已对接' : '等待对接') : '') + '</div></div>' +
          '<div class="ra">' + (s.amount ? money(s.amount) : '免费') + '</div></div>';
      }).join('') : '<div class="wb-empty"><div class="e-big">🧾</div><div>暂无记录</div></div>') + '</div></div>';
  }

  /* ================= 页面：我的资料 / 入驻档案 ================= */
  function pageMyProfile() {
    var db = S.get(), u = db.user, p = u.profile || {};
    var missing = [];
    if (!p.realName) missing.push('姓名');
    if (!p.company || !p.industry) missing.push('公司+行业');
    if (!p.wechat) missing.push('微信号');
    phone.innerHTML = pagebar('我的资料', '#/me', '<span class="top-act" onclick="User.saveMyProfile()">保存</span>') +
      '<div class="form-page">' +
      (missing.length ? '<div class="coop-hero" style="background:#FDF3E2;color:#a3741b">还差 <b>' + missing.join('、') + '</b> 没填 —— 补齐后平台才能帮你对接资源。</div>' : '') +
      '<div class="form-card"><div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">' +
      '<div class="cava" style="width:52px;height:52px;' + (u.avatar ? 'background-image:url(' + u.avatar + ');background-size:cover' : '') + '">' + (u.avatar ? '' : '👤') + '</div>' +
      '<div style="flex:1"><div style="font-size:14px;font-weight:700">' + esc(u.nickname) + '</div>' +
      '<div style="font-size:10.5px;color:var(--txt3);margin-top:3px">微信头像与昵称自动带出</div></div></div>' +
      '<div class="f-label">昵称 <span class="req">*</span></div><input class="f-input" id="mpfNick" maxlength="20" placeholder="发帖时显示的名字" value="' + esc(u.nickname) + '">' +
      '<div class="f-label">头衔</div><input class="f-input" id="mpfTitle" maxlength="30" placeholder="例：跨境电商 · 深圳" value="' + esc(u.title) + '">' +
      '<div class="f-label">一句话介绍</div><input class="f-input" id="mpfSub" maxlength="60" placeholder="例：做亚马逊精品，正在找包清关渠道" value="' + esc(u.sub) + '">' +
      '</div>' +
      '<div class="form-card"><h4>入驻档案 <span class="opt">仅平台内部可见，不对外公开</span></h4>' +
      '<div class="f-label">姓名 / 称呼 <span class="req">*</span></div><input class="f-input" id="mpfName" placeholder="例：王建国" value="' + esc(p.realName) + '">' +
      '<div class="f-label">手机号</div><input class="f-input" value="' + esc(u.phone || '') + '" disabled><div class="hint">账号手机号，不可修改</div>' +
      '<div class="f-label">公司 <span class="req">*</span></div><input class="f-input" id="mpfCompany" placeholder="例：深圳市某某科技有限公司" value="' + esc(p.company) + '">' +
      '<div class="f-label">行业 <span class="req">*</span></div><input class="f-input" id="mpfIndustry" placeholder="例：跨境电商" value="' + esc(p.industry) + '">' +
      '<div class="f-label">主营</div><input class="f-input" id="mpfBiz" placeholder="例：亚马逊精品卖家，年销 2000 万" value="' + esc(p.mainBiz) + '">' +
      '<div class="f-label">想对接什么资源</div><input class="f-input" id="mpfWant" placeholder="例：东南亚物流渠道、TikTok 运营操盘手" value="' + esc(p.wantRes) + '">' +
      '<div class="f-label">现有资源</div><input class="f-input" id="mpfHas" placeholder="例：深圳仓 2000 平、清关资质、2 个抖音号" value="' + esc(p.hasRes) + '">' +
      '<div class="f-label">微信号 <span class="req">*</span></div><input class="f-input" id="mpfWechat" placeholder="平台客服加你用的" value="' + esc(p.wechat) + '">' +
      '<div class="hint">不对外公开，只用于平台对接</div></div>' +
      '<button class="btn-save" onclick="User.saveMyProfile()">保存</button></div>';
  }

  /* ================= 页面：设置 ================= */
  function pageSettings() {
    var db = S.get(), u = db.user;
    phone.innerHTML = pagebar('设置', '#/me') +
      '<div class="form-page">' +
      '<div class="form-card"><h4>👤 账号信息</h4>' +
      '<div class="ds-kv"><span class="k">手机号</span><span class="v">' + (u.phone ? S.maskPhone(u.phone) : '—') + '</span></div>' +
      '<div class="ds-kv"><span class="k">身份角色</span><span class="v">' + roleLabel() + '</span></div>' +
      '<div class="ds-kv"><span class="k">微信绑定</span><span class="v">' + (u.wxNicknameBound ? '已绑定' : '未绑定（可在微信内授权）') + '</span></div>' +
      (!u.wxNicknameBound ? '<div class="menu-item" onclick="User.fetchWxProfile()"><div class="menu-ico">🧩</div><span class="mi-t">获取微信头像昵称</span><span class="arrow">›</span></div>' : '') +
      '</div>' +
      '<div class="form-card"><h4>✏️ 个人资料</h4>' +
      '<div class="f-label">昵称（对外显示）</div><input class="f-input" id="setNick" maxlength="20" value="' + esc(u.nickname) + '">' +
      '<div class="f-label">头衔</div><input class="f-input" id="setTitle" maxlength="30" placeholder="如：乐道科技 · 主理人" value="' + esc(u.title) + '">' +
      '<div class="f-label">个人简介</div><textarea class="f-textarea" id="setSub" maxlength="60">' + esc(u.sub) + '</textarea>' +
      '<button class="btn-ghost" style="margin-top:10px" onclick="User.saveSettings()">保存资料</button></div>' +
      '<div class="form-card"><h4>🔒 安全</h4><div class="hint">已绑定微信自动登录，无需退出</div></div>' +
      '<button class="btn-plain" style="color:var(--red);border-color:#f5d5d5" onclick="User.logout()">退出登录</button>' +
      '<div style="text-align:center;color:var(--txt3);font-size:11px;margin-top:16px">乐道AI · 付费圈子系统 v2.0</div></div>';
  }

  /* ================= 页面：会员专属顾问 ================= */
  function pageAdvisor() {
    var db = S.get(), c = db.config, u = db.user;
    if (!u.member) {
      phone.innerHTML = pagebar('添加专属顾问', '#/me') + '<div class="empty-salon"><div class="ico">👑</div><p>开通会员后添加会员专属顾问</p>' +
        '<div style="margin-top:14px"><button class="btn-primary" onclick="UI.go(\'#/vip\')">开通年度老板会员</button></div></div>';
      return;
    }
    var qr = 'advisor-' + c.serviceWechat;
    var done = !!u.advisorAdded;
    phone.innerHTML = pagebar('添加专属顾问', '#/me') +
      '<div class="advisor-head"><div class="ah1">你的专属顾问</div>' +
      '<div class="ah2">活动邀约 · 引荐对接 · 资源链接<br>一对一服务，加不上顾问圈子发帖不开放</div></div>' +
      (done
        ? '<div class="d-block" style="text-align:center"><div class="adv-ok">✓</div>' +
          '<div style="font-size:14.5px;font-weight:700;margin:10px 0 6px">你已添加 ' + esc(c.serviceWechat) + '</div>' +
          '<div class="wb-note">后续活动邀约、引荐对接、资源链接都由顾问一对一服务</div>' +
          '<div class="qbox" style="margin:12px auto 0;width:130px">' + qrSVG(qr) + '</div>' +
          '<div class="wb-note">换设备或误删可再次长按识别添加</div>' +
          '<button class="btn-primary" style="margin-top:14px" onclick="UI.go(\'#/circle\')">进入圈子</button></div>'
        : '<div class="d-block" style="text-align:center">' +
          '<div style="font-size:14.5px;font-weight:700;margin-bottom:5px">' + esc(c.serviceWechat) + '</div>' +
          '<div class="wb-note">长按识别下方二维码，添加顾问企业微信</div>' +
          '<div class="qbox" style="margin:0 auto;width:200px">' + qrSVG(qr) + '</div>' +
          '<div class="wb-note">加完后点下面的按钮，发帖功能即可开放</div>' +
          '<button class="btn-primary" style="margin-top:14px" onclick="User.addAdvisor()">我已添加顾问</button></div>' +
          '<div class="d-block"><div class="wb-note">为什么要加顾问：你的引荐对接、活动邀约、资源链接都由顾问一对一跟，不加就没人接你的需求。</div></div>');
  }

  /* ================= 页面：消息通知中心 ================= */
  function pageNotifs() {
    var db = S.get();
    var u = db.user;
    var bucket = (u.role === 'boss' || u.superadmin) ? 'boss' : u.role === 'distributor' ? 'dist' : 'user';
    var name = { boss: '老板 / 管理线', dist: '分销员线', user: '用户线' }[bucket];
    var all = (db.notifs || []).filter(function (n) { return n.bucket === bucket; });
    var last = +(localStorage.getItem('TQ_NOTIF_READ') || 0);
    var body = '<div class="bd-hero"><div class="h1">🔔 消息通知</div>' +
      '<div class="wb-note" style="color:rgba(255,255,255,.85)">当前视角：' + name + ' · 报名 / 支付实时提示</div></div>' +
      '<div class="wb-note" style="padding:10px 14px 0">提示在您操作后即时生成 · 跨设备登录也能看到本机的通知记录</div>' +
      '<div class="d-block">' + (all.length ? all.map(function (n) {
        var unread = n.ts > last;
        return '<div class="wb-card"' + (unread ? ' style="border-left:3px solid var(--red)"' : '') + '>' +
          '<div class="wc-top">' + n.ic + ' ' + esc(n.t) + (unread ? ' <span class="wb-tag" style="background:#FCEBEB;color:var(--red)">● NEW</span>' : '') + '</div>' +
          '<div class="wc-sub">' + esc(n.s) + '</div>' +
          '<div class="wc-sub">' + esc(n.time || '') + ' · ' + name + '</div></div>';
      }).join('') : '<div class="wb-empty"><div class="e-big">🔔</div><div>暂无通知 · 报名 / 开通会员后相关链路会实时收到提示</div></div>') + '</div>';
    phone.innerHTML = pagebar('消息通知', '#/me') + '<div class="wb-body">' + body + '</div>';
    localStorage.setItem('TQ_NOTIF_READ', String(Date.now()));
  }

  /* ================= 页面：商务合作申请 ================= */
  function pageCoopApply() {
    var db = S.get(), u = db.user;
    phone.innerHTML = pagebar('商务合作', '#/me') +
      '<div class="form-page">' +
      '<div class="coop-hero"><b>想跟乐道合作？</b><br>填完提交，主理人会直接看到我们通常 24 小时内联系你</div>' +
      '<div class="form-card"><div class="f-label">你的称呼 / 公司名 <span class="req">*</span></div>' +
      '<input class="f-input" id="coName" placeholder="如：张三 · 深圳某某科技" value="' + esc(u.nickname) + '"></div>' +
      '<div class="form-card"><div class="f-label">你是做什么的 <span class="req">*</span></div>' +
      '<textarea class="f-textarea" id="coBiz" placeholder="一行业务 + 一行客户，比如：做企业财税代账，客户是深圳中小制造业老板"></textarea>' +
      '<div class="f-label">目前拿到的结果 <span class="opt">选填</span></div>' +
      '<textarea class="f-textarea" id="coResult" placeholder="有数字最好，比如：小红书 8 万粉 / 月流水 30 万 / 服务过 200 家企业"></textarea></div>' +
      '<div class="form-card"><div class="f-label">想怎么合作 <span class="req">*</span><div class="hint">先勾类型，再写具体想法（可多选）</div></div>' +
      '<div class="chips" id="coopChips">' +
      ['供货', '渠道分销', '内容联名', '流量互推', '资源置换', '其他'].map(function (c) { return '<span class="chip" data-v="' + c + '">' + c + '</span>'; }).join('') + '</div>' +
      '<div class="f-label" style="margin-top:16px">具体怎么合作</div>' +
      '<textarea class="f-textarea" id="coDetail" placeholder="具体怎么合作，比如：我有供应链，想给乐道的老板供货分成"></textarea></div>' +
      '<div class="form-card"><div class="f-label">有没有预算 <span class="opt">选填</span></div>' +
      '<div class="chips" id="budgetChips">' +
      ['暂无预算', '1 万以内', '1-5 万', '5-10 万', '10 万以上'].map(function (c) { return '<span class="chip" data-v="' + c + '">' + c + '</span>'; }).join('') + '</div>' +
      '<div class="hint">纯粹帮我们对齐预期，不是收费项。没预算也能谈资源置换。</div></div>' +
      '<div class="form-card"><div class="f-label">怎么联系你 <span class="req">*</span></div>' +
      '<input class="f-input" id="coPhone" placeholder="11 位手机号" value="' + esc(/^1\d{10}$/.test(u.phone || '') ? u.phone : '') + '">' +
      '<input class="f-input" id="coWechat" style="margin-top:10px" placeholder="微信号（选填，填了更好加你）"></div>' +
      '<button class="btn-save" onclick="User.submitCoop()">提交合作申请</button>' +
      '<div style="text-align:center;font-size:11px;color:var(--txt3);margin-top:12px">提交后页面会直接给出主理人的微信二维码<br>同一手机号 24 小时内只能提交一次</div></div>';
    multiChips('coopChips');
    bindChips('budgetChips');
  }

  function pageCoopOk() {
    var c = S.get().config;
    phone.innerHTML = pagebar('已提交', '#/me') +
      '<div class="wb-body">' +
      '<div class="coop-okhead"><div class="ok">✓</div><div class="t1">已收到你的合作申请</div>' +
      '<div class="t2">我们会尽快看完并联系你通常 24 小时内回复</div></div>' +
      '<div class="d-block" style="text-align:center">' +
      '<div style="font-size:14px;font-weight:700">' + esc(c.coopName) + '</div>' +
      '<div class="wb-note">着急的话，直接扫码加微信聊备注「合作」通过更快</div>' +
      '<div class="qbox" style="margin:0 auto;width:180px">' + qrSVG('coop-' + c.coopWechat) + '</div>' +
      '<button class="btn-ghost" style="margin-top:12px" onclick="UI.copy(\'' + c.coopWechat + '\')">📋 复制微信号：' + esc(c.coopWechat) + '</button></div>' +
      '<div class="wb-note">想补充信息或改内容？直接加微信说，不用重新提交（同一手机号 24 小时内只能提交一次）。</div>' +
      '<button class="btn-plain" onclick="UI.go(\'#/me\')">返回</button></div>';
  }

  /* ================= 页面：核销台（自研；原站已下线该模块） ================= */
  function pageVerify() {
    var db = S.get();
    var u = db.user;
    if (!(u.role === 'boss' || u.superadmin || u.role === 'distributor')) {
      UI.toast('仅工作人员可访问'); UI.go('#/me'); return;
    }
    var today = db.signups.filter(function (s) { return s.kind === 'salon' && s.paid && !s.refunded; });
    phone.innerHTML = pagebar('核销台', '#/boss-dash') +
      '<div class="wb-body">' +
      '<div class="bd-hero"><div class="h1">✅ 核销台</div>' +
      '<div class="wb-note" style="color:rgba(255,255,255,.85)">输入凭证编号或选择报名记录完成核销 · 重复核销会拦截</div></div>' +
      '<div class="d-block"><div class="wt">扫码 / 输码核销</div>' +
      '<input id="vfCode" class="wb-inp" placeholder="输入凭证编号，如 TQ-S-2001">' +
      '<button class="wb-btn primary" style="margin-top:8px" onclick="User.verifyCode()">立即核销</button></div>' +
      '<div class="d-block"><div class="wt">待核销报名（' + today.length + '）</div>' +
      (today.length ? today.map(function (s) {
        return '<div class="wb-card"><div class="wc-top">' + esc(s.name) + ' · ' + esc(s.title) + '</div>' +
          '<div class="wc-sub">凭证 ' + esc(s.code) + ' · ' + money(s.amount) + '</div>' +
          '<div class="wb-btns"><button class="wb-btn ' + (s.used ? 'ghost' : 'primary') + '" onclick="User.verifySignup(\'' + s.id + '\')">' + (s.used ? '已核销' : '核销') + '</button></div></div>';
      }).join('') : '<div class="wb-empty"><div class="e-big">✅</div><div>暂无待核销报名</div></div>') + '</div>' +
      '<div class="member-tip">核销后不可撤销 · 重复核销会被拦截</div></div>';
  }

  /* ================= 页面：沙龙详情 ================= */
  function pageSalonDetail(id) {
    var db = S.get();
    var s = db.salons.filter(function (x) { return x.id === id; })[0];
    if (!s) { phone.innerHTML = pagebar('活动详情', '#/salon') + '<div class="empty-salon">活动不存在</div>'; return; }
    var seat = Math.max(0, (s.seats || 0) - (s.joined || 0));
    var hot = s.seats ? (s.joined / s.seats) >= 0.8 : false;
    var isMember = db.user.member;
    var myTickets = db.signups.filter(function (x) { return x.kind === 'salon' && x.evId === s.id && x.paid && !x.refunded; });
    var closed = s.status !== '报名中' || (s.seats && seat <= 0);
    var btn;
    if (myTickets.length) btn = '<button class="btn-primary" onclick="UI.go(\'#/ticket\')">查看沙龙报名凭证（已报 ' + myTickets.length + ' 张）</button>' +
      (closed ? '<div class="bd-foot-hint">已报名本场 · 到场出示报名凭证</div>'
        : '<div style="margin-top:10px"><button class="btn-ghost" style="width:100%" onclick="UI.go(\'#/pay/salon/' + s.id + '\')">再报一张 · 帮朋友报名</button></div>');
    else if (closed) btn = '<button class="btn-primary" style="background:#b0b5bb" onclick="UI.toast(\'' + (seat <= 0 ? '本场已满员，可联系主理人候补' : '该活动报名已截止') + '\')">' + (seat <= 0 ? '已满员 · 联系主理人候补' : '已截止报名') + '</button>';
    else (function () {
      /* 门票调整同步：立省金额按「当前生效票价 − 会员价」计算（与后端规则一致） */
      var q0 = ticketLocal(s, isMember, db);
      var ghost = (!isMember && s.mprice < q0.finalPrice) ? '<button class="btn-ghost" style="width:100%;margin-bottom:10px" onclick="UI.go(\'#/vip\')">开通会员立省 ' + money(q0.finalPrice - s.mprice) + '</button>' : '';
      btn = ghost +
        '<button class="btn-primary" id="salonBookBtn" data-price="' + q0.finalPrice + '" onclick="User.startSalonBook(\'' + s.id + '\')">' + (q0.finalPrice === 0 ? '免费报名 · 领取报名凭证' : '立即报名 · ' + money(q0.finalPrice)) + '</button>';
    })();

    phone.innerHTML = pagebar('活动详情', '#/salon') +
      '<div class="boss-detail">' +
      '<div class="bd-card"><div class="boss-name" style="font-size:19px">' + esc(s.title) + '</div>' +
      '<div style="margin-top:10px;font-size:13.5px;color:#555;line-height:2">🗓️ ' + s.date + ' ' + (s.time || '') + '<br>📍 ' + esc(s.city) + ' · ' + esc(s.place) + '<br>👥 名额 ' + (s.seats || '不限') + ' · 已报名 ' + (s.joined || 0) + '</div>' +
      '<div style="margin-top:10px"><span class="tag">' + s.status + '</span></div>' +
      '<div class="bd-text" style="margin-top:12px">' + esc(s.desc) + '</div></div>' +

      ((s.seats && seat > 0) ? '<div class="bd-card" style="display:flex;align-items:center;gap:10px">' +
        '<div style="font-size:15px;font-weight:800;color:' + (hot ? 'var(--warn)' : 'var(--green)') + ';flex-shrink:0">剩 ' + seat + ' 个名额</div>' +
        '<div style="font-size:11px;color:var(--txt3)">' + (hot ? '名额紧张，报满即止' : '本期名额有限，报满即止') + '</div></div>' : '') +

      (s.desc ? '<div class="bd-card"><h4>📝 沙龙简介</h4><div style="font-size:12px;color:var(--txt2);line-height:1.8;white-space:pre-wrap">' + esc(s.desc) + '</div></div>' : '') +

      (s.videoUrl ? '<div class="bd-card"><h4>🎬 沙龙预告视频</h4>' +
        (s.videoCover
          ? '<div style="position:relative;border-radius:10px;overflow:hidden" onclick="window.open(\'' + s.videoUrl + '\',\'_blank\')">' +
            '<img src="' + s.videoCover + '" style="width:100%;display:block;aspect-ratio:2/1;object-fit:cover">' +
            '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.25))">' +
            '<span style="width:46px;height:46px;border-radius:50%;background:rgba(0,0,0,.5);color:#fff;display:flex;align-items:center;justify-content:center;font-size:19px;padding-left:3px">▶</span></div>' +
            '<div style="position:absolute;left:10px;bottom:8px;color:#fff;font-size:11px;text-shadow:0 1px 4px rgba(0,0,0,.6)">点击播放预告视频</div></div>'
          : '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#fdeaea;border-radius:10px" onclick="window.open(\'' + s.videoUrl + '\',\'_blank\')">' +
        '<div style="width:36px;height:36px;border-radius:10px;background:#fff;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">🎬</div>' +
        '<div style="flex:1;min-width:0"><div style="font-size:12.5px;font-weight:700;color:#a3741b">查看沙龙预告视频</div>' +
        '<div style="font-size:11px;color:var(--txt3);margin-top:1px">视频号实拍 · 点击跳转观看</div></div><span style="color:#a3741b">›</span></div>') + '</div>' : '') +

      ((s.sharePoints && s.sharePoints.filter(function (x) { return String(x || '').trim(); }).length)
        ? '<div class="bd-card"><h4>📌 分享要点</h4>' +
          s.sharePoints.filter(function (x) { return String(x || '').trim(); }).map(function (x, i) {
            return '<div style="display:flex;gap:8px;font-size:12px;color:var(--txt2);line-height:1.7;margin-bottom:5px">' +
              '<span style="flex-shrink:0;color:var(--blue);font-weight:700">' + (i + 1) + '.</span><span style="white-space:pre-wrap">' + esc(x) + '</span></div>';
          }).join('') + '</div>' : '') +

      (s.audience ? '<div class="bd-card"><h4>🎯 适合人群</h4><div style="font-size:12px;color:var(--txt2);line-height:1.8;white-space:pre-wrap">' + esc(s.audience) + '</div></div>' : '') +
      (s.notice ? '<div class="bd-card"><h4>📋 报名须知</h4><div style="font-size:12px;color:var(--txt2);line-height:1.8;white-space:pre-wrap">' + esc(s.notice) + '</div></div>' : '') +

      ((s.bossIds && s.bossIds.length) ? s.bossIds.map(function (bid) {
        var b = db.bosses.filter(function (x) { return x.id === bid; })[0];
        if (!b) return '';
        return '<div class="bd-card" onclick="UI.go(\'#/boss/' + b.id + '\')"><h4>🎤 沙龙分享人</h4>' +
          '<div style="display:flex;gap:12px;align-items:center">' + avaHtml(b, 50) +
          '<div style="flex:1"><div class="boss-name" style="font-size:15px">' + esc(b.name) + '</div>' +
          '<div class="boss-title">' + esc(b.title) + '</div></div><span class="arrow">›</span></div></div>';
      }).join('') : '') +

      ((s.photos && s.photos.length)
        ? '<div class="bd-card"><h4>📸 沙龙现场</h4><div class="img-grid">' +
          s.photos.map(function (src) { return '<div class="ph"><img src="' + src + '" style="width:100%;height:100%;object-fit:cover;border-radius:8px"></div>'; }).join('') +
          '</div></div>' : '') +

      '<div style="padding:2px 0 14px">' + btn + '</div>' +
      '<div class="bd-foot-hint">到场出示报名凭证入场 · 会员享专属价与优先锁座</div>' +
      '</div>';

    /* 门票调整：向后端取最终应付价，回填既有按钮（不新增元素、不改样式与位置） */
    ticketQuote(s, isMember, function (q) {
      var b = document.getElementById('salonBookBtn');
      if (!b || !q) return;
      b.setAttribute('data-price', q.finalPrice);
      b.textContent = q.finalPrice === 0 ? '免费报名 · 领取报名凭证' : '立即报名 · ' + money(q.finalPrice);
    });
  }

  /* ================= 页面：引荐提交（兼容旧路由，直接进收银台） ================= */
  function pageRefer(id) { pagePayForm('refer', id); }

  /* ================= 页面：转发给好友 ================= */
  function pageShare() {
    var u = S.get().user;
    phone.innerHTML = '' +
      '<div class="share-page">' +
      '<div class="sp-t">转发给好友</div><div class="sp-s">链接自动携带你的专属分销参数</div>' +
      '<div class="share-card"><img class="share-logo" src="img/logo-icon.png" alt=""><div><div class="sc-t">乐道AI · AI 老板资源圈</div><div class="sc-s">AI 自媒体老板圈子 · 会员 · 沙龙</div></div></div>' +
      '<div class="share-tip">✅ 好友点开这个链接就自动锁粉到 <b>' + esc(u.nickname) + '</b> 名下，他买任何产品（会员/沙龙）佣金都归你 —— 无需海报，转发即分销</div>' +
      '<button class="btn-wechat" onclick="UI.copy(location.origin+location.pathname+\'?d=' + u.inviteCode + '\')">复制链接 · 发给好友</button>' +
      '<button class="btn-plain" onclick="UI.go(\'#/distro\')">关闭</button>' +
      '</div>';
  }

  /* ================= 页面：商务合作海报 ================= */
  function pagePoster() {
    var u = S.get().user, c = S.get().config;
    phone.innerHTML = '' +
      '<div class="poster-page">' +
      '<div class="pp-t">商务合作海报</div>' +
      '<div class="pp-s">二维码是你的专属锁粉链接 · 谁扫谁就是你的客户 · 长按图片保存到相册</div>' +
      '<div class="poster">' +
      '<div class="po-k">' + esc(c.organizer.replace('市', '市 ')) + ' · 商务合作</div>' +
      '<div class="po-big">跟乐道牵手合作</div>' +
      '<div class="po-sub">深圳 AI 自媒体 MCN · 16000+ 私域老板</div>' +
      '<div class="po-sec">合作流程</div>' +
      '<div class="po-step"><div class="n">1</div><div><div class="t">扫码填表</div><div class="d">30 秒，说清你是做什么的</div></div></div>' +
      '<div class="po-step"><div class="n">2</div><div><div class="t">主理人联系</div><div class="d">24 小时内，直接跟你谈</div></div></div>' +
      '<div class="po-step"><div class="n">3</div><div><div class="t">谈成即合作</div><div class="d">供货 / 分销 / 联名都能谈</div></div></div>' +
      '<div class="qr-wrap"><div class="qbox">' + qrSVG('coop-' + u.inviteCode) + '</div>' +
      '<div class="qt">扫码填写合作意向</div><div class="qd">主理人 24 小时内联系你 · 不收费</div></div>' +
      '</div>' +
      '<button class="btn-plain" style="margin-top:14px" onclick="UI.go(\'#/distro\')">关闭</button>' +
      '</div>';
  }

  /* ================= 页面：圈子 ================= */
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
  function cclGateBarHtml() {
    var db = S.get();
    var logged = window.Auth && Auth.isLoggedIn();
    if (logged && db.user.member) return '';
    return '<div class="ccl-gate" onclick="UI.go(\'' + (logged ? '#/vip' : '#/login') + '\')">' +
      '<div style="flex:1">' +
      '<div style="font-size:12.5px;font-weight:700;color:var(--green);line-height:1.5">' + (logged ? '开通会员，才能发自己的动态' : '成为会员，圈子才能发动态') + '</div>' +
      '<div style="font-size:10.5px;color:#5f6368;margin-top:3px;line-height:1.6">游客可以浏览全部动态；想联系发布人，点动态里的「申请平台引荐」由客服免费拉群。</div>' +
      '</div><span style="font-size:11px;color:var(--green);font-weight:700;flex-shrink:0">' + (logged ? '去开通 ›' : '登录 ›') + '</span></div>';
  }
  function cclCardHtml(p) {
    var a = p.author || {}, imgs = p.images || [], imgHtml = '';
    if (imgs.length === 1) imgHtml = '<div style="margin-top:10px"><img src="' + imgs[0] + '" style="width:100%;max-height:220px;object-fit:cover;border-radius:10px;background:#eef0f3"></div>';
    else if (imgs.length > 1) imgHtml = '<div class="ccl-imgs">' + imgs.map(function (u) { return '<img src="' + u + '">'; }).join('') + '</div>';
    var videoHtml = p.videoUrl
      ? '<div class="ccl-video" onclick="event.stopPropagation();window.open(\'' + p.videoUrl + '\',\'_blank\')">' +
        '<span style="font-size:14px">🎬</span><span style="flex:1">探访视频 · 点开看看这家公司</span><span style="font-size:11px;color:#a3741b">播放 ›</span></div>' : '';
    var catName = (CCL_CATS.filter(function (c) { return c[0] === p.cat; })[0] || [])[1] || '分享';
    return '<div class="ccl-card" onclick="UI.go(\'#/circle-detail/' + p.id + '\')">' +
      '<div class="ccl-head">' + cclAvatar(a, 38) +
      '<div style="flex:1;min-width:0">' +
      '<div style="font-size:13.5px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(a.nickname || '会员') +
      (a.industry ? '<span style="font-size:10.5px;font-weight:400;color:#9aa0a6;margin-left:6px">' + esc(a.industry) + '</span>' : '') + '</div>' +
      '<div style="font-size:10.5px;color:#9aa0a6;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(a.company || '') + '</div>' +
      '</div>' +
      (p.pinned ? '<span class="ccl-chip" style="background:#fdf3e2;color:#a3741b">📌 置顶</span>' : '') +
      '<span class="ccl-chip" style="background:var(--brand-l);color:var(--blue)">' + catName + '</span></div>' +
      (p.content ? '<div class="ccl-body">' + esc(p.content).replace(/\n/g, '<br>') + '</div>' : '') +
      imgHtml + videoHtml +
      '<div class="ccl-foot"><span>' + cclAgo(p.createdAt) + '</span>' +
      '<span style="color:var(--green);font-weight:700">' + (p.mine ? '我发的 · 看看 ›' : '想联系 TA ›') + '</span></div></div>';
  }

  function pageCircle() {
    var db = S.get();
    var cat = window._cclCat || 'all';
    var list = (db.posts || []).filter(function (p) { return (p.status || 'on') === 'on' && (cat === 'all' || p.cat === cat); });
    list = list.slice().sort(function (a, b) { return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || String(b.createdAt).localeCompare(String(a.createdAt)); });
    phone.innerHTML = pagebar('圈子', '#/circle', '<span class="top-act" onclick="UI.go(\'#/circle-pub\')">发动态</span>') +
      cclGateBarHtml() +
      '<div class="ccl-cats">' + CCL_CATS.map(function (c) {
        return '<span class="ccl-cat ' + (cat === c[0] ? 'on' : '') + '" onclick="window._cclCat=\'' + c[0] + '\';render()">' + c[1] + '</span>';
      }).join('') + '</div>' +
      '<div class="ccl-list">' +
      (list.length ? list.map(cclCardHtml).join('') + '<div class="ccl-end">— 到底了 —</div>'
        : '<div class="empty-salon"><div class="ico">○</div><p>' + (cat === 'all' ? '圈子里还没有动态' : '这个分类下还没有动态') + '</p></div>') +
      '</div>' + vipFabHtml() + tabbar('circle');
  }

  function pageCircleDetail(id) {
    var db = S.get();
    var p = (db.posts || []).filter(function (x) { return x.id === id; })[0];
    if (!p) { phone.innerHTML = pagebar('动态详情', '#/circle') + '<div class="empty-salon">动态不存在</div>'; return; }
    var catName = (CCL_CATS.filter(function (c) { return c[0] === p.cat; })[0] || [])[1] || '分享';
    phone.innerHTML = pagebar('动态详情', '#/circle') +
      '<div class="ccl-list">' + cclCardHtml(p) +
      '<div class="bd-card" style="margin-top:10px"><h4>想联系 TA？</h4>' +
      '<div class="hint" style="font-size:12px;color:var(--txt2);line-height:1.7">平台提示：为保护双方，动态里不显示联系方式。想对接就点下面「申请平台引荐」，客服核对后会免费拉群。</div>' +
      '<div style="margin-top:12px"><button class="btn-primary" onclick="User.cclRefer(\'' + p.id + '\')">申请平台引荐</button></div>' +
      '<div class="bd-foot-hint">分类：' + catName + ' · 信息由发布人本人提供 · 联系方式由平台打码保护</div></div></div>';
  }

  function pageCirclePub() {
    var db = S.get();
    if (!db.user.member) {
      phone.innerHTML = pagebar('发布动态', '#/circle') + cclGateBarHtml() +
        '<div class="empty-salon"><div class="ico">👑</div><p>圈子发帖仅限会员</p>' +
        '<div style="margin-top:14px"><button class="btn-primary" onclick="UI.go(\'#/vip\')">开通年度老板会员</button></div></div>';
      return;
    }
    if (!db.user.advisorAdded) {
      phone.innerHTML = pagebar('发布动态', '#/circle') +
        '<div class="empty-salon"><div class="ico">🎓</div><p>请先添加平台专属顾问</p>' +
        '<div style="font-size:11px;color:var(--txt3);margin-top:8px">加顾问后发帖功能才开放</div>' +
        '<div style="margin-top:14px"><button class="btn-primary" onclick="UI.go(\'#/advisor\')">去添加顾问</button></div></div>';
      return;
    }
    var cat = window._cclPubCat || 'res';
    if (!window._cclPubImgs) window._cclPubImgs = [];
    if (!window._cclPubAgree) window._cclPubAgree = false;
    phone.innerHTML = pagebar('发布动态', '#/circle') +
      '<div class="ccl-pub">' +
      '<div class="fld"><div class="lb">昵称（前台只显示微信头像与昵称）</div>' +
      '<input id="cclNick" maxlength="20" value="' + esc(db.user.nickname) + '" placeholder="例如：老王 · 跨境电商"></div>' +
      '<div class="fld"><div class="lb">分类</div><div class="ccl-chips">' +
      CCL_CATS.filter(function (c) { return c[0] !== 'all'; }).map(function (c) {
        return '<span class="chip ' + (cat === c[0] ? 'on' : '') + '" onclick="window._cclPubCat=\'' + c[0] + '\';render()">' + c[1] + '</span>';
      }).join('') + '</div></div>' +
      '<div class="fld"><div class="lb">说点什么</div>' +
      '<textarea id="cclContent" placeholder="说说你的资源、需求或合作计划…">' + esc(window._cclPubText || '') + '</textarea></div>' +
      '<div class="fld"><div class="lb">配图 <span style="font-weight:400;color:#9aa0a6">（选填，最多 9 张）</span></div>' +
      '<div class="ccl-picks">' +
      window._cclPubImgs.map(function (u, i) {
        return '<span class="pk"><img src="' + u + '"><span class="x" onclick="User.cclDelImg(' + i + ')">✕</span></span>';
      }).join('') +
      (window._cclPubImgs.length < 9 ? '<div class="ccl-pick-add" onclick="User.cclPickImgs()"><span style="font-size:20px;color:#b0b5bb">+</span><span style="font-size:10px;color:#b0b5bb">添加图片</span></div>' : '') +
      '</div></div>' +
      '<div class="fld"><div class="ccl-warn">⚠ 手机号、微信号、QQ、邮箱会被系统自动隐藏 —— 对接走平台引荐，避免被绕单。</div>' +
      '<div class="ccl-agree" onclick="window._cclPubAgree=!window._cclPubAgree;render()">' +
      '<span class="box ' + (window._cclPubAgree ? 'on' : '') + '">✓</span>' +
      '<span>我已阅读并同意《圈子发布规范》：不发广告刷屏、不虚假宣传、不私下导流。</span></div></div>' +
      '<div style="padding:2px 0 14px"><button class="btn-primary" onclick="User.cclPublish()">发布动态</button></div>' +
      '</div>' + tabbar('circle');
  }

  function pageCircleMine() {
    var db = S.get();
    var mine = (db.posts || []).filter(function (p) { return p.mine; });
    var ST = { pending: '待审核', on: '已发布', off: '已下架', rejected: '已驳回' };
    phone.innerHTML = pagebar('我的动态', '#/circle') +
      '<div class="ccl-list">' +
      (mine.length ? mine.map(function (p) {
        var st = ST[p.status || 'on'];
        return cclCardHtml(p) + '<div class="wb-note" style="margin:-6px 14px 10px">状态：' + st +
          (p.rejectReason ? ' · 驳回原因：' + esc(p.rejectReason) : '') + '</div>';
      }).join('') : '<div class="empty-salon"><div class="ico">○</div><p>你还没有发布动态</p></div>') +
      '</div>';
  }

  /* ================= 页面：登录 ================= */
  function pageLogin() {
    var inWx = Auth.isWeChat();
    phone.innerHTML = '' +
      '<div class="login-page">' +
      '<img class="lp-logo" src="img/logo-icon.png" alt="乐道AI">' +
      '<div class="lp-name">乐道AI</div>' +
      '<div class="lp-slogan">AI 出海 · 年度老板会员圈子</div>' +
      '<button class="lp-wx" onclick="User.wxLogin()">' +
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><path d="M9.5 4C5.9 4 3 6.5 3 9.6c0 1.8 1 3.4 2.5 4.5l-.7 2.1 2.4-1.2c.7.2 1.5.3 2.3.3h.4A5.6 5.6 0 0 1 9.6 13c0-3 2.9-5.4 6.4-5.4h.3C15.6 5.5 12.8 4 9.5 4zm-2 3.5a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8zm4.5 0a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8zM16 8.6c-3.2 0-5.8 2.1-5.8 4.7s2.6 4.7 5.8 4.7c.6 0 1.2-.1 1.8-.3l2 1-.6-1.7c1.3-.9 2.2-2.2 2.2-3.7 0-2.6-2.6-4.7-5.4-4.7zm-1.8 2.9a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5zm3.6 0a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5z"/></svg>' +
      (inWx ? '微信授权一键登录' : '微信登录（未配置则模拟授权）') + '</button>' +
      '<div class="lp-tip">登录即代表同意《用户协议》与《隐私政策》<br>' +
      (inWx ? '已识别微信环境 · 正在自动授权登录…' : '未检测到微信环境 · 演示模式：点击按钮即完成模拟授权登录') + '</div></div>';
  }

  /* ================= 路由 ================= */
  var routes = {
    'circle': pageCircle,
    'circle-pub': pageCirclePub,
    'circle-mine': pageCircleMine,
    'salon': pageSalon,
    'boss': pageBoss,
    'me': pageMe,
    'vip': pageVip,
    'member': pageVip,
    'ticket': function () { pageTicket(null); },
    'refer-ticket': function () { pageReferTicket(null); },
    'my-pay': function () { pageMyPay(null); },
    'myprofile': pageMyProfile,
    'settings': pageSettings,
    'advisor': pageAdvisor,
    'notifs': pageNotifs,
    'coop-apply': pageCoopApply,
    'coop-ok': pageCoopOk,
    'verify': pageVerify,
    'share': pageShare,
    'poster': pagePoster,
    'login': pageLogin
  };

  function render(keepScroll) {
    var h = location.hash.replace('#/', '') || 'salon';
    var seg = h.split('/');
    if (!Auth.isLoggedIn() && h !== 'login') h = 'login';
    var y = window.scrollY;
    var name = h.split('/')[0];
    if (phone.classList) phone.classList.remove('salon-fix');

    /* 子模块优先（老板工作台 / 分销中心） */
    if (name.indexOf('boss-') === 0 && window.Workbench) { window.Workbench.route(h); }
    else if ((name === 'distro' || name.indexOf('distro-') === 0) && window.Distro) { window.Distro.route(h); }
    /* 动态参数路由 */
    else if (name === 'boss' && seg[1]) { pageBossDetail(seg[1]); }
    else if (name === 'refer' && seg[1]) { pageRefer(seg[1]); }
    else if (name === 'salon-detail' && seg[1]) { pageSalonDetail(seg[1]); }
    else if (name === 'circle-detail' && seg[1]) { pageCircleDetail(seg[1]); }
    else if (name === 'ticket' && seg[1]) { pageTicket(seg[1]); }
    else if (name === 'refer-ticket' && seg[1]) { pageReferTicket(seg[1]); }
    else if (name === 'my-pay' && seg[1]) { pageMyPay(seg[1]); }
    else if (name === 'pay' && seg[1]) { pagePayForm(seg[1], seg[2]); }
    else if (routes[h]) { routes[h](); }
    else { pageSalon(); }
    if (keepScroll) window.scrollTo(0, y); else window.scrollTo(0, 0);
  }
  window.render = render;
  /* 供新模块带参数跳转使用 */
  window.render2 = function (base, param) { location.hash = '#/' + base + (param && param !== 'all' && param !== 'paid' ? '/' + param : (base === 'my-pay' ? '/' + param : '')); render(); };

  window.addEventListener('hashchange', function () { render(); });

  /* 云端数据初始化：拉取最新内容（后台在其他设备改的数据），有变化则刷新当前页 */
  if (S.initSync) {
    S.initSync(function () { if (S.reconcileDistRole) S.reconcileDistRole(); render(true); }, function () { /* 云端暂不可达：静默沿用本地缓存 */ });
  }

  /* 启动：处理微信授权回调 → 同步登录态 → 微信内自动授权登录 → 首次渲染 */
  Auth.handleCallback()
    .then(function () { Auth.syncToStore(); })
    .catch(function () { Auth.logout(); })
    .then(function () {
      var auto = Auth.tryAutoLogin();
      if (auto && typeof auto.then === 'function') {
        auto.then(function (s) {
          if (s) { Auth.syncToStore(); UI.toast('微信授权成功，欢迎 ' + (s.nickname || '')); }
          render();
        }).catch(function () { render(); });
      } else { render(); }
    });

  /* ================= 通知（站内，本机） ================= */
  function notify(bucket, ic, t, s) {
    var db = S.get();
    db.notifs = db.notifs || [];
    db.notifs.unshift({ bucket: bucket, ic: ic, t: t, s: s, ts: Date.now(), time: nowStr() });
    db.notifs = db.notifs.slice(0, 60);
    S.persist();
  }
  window.notify = notify;

  /* ================= 微信/支付宝收款（配置读取 + 收款确认弹窗） ================= */
  function payInfoOf(db) {
    var p = ((db || S.get()).config || {}).payInfo || {};
    return { wxQr: p.wxQr || '', aliQr: p.aliQr || '', wxName: p.wxName || '', aliName: p.aliName || '', link: p.link || '', amount: +p.amount || 0, note: p.note || '', updatedAt: p.updatedAt || '' };
  }
  function hasPayQr(p) { return !!(p.wxQr || p.aliQr); }
  /* 收款确认弹窗：展示商家收款二维码/金额/订单说明，付款人扫码后点「我已完成支付」回调落库。
   * 配置了二维码或收款链接任一即弹窗；都未配置时直接回调（保持原有模拟支付流程，行为完全兼容）。 */
  function payCollect(opt, onDone) {
    var p = payInfoOf();
    if (!hasPayQr(p) && !p.link) { onDone('微信支付'); return; }
    var side = p.wxQr ? 'wx' : (p.aliQr ? 'ali' : '');
    window._pcSide = side || 'wx';
    var html =
      '<div class="sheet pay-sheet tall" id="collectSheet">' +
      '<span class="close-x" onclick="UI.closeSheet()">✕</span>' +
      '<h3>扫码支付</h3>' +
      '<div class="pc-amount">' + money(opt.amount || 0) + '</div>' +
      (opt.title ? '<div class="pc-title">' + esc(opt.title) + '</div>' : '') +
      (p.note ? '<div class="pc-note">📋 ' + esc(p.note) + '</div>' : '') +
      (p.link ? '<div class="pc-note pc-link" onclick="User.copyPayLink()">🔗 收款链接：<span class="u">' + esc(p.link) + '</span>（点击复制）</div>' : '') +
      (side
        ? ((p.wxQr && p.aliQr)
          ? '<div class="pc-tabs"><span class="chip ' + (side === 'wx' ? 'on' : '') + '" id="pcTabWx" onclick="User.pcSide(\'wx\')">微信支付</span>' +
            '<span class="chip ' + (side === 'ali' ? 'on' : '') + '" id="pcTabAli" onclick="User.pcSide(\'ali\')">支付宝</span></div>'
          : '') +
          '<div class="pc-qr"><img id="pcQrImg" src="' + (side === 'wx' ? p.wxQr : p.aliQr) + '" alt="收款二维码">' +
          '<div class="pc-qrname" id="pcQrName">' + esc(side === 'wx' ? (p.wxName || '微信收款') : (p.aliName || '支付宝收款')) + '</div>' +
          '<div class="pc-tip" id="pcTip">长按或截图 → 打开' + (side === 'wx' ? '微信' : '支付宝') + '扫一扫付款</div></div>'
        : '<div class="pc-qr"><div class="pc-tip" style="font-size:13px;color:var(--txt2);padding:8px 0">请点击上方收款链接完成付款<br>（链接已复制到剪贴板可粘贴打开）</div></div>') +
      '<button class="btn-wechat" style="width:100%;margin-top:10px" id="pcDone">我已完成支付</button>' +
      '</div>';
    var old = document.getElementById('collectSheet');
    if (old) old.remove();
    document.body.insertAdjacentHTML('beforeend', html);
    UI.openSheet('collectSheet');
    document.getElementById('pcDone').onclick = function () {
      var m = window._pcSide === 'ali' ? '支付宝' : '微信支付';
      UI.closeSheet();
      onDone(m);
    };
  }

  /* ================= 用户操作 ================= */
  var User = window.User = {
    menuClick: function (target) {
      if (target === 'service') { UI.toast('客服微信：' + S.get().config.serviceWechat + '（已复制）'); UI.copy(S.get().config.serviceWechat); return; }
      if (target === 'wxprofile') { User.fetchWxProfile(); return; }
      if (target === 'paysetup') { User.openPaySetup(); return; }
      UI.go(target || '#/me');
    },
    /* 复制收款链接（收款弹窗内） */
    copyPayLink: function () {
      var p = payInfoOf();
      UI.copy(p.link);
    },
    /* 收款弹窗切换 微信/支付宝 */
    pcSide: function (s) {
      var p = payInfoOf();
      window._pcSide = s;
      var img = document.getElementById('pcQrImg');
      if (img) img.src = s === 'wx' ? p.wxQr : p.aliQr;
      var nm = document.getElementById('pcQrName');
      if (nm) nm.textContent = s === 'wx' ? (p.wxName || '微信收款') : (p.aliName || '支付宝收款');
      var tp = document.getElementById('pcTip');
      if (tp) tp.textContent = '长按或截图 → 打开' + (s === 'wx' ? '微信' : '支付宝') + '扫一扫付款';
      var tw = document.getElementById('pcTabWx');
      if (tw) tw.className = 'chip' + (s === 'wx' ? ' on' : '');
      var ta = document.getElementById('pcTabAli');
      if (ta) ta.className = 'chip' + (s === 'ali' ? ' on' : '');
    },
    fetchWxProfile: function () {
      var p = Auth.fetchProfile();
      if (!p) return;
      p.then(function (s) {
        Auth.syncToStore();
        UI.toast('已获取微信头像昵称' + (s.demo ? '（演示模式）' : ''));
        render();
      }).catch(function (e) { UI.toast(e.message || '获取失败'); });
    },

    /* ---------- 会员开通 ---------- */
    payVip: function () {
      var db = S.get(), c = db.config;
      UI.openSheet('paySheet');
      var priceEl = document.getElementById('payPrice');
      if (priceEl) priceEl.textContent = money(c.memberPrice) + ' / ' + c.memberDays + ' 天';
    },
    /* 会员收银弹窗「确认支付」入口（修复原 payMember 缺失导致的点击报错）：
     * 配置了收款码 → 打开扫码收款弹窗；未配置 → 保持原有模拟支付 */
    payMember: function () {
      var db = S.get(), c = db.config;
      payCollect({ amount: c.memberPrice, title: '开通年度老板会员' }, function (m) {
        UI.closeSheet();
        User.confirmVipPay(m);
      });
    },
    confirmVipPay: function (method) {
      var db = S.get(), c = db.config, u = db.user;
      var expire = new Date(Date.now() + (c.memberDays || 365) * 86400000).toISOString().slice(0, 10);
      var sg = {
        id: S.uid('sg'), kind: 'member', type: 'normal', title: 'AI出海年度老板会员',
        name: u.nickname, phone: u.phone, amount: c.memberPrice, paid: true, paidAt: nowStr(),
        payMethod: method || '微信支付',
        refunded: false, createdAt: nowStr(), code: 'TQ-V-' + String(Date.now()).slice(-4),
        memberDays: c.memberDays, dist: u.inviteCode, distName: u.nickname,
        formData: {}
      };
      db.signups.unshift(sg);
      u.member = true; u.memberExpire = expire;
      db.members.unshift({
        phone: u.phone, nickname: u.nickname, realName: u.nickname, company: '', industry: '',
        expire: expire, status: 'active', paidTotal: c.memberPrice, orderCount: 1,
        distName: u.nickname, wxBound: true, signAt: nowStr()
      });
      db.commissions.unshift({
        id: S.uid('cm'), signupId: sg.id, kind: 'member', title: sg.title, name: u.nickname,
        amount: Math.round(c.memberPrice * c.memberCommissionRate) / 100, rate: c.memberCommissionRate,
        dist: u.inviteCode, distName: u.nickname, status: '待结算', time: nowStr()
      });
      S.save(); UI.closeSheet();
      notify('user', '👑', '会员开通', '已开通年度老板会员 · 有效期至 ' + expire);
      notify('boss', '👑', '会员开通', u.nickname + ' 开通年度会员 ' + money(c.memberPrice));
      UI.toast('开通成功！主理人将一对一对接');
      setTimeout(function () { UI.go('#/vip'); render(); }, 700);
    },

    /* ---------- 沙龙报名 ---------- */
    /* 报名入口：先按门票规则校验（限购），通过后进入收银台 */
    startSalonBook: function (evId) {
      var db = S.get();
      var s = db.salons.filter(function (x) { return x.id === evId; })[0] || {};
      ticketQuote(s, db.user.member, function (q, fromServer) {
        if (fromServer) return; /* 服务端校正回调：仅用于回填价格，不重复跳转 */
        if (q && !q.limitOk) { UI.toast('每人限购 ' + q.limit + ' 张，您已报名 ' + q.bought + ' 张'); return; }
        UI.go('#/pay/salon/' + evId);
      });
    },
    confirmSalonPay: function (evId, price) {
      var db = S.get(), u = db.user;
      var ev = db.salons.filter(function (x) { return x.id === evId; })[0] || {};
      var name = ($('pfName') || {}).value || u.nickname;
      var phoneNo = ($('pfPhone') || {}).value || u.phone;
      var want = ($('pfWant') || {}).value || '';
      if (!name.trim()) { UI.toast('请填写姓名'); return; }
      if (!/^1\d{10}$/.test(phoneNo || '')) { UI.toast('请填写正确的 11 位手机号'); return; }
      var base = (price == null) ? (u.member ? (ev.mprice || 0) : (ev.price || 0)) : price;

      /* 下单落库（金额与凭证号以后端确认为准，后端不可达时回退前端计算） */
      var submit = function (finalPrice, code, method) {
        var sg = {
          id: S.uid('sg'), kind: 'salon', type: u.member ? 'vip' : 'normal', evId: evId,
          title: ev.title || '沙龙报名', name: name.trim(), phone: phoneNo, amount: finalPrice,
          paid: true, paidAt: nowStr(), payMethod: method || '微信支付', refunded: false, createdAt: nowStr(),
          code: code || ('TQ-S-' + String(Date.now()).slice(-4)), dist: u.inviteCode, distName: u.nickname,
          formData: { '姓名': name.trim(), '手机号': phoneNo, '希望通过沙龙获得什么': want }
        };
        db.signups.unshift(sg);
        ev.joined = (ev.joined || 0) + 1;
        if (finalPrice > 0) {
          db.commissions.unshift({
            id: S.uid('cm'), signupId: sg.id, kind: 'salon', title: sg.title, name: sg.name,
            amount: Math.round(finalPrice * db.config.salonCommissionRate) / 100, rate: db.config.salonCommissionRate,
            dist: u.inviteCode, distName: u.nickname, status: '待结算', time: nowStr()
          });
        }
        S.save();
        notify('user', '🎫', '报名成功', sg.title + ' · 到场出示报名凭证');
        notify('boss', '🎫', '新报名 · ' + sg.title, sg.name + ' · ' + (finalPrice ? money(finalPrice) : '免费票') + ' · 编号 ' + sg.code);
        UI.toast(finalPrice ? '支付成功 · 报名凭证已生成' : '报名成功 · 报名凭证已生成');
        setTimeout(function () { UI.go('#/ticket/' + sg.id); }, 800);
      };

      var bought = (db.signups || []).filter(function (x) {
        return x.kind === 'salon' && x.evId === evId && x.phone === phoneNo && x.paid && !x.refunded;
      }).length;
      /* 收款弹窗：配置了收款二维码时先展示扫码支付，确认后再落库 */
      var gate = function (fp, code) {
        payCollect({ amount: fp, title: '沙龙报名 · ' + (ev.title || '') }, function (m) { submit(fp, code, m); });
      };
      apiPost('/ticket/confirm', {
        salonId: evId, title: ev.title || '', price: ev.price || 0, mprice: ev.mprice || 0,
        isMember: !!u.member, ticketAdjust: ev.ticketAdjust || null, boughtCount: bought,
        phone: phoneNo, name: name.trim(), qty: 1, today: S.today()
      }, function (res) {
        if (res && res.ok === false) { UI.toast(res.msg || '报名校验未通过'); return; }
        if (res && res.ok) return gate(res.finalPrice, res.code);
        gate(base, null); /* 纯静态部署/接口不可达：沿用前端价 */
      });
    },

    /* ---------- 老板引荐 ---------- */
    confirmReferPay: function (bossId, amount) {
      var db = S.get(), u = db.user;
      var b = db.bosses.filter(function (x) { return x.id === bossId; })[0] || {};
      var name = ($('rfName') || {}).value || u.nickname;
      var wx = ($('rfWx') || {}).value || '';
      var need = ($('rfNeed') || {}).value || '';
      if (!name.trim()) { UI.toast('请填写姓名'); return; }
      if (!need.trim()) { UI.toast('请填写你的引荐诉求'); return; }
      /* 收款弹窗：配置了收款二维码时先展示扫码支付，确认后再落库 */
      payCollect({ amount: amount, title: '老板引荐 · ' + (b.name || '') }, function (method) {
        User.referSubmit(bossId, amount, name.trim(), wx, need.trim(), method);
      });
    },
    referSubmit: function (bossId, amount, name, wx, need, method) {
      var db = S.get(), u = db.user;
      var b = db.bosses.filter(function (x) { return x.id === bossId; })[0] || {};
      var sg = {
        id: S.uid('sg'), kind: 'refer', type: u.member ? 'vip' : 'normal', bossId: bossId, bossName: b.name,
        title: '老板引荐 · ' + b.name, name: name, phone: u.phone, amount: amount,
        paid: true, paidAt: nowStr(), payMethod: method || '微信支付', refunded: false, createdAt: nowStr(),
        code: 'TQ-R-' + String(Date.now()).slice(-4), dist: u.inviteCode, distName: u.nickname,
        referred: false, dock: 'pending', demand: need,
        deadline: new Date(Date.now() + 24 * 3600000).toISOString(),
        formData: { '姓名': name, '微信号': wx, '引荐诉求': need }
      };
      db.signups.unshift(sg);
      db.referrals.unshift({
        id: S.uid('r'), signupId: sg.id, bossId: bossId, bossName: b.name, client: sg.name,
        phone: u.phone, amount: amount, commission: Math.round(amount * db.config.memberCommissionRate) / 100,
        dock: 'pending', referred: false, dist: u.inviteCode, distName: u.nickname,
        demand: sg.demand, submitTime: nowStr(), note: ''
      });
      if (amount > 0) {
        db.commissions.unshift({
          id: S.uid('cm'), signupId: sg.id, kind: 'refer', title: sg.title, name: sg.name,
          amount: Math.round(amount * db.config.memberCommissionRate) / 100, rate: db.config.memberCommissionRate,
          dist: u.inviteCode, distName: u.nickname, status: '待结算', time: nowStr()
        });
      }
      b.matched = (b.matched || 0) + 1;
      if (b.quotaLeft != null) b.quotaLeft = Math.max(0, b.quotaLeft - 1);
      S.save();
      notify('user', '🤝', '引荐提交成功', '引荐顾问将在 ' + db.config.refundHours + ' 小时内为你对接');
      notify('boss', '🤝', '新引荐单 · ' + b.name, sg.name + ' 引荐 ' + b.name + '（' + (amount ? money(amount) : '会员免费') + '）');
      UI.toast('引荐提交成功 · 引荐顾问将在 24 小时内为你对接');
      setTimeout(function () { UI.go('#/refer-ticket/' + sg.id); }, 800);
    },

    /* ---------- 收款设置（微信/支付宝收款信息填写弹窗，主理人入口） ---------- */
    openPaySetup: function () {
      var p = payInfoOf();
      var html =
        '<div class="sheet pay-sheet tall" id="paySetupSheet">' +
        '<span class="close-x" onclick="UI.closeSheet()">✕</span>' +
        '<h3>收款设置（微信 / 支付宝）</h3>' +
        '<div class="ps-grid">' +
        '<div class="ps-cell"><div class="f-label" style="text-align:center">微信收款码</div>' +
        '<div class="ps-qr" id="psQrWx">' + (p.wxQr ? '<img src="' + p.wxQr + '">' : '<span>未上传</span>') + '</div>' +
        '<button class="btn-ghost" style="width:100%;font-size:12px;padding:7px 0" onclick="User.upPayQr(\'wx\')">📤 上传微信收款码</button></div>' +
        '<div class="ps-cell"><div class="f-label" style="text-align:center">支付宝收款码</div>' +
        '<div class="ps-qr" id="psQrAli">' + (p.aliQr ? '<img src="' + p.aliQr + '">' : '<span>未上传</span>') + '</div>' +
        '<button class="btn-ghost" style="width:100%;font-size:12px;padding:7px 0" onclick="User.upPayQr(\'ali\')">📤 上传支付宝收款码</button></div>' +
        '</div>' +
        '<div class="f-label">微信收款人</div><input class="f-input" id="psWxName" value="' + esc(p.wxName) + '" placeholder="微信昵称 / 收款人">' +
        '<div class="f-label">支付宝收款人</div><input class="f-input" id="psAliName" value="' + esc(p.aliName) + '" placeholder="支付宝姓名 / 账号">' +
        '<div class="f-label">收款链接（微信/支付宝收款码链接，选填）</div><input class="f-input" id="psLink" value="' + esc(p.link) + '" placeholder="https://...（支付时向付款人展示，可复制）">' +
        '<div class="f-label">默认收款金额（元，留空/0 = 按订单金额）</div><input class="f-input" id="psAmount" type="number" min="0" value="' + (p.amount || '') + '">' +
        '<div class="f-label">订单说明（支付时向付款人展示）</div><input class="f-input" id="psNote" value="' + esc(p.note) + '" placeholder="例：沙龙报名 / 老板引荐服务费">' +
        '<button class="btn-wechat" style="width:100%;margin-top:14px" onclick="User.savePaySetup()">保存收款信息</button>' +
        '<div style="text-align:center;font-size:11px;color:var(--txt3);margin-top:8px">保存后用户端收银台支付时展示收款二维码、金额与订单说明</div>' +
        '</div>';
      var old = document.getElementById('paySetupSheet');
      if (old) old.remove();
      document.body.insertAdjacentHTML('beforeend', html);
      UI.openSheet('paySetupSheet');
      window._psTemp = { wxQr: p.wxQr, aliQr: p.aliQr };
    },
    /* 上传收款二维码：ImgUp 统一管线压缩 → /api/pay/upload 落盘 → 返回可访问 URL */
    upPayQr: function (kind) {
      ImgUp.pick({ ratio: 0, max: 700, targetKB: 180 }, function (urls) {
        if (!urls || !urls.length) return;
        var url = urls[0];
        window._psTemp[kind + 'Qr'] = url;
        var el = document.getElementById(kind === 'wx' ? 'psQrWx' : 'psQrAli');
        if (el) el.innerHTML = '<img src="' + url + '">';
        apiPost('/pay/upload', { kind: kind, dataUrl: url }, function (r) {
          if (r && r.ok && r.url) {
            window._psTemp[kind + 'Qr'] = r.url;
            var el2 = document.getElementById(kind === 'wx' ? 'psQrWx' : 'psQrAli');
            if (el2) el2.innerHTML = '<img src="' + r.url + '">';
            UI.toast('收款码已上传');
          } else {
            UI.toast((r && r.msg) ? r.msg : '服务端上传失败，将随配置本地保存');
          }
        });
      });
    },
    /* 保存收款信息：服务端 pay/save 持久化 + 同步本机/云端 config.payInfo */
    savePaySetup: function () {
      var t = window._psTemp || {};
      var payload = {
        wxQr: t.wxQr || '', aliQr: t.aliQr || '',
        wxName: (($('psWxName') || {}).value || '').trim(), aliName: (($('psAliName') || {}).value || '').trim(),
        link: (($('psLink') || {}).value || '').trim(),
        amount: +(($('psAmount') || {}).value || 0) || 0,
        note: (($('psNote') || {}).value || '').trim()
      };
      apiPost('/pay/save', payload, function (r) {
        var db = S.get();
        if (r && r.ok && r.payInfo) {
          db.config.payInfo = r.payInfo;
          UI.toast('收款信息已保存');
        } else {
          payload.updatedAt = nowStr();
          db.config.payInfo = payload;
          UI.toast('服务端不可达，已保存在本机（联网后自动同步）');
        }
        S.save(); UI.closeSheet(); render();
      });
    },

    /* ---------- 会员资料 ---------- */
    saveMyProfile: function () {
      var db = S.get(), u = db.user;
      var nick = ($('mpfNick') || {}).value || '';
      if (!nick.trim()) { UI.toast('请填写昵称'); return; }
      u.nickname = nick.trim();
      u.title = ($('mpfTitle') || {}).value || '';
      u.sub = ($('mpfSub') || {}).value || '';
      u.profile = u.profile || {};
      u.profile.realName = ($('mpfName') || {}).value || '';
      u.profile.company = ($('mpfCompany') || {}).value || '';
      u.profile.industry = ($('mpfIndustry') || {}).value || '';
      u.profile.mainBiz = ($('mpfBiz') || {}).value || '';
      u.profile.wantRes = ($('mpfWant') || {}).value || '';
      u.profile.hasRes = ($('mpfHas') || {}).value || '';
      u.profile.wechat = ($('mpfWechat') || {}).value || '';
      S.save();
      var missing = [];
      if (!u.profile.realName) missing.push('姓名');
      if (!u.profile.company || !u.profile.industry) missing.push('公司+行业');
      if (!u.profile.wechat) missing.push('微信号');
      if (missing.length) { UI.toast('还差：' + missing.join('、')); render(); return; }
      UI.toast('资料已保存');
      setTimeout(function () { UI.go('#/me'); }, 600);
    },
    saveSettings: function () {
      var db = S.get(), u = db.user;
      var n = ($('setNick') || {}).value || '';
      if (!n.trim()) { UI.toast('昵称不能为空'); return; }
      u.nickname = n.trim();
      u.title = ($('setTitle') || {}).value || '';
      u.sub = ($('setSub') || {}).value || '';
      S.save(); UI.toast('资料已保存');
    },

    /* ---------- 专属顾问 ---------- */
    addAdvisor: function () {
      var db = S.get(), u = db.user;
      u.advisorAdded = true;
      db.staffAdded = true;
      S.save();
      notify('boss', '🤝', '会员添加专属顾问', u.nickname + ' 已添加 ' + db.config.serviceWechat);
      UI.toast('已添加专属顾问');
      render();
    },

    /* ---------- 商务合作 ---------- */
    submitCoop: function () {
      var db = S.get(), u = db.user;
      var name = ($('coName') || {}).value || '';
      var biz = ($('coBiz') || {}).value || '';
      var want = ($('coDetail') || {}).value || '';
      var phoneNo = ($('coPhone') || {}).value || '';
      if (!name.trim()) { UI.toast('请填写你的称呼或公司名'); return; }
      if (!biz.trim()) { UI.toast('请简单介绍你是做什么的'); return; }
      if (!want.trim()) { UI.toast('请写下你想怎么合作'); return; }
      if (!/^1\d{10}$/.test(phoneNo)) { UI.toast('请填写正确的 11 位手机号'); return; }
      var types = Array.prototype.map.call(document.querySelectorAll('#coopChips .chip.on'), function (c) { return c.dataset.v; });
      var budgetChip = document.querySelector('#budgetChips .chip.on');
      db.coopLeads.unshift({
        id: S.uid('l'), name: name.trim(), biz: biz.trim(), result: ($('coResult') || {}).value || '',
        want: want.trim(), types: types.length ? types : ['其他'],
        budget: budgetChip ? budgetChip.dataset.v : '未填',
        phone: phoneNo, wechat: ($('coWechat') || {}).value || '',
        status: 'new', dist: u.inviteCode, distName: u.nickname, commission: 0, cmState: '',
        note: '', time: nowStr()
      });
      S.save();
      notify('boss', '💼', '新的商务合作申请', name.trim() + ' · ' + biz.trim().slice(0, 24));
      UI.toast('提交成功！主理人 24 小时内联系你');
      setTimeout(function () { UI.go('#/coop-ok'); }, 700);
    },

    /* ---------- 核销台 ---------- */
    verifyCode: function () {
      var db = S.get();
      var code = (($('vfCode') || {}).value || '').trim();
      if (!code) { UI.toast('请输入凭证编号'); return; }
      var s = db.signups.filter(function (x) { return x.code === code; })[0];
      if (!s) { UI.toast('❌ 未找到该凭证，请核对编号'); return; }
      User.verifySignup(s.id);
    },
    verifySignup: function (id) {
      var db = S.get();
      var s = db.signups.filter(function (x) { return x.id === id; })[0];
      if (!s) return;
      if (s.used) { UI.toast('⚠️ 该凭证已核销过，请勿重复核销'); return; }
      if (s.refunded) { UI.toast('❌ 该报名已退款，凭证已失效'); return; }
      if (!s.paid) { UI.toast('❌ 该报名未支付，无法核销'); return; }
      s.used = true; s.usedAt = nowStr();
      S.save();
      notify('user', '✅', '报名已核销', s.title + ' · 凭证 ' + s.code);
      UI.toast('✅ 核销成功 · ' + s.name);
      pageVerify();
    },

    /* ---------- 登录 ---------- */
    wxLogin: function () {
      var p = Auth.isWeChat() ? Auth.wxMpLogin() : Auth.wxOpenLogin();
      if (p) p.then(function (wxUser) {
        if (!wxUser) return;
        Auth.setSession(wxUser);
        Auth.syncToStore();
        UI.toast('微信授权成功，欢迎你（' + (wxUser.label || '演示模式') + '）');
        if (location.hash.replace('#/', '') !== 'salon') UI.go('#/salon'); else render();
      }).catch(function (e) { UI.toast(e.message || '微信授权失败'); });
    },
    logout: function () {
      Auth.logout();
      UI.toast('已退出登录');
      setTimeout(function () { UI.go('#/login'); render(); }, 600);
    },

    /* ---------- 圈子 ---------- */
    cclPickImgs: function () {
      if (!window.ImgUp) { UI.toast('图片组件未加载'); return; }
      ImgUp.pick({ ratio: 0, max: 1200, targetKB: 220, multiple: true }, function (urls) {
        window._cclPubImgs = (window._cclPubImgs || []).concat(urls).slice(0, 9);
        User.cclKeepDraft(); render();
        UI.toast('已添加 ' + urls.length + ' 张');
      });
    },
    cclDelImg: function (i) { window._cclPubImgs.splice(i, 1); User.cclKeepDraft(); render(); },
    cclKeepDraft: function () {
      var el = document.getElementById('cclContent');
      if (el) window._cclPubText = el.value;
    },
    cclPublish: function () {
      var db = S.get();
      var content = ($('cclContent') || {}).value || '';
      var nick = ($('cclNick') || {}).value || db.user.nickname;
      var imgs = window._cclPubImgs || [];
      if (!content.trim() && !imgs.length) { UI.toast('说点什么，或至少配一张图'); return; }
      if (!window._cclPubAgree) { UI.toast('请先勾选《圈子发布规范》'); return; }
      /* 落库：content 为打码后的最终文案（敏感信息自动隐藏，对接走平台引荐） */
      var publish = function (finalContent) {
        db.user.nickname = nick || db.user.nickname;
        db.posts.unshift({
          id: S.uid('p'), cat: window._cclPubCat || 'res', content: finalContent,
          images: imgs.slice(), mine: true, pinned: false, status: 'pending',
          createdAt: nowStr(),
          author: { nickname: db.user.nickname, avatarUrl: db.user.avatar, company: (db.user.profile || {}).company || '', industry: (db.user.profile || {}).industry || '' }
        });
        S.save();
        window._cclPubText = ''; window._cclPubImgs = []; window._cclPubAgree = false;
        notify('boss', '📝', '新动态待审核', db.user.nickname + ' 发布了圈子动态');
        UI.toast('已发布，等待平台审核');
        setTimeout(function () { UI.go('#/circle'); }, 700);
      };
      /* 服务端校验优先（会员/顾问门槛 + 分类合法 + 敏感信息打码），不可达时本地规则兜底 */
      apiPost('/post/check', {
        content: content.trim(), cat: window._cclPubCat || 'res', images: imgs.slice(),
        member: !!db.user.member, advisorAdded: !!db.user.advisorAdded
      }, function (res) {
        if (res && res.ok === false) { UI.toast(res.msg || '发布校验未通过'); return; }
        if (res && res.ok) {
          if (res.flags && res.flags.length) UI.toast(res.msg || '已自动隐藏联系方式，对接走平台引荐');
          return publish(res.content);
        }
        var m = cclMask(content.trim());
        if (m.flags.length) UI.toast('已自动隐藏联系方式，对接走平台引荐');
        publish(m.text); /* 纯静态部署/接口不可达：沿用本地打码 */
      });
    },
    cclRefer: function (id) {
      var db = S.get();
      var p = (db.posts || []).filter(function (x) { return x.id === id; })[0] || {};
      var cnt = db.referrals.filter(function (r) { return r.dist === db.user.inviteCode && r.fromPost; }).length;
      if (cnt >= (db.config.referralQuota || 3)) { UI.toast('本月免费引荐额度已用完'); return; }
      db.referrals.unshift({
        id: S.uid('r'), bossId: '', bossName: (p.author && p.author.nickname) || '圈子会员',
        client: '平台引荐（圈子）', phone: db.user.phone, amount: 0, commission: 0,
        dock: 'pending', referred: false, dist: db.user.inviteCode, distName: db.user.nickname,
        demand: '圈子动态引荐 · 客服免费拉群', submitTime: nowStr(), note: '', fromPost: true
      });
      S.save();
      notify('boss', '🤝', '新的圈子引荐申请', db.user.nickname + ' 申请引荐 ' + ((p.author && p.author.nickname) || ''));
      UI.toast('已提交申请，客服将免费拉群对接');
      setTimeout(function () { UI.go('#/circle'); }, 800);
    },

    /* ---------- 视频 ---------- */
    openVideo: function (bid) {
      var db = S.get(), b = db.bosses.filter(function (x) { return x.id === bid; })[0];
      if (!b) return;
      if (b.videoUrl) { UI.toast('正在打开视频号...'); window.open(b.videoUrl, '_blank'); }
      else { UI.go('#/boss/' + bid); }
    }
  };
})();
