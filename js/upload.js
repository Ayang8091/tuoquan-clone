/* ============================================================
 * 乐道AI · 统一图片上传组件（js/upload.js）—— 全站唯一图片入口
 * ------------------------------------------------------------
 * 能力：
 *   1. 任意格式：JPG/PNG/WebP/AVIF/BMP/GIF/TIFF/HEIC( iPhone 原图 )… 
 *      浏览器原生能解码的直接解码；解不了的（如 Chrome 下的 HEIC）
 *      自动按需加载 heic2any 解码器（jsdelivr → unpkg 双 CDN 兜底），
 *      解码器不可达时给出明确可操作的提示，绝不静默失败。
 *   2. 任意尺寸：超大图（几千上万像素、几十 MB）先分步缩半（画质优于
 *      一步缩放，且规避 iOS canvas 4096 尺寸/面积上限），再精确缩放。
 *   3. 自动转换：统一导出 JPEG；透明通道自动垫白底（不会变黑）；
 *      EXIF 方向自动纠正（iPhone 竖拍不横躺）；GIF 取首帧转静态图。
 *   4. 体积达标：按 targetKB 逐级降质 → 仍超标再缩边，保证最终
 *      dataURL 体积可控（localStorage / 云端同步不被图片撑爆）。
 *   5. 全站 8 处上传入口（桌面后台 5 处 + H5 工作台/圈子等）全部
 *      走本组件的同一条处理管线，行为完全一致。
 *
 * 用法：
 *   ImgUp.pick(opts, cb)                打开系统文件选择器（支持多选）
 *   ImgUp.process(file, opts) -> Promise<dataURL>   直接处理一个 File/Blob
 *   cb(dataUrlArray)；opts:
 *     ratio     目标宽高比 w/h（1=方形头像 2=封面横图 2.4=运营位 0=保持原比例）
 *     max       压缩后最长边像素（默认 1200）
 *     quality   起始压缩质量（默认 0.85，仅作起点，实际按 targetKB 自适应）
 *     targetKB  目标体积上限 KB（默认 220；超限自动降质/缩边）
 *     multiple  是否支持多选
 *     limit     多选时最多处理几张（默认 9）
 *     onerror   失败回调（缺省 alert 提示）
 * ============================================================ */
