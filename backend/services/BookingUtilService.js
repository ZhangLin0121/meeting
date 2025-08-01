/**
 * 预约工具服务
 * 处理所有预约相关的工具方法
 */
class BookingUtilService {

    /**
     * 获取状态文本
     * @param {string} status - 状态代码
     * @returns {string} 状态文本
     */
    static getStatusText(status) {
        const statusMap = {
            'booked': '已预约',
            'completed': '已完成',
            'cancelled': '已取消'
        };
        return statusMap[status] || status;
    }

    /**
     * 验证预约数据完整性
     * @param {Object} bookingData - 预约数据
     * @returns {Object} 验证结果
     */
    static validateBookingData(bookingData) {
        const required = ['roomId', 'bookingDate', 'startTime', 'endTime', 'topic', 'contactName', 'contactPhone'];
        const missing = required.filter(field => !bookingData[field]);

        if (missing.length > 0) {
            return {
                valid: false,
                message: `缺少必填字段: ${missing.join(', ')}`
            };
        }

        // 验证电话号码格式
        const phoneRegex = /^1[3-9]\d{9}$/;
        if (!phoneRegex.test(bookingData.contactPhone)) {
            return {
                valid: false,
                message: '请输入正确的手机号码'
            };
        }

        // 验证参会人数
        if (bookingData.attendeesCount && (bookingData.attendeesCount < 1 || bookingData.attendeesCount > 100)) {
            return {
                valid: false,
                message: '参会人数应在1-100人之间'
            };
        }

        return { valid: true };
    }

    /**
     * 格式化预约响应数据
     * @param {Object} booking - 预约对象
     * @param {Object} options - 格式化选项
     * @returns {Object} 格式化后的数据
     */
    static formatBookingResponse(booking, options = {}) {
        const TimeHelper = require('../utils/timeHelper');
        const config = require('../config');

        const formatted = {
            id: booking._id,
            roomId: booking.roomId,
            conferenceRoomName: booking.conferenceRoomName,
            bookingDate: TimeHelper.formatDate(booking.bookingDate),
            startTime: booking.startTime,
            endTime: booking.endTime,
            topic: booking.topic,
            attendeesCount: booking.attendeesCount,
            userName: booking.userName,
            userPhone: booking.userPhone,
            status: booking.status,
            createdAt: booking.createdAt
        };

        // 可选字段
        if (options.includeCanCancel) {
            const limitMinutes = options.userRole === 'admin' ?
                config.booking.adminCancelTimeLimitMinutes :
                config.booking.cancelTimeLimitMinutes;

            formatted.canCancel = booking.status === 'booked' && 
                TimeHelper.canCancelBooking(booking.bookingDate, booking.startTime, limitMinutes);
        }

        if (options.includeRoomLocation && booking.roomId) {
            formatted.roomLocation = booking.roomId.location;
        }

        if (options.includeUserNickname && booking.userId) {
            formatted.userNickname = booking.userId.nickname;
        }

        if (options.includeManualBooking) {
            formatted.isManualBooking = booking.isManualBooking;
        }

        return formatted;
    }

    /**
     * 计算预约时长（分钟）
     * @param {string} startTime - 开始时间
     * @param {string} endTime - 结束时间
     * @returns {number} 时长（分钟）
     */
    static calculateDuration(startTime, endTime) {
        const TimeHelper = require('../utils/timeHelper');
        const startMinutes = TimeHelper.timeToMinutes(startTime);
        const endMinutes = TimeHelper.timeToMinutes(endTime);
        return endMinutes - startMinutes;
    }

    /**
     * 生成预约摘要文本
     * @param {Object} booking - 预约对象
     * @returns {string} 摘要文本
     */
    static generateBookingSummary(booking) {
        const TimeHelper = require('../utils/timeHelper');
        const duration = this.calculateDuration(booking.startTime, booking.endTime);
        const durationText = duration >= 60 ? 
            `${Math.floor(duration / 60)}小时${duration % 60 > 0 ? `${duration % 60}分钟` : ''}` :
            `${duration}分钟`;

        return `${booking.conferenceRoomName} | ${TimeHelper.formatDate(booking.bookingDate)} ${booking.startTime}-${booking.endTime} (${durationText}) | ${booking.topic}`;
    }

    /**
     * 检查预约是否可以修改
     * @param {Object} booking - 预约对象
     * @param {Object} user - 用户对象
     * @returns {Object} 检查结果
     */
    static canModifyBooking(booking, user) {
        const TimeHelper = require('../utils/timeHelper');
        const config = require('../config');

        // 只有预约状态为'booked'的预约才能修改
        if (booking.status !== 'booked') {
            return {
                canModify: false,
                message: '只能修改已预约状态的预约'
            };
        }

        // 检查权限
        if (booking.userId.toString() !== user._id.toString() && user.role !== 'admin') {
            return {
                canModify: false,
                message: '无权修改此预约'
            };
        }

        // 检查时间限制
        const limitMinutes = user.role === 'admin' ?
            config.booking.adminCancelTimeLimitMinutes :
            config.booking.cancelTimeLimitMinutes;

        if (!TimeHelper.canCancelBooking(booking.bookingDate, booking.startTime, limitMinutes)) {
            const limitText = user.role === 'admin' ? '5分钟' : '30分钟';
            return {
                canModify: false,
                message: `会议开始前${limitText}内不能修改预约`
            };
        }

        return { canModify: true };
    }

