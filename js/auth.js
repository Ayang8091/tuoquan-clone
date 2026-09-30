/* ============================================================
 * 拓圈AI · 登录模块
 * 流程：进入登录页 → 直接唤起微信授权（微信内网页授权 / 微信外扫码，
 *      未配置 AppID 时走演示模式）→ 授权成功即完成登录并锁定身份
 * 登录态存 localStorage: TQ_SESSION
 * ============================================================ */
(function (global) {
  'use strict';

  var SESSION_KEY = 'TQ_SESSION';
  var CFG = (global.WX_CONFIG = global.WX_CONFIG || {});

  /* 演示头像：绿色圆形 + 昵称首字（真实授权时使用微信头像 headimgurl） */
  function demoAvatar(name) {
    var ch = String(name || '微').charAt(0);
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" rx="48" fill="#07c160"/><text x="48" y="62" font-size="40" text-anchor="middle" fill="#fff" font-family="sans-serif">' + ch + '</text></svg>';
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }

  function api(path, data) {
    var base = CFG.apiBase || '/api';
    return fetch(base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data || {})
    }).then(function (r) { return r.json(); })
      .catch(function () { return { offline: true }; }); // 纯静态部署（无后端）时走前端演示逻辑
  }

  var Auth = {
    /* ---------- 登录态 ---------- */
    getSession: function () {
      try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) { return null; }
    },
    setSession: function (s) { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); },
    logout: function () { localStorage.removeItem(SESSION_KEY); },

    isLoggedIn: function () { return !!Auth.getSession(); },
    isWeChat: function () { return /MicroMessenger/i.test(navigator.userAgent); },

    /* ---------- 微信授权 ---------- */
    /* 微信内：公众号网页授权跳转 */
    wxMpLogin: function () {
      var appid = CFG.mpAppId;
      if (!appid) return Promise.resolve(Auth.demoWx('微信内授权'));
      var redirect = encodeURIComponent((CFG.authDomain || location.origin) + '/index.html?from=wxmp');
      var url = 'https://open.weixin.qq.com/connect/oauth2/authorize?appid=' + appid +
        '&redirect_uri=' + redirect + '&response_type=code&scope=snsapi_userinfo' +
        '&state=tq_' + Date.now() + '#wechat_redirect';
      location.href = url;
      return Promise.resolve(null);
    },
    /* 微信外：开放平台网站应用扫码 */
    wxOpenLogin: function () {
      var appid = CFG.openAppId;
      if (!appid) return Promise.resolve(Auth.demoWx('扫码授权'));
      var redirect = encodeURIComponent((CFG.authDomain || location.origin) + '/index.html?from=wxopen');
      var url = 'https://open.weixin.qq.com/connect/qrconnect?appid=' + appid +
        '&redirect_uri=' + redirect + '&response_type=code&scope=snsapi_login' +
        '&state=tq_' + Date.now() + '#wechat_redirect';
      window.open(url, '_blank');
      return Promise.resolve(null);
    },
    /* 授权回调：用 code 换用户信息（真实模式走后端，演示模式本地模拟） */
    exchangeCode: function (code, from) {
      if (from === 'wxopen' && !CFG.openAppId || from === 'wxmp' && !CFG.mpAppId) {
        return Promise.resolve(Auth.demoWx(from === 'wxopen' ? '扫码授权' : '微信内授权'));
      }
      return api('/wx/exchange', { code: code, from: from }).then(function (r) {
        if (r && r.openid) return r;
        throw new Error(r && r.msg || '微信授权失败');
      });
    },
    /* 演示模式：模拟微信用户（含生成的头像，展示微信名+头像效果） */
    demoWx: function (label) {
      var nickname = '微信用户' + Math.random().toString(36).slice(2, 6).toUpperCase();
      return {
        openid: 'demo_openid_' + Math.random().toString(36).slice(2, 10),
        nickname: nickname,
        avatar: demoAvatar(nickname),
        demo: true, label: label || '演示授权'
      };
    },

    /* 微信内自动授权登录：进入页面即识别微信并完成登录，无需点击
     * - 已配置 mpAppId：直接跳转公众号网页授权（回调后自动完成）
     * - 未配置（演示模式）：本地生成演示微信身份直登
     * 返回 Promise(session) 或 null（无需/无法自动登录） */
    tryAutoLogin: function () {
      if (!Auth.isWeChat() || Auth.isLoggedIn()) return null;
      if (CFG.mpAppId) {
        if (sessionStorage.getItem('TQ_AUTH_TRIED')) return null; // 防授权死循环
        sessionStorage.setItem('TQ_AUTH_TRIED', '1');
        return Auth.wxMpLogin(); // 跳转微信授权页，返回 null
      }
      var s = Auth.demoWx('微信自动授权');
      Auth.setSession(s);
      return Promise.resolve(s);
    },

    /* ---------- 手机号绑定（已移除：登录流程 = 微信授权即登录） ---------- */

    /* 同步登录态到业务数据层（昵称/手机号） */
    syncToStore: function () {
      var s = Auth.getSession();
      if (!s || !global.Store) return;
      var db = global.Store.get();
      db.user.nickname = s.nickname || db.user.nickname;
      if (s.phone) { db.user.phone = s.phone; db.user.maskedPhone = global.Store.maskPhone(s.phone); }
      db.user.wxNicknameBound = !!s.wxNicknameBound;
      if (s.avatar) db.user.avatar = s.avatar;
      global.Store.save();
    },

    /* 微信回调 URL 处理：?code=xxx&from=wxmp */
    handleCallback: function () {
      var q = new URLSearchParams(location.search);
      var code = q.get('code');
      var from = q.get('from');
      if (!code || !from) return Promise.resolve(false);
      return Auth.exchangeCode(code, from).then(function (wxUser) {
        Auth.setSession(wxUser);
        sessionStorage.removeItem('TQ_AUTH_TRIED');
        // 清理 URL 参数
        history.replaceState(null, '', location.pathname);
        return true;
      });
    }
  };

  global.Auth = Auth;
})(window);
