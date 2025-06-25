const express = require('express');
const router = express.Router();
const RoomController = require('../controllers/roomController');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validate, schemas } = require('../utils/validation');

/**
 * 会议室相关路由
 */

// 以下路由需要身份验证
router.use(authenticate);

// 获取会议室列表（带搜索和筛选）
router.get('/',
    validate(schemas.room.list, 'query'),
    RoomController.getRooms
);

// 获取会议室详情
router.get('/:id',
    RoomController.getRoomDetail
);

// 获取会议室指定日期的可用性
router.get('/:id/availability',
    RoomController.getRoomAvailability
);

// 获取会议室指定月份的可用性
router.get('/:id/monthly-availability',
    RoomController.getRoomMonthlyAvailability
);

// 以下路由需要管理员权限
router.use(requireAdmin);

// 创建会议室
router.post('/',
    validate(schemas.room.create),
    RoomController.createRoom
);

// 更新会议室信息
router.put('/:id',
    validate(schemas.room.update),
    RoomController.updateRoom
);

// 删除会议室
router.delete('/:id',
    RoomController.deleteRoom
);

module.exports = router;