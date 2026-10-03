/* ============================================================
 * 乐道AI · 复刻系统 —— 数据层
 * 云端数据库（tq_content）为唯一数据源，localStorage 仅作本地缓存：
 *   - 启动时 Store.initSync() 拉取云端全部内容域
 *   - 后台保存（Store.save()）自动把内容域推送云端 → 所有设备同步
 * 用户端与后台共用同一份数据，后台改动实时反映到用户端
 *
 * 内容域（scope）：config / bosses / salons / notices / posts /
 *   banners / vipPage / signups / commissions / referrals /
 *   coopLeads / distTeam / members / upsells
 * 说明：登录身份（user）与站内通知（notifs）为「本机」数据，不上云。
 * ============================================================ */
(function (global) {
  'use strict';

  var DB_KEY = 'TQ_DB_V1';
  var CONTENT_SCOPES = [
    'config', 'bosses', 'salons', 'notices', 'posts',
    'banners', 'vipPage', 'signups', 'commissions', 'referrals',
    'coopLeads', 'distTeam', 'members', 'upsells', 'distApplyList'
  ];

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function seed() {
    var now = new Date();
    function d(offsetDays) {
      var t = new Date(now.getTime() + offsetDays * 86400000);
      return t.toISOString().slice(0, 10);
    }
    function dt(offsetDays, hhmm) {
      return d(offsetDays) + ' ' + (hhmm || '10:00');
    }

    return {
      /* ---------- 系统配置（后台可改） ---------- */
      config: {
        siteName: '乐道AI',
        domain: 'ledaoykj.com',
        memberPrice: 1980,
        memberDays: 365,
        referralPrice: 100,
        memberCommissionRate: 30,   // 会员佣金 %
        salonCommissionRate: 50,    // 沙龙佣金 %
        lockDays: 60,               // 锁粉有效期（天，0=永久）
        refundHours: 24,            // 引荐超时未对接自动退款（小时）
        referralQuota: 3,           // 会员每月免费引荐次数
        organizer: '深圳市乐道科技有限公司',
        salonHeld: '已发起100期AI出海相关主题线下沙龙',
        privatePool: '老板私域 20000+',
        serviceWechat: 'ledaoykj-keeper',
        wecomQRText: 'TQ-WECOM-QR-17785059319',
        coopWechat: 'ledaoykj-coop',
        coopName: '乐道科技 · 商务合作',
        hiddenTabs: [],             // 首页入口开关：circle / bosses
        payInfo: {                  // 微信/支付宝收款信息（后台「收款设置」可改，服务端 pay/save 同步）
          wxQr: '', aliQr: '',      // 收款二维码图片地址（/uploads/payqr-*.jpg）
          wxName: '', aliName: '',  // 收款人名称
          amount: 0,                // 默认收款金额（0=按订单金额）
          note: '',                 // 订单说明（收款弹窗展示）
          updatedAt: ''
        }
      },

      /* ---------- 当前登录用户（微信登录态 · 本机） ---------- */
      user: {
        id: 'u_1001',
        nickname: '梓',
        avatar: '',
        wxNicknameBound: true,
        phone: '17785059319',
        role: 'boss',               // boss / distributor / 空（demo：主理人，可亲自分销）
        member: true,
        memberExpire: d(364),
        advisorAdded: false,
        superadmin: false,
        title: '',
        sub: '',
        boundName: '',
        inviteCode: '17785059319',
        distApply: '',
        profile: {
          realName: '', company: '', industry: '', mainBiz: '',
          wantRes: '', hasRes: '', wechat: '', intro: ''
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
          videoUrl: '', videoCover: '', avatarImg: '', photos: [], quota: 20, quotaLeft: 19, eventIds: []
        },
        {
          id: 'b_002', name: '江文鑫', title: '趣猫娱乐科技创始人', tag: '游戏科技',
          badges: ['1. AI小游戏赛道8年深耕创业者', '2. 小游戏IAA广告变现累计3000万+', '3. AI小游戏全链路落地操盘手'],
          desc: '深耕AI小游戏8年，累计广告变现3000万+，输出可落地小游戏变现整套闭环',
          detail: '深耕 AI 小游戏赛道 8 年，累计广告变现 3000万+；拥有成熟 AI 小游戏全套开发、投流、变现闭环体系，可输出可二开游戏源码、AI 游戏生产流水线、投流跑量方法话术。适合对接：想入局小游戏变现的创业者、广告投流从业者、想搭建 AI 小游戏业务的团队，可提供源码交付、项目陪跑、业务落地咨询。',
          matched: 12, salons: 0, price: 100, cover: '', video: false, onShelf: true,
          feedbackImgs: 2, sceneImgs: 2,
          videoUrl: '', videoCover: '', avatarImg: '', photos: [], quota: 20, quotaLeft: 8, eventIds: []
        },
        {
          id: 'b_003', name: '陈晨', title: 'Codex自动化应用实战派玩家', tag: 'AI探索/AI自动化应用',
          badges: ['已经发起Codex沙龙50+场', '帮助100+老板通过AI短视频拿到结果'],
          desc: 'Codex自动化应用实战派玩家',
          detail: 'Codex 自动化应用实战派玩家，已经发起 Codex 沙龙 50+ 场，帮助 100+ 老板通过 AI 短视频拿到结果。擅长把 AI 自动化落到真实业务流：内容生产、私域运营、短视频矩阵均有成熟实操路径。',
          matched: 20, salons: 1, price: 100, cover: 'codex', video: true, onShelf: true,
          feedbackImgs: 2, sceneImgs: 2,
          videoUrl: '', videoCover: '', avatarImg: '', photos: [], quota: 20, quotaLeft: 20, eventIds: ['s_002']
        },
        {
          id: 'b_004', name: '仲达', title: 'AI海外社媒爆款视频操盘手', tag: '外贸/出海',
          badges: ['蓝色光标B2B出海战略合作伙伴', '20年时通过微抖音开了9家连锁餐饮品牌店', 'TK和FB操盘电动车工厂做到头部'],
          desc: '5年跨境出海实战经验 AI出海全域操盘负责人',
          detail: '打造 Facebook 三地和 Instagram 五千万粉丝矩阵体系，结合 TikTok 矩阵流量截流、公域到私域自动获客系统，精准触达海外批发商、采购商、经销商，低成本获取高质量外贸询盘，搭建稳定长效海外 B 端客源渠道。',
          matched: 12, salons: 2, price: 100, cover: 'sea', video: true, onShelf: true,
          feedbackImgs: 2, sceneImgs: 2,
          videoUrl: '', videoCover: '', avatarImg: '', photos: [], quota: 20, quotaLeft: 3, eventIds: ['s_002']
        },
        {
          id: 'b_005', name: '香樟君', title: '乐道科技创始人', tag: 'AI自媒体',
          badges: ['12年新媒体实战玩家', '已发起至少100场AI沙龙', '自运营抖音账号香樟君32万粉丝'],
          desc: '乐道AI·乐道科技创始人',
          detail: '12 年新媒体实战玩家，已发起至少 100 场 AI 沙龙，自运营抖音账号「香樟君」32 万粉丝。乐道AI·乐道科技创始人，长期实地探访出海工厂、跨境公司、AI 标杆企业，所有资源均为线下实拍、真人对接、亲自筛选。',
          matched: 31, salons: 1, price: 100, cover: 'class', video: true, onShelf: true,
          feedbackImgs: 2, sceneImgs: 2,
          videoUrl: '', videoCover: '', avatarImg: '', photos: [], quota: 20, quotaLeft: 20, eventIds: ['s_002']
        }
      ],

      /* ---------- 圈子动态 ---------- */
      posts: [
        {
          id: 'cp_001', cat: 'res', pinned: true, mine: false, status: 'on', createdAt: dt(-2, '10:20'),
          content: '工厂直连：3C 配件（充电头/数据线/支架）现货供应，支持一件代发与小批量定制，已服务 200+ 亚马逊/独立站卖家。有需要供应链的圈友可以找我聊，样品免费寄。',
          images: [], videoUrl: 'https://channels.weixin.qq.com/web/pages/factory-tour',
          author: { nickname: '李厂长', avatarUrl: '', company: '深圳鹏芯电子有限公司', industry: '3C配件工厂' }
        },
        {
          id: 'cp_002', cat: 'need', pinned: false, mine: false, status: 'on', createdAt: dt(-5, '15:40'),
          content: '找 TikTok 美区带货达人合作：家居收纳类目，客单价 29-59 美金，我们有现货和海外仓，可给到 35% 佣金 + 免费样品。',
          images: [], videoUrl: '',
          author: { nickname: 'Cathy', avatarUrl: '', company: '杭州瞬达跨境', industry: '跨境电商' }
        },
        {
          id: 'cp_003', cat: 'coop', pinned: false, mine: false, status: 'on', createdAt: dt(-9, '09:05'),
          content: '招募 AI 应用合伙人：我们做企业知识库 + 智能客服落地，已有 30 家企业客户，需要有销售资源或行业渠道的伙伴一起做大。',
          images: [], videoUrl: '',
          author: { nickname: '老王', avatarUrl: '', company: '云智科技', industry: 'AI应用' }
        },
        {
          id: 'cp_004', cat: 'idea', pinned: false, mine: false, status: 'on', createdAt: dt(-14, '20:12'),
          content: '这周跑了几家出海工厂，最大的感受是：老板们不缺产能，缺的是“把产能讲给海外客户听”的内容能力。AI 短视频矩阵恰好补这一环。',
          images: [], videoUrl: '',
          author: { nickname: '香樟君', avatarUrl: '', company: '乐道科技', industry: 'AI自媒体' }
        },
        {
          id: 'cp_005', cat: 'res', pinned: false, mine: false, status: 'pending', createdAt: dt(-1, '11:32'),
          content: '我们有越南/印尼海外仓，做美区一件代发，想对接做 TikTok 的卖家，可谈账期。',
          images: [], videoUrl: '',
          author: { nickname: '阿强', avatarUrl: '', company: '南洋仓配', industry: '跨境物流' }
        }
      ],

      /* ---------- 沙龙活动 ---------- */
      salons: [
        {
          id: 's_001', title: 'AI出海·跨境资源对接沙龙（第101期）', date: d(7), time: '14:00', city: '深圳',
          place: '龙华区·乐道沙龙基地', seats: 60, joined: 12,
          status: '报名中', desc: '主理人正在筹备下一场沙龙，敬请期待', banner: 'boss', photos: [],
          price: 199, mprice: 0,
          videoUrl: '', sharePoints: ['AI 出海最新玩法拆解', '跨境资源现场对接', '老板自我介绍与需求发布'],
          audience: '做跨境、外贸、AI 应用，想找供应链与海外渠道的老板',
          notice: '1.沙龙最终地点以活动群内具体通知为准\n2.这是唯一报名通道，请勿私下转账报名\n3.报名后务必联系销售客服拉你进活动群',
          bossIds: ['b_001'], published: true, deleted: false
        },
        {
          id: 's_002', title: 'AI自动化实战沙龙（第100期）', date: d(-14), time: '14:00', city: '深圳',
          place: '南山区·科技园', seats: 60, joined: 60,
          status: '已结束', desc: 'Codex 商业化 AI 实战公开课', banner: 'codex', photos: [],
          price: 99, mprice: 0,
          videoUrl: '', sharePoints: ['Codex 商业化落地路径', 'AI 短视频矩阵搭建', '100+ 老板拿到结果复盘'],
          audience: '想用 AI 自动化降本增效的创业者',
          notice: '1.沙龙最终地点以活动群内具体通知为准\n2.这是唯一报名通道，请勿私下转账报名\n3.报名后务必联系销售客服拉你进活动群',
          bossIds: ['b_003'], published: true, deleted: false
        },
        {
          id: 's_003', title: 'AI出海·品牌出海闭门沙龙（第102期）', date: d(21), time: '13:30', city: '深圳',
          place: '南山区·待定', seats: 40, joined: 0,
          status: '筹备中', desc: '品牌出海与独立站选品闭门交流', banner: 'sea', photos: [],
          price: 299, mprice: 0,
          videoUrl: '', sharePoints: [], audience: '', notice: '',
          bossIds: ['b_004'], published: false, deleted: false
        }
      ],

      /* ---------- 公告 ---------- */
      notices: [
        {
          id: 'n_001', cat: 'tip', type: '技巧与通知', pinned: true,
          title: '记得上传你的二维码',
          content: '这两天有部分客户报名沙龙后，不清楚该进沙龙群。针对这个痛点，系统做了更新：客户凭证页现在会直接展示你的企业微信码，请各位分销员及时在「分销中心 → 我的企业微信码」上传/更换二维码。',
          date: d(-22), read: false
        },
        {
          id: 'n_002', cat: 'rule', type: '规则红线', pinned: false,
          title: '分销归因以「首次点击」为准',
          content: '客户首次点击分销员链接即完成锁定，锁定期内成交佣金归该分销员；锁定期内请勿私下加价或另开收款渠道，一经发现取消分销资格。',
          date: d(-40), read: true
        }
      ],

      /* ---------- 首页运营位 ---------- */
      banners: [
        {
          id: 'bn_001', img: 'img/logo.png', title: '乐道AI · 年度老板会员', sub: '全年沙龙免门票 · 老板资源免费引荐',
          linkType: 'vip', linkValue: '', on: true, sort: 1
        }
      ],

      /* ---------- 会员落地页配置（后台可改文案；空=用内置默认） ---------- */
      vipPage: { price: 1980, days: 365, sections: {} },

      /* ---------- 统一订单 / 凭证 ---------- */
      signups: [
        {
          id: 'sg_1001', kind: 'refer', type: 'normal', bossId: 'b_003', bossName: '陈晨',
          title: '老板引荐 · 陈晨', name: '王磊', phone: '13800002200',
          amount: 100, paid: true, paidAt: dt(-3, '14:20'), refunded: false, createdAt: dt(-3, '14:12'),
          code: 'TQ-R-8821', dist: '17785059319', distName: '梓',
          referred: true, referredAt: dt(-3, '16:40'), dock: 'done',
          demand: '想对接小游戏变现路径与投流话术',
          formData: { name: '王磊', wx: 'wanglei_88', need: '想对接小游戏变现路径与投流话术' }
        },
        {
          id: 'sg_1002', kind: 'refer', type: 'normal', bossId: 'b_004', bossName: '仲达',
          title: '老板引荐 · 仲达', name: '李倩', phone: '13900003311',
          amount: 100, paid: true, paidAt: dt(-1, '09:10'), refunded: false, createdAt: dt(-1, '09:02'),
          code: 'TQ-R-8822', dist: '17785059319', distName: '梓',
          referred: false, dock: 'pending', demand: '想了解 Facebook 矩阵起号',
          deadline: new Date(now.getTime() + 18 * 3600000).toISOString(),
          formData: { name: '李倩', wx: 'lq_2024', need: '想了解 Facebook 矩阵起号' }
        },
        {
          id: 'sg_1003', kind: 'member', type: 'normal', title: 'AI出海年度老板会员', name: '周涛', phone: '13700004455',
          amount: 1980, paid: true, paidAt: dt(-6, '20:45'), refunded: false, createdAt: dt(-6, '20:40'),
          code: 'TQ-V-1001', dist: '17785059319', distName: '梓',
          memberDays: 365, formData: {}
        },
        {
          id: 'sg_1004', kind: 'salon', type: 'normal', evId: 's_002', title: 'AI自动化实战沙龙（第100期）',
          name: '赵敏', phone: '13600005566', amount: 99, paid: true, paidAt: dt(-15, '11:03'),
          refunded: false, createdAt: dt(-15, '11:00'), code: 'TQ-S-2001', dist: '17785059319', distName: '梓',
          formData: { name: '赵敏', phone: '13600005566', want: '学习 AI 自动化落地' }
        },
        {
          id: 'sg_1005', kind: 'refer', type: 'normal', bossId: 'b_002', bossName: '江文鑫',
          title: '老板引荐 · 江文鑫', name: '孙浩', phone: '13500006677',
          amount: 100, paid: true, paidAt: dt(-8, '16:31'), refunded: true, autoRefunded: true,
          createdAt: dt(-8, '16:20'), code: 'TQ-R-8823', dist: '13800001111', distName: '王哥',
          referred: false, dock: 'pending', demand: '想找小游戏源码合作',
          formData: { name: '孙浩', wx: 'sunhao_x', need: '想找小游戏源码合作' }
        },
        {
          id: 'sg_1006', kind: 'salon', type: 'normal', evId: 's_001', title: 'AI出海·跨境资源对接沙龙（第101期）',
          name: '梓', phone: '17785059319', amount: 199, paid: false, refunded: false,
          createdAt: dt(0, '09:30'), code: 'TQ-S-2002', dist: '', distName: '',
          formData: { name: '梓', phone: '17785059319', want: '' }
        }
      ],

      /* ---------- 佣金台账 ---------- */
      commissions: [
        { id: 'cm_01', signupId: 'sg_1003', kind: 'member', title: 'AI出海年度老板会员', name: '周涛', amount: 594, rate: 30, dist: '17785059319', distName: '梓', status: '已结算', time: dt(-5, '10:00') },
        { id: 'cm_02', signupId: 'sg_1004', kind: 'salon', title: 'AI自动化实战沙龙（第100期）', name: '赵敏', amount: 49.5, rate: 50, dist: '17785059319', distName: '梓', status: '已结算', time: dt(-14, '10:00') },
        { id: 'cm_03', signupId: 'sg_1001', kind: 'refer', title: '老板引荐 · 陈晨', name: '王磊', amount: 30, rate: 30, dist: '17785059319', distName: '梓', status: '已结算', time: dt(-2, '10:00') },
        { id: 'cm_04', signupId: 'sg_1002', kind: 'refer', title: '老板引荐 · 仲达', name: '李倩', amount: 30, rate: 30, dist: '17785059319', distName: '梓', status: '待结算', time: dt(0, '09:10') }
      ],

      /* ---------- 引荐单（对接台账，与 signups kind=refer 同源简化） ---------- */
      referrals: [
        { id: 'r_2001', signupId: 'sg_1001', bossId: 'b_003', bossName: '陈晨', client: '王磊', phone: '13800002200', amount: 100, commission: 30, dock: 'done', referred: true, dist: '17785059319', distName: '梓', demand: '想对接小游戏变现路径与投流话术', submitTime: dt(-3, '16:40'), note: '微信线上沟通' },
        { id: 'r_2002', signupId: 'sg_1002', bossId: 'b_004', bossName: '仲达', client: '李倩', phone: '13900003311', amount: 100, commission: 30, dock: 'pending', referred: false, dist: '17785059319', distName: '梓', demand: '想了解 Facebook 矩阵起号', submitTime: dt(-1, '09:02'), note: '', deadline: new Date(now.getTime() + 18 * 3600000).toISOString() }
      ],

      /* ---------- 商务合作线索 ---------- */
      coopLeads: [
        {
          id: 'l_3001', name: '李厂长', biz: '做3C配件工厂，客户是亚马逊卖家', result: '月供货 50 万',
          want: '我有供应链，想给乐道的老板供货分成', types: ['供货'], budget: '5-10万',
          phone: '13800002200', wechat: 'lichang_3c', status: 'new',
          dist: '17785059319', distName: '梓', commission: 0, cmState: '', note: '', time: dt(-2, '10:18')
        }
      ],

      /* ---------- 分销团队（老板端） ---------- */
      distTeam: [
        { phone: '17785059319', name: '梓', nickname: '梓', role: 'distributor', rates: { member: 30, salon: 50 }, custCount: 3, lockedCount: 2, dealCount: 3, totalPaid: 2379, pendingTotal: 30, settlingTotal: 0, settledTotal: 673.5, wxQrStatus: 'approved', lockDays: 60, reLockable: false, rawView: false },
        { phone: '13800001111', name: '王哥', nickname: '王哥', role: 'distributor', rates: { member: 30, salon: 50 }, custCount: 1, lockedCount: 0, dealCount: 0, totalPaid: 0, pendingTotal: 0, settlingTotal: 0, settledTotal: 0, wxQrStatus: 'pending', lockDays: 60, reLockable: false, rawView: false }
      ],

      /* ---------- 会员名册 ---------- */
      members: [
        { phone: '13700004455', nickname: '周涛', realName: '周涛', company: '深圳某跨境电商', industry: '跨境电商', expire: d(359), status: 'active', paidTotal: 1980, orderCount: 1, distName: '梓', wxBound: true, signAt: dt(-6, '20:45') }
      ],

      /* ---------- 升单记录（老客户二次成交） ---------- */
      upsells: [
        { id: 'up_01', customer: '周涛', phone: '13700004455', product: '深度流量合作', amount: 16800, commission: 1680, rate: 10, mode: 'rate', source: 'lock', dist: '17785059319', distName: '梓', date: d(-4), note: '会员复购', refunded: false }
      ],

      /* ---------- 分销客户（锁粉） ---------- */
      clients: [
        { id: 'c_001', nickname: '微信用户MeoA', openid: 'wx_oPq2XrN8sT1uV3wXyZ4aBcDeFg', locked: false, lockUntil: '', firstLock: d(-20), consume: '已解锁 · 累计消费 ¥2180', followups: [], salons: 1, commissionTotal: 624, owner: '梓' },
        { id: 'c_002', nickname: '微信用户Mqvo', openid: 'wx_oxFZ3MiChf74g9K2JzUcOktMqvo', locked: true, lockUntil: d(39), firstLock: d(-21), consume: '暂无消费', followups: [], salons: 1, commissionTotal: 50, owner: '杨环安' },
        { id: 'c_003', nickname: '微信用户Kk88', openid: 'wx_oKk88ZmQ7pL2nR4tY6uI0oP9aS', locked: true, lockUntil: d(52), firstLock: d(-8), consume: '暂无消费', followups: [], salons: 0, commissionTotal: 0, owner: '梓' }
      ],

      /* ---------- 分销申请（待审） ---------- */
      distApplyList: []
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(DB_KEY);
      if (raw) {
        var db = JSON.parse(raw);
        /* 结构升级：补齐新内容域，避免老缓存缺字段 */
        var s = seed();
        Object.keys(s).forEach(function (k) { if (db[k] === undefined) db[k] = s[k]; });
        return db;
      }
    } catch (e) { /* ignore */ }
    var fresh = seed();
    save(fresh);
    return fresh;
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
    var out = {};
    CONTENT_SCOPES.forEach(function (k) { out[k] = s[k]; });
    return out;
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
    /* 角色回填：审批通过后，申请人设备按云端 distTeam 反查自己手机号，自动升级为分销员。
       返回 true 表示本地用户数据有变更（调用方应刷新界面） */
    reconcileDistRole: function () {
      var u = db.user;
      if (!u || u.role === 'boss' || u.superadmin) return false;
      var key = function (p) { return String(p == null ? '' : p).trim(); };
      var mine = db.distTeam.filter(function (m) {
        /* 只按绑定手机号匹配；inviteCode 默认继承主理人演示值，不能作为身份键 */
        return key(m.phone) && key(u.phone) && key(m.phone) === key(u.phone);
      })[0];
      var changed = false;
      if (mine) {
        if (u.role !== 'distributor') { u.role = 'distributor'; changed = true; }
        if (u.distApply) { u.distApply = ''; changed = true; }
        /* 锁粉链接归属自己：inviteCode 还不是本人手机号时纠正 */
        if (/^1\d{10}$/.test(key(u.phone)) && key(u.inviteCode) !== key(u.phone)) { u.inviteCode = key(u.phone); changed = true; }
      } else if (u.distApply === 'pending') {
        /* 云端申请列表里已没有自己的申请（且不在分销团队）→ 已被驳回，恢复可再申请 */
        var stillThere = (db.distApplyList || []).some(function (a) {
          return key(a.phone) && key(u.phone) && key(a.phone) === key(u.phone);
        });
        if (!stillThere) { u.distApply = ''; changed = true; }
      }
      if (changed) save(db);
      return changed;
    },

    reset: function () { db = seed(); save(db); scheduleCloudPush(); },
    uid: uid,
    /* 工具 */
    fmtMoney: function (n) { return '¥' + (Math.round(n * 100) / 100); },
    maskPhone: function (p) { return p ? String(p).slice(0, 3) + '****' + String(p).slice(-4) : ''; },
    today: function () { return new Date().toISOString().slice(0, 10); },
    daysBetween: function (a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }
  };
})(window);
