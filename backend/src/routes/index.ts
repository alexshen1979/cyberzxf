import Router from '@koa/router';
import { auth, optionalAuth, adminAuth, adminContentAuth, adminDistributionAuth, adminUserAuth } from '../middleware/auth';
import * as authCtrl from '../controllers/auth.controller';
import * as aiCtrl from '../controllers/ai.controller';
import * as pointsCtrl from '../controllers/points.controller';
import * as paymentCtrl from '../controllers/payment.controller';
import * as wechatCtrl from '../controllers/wechat.controller';
import * as articleCtrl from '../controllers/article.controller';
import * as adminCtrl from '../controllers/admin.controller';
import * as favCtrl from '../controllers/favorite.controller';
import * as knowledgeCtrl from '../controllers/knowledge.controller';
import * as webScrapeCtrl from '../controllers/web-scrape.controller';
import * as categoryCtrl from '../controllers/category.controller';
import * as uniCtrl from '../controllers/university.controller';
import * as volunteerCtrl from '../controllers/volunteer.controller';
import * as regionCtrl from '../controllers/region.controller';
import * as distributionCtrl from '../controllers/distribution.controller';
import * as tencentAdCtrl from '../controllers/tencent-ad.controller';

const router = new Router({ prefix: '/api/v1' });

// ─── 健康检查 ───────────────────────────────────────
router.get('/health', (ctx) => { ctx.body = { status: 'ok', timestamp: Date.now() }; });

// ─── 用户认证 ───────────────────────────────────────
router.post('/auth/miniprogram-login', authCtrl.miniProgramLogin);   // 小程序登录
router.post('/auth/mp-oauth', authCtrl.mpOAuthLogin);                // 公众号网页授权
router.get('/auth/profile', auth, authCtrl.getProfile);               // 获取用户信息
router.put('/auth/profile', auth, authCtrl.updateProfile);            // 更新用户信息
router.post('/auth/avatar', auth, authCtrl.uploadAvatar);             // 上传头像
router.get('/uploads/avatars/:filename', authCtrl.getUploadedAvatar);  // 访问头像

// ─── AI 咨询 ───────────────────────────────────────
router.post('/ai/consult', optionalAuth, aiCtrl.consult);                    // AI 咨询（未登录用户可免费试用）
router.post('/ai/stream-consult', optionalAuth, aiCtrl.streamConsult);       // 流式 AI 咨询（未登录用户可免费试用）
router.get('/ai/history', optionalAuth, aiCtrl.getHistory);                  // 咨询历史
router.get('/ai/session/:sessionId', optionalAuth, aiCtrl.getSession);       // 会话详情
router.get('/ai/quick-questions', optionalAuth, aiCtrl.getQuickQuestions); // 快捷提问
router.get('/ai/active-skill', optionalAuth, aiCtrl.getActiveSkill);       // 当前 AI Skill 名称

// ─── 点数系统 ───────────────────────────────────────
router.get('/points/balance', auth, pointsCtrl.getBalance);          // 查询余额
router.get('/points/transactions', auth, pointsCtrl.getTransactions);// 点数流水

// ─── 支付 & 订单 ────────────────────────────────────
router.get('/payments/products', optionalAuth, paymentCtrl.getProducts);   // 套餐列表
router.post('/payments/analytics', optionalAuth, paymentCtrl.recordRechargeAnalytics); // 充值页统计
router.post('/payments/order', auth, paymentCtrl.createOrder);             // 创建订单
router.post('/payments/callback', paymentCtrl.paymentCallback);            // 支付回调
router.get('/payments/virtual-callback', paymentCtrl.verifyVirtualPaymentCallback); // 小程序虚拟支付推送验证
router.post('/payments/virtual-callback', paymentCtrl.virtualPaymentCallback); // 小程序虚拟支付推送
router.get('/payments/orders/:orderNo', auth, paymentCtrl.getOrderDetail); // 单个订单状态
router.get('/payments/orders', auth, paymentCtrl.getOrders);               // 订单列表

// ─── 微信公众号消息接口 ────────────────────────────
router.get('/wechat/mp', wechatCtrl.verifyServer);                    // 服务器验证
router.post('/wechat/mp', wechatCtrl.receiveMessage);                 // 接收消息

// ─── 干货文库 ───────────────────────────────────────
router.get('/articles', optionalAuth, articleCtrl.list);             // 文章列表
router.get('/articles/:id', optionalAuth, articleCtrl.detail);       // 文章详情

