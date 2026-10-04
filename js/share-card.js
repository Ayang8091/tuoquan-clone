/* ============================================================
 * 乐道AI · 分享卡片图（无需微信公众号）
 * ------------------------------------------------------------
 * 背景：微信内「链接转发卡片」的描述+缩略图只有 JS-SDK（需认证公众号）一条路。
 * 本模块提供不依赖公众号的替代：把当前页面信息直接画成一张设计稿样式的
 * 「分享卡片图」（标题+描述+logo+当前页二维码），转发图片即卡片效果，
 * 好友长按二维码可直接打开页面 —— 全渠道一致、100% 可控。
 * 入口：右下角悬浮分享按钮；生成后长按图片保存到相册（复用海报保存交互）。
 * ============================================================ */
(function () {
  'use strict';
  var W = 500, H = 680, DPR = 2;   /* 输出 1000×1360，清晰度足够 */
  var loading = false;

  function toast(msg) {
    if (window.UI && UI.toast) return UI.toast(msg);
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.style.display = 'block';
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.style.display = 'none'; }, 2600);
  }

  /* 文本自动换行，返回实际行数 */
  function wrapText(ctx, text, x, y, maxW, lineH, maxLines) {
    var chars = String(text || '').split(''), line = '', lines = [];
    for (var i = 0; i < chars.length; i++) {
      var test = line + chars[i];
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = chars[i]; if (lines.length === maxLines) break; }
      else line = test;
    }
    if (lines.length < maxLines && line) lines.push(line);
    if (lines.length === maxLines) { var last = lines[maxLines - 1]; if (ctx.measureText(line).width > maxW || lines.join('').length < String(text).length) lines[maxLines - 1] = last.replace(/.{1}$/, '') + '…'; }
    lines.forEach(function (l, idx) { ctx.fillText(l, x, y + idx * lineH); });
    return lines.length;
  }

  function loadImg(src) {
    return new Promise(function (res) {
      var img = new Image();
      img.onload = function () { res(img); };
      img.onerror = function () { res(null); };
      img.src = src;
    });
  }

  /* SVG 字符串 → Image（二维码由 app.js 的 qrUrlSvg 生成，无外部引用，dataURL 加载安全） */
  function svgToImg(svg) {
    return loadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function buildCanvas(share) {
    var c = document.createElement('canvas');
    c.width = W * DPR; c.height = H * DPR;
    var ctx = c.getContext('2d');
    ctx.scale(DPR, DPR);

    /* 聊天灰底 + 白色圆角卡片（对齐设计稿版式） */
    ctx.fillStyle = '#ededed'; ctx.fillRect(0, 0, W, H);
    var cx = 30, cy = 34, cw = W - 60, ch = 400;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,.08)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6;
    roundRect(ctx, cx, cy, cw, ch, 16); ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

    /* 标题（最多 2 行） */
    ctx.fillStyle = '#111111';
    ctx.font = '700 30px -apple-system,"PingFang SC","Helvetica Neue",sans-serif';
    wrapText(ctx, share.title, cx + 28, cy + 66, cw - 56, 42, 2);
    /* 描述（最多 2 行） */
    ctx.fillStyle = '#8a8a8a';
    ctx.font = '400 22px -apple-system,"PingFang SC","Helvetica Neue",sans-serif';
    wrapText(ctx, share.desc, cx + 28, cy + 168, cw - 56, 32, 2);

    /* logo 右下（画不出来则留白） */
    return loadImg('img/logo-icon.png').then(function (logo) {
      if (logo) {
        var lw = 92, lh = 92;
        ctx.drawImage(logo, cx + cw - lw - 28, cy + ch - lh - 26, lw, lh);
        ctx.fillStyle = '#333'; ctx.font = '600 18px -apple-system,"PingFang SC",sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText((window.Store && Store.get().config.siteName) || '乐道AI', cx + cw - lw - 40, cy + ch - 52);
        ctx.textAlign = 'left';
      }
      /* 卡片外：二维码（当前页面链接，带锁粉参数） */
      var link = share.link || location.origin + location.pathname;
      var qrSvg = window.qrUrlSvg ? window.qrUrlSvg(link, 240) : '';
      var qrBox = 300, qx = (W - qrBox) / 2, qy = cy + ch + 40;
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, qx, qy, qrBox, qrBox, 12); ctx.fill();
      if (qrSvg) {
        return svgToImg(qrSvg).then(function (qr) {
          if (qr) ctx.drawImage(qr, qx + 26, qy + 26, qrBox - 52, qrBox - 52);
          drawFooter(ctx, qy);
          return c;
        });
      }
      drawFooter(ctx, qy);
      return Promise.resolve(c);
    });
  }

  function drawFooter(ctx, qy) {
    ctx.fillStyle = '#666666';
    ctx.font = '400 20px -apple-system,"PingFang SC",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('长按识别二维码 · 打开页面', W / 2, qy + 300 + 34);
    ctx.fillStyle = '#9a9a9a';
    ctx.font = '400 16px -apple-system,"PingFang SC",sans-serif';
    ctx.fillText((location.origin || '').replace(/^https?:\/\//, ''), W / 2, qy + 300 + 62);
    ctx.textAlign = 'left';
  }

  function showOverlay(dataUrl) {
    var old = document.getElementById('scShareMask'); if (old) old.remove();
    var mask = document.createElement('div');
    mask.id = 'scShareMask';
    mask.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.82);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:18px';
    var tip = document.createElement('div');
    tip.style.cssText = 'color:#fff;font-size:15px;font-weight:600;margin-bottom:10px';
    tip.textContent = /MicroMessenger/i.test(navigator.userAgent) ? '长按图片 · 转发给朋友或保存到相册' : '长按图片保存，或点击下方按钮下载';
    var img = document.createElement('img');
    img.src = dataUrl;
    img.style.cssText = 'max-width:80%;max-height:74vh;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.5)';
    mask.appendChild(tip); mask.appendChild(img);
    if (!/MicroMessenger/i.test(navigator.userAgent)) {
      var a = document.createElement('a');
      a.href = dataUrl; a.download = '乐道AI-分享卡片-' + Date.now() + '.png';
      a.textContent = '⬇️ 下载图片';
      a.style.cssText = 'margin-top:14px;color:#fff;font-size:14px;text-decoration:none;border:1px solid rgba(255,255,255,.5);border-radius:20px;padding:8px 22px';
      mask.appendChild(a);
    }
    var close = document.createElement('div');
    close.textContent = '✕ 关闭';
    close.style.cssText = 'margin-top:14px;color:rgba(255,255,255,.75);font-size:13px;padding:6px 14px';
    close.onclick = function () { mask.remove(); };
    mask.appendChild(close);
    mask.addEventListener('click', function (e) { if (e.target === mask) mask.remove(); });
    document.body.appendChild(mask);
    toast('分享卡片已生成，转发图片即是卡片效果');
  }

  function generate() {
    if (loading) return;
    if (!window.routeShare) { toast('分享组件加载中，请稍后再试'); return; }
    loading = true;
    var share = window.routeShare();
    share.link = location.origin + location.pathname + (location.hash || '#/');
    toast('正在生成分享卡片…');
    buildCanvas(share).then(function (canvas) {
      loading = false;
      if (canvas) showOverlay(canvas.toDataURL('image/png'));
      else toast('卡片生成失败，请重试');
    }).catch(function () { loading = false; toast('卡片生成失败，请重试'); });
  }

  /* 悬浮分享按钮（右下角，避开底部 Tab） */
  function mountButton() {
    var b = document.createElement('div');
    b.id = 'scShareBtn';
    b.title = '生成分享卡片';
    b.style.cssText = 'position:fixed;right:14px;bottom:76px;z-index:9999;width:46px;height:46px;border-radius:50%;' +
      'background:rgba(17,17,17,.55);color:#fff;display:flex;align-items:center;justify-content:center;' +
      'font-size:20px;box-shadow:0 4px 14px rgba(0,0,0,.25);cursor:pointer;backdrop-filter:blur(4px)';
    b.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>';
    b.onclick = generate;
    document.body.appendChild(b);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountButton);
  else mountButton();
})();
