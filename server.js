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
const zlib = require('zlib');

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
    req.on('data', (c) => { raw += c; if (raw.length > 2.5e6) req.destroy(); });
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

/* ---------- 门票调整：规则计算（与前端 ticketLocal 保持同一套规则） ---------- */
function ticketCalc(b) {
  const tk = b.ticketAdjust || {};
  /* 业务日期：优先用客户端日期（用户所在时区），缺省用服务器日期 */
  const today = String(b.today || '').trim() || new Date().toISOString().slice(0, 10);
  const from = String(tk.from || '');
  const to = String(tk.to || '');
  const windowOk = (!from || today >= from) && (!to || today <= to);
  const active = !!tk.enabled && windowOk;
  const price = +b.price || 0;
  const mprice = +b.mprice || 0;
  const base = b.isMember ? mprice : price;
  const adjustPrice = +tk.adjustPrice || 0;
  const finalPrice = active ? adjustPrice : base;
  const limit = +tk.limit || 0;
  const bought = +b.boughtCount || 0;
  return {
    salonId: String(b.salonId || ''),
    active: active, windowOk: windowOk, window: { from: from, to: to },
    basePrice: base, originPrice: (tk.originPrice != null ? +tk.originPrice : price),
    adjustPrice: adjustPrice, finalPrice: finalPrice,
    limit: limit, bought: bought,
    remaining: limit ? Math.max(0, limit - bought) : -1,
    limitOk: !limit || bought < limit,
    hint: String(tk.hint || ''), note: String(tk.note || ''),
    serverDate: new Date().toISOString().slice(0, 10)
  };
}

/* ---------- 圈子动态：敏感信息打码（与前端 cclMask 保持同一套规则） ----------
 * 承诺：动态里手机号/微信号/QQ/邮箱会被系统自动隐藏，对接走平台引荐 */
function maskSensitive(text) {
  var s = String(text || '');
  var flags = [];
  if (/1[3-9]\d{9}/.test(s)) {
    flags.push('phone');
    s = s.replace(/1[3-9]\d{9}/g, '［手机号已隐藏］');
  }
  if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(s)) {
    flags.push('email');
    s = s.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '［邮箱已隐藏］');
  }
  if (/(?:QQ|qq|ＱＱ)[：:\s]*\d{5,12}/.test(s)) {
    flags.push('qq');
    s = s.replace(/(?:QQ|qq|ＱＱ)[：:\s]*\d{5,12}/g, '［QQ已隐藏］');
  }
  if (/(?:微信号|微信|加v|加V|加VX|加vx|wx|WX|vx|VX)[：:\s]*[A-Za-z][A-Za-z0-9_-]{5,19}/.test(s)) {
    flags.push('wechat');
    s = s.replace(/(?:微信号|微信|加v|加V|加VX|加vx|wx|WX|vx|VX)[：:\s]*[A-Za-z][A-Za-z0-9_-]{5,19}/g, '［微信号已隐藏］');
  }
  return { text: s, flags: flags };
}

/* ---------- 支付收款信息：磁盘持久化（data/payinfo.json） ----------
 * 收款二维码图片存 uploads/（返回可访问 URL），配置存 data/payinfo.json。
 * 前端（后台填写弹窗 / 用户端收款弹窗）统一走 pay/save + pay/info 同步。 */
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const DATA_DIR = path.join(ROOT, 'data');
const PAY_FILE = path.join(DATA_DIR, 'payinfo.json');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });
const PAY_DEFAULT = { wxQr: '', aliQr: '', wxName: '', aliName: '', link: '', amount: 0, note: '', updatedAt: '' };
function payRead() {
  try { return Object.assign({}, PAY_DEFAULT, JSON.parse(fs.readFileSync(PAY_FILE, 'utf8'))); }
  catch (e) { return Object.assign({}, PAY_DEFAULT); }
}
function payWrite(p) {
  p.updatedAt = new Date().toISOString();
  fs.writeFileSync(PAY_FILE, JSON.stringify(p, null, 2));
  return p;
}
/* dataURL 落盘：校验格式/体积 → base64 解码 → uploads/ 下生成文件 → 返回可访问 URL
 * prefix 决定文件名前缀（payqr- 收款码 / img- 通用图片如企业微信码） */
