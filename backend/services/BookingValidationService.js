const ConferenceRoom = require('../models/ConferenceRoom');
const Booking = require('../models/Booking');
const TemporaryClosure = require('../models/TemporaryClosure');
const TimeHelper = require('../utils/timeHelper');
const config = require('../config');

/**
 * 预约验证服务
 * 处理所有预约相关的验证逻辑
 */
class BookingValidationService {

    /**
     * 验证会议室是否存在
     * @param {string} roomId - 会议室ID
     * @returns {Promise<Object>} 会议室对象或null
     */
    static async validateRoomExists(roomId) {
        return await ConferenceRoom.findById(roomId);
    }

    /**
     * 验证预约日期是否在允许范围内
     * @param {string} bookingDate - 预约日期
     * @returns {boolean} 是否在允许范围内
     */
    static validateBookingDateRange(bookingDate) {
        return TimeHelper.isWithinBookingRange(bookingDate);
    }

    /**
     * 验证预约时间是否在过去
     * @param {string} bookingDate - 预约日期
     * @param {string} startTime - 开始时间
     * @returns {boolean} 是否为过去时间
     */
    static validateNotPastTime(bookingDate, startTime) {
        return !TimeHelper.isPastTime(bookingDate, startTime);
    }

    /**
     * 验证是否跨越午休时间
     * @param {string} startTime - 开始时间
     * @param {string} endTime - 结束时间
     * @returns {boolean} 是否有效（不跨越午休）
     */
    static validateLunchBreakCrossing(startTime, endTime) {
        return !TimeHelper.isInvalidLunchBreakCrossing(startTime, endTime);
    }

    /**
     * 验证时间段有效性
     * @param {string} startTime - 开始时间
     * @param {string} endTime - 结束时间
     * @returns {Object} 验证结果
     */
    static validateTimeRange(startTime, endTime) {
        const startMinutes = TimeHelper.timeToMinutes(startTime);
        const endMinutes = TimeHelper.timeToMinutes(endTime);

        if (endMinutes <= startMinutes) {
            return {
                valid: false,
                message: '结束时间必须大于开始时间'
            };
        }

        if (endMinutes - startMinutes < 30) {
            return {
                valid: false,
                message: '最小预约时间为30分钟'
            };
        }

        return { valid: true };
    }

    /**
     * 检查时间段冲突
     * @param {string} roomId - 会议室ID
     * @param {Date} bookingDateObj - 预约日期对象
     * @param {string} startTime - 开始时间
     * @param {string} endTime - 结束时间
     * @param {string} excludeBookingId - 排除的预约ID（用于更新时）
     * @returns {Promise<Object>} 冲突检查结果
     */
    static async checkTimeConflict(roomId, bookingDateObj, startTime, endTime, excludeBookingId = null) {
        const query = {
            roomId,
            bookingDate: bookingDateObj,
            status: 'booked',
            $or: [
                // 开始时间在已有预约时间段内（允许边界时间衔接）
                {
                    startTime: { $lte: startTime },
                    endTime: { $gt: startTime }
                },
                // 结束时间在已有预约时间段内（允许边界时间衔接）
                {
                    startTime: { $lt: endTime },
                    endTime: { $gte: endTime }
                },
                // 新预约完全包含已有预约
                {
                    startTime: { $gte: startTime },
                    endTime: { $lte: endTime }
                }
            ]
        };

        // 如果是更新操作，排除当前预约
        if (excludeBookingId) {
            query._id = { $ne: excludeBookingId };
        }

        const conflictBooking = await Booking.findOne(query);

        // 调试信息：如果有冲突，记录查询条件和冲突的预约
        if (conflictBooking) {
            console.log('⏰ 时间冲突检测 - 查询条件:', JSON.stringify(query));
            console.log('⏰ 找到冲突预约:', {
                _id: conflictBooking._id,
                startTime: conflictBooking.startTime,
                endTime: conflictBooking.endTime,
                bookingDate: conflictBooking.bookingDate,
                status: conflictBooking.status
            });
        }

        return {
            hasConflict: !!conflictBooking,
            conflictBooking: conflictBooking,
            message: conflictBooking ? '该时间段已被预约' : null
        };
    }

