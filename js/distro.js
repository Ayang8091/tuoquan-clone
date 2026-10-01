/* ============================================================
 * 乐道AI · 复刻系统 —— 分销中心（H5 内）
 * 对应原站 v-distro / v-distro-stats / v-signup-detail / v-distro-notices /
 *   v-distro-custs / v-distro-cust-detail / v-distro-cms（佣金明细）/
 *   v-distro-refers / v-distro-coop
 * 角色：分销员 / 老板（亲自分销）；普通用户看到「推广赚佣金 + 申请表」
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
  function isBoss() { var u = S.get().user; return !!(u && (u.role === 'boss' || u.superadmin)); }
  function isDist() { var u = S.get().user; return !!(u && (u.role === 'distributor' || u.role === 'boss' || u.superadmin)); }
  function myPhone() { return S.get().user.inviteCode; }
  function roleName() {
    var u = S.get().user;
    if (u.role === 'boss') return '老板 · 亲自分销';
    if (u.superadmin) return '超级管理员';
    return '分销员';
  }
  function lockTxt() { var d = S.get().config.lockDays; return d ? '锁定 ' + d + ' 天内有效' : '永久锁定'; }
  function shell(o) {
    var html = H().pagebar(o.title, o.back || '#/me', o.right || '') +
      '<div class="wb-body">' + o.body + '</div>' + (o.tabbar ? H().tabbar(o.tabbar) : '');
    $('phone').innerHTML = html;
    if (o.after) o.after();
  }
  function emptyBox(big, txt) { return '<div class="wb-empty"><div class="e-big">' + big + '</div><div>' + txt + '</div></div>'; }
  function chipRow(list, active, fn) {
    return '<div class="chip-row">' + list.map(function (c) {
      return '<span class="chip ' + (active === c[0] ? 'on' : '') + '" onclick="' + fn.replace('%s', c[0]) + '">' + c[1] + '</span>';
    }).join('') + '</div>';
  }
  function myComms() { return S.get().commissions.filter(function (c) { return c.dist === myPhone(); }); }
  function myRefers() { return S.get().referrals.filter(function (r) { return r.dist === myPhone(); }); }
  function sum(arr, k) { return arr.reduce(function (a, b) { return a + (+(b[k] || 0)); }, 0); }

  var D = {
    /* ==================== 分销中心首页 ==================== */
    home: function () {
      if (!isDist()) return D.apply();
      var db = S.get(), c = db.config, u = db.user;
      var link = location.origin + location.pathname + '?d=' + u.inviteCode;
      var cm = myComms();
      var pending = sum(cm.filter(function (x) { return x.status === '待结算'; }), 'amount');
      var settling = sum(cm.filter(function (x) { return x.status === '结算中'; }), 'amount');
      var settled = sum(cm.filter(function (x) { return x.status === '已结算'; }), 'amount');
      var custs = db.clients.filter(function (x) { return x.owner === u.nickname; });
      var locked = custs.filter(function (x) { return x.locked; }).length;
      var unlocked = custs.length - locked;
      var refers = myRefers();
      var refPending = refers.filter(function (r) { return r.dock === 'pending'; }).length;
      var coopMine = db.coopLeads.filter(function (l) { return l.distName === u.nickname; });
      var coopPending = coopMine.filter(function (l) { return l.status === 'new'; }).length;
      var coopDeal = coopMine.filter(function (l) { return l.status === 'deal'; }).length;
      var coopCm = sum(coopMine, 'commission');

      var bodyHtml =
        '<div class="distro-hero"><div class="h1">您好，' + esc(u.nickname || '分销员') + '</div>' +
        '<div class="h2">' + roleName() + ' · 会员佣金 ' + c.memberCommissionRate + '% · 沙龙 ' + c.salonCommissionRate + '%</div>' +
        '<div class="dist-stats">' +
        '<div class="ds"><div class="v o">' + money(pending) + '</div><div class="k">待结算</div></div>' +
        '<div class="ds"><div class="v b">' + money(settling) + '</div><div class="k">结算中</div></div>' +
        '<div class="ds"><div class="v g">' + money(settled) + '</div><div class="k">已结算</div></div>' +
        '</div></div>' +

        '<div class="d-block"><div class="vip-list">' +
        item('📊', '我的业绩看板', '今日 · 成交 ' + money(sum(myPaidToday(), 'amount')) + ' · 锁客 ' + locked + ' 人', '#/distro-stats') +
        item('🔒', '我的专属链接（锁粉）', '客户首次点击即锁定到你名下 · ' + lockTxt(), 'link') +
        item('📢', '公告与规则', '规则红线 · 使用教程 · 转化技巧', '#/distro-notices') +
        item('👥', '我的客户（' + custs.length + '）', '锁定中 ' + locked + ' 位 · 已解锁 ' + unlocked + ' 位', '#/distro-custs') +
        item('💰', '佣金明细', '待结算 ' + cm.filter(function (x) { return x.status === '待结算'; }).length + ' 笔 · 已结算 ' + cm.filter(function (x) { return x.status === '已结算'; }).length + ' 笔', '#/distro-cms') +
        item('🤝', '我的引荐', refPending ? '待对接 ' + refPending + ' 单' : '客户引荐单对接 · 24h 内提交，公司确认后佣金生效', '#/distro-refers') +
        item('🤝', '我的合作线索', coopDeal ? '已合作 ' + coopDeal + ' 条 · 合作佣金 ' + money(coopCm) : '客户扫你的合作海报提交，谈成后给你分佣', '#/distro-coop') +
        '</div></div>' +

        '<div class="d-block" style="background:#E1F5EE"><div class="wt" style="color:#0F6E56">🔒 我的专属链接（锁粉）</div>' +
        '<div class="wb-note">客户首次点你的链接进入即锁定到你名下，<b>' + lockTxt() + '</b>——他买任何产品（会员 / 沙龙）佣金都归你</div>' +
        '<div class="link-box" onclick="UI.copy(\'' + link + '\')">' + link + ' · 点击复制</div>' +
        '<div class="wb-btns"><button class="wb-btn ghost" onclick="UI.go(\'#/share\')">↗ 生成转发卡片</button>' +
        '<button class="wb-btn ghost" onclick="UI.go(\'#/poster\')">🤝 生成商务合作海报</button></div></div>' +

        '<div class="member-tip">待结算 = 订单已记录 · 结算中 = 老板已确认、等待打款 · 已结算 = 打款完成</div>';
      shell({ title: '分销中心', back: '#/me', body: bodyHtml });
    },
    copyLink: function () {
      var u = S.get().user;
      UI.copy(location.origin + location.pathname + '?d=' + u.inviteCode);
    },

    /* ==================== 普通用户：推广介绍 + 申请 ==================== */
    apply: function () {
      var db = S.get(), c = db.config, u = db.user;
      var applying = u.distApply === 'pending';
      var earn = Math.round(c.memberPrice * c.memberCommissionRate) / 100;
      var bodyHtml =
        '<div class="distro-hero"><div class="h1">推广赚佣金</div>' +
        '<div class="h2">卖会员 · 卖沙龙票，一码通用</div>' +
        '<div class="dist-stats">' +
        '<div class="ds"><div class="v">' + c.memberCommissionRate + '%</div><div class="k">会员佣金</div></div>' +
        '<div class="ds"><div class="v">' + c.salonCommissionRate + '%</div><div class="k">沙龙票佣金</div></div>' +
        '<div class="ds"><div class="v">' + money(earn) + '</div><div class="k">卖一单会员得</div></div>' +
        '</div></div>' +
        '<div class="d-block"><div class="wt">怎么赚钱</div>' +
        [['① 申请成为分销员', '提交申请，老板审核通过后自动开通'],
         ['② 客户通过你的链接付费', '会员、沙龙票，买任意一样都算你的单（' + lockTxt() + '）'],
         ['③ 佣金自动记账', '老板按周期确认结算并打款，明细清晰可对账']].map(function (r) {
          return '<div class="wb-card"><div class="wc-top">' + r[0] + '</div><div class="wc-sub">' + r[1] + '</div></div>';
        }).join('') + '</div>' +
        (applying
          ? '<div class="d-block"><div class="wt">⏳ 申请审核中</div><div class="wb-note">你的分销员申请已提交，老板审核通过后即可获得专属链接，无需重复提交。</div></div>'
          : '<div class="d-block"><div class="wt">申请成为分销员</div>' +
            '<div class="wb-field"><div class="wb-lab">真实姓名 *</div><input id="daName" class="wb-inp" placeholder="与身份证一致的姓名，用于佣金结算"></div>' +
            '<div class="wb-field"><div class="wb-lab">手机号 *</div><input id="daPhone" class="wb-inp" placeholder="11 位手机号，将作为你的分销账号"></div>' +
            '<div class="wb-field"><div class="wb-lab">申请理由 / 资源说明</div><textarea id="daReason" class="wb-inp" rows="3" placeholder="例：我有 3 个本地老板社群共 2000 人，计划每月组织 1 场沙龙"></textarea></div>' +
            '<button class="wb-btn primary" onclick="Distro.submitApply()">提交申请 · 等待老板审核</button>' +
            '<div class="wb-note">审核制 · 通过后自动生成专属锁粉链接，自购产品同样享受佣金</div></div>');
      shell({ title: '分销中心', back: '#/me', body: bodyHtml });
    },
    submitApply: function () {
      var db = S.get();
      var name = (($('daName') || {}).value || '').trim();
      var phone = (($('daPhone') || {}).value || '').trim();
      var reason = (($('daReason') || {}).value || '').trim();
      if (!name) { UI.toast('请填写真实姓名'); return; }
      if (!/^1\d{10}$/.test(phone)) { UI.toast('请填写正确的 11 位手机号'); return; }
      db.distApplyList.push({ id: S.uid('ap'), name: name, phone: phone, reason: reason, at: S.today() });
      db.user.distApply = 'pending';
      S.save(); UI.toast('已提交申请，等待老板审核');
      setTimeout(function () { D.home(); }, 600);
    },

    /* ==================== 业绩看板 ==================== */
    stats: function (period) {
      if (!isDist()) { UI.toast('仅分销员可访问'); return D.home(); }
      var p = period || 'today';
      var paid = S.get().signups.filter(function (s) { return s.dist === myPhone() && s.paid && !s.refunded; });
      if (p === 'today') paid = paid.filter(function (s) { return (s.paidAt || '').slice(0, 10) === S.today(); });
      if (p === '7d') { var t = Date.now() - 7 * 86400000; paid = paid.filter(function (s) { return new Date(s.paidAt).getTime() >= t; }); }
      var amount = sum(paid, 'amount');
      var refunded = S.get().signups.filter(function (s) { return s.dist === myPhone() && s.refunded; });
      var custs = S.get().clients.filter(function (x) { return x.owner === S.get().user.nickname; });
      var bodyHtml =
        '<div class="d-block"><div class="wt">我的业绩</div>' +
        chipRow([['today', '今日'], ['7d', '近 7 天'], ['all', '全部']], p, "Distro.stats('%s')") +
        '<div class="wb-2x2">' +
        statBox(custs.length + ' 人', '锁客数') +
        statBox(money(amount), '成交额 · ' + paid.length + ' 单') +
        statBox(refunded.length + ' 笔', '退款', 'red') +
        statBox(money(amount * 0.3), '区间佣金', 'green') +
        '</div></div>' +
        '<div class="d-block"><div class="wb-3">' +
        '<div class="wb-3c"><div class="n">' + (paid.length ? money(amount / paid.length) : '¥0') + '</div><div class="l">客单价</div></div>' +
        '<div class="wb-3c"><div class="n">' + paid.length + '</div><div class="l">成交单数</div></div>' +
        '<div class="wb-3c"><div class="n">' + money(sum(myComms().filter(function (c) { return c.status !== '已结算'; }), 'amount')) + '</div><div class="l">在路上</div></div>' +
        '</div></div>' +
        '<div class="d-block"><div class="wt">区间内订单明细（按报名时间倒序）</div>' +
        (paid.length ? paid.map(function (s) {
          return '<div class="wb-rev clickable" onclick="UI.go(\'#/distro-detail/' + s.id + '\')">' +
            '<div class="ri">' + (s.kind === 'member' ? '👑' : s.kind === 'refer' ? '🤝' : '🎫') + '</div>' +
            '<div class="rt"><div class="rs">' + esc(s.title) + ' · ' + esc(s.name) + '</div>' +
            '<div class="elapsed">' + esc(s.paidAt || '') + '</div></div>' +
            '<div class="ra">' + (s.amount ? money(s.amount) : '免费') + '</div></div>';
        }).join('') : emptyBox('📊', '区间内还没有成交记录')) + '</div>';
      shell({ title: '分销员业绩', back: '#/distro', body: bodyHtml });
    },

    /* ==================== 报名详情 ==================== */
    detail: function (id) {
      var db = S.get();
      var s = db.signups.filter(function (x) { return x.id === id; })[0];
      if (!s) { shell({ title: '报名详情', back: '#/distro-stats', body: emptyBox('❓', '记录不存在') }); return; }
      var isRefer = s.kind === 'refer';
      var kv = [
        ['产品类型', s.kind === 'member' ? '会员' : isRefer ? '引荐' : '沙龙'],
        [isRefer ? '引荐对象' : '主题', isRefer ? (s.bossName || '') : (s.title || '')],
        ['票种', (s.type === 'vip' ? '会员价' : '标准') + ' · ' + (s.amount ? money(s.amount) : '免费')],
        ['报名时间', s.createdAt || ''],
        ['成交时间', s.paidAt || ''],
        ['状态', s.refunded ? '已退款' : s.paid ? '已支付' : '待支付']
      ];
      var bodyHtml =
        '<div class="ds-detail-head"><div class="dh-ava">' + esc((s.name || '客')[0]) + '</div>' +
        '<div><div class="dh-name">' + esc(s.name || '') + '</div><div class="dh-sub">' + maskPhone(s.phone) + (isRefer ? ' · 引荐客户' : '') + '</div></div></div>' +
        '<div class="d-block">' + kv.map(function (r) {
          return '<div class="ds-kv"><span class="k">' + r[0] + '</span><span class="v">' + esc(r[1] || '—') + '</span></div>';
        }).join('') + '</div>' +
        '<div class="member-tip">' + (isRefer ? '手机号 / 微信号已脱敏 · 仅可查看归属你的客户' : '仅可查看归属你的客户') + ' · 如需联系客户请在「我的客户」中查看</div>';
      shell({ title: isRefer ? '引荐信息' : '报名详情', back: '#/distro-stats', body: bodyHtml });
    },

    /* ==================== 公告与规则 ==================== */
    notices: function () {
      var db = S.get();
      var CATS = [['rule', '🚫 规则红线'], ['guide', '📖 使用教程'], ['tip', '💡 技巧与通知']];
      var bodyHtml = (db.notices.length ? CATS.map(function (c) {
        var list = db.notices.filter(function (n) { return (n.cat || 'tip') === c[0]; });
        if (!list.length) return '';
        return '<div class="d-block"><div class="wt">' + c[1] + '</div>' + list.map(function (n) {
          return '<div class="wb-card" onclick="Distro.noticeRead(\'' + n.id + '\')">' +
            '<div class="wc-top">' + (n.read ? '📢' : '🔴') + ' ' + (n.pinned ? '📌 ' : '') + esc(n.title) + '</div>' +
            '<div class="wc-sub">' + esc(n.content).slice(0, 42) + '…</div>' +
            '<div class="wc-sub">' + esc(n.date) + ' · 已更新</div></div>';
        }).join('') + '</div>';
      }).join('') : emptyBox('📢', '暂无公告'));
      shell({ title: '公告与规则', back: '#/distro', body: bodyHtml });
    },
    noticeRead: function (id) {
      var db = S.get();
      var n = db.notices.filter(function (x) { return x.id === id; })[0];
      if (!n) return;
      n.read = true; S.save();
      window.alert('📢 ' + n.title + '\n\n' + n.content + '\n\n· 乐道AI 官方');
      D.notices();
    },

    /* ==================== 我的客户 ==================== */
    custs: function (st) {
      var db = S.get(), u = db.user;
      var k = st || 'all';
      var all = db.clients.filter(function (x) { return x.owner === u.nickname; });
      var list = k === 'locked' ? all.filter(function (x) { return x.locked; })
        : k === 'unlocked' ? all.filter(function (x) { return !x.locked; }) : all;
      var bodyHtml =
        chipRow([['all', '全部 ' + all.length], ['locked', '🔒 锁定中 ' + all.filter(function (x) { return x.locked; }).length], ['unlocked', '🔓 已解锁 ' + all.filter(function (x) { return !x.locked; }).length]], k, "Distro.custs('%s')") +
        '<div class="d-block">' + (list.length ? list.map(function (c) {
          var chip = c.locked ? '<span class="wb-tag" style="background:#e6f5ec;color:#1a7f4b">🔒 锁定中 · ' + esc(c.lockUntil) + '</span>'
            : '<span class="wb-tag" style="background:#f1f2f4;color:#8a8f99">已解锁</span>';
          return '<div class="wb-card" onclick="UI.go(\'#/distro-cust/' + c.id + '\')">' +
            '<div class="wc-top">' + esc(c.nickname) + ' ' + chip + '</div>' +
            '<div class="wc-sub">首次锁定 ' + esc(c.firstLock) + ' · ' + esc(c.consume) + '</div>' +
            '<div class="wc-sub">我的佣金 ' + money(c.commissionTotal) + '</div></div>';
        }).join('') : emptyBox('👥', '还没有锁粉客户<br>把专属链接发出去，客户进入即锁定')) + '</div>' +
        '<div class="member-tip">客户首次点击你的链接即锁定 · 锁定期内成交都归你</div>';
      shell({ title: '我的客户（' + all.length + '）', back: '#/distro', body: bodyHtml });
    },

    /* ==================== 客户详情（脱敏只读） ==================== */
    custDetail: function (id) {
      var db = S.get();
      var c = db.clients.filter(function (x) { return x.id === id; })[0];
      if (!c) { shell({ title: '客户详情', back: '#/distro-custs', body: emptyBox('❓', '客户不存在') }); return; }
      var spend = db.signups.filter(function (s) { return s.name === c.nickname && s.paid && !s.refunded; });
      var cm = db.commissions.filter(function (x) { return x.dist === myPhone() && x.name === c.nickname; });
      var bodyHtml =
        '<div class="ds-detail-head" style="background:#0F6E56;color:#fff"><div class="dh-ava" style="background:#fff;color:#0F6E56">' + esc(c.nickname[0]) + '</div>' +
        '<div><div class="dh-name">' + esc(c.nickname) + ' ' + (c.locked ? '🔒 锁定中' : '已解锁') + '</div>' +
        '<div class="dh-sub" style="color:rgba(255,255,255,.8)">首次锁定 ' + esc(c.firstLock) + ' · 锁至 ' + esc(c.lockUntil || '—') + '</div></div></div>' +
        '<div class="d-block"><div class="wt">💰 消费记录</div>' +
        (spend.length ? spend.map(function (s) {
          return '<div class="ds-kv"><span class="k">' + esc(s.title) + '</span><span class="v">' + money(s.amount) + '</span></div>';
        }).join('') : '<div class="wb-note">暂无消费</div>') + '</div>' +
        '<div class="d-block"><div class="wt">💰 佣金明细（' + cm.length + '）</div>' +
        (cm.length ? cm.map(function (x) {
          return '<div class="ds-kv"><span class="k">' + esc(x.title) + ' · ' + x.status + '</span><span class="v">' + money(x.amount) + '</span></div>';
        }).join('') : '<div class="wb-note">暂无佣金记录</div>') + '</div>' +
        '<div class="member-tip">🔒 客户手机号 / 微信号已脱敏展示 · 防止私下加人 · 如需对接请走系统内消息</div>';
      shell({ title: '客户详情', back: '#/distro-custs', body: bodyHtml });
    },

    /* ==================== 佣金明细 ==================== */
    cms: function (st) {
      var db = S.get();
      var k = st || 'all';
      var all = myComms();
      var list = k === 'all' ? all : all.filter(function (c) { return c.status === ({ pending: '待结算', settling: '结算中', settled: '已结算', refunded: '已退款' })[k]; });
      var cnt = function (s) { return all.filter(function (c) { return c.status === s; }).length; };
      var total = sum(all.filter(function (c) { return c.status !== '已退款'; }), 'amount');
      var settled = sum(all.filter(function (c) { return c.status === '已结算'; }), 'amount');
      var bodyHtml =
        '<div class="dcm-sum">' +
        [['pending', '待结算', sum(all.filter(function (c) { return c.status === '待结算'; }), 'amount')],
         ['settling', '结算中', sum(all.filter(function (c) { return c.status === '结算中'; }), 'amount')],
         ['settled', '已结算', settled],
         ['refunded', '已退款', sum(all.filter(function (c) { return c.status === '已退款'; }), 'amount')]].map(function (x) {
          return '<div class="dcm-c" onclick="Distro.cms(\'' + x[0] + '\')"><div class="n">' + money(x[2]) + '</div><div class="l">' + x[1] + '</div></div>';
        }).join('') + '</div>' +
        '<div class="wb-note" style="padding:0 14px">累计佣金 ' + money(total) + '（不含已退款） · 已到账 ' + money(settled) + '</div>' +
        chipRow([['all', '全部 ' + all.length], ['pending', '待结算 ' + cnt('待结算')], ['settling', '结算中 ' + cnt('结算中')], ['settled', '已结算 ' + cnt('已结算')], ['refunded', '已退款 ' + cnt('已退款')]], k, "Distro.cms('%s')") +
        '<div class="d-block">' + (list.length ? list.map(function (c) {
          var chip = c.status === '已结算' ? '#e6f5ec|#1a7f4b' : c.status === '待结算' ? '#faeeda|#a3741b' : c.status === '结算中' ? '#e8f4ff|#1a5f9f' : '#f1f2f4|#8a8f99';
          var parts = chip.split('|');
          return '<div class="wb-card"><div class="wc-top">' +
            (c.kind === 'member' ? '👑 会员' : c.kind === 'refer' ? '🤝 引荐' : c.kind === 'upsell' ? '📈 升单' : '🎫 沙龙') +
            ' <span class="wb-tag" style="background:' + parts[0] + ';color:' + parts[1] + '">' + c.status + '</span></div>' +
            '<div class="wc-sub">' + esc(c.title) + ' · ' + esc(c.name || '') + ' · ' + esc(c.time || '') + '</div>' +
            '<div class="wc-sub">佣金比例 ' + c.rate + '%</div>' +
            '<div class="ra" style="color:var(--green);font-weight:700">+' + money(c.amount) + '</div></div>';
        }).join('') : emptyBox('💰', '该状态下暂无佣金记录')) + '</div>' +
        '<div class="member-tip">待确认引荐单不计入佣金台账 · 公司确认对接后才正式生成佣金</div>';
      shell({ title: '佣金明细', back: '#/distro', body: bodyHtml });
    },

    /* ==================== 我的引荐 ==================== */
    refers: function () {
      if (!isDist()) { UI.toast('仅分销员可访问'); return D.home(); }
      var list = myRefers();
      var pending = list.filter(function (r) { return r.dock === 'pending'; }).length;
      var bodyHtml = (list.length ? list.map(function (r) {
        var st = r.dock === 'done' ? '<span class="wb-tag" style="background:#e6f5ec;color:#1a7f4b">✓ 已完成</span>'
          : r.dock === 'submitted' ? '<span class="wb-tag" style="background:#fef3c7;color:#b45309">待公司确认</span>'
            : '<span class="wb-tag" style="background:#e8f4ff;color:#1a5f9f">待对接</span>';
        return '<div class="wb-card"><div class="wc-top">🤝 ' + esc(r.bossName) + ' ' + st + '</div>' +
          '<div class="wc-sub">客户：' + esc(r.client) + ' · ' + maskPhone(r.phone) + '</div>' +
          '<div class="wc-sub">💬 诉求：' + esc(r.demand || '—') + '</div>' +
          '<div class="wc-sub">引荐费 ' + money(r.amount) + ' · 我的佣金 ' + money(r.commission) + '</div>' +
          (r.dock === 'pending' ? '<div class="wb-btns"><button class="wb-btn primary" onclick="Distro.refSubmit(\'' + r.id + '\')">✓ 已把老板微信推给客户 · 提交对接完成</button></div>'
            : '<div class="wc-sub">提交于 ' + esc(r.submitTime || '') + ' · 等待公司确认，如久未确认可在工作群提醒</div>') +
          '</div>';
      }).join('') : emptyBox('🤝', '暂无引荐单 · 客户通过你的链接付费引荐后会出现在这里')) +
        '<div class="member-tip">对接流程：找公司拿老板微信 → 推给客户 → 点「提交对接完成」→ 公司确认后佣金生效 · 24 小时未提交系统自动退款</div>';
      shell({ title: '我的引荐（待对接 ' + pending + '）', back: '#/distro', body: bodyHtml });
    },
    refSubmit: function (id) {
      if (!window.confirm('确认已把老板微信推送给客户？\n提交后等待公司确认，佣金在公司确认后生效。')) return;
      var db = S.get();
      var r = db.referrals.filter(function (x) { return x.id === id; })[0];
      if (!r) return;
      r.dock = 'submitted'; r.submitTime = S.today() + ' ' + new Date().toTimeString().slice(0, 5);
      S.save(); UI.toast('已提交，等待公司确认'); D.refers();
    },

    /* ==================== 我的合作线索 ==================== */
    coop: function () {
      if (!isBoss() && S.get().user.role !== 'distributor') { UI.toast('无分销权限'); return D.home(); }
      var db = S.get();
      var META = { new: '🆕 待跟进', wechat: '💬 已加微信', talking: '🤝 洽谈中', deal: '✅ 已合作', no: '⛔ 不适合' };
      var all = db.coopLeads.filter(function (l) { return l.distName === db.user.nickname; });
      var bodyHtml =
        '<div class="bd-hero" style="background:#0C447C"><div class="h1">🤝 我的合作线索</div>' +
        '<div class="wb-note" style="color:rgba(255,255,255,.85)">共 ' + all.length + ' 条 · 已合作 ' + all.filter(function (l) { return l.status === 'deal'; }).length + ' · 合作佣金 ' + money(sum(all, 'commission')) + '</div></div>' +
        (all.length ? all.map(function (l) {
          return '<div class="d-block"><div class="wb-card" style="box-shadow:none;padding:0">' +
            '<div class="wc-top">' + esc(l.name) + ' <span class="wb-tag" style="background:#eef1ff;color:#3a4a9f">' + (META[l.status] || l.status) + '</span></div>' +
            '<div class="wc-sub">' + esc(l.biz) + '</div>' +
            '<div class="wc-sub">想怎么合作：' + esc(l.want) + '</div>' +
            (l.status === 'deal' && l.commission > 0 ? '<div class="wc-sub" style="color:var(--green)">你的佣金 ' + money(l.commission) + '</div>' : '') +
            '<div class="wc-sub">' + maskPhone(l.phone) + '</div>' +
            '<div class="wb-btns"><button class="wb-btn ghost" onclick="UI.copy(\'' + l.phone + '\')">📋 复制手机号</button>' +
            (l.wechat ? '<button class="wb-btn ghost" onclick="UI.copy(\'' + esc(l.wechat) + '\')">💬 复制微信号</button>' : '') +
            '</div></div></div>';
        }).join('') : emptyBox('🤝', '还没有合作线索<br>把你的专属合作海报发出去，客户扫码提交后这里就有记录')) +
        '<div class="member-tip">跟进由主理人统一负责，进度会自动同步到你这里 · 合作谈成后佣金直接进你的收益</div>';
      shell({ title: '我的合作线索', back: '#/distro', body: bodyHtml });
    },

    /* ==================== 路由 ==================== */
    route: function (h) {
      var seg = h.split('/');
      var name = seg[0], param = seg[1];
      var map = {
        'distro': function () { D.home(); },
        'distro-apply': function () { D.apply(); },
        'distro-stats': function () { D.stats(); },
        'distro-detail': function () { D.detail(param); },
        'distro-notices': function () { D.notices(); },
        'distro-custs': function () { D.custs(); },
        'distro-cust': function () { D.custDetail(param); },
        'distro-cms': function () { D.cms(); },
        'distro-refers': function () { D.refers(); },
        'distro-coop': function () { D.coop(); }
      };
      if (map[name]) { map[name](); return true; }
      return false;
    }
  };

  function item(ic, t, s, target) {
    var click = target === 'link' ? 'onclick="Distro.copyLink()"' : 'onclick="UI.go(\'' + target + '\')"';
    return '<div class="vip-item" ' + click + '><div class="ic">' + ic + '</div>' +
      '<div><div class="vt2">' + t + '</div><div class="vs2">' + s + '</div></div>' +
      '<span class="arrow">›</span></div>';
  }
  function statBox(n, l, tone) {
    return '<div class="wb-stat ' + (tone || '') + '"><div class="n">' + n + '</div><div class="l">' + l + '</div></div>';
  }
  function myPaidToday() {
    return S.get().signups.filter(function (s) {
      return s.dist === myPhone() && s.paid && !s.refunded && (s.paidAt || '').slice(0, 10) === S.today();
    });
  }

  window.Distro = D;
})();
