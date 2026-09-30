/* ============================================================
 * 乐道AI · 复刻系统 —— 轻量后端（零依赖，node server.js）
 * ------------------------------------------------------------
 * 职责：
 *   1. 托管静态前端（index.html / admin.html）
 *   2. /api/wx/exchange  微信 code 换取用户信息（真实接入需环境变量）
 *
 * 真实接入环境变量：
 *   WX_APPID / WX_SECRET   公众号网页授权（微信内）
 *   OPEN_APPID / OPEN_SECRET  开放平台网站应用（微信外扫码，换取
 *                              access_token 需再经 code→token 两步，此处
 *                              已留 TODO 标注）
 *
 * 登录流程：微信授权成功即完成登录并锁定身份（无手机号绑定环节）
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

  /* 视频号/网页链接 → 抓取封面图与标题（og:image），失败时前端回退为手动上传封面 */
  'video/resolve': async (body, res) => {
    const target = String(body.url || '').trim();
    if (!/^https?:\/\//i.test(target)) return json(res, 200, { ok: false, msg: '链接格式不正确' });
    const UA = { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.49' };
    const fetchText = (u) => new Promise((resolve, reject) => {
      const req = https.get(u, { headers: UA }, (r) => {
        /* 跟随一次跳转 */
        if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
          https.get(r.headers.location, { headers: UA }, (r2) => {
            let raw = ''; r2.on('data', (c) => (raw += c));
            r2.on('end', () => resolve(raw));
          }).on('error', reject);
          return;
        }
        let raw = ''; r.on('data', (c) => (raw += c));
        r.on('end', () => resolve(raw));
      }).on('error', reject);
      req.setTimeout(8000, () => req.destroy(new Error('timeout')));
    });
    try {
      const html = await fetchText(target);
      const meta = (prop) => {
        const re = new RegExp('<meta[^>]*(?:property|name)="' + prop + '"[^>]*content="([^"]*)"', 'i');
        const m = html.match(re) || [];
        return m[1] || '';
      };
      let title = meta('og:title') || (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || '';
      let cover = meta('og:image') || meta('twitter:image');
      if (!cover) { const m = html.match(/"(https?:[^"]*(?:cover|snapshot|thumb)[^"]*)"/i); cover = m ? m[1] : ''; }
      try { title = decodeURIComponent(title); } catch (e) { /* keep */ }
      json(res, 200, { ok: true, title: title.replace(/&amp;/g, '&').trim(), cover: cover.trim() });
    } catch (e) {
      json(res, 200, { ok: false, msg: '抓取失败（该链接需在微信内打开或未暴露封面），请手动上传封面图' });
    }
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
    /* HTML/JS/CSS 不缓存，确保前端更新即时生效 */
    const noCache = /\.(html|js|css|json)$/.test(abs) || abs.endsWith(ROOT + '/');
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(abs)] || 'application/octet-stream',
      'Cache-Control': noCache ? 'no-cache, must-revalidate' : 'public, max-age=86400'
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  const mode = WX_APPID ? '真实微信授权' : '演示模式（未配置 WX_APPID）';
  console.log(`乐道AI 服务已启动: http://localhost:${PORT}`);
  console.log(`登录模式: ${mode} | 授权成功即登录（无手机号绑定）`);
});
