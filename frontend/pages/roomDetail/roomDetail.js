// pages/roomDetail/roomDetail.js
const request = require('../../utils/request.js');

Page({

    /**
     * 页面的初始数据
     */
    data: {
        roomId: null,
        room: null,
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
        apiBaseUrl: '',
        statusBarHeight: 0,

        // 日期选择相关
        selectedDate: '',
        selectedDateWithWeekday: '', // 带有周几信息的日期显示
        minDate: '',
        maxDate: '',

        // 时间段相关
        timeSlots: [], // 时间段数组
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
    },

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad(options) {
        console.log('会议室详情页面加载，参数:', options);

        // 安全获取房间ID
        const roomId = options.roomId || options.id;
        if (!roomId) {
            console.error('❌ 会议室ID缺失');
            wx.showToast({
                title: '会议室ID缺失',
                icon: 'none',
                duration: 2000
            });
            setTimeout(() => {
                wx.navigateBack();
            }, 2000);
            return;
        }

        this.setData({
            roomId: roomId
        });

        // 安全获取App数据
        this.safeGetAppData();

        // 获取系统信息
        this.getSystemInfo();
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
        if (this.data.roomId) {
            console.log('✅ 开始获取会议室详情:', this.data.roomId);

            // 并行获取会议室详情和用户联系人信息
            await Promise.all([
                this.fetchRoomDetails(),
                this.fetchUserContactInfo().catch(error => {
                    console.warn('⚠️ 获取用户联系人信息失败:', error);
                    // 不影响页面正常加载
                })
            ]);

            this.initializeDates();
        } else {
            console.error('❌ 房间ID缺失，无法初始化页面');
        }
    },

    /**
     * 获取用户openid
     */
    getUserOpenId() {
        try {
            // 先从全局数据获取
            const app = getApp();
            if (app && app.globalData && app.globalData.userInfo && app.globalData.userInfo.openid) {
                this.setData({
                    userOpenId: app.globalData.userInfo.openid
                });
                console.log('✅ 从全局数据获取用户openid:', app.globalData.userInfo.openid);
                return;
            }

            // 从本地存储获取
            const userInfo = wx.getStorageSync('userInfo');
            if (userInfo && userInfo.openid) {
                this.setData({
                    userOpenId: userInfo.openid
                });
                console.log('✅ 从本地存储获取用户openid:', userInfo.openid);
                return;
            }

            // 如果都没有，尝试重新登录
            console.log('⚠️ 未找到用户openid，尝试重新登录');
            if (app && app.forceLogin) {
                app.forceLogin().then(() => {
                    this.getUserOpenId();
                }).catch(error => {
                    console.error('强制登录失败:', error);
                });
            }
        } catch (error) {
            console.error('❌ 获取用户openid失败:', error);
            // 不影响页面正常加载，只是没有用户信息
        }
    },

    /**
     * 获取用户联系人信息
     */
    async fetchUserContactInfo() {
        try {
            if (!this.data.userOpenId) {
                console.log('⚠️ 用户未登录，跳过获取联系人信息');
                return;
            }

            console.log('👤 开始获取用户联系人信息...');

            const result = await this.requestAPI('GET', '/api/user/profile');

            if (result.success && result.data) {
                const { contactName, contactPhone } = result.data;

                if (contactName && contactPhone) {
                    console.log('✅ 获取用户联系人信息成功:', {
                        contactName,
                        contactPhone: contactPhone.substring(0, 3) + '****' + contactPhone.substring(7)
                    });

                    // 存储用户的联系人信息，但不立即填入表单
                    // 表单填入会在显示预订弹窗时进行
                    this.setData({
                        'bookingForm.contactName': contactName,
                        'bookingForm.contactPhone': contactPhone
                    });
                } else {
                    console.log('ℹ️ 用户尚未设置联系人信息');
                }
            }
        } catch (error) {
            console.error('❌ 获取用户联系人信息失败:', error);
            // 不抛出错误，避免影响页面正常加载
        }
    },

    /**
     * 生命周期函数--监听页面显示
     */
    async onShow() {
        if (this.data.roomId) {
            this.fetchRoomDetails();

            // 确保selectedDate已初始化，如果没有则初始化日期
            if (!this.data.selectedDate) {
                console.log('⚠️ selectedDate未初始化，先初始化日期');
                this.initializeDates();

                // 等待setData完成
                await new Promise(resolve => {
                    wx.nextTick(() => {
                        resolve();
                    });
                });
            }

            // 确保selectedDate有值后再获取可用性
            if (this.data.selectedDate) {
                this.fetchRoomAvailability(this.data.selectedDate);
            } else {
                // 如果还是没有，使用今天的日期作为默认值
                const today = new Date();
                const todayStr = this.formatDate(today);
                console.log('🔧 使用今天日期作为默认值:', todayStr);
                this.fetchRoomAvailability(todayStr);
            }
        }
    },

    /**
     * 获取系统信息
     */
    getSystemInfo() {
        try {
            const systemInfo = wx.getSystemInfoSync();
            this.setData({
                statusBarHeight: systemInfo.statusBarHeight || 20
            });
        } catch (error) {
            console.error('获取系统信息失败:', error);
            this.setData({
                statusBarHeight: 20
            });
        }
    },

    /**
     * 初始化日期数据
     */
    initializeDates() {
        const today = new Date();
        const maxDate = new Date(today);
        maxDate.setDate(today.getDate() + 3); // 修改为只能预约未来3天

        this.setData({
            selectedDate: this.formatDate(today),
            selectedDateWithWeekday: this.formatDateWithWeekday(today),
            minDate: this.formatDate(today),
            maxDate: this.formatDate(maxDate)
        });
    },

    /**
     * 格式化日期为YYYY-MM-DD格式
     */
    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    /**
     * 格式化日期为YYYY-MM-DD格式，并添加周几信息
     */
    formatDateWithWeekday(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const weekday = this.getWeekdayName(date.getDay());
        return `${year}-${month}-${day} (${weekday})`;
    },

    /**
     * 获取周几的中文名称
     */
    getWeekdayName(day) {
        const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        return weekdays[day];
    },

    /**
     * 检查日期是否为周末
     */
    isWeekend(dateString) {
        const date = new Date(dateString);
        const dayOfWeek = date.getDay();
        return dayOfWeek === 0 || dayOfWeek === 6; // 0是周日，6是周六
    },

    /**
     * 获取会议室详情
     */
    async fetchRoomDetails() {
        try {
            this.setData({ imageLoading: true });

            const result = await this.requestAPI('GET', `/api/rooms/${this.data.roomId}`);

            if (result.success && result.data) {
                // 处理图片路径
                const roomDetails = result.data;
                if (roomDetails.images && roomDetails.images.length > 0) {
                    roomDetails.displayImage = `${this.data.apiBaseUrl}${roomDetails.images[0]}`;
                } else {
                    roomDetails.displayImage = '/images/default_room.svg';
                }

                this.setData({
                    roomDetails: roomDetails,
                    loading: false
                });
            } else {
                throw new Error(result.message || '获取会议室详情失败');
            }
        } catch (error) {
            console.error('获取会议室详情失败:', error);
            this.setData({
                loading: false,
                roomDetails: null
            });

            wx.showToast({
                title: '加载失败，请重试',
                icon: 'none'
            });
        }
    },

    /**
     * 获取会议室指定日期的可用性
     */
    async fetchRoomAvailability(date) {
        // 检查日期参数是否有效
        if (!date || typeof date !== 'string' || date.trim() === '') {
            console.error('❌ fetchRoomAvailability 接收到无效的日期参数:', date);
            // 使用今天的日期作为默认值
            const today = new Date();
            date = this.formatDate(today);
            console.log('🔧 使用今天日期作为默认值:', date);
        }

        try {
            console.log('🔍 获取会议室可用性，日期:', date);
            const result = await this.requestAPI('GET', `/api/rooms/${this.data.roomId}/availability?date=${date}`);

            if (result.success && result.data) {
                // 生成时间段数组
                const timeSlots = this.generateTimeSlotsArray();

                // 根据后端返回的数据更新时间段状态
                const availabilityData = result.data;

                // 处理已预约时间段
                if (availabilityData.timeSlots) {
                    availabilityData.timeSlots.forEach(slot => {
                        if (slot.status === 'booked') {
                            const index = timeSlots.findIndex(ts => ts.time === slot.startTime);
                            if (index !== -1) {
                                timeSlots[index].status = 'booked';
                            }
                        }
                    });
                }

                // 处理临时关闭时间段
                if (availabilityData.temporaryClosures) {
                    availabilityData.temporaryClosures.forEach(closure => {
                        const startIndex = timeSlots.findIndex(ts => ts.time === closure.startTime);
                        const endIndex = timeSlots.findIndex(ts => ts.time === closure.endTime);

                        if (startIndex !== -1 && endIndex !== -1) {
                            for (let i = startIndex; i <= endIndex; i++) {
                                timeSlots[i].status = 'closed';
                            }
                        }
                    });
                }

                this.setData({
                    timeSlots: timeSlots,
                    selectedStartIndex: -1,
                    selectedEndIndex: -1
                });

                // 清空选中状态
                this.clearBookingForm();

            } else {
                throw new Error(result.message || '获取时间段失败');
            }
        } catch (error) {
            console.error('获取会议室可用性失败:', error);
            wx.showToast({
                title: '获取时间段失败',
                icon: 'none'
            });
        }
    },

    /**
     * 生成时间段数组 (08:30-12:00 和 14:30-17:30，每30分钟一个时间段)
     */
    generateTimeSlotsArray() {
        const timeSlots = [];
        let index = 0;

        // 上午时段 08:30-12:00
        const morningStart = { hour: 8, minute: 30 };
        const morningEnd = { hour: 12, minute: 0 };

        let currentHour = morningStart.hour;
        let currentMinute = morningStart.minute;

        while (currentHour < morningEnd.hour || (currentHour === morningEnd.hour && currentMinute <= morningEnd.minute)) {
            const timeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
            timeSlots.push({
                time: timeStr,
                status: 'available',
                isSelected: false,
                index: index++,
                period: 'morning' // 添加时段标识
            });

            // 增加30分钟
            currentMinute += 30;
            if (currentMinute >= 60) {
                currentHour += 1;
                currentMinute = 0;
            }
        }

        // 下午时段 14:30-17:30
        const afternoonStart = { hour: 14, minute: 30 };
        const afternoonEnd = { hour: 17, minute: 30 };

        currentHour = afternoonStart.hour;
        currentMinute = afternoonStart.minute;

        while (currentHour < afternoonEnd.hour || (currentHour === afternoonEnd.hour && currentMinute <= afternoonEnd.minute)) {
            const timeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
            timeSlots.push({
                time: timeStr,
                status: 'available',
                isSelected: false,
                index: index++,
                period: 'afternoon' // 添加时段标识
            });

            // 增加30分钟
            currentMinute += 30;
            if (currentMinute >= 60) {
                currentHour += 1;
                currentMinute = 0;
            }
        }

        return timeSlots;
    },

    /**
     * 日期选择器变化事件
     */
    bindDateChange(e) {
        const selectedDate = e.detail.value;
        const selectedDateObj = new Date(selectedDate);

        // 移除周末限制，允许周末预约
        // if (this.isWeekend(selectedDate)) {
        //     wx.showToast({
        //         title: '周末暂不可预约',
        //         icon: 'none',
        //         duration: 2000
        //     });
        //     return;
        // }

        this.setData({
            selectedDate: selectedDate,
            selectedDateWithWeekday: this.formatDateWithWeekday(selectedDateObj)
        });

        // 获取新日期的可用性信息
        this.fetchRoomAvailability(selectedDate);
    },

    /**
     * 时间段点击事件
     */
    onTimeSlotTap(e) {
        const index = parseInt(e.currentTarget.dataset.index);
        const timeSlots = [...this.data.timeSlots];
        const clickedSlot = timeSlots[index];

        // 如果点击的是不可用时间段，直接返回
        if (clickedSlot.status === 'booked' || clickedSlot.status === 'closed') {
            wx.showToast({
                title: clickedSlot.status === 'booked' ? '该时段已被预约' : '该时段临时关闭',
                icon: 'none'
            });
            return;
        }

        const { selectedStartIndex, selectedEndIndex } = this.data;

        // 如果点击的是已选中的开始时间段，清空所有选择
        if (index === selectedStartIndex) {
            this.clearTimeSelection();
            return;
        }

        // 如果还没有选择开始时间，或者点击的时间早于已选开始时间
        if (selectedStartIndex === -1 || index < selectedStartIndex) {
            this.setStartTime(index);
        }
        // 如果已有开始时间，设置结束时间
        else {
            this.setEndTime(selectedStartIndex, index);
        }
    },

    /**
     * 设置开始时间
     */
    setStartTime(startIndex) {
        // 清空之前的选择
        const timeSlots = [...this.data.timeSlots];
        timeSlots.forEach(slot => slot.isSelected = false);

        // 设置新的开始时间
        timeSlots[startIndex].isSelected = true;

        this.setData({
            timeSlots: timeSlots,
            selectedStartIndex: startIndex,
            selectedEndIndex: -1
        });
    },

    /**
     * 设置结束时间并验证时间段连续性
     */
    setEndTime(startIndex, endIndex) {
        const timeSlots = [...this.data.timeSlots];

        // 验证选中的时间段是否连续且都可用
        const validationResult = this.validateTimeRange(startIndex, endIndex);

        if (!validationResult.isValid) {
            wx.showToast({
                title: validationResult.message,
                icon: 'none'
            });
            return;
        }

        // 清空之前的选择
        timeSlots.forEach(slot => slot.isSelected = false);

        // 设置选中的时间段
        for (let i = startIndex; i <= endIndex; i++) {
            timeSlots[i].isSelected = true;
        }

        this.setData({
            timeSlots: timeSlots,
            selectedEndIndex: endIndex
        });
    },

    /**
     * 验证时间段范围
     */
    validateTimeRange(startIndex, endIndex) {
        const timeSlots = this.data.timeSlots;

        // 检查是否跨越午休时间 (12:00之后到14:30之前是午休时间)
        const morningEndIndex = timeSlots.findIndex(slot => slot.time === '12:00');
        const afternoonStartIndex = timeSlots.findIndex(slot => slot.time === '14:30');

        if (startIndex < morningEndIndex && endIndex >= afternoonStartIndex) {
            return {
                isValid: false,
                message: '不能跨越午休时间预约'
            };
        }

        // 检查选中范围内是否有不可用时间段
        for (let i = startIndex; i <= endIndex; i++) {
            if (timeSlots[i].status !== 'available') {
                return {
                    isValid: false,
                    message: '选中时间段包含不可用时段'
                };
            }
        }

        return { isValid: true };
    },

    /**
     * 清空时间选择
     */
    clearTimeSelection() {
        const timeSlots = [...this.data.timeSlots];
        timeSlots.forEach(slot => slot.isSelected = false);

        this.setData({
            timeSlots: timeSlots,
            selectedStartIndex: -1,
            selectedEndIndex: -1
        });

        this.clearBookingForm();
    },

    /**
     * 清空预约表单
     */
    clearBookingForm() {
        this.setData({
            bookingForm: {
                topic: '',
                contactName: '',
                contactPhone: '',
                date: '',
                startTime: '',
                endTime: '',
                attendeesCount: 1,
                requirements: ''
            }
        });
    },

    /**
     * 表单输入事件
     */
    onFormInput(e) {
        const field = e.currentTarget.dataset.field;
        const value = e.detail.value;

        this.setData({
            [`bookingForm.${field}`]: value
        });
    },

    /**
     * 显示预约弹窗
     */
    showBookingModal() {
        // 验证时间选择
        if (this.data.selectedStartIndex === -1 || this.data.selectedEndIndex === -1) {
            wx.showToast({
                title: '请选择预约时间段',
                icon: 'none'
            });
            return;
        }

        // 生成选中时间的文本描述
        const { selectedStartIndex, selectedEndIndex, timeSlots } = this.data;
        const startTime = timeSlots[selectedStartIndex].time;

        // 修正结束时间计算：结束时间就是用户选择的最后一个时间槽的时间
        // 用户选择的时间槽就是他们期望的结束时间，不需要额外加30分钟
        const lastSelectedSlot = timeSlots[selectedEndIndex];
        const actualEndTime = lastSelectedSlot.time;
        const selectedTimeText = `${startTime} - ${actualEndTime}`;

        this.setData({
            showBookingModal: true,
            selectedTimeText: selectedTimeText
        });
    },

    /**
     * 隐藏预约弹窗
     */
    hideBookingModal() {
        this.setData({
            showBookingModal: false
        });
    },

    /**
     * 阻止弹窗关闭（点击弹窗内容区域）
     */
    preventClose() {
        // 什么都不做，阻止事件冒泡
    },

    /**
     * 提交预约
     */
    async submitBooking() {
        // 验证时间选择
        if (this.data.selectedStartIndex === -1 || this.data.selectedEndIndex === -1) {
            wx.showToast({
                title: '请选择预约时间段',
                icon: 'none'
            });
            return;
        }

        // 验证表单
        const { topic, contactName, contactPhone } = this.data.bookingForm;

        if (!topic || !topic.trim()) {
            wx.showToast({
                title: '请输入会议主题',
                icon: 'none'
            });
            return;
        }

        if (!contactName || !contactName.trim()) {
            wx.showToast({
                title: '请输入联系人',
                icon: 'none'
            });
            return;
        }

        if (!contactPhone || !contactPhone.trim()) {
            wx.showToast({
                title: '请输入联系方式',
                icon: 'none'
            });
            return;
        }

        // 验证手机号格式
        const phoneRegex = /^1[3-9]\d{9}$/;
        if (!phoneRegex.test(contactPhone)) {
            wx.showToast({
                title: '请输入正确的手机号',
                icon: 'none'
            });
            return;
        }

        // 获取选中的时间段
        const { selectedStartIndex, selectedEndIndex, timeSlots } = this.data;
        const startTime = timeSlots[selectedStartIndex].time;

        // 修正结束时间计算：结束时间就是用户选择的最后一个时间槽的时间
        // 用户选择的时间槽就是他们期望的结束时间，不需要额外加30分钟
        const lastSelectedSlot = timeSlots[selectedEndIndex];
        const actualEndTime = lastSelectedSlot.time;

        // 构建预约数据 - 注意日期格式转换
        const bookingData = {
            roomId: this.data.roomId,
            bookingDate: new Date(this.data.selectedDate).toISOString(), // 转换为ISO格式
            startTime: startTime,
            endTime: actualEndTime,
            topic: topic.trim(),
            contactName: contactName.trim(),
            contactPhone: contactPhone.trim()
        };

        // 只有当参会人数有值时才添加该字段
        if (this.data.bookingForm.attendeesCount) {
            // 处理数字或字符串类型的参会人数
            const attendeeCount = typeof this.data.bookingForm.attendeesCount === 'string' ?
                this.data.bookingForm.attendeesCount.trim() :
                String(this.data.bookingForm.attendeesCount);

            if (attendeeCount && attendeeCount !== '0') {
                bookingData.attendeesCount = parseInt(attendeeCount);
            }
        }

        try {
            wx.showLoading({
                title: '提交中...'
            });

            const result = await this.requestAPI('POST', '/api/bookings', bookingData);

            wx.hideLoading();

            if (result.success) {
                wx.showToast({
                    title: '预约成功',
                    icon: 'success'
                });

                // 检查并更新用户联系人信息
                await this.updateUserContactInfo(contactName.trim(), contactPhone.trim());

                // 关闭弹窗
                this.hideBookingModal();

                // 清空选择和表单
                this.clearTimeSelection();

                // 重新获取可用性
                this.fetchRoomAvailability(this.data.selectedDate);

            } else {
                throw new Error(result.message || '预约失败');
            }

        } catch (error) {
            wx.hideLoading();
            console.error('预约失败:', error);

            wx.showToast({
                title: error.message || '预约失败，请重试',
                icon: 'none'
            });
        }
    },

    /**
     * 图片加载成功
     */
    onImageLoad() {
        this.setData({
            imageLoading: false,
            imageError: false
        });
    },

    /**
     * 图片加载失败
     */
    onImageError() {
        this.setData({
            imageLoading: false,
            imageError: true
        });
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
            const requestConfig = {
                url: `${this.data.apiBaseUrl}${url}`,
                method: method,
                header: {
                    'Content-Type': 'application/json',
                    'X-User-Openid': this.data.userOpenId
                },
                success: (res) => {
                    console.log(`${method} ${url} 响应:`, res);

                    // 2xx状态码都认为是成功
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(res.data);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${res.data?.message || 'Request failed'}`));
                    }
                },
                fail: (err) => {
                    console.error(`${method} ${url} 请求失败:`, err);
                    reject(new Error(err.errMsg || '网络请求失败'));
                }
            };

            if (method !== 'GET' && Object.keys(data).length > 0) {
                requestConfig.data = data;
            }

            wx.request(requestConfig);
        });
    },

    /**
     * 更新用户联系人信息
     */
    async updateUserContactInfo(contactName, contactPhone) {
        try {
            // 检查是否需要更新（联系人信息有变化）
            const currentContactName = this.data.bookingForm.contactName;
            const currentContactPhone = this.data.bookingForm.contactPhone;

            if (currentContactName === contactName && currentContactPhone === contactPhone) {
                console.log('ℹ️ 联系人信息无变化，跳过更新');
                return;
            }

            console.log('📝 更新用户联系人信息:', {
                contactName,
                contactPhone: contactPhone.substring(0, 3) + '****' + contactPhone.substring(7)
            });

            const result = await this.requestAPI('PUT', '/api/user/contact', {
                contactName: contactName,
                contactPhone: contactPhone
            });

            if (result.success) {
                console.log('✅ 用户联系人信息更新成功');

                // 更新本地缓存的联系人信息
                this.setData({
                    'bookingForm.contactName': contactName,
                    'bookingForm.contactPhone': contactPhone
                });
            } else {
                throw new Error(result.message || '更新用户联系人信息失败');
            }
        } catch (error) {
            console.error('❌ 更新用户联系人信息失败:', error);
            // 不显示错误提示，避免干扰用户体验
            // 联系人信息更新失败不影响预订流程
        }
    }
});