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

    /* 拉取云端全部内容域 → { scope: data } 或 null；同时记录各域更新时间（供合并判断） */
    pull: function () {
      var c = client();
      if (!c) return Promise.resolve(null);
      return c.database.from('tq_content').select('scope,data,updated_at')
        .then(function (res) {
          if (!ok(res)) { console.warn('[CloudSync] 拉取失败', res && res.error); return null; }
          var map = {}, meta = {};
          (res.data || []).forEach(function (row) {
            map[row.scope] = row.data;
            meta[row.scope] = row.updated_at || '';
          });
          CloudSync.lastMeta = meta;
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
          /* 记录推送时间：之后云端时间戳早于它 → 判定本地领先，不被回退 */
          try { if (global.Store && global.Store.markPushed) global.Store.markPushed(scopes); } catch (e) { /* 元数据失败不影响数据 */ }
          return true;
        })
        .catch(function (e) { console.warn('[CloudSync] 写入异常', e); return false; });
    },

    /* 启动时初始化（升级安全版）：
     * 合并规则（按内容域逐域判断，避免升级/离线期间的本地改动被云端旧快照回退）：
     *   1. 云端该域为空/null → 保留本地（绝不用空值清数据），本地有内容则补推上云
     *   2. 本地该域有未同步的编辑（__editAt 晚于云端 updated_at）→ 本地领先，本地为准并回写云端
     *   3. 否则 → 云端为准覆盖本地缓存（多端一致性），但不清空本地独有的本机数据（user/notifs/clients）
     * 注意：user / notifs / clients 等「本机数据」不在同步域内，永不参与覆盖 */
    init: function (db, seedContent, onChanged, onError) {
      void seedContent;
      return CloudSync.pull().then(function (map) {
        if (!map) { if (onError) onError(); return; }
        var meta = CloudSync.lastMeta || {};
        var hasCloud = SCOPES.some(function (s) { return map[s] !== undefined && map[s] !== null; });
        if (!hasCloud) {
          /* 云端完全没有有效数据：本地一旦编辑过就首推上云（本地是唯一副本，绝不丢弃） */
          var anyLocal = SCOPES.some(function (s) {
            var v = db[s];
            return Array.isArray(v) ? v.length > 0 : (v !== undefined && v !== null && typeof v === 'object');
          });
          if (anyLocal && global.Store && !global.Store.isSeed()) CloudSync.push(SCOPES, db);
          return;
        }
        var changed = false, pushThese = [];
        SCOPES.forEach(function (s) {
          var cloudVal = map[s];
          if (cloudVal === undefined || cloudVal === null) {
            /* 规则 1：云端该域为空/null → 绝不用空值覆盖本地；本地有真实数据则补推上云（升级新增域常见） */
            if (!(global.Store && global.Store.isSeed())) pushThese.push(s);
            return;
          }
          var localVal = db[s];
          if (same(cloudVal, localVal)) return;                      /* 一致，无需处理 */
          var cloudTs = Date.parse(meta[s] || '') || 0;
          var localEditTs = Date.parse((global.Store && global.Store.editAt) ? global.Store.editAt(s) : '') || 0;
          var localPushTs = Date.parse((global.Store && global.Store.pushAt) ? global.Store.pushAt(s) : '') || 0;
          if (localEditTs > Math.max(cloudTs, localPushTs)) {
            /* 规则 2：本地改动晚于云端 → 本地领先，保留本地并回写云端 */
            pushThese.push(s);
            return;
          }
          /* 规则 3：云端更新（或本地从未编辑过该域）→ 云端为准 */
          db[s] = cloudVal;
          changed = true;
        });
        if (pushThese.length) CloudSync.push(pushThese, db);
        if (changed && global.Store) global.Store.persist();
        if (changed && onChanged) onChanged();
      });
    }
  };

  global.CloudSync = CloudSync;
})(window);