// ─── 知识库 ─────────────────────────────────────────
router.get('/knowledge', optionalAuth, knowledgeCtrl.list);
router.get('/knowledge-categories', optionalAuth, knowledgeCtrl.getCategories);
router.get('/knowledge/:id', optionalAuth, knowledgeCtrl.detail);

// ─── 文章收藏 ───────────────────────────────────────
router.post('/favorites/toggle', auth, favCtrl.toggle);
router.get('/favorites/check', auth, favCtrl.check);
router.get('/favorites', auth, favCtrl.list);
router.delete('/favorites/:id', auth, favCtrl.remove);

// ─── 系统公告 ───────────────────────────────────────
router.get('/notices', optionalAuth, adminCtrl.getNotices);          // 公告列表

// ─── 公共配置（供小程序/前端读取） ──────────────────
router.get('/public-config', adminCtrl.getPublicConfig);

// ─── 分类（公开） ──────────────────────────────────
router.get('/categories', categoryCtrl.list);

// ─── 省市区域（公开） ──────────────────────────────
router.get('/regions/tree', regionCtrl.tree);

// ─── 院校库（公开） ────────────────────────────────
router.get('/universities', uniCtrl.list);
router.get('/university-filters', uniCtrl.filters);
router.get('/universities/:id', uniCtrl.detail);

// ─── 专业库（公开） ────────────────────────────────
router.get('/majors', optionalAuth, volunteerCtrl.publicMajors);
router.get('/major-categories', optionalAuth, volunteerCtrl.publicMajorCategories);
router.get('/majors/:id', optionalAuth, volunteerCtrl.publicMajorDetail);

// ─── AI 高考志愿分析 ───────────────────────────────
router.post('/volunteer/analyze', auth, volunteerCtrl.analyze);
router.post('/volunteer/preview', optionalAuth, volunteerCtrl.preview);
router.get('/volunteer/score-rank', optionalAuth, volunteerCtrl.scoreRankLookup);
router.get('/volunteer/data-years', optionalAuth, volunteerCtrl.volunteerDataYears);
router.get('/volunteer/art-support', optionalAuth, volunteerCtrl.artAdmissionSupport);
router.get('/volunteer/major-suggestions', optionalAuth, volunteerCtrl.majorSuggestions);
router.get('/volunteer/report-export-costs', optionalAuth, volunteerCtrl.reportExportCosts);
router.get('/volunteer/reports', auth, volunteerCtrl.reports);
router.get('/volunteer/reports/:id', auth, volunteerCtrl.reportDetail);
router.put('/volunteer/reports/:id/title', auth, volunteerCtrl.updateReportTitle);
router.get('/volunteer/reports/:id/export', auth, volunteerCtrl.exportReport);

// ─── 分销体系 ─────────────────────────────────────
router.get('/distribution/me', auth, distributionCtrl.me);
router.post('/distribution/apply', auth, distributionCtrl.apply);
router.get('/distribution/qrcode', auth, distributionCtrl.qrcode);
router.post('/distribution/share', auth, distributionCtrl.recordShare);
router.post('/distribution/bind-referral', auth, distributionCtrl.bindReferral);
router.get('/distribution/commissions', auth, distributionCtrl.commissions);
router.get('/distribution/registration-rewards', auth, distributionCtrl.registrationRewards);
router.get('/distribution/withdrawals', auth, distributionCtrl.withdrawals);
router.post('/distribution/withdrawals', auth, distributionCtrl.applyWithdrawal);
router.get('/distribution/withdrawals/:id/transfer-package', auth, distributionCtrl.withdrawalTransferPackage);
router.post('/distribution/withdrawals/:id/sync-transfer', auth, distributionCtrl.syncWithdrawalTransfer);
router.post('/distribution/transfer-callback', distributionCtrl.transferCallback);

// ─── 管理后台接口（需要 admin 权限） ─────────────────
const admin = new Router({ prefix: '/admin' });

// 用户管理
admin.get('/users/menu-stats', adminUserAuth, adminCtrl.getUserMenuStats);
admin.get('/users', adminUserAuth, adminCtrl.getUsers);
admin.get('/users/:id', adminUserAuth, adminCtrl.getUserDetail);
admin.put('/users/:id', adminUserAuth, adminCtrl.updateUser);
admin.delete('/users/:id/purge', adminAuth, adminCtrl.purgeUserForAdmin);

