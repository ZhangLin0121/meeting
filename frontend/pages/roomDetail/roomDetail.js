// pages/roomDetail/roomDetail.js
const request = require('../../utils/request.js');
const envConfig = require('../../config/env.js');

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
        apiBaseUrl: envConfig.apiBaseUrl,
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
        isFullDayUnavailable: false, // 全天是否约满
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

        // 获取状态栏高度并调试 - 使用新的API
        const windowInfo = wx.getWindowInfo();
        const statusBarHeight = windowInfo.statusBarHeight || 44;

        console.log('🔍 调试信息:');
        console.log('📱 窗口信息:', windowInfo);
        console.log('📱 原始状态栏高度:', windowInfo.statusBarHeight);
        console.log('📱 最终状态栏高度:', statusBarHeight);

        this.setData({
            roomId,
            statusBarHeight: statusBarHeight
        });

        // 延迟检查数据是否正确设置
        setTimeout(() => {
            console.log('✅ 页面数据中的状态栏高度:', this.data.statusBarHeight);
        }, 100);

        this.getUserOpenId();
        this.initializePage();

        // 预加载用户信息
        this.preloadUserInfo();
    },

    /**
     * 预加载用户信息
     */
    async preloadUserInfo() {
        try {
            // 优先从用户个人信息获取
            const userProfile = await this.fetchUserProfile();

            if (userProfile && userProfile.name && userProfile.phone) {
                console.log('✅ 预加载用户个人信息:', userProfile);

                this.setData({
                    'bookingForm.contactName': userProfile.name,
                    'bookingForm.contactPhone': userProfile.phone
                });

                // 同时更新本地缓存
                this.saveUserBookingInfo(userProfile.name, userProfile.phone);
                return;
            }
        } catch (error) {
            console.log('⚠️ 预加载用户个人信息失败:', error);
        }

        // 备用方案：从本地存储获取用户信息
        const savedUserInfo = wx.getStorageSync('userBookingInfo');

        if (savedUserInfo && savedUserInfo.contactName && savedUserInfo.contactPhone) {
            // 检查信息是否过期（30天）
            const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
            if (savedUserInfo.lastUpdated && savedUserInfo.lastUpdated > thirtyDaysAgo) {
                console.log('✅ 预加载本地存储用户信息:', savedUserInfo);

                this.setData({
                    'bookingForm.contactName': savedUserInfo.contactName,
                    'bookingForm.contactPhone': savedUserInfo.contactPhone
                });
            } else {
                // 信息过期，清除本地存储
                wx.removeStorageSync('userBookingInfo');
                console.log('⚠️ 用户信息已过期，已清除');
            }
        }
    },

    /**
     * 安全获取App数据，避免getApp()返回undefined
     */
    safeGetAppData() {
        try {
            const app = getApp();

            if (app && app.globalData) {
                this.setData({
                    apiBaseUrl: app.globalData.apiBaseUrl || envConfig.apiBaseUrl
                });
                console.log('✅ 成功获取App全局数据');

                // 获取用户openid
                this.getUserOpenId();

                // 初始化页面数据
                this.initializePage();
            } else {
                console.warn('⚠️ App实例未就绪，使用默认配置');
                this.setData({
                    apiBaseUrl: envConfig.apiBaseUrl
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
                apiBaseUrl: envConfig.apiBaseUrl
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
                // 处理图片路径
                const roomDetails = result.data;
                if (roomDetails.images && roomDetails.images.length > 0) {
                    // 检查图片路径是否已经是完整URL
                    if (roomDetails.images[0].startsWith('http')) {
                        roomDetails.displayImage = roomDetails.images[0];
                    } else {
                        roomDetails.displayImage = `${this.data.apiBaseUrl}${roomDetails.images[0]}`;
                    }
                } else {
                    roomDetails.displayImage = '/images/default_room.png';
                }

                console.log('✅ 会议室图片路径:', roomDetails.displayImage);

                this.setData({
                    roomDetails: roomDetails,
                    loading: false,
                    imageLoading: true,
                    imageError: false
                });
            }
        } catch (error) {
            console.error('❌ 获取会议室详情失败:', error);
            wx.showToast({ title: '获取房间信息失败', icon: 'none' });
            this.setData({
                loading: false,
                imageError: true
            });
        }
    },

    /**
     * 图片加载成功
     */
    onImageLoad() {
        console.log('✅ 图片加载成功');
        this.setData({
            imageLoading: false,
            imageError: false
        });
    },

    /**
     * 图片加载失败
     */
    onImageError() {
        console.error('❌ 图片加载失败');
        this.setData({
            imageLoading: false,
            imageError: true
        });
    },

    /**
     * 初始化日期数据
     */
    initializeDates() {
        const today = new Date();
        const maxDate = new Date();
        maxDate.setDate(today.getDate() + 30); // 1个月（30天）

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
            if (result.success && result.data && result.data.timeSlots) {
                console.log('🔍 后端返回的时间槽数据:', result.data.timeSlots);

                // 直接使用后端返回的时间槽数据，转换为前端需要的格式
                const timeSlots = result.data.timeSlots.map((backendSlot, index) => ({
                    time: backendSlot.startTime,
                    endTime: backendSlot.endTime,
                    status: backendSlot.status,
                    period: backendSlot.period,
                    isSelected: false,
                    index: index
                }));

                console.log('🕐 转换后的前端时间槽:', timeSlots);

                // 生成时段分组
                const timePeriods = this.generateTimePeriodsArray();

                // 更新时段可用性
                this.updatePeriodAvailability(timePeriods, timeSlots);

                // 清除原始状态缓存，确保数据是最新的
                this.originalPeriodStates = null;

                // 重置选择状态
                this.setData({
                    timeSlots,
                    timePeriods,
                    selectedStartIndex: -1,
                    selectedEndIndex: -1,
                    wholePeriodBooking: null,
                    expandedPeriod: null
                });

                console.log('📊 更新后的时段状态:', timePeriods.map(p => ({
                    name: p.name,
                    status: p.status,
                    availableCount: p.availableCount,
                    totalCount: p.totalCount,
                    canBookWhole: p.canBookWhole
                })));
            }
        } catch (error) {
            console.error('❌ 获取时间段失败:', error);
            wx.showToast({ title: '获取时间段失败', icon: 'none' });
        }
    },



    /**
     * 生成时段分组数组（上午、中午、下午）
     */
    generateTimePeriodsArray() {
        return [
            { id: 'fullday', name: '全天', timeRange: '08:30 - 22:00', icon: '🌍', status: 'available', availableCount: 0, totalCount: 0, isFullDay: true },
            { id: 'morning', name: '上午时段', timeRange: '08:30 - 12:00', icon: '🌅', status: 'available', availableCount: 0, totalCount: 0 },
            { id: 'noon', name: '中午时段', timeRange: '12:00 - 14:30', icon: '☀️', status: 'available', availableCount: 0, totalCount: 0 },
            { id: 'afternoon', name: '下午时段', timeRange: '14:30 - 22:00', icon: '🌆', status: 'available', availableCount: 0, totalCount: 0 }
        ];
    },

    /**
     * 更新时段分组的可用性状态
     */
    updatePeriodAvailability(timePeriods, timeSlots) {
        let isFullDayUnavailable = false;

        timePeriods.forEach(period => {
            let periodSlots = [];
            if (period.id === 'fullday') {
                // 全天包含所有时间槽
                periodSlots = timeSlots;
            } else if (period.id === 'morning') {
                periodSlots = timeSlots.filter(slot => slot.period === 'morning');
            } else if (period.id === 'noon') {
                periodSlots = timeSlots.filter(slot => slot.period === 'noon');
            } else if (period.id === 'afternoon') {
                periodSlots = timeSlots.filter(slot => slot.period === 'afternoon');
            }

            const totalCount = periodSlots.length;
            const availableCount = periodSlots.filter(slot => slot.status === 'available').length;

            period.totalCount = totalCount;
            period.availableCount = availableCount;
            period.status = availableCount === 0 ? 'unavailable' : availableCount < totalCount ? 'partial' : 'available';

            // 添加是否可以整体预约的标识
            // 只有当所有时间槽都是available状态时，才允许预约整个时段
            period.canBookWhole = availableCount > 0 && availableCount === totalCount;

            // 检查全天是否约满
            if (period.id === 'fullday' && period.status === 'unavailable') {
                isFullDayUnavailable = true;
            }
        });

        // 更新全天约满状态
        this.setData({
            isFullDayUnavailable
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

        // 全天预约不允许展开详细选择
        if (periodId === 'fullday') {
            return;
        }

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
     * 注意：WXML中使用catchtap绑定，会自动阻止事件冒泡
     */
    onQuickBookPeriod(e) {
        const periodId = e.currentTarget.dataset.period;
        const selectedPeriod = this.data.timePeriods.find(p => p.id === periodId);
        if (!selectedPeriod) return;

        // 检查该时段是否有部分时间已被占用
        if (this.isPeriodPartiallyBooked(periodId)) {
            wx.showModal({
                title: '无法预约整时段',
                content: '该时段部分时间已被预约，无法预约整个时段。请选择具体的可用时间段进行预约。',
                showCancel: false,
                confirmText: '我知道了'
            });
            return;
        }

        this.bookWholePeriod(periodId, selectedPeriod);
    },

    /**
     * 检查时段是否部分被预约
     */
    isPeriodPartiallyBooked(periodId) {
        const timeSlots = this.data.timeSlots;
        let periodSlots = [];

        // 根据时段ID找到对应的时间槽
        if (periodId === 'fullday') {
            // 全天包含所有时间槽
            periodSlots = timeSlots;
        } else if (periodId === 'morning') {
            periodSlots = timeSlots.filter(slot => {
                const time = slot.time;
                return time >= '08:30' && time < '12:00';
            });
        } else if (periodId === 'noon') {
            periodSlots = timeSlots.filter(slot => {
                const time = slot.time;
                return time >= '12:00' && time < '14:30';
            });
        } else if (periodId === 'afternoon') {
            periodSlots = timeSlots.filter(slot => {
                const time = slot.time;
                return time >= '14:30' && time < '22:00';
            });
        }

        if (periodSlots.length === 0) return false;

        // 检查是否有任何时间槽不是可用状态（包括已预约、已过期、临时关闭）
        const hasBookedSlots = periodSlots.some(slot => slot.status !== 'available');
        // 检查是否所有时间槽都不可用（如果全部不可用，说明整个时段都不可用，用户也不会看到预约按钮）
        const allSlotsUnavailable = periodSlots.every(slot => slot.status !== 'available');

        // 只有在部分可用、部分不可用的情况下才返回true（部分被占用）
        return hasBookedSlots && !allSlotsUnavailable;
    },

    /**
     * 预约整个时段
     */
    bookWholePeriod(periodId, selectedPeriod) {
        let startTime, endTime;

        if (periodId === 'fullday') {
            startTime = '08:30';
            endTime = '22:00';
        } else if (periodId === 'morning') {
            startTime = '08:30';
            endTime = '12:00';
        } else if (periodId === 'noon') {
            startTime = '12:00';
            endTime = '14:30';
        } else if (periodId === 'afternoon') {
            startTime = '14:30';
            endTime = '22:00';
        }

        // 如果是全天预约，需要更新其他时段的可用性显示
        if (periodId === 'fullday') {
            this.updatePeriodsForFullDayBooking();
        }

        this.setData({
            wholePeriodBooking: { periodId, startTime, endTime, periodName: selectedPeriod.name },
            selectedStartIndex: -2,
            selectedEndIndex: -2
        });

        this.showBookingModal();
    },

    /**
     * 更新时段显示 - 全天预约时其他时段应显示为不可用
     */
    updatePeriodsForFullDayBooking() {
        const timePeriods = [...this.data.timePeriods];

        // 保存原始状态，用于后续恢复
        if (!this.originalPeriodStates) {
            this.originalPeriodStates = timePeriods.map(period => ({
                id: period.id,
                availableCount: period.availableCount,
                status: period.status,
                canBookWhole: period.canBookWhole
            }));
        }

        timePeriods.forEach(period => {
            if (period.id !== 'fullday') {
                // 全天预约时，其他时段应显示为完全不可用
                period.availableCount = 0;
                period.status = 'unavailable';
                period.canBookWhole = false;
            }
        });

        this.setData({
            timePeriods,
            isFullDayUnavailable: true // 选择全天预约时，其他时段应该隐藏
        });
    },

    /**
     * 恢复时段可用性 - 取消全天预约时恢复正常显示
     */
    restorePeriodsAvailability() {
        if (this.originalPeriodStates) {
            const timePeriods = [...this.data.timePeriods];

            // 恢复原始状态
            timePeriods.forEach(period => {
                const originalState = this.originalPeriodStates.find(state => state.id === period.id);
                if (originalState && period.id !== 'fullday') {
                    period.availableCount = originalState.availableCount;
                    period.status = originalState.status;
                    period.canBookWhole = originalState.canBookWhole;
                }
            });

            this.setData({
                timePeriods,
                isFullDayUnavailable: false // 恢复其他时段显示
            });

            // 清除保存的原始状态
            this.originalPeriodStates = null;
        }
    },

    /**
     * 设置开始时间
     */
    setStartTime(startIndex) {
        const timeSlots = [...this.data.timeSlots];
        timeSlots.forEach(slot => slot.isSelected = false);
        timeSlots[startIndex].isSelected = true;

        // 如果之前有全天预约，现在选择具体时间段，需要恢复时段可用性
        if (this.data.wholePeriodBooking && this.data.wholePeriodBooking.periodId === 'fullday') {
            this.restorePeriodsAvailability();
        }

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
        const value = e.detail.value;

        this.setData({
            [`bookingForm.${field}`]: value
        });

        // 实时缓存表单数据
        this.saveFormCache();
    },

    /**
     * 保存表单缓存
     */
    saveFormCache() {
        try {
            const cacheData = {
                ...this.data.bookingForm,
                roomId: this.data.roomId,
                selectedDate: this.data.selectedDate,
                selectedTimeText: this.data.selectedTimeText,
                wholePeriodBooking: this.data.wholePeriodBooking,
                selectedStartIndex: this.data.selectedStartIndex,
                selectedEndIndex: this.data.selectedEndIndex,
                timestamp: Date.now()
            };

            wx.setStorageSync('bookingFormCache', cacheData);
            console.log('✅ 表单缓存已保存');
        } catch (error) {
            console.error('❌ 保存表单缓存失败:', error);
        }
    },

    /**
     * 恢复表单缓存
     */
    restoreFormCache() {
        try {
            const cacheData = wx.getStorageSync('bookingFormCache');

            if (cacheData && cacheData.roomId === this.data.roomId) {
                // 检查缓存是否过期（1小时）
                const oneHourAgo = Date.now() - (60 * 60 * 1000);
                if (cacheData.timestamp && cacheData.timestamp > oneHourAgo) {
                    console.log('✅ 恢复表单缓存:', cacheData);

                    // 只恢复表单数据，不恢复时间选择
                    this.setData({
                        'bookingForm.topic': cacheData.topic || '',
                        'bookingForm.attendeesCount': cacheData.attendeesCount || 1,
                        'bookingForm.requirements': cacheData.requirements || ''
                    });

                    // 显示恢复提示
                    if (cacheData.topic) {
                        wx.showToast({
                            title: '已恢复上次填写内容',
                            icon: 'success',
                            duration: 2000
                        });
                    }
                } else {
                    // 缓存过期，清除
                    wx.removeStorageSync('bookingFormCache');
                    console.log('⚠️ 表单缓存已过期，已清除');
                }
            }
        } catch (error) {
            console.error('❌ 恢复表单缓存失败:', error);
        }
    },

    /**
     * 清除表单缓存
     */
    clearFormCache() {
        try {
            wx.removeStorageSync('bookingFormCache');
            console.log('✅ 表单缓存已清除');
        } catch (error) {
            console.error('❌ 清除表单缓存失败:', error);
        }
    },

    /**
     * 显示预约弹窗
     */
    showBookingModal() {
        const { wholePeriodBooking, selectedStartIndex, selectedEndIndex, timeSlots } = this.data;
        let selectedTimeText = '';

        if (wholePeriodBooking) {
            // 整时段预约
            selectedTimeText = `${wholePeriodBooking.startTime} - ${wholePeriodBooking.endTime} (整${wholePeriodBooking.periodName})`;
        } else if (selectedStartIndex >= 0 && selectedEndIndex >= 0) {
            // 具体时间段预约
            const startTime = timeSlots[selectedStartIndex].time;
            const endTime = timeSlots[selectedEndIndex].time;
            selectedTimeText = `${startTime} - ${endTime}`;
        }

        // 恢复表单缓存
        this.restoreFormCache();

        // 自动填充用户信息
        this.autoFillUserInfo();

        this.setData({ showBookingModal: true, selectedTimeText });
    },

    /**
     * 自动填充用户信息
     */
    autoFillUserInfo() {
        const currentForm = this.data.bookingForm;

        // 如果表单已经有信息，不需要重复填充
        if (currentForm.contactName && currentForm.contactPhone) {
            console.log('✅ 表单已有用户信息，无需重复填充');
            return;
        }

        // 优先从用户个人信息中获取（与"我的"页面同步）
        this.fetchUserProfile().then(userProfile => {
            if (userProfile && userProfile.name && userProfile.phone) {
                console.log('✅ 从用户个人信息自动填充:', userProfile);

                const updatedForm = {
                    ...currentForm,
                    contactName: currentForm.contactName || userProfile.name,
                    contactPhone: currentForm.contactPhone || userProfile.phone
                };

                this.setData({
                    bookingForm: updatedForm
                });

                // 同时更新本地缓存
                this.saveUserBookingInfo(userProfile.name, userProfile.phone);
                return;
            }

            // 如果没有个人信息，尝试从本地存储获取
            this.fallbackToLocalStorage();
        }).catch(error => {
            console.log('⚠️ 获取用户个人信息失败，使用备用方案:', error);
            this.fallbackToLocalStorage();
        });
    },

    /**
     * 获取用户个人信息
     */
    async fetchUserProfile() {
        try {
            if (!this.data.userOpenId) {
                console.log('⚠️ 用户未登录，无法获取个人信息');
                return null;
            }

            // 先尝试从本地存储获取用户信息
            const localUserInfo = wx.getStorageSync('userInfo');
            if (localUserInfo && localUserInfo.contactName && localUserInfo.contactPhone) {
                console.log('✅ 从本地存储获取用户个人信息:', localUserInfo);
                return {
                    name: localUserInfo.contactName,
                    phone: localUserInfo.contactPhone
                };
            }

            // 如果本地没有，尝试从API获取
            const result = await this.requestAPI('GET', '/api/user/profile');

            if (result.success && result.data) {
                // 根据实际API返回的字段结构调整
                const userData = result.data;
                return {
                    name: userData.contactName || userData.name,
                    phone: userData.contactPhone || userData.phone
                };
            }

            return null;
        } catch (error) {
            console.log('⚠️ 获取用户个人信息失败:', error);
            return null;
        }
    },

    /**
     * 备用方案：从本地存储获取用户信息
     */
    fallbackToLocalStorage() {
        const currentForm = this.data.bookingForm;

        // 获取本地存储的用户信息
        const savedUserInfo = wx.getStorageSync('userBookingInfo');

        if (savedUserInfo && savedUserInfo.contactName && savedUserInfo.contactPhone) {
            // 检查信息是否过期（30天）
            const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
            if (savedUserInfo.lastUpdated && savedUserInfo.lastUpdated > thirtyDaysAgo) {
                console.log('✅ 从本地存储自动填充用户信息:', savedUserInfo);

                const updatedForm = {
                    ...currentForm,
                    contactName: currentForm.contactName || savedUserInfo.contactName,
                    contactPhone: currentForm.contactPhone || savedUserInfo.contactPhone
                };

                this.setData({
                    bookingForm: updatedForm
                });
            } else {
                // 信息过期，清除本地存储并尝试从历史预约获取
                wx.removeStorageSync('userBookingInfo');
                this.fetchUserBookingHistory();
            }
        } else {
            // 如果没有本地存储，尝试从用户的历史预约中获取
            this.fetchUserBookingHistory();
        }
    },

    /**
     * 获取用户历史预约信息
     */
    async fetchUserBookingHistory() {
        try {
            if (!this.data.userOpenId) {
                console.log('⚠️ 用户未登录，无法获取历史预约信息');
                return;
            }

            const result = await this.requestAPI('GET', '/api/bookings/user/recent');

            if (result.success && result.data && result.data.length > 0) {
                // 获取最近一次预约的联系信息
                const recentBooking = result.data[0];
                if (recentBooking.contactName && recentBooking.contactPhone) {
                    console.log('✅ 从历史预约获取用户信息:', {
                        contactName: recentBooking.contactName,
                        contactPhone: recentBooking.contactPhone
                    });

                    // 保存到本地存储
                    const userInfo = {
                        contactName: recentBooking.contactName,
                        contactPhone: recentBooking.contactPhone,
                        lastUpdated: Date.now()
                    };
                    wx.setStorageSync('userBookingInfo', userInfo);

                    // 填充到表单
                    const currentForm = this.data.bookingForm;
                    this.setData({
                        bookingForm: {
                            ...currentForm,
                            contactName: currentForm.contactName || recentBooking.contactName,
                            contactPhone: currentForm.contactPhone || recentBooking.contactPhone
                        }
                    });
                }
            }
        } catch (error) {
            console.log('⚠️ 获取用户历史预约信息失败:', error);
            // 不显示错误提示，因为这不是关键功能
        }
    },

    /**
     * 隐藏预约弹窗
     */
    hideBookingModal() {
        // 如果有内容，保存缓存
        if (this.data.bookingForm.topic) {
            this.saveFormCache();
        }

        // 如果有全天预约，关闭弹窗时恢复其他时段的可用性
        if (this.data.wholePeriodBooking && this.data.wholePeriodBooking.periodId === 'fullday') {
            this.restorePeriodsAvailability();
        }

        this.setData({
            showBookingModal: false,
            wholePeriodBooking: null,
            selectedStartIndex: -1,
            selectedEndIndex: -1
        });

        // 清除时间段选择状态
        const timeSlots = [...this.data.timeSlots];
        timeSlots.forEach(slot => slot.isSelected = false);
        this.setData({ timeSlots });
    },

    /**
     * 阻止弹窗关闭（点击弹窗内容区域）
     */
    preventClose() {},

    /**
     * 提交预约
     */
    async submitBooking() {
        const { wholePeriodBooking, selectedStartIndex, selectedEndIndex, timeSlots } = this.data;
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

        let startTime, endTime;

        // 处理两种预约方式
        if (wholePeriodBooking) {
            // 方式1: 整时段预约
            startTime = wholePeriodBooking.startTime;
            endTime = wholePeriodBooking.endTime;
        } else if (selectedStartIndex >= 0 && selectedEndIndex >= 0) {
            // 方式2: 具体时间段预约
            startTime = timeSlots[selectedStartIndex].time;

            // 结束时间需要加30分钟，因为预约是到结束时间点
            const endTimeSlot = timeSlots[selectedEndIndex];
            const [hours, minutes] = endTimeSlot.time.split(':').map(Number);

            let endHours = hours;
            let endMinutes = minutes + 30;

            if (endMinutes >= 60) {
                endHours += 1;
                endMinutes -= 60;
            }

            endTime = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
        } else {
            wx.showToast({ title: '请选择预约时段', icon: 'none' });
            return;
        }

        const bookingData = {
            roomId: this.data.roomId,
            bookingDate: new Date(this.data.selectedDate).toISOString(),
            startTime,
            endTime,
            topic: topic.trim(),
            contactName: contactName.trim(),
            contactPhone: contactPhone.trim()
        };

        console.log('📝 预约数据:', bookingData);

        try {
            wx.showLoading({ title: '提交中...' });
            const result = await this.requestAPI('POST', '/api/bookings', bookingData);
            wx.hideLoading();

            if (result.success) {
                // 保存用户信息到本地存储，供下次使用
                this.saveUserBookingInfo(contactName.trim(), contactPhone.trim());

                // 清除表单缓存
                this.clearFormCache();

                wx.showToast({ title: '预约成功', icon: 'success' });

                // 预约成功后，重置所有状态并刷新可用性
                this.setData({
                    selectedStartIndex: -1,
                    selectedEndIndex: -1,
                    wholePeriodBooking: null,
                    showBookingModal: false,
                    bookingForm: { topic: '', contactName: '', contactPhone: '', attendeesCount: 1 }
                });

                // 清除时间段选择状态
                const timeSlots = [...this.data.timeSlots];
                timeSlots.forEach(slot => slot.isSelected = false);
                this.setData({ timeSlots });

                // 重新获取房间可用性
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
     * 保存用户预约信息到本地存储
     */
    saveUserBookingInfo(contactName, contactPhone) {
        try {
            const userInfo = {
                contactName,
                contactPhone,
                lastUpdated: Date.now()
            };

            wx.setStorageSync('userBookingInfo', userInfo);
            console.log('✅ 用户信息已保存到本地存储:', userInfo);
        } catch (error) {
            console.error('❌ 保存用户信息失败:', error);
        }
    },

    /**
     * 页面隐藏时保存缓存
     */
    onHide() {
        // 如果弹窗打开且有内容，保存缓存
        if (this.data.showBookingModal && this.data.bookingForm.topic) {
            this.saveFormCache();
        }
    },

    /**
     * 页面卸载时保存缓存
     */
    onUnload() {
        // 如果有内容，保存缓存
        if (this.data.bookingForm.topic) {
            this.saveFormCache();
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