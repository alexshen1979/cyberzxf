import Router from '@koa/router';
import { auth, optionalAuth, adminAuth } from '../middleware/auth';
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

const router = new Router({ prefix: '/api/v1' });

// ─── 健康检查 ───────────────────────────────────────
router.get('/health', (ctx) => { ctx.body = { status: 'ok', timestamp: Date.now() }; });

// ─── 用户认证 ───────────────────────────────────────
router.post('/auth/miniprogram-login', authCtrl.miniProgramLogin);   // 小程序登录
router.post('/auth/mp-oauth', authCtrl.mpOAuthLogin);                // 公众号网页授权
router.get('/auth/profile', auth, authCtrl.getProfile);               // 获取用户信息
router.put('/auth/profile', auth, authCtrl.updateProfile);            // 更新用户信息

// ─── AI 咨询 ───────────────────────────────────────
router.post('/ai/consult', optionalAuth, aiCtrl.consult);                    // AI 咨询（未登录用户可免费试用）
router.post('/ai/stream-consult', optionalAuth, aiCtrl.streamConsult);       // 流式 AI 咨询（未登录用户可免费试用）
router.get('/ai/history', optionalAuth, aiCtrl.getHistory);                  // 咨询历史
router.get('/ai/session/:sessionId', optionalAuth, aiCtrl.getSession);       // 会话详情
router.get('/ai/quick-questions', optionalAuth, aiCtrl.getQuickQuestions); // 快捷提问

// ─── 点数系统 ───────────────────────────────────────
router.get('/points/balance', auth, pointsCtrl.getBalance);          // 查询余额
router.get('/points/transactions', auth, pointsCtrl.getTransactions);// 点数流水

// ─── 支付 & 订单 ────────────────────────────────────
router.get('/payments/products', optionalAuth, paymentCtrl.getProducts);   // 套餐列表
router.post('/payments/order', auth, paymentCtrl.createOrder);             // 创建订单
router.post('/payments/callback', paymentCtrl.paymentCallback);            // 支付回调
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

// ─── AI 高考志愿分析 ───────────────────────────────
router.post('/volunteer/analyze', auth, volunteerCtrl.analyze);
router.post('/volunteer/preview', optionalAuth, volunteerCtrl.preview);
router.get('/volunteer/score-rank', optionalAuth, volunteerCtrl.scoreRankLookup);
router.get('/volunteer/data-years', optionalAuth, volunteerCtrl.volunteerDataYears);
router.get('/volunteer/major-suggestions', optionalAuth, volunteerCtrl.majorSuggestions);
router.get('/volunteer/reports', auth, volunteerCtrl.reports);
router.get('/volunteer/reports/:id', auth, volunteerCtrl.reportDetail);
router.get('/volunteer/reports/:id/export', auth, volunteerCtrl.exportReport);

// ─── 分销体系 ─────────────────────────────────────
router.get('/distribution/me', auth, distributionCtrl.me);
router.post('/distribution/apply', auth, distributionCtrl.apply);
router.get('/distribution/qrcode', auth, distributionCtrl.qrcode);
router.get('/distribution/commissions', auth, distributionCtrl.commissions);

// ─── 管理后台接口（需要 admin 权限） ─────────────────
const admin = new Router({ prefix: '/admin' });

// 用户管理
admin.get('/users', adminAuth, adminCtrl.getUsers);
admin.get('/users/:id', adminAuth, adminCtrl.getUserDetail);
admin.put('/users/:id', adminAuth, adminCtrl.updateUser);

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
admin.get('/orders', adminAuth, adminCtrl.getAllOrders);
admin.get('/orders/:id', adminAuth, adminCtrl.getOrderDetail);
admin.get('/payment-config/status', adminAuth, paymentCtrl.getConfigStatus);
admin.get('/payment-config', adminAuth, paymentCtrl.getAdminPaymentConfig);
admin.put('/payment-config', adminAuth, paymentCtrl.updateAdminPaymentConfig);

// 分销管理
admin.get('/distribution/settings', adminAuth, distributionCtrl.adminSettings);
admin.put('/distribution/settings', adminAuth, distributionCtrl.adminUpdateSettings);
admin.get('/distribution/dashboard', adminAuth, distributionCtrl.adminDashboard);
admin.get('/distribution/distributors', adminAuth, distributionCtrl.adminDistributors);
admin.get('/distribution/level-one', adminAuth, distributionCtrl.adminLevelOneDistributors);
admin.post('/distribution/distributors', adminAuth, distributionCtrl.adminCreateDistributor);
admin.put('/distribution/distributors/:id', adminAuth, distributionCtrl.adminUpdateDistributor);
admin.get('/distribution/commissions', adminAuth, distributionCtrl.adminCommissions);

