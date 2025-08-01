const RoomQueryService = require('../services/RoomQueryService');
const RoomManagementService = require('../services/RoomManagementService');
const RoomAvailabilityService = require('../services/RoomAvailabilityService');

/**
 * 会议室控制器
 * 处理会议室相关的API请求
 * 已重构为模块化架构，使用服务层处理具体业务逻辑
 */
class RoomController {

    /**
     * 获取会议室列表（带搜索和筛选）
     * GET /api/rooms
     */
    static async getRooms(req, res) {
        return await RoomQueryService.getRooms(req, res);
    }

    /**
     * 获取会议室详情
     * GET /api/rooms/:id
     */
    static async getRoomDetail(req, res) {
        return await RoomQueryService.getRoomDetail(req, res);
    }

    /**
     * 获取会议室指定日期的可用性
     * GET /api/rooms/:id/availability
     */
    static async getRoomAvailability(req, res) {
        return await RoomQueryService.getRoomAvailability(req, res);
    }

    /**
     * 创建会议室（管理员权限）
     * POST /api/rooms
     */
    static async createRoom(req, res) {
        return await RoomManagementService.createRoom(req, res);
    }

    /**
     * 更新会议室信息（管理员权限）
     * PUT /api/rooms/:id
     */
    static async updateRoom(req, res) {
        return await RoomManagementService.updateRoom(req, res);
    }

    /**
     * 删除会议室（管理员权限）
     * DELETE /api/rooms/:id
     */
    static async deleteRoom(req, res) {
        return await RoomManagementService.deleteRoom(req, res);
    }

    /**
     * 生成时间段信息
     * @param {Array} bookings 预约记录
     * @param {Array} closures 临时关闭记录
     * @param {Date} queryDate 查询日期，用于检查过去时间
     * @returns {Array} 时间段数组
     */
    static generateTimeSlots(bookings, closures, queryDate) {
        return RoomAvailabilityService.generateTimeSlots(bookings, closures, queryDate);
    }

    /**
     * 获取会议室指定月份的可用性
     * GET /api/rooms/:id/monthly-availability
     */
    static async getRoomMonthlyAvailability(req, res) {
        return await RoomQueryService.getRoomMonthlyAvailability(req, res);
    }

    /**
     * 获取会议室在指定日期的可用性状态
     * @param {string} roomId 会议室ID
     * @param {Date} date 日期
     * @returns {Object} 可用性状态
     */
    static async getRoomAvailabilityStatus(roomId, date) {
        return await RoomQueryService.getRoomAvailabilityStatus(roomId, date);
    }
}

module.exports = RoomController;