/* ============================================================
 * 乐道AI · 统一图片上传组件（img/upload.js）
 * 全站统一交互：点击 → 调起系统文件选择器（电脑桌面文件 / 手机相册）
 * → canvas 自动裁剪（居中裁切到目标比例）→ 压缩 → 返回 dataURL
 * 用法：ImgUp.pick({ ratio: 1, max: 300, quality: .85, multiple: false }, cb)
 *   ratio  目标宽高比 w/h（1=方形头像, 2=封面横图, 0=保持原比例）
 *   max    压缩后最长边像素
 *   cb(results, ctx)  results 为 dataURL 数组
 * ============================================================ */
(function (global) {
  'use strict';

  function compress(img, ratio, max, quality) {
    var iw = img.naturalWidth, ih = img.naturalHeight;
    var sw = iw, sh = ih, sx = 0, sy = 0;
    if (ratio > 0) {
      /* 居中裁剪到目标比例 */
      if (iw / ih > ratio) { sw = ih * ratio; sx = (iw - sw) / 2; }
      else { sh = iw / ratio; sy = (ih - sh) / 2; }
    }
    var dw = sw, dh = sh;
    if (Math.max(dw, dh) > max) {
      var k = max / Math.max(dw, dh);
      dw = Math.round(dw * k); dh = Math.round(dh * k);
    }
    var cv = document.createElement('canvas');
    cv.width = dw; cv.height = dh;
    cv.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
    return cv.toDataURL('image/jpeg', quality || 0.82);
  }

  function readAsImage(file) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () {
        var img = new Image();
        img.onload = function () { res(img); };
        img.onerror = rej;
        img.src = fr.result;
      };
      fr.onerror = rej;
      fr.readAsDataURL(file);
    });
  }

  /**
   * 打开系统文件选择器并处理图片
   * opts: { ratio, max, quality, multiple }
   * cb(dataUrlArray)
   */
  function pick(opts, cb) {
    opts = opts || {};
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (opts.multiple) input.multiple = true;
    input.style.display = 'none';
    document.body.appendChild(input);
    input.onchange = function () {
      var files = Array.prototype.slice.call(input.files || []);
      document.body.removeChild(input);
      if (!files.length) return;
      Promise.all(files.map(function (f) {
        return readAsImage(f).then(function (img) {
          return compress(img, opts.ratio || 0, opts.max || 1000, opts.quality);
        });
      })).then(function (urls) { cb(urls); })
        .catch(function () { if (opts.onerror) opts.onerror(); else alert('图片读取失败，请重试'); });
    };
    input.click();
  }

  global.ImgUp = { pick: pick, compress: compress };
})(window);
