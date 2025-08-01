const TimeHelper = require('../utils/timeHelper');
const config = require('../config');

/**
 * 会议室可用性服务
 * 处理所有会议室可用性计算相关的逻辑
 */
class RoomAvailabilityService {

    /**
     * 生成时间段信息
     * @param {Array} bookings 预约记录
     * @param {Array} closures 临时关闭记录
     * @param {Date} queryDate 查询日期，用于检查过去时间
     * @returns {Array} 时间段数组
     */
    static generateTimeSlots(bookings, closures, queryDate) {
        console.log('🔍 生成时间段信息，预约记录:', bookings.map(b => ({
            startTime: b.startTime,
            endTime: b.endTime,
            topic: b.topic
        })));

        const slots = [];

        // 简化为两个时段：上午和下午
        // 上午时间段 8:30-12:00
        const morningStart = TimeHelper.timeToMinutes(config.office.startTime);
        const morningEnd = TimeHelper.timeToMinutes(config.office.endTimeMorning);

        // 下午时间段 12:00-22:00（合并了原来的中午和下午）
        const afternoonStart = TimeHelper.timeToMinutes(config.office.startTimeNoon);
        const afternoonEnd = TimeHelper.timeToMinutes(config.office.endTime);

        // 生成30分钟间隔的时间段
        const periods = [
            { start: morningStart, end: morningEnd, name: 'morning' },
            { start: afternoonStart, end: afternoonEnd, name: 'afternoon' }
        ];

        // 生成时间点而不是时间槽
        // 用户选择开始时间点和结束时间点，预约从开始到结束的时间段
        const timePoints = [];

        // 收集所有预约的边界时间（结束时间），这些可以作为新预约的开始时间
        const boundaryTimes = new Set();
        bookings.forEach(booking => {
            const endMinutes = TimeHelper.timeToMinutes(booking.endTime);
            boundaryTimes.add(endMinutes);
        });

        // 生成基础时间点（每30分钟一个）
        const baseTimePoints = [];
        for (let minutes = TimeHelper.timeToMinutes('08:30'); minutes <= TimeHelper.timeToMinutes('22:00'); minutes += 30) {
            baseTimePoints.push(minutes);
        }

        // 添加边界时间点（如果不在基础时间点中）
        boundaryTimes.forEach(boundaryMinutes => {
            if (!baseTimePoints.includes(boundaryMinutes) &&
                boundaryMinutes >= TimeHelper.timeToMinutes('08:30') &&
                boundaryMinutes <= TimeHelper.timeToMinutes('22:00')) {
                baseTimePoints.push(boundaryMinutes);
            }
        });

        // 排序所有时间点
        baseTimePoints.sort((a, b) => a - b);

        // 为每个时间点生成状态信息
        baseTimePoints.forEach(minutes => {
            const timePoint = TimeHelper.minutesToTime(minutes);

            // 检查是否在已预约的时间段内
            const isInBookedRange = bookings.some(booking => {
                const bookingStart = TimeHelper.timeToMinutes(booking.startTime);
                const bookingEnd = TimeHelper.timeToMinutes(booking.endTime);
                // 时间点在预约范围内（开始时间含，结束时间不含）
                return minutes >= bookingStart && minutes < bookingEnd;
            });

            // 检查这个时间点是否可以作为开始时间
            // 1. 不在已预约的时间段内
            // 2. 或者是某个预约的结束时间（边界时间）
            // 3. 不能是最后一个时间点（22:00），因为无法找到结束时间
            const isLastTimePoint = minutes === TimeHelper.timeToMinutes('22:00');
            const canBeStartTime = (!isInBookedRange || boundaryTimes.has(minutes)) && !isLastTimePoint;

            // 检查这个时间点是否可以作为结束时间
            // 不能在已预约时间段的中间（不包括开始时间）
            const canBeEndTime = !bookings.some(booking => {
                const bookingStart = TimeHelper.timeToMinutes(booking.startTime);
                const bookingEnd = TimeHelper.timeToMinutes(booking.endTime);
                return minutes > bookingStart && minutes <= bookingEnd;
            });

            // 检查是否为过去的时间
            const isPastTime = queryDate && TimeHelper.isPastTime(queryDate, timePoint);

            // 检查是否临时关闭
            const isClosed = closures.some(closure => {
                if (closure.isAllDay) return true;
                const closureStart = TimeHelper.timeToMinutes(closure.startTime);
                const closureEnd = TimeHelper.timeToMinutes(closure.endTime);
                return minutes >= closureStart && minutes < closureEnd;
            });

            // 确定状态
            let status = 'available';
            if (isClosed) {
                status = 'closed';
            } else if (isPastTime) {
                status = 'past';
            } else if (isInBookedRange && !boundaryTimes.has(minutes)) {
                // 在预约时间段内且不是边界时间，标记为已预约
                status = 'booked';
            }

            // 确定时间点属于哪个时段（用于前端分组显示）
            let period = 'afternoon'; // 默认下午
            if (minutes < TimeHelper.timeToMinutes('12:00')) {
                period = 'morning';
            }

            timePoints.push({
                time: timePoint,
                minutes: minutes,
                status: status,
                period: period,
                canBeStartTime: (status === 'available') && canBeStartTime,
                canBeEndTime: (status === 'available') && canBeEndTime,
                isBoundaryTime: boundaryTimes.has(minutes), // 标记是否为边界时间
                // 为了兼容前端，保留这些字段
                startTime: timePoint,
                endTime: TimeHelper.minutesToTime(minutes + 30)
            });
        });

        return timePoints;
    }

