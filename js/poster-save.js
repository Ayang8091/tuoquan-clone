/* ============================================================
 * 乐道AI · 海报长按保存到相册
 * ------------------------------------------------------------
 * 交互：长按海报 550ms → 懒加载 html2canvas 把海报 DOM 渲染成图片
 *       → 全屏遮罩展示大图 + 提示「长按图片 · 保存到相册」
 *       微信内长按 <img> 会唤起原生「保存图片」菜单；其他浏览器提供下载按钮
 * 说明：纯增量脚本，不改海报页业务逻辑与样式；html2canvas 按需加载
 * ============================================================ */
(function () {
  'use strict';
  var HOLD_MS = 550, timer = null, startX = 0, startY = 0, suppressClick = false, loading = false;

  function inWeChat() { return /MicroMessenger/i.test(navigator.userAgent || ''); }

  /* 懒加载本地 html2canvas（首次长按时才下载，不拖慢页面启动） */
  function ensureLib(cb) {
    if (window.html2canvas) return cb();
    var s = document.createElement('script');
    s.src = 'js/vendor/html2canvas.min.js';
    s.onload = function () { cb(); };
    s.onerror = function () { toast('图片生成组件加载失败，请检查网络后重试'); loading = false; };
    document.head.appendChild(s);
  }

  function toast(msg) {
    if (window.UI && UI.toast) return UI.toast(msg);
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.style.display = 'block';
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.style.display = 'none'; }, 2600);
  }

  function showOverlay(dataUrl) {
    var mask = document.createElement('div');
    mask.id = 'psSaveMask';
    mask.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.82);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:18px';
    var tip = document.createElement('div');
    tip.style.cssText = 'color:#fff;font-size:15px;font-weight:600;margin-bottom:10px;letter-spacing:.5px';
    tip.textContent = inWeChat() ? '长按图片 · 保存到相册' : '长按图片保存，或点击下方按钮下载';
    var img = document.createElement('img');
    img.src = dataUrl;
    img.style.cssText = 'max-width:86%;max-height:72vh;border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,.5);background:#fff';
    mask.appendChild(tip); mask.appendChild(img);
    if (!inWeChat()) {
      var a = document.createElement('a');
      a.href = dataUrl;
      a.download = '乐道AI-海报-' + Date.now() + '.png';
      a.textContent = '⬇️ 下载图片';
      a.style.cssText = 'margin-top:14px;color:#fff;font-size:14px;text-decoration:none;border:1px solid rgba(255,255,255,.5);border-radius:20px;padding:8px 22px';
      mask.appendChild(a);
    }
    var close = document.createElement('div');
    close.textContent = '✕ 关闭';
    close.style.cssText = 'margin-top:14px;color:rgba(255,255,255,.75);font-size:13px;padding:6px 14px';
    close.onclick = function () { document.body.removeChild(mask); };
    mask.appendChild(close);
    mask.addEventListener('click', function (e) { if (e.target === mask) document.body.removeChild(mask); });
    document.body.appendChild(mask);
    toast('海报图片已生成，' + (inWeChat() ? '长按图片即可保存到相册' : '长按图片或点击下载'));
  }

  function generate(el) {
    if (loading) return;
    loading = true;
    toast('正在生成海报图片…');
    ensureLib(function () {
      try {
        window.html2canvas(el, { backgroundColor: '#ffffff', scale: Math.min(2, window.devicePixelRatio || 1), useCORS: true, logging: false })
          .then(function (canvas) {
            loading = false;
            if (!canvas) { toast('海报生成失败，请重试'); return; }
            showOverlay(canvas.toDataURL('image/png'));
          })
          .catch(function () { loading = false; toast('海报生成失败，请重试'); });
      } catch (e) { loading = false; toast('海报生成失败，请重试'); }
    });
  }

  function posterTarget(t) {
    var el = t && t.closest ? t.closest('.poster-page .poster') : null;
    return el;
  }

  document.addEventListener('pointerdown', function (e) {
    var el = posterTarget(e.target);
    if (!el || loading) return;
    startX = e.clientX; startY = e.clientY;
    clearTimeout(timer);
    timer = setTimeout(function () {
      suppressClick = true;               /* 长按生效后拦截随后的 click（避免误触二维码跳转） */
      setTimeout(function () { suppressClick = false; }, 900);
      generate(el);
    }, HOLD_MS);
  }, { passive: true });

  document.addEventListener('pointermove', function (e) {
    if (!timer) return;
    if (Math.abs(e.clientX - startX) > 12 || Math.abs(e.clientY - startY) > 12) clearTimeout(timer); /* 滑动取消 */
  }, { passive: true });

  document.addEventListener('pointerup', function () { clearTimeout(timer); }, { passive: true });
  document.addEventListener('pointercancel', function () { clearTimeout(timer); }, { passive: true });

  /* 长按后拦截一次 click（捕获阶段），防止触发海报内二维码/按钮的跳转 */
  document.addEventListener('click', function (e) {
    if (suppressClick && posterTarget(e.target)) { e.stopPropagation(); e.preventDefault(); }
  }, true);
})();
