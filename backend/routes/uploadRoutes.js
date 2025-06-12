const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const ResponseHelper = require('../utils/responseHelper');

/**
 * 图片上传相关路由
 */

// 配置multer存储
const storage = multer.diskStorage({
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
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB限制
    },
    fileFilter: fileFilter
});

// 以下路由需要身份验证和管理员权限
router.use(authenticate);
router.use(requireAdmin);

/**
 * 上传会议室图片
 * POST /api/upload/room-image
 */
router.post('/room-image', upload.single('image'), (req, res) => {
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
 * 删除会议室图片
 * DELETE /api/upload/room-image
 */
router.delete('/room-image', (req, res) => {
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
            return ResponseHelper.error(res, '图片文件大小不能超过5MB', 400);
        }
        return ResponseHelper.error(res, `上传错误: ${error.message}`, 400);
    }

    if (error.message) {
        return ResponseHelper.error(res, error.message, 400);
    }

    return ResponseHelper.serverError(res, '图片上传失败');
});

module.exports = router;