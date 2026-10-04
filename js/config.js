/* ============================================================
 * 乐道AI · 复刻系统 —— 接入配置
 * ------------------------------------------------------------
 * 微信登录（二选一或都配，支持真实接入 + 演示兜底）
 *   1) 微信内置浏览器：公众号网页授权（snsapi_userinfo）
 *      - 需要一个【已认证的服务号】或微信公众平台测试号
 *      - 在「公众号设置 → 功能设置 → 网页授权域名」填入部署域名
 *   2) 微信外浏览器：微信开放平台「网站应用」扫码登录
 *      - 需要微信开放平台账号（企业资质）+ 已审核通过的网站应用
 *   ⚠️ AppSecret 绝不能放进前端！真实换票据必须由后端完成：
 *      把下面的 apiBase 指向你的后端（见 server.js），并设置环境变量：
 *      WX_APPID / WX_SECRET
 *
 * 登录流程：进入登录页 → 唤起微信授权 → 授权成功即登录并锁定身份
 * ============================================================ */
window.WX_CONFIG = {
  // 公众号网页授权 AppID（微信内）。留空 = 演示模式
  mpAppId: '',
  // 微信开放平台网站应用 AppID（微信外扫码登录）。留空 = 演示模式
  openAppId: '',
  // 后端 API 地址（同域部署 server.js 时留空自动用同源 /api）
  apiBase: '',
  // 部署域名（用于微信授权回调回跳，留空自动取 location.origin）
  authDomain: ''
};

/* 微信分享卡片内容（JS-SDK 自定义分享；imgUrl 相对路径自动转绝对地址）
 * 生效前提：后端配置 WX_APPID/WX_SECRET + 公众号后台「JS 接口安全域名」「IP 白名单」 */
window.WX_SHARE = {
  title: '乐道AI · AI 老板资源圈',
  desc: 'AI 出海老板沙龙 · 16000+ 私域老板资源对接 · 名额有限，马上报名',
  imgUrl: 'img/logo-icon.png',
  link: ''    /* 留空 = 分享当前页面地址 */
};

/* WorkBuddy 云服务公共配置（数据跨设备同步用）
 * endpoint 必须与当前部署域名一致；publishableKey 仅标识应用，无敏感权限 */
window.PUBLIC_CONFIG = {
  endpoint: 'https://tuoquan-ai.app.workbuddy.host',
  publishableKey: 'wbpk_ZCEEBSKEIGvYtpuy9Vwcyy_ctN0eqfb1SzTA5BHRoPbhlQUMj7YXZ2k'
};
