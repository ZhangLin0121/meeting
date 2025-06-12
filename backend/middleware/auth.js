const User = require('../models/User');
const ResponseHelper = require('../utils/responseHelper');

/**
 * 身份验证中间件
 * 验证用户的微信openid并获取用户信息
 */
async function authenticate(req, res, next) {
    try {
        // 从请求头获取openid
        const openid = req.headers['x-user-openid'] || req.headers.openid;

        if (!openid) {
            return ResponseHelper.unauthorized(res, '缺少用户身份信息');
        }

        // 查找用户
        let user = await User.findOne({ openid });

        if (!user) {
            // 如果用户不存在，创建新用户
            user = new User({
                openid,
                nickname: req.headers['x-nickname'] || req.headers.nickname || '',
                avatarUrl: req.headers['x-avatar-url'] || req.headers.avatarurl || '',
                role: 'employee' // 默认为普通员工
            });

            await user.save();
            console.log(`✅ 新用户注册: ${openid}`);
        }

        // 将用户信息添加到请求对象
        req.user = user;
        req.openid = openid;

        next();
    } catch (error) {
        console.error('身份验证失败:', error);
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