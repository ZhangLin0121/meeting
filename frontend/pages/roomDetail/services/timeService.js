// 时间管理服务模块
const request = require('../../../utils/request.js');

class TimeService {
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
            
            console.log('✅ 房间可用性数据:', response);
            return response;
        } catch (error) {
            console.error('❌ 获取房间可用性失败:', error);
            throw error;
        }
    }

    /**
     * 生成时间段数组
     * @returns {Array} 时间段数组
     */
    static generateTimePeriodsArray() {
        return [
            { id: 'morning', name: '上午', startTime: '08:30', endTime: '12:00', available: true, partiallyBooked: false },
            { id: 'noon', name: '中午', startTime: '12:00', endTime: '14:30', available: true, partiallyBooked: false },
            { id: 'afternoon', name: '下午', startTime: '14:30', endTime: '22:00', available: true, partiallyBooked: false }
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
            
            return {
                ...period,
                available: availableSlots.length > 0,
                partiallyBooked: bookedSlots.length > 0 && availableSlots.length > 0,
                fullyBooked: availableSlots.length === 0,
                canBookWholePeriod,
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
     * 设置开始时间
     * @param {number} startIndex 开始索引
     * @param {Array} timeSlots 时间段数组
     * @returns {Object} 设置结果
     */
    static setStartTime(startIndex, timeSlots) {
        if (startIndex < 0 || startIndex >= timeSlots.length) {
            return { success: false, error: '无效的开始时间索引' };
        }

        const startSlot = timeSlots[startIndex];
        if (!startSlot.available) {
            return { success: false, error: '选择的开始时间不可用' };
        }

        return {
            success: true,
            selectedStartIndex: startIndex,
            selectedEndIndex: startIndex,
            selectedTimeSlot: {
                startTime: startSlot.startTime,
                endTime: startSlot.endTime,
                duration: 30
            },
            selectedTimeText: `${startSlot.startTime} - ${startSlot.endTime}`
        };
    }

    /**
     * 设置结束时间
     * @param {number} startIndex 开始索引
     * @param {number} endIndex 结束索引
     * @param {Array} timeSlots 时间段数组
     * @returns {Object} 设置结果
     */
    static setEndTime(startIndex, endIndex, timeSlots) {
        if (startIndex < 0 || endIndex < 0 || startIndex >= timeSlots.length || endIndex >= timeSlots.length) {
            return { success: false, error: '无效的时间索引' };
        }

        if (endIndex < startIndex) {
            return { success: false, error: '结束时间不能早于开始时间' };
        }

        // 检查选中范围内的所有时间段是否都可用
        for (let i = startIndex; i <= endIndex; i++) {
            if (!timeSlots[i].available) {
                return { success: false, error: '选择的时间范围内包含不可用时间段' };
            }
        }

        const startSlot = timeSlots[startIndex];
        const endSlot = timeSlots[endIndex];
        const duration = (endIndex - startIndex + 1) * 30;

        return {
            success: true,
            selectedStartIndex: startIndex,
            selectedEndIndex: endIndex,
            selectedTimeSlot: {
                startTime: startSlot.startTime,
                endTime: endSlot.endTime,
                duration
            },
            selectedTimeText: `${startSlot.startTime} - ${endSlot.endTime}`
        };
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