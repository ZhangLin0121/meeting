const TemporaryClosure = require('../models/TemporaryClosure');
const ConferenceRoom = require('../models/ConferenceRoom');
const ResponseHelper = require('../utils/responseHelper');
const TimeHelper = require('../utils/timeHelper');

/**
 * 临时关闭控制器
 * 处理会议室临时关闭相关的API请求（管理员权限）
 */
class ClosureController {

    /**
     * 创建临时关闭
     * POST /api/closures
     */
    static async createClosure(req, res) {
        try {
            const { roomId, closureDate, isAllDay, startTime, endTime, reason } = req.body;

            // 验证会议室是否存在
            const room = await ConferenceRoom.findById(roomId);
            if (!room) {
                return ResponseHelper.notFound(res, '会议室不存在');
            }

            // 验证关闭日期不能是过去的日期
            const today = TimeHelper.getStartOfDay(new Date());
            const closureDateObj = TimeHelper.getStartOfDay(closureDate);

            if (closureDateObj < today) {
                return ResponseHelper.error(res, '不能设置过去日期的临时关闭');
            }

            // 如果不是全天关闭，验证时间格式和逻辑
            if (!isAllDay) {
                if (!startTime || !endTime) {
                    return ResponseHelper.error(res, '非全天关闭时，必须指定开始时间和结束时间');
                }

                // 验证时间是否在办公时间内
                if (!TimeHelper.isOfficeTime(startTime) || !TimeHelper.isOfficeTime(endTime)) {
                    return ResponseHelper.error(res, '关闭时间必须在办公时间内');
                }

                // 验证结束时间大于开始时间
                const startMinutes = TimeHelper.timeToMinutes(startTime);
                const endMinutes = TimeHelper.timeToMinutes(endTime);
                if (endMinutes <= startMinutes) {
                    return ResponseHelper.error(res, '结束时间必须大于开始时间');
                }
            }

            // 检查是否已存在重叠的临时关闭
            const conflictClosure = await TemporaryClosure.findOne({
                roomId,
                closureDate: closureDateObj,
                $or: [
                    // 已有全天关闭
                    { isAllDay: true },
                    // 新建全天关闭，但已有其他关闭
                    ...(isAllDay ? [{}] : []),
                    // 非全天关闭的时间冲突检查
                    ...(!isAllDay ? [{
                        isAllDay: false,
                        $or: [
                            // 开始时间在已有关闭时间段内
                            {
                                startTime: { $lte: startTime },
                                endTime: { $gt: startTime }
                            },
                            // 结束时间在已有关闭时间段内
                            {
                                startTime: { $lt: endTime },
                                endTime: { $gte: endTime }
                            },
                            // 新关闭完全包含已有关闭
                            {
                                startTime: { $gte: startTime },
                                endTime: { $lte: endTime }
                            }
                        ]
                    }] : [])
                ]
            });

            if (conflictClosure) {
                return ResponseHelper.error(res, '该时间段已存在临时关闭设置', 409);
            }

            // 创建临时关闭
            const closure = new TemporaryClosure({
                roomId,
                closureDate: closureDateObj,
                isAllDay,
                startTime: !isAllDay ? startTime : undefined,
                endTime: !isAllDay ? endTime : undefined,
                reason: reason || ''
            });

            await closure.save();

            return ResponseHelper.success(res, {
                id: closure._id,
                roomId: closure.roomId,
                roomName: room.name,
                closureDate: TimeHelper.formatDate(closure.closureDate),
                isAllDay: closure.isAllDay,
                startTime: closure.startTime,
                endTime: closure.endTime,
                reason: closure.reason,
                createdAt: closure.createdAt
            }, '创建临时关闭成功', 201);

        } catch (error) {
            console.error('创建临时关闭失败:', error);
            return ResponseHelper.serverError(res, '创建临时关闭失败', error.message);
        }
    }

