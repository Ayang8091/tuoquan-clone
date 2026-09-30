/* ============================================================
 * 乐道AI · 复刻系统 —— 数据层
 * 云端数据库（tq_content）为唯一数据源，localStorage 仅作本地缓存：
 *   - 启动时 Store.initSync() 拉取云端内容域（config/bosses/salons/notices）
 *   - 后台保存（Store.save()）自动把内容域推送云端 → 所有设备同步
 * 用户端与后台共用同一份数据，后台改动实时反映到用户端
 * ============================================================ */
(function (global) {
  'use strict';

  var DB_KEY = 'TQ_DB_V1';
  var CONTENT_SCOPES = ['config', 'bosses', 'salons', 'notices'];

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function seed() {
    var now = new Date();
    function d(offsetDays) {
      var t = new Date(now.getTime() + offsetDays * 86400000);
      return t.toISOString().slice(0, 10);
    }
    return {
      /* ---------- 系统配置（后台可改） ---------- */
      config: {
        siteName: '乐道AI',
        domain: 'ledaoykj.com',
        memberPrice: 1980,
        referralPrice: 100,
        memberCommissionRate: 30,   // 会员佣金 %
        salonCommissionRate: 50,    // 沙龙佣金 %
        lockDays: 60,               // 锁粉有效期（天）
        refundHours: 24,            // 引荐超时未对接自动退款（小时）
        organizer: '深圳市乐道科技有限公司',
        salonHeld: '已发起100期AI出海相关主题线下沙龙',
        privatePool: '老板私域 20000+',
        serviceWechat: 'tuquan-keeper',
        wecomQRText: 'TQ-WECOM-QR-17785059319'
      },

      /* ---------- 当前登录用户（模拟微信登录态） ---------- */
      user: {
        id: 'u_1001',
        nickname: '梓',
        avatar: '',                 // 空则用首字占位
        wxNicknameBound: true,      // 是否已获取微信头像昵称
        phone: '17785059319',
        maskedPhone: '177****9319',
        role: '分销员',              // 分销员 / 会员 / 游客
        memberUntil: '2027-09-30',
        distributeEnabled: true,
        inviteCode: '17785059319',
        profile: {
          ageRange: '30-40岁',
          industryTags: ['跨境电商', 'AI应用'],
          intro: '做亚马逊选品，正在找包清关渠道',
          name: '',
          company: '',
          industry: '',
          mainBiz: '',
          wantResource: '',
          hasResource: ''
        }
      },

      /* ---------- 老板资源 ---------- */
      bosses: [
        {
          id: 'b_001', name: '刘帅', title: 'TikTok双向出海服务商', tag: '跨境外贸',
          badges: ['手握产业供应链资源、全套AI出海工具、成熟海外团队'],
          desc: '专注 TikTok To-C 零售带货与社媒 To-B 外贸询盘获客双赛道，依托 AI 自动化技术，为个人创业者、源头工厂、外贸企业',
          detail: '专注 TikTok To-C 零售带货与社媒 To-B 外贸询盘获客双赛道，依托 AI 自动化技术，为个人创业者、源头工厂、外贸企业提供双向出海服务。手握产业供应链资源、全套 AI 出海工具与成熟海外团队，可提供工厂直连、工具配置、团队搭建的全流程陪跑。',
          matched: 1, salons: 0, price: 100, cover: '', video: true, onShelf: true,
          feedbackImgs: 2, sceneImgs: 2,
          videoUrl: '', videoCover: '', avatarImg: '', photos: []
        },
        {
          id: 'b_002', name: '江文鑫', title: '趣猫娱乐科技创始人', tag: '游戏科技',
          badges: ['1. AI小游戏赛道8年深耕创业者', '2. 小游戏IAA广告变现累计3000万+', '3. AI小游戏全链路落地操盘手'],
          desc: '深耕AI小游戏8年，累计广告变现3000万+，输出可落地小游戏变现整套闭环',
          detail: '深耕 AI 小游戏赛道 8 年，累计广告变现 3000万+；拥有成熟 AI 小游戏全套开发、投流、变现闭环体系，可输出可二开游戏源码、AI 游戏生产流水线、投流跑量方法话术。适合对接：想入局小游戏变现的创业者、广告投流从业者、想搭建 AI 小游戏业务的团队，可提供源码交付、项目陪跑、业务落地咨询。',
          matched: 12, salons: 0, price: 100, cover: '', video: false, onShelf: true,
          feedbackImgs: 2, sceneImgs: 2,
          videoUrl: '', videoCover: '', avatarImg: '', photos: []
        },
        {
          id: 'b_003', name: '陈晨', title: 'Codex自动化应用实战派玩家', tag: 'AI探索/AI自动化应用',
          badges: ['已经发起Codex沙龙50+场', '帮助100+老板通过AI短视频拿到结果'],
          desc: 'Codex自动化应用实战派玩家',
          detail: 'Codex 自动化应用实战派玩家，已经发起 Codex 沙龙 50+ 场，帮助 100+ 老板通过 AI 短视频拿到结果。擅长把 AI 自动化落到真实业务流：内容生产、私域运营、短视频矩阵均有成熟实操路径。',
          matched: 20, salons: 1, price: 100, cover: 'codex', video: true, onShelf: true,
          feedbackImgs: 2, sceneImgs: 2,
          videoUrl: '', videoCover: '', avatarImg: '', photos: []
        },
        {
          id: 'b_004', name: '仲达', title: 'AI海外社媒爆款视频操盘手', tag: '外贸/出海',
          badges: ['蓝色光标B2B出海战略合作伙伴', '20年时通过微抖音开了9家连锁餐饮品牌店', 'TK和FB操盘电动车工厂做到头部'],
          desc: '5年跨境出海实战经验 AI出海全域操盘负责人',
          detail: '打造 Facebook 三地和 Instagram 五千万粉丝矩阵体系，结合 TikTok 矩阵流量截流、公域到私域自动获客系统，精准触达海外批发商、采购商、经销商，低成本获取高质量外贸询盘，搭建稳定长效海外 B 端客源渠道。',
          matched: 12, salons: 2, price: 100, cover: 'sea', video: true, onShelf: true,
          feedbackImgs: 2, sceneImgs: 2,
          videoUrl: '', videoCover: '', avatarImg: '', photos: []
        },
        {
          id: 'b_005', name: '香樟君', title: '乐道科技创始人', tag: 'AI自媒体',
          badges: ['12年新媒体实战玩家', '已发起至少100场AI沙龙', '自运营抖音账号香樟君32万粉丝'],
          desc: '乐道AI·乐道科技创始人',
          detail: '12 年新媒体实战玩家，已发起至少 100 场 AI 沙龙，自运营抖音账号「香樟君」32 万粉丝。乐道AI·乐道科技创始人，长期实地探访出海工厂、跨境公司、AI 标杆企业，所有资源均为线下实拍、真人对接、亲自筛选。',
          matched: 31, salons: 1, price: 100, cover: 'class', video: true, onShelf: true,
          feedbackImgs: 2, sceneImgs: 2,
          videoUrl: '', videoCover: '', avatarImg: '', photos: []
        }
      ],

      /* ---------- 沙龙活动 ---------- */
      salons: [
        {
          id: 's_001', title: 'AI出海·跨境资源对接沙龙（第101期）', date: d(7), city: '深圳',
          place: '龙华区·乐道沙龙基地', seats: 60, joined: 0,
          status: '筹备中', desc: '主理人正在筹备下一场沙龙，敬请期待', banner: 'boss', photos: []
        },
        {
          id: 's_002', title: 'AI自动化实战沙龙（第100期）', date: d(-14), city: '深圳',
          place: '南山区·科技园', seats: 60, joined: 60,
          status: '已结束', desc: 'Codex 商业化 AI 实战公开课', banner: 'codex', photos: []
        }
      ],

      /* ---------- 公告 ---------- */
      notices: [
        {
          id: 'n_001', type: '技巧与通知', pinned: true,
          title: '记得上传你的二维码',
          content: '这两天有部分客户报名沙龙后，不清楚该进沙龙群。针对这个痛点，系统做了更新：客户凭证页现在会直接展示你的企业微信码，请各位分销员及时在「分销中心 → 我的企业微信码」上传/更换二维码。',
          date: '9月9日'
        }
      ],

      /* ---------- 订单（会员/引荐/沙龙） ---------- */
      orders: [
        { id: 'o_1001', type: '引荐', boss: '陈晨', user: '微信用户MeoA', amount: 100, distributor: '梓', commission: 30, status: '已对接', time: d(-3) + ' 14:22' },
        { id: 'o_1002', type: '引荐', boss: '仲达', user: '微信用户Mqvo', amount: 100, distributor: '梓', commission: 30, status: '待对接', time: d(0) + ' 09:10' },
        { id: 'o_1003', type: '会员', product: 'AI出海年度老板会员', user: '微信用户Rk02', amount: 1980, distributor: '梓', commission: 594, status: '已完成', time: d(-6) + ' 20:45' },
        { id: 'o_1004', type: '沙龙', product: 'AI自动化实战沙龙（第100期）', user: '微信用户Mqvo', amount: 99, distributor: '梓', commission: 50, status: '已完成', time: d(-15) + ' 11:03' },
        { id: 'o_1005', type: '引荐', boss: '江文鑫', user: '微信用户QpLm', amount: 100, distributor: '王哥', commission: 30, status: '已退款', time: d(-8) + ' 16:31' }
      ],

      /* ---------- 分销客户（锁粉） ---------- */
      clients: [
        { id: 'c_001', nickname: '微信用户MeoA', openid: 'wx_oPq2XrN8sT1uV3wXyZ4aBcDeFg', locked: false, lockUntil: '', firstLock: d(-20), consume: '已解锁 · 累计消费 ¥2180', followups: [], salons: 1, commissionTotal: 624, owner: '梓' },
        { id: 'c_002', nickname: '微信用户Mqvo', openid: 'wx_oxFZ3MiChf74g9K2JzUcOktMqvo', locked: true, lockUntil: d(39), firstLock: d(-21), consume: '暂无消费', followups: [], salons: 1, commissionTotal: 50, owner: '杨环安' },
        { id: 'c_003', nickname: '微信用户Kk88', openid: 'wx_oKk88ZmQ7pL2nR4tY6uI0oP9aS', locked: true, lockUntil: d(52), firstLock: d(-8), consume: '暂无消费', followups: [], salons: 0, commissionTotal: 0, owner: '梓' }
      ],

      /* ---------- 我的引荐单 ---------- */
      referrals: [
        { id: 'r_2001', boss: '陈晨', client: '微信用户MeoA', amount: 100, commission: 30, status: '已对接', submitTime: d(-3) + ' 14:20', note: '微信线上沟通' }
      ],

      /* ---------- 合作线索（商务合作申请） ---------- */
      leads: [
        { id: 'l_3001', name: '李厂长', biz: '做3C配件工厂，客户是亚马逊卖家', result: '月供货 50 万', coopTypes: ['供货'], coopDetail: '我有供应链，想给乐道的老板供货分成', budget: '5-10万', contact: '138****2200', status: '待跟进', from: '梓的海报', time: d(-2) + ' 10:18' }
      ],

      /* ---------- 佣金明细 ---------- */
      commissions: [
        { id: 'cm_01', order: 'o_1003', type: '会员', amount: 594, status: '已结算', time: d(-5) },
        { id: 'cm_02', order: 'o_1004', type: '沙龙', amount: 50, status: '已结算', time: d(-14) },
        { id: 'cm_03', order: 'o_1001', type: '引荐', amount: 30, status: '已结算', time: d(-2) },
        { id: 'cm_04', order: 'o_1002', type: '引荐', amount: 30, status: '待结算', time: d(0) }
      ],

      /* ---------- 支付记录 ---------- */
      payments: [
        { id: 'p_01', title: '引荐 · 陈晨', amount: 100, status: '已支付', time: d(-3) + ' 14:20' }
      ],

      /* ---------- 沙龙凭证 ---------- */
      salonTickets: [
        { id: 't_01', salon: 'AI自动化实战沙龙（第100期）', date: d(-14), status: '已核销', code: 'TQ-S100-8821' }
      ]
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(DB_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    var db = seed();
    save(db);
    return db;
  }

  function save(db) {
    try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch (e) { /* ignore */ }
  }

  var db = load();

  /* ---------- 云同步：保存后自动推送内容域（防抖 600ms） ---------- */
  var pushTimer = null;
  function scheduleCloudPush() {
    if (!global.CloudSync) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () {
      global.CloudSync.push(CONTENT_SCOPES, db);
    }, 600);
  }

  /* 判断当前本地内容域是否仍是初始种子数据（云端为空时决定是否首推上云） */
  function seedContent() {
    var s = seed();
    return { config: s.config, bosses: s.bosses, salons: s.salons, notices: s.notices };
  }

  global.Store = {
    get: function () { return db; },
    save: function () { save(db); scheduleCloudPush(); },
    persist: function () { save(db); },
    /* 启动时云端初始化：拉取云端覆盖本地（changed 时回调刷新界面） */
    initSync: function (onChanged, onError) {
      if (!global.CloudSync) return Promise.resolve();
      return global.CloudSync.init(db, seedContent(), onChanged, onError);
    },
    reset: function () { db = seed(); save(db); scheduleCloudPush(); },
    uid: uid,
    /* 工具 */
    fmtMoney: function (n) { return '¥' + (Math.round(n * 100) / 100); },
    maskPhone: function (p) { return p ? p.slice(0, 3) + '****' + p.slice(-4) : ''; },
    today: function () { return new Date().toISOString().slice(0, 10); },
    daysBetween: function (a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }
  };
})(window);