    /**
     * 生成预约统计信息
     * @param {Array} bookings - 预约数组
     * @returns {Object} 统计信息
     */
    static generateBookingStats(bookings) {
        const stats = {
            total: bookings.length,
            byStatus: {},
            byRoom: {},
            totalDuration: 0,
            averageDuration: 0
        };

        bookings.forEach(booking => {
            // 按状态统计
            stats.byStatus[booking.status] = (stats.byStatus[booking.status] || 0) + 1;

            // 按会议室统计
            const roomName = booking.conferenceRoomName;
            stats.byRoom[roomName] = (stats.byRoom[roomName] || 0) + 1;

            // 计算总时长
            const duration = this.calculateDuration(booking.startTime, booking.endTime);
            stats.totalDuration += duration;
        });

        // 计算平均时长
        stats.averageDuration = stats.total > 0 ? Math.round(stats.totalDuration / stats.total) : 0;

        return stats;
    }

    /**
     * 检查预约冲突详情
     * @param {Object} newBooking - 新预约信息
     * @param {Array} existingBookings - 现有预约列表
     * @returns {Object} 冲突详情
     */
    static checkBookingConflictDetails(newBooking, existingBookings) {
        const TimeHelper = require('../utils/timeHelper');
        const conflicts = [];

        const newStart = TimeHelper.timeToMinutes(newBooking.startTime);
        const newEnd = TimeHelper.timeToMinutes(newBooking.endTime);

        existingBookings.forEach(booking => {
            if (booking.status !== 'booked') return;

            const existingStart = TimeHelper.timeToMinutes(booking.startTime);
            const existingEnd = TimeHelper.timeToMinutes(booking.endTime);

            // 检查时间重叠
            if ((newStart < existingEnd && newEnd > existingStart)) {
                conflicts.push({
                    bookingId: booking._id,
                    timeRange: `${booking.startTime}-${booking.endTime}`,
                    topic: booking.topic,
                    userName: booking.userName,
                    conflictType: this.getConflictType(newStart, newEnd, existingStart, existingEnd)
                });
            }
        });

        return {
            hasConflict: conflicts.length > 0,
            conflicts: conflicts,
            message: conflicts.length > 0 ? 
                `与${conflicts.length}个现有预约存在时间冲突` : 
                '无时间冲突'
        };
    }

    /**
     * 获取冲突类型
     * @param {number} newStart - 新预约开始时间（分钟）
     * @param {number} newEnd - 新预约结束时间（分钟）
     * @param {number} existingStart - 现有预约开始时间（分钟）
     * @param {number} existingEnd - 现有预约结束时间（分钟）
     * @returns {string} 冲突类型
     */
    static getConflictType(newStart, newEnd, existingStart, existingEnd) {
        if (newStart >= existingStart && newEnd <= existingEnd) {
            return '完全包含在现有预约内';
        } else if (newStart <= existingStart && newEnd >= existingEnd) {
            return '完全包含现有预约';
        } else if (newStart < existingStart && newEnd > existingStart) {
            return '开始时间早于现有预约，但有重叠';
        } else if (newStart < existingEnd && newEnd > existingEnd) {
            return '结束时间晚于现有预约，但有重叠';
        } else {
            return '部分时间重叠';
        }
    }

    /**
     * 验证预约时间是否合理
     * @param {string} startTime - 开始时间
     * @param {string} endTime - 结束时间
     * @returns {Object} 验证结果
     */
    static validateBookingTime(startTime, endTime) {
        const TimeHelper = require('../utils/timeHelper');
        
        // 检查时间格式
        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
            return {
                valid: false,
                message: '时间格式不正确，请使用 HH:MM 格式'
            };
        }

        const startMinutes = TimeHelper.timeToMinutes(startTime);
        const endMinutes = TimeHelper.timeToMinutes(endTime);

        // 检查开始时间是否早于结束时间
        if (startMinutes >= endMinutes) {
            return {
                valid: false,
                message: '开始时间必须早于结束时间'
            };
        }

        // 检查最小预约时长（30分钟）
        if (endMinutes - startMinutes < 30) {
            return {
                valid: false,
                message: '最小预约时长为30分钟'
            };
        }

        // 检查最大预约时长（8小时）
        if (endMinutes - startMinutes > 480) {
            return {
                valid: false,
                message: '单次预约时长不能超过8小时'
            };
        }

        return { valid: true };
    }
}

module.exports = BookingUtilService; 