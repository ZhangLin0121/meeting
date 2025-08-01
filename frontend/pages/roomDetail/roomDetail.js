// pages/roomDetail/roomDetail.js - 模块化重构版
const envConfig = require('../../config/env.js');
const WechatAuth = require('../../utils/auth.js');

// 引入服务模块
const TimeService = require('./services/timeService.js');
const BookingService = require('./services/bookingService.js');
const { RoomService, PageManager, ScrollManager, ImageManager, StateManager } = require('./services/roomService.js');

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

        // 滚动位置管理
        scrollTop: 0,
        
        // 展开动画状态
        isExpanding: false,
    },

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad(options) {
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
        
        this.initializePage();

        // 预加载用户信息
        this.preloadUserInfo();
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
        this.setData({ selectedDate: formattedDate });
        this.fetchRoomAvailability(formattedDate);
    },

    /**
     * 获取房间详情
     */
    async fetchRoomDetails() {
        try {
            this.setData({ loading: true });
            
            const roomDetails = await RoomService.fetchRoomDetails(this.data.roomId, this.data.userOpenId);
            
            this.setData({
                roomDetails,
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
            console.log('🔍 获取房间可用性:', { roomId: this.data.roomId, date, userOpenId: this.data.userOpenId });
            
            const response = await TimeService.fetchRoomAvailability(this.data.roomId, date, this.data.userOpenId);
            
            const timePeriods = TimeService.generateTimePeriodsArray();
            const updatedPeriods = TimeService.updatePeriodAvailability(timePeriods, response.timeSlots);
            
            this.setData({
                timeSlots: response.timeSlots,
                timePeriods: updatedPeriods,
                isFullDayUnavailable: response.timeSlots.every(slot => !slot.available)
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
    onCalendarDateChange(e) {
        const selectedDate = e.detail.dateString;
        console.log('📅 日期选择变化:', selectedDate);
        
        // 清除之前的选择状态
        this.setData({
            selectedDate,
            selectedTimeSlot: null,
            selectedStartIndex: -1,
            selectedEndIndex: -1,
            selectedTimeText: '',
            expandedPeriod: null,
            wholePeriodBooking: null
        });
        
        // 获取新日期的可用性
        this.fetchRoomAvailability(selectedDate);
        
        // 滚动到时间选择区域
        this.pageManager.safeSetTimeout(() => {
            this.scrollManager.scrollToTimeSlotsSmooth();
        }, 300);
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
        const timeSlot = this.data.timeSlots[index];
        
        if (!timeSlot.available) {
            return;
        }
        
        console.log('⏰ 时间段点击:', { index, timeSlot });
        
        if (this.data.selectedStartIndex === -1) {
            // 设置开始时间
            const result = TimeService.setStartTime(index, this.data.timeSlots);
            if (result.success) {
                this.setData(result);
            }
        } else if (this.data.selectedStartIndex === index) {
            // 取消选择
            this.setData({
                selectedStartIndex: -1,
                selectedEndIndex: -1,
                selectedTimeSlot: null,
                selectedTimeText: ''
            });
        } else {
            // 设置结束时间
            const result = TimeService.setEndTime(this.data.selectedStartIndex, index, this.data.timeSlots);
            if (result.success) {
                this.setData(result);
            } else {
                wx.showToast({
                    title: result.error,
                    icon: 'none'
                });
            }
        }
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
                this.data.roomId, 
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
        
        // 恢复表单缓存
        const cachedForm = BookingService.restoreFormCache();
        if (cachedForm) {
            this.setData({
                bookingForm: {
                    topic: cachedForm.topic || this.data.bookingForm.topic,
                    contactName: cachedForm.contactName || this.data.bookingForm.contactName,
                    contactPhone: cachedForm.contactPhone || this.data.bookingForm.contactPhone,
                    attendeesCount: cachedForm.attendeesCount || this.data.bookingForm.attendeesCount,
                    requirements: cachedForm.requirements || this.data.bookingForm.requirements
                }
            });
        }
        
        this.setData({ showBookingModal: true });
        
        // 自动填充用户信息
        this.autoFillUserInfo();
    },

    /**
     * 自动填充用户信息
     */
    async autoFillUserInfo() {
        // 如果已有联系信息，不覆盖
        if (this.data.bookingForm.contactName && this.data.bookingForm.contactPhone) {
            return;
        }
        
        try {
            const userInfo = await BookingService.autoFillUserInfo(this.data.userOpenId);
            
            if (userInfo) {
                this.setData({
                    'bookingForm.contactName': userInfo.contactName,
                    'bookingForm.contactPhone': userInfo.contactPhone
                });
                
                console.log('✅ 自动填充用户信息成功:', userInfo.source);
            }
        } catch (error) {
            console.log('⚠️ 自动填充用户信息失败:', error);
        }
    },

    /**
     * 隐藏预约弹窗
     */
    hideBookingModal() {
        this.setData({ showBookingModal: false });
        
        // 如果是整时段预约，恢复时段状态
        if (this.data.wholePeriodBooking) {
            const restoreResult = TimeService.restorePeriodsAvailability(this.data.timeSlots);
            this.setData(restoreResult);
        }
        
        // 清除表单缓存
        this.pageManager.safeSetTimeout(() => {
            BookingService.clearFormCache();
        }, 100);
    },

    /**
     * 阻止弹窗关闭
     */
    preventClose() {},

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
            
            if (this.data.wholePeriodBooking) {
                // 整时段预约
                const { periodId, selectedPeriod } = this.data.wholePeriodBooking;
                await this.submitWholePeriodBooking(periodId, selectedPeriod);
            } else {
                // 普通预约
                bookingData = {
                    roomId: this.data.roomId,
                    selectedDate: this.data.selectedDate,
                    selectedTimeSlot: this.data.selectedTimeSlot,
                    bookingForm: this.data.bookingForm
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
            
            // 隐藏弹窗
            this.hideBookingModal();
            
            // 刷新可用性数据
            this.pageManager.safeSetTimeout(() => {
                this.fetchRoomAvailability(this.data.selectedDate);
            }, 500);
            
        } catch (error) {
            console.error('❌ 提交预约失败:', error);
            wx.showToast({
                title: error.message || '预约失败，请重试',
                icon: 'none'
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