    /**
     * 检查临时关闭
     * @param {string} roomId - 会议室ID
     * @param {Date} bookingDateObj - 预约日期对象
     * @param {string} startTime - 开始时间
     * @param {string} endTime - 结束时间
     * @returns {Promise<Object>} 临时关闭检查结果
     */
    static async checkTemporaryClosure(roomId, bookingDateObj, startTime, endTime) {
        const closure = await TemporaryClosure.findOne({
            roomId,
            closureDate: bookingDateObj,
            $or: [
                { isAllDay: true },
                {
                    isAllDay: false,
                    startTime: { $lte: startTime },
                    endTime: { $gt: startTime }
                },
                {
                    isAllDay: false,
                    startTime: { $lt: endTime },
                    endTime: { $gte: endTime }
                }
            ]
        });

        return {
            isClosed: !!closure,
            closure: closure,
            message: closure ? `该时间段会议室临时关闭${closure.reason ? `（${closure.reason}）` : ''}` : null
        };
    }

    /**
     * 验证用户权限
     * @param {Object} user - 用户对象
     * @param {Object} booking - 预约对象
     * @param {string} operation - 操作类型 ('cancel', 'update', 'view')
     * @returns {Object} 权限验证结果
     */
    static validateUserPermission(user, booking, operation) {
        // 管理员有所有权限
        if (user.role === 'admin') {
            return { hasPermission: true };
        }

        // 用户只能操作自己的预约
        if (booking.userId.toString() !== user._id.toString()) {
            return {
                hasPermission: false,
                message: `无权${operation === 'cancel' ? '取消' : operation === 'update' ? '修改' : '查看'}此预约`
            };
        }

        return { hasPermission: true };
    }

    /**
     * 验证取消时间限制
     * @param {Date} bookingDate - 预约日期
     * @param {string} startTime - 开始时间
     * @param {Object} user - 用户对象
     * @returns {Object} 取消时间验证结果
     */
    static validateCancelTimeLimit(bookingDate, startTime, user) {
        const limitMinutes = user.role === 'admin' ?
            config.booking.adminCancelTimeLimitMinutes :
            config.booking.cancelTimeLimitMinutes;

        const canCancel = TimeHelper.canCancelBooking(bookingDate, startTime, limitMinutes);

        return {
            canCancel: canCancel,
            message: canCancel ? null : `会议开始前${user.role === 'admin' ? '5分钟' : '30分钟'}内不能取消预约`
        };
    }

    /**
     * 完整的预约验证
     * @param {Object} params - 验证参数
     * @returns {Promise<Object>} 完整验证结果
     */
    static async validateBookingRequest(params) {
        const {
            roomId,
            bookingDate,
            startTime,
            endTime,
            user,
            excludeBookingId = null
        } = params;

        // 验证会议室存在
        const room = await this.validateRoomExists(roomId);
        if (!room) {
            return {
                valid: false,
                message: '会议室不存在',
                code: 404
            };
        }

        // 验证预约日期范围
        if (!this.validateBookingDateRange(bookingDate)) {
            return {
                valid: false,
                message: `只能预约未来${config.booking.maxAdvanceDays}天内的会议室`,
                code: 400
            };
        }

        // 验证不是过去时间
        if (!this.validateNotPastTime(bookingDate, startTime)) {
            return {
                valid: false,
                message: '不能预约过去的时间',
                code: 400
            };
        }

        // 验证午休时间跨越
        if (!this.validateLunchBreakCrossing(startTime, endTime)) {
            return {
                valid: false,
                message: '预约时间不能跨越午休时间',
                code: 400
            };
        }

        // 验证时间段有效性
        const timeValidation = this.validateTimeRange(startTime, endTime);
        if (!timeValidation.valid) {
            return {
                valid: false,
                message: timeValidation.message,
                code: 400
            };
        }

        const bookingDateObj = TimeHelper.getStartOfDay(bookingDate);

        // 检查时间冲突
        const conflictCheck = await this.checkTimeConflict(roomId, bookingDateObj, startTime, endTime, excludeBookingId);
        if (conflictCheck.hasConflict) {
            return {
                valid: false,
                message: conflictCheck.message,
                code: 409
            };
        }

        // 检查临时关闭
        const closureCheck = await this.checkTemporaryClosure(roomId, bookingDateObj, startTime, endTime);
        if (closureCheck.isClosed) {
            return {
                valid: false,
                message: closureCheck.message,
                code: 409
            };
        }

        return {
            valid: true,
            room: room,
            bookingDateObj: bookingDateObj
        };
    }
}

module.exports = BookingValidationService; 