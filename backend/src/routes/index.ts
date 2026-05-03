import Router from '@koa/router';
import { auth, optionalAuth, adminAuth } from '../middleware/auth';
import * as authCtrl from '../controllers/auth.controller';
import * as aiCtrl from '../controllers/ai.controller';
import * as pointsCtrl from '../controllers/points.controller';
import * as paymentCtrl from '../controllers/payment.controller';
import * as wechatCtrl from '../controllers/wechat.controller';
import * as articleCtrl from '../controllers/article.controller';
import * as adminCtrl from '../controllers/admin.controller';

const router = new Router({ prefix: '/api/v1' });

// ─── 健康检查 ───────────────────────────────────────
router.get('/health', (ctx) => { ctx.body = { status: 'ok', timestamp: Date.now() }; });

// ─── 用户认证 ───────────────────────────────────────
router.post('/auth/miniprogram-login', authCtrl.miniProgramLogin);   // 小程序登录
router.post('/auth/mp-oauth', authCtrl.mpOAuthLogin);                // 公众号网页授权
router.get('/auth/profile', auth, authCtrl.getProfile);               // 获取用户信息
router.put('/auth/profile', auth, authCtrl.updateProfile);            // 更新用户信息

// ─── AI 咨询 ───────────────────────────────────────
router.post('/ai/consult', auth, aiCtrl.consult);                    // AI 咨询
router.post('/ai/stream-consult', auth, aiCtrl.streamConsult);       // 流式 AI 咨询
router.get('/ai/history', auth, aiCtrl.getHistory);                  // 咨询历史
router.get('/ai/session/:sessionId', auth, aiCtrl.getSession);       // 会话详情
router.get('/ai/quick-questions', optionalAuth, aiCtrl.getQuickQuestions); // 快捷提问

// ─── 点数系统 ───────────────────────────────────────
router.get('/points/balance', auth, pointsCtrl.getBalance);          // 查询余额
router.get('/points/transactions', auth, pointsCtrl.getTransactions);// 点数流水

// ─── 支付 & 订单 ────────────────────────────────────
router.get('/payments/products', optionalAuth, paymentCtrl.getProducts);   // 套餐列表
router.post('/payments/order', auth, paymentCtrl.createOrder);             // 创建订单
router.post('/payments/callback', paymentCtrl.paymentCallback);            // 支付回调
router.get('/payments/orders', auth, paymentCtrl.getOrders);               // 订单列表

// ─── 微信公众号消息接口 ────────────────────────────
router.get('/wechat/mp', wechatCtrl.verifyServer);                    // 服务器验证
router.post('/wechat/mp', wechatCtrl.receiveMessage);                 // 接收消息

// ─── 干货文库 ───────────────────────────────────────
router.get('/articles', optionalAuth, articleCtrl.list);             // 文章列表
router.get('/articles/:id', optionalAuth, articleCtrl.detail);       // 文章详情

// ─── 系统公告 ───────────────────────────────────────
router.get('/notices', optionalAuth, adminCtrl.getNotices);          // 公告列表

// ─── 管理后台接口（需要 admin 权限） ─────────────────
const admin = new Router({ prefix: '/admin' });

// 用户管理
admin.get('/users', adminAuth, adminCtrl.getUsers);
admin.get('/users/:id', adminAuth, adminCtrl.getUserDetail);
admin.put('/users/:id', adminAuth, adminCtrl.updateUser);

// 点数管理
admin.get('/points/:userId', adminAuth, adminCtrl.getUserPoints);
admin.post('/points/adjust', adminAuth, adminCtrl.adjustPoints);

// 订单管理
admin.get('/orders', adminAuth, adminCtrl.getAllOrders);
admin.get('/orders/:id', adminAuth, adminCtrl.getOrderDetail);

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

// AI 配置
admin.get('/ai-config', adminAuth, adminCtrl.getAiConfig);
admin.put('/ai-config', adminAuth, adminCtrl.updateAiConfig);

// 公告管理
admin.get('/notices', adminAuth, adminCtrl.adminGetNotices);
admin.post('/notices', adminAuth, adminCtrl.createNotice);
admin.put('/notices/:id', adminAuth, adminCtrl.updateNotice);
admin.delete('/notices/:id', adminAuth, adminCtrl.deleteNotice);

// 数据大盘
admin.get('/dashboard', adminAuth, adminCtrl.getDashboard);

// 公众号菜单管理
admin.get('/wechat-menu', adminAuth, adminCtrl.getWechatMenu);
admin.post('/wechat-menu/sync', adminAuth, adminCtrl.syncWechatMenu);

// 管理员账号
admin.post('/admins/login', adminCtrl.adminLogin);
admin.post('/admins', adminAuth, adminCtrl.createAdmin);

router.use(admin.routes());

export { router as routes };
