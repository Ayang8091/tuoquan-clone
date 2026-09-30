/* ============================================================
 * 乐道AI · 复刻系统 —— 后台管理端逻辑
 * ============================================================ */
(function () {
  'use strict';
  var S = window.Store;

  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg; t.style.display = 'block';
    clearTimeout(t._h);
    t._h = setTimeout(function () { t.style.display = 'none'; }, 1600);
  }
  function esc(s) { return String(s == null ? '' : s).replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
  function modal(html) {
    document.getElementById('modalBox').innerHTML = html;
    document.getElementById('modalMask').style.display = 'flex';
  }
  function closeModal() { document.getElementById('modalMask').style.display = 'none'; }
  document.getElementById('modalMask').onclick = function (e) { if (e.target === this) closeModal(); };

  var TITLES = { dashboard: '数据看板', bosses: '老板资源管理', salons: '沙龙活动管理', orders: '订单管理', users: '用户管理', distribute: '分销与佣金', leads: '合作线索', notices: '公告管理', config: '系统配置' };

  function statusTag(st) {
    var map = {
      '待对接': 'orange', '已对接': 'blue', '已完成': 'green', '已退款': 'red',
      '待跟进': 'orange', '已合作': 'green',
      '待结算': 'orange', '结算中': 'blue', '已结算': 'green',
      '报名中': 'green', '筹备中': 'orange', '已结束': 'gray', '已报名': 'blue', '已核销': 'green'
    };
    return '<span class="tagx ' + (map[st] || 'gray') + '">' + st + '</span>';
  }

  var Admin = window.Admin = {
    /* ---------- 登录 ---------- */
    login: function () {
      var u = document.getElementById('loginUser').value;
      var p = document.getElementById('loginPass').value;
      if (u === 'admin' && p === '123456') {
        sessionStorage.setItem('TQ_ADMIN', '1');
        document.getElementById('loginMask').style.display = 'none';
        document.getElementById('admin').style.display = 'block';
        Admin.renderAll();
        toast('登录成功');
        Admin.pullCloud();
      } else { toast('账号或密码错误（admin / 123456）'); }
    },
    logout: function () {
      sessionStorage.removeItem('TQ_ADMIN');
      document.getElementById('admin').style.display = 'none';
      document.getElementById('loginMask').style.display = 'flex';
    },

    /* ---------- 导航 ---------- */
    go: function (page) {
      document.querySelectorAll('.sb-item').forEach(function (i) { i.classList.toggle('on', i.dataset.page === page); });
      document.querySelectorAll('.page').forEach(function (p) { p.classList.toggle('on', p.id === 'page-' + page); });
      document.getElementById('tbTitle').textContent = TITLES[page] || page;
      Admin.renderAll();
    },

    renderAll: function () {
      Admin.renderDash();
      Admin.renderBosses();
      Admin.renderSalons();
      Admin.renderOrders();
      Admin.renderUsers();
      Admin.renderDistribute();
      Admin.renderLeads();
      Admin.renderNotices();
      Admin.renderConfig();
    },

    /* ---------- 看板 ---------- */
    renderDash: function () {
      var db = S.get();
      var memberCnt = db.orders.filter(function (o) { return o.type === '会员' && o.status !== '已退款'; }).length;
      var refCnt = db.orders.filter(function (o) { return o.type === '引荐'; }).length;
      var gmv = db.orders.filter(function (o) { return o.status !== '已退款'; }).reduce(function (a, b) { return a + b.amount; }, 0);
      var pendingCm = db.commissions.filter(function (c) { return c.status === '待结算'; }).reduce(function (a, b) { return a + b.amount; }, 0);
      var stats = [
        ['累计 GMV（元）', gmv, '+12.5%', 'up'],
        ['用户总数', db.clients.length + 1, '+3', 'up'],
        ['年度会员', memberCnt + ' 人', '+1', 'up'],
        ['引荐单', refCnt + ' 单', '+2', 'up'],
        ['待结算佣金（元）', pendingCm, '—', ''],
        ['合作线索', db.leads.length + ' 条', '+1', 'up']
      ];
      document.getElementById('statGrid').innerHTML = stats.map(function (s) {
        return '<div class="stat-card"><div class="k">' + s[0] + '</div><div class="v">' + s[1] + '</div><div class="d ' + s[3] + '">' + s[2] + '</div></div>';
      }).join('');

      Admin.drawChart();
      var rows = db.orders.slice(0, 5).map(function (o) {
        return '<tr><td>' + o.id + '</td><td>' + statusTag(o.type) + '</td><td>' + esc(o.product || o.boss || '—') + '</td><td>' + esc(o.user) + '</td><td>¥' + o.amount + '</td><td>' + statusTag(o.status) + '</td><td>' + o.time + '</td></tr>';
      }).join('');
      document.getElementById('recentOrders').innerHTML = '<tr><th>订单号</th><th>类型</th><th>内容</th><th>用户</th><th>金额</th><th>状态</th><th>时间</th></tr>' + rows;
    },

    drawChart: function () {
      var cv = document.getElementById('chart');
      if (!cv) return;
      var ctx = cv.getContext('2d');
      var W = cv.width, H = cv.height, pad = 34;
      ctx.clearRect(0, 0, W, H);
      var days = [], amounts = [], refs = [], locks = [];
      var db = S.get();
      for (var i = 6; i >= 0; i--) {
        var d = new Date(Date.now() - i * 86400000).toISOString().slice(5, 10);
        days.push(d);
        var amt = db.orders.filter(function (o) { return o.time.indexOf(d) >= 0 && o.status !== '已退款'; }).reduce(function (a, b) { return a + b.amount; }, 0);
        amounts.push(amt);
        refs.push(db.orders.filter(function (o) { return o.time.indexOf(d) >= 0 && o.type === '引荐'; }).length);
        locks.push(db.clients.filter(function (c) { return c.firstLock.indexOf('20' + d.replace('/', '-')) === 0 || c.firstLock.slice(5) === d; }).length);
      }
      var maxV = Math.max.apply(null, amounts.concat([100]));
      /* 网格 */
      ctx.strokeStyle = '#f0f1f3';
      for (var g = 0; g <= 4; g++) {
        var y = pad + (H - pad * 2) * g / 4;
        ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - 10, y); ctx.stroke();
        ctx.fillStyle = '#86909c'; ctx.font = '10px sans-serif';
        ctx.fillText(Math.round(maxV * (4 - g) / 4), 4, y + 3);
      }
      var n = days.length, step = (W - pad - 20) / (n - 1);
      function x(i) { return pad + i * step; }
      function yA(v) { return pad + (H - pad * 2) * (1 - v / maxV); }
      /* 金额面积 */
      ctx.beginPath(); ctx.moveTo(x(0), H - pad);
      amounts.forEach(function (v, i) { ctx.lineTo(x(i), yA(v)); });
      ctx.lineTo(x(n - 1), H - pad); ctx.closePath();
      var grad = ctx.createLinearGradient(0, pad, 0, H - pad);
      grad.addColorStop(0, 'rgba(22,103,209,.25)'); grad.addColorStop(1, 'rgba(22,103,209,.02)');
      ctx.fillStyle = grad; ctx.fill();
      ctx.beginPath();
      amounts.forEach(function (v, i) { i ? ctx.lineTo(x(i), yA(v)) : ctx.moveTo(x(i), yA(v)); });
      ctx.strokeStyle = '#1667d1'; ctx.lineWidth = 2; ctx.stroke();
      /* 引荐柱 */
      refs.forEach(function (v, i) {
        ctx.fillStyle = '#c9a44c';
        ctx.fillRect(x(i) - 5, H - pad - v * 14, 4, v * 14 || 2);
      });
      /* 锁粉柱 */
      locks.forEach(function (v, i) {
        ctx.fillStyle = '#00b578';
        ctx.fillRect(x(i) + 1, H - pad - v * 14, 4, v * 14 || 2);
      });
      /* X 轴 */
      ctx.fillStyle = '#86909c'; ctx.font = '10px sans-serif';
      days.forEach(function (d, i) { ctx.fillText(d, x(i) - 12, H - 10); });
    },

    /* ---------- 老板管理 ---------- */
    renderBosses: function () {
      var db = S.get();
      var kw = (document.getElementById('bossSearch') && document.getElementById('bossSearch').value || '').trim();
      var list = db.bosses.filter(function (b) { return !kw || (b.name + b.tag + b.title).indexOf(kw) >= 0; });
      document.getElementById('bossTable').innerHTML =
        '<tr><th>老板</th><th>行业标签</th><th>亮点（🏆）</th><th>引荐价</th><th>已对接</th><th>状态</th><th>操作</th></tr>' +
        list.map(function (b) {
          return '<tr><td><b>' + esc(b.name) + '</b><br><span style="color:#86909c;font-size:12px">' + esc(b.title) + '</span></td>' +
            '<td><span class="tagx blue">' + esc(b.tag) + '</span></td>' +
            '<td style="max-width:280px;font-size:12px;color:#4e5969">' + b.badges.map(esc).join('；') + '</td>' +
            '<td>¥' + b.price + '</td><td>' + b.matched + ' 人</td>' +
            '<td>' + (b.onShelf ? '<span class="tagx green">已上架</span>' : '<span class="tagx gray">已下架</span>') + '</td>' +
            '<td><button class="btn sm" onclick="Admin.editBoss(\'' + b.id + '\')">编辑</button> ' +
            '<button class="btn sm warn" onclick="Admin.toggleBoss(\'' + b.id + '\')">' + (b.onShelf ? '下架' : '上架') + '</button> ' +
            '<button class="btn sm danger" onclick="Admin.delBoss(\'' + b.id + '\')">删除</button></td></tr>';
        }).join('');
    },
    editBoss: function (id) {
      var db = S.get();
      var b = db.bosses.find(function (x) { return x.id === id; }) || { name: '', title: '', tag: '', badges: [], desc: '', detail: '', price: 100, onShelf: true, video: false, cover: '', videoUrl: '', videoCover: '', avatarImg: '', photos: [] };
      window._editTemp = { videoCover: b.videoCover || '', avatarImg: b.avatarImg || '', photos: (b.photos || []).slice(), legacyCover: b.cover || '' };
      modal('<h3>' + (id ? '编辑老板' : '新增老板') + '</h3>' +
        '<div class="mrow">' +
        '<div class="f"><label>姓名</label><input id="mName" value="' + esc(b.name) + '"></div>' +
        '<div class="f"><label>头衔</label><input id="mTitle" value="' + esc(b.title) + '"></div>' +
        '<div class="f"><label>行业标签</label><input id="mTag" value="' + esc(b.tag) + '"></div>' +
        '<div class="f"><label>引荐价格（元）</label><input id="mPrice" type="number" value="' + b.price + '"></div></div>' +
        '<div class="f"><label>亮点（每行一条）</label><textarea id="mBadges">' + esc(b.badges.join('\n')) + '</textarea></div>' +
        '<div class="f"><label>列表简介</label><textarea id="mDesc">' + esc(b.desc) + '</textarea></div>' +
        '<div class="f"><label>名片详情</label><textarea id="mDetail">' + esc(b.detail) + '</textarea></div>' +
        '<div class="f"><label>视频号链接（粘贴后点「抓取封面」，用户端点击封面直接跳转播放）</label>' +
        '<div style="display:flex;gap:8px"><input id="mVideoUrl" value="' + esc(b.videoUrl || '') + '" placeholder="https://channels.weixin.qq.com/... 或视频号分享链接" style="flex:1">' +
        '<button class="btn sm" onclick="Admin.grabCover()">抓取封面</button></div></div>' +
        '<div class="mrow">' +
        '<div class="f"><label>视频封面图（自动抓取或上传，900×450 自动裁剪压缩）</label>' +
        '<div style="display:flex;gap:10px;align-items:center">' +
        '<img id="pvCover" src="' + (window._editTemp.videoCover || '') + '" style="width:120px;height:60px;object-fit:cover;border-radius:8px;background:#f0f2f5;' + (window._editTemp.videoCover ? '' : 'display:none') + '">' +
        '<div><button class="btn sm" onclick="Admin.upCover()">📤 上传封面</button>' +
        '<div style="font-size:11px;color:#86909c;margin-top:4px" id="pvCoverTip">' + (window._editTemp.videoCover ? '已设置封面' : '未设置 · 无封面时展示默认样式') + '</div></div></div></div>' +
        '<div class="f"><label>老板头像（自动方形裁剪压缩至 300px）</label>' +
        '<div style="display:flex;gap:10px;align-items:center">' +
        '<img id="pvAva" src="' + (window._editTemp.avatarImg || '') + '" style="width:56px;height:56px;object-fit:cover;border-radius:50%;background:#f0f2f5;' + (window._editTemp.avatarImg ? '' : 'display:none') + '">' +
        '<div><button class="btn sm" onclick="Admin.upAva()">📤 上传头像</button>' +
        '<div style="font-size:11px;color:#86909c;margin-top:4px" id="pvAvaTip">' + (window._editTemp.avatarImg ? '已设置头像' : '未设置 · 显示姓名首字') + '</div></div></div></div></div>' +
        '<div class="f"><label>沙龙现场照片（可多选，自动压缩适配尺寸）</label>' +
        '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap" id="pvPhotos"></div>' +
        '<button class="btn sm" onclick="Admin.upPhotos()" style="margin-top:8px">📤 上传现场照片</button></div>' +
        '<div class="mrow">' +
        '<div class="f"><label>上架</label><select id="mOn"><option value="1" ' + (b.onShelf ? 'selected' : '') + '>上架</option><option value="0" ' + (!b.onShelf ? 'selected' : '') + '>下架</option></select></div></div>' +
        '<div class="mfoot"><button class="btn" onclick="Admin.closeModal()">取消</button><button class="btn primary" onclick="Admin.saveBoss(\'' + (id || '') + '\')">保存</button></div>');
      Admin.renderPhotoPv();
    },
    renderPhotoPv: function () {
      var box = document.getElementById('pvPhotos');
      if (!box) return;
      var t = window._editTemp;
      box.innerHTML = t.photos.map(function (src, i) {
        return '<span style="position:relative;display:inline-block"><img src="' + src + '" style="width:64px;height:44px;object-fit:cover;border-radius:6px">' +
          '<span onclick="Admin.delPhoto(' + i + ')" style="position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;background:#f53f3f;color:#fff;font-size:11px;display:flex;align-items:center;justify-content:center;cursor:pointer">✕</span></span>';
      }).join('') + (t.photos.length ? '' : '<span style="font-size:12px;color:#86909c">暂无照片</span>');
    },
    delPhoto: function (i) { window._editTemp.photos.splice(i, 1); Admin.renderPhotoPv(); },
    upPhotos: function () {
      ImgUp.pick({ ratio: 0, max: 1000, quality: 0.8, multiple: true }, function (urls) {
        window._editTemp.photos = window._editTemp.photos.concat(urls);
        Admin.renderPhotoPv();
        toast('已压缩并添加 ' + urls.length + ' 张');
      });
    },
    upCover: function () {
      ImgUp.pick({ ratio: 2, max: 900, quality: 0.82 }, function (urls) {
        window._editTemp.videoCover = urls[0];
        var pv = document.getElementById('pvCover');
        pv.src = urls[0]; pv.style.display = '';
        document.getElementById('pvCoverTip').textContent = '已设置封面（' + Math.round(urls[0].length / 1365) + 'KB）';
      });
    },
    upAva: function () {
      ImgUp.pick({ ratio: 1, max: 300, quality: 0.85 }, function (urls) {
        window._editTemp.avatarImg = urls[0];
        var pv = document.getElementById('pvAva');
        pv.src = urls[0]; pv.style.display = '';
        document.getElementById('pvAvaTip').textContent = '已设置头像';
      });
    },
    grabCover: function () {
      var u = document.getElementById('mVideoUrl').value.trim();
      if (!u) { toast('请先粘贴视频号链接'); return; }
      toast('正在抓取封面...');
      var base = location.origin.startsWith('http') ? location.origin : '';
      fetch(base + '/api/video/resolve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: u }) })
        .then(function (r) { return r.json(); })
        .then(function (r) {
          if (r.ok && r.cover) {
            var img = new Image();
            img.crossOrigin = '';
            img.onload = function () {
              var cv = document.createElement('canvas');
              var s = Math.min(img.naturalWidth, img.naturalHeight * 2);
              cv.width = 900; cv.height = 450;
              cv.getContext('2d').drawImage(img, (img.naturalWidth - s) / 2, 0, s, s / 2, 0, 0, 900, 450);
              window._editTemp.videoCover = cv.toDataURL('image/jpeg', 0.82);
              var pv = document.getElementById('pvCover');
              pv.src = window._editTemp.videoCover; pv.style.display = '';
              document.getElementById('pvCoverTip').textContent = '已自动抓取封面';
              toast('封面抓取成功');
            };
            img.onerror = function () { toast('封面图加载失败，请手动上传'); };
            img.src = r.cover;
          } else toast(r.msg || '未抓取到封面，请手动上传');
        }).catch(function () { toast('抓取失败，请手动上传封面'); });
    },
    saveBoss: function (id) {
      var db = S.get();
      var data = {
        name: document.getElementById('mName').value, title: document.getElementById('mTitle').value,
        tag: document.getElementById('mTag').value, price: +document.getElementById('mPrice').value || 100,
        badges: document.getElementById('mBadges').value.split('\n').filter(function (x) { return x.trim(); }),
        desc: document.getElementById('mDesc').value, detail: document.getElementById('mDetail').value,
        videoUrl: document.getElementById('mVideoUrl').value.trim(),
        videoCover: window._editTemp.videoCover || '', avatarImg: window._editTemp.avatarImg || '',
        photos: window._editTemp.photos || [],
        cover: window._editTemp.legacyCover || '',
        video: !!(document.getElementById('mVideoUrl').value.trim() || window._editTemp.videoCover),
        onShelf: document.getElementById('mOn').value === '1'
      };
      if (!data.name) { toast('请填写姓名'); return; }
      if (id) { Object.assign(db.bosses.find(function (x) { return x.id === id; }), data); }
      else { data.id = S.uid('b'); data.matched = 0; data.salons = 0; db.bosses.unshift(data); }
      S.save(); closeModal(); Admin.renderBosses(); toast('已保存，用户端实时生效');
    },
    toggleBoss: function (id) {
      var db = S.get(); var b = db.bosses.find(function (x) { return x.id === id; });
      b.onShelf = !b.onShelf; S.save(); Admin.renderBosses(); toast(b.onShelf ? '已上架' : '已下架');
    },
    delBoss: function (id) {
      if (!confirm('确定删除该老板资源？')) return;
      var db = S.get();
      db.bosses = db.bosses.filter(function (x) { return x.id !== id; });
      S.save(); Admin.renderBosses(); toast('已删除');
    },

    /* ---------- 沙龙管理 ---------- */
    renderSalons: function () {
      var db = S.get();
      document.getElementById('salonTable').innerHTML =
        '<tr><th>沙龙</th><th>日期</th><th>地点</th><th>名额</th><th>已报名</th><th>状态</th><th>操作</th></tr>' +
        db.salons.map(function (s) {
          return '<tr><td><b>' + esc(s.title) + '</b></td><td>' + s.date + '</td><td>' + esc(s.city + ' · ' + s.place) + '</td>' +
            '<td>' + s.seats + '</td><td>' + s.joined + '</td><td>' + statusTag(s.status) + '</td>' +
            '<td><button class="btn sm" onclick="Admin.editSalon(\'' + s.id + '\')">编辑</button> ' +
            (s.status !== '已结束' ? '<button class="btn sm warn" onclick="Admin.cycleSalon(\'' + s.id + '\')">切状态</button> ' : '') +
            '<button class="btn sm danger" onclick="Admin.delSalon(\'' + s.id + '\')">删除</button></td></tr>';
        }).join('');
    },
    editSalon: function (id) {
      var db = S.get();
      var s = db.salons.find(function (x) { return x.id === id; }) || { title: '', date: S.today(), city: '深圳', place: '', seats: 60, status: '筹备中', desc: '' };
      modal('<h3>' + (id ? '编辑沙龙' : '新增沙龙') + '</h3>' +
        '<div class="f"><label>标题</label><input id="mTitle" value="' + esc(s.title) + '"></div>' +
        '<div class="mrow">' +
        '<div class="f"><label>日期</label><input id="mDate" type="date" value="' + s.date + '"></div>' +
        '<div class="f"><label>城市</label><input id="mCity" value="' + esc(s.city) + '"></div>' +
        '<div class="f"><label>地点</label><input id="mPlace" value="' + esc(s.place) + '"></div>' +
        '<div class="f"><label>名额</label><input id="mSeats" type="number" value="' + s.seats + '"></div>' +
        '<div class="f"><label>状态</label><select id="mStatus">' + ['筹备中', '报名中', '已结束'].map(function (x) { return '<option ' + (s.status === x ? 'selected' : '') + '>' + x + '</option>'; }).join('') + '</select></div></div>' +
        '<div class="f"><label>描述</label><textarea id="mDesc">' + esc(s.desc) + '</textarea></div>' +
        '<div class="f"><label>现场照片（可多选，自动压缩适配尺寸）</label>' +
        '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap" id="pvPhotos"></div>' +
        '<button class="btn sm" onclick="Admin.upSalonPhotos()" style="margin-top:8px">📤 上传现场照片</button></div>' +
        '<div class="mfoot"><button class="btn" onclick="Admin.closeModal()">取消</button><button class="btn primary" onclick="Admin.saveSalon(\'' + (id || '') + '\')">保存</button></div>');
      window._editTemp = { photos: (s.photos || []).slice() };
      Admin.renderPhotoPv();
    },
    upSalonPhotos: function () {
      ImgUp.pick({ ratio: 0, max: 1000, quality: 0.8, multiple: true }, function (urls) {
        window._editTemp.photos = window._editTemp.photos.concat(urls);
        Admin.renderPhotoPv();
        toast('已压缩并添加 ' + urls.length + ' 张');
      });
    },
    saveSalon: function (id) {
      var db = S.get();
      var data = {
        title: document.getElementById('mTitle').value, date: document.getElementById('mDate').value,
        city: document.getElementById('mCity').value, place: document.getElementById('mPlace').value,
        seats: +document.getElementById('mSeats').value || 60, status: document.getElementById('mStatus').value,
        desc: document.getElementById('mDesc').value,
        photos: window._editTemp.photos || []
      };
      if (!data.title) { toast('请填写标题'); return; }
      if (id) { Object.assign(db.salons.find(function (x) { return x.id === id; }), data); }
      else { data.id = S.uid('s'); data.joined = 0; data.banner = 'boss'; db.salons.unshift(data); }
      S.save(); closeModal(); Admin.renderSalons(); toast('已保存（用户端沙龙 Tab 实时刷新）');
    },
    cycleSalon: function (id) {
      var db = S.get(); var s = db.salons.find(function (x) { return x.id === id; });
      var order = ['筹备中', '报名中', '已结束'];
      s.status = order[(order.indexOf(s.status) + 1) % order.length];
      S.save(); Admin.renderSalons(); toast('状态：' + s.status);
    },
    delSalon: function (id) {
      if (!confirm('确定删除该沙龙？')) return;
      var db = S.get();
      db.salons = db.salons.filter(function (x) { return x.id !== id; });
      S.save(); Admin.renderSalons(); toast('已删除');
    },

    /* ---------- 订单 ---------- */
    renderOrders: function () {
      var db = S.get();
      var t = document.getElementById('orderType').value;
      var st = document.getElementById('orderStatus').value;
      var list = db.orders.filter(function (o) { return (!t || o.type === t) && (!st || o.status === st); });
      document.getElementById('orderTable').innerHTML =
        '<tr><th>订单号</th><th>类型</th><th>内容</th><th>用户</th><th>分销员</th><th>金额</th><th>佣金</th><th>状态</th><th>时间</th><th>操作</th></tr>' +
        list.map(function (o) {
          return '<tr><td>' + o.id + '</td><td>' + statusTag(o.type) + '</td><td>' + esc(o.product || o.boss || '—') + '</td>' +
            '<td>' + esc(o.user) + '</td><td>' + esc(o.distributor || '—') + '</td><td>¥' + o.amount + '</td><td>¥' + (o.commission || 0) + '</td>' +
            '<td>' + statusTag(o.status) + '</td><td>' + o.time + '</td>' +
            '<td>' + (o.status === '待对接' ? '<button class="btn sm primary" onclick="Admin.setOrder(\'' + o.id + '\',\'已对接\')">确认对接</button>' : '') +
            (o.status === '已对接' ? '<button class="btn sm primary" onclick="Admin.setOrder(\'' + o.id + '\',\'已完成\')">完成</button>' : '') +
            (o.status !== '已退款' ? ' <button class="btn sm danger" onclick="Admin.setOrder(\'' + o.id + '\',\'已退款\')">退款</button>' : '') + '</td></tr>';
        }).join('');
    },
    setOrder: function (id, status) {
      if (status === '已退款' && !confirm('确认退款？佣金将同步作废。')) return;
      var db = S.get();
      var o = db.orders.find(function (x) { return x.id === id; });
      o.status = status;
      db.commissions.forEach(function (c) { if (c.order === id) c.status = status === '已退款' ? '已结算' : (status === '已完成' ? '待结算' : c.status); });
      S.save(); Admin.renderOrders(); Admin.renderDash(); toast('订单已更新为：' + status);
    },

    /* ---------- 用户 ---------- */
    renderUsers: function () {
      var db = S.get();
      var rows = [db.user].concat(db.clients.map(function (c) {
        return { nickname: c.nickname, role: '客户', maskedPhone: '—', memberUntil: '', openid: c.openid, locked: c.locked, firstLock: c.firstLock, id: c.id };
      })).map(function (u) {
        return '<tr><td><b>' + esc(u.nickname) + '</b><br><span style="font-size:11px;color:#86909c">' + (u.openid || '本人账号') + '</span></td>' +
          '<td>' + (u.role === '分销员' ? '<span class="tagx gold">分销员</span>' : u.role === '会员' ? '<span class="tagx blue">会员</span>' : '<span class="tagx gray">客户</span>') + '</td>' +
          '<td>' + u.maskedPhone + '</td>' +
          '<td>' + (u.memberUntil ? '至 ' + u.memberUntil : '—') + '</td>' +
          '<td>' + (u.firstLock || '—') + '</td>' +
          '<td>' + (u.role !== '分销员' ? '<button class="btn sm primary" onclick="Admin.makeDist(\'' + u.id + '\')">开通分销员</button>' : '<span class="tagx green">已开通</span>') + '</td></tr>';
      }).join('');
      document.getElementById('userTable').innerHTML = '<tr><th>用户</th><th>角色</th><th>手机号</th><th>会员有效期</th><th>首次锁粉</th><th>操作</th></tr>' + rows;
    },
    makeDist: function (id) {
      if (id === 'u_1001') { toast('本人已是分销员'); return; }
      var db = S.get();
      var c = db.clients.find(function (x) { return x.id === id; });
      if (c) { c.locked = false; toast(c.nickname + ' 已开通分销员（演示）'); }
      S.save(); Admin.renderUsers();
    },

    /* ---------- 分销佣金 ---------- */
    renderDistribute: function () {
      var db = S.get();
      var sum = function (st) { return db.commissions.filter(function (c) { return c.status === st; }).reduce(function (a, b) { return a + b.amount; }, 0); };
      document.getElementById('distStats').innerHTML =
        [['待结算佣金（元）', sum('待结算')], ['结算中佣金（元）', sum('结算中')], ['已结算佣金（元）', sum('已结算')],
         ['锁粉客户', db.clients.length + ' 人'], ['锁定中', db.clients.filter(function (c) { return c.locked; }).length + ' 人'], ['分销员', '1 人']].map(function (s) {
          return '<div class="stat-card"><div class="k">' + s[0] + '</div><div class="v">' + s[1] + '</div></div>';
        }).join('');
      document.getElementById('commissionTable').innerHTML =
        '<tr><th>单号</th><th>类型</th><th>金额</th><th>状态</th><th>时间</th><th>操作</th></tr>' +
        db.commissions.map(function (c) {
          return '<tr><td>' + c.order + '</td><td>' + c.type + '</td><td>¥' + c.amount + '</td><td>' + statusTag(c.status) + '</td><td>' + c.time + '</td>' +
            '<td>' + (c.status !== '已结算' ? '<button class="btn sm primary" onclick="Admin.settle(\'' + c.id + '\')">结算</button>' : '') + '</td></tr>';
        }).join('');
      document.getElementById('clientTable').innerHTML =
        '<tr><th>客户</th><th>锁粉状态</th><th>首次锁定</th><th>到期</th><th>归属</th><th>累计佣金</th></tr>' +
        db.clients.map(function (c) {
          return '<tr><td>' + esc(c.nickname) + '</td><td>' + (c.locked ? '<span class="tagx blue">锁定中</span>' : '<span class="tagx green">已解锁</span>') + '</td>' +
            '<td>' + c.firstLock + '</td><td>' + (c.lockUntil || '—') + '</td><td>' + esc(c.owner) + '</td><td>¥' + c.commissionTotal + '</td></tr>';
        }).join('');
    },
    settle: function (id) {
      var db = S.get();
      db.commissions.find(function (c) { return c.id === id; }).status = '已结算';
      S.save(); Admin.renderDistribute(); toast('佣金已结算');
    },

    /* ---------- 线索 ---------- */
    renderLeads: function () {
      var db = S.get();
      document.getElementById('leadTable').innerHTML =
        '<tr><th>客户</th><th>业务</th><th>想怎么合作</th><th>预算档</th><th>来源</th><th>状态</th><th>时间</th><th>操作</th></tr>' +
        db.leads.map(function (l) {
          return '<tr><td><b>' + esc(l.name) + '</b><br><span style="font-size:11px;color:#86909c">' + esc(l.contact) + '</span></td>' +
            '<td style="max-width:220px;font-size:12px">' + esc(l.biz) + (l.result ? '<br>结果：' + esc(l.result) : '') + '</td>' +
            '<td>' + l.coopTypes.map(function (t) { return '<span class="tagx blue">' + esc(t) + '</span>'; }).join(' ') +
            (l.coopDetail ? '<div style="font-size:11px;color:#86909c;margin-top:4px">' + esc(l.coopDetail) + '</div>' : '') + '</td>' +
            '<td>' + esc(l.budget) + '</td><td>' + esc(l.from) + '</td><td>' + statusTag(l.status) + '</td><td>' + l.time + '</td>' +
            '<td>' + (l.status === '待跟进' ? '<button class="btn sm primary" onclick="Admin.setLead(\'' + l.id + '\')">标记已合作</button>' : '') + '</td></tr>';
        }).join('');
    },
    setLead: function (id) {
      var db = S.get();
      db.leads.find(function (l) { return l.id === id; }).status = '已合作';
      S.save(); Admin.renderLeads(); toast('已标记为已合作');
    },

    /* ---------- 公告 ---------- */
    renderNotices: function () {
      var db = S.get();
      document.getElementById('noticeTable').innerHTML =
        '<tr><th>类型</th><th>标题</th><th>内容</th><th>日期</th><th>操作</th></tr>' +
        db.notices.map(function (n) {
          return '<tr><td><span class="tagx gold">' + esc(n.type) + '</span></td><td><b>' + esc(n.title) + '</b></td>' +
            '<td style="max-width:360px;font-size:12px;color:#4e5969">' + esc(n.content) + '</td><td>' + n.date + '</td>' +
            '<td><button class="btn sm" onclick="Admin.editNotice(\'' + n.id + '\')">编辑</button> ' +
            '<button class="btn sm danger" onclick="Admin.delNotice(\'' + n.id + '\')">删除</button></td></tr>';
        }).join('');
    },
    editNotice: function (id) {
      var db = S.get();
      var n = db.notices.find(function (x) { return x.id === id; }) || { type: '技巧与通知', title: '', content: '', date: new Date().getMonth() + 1 + '月' + new Date().getDate() + '日' };
      modal('<h3>' + (id ? '编辑公告' : '新增公告') + '</h3>' +
        '<div class="mrow">' +
        '<div class="f"><label>类型</label><input id="mType" value="' + esc(n.type) + '"></div>' +
        '<div class="f"><label>日期</label><input id="mDate" value="' + esc(n.date) + '"></div></div>' +
        '<div class="f"><label>标题</label><input id="mTitle" value="' + esc(n.title) + '"></div>' +
        '<div class="f"><label>内容</label><textarea id="mContent" style="min-height:110px">' + esc(n.content) + '</textarea></div>' +
        '<div class="mfoot"><button class="btn" onclick="Admin.closeModal()">取消</button><button class="btn primary" onclick="Admin.saveNotice(\'' + (id || '') + '\')">保存</button></div>');
    },
    saveNotice: function (id) {
      var db = S.get();
      var data = {
        type: document.getElementById('mType').value, date: document.getElementById('mDate').value,
        title: document.getElementById('mTitle').value, content: document.getElementById('mContent').value
      };
      if (!data.title) { toast('请填写标题'); return; }
      if (id) { Object.assign(db.notices.find(function (x) { return x.id === id; }), data); }
      else { data.id = S.uid('n'); data.pinned = true; db.notices.unshift(data); }
      S.save(); closeModal(); Admin.renderNotices(); toast('公告已发布，用户端实时可见');
    },
    delNotice: function (id) {
      if (!confirm('确定删除该公告？')) return;
      var db = S.get();
      db.notices = db.notices.filter(function (x) { return x.id !== id; });
      S.save(); Admin.renderNotices(); toast('已删除');
    },

    /* ---------- 配置 ---------- */
    renderConfig: function () {
      var c = S.get().config;
      var g1 = [['memberPrice', '年度会员价格（元/年）'], ['referralPrice', '默认引荐价格（元）'], ['memberCommissionRate', '会员佣金比例（%）'], ['salonCommissionRate', '沙龙佣金比例（%）'], ['lockDays', '锁粉有效期（天）'], ['refundHours', '引荐超时退款（小时）']];
      var g2 = [['siteName', '站点名称'], ['domain', '站点域名'], ['organizer', '主办方'], ['salonHeld', '沙龙成果文案'], ['privatePool', '私域规模文案'], ['serviceWechat', '客服微信号'], ['wecomQRText', '企业微信码内容']];
      function render(list, elId) {
        document.getElementById(elId).innerHTML = list.map(function (x) {
          return '<div class="cfg-item"><div class="ck">' + x[1] + '</div><input id="cfg_' + x[0] + '" value="' + esc(c[x[0]]) + '"></div>';
        }).join('');
      }
      render(g1, 'cfgGrid1'); render(g2, 'cfgGrid2');
    },
    saveConfig: function () {
      var db = S.get();
      Object.keys(db.config).forEach(function (k) {
        var el = document.getElementById('cfg_' + k);
        if (el) {
          var v = el.value;
          db.config[k] = (typeof db.config[k] === 'number') ? (+v || 0) : v;
        }
      });
      S.save(); toast('配置已保存，用户端实时生效');
    },

    closeModal: closeModal,

    /* 拉取云端最新内容（其他设备/电脑后台改过的数据）并刷新界面 */
    pullCloud: function () {
      if (!S.initSync) return;
      S.initSync(function () {
        Admin.renderAll();
        toast('已同步云端最新数据');
      }, function () {
        toast('云端连接失败，当前显示本地缓存');
      });
    }
  };

  /* 自动登录恢复 & 侧边栏绑定 */
  if (sessionStorage.getItem('TQ_ADMIN') === '1') {
    document.getElementById('loginMask').style.display = 'none';
    document.getElementById('admin').style.display = 'block';
    Admin.renderAll();
    Admin.pullCloud();
  }
  document.querySelectorAll('.sb-item').forEach(function (i) {
    i.onclick = function () { Admin.go(i.dataset.page); };
  });
})();