    /**
     * 获取临时关闭列表
     * GET /api/closures
     */
    static async getClosures(req, res) {
        try {
            const { roomId, startDate, endDate, page = 1, limit = 10 } = req.query;

            const query = {};

            if (roomId) {
                query.roomId = roomId;
            }

            if (startDate || endDate) {
                query.closureDate = {};
                if (startDate) {
                    query.closureDate.$gte = TimeHelper.getStartOfDay(startDate);
                }
                if (endDate) {
                    query.closureDate.$lte = TimeHelper.getEndOfDay(endDate);
                }
            }

            const skip = (page - 1) * limit;

            const closures = await TemporaryClosure.find(query)
                .sort({ closureDate: -1, startTime: 1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('roomId', 'name location');

            const total = await TemporaryClosure.countDocuments(query);

            const closureList = closures.map(closure => ({
                id: closure._id,
                roomId: closure.roomId._id,
                roomName: closure.roomId.name,
                roomLocation: closure.roomId.location,
                closureDate: TimeHelper.formatDate(closure.closureDate),
                isAllDay: closure.isAllDay,
                startTime: closure.startTime,
                endTime: closure.endTime,
                reason: closure.reason,
                createdAt: closure.createdAt
            }));

            return ResponseHelper.paginated(res, closureList, {
                page: parseInt(page),
                limit: parseInt(limit),
                total
            }, '获取临时关闭列表成功');

        } catch (error) {
            console.error('获取临时关闭列表失败:', error);
            return ResponseHelper.serverError(res, '获取临时关闭列表失败', error.message);
        }
    }

    /**
     * 获取临时关闭详情
     * GET /api/closures/:id
     */
    static async getClosureDetail(req, res) {
        try {
            const { id } = req.params;

            const closure = await TemporaryClosure.findById(id)
                .populate('roomId', 'name location');

            if (!closure) {
                return ResponseHelper.notFound(res, '临时关闭记录不存在');
            }

            return ResponseHelper.success(res, {
                id: closure._id,
                roomId: closure.roomId._id,
                roomName: closure.roomId.name,
                roomLocation: closure.roomId.location,
                closureDate: TimeHelper.formatDate(closure.closureDate),
                isAllDay: closure.isAllDay,
                startTime: closure.startTime,
                endTime: closure.endTime,
                reason: closure.reason,
                createdAt: closure.createdAt,
                updatedAt: closure.updatedAt
            }, '获取临时关闭详情成功');

        } catch (error) {
            console.error('获取临时关闭详情失败:', error);
            return ResponseHelper.serverError(res, '获取临时关闭详情失败', error.message);
        }
    }

    /**
     * 更新临时关闭
     * PUT /api/closures/:id
     */
    static async updateClosure(req, res) {
        try {
            const { id } = req.params;
            const { closureDate, isAllDay, startTime, endTime, reason } = req.body;

            const closure = await TemporaryClosure.findById(id);
            if (!closure) {
                return ResponseHelper.notFound(res, '临时关闭记录不存在');
            }

            // 验证关闭日期不能是过去的日期
            if (closureDate) {
                const today = TimeHelper.getStartOfDay(new Date());
                const closureDateObj = TimeHelper.getStartOfDay(closureDate);

                if (closureDateObj < today) {
                    return ResponseHelper.error(res, '不能设置过去日期的临时关闭');
                }
                closure.closureDate = closureDateObj;
            }

            // 更新全天关闭设置
            if (typeof isAllDay === 'boolean') {
                closure.isAllDay = isAllDay;
            }

            // 如果不是全天关闭，验证和更新时间
            if (!closure.isAllDay) {
                if (startTime !== undefined) {
                    if (!TimeHelper.isOfficeTime(startTime)) {
                        return ResponseHelper.error(res, '开始时间必须在办公时间内');
                    }
                    closure.startTime = startTime;
                }

                if (endTime !== undefined) {
                    if (!TimeHelper.isOfficeTime(endTime)) {
                        return ResponseHelper.error(res, '结束时间必须在办公时间内');
                    }
                    closure.endTime = endTime;
                }

                // 验证时间逻辑
                if (closure.startTime && closure.endTime) {
                    const startMinutes = TimeHelper.timeToMinutes(closure.startTime);
                    const endMinutes = TimeHelper.timeToMinutes(closure.endTime);
                    if (endMinutes <= startMinutes) {
                        return ResponseHelper.error(res, '结束时间必须大于开始时间');
                    }
                }
            } else {
                // 全天关闭时清空时间字段
                closure.startTime = undefined;
                closure.endTime = undefined;
            }

            // 更新原因
            if (reason !== undefined) {
                closure.reason = reason;
            }

            await closure.save();

            const room = await ConferenceRoom.findById(closure.roomId);

            return ResponseHelper.success(res, {
                id: closure._id,
                roomId: closure.roomId,
                roomName: room.name,
                closureDate: TimeHelper.formatDate(closure.closureDate),
                isAllDay: closure.isAllDay,
                startTime: closure.startTime,
                endTime: closure.endTime,
                reason: closure.reason,
                updatedAt: closure.updatedAt
            }, '更新临时关闭成功');

        } catch (error) {
            console.error('更新临时关闭失败:', error);
            return ResponseHelper.serverError(res, '更新临时关闭失败', error.message);
        }
    }

    /**
     * 删除临时关闭
     * DELETE /api/closures/:id
     */
    static async deleteClosure(req, res) {
        try {
            const { id } = req.params;

            const closure = await TemporaryClosure.findById(id);
            if (!closure) {
                return ResponseHelper.notFound(res, '临时关闭记录不存在');
            }

            await TemporaryClosure.findByIdAndDelete(id);

            return ResponseHelper.success(res, null, '删除临时关闭成功');

        } catch (error) {
            console.error('删除临时关闭失败:', error);
            return ResponseHelper.serverError(res, '删除临时关闭失败', error.message);
        }
    }

    /**
     * 获取指定会议室和日期的临时关闭信息
     * GET /api/closures/room/:roomId/date/:date
     */
    static async getRoomClosuresByDate(req, res) {
        try {
            const { roomId, date } = req.params;

            const room = await ConferenceRoom.findById(roomId);
            if (!room) {
                return ResponseHelper.notFound(res, '会议室不存在');
            }

            const queryDate = new Date(date);
            const startOfDay = TimeHelper.getStartOfDay(queryDate);
            const endOfDay = TimeHelper.getEndOfDay(queryDate);

            const closures = await TemporaryClosure.find({
                roomId,
                closureDate: {
                    $gte: startOfDay,
                    $lte: endOfDay
                }
            }).sort({ startTime: 1 });

            const closureList = closures.map(closure => ({
                id: closure._id,
                isAllDay: closure.isAllDay,
                startTime: closure.startTime,
                endTime: closure.endTime,
                reason: closure.reason
            }));

            return ResponseHelper.success(res, {
                roomId,
                roomName: room.name,
                date: TimeHelper.formatDate(queryDate),
                closures: closureList,
                hasAllDayClosure: closures.some(c => c.isAllDay)
            }, '获取会议室临时关闭信息成功');

        } catch (error) {
            console.error('获取会议室临时关闭信息失败:', error);
            return ResponseHelper.serverError(res, '获取会议室临时关闭信息失败', error.message);
        }
    }
}

module.exports = ClosureController;