// pages/roomList/roomList.js
const API_BASE_URL = 'http://localhost:3000';

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
        userOpenId: 'test_user_001' // 模拟用户openid，实际应通过微信登录获取
    },

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad() {
        this.getSystemInfo();
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
     * 获取系统信息，计算状态栏高度
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
                statusBarHeight: 20 // 默认值
            });
        }
    },

    /**
     * 用户登录
     */
    async loginUser() {
        try {
            // 调用后端登录接口，确保用户存在于数据库中
            const result = await this.requestAPI('POST', '/api/user/login', {
                openid: this.data.userOpenId,
                nickname: '测试用户', // 这里可以是微信获取的昵称
                avatarUrl: '' // 这里可以是微信获取的头像
            });

            if (result.success) {
                console.log('✅ 用户登录成功:', result.data);
                return result.data;
            } else {
                throw new Error(result.message || '登录失败');
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
            const result = await this.requestAPI('GET', '/api/rooms');

            if (result.success && result.data) {
                // 处理会议室数据，添加状态判断
                const processedRooms = await this.processRoomsData(result.data);

                this.setData({
                    rooms: processedRooms,
                    loading: false
                });
            } else {
                throw new Error(result.message || '获取会议室列表失败');
            }
        } catch (error) {
            console.error('获取会议室列表失败:', error);
            this.setData({
                loading: false,
                rooms: []
            });

            wx.showToast({
                title: '加载失败，请重试',
                icon: 'none',
                duration: 2000
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
                        displayImage = imageUrl.startsWith('http') ? imageUrl : `${API_BASE_URL}${imageUrl}`;
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
                url: `${API_BASE_URL}${url}`,
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
        const roomId = e.currentTarget.dataset.roomId;
        console.log('点击会议室卡片，roomId:', roomId);

        if (!roomId) {
            console.error('roomId 为空，无法跳转');
            wx.showToast({
                title: '会议室信息错误',
                icon: 'none',
                duration: 2000
            });
            return;
        }

        console.log('准备跳转到会议室详情页，URL:', `/pages/roomDetail/roomDetail?roomId=${roomId}`);

        wx.navigateTo({
            url: `/pages/roomDetail/roomDetail?roomId=${roomId}`,
            success: () => {
                console.log('跳转成功');
            },
            fail: (error) => {
                console.error('跳转失败:', error);
                wx.showToast({
                    title: '页面跳转失败',
                    icon: 'none',
                    duration: 2000
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
            const result = await this.requestAPI('GET', `/api/rooms?minCapacity=${minCapacity}&maxCapacity=${maxCapacity}`);

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
     * 显示设备筛选（简化版）
     */
    showEquipmentFilter() {
        wx.showToast({
            title: '设备筛选功能开发中',
            icon: 'none',
            duration: 2000
        });
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