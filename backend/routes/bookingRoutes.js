const express = require('express');
const router = express.Router();
const BookingController = require('../controllers/bookingController');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validate, schemas } = require('../utils/validation');

/**
 * 预约相关路由
 */

// 下载导出文件（不需要认证，因为微信小程序downloadFile无法传递headers）
router.get('/download/:filename',
    BookingController.downloadExportFile
);

// 以下路由需要身份验证
router.use(authenticate);

// 创建预约
router.post('/',
    validate(schemas.booking.create),
    BookingController.createBooking
);

// 获取当前用户的预约列表
router.get('/my',
    validate(schemas.booking.list, 'query'),
    BookingController.getMyBookings
);

// 取消预约（用户可以取消自己的预约，管理员可以取消任何预约）
router.delete('/:id',
    BookingController.cancelBooking
);

// 以下路由需要管理员权限
router.use(requireAdmin);

// 获取所有预约记录（管理员）
router.get('/',
    validate(schemas.booking.list, 'query'),
    BookingController.getAllBookings
);

// 管理员代预约
router.post('/manual',
    validate(schemas.booking.create),
    BookingController.createManualBooking
);

// 导出预约记录（管理员）
router.get('/export',
    validate(schemas.booking.export, 'query'),
    BookingController.exportBookings
);

module.exports = router;