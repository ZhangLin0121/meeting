const moment = require('moment-timezone');
const config = require('../config');

/**
 * 时间处理工具类
 * 统一使用中国北京时间（UTC+8）
 */
class TimeHelper {

    /**
     * 获取当前北京时间
     * @returns {moment.Moment} 当前时间的moment对象
     */
    static now() {
        return moment().tz(config.timezone);
    }

    /**
     * 将日期转换为北京时间
     * @param {Date|string} date 要转换的日期
     * @returns {moment.Moment} 转换后的moment对象
     */
    static toBeijingTime(date) {
        return moment(date).tz(config.timezone);
    }

    /**
     * 获取日期的开始时间（00:00:00）
     * @param {Date|string} date 日期
     * @returns {Date} 日期的开始时间
     */
    static getStartOfDay(date) {
        return moment(date).tz(config.timezone).startOf('day').toDate();
    }

    /**
     * 获取日期的结束时间（23:59:59）
     * @param {Date|string} date 日期
     * @returns {Date} 日期的结束时间
     */
    static getEndOfDay(date) {
        return moment(date).tz(config.timezone).endOf('day').toDate();
    }

    /**
     * 检查是否为工作日（周一到周五）
     * @param {Date|string} date 要检查的日期
     * @returns {boolean} 是否为工作日
     */
    static isWorkday(date) {
        const dayOfWeek = moment(date).tz(config.timezone).day();
        return dayOfWeek >= 1 && dayOfWeek <= 5; // 1=周一, 5=周五
    }

    /**
     * 检查时间是否在办公时间内
     * @param {string} time 时间字符串，格式为"HH:MM"
     * @returns {boolean} 是否在办公时间内
     */
    static isOfficeTime(time) {
        const timeMinutes = this.timeToMinutes(time);
        const morningStart = this.timeToMinutes(config.office.startTime);
        const morningEnd = this.timeToMinutes(config.office.endTimeMorning);
        const noonStart = this.timeToMinutes(config.office.startTimeNoon);
        const noonEnd = this.timeToMinutes(config.office.endTimeNoon);
        const afternoonStart = this.timeToMinutes(config.office.startTimeAfternoon);
        const afternoonEnd = this.timeToMinutes(config.office.endTime);

        return (timeMinutes >= morningStart && timeMinutes <= morningEnd) ||
            (timeMinutes >= noonStart && timeMinutes <= noonEnd) ||
            (timeMinutes >= afternoonStart && timeMinutes <= afternoonEnd);
    }

    /**
     * 将时间字符串转换为分钟数
     * @param {string} time 时间字符串，格式为"HH:MM"
     * @returns {number} 分钟数
     */
    static timeToMinutes(time) {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    }

    /**
     * 将分钟数转换为时间字符串
     * @param {number} minutes 分钟数
     * @returns {string} 时间字符串，格式为"HH:MM"
     */
    static minutesToTime(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }

    /**
     * 检查时间段是否跨越午休时间
     * @param {string} startTime 开始时间
     * @param {string} endTime 结束时间
     * @returns {boolean} 是否跨越午休时间
     */
    static isAcrossLunchBreak(startTime, endTime) {
        const startMinutes = this.timeToMinutes(startTime);
        const endMinutes = this.timeToMinutes(endTime);
        const lunchStart = this.timeToMinutes(config.office.endTimeMorning);
        const lunchEnd = this.timeToMinutes(config.office.startTimeAfternoon);

        return startMinutes < lunchStart && endMinutes > lunchEnd;
    }

    /**
     * 检查是否为全天预约（08:30-22:00）
     * @param {string} startTime 开始时间
     * @param {string} endTime 结束时间
     * @returns {boolean} 是否为全天预约
     */
    static isFullDayBooking(startTime, endTime) {
        // 使用配置的办公开始/结束时间判断是否为全天预约
        const dayStart = config.office.startTime || '08:30';
        const dayEnd = config.office.endTime || '22:00';
        return startTime === dayStart && endTime === dayEnd;
    }

