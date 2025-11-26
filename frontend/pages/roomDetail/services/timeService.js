// 时间管理服务模块
const request = require('../../../utils/request.js');

class TimeService {
    static DEFAULT_DAY_START = '08:30';
    static DEFAULT_DAY_END = '22:00';
    /**
     * 获取房间可用性数据
     * @param {string} roomId 房间ID
     * @param {string} date 日期
     * @param {string} userOpenId 用户openid
     * @returns {Promise<Object>} 可用性数据
     */
    static async fetchRoomAvailability(roomId, date, userOpenId) {
        console.log('🔍 获取房间可用性:', { roomId, date, userOpenId });
        
        try {
            const response = await request.get(`/api/rooms/${roomId}/availability?date=${date}`);
            let data = (response && response.success) ? response.data : (response && response.data) ? response.data : response;

            // 兼容后端字段：将 status 映射为 available 布尔值
            if (data && Array.isArray(data.timeSlots)) {
                data.timeSlots = data.timeSlots.map(slot => ({
                    ...slot,
                    available: slot.status === 'available'
                }));
            }

            console.log('✅ 房间可用性数据获取成功并已转换');
            return data;
        } catch (error) {
            console.error('❌ 获取房间可用性失败:', error);
            throw error;
        }
    }

    /**
     * 时间字符串转分钟
     * @param {string} time HH:mm
     * @returns {number} 分钟数
     */
    static timeToMinutes(time) {
        if (!time) return 0;
        const [hours, minutes] = time.split(':').map(num => parseInt(num, 10));
        return (hours * 60) + (minutes || 0);
    }

    /**
     * 分钟转换为时间字符串
     * @param {number} minutes 分钟数
     * @returns {string} HH:mm
     */
    static minutesToTime(minutes) {
        const hrs = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    }

    /**
     * 生成时间段数组
     * @returns {Array} 时间段数组
     */
    static generateTimePeriodsArray() {
        return [
            { id: 'morning', name: '上午', icon: '☀️', timeRange: '08:30 - 12:00', startTime: '08:30', endTime: '12:00', available: true, partiallyBooked: false },
            { id: 'noon', name: '中午', icon: '🍽️', timeRange: '12:00 - 14:30', startTime: '12:00', endTime: '14:30', available: true, partiallyBooked: false },
            { id: 'afternoon', name: '下午', icon: '🌇', timeRange: '14:30 - 22:00', startTime: '14:30', endTime: '22:00', available: true, partiallyBooked: false }
        ];
    }

    /**
     * 获取时间段模板
     * @returns {Array} 模板配置
     */
    static getTimePresets() {
        return [
            { id: 'morningHalf', label: '上午半天', startTime: '08:30', endTime: '12:00' },
            { id: 'afternoonHalf', label: '下午半天', startTime: '14:30', endTime: '18:00' },
            // 与后端“全天预约”定义保持一致（08:30 - 22:00）
            { id: 'fullDay', label: '全天', startTime: '08:30', endTime: '22:00' }
        ];
    }

    /**
     * 更新时段可用性
     * @param {Array} timePeriods 时段数组
     * @param {Array} timeSlots 时间段数组
     * @returns {Array} 更新后的时段数组
     */
    static updatePeriodAvailability(timePeriods, timeSlots) {
        return timePeriods.map(period => {
            const periodSlots = timeSlots.filter(slot => {
                const slotStart = parseInt(slot.startTime.replace(':', ''));
                const slotEnd = parseInt(slot.endTime.replace(':', ''));
                const periodStart = parseInt(period.startTime.replace(':', ''));
                const periodEnd = parseInt(period.endTime.replace(':', ''));
                
                return slotStart >= periodStart && slotEnd <= periodEnd;
            });

            const availableSlots = periodSlots.filter(slot => slot.available);
            const bookedSlots = periodSlots.filter(slot => !slot.available);

            // 检查整时段是否可预约
            const canBookWholePeriod = this.canBookWholePeriod(periodSlots);
            
            const status = availableSlots.length === 0
                ? 'unavailable'
                : (bookedSlots.length > 0 ? 'partial' : 'available');

            return {
                ...period,
                available: availableSlots.length > 0,
                partiallyBooked: bookedSlots.length > 0 && availableSlots.length > 0,
                fullyBooked: availableSlots.length === 0,
                canBookWholePeriod,
                status,
                availableCount: availableSlots.length,
                totalCount: periodSlots.length,
                slots: periodSlots
            };
        });
    }

