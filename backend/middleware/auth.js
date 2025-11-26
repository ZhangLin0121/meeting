const User = require('../models/User');
const ResponseHelper = require('../utils/responseHelper');

/**
 * 身份验证中间件
 * 验证用户的微信openid并获取用户信息
 */
async function authenticate(req, res, next) {
    try {
        // 从请求头获取openid - 支持多种格式以兼容不同设备
        const openid = req.headers['x-user-openid'] ||
            req.headers['x-openid'] ||
            req.headers['openid'] ||
            req.headers['X-User-Openid'] ||
            req.headers['X-Openid'] ||
            req.headers['Openid'];

        console.log('🔍 认证中间件 - 请求头:', {
            'x-user-openid': req.headers['x-user-openid'],
            'openid': req.headers['openid'],
            'X-User-Openid': req.headers['X-User-Openid'],
            'user-agent': req.headers['user-agent']
        });

        if (!openid) {
            console.warn('❌ 认证失败: 缺少用户身份信息');
            return ResponseHelper.unauthorized(res, '缺少用户身份信息');
        }

        console.log('🔑 找到用户标识:', openid);

        // 查找用户
        let user = await User.findOne({ openid });

        if (!user) {
            console.log('👤 用户不存在，创建新用户:', openid);
            // 如果用户不存在，创建新用户
            user = new User({
                openid,
                nickname: req.headers['x-nickname'] || req.headers.nickname || '微信用户',
                avatarUrl: req.headers['x-avatar-url'] || req.headers.avatarurl || '',
                role: 'employee' // 默认为普通员工
            });

            await user.save();
            console.log(`✅ 新用户注册成功: ${openid}`);
        } else {
            console.log(`✅ 用户认证成功: ${openid}`);
        }

        // 将用户信息添加到请求对象
        req.user = user;
        req.openid = openid;

        next();
    } catch (error) {
        console.error('❌ 身份验证失败:', error);
        return ResponseHelper.serverError(res, '身份验证失败', error.message);
    }
}

/**
 * 管理员权限验证中间件
 * 必须在authenticate中间件之后使用
 */
function requireAdmin(req, res, next) {
    if (!req.user) {
        return ResponseHelper.unauthorized(res, '请先进行身份验证');
    }

    if (req.user.role !== 'admin') {
        return ResponseHelper.forbidden(res, '需要管理员权限');
    }

    next();
}

/**
 * 可选的身份验证中间件
 * 如果有openid就验证，没有就跳过
 */
async function optionalAuth(req, res, next) {
    try {
        const openid = req.headers['x-openid'] || req.headers.openid;

        if (openid) {
            const user = await User.findOne({ openid });
            if (user) {
                req.user = user;
                req.openid = openid;
            }
        }

        next();
    } catch (error) {
        console.error('可选身份验证失败:', error);
        // 可选验证失败不阻止请求继续
        next();
    }
}

module.exports = {
    authenticate,
    requireAdmin,
    optionalAuth
};