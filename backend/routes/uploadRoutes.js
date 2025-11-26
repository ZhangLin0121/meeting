const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const ResponseHelper = require('../utils/responseHelper');
const User = require('../models/User');

/**
 * 图片上传相关路由
 */

// 配置multer存储 - 会议室图片
const roomStorage = multer.diskStorage({
    destination: function(req, file, cb) {
        const uploadPath = path.join(__dirname, '../uploads/rooms');

        // 确保目录存在
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }

        cb(null, uploadPath);
    },
    filename: function(req, file, cb) {
        // 生成唯一文件名：时间戳 + 随机数 + 原始扩展名
        const timestamp = Date.now();
        const random = Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const filename = `room_${timestamp}_${random}${ext}`;
        cb(null, filename);
    }
});

// 配置multer存储 - 用户头像
const avatarStorage = multer.diskStorage({
    destination: function(req, file, cb) {
        const uploadPath = path.join(__dirname, '../uploads/avatars');

        // 确保目录存在
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }

        cb(null, uploadPath);
    },
    filename: function(req, file, cb) {
        // 生成唯一文件名：用户ID + 时间戳 + 扩展名
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        const filename = `avatar_${req.user.id}_${timestamp}${ext}`;
        cb(null, filename);
    }
});

// 文件过滤器
const fileFilter = (req, file, cb) => {
    // 检查文件类型
    const allowedTypes = /jpeg|jpg|png|gif|svg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('只支持 JPEG, JPG, PNG, GIF, SVG 格式的图片'));
    }
};

// 配置multer
const roomUpload = multer({
    storage: roomStorage,
    limits: {
        fileSize: 20 * 1024 * 1024, // 20MB限制
    },
    fileFilter: fileFilter
});

// 配置用户头像上传
const avatarUpload = multer({
    storage: avatarStorage,
    limits: {
        fileSize: 2 * 1024 * 1024, // 2MB限制，头像不需要太大
    },
    fileFilter: fileFilter
});

// 所有路由都需要身份验证
router.use(authenticate);

/**
 * 上传用户头像 - 普通用户可用
 * POST /api/upload/avatar
 */
router.post('/avatar', avatarUpload.single('avatar'), async(req, res) => {
    try {
        if (!req.file) {
            return ResponseHelper.error(res, '请选择要上传的头像图片', 400);
        }

        // 返回图片的相对路径
        const avatarPath = `/uploads/avatars/${req.file.filename}`;

        // 更新用户头像URL到数据库
        const user = await User.findById(req.user.id);
        if (!user) {
            return ResponseHelper.notFound(res, '用户不存在');
        }

        // 删除旧头像文件（如果存在且不是默认头像）
        if (user.avatarUrl && user.avatarUrl.startsWith('/uploads/avatars/')) {
            const oldAvatarPath = path.join(__dirname, '..', user.avatarUrl);
            if (fs.existsSync(oldAvatarPath)) {
                try {
                    fs.unlinkSync(oldAvatarPath);
                    console.log('✅ 删除旧头像文件:', oldAvatarPath);
                } catch (deleteError) {
                    console.warn('⚠️ 删除旧头像文件失败:', deleteError);
                }
            }
        }

        // 更新用户头像URL
        user.avatarUrl = avatarPath;
        await user.save();

        console.log('✅ 用户头像上传成功:', {
            userId: user.id,
            avatarPath: avatarPath,
            fileSize: req.file.size
        });

        return ResponseHelper.success(res, {
            avatarUrl: avatarPath,
            originalName: req.file.originalname,
            size: req.file.size,
            filename: req.file.filename
        }, '头像上传成功', 201);

    } catch (error) {
        console.error('❌ 头像上传失败:', error);
        return ResponseHelper.serverError(res, '头像上传失败', error.message);
    }
});

/**
 * 上传会议室图片 - 需要管理员权限
 * POST /api/upload/room-image
 */
router.post('/room-image', requireAdmin, roomUpload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return ResponseHelper.error(res, '请选择要上传的图片', 400);
        }

        // 返回图片的相对路径
        const imagePath = `/uploads/rooms/${req.file.filename}`;

        return ResponseHelper.success(res, {
            imagePath: imagePath,
            originalName: req.file.originalname,
            size: req.file.size,
            filename: req.file.filename
        }, '图片上传成功', 201);

    } catch (error) {
        console.error('图片上传失败:', error);
        return ResponseHelper.serverError(res, '图片上传失败', error.message);
    }
});

/**
 * 删除会议室图片 - 需要管理员权限
 * DELETE /api/upload/room-image
 */
router.delete('/room-image', requireAdmin, (req, res) => {
    try {
        const { imagePath } = req.body;

        if (!imagePath) {
            return ResponseHelper.error(res, '请提供要删除的图片路径', 400);
        }

        // 构建完整的文件路径
        const fullPath = path.join(__dirname, '..', imagePath);

        // 检查文件是否存在
        if (fs.existsSync(fullPath)) {
            // 删除文件
            fs.unlinkSync(fullPath);
            return ResponseHelper.success(res, null, '图片删除成功');
        } else {
            return ResponseHelper.error(res, '图片文件不存在', 404);
        }

    } catch (error) {
        console.error('图片删除失败:', error);
        return ResponseHelper.serverError(res, '图片删除失败', error.message);
    }
});

// 错误处理中间件
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return ResponseHelper.error(res, '图片文件大小不能超过20MB', 400);
        }
        return ResponseHelper.error(res, `上传错误: ${error.message}`, 400);
    }

    if (error.message) {
        return ResponseHelper.error(res, error.message, 400);
    }

    return ResponseHelper.serverError(res, '图片上传失败');
});

module.exports = router;