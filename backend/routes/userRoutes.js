const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');
const { validate, schemas } = require('../utils/validation');

/**
 * 用户相关路由
 */

// 微信小程序登录（不需要认证）
router.post('/wechat-login',
    UserController.wechatLogin
);

// 用户登录/注册（不需要认证）
router.post('/login',
    validate(schemas.user.login),
    UserController.login
);

// 以下路由需要身份验证
router.use(authenticate);

// 获取当前用户信息
router.get('/profile', UserController.getProfile);

// 获取用户角色信息
router.get('/role', UserController.getRole);

// 更新用户联系信息
router.put('/contact',
    validate(schemas.user.updateContact),
    UserController.updateContact
);

// 更新用户头像
router.put('/avatar', UserController.updateAvatar);

// 获取用户自己的预约记录
router.get('/bookings', UserController.getUserBookings);

module.exports = router;