function dataUrlSave(dataUrl, prefix) {
  const m = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) return { ok: false, msg: '仅支持 PNG/JPG/WebP 图片' };
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length < 100) return { ok: false, msg: '图片内容为空或已损坏' };
  if (buf.length > 800 * 1024) return { ok: false, msg: '图片过大（上限 800KB），请压缩后重试' };
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
  const name = (prefix === 'payqr-' ? 'payqr-' : 'img-') + Date.now() + '-' + Math.random().toString(36).slice(2, 6) + '.' + ext;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
  /* 同前缀旧文件只保留最近 8 张，避免目录无限膨胀 */
  try {
    const olds = fs.readdirSync(UPLOAD_DIR).filter((f) => f.startsWith(prefix)).sort().reverse();
    olds.slice(8).forEach((f) => { try { fs.unlinkSync(path.join(UPLOAD_DIR, f)); } catch (e) { /* noop */ } });
  } catch (e) { /* noop */ }
  return { ok: true, url: '/uploads/' + name, size: buf.length };
}
function payUpload(b) {
  const kind = (b.kind === 'ali') ? 'ali' : 'wx';
  const r = dataUrlSave(b.dataUrl, 'payqr-');
  if (!r.ok) return r;
  r.kind = kind;
  return r;
}
function paySanitize(b) {
  const p = payRead();
  const str = (v, max) => String(v == null ? '' : v).slice(0, max);
  p.wxQr = /^\/?uploads\/[\w.-]+$/.test(str(b.wxQr, 200)) ? (b.wxQr[0] === '/' ? b.wxQr : '/' + b.wxQr) : str(b.wxQr, 200);
  p.aliQr = /^\/?uploads\/[\w.-]+$/.test(str(b.aliQr, 200)) ? (b.aliQr[0] === '/' ? b.aliQr : '/' + b.aliQr) : str(b.aliQr, 200);
  p.wxName = str(b.wxName, 40);
  p.aliName = str(b.aliName, 40);
  /* 收款链接：仅接受 http/https 链接（留空表示未配置） */
  const link = str(b.link, 300).trim();
  p.link = /^https?:\/\/\S+$/i.test(link) ? link : '';
  p.amount = Math.max(0, +b.amount || 0);
  p.note = str(b.note, 200);
  return p;
}

/* ---------- 扫码收款订单：待确认 → 已到账/已过期 ----------
 * 用户端打开收款弹窗时创建订单（pending），前端轮询 status；
 * 后台「扫码收款确认」核实款项到账后置为 paid，用户端按钮才解锁。
 * 超过有效期未到账自动标记 expired（对应二维码过期/支付超时）。 */
const PAYORDERS_FILE = path.join(DATA_DIR, 'payorders.json');
const PAY_ORDER_TTL = 5 * 60 * 1000; /* 单笔订单有效期 5 分钟 */
function poRead() {
  try { return JSON.parse(fs.readFileSync(PAYORDERS_FILE, 'utf8')); } catch (e) { return []; }
}
function poWrite(list) {
  /* 只保留最近 200 条，防止无限膨胀 */
  fs.writeFileSync(PAYORDERS_FILE, JSON.stringify(list.slice(0, 200), null, 2));
}
function poFind(orderNo) {
  return poRead().find((o) => o.orderNo === orderNo) || null;
}
function poUpdate(orderNo, patch) {
  const list = poRead();
  const o = list.find((x) => x.orderNo === orderNo);
  if (!o) return null;
  Object.assign(o, patch);
  poWrite(list);
  return o;
}
function poCreate(b) {
  const now = Date.now();
  const o = {
    orderNo: 'PO' + now + Math.random().toString(36).slice(2, 6).toUpperCase(),
    kind: ['salon', 'refer', 'member'].indexOf(b.kind) >= 0 ? b.kind : 'custom',
    title: String(b.title || '').slice(0, 120),
    amount: Math.min(1000000, Math.max(0, +b.amount || 0)),
    status: 'pending',
    createdAt: now,
    expireAt: now + PAY_ORDER_TTL,
    paidAt: 0
  };
  const list = poRead();
  list.unshift(o);
  poWrite(list);
  return o;
}

