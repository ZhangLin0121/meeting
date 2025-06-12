const User = require('../models/User');
const ResponseHelper = require('../utils/responseHelper');
const config = require('../config');
const axios = require('axios');

/**
 * 用户控制器
 * 处理用户相关的API请求
 */
class UserController {

    /**
     * 微信小程序登录
     * POST /api/user/wechat-login
     */
    static async wechatLogin(req, res) {
        try {
            const { code, nickname, avatarUrl } = req.body;

            if (!code) {
                return ResponseHelper.error(res, '缺少微信登录code', 400);
            }

            console.log('🔐 微信登录请求:', { code: code.substring(0, 10) + '...', nickname });

            // 使用code换取openid和session_key
            const wxResponse = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
                params: {
                    appid: config.wechat.appId,
                    secret: config.wechat.appSecret,
                    js_code: code,
                    grant_type: 'authorization_code'
                }
            });

            console.log('🌐 微信API响应:', wxResponse.data);

            if (wxResponse.data.errcode) {
                console.error('❌ 微信API错误:', wxResponse.data);
                return ResponseHelper.error(res, `微信登录失败: ${wxResponse.data.errmsg}`, 400);
            }

            const { openid, session_key } = wxResponse.data;

            // 查找或创建用户
            let user = await User.findOne({ openid });

            if (!user) {
                // 创建新用户
                user = new User({
                    openid,
                    nickname: nickname || '微信用户',
                    avatarUrl: avatarUrl || '',
                    role: 'employee'
                });

                await user.save();
                console.log(`✅ 新用户注册: ${openid}`);
            } else {
                // 更新用户信息
                if (nickname) user.nickname = nickname;
                if (avatarUrl) user.avatarUrl = avatarUrl;
                await user.save();
                console.log(`✅ 用户登录: ${openid}`);
            }

            return ResponseHelper.success(res, {
                id: user._id,
                openid: user.openid,
                nickname: user.nickname,
                avatarUrl: user.avatarUrl,
                role: user.role,
                contactName: user.contactName,
                contactPhone: user.contactPhone,
                isNewUser: !user.contactName || !user.contactPhone,
                sessionKey: session_key // 注意：生产环境中不应该返回session_key
            }, '登录成功');

        } catch (error) {
            console.error('❌ 微信登录失败:', error);

            if (error.code === 'ENOTFOUND') {
                return ResponseHelper.error(res, '网络连接失败，请检查网络设置', 500);
            }

            return ResponseHelper.serverError(res, '登录失败', error.message);
        }
    }

    /**
     * 获取当前用户信息
     * GET /api/user/profile
     */
    static async getProfile(req, res) {
        try {
            const user = req.user;

            return ResponseHelper.success(res, {
                id: user._id,
                openid: user.openid,
                nickname: user.nickname,
                avatarUrl: user.avatarUrl,
                role: user.role,
                contactName: user.contactName,
                contactPhone: user.contactPhone,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            }, '获取用户信息成功');

        } catch (error) {
            console.error('获取用户信息失败:', error);
            return ResponseHelper.serverError(res, '获取用户信息失败', error.message);
        }
    }

    /**
     * 更新用户联系信息
     * PUT /api/user/contact
     */
    static async updateContact(req, res) {
        try {
            const { contactName, contactPhone } = req.body;
            const user = req.user;

            // 更新用户联系信息
            user.contactName = contactName;
            user.contactPhone = contactPhone;

            await user.save();

            return ResponseHelper.success(res, {
                id: user._id,
                contactName: user.contactName,
                contactPhone: user.contactPhone,
                updatedAt: user.updatedAt
            }, '更新联系信息成功');

        } catch (error) {
            console.error('更新用户联系信息失败:', error);
            return ResponseHelper.serverError(res, '更新联系信息失败', error.message);
        }
    }

    /**
     * 用户登录/注册（通过微信openid）
     * POST /api/user/login
     */
    static async login(req, res) {
        try {
            const { openid, nickname, avatarUrl } = req.body;

            // 查找或创建用户
            let user = await User.findOne({ openid });

            if (!user) {
                // 创建新用户
                user = new User({
                    openid,
                    nickname: nickname || '',
                    avatarUrl: avatarUrl || '',
                    role: 'employee'
                });

                await user.save();
                console.log(`✅ 新用户注册: ${openid}`);
            } else {
                // 更新用户信息
                if (nickname) user.nickname = nickname;
                if (avatarUrl) user.avatarUrl = avatarUrl;
                await user.save();
            }

            return ResponseHelper.success(res, {
                id: user._id,
                openid: user.openid,
                nickname: user.nickname,
                avatarUrl: user.avatarUrl,
                role: user.role,
                contactName: user.contactName,
                contactPhone: user.contactPhone,
                isNewUser: !user.contactName || !user.contactPhone
            }, '登录成功');

        } catch (error) {
            console.error('用户登录失败:', error);
            return ResponseHelper.serverError(res, '登录失败', error.message);
        }
    }

    /**
     * 获取用户角色信息（检查是否为管理员）
     * GET /api/user/role
     */
    static async getRole(req, res) {
        try {
            const user = req.user;

            return ResponseHelper.success(res, {
                role: user.role,
                isAdmin: user.role === 'admin',
                permissions: user.role === 'admin' ? [
                    'room_management',
                    'booking_management',
                    'user_booking'
                ] : ['user_booking']
            }, '获取角色信息成功');

        } catch (error) {
            console.error('获取用户角色失败:', error);
            return ResponseHelper.serverError(res, '获取角色信息失败', error.message);
        }
    }
}

module.exports = UserController;