// pages/roomDetail/roomDetail.js - 模块化重构版
const envConfig = require('../../config/env.js');
const WechatAuth = require('../../utils/auth.js');
const SUBSCRIBE_TEMPLATE_ID = envConfig.subscribeTemplateId;
const CANCEL_TEMPLATE_ID = envConfig.cancelTemplateId;

// 引入服务模块
const TimeService = require('./services/timeService.js');
const BookingService = require('./services/bookingService.js');
const { RoomService, PageManager, ScrollManager, ImageManager, StateManager } = require('./services/roomService.js');

Page({
    /**
     * 页面的初始数据
     */
    data: {
        id: null,
        roomDetails: {},
        loading: true,
        userInfo: null,
        userOpenId: '',
        // 描述/设备展开控制
        descExpanded: false,
        equipmentExpanded: false,
        equipmentPreviewCount: 6,
        // 时间选择面板
        showTimeSheet: false,
        activePeriod: 'morning',
        filteredTimePoints: [],
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

        // 时间段相关 - 新增两层级时段选择
        timePeriods: [], // 时段分组数组（上午、中午、下午）
        timeSlots: [], // 详细时间段数组
        timePoints: [], // 时间刻度点
        timeSlotLookup: {}, // 时间段查找表
        bookings: [],
        closures: [],
        selectedPeriod: null, // 当前选中的时段（morning/noon/afternoon）
        expandedPeriod: null, // 当前展开的时段
        selectedTimeSlot: null, // 当前选中的时间段对象
        selectedStartIndex: -1, // 选中的开始时间段索引
        selectedEndIndex: -1, // 选中的结束时间段索引
        timePresets: TimeService.getTimePresets(),

        // 预约表单
        bookingForm: {
            topic: '',
            contactName: '',
            contactPhone: '',
            attendeesCount: 1
        },

        autoFillStatus: 'idle',
        autoFillMessage: '',

        // 页面状态
        imageLoading: true,
        imageError: false,
        selectedTimeText: '',
        wholePeriodBooking: null, // 整时段预约信息
        isFullDayUnavailable: false, // 全天是否约满

        // 滚动位置管理
        scrollTop: 0,
        
        // 展开动画状态
        isExpanding: false,
    },

    /**
     * 生命周期函数--监听页面加载
     */
    async onLoad(options) {
        // 初始化页面状态
        if (!StateManager.initializePageState(this, options)) {
            return;
        }

        // 初始化页面管理器
        this.pageManager = new PageManager(this);
        this.scrollManager = new ScrollManager(this);

        // 获取用户openid
        const userOpenId = WechatAuth.getUserOpenId();
        this.setData({ userOpenId });

        const canProceed = await this.ensureUserProfileComplete();
        if (!canProceed) {
            this.setData({ loading: false });
            return;
        }
        
        this.initializePage();

        // 预加载用户信息
        this.preloadUserInfo();
    },

    /**
     * 切换描述展开/收起
     */
    toggleDescription() {
        this.setData({ descExpanded: !this.data.descExpanded });
    },

    /**
     * 切换设备展开/收起
     */
    toggleEquipment() {
        this.setData({ equipmentExpanded: !this.data.equipmentExpanded });
    },

    /**
     * 预加载用户信息
     */
    async preloadUserInfo() {
        try {
            const userInfo = await BookingService.autoFillUserInfo(this.data.userOpenId);
            
            if (userInfo) {
                this.setData({
                    'bookingForm.contactName': userInfo.contactName,
                    'bookingForm.contactPhone': userInfo.contactPhone
                });
                
                console.log('✅ 用户信息预加载成功:', userInfo.source);
            }
        } catch (error) {
            console.log('⚠️ 预加载用户信息失败:', error);
        }
    },

    /**
     * 检查用户资料是否完整
     */
    isUserProfileComplete(userInfo) {
        if (!userInfo) return false;
        const hasCompany = !!(userInfo.company && userInfo.company.trim());
        const hasName = !!(userInfo.contactName && userInfo.contactName.trim());
        const hasPhone = !!(userInfo.contactPhone && userInfo.contactPhone.trim());
        return hasCompany && hasName && hasPhone;
    },

    /**
     * 确保用户已经完善资料，否则强制跳转
     */
    async ensureUserProfileComplete() {
        try {
            const app = getApp();
            let userInfo = (app && app.globalData && app.globalData.userInfo) || null;

            if (!this.isUserProfileComplete(userInfo)) {
                const cachedUser = wx.getStorageSync('userInfo');
                if (cachedUser && cachedUser.openid) {
                    userInfo = cachedUser;
                }
            }

            if (!this.isUserProfileComplete(userInfo)) {
                const response = await BookingService.fetchUserProfile(this.data.userOpenId);
                if (response && response.success && response.data) {
                    userInfo = response.data;
                    if (app && app.globalData) {
                        app.globalData.userInfo = userInfo;
                    }
                    wx.setStorageSync('userInfo', userInfo);
                }
            }

            if (this.isUserProfileComplete(userInfo)) {
                this.setData({ userInfo });
                return true;
            }

            this.redirectToProfileCompletion();
            return false;
        } catch (error) {
            console.error('❌ 检查用户资料失败:', error);
            wx.showToast({
                title: '获取个人信息失败，请稍后重试',
                icon: 'none'
            });
            this.redirectToProfileCompletion();
            return false;
        }
    },

    /**
     * 跳转至资料完善页面
     */
    redirectToProfileCompletion() {
        try {
            wx.setStorageSync('profileCompletionRedirect', {
                source: 'roomDetail',
                timestamp: Date.now()
            });
        } catch (error) {
            console.warn('⚠️ 设置资料完善标记失败:', error);
        }

        wx.showModal({
            title: '请完善资料',
            content: '进入会议室详情前，请先填写公司、联系人和联系电话。',
            confirmText: '去完善',
            showCancel: false,
            success: () => {
                wx.switchTab({
                    url: '/pages/profile/profile',
                    fail: () => {
                        wx.navigateTo({ url: '/pages/profile/profile' });
                    }
                });
            }
        });
    },

    /**
     * 初始化页面数据
     */
    async initializePage() {
        await this.fetchRoomDetails();
        // 初始化选择今天的日期
        this.initializeDate();
    },

    /**
     * 初始化日期
     */
    initializeDate() {
        const today = new Date();
        const formattedDate = TimeService.formatDate(today);
        // 计算最大可预约日期（今天+15天）
        const maxDateObj = new Date();
        maxDateObj.setDate(maxDateObj.getDate() + 15);
        const maxDate = TimeService.formatDate(maxDateObj);
        this.setData({ selectedDate: formattedDate, maxAdvanceDate: maxDate, minDate: formattedDate });
        this.fetchRoomAvailability(formattedDate);
    },

    /**
     * 获取房间详情
     */
    async fetchRoomDetails() {
        try {
            this.setData({ loading: true });
            
            const rawDetails = await RoomService.fetchRoomDetails(this.data.id, this.data.userOpenId);

            // 生成显示所需的图片URL
            let displayImage = '/images/default_room.png';
            if (rawDetails && rawDetails.images && Array.isArray(rawDetails.images) && rawDetails.images.length > 0) {
                const imagePath = rawDetails.images[0];
                const base = this.data.apiBaseUrl || envConfig.apiBaseUrl;
                displayImage = imagePath && imagePath.startsWith('http') ? imagePath : `${base}${imagePath}`;
            }

            // 规范化ID字段，保证有 id 和 _id
            const normalizedDetails = { ...rawDetails };
            if (!normalizedDetails._id && normalizedDetails.id) normalizedDetails._id = normalizedDetails.id;
            if (!normalizedDetails.id && normalizedDetails._id) normalizedDetails.id = normalizedDetails._id;
            normalizedDetails.displayImage = displayImage;

            this.setData({
                roomDetails: normalizedDetails,
                loading: false
            });
        } catch (error) {
            console.error('❌ 获取房间详情失败:', error);
            this.setData({ loading: false });
            
            wx.showModal({
                title: '获取房间信息失败',
                content: '请检查网络连接后重试',
                showCancel: true,
                confirmText: '重试',
                cancelText: '返回',
                success: (res) => {
                    if (res.confirm) {
                        this.fetchRoomDetails();
                    } else {
                        wx.navigateBack();
                    }
                }
            });
        }
    },

    /**
     * 图片加载成功
     */
    onImageLoad() {
        ImageManager.onImageLoad(this);
    },

    /**
     * 图片加载失败
     */
    onImageError() {
        ImageManager.onImageError(this);
    },

    /**
     * 获取房间可用性
     */
    async fetchRoomAvailability(date) {
        try {
            console.log('🔍 获取房间可用性:', { id: this.data.id, date, userOpenId: this.data.userOpenId });
            
            const response = await TimeService.fetchRoomAvailability(this.data.id, date, this.data.userOpenId);
            
            const bookings = Array.isArray(response.bookings) ? response.bookings : [];
            const closures = Array.isArray(response.closures) ? response.closures : [];

            const normalizedSlots = (response.timeSlots || []).map((slot, index) => ({
                ...slot,
                originalIndex: typeof slot.originalIndex === 'number' ? slot.originalIndex : index
            }));

            let timePoints = TimeService.buildTimePoints(normalizedSlots, bookings, closures, date);
            const timeSlotLookup = TimeService.buildSlotLookup(bookings, closures);
            timePoints = TimeService.applyCurrentTimeRules(timePoints, date);
            const decoratedPoints = TimeService.markSelectedRange(timePoints, -1, -1);

            const derivedSlots = decoratedPoints.slice(0, Math.max(0, decoratedPoints.length - 1)).map((point, idx) => ({
                startTime: point.time,
                endTime: decoratedPoints[idx + 1] ? decoratedPoints[idx + 1].time : point.time,
                status: point.status,
                available: point.status === 'available'
            }));

            const timePeriods = TimeService.generateTimePeriodsArray();
            const updatedPeriods = TimeService.updatePeriodAvailability(timePeriods, derivedSlots);
            const presets = this.refreshPresetAvailability(TimeService.getTimePresets(), decoratedPoints, timeSlotLookup);
            
            this.setData({
                timeSlots: normalizedSlots,
                timePeriods: updatedPeriods,
                timePoints: decoratedPoints,
                timeSlotLookup,
                bookings,
                closures,
                filteredTimePoints: [],
                timePresets: presets,
                isFullDayUnavailable: decoratedPoints.every(point => point.status !== 'available')
            });
            
            console.log('✅ 房间可用性数据更新完成');
        } catch (error) {
            console.error('❌ 获取房间可用性失败:', error);
            wx.showToast({
                title: '获取时间段失败',
                icon: 'none'
            });
        }
    },

    /**
     * 日历日期变化
     */
    async onCalendarDateChange(e) {
        const raw = e.detail.date || e.detail.dateString;
        const selectedDate = raw;
        console.log('📅 日期选择变化:', selectedDate);

        // 前端限制：仅允许选择今天到15天内
        try {
            const min = this.data.minDate || TimeService.formatDate(new Date());
            const max = this.data.maxAdvanceDate;
            if (min && selectedDate < min) {
                wx.showToast({ title: '仅可预约今天及之后日期', icon: 'none' });
                return;
            }
            if (max && selectedDate > max) {
                wx.showToast({ title: '仅可预约未来15天内', icon: 'none' });
                return;
            }
        } catch (_) {}

        // 清除之前的选择状态
        this.setData({
            selectedDate,
            selectedTimeSlot: null,
            selectedStartIndex: -1,
            selectedEndIndex: -1,
            selectedTimeText: '',
            expandedPeriod: null,
            wholePeriodBooking: null,
            timePoints: [],
            timeSlotLookup: {},
            filteredTimePoints: []
        });

        // 获取新日期的可用性
        await this.fetchRoomAvailability(selectedDate);

        // 打开高级时间选择面板
        this.openTimeSheet();
    },

    /**
     * 打开时间选择面板
     */
    openTimeSheet() {
        // 选择第一个有可用时间段的时段作为默认选中
        const first = this.getFirstAvailablePeriodId();
        const period = first || 'morning';
        this.setData({
            activePeriod: period,
            showTimeSheet: true
        });
        this.updateFilteredSlots(period, this.data.timePoints);
        this.refreshPresetAvailability();
    },

    /**
     * 关闭时间选择面板
     */
    closeTimeSheet() {
        this.setData({ showTimeSheet: false });
    },

    /**
     * 计算第一个可用的时段
     */
    getFirstAvailablePeriodId() {
        const order = ['morning', 'noon', 'afternoon'];
        const periodRanges = {
            morning: { start: TimeService.timeToMinutes('08:30'), end: TimeService.timeToMinutes('12:00') },
            noon: { start: TimeService.timeToMinutes('12:00'), end: TimeService.timeToMinutes('14:30') },
            afternoon: { start: TimeService.timeToMinutes('14:30'), end: TimeService.timeToMinutes('22:00') }
        };

        const { timePoints = [], selectedDate } = this.data;
        const now = new Date();
        const today = TimeService.formatDate(now);
        const isSameDay = selectedDate === today;
        const currentMinutes = (now.getHours() * 60) + now.getMinutes();

        for (const id of order) {
            const range = periodRanges[id];
            if (!range) continue;

            const hasFuturePoint = (timePoints || []).some(point => {
                if (!point || point.status !== 'available') return false;
                if (point.minutes < range.start || point.minutes > range.end) return false;
                if (isSameDay && point.minutes <= currentMinutes) return false;
                return true;
            });

            if (hasFuturePoint) {
                return id;
            }
        }

        // 若当天全部未来时段都不可用，则退回第一个仍有可预约状态的时段
        const { timePeriods = [] } = this.data;
        for (const id of order) {
            const period = timePeriods.find(tp => tp.id === id);
            if (period && period.available && !period.fullyBooked) {
                return id;
            }
        }

        return order[0];
    },

    /**
     * 切换时段标签
     */
    onPeriodTabTap(e) {
        const periodId = e.currentTarget.dataset.periodId;
        this.setData({ activePeriod: periodId });
        this.updateFilteredSlots(periodId);
    },

    /**
     * 确认时间选择
     */
    onTimeConfirm() {
        if (this.data.selectedStartIndex >= 0 && this.data.selectedEndIndex >= 0) {
            this.closeTimeSheet();
            // 如果表单信息完整，直接提交；否则弹出预约信息填写
            if (this.canAutoSubmit()) {
                this.submitBooking();
            } else {
                this.showBookingModal();
            }
        } else {
            wx.showToast({ title: '请先选择时间段', icon: 'none' });
        }
    },

    /**
     * 判断是否可以自动提交预约（表单信息完整）
     */
    canAutoSubmit() {
        const form = this.data.bookingForm || {};
        const hasTopic = !!(form.topic && form.topic.trim());
        const hasName = !!(form.contactName && form.contactName.trim());
        const hasPhone = !!(form.contactPhone && /^1[3-9]\d{9}$/.test((form.contactPhone+'').trim()));
        const hasAttendees = !!(form.attendeesCount && form.attendeesCount > 0); // 确保参会人数存在且大于0
        return hasTopic && hasName && hasPhone && hasAttendees;
    },

    /**
     * 根据当前时段筛选可见的时间槽
     */
    updateFilteredSlots(periodId = this.data.activePeriod, points = this.data.timePoints) {
        try {
            const ranges = {
                morning: { start: '08:30', end: '12:00' },
                noon: { start: '12:00', end: '14:30' },
                afternoon: { start: '14:30', end: '22:00' }
            };
            const range = ranges[periodId] || ranges.morning;
            const startMinutes = TimeService.timeToMinutes(range.start);
            const endMinutes = TimeService.timeToMinutes(range.end);
            // 边界刻度（12:00、14:30）也保留，用于跨时段衔接；在前一时段显示占用，下一时段显示可选
            const boundaryNextPeriod = {
                '12:00': 'noon',
                '14:30': 'afternoon'
            };
            const boundaryPrevPeriod = {
                '12:00': 'morning',
                '14:30': 'noon'
            };

            const filtered = (points || [])
                // 边界点在两侧分栏都展示，但在下一时段用 boundaryEnd 将其显示为可选
                .filter(point => point && point.minutes >= startMinutes && point.minutes <= endMinutes)
                .map(point => {
                    const naturalPeriod = this.getPeriodIdByTime(point.time);
                    // 边界结束点归属前一个分栏，用于保持占用高亮
                    const owningPeriod = (point.boundaryEnd && point.status === 'booked')
                        ? (boundaryPrevPeriod[point.time] || naturalPeriod)
                        : naturalPeriod;
                    // 非所属分栏的镜像点：不继承“占用”高亮，只有作为下一分栏起点时显示可选
                    if (periodId !== owningPeriod) {
                        const isClosed = point.status === 'closed';
                        const nextPeriod = boundaryNextPeriod[point.time];
                        const isNext = nextPeriod && nextPeriod === periodId && point.boundaryEnd;
                        const status = isClosed ? 'closed' : (isNext ? 'available' : point.status);
                        return {
                            ...point,
                            status,
                            isDisabled: isClosed || point.isPastClient
                        };
                    }

                    let displayStatus = point.status;
                    const nextPeriod = boundaryNextPeriod[point.time];
                    if (nextPeriod && nextPeriod === periodId && point.boundaryEnd) {
                        // 边界在下一时段显示为可选
                        displayStatus = 'available';
                    }

                    return {
                        ...point,
                        status: displayStatus,
                        isDisabled: point.isPastClient || (displayStatus !== 'available' && displayStatus !== 'booked' && !(displayStatus === 'past' && !point.isPastClient))
                    };
                });
            this.setData({ filteredTimePoints: filtered });
        } catch (error) {
            console.error('筛选时间刻度失败:', error);
            this.setData({ filteredTimePoints: [] });
        }
    },

    /**
     * 根据时间判断所属分栏（上午/中午/下午）
     */
    getPeriodIdByTime(timeStr) {
        const m = TimeService.timeToMinutes(timeStr);
        if (m < TimeService.timeToMinutes('12:00')) return 'morning';
        if (m < TimeService.timeToMinutes('14:30')) return 'noon';
        return 'afternoon';
    },

    /**
     * 更新模板可用状态
     */
    refreshPresetAvailability(presets = this.data.timePresets, points = this.data.timePoints, slotLookup = this.data.timeSlotLookup) {
        const updated = (presets || []).map(preset => ({
            ...preset,
            disabled: !TimeService.isPresetAvailable(preset, points, slotLookup)
        }));

        if (presets === this.data.timePresets) {
            this.setData({ timePresets: updated });
        }

        return updated;
    },

    /**
     * 页面滚动事件
     */
    onScroll(e) {
        this.scrollManager.onScroll(e);
    },

    /**
     * 时段点击事件
     */
    onPeriodTap(e) {
        const periodId = e.currentTarget.dataset.periodId;
        const period = this.data.timePeriods.find(p => p.id === periodId);
        
        if (!period || !period.available) {
            return;
        }
        
        console.log('🎯 时段点击:', { periodId, period });
        
        // 切换展开状态
        const newExpandedPeriod = this.data.expandedPeriod === periodId ? null : periodId;
        
        this.setData({
            expandedPeriod: newExpandedPeriod,
            selectedPeriod: newExpandedPeriod ? periodId : null,
            isExpanding: true
        });
        
        // 重置动画状态
        this.pageManager.safeSetTimeout(() => {
            this.setData({ isExpanding: false });
        }, 300);
    },

    /**
     * 时间段点击事件
     */
    onTimeSlotTap(e) {
        const { index } = e.currentTarget.dataset;
        const result = TimeService.handlePointSelection({
            currentStart: this.data.selectedStartIndex,
            currentEnd: this.data.selectedEndIndex,
            pointIndex: index,
            points: this.data.timePoints,
            slotLookup: this.data.timeSlotLookup
        });

        if (!result.success) {
            if (result.error) {
                wx.showToast({ title: result.error, icon: 'none' });
            }
            return;
        }

        // 如果仅选了开始时间，自动切换到该开始时间所属分栏
        if (result.selectedStartIndex >= 0 && result.selectedEndIndex === -1) {
            const startTime = result.timePoints[result.selectedStartIndex]?.time;
            const newPeriod = startTime ? this.getPeriodIdByTime(startTime) : this.data.activePeriod;
            this.setData({
                activePeriod: newPeriod,
                selectedStartIndex: result.selectedStartIndex,
                selectedEndIndex: result.selectedEndIndex,
                timePoints: result.timePoints,
                selectedTimeSlot: result.selectedTimeSlot,
                selectedTimeText: result.selectedTimeText
            });
            this.updateFilteredSlots(newPeriod, result.timePoints);
        } else {
            this.setData({
                selectedStartIndex: result.selectedStartIndex,
                selectedEndIndex: result.selectedEndIndex,
                timePoints: result.timePoints,
                selectedTimeSlot: result.selectedTimeSlot,
                selectedTimeText: result.selectedTimeText
            });
            this.updateFilteredSlots(this.data.activePeriod, result.timePoints);
        }

        this.refreshPresetAvailability(this.data.timePresets, result.timePoints, this.data.timeSlotLookup);
    },

    /**
     * 模板时间段快捷选择
     */
    onPresetTap(e) {
        const { start, end } = e.currentTarget.dataset;
        const preset = (this.data.timePresets || []).find(item => item.startTime === start && item.endTime === end);

        if (!preset || preset.disabled) {
            wx.showToast({ title: '该时间模板暂不可用', icon: 'none' });
            return;
        }

        const result = TimeService.applyPresetSelection(preset, this.data.timePoints, this.data.timeSlotLookup);
        if (!result.success) {
            wx.showToast({ title: result.error, icon: 'none' });
            return;
        }

        // 依据模板起点自动切换分栏
        const newPeriod = this.getPeriodIdByTime(preset.startTime);
        this.setData({
            activePeriod: newPeriod,
            selectedStartIndex: result.selectedStartIndex,
            selectedEndIndex: result.selectedEndIndex,
            timePoints: result.timePoints,
            selectedTimeSlot: result.selectedTimeSlot,
            selectedTimeText: result.selectedTimeText
        });

        this.updateFilteredSlots(newPeriod, result.timePoints);
        this.refreshPresetAvailability(this.data.timePresets, result.timePoints, this.data.timeSlotLookup);
    },

    /**
     * 快速预约整时段
     */
    async onQuickBookPeriod(e) {
        const periodId = e.currentTarget.dataset.periodId;
        const selectedPeriod = this.data.timePeriods.find(p => p.id === periodId);
        
        if (!selectedPeriod || !selectedPeriod.canBookWholePeriod) {
            wx.showToast({
                title: '该时段无法整段预约',
                icon: 'none'
            });
            return;
        }
        
        console.log('🚀 快速预约整时段:', { periodId, selectedPeriod });
        
        // 检查表单是否已填写
        if (!this.data.bookingForm.topic || !this.data.bookingForm.contactName || !this.data.bookingForm.contactPhone) {
            // 显示预约弹窗让用户填写信息
            this.setData({
                wholePeriodBooking: { periodId, selectedPeriod },
                showBookingModal: true
            });
            
            // 更新全天预约状态的UI
            const updateResult = TimeService.updatePeriodsForFullDayBooking(this.data.timePeriods);
            this.setData(updateResult);
            
            return;
        }
        
        // 直接提交预约
        await this.submitWholePeriodBooking(periodId, selectedPeriod);
    },

    /**
     * 提交整时段预约
     */
    async submitWholePeriodBooking(periodId, selectedPeriod) {
        try {
            await BookingService.bookWholePeriod(
                periodId, 
                selectedPeriod, 
                this.data.bookingForm, 
                this.data.id, 
                this.data.selectedDate, 
                this.data.userOpenId
            );
            
            wx.showToast({
                title: '预约成功',
                icon: 'success'
            });
            
            // 刷新可用性数据
            this.fetchRoomAvailability(this.data.selectedDate);
            
        } catch (error) {
            console.error('❌ 整时段预约失败:', error);
            wx.showToast({
                title: error.message || '预约失败',
                icon: 'none'
            });
            
            // 恢复时段状态
            const restoreResult = TimeService.restorePeriodsAvailability(this.data.timeSlots);
            this.setData(restoreResult);
        }
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
        
        // 保存表单缓存
        BookingService.saveFormCache(this.data.bookingForm);
    },

    /**
     * 显示预约弹窗
     */
    showBookingModal() {
        if (!this.data.selectedTimeSlot) {
            wx.showToast({
                title: '请先选择时间段',
                icon: 'none'
            });
            return;
        }

        const cachedForm = BookingService.restoreFormCache();
        let formSnapshot = { ...this.data.bookingForm };

        if (cachedForm) {
            formSnapshot = {
                topic: cachedForm.topic || formSnapshot.topic,
                contactName: cachedForm.contactName || formSnapshot.contactName,
                contactPhone: cachedForm.contactPhone || formSnapshot.contactPhone,
                attendeesCount: cachedForm.attendeesCount || formSnapshot.attendeesCount
            };
        }

        const hasContact = !!(formSnapshot.contactName && formSnapshot.contactPhone);

        this.setData({
            bookingForm: formSnapshot,
            showBookingModal: true,
            autoFillStatus: hasContact ? 'cached' : 'loading',
            autoFillMessage: hasContact ? '已为你保留上次填写的联系人信息' : ''
        }, () => {
            if (!hasContact) {
                this.autoFillUserInfo();
            }
        });
    },

    /**
     * 自动填充用户信息
     */
    async autoFillUserInfo() {
        // 如果已有联系信息，不覆盖
        if (this.data.bookingForm.contactName && this.data.bookingForm.contactPhone) {
            if (this.data.autoFillStatus !== 'cached') {
                this.setData({
                    autoFillStatus: 'cached',
                    autoFillMessage: '已为你保留上次填写的联系人信息'
                });
            }
            return;
        }

        try {
            this.setData({ autoFillStatus: 'loading', autoFillMessage: '' });
            const userInfo = await BookingService.autoFillUserInfo(this.data.userOpenId);

            if (userInfo) {
                const sourceMessageMap = {
                    database: '已自动填充您的个人信息',
                    profile: '已同步企业通讯录中的联系人信息',
                    history: '已为你载入最近一次预约的联系人信息',
                    local: '已应用你上次保存的联系人信息'
                };

                const updatedForm = {
                    ...this.data.bookingForm,
                    contactName: userInfo.contactName || '',
                    contactPhone: userInfo.contactPhone || ''
                };

                this.setData({
                    bookingForm: updatedForm,
                    autoFillStatus: 'success',
                    autoFillMessage: sourceMessageMap[userInfo.source] || '已自动填充联系人信息'
                }, () => {
                    BookingService.saveFormCache(this.data.bookingForm);
                });

                console.log('✅ 自动填充用户信息成功:', userInfo.source);
            } else {
                this.setData({ autoFillStatus: 'empty', autoFillMessage: '' });
            }
        } catch (error) {
            console.log('⚠️ 自动填充用户信息失败:', error);
            this.setData({
                autoFillStatus: 'error',
                autoFillMessage: '暂时无法自动获取联系方式，请手动填写'
            });
        }
    },

    /**
     * 隐藏预约弹窗
     */
    hideBookingModal() {
        this.setData({
            showBookingModal: false,
            autoFillStatus: 'idle',
            autoFillMessage: ''
        });

        // 如果是整时段预约，恢复时段状态
        if (this.data.wholePeriodBooking) {
            const restoreResult = TimeService.restorePeriodsAvailability(this.data.timeSlots);
            this.setData(restoreResult);
        }
    },

    /**
     * 阻止弹窗关闭
     */
    preventClose() {},

    /**
     * 预约前订阅：每次提交都请求，确保本次有可用次数
     */
    async requestSubscribeTemplates() {
        try {
            const ids = [];
            if (SUBSCRIBE_TEMPLATE_ID) ids.push(SUBSCRIBE_TEMPLATE_ID);
            if (CANCEL_TEMPLATE_ID && CANCEL_TEMPLATE_ID !== SUBSCRIBE_TEMPLATE_ID) ids.push(CANCEL_TEMPLATE_ID);
            if (envConfig.reminderTemplateId) ids.push(envConfig.reminderTemplateId);
            const need = Array.from(new Set(ids));
            if (!need.length) return;

            const res = await wx.requestSubscribeMessage({ tmplIds: need });
            console.log('订阅授权结果', res);
        } catch (err) {
            console.log('订阅授权流程失败（忽略不中断）', err);
        }
    },

    /**
     * 提交预约
     */
    async submitBooking() {
        if (this.data.submittingBooking) {
            return;
        }
        
        this.setData({ submittingBooking: true });
        
        try {
            let bookingData;
            
            // 1. 请求订阅消息授权（仅首次提示，合并请求）
            await this.requestSubscribeTemplates();

            // 验证参会人数
            const attendeesCount = this.data.bookingForm.attendeesCount;
            if (!attendeesCount || isNaN(attendeesCount) || attendeesCount <= 0) {
                wx.showToast({
                    title: '请输入有效的参会人数',
                    icon: 'none'
                });
                this.setData({ submittingBooking: false });
                return;
            }

            if (this.data.wholePeriodBooking) {
                // 整时段预约
                const { periodId, selectedPeriod } = this.data.wholePeriodBooking;
                await this.submitWholePeriodBooking(periodId, selectedPeriod);
            } else {
                // 普通预约
                bookingData = {
                    roomId: this.data.id,
                    bookingDate: this.data.selectedDate,
                    startTime: this.data.selectedTimeSlot.startTime,
                    endTime: this.data.selectedTimeSlot.endTime,
                    topic: this.data.bookingForm.topic,
                    contactName: this.data.bookingForm.contactName,
                    contactPhone: this.data.bookingForm.contactPhone,
                    attendeesCount: attendeesCount // 使用验证后的参会人数
                };
                
                await BookingService.submitBooking(bookingData, this.data.userOpenId);
                
                wx.showToast({
                    title: '预约成功',
                    icon: 'success'
                });
            }
            
            // 保存用户信息
            BookingService.saveUserBookingInfo(
                this.data.bookingForm.contactName,
                this.data.bookingForm.contactPhone
            );

            BookingService.clearFormCache();

            // 隐藏弹窗
            this.hideBookingModal();
            
            // 刷新可用性数据
            this.pageManager.safeSetTimeout(() => {
                this.fetchRoomAvailability(this.data.selectedDate);
                const calendar = this.selectComponent('#bookingCalendar');
                if (calendar && typeof calendar.refreshAvailability === 'function') {
                    calendar.refreshAvailability();
                }
            }, 500);
            
        } catch (error) {
            console.error('❌ 提交预约失败:', error);

            let errorMessage = '预约失败，请重试';
            if (error.message && error.message.includes('409')) {
                errorMessage = '该时间段已被预约，请选择其他时间';
            } else if (error.message) {
                errorMessage = error.message;
            }

            wx.showToast({
                title: errorMessage,
                icon: 'none',
                duration: 3000
            });
        } finally {
            this.setData({ submittingBooking: false });
        }
    },

    /**
     * 页面隐藏
     */
    onHide() {
        console.log('📱 页面隐藏');
        // 保存表单缓存
        BookingService.saveFormCache(this.data.bookingForm);
    },

    /**
     * 页面卸载
     */
    onUnload() {
        console.log('📱 页面卸载，清理资源');
        
        // 清理定时器
        if (this.pageManager) {
            this.pageManager.clearAllTimers();
        }
        
        // 清理数据对象
        if (this.pageManager) {
            this.pageManager.clearDataObjects();
        }
        
        // 清除表单缓存
        BookingService.clearFormCache();
    },

    /**
     * 返回上一页
     */
    goBack() {
        wx.navigateBack();
    }
});
