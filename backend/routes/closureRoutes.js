const express = require('express');
const router = express.Router();
const ClosureController = require('../controllers/closureController');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validate, schemas } = require('../utils/validation');

/**
 * 临时关闭相关路由（管理员权限）
 */

// 以下路由需要身份验证和管理员权限
router.use(authenticate);
router.use(requireAdmin);

// 创建临时关闭
router.post('/',
    validate(schemas.closure.create),
    ClosureController.createClosure
);

// 获取临时关闭列表
router.get('/', ClosureController.getClosures);

// 获取临时关闭详情
router.get('/:id',
    validate(schemas.objectId, 'params'),
    ClosureController.getClosureDetail
);

// 更新临时关闭
router.put('/:id',
    validate(schemas.objectId, 'params'),
    ClosureController.updateClosure
);

// 删除临时关闭
router.delete('/:id',
    validate(schemas.objectId, 'params'),
    ClosureController.deleteClosure
);

// 获取指定会议室和日期的临时关闭信息
router.get('/room/:roomId/date/:date',
    validate(schemas.objectId, 'params'),
    ClosureController.getRoomClosuresByDate
);

module.exports = router;