const app = getApp(); // 获取全局应用实例

Page({
    data: {
        upcomingBookings: [], // 即将开始的预约
        pastBookings: [], // 历史预约
        loading: false, // 加载状态
        isEmpty: false, // 是否没有预约记录
        error: '', // 错误信息
        userOpenId: '', // 用户openid，用于API请求
        apiBaseUrl: 'https://www.cacophonyem.me/meeting/api' // API基础URL
    },

    onLoad() {
        this.getUserOpenId();
    },

    onShow() {
        // 页面显示时刷新数据，确保数据最新
        if (this.data.userOpenId) {
            this.fetchMyBookings();
        }
    },

    /**
     * 获取用户openid
     */
    getUserOpenId() {
        try {
            // 先从全局数据获取
            if (app && app.globalData && app.globalData.userInfo && app.globalData.userInfo.openid) {
                this.setData({
                    userOpenId: app.globalData.userInfo.openid
                }, () => {
                    this.fetchMyBookings(); // 获取到openid后立即加载预约
                });
                console.log('✅ 从全局数据获取用户openid:', app.globalData.userInfo.openid);
                return;
            }

            // 从本地存储获取
            const userInfo = wx.getStorageSync('userInfo');
            if (userInfo && userInfo.openid) {
                this.setData({
                    userOpenId: userInfo.openid
                }, () => {
                    this.fetchMyBookings(); // 获取到openid后立即加载预约
                });
                console.log('✅ 从本地存储获取用户openid:', userInfo.openid);
                return;
            }

            // 如果都没有，尝试重新登录
            console.log('⚠️ 未找到用户openid，尝试重新登录');
            if (app && app.forceLogin) {
                app.forceLogin().then(() => {
                    this.getUserOpenId(); // 登录成功后再次获取openid
                }).catch(error => {
                    console.error('强制登录失败:', error);
                    this.setData({ error: '登录失败，请重试' });
                });
            } else {
                this.setData({ error: '未登录，无法获取预约信息' });
            }
        } catch (error) {
            console.error('❌ 获取用户openid失败:', error);
            this.setData({ error: '获取用户信息失败' });
        }
    },

    /**
     * 获取我的预约记录
     */
    async fetchMyBookings() {
        if (!this.data.userOpenId) {
            console.log('⚠️ 用户未登录，跳过获取我的预约记录');
            this.setData({ isEmpty: true, upcomingBookings: [], pastBookings: [] });
            return;
        }

        this.setData({ loading: true, error: '', isEmpty: false });
        console.log('🔍 开始获取我的预约记录...');

        try {
            const result = await this.requestAPI('GET', '/api/user/bookings');

            if (result.success && result.data) {
                const { upcomingBookings, pastBookings } = result.data;
                this.setData({
                    upcomingBookings: upcomingBookings,
                    pastBookings: pastBookings,
                    isEmpty: upcomingBookings.length === 0 && pastBookings.length === 0
                });
                console.log('✅ 获取我的预约记录成功。即将开始:', upcomingBookings.length, '历史:', pastBookings.length);
            } else {
                throw new Error(result.message || '获取预约记录失败');
            }
        } catch (error) {
            console.error('❌ 获取我的预约记录失败:', error);
            this.setData({ error: error.message || '加载预约记录失败，请检查网络' });
        } finally {
            this.setData({ loading: false });
        }
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
     * 跳转到会议室详情页面
     */
    goToRoomDetail(e) {
        const roomId = e.currentTarget.dataset.roomid;
        wx.navigateTo({
            url: `/pages/roomDetail/roomDetail?roomId=${roomId}`
        });
    },

    /**
     * 跳转到会议室列表页面
     */
    goToRoomList() {
        wx.navigateTo({
            url: '/pages/roomList/roomList'
        });
    },

    /**
     * 重试加载
     */
    retryLoad() {
        this.fetchMyBookings();
    }
});