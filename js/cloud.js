/* ============================================================
 * 乐道AI · 复刻系统 —— 云端数据同步模块
 * 依托 WorkBuddy 云数据库（tq_content 表）实现手机/电脑数据同步：
 *   - pull(): 拉取云端 4 个内容域（config/bosses/salons/notices）
 *   - push(scopes): 把本地内容域写入云端（后台保存时自动调用）
 * 本地 localStorage 仅作缓存；云端为唯一数据源。
 * ============================================================ */
(function (global) {
  'use strict';

  var SCOPES = [
    'config', 'bosses', 'salons', 'notices', 'posts',
    'banners', 'vipPage', 'signups', 'commissions', 'referrals',
    'coopLeads', 'distTeam', 'members', 'upsells', 'distApplyList'
  ];

  var _cloud = null;
  function client() {
    if (_cloud) return _cloud;
    var cfg = global.PUBLIC_CONFIG || {};
    if (!global.WorkBuddyCloud || !cfg.endpoint || !cfg.publishableKey) return null;
    try {
      _cloud = global.WorkBuddyCloud.createWorkBuddyCloud({
        endpoint: cfg.endpoint,
        publishableKey: cfg.publishableKey
      });
    } catch (e) { _cloud = null; }
    return _cloud;
  }

  function ok(res) { return res && !res.error; }

  /* 规范化序列化（键排序）：JSONB 不保留键顺序，直接 stringify 对比会误判 */
  function canonical(v) {
    if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
    if (v && typeof v === 'object') {
      return '{' + Object.keys(v).sort().map(function (k) {
        return JSON.stringify(k) + ':' + canonical(v[k]);
      }).join(',') + '}';
    }
    return JSON.stringify(v);
  }
  function same(a, b) { return canonical(a) === canonical(b); }

  var CloudSync = {
    SCOPES: SCOPES,

    /* 拉取云端全部内容域 → { config, bosses, salons, notises 原名 } 或 null */
    pull: function () {
      var c = client();
      if (!c) return Promise.resolve(null);
      return c.database.from('tq_content').select('scope,data')
        .then(function (res) {
          if (!ok(res)) { console.warn('[CloudSync] 拉取失败', res && res.error); return null; }
          var map = {};
          (res.data || []).forEach(function (row) { map[row.scope] = row.data; });
          return map;
        })
        .catch(function (e) { console.warn('[CloudSync] 拉取异常', e); return null; });
    },

    /* 把指定内容域写入云端（upsert by scope） */
    push: function (scopes, db) {
      var c = client();
      if (!c) return Promise.resolve(false);
      var rows = scopes.map(function (s) {
        return { scope: s, data: db[s], updated_at: new Date().toISOString() };
      });
      return c.database.from('tq_content').upsert(rows)
        .then(function (res) {
          if (!ok(res)) { console.warn('[CloudSync] 写入失败', res && res.error); return false; }
          return true;
        })
        .catch(function (e) { console.warn('[CloudSync] 写入异常', e); return false; });
    },

    /* 启动时初始化：
     * - 云端为「种子数据」且本地已编辑过 → 本地优先，把本地内容域推上云
     * - 云端有真实数据 → 覆盖本地缓存并回调 changed
     * - 云端为空 → 本地已编辑过则首推上云 */
    init: function (db, seedContent, onChanged, onError) {
      function equalsSeed(obj, scope) {
        return scope === undefined || same(obj[scope], seedContent[scope]);
      }
      return CloudSync.pull().then(function (map) {
        if (!map) { if (onError) onError(); return; }
        var hasCloud = SCOPES.some(function (s) { return map[s] !== undefined; });
        if (!hasCloud) {
          var localSeed = SCOPES.every(function (s) { return equalsSeed(db, s); });
          if (!localSeed) CloudSync.push(SCOPES, db); // 云端为空且本地有编辑 → 首次上云
          return;
        }
        /* 云端是否仍是种子数据（例如刚初始化过） */
        var cloudIsSeed = SCOPES.every(function (s) { return equalsSeed(map, s); });
        var localIsSeed = SCOPES.every(function (s) { return equalsSeed(db, s); });
        if (cloudIsSeed && !localIsSeed) {
          /* 本地有编辑、云端还是种子 → 本地优先并回写云端 */
          CloudSync.push(SCOPES, db);
          return;
        }
        var changed = false;
        SCOPES.forEach(function (s) {
          if (map[s] !== undefined && !same(map[s], db[s])) {
            db[s] = map[s];
            changed = true;
          }
        });
        if (changed && global.Store) global.Store.persist();
        if (changed && onChanged) onChanged();
      });
    }
  };

  global.CloudSync = CloudSync;
})(window);
