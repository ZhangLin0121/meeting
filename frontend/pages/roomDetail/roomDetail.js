// pages/roomDetail/roomDetail.js
const request = require('../../utils/request.js');

Page({

    /**
     * 页面的初始数据
     */
    data: {
        roomId: null,
        roomDetails: {},
        loading: true,
        userOpenId: '',
        bookingData: {
            startTime: '',
            endTime: '',
            purpose: '',
            attendeeCount: 1
        },
        showBookingModal: false,
        submittingBooking: false,
        apiBaseUrl: 'https://www.cacophonyem.me/meeting',
        statusBarHeight: 0,

        // 日期选择相关
        selectedDate: '',
        selectedDateWithWeekday: '', // 带有周几信息的日期显示
        minDate: '',
        maxDate: '',

        // 时间段相关 - 新增两层级时段选择
        timePeriods: [], // 时段分组数组（上午、中午、下午）
        timeSlots: [], // 详细时间段数组
        selectedPeriod: null, // 当前选中的时段（morning/noon/afternoon）
        expandedPeriod: null, // 当前展开的时段
        selectedTimeSlot: null, // 当前选中的时间段对象
        selectedStartIndex: -1, // 选中的开始时间段索引
        selectedEndIndex: -1, // 选中的结束时间段索引

        // 预约表单
        bookingForm: {
            topic: '',
            contactName: '',
            contactPhone: '',
            attendeesCount: 1,
            requirements: ''
        },

        // 页面状态
        imageLoading: true,
        imageError: false,
        selectedTimeText: '',
        wholePeriodBooking: null, // 整时段预约信息
    },

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad(options) {
        const roomId = options.roomId || options.id;
        if (!roomId) {
            wx.showToast({ title: '房间ID缺失', icon: 'none' });
            wx.navigateBack();
            return;
        }

        this.setData({ roomId });
        this.getUserOpenId();
        this.initializePage();
    },

    /**
     * 安全获取App数据，避免getApp()返回undefined
     */
    safeGetAppData() {
        try {
            const app = getApp();

            if (app && app.globalData) {
                this.setData({
                    apiBaseUrl: app.globalData.apiBaseUrl || 'https://www.cacophonyem.me/meeting'
                });
                console.log('✅ 成功获取App全局数据');

                // 获取用户openid
                this.getUserOpenId();

                // 初始化页面数据
                this.initializePage();
            } else {
                console.warn('⚠️ App实例未就绪，使用默认配置');
                this.setData({
                    apiBaseUrl: 'https://www.cacophonyem.me/meeting'
                });

                // 延迟重试获取用户数据
                setTimeout(() => {
                    this.safeGetAppData();
                }, 500);
            }
        } catch (error) {
            console.error('❌ 获取App数据失败:', error);

            // 使用默认配置
            this.setData({
                apiBaseUrl: 'https://www.cacophonyem.me/meeting'
            });

            // 延迟重试
            setTimeout(() => {
                this.safeGetAppData();
            }, 1000);
        }
    },

    /**
     * 初始化页面数据
     */
    async initializePage() {
        await this.fetchRoomDetails();
        this.initializeDates();
    },

    /**
     * 获取用户openid
     */
    getUserOpenId() {
        const app = getApp();
        if (app && app.globalData && app.globalData.userInfo && app.globalData.userInfo.openid) {
            this.setData({ userOpenId: app.globalData.userInfo.openid });
        } else {
            const userInfo = wx.getStorageSync('userInfo');
            if (userInfo && userInfo.openid) {
                this.setData({ userOpenId: userInfo.openid });
            }
        }
    },

    /**
     * 获取会议室详情
     */
    async fetchRoomDetails() {
        try {
            const result = await this.requestAPI('GET', `/api/rooms/${this.data.roomId}`);
            if (result.success) {
                this.setData({
                    roomDetails: result.data,
                    loading: false
                });
            }
        } catch (error) {
            wx.showToast({ title: '获取房间信息失败', icon: 'none' });
        }
    },

    /**
     * 初始化日期数据
     */
    initializeDates() {
        const today = new Date();
        const maxDate = new Date();
        maxDate.setDate(today.getDate() + 30);

        this.setData({
            selectedDate: this.formatDate(today),
            selectedDateWithWeekday: this.formatDateWithWeekday(today),
            minDate: this.formatDate(today),
            maxDate: this.formatDate(maxDate)
        });

        this.fetchRoomAvailability(this.formatDate(today));
    },

    /**
     * 格式化日期为YYYY-MM-DD格式
     */
    formatDate(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    },

    /**
     * 格式化日期为YYYY-MM-DD格式，并添加周几信息
     */
    formatDateWithWeekday(date) {
        const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        return `${this.formatDate(date)} ${weekdays[date.getDay()]}`;
    },

    /**
     * 获取会议室指定日期的可用性
     */
    async fetchRoomAvailability(date) {
        try {
            const result = await this.requestAPI('GET', `/api/rooms/${this.data.roomId}/availability?date=${date}`);
            if (result.success) {
                const timeSlots = this.generateTimeSlotsArray();
                const timePeriods = this.generateTimePeriodsArray();

                // 处理已预约时间
                if (result.data && result.data.timeSlots) {
                    result.data.timeSlots.forEach(slot => {
                        if (slot.status === 'booked') {
                            const index = timeSlots.findIndex(ts => ts.time === slot.startTime);
                            if (index !== -1) timeSlots[index].status = 'booked';
                        }
                    });
                }

                this.updatePeriodAvailability(timePeriods, timeSlots);
                this.setData({ timeSlots, timePeriods });
            }
        } catch (error) {
            wx.showToast({ title: '获取时间段失败', icon: 'none' });
        }
    },

    /**
     * 生成时间段数组 - 按时间段分组，每30分钟一个时间槽
     * 上午：08:30-12:00、中午：12:00-14:30、下午：14:30-22:00
     */
    generateTimeSlotsArray() {
        const timeSlots = [];
        let index = 0;

        // 上午 08:30-12:00
        for (let h = 8; h < 12; h++) {
            for (let m = (h === 8 ? 30 : 0); m < 60; m += 30) {
                if (h === 11 && m > 30) break;
                timeSlots.push({
                    time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
                    status: 'available',
                    isSelected: false,
                    index: index++,
                    period: 'morning'
                });
            }
        }

        // 中午 12:30-14:30
        for (let h = 12; h <= 14; h++) {
            for (let m = (h === 12 ? 30 : 0); m < 60; m += 30) {
                if (h === 14 && m > 30) break;
                timeSlots.push({
                    time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
                    status: 'available',
                    isSelected: false,
                    index: index++,
                    period: 'noon'
                });
            }
        }

        // 下午 15:00-22:00
        for (let h = 15; h <= 22; h++) {
            for (let m = 0; m < 60; m += 30) {
                if (h === 22 && m > 0) break;
                timeSlots.push({
                    time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
                    status: 'available',
                    isSelected: false,
                    index: index++,
                    period: 'afternoon'
                });
            }
        }

        return timeSlots;
    },

    /**
     * 生成时段分组数组（上午、中午、下午）
     */
    generateTimePeriodsArray() {
        return [
            { id: 'morning', name: '上午时段', timeRange: '08:30 - 12:00', icon: '🌅', status: 'available', availableCount: 0, totalCount: 0 },
            { id: 'noon', name: '中午时段', timeRange: '12:00 - 14:30', icon: '☀️', status: 'available', availableCount: 0, totalCount: 0 },
            { id: 'afternoon', name: '下午时段', timeRange: '14:30 - 22:00', icon: '🌆', status: 'available', availableCount: 0, totalCount: 0 }
        ];
    },

    /**
     * 更新时段分组的可用性状态
     */
    updatePeriodAvailability(timePeriods, timeSlots) {
        timePeriods.forEach(period => {
            let periodSlots = [];
            if (period.id === 'morning') {
                periodSlots = timeSlots.filter(slot => slot.period === 'morning');
            } else if (period.id === 'noon') {
                periodSlots = timeSlots.filter(slot => slot.time === '12:00' || slot.period === 'noon');
            } else if (period.id === 'afternoon') {
                periodSlots = timeSlots.filter(slot => slot.time === '14:30' || slot.period === 'afternoon');
            }

            const totalCount = periodSlots.length;
            const availableCount = periodSlots.filter(slot => slot.status === 'available').length;

            period.totalCount = totalCount;
            period.availableCount = availableCount;
            period.status = availableCount === 0 ? 'unavailable' : availableCount < totalCount ? 'partial' : 'available';
        });
    },

    /**
     * 日期选择器变化事件
     */
    bindDateChange(e) {
        const selectedDate = e.detail.value;
        const selectedDateObj = new Date(selectedDate);
        this.setData({
            selectedDate,
            selectedDateWithWeekday: this.formatDateWithWeekday(selectedDateObj)
        });
        this.fetchRoomAvailability(selectedDate);
    },

    /**
     * 时段点击事件 - 选择或展开时段
     */
    onPeriodTap(e) {
        const periodId = e.currentTarget.dataset.period;
        const expandedPeriod = this.data.expandedPeriod === periodId ? null : periodId;
        this.setData({ expandedPeriod });
    },

    /**
     * 时间段点击事件 - 支持多时间槽选择（在展开的时段内）
     */
    onTimeSlotTap(e) {
        const index = parseInt(e.currentTarget.dataset.index);
        const timeSlot = this.data.timeSlots[index];

        if (timeSlot.status !== 'available') return;

        if (this.data.selectedStartIndex === -1) {
            this.setStartTime(index);
        } else if (this.data.selectedEndIndex === -1) {
            this.setEndTime(this.data.selectedStartIndex, index);
        } else {
            this.setStartTime(index);
        }
    },

    /**
     * 快速预约整个时段 - 预约完整的时段时间范围
     */
    onQuickBookPeriod(e) {
        e.stopPropagation();
        const periodId = e.currentTarget.dataset.period;
        const selectedPeriod = this.data.timePeriods.find(p => p.id === periodId);
        if (!selectedPeriod) return;
        this.bookWholePeriod(periodId, selectedPeriod);
    },

    /**
     * 预约整个时段
     */
    bookWholePeriod(periodId, selectedPeriod) {
        let startTime, endTime;

        if (periodId === 'morning') {
            startTime = '08:30';
            endTime = '12:00';
        } else if (periodId === 'noon') {
            startTime = '12:00';
            endTime = '14:30';
        } else if (periodId === 'afternoon') {
            startTime = '14:30';
            endTime = '22:00';
        }

        this.setData({
            wholePeriodBooking: { periodId, startTime, endTime, periodName: selectedPeriod.name },
            selectedStartIndex: -2,
            selectedEndIndex: -2
        });

        this.showBookingModal();
    },

    /**
     * 设置开始时间
     */
    setStartTime(startIndex) {
        const timeSlots = [...this.data.timeSlots];
        timeSlots.forEach(slot => slot.isSelected = false);
        timeSlots[startIndex].isSelected = true;

        this.setData({
            timeSlots,
            selectedStartIndex: startIndex,
            selectedEndIndex: -1,
            wholePeriodBooking: null
        });
    },

    /**
     * 设置结束时间并验证时间段连续性
     */
    setEndTime(startIndex, endIndex) {
        const timeSlots = [...this.data.timeSlots];
        timeSlots.forEach(slot => slot.isSelected = false);

        for (let i = startIndex; i <= endIndex; i++) {
            if (timeSlots[i].status !== 'available') {
                wx.showToast({ title: '选中时间段包含不可用时段', icon: 'none' });
                return;
            }
            timeSlots[i].isSelected = true;
        }

        this.setData({
            timeSlots,
            selectedEndIndex: endIndex,
            wholePeriodBooking: null
        });
    },

    /**
     * 表单输入事件
     */
    onFormInput(e) {
        const { field } = e.currentTarget.dataset;
        this.setData({
            [`bookingForm.${field}`]: e.detail.value
        });
    },

    /**
     * 显示预约弹窗
     */
    showBookingModal() {
        const { wholePeriodBooking } = this.data;
        let selectedTimeText = '';
        if (wholePeriodBooking) {
            selectedTimeText = `${wholePeriodBooking.startTime} - ${wholePeriodBooking.endTime} (整${wholePeriodBooking.periodName})`;
        }
        this.setData({ showBookingModal: true, selectedTimeText });
    },

    /**
     * 隐藏预约弹窗
     */
    hideBookingModal() {
        this.setData({ showBookingModal: false });
    },

    /**
     * 阻止弹窗关闭（点击弹窗内容区域）
     */
    preventClose() {},

    /**
     * 提交预约
     */
    async submitBooking() {
        const { wholePeriodBooking } = this.data;
        const { topic, contactName, contactPhone } = this.data.bookingForm;

        if (!topic || !topic.trim()) {
            wx.showToast({ title: '请输入会议主题', icon: 'none' });
            return;
        }
        if (!contactName || !contactName.trim()) {
            wx.showToast({ title: '请输入联系人', icon: 'none' });
            return;
        }
        if (!contactPhone || !contactPhone.trim()) {
            wx.showToast({ title: '请输入联系方式', icon: 'none' });
            return;
        }
        if (!/^1[3-9]\d{9}$/.test(contactPhone)) {
            wx.showToast({ title: '请输入正确的手机号', icon: 'none' });
            return;
        }

        const startTime = wholePeriodBooking.startTime;
        const endTime = wholePeriodBooking.endTime;

        const bookingData = {
            roomId: this.data.roomId,
            bookingDate: new Date(this.data.selectedDate).toISOString(),
            startTime,
            endTime,
            topic: topic.trim(),
            contactName: contactName.trim(),
            contactPhone: contactPhone.trim()
        };

        try {
            wx.showLoading({ title: '提交中...' });
            const result = await this.requestAPI('POST', '/api/bookings', bookingData);
            wx.hideLoading();

            if (result.success) {
                wx.showToast({ title: '预约成功', icon: 'success' });
                this.hideBookingModal();
                this.setData({
                    selectedStartIndex: -1,
                    selectedEndIndex: -1,
                    wholePeriodBooking: null,
                    bookingForm: { topic: '', contactName: '', contactPhone: '', attendeesCount: 1 }
                });
                this.fetchRoomAvailability(this.data.selectedDate);
            } else {
                throw new Error(result.message || '预约失败');
            }
        } catch (error) {
            wx.hideLoading();
            wx.showToast({ title: error.message || '预约失败，请重试', icon: 'none' });
        }
    },

    /**
     * 返回上一页
     */
    goBack() {
        wx.navigateBack();
    },

    /**
     * 通用API请求方法
     */
    async requestAPI(method, url, data = {}) {
        return new Promise((resolve, reject) => {
            wx.request({
                url: `${this.data.apiBaseUrl}${url}`,
                method,
                header: {
                    'Content-Type': 'application/json',
                    'X-User-Openid': this.data.userOpenId
                },
                data: method !== 'GET' ? data : undefined,
                success: (res) => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(res.data);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${res.data && res.data.message || 'Request failed'}`));
                    }
                },
                fail: (err) => {
                    reject(new Error(err.errMsg || '网络请求失败'));
                }
            });
        });
    }
});