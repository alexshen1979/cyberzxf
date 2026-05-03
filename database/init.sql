-- 赛博张老师 - 数据库初始化脚本
-- MySQL 8.0+

CREATE DATABASE IF NOT EXISTS cyberzhang
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE cyberzhang;

-- 用户表
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    union_id VARCHAR(64) UNIQUE COMMENT '微信开放平台 UnionID',
    mp_open_id VARCHAR(64) UNIQUE COMMENT '公众号 OpenID',
    mini_open_id VARCHAR(64) UNIQUE COMMENT '小程序 OpenID',
    nickname VARCHAR(100),
    avatar VARCHAR(500),
    phone VARCHAR(20),
    status TINYINT NOT NULL DEFAULT 1 COMMENT '1:正常 0:禁用',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_users_mp_open_id (mp_open_id),
    INDEX idx_users_mini_open_id (mini_open_id),
    INDEX idx_users_union_id (union_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- 点数账户
CREATE TABLE points_accounts (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL UNIQUE,
    balance INT NOT NULL DEFAULT 0 COMMENT '当前可用余额',
    frozen INT NOT NULL DEFAULT 0 COMMENT '冻结点数',
    expired_at DATETIME NOT NULL COMMENT '点数过期时间',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='点数账户';

-- 点数流水
CREATE TABLE points_transactions (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    type VARCHAR(20) NOT NULL COMMENT 'gift|charge|consume|refund|expire',
    amount INT NOT NULL COMMENT '变动数量（正增负减）',
    balance_after INT NOT NULL COMMENT '操作后余额',
    source VARCHAR(50) COMMENT '来源',
    source_id VARCHAR(100) COMMENT '来源关联ID',
    remark VARCHAR(500),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pt_user_id (user_id),
    INDEX idx_pt_created_at (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='点数流水';

-- 订单表
CREATE TABLE orders (
    id VARCHAR(36) PRIMARY KEY,
    order_no VARCHAR(30) UNIQUE NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    product_id VARCHAR(50) NOT NULL,
    product_name VARCHAR(100) NOT NULL,
    amount INT NOT NULL COMMENT '实付金额（分）',
    points INT NOT NULL COMMENT '购买点数',
    bonus_points INT NOT NULL DEFAULT 0 COMMENT '赠送点数',
    status VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT 'pending|paid|refunded|closed',
    paid_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_orders_user_id (user_id),
    INDEX idx_orders_status (status),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单表';

-- 咨询记录
CREATE TABLE consultation_records (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    session_id VARCHAR(100) NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    model VARCHAR(50) NOT NULL,
    points_cost INT NOT NULL COMMENT '本次消耗点数',
    channel VARCHAR(20) NOT NULL DEFAULT 'miniprogram' COMMENT 'miniprogram|mp_public',
    type VARCHAR(20) NOT NULL DEFAULT 'normal' COMMENT 'normal|deep',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_cr_user_id (user_id),
    INDEX idx_cr_session_id (session_id),
    INDEX idx_cr_created_at (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='咨询记录';

-- 干货文库
CREATE TABLE articles (
    id VARCHAR(36) PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    cover VARCHAR(500),
    category VARCHAR(20) NOT NULL DEFAULT 'gaokao' COMMENT 'gaokao|kaoyan|zhiye|bimian',
    status VARCHAR(20) NOT NULL DEFAULT 'published' COMMENT 'draft|published|archived',
    view_count INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_articles_category (category),
    INDEX idx_articles_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='干货文库';

-- AI 全局配置
CREATE TABLE ai_config (
    id VARCHAR(36) PRIMARY KEY,
    model VARCHAR(50) NOT NULL DEFAULT 'deepseek-chat',
    temperature FLOAT NOT NULL DEFAULT 0.7,
    max_tokens INT NOT NULL DEFAULT 2000,
    top_p FLOAT NOT NULL DEFAULT 0.9,
    context_window INT NOT NULL DEFAULT 10,
    skill_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    skill_weight FLOAT NOT NULL DEFAULT 0.6,
    points_per_query INT NOT NULL DEFAULT 5,
    points_per_deep INT NOT NULL DEFAULT 18,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI配置（单例）';

-- 系统公告
CREATE TABLE system_notices (
    id VARCHAR(36) PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'notice' COMMENT 'notice|popup|alert',
    status VARCHAR(20) NOT NULL DEFAULT 'published' COMMENT 'draft|published|archived',
    published_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统公告';

-- 快捷提问模板
CREATE TABLE quick_questions (
    id VARCHAR(36) PRIMARY KEY,
    question TEXT NOT NULL,
    category VARCHAR(20) NOT NULL DEFAULT 'general',
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='快捷提问模板';

-- 公众号自动回复规则
CREATE TABLE auto_reply_rules (
    id VARCHAR(36) PRIMARY KEY,
    keyword VARCHAR(100) NOT NULL,
    match_mode VARCHAR(20) NOT NULL DEFAULT 'exact' COMMENT 'exact|contains|regex',
    reply_type VARCHAR(20) NOT NULL DEFAULT 'text' COMMENT 'text|image|news|card',
    reply_content TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'enabled',
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='公众号自动回复规则';

-- 公众号菜单
CREATE TABLE wechat_menus (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    type VARCHAR(20) NOT NULL COMMENT 'click|view|miniprogram|parent',
    `key` VARCHAR(100),
    url VARCHAR(500),
    app_id VARCHAR(64),
    page_path VARCHAR(200),
    parent_id VARCHAR(36),
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_wm_parent_id (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='公众号自定义菜单';

-- 管理员
CREATE TABLE admins (
    id VARCHAR(36) PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(200) NOT NULL COMMENT 'bcrypt hash',
    role VARCHAR(20) NOT NULL DEFAULT 'admin' COMMENT 'admin|super_admin',
    status TINYINT NOT NULL DEFAULT 1,
    last_login DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='管理员';

-- 默认管理员密码: admin123（bcrypt 加密）
INSERT INTO admins (id, username, password, role) VALUES
  (UUID(), 'admin', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'super_admin');

-- 默认 AI 配置
INSERT INTO ai_config (id) VALUES (UUID());

-- 默认快捷提问
INSERT INTO quick_questions (id, question, category, sort_order) VALUES
  (UUID(), '理科580分能上什么大学？', 'gaokao', 1),
  (UUID(), '计算机专业就业前景如何？', 'gaokao', 2),
  (UUID(), '土木工程还值得学吗？', 'gaokao', 3),
  (UUID(), '考研二战划算吗？', 'kaoyan', 4),
  (UUID(), '金融学和经济学有什么区别？', 'gaokao', 5);
