#!/usr/bin/env node
/**
 * 乐道AI · 公众号后台自动连接器（只读）
 *
 * 目标：复用用户浏览器中已有的微信公众号登录态，直接打开公众号后台管理页面。
 * 铁律：
 *  1. 仅复用现有会话，绝不重新登录、绝不扫码、绝不修改任何账号信息；
 *  2. 登录态有效 → 保持后台页面打开并报告；
 *  3. 登录态已失效 → 仅输出「登录状态已失效」，不做任何恢复尝试。
 *
 * 原理：通过 Chrome 远程调试端口（CDP, 默认 9222）attach 到用户正在运行的浏览器，
 * 复用其 Cookie/会话打开 mp.weixin.qq.com，只读检测页面特征判断登录态。
 *
 * 用法：
 *   node scripts/mp-connect.mjs                 # 默认端口 9222
 *   node scripts/mp-connect.mjs --port 9223     # 指定端口
 *   node scripts/mp-connect.mjs --wait 60       # 端口未开时等待用户开启，最多 60 秒
 */
import { setTimeout as sleep } from 'node:timers/promises';

const args = process.argv.slice(2);
function argOf(name, dflt) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : dflt;
}
const PORT = argOf('--port', 9222);
const WAIT_SEC = argOf('--wait', 0);
const CDP = `http://127.0.0.1:${PORT}`;
const MP_HOME = 'https://mp.weixin.qq.com/';

// ---- Node 侧 playwright 解析（优先工作区 node_modules）----
const NODE_PATHS = [
  '/Users/apple/.workbuddy/binaries/node/workspace/node_modules',
  process.cwd() + '/node_modules',
];
let playwright = null;
for (const p of NODE_PATHS) {
  try { playwright = (await import('file://' + p + '/playwright/index.mjs')); break; } catch (_) {}
}
if (!playwright) { console.error('❌ 未找到 playwright，请先安装：npm i playwright'); process.exit(2); }

console.log(`\n🔗 乐道AI · 公众号后台自动连接器（只读模式）`);
console.log(`   目标调试端口: ${CDP}\n`);

// ---- 1. 等待/探测 CDP 端口 ----
async function cdpAlive() {
  try {
    const r = await fetch(CDP + '/json/version', { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch (_) { return false; }
}

const guide = () => {
  console.log(`⚠️  未检测到浏览器调试端口 (${PORT})。`);
  console.log(`   请完全退出 Chrome（Cmd+Q），然后在终端执行：`);
  console.log(`   open -na "Google Chrome" --args --remote-debugging-port=${PORT}`);
  console.log(`   启动后登录态保留（同一用户目录），再重新运行本脚本。`);
  console.log(`   ※ 不要使用陌生目录启动，否则拿不到已有登录态。\n`);
};

if (!(await cdpAlive())) {
  if (WAIT_SEC > 0) {
    console.log(`⏳ 等待调试端口开启（最多 ${WAIT_SEC}s）...`);
    const dl = Date.now() + WAIT_SEC * 1000;
    let ok = false;
    while (Date.now() < dl) { if (await cdpAlive()) { ok = true; break; } await sleep(1000); }
    if (!ok) { guide(); process.exit(3); }
  } else { guide(); process.exit(3); }
}
console.log(`✅ 已连接浏览器调试端口 ${PORT}`);

// ---- 2. attach 并打开公众号后台 ----
const browser = await playwright.chromium.connectOverCDP(CDP);
const ctx = browser.contexts()[0];
if (!ctx) { console.error('❌ 未找到浏览器上下文'); process.exit(4); }

const page = await ctx.newPage();
console.log(`🌐 正在以现有会话打开: ${MP_HOME}`);
await page.goto(MP_HOME, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
await sleep(4000);

// ---- 3. 只读判定登录态（不点击、不输入、不修改任何东西）----
const url = page.url();
const info = await page.evaluate(() => {
  const t = document.title || '';
  const bodyText = (document.body && document.body.innerText || '').slice(0, 3000);
  return {
    title: t,
    hasQrLogin: !!document.querySelector('.login__type__container__scan, .qrcode, [class*="scan"]'),
    hasAccountEntry: !!document.querySelector('.new-logout, .user-info, .menu_main, #js_main'),
    hasNickname: /公众号|小程序/.test(bodyText) && !/扫码登录|微信扫一扫/.test(bodyText),
    bodyHead: bodyText.slice(0, 200),
  };
}).catch(e => ({ err: String(e) }));

console.log(`\n📡 检测结果：`);
console.log(`   URL: ${url}`);
console.log(`   标题: ${info.title || '(空)'} `);

const looksLoginPage = /\/login/.test(url) || info.hasQrLogin || /扫码登录|微信扫一扫登录/.test(info.bodyHead || '');
const looksDashboard = info.hasAccountEntry || info.hasNickname || /首页|公众号平台|内容与互动/.test(info.bodyHead || '');

if (looksDashboard && !looksLoginPage) {
  console.log(`\n✅ 登录状态有效 —— 已直接进入公众号后台管理页面（页面保持打开，可直接操作）。`);
  console.log(`   本次连接全程只读检测，未触碰任何账号安全设置。`);
  // 保持页面打开 60s 供用户直接接手使用
  await sleep(60000);
  process.exit(0);
} else if (looksLoginPage) {
  console.log(`\n❌ 登录状态已失效 —— 检测到扫码登录页。`);
  console.log(`   按约束不做重新登录/扫码/修改任何账号信息。请你在浏览器里手动扫码后重跑本脚本。`);
  process.exit(5);
} else {
  console.log(`\n⚠️ 无法明确判定登录态（页面特征不足）。`);
  console.log(`   页面前 200 字: ${(info.bodyHead || info.err || '(空)').replace(/\s+/g, ' ')}`);
  console.log(`   未做任何操作，请人工确认 mp.weixin.qq.com 的登录状态。`);
  process.exit(6);
}