    /**
     * 检查时间段是否跨越午休时间（全天预约除外）
     * @param {string} startTime 开始时间
     * @param {string} endTime 结束时间
     * @returns {boolean} 是否跨越午休时间且不是全天预约
     */
    static isInvalidLunchBreakCrossing(startTime, endTime) {
        // 全天预约允许跨越午休时间
        if (this.isFullDayBooking(startTime, endTime)) {
            return false;
        }
        // 其他预约不允许跨越午休时间
        return this.isAcrossLunchBreak(startTime, endTime);
    }

    /**
     * 检查日期是否在允许的预约范围内
     * @param {Date|string} date 要检查的日期
     * @returns {boolean} 是否在允许的预约范围内
     */
    static isWithinBookingRange(date) {
        const bookingDate = moment(date).tz(config.timezone).startOf('day');
        const today = this.now().startOf('day');
        const maxDate = today.clone().add(config.booking.maxAdvanceDays, 'days');

        return bookingDate.isSameOrAfter(today) && bookingDate.isSameOrBefore(maxDate);
    }

    /**
     * 检查是否可以取消预约（基于时间限制）
     * @param {Date|string} bookingDate 预约日期
     * @param {string} startTime 预约开始时间
     * @param {number} limitMinutes 取消时间限制（分钟）
     * @returns {boolean} 是否可以取消
     */
    static canCancelBooking(bookingDate, startTime, limitMinutes) {
        const bookingDateTime = moment(bookingDate).tz(config.timezone);
        const [hours, minutes] = startTime.split(':').map(Number);
        bookingDateTime.hour(hours).minute(minutes).second(0);

        const now = this.now();
        const diffMinutes = bookingDateTime.diff(now, 'minutes');

        return diffMinutes > limitMinutes;
    }

    /**
     * 格式化日期为 YYYY-MM-DD 格式
     * @param {Date|string} date 日期
     * @returns {string} 格式化后的日期字符串
     */
    static formatDate(date) {
        return moment(date).tz(config.timezone).format('YYYY-MM-DD');
    }

    /**
     * 格式化日期时间为 YYYY-MM-DD HH:MM:SS 格式
     * @param {Date|string} date 日期时间
     * @returns {string} 格式化后的日期时间字符串
     */
    static formatDateTime(date) {
        return moment(date).tz(config.timezone).format('YYYY-MM-DD HH:MM:SS');
    }

    /**
     * 将日期和时间字符串合并为一个 Moment 对象
     * @param {Date|string} date 日期对象或日期字符串 (YYYY-MM-DD)
     * @param {string} time 时间字符串 (HH:MM)
     * @returns {moment.Moment} 合并后的Moment对象
     */
    static combineDateAndTime(date, time) {
        const dateStr = this.formatDate(date); // 确保日期格式为 YYYY-MM-DD
        return moment.tz(`${dateStr} ${time}`, config.timezone);
    }

    /**
     * 检查预约时间是否在过去
     * @param {Date|string} bookingDate 预约日期
     * @param {string} startTime 开始时间 (HH:MM)
     * @returns {boolean} 是否为过去的时间
     */
    static isPastTime(bookingDate, startTime) {
        const bookingDateTime = this.combineDateAndTime(bookingDate, startTime);
        const now = this.now();

        // 如果预约时间在当前时间之前，则为过去时间
        return bookingDateTime.isBefore(now);
    }

    /**
     * 格式化日期为YYYY-MM-DD (周几) 格式
     * @param {Date|string} date 日期对象或日期字符串
     * @returns {string} 格式化后的日期字符串
     */
    static formatDateWithWeekday(date) {
        const momentDate = moment(date).tz(config.timezone);
        const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        const weekdayName = weekdays[momentDate.day()];
        return `${momentDate.format('YYYY-MM-DD')} (${weekdayName})`;
    }
}

module.exports = TimeHelper;
