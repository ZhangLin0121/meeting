// pages/roomList/roomList.js
const request = require('../../utils/request.js');

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
        apiBaseUrl: '',
        // 胶囊按钮信息
        menuButtonInfo: null,
        customNavBarHeight: 0
    },

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad() {
        console.log('会议室列表页面加载');

        // 安全获取App实例和API基础URL
        this.safeGetAppData();

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

            // 显示错误提示但不阻塞页面
            wx.showToast({
                title: '初始化中，请稍候',
                icon: 'loading',
                duration: 1500
            });

            // 延迟重试
            setTimeout(() => {
                this.safeGetAppData();
            }, 1000);
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
     * 生命周期函数--监听页面初次渲染完成
     */
    onReady() {

    },

    /**
     * 生命周期函数--监听页面显示
     */
    onShow() {
        // 先确保有用户openid
        if (!this.data.userOpenId) {
            this.getUserOpenId();
        }

        // 等待一下确保openid已获取
        setTimeout(() => {
            if (this.data.userOpenId) {
                this.loginUser().then(() => {
                    this.checkUserRole();
                    this.fetchRooms();
                }).catch(error => {
                    console.error('用户登录失败:', error);
                    wx.showToast({
                        title: '登录失败，请重试',
                        icon: 'none',
                        duration: 2000
                    });
                });
            } else {
                // 如果还是没有openid，直接获取房间列表
                this.fetchRooms();
            }
        }, 500);
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
        this.fetchRooms().finally(() => {
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
     * 用户点击右上角分享
     */
    onShareAppMessage() {

    },

    /**
     * 获取系统信息，计算状态栏高度和导航栏安全区域
     */
    getSystemInfo() {
        try {
            const systemInfo = wx.getSystemInfoSync();
            const menuButtonInfo = wx.getMenuButtonBoundingClientRect();

            console.log('📱 系统信息:', systemInfo);
            console.log('🔘 胶囊按钮信息:', menuButtonInfo);

            const statusBarHeight = systemInfo.statusBarHeight || 20;

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
            const WechatAuth = require('../../utils/auth.js');

            // 检查登录状态
            let userInfo = WechatAuth.checkLoginStatus();

            if (!userInfo || !userInfo.openid) {
                console.log('🔐 未找到用户信息，尝试重新登录...');
                userInfo = await WechatAuth.performWechatLogin();
            }

            if (userInfo && userInfo.openid) {
                // 更新页面的用户ID
                this.setData({
                    userOpenId: userInfo.openid
                });
                console.log('✅ 用户登录成功，openid:', userInfo.openid);
                return userInfo;
            } else {
                throw new Error('无法获取用户信息');
            }
        } catch (error) {
            console.error('用户登录失败:', error);
            throw error;
        }
    },

    /**
     * 检查用户角色
     */
    async checkUserRole() {
        try {
            const result = await this.requestAPI('GET', '/api/user/role');
            if (result.success) {
                this.setData({
                    isAdmin: result.data.role === 'admin'
                });
            }
        } catch (error) {
            console.error('检查用户角色失败:', error);
            // 默认为普通用户
            this.setData({
                isAdmin: false
            });
        }
    },

    /**
     * 获取会议室列表
     */
    async fetchRooms() {
        this.setData({ loading: true });

        try {
            console.log('🏢 开始获取会议室列表...');
            const result = await request.get('/api/rooms');

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
     * 处理会议室数据，判断可用状态和图片显示
     */
    async processRoomsData(rooms) {
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0];

        const processedRooms = await Promise.all(
            rooms.map(async(room) => {
                try {
                    // 获取今日可用时段
                    const availabilityResult = await this.requestAPI('GET', `/api/rooms/${room.id}/availability?date=${dateStr}`);

                    let status = 'available';
                    if (availabilityResult.success && availabilityResult.data) {
                        // 检查是否有可用时段
                        const timeSlots = availabilityResult.data.timeSlots || [];
                        const hasAvailableSlot = timeSlots.some(slot => slot.status === 'available');
                        status = hasAvailableSlot ? 'available' : 'unavailable';
                    }

                    // 处理图片显示逻辑
                    let displayImage = '/images/default_room.svg';
                    if (room.images && room.images.length > 0) {
                        // 构建完整的图片URL
                        const imageUrl = room.images[0];
                        displayImage = imageUrl.startsWith('http') ? imageUrl : `${this.data.apiBaseUrl}${imageUrl}`;
                    }

                    return {
                        ...room,
                        status: status,
                        displayImage: displayImage,
                        imageLoading: false,
                        imageError: false
                    };
                } catch (error) {
                    console.error(`处理会议室 ${room.name} 数据失败:`, error);
                    return {
                        ...room,
                        status: 'available',
                        displayImage: '/images/default_room.svg',
                        imageLoading: false,
                        imageError: false
                    };
                }
            })
        );

        return processedRooms;
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
     * API请求封装
     */
    requestAPI(method, url, data = {}) {
        return new Promise((resolve, reject) => {
            const requestConfig = {
                url: `${this.data.apiBaseUrl}${url}`,
                method: method,
                header: {
                    'Content-Type': 'application/json',
                    'X-User-Openid': this.data.userOpenId
                },
                success: (res) => {
                    resolve(res.data);
                },
                fail: (error) => {
                    reject(error);
                }
            };

            if (method === 'POST' || method === 'PUT') {
                requestConfig.data = data;
            }

            wx.request(requestConfig);
        });
    },

    /**
     * 跳转到会议室详情页
     */
    goToRoomDetail(e) {
        console.log('🖱️ 点击会议室卡片');
        console.log('📥 事件对象:', e);
        console.log('📥 dataset:', e.currentTarget.dataset);
        console.log('📥 当前会议室数据:', this.data.rooms);

        const roomId = e.currentTarget.dataset.roomId;
        console.log('🏢 获取到的roomId:', roomId);
        console.log('🏢 roomId类型:', typeof roomId);

        if (!roomId) {
            console.error('❌ roomId 为空，无法跳转');
            console.error('❌ dataset内容:', e.currentTarget.dataset);
            console.error('❌ 当前rooms数据:', this.data.rooms);

            wx.showModal({
                title: '调试信息',
                content: `roomId为空\ndataset: ${JSON.stringify(e.currentTarget.dataset)}\n\n检查点：\n1. 请查看控制台完整日志\n2. 数据是否正确加载`,
                showCancel: false
            });
            return;
        }

        const targetUrl = `/pages/roomDetail/roomDetail?roomId=${roomId}`;
        console.log('🔗 准备跳转URL:', targetUrl);

        wx.navigateTo({
            url: targetUrl,
            success: () => {
                console.log('✅ 跳转成功到会议室详情页');
            },
            fail: (error) => {
                console.error('❌ 跳转失败:', error);
                wx.showModal({
                    title: '跳转失败',
                    content: `错误: ${JSON.stringify(error)}\nURL: ${targetUrl}`,
                    showCancel: false
                });
            }
        });
    },

    /**
     * 跳转到管理员面板
     */
    goToAdminPanel() {
        if (!this.data.isAdmin) {
            wx.showToast({
                title: '您没有管理员权限',
                icon: 'none',
                duration: 2000
            });
            return;
        }

        wx.navigateTo({
            url: '/pages/admin/admin'
        });
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
    onSearchConfirm(e) {
        const keyword = e.detail.value.trim();
        if (keyword) {
            this.performSearch(keyword);
        } else {
            this.fetchRooms();
        }
    },

    /**
     * 执行搜索
     */
    async performSearch(keyword) {
        this.setData({ loading: true, searchKeyword: keyword });

        try {
            const result = await this.requestAPI('GET', `/api/rooms?search=${encodeURIComponent(keyword)}`);

            if (result.success && result.data) {
                const processedRooms = await this.processRoomsData(result.data);
                this.setData({
                    rooms: processedRooms,
                    loading: false
                });
            } else {
                throw new Error(result.message || '搜索失败');
            }
        } catch (error) {
            console.error('搜索失败:', error);
            this.setData({
                loading: false,
                rooms: []
            });

            wx.showToast({
                title: '搜索失败，请重试',
                icon: 'none',
                duration: 2000
            });
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
    }
});