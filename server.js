/* ============================================================
 * 拓圈AI · 复刻系统 —— 轻量后端（零依赖，node server.js）
 * ------------------------------------------------------------
 * 职责：
 *   1. 托管静态前端（index.html / admin.html）
 *   2. /api/wx/exchange  微信 code 换取用户信息（真实接入需环境变量）
 *   3. /api/sms/send     发送短信验证码（演示模式固定 123456）
 *   4. /api/sms/verify   校验短信验证码
 *
 * 真实接入环境变量：
 *   WX_APPID / WX_SECRET   公众号网页授权（微信内）
 *   OPEN_APPID / OPEN_SECRET  开放平台网站应用（微信外扫码，换取
 *                              access_token 需再经 code→token 两步，此处
 *                              已留 TODO 标注）
 *   SMS_PROVIDER_KEY       短信服务商密钥（腾讯云/阿里云 SDK 接入点）
 *
 * 运行：node server.js [端口，默认 8080]
 * ============================================================ */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 8080;
const ROOT = __dirname;
const WX_APPID = process.env.WX_APPID || '';
const WX_SECRET = process.env.WX_SECRET || '';
const SMS_KEY = process.env.SMS_PROVIDER_KEY || '';

/* 内存验证码池（生产请换 Redis） */
const smsPool = new Map(); // phone -> { code, expires }

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch (e) { resolve({}); } });
  });
}
function httpsGet(target) {
  return new Promise((resolve, reject) => {
    https.get(target, (r) => {
      let raw = '';
      r.on('data', (c) => (raw += c));
      r.on('end', () => { try { resolve(JSON.parse(raw)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}
function randomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/* ---------- API 处理 ---------- */
const apiHandlers = {
  /* 微信 code 换用户信息 */
  'wx/exchange': async (body, res) => {
    const from = body.from || 'wxmp';
    const appid = from === 'wxopen' ? (process.env.OPEN_APPID || '') : WX_APPID;
    const secret = from === 'wxopen' ? (process.env.OPEN_SECRET || '') : WX_SECRET;
    if (!appid || !secret) {
      // 演示模式
      return json(res, 200, {
        openid: 'demo_' + Math.random().toString(36).slice(2, 10),
        nickname: '微信用户' + Math.random().toString(36).slice(2, 6).toUpperCase(),
        avatar: '', demo: true, label: '演示授权'
      });
    }
    try {
      if (from === 'wxmp') {
        /* 公众号网页授权：code 换 access_token + openid，再拉取用户信息 */
        const t = await httpsGet(
          `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${appid}&secret=${secret}&code=${body.code}&grant_type=authorization_code`);
        if (t.errcode) return json(res, 200, { ok: false, msg: '微信授权失败：' + t.errmsg });
        const u = await httpsGet(
          `https://api.weixin.qq.com/sns/userinfo?access_token=${t.access_token}&openid=${t.openid}&lang=zh_CN`);
        json(res, 200, { openid: u.openid, nickname: u.nickname, avatar: u.headimgurl });
      } else {
        /* TODO 网站应用扫码：同样走 sns/oauth2/access_token（需开放平台资质） */
        json(res, 200, { ok: false, msg: '请在服务端补齐开放平台接入' });
      }
    } catch (e) {
      json(res, 500, { ok: false, msg: String(e.message || e) });
    }
  },

  /* 发送短信验证码 */
  'sms/send': async (body, res) => {
    const phone = String(body.phone || '');
    if (!/^1\d{10}$/.test(phone)) return json(res, 200, { ok: false, msg: '手机号格式不正确' });
    const code = SMS_KEY ? randomCode() : '123456'; // 演示模式固定 123456
    smsPool.set(phone, { code, expires: Date.now() + 5 * 60 * 1000 });
    /* TODO 真实接入点：在此调用腾讯云 SMS / 阿里云 SMS SDK 发送短信 */
    console.log(`[SMS] ${phone} -> ${code} (演示模式直接返回给前端)`);
    json(res, 200, { ok: true, demo: !SMS_KEY, demoCode: SMS_KEY ? undefined : code });
  },

  /* 校验验证码 */
  'sms/verify': async (body, res) => {
    const phone = String(body.phone || '');
    const rec = smsPool.get(phone);
    if (!rec || rec.expires < Date.now()) return json(res, 200, { ok: false, msg: '验证码已过期，请重新发送' });
    if (rec.code !== String(body.code || '')) return json(res, 200, { ok: false, msg: '验证码错误' });
    smsPool.delete(phone);
    json(res, 200, { ok: true });
  }
};

/* ---------- 静态文件 ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json' };

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = decodeURIComponent(parsed.pathname);

  if (pathname.startsWith('/api/')) {
    const handler = apiHandlers[pathname.slice(5)];
    if (!handler) return json(res, 404, { ok: false, msg: '未知接口' });
    const body = await readBody(req);
    return handler(body, res);
  }

  let file = pathname === '/' ? '/index.html' : pathname;
  const abs = path.join(ROOT, file);
  if (!abs.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(abs, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not Found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(abs)] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  const mode = WX_APPID ? '真实微信授权' : '演示模式（未配置 WX_APPID）';
  console.log(`拓圈AI 服务已启动: http://localhost:${PORT}`);
  console.log(`登录模式: ${mode} | 短信: ${SMS_KEY ? '真实服务商' : '演示模式(验证码 123456)'}`);
});
