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
        timePoints: [], // 时间点数组
        selectedPeriod: null, // 当前选中的时段（morning/noon/afternoon）
        expandedPeriod: null, // 当前展开的时段
        selectedTimeSlot: null, // 当前选中的时间段对象
        selectedStartIndex: -1, // 选中的开始时间段索引
        selectedEndIndex: -1, // 选中的结束时间段索引

        // 时间点分组数据
        morningTimePoints: [],
        noonTimePoints: [],
        afternoonTimePoints: [],

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

        // 获取状态栏高度并调试
        const systemInfo = wx.getSystemInfoSync();
        const statusBarHeight = systemInfo.statusBarHeight || 44;

        console.log('🔍 调试信息:');
        console.log('📱 完整系统信息:', systemInfo);
        console.log('📱 原始状态栏高度:', systemInfo.statusBarHeight);
        console.log('📱 最终状态栏高度:', statusBarHeight);
        console.log('📱 设备型号:', systemInfo.model);
        console.log('📱 系统:', systemInfo.system);

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

                // 将后端时间槽转换为时间点选择模式
                const timePoints = this.generateTimePointsFromSlots(result.data.timeSlots);
                const timeSlots = result.data.timeSlots.map((backendSlot, index) => ({
                    time: `${backendSlot.startTime} - ${backendSlot.endTime}`,
                    startTime: backendSlot.startTime,
                    endTime: backendSlot.endTime,
                    status: backendSlot.status,
                    period: backendSlot.period,
                    isSelected: false,
                    index: index
                }));

                console.log('🕐 转换后的前端时间槽:', timeSlots);

                // 生成时段分组（传入时间槽数据以动态计算时间范围）
                const timePeriods = this.generateTimePeriodsArray(timeSlots);

                // 更新时段可用性
                this.updatePeriodAvailability(timePeriods, timeSlots);

                // 清除原始状态缓存，确保数据是最新的
                this.originalPeriodStates = null;

                // 生成分组的时间点数据
                const groupedTimePoints = this.generateGroupedTimePoints(timePoints);

                // 重置选择状态
                this.setData({
                    timeSlots,
                    timePoints,
                    timePeriods,
                    morningTimePoints: groupedTimePoints.morning,
                    noonTimePoints: groupedTimePoints.noon,
                    afternoonTimePoints: groupedTimePoints.afternoon,
                    selectedStartIndex: -1,
                    selectedEndIndex: -1,
                    selectedStartTime: null,
                    selectedEndTime: null,
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
     * 从时间槽生成时间点选择列表
     * 将时间槽转换为用户可选择的时间点
     */
    generateTimePointsFromSlots(timeSlots) {
        const timePointsMap = new Map();

        // 从所有时间槽中提取时间点
        timeSlots.forEach(slot => {
            const startTime = slot.startTime;
            const endTime = slot.endTime;

            // 添加开始时间点
            if (!timePointsMap.has(startTime)) {
                timePointsMap.set(startTime, {
                    time: startTime,
                    period: slot.period,
                    isAvailable: slot.status === 'available',
                    isStart: false,
                    isEnd: false,
                    isSelected: false,
                    periods: [slot.period] // 记录该时间点属于哪些period
                });
            } else {
                // 如果该时间点已存在，更新可用性和period信息
                const existing = timePointsMap.get(startTime);
                existing.isAvailable = existing.isAvailable || slot.status === 'available';
                // 添加period到列表中（避免重复）
                if (!existing.periods.includes(slot.period)) {
                    existing.periods.push(slot.period);
                }
            }

            // 添加结束时间点 - 确保结束时间点的period正确
            if (!timePointsMap.has(endTime)) {
                // 对于结束时间点，需要确定它属于哪个period
                let endPeriods = [slot.period];

                // 特殊处理跨period的结束时间点 - 边界时间点属于多个period
                if (endTime === '12:00') {
                    endPeriods = ['morning', 'noon']; // 12:00既是上午结束也是中午开始
                } else if (endTime === '14:30') {
                    endPeriods = ['noon', 'afternoon']; // 14:30既是中午结束也是下午开始
                }

                timePointsMap.set(endTime, {
                    time: endTime,
                    period: endPeriods[0], // 主要period（向后兼容）
                    isAvailable: slot.status === 'available',
                    isStart: false,
                    isEnd: false,
                    isSelected: false,
                    periods: endPeriods // 记录该时间点属于哪些period
                });
            } else {
                const existing = timePointsMap.get(endTime);
                existing.isAvailable = existing.isAvailable || slot.status === 'available';
                // 添加period到列表中（避免重复）
                if (!existing.periods.includes(slot.period)) {
                    existing.periods.push(slot.period);
                }
            }
        });

        // 转换为数组并排序
        const timePoints = Array.from(timePointsMap.values()).sort((a, b) => {
            return a.time.localeCompare(b.time);
        });

        // 确保所有时间点都有 periods 字段
        timePoints.forEach(tp => {
            if (!tp.periods) {
                tp.periods = [tp.period];
            }
        });

        console.log('🕐 生成的时间点列表:', timePoints.length, '个');

        return timePoints;
    },

    /**
     * 生成分组的时间点数据
     */
    generateGroupedTimePoints(timePoints) {
        // 定义各时段的时间点
        const morningTimes = ['08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00'];
        const noonTimes = ['12:00', '12:30', '13:00', '13:30', '14:00', '14:30'];
        const afternoonTimes = ['14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00'];

        // 从时间槽数据创建时间点可用性映射
        const timeSlotAvailabilityMap = this.createTimePointAvailabilityFromSlots();

        // 生成各时段的时间点数据
        const generatePeriodPoints = (times) => {
            return times.map(time => ({
                time: time,
                isAvailable: timeSlotAvailabilityMap.get(time) !== false // 默认为可用，除非明确标记为不可用
            }));
        };

        const result = {
            morning: generatePeriodPoints(morningTimes),
            noon: generatePeriodPoints(noonTimes),
            afternoon: generatePeriodPoints(afternoonTimes)
        };

        console.log('🕐 生成的分组时间点数据:', result);
        console.log('🔍 时间槽可用性映射:', timeSlotAvailabilityMap);
        return result;
    },

    /**
     * 从时间槽数据创建时间点可用性映射
     * 逻辑：如果某个30分钟时间段（如09:00-09:30）已被预约，
     * 那么该时间段的开始时间点（09:00）不可选作为开始时间
     */
    createTimePointAvailabilityFromSlots() {
        const availabilityMap = new Map();
        const timeSlots = this.data.timeSlots || [];

        // 首先，所有时间点默认可用
        const allTimePoints = ['08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00',
            '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00',
            '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00',
            '20:30', '21:00', '21:30', '22:00'
        ];

        allTimePoints.forEach(time => {
            availabilityMap.set(time, true);
        });

        // 遍历所有时间槽，标记不可用的时间点
        timeSlots.forEach(slot => {
            const startTime = slot.startTime;
            const isAvailable = slot.status === 'available';

            // 如果时间槽不可用（已被预约、关闭或过期），那么其开始时间点不可选
            if (!isAvailable) {
                availabilityMap.set(startTime, false);
                console.log(`🚫 时间点 ${startTime} 不可选，因为时间段 ${slot.startTime}-${slot.endTime} 状态为 ${slot.status}`);
            }
        });

        return availabilityMap;
    },

    /**
     * 生成时段分组数组（上午、中午、下午）
     * 现在根据实际时间槽数据动态生成时间范围
     */
    generateTimePeriodsArray(timeSlots = []) {
        // 根据实际时间槽数据计算时间范围
        const getPeriodTimeRange = (periodId) => {
            const periodSlots = timeSlots.filter(slot => slot.period === periodId);

            if (periodSlots.length === 0) {
                // 如果没有时间槽数据，使用默认值
                const defaults = {
                    'morning': '08:30 - 12:00',
                    'noon': '12:00 - 14:30',
                    'afternoon': '14:30 - 22:00'
                };
                return defaults[periodId] || '08:30 - 22:00';
            }

            // 按开始时间排序确保顺序正确
            periodSlots.sort((a, b) => a.startTime.localeCompare(b.startTime));

            // 获取第一个和最后一个时间槽来确定时间范围
            const firstSlot = periodSlots[0];
            const lastSlot = periodSlots[periodSlots.length - 1];

            // 从slot.time中提取起始时间和结束时间
            const startTime = firstSlot.startTime || firstSlot.time.split(' - ')[0];
            const endTime = lastSlot.endTime || lastSlot.time.split(' - ')[1];

            return `${startTime} - ${endTime}`;
        };

        // 计算全天时间范围
        const getFullDayTimeRange = () => {
            if (timeSlots.length === 0) return '08:30 - 22:00';

            const firstSlot = timeSlots[0];
            const lastSlot = timeSlots[timeSlots.length - 1];

            const startTime = firstSlot.startTime || firstSlot.time.split(' - ')[0];
            const endTime = lastSlot.endTime || lastSlot.time.split(' - ')[1];

            return `${startTime} - ${endTime}`;
        };

        return [
            { id: 'fullday', name: '全天', timeRange: getFullDayTimeRange(), icon: '🌍', status: 'available', availableCount: 0, totalCount: 0, isFullDay: true },
            { id: 'morning', name: '上午时段', timeRange: getPeriodTimeRange('morning'), icon: '🌅', status: 'available', availableCount: 0, totalCount: 0 },
            { id: 'noon', name: '中午时段', timeRange: getPeriodTimeRange('noon'), icon: '☀️', status: 'available', availableCount: 0, totalCount: 0 },
            { id: 'afternoon', name: '下午时段', timeRange: getPeriodTimeRange('afternoon'), icon: '🌆', status: 'available', availableCount: 0, totalCount: 0 }
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
     * 时间点点击事件 - 用户选择开始或结束时间点
     */
    onTimePointTap(e) {
        const timePoint = e.currentTarget.dataset.time;

        // 从分组时间点数据中查找该时间点的可用性
        const timePointData = this.findTimePointInGroupedData(timePoint);

        console.log(`🔍 点击时间点 ${timePoint}，可用性:`, timePointData);

        if (!timePointData || !timePointData.isAvailable) {
            wx.showToast({ title: '该时间点不可选择', icon: 'none' });
            return;
        }

        const { selectedStartTime, selectedEndTime } = this.data;

        // 如果点击的是已选择的开始或结束时间，则取消选择
        if (timePoint === selectedStartTime) {
            this.clearTimeSelection();
            wx.showToast({
                title: '已取消选择',
                icon: 'none',
                duration: 1000
            });
            return;
        }

        if (timePoint === selectedEndTime) {
            this.setData({
                selectedEndTime: '',
                selectedTimeText: ''
            });
            wx.showToast({
                title: '已取消结束时间选择',
                icon: 'none',
                duration: 1000
            });
            return;
        }

        if (!selectedStartTime) {
            // 第一步：选择开始时间
            this.setStartTimePoint(timePoint);
            wx.showToast({
                title: '已选择开始时间，请选择结束时间',
                icon: 'none',
                duration: 1500
            });
        } else if (!selectedEndTime) {
            // 第二步：选择结束时间，加入验证逻辑
            const validation = this.validateTimeSelection(selectedStartTime, timePoint);
            if (!validation.valid) {
                wx.showToast({ title: validation.message, icon: 'none' });
                return;
            }

            // 显示警告信息（如果有）
            if (validation.warning) {
                wx.showModal({
                    title: '预约提醒',
                    content: validation.warning,
                    showCancel: true,
                    confirmText: '继续预约',
                    cancelText: '重新选择',
                    success: (res) => {
                        if (res.confirm) {
                            this.setEndTimePoint(timePoint);
                        }
                    }
                });
            } else {
                this.setEndTimePoint(timePoint);
            }
        } else {
            // 第三步：重新选择（清空当前选择，重新开始）
            this.clearTimeSelection();
            this.setStartTimePoint(timePoint);
            wx.showToast({
                title: '重新选择，请选择结束时间',
                icon: 'none',
                duration: 1500
            });
        }
    },

    /**
     * 验证时间选择的有效性
     * 新逻辑：用户只能选择30分钟间隔的时间点，且不能跨越已被预约的时间段
     */
    validateTimeSelection(startTime, endTime) {
        const startMinutes = this.timeToMinutes(startTime);
        const endMinutes = this.timeToMinutes(endTime);

        // 检查结束时间是否晚于开始时间
        if (endMinutes <= startMinutes) {
            return { valid: false, message: '结束时间必须晚于开始时间' };
        }

        // 检查时间间隔是否为30分钟的倍数
        const duration = endMinutes - startMinutes;
        if (duration % 30 !== 0) {
            return { valid: false, message: '预约时间必须为30分钟的倍数' };
        }

        // 检查最小预约时长（至少30分钟）
        if (duration < 30) {
            return { valid: false, message: '预约时长不能少于30分钟' };
        }

        // 检查选择的时间范围内所有30分钟时间段是否都可用
        const unavailableSlots = this.checkUnavailableSlotsInRange(startTime, endTime);
        if (unavailableSlots.length > 0) {
            return {
                valid: false,
                message: `时间范围内有已被预约的时间段: ${unavailableSlots.join(', ')}，请重新选择`
            };
        }

        // 建议预约时长至少1小时
        if (duration < 60) {
            return {
                valid: true,
                warning: `当前预约时长为${duration}分钟，建议预约时长至少1小时以获得更好的会议体验。是否继续？`
            };
        }

        return { valid: true };
    },

    /**
     * 检查时间范围内是否有不可用的30分钟时间段
     * 逻辑：检查从开始时间到结束时间之间的所有30分钟时间段是否都可用
     */
    checkUnavailableSlotsInRange(startTime, endTime) {
        const startMinutes = this.timeToMinutes(startTime);
        const endMinutes = this.timeToMinutes(endTime);
        const unavailableSlots = [];
        const timeSlots = this.data.timeSlots || [];

        // 生成需要检查的时间段列表
        for (let currentMinutes = startMinutes; currentMinutes < endMinutes; currentMinutes += 30) {
            const currentTime = this.minutesToTime(currentMinutes);
            const nextTime = this.minutesToTime(currentMinutes + 30);
            const slotKey = `${currentTime}-${nextTime}`;

            // 查找对应的时间槽
            const slot = timeSlots.find(s => s.startTime === currentTime && s.endTime === nextTime);

            if (slot && slot.status !== 'available') {
                unavailableSlots.push(slotKey);
                console.log(`🚫 时间段 ${slotKey} 不可用，状态: ${slot.status}`);
            }
        }

        return unavailableSlots;
    },

    /**
     * 将分钟数转换为时间字符串
     */
    minutesToTime(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    },

    /**
     * 从分组时间点数据中查找指定时间点
     */
    findTimePointInGroupedData(targetTime) {
        const { morningTimePoints, noonTimePoints, afternoonTimePoints } = this.data;

        // 先查找上午时段
        let timePointData = morningTimePoints.find(tp => tp.time === targetTime);
        if (timePointData) {
            console.log(`🔍 在上午时段找到时间点 ${targetTime}:`, timePointData);
            return timePointData;
        }

        // 再查找中午时段
        timePointData = noonTimePoints.find(tp => tp.time === targetTime);
        if (timePointData) {
            console.log(`🔍 在中午时段找到时间点 ${targetTime}:`, timePointData);
            return timePointData;
        }

        // 最后查找下午时段
        timePointData = afternoonTimePoints.find(tp => tp.time === targetTime);
        if (timePointData) {
            console.log(`🔍 在下午时段找到时间点 ${targetTime}:`, timePointData);
            return timePointData;
        }

        console.log(`❌ 未找到时间点 ${targetTime}`);
        return null;
    },

    /**
     * 将时间字符串转换为分钟数
     */
    timeToMinutes(time) {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    },

    /**
     * 清空时间选择
     */
    clearTimeSelection() {
        // 重置所有时间点的选中状态
        this.setData({
            selectedStartTime: '',
            selectedEndTime: '',
            selectedTimeText: ''
        });
    },

    /**
     * 设置开始时间点
     */
    setStartTimePoint(startTime) {
        this.setData({
            selectedStartTime: startTime,
            selectedEndTime: ''
        });
    },

    /**
     * 设置结束时间点
     */
    setEndTimePoint(endTime) {
        const { selectedStartTime } = this.data;

        // 计算并格式化选中的时间文本
        const startMinutes = this.timeToMinutes(selectedStartTime);
        const endMinutes = this.timeToMinutes(endTime);
        const durationMinutes = endMinutes - startMinutes;
        const hours = Math.floor(durationMinutes / 60);
        const minutes = durationMinutes % 60;

        let durationText = '';
        if (hours > 0) {
            durationText += `${hours}小时`;
        }
        if (minutes > 0) {
            durationText += `${minutes}分钟`;
        }

        const selectedTimeText = `${selectedStartTime} - ${endTime} (${durationText})`;

        this.setData({
            selectedEndTime: endTime,
            selectedTimeText: selectedTimeText
        });
    },

    /**
     * 快速预约整个时段 - 预约完整的时段时间范围
     */
    onQuickBookPeriod(e) {
        const periodId = e.currentTarget.dataset.period;
        const selectedPeriod = this.data.timePeriods.find(p => p.id === periodId);
        if (!selectedPeriod) return;

        // 检查该时段是否可以整体预约
        if (!selectedPeriod.canBookWhole) {
            wx.showModal({
                title: '无法预约整时段',
                content: '该时段部分时间已被预约，无法预约整个时段。请选择具体的可用时间段进行预约。',
                showCancel: false,
                confirmText: '我知道了'
            });
            return;
        }

        // 根据时段ID设置开始和结束时间
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

        // 计算时长文本
        const startMinutes = this.timeToMinutes(startTime);
        const endMinutes = this.timeToMinutes(endTime);
        const durationMinutes = endMinutes - startMinutes;
        const hours = Math.floor(durationMinutes / 60);
        const minutes = durationMinutes % 60;

        let durationText = '';
        if (hours > 0) {
            durationText += `${hours}小时`;
        }
        if (minutes > 0) {
            durationText += `${minutes}分钟`;
        }

        // 设置整时段预约
        this.setData({
            selectedStartTime: startTime,
            selectedEndTime: endTime,
            selectedTimeText: `${startTime} - ${endTime} (${durationText})`,
            wholePeriodBooking: {
                periodId,
                startTime,
                endTime,
                periodName: selectedPeriod.name
            }
        });

        // 直接显示预约弹窗
        this.showBookingModal();
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
        const { wholePeriodBooking, selectedStartTime, selectedEndTime, selectedStartIndex, selectedEndIndex, timeSlots } = this.data;
        let selectedTimeText = '';

        if (wholePeriodBooking) {
            // 整时段预约
            selectedTimeText = `${wholePeriodBooking.startTime} - ${wholePeriodBooking.endTime} (整${wholePeriodBooking.periodName})`;
        } else if (selectedStartTime && selectedEndTime) {
            // 时间点选择模式
            selectedTimeText = `${selectedStartTime} - ${selectedEndTime}`;
        } else if (selectedStartIndex >= 0 && selectedEndIndex >= 0) {
            // 具体时间段预约 - 显示开始时间到结束时间（旧模式兼容）
            const startSlot = timeSlots[selectedStartIndex];
            const endSlot = timeSlots[selectedEndIndex];

            // 提取开始时间和结束时间
            const startTime = startSlot.startTime || startSlot.time.split(' - ')[0];
            const endTime = endSlot.endTime || endSlot.time.split(' - ')[1];

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
            selectedEndIndex: -1,
            selectedStartTime: '',
            selectedEndTime: '',
            selectedTimeText: '',
            expandedPeriod: null
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
        const { wholePeriodBooking, selectedStartTime, selectedEndTime, selectedStartIndex, selectedEndIndex, timeSlots } = this.data;
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

        // 处理三种预约方式
        if (wholePeriodBooking) {
            // 方式1: 整时段预约
            startTime = wholePeriodBooking.startTime;
            endTime = wholePeriodBooking.endTime;
        } else if (selectedStartTime && selectedEndTime) {
            // 方式2: 时间点选择预约（新UI）
            startTime = selectedStartTime;
            endTime = selectedEndTime;
        } else if (selectedStartIndex >= 0 && selectedEndIndex >= 0) {
            // 方式3: 具体时间段预约（旧UI兼容）
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
                    selectedStartTime: '',
                    selectedEndTime: '',
                    selectedTimeText: '',
                    wholePeriodBooking: null,
                    showBookingModal: false,
                    expandedPeriod: null,
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