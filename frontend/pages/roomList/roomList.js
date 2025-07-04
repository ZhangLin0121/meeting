// pages/roomList/roomList.js
const request = require('../../utils/request.js');
const envConfig = require('../../config/env.js');

Page({

    /**
     * 页面的初始数据
     */
    data: {
        rooms: [],
        loading: false,
        loadingMore: false,
        searchKeyword: '',
        isAdmin: false,
        statusBarHeight: 0,
        userOpenId: '',
        apiBaseUrl: envConfig.apiBaseUrl,
        // 胶囊按钮信息
        menuButtonInfo: null,
        customNavBarHeight: 0,
        // 页面配置
        refreshing: false,
        hasMore: true,
        currentPage: 1
    },

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad() {
        console.log('会议室列表页面加载');

        // 获取系统信息，包括状态栏高度
        this.getSystemInfo();

        // 获取用户openid
        this.getUserOpenId();

        // 页面加载完成，会在onShow中初始化数据
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
     * 生命周期函数--监听页面初次渲染完成
     */
    onReady() {

    },

    /**
     * 生命周期函数--监听页面显示 - 优化版本，确保登录后再获取数据
     */
    async onShow() {
        console.log('📱 页面显示，开始初始化...');

        // 打印当前页面状态，帮助调试
        console.log('🔍 当前页面状态:', {
            userOpenId: this.data.userOpenId,
            apiBaseUrl: this.data.apiBaseUrl,
            loading: this.data.loading,
            roomsCount: this.data.rooms.length,
            isAdmin: this.data.isAdmin
        });

        await this.initializePage();
    },

    /**
     * 智能初始化页面 - 确保登录后再加载数据
     */
    async initializePage() {
        try {
            const userInfo = await this.loginUser();
            if (userInfo && userInfo.openid) {
                // 更新页面数据
                this.setData({
                    userOpenId: userInfo.openid
                });

                // 并行执行用户角色检查和会议室列表获取
                await Promise.all([
                    this.checkUserRole().catch(error => {
                        console.warn('⚠️ 用户角色检查失败，使用默认权限:', error);
                    }),
                    this.fetchRooms().catch(error => {
                        console.error('❌ 获取会议室列表失败:', error);
                        // 不抛出错误，让页面继续显示
                    })
                ]);



            } else {
                throw new Error('登录失败：无法获取用户信息');
            }

        } catch (error) {
            console.error('❌ 页面初始化失败:', error);

            // 显示友好的错误提示
            wx.showModal({
                title: '初始化失败',
                content: '页面加载失败，请检查网络连接后重试',
                showCancel: true,
                cancelText: '取消',
                confirmText: '重试',
                success: (res) => {
                    if (res.confirm) {
                        // 用户选择重试
                        this.initializePage();
                    }
                }
            });
        }
    },



    /**
     * 生命周期函数--监听页面隐藏
     */
    onHide() {

    },

    /**
     * 生命周期函数--监听页面卸载
     */
    onUnload() {

    },

    /**
     * 页面相关事件处理函数--监听用户下拉动作
     */
    onPullDownRefresh() {
        console.log('🔄 用户下拉刷新');

        // 确保用户已登录后再刷新数据
        this.fetchRooms()
            .catch(error => {
                console.error('❌ 下拉刷新失败:', error);
                wx.showToast({
                    title: '刷新失败',
                    icon: 'none',
                    duration: 2000
                });
            })
            .finally(() => {
                wx.stopPullDownRefresh();
            });
    },

    /**
     * 页面上拉触底事件的处理函数
     */
    onReachBottom() {
        // 这里可以实现分页加载逻辑
        console.log('到达底部，可实现分页加载');
    },

    /**
     * 下拉刷新处理函数
     */
    onRefresh() {
        console.log('🔄 下拉刷新触发');
        this.fetchRooms()
            .catch(error => {
                console.error('❌ 刷新失败:', error);
                wx.showToast({
                    title: '刷新失败',
                    icon: 'none'
                });
            });
    },

    /**
     * 用户点击右上角分享
     */
    onShareAppMessage() {

    },

    /**
     * 获取系统信息，计算状态栏高度和导航栏安全区域
     */
    getSystemInfo() {
        try {
            const windowInfo = wx.getWindowInfo();
            const menuButtonInfo = wx.getMenuButtonBoundingClientRect();

            console.log('📱 窗口信息:', windowInfo);
            console.log('🔘 胶囊按钮信息:', menuButtonInfo);

            const statusBarHeight = windowInfo.statusBarHeight || 20;

            // 计算自定义导航栏的安全高度
            // 胶囊按钮顶部到状态栏底部的距离 * 2 + 胶囊按钮高度
            const customNavBarHeight = menuButtonInfo.top && menuButtonInfo.height ?
                (menuButtonInfo.top - statusBarHeight) * 2 + menuButtonInfo.height : 44;

            this.setData({
                statusBarHeight: statusBarHeight,
                menuButtonInfo: menuButtonInfo,
                customNavBarHeight: customNavBarHeight
            });

            console.log('✅ 导航栏信息设置完成:', {
                statusBarHeight,
                customNavBarHeight,
                menuButtonInfo
            });
        } catch (error) {
            console.error('获取系统信息失败:', error);
            this.setData({
                statusBarHeight: 20, // 默认值
                customNavBarHeight: 44 // 默认值
            });
        }
    },

    /**
     * 用户登录
     */
    async loginUser() {
        try {
            const existingUser = wx.getStorageSync('userInfo');
            if (existingUser && existingUser.openid) return existingUser;

            return new Promise((resolve) => {
                wx.login({
                    success: async(res) => {
                        if (res.code) {
                            try {
                                const result = await this.requestAPI('POST', '/api/user/wechat-login', { code: res.code });
                                if (result.success && result.data) {
                                    wx.setStorageSync('userInfo', result.data);
                                    resolve(result.data);
                                }
                            } catch (error) {
                                resolve(null);
                            }
                        } else {
                            resolve(null);
                        }
                    },
                    fail: () => resolve(null)
                });
            });
        } catch (error) {
            return null;
        }
    },

    /**
     * 检查用户角色
     */
    async checkUserRole() {
        try {
            const result = await this.requestAPI('GET', '/api/user/role');
            if (result.success) {
                this.setData({ isAdmin: result.data.isAdmin });
            }
        } catch (error) {
            this.setData({ isAdmin: false });
        }
    },

    /**
     * 获取会议室列表 - 增强版本，确保用户已登录
     */
    async fetchRooms() {
        console.log('🏢 fetchRooms方法被调用');
        console.log('🔍 当前状态检查:', {
            userOpenId: this.data.userOpenId,
            apiBaseUrl: this.data.apiBaseUrl,
            hasUserOpenId: !!this.data.userOpenId,
            userOpenIdLength: this.data.userOpenId ? this.data.userOpenId.length : 0
        });

        // 检查页面是否有用户ID
        if (!this.data.userOpenId) {
            console.warn('⚠️ 页面用户ID未设置，跳过获取会议室列表');
            this.setData({
                loading: false,
                rooms: []
            });
            return;
        }

        this.setData({ loading: true });
        try {
            console.log('🏢 开始获取会议室列表...', {
                userOpenId: this.data.userOpenId.substring(0, 8) + '...',
                fullUrl: `${this.data.apiBaseUrl}/api/rooms`
            });

            const result = await this.requestAPI('GET', '/api/rooms');

            console.log('✅ 获取会议室列表成功:', result);

            if (result.success && result.data) {
                // 处理会议室数据，添加状态判断
                const processedRooms = await this.processRoomsData(result.data);

                this.setData({
                    rooms: processedRooms,
                    loading: false
                });

                wx.showToast({
                    title: `加载了${processedRooms.length}个会议室`,
                    icon: 'success',
                    duration: 1500
                });
            } else {
                throw new Error(result.message || '获取会议室列表失败');
            }
        } catch (error) {
            console.error('❌ 获取会议室列表失败:', error);
            this.setData({
                loading: false,
                rooms: []
            });

            // 显示详细错误信息
            let errorMessage = '加载失败，请重试';
            if (error.message) {
                if (error.message.includes('网络')) {
                    errorMessage = '网络连接失败，请检查网络设置';
                } else if (error.message.includes('超时')) {
                    errorMessage = '请求超时，请重试';
                } else {
                    errorMessage = error.message;
                }
            }

            wx.showModal({
                title: '加载失败',
                content: errorMessage,
                showCancel: true,
                cancelText: '取消',
                confirmText: '重试',
                success: (res) => {
                    if (res.confirm) {
                        this.fetchRooms();
                    }
                }
            });
        }
    },

    /**
     * 处理会议室数据，添加图片路径和其他展示信息
     */
    async processRoomsData(rooms) {
        console.log('🔄 开始处理会议室数据...');

        const processedRooms = rooms.map((room, index) => {
            // 处理图片路径
            let displayImage;
            if (room.images && room.images.length > 0) {
                // 使用服务器返回的图片路径，确保正确拼接
                const imagePath = room.images[0];
                displayImage = imagePath.startsWith('http') ? imagePath : `${this.data.apiBaseUrl}${imagePath}`;
                console.log(`🖼️ 会议室 ${room.name} 图片路径:`, displayImage);
            } else {
                // 使用本地默认图片
                displayImage = this.getLocalRoomImage(room.name, room.id);
                console.log(`🎨 会议室 ${room.name} 使用默认图片:`, displayImage);
            }

            // 根据 availability 字段设置状态
            let status = 'available';
            if (room.availability === 'occupied' || room.availability === 'unavailable') {
                status = 'occupied';
            }

            // 模拟丰富的数据
            const enhancedRoom = {
                ...room,
                displayImage: displayImage,
                status: status,
                imageError: false,
                // 新增模拟数据
                todayBookings: Math.floor(Math.random() * 8) + 1, // 1-8次预约
                popularity: Math.floor(Math.random() * 30) + 70, // 70-100%使用率
                rating: (Math.random() * 1 + 4).toFixed(1), // 4.0-5.0评分
                nextBooking: status === 'occupied' ? '14:00-15:30' : null,
                // 根据容量和设备生成特色
                features: this.generateRoomFeatures(room)
            };

            console.log(`✅ 处理完成: ${room.name}`, {
                id: room.id,
                displayImage: displayImage.substring(0, 50) + '...',
                status: status,
                todayBookings: enhancedRoom.todayBookings,
                popularity: enhancedRoom.popularity,
                rating: enhancedRoom.rating
            });

            return enhancedRoom;
        });

        console.log('✅ 所有会议室数据处理完成');
        return processedRooms;
    },

    /**
     * 生成会议室特色标签
     */
    generateRoomFeatures(room) {
        const features = [];

        if (room.capacity >= 20) {
            features.push('大型会议');
        }

        if (room.capacity <= 8) {
            features.push('私密空间');
        }

        if (room.equipment && room.equipment.includes('投影设备')) {
            features.push('投影设备');
        }

        if (room.equipment && room.equipment.includes('视频会议设备')) {
            features.push('视频会议');
        }

        return features;
    },

    /**
     * 图片加载成功
     */
    onImageLoad(e) {
        const roomId = e.currentTarget.dataset.roomId;
        this.updateRoomImageStatus(roomId, { imageLoading: false, imageError: false });
    },

    /**
     * 图片加载失败
     */
    onImageError(e) {
        const roomId = e.currentTarget.dataset.roomId;
        this.updateRoomImageStatus(roomId, { imageLoading: false, imageError: true });
    },

    /**
     * 更新特定会议室的图片状态
     */
    updateRoomImageStatus(roomId, updates) {
        const rooms = this.data.rooms;
        const index = rooms.findIndex(room => room.id === roomId);
        if (index !== -1) {
            const updatePath = {};
            Object.keys(updates).forEach(key => {
                updatePath[`rooms[${index}].${key}`] = updates[key];
            });
            this.setData(updatePath);
        }
    },

    /**
     * 清除搜索
     */
    clearSearch() {
        this.setData({
            searchKeyword: ''
        });
        this.fetchRooms();
    },

    /**
     * 获取本地会议室图片
     */
    getLocalRoomImage(roomName, roomId) {
        // 直接使用默认图片，等待管理员上传真实图片
        return '/images/default_room.png';
    },

    /**
     * 简单哈希函数
     */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为32位整数
        }
        return Math.abs(hash);
    },

    /**
     * API请求封装
     */
    requestAPI(method, url, data = {}) {
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
                        reject(new Error(`HTTP ${res.statusCode}`));
                    }
                },
                fail: (err) => {
                    reject(new Error(err.errMsg || '网络请求失败'));
                }
            });
        });
    },

    /**
     * 跳转到会议室详情页
     */
    /**
     * 跳转到会议室详情页
     */
    goToRoomDetail(e) {
        console.log('🔗 点击跳转到会议室详情:', e.currentTarget.dataset);

        const room = e.currentTarget.dataset.room;

        if (!room) {
            console.error('❌ 无法获取会议室数据');
            wx.showToast({
                title: '会议室信息错误',
                icon: 'none'
            });
            return;
        }

        // 获取会议室ID，兼容不同的字段名
        const roomId = room.id || room.roomId || room._id;

        if (!roomId) {
            console.error('❌ 无法获取会议室ID:', room);
            wx.showToast({
                title: '会议室ID错误',
                icon: 'none'
            });
            return;
        }

        console.log('✅ 跳转到详情页，会议室ID:', roomId);

        wx.navigateTo({
            url: `/pages/roomDetail/roomDetail?roomId=${roomId}`,
            fail: (err) => {
                console.error('❌ 页面跳转失败:', err);
                wx.showToast({
                    title: '页面跳转失败',
                    icon: 'none'
                });
            }
        });
    },

    /**
     * 跳转到管理员面板
     */
    goToAdminPanel() {
        if (this.data.isAdmin) {
            wx.navigateTo({
                url: '/pages/admin/admin'
            });
        } else {
            wx.showToast({
                title: '您没有管理员权限',
                icon: 'none'
            });
        }
    },

    /**
     * 跳转到搜索页面
     */
    goToSearchPage() {
        wx.navigateTo({
            url: '/pages/search/search'
        });
    },

    /**
     * 搜索输入处理
     */
    onSearchInput(e) {
        this.setData({
            searchKeyword: e.detail.value
        });
    },

    /**
     * 搜索确认处理
     */
    async onSearchConfirm() {
        const keyword = this.data.searchKeyword.trim();
        if (keyword) {
            await this.performSearch(keyword);
        } else {
            await this.fetchRooms();
        }
    },

    /**
     * 执行搜索
     */
    async performSearch(keyword) {
        this.setData({ loading: true });
        try {
            const result = await this.requestAPI('GET', `/api/rooms/search?keyword=${encodeURIComponent(keyword)}`);
            if (result.success) {
                this.setData({ rooms: result.data || [] });
            }
        } catch (error) {
            wx.showToast({ title: '搜索失败', icon: 'none' });
        } finally {
            this.setData({ loading: false });
        }
    },

    /**
     * 显示筛选选项
     */
    showFilterOptions() {
        const filterOptions = ['按容纳人数', '按设备配置', '清除筛选'];

        wx.showActionSheet({
            itemList: filterOptions,
            success: (res) => {
                switch (res.tapIndex) {
                    case 0:
                        this.showCapacityFilter();
                        break;
                    case 1:
                        this.showEquipmentFilter();
                        break;
                    case 2:
                        this.clearFilter();
                        break;
                }
            }
        });
    },

    /**
     * 显示容量筛选
     */
    showCapacityFilter() {
        const capacityOptions = ['1-5人', '6-10人', '11-20人', '20人以上'];

        wx.showActionSheet({
            itemList: capacityOptions,
            success: (res) => {
                const ranges = [
                    { min: 1, max: 5 },
                    { min: 6, max: 10 },
                    { min: 11, max: 20 },
                    { min: 21, max: 999 }
                ];
                const selectedRange = ranges[res.tapIndex];
                this.filterByCapacity(selectedRange.min, selectedRange.max);
            }
        });
    },

    /**
     * 按容量筛选
     */
    async filterByCapacity(minCapacity, maxCapacity) {
        this.setData({ loading: true });

        try {
            const result = await this.requestAPI('GET', `/api/rooms?capacityMin=${minCapacity}&capacityMax=${maxCapacity}`);

            if (result.success && result.data) {
                const processedRooms = await this.processRoomsData(result.data);
                this.setData({
                    rooms: processedRooms,
                    loading: false
                });

                wx.showToast({
                    title: `已筛选 ${minCapacity}-${maxCapacity === 999 ? '无限' : maxCapacity}人会议室`,
                    icon: 'none',
                    duration: 2000
                });
            } else {
                throw new Error(result.message || '筛选失败');
            }
        } catch (error) {
            console.error('按容量筛选失败:', error);
            this.setData({
                loading: false
            });

            wx.showToast({
                title: '筛选失败，请重试',
                icon: 'none',
                duration: 2000
            });
        }
    },

    /**
     * 显示设备筛选
     */
    showEquipmentFilter() {
        const equipmentOptions = ['投屏设备', '麦克风', '音响系统', '白板', '视频会议设备', '网络接口/Wi-Fi'];

        wx.showActionSheet({
            itemList: equipmentOptions,
            success: (res) => {
                const selectedEquipment = equipmentOptions[res.tapIndex];
                this.filterByEquipment(selectedEquipment);
            }
        });
    },

    /**
     * 按设备筛选
     */
    async filterByEquipment(equipment) {
        this.setData({ loading: true });

        try {
            const result = await this.requestAPI('GET', `/api/rooms?equipment=${encodeURIComponent(equipment)}`);

            if (result.success && result.data) {
                const processedRooms = await this.processRoomsData(result.data);
                this.setData({
                    rooms: processedRooms,
                    loading: false
                });

                wx.showToast({
                    title: `已筛选包含"${equipment}"的会议室`,
                    icon: 'none',
                    duration: 2000
                });
            } else {
                throw new Error(result.message || '筛选失败');
            }
        } catch (error) {
            console.error('按设备筛选失败:', error);
            this.setData({
                loading: false
            });

            wx.showToast({
                title: '筛选失败，请重试',
                icon: 'none',
                duration: 2000
            });
        }
    },

    /**
     * 清除筛选
     */
    clearFilter() {
        this.setData({
            searchKeyword: ''
        });
        this.fetchRooms();

        wx.showToast({
            title: '已清除筛选条件',
            icon: 'none',
            duration: 1500
        });
    },

    /**
     * 打开会议室位置地图
     */
    openLocationMap(e) {
        const roomId = e.currentTarget.dataset.roomId;
        console.log('打开位置地图，会议室ID:', roomId);

        // 显示加载中
        wx.showLoading({
            title: '获取位置信息...',
        });

        // 从当前数据中查找会议室
        const room = this.data.rooms.find(r => r.id === roomId || r.roomId === roomId || r._id === roomId);

        if (!room) {
            wx.hideLoading();
            wx.showToast({
                title: '未找到会议室信息',
                icon: 'none',
                duration: 2000
            });
            return;
        }

        // 如果会议室数据中已有经纬度信息
        if (room.latitude && room.longitude) {
            this.openMap(room);
            return;
        }

        // 如果没有经纬度，则通过地址获取经纬度
        this.getLocationFromAddress(room);
    },

    /**
     * 通过地址获取经纬度
     */
    getLocationFromAddress(room) {
        // 这里需要替换为您的高德地图API Key
        const key = '您的高德地图API Key';
        const address = room.location || '';
        const url = `https://restapi.amap.com/v3/geocode/geo?key=${key}&address=${encodeURIComponent(address)}&city=全国`;

        wx.request({
            url: url,
            success: (res) => {
                wx.hideLoading();

                if (res.data.status === '1' && res.data.geocodes && res.data.geocodes.length > 0) {
                    const location = res.data.geocodes[0].location.split(',');
                    const longitude = parseFloat(location[0]);
                    const latitude = parseFloat(location[1]);

                    // 更新会议室数据，添加经纬度信息
                    room.latitude = latitude;
                    room.longitude = longitude;

                    // 打开地图
                    this.openMap(room);
                } else {
                    wx.showToast({
                        title: '无法获取位置坐标',
                        icon: 'none',
                        duration: 2000
                    });
                }
            },
            fail: (error) => {
                console.error('❌ 地理编码失败:', error);
                wx.hideLoading();

                wx.showToast({
                    title: '获取位置坐标失败',
                    icon: 'none',
                    duration: 2000
                });
            }
        });
    },

    /**
     * 打开地图
     */
    openMap(room) {
        wx.openLocation({
            latitude: room.latitude,
            longitude: room.longitude,
            name: room.name,
            address: room.location,
            scale: 18
        });
    },

    /**
     * 跳转到我的预约页面
     */
    goToMyBookings() {
        wx.showModal({
            title: '我的预约',
            content: '预约管理功能开发中，敬请期待！',
            showCancel: false
        });
    },

    /**
     * 跳转到我的预约
     */
    goToMyBookings() {
        wx.switchTab({
            url: '/pages/myBookings/myBookings'
        });
    }
});