(function (global) {
  'use strict';

  /* ---------- 格式识别：扩展名 + MIME + 文件头魔数 ---------- */
  var HEIC_EXT = /\.(heic|heif|hif)$/i;
  var TIFF_EXT = /\.(tiff?)$/i;
  function looksHeic(file) {
    if (HEIC_EXT.test(file.name || '')) return true;
    if (/^image\/(hei[cf]|heif|avif hif)/i.test(file.type || '')) return true;
    return false;
  }
  function looksTiff(file) {
    if (TIFF_EXT.test(file.name || '')) return true;
    if (/^image\/tiff/i.test(file.type || '')) return true;
    return false;
  }

  /* ---------- 通用第三方解码器按需加载（去重 + 超时 + 双 CDN 兜底） ---------- */
  var libCache = {};
  function loadLib(key, urls, check) {
    if (!libCache[key]) {
      libCache[key] = new Promise(function (resolve, reject) {
        (function tryAt(i) {
          if (i >= urls.length) return reject(new Error(key));
          var s = document.createElement('script');
          s.src = urls[i];
          var timer = setTimeout(function () { s.remove(); tryAt(i + 1); }, 8000); /* CDN 无响应超时兜底，绝不永久挂起 */
          s.onload = function () { clearTimeout(timer); check() ? resolve() : tryAt(i + 1); };
          s.onerror = function () { clearTimeout(timer); s.remove(); tryAt(i + 1); };
          document.head.appendChild(s);
        })(0);
      });
      libCache[key].catch(function () { delete libCache[key]; }); /* 失败后允许下次重试 */
    }
    return libCache[key];
  }
  function waitHeicLib() {
    return loadLib('heic2any', [
      'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js',
      'https://unpkg.com/heic2any@0.0.4/dist/heic2any.min.js',
      'https://fastly.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js'
    ], function () { return !!global.heic2any; });
  }
  function waitTiffLib() {
    return loadLib('utif', [
      'https://cdn.jsdelivr.net/npm/utif@3.1.0/UTIF.min.js',
      'https://unpkg.com/utif@3.1.0/UTIF.js',
      'https://fastly.jsdelivr.net/npm/utif@3.1.0/UTIF.min.js'
    ], function () { return !!global.UTIF; });
  }

  /* ---------- HEIC：heic2any 转 JPEG Blob 再走 Image ---------- */
  function heicDecode(file) {
    return waitHeicLib().then(function () {
      return global.heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
    }).then(function (out) {
      var blob = Array.isArray(out) ? out[0] : out;
      return imgFromBlob(blob);
    });
  }
  /* ---------- TIFF：UTIF 解码为 RGBA 画上画布 ---------- */
  function tiffDecode(file) {
    return waitTiffLib().then(function () {
      return file.arrayBuffer ? file.arrayBuffer() : new Promise(function (res, rej) {
        var fr = new FileReader();
        fr.onload = function () { res(fr.result); };
        fr.onerror = rej;
        fr.readAsArrayBuffer(file);
      });
    }).then(function (buf) {
      var ifds = global.UTIF.decode(buf);
      global.UTIF.decodeImage(buf, ifds[0], ifds);
      var rgba = global.UTIF.toRGBA8(ifds[0]);
      var cv = document.createElement('canvas');
      cv.width = ifds[0].width; cv.height = ifds[0].height;
      var ctx = cv.getContext('2d');
      var id = ctx.createImageData(cv.width, cv.height);
      id.data.set(rgba);
      ctx.putImageData(id, 0, 0);
      return cv;
    });
  }

  /* ---------- 解码主链：原生 → HEIC 转换 → TIFF 转换 ---------- */
  function imgFromBlob(blob) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('decode')); };
      img.src = url;
    });
  }
  function decode(file) {
    function nativeDecode() {
      /* createImageBitmap：主线程外解码 + EXIF 方向自动纠正 */
      if (global.createImageBitmap) {
        return global.createImageBitmap(file, { imageOrientation: 'from-image' })
          .catch(function () { return imgFromBlob(file); });
      }
      return imgFromBlob(file);
    }
    return nativeDecode().catch(function () {
      /* 原生解不了：按格式走解码器（HEIC / TIFF），互为兜底 */
      if (looksHeic(file)) return heicDecode(file).catch(function () { return tiffDecode(file); });
      if (looksTiff(file)) return tiffDecode(file).catch(function () { return heicDecode(file); });
      throw new Error('decode');
    });
  }

  /* ---------- 画布：白底 + 高质量缩放 ---------- */
  function draw(src, sx, sy, sw, sh, dw, dh) {
    var cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(dw));
    cv.height = Math.max(1, Math.round(dh));
    var ctx = cv.getContext('2d');
    ctx.fillStyle = '#ffffff';               /* 透明区域垫白底，导出 JPEG 不发黑 */
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
    return cv;
  }

  /* ---------- 裁剪 + 分步缩放（规避 iOS canvas 上限 & 保画质） ---------- */
  var CANVAS_CAP = 4096; /* iOS 安全上限（单边/大面积均不出错） */
  function toCanvas(src, ratio, max) {
    var iw = src.width || src.naturalWidth;
    var ih = src.height || src.naturalHeight;

    /* 1) 居中裁剪到目标比例（ratio<=0 保持原比例） */
    var sx = 0, sy = 0, sw = iw, sh = ih;
    if (ratio > 0) {
      if (iw / ih > ratio) { sw = ih * ratio; sx = (iw - sw) / 2; }
      else { sh = iw / ratio; sy = (ih - sh) / 2; }
    }

    /* 2) 超大原图先整半降采样到安全区（分步缩半画质远好于一步到位） */
    var k0 = Math.min(1, CANVAS_CAP / Math.max(sw, sh));
    var cur = draw(src, sx, sy, sw, sh, sw * k0, sh * k0);
    while (Math.max(cur.width, cur.height) > Math.min(max, CANVAS_CAP) * 2) {
      cur = draw(cur, 0, 0, cur.width, cur.height, cur.width / 2, cur.height / 2);
    }

    /* 3) 精确缩放到目标最长边 */
    var k = Math.min(1, max / Math.max(cur.width, cur.height));
    if (k >= 1 && Math.max(cur.width, cur.height) <= max) return cur;
    return draw(cur, 0, 0, cur.width, cur.height, cur.width * k, cur.height * k);
  }

  /* ---------- 导出：按 targetKB 自适应（先降质，仍超再缩边） ---------- */
  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(fr.result); };
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  }
  function exportDataUrl(cv, startQuality, targetKB) {
    var quality = Math.min(0.92, Math.max(0.5, startQuality || 0.85));
    return new Promise(function (resolve) {
      var shrinks = 0;
      function emit() {
        if (cv.toBlob) { cv.toBlob(step, 'image/jpeg', quality); return; }
        /* 极老浏览器无 toBlob：直接 toDataURL，不做体积自适应 */
        resolve(cv.toDataURL('image/jpeg', quality));
      }
      function step(blob) {
        function finish() {
          if (blob && blobToDataUrl) {
            blobToDataUrl(blob).then(resolve, function () { resolve(cv.toDataURL('image/jpeg', quality)); });
          } else resolve(cv.toDataURL('image/jpeg', quality));
        }
        var kb = blob ? blob.size / 1024 : Infinity;
        if (kb > targetKB && quality > 0.5) { quality = Math.max(0.5, quality - 0.12); emit(); return; }
        if (kb > targetKB && Math.max(cv.width, cv.height) > 320 && shrinks < 3) {
          shrinks++;
          cv = draw(cv, 0, 0, cv.width, cv.height, cv.width * 0.75, cv.height * 0.75);
          quality = Math.min(0.85, quality + 0.1);
          emit(); return;
        }
        finish();
      }
      emit();
    });
  }

  /* ---------- 单文件完整管线 ---------- */
  function process(file, opts) {
    opts = opts || {};
    var ratio = opts.ratio || 0;
    var max = opts.max || 1200;
    var targetKB = opts.targetKB || 220;
    return decode(file)
      .then(function (bmp) {
        var cv = toCanvas(bmp, ratio, max);
        if (bmp.close) try { bmp.close(); } catch (e) { /* noop */ }
        return exportDataUrl(cv, opts.quality, targetKB);
      });
  }
  function processFiles(files, opts) {
    opts = opts || {};
    var limit = opts.limit || 9;
    return Promise.all(Array.prototype.slice.call(files, 0, limit).map(function (f) {
      return process(f, opts).catch(function (err) {
        if (opts.onerror) opts.onerror(err);
        return null;
      });
    })).then(function (list) { return list.filter(Boolean); });
  }

  /* ---------- 文件选择器（全站唯一入口） ---------- */
  function pick(opts, cb) {
    opts = opts || {};
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = opts.accept || 'image/*,.heic,.heif';
    if (opts.multiple) input.multiple = true;
    input.style.display = 'none';
    document.body.appendChild(input);
    input.onchange = function () {
      var files = Array.prototype.slice.call(input.files || []);
      document.body.removeChild(input);
      if (!files.length) return;
      processFiles(files, opts).then(function (urls) {
        if (!urls.length) {
          var msg = '图片读取失败：可能是 HEIC 原图且当前网络加载转换器失败，可截图后重试或改用 JPG/PNG';
          if (opts.onerror) opts.onerror(new Error('empty')); else alert(msg);
          return;
        }
        cb(urls);
      });
    };
    input.click();
  }

  /* ---------- 兼容旧接口 ---------- */
  function compress(img, ratio, max, quality) {
    return toCanvas(img, ratio || 0, max || 1200).toDataURL('image/jpeg', quality || 0.82);
  }

  global.ImgUp = {
    pick: pick,
    process: process,
    processFiles: processFiles,
    compress: compress,
    /* 诊断信息（测试用） */
    _info: { version: '2.0', canvasCap: CANVAS_CAP }
  };
})(window);