    /**
     * 计算会议室在指定时间段的可用性
     * @param {Array} bookings - 预约记录
     * @param {Array} closures - 临时关闭记录
     * @param {string} startTime - 开始时间
     * @param {string} endTime - 结束时间
     * @returns {Object} 可用性结果
     */
    static calculateTimeRangeAvailability(bookings, closures, startTime, endTime) {
        const startMinutes = TimeHelper.timeToMinutes(startTime);
        const endMinutes = TimeHelper.timeToMinutes(endTime);

        // 检查是否与现有预约冲突
        const conflictingBookings = bookings.filter(booking => {
            const bookingStart = TimeHelper.timeToMinutes(booking.startTime);
            const bookingEnd = TimeHelper.timeToMinutes(booking.endTime);

            // 检查时间重叠
            return (startMinutes < bookingEnd && endMinutes > bookingStart);
        });

        // 检查是否与临时关闭冲突
        const conflictingClosures = closures.filter(closure => {
            if (closure.isAllDay) return true;

            const closureStart = TimeHelper.timeToMinutes(closure.startTime);
            const closureEnd = TimeHelper.timeToMinutes(closure.endTime);

            // 检查时间重叠
            return (startMinutes < closureEnd && endMinutes > closureStart);
        });

        return {
            available: conflictingBookings.length === 0 && conflictingClosures.length === 0,
            conflictingBookings: conflictingBookings,
            conflictingClosures: conflictingClosures
        };
    }

    /**
     * 生成可用时间段列表
     * @param {Array} bookings - 预约记录
     * @param {Array} closures - 临时关闭记录
     * @param {Date} date - 日期
     * @returns {Array} 可用时间段
     */
    static generateAvailableTimeSlots(bookings, closures, date) {
        const availableSlots = [];
        const workStart = TimeHelper.timeToMinutes(config.office.startTime); // 08:30
        const workEnd = TimeHelper.timeToMinutes(config.office.endTime); // 22:00

        // 创建所有占用时间段的列表（预约 + 关闭）
        const occupiedSlots = [];

        // 添加预约时间段
        bookings.forEach(booking => {
            occupiedSlots.push({
                start: TimeHelper.timeToMinutes(booking.startTime),
                end: TimeHelper.timeToMinutes(booking.endTime),
                type: 'booking',
                data: booking
            });
        });

        // 添加临时关闭时间段
        closures.forEach(closure => {
            if (closure.isAllDay) {
                occupiedSlots.push({
                    start: workStart,
                    end: workEnd,
                    type: 'closure',
                    data: closure
                });
            } else {
                occupiedSlots.push({
                    start: TimeHelper.timeToMinutes(closure.startTime),
                    end: TimeHelper.timeToMinutes(closure.endTime),
                    type: 'closure',
                    data: closure
                });
            }
        });

        // 按开始时间排序
        occupiedSlots.sort((a, b) => a.start - b.start);

        // 合并重叠的时间段
        const mergedSlots = this.mergeOverlappingSlots(occupiedSlots);

        // 找出空闲时间段
        let currentTime = workStart;

        mergedSlots.forEach(slot => {
            if (currentTime < slot.start) {
                // 在当前时间和下一个占用时间段之间有空闲时间
                const freeStart = currentTime;
                const freeEnd = slot.start;

                // 只添加至少30分钟的空闲时间段
                if (freeEnd - freeStart >= 30) {
                    availableSlots.push({
                        startTime: TimeHelper.minutesToTime(freeStart),
                        endTime: TimeHelper.minutesToTime(freeEnd),
                        duration: freeEnd - freeStart,
                        isPastTime: date && TimeHelper.isPastTime(date, TimeHelper.minutesToTime(freeStart))
                    });
                }
            }
            currentTime = Math.max(currentTime, slot.end);
        });

        // 检查最后一个时间段到工作结束时间
        if (currentTime < workEnd) {
            const freeStart = currentTime;
            const freeEnd = workEnd;

            if (freeEnd - freeStart >= 30) {
                availableSlots.push({
                    startTime: TimeHelper.minutesToTime(freeStart),
                    endTime: TimeHelper.minutesToTime(freeEnd),
                    duration: freeEnd - freeStart,
                    isPastTime: date && TimeHelper.isPastTime(date, TimeHelper.minutesToTime(freeStart))
                });
            }
        }

        return availableSlots;
    }