// 点数管理
admin.get('/points/:userId', adminAuth, adminCtrl.getUserPoints);
admin.post('/points/adjust', adminAuth, adminCtrl.adjustPoints);
admin.get('/point-settings', adminAuth, adminCtrl.getPointSettingsForAdmin);
admin.put('/point-settings', adminAuth, adminCtrl.updatePointSettingsForAdmin);
admin.get('/recharge-products', adminAuth, adminCtrl.getRechargeProductsForAdmin);
admin.post('/recharge-products', adminAuth, adminCtrl.createRechargeProductForAdmin);
admin.put('/recharge-products/:id', adminAuth, adminCtrl.updateRechargeProductForAdmin);
admin.delete('/recharge-products/:id', adminAuth, adminCtrl.deleteRechargeProductForAdmin);

// 订单管理
admin.get('/orders/menu-stats', adminAuth, adminCtrl.getOrderMenuStats);
admin.get('/orders/recharge-analytics', adminAuth, paymentCtrl.adminRechargeAnalytics);
admin.get('/orders/virtual-settlements', adminAuth, paymentCtrl.adminVirtualSettlementOverview);
admin.post('/orders/virtual-settlements/sync', adminAuth, paymentCtrl.adminSyncVirtualSettlements);
admin.get('/orders/virtual-settlements/sync-settings', adminAuth, paymentCtrl.adminVirtualSettlementSyncSettings);
admin.put('/orders/virtual-settlements/sync-settings', adminAuth, paymentCtrl.adminUpdateVirtualSettlementSyncSettings);
admin.post('/orders/:orderNo/sync-payment', adminAuth, paymentCtrl.adminSyncPaymentOrder);
admin.get('/orders', adminAuth, adminCtrl.getAllOrders);
admin.get('/orders/:id', adminAuth, adminCtrl.getOrderDetail);
admin.get('/payment-config/status', adminAuth, paymentCtrl.getConfigStatus);
admin.get('/payment-config', adminAuth, paymentCtrl.getAdminPaymentConfig);
admin.put('/payment-config', adminAuth, paymentCtrl.updateAdminPaymentConfig);

// 腾讯广告转化回传
admin.get('/tencent-ad-conversion/config', adminAuth, tencentAdCtrl.adminGetTencentAdConfig);
admin.put('/tencent-ad-conversion/config', adminAuth, tencentAdCtrl.adminUpdateTencentAdConfig);
admin.get('/tencent-ad-conversion/events', adminAuth, tencentAdCtrl.adminListTencentAdEvents);
admin.post('/tencent-ad-conversion/events/:id/retry', adminAuth, tencentAdCtrl.adminRetryTencentAdEvent);

// 分销管理
admin.get('/distribution/settings', adminAuth, distributionCtrl.adminSettings);
admin.put('/distribution/settings', adminAuth, distributionCtrl.adminUpdateSettings);
admin.get('/distribution/dashboard', adminAuth, distributionCtrl.adminDashboard);
admin.get('/distribution/pending-counts', adminDistributionAuth, distributionCtrl.adminPendingCounts);
admin.get('/distribution/distributors', adminAuth, distributionCtrl.adminDistributors);
admin.get('/distribution/distributor-tree', adminDistributionAuth, distributionCtrl.adminDistributorTree);
admin.get('/distribution/level-one', adminDistributionAuth, distributionCtrl.adminLevelOneDistributors);
admin.get('/distribution/general-agents', adminAuth, distributionCtrl.adminGeneralAgents);
admin.post('/distribution/distributors', adminDistributionAuth, distributionCtrl.adminCreateDistributor);
admin.put('/distribution/distributors/:id', adminDistributionAuth, distributionCtrl.adminUpdateDistributor);
admin.get('/distribution/commissions', adminDistributionAuth, distributionCtrl.adminCommissions);
admin.get('/distribution/general-agent-commissions', adminAuth, distributionCtrl.adminGeneralAgentCommissions);
admin.get('/distribution/general-agents/:id/stats', adminAuth, distributionCtrl.adminGeneralAgentStats);
admin.put('/distribution/general-agent-commissions/:id', adminAuth, distributionCtrl.adminMarkGeneralAgentCommission);
admin.get('/distribution/withdrawals', adminDistributionAuth, distributionCtrl.adminWithdrawals);
admin.put('/distribution/withdrawals/:id', adminAuth, distributionCtrl.adminReviewWithdrawal);
admin.post('/distribution/withdrawals/:id/wechat-transfer', adminAuth, distributionCtrl.adminStartWechatTransfer);
admin.post('/distribution/withdrawals/:id/query-transfer', adminAuth, distributionCtrl.adminQueryWechatTransfer);