/* ---------- API 处理 ---------- */
const apiHandlers = {
  /* 支付收款信息：上传收款二维码（dataURL → uploads 文件 → 可访问 URL） */
  'pay/upload': async (body, res) => {
    const r = payUpload(body);
    json(res, 200, Object.assign({ source: 'server' }, r));
  },

  /* 通用图片上传（企业微信码等）：dataURL → uploads/img-*.jpg → 可访问 URL */
  'img/upload': async (body, res) => {
    const r = dataUrlSave(body.dataUrl, 'img-');
    json(res, 200, Object.assign({ source: 'server' }, r));
  },

  /* 支付收款信息：保存（后台填写弹窗提交） */
  'pay/save': async (body, res) => {
    const p = payWrite(paySanitize(body));
    json(res, 200, { ok: true, source: 'server', payInfo: p });
  },

  /* 支付收款信息：读取（用户端收款弹窗拉取最新配置） */
  'pay/info': async (body, res) => {
    json(res, 200, { ok: true, source: 'server', payInfo: payRead() });
  },

  /* 扫码收款：创建待确认订单（用户端收款弹窗打开时调用） */
  'pay/order/create': async (body, res) => {
    const o = poCreate(body);
    json(res, 200, { ok: true, source: 'server', orderNo: o.orderNo, status: o.status, amount: o.amount, expireAt: o.expireAt, ttl: PAY_ORDER_TTL });
  },

  /* 扫码收款：轮询订单状态（前端据此解锁「我已完成支付」） */
  'pay/order/status': async (body, res) => {
    const no = String(body.orderNo || '');
    let o = poFind(no);
    if (!o) return json(res, 200, { ok: false, reason: 'notfound', msg: '订单不存在，请重新获取二维码' });
    if (o.status === 'pending' && Date.now() > o.expireAt) o = poUpdate(no, { status: 'expired' }) || o;
    json(res, 200, { ok: true, source: 'server', orderNo: no, status: o.status, amount: o.amount, expireAt: o.expireAt, paidAt: o.paidAt, serverTime: Date.now() });
  },

  /* 扫码收款：后台确认到账 / 作废（订单管理「扫码收款确认」） */
  'pay/order/confirm': async (body, res) => {
    const no = String(body.orderNo || '');
    const action = body.action === 'void' ? 'void' : 'paid';
    const o = poFind(no);
    if (!o) return json(res, 200, { ok: false, msg: '订单不存在' });
    if (o.status === 'expired') return json(res, 200, { ok: false, msg: '订单已过期，请让用户重新获取二维码' });
    const u = poUpdate(no, { status: action === 'paid' ? 'paid' : 'void', paidAt: action === 'paid' ? Date.now() : 0 });
    json(res, 200, { ok: true, source: 'server', orderNo: no, status: u.status, paidAt: u.paidAt });
  },

  /* 扫码收款：订单列表（后台「扫码收款确认」台账） */
  'pay/order/list': async (body, res) => {
    json(res, 200, { ok: true, source: 'server', orders: poRead() });
  },

  /* 门票调整：查询该沙龙最终应付价（前端展示与按钮金额由此驱动） */
  'ticket/quote': async (body, res) => {
    const r = ticketCalc(body);
    json(res, 200, Object.assign({ ok: true, source: 'server', serverTime: new Date().toISOString() }, r));
  },

  /* 门票调整：下单前确认（限购校验 + 最终应付价 + 凭证号） */
  'ticket/confirm': async (body, res) => {
    const r = ticketCalc(body);
    if (!r.limitOk) {
      return json(res, 200, Object.assign({
        ok: false, reason: 'limit',
        msg: '每人限购 ' + r.limit + ' 张，您已报名 ' + r.bought + ' 张'
      }, r));
    }
    const qty = Math.max(1, +body.qty || 1);
    if (r.limit && r.bought + qty > r.limit) {
      return json(res, 200, Object.assign({
        ok: false, reason: 'limit', msg: '每人限购 ' + r.limit + ' 张，剩余可报 ' + r.remaining + ' 张'
      }, r));
    }
    json(res, 200, Object.assign({
      ok: true, source: 'server', qty: qty,
      orderNo: 'TKT' + Date.now(),
      code: 'TQ-S-' + String(Date.now()).slice(-4),
      serverTime: new Date().toISOString()
    }, r));
  },

  /* 圈子动态：发布前服务端校验（会员/顾问门槛 + 分类合法 + 内容校验 + 敏感信息打码） */
  'post/check': async (body, res) => {
    const cats = ['res', 'need', 'coop', 'idea'];
    const cat = String(body.cat || '');
    const content = String(body.content || '').trim();
    const images = Array.isArray(body.images)
      ? body.images.filter((u) => typeof u === 'string' && u.length < 2e6).slice(0, 9)
      : [];
    if (cats.indexOf(cat) < 0) return json(res, 200, { ok: false, reason: 'cat', msg: '动态分类不合法' });
    if (!body.member) return json(res, 200, { ok: false, reason: 'member', msg: '圈子发帖仅限会员' });
    if (!body.advisorAdded) return json(res, 200, { ok: false, reason: 'advisor', msg: '请先添加平台专属顾问' });
    if (!content && !images.length) return json(res, 200, { ok: false, reason: 'empty', msg: '说点什么，或至少配一张图' });
    if (content.length > 2000) return json(res, 200, { ok: false, reason: 'toolong', msg: '内容过长（上限 2000 字）' });
    const m = maskSensitive(content);
    json(res, 200, {
      ok: true, source: 'server', cat: cat,
      content: m.text, flags: m.flags, imageCount: images.length,
      msg: m.flags.length ? '已自动隐藏 ' + m.flags.length + ' 处联系方式，对接走平台引荐' : ''
    });
  },

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
    const UA = { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.49', 'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8', 'Accept-Encoding': 'gzip, deflate, br' };
    /* 支持多级跳转（视频号分享链常需 2~3 次 302），http/https 通吃；自动解压 + 编码识别 */
    const fetchText = (u, depth) => new Promise((resolve, reject) => {
      if (depth > 3) return reject(new Error('redirect loop'));
      const mod = u.startsWith('http://') ? http : https;
      const req = mod.get(u, { headers: UA }, (r) => {
        if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
          r.resume();
          const next = new url.URL(r.headers.location, u).toString();
          return resolve(fetchText(next, depth + 1));
        }
        const chunks = [];
        r.on('data', (c) => chunks.push(c));
        r.on('end', () => {
          let buf = Buffer.concat(chunks);
          const enc = String(r.headers['content-encoding'] || '').toLowerCase();
          try {
            if (enc.includes('br')) buf = zlib.brotliDecompressSync(buf);
            else if (enc.includes('gzip')) buf = zlib.gunzipSync(buf);
            else if (enc.includes('deflate')) buf = zlib.inflateSync(buf);
          } catch (e) { /* 未压缩或已解压，保持原样 */ }
          let text = buf.toString('utf8');
          /* GBK 等非 UTF-8 站点：按 meta charset 重新解码 */
          const cm = text.slice(0, 2000).match(/charset=["']?([\w-]+)/i);
          if (cm && !/utf-?8/i.test(cm[1])) {
            try { text = new TextDecoder(cm[1]).decode(buf); } catch (e) { /* keep utf8 */ }
          }
          resolve(text);
        });
      }).on('error', reject);
      req.setTimeout(8000, () => req.destroy(new Error('timeout')));
    });
    const unesc = (s) => s.replace(/\\\//g, '/').replace(/\\u002[Ff]/g, '/').replace(/&amp;/g, '&').trim();
    try {
      const html = await fetchText(target, 0);
      /* meta 提取：兼容 property/name 在前或 content 在前两种顺序 */
      const meta = (prop) => {
        let m = html.match(new RegExp('<meta[^>]*(?:property|name)=["\']' + prop + '["\'][^>]*content=["\']([^"\']*)["\']', 'i'));
        if (!m) m = html.match(new RegExp('<meta[^>]*content=["\']([^"\']*)["\'][^>]*(?:property|name)=["\']' + prop + '["\']', 'i'));
        return m ? unesc(m[1]) : '';
      };
      let title = meta('og:title') || (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || '';
      let cover = meta('og:image') || meta('og:image:secure_url') || meta('twitter:image') || meta('twitter:image:src') || meta('image');
      /* 视频号/通用 JSON 字段兜底：coverUrl 等常见键名（含 \/ 转义） */
      if (!cover) {
        const keys = ['coverUrl', 'cover_url', 'coverImgUrl', 'cover_img_url', 'coverMap', 'mediaCoverUrl', 'snapshotUrl', 'thumbUrl', 'thumbnailUrl', 'imageUrl', 'poster'];
        for (const k of keys) {
          const m = html.match(new RegExp('["\\\']?' + k + '["\\\']?\\s*[:=]\\s*["\\\'](https?:[^"\\\']+)', 'i'));
          if (m) { cover = unesc(m[1]); break; }
        }
      }
      /* 最后兜底：任意含 cover/snapshot/thumb 关键词的 URL */
      if (!cover) {
        const m = html.match(/"(https?:[^"\\]*(?:cover|snapshot|thumb)[^"\\]*)"/i);
        if (m) cover = unesc(m[1]);
      }
      try { title = decodeURIComponent(title); } catch (e) { /* keep */ }
      const isChannels = /channels\.weixin\.qq\.com/i.test(target);
      if (!cover && isChannels) {
        return json(res, 200, { ok: false, msg: '视频号未暴露封面（需在微信内打开），将使用默认视频窗口样式，可手动上传封面' });
      }
      json(res, 200, { ok: true, title: title.replace(/&amp;/g, '&').trim(), cover: (cover || '').trim() });
    } catch (e) {
      json(res, 200, { ok: false, msg: '抓取失败（链接需在微信内打开或网络超时），将使用默认视频窗口样式，可手动上传封面' });
    }
  }
};

/* ---------- 静态文件 ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json' };

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
