/* ============================================================
 * 乐道AI · 复刻系统 —— 老板工作台（H5 内）
 * 对应原站 v-boss-dash 及全部 v-boss-* 子视图：
 *   沙龙管理 / 发布 / 报名记录 / 回收站 / 流水与收入 / 升单管理 /
 *   会员管理 / 手动开通 / 引荐管理 / 老板资源管理 / 商务合作线索 /
 *   分销员管理 / 首页运营位 / 圈子内容管理 / 用户管理 / 首页入口开关 /
 *   管理员权限 / 定向佣金 / 锁粉归因 / 会员落地页
 * 角色门槛：isBoss()（role==='boss' || superadmin）
 * ============================================================ */
(function () {
  'use strict';

  var S = window.Store, UI = window.UI;
  function H() { return window.HUI; }
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function money(n) { return '¥' + (Math.round((+n || 0) * 100) / 100).toLocaleString('zh-CN'); }
  function maskPhone(p) {
    var s = String(p || '');
    if (!s) return '';
    if (s.indexOf('wx_') === 0) return '微信访客·' + s.slice(-3);
    return s.length >= 11 ? s.slice(0, 3) + '****' + s.slice(-4) : s;
  }
  function nowHM() { return new Date().toTimeString().slice(0, 5); }
  function isBoss() { var u = S.get().user; return !!(u && (u.role === 'boss' || u.superadmin)); }

  function body(html) { return '<div class="wb-body">' + html + '</div>'; }
  function shell(o) {
    var html = H().pagebar(o.title, o.back || '#/boss-dash', o.right || '') +
      body(o.body) + (o.tabbar ? H().tabbar(o.tabbar) : '');
    $('phone').innerHTML = html;
    if (o.after) o.after();
  }
  function deny() {
    UI.toast('仅老板可访问');
    UI.go('#/me');
  }
  function cell(n, label, val) {
    return '<div class="bd-cell"><div class="n">' + n + '</div><div class="l">' + label + '</div></div>';
  }
  function chipRow(list, active, fn) {
    return '<div class="chip-row">' + list.map(function (c) {
      return '<span class="chip ' + (active === c[0] ? 'on' : '') + '" onclick="' + fn.replace('%s', c[0]) + '">' + c[1] + '</span>';
    }).join('') + '</div>';
  }
  function emptyBox(big, txt) {
    return '<div class="wb-empty"><div class="e-big">' + big + '</div><div>' + txt + '</div></div>';
  }

  /* ---------- 沙龙状态徽章 ---------- */
  function evTag(s) {
    if (s.deleted) return '<span class="wb-tag" style="background:#f1f2f4;color:#8a8f99">回收站</span>';
    if (!s.published) return '<span class="wb-tag" style="background:#fef3c7;color:#b45309">未发布</span>';
    if (s.status === '已结束') return '<span class="wb-tag" style="background:#f1f2f4;color:#8a8f99">已结束</span>';
    return '<span class="wb-tag" style="background:#e6f5ec;color:#1a7f4b">报名中</span>';
  }
  function paidCount(s) { return (s.joined || 0); }

  var WB = {
    /* ==================== 工作台首页（宫格） ==================== */
    dash: function () {
      if (!isBoss()) return deny();
      var db = S.get();
      var pendingCoop = db.coopLeads.filter(function (l) { return l.status === 'new'; }).length;
      var cmTotal = db.commissions.filter(function (c) { return c.status !== '已退款'; })
        .reduce(function (a, b) { return a + b.amount; }, 0);
      var pendingRef = db.referrals.filter(function (r) { return r.dock === 'pending'; }).length;
      var pendingPost = db.posts.filter(function (p) { return p.status === 'pending'; }).length;
      var grid = [
        ['流', '流水与收入', '报名订单 · 收入统计', '#/boss-finance'],
        ['录', '升单管理', '成交/佣金 · 来源贡献', '#/boss-upsell'],
        ['分', '分销员管理', '申请审核 · 打款确认 · ' + money(cmTotal), '#/boss-dist'],
        ['沙', '沙龙管理', '发布沙龙 · 报名进度 · 导出 CSV', '#/boss-events'],
        ['员', '会员管理', '会员名册 · 定价 · 手动开通', '#/boss-members'],
        ['合', '商务合作', '合作线索台账 · 待跟进 ' + pendingCoop + ' 条', '#/boss-coop'],
        ['广', '首页运营位', '沙龙页顶部广告位 · 上传图 · 配跳转', '#/boss-banners'],
        ['圈', '圈子内容管理', '动态审核 · 编辑 · 引荐台账' + (pendingPost ? ' · 待审 ' + pendingPost : ''), '#/boss-posts'],
        ['荐', '引荐管理', '待确认审核 · 待对接监督' + (pendingRef ? ' · 待对接 ' + pendingRef : ''), '#/boss-refers'],
        ['板', '老板资源管理', '名片增删改 · 挂探访视频 · 关联沙龙', '#/boss-resources'],
        ['员', '用户管理', '用户列表 · 开通分销员角色', '#/boss-staff'],
        ['隐', '首页入口开关', '圈子 / 老板资源 · 对客户显示或隐藏', '#/boss-tabs'],
        ['📝', '会员落地页', '十屏文案 + 模块开关 · 保存即生效', '#/boss-vip-page'],
        ['🔐', '管理员权限', '三类角色 · 各司其职', '#/boss-perms'],
        ['💰', '定向佣金', '佣金规则 · 全平台生效', '#/boss-comm'],
        ['🔒', '锁粉归因设置', '首次点击 · 锁定规则', '#/boss-lock']
      ];
      shell({
        title: '老板工作台',
        back: '#/me',
        body: '<div class="d-block"><div class="vip-list">' + grid.map(function (g) {
          return '<div class="vip-item" onclick="UI.go(\'' + g[3] + '\')">' +
            '<div class="ic">' + g[0] + '</div>' +
            '<div><div class="vt2">' + g[1] + '</div><div class="vs2">' + g[2] + '</div></div>' +
            '<span class="arrow">›</span></div>';
        }).join('') + '</div></div>'
      });
    },

    /* ==================== 沙龙管理 ==================== */
    events: function (tab) {
      if (!isBoss()) return deny();
      var db = S.get();
      var t = tab || 'on';
      var kw = (window._bEvKw || '').trim();
      var all = db.salons;
      var list = all.filter(function (s) {
        if (t === 'bin') return s.deleted;
        if (s.deleted) return false;
        if (t === 'off') return s.status === '已结束';
        if (t === 'prog') return true;
        return s.status !== '已结束';
      }).filter(function (s) {
        return !kw || (s.title + s.date + s.place).indexOf(kw) >= 0;
      });
      var cOn = all.filter(function (s) { return !s.deleted && s.status !== '已结束'; }).length;
      var cOff = all.filter(function (s) { return !s.deleted && s.status === '已结束'; }).length;
      var cBin = all.filter(function (s) { return s.deleted; }).length;

      var head = '<div class="wb-search"><input id="bEvKw" placeholder="🔍 搜索主题 / 日期 / 地点" value="' + esc(kw) + '"></div>' +
        chipRow([['on', '进行中 (' + cOn + ')'], ['off', '已结束 (' + cOff + ')'], ['bin', '♻️ 回收站 (' + cBin + ')'], ['prog', '📊 进度']], t, "Workbench.events('%s')");

      var main;
      if (t === 'prog') {
        main = '<div class="d-block"><div class="wt">📊 沙龙报名进度</div>' +
          '<div class="wb-note">未开始 · 按日期排序 · 只算已支付 · 带名额的快满（≥80%）变橙色</div>' +
          list.map(function (s) {
            var cap = +s.seats || 0, paid = paidCount(s);
            var pct = cap ? Math.min(100, Math.round(paid / cap * 100)) : 0;
            var hot = pct >= 80;
            return '<div style="padding:10px 0;border-bottom:1px dashed var(--line)">' +
              '<div style="font-size:13px;font-weight:600">【' + s.date.slice(5).replace('-', '月') + '日】' + esc(s.title) + '</div>' +
              '<div style="font-size:11px;color:var(--txt2);margin:4px 0 6px">' + paid + '/' + (cap || '∞') + ' 人 · ' + money(paid * (s.price || 0)) + '</div>' +
              '<div style="height:6px;border-radius:3px;background:#eef1f5"><div style="height:6px;border-radius:3px;width:' + pct + '%;background:' + (hot ? '#e8943a' : '#378ADD') + '"></div></div>' +
              '</div>';
          }).join('') + '</div>';
      } else {
        main = (t === 'on' && !kw
          ? '<div class="d-block wb-pubcard" onclick="UI.go(\'#/boss-publish\')"><div class="ic">＋</div>' +
            '<div><div class="vt2">发布新沙龙</div><div class="vs2">AI 生成草稿 · 粘贴备忘录一键填</div></div><span class="arrow">›</span></div>'
          : '') +
          (list.length ? list.map(function (s) { return evCard(s, t); }).join('')
            : emptyBox('🗓', kw ? '没有匹配「' + esc(kw) + '」的沙龙' : (t === 'bin' ? '回收站是空的<br>移到回收站的沙龙会出现在这里' : t === 'off' ? '暂无已结束的沙龙' : '暂无进行中的沙龙')));
      }

      shell({
        title: '已发布沙龙',
        back: '#/boss-dash',
        body: head + main + '<div class="member-tip">报名进度只算已支付订单 · 移入回收站后可随时恢复</div>',
        after: function () {
          var i = $('bEvKw');
          if (i) i.oninput = function () { window._bEvKw = i.value; WB.events(t, true); };
        }
      });
      window._bEvTab = t;
    },

    evTogglePublish: function (id) {
      var db = S.get();
      var s = db.salons.filter(function (x) { return x.id === id; })[0];
      if (!s) return;
      s.published = !s.published;
      s.status = s.published ? '报名中' : '筹备中';
      S.save(); UI.toast(s.published ? '已发布 · 前台沙龙页立即可见' : '已下架'); WB.events(window._bEvTab);
    },
    evDel: function (id) {
      var db = S.get();
      var s = db.salons.filter(function (x) { return x.id === id; })[0];
      if (!s) return;
      if (!window.confirm('确定将「' + s.title + '」移入回收站吗？\n\n移入回收站后可以随时恢复。')) return;
      s.deleted = true; S.save(); UI.toast('已移入回收站'); WB.events(window._bEvTab);
    },
    evRestore: function (id) {
      var db = S.get();
      var s = db.salons.filter(function (x) { return x.id === id; })[0];
      if (!s) return;
      if (!window.confirm('确定恢复「' + s.title + '」吗？\n恢复后前台立即重新上线。')) return;
      s.deleted = false; S.save(); UI.toast('已恢复'); WB.events('bin');
    },
    evPermDel: function (id) {
      var db = S.get();
      var s = db.salons.filter(function (x) { return x.id === id; })[0];
      if (!s) return;
      if (!window.confirm('⚠️ 彻底删除「' + s.title + '」？\n\n此操作不可恢复，确定吗？')) return;
      db.salons = db.salons.filter(function (x) { return x.id !== id; });
      S.save(); UI.toast('已彻底删除'); WB.events('bin');
    },
    evCopy: function (id) {
      var db = S.get();
      var s = db.salons.filter(function (x) { return x.id === id; })[0];
      if (!s) return;
      var c = JSON.parse(JSON.stringify(s));
      c.id = S.uid('s'); c.title = s.title + '（副本）'; c.joined = 0; c.published = false; c.status = '筹备中';
      db.salons.unshift(c); S.save(); UI.toast('已复制为草稿'); WB.events(window._bEvTab);
    },

    /* ==================== 发布 / 编辑沙龙 ==================== */
    publish: function (id) {
      if (!isBoss()) return deny();
      var db = S.get();
      var s = id ? db.salons.filter(function (x) { return x.id === id; })[0] : null;
      var v = s || {
        id: '', title: '', date: S.today(), time: '14:00', city: '深圳', place: '', seats: 60,
        price: 199, mprice: 0, desc: '', sharePoints: [], audience: '', notice: '', videoUrl: '',
        bossIds: [], published: false, status: '筹备中', banner: 'boss', photos: [], joined: 0
      };
      var bosses = db.bosses.filter(function (b) { return b.onShelf; });
      var bodyHtml =
        '<div class="d-block"><div class="wt">活动信息</div>' +
        f('sfTitle', '活动主题 *', v.title, '例：AI出海·跨境资源对接沙龙（第101期）') +
        '<div class="f2"><div>' + lab('日期') + '<input id="sfDate" type="date" class="wb-inp" value="' + v.date + '"></div>' +
        '<div>' + lab('时间') + '<input id="sfTime" type="time" class="wb-inp" value="' + (v.time || '14:00') + '"></div></div>' +
        f('sfPlace', '地点', v.place, '例：龙华区·乐道沙龙基地') +
        '<div class="f2"><div>' + lab('名额（0=不限）') + '<input id="sfSpots" type="number" class="wb-inp" value="' + v.seats + '"></div>' +
        '<div>' + lab('非会员价 ¥') + '<input id="sfPrice" type="number" class="wb-inp" value="' + v.price + '"></div></div>' +
        lab('会员价 ¥（0=会员免费）') + '<input id="sfMprice" type="number" class="wb-inp" value="' + (v.mprice || 0) + '">' +
        '<div class="wb-gap"></div>' +
        f('sfDesc', '沙龙简介', v.desc, '一段话讲清这期沙龙讲什么') +
        f('sfShare', '分享要点（海报展示用，选填）', (v.sharePoints || []).join('\n'), '一行一条') +
        f('sfAudience', '适合人群（选填）', v.audience, '例：做跨境、外贸、AI 应用的老板') +
        f('sfNotice', '报名须知（选填）', v.notice, '一行一条') +
        f('sfVideo', '🎬 沙龙预告视频', v.videoUrl, '粘贴视频号 / 公众号文章链接') +
        '</div>' +
        '<div class="d-block"><div class="wt">📋 关联老板（本场分享人，选填）</div>' +
        bosses.map(function (b) {
          var on = (v.bossIds || []).indexOf(b.id) >= 0;
          return '<span class="chip ' + (on ? 'on' : '') + '" onclick="Workbench.bossToggle(this,\'' + b.id + '\')">' + esc(b.name) + '</span>';
        }).join('') + '</div>' +
        '<div class="d-block"><div class="wt">📋 粘贴备忘录，一键填</div>' +
        '<div class="wb-note">点「复制填写模板」→ 到备忘录粘贴填好 → 全选复制回来粘进上面框 → 点解析。没写到的标签留空即可。</div>' +
        '<textarea id="memoText" class="wb-inp" rows="4" placeholder="把填好的备忘录全选粘贴到这里"></textarea>' +
        '<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">' +
        '<button class="wb-btn ghost" onclick="Workbench.memoTemplate()">📋 复制填写模板</button>' +
        '<button class="wb-btn" onclick="Workbench.memoParse()">⚡ 一键解析填写</button>' +
        '<button class="wb-btn ghost" onclick="document.getElementById(\'memoText\').value=\'\'">清空</button></div></div>' +
        '<button class="wb-btn primary" onclick="Workbench.saveSalon(\'' + (id || '') + '\')">' + (id ? '保存修改' : '发布 · 前台立即可见') + '</button>' +
        '<div class="member-tip">' + (id ? '保存后前台立即更新 · 已有报名不受影响' : '发布后前台沙龙页立即可见 · 报名信息按此表单收集') + '</div>';

      shell({
        title: '沙龙活动发布',
        back: '#/boss-events',
        body: bodyHtml,
        after: function () {
          window._sfBossIds = (v.bossIds || []).slice();
        }
      });
    },
    bossToggle: function (el, id) {
      var arr = window._sfBossIds || (window._sfBossIds = []);
      var i = arr.indexOf(id);
      if (i >= 0) arr.splice(i, 1); else arr.push(id);
      el.classList.toggle('on');
    },
    memoTemplate: function () {
      UI.copy('主题：\n日期：\n时间：\n地点：\n名额：\n非会员价：\n会员价：\n分享要点：\n- \n适合人群：\n报名须知：\n沙龙预告视频：');
      UI.toast('模板已复制，去备忘录填好再粘回来');
    },
    memoParse: function () {
      var raw = ($('memoText') || {}).value || '';
      if (!raw.trim()) { UI.toast('请先粘贴备忘录内容'); return; }
      function pick(names) {
        var lines = raw.split('\n');
        for (var i = 0; i < lines.length; i++) {
          var idx = lines[i].indexOf('：') >= 0 ? lines[i].indexOf('：') : lines[i].indexOf(':');
          if (idx < 0) continue;
          var k = lines[i].slice(0, idx).trim();
          if (names.indexOf(k) >= 0) return lines[i].slice(idx + 1).trim();
        }
        return '';
      }
      var map = [
        ['sfTitle', ['主题', '标题']], ['sfDate', ['日期']], ['sfTime', ['时间']],
        ['sfPlace', ['地点', '地址']], ['sfSpots', ['名额', '人数']],
        ['sfPrice', ['非会员价', '非会员', '票价', '价格']], ['sfMprice', ['会员价']],
        ['sfShare', ['分享要点']], ['sfAudience', ['适合人群']], ['sfNotice', ['报名须知']],
        ['sfVideo', ['沙龙预告视频', '预告视频', '视频']]
      ];
      map.forEach(function (m) {
        var v = pick(m[1]);
        var el = $(m[0]);
        if (v && el) el.value = v;
      });
      UI.toast('已按备忘录填写');
    },
    saveSalon: function (id) {
      var db = S.get();
      var title = ($('sfTitle') || {}).value || '';
      if (!title.trim()) { UI.toast('请填写活动主题'); return; }
      var data = {
        title: title.trim(),
        date: ($('sfDate') || {}).value || S.today(),
        time: ($('sfTime') || {}).value || '14:00',
        place: ($('sfPlace') || {}).value || '',
        seats: +($('sfSpots') || {}).value || 0,
        price: +($('sfPrice') || {}).value || 0,
        mprice: +($('sfMprice') || {}).value || 0,
        desc: ($('sfDesc') || {}).value || '',
        sharePoints: (($('sfShare') || {}).value || '').split('\n').filter(function (x) { return x.trim(); }),
        audience: ($('sfAudience') || {}).value || '',
        notice: ($('sfNotice') || {}).value || '',
        videoUrl: ($('sfVideo') || {}).value || '',
        bossIds: (window._sfBossIds || []).slice()
      };
      if (id) {
        var s = db.salons.filter(function (x) { return x.id === id; })[0];
        if (!s) return;
        Object.keys(data).forEach(function (k) { s[k] = data[k]; });
        S.save(); UI.toast('已保存'); UI.go('#/boss-events');
      } else {
        data.id = S.uid('s'); data.city = '深圳'; data.joined = 0;
        data.status = '报名中'; data.published = true; data.deleted = false;
        data.banner = 'boss'; data.photos = [];
        db.salons.unshift(data);
        S.save(); UI.toast('已发布 · 前台沙龙页立即可见'); UI.go('#/boss-events');
      }
    },

    /* ==================== 报名记录 ==================== */
    attendees: function (evId) {
      if (!isBoss()) return deny();
      var db = S.get();
      var ev = db.salons.filter(function (x) { return x.id === evId; })[0] || { title: '沙龙', seats: 0 };
      var list = db.signups.filter(function (s) { return s.kind !== 'member' && (s.evId === evId || (s.kind === 'refer' && false)); });
      var paid = list.filter(function (s) { return s.paid && !s.refunded; });
      var income = paid.reduce(function (a, b) { return a + (+b.amount || 0); }, 0);
      var bodyHtml =
        '<div class="bd-hero"><div class="h1">' + esc(ev.title) + '</div>' +
        '<div class="bd-grid">' + cell(list.length, '总报名') + cell(money(income), '实收款') + cell(paid.length, '已支付') + cell(ev.seats || '∞', '名额') + '</div></div>' +
        (list.length ? '<div class="d-block">' + list.map(atCard).join('') + '</div>'
          : emptyBox('🎫', '暂无报名'));
      shell({ title: ev.title, back: '#/boss-events', body: bodyHtml });
    },
    refundSignup: function (id) {
      var db = S.get();
      var s = db.signups.filter(function (x) { return x.id === id; })[0];
      if (!s) return;
      if (!window.confirm('确认退款？\n微信支付的订单将原路退回客户微信，对应佣金同步取消。')) return;
      s.refunded = true;
      db.commissions.forEach(function (c) { if (c.signupId === id && c.status !== '已结算') c.status = '已退款'; });
      S.save(); UI.toast('已退款，佣金已取消'); WB.attendees(s.evId);
    },

    /* ==================== 流水与收入 ==================== */
    finance: function () {
      if (!isBoss()) return deny();
      var db = S.get();
      var period = window._finPeriod || 'all';
      var orders = db.signups.filter(function (s) {
        if (!s.paid || s.refunded) return false;
        if (period === 'today') return (s.paidAt || '').slice(0, 10) === S.today();
        return true;
      });
      var gross = orders.reduce(function (a, b) { return a + (+b.amount || 0); }, 0);
      var refunded = db.signups.filter(function (s) { return s.refunded; })
        .reduce(function (a, b) { return a + (+b.amount || 0); }, 0);
      var byKind = function (k) { return orders.filter(function (s) { return s.kind === k; }); };
      var sum = function (arr) { return arr.reduce(function (a, b) { return a + (+b.amount || 0); }, 0); };
      var bodyHtml =
        '<div class="bd-hero-v2"><div class="h-label">已收款（净流水） · ' + (period === 'today' ? '今日' : '全部') + '</div>' +
        '<div class="h-main">' + money(gross) + '</div>' +
        '<div class="h-sub-grid"><div class="h-sub">订单 ' + orders.length + ' 单</div><div class="h-sub bad">已退款 ' + money(refunded) + '</div></div></div>' +
        chipRow([['all', '全部'], ['today', '今日']], period, "Workbench.finPeriod('%s')") +
        '<div class="d-block"><div class="wt">收入来自哪里</div><div class="wb-3">' +
        '<div class="wb-3c" style="background:#e6f1fb"><div class="n">' + money(sum(byKind('member'))) + '</div><div class="l">会员开通</div></div>' +
        '<div class="wb-3c" style="background:#e1f5ee"><div class="n">' + money(sum(byKind('salon'))) + '</div><div class="l">沙龙报名</div></div>' +
        '<div class="wb-3c" style="background:#faeeda"><div class="n">' + money(sum(byKind('refer'))) + '</div><div class="l">引荐升单</div></div>' +
        '</div></div>' +
        '<div class="d-block"><div class="wt">订单明细（' + orders.length + '）</div>' +
        (orders.length ? orders.map(function (s) {
          var k = s.kind === 'member' ? '👑' : s.kind === 'refer' ? '🤝' : '🎫';
          return '<div class="wb-rev"><div class="ri">' + k + '</div>' +
            '<div class="rt"><div class="rs">' + esc(s.title) + ' · ' + esc(s.name || '') + '</div>' +
            '<div class="elapsed">' + esc(s.paidAt || '') + ' · ' + maskPhone(s.phone) + (s.distName ? ' · 归属 ' + esc(s.distName) : '') + '</div></div>' +
            '<div class="ra">' + money(s.amount) + '</div></div>';
        }).join('') : emptyBox('💰', '暂无订单')) + '</div>' +
        '<div class="member-tip">会员开通订单计入分销员佣金 · 沙龙订单支付后结算 · 顶部数字均为全量口径</div>';
      shell({
        title: '流水与收入', back: '#/boss-dash', body: bodyHtml,
        after: function () { window._finPeriod = period; }
      });
    },
    finPeriod: function (p) { window._finPeriod = p; WB.finance(); },

    /* ==================== 升单管理 ==================== */
    upsell: function () {
      if (!isBoss()) return deny();
      var db = S.get();
      var list = db.upsells;
      var total = list.filter(function (u) { return !u.refunded; }).reduce(function (a, b) { return a + (+b.amount || 0); }, 0);
      var cm = list.filter(function (u) { return !u.refunded; }).reduce(function (a, b) { return a + (+b.commission || 0); }, 0);
      var bodyHtml =
        '<div class="bd-hero-v2"><div class="h-label">总升单成交 · 全量口径</div>' +
        '<div class="h-main">' + money(total) + '</div>' +
        '<div class="h-sub-grid"><div class="h-sub">佣金 ' + money(cm) + '</div><div class="h-sub">记录 ' + list.length + ' 条</div></div></div>' +
        '<div class="d-block"><div class="wt">🏆 升单记录</div>' +
        (list.length ? list.map(function (u) {
          return '<div class="wb-rev"><div class="ri">📈</div>' +
            '<div class="rt"><div class="rs">' + esc(u.customer) + ' · ' + esc(u.product) + '</div>' +
            '<div class="elapsed">' + esc(u.date) + ' · ' + (u.mode === 'rate' ? '比例 ' + u.rate + '%' : '固定佣金') + ' · 归属 ' + esc(u.distName) + (u.refunded ? ' · 已冲正' : '') + '</div></div>' +
            '<div class="ra">' + money(u.amount) + '<div style="font-size:10px;color:var(--green)">佣金 ' + money(u.commission) + '</div></div></div>';
        }).join('') : emptyBox('📈', '暂无升单记录 · 点「＋ 登记升单」开始第一笔')) + '</div>' +
        '<div class="member-tip">升单 = 老客户从沙龙/引荐后续购买的二次成交 · 佣金自动按比例入分销员账户</div>';
      shell({
        title: '升单管理', back: '#/boss-dash', body: bodyHtml,
        right: '<span class="wb-right" onclick="Workbench.upsellAdd()">＋ 登记</span>'
      });
    },
    upsellAdd: function () {
      var db = S.get();
      var name = window.prompt('客户姓名');
      if (!name) return;
      var product = window.prompt('成交产品', '深度流量合作');
      if (!product) return;
      var amount = +(window.prompt('成交总额 ¥', '16800') || 0);
      var rate = +(window.prompt('佣金比例 %', String(db.config.memberCommissionRate)) || 0);
      db.upsells.unshift({
        id: S.uid('up'), customer: name.trim(), phone: '', product: product.trim(),
        amount: amount, commission: Math.round(amount * rate) / 100, rate: rate, mode: 'rate',
        source: 'lock', dist: db.user.inviteCode, distName: db.user.nickname, date: S.today(), note: '后台登记', refunded: false
      });
      S.save(); UI.toast('已登记升单 · 佣金入账'); WB.upsell();
    },

    /* ==================== 会员管理 ==================== */
    members: function () {
      if (!isBoss()) return deny();
      var db = S.get(), c = db.config;
      var list = db.members;
      var active = list.filter(function (m) { return m.status === 'active'; }).length;
      var expired = list.filter(function (m) { return m.status === 'expired'; }).length;
      var income = list.reduce(function (a, b) { return a + (+b.paidTotal || 0); }, 0);
      var bodyHtml =
        '<div class="d-block" style="border:1.5px solid var(--gold)"><div class="wt">会员定价 <span class="wb-badge">一口价单档</span></div>' +
        '<div class="f2"><div>' + lab('会员价（元）') + '<input id="bmemPrice" type="number" class="wb-inp" value="' + c.memberPrice + '"></div>' +
        '<div>' + lab('时长（天）') + '<input id="bmemDays" type="number" class="wb-inp" value="' + c.memberDays + '"></div></div>' +
        '<div class="wb-note">改价只影响之后新开的单；已支付订单金额不变。</div>' +
        '<button class="wb-btn" onclick="Workbench.saveVipPrice()">保存定价</button></div>' +
        '<div class="d-block wb-pubcard" onclick="UI.go(\'#/boss-vip-page\')"><div class="ic">📝</div>' +
        '<div><div class="vt2">会员落地页内容</div><div class="vs2">十屏文案 + 模块开关 · 保存即生效，不用发版</div></div><span class="arrow">›</span></div>' +
        '<div class="d-block"><div class="wb-3">' +
        '<div class="wb-3c"><div class="n">' + active + '</div><div class="l">有效会员</div></div>' +
        '<div class="wb-3c"><div class="n">' + expired + '</div><div class="l">已过期</div></div>' +
        '<div class="wb-3c"><div class="n">' + money(income) + '</div><div class="l">累计会员收入</div></div>' +
        '</div></div>' +
        '<div class="d-block"><div class="wt">会员名册（' + list.length + '）</div>' +
        (list.length ? list.map(function (m) {
          var chip = m.status === 'active' ? '<span class="wb-tag" style="background:#e6f5ec;color:#1a7f4b">有效</span>'
            : '<span class="wb-tag" style="background:#f1f2f4;color:#8a8f99">已过期</span>';
          return '<div class="wb-card"><div class="wc-top">' + esc(m.nickname) + ' ' + chip + '</div>' +
            '<div class="wc-sub">' + maskPhone(m.phone) + (m.company ? ' · ' + esc(m.company) : '') + (m.industry ? ' · ' + esc(m.industry) : '') + '</div>' +
            '<div class="wc-sub">到期 <b>' + esc(m.expire) + '</b> · 实付 ' + money(m.paidTotal) + ' · 归属 ' + esc(m.distName || '无') + '</div></div>';
        }).join('') : emptyBox('👑', '还没有会员<br>用户在「我的」页开通会员，或用「＋ 开通」手动开')) + '</div>';
      shell({
        title: '会员管理', back: '#/boss-dash', body: bodyHtml,
        right: '<span class="wb-right" onclick="Workbench.grant()">＋ 开通</span>'
      });
    },
    saveVipPrice: function () {
      var db = S.get();
      db.config.memberPrice = +($('bmemPrice') || {}).value || 1980;
      db.config.memberDays = +($('bmemDays') || {}).value || 365;
      S.save(); UI.toast('定价已保存'); WB.members();
    },
    grant: function () {
      var db = S.get(), c = db.config;
      var kw = window.prompt('输一个字也行，如 微信昵称 或 手机号');
      if (kw === null) return;
      kw = (kw || '').trim();
      var days = +(window.prompt('开通时长（天）', String(c.memberDays)) || c.memberDays);
      var amount = +(window.prompt('线下实收多少钱（元，留空或 0 = 纯赠送）', '0') || 0);
      db.members.unshift({
        phone: /^1\d{10}$/.test(kw) ? kw : '138' + String(Date.now()).slice(-8),
        nickname: kw || '手动开通用户', realName: kw || '', company: '', industry: '',
        expire: new Date(Date.now() + days * 86400000).toISOString().slice(0, 10),
        status: 'active', paidTotal: amount, orderCount: 1,
        distName: '', wxBound: false, signAt: S.today() + ' ' + nowHM()
      });
      S.save(); UI.toast('已开通，到期 ' + db.members[0].expire); WB.members();
    },

    /* ==================== 引荐管理 ==================== */
    refers: function (tab) {
      if (!isBoss()) return deny();
      var db = S.get();
      var t = tab || 'pending';
      var all = db.referrals;
      var cnt = {
        pending: all.filter(function (r) { return r.dock === 'pending' && !r.referred; }).length,
        done: all.filter(function (r) { return r.dock === 'done'; }).length,
        submit: all.filter(function (r) { return r.dock === 'submitted'; }).length
      };
      var list = all.filter(function (r) {
        if (t === 'pending') return r.dock === 'pending';
        if (t === 'submit') return r.dock === 'submitted';
        if (t === 'done') return r.dock === 'done';
        return true;
      });
      var bodyHtml =
        '<div class="bd-hero"><div class="h1">🤝 引荐管理</div>' +
        '<div class="wb-note" style="color:rgba(255,255,255,.85)">待对接 ' + cnt.pending + ' 单 · 待确认 ' + cnt.submit + ' 单 · 已完成 ' + cnt.done + ' 单</div></div>' +
        chipRow([['pending', '待对接 (' + cnt.pending + ')'], ['submit', '待确认 (' + cnt.submit + ')'], ['done', '已完成 (' + cnt.done + ')'], ['all', '全部 (' + all.length + ')']], t, "Workbench.refers('%s')") +
        '<div class="d-block">' + (list.length ? list.map(function (r) {
          var st = r.dock === 'done' ? '<span class="wb-tag" style="background:#e6f5ec;color:#1a7f4b">✓ 已完成</span>'
            : r.dock === 'submitted' ? '<span class="wb-tag" style="background:#fef3c7;color:#b45309">待确认</span>'
              : '<span class="wb-tag" style="background:#e8f4ff;color:#1a5f9f">待对接</span>';
          return '<div class="wb-card"><div class="wc-top">🤝 ' + esc(r.bossName) + ' ' + st + '</div>' +
            '<div class="wc-sub">客户：' + esc(r.client) + ' · ' + maskPhone(r.phone) + ' · ' + money(r.amount) + '</div>' +
            '<div class="wc-sub">💬 诉求：' + esc(r.demand || '—') + '</div>' +
            '<div class="wc-sub">归属分销员：' + esc(r.distName || '无') + ' · 提交 ' + esc(r.submitTime || '') + '</div>' +
            (r.dock !== 'done'
              ? '<div class="wb-btns"><button class="wb-btn primary" onclick="Workbench.refConfirm(\'' + r.id + '\')">✓ 确认对接完成 · 佣金生效</button>' +
                '<button class="wb-btn ghost" onclick="Workbench.refReject(\'' + r.id + '\')">↩ 驳回</button></div>'
              : '') +
            '</div>';
        }).join('') : emptyBox('🤝', '暂无待处理的引荐')) + '</div>' +
        '<div class="member-tip">分销员 24 小时内提交对接（超时自动退款并取消佣金）· 提交后由公司确认，确认后佣金生效</div>';
      shell({ title: '引荐管理', back: '#/boss-dash', body: bodyHtml });
    },
    refConfirm: function (id) {
      var db = S.get();
      var r = db.referrals.filter(function (x) { return x.id === id; })[0];
      if (!r) return;
      r.dock = 'done'; r.referred = true;
      var cm = db.commissions.filter(function (c) { return c.signupId === r.signupId; })[0];
      if (!cm) {
        db.commissions.unshift({
          id: S.uid('cm'), signupId: r.signupId, kind: 'refer', title: '老板引荐 · ' + r.bossName,
          name: r.client, amount: r.commission, rate: db.config.memberCommissionRate,
          dist: r.dist, distName: r.distName, status: '待结算', time: S.today() + ' ' + nowHM()
        });
      } else { cm.status = '待结算'; }
      S.save(); UI.toast('已确认对接 · 佣金已生效'); WB.refers();
    },
    refReject: function (id) {
      var reason = window.prompt('驳回原因（打回分销员重新对接）', '凭证不清晰，请重新提交');
      if (reason === null) return;
      var db = S.get();
      var r = db.referrals.filter(function (x) { return x.id === id; })[0];
      if (!r) return;
      r.dock = 'pending'; r.rejectReason = reason;
      S.save(); UI.toast('已驳回，倒计时不重置'); WB.refers();
    },

    /* ==================== 老板资源管理 ==================== */
    resources: function () {
      if (!isBoss()) return deny();
      var db = S.get();
      var bodyHtml =
        '<div class="bd-hero"><div class="h1">🤝 老板资源管理</div>' +
        '<div class="wb-note" style="color:rgba(255,255,255,.85)">挂视频号探访老板 · 客户付费引荐对接</div></div>' +
        '<div class="d-block"><div class="wt">全部名片（' + db.bosses.length + '）</div>' +
        db.bosses.map(function (b) {
          return '<div class="wb-card"><div class="wc-top">' + esc(b.name) + ' ' +
            (b.onShelf ? '<span class="wb-tag" style="background:#e6f5ec;color:#1a7f4b">上架中</span>' : '<span class="wb-tag" style="background:#f1f2f4;color:#8a8f99">已下架</span>') + '</div>' +
            '<div class="wc-sub">' + esc(b.title) + ' · ' + esc(b.tag) + '</div>' +
            '<div class="wc-chips"><span class="wb-mini">引荐 ' + (b.matched || 0) + ' 单</span>' +
            '<span class="wb-mini">⚡ 名额 ' + (b.quotaLeft == null ? '—' : b.quotaLeft) + '/' + (b.quota || '—') + '</span>' +
            (b.videoUrl ? '<span class="wb-mini">🎬 已挂视频</span>' : '') +
            (b.cover ? '<span class="wb-mini">🖼 封面</span>' : '') + '</div>' +
            '<div class="wb-btns"><button class="wb-btn ghost" onclick="UI.go(\'#/boss/' + b.id + '\')">✏️ 编辑名片</button>' +
            '<button class="wb-btn ghost" onclick="Workbench.bossShelf(\'' + b.id + '\')">' + (b.onShelf ? '⏸ 下架' : '▶️ 上架') + '</button>' +
            '<button class="wb-btn ghost danger" onclick="Workbench.bossDel(\'' + b.id + '\')">🗑 删除</button></div></div>';
        }).join('') + '</div>' +
        '<div class="member-tip">引荐规则：非会员按定价付费 · 会员免费 · 24 小时内未提交对接自动原路退款</div>';
      shell({ title: '老板资源管理', back: '#/boss-dash', body: bodyHtml });
    },
    bossShelf: function (id) {
      var db = S.get();
      var b = db.bosses.filter(function (x) { return x.id === id; })[0];
      if (!b) return;
      b.onShelf = !b.onShelf; S.save(); UI.toast(b.onShelf ? '已上架' : '已下架'); WB.resources();
    },
    bossDel: function (id) {
      var db = S.get();
      var b = db.bosses.filter(function (x) { return x.id === id; })[0];
      if (!b) return;
      if (!window.confirm('确定删除「' + b.name + '」的名片吗？')) return;
      db.bosses = db.bosses.filter(function (x) { return x.id !== id; });
      S.save(); UI.toast('已删除'); WB.resources();
    },

    /* ==================== 商务合作线索 ==================== */
    coop: function (st) {
      if (!isBoss()) return deny();
      var db = S.get();
      var META = {
        all: '全部', new: '🆕 待跟进', wechat: '💬 已加微信', talking: '🤝 洽谈中',
        deal: '✅ 已合作', no: '⛔ 不适合'
      };
      var t = st || 'all';
      var all = db.coopLeads;
      var list = t === 'all' ? all : all.filter(function (l) { return l.status === t; });
      var pending = all.filter(function (l) { return l.status === 'new'; }).length;
      var deal = all.filter(function (l) { return l.status === 'deal'; }).length;
      var cm = all.reduce(function (a, b) { return a + (+b.commission || 0); }, 0);
      var chips = Object.keys(META).map(function (k) {
        return [k, META[k] + (k !== 'all' ? ' ' + all.filter(function (l) { return l.status === k; }).length : ' ' + all.length)];
      });
      var bodyHtml =
        '<div class="bd-hero"><div class="h1">🤝 商务合作</div>' +
        '<div class="wb-note" style="color:rgba(255,255,255,.85)">共 ' + all.length + ' 条线索 · 待跟进 ' + pending + ' · 已合作 ' + deal + (cm ? ' · 已分佣 ' + money(cm) : '') + '</div></div>' +
        chipRow(chips, t, "Workbench.coop('%s')") +
        '<div class="d-block">' + (list.length ? list.map(function (l) {
          return '<div class="wb-card"><div class="wc-top">' + esc(l.name) + ' <span class="wb-tag" style="background:#eef1ff;color:#3a4a9f">' + (META[l.status] || l.status) + '</span></div>' +
            '<div class="wc-sub">' + esc(l.biz) + '</div>' +
            '<div class="wc-sub">想怎么合作：' + esc(l.want) + '</div>' +
            '<div class="wc-sub">' + maskPhone(l.phone) + ' · ' + (l.wechat ? '微信 ' + esc(l.wechat) : '未填微信') + ' · ' + esc(l.time) + '</div>' +
            '<div class="wc-sub">归属分销员：' + esc(l.distName || '无') + '</div>' +
            '<div class="wb-btns">' +
            ['wechat', 'talking', 'deal', 'no'].map(function (k) {
              return '<button class="wb-btn ghost" onclick="Workbench.coopSet(\'' + l.id + '\',\'' + k + '\')">' + META[k] + '</button>';
            }).join('') + '</div></div>';
        }).join('') : emptyBox('🤝', t === 'all' ? '还没有合作申请' : '这个状态下暂时没有线索')) + '</div>';
      shell({ title: '合作线索', back: '#/boss-dash', body: bodyHtml });
    },
    coopSet: function (id, st) {
      var db = S.get();
      var l = db.coopLeads.filter(function (x) { return x.id === id; })[0];
      if (!l) return;
      l.status = st;
      S.save(); UI.toast('已更新为「' + st + '」'); WB.coop();
    },

    /* ==================== 分销员管理 ==================== */
    dist: function (tab) {
      if (!isBoss()) return deny();
      var db = S.get(), c = db.config;
      var t = tab || 'team';
      var team = db.distTeam;
      var totals = {
        pending: team.reduce(function (a, b) { return a + (+b.pendingTotal || 0); }, 0),
        settling: team.reduce(function (a, b) { return a + (+b.settlingTotal || 0); }, 0),
        settled: team.reduce(function (a, b) { return a + (+b.settledTotal || 0); }, 0)
      };
      var bodyHtml =
        '<div class="distro-hero"><div class="h1">分销员管理</div><div class="h2">申请审核 · 比例设置 · 打款确认</div>' +
        '<div class="dist-stats">' +
        '<div class="ds"><div class="v o">' + money(totals.pending) + '</div><div class="k">待结算</div></div>' +
        '<div class="ds"><div class="v b">' + money(totals.settling) + '</div><div class="k">结算中(待打款)</div></div>' +
        '<div class="ds"><div class="v g">' + money(totals.settled) + '</div><div class="k">已结算</div></div>' +
        '</div></div>' +
        chipRow([['team', '👥 团队 (' + team.length + ')'], ['apply', '📋 申请 (' + db.distApplyList.length + ')'], ['notice', '📢 公告']], t, "Workbench.dist('%s')") +
        (t === 'team' ? team.map(function (m) {
          var qr = m.wxQrStatus === 'approved' ? '<span class="wb-mini">✓ 码已过</span>'
            : m.wxQrStatus === 'pending' ? '<span class="wb-mini">⏳ 码待审</span>' : '<span class="wb-mini">未传码</span>';
          return '<div class="d-block"><div class="wb-card" style="box-shadow:none;padding:0">' +
            '<div class="wc-top">' + esc(m.name) + (m.role === 'boss' ? ' <span class="wb-mini">老板 · 亲自分销</span>' : '') + ' ' + qr + '</div>' +
            '<div class="wc-sub">' + maskPhone(m.phone) + ' · 锁客 ' + m.lockedCount + ' · 已成交 ' + m.dealCount + ' 单 · 沙龙 ' + m.rates.salon + '% / 会员 ' + m.rates.member + '%</div>' +
            '<div class="wc-sub">📊 总成交 ' + money(m.totalPaid) + ' · 待结算 ' + money(m.pendingTotal) + ' · 已结算 ' + money(m.settledTotal) + '</div>' +
            '<div class="wb-btns">' +
            (m.settlingTotal > 0 ? '<button class="wb-btn primary" onclick="Workbench.distPay(\'' + m.phone + '\')">✓ 确认已打款 ' + money(m.settlingTotal) + '</button>' : '') +
            (m.wxQrStatus === 'pending' ? '<button class="wb-btn ghost" onclick="Workbench.wxqrReview(\'' + m.phone + '\',\'approved\')">✓ 通过企微码</button>' +
              '<button class="wb-btn ghost" onclick="Workbench.wxqrReview(\'' + m.phone + '\',\'rejected\')">✕ 驳回</button>' : '') +
            '<button class="wb-btn ghost danger" onclick="Workbench.distRevoke(\'' + m.phone + '\')">⚠ 取消分销资格</button>' +
            '</div></div></div>';
        }).join('') : '') +
        (t === 'apply' ? (db.distApplyList.length ? db.distApplyList.map(function (a) {
          return '<div class="d-block"><div class="wb-card" style="box-shadow:none;padding:0">' +
            '<div class="wc-top">' + esc(a.name) + ' · ' + maskPhone(a.phone) + '</div>' +
            '<div class="wc-sub">' + esc(a.reason || '') + '</div>' +
            '<div class="wb-btns"><button class="wb-btn primary" onclick="Workbench.applyReview(\'' + a.id + '\',1)">✓ 通过</button>' +
            '<button class="wb-btn ghost" onclick="Workbench.applyReview(\'' + a.id + '\',0)">✕ 驳回</button></div></div></div>';
        }).join('') : emptyBox('📋', '暂无待审核的分销申请')) : '') +
        (t === 'notice' ? noticeAdmin() : '') +
        '<div class="member-tip">调整比例后对方重新登录生效 · 提现按「确认已打款」结算</div>';
      shell({
        title: '分销员管理', back: '#/boss-dash', body: bodyHtml,
        right: '<span class="wb-right" onclick="Workbench.distSettings()">⚙️</span>'
      });
    },
    distPay: function (phone) {
      var db = S.get();
      var m = db.distTeam.filter(function (x) { return x.phone === phone; })[0];
      if (!m) return;
      if (!window.confirm('确认已向「' + m.name + '」打款 ' + money(m.settlingTotal) + ' 吗？')) return;
      m.settledTotal += m.settlingTotal; m.settlingTotal = 0;
      db.commissions.forEach(function (c) { if (c.dist === phone && c.status === '结算中') c.status = '已结算'; });
      S.save(); UI.toast('已确认打款'); WB.dist('team');
    },
    wxqrReview: function (phone, action) {
      var db = S.get();
      var m = db.distTeam.filter(function (x) { return x.phone === phone; })[0];
      if (!m) return;
      m.wxQrStatus = action;
      S.save(); UI.toast(action === 'approved' ? '企微码已通过' : '企微码已驳回'); WB.dist('team');
    },
    distRevoke: function (phone) {
      var db = S.get();
      var m = db.distTeam.filter(function (x) { return x.phone === phone; })[0];
      if (!m) return;
      if (!window.confirm('取消「' + m.name + '」的分销员资格？已产生的佣金记录保留。')) return;
      db.distTeam = db.distTeam.filter(function (x) { return x.phone !== phone; });
      S.save(); UI.toast('已取消分销资格'); WB.dist('team');
    },
    applyReview: function (id, pass) {
      var db = S.get();
      var a = db.distApplyList.filter(function (x) { return x.id === id; })[0];
      if (!a) return;
      if (pass) {
        db.distTeam.push({
          phone: a.phone, name: a.name, nickname: a.name, role: 'distributor',
          rates: { member: db.config.memberCommissionRate, salon: db.config.salonCommissionRate },
          custCount: 0, lockedCount: 0, dealCount: 0, totalPaid: 0, pendingTotal: 0, settlingTotal: 0,
          settledTotal: 0, wxQrStatus: '', lockDays: db.config.lockDays, reLockable: false, rawView: false
        });
      }
      db.distApplyList = db.distApplyList.filter(function (x) { return x.id !== id; });
      S.save(); UI.toast(pass ? '已通过，对方重新登录生效' : '已驳回'); WB.dist('apply');
    },
    distSettings: function () {
      var db = S.get(), c = db.config;
      var r = window.prompt('会员佣金比例 %', String(c.memberCommissionRate));
      if (r === null) return;
      var s = window.prompt('沙龙佣金比例 %', String(c.salonCommissionRate));
      if (s === null) return;
      var l = window.prompt('锁粉有效期（天，0=永久）', String(c.lockDays));
      if (l === null) return;
      c.memberCommissionRate = +r || c.memberCommissionRate;
      c.salonCommissionRate = +s || c.salonCommissionRate;
      c.lockDays = +l || 0;
      S.save(); UI.toast('分销设置已保存'); WB.dist('team');
    },

    /* ==================== 首页运营位 ==================== */
    banners: function () {
      if (!isBoss()) return deny();
      var db = S.get();
      var bodyHtml =
        '<div class="d-block"><div class="wt">首页运营位</div>' +
        '<div class="wb-note">显示在「沙龙活动」首页最顶部 · 手动横滑（不自动轮播）<br>图片推荐 1200×500 横图，前台按 2.4:1 自动裁切<br>建议最多 3 张 · 最要紧的放最上面 · 改完立即生效</div></div>' +
        '<div class="d-block">' + (db.banners.length ? db.banners.map(function (b) {
          return '<div class="wb-card"><div class="wc-top">' + esc(b.title || '（无标题 · 纯图展示）') + ' ' +
            (b.on ? '<span class="wb-tag" style="background:#e6f5ec;color:#1a7f4b">上架中</span>' : '<span class="wb-tag" style="background:#f1f2f4;color:#8a8f99">已下架</span>') + '</div>' +
            '<div class="wc-sub">' + esc(b.sub || '') + ' · 🔗 ' + linkLabel(b.linkType) + '</div>' +
            '<div class="wb-btns"><button class="wb-btn ghost" onclick="Workbench.bnForm(\'' + b.id + '\')">✏️ 编辑</button>' +
            '<button class="wb-btn ghost" onclick="Workbench.bnMove(\'' + b.id + '\',-1)">↑ 上移</button>' +
            '<button class="wb-btn ghost" onclick="Workbench.bnMove(\'' + b.id + '\',1)">↓ 下移</button>' +
            '<button class="wb-btn ghost" onclick="Workbench.bnToggle(\'' + b.id + '\')">' + (b.on ? '⏸ 下架' : '▶️ 上架') + '</button>' +
            '<button class="wb-btn ghost danger" onclick="Workbench.bnDel(\'' + b.id + '\')">🗑 删除</button></div></div>';
        }).join('') : emptyBox('🖼', '还没有运营位<br>点右上角「＋ 新增」上传第一张广告图')) + '</div>';
      shell({
        title: '首页运营位', back: '#/boss-dash', body: bodyHtml,
        right: '<span class="wb-right" onclick="Workbench.bnForm()">＋ 新增</span>'
      });
    },
    bnForm: function (id) {
      if (!isBoss()) return deny();
      var db = S.get();
      var b = db.banners.filter(function (x) { return x.id === id; })[0] || { title: '', sub: '', linkType: 'vip', linkValue: '', on: true, img: '' };
      window.__bnImg = b.img || '';
      var LT = [['vip', '会员页'], ['bosses', '老板资源'], ['salon', '指定沙龙（填活动ID）'], ['url', '外部链接（填完整URL）'], ['none', '不跳转']];
      var bodyHtml =
        '<div class="d-block"><div class="wt">' + (id ? '编辑运营位' : '新增运营位') + '</div>' +
        '<div class="wb-note">图片建议 1200×500 横图，前台按 2.4:1 自动裁切；标题副标题选填，纯图也可</div></div>' +
        '<div class="d-block">' +
        '<div class="wb-field"><div class="wb-lab">封面图</div>' +
        '<div id="bnPrev" style="height:110px;border-radius:12px;background:#f2f3f5 center/cover no-repeat;' + (b.img ? 'background-image:url(' + b.img + ');' : '') + '"></div>' +
        '<button class="wb-btn" style="margin-top:8px" onclick="Workbench.bnPick()">📷 上传 / 更换图片</button></div>' +
        '<div class="wb-field"><div class="wb-lab">主标题（选填 · 最多 20 字）</div><input class="wb-inp" id="bnT" maxlength="20" value="' + esc(b.title) + '"></div>' +
        '<div class="wb-field"><div class="wb-lab">副标题（选填 · 最多 24 字）</div><input class="wb-inp" id="bnS" maxlength="24" value="' + esc(b.sub) + '"></div>' +
        '<div class="wb-field"><div class="wb-lab">点击跳转</div><select class="wb-inp" id="bnLT">' +
        LT.map(function (x) { return '<option value="' + x[0] + '"' + (b.linkType === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="wb-field"><div class="wb-lab">跳转值（选沙龙填活动ID · 选链接填完整URL）</div><input class="wb-inp" id="bnLV" value="' + esc(b.linkValue || '') + '"></div>' +
        '<div class="wb-field"><div class="wb-lab">状态</div><select class="wb-inp" id="bnOn">' +
        '<option value="1"' + (b.on ? ' selected' : '') + '>上架</option>' +
        '<option value="0"' + (!b.on ? ' selected' : '') + '>下架</option></select></div>' +
        '<button class="wb-btn" style="width:100%;margin-top:10px" onclick="Workbench.bnSave(\'' + (id || '') + '\')">保存</button></div>';
      shell({ title: id ? '编辑运营位' : '新增运营位', back: '#/boss-banners', body: bodyHtml });
    },
    bnPick: function () {
      if (!window.ImgUp) { UI.toast('上传组件未加载'); return; }
      ImgUp.pick({ ratio: 2.4, max: 900, quality: .82 }, function (urls) {
        var u = urls && urls[0];
        if (!u) return;
        window.__bnImg = u;
        var el = document.getElementById('bnPrev');
        if (el) { el.style.backgroundImage = 'url(' + u + ')'; }
        UI.toast('图片已就绪，点「保存」生效');
      });
    },
    bnSave: function (id) {
      if (!isBoss()) return deny();
      var db = S.get();
      var data = {
        title: document.getElementById('bnT').value.trim(),
        sub: document.getElementById('bnS').value.trim(),
        linkType: document.getElementById('bnLT').value,
        linkValue: document.getElementById('bnLV').value.trim(),
        on: document.getElementById('bnOn').value === '1',
        img: window.__bnImg || 'img/logo.png'
      };
      if (id) {
        var b = db.banners.filter(function (x) { return x.id === id; })[0];
        Object.assign(b, data);
      } else {
        data.id = S.uid('bn');
        data.sort = db.banners.length + 1;
        db.banners.push(data);
      }
      S.save(); UI.toast('已保存，前台立即生效'); WB.banners();
    },
    bnToggle: function (id) {
      var db = S.get();
      var b = db.banners.filter(function (x) { return x.id === id; })[0];
      b.on = !b.on; S.save(); UI.toast(b.on ? '已上架' : '已下架'); WB.banners();
    },
    bnMove: function (id, dir) {
      var db = S.get();
      var i = db.banners.findIndex(function (x) { return x.id === id; });
      var j = i + dir;
      if (j < 0 || j >= db.banners.length) return;
      var tmp = db.banners[i]; db.banners[i] = db.banners[j]; db.banners[j] = tmp;
      S.save(); WB.banners();
    },
    bnDel: function (id) {
      var db = S.get();
      if (!window.confirm('确定删除这个运营位吗？')) return;
      db.banners = db.banners.filter(function (x) { return x.id !== id; });
      S.save(); UI.toast('已删除'); WB.banners();
    },

    /* ==================== 圈子内容管理 ==================== */
    posts: function (tab, st) {
      if (!isBoss()) return deny();
      var db = S.get();
      var t = tab || 'post';
      var ST = { pending: '待审核', on: '已发布', off: '已下架', rejected: '已驳回' };
      var bodyHtml;
      if (t === 'post') {
        var s = st || 'all';
        var list = s === 'all' ? db.posts : db.posts.filter(function (p) { return (p.status || 'on') === s; });
        var cnt = function (k) { return db.posts.filter(function (p) { return (p.status || 'on') === k; }).length; };
        bodyHtml = chipRow([['post', '动态管理 · ' + db.posts.length], ['ref', '引荐请求 · ' + db.referrals.length]], 'post', "Workbench.posts('%s')") +
          chipRow([['all', '全部 ' + db.posts.length], ['pending', '待审 ' + cnt('pending')], ['on', '已发布 ' + cnt('on')], ['off', '已下架 ' + cnt('off')], ['rejected', '已驳回 ' + cnt('rejected')]], s, "Workbench.posts('post','%s')") +
          '<div class="d-block">' + (list.length ? list.map(function (p) {
            return '<div class="wb-card"><div class="wc-top">' + esc(p.author.name || p.author.nickname) + ' · ' + esc(p.author.company || '') + ' ' +
              '<span class="wb-tag" style="background:#fef3c7;color:#b45309">' + (ST[p.status || 'on']) + '</span></div>' +
              '<div class="wc-sub">' + esc(p.content).slice(0, 78) + '…</div>' +
              '<div class="wc-sub">' + esc(p.createdAt) + (p.pinned ? ' · 📌 置顶' : '') + '</div>' +
              '<div class="wb-btns">' +
              ((p.status === 'pending' || p.status === 'rejected') ? '<button class="wb-btn primary" onclick="Workbench.postSet(\'' + p.id + '\',\'on\')">✅ 通过发布</button>' : '') +
              (p.status === 'pending' ? '<button class="wb-btn ghost" onclick="Workbench.postReject(\'' + p.id + '\')">✕ 驳回</button>' : '') +
              ((p.status || 'on') === 'on' ? '<button class="wb-btn ghost" onclick="Workbench.postSet(\'' + p.id + '\',\'off\')">⏸ 下架</button>' +
                '<button class="wb-btn ghost" onclick="Workbench.postPin(\'' + p.id + '\')">' + (p.pinned ? '取消置顶' : '📌 置顶') + '</button>' : '') +
              (p.status === 'off' ? '<button class="wb-btn ghost" onclick="Workbench.postSet(\'' + p.id + '\',\'on\')">▶️ 恢复发布</button>' : '') +
              '<button class="wb-btn ghost danger" onclick="Workbench.postDel(\'' + p.id + '\')">🗑 删除</button>' +
              '</div></div>';
          }).join('') : emptyBox('📭', s === 'pending' ? '没有待审动态' : '没有符合条件的动态')) + '</div>' +
          '<div class="member-tip">驳回原因会显示给发布人 · 删除后不可恢复，配图会一并清理</div>';
      } else {
        bodyHtml = chipRow([['post', '动态管理 · ' + db.posts.length], ['ref', '引荐请求 · ' + db.referrals.length]], 'ref', "Workbench.posts('%s')") +
          '<div class="d-block"><div class="wt">🎫 免费引荐额度</div>' +
          '<div class="wb-note">会员每月免费引荐次数 · 会员在圈子点「申请平台引荐」时扣一次；被驳回的不占额度。</div>' +
          '<div style="display:flex;gap:8px;align-items:center"><input id="rqGen" type="number" class="wb-inp" style="flex:1" value="' + db.config.referralQuota + '"><button class="wb-btn" onclick="Workbench.saveQuota()">保存</button></div></div>' +
          '<div class="d-block">' + (db.referrals.length ? db.referrals.map(function (r) {
            return '<div class="wb-card"><div class="wc-top">' + esc(r.client) + ' <span class="wb-tag" style="background:#eef1ff;color:#3a4a9f">' + esc(r.bossName) + '</span></div>' +
              '<div class="wc-sub">💬 诉求：' + esc(r.demand || '—') + '</div>' +
              '<div class="wc-sub">' + maskPhone(r.phone) + ' · ' + esc(r.submitTime || '') + '</div></div>';
          }).join('') : emptyBox('🤝', '没有引荐请求<br>会员在圈子里点「申请平台引荐」后会出现在这里')) + '</div>';
      }
      shell({ title: '圈子内容管理', back: '#/boss-dash', body: bodyHtml });
    },
    postSet: function (id, st) {
      var db = S.get();
      var p = db.posts.filter(function (x) { return x.id === id; })[0];
      if (!p) return; p.status = st; S.save(); UI.toast('已更新'); WB.posts('post', window._bPostSt || 'all');
    },
    postReject: function (id) {
      var reason = window.prompt('驳回原因（会显示给发布人）', '不符合圈子发布规范');
      if (reason === null) return;
      var db = S.get();
      var p = db.posts.filter(function (x) { return x.id === id; })[0];
      if (!p) return; p.status = 'rejected'; p.rejectReason = reason.slice(0, 100);
      S.save(); UI.toast('已驳回'); WB.posts('post', window._bPostSt || 'all');
    },
    postPin: function (id) {
      var db = S.get();
      var p = db.posts.filter(function (x) { return x.id === id; })[0];
      if (!p) return; p.pinned = !p.pinned; S.save(); UI.toast(p.pinned ? '已置顶' : '已取消置顶'); WB.posts('post', window._bPostSt || 'all');
    },
    postDel: function (id) {
      if (!window.confirm('确定删除这条动态吗？删除后不可恢复，配图会一并清理。')) return;
      var db = S.get();
      db.posts = db.posts.filter(function (x) { return x.id !== id; });
      S.save(); UI.toast('已删除'); WB.posts('post', window._bPostSt || 'all');
    },
    saveQuota: function () {
      var db = S.get();
      db.config.referralQuota = +($('rqGen') || {}).value || 3;
      S.save(); UI.toast('已保存'); WB.posts('ref');
    },

    /* ==================== 用户管理 ==================== */
    staff: function () {
      if (!isBoss()) return deny();
      var db = S.get();
      var users = [{ phone: db.user.phone, nickname: db.user.nickname, role: 'boss', member: db.user.member }].concat(
        db.distTeam.map(function (m) { return { phone: m.phone, nickname: m.name, role: 'distributor', member: false }; })
      );
      var bodyHtml =
        '<div class="bd-hero"><div class="h1">👥 用户管理</div>' +
        '<div class="wb-note" style="color:rgba(255,255,255,.85)">开通分销员 / 超级管理员 · 查看会员与锁粉归属</div></div>' +
        '<div class="d-block"><div class="wt">用户列表（' + users.length + '）</div>' +
        users.map(function (u) {
          return '<div class="wb-card"><div class="wc-top">' + esc(u.nickname) + ' ' +
            (u.role === 'boss' ? '<span class="wb-tag" style="background:#e8f4ff;color:#1a5f9f">⭐ 主理人</span>' : '') +
            (u.member ? '<span class="wb-tag" style="background:#faeeda;color:#a3741b">👑 会员</span>' : '') + '</div>' +
            '<div class="wc-sub">' + maskPhone(u.phone) + ' · 角色：' + (u.role === 'boss' ? '主理人' : u.role === 'distributor' ? '分销员' : '普通用户') + '</div></div>';
        }).join('') + '</div>' +
        '<div class="d-block"><div class="wt">🤝 会员专属顾问设置</div>' +
        '<div class="wb-note">配置会员专属顾问的企业微信二维码与顾问名（会员加顾问后才可发帖）。' +
        '当前顾问：' + esc(db.config.serviceWechat) + '</div>' +
        '<button class="wb-btn ghost" onclick="Workbench.setAdvisor()">修改顾问名</button></div>' +
        '<div class="d-block"><div class="wt">💼 商务合作设置</div>' +
        '<div class="wb-note">合作二维码显示名：' + esc(db.config.coopName) + ' · 微信号：' + esc(db.config.coopWechat) + '</div>' +
        '<button class="wb-btn ghost" onclick="Workbench.setCoop()">修改合作联系方式</button></div>' +
        '<div class="member-tip">调整角色后对方重新登录生效 · 分销员可见「分销中心」后台</div>';
      shell({ title: '用户管理', back: '#/boss-dash', body: bodyHtml });
    },
    setAdvisor: function () {
      var db = S.get();
      var n = window.prompt('顾问微信名', db.config.serviceWechat);
      if (n === null) return;
      db.config.serviceWechat = n.trim(); S.save(); UI.toast('已保存'); WB.staff();
    },
    setCoop: function () {
      var db = S.get();
      var n = window.prompt('合作显示名', db.config.coopName);
      if (n === null) return;
      var w = window.prompt('合作微信号', db.config.coopWechat);
      if (w === null) return;
      db.config.coopName = n.trim(); db.config.coopWechat = w.trim();
      S.save(); UI.toast('已保存'); WB.staff();
    },

    /* ==================== 首页入口开关 ==================== */
    tabs: function () {
      if (!isBoss()) return deny();
      var db = S.get();
      var hidden = db.config.hiddenTabs || [];
      var META = { circle: ['圈', '圈子', '会员圈子动态流'], bosses: ['板', '老板资源', '探访老板名片墙'] };
      var bodyHtml =
        '<div class="d-block"><div class="wt">首页入口开关</div>' +
        '<div class="wb-note">关掉的入口在客户手机上看不到（底部 Tab 直接消失）；你自己仍能看到，只是标灰带「隐」字。<br>藏起来之后，客户即使从旧链接/收藏里点进去，也会自动回到沙龙列表。</div>' +
        Object.keys(META).map(function (k) {
          var on = hidden.indexOf(k) < 0;
          return '<div class="vip-item" onclick="Workbench.toggleTab(\'' + k + '\')">' +
            '<div class="ic">' + META[k][0] + '</div>' +
            '<div><div class="vt2">' + META[k][1] + '</div><div class="vs2">' + META[k][2] + '</div></div>' +
            '<span class="wb-state">' + (on ? '显示中 ›' : '已隐藏 ›') + '</span></div>';
        }).join('') + '</div>';
      shell({ title: '首页入口开关', back: '#/boss-dash', body: bodyHtml });
    },
    toggleTab: function (k) {
      var db = S.get();
      var hidden = db.config.hiddenTabs = db.config.hiddenTabs || [];
      var i = hidden.indexOf(k);
      if (i >= 0) { hidden.splice(i, 1); UI.toast('已对客户显示'); }
      else { hidden.push(k); UI.toast('已对客户隐藏'); }
      S.save(); WB.tabs();
    },

    /* ==================== 说明页：权限 / 佣金 / 锁粉 ==================== */
    perms: function () {
      if (!isBoss()) return deny();
      var bodyHtml = '<div class="bd-hero"><div class="h1">🔐 角色权限说明</div><div class="wb-note" style="color:rgba(255,255,255,.85)">三类角色 · 各司其职</div></div>' +
        '<div class="d-block">' +
        [['老板（主理人）', '发布沙龙 / 用户管理 / 全部后台 · 仅白名单手机号'],
         ['分销员', '专属锁粉链接 / 客户与佣金明细 / 转发卡片'],
         ['普通用户 / 会员', '报名沙龙 / 开通会员 / 分销中心介绍页']].map(function (r) {
          return '<div class="wb-card"><div class="wc-top">' + r[0] + '</div><div class="wc-sub">' + r[1] + '</div></div>';
        }).join('') + '</div>' +
        '<div class="member-tip">分销员：在「用户管理」页按用户下拉选择授权 · 即时生效</div>';
      shell({ title: '管理员权限', back: '#/boss-dash', body: bodyHtml });
    },
    comm: function () {
      if (!isBoss()) return deny();
      var c = S.get().config;
      var earn = Math.round(c.memberPrice * c.memberCommissionRate) / 100;
      var bodyHtml = '<div class="bd-hero"><div class="h1">💰 佣金规则</div><div class="wb-note" style="color:rgba(255,255,255,.85)">当前为统一比例 · 全平台生效</div></div>' +
        '<div class="d-block">' +
        '<div class="wb-card"><div class="wc-top">圈子（年度）会员 ' + money(c.memberPrice) + ' → 佣金 ' + c.memberCommissionRate + '%</div>' +
        '<div class="wc-sub">分销员得 ' + money(earn) + ' / 单 · 客户终身绑定归属</div></div>' +
        '<div class="wb-card"><div class="wc-top">沙龙门票 → 佣金 ' + c.salonCommissionRate + '%</div>' +
        '<div class="wc-sub">按每场实际票价计算 · 支付后自动入账</div></div></div>' +
        '<div class="member-tip">当前为统一比例：会员 ' + c.memberCommissionRate + '% · 沙龙 ' + c.salonCommissionRate + '% · 锁粉 ' + (c.lockDays || '永久') + '。要按人定向设置，去「分销员管理 → 分销设置」里给单个分销员单独调比例。</div>';
      shell({ title: '定向佣金', back: '#/boss-dash', body: bodyHtml });
    },
    lock: function () {
      if (!isBoss()) return deny();
      var c = S.get().config;
      var txt = c.lockDays ? '锁定 ' + c.lockDays + ' 天内有效' : '永久锁定';
      var bodyHtml = '<div class="bd-hero"><div class="h1">🔒 锁粉归因规则</div><div class="wb-note" style="color:rgba(255,255,255,.85)">首次点击 · ' + txt + '</div></div>' +
        '<div class="d-block">' +
        [['① 客户首次点击分销员链接', '链接形如 ledaoykj.com/?d=手机号 · 进入即绑定'],
         ['② 锁定期内先到先得', '谁先带来就归谁，其他人再点也抢不走'],
         ['③ ' + txt + ' · 任何产品成交都归属', '会员 / 沙龙 / 引荐 / 升单全部计入']].map(function (r) {
          return '<div class="wb-card"><div class="wc-top">' + r[0] + '</div><div class="wc-sub">' + r[1] + '</div></div>';
        }).join('') + '</div>' +
        '<div class="member-tip">在「分销员管理 → 分销设置 → 锁粉有效期」填写天数（0 = 永久锁定）</div>';
      shell({ title: '锁粉归因设置', back: '#/boss-dash', body: bodyHtml });
    },

    /* ==================== 会员落地页 ==================== */
    vipPage: function () {
      if (!isBoss()) return deny();
      var db = S.get(), c = db.config;
      var bodyHtml = '<div class="d-block"><div class="wt">会员落地页内容</div>' +
        '<div class="wb-note">落地页共十屏：封面 / 痛点 / 为什么加入 / 老板资源 / 权益清单 / 增值合作 / 服务规则 / 常见问题 / 下单 / 支付成功。<br>用两个星号包起来的字会加粗；回车换行。保存立刻生效，不用发版。</div>' +
        '<div class="f2"><div>' + lab('会员价（元）') + '<input id="vpPrice" type="number" class="wb-inp" value="' + c.memberPrice + '"></div>' +
        '<div>' + lab('时长（天）') + '<input id="vpDays" type="number" class="wb-inp" value="' + c.memberDays + '"></div></div>' +
        '<button class="wb-btn primary" onclick="Workbench.saveVipPage()">保存并看效果</button>' +
        '<button class="wb-btn ghost" onclick="UI.go(\'#/vip\')">去看效果</button></div>' +
        '<div class="d-block"><div class="wt">页面模块开关</div>' +
        [['s4', '老板资源'], ['s6', '增值深度合作'], ['s8', '常见问题']].map(function (s) {
          var off = (db.vipPage.sections || {})[s[0]] === false;
          return '<div class="vip-item" onclick="Workbench.toggleVpSec(\'' + s[0] + '\')"><div class="ic">屏</div>' +
            '<div><div class="vt2">' + s[1] + '</div><div class="vs2">客户看不到这一屏</div></div>' +
            '<span class="wb-state">' + (off ? '已隐藏 ›' : '显示中 ›') + '</span></div>';
        }).join('') + '</div>' +
        '<div class="member-tip">关掉的屏不影响已付费会员的权益，只是他自己看不到那一屏的说明</div>';
      shell({ title: '会员落地页', back: '#/boss-dash', body: bodyHtml });
    },
    saveVipPage: function () {
      var db = S.get();
      db.config.memberPrice = +($('vpPrice') || {}).value || db.config.memberPrice;
      db.config.memberDays = +($('vpDays') || {}).value || db.config.memberDays;
      db.vipPage.price = db.config.memberPrice; db.vipPage.days = db.config.memberDays;
      S.save(); UI.toast('落地页内容已保存');
    },
    toggleVpSec: function (k) {
      var db = S.get();
      db.vipPage.sections = db.vipPage.sections || {};
      db.vipPage.sections[k] = db.vipPage.sections[k] === false ? true : false;
      S.save(); WB.vipPage();
    },

    /* ==================== 路由 ==================== */
    route: function (h) {
      var seg = h.split('/');
      var name = seg[0], param = seg[1];
      var map = {
        'boss-dash': function () { WB.dash(); },
        'boss-events': function () { WB.events(); },
        'boss-publish': function () { WB.publish(param); },
        'boss-attendees': function () { WB.attendees(param); },
        'boss-recycle': function () { WB.events('bin'); },
        'boss-finance': function () { WB.finance(); },
        'boss-upsell': function () { WB.upsell(); },
        'boss-members': function () { WB.members(); },
        'boss-refers': function () { WB.refers(); },
        'boss-resources': function () { WB.resources(); },
        'boss-coop': function () { WB.coop(); },
        'boss-dist': function () { WB.dist(); },
        'boss-banners': function () { WB.banners(); },
        'boss-banner-form': function () { WB.bnForm(); },
        'boss-posts': function () { WB.posts(); },
        'boss-staff': function () { WB.staff(); },
        'boss-tabs': function () { WB.tabs(); },
        'boss-perms': function () { WB.perms(); },
        'boss-comm': function () { WB.comm(); },
        'boss-lock': function () { WB.lock(); },
        'boss-vip-page': function () { WB.vipPage(); }
      };
      if (map[name]) { map[name](); return true; }
      return false;
    }
  };

  /* ---------- 局部渲染辅助 ---------- */
  function lab(t) { return '<div class="wb-lab">' + t + '</div>'; }
  function f(id, label, val, ph) {
    return '<div class="wb-field">' + lab(label) +
      '<input id="' + id + '" class="wb-inp" placeholder="' + esc(ph || '') + '" value="' + esc(val == null ? '' : val) + '"></div>';
  }
  function evCard(s, t) {
    return '<div class="wb-evcard">' +
      '<div class="wc-top">' + esc(s.title) + ' ' + evTag(s) + '</div>' +
      '<div class="wc-sub">📅 ' + s.date + ' ' + (s.time || '') + ' · 📍 ' + esc(s.place) + ' · 👥 ' + paidCount(s) + '/' + (s.seats || '∞') + '</div>' +
      '<div class="wc-sub">💳 非会员 ' + money(s.price) + ' · 会员 ' + (s.mprice ? money(s.mprice) : '免费') + '</div>' +
      '<div class="wb-btns">' +
      (!s.published ? '<button class="wb-btn primary" onclick="Workbench.evTogglePublish(\'' + s.id + '\')">🚀 发布上线</button>' : '') +
      '<button class="wb-btn ghost" onclick="UI.go(\'#/boss-attendees/' + s.id + '\')">👥 报名记录（' + paidCount(s) + '）</button>' +
      '<button class="wb-btn ghost" onclick="UI.go(\'#/boss-publish/' + s.id + '\')">✏️ 编辑</button>' +
      (t === 'bin'
        ? '<button class="wb-btn ghost" onclick="Workbench.evRestore(\'' + s.id + '\')">↩️ 恢复</button><button class="wb-btn ghost danger" onclick="Workbench.evPermDel(\'' + s.id + '\')">🗑 彻底删除</button>'
        : '<button class="wb-btn ghost" onclick="Workbench.evCopy(\'' + s.id + '\')">📋 复制</button>' +
          (s.published ? '<button class="wb-btn ghost" onclick="Workbench.evTogglePublish(\'' + s.id + '\')">⏸ 下架</button>' : '') +
          '<button class="wb-btn ghost danger" onclick="Workbench.evDel(\'' + s.id + '\')">🗑 移入回收站</button>') +
      '</div></div>';
  }
  function atCard(s) {
    var st = s.refunded ? '<span class="wb-tag" style="background:#f1f2f4;color:#8a8f99">已退款</span>'
      : s.paid ? '<span class="wb-tag" style="background:#e6f5ec;color:#1a7f4b">已支付</span>'
        : '<span class="wb-tag" style="background:#fef3c7;color:#b45309">待支付</span>';
    return '<div class="wb-card" style="box-shadow:none;border-bottom:1px dashed var(--line);border-radius:0">' +
      '<div class="wc-top">' + esc(s.name || '未填写') + ' ' + st + '</div>' +
      '<div class="wc-sub">' + maskPhone(s.phone) + ' · ' + (s.type === 'vip' ? '会员价' : '标准') + ' · ' + money(s.amount) + '</div>' +
      '<div class="wc-sub">' + esc(s.createdAt || '') + (s.distName ? ' · 分销员 ' + esc(s.distName) : '') + '</div>' +
      (!s.refunded && s.paid ? '<div class="wb-btns"><button class="wb-btn ghost danger" onclick="Workbench.refundSignup(\'' + s.id + '\')">退款</button></div>' : '') +
      '</div>';
  }
  function linkLabel(t) {
    return ({ none: '不跳转（纯展示）', salon: '跳转到某场沙龙', bosses: '跳转到「老板资源」列表', vip: '跳转到「会员权益」页', mypay: '跳转到「我的支付记录」', distro: '跳转到「分销中心」', url: '打开外部链接' })[t] || t;
  }
  function noticeAdmin() {
    return '<div class="d-block"><div class="wt">📢 分销公告与规则</div>' +
      '<div class="wb-note">发布后分销员在「分销中心 · 公告与规则」查看，未读强制弹窗。</div>' +
      '<button class="wb-btn" onclick="Workbench.noticeAdd()">📢 发布新公告</button></div>' +
      '<div class="d-block">' + S.get().notices.map(function (n) {
        return '<div class="wb-card"><div class="wc-top">' + esc(n.title) + ' <span class="wb-mini">' + esc(n.type) + '</span></div>' +
          '<div class="wc-sub">' + esc(n.content).slice(0, 60) + '…</div></div>';
      }).join('') + '</div>';
  }
  WB.noticeAdd = function () {
    var db = S.get();
    var t = window.prompt('公告标题');
    if (!t) return;
    var ct = window.prompt('公告内容', '');
    if (ct === null) return;
    db.notices.unshift({ id: S.uid('n'), cat: 'tip', type: '技巧与通知', pinned: false, title: t.trim(), content: ct.trim(), date: S.today(), read: false });
    S.save(); UI.toast('公告已发布'); WB.dist('notice');
  };

  window.Workbench = WB;
})();