// 内容管理
admin.get('/articles', adminAuth, articleCtrl.adminList);
admin.post('/articles', adminAuth, articleCtrl.create);
admin.put('/articles/:id', adminAuth, articleCtrl.update);
admin.delete('/articles/:id', adminAuth, articleCtrl.remove);

// 快捷提问管理
admin.get('/quick-questions', adminContentAuth, adminCtrl.getQuickQuestions);
admin.post('/quick-questions', adminContentAuth, adminCtrl.createQuickQuestion);
admin.put('/quick-questions/:id', adminContentAuth, adminCtrl.updateQuickQuestion);
admin.delete('/quick-questions/:id', adminContentAuth, adminCtrl.deleteQuickQuestion);

// 自动回复规则管理
admin.get('/auto-reply', adminContentAuth, adminCtrl.getAutoReplyRules);
admin.post('/auto-reply', adminContentAuth, adminCtrl.createAutoReplyRule);
admin.put('/auto-reply/:id', adminContentAuth, adminCtrl.updateAutoReplyRule);
admin.delete('/auto-reply/:id', adminContentAuth, adminCtrl.deleteAutoReplyRule);

// 知识库管理
admin.get('/knowledge', adminContentAuth, knowledgeCtrl.adminList);
admin.get('/knowledge/:id', adminContentAuth, knowledgeCtrl.adminDetail);
admin.post('/knowledge', adminContentAuth, knowledgeCtrl.create);
admin.put('/knowledge/:id', adminContentAuth, knowledgeCtrl.update);
admin.delete('/knowledge/:id', adminContentAuth, knowledgeCtrl.remove);

// AI 配置
admin.get('/ai-config', adminAuth, adminCtrl.getAiConfig);
admin.put('/ai-config', adminAuth, adminCtrl.updateAiConfig);

// Skill 管理
admin.get('/skills', adminAuth, adminCtrl.getSkills);
admin.post('/skills', adminAuth, adminCtrl.createSkill);
admin.post('/skills/sync-github', adminAuth, adminCtrl.syncSkillFromGithub);
admin.put('/skills/:id', adminAuth, adminCtrl.updateSkill);
admin.delete('/skills/:id', adminAuth, adminCtrl.deleteSkill);

// 公告管理
admin.get('/notices', adminAuth, adminCtrl.adminGetNotices);
admin.post('/notices', adminAuth, adminCtrl.createNotice);
admin.put('/notices/:id', adminAuth, adminCtrl.updateNotice);
admin.delete('/notices/:id', adminAuth, adminCtrl.deleteNotice);

// 数据大盘
admin.get('/dashboard', adminAuth, adminCtrl.getDashboard);

// 数据导出
admin.get('/export/users', adminAuth, adminCtrl.exportUsers);
admin.get('/export/orders', adminAuth, adminCtrl.exportOrders);
admin.get('/export/consultations', adminAuth, adminCtrl.exportConsultations);

// 公众号菜单管理
admin.get('/wechat-menu', adminContentAuth, adminCtrl.getWechatMenu);
admin.post('/wechat-menu/sync', adminContentAuth, adminCtrl.syncWechatMenu);

// 管理员账号
admin.post('/admins/login', adminCtrl.adminLogin);
admin.post('/admins', adminAuth, adminCtrl.createAdmin);
admin.get('/admins', adminAuth, adminCtrl.listAdmins);
admin.put('/admins/:id', adminAuth, adminCtrl.updateAdmin);
admin.delete('/admins/:id', adminAuth, adminCtrl.deleteAdmin);

// 院校库管理
admin.get('/universities', adminContentAuth, uniCtrl.adminList);
admin.post('/universities', adminContentAuth, uniCtrl.create);
admin.put('/universities/:id', adminContentAuth, uniCtrl.update);
admin.delete('/universities/:id', adminContentAuth, uniCtrl.remove);

// 省市区域管理
admin.get('/regions', adminAuth, regionCtrl.adminList);
admin.get('/regions/tree', adminContentAuth, regionCtrl.adminTree);
admin.post('/regions/sync-universities', adminAuth, regionCtrl.syncFromUniversities);
admin.post('/regions', adminAuth, regionCtrl.create);
admin.put('/regions/:id', adminAuth, regionCtrl.update);
admin.delete('/regions/:id', adminAuth, regionCtrl.remove);

