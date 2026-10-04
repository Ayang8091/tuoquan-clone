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
          wx.updateAppMessageShareData(shareData);                       /* 转发给朋友 */
          wx.updateTimelineShareData({ title: shareData.title, link: shareData.link, imgUrl: shareData.imgUrl }); /* 朋友圈 */
        });
        wx.error(function (res) { console.warn('[wechat-share] wx.error:', res && res.errMsg); });
      }).catch(function () { /* 签名接口不可达：静默降级 */ });
    };
    document.head.appendChild(s);
  }

  if (!IN_WX) return;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initWxSdk);
  else initWxSdk();
})();
