/* ============================================================
 * 乐道AI · 微信分享卡片（JS-SDK 自定义分享）
 * ------------------------------------------------------------
 * 职责：微信内置浏览器内，通过 JS-SDK 设置「转发给朋友 / 分享朋友圈」
 *       的标题、摘要、缩略图。纯增量脚本，不改任何业务逻辑与样式。
 * 降级策略：
 *   - 普通浏览器：不加载 JS-SDK（head 里的 OG meta 供 QQ/微博等抓取）
 *   - 微信内但后端未配置 WX_APPID/WX_SECRET 或签名失败：
 *     静默降级为微信默认卡片（标题取 document.title）
 * 后端配合：POST /api/wx/signature（见 server.js，需环境变量 WX_APPID/WX_SECRET，
 *   且公众号后台需配置 JS 接口安全域名 + IP 白名单）
 * ============================================================ */
(function () {
  'use strict';
  var IN_WX = /MicroMessenger/i.test(navigator.userAgent || '');
  var SHARE = window.WX_SHARE || {};

  function absUrl(u) {
    u = String(u || '');
    if (/^https?:\/\//i.test(u)) return u;
    return location.origin + location.pathname.replace(/[^/]*$/, '') + u.replace(/^\//, '');
  }

  var shareData = {
    title: SHARE.title || document.title,
    desc: SHARE.desc || '名额有限，马上报名',
    link: SHARE.link || (location.origin + location.pathname), /* 分享链接域名必须与当前页面一致 */
    imgUrl: absUrl(SHARE.imgUrl || 'img/logo-icon.png')
  };

  /* ---------- 按当前路由动态生成分享内容（对齐设计稿：标题+描述+缩略图） ---------- */
  function routeShare() {
    var db = (window.Store && window.Store.get()) || {};
    var c = db.config || {};
    var brand = c.siteName || '乐道AI';
    var def = {
      title: brand + ' · AI 老板资源圈',
      desc: 'AI 出海老板沙龙 · 16000+ 私域老板资源对接 · 名额有限，马上报名',
      imgUrl: absUrl(SHARE.imgUrl || 'img/logo-icon.png')
    };
    var h = (location.hash || '#/').replace('#/', '');
    var seg = h.split('/');
    function salonOf(id) { return (db.salons || []).filter(function (s) { return s.id === id; })[0]; }
    var m = {
      '': { t: '沙龙活动', d: '名额有限，马上报名' },
      'salon': { t: '沙龙活动', d: '名额有限，马上报名' },
      'salons': { t: '沙龙活动', d: '名额有限，马上报名' },
      'boss': { t: '老板资源', d: '真实老板 · 真实资源 · 线下实地探访' },
      'bosses': { t: '老板资源', d: '真实老板 · 真实资源 · 线下实地探访' },
      'circle': { t: '老板圈子', d: '供应链 / 渠道 / 流量，进圈直接对接' },
      'vip': { t: '年度老板会员', d: '全年沙龙免门票 · 老板资源免费引荐' },
      'member': { t: '年度老板会员', d: '全年沙龙免门票 · 老板资源免费引荐' },
      'poster': { t: '商务合作', d: '16000+ 私域老板 · 供货 / 分销 / 联名都能谈' },
      'poster-salons': { t: '沙龙邀请函', d: '名额有限，扫码报名' },
      'poster-salon': { t: '沙龙邀请函', d: '名额有限，扫码报名' },
      'poster-boss': { t: '探访实录', d: '看老板都在聊什么' },
      'coop-apply': { t: '商务合作', d: '主理人 24 小时内联系你 · 不收费' },
      'distro': { t: '分销中心', d: '转发即分销，成交拿佣金' },
      'login': { t: '沙龙活动', d: '名额有限，马上报名' }
    }[seg[0]];
    if (seg[0] === 'salon-detail' && seg[1]) {
      var s = salonOf(seg[1]);
      if (s) return { title: brand + ' · ' + s.title, desc: (s.date || '') + ' ' + (s.time || '') + ' · ' + (s.city || s.place || '') + ' · 名额有限，马上报名', imgUrl: def.imgUrl };
    }
    if (seg[0] === 'poster-salon' && seg[1]) {
      var s2 = salonOf(seg[1]);
      if (s2) return { title: brand + ' · ' + s2.title, desc: '名额有限，扫码报名', imgUrl: def.imgUrl };
    }
    if (!m) return def;
    return { title: brand + ' · ' + m.t, desc: m.d, imgUrl: def.imgUrl };
  }

  var wxReady = false;
  function applyShare() {
    shareData = routeShare();
    shareData.link = SHARE.link || (location.origin + location.pathname + (location.hash || '#/')); /* 带当前页面路由 */
    if (wxReady) {
      try {
        wx.updateAppMessageShareData(shareData);
        wx.updateTimelineShareData({ title: shareData.title, link: shareData.link, imgUrl: shareData.imgUrl });
      } catch (e) { /* 卡片更新失败不影响页面 */ }
    }
  }
  window.addEventListener('hashchange', applyShare);

  function initWxSdk() {
    /* JS-SDK 官方 CDN，仅微信内需要 */
    var s = document.createElement('script');
    s.src = 'https://res.wx.qq.com/open/js/jweixin-1.6.0.js';
    s.onload = function () {
      /* 当前 URL（不含 hash）必须与签名时用的 url 完全一致 */
      fetch('/api/wx/signature', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: location.href.split('#')[0] })
      }).then(function (r) { return r.json(); }).then(function (cfg) {
        if (!cfg || !cfg.ok) return; /* 未配置或签名失败：保持微信默认卡片，不打扰用户 */
        wx.config({
          debug: false,
          appId: cfg.appId,
          timestamp: cfg.timestamp,
          nonceStr: cfg.nonceStr,
          signature: cfg.signature,
          jsApiList: ['updateAppMessageShareData', 'updateTimelineShareData']
        });
        wx.ready(function () {
          wxReady = true;
          applyShare();   /* 用当前路由内容设置朋友 + 朋友圈卡片 */
        });
        wx.error(function (res) { console.warn('[wechat-share] wx.error:', res && res.errMsg); });
      }).catch(function () { /* 签名接口不可达：静默降级 */ });
    };
    document.head.appendChild(s);
  }

  if (!IN_WX) return;
  applyShare();   /* 首次进入也按当前路由生成卡片内容 */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initWxSdk);
  else initWxSdk();
})();