// 志愿分析数据管理
admin.get('/volunteer/reports', adminAuth, volunteerCtrl.adminReports);
admin.get('/score-ranks', adminAuth, volunteerCtrl.adminScoreRanks);
admin.post('/score-ranks', adminAuth, volunteerCtrl.createScoreRank);
admin.post('/score-ranks/import', adminAuth, volunteerCtrl.importScoreRanks);
admin.put('/score-ranks/:id', adminAuth, volunteerCtrl.updateScoreRank);
admin.delete('/score-ranks/:id', adminAuth, volunteerCtrl.deleteScoreRank);
admin.get('/admission-scores', adminContentAuth, volunteerCtrl.adminAdmissionScores);
admin.get('/admission-scores/auto-fill/status', adminAuth, volunteerCtrl.admissionAutoFillStatus);
admin.post('/admission-scores/auto-fill/start', adminAuth, volunteerCtrl.startAdmissionAutoFillTask);
admin.post('/admission-scores/auto-fill/stop', adminAuth, volunteerCtrl.stopAdmissionAutoFillTask);
admin.post('/admission-scores', adminAuth, volunteerCtrl.createAdmissionScore);
admin.post('/admission-scores/import', adminAuth, volunteerCtrl.importAdmissionScores);
admin.put('/admission-scores/:id', adminAuth, volunteerCtrl.updateAdmissionScore);
admin.delete('/admission-scores/:id', adminAuth, volunteerCtrl.deleteAdmissionScore);
admin.get('/art-admission-rules', adminAuth, volunteerCtrl.adminArtAdmissionRules);
admin.post('/art-admission-rules', adminAuth, volunteerCtrl.createArtAdmissionRule);
admin.post('/art-admission-rules/import', adminAuth, volunteerCtrl.importArtAdmissionRules);
admin.put('/art-admission-rules/:id', adminAuth, volunteerCtrl.updateArtAdmissionRule);
admin.delete('/art-admission-rules/:id', adminAuth, volunteerCtrl.deleteArtAdmissionRule);
admin.get('/art-admission-scores', adminAuth, volunteerCtrl.adminArtAdmissionScores);
admin.post('/art-admission-scores', adminAuth, volunteerCtrl.createArtAdmissionScore);
admin.post('/art-admission-scores/import', adminAuth, volunteerCtrl.importArtAdmissionScores);
admin.put('/art-admission-scores/:id', adminAuth, volunteerCtrl.updateArtAdmissionScore);
admin.delete('/art-admission-scores/:id', adminAuth, volunteerCtrl.deleteArtAdmissionScore);
admin.get('/majors', adminContentAuth, volunteerCtrl.adminMajors);
admin.post('/majors', adminContentAuth, volunteerCtrl.createMajor);
admin.post('/majors/import', adminContentAuth, volunteerCtrl.importMajors);
admin.put('/majors/:id', adminContentAuth, volunteerCtrl.updateMajor);
admin.delete('/majors/:id', adminContentAuth, volunteerCtrl.deleteMajor);
admin.get('/university-majors', adminContentAuth, volunteerCtrl.adminUniversityMajors);
admin.post('/university-majors', adminContentAuth, volunteerCtrl.createUniversityMajor);
admin.post('/university-majors/import', adminContentAuth, volunteerCtrl.importUniversityMajors);
admin.put('/university-majors/:id', adminContentAuth, volunteerCtrl.updateUniversityMajor);
admin.delete('/university-majors/:id', adminContentAuth, volunteerCtrl.deleteUniversityMajor);

// 分类管理
admin.get('/categories', adminContentAuth, categoryCtrl.adminList);
admin.post('/categories', adminAuth, categoryCtrl.create);
admin.put('/categories/set-default/:id', adminAuth, categoryCtrl.setDefault);
admin.put('/categories/:id', adminAuth, categoryCtrl.update);
admin.delete('/categories/:id', adminAuth, categoryCtrl.remove);

// 全网搜索智能添加
admin.post('/web-search', adminContentAuth, webScrapeCtrl.webSearch);
admin.post('/web-scrape', adminContentAuth, webScrapeCtrl.webScrape);
admin.post('/web-polish', adminContentAuth, webScrapeCtrl.webPolish);

router.use(admin.routes());

export { router as routes };