    /**
     * 合并重叠的时间段
     * @param {Array} slots - 时间段数组
     * @returns {Array} 合并后的时间段
     */
    static mergeOverlappingSlots(slots) {
        if (slots.length === 0) return [];

        const merged = [];
        let current = { ...slots[0] };

        for (let i = 1; i < slots.length; i++) {
            const next = slots[i];

            if (current.end >= next.start) {
                // 重叠，合并
                current.end = Math.max(current.end, next.end);
            } else {
                // 不重叠，添加当前时间段并开始新的
                merged.push(current);
                current = { ...next };
            }
        }

        merged.push(current);
        return merged;
    }

    /**
     * 检查特定时间段是否可用
     * @param {Array} bookings - 预约记录
     * @param {Array} closures - 临时关闭记录
     * @param {string} startTime - 开始时间
     * @param {string} endTime - 结束时间
     * @param {Date} date - 日期
     * @returns {Object} 检查结果
     */
    static checkTimeSlotAvailability(bookings, closures, startTime, endTime, date) {
        // 检查是否为过去时间
        if (date && TimeHelper.isPastTime(date, startTime)) {
            return {
                available: false,
                reason: 'past_time',
                message: '不能预约过去的时间'
            };
        }

        // 检查时间段有效性
        const startMinutes = TimeHelper.timeToMinutes(startTime);
        const endMinutes = TimeHelper.timeToMinutes(endTime);

        if (endMinutes <= startMinutes) {
            return {
                available: false,
                reason: 'invalid_time_range',
                message: '结束时间必须大于开始时间'
            };
        }

        if (endMinutes - startMinutes < 30) {
            return {
                available: false,
                reason: 'too_short',
                message: '最小预约时间为30分钟'
            };
        }

        // 检查是否在工作时间内
        const workStart = TimeHelper.timeToMinutes(config.office.startTime);
        const workEnd = TimeHelper.timeToMinutes(config.office.endTime);

        if (startMinutes < workStart || endMinutes > workEnd) {
            return {
                available: false,
                reason: 'outside_work_hours',
                message: `预约时间必须在 ${config.office.startTime} - ${config.office.endTime} 之间`
            };
        }

        // 检查可用性
        const availabilityResult = this.calculateTimeRangeAvailability(bookings, closures, startTime, endTime);

        if (!availabilityResult.available) {
            let reason = 'conflict';
            let message = '该时间段不可用';

            if (availabilityResult.conflictingClosures.length > 0) {
                reason = 'temporary_closure';
                message = '该时间段会议室临时关闭';
            } else if (availabilityResult.conflictingBookings.length > 0) {
                reason = 'booking_conflict';
                message = '该时间段已被预约';
            }

            return {
                available: false,
                reason: reason,
                message: message,
                conflicts: {
                    bookings: availabilityResult.conflictingBookings,
                    closures: availabilityResult.conflictingClosures
                }
            };
        }

        return {
            available: true,
            message: '时间段可用'
        };
    }

    /**
     * 获取建议的可用时间段
     * @param {Array} bookings - 预约记录
     * @param {Array} closures - 临时关闭记录
     * @param {Date} date - 日期
     * @param {number} duration - 期望时长（分钟）
     * @returns {Array} 建议的时间段
     */
    static getSuggestedTimeSlots(bookings, closures, date, duration = 60) {
        const availableSlots = this.generateAvailableTimeSlots(bookings, closures, date);
        
        // 筛选出足够长的时间段
        const suitableSlots = availableSlots.filter(slot => 
            slot.duration >= duration && !slot.isPastTime
        );

        // 为每个合适的时间段生成建议
        const suggestions = [];

        suitableSlots.forEach(slot => {
            const slotStart = TimeHelper.timeToMinutes(slot.startTime);
            const slotEnd = TimeHelper.timeToMinutes(slot.endTime);

            // 在这个空闲时间段内生成多个建议（每30分钟一个起始点）
            for (let start = slotStart; start + duration <= slotEnd; start += 30) {
                suggestions.push({
                    startTime: TimeHelper.minutesToTime(start),
                    endTime: TimeHelper.minutesToTime(start + duration),
                    duration: duration,
                    priority: this.calculateSlotPriority(start, duration)
                });
            }
        });

        // 按优先级排序（上午时间段优先级更高）
        suggestions.sort((a, b) => b.priority - a.priority);

        return suggestions.slice(0, 5); // 返回前5个建议
    }

    /**
     * 计算时间段优先级
     * @param {number} startMinutes - 开始时间（分钟）
     * @param {number} duration - 时长（分钟）
     * @returns {number} 优先级分数
     */
    static calculateSlotPriority(startMinutes, duration) {
        let priority = 0;

        // 上午时间段优先级更高
        if (startMinutes >= TimeHelper.timeToMinutes('09:00') && startMinutes < TimeHelper.timeToMinutes('11:00')) {
            priority += 100;
        }

        // 下午早期时间段次优先
        if (startMinutes >= TimeHelper.timeToMinutes('14:00') && startMinutes < TimeHelper.timeToMinutes('16:00')) {
            priority += 80;
        }

        // 整点时间优先级更高
        if (startMinutes % 60 === 0) {
            priority += 20;
        }

        // 半点时间次优先
        if (startMinutes % 60 === 30) {
            priority += 10;
        }

        return priority;
    }
}

module.exports = RoomAvailabilityService; 