    /**
     * 检查是否可以预约整个时段
     * @param {Array} periodSlots 时段内的时间段
     * @returns {boolean} 是否可以预约整个时段
     */
    static canBookWholePeriod(periodSlots) {
        if (periodSlots.length === 0) return false;
        
        // 检查是否所有时间段都可用
        const allAvailable = periodSlots.every(slot => slot.available);
        
        // 检查时间段是否连续
        const sortedSlots = periodSlots.sort((a, b) => 
            parseInt(a.startTime.replace(':', '')) - parseInt(b.startTime.replace(':', ''))
        );
        
        let isContinuous = true;
        for (let i = 0; i < sortedSlots.length - 1; i++) {
            if (sortedSlots[i].endTime !== sortedSlots[i + 1].startTime) {
                isContinuous = false;
                break;
            }
        }
        
        return allAvailable && isContinuous;
    }

    /**
     * 检查时段是否部分已预约
     * @param {string} periodId 时段ID
     * @param {Array} timeSlots 时间段数组
     * @returns {boolean} 是否部分已预约
     */
    static isPeriodPartiallyBooked(periodId, timeSlots) {
        const periodConfig = {
            'morning': { start: 830, end: 1200 },
            'noon': { start: 1200, end: 1430 },
            'afternoon': { start: 1430, end: 2200 }
        };

        const config = periodConfig[periodId];
        if (!config) return false;

        const periodSlots = timeSlots.filter(slot => {
            const startTime = parseInt(slot.startTime.replace(':', ''));
            const endTime = parseInt(slot.endTime.replace(':', ''));
            return startTime >= config.start && endTime <= config.end;
        });

        const availableSlots = periodSlots.filter(slot => slot.available);
        const bookedSlots = periodSlots.filter(slot => !slot.available);

        return bookedSlots.length > 0 && availableSlots.length > 0;
    }

    /**
     * 构建时间刻度点
     * @param {Array} timeSlots 时间段数组
     * @returns {Array} 时间点数组
     */
    static buildTimePoints(timeSlots = [], bookings = [], closures = [], selectedDate = '') {
        const DEFAULT_START = this.timeToMinutes(this.DEFAULT_DAY_START || '08:30');
        const DEFAULT_END = this.timeToMinutes(this.DEFAULT_DAY_END || '22:00');

        const bookingRanges = this.buildBookingRanges(bookings);
        const closureRanges = this.buildClosureRanges(closures);
        const bookingEndSet = new Set(bookingRanges.map(r => r.end));

        const points = [];
        for (let minutes = DEFAULT_START; minutes <= DEFAULT_END; minutes += 30) {
            const originalStatus = this.resolveSlotStatus(minutes, bookingRanges, closureRanges);
            // 起点/终点可选择必须确保后续或前序能组成最小时长（30分钟）
            const nextMinutes = minutes + 30;
            const prevMinutes = minutes - 30;
            const startBlocked = this.isMinuteWithinRanges(minutes, bookingRanges)
                || this.isMinuteWithinRanges(minutes, closureRanges)
                || this.isMinuteWithinRanges(nextMinutes, bookingRanges, true, false); // 后半段被占用则不可作为开始
            const endBlocked = this.isMinuteWithinRanges(minutes, bookingRanges, false, false)
                || this.isMinuteWithinRanges(minutes, closureRanges, false, false)
                || this.isMinuteWithinRanges(prevMinutes, bookingRanges); // 前半段被占用则不可作为结束

            const allowBoundaryStart = bookingEndSet.has(minutes);
            const boundaryEnd = allowBoundaryStart && originalStatus === 'available';
            const status = boundaryEnd ? 'booked' : originalStatus;
            points.push({
                time: this.minutesToTime(minutes),
                minutes,
                index: points.length,
                startSlotIndex: -1,
                endSlotIndex: -1,
                canSelectStart: (!startBlocked && minutes < DEFAULT_END) || allowBoundaryStart,
                canSelectEnd: !endBlocked,
                isTerminal: minutes === DEFAULT_END,
                isPast: false,
                status,
                allowStartAfterBooking: allowBoundaryStart,
                boundaryEnd
            });
        }

        // 边界刻度（12:00、14:30）允许作为新时段起点，前一时段占用不影响
        const boundaryStarts = ['12:00', '14:30'];
        return points.map(p => {
            if (boundaryStarts.includes(p.time) && p.status !== 'closed') {
                return { ...p, canSelectStart: true, allowStartAfterBooking: true, boundaryEnd: p.boundaryEnd };
            }
            return p;
        });
    }