// 内容管理
admin.get('/articles', adminAuth, articleCtrl.adminList);
admin.post('/articles', adminAuth, articleCtrl.create);
admin.put('/articles/:id', adminAuth, articleCtrl.update);
admin.delete('/articles/:id', adminAuth, articleCtrl.remove);

// 快捷提问管理
admin.get('/quick-questions', adminAuth, adminCtrl.getQuickQuestions);
admin.post('/quick-questions', adminAuth, adminCtrl.createQuickQuestion);
admin.put('/quick-questions/:id', adminAuth, adminCtrl.updateQuickQuestion);
admin.delete('/quick-questions/:id', adminAuth, adminCtrl.deleteQuickQuestion);

// 自动回复规则管理
admin.get('/auto-reply', adminAuth, adminCtrl.getAutoReplyRules);
admin.post('/auto-reply', adminAuth, adminCtrl.createAutoReplyRule);
admin.put('/auto-reply/:id', adminAuth, adminCtrl.updateAutoReplyRule);
admin.delete('/auto-reply/:id', adminAuth, adminCtrl.deleteAutoReplyRule);

// 知识库管理
admin.get('/knowledge', adminAuth, knowledgeCtrl.adminList);
admin.get('/knowledge/:id', adminAuth, knowledgeCtrl.adminDetail);
admin.post('/knowledge', adminAuth, knowledgeCtrl.create);
admin.put('/knowledge/:id', adminAuth, knowledgeCtrl.update);
admin.delete('/knowledge/:id', adminAuth, knowledgeCtrl.remove);

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
admin.get('/wechat-menu', adminAuth, adminCtrl.getWechatMenu);
admin.post('/wechat-menu/sync', adminAuth, adminCtrl.syncWechatMenu);

// 管理员账号
admin.post('/admins/login', adminCtrl.adminLogin);
admin.post('/admins', adminAuth, adminCtrl.createAdmin);

// 院校库管理
admin.get('/universities', adminAuth, uniCtrl.adminList);
admin.post('/universities', adminAuth, uniCtrl.create);
admin.put('/universities/:id', adminAuth, uniCtrl.update);
admin.delete('/universities/:id', adminAuth, uniCtrl.remove);

// 省市区域管理
admin.get('/regions', adminAuth, regionCtrl.adminList);
admin.get('/regions/tree', adminAuth, regionCtrl.adminTree);
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
admin.get('/admission-scores', adminAuth, volunteerCtrl.adminAdmissionScores);
admin.get('/admission-scores/auto-fill/status', adminAuth, volunteerCtrl.admissionAutoFillStatus);
admin.post('/admission-scores/auto-fill/start', adminAuth, volunteerCtrl.startAdmissionAutoFillTask);
admin.post('/admission-scores/auto-fill/stop', adminAuth, volunteerCtrl.stopAdmissionAutoFillTask);
admin.post('/admission-scores', adminAuth, volunteerCtrl.createAdmissionScore);
admin.post('/admission-scores/import', adminAuth, volunteerCtrl.importAdmissionScores);
admin.put('/admission-scores/:id', adminAuth, volunteerCtrl.updateAdmissionScore);
admin.delete('/admission-scores/:id', adminAuth, volunteerCtrl.deleteAdmissionScore);
admin.get('/majors', adminAuth, volunteerCtrl.adminMajors);
admin.post('/majors', adminAuth, volunteerCtrl.createMajor);
admin.post('/majors/import', adminAuth, volunteerCtrl.importMajors);
admin.put('/majors/:id', adminAuth, volunteerCtrl.updateMajor);
admin.delete('/majors/:id', adminAuth, volunteerCtrl.deleteMajor);
admin.get('/university-majors', adminAuth, volunteerCtrl.adminUniversityMajors);
admin.post('/university-majors', adminAuth, volunteerCtrl.createUniversityMajor);
admin.post('/university-majors/import', adminAuth, volunteerCtrl.importUniversityMajors);
admin.put('/university-majors/:id', adminAuth, volunteerCtrl.updateUniversityMajor);
admin.delete('/university-majors/:id', adminAuth, volunteerCtrl.deleteUniversityMajor);

// 分类管理
admin.get('/categories', adminAuth, categoryCtrl.adminList);
admin.post('/categories', adminAuth, categoryCtrl.create);
admin.put('/categories/set-default/:id', adminAuth, categoryCtrl.setDefault);
admin.put('/categories/:id', adminAuth, categoryCtrl.update);
admin.delete('/categories/:id', adminAuth, categoryCtrl.remove);

// 全网搜索智能添加
admin.post('/web-search', adminAuth, webScrapeCtrl.webSearch);
admin.post('/web-scrape', adminAuth, webScrapeCtrl.webScrape);
admin.post('/web-polish', adminAuth, webScrapeCtrl.webPolish);

router.use(admin.routes());

export { router as routes };
