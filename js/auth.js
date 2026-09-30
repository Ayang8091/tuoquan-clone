/* ============================================================
 * 拓圈AI · 登录/注册模块
 * 流程：微信授权（微信内网页授权 / 微信外扫码，未配置走演示模式）
 *      → 未绑定手机号则进入手机号+短信验证码绑定 → 注册完成
 * 登录态存 localStorage: TQ_SESSION
 * ============================================================ */
(function (global) {
  'use strict';

  var SESSION_KEY = 'TQ_SESSION';
  var CFG = (global.WX_CONFIG = global.WX_CONFIG || {});

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
    hasPhone: function () { var s = Auth.getSession(); return !!(s && s.phone); },
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
    /* 演示模式：模拟微信用户 */
    demoWx: function (label) {
      return {
        openid: 'demo_openid_' + Math.random().toString(36).slice(2, 10),
        nickname: '微信用户' + Math.random().toString(36).slice(2, 6).toUpperCase(),
        avatar: '',
        demo: true, label: label || '演示授权'
      };
    },

    /* ---------- 手机号绑定 ---------- */
    sendSms: function (phone) {
      if (!/^1\d{10}$/.test(phone)) return Promise.reject(new Error('请输入正确的手机号'));
      return api('/sms/send', { phone: phone }).then(function (r) {
        if (r.offline) return { ok: true, demo: true, demoCode: '123456' }; // 无后端演示模式
        if (!r.ok) throw new Error(r.msg || '发送失败');
        return r; // { ok:true, demoCode?:'123456' } 演示模式会返回固定码
      });
    },
    bindPhone: function (phone, smsCode, wxUser) {
      return api('/sms/verify', { phone: phone, code: smsCode }).then(function (r) {
        if (r.offline) { // 无后端：本地校验演示码
          if (smsCode !== '123456') throw new Error('验证码错误（演示模式验证码为 123456）');
          r = { ok: true };
        }
        if (!r.ok) throw new Error(r.msg || '验证码错误');
        var s = Auth.getSession() || wxUser || Auth.demoWx();
        s.phone = phone; s.wxNicknameBound = true;
        Auth.setSession(s);
        return s;
      });
    },
    /* 手机号+验证码直接登录（未走微信时） */
    phoneLogin: function (phone, smsCode) {
      return api('/sms/verify', { phone: phone, code: smsCode }).then(function (r) {
        if (r.offline) {
          if (smsCode !== '123456') throw new Error('验证码错误（演示模式验证码为 123456）');
          r = { ok: true };
        }
        if (!r.ok) throw new Error(r.msg || '验证码错误');
        var s = Auth.getSession() || Auth.demoWx('手机号登录');
        s.phone = phone; s.wxNicknameBound = true;
        Auth.setSession(s);
        return s;
      });
    },

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
        // 清理 URL 参数
        history.replaceState(null, '', location.pathname);
        return true;
      });
    }
  };

  global.Auth = Auth;
})(window);