    /**
     * 判断时间段是否可作为开始时间
     */
    static isSlotStartAvailable(slot) {
        if (!slot) return false;
        // 直接使用 canBeStartTime 字段，这个字段在 buildSlotLookup 中已经正确计算
        return slot.canBeStartTime === true;
    }

    static buildBookingRanges(bookings = []) {
        return (bookings || []).map(booking => {
            const start = this.timeToMinutes(booking.startTime);
            const end = this.timeToMinutes(booking.endTime);
            if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
                return null;
            }
            return { start, end };
        }).filter(Boolean);
    }

    static buildClosureRanges(closures = []) {
        const DEFAULT_START = this.timeToMinutes(this.DEFAULT_DAY_START || '08:30');
        const DEFAULT_END = this.timeToMinutes(this.DEFAULT_DAY_END || '22:00');

        return (closures || []).map(closure => {
            if (closure.isAllDay) {
                return { start: DEFAULT_START, end: DEFAULT_END };
            }

            const start = closure.startTime ? this.timeToMinutes(closure.startTime) : DEFAULT_START;
            const end = closure.endTime ? this.timeToMinutes(closure.endTime) : DEFAULT_END;
            if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
                return null;
            }
            return { start, end };
        }).filter(Boolean);
    }

    static resolveSlotStatus(minutes, bookingRanges, closureRanges) {
        if (this.isMinuteWithinRanges(minutes, closureRanges)) {
            return 'closed';
        }
        if (this.isMinuteWithinRanges(minutes, bookingRanges)) {
            return 'booked';
        }
        return 'available';
    }

    static isMinuteWithinRanges(minutes, ranges = [], inclusiveStart = true, exclusiveEnd = true) {
        return (ranges || []).some(range => {
            const lowerOk = inclusiveStart ? minutes >= range.start : minutes > range.start;
            const upperOk = exclusiveEnd ? minutes < range.end : minutes <= range.end;
            return lowerOk && upperOk;
        });
    }

    /**
     * 判断时间段是否可作为结束时间边界
     */
    static isSlotEndSelectable(slot) {
        if (!slot) return false;
        if (slot.status && slot.status === 'closed') return false;
        if (typeof slot.canBeEndTime === 'boolean') {
            return slot.canBeEndTime;
        }
        return true;
    }

    /**
     * 根据当前时间调整时间点可用性
     * @param {Array} points 时间点集合
     * @param {string} selectedDate 选中的日期（YYYY-MM-DD）
     * @returns {Array} 调整后的时间点
     */
    static applyCurrentTimeRules(points = [], selectedDate) {
        if (!Array.isArray(points) || !selectedDate) {
            return points;
        }

        const nowDate = new Date();
        const today = this.formatDate(nowDate);
        const isSameDay = selectedDate === today;
        const currentMinutes = (nowDate.getHours() * 60) + nowDate.getMinutes();

        return points.map(point => {
            const status = point.status || 'available';
            const baseCanStart = typeof point.canSelectStart === 'boolean'
                ? point.canSelectStart
                : status === 'available';
            const baseCanEnd = typeof point.canSelectEnd === 'boolean'
                ? point.canSelectEnd
                : status === 'available';

            const isPastClient = isSameDay && point.minutes < currentMinutes;
            const isBlocked = (status === 'booked' || status === 'closed') && !point.allowStartAfterBooking;

            // 强化规则：必须能组成至少30分钟的可用区间
            let canSelectStart = !isPastClient && !point.isTerminal && !isBlocked && point.canSelectStart;
            let canSelectEnd = !isPastClient && !isBlocked && point.canSelectEnd;

            if (baseCanStart === false && status !== 'past') {
                canSelectStart = false;
            }

            if (baseCanEnd === false && status !== 'past') {
                canSelectEnd = false;
            }

            return {
                ...point,
                canSelectStart,
                canSelectEnd,
                isPastClient
            };
        });
    }

    /**
     * 构建时间段查找表
     * @param {Array} timeSlots 时间段数组
     * @returns {Object} 查找表
     */
    static buildSlotLookup(bookings = [], closures = []) {
        const DEFAULT_START = this.timeToMinutes(this.DEFAULT_DAY_START || '08:30');
        const DEFAULT_END = this.timeToMinutes(this.DEFAULT_DAY_END || '22:00');

        const bookingRanges = this.buildBookingRanges(bookings);
        const closureRanges = this.buildClosureRanges(closures);

        const lookup = {};
        let index = 0;
        for (let minutes = DEFAULT_START; minutes < DEFAULT_END; minutes += 30) {
            const status = this.resolveSlotStatus(minutes, bookingRanges, closureRanges);
            const nextBoundary = minutes + 30;
            const prevBoundary = minutes - 30;
            const startBlocked = this.isMinuteWithinRanges(minutes, bookingRanges)
                || this.isMinuteWithinRanges(minutes, closureRanges)
                || this.isMinuteWithinRanges(nextBoundary, bookingRanges, true, false); // 后半段被占用则不可作为开始
            const endBlocked = this.isMinuteWithinRanges(nextBoundary, bookingRanges, false, false)
                || this.isMinuteWithinRanges(nextBoundary, closureRanges, false, false)
                || this.isMinuteWithinRanges(prevBoundary, bookingRanges); // 前半段被占用则不可作为结束

            lookup[minutes] = {
                index: index++,
                slot: {
                    startTime: this.minutesToTime(minutes),
                    endTime: this.minutesToTime(minutes + 30),
                    status,
                    available: !startBlocked,
                    canBeStartTime: !startBlocked,
                    canBeEndTime: !endBlocked
                }
            };
        }

        return lookup;
    }

    /**
     * 应用选中状态到时间点
     * @param {Array} points 时间点列表
     * @param {number} startIndex 起始点索引
     * @param {number} endIndex 结束点索引（开区间）
     * @returns {Array} 新的时间点列表
     */
    static markSelectedRange(points = [], startIndex, endIndex) {
        return points.map((point, idx) => {
            const hasRange = startIndex >= 0 && endIndex >= 0;
            const inRange = hasRange && idx >= startIndex && idx < endIndex;
            return {
                ...point,
                isSelectedStart: startIndex >= 0 && idx === startIndex,
                isSelectedEnd: endIndex >= 0 && idx === endIndex,
                isInSelectedRange: inRange
            };
        });
    }

    /**
     * 处理时间点点击
     * @param {Object} payload 选择参数
     * @returns {Object} 处理结果
     */
    static handlePointSelection(payload) {
        const { currentStart, currentEnd, pointIndex, points = [], slotLookup = {} } = payload;

        if (!Array.isArray(points) || pointIndex < 0 || pointIndex >= points.length) {
            return { success: false, error: '无效的时间点' };
        }

        const point = points[pointIndex];
        const lastIndex = points.length - 1;

        const isSelectingStart = currentStart < 0 || (currentStart >= 0 && currentEnd >= 0);

        if (point && point.isPastClient) {
            return { success: false, error: '该时间已过去，请选择更晚的时间' };
        }

        if (isSelectingStart) {
            if (pointIndex === lastIndex) {
                return { success: false, error: '请至少保留30分钟的使用时长' };
            }

            if (!point.canSelectStart) {
                return { success: false, error: '该时间不可作为开始' };
            }

            const lookup = slotLookup[point.minutes];
            if (lookup && lookup.slot && !this.isSlotStartAvailable(lookup.slot)) {
                return { success: false, error: '该时间不可作为开始' };
            }

            const updatedPoints = this.markSelectedRange(points, pointIndex, -1);
            return {
                success: true,
                selectedStartIndex: pointIndex,
                selectedEndIndex: -1,
                timePoints: updatedPoints,
                selectedTimeSlot: null,
                selectedTimeText: `${point.time} 起`
            };
        }

        if (pointIndex === currentStart) {
            const clearedPoints = this.markSelectedRange(points, -1, -1);
            return {
                success: true,
                selectedStartIndex: -1,
                selectedEndIndex: -1,
                timePoints: clearedPoints,
                selectedTimeSlot: null,
                selectedTimeText: ''
            };
        }

        let startIndex = currentStart;
        let endIndex = pointIndex;

        if (pointIndex < currentStart) {
            startIndex = pointIndex;
            endIndex = currentStart;
        }

        if (endIndex <= startIndex) {
            return { success: false, error: '结束时间需晚于开始时间' };
        }

        const validation = this.validateRange(startIndex, endIndex, points, slotLookup);
        if (!validation.success) {
            return validation;
        }

        const startPoint = points[startIndex];
        const endPoint = points[endIndex];
        const updatedPoints = this.markSelectedRange(points, startIndex, endIndex);
        const durationMinutes = endPoint.minutes - startPoint.minutes;

        return {
            success: true,
            selectedStartIndex: startIndex,
            selectedEndIndex: endIndex,
            timePoints: updatedPoints,
            selectedTimeSlot: {
                startTime: startPoint.time,
                endTime: endPoint.time,
                duration: durationMinutes,
                slotIndices: this.collectSlotIndices(startIndex, endIndex, points, slotLookup)
            },
            selectedTimeText: `${startPoint.time} - ${endPoint.time}`
        };
    }

    /**
     * 校验时间区间是否全部可用
     * @param {number} startIndex 起始点索引
     * @param {number} endIndex 结束点索引（开区间）
     * @param {Array} points 时间点数组
     * @param {Object} slotLookup 查找表
     * @returns {Object} 校验结果
     */
    static validateRange(startIndex, endIndex, points, slotLookup) {
        if (endIndex <= startIndex) {
            return { success: false, error: '结束时间需晚于开始时间' };
        }

        for (let idx = startIndex; idx < endIndex; idx++) {
            const point = points[idx];
            if (point && point.isPastClient) {
                return { success: false, error: '所选时间段包含已过期的时间' };
            }
            const lookup = slotLookup[point.minutes];
            if (!lookup || !lookup.slot || !this.isSlotStartAvailable(lookup.slot)) {
                return { success: false, error: '所选时间段包含不可用时段' };
            }
        }

        const endPointCheck = points[endIndex];
        if (endPointCheck && endPointCheck.isPastClient) {
            return { success: false, error: '所选时间段包含已过期的时间' };
        }

        return { success: true };
    }

    /**
     * 收集选中时间段对应的索引
     * @param {number} startIndex 起始点索引
     * @param {number} endIndex 结束点索引（开区间）
     * @param {Array} points 时间点数组
     * @param {Object} slotLookup 查找表
     * @returns {Array} 时间段索引
     */
    static collectSlotIndices(startIndex, endIndex, points, slotLookup) {
        const result = [];
        for (let idx = startIndex; idx < endIndex; idx++) {
            const lookup = slotLookup[points[idx].minutes];
            if (lookup && typeof lookup.index === 'number' && lookup.index >= 0) {
                result.push(lookup.index);
            }
        }
        return result;
    }

    /**
     * 查找指定时间在刻度中的索引
     * @param {Array} points 时间点集合
     * @param {string} time HH:mm
     * @returns {number} 索引
     */
    static findPointIndexByTime(points = [], time) {
        return points.findIndex(point => point.time === time);
    }

    /**
     * 根据模板选择时间段
     * @param {Object} preset 模板
     * @param {Array} points 时间点集合
     * @param {Object} slotLookup 查找表
     * @returns {Object} 选择结果
     */
    static applyPresetSelection(preset, points = [], slotLookup = {}) {
        if (!preset) {
            return { success: false, error: '无效的时间模板' };
        }

        const startIndex = this.findPointIndexByTime(points, preset.startTime);
        const endIndex = this.findPointIndexByTime(points, preset.endTime);

        if (startIndex === -1 || endIndex === -1) {
            return { success: false, error: '当前日期不支持该模板' };
        }

        const validation = this.validateRange(startIndex, endIndex, points, slotLookup);
        if (!validation.success) {
            return validation;
        }

        const updatedPoints = this.markSelectedRange(points, startIndex, endIndex);
        const durationMinutes = points[endIndex].minutes - points[startIndex].minutes;

        return {
            success: true,
            selectedStartIndex: startIndex,
            selectedEndIndex: endIndex,
            timePoints: updatedPoints,
            selectedTimeSlot: {
                startTime: preset.startTime,
                endTime: preset.endTime,
                duration: durationMinutes,
                slotIndices: this.collectSlotIndices(startIndex, endIndex, points, slotLookup)
            },
            selectedTimeText: `${preset.startTime} - ${preset.endTime}`
        };
    }

    /**
     * 模板是否可用
     * @param {Object} preset 模板
     * @param {Array} points 时间点集合
     * @param {Object} slotLookup 查找表
     * @returns {boolean} 是否可用
     */
    static isPresetAvailable(preset, points = [], slotLookup = {}) {
        const startIndex = this.findPointIndexByTime(points, preset.startTime);
        const endIndex = this.findPointIndexByTime(points, preset.endTime);

        if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
            return false;
        }

        const validation = this.validateRange(startIndex, endIndex, points, slotLookup);
        return validation.success;
    }

    /**
     * 格式化日期
     * @param {Date} date 日期对象
     * @returns {string} 格式化后的日期字符串
     */
    static formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * 更新全天预约状态
     * @param {Array} timePeriods 时段数组
     * @returns {Object} 更新结果
     */
    static updatePeriodsForFullDayBooking(timePeriods) {
        const updatedPeriods = timePeriods.map(period => ({
            ...period,
            available: false,
            fullyBooked: true,
            canBookWholePeriod: false
        }));

        return {
            timePeriods: updatedPeriods,
            isFullDayUnavailable: true
        };
    }

    /**
     * 恢复时段可用性
     * @param {Array} originalTimeSlots 原始时间段数组
     * @returns {Object} 恢复结果
     */
    static restorePeriodsAvailability(originalTimeSlots) {
        const timePeriods = this.generateTimePeriodsArray();
        const updatedPeriods = this.updatePeriodAvailability(timePeriods, originalTimeSlots);

        return {
            timePeriods: updatedPeriods,
            isFullDayUnavailable: false,
            wholePeriodBooking: null
        };
    }
}

module.exports = TimeService; 
