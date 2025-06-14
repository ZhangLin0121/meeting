const app = getApp(); // 获取全局应用实例
const request = require('../../utils/request.js'); // 导入网络请求工具

Page({
    data: {
        upcomingBookings: [], // 即将开始的预约
        pastBookings: [], // 历史预约
        loading: false, // 初始加载状态
        refreshing: false, // 下拉刷新状态
        loadingMore: false, // 加载更多状态
        isEmpty: false, // 是否没有预约记录
        error: '', // 错误信息
        userOpenId: '', // 用户openid，用于API请求
        statusBarHeight: 0, // 状态栏高度
        hasMore: false, // 是否有更多数据
        currentPage: 1, // 当前页码
        pageSize: 10 // 每页数量
    },

    onLoad() {
        // 获取系统信息
        wx.getSystemInfo({
            success: (res) => {
                this.setData({
                    statusBarHeight: res.statusBarHeight
                });
            }
        });

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
    async fetchMyBookings(isRefresh = false, isLoadMore = false) {
        if (!this.data.userOpenId) {
            console.log('⚠️ 用户未登录，跳过获取我的预约记录');
            this.setData({ isEmpty: true, upcomingBookings: [], pastBookings: [] });
            return;
        }

        // 设置加载状态
        if (isRefresh) {
            this.setData({ refreshing: true });
        } else if (isLoadMore) {
            this.setData({ loadingMore: true });
        } else {
            this.setData({ loading: true });
        }

        this.setData({ error: '', isEmpty: false });
        console.log('🔍 开始获取我的预约记录...');

        try {
            const result = await request.get('/api/user/bookings', {
                page: isLoadMore ? this.data.currentPage + 1 : 1,
                pageSize: this.data.pageSize
            });

            if (result.success && result.data) {
                const { upcomingBookings, pastBookings, hasMore, currentPage } = result.data;

                // 格式化预约数据，添加格式化的创建时间
                const formatBookings = (bookings) => {
                    return bookings.map(booking => ({
                        ...booking,
                        createdAt: this.formatDate(booking.createdAt)
                    }));
                };

                const formattedUpcoming = formatBookings(upcomingBookings);
                const formattedPast = formatBookings(pastBookings);

                if (isLoadMore) {
                    // 加载更多，追加数据
                    this.setData({
                        upcomingBookings: [...this.data.upcomingBookings, ...formattedUpcoming],
                        pastBookings: [...this.data.pastBookings, ...formattedPast],
                        hasMore: hasMore || false,
                        currentPage: currentPage || this.data.currentPage + 1,
                        isEmpty: this.data.upcomingBookings.length === 0 && this.data.pastBookings.length === 0 && formattedUpcoming.length === 0 && formattedPast.length === 0
                    });
                } else {
                    // 首次加载或刷新，替换数据
                    this.setData({
                        upcomingBookings: formattedUpcoming,
                        pastBookings: formattedPast,
                        hasMore: hasMore || false,
                        currentPage: currentPage || 1,
                        isEmpty: formattedUpcoming.length === 0 && formattedPast.length === 0
                    });
                }

                console.log('✅ 获取我的预约记录成功。即将开始:', formattedUpcoming.length, '历史:', formattedPast.length);
            } else {
                throw new Error(result.message || '获取预约记录失败');
            }
        } catch (error) {
            console.error('❌ 获取我的预约记录失败:', error);
            if (!isLoadMore) {
                this.setData({ error: error.message || '加载预约记录失败，请检查网络' });
            } else {
                wx.showToast({
                    title: '加载失败',
                    icon: 'none'
                });
            }
        } finally {
            this.setData({
                loading: false,
                refreshing: false,
                loadingMore: false
            });
        }
    },

    /**
     * 格式化日期时间
     */
    formatDate(dateString) {
        if (!dateString) return '';

        try {
            const date = new Date(dateString);
            const now = new Date();
            const diffTime = now.getTime() - date.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 0) {
                // 今天，显示具体时间
                return `今天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
            } else if (diffDays === 1) {
                return '昨天';
            } else if (diffDays < 7) {
                return `${diffDays}天前`;
            } else {
                // 超过一周，显示具体日期
                return `${date.getMonth() + 1}月${date.getDate()}日`;
            }
        } catch (error) {
            console.error('日期格式化失败:', error);
            return '';
        }
    },



    /**
     * 返回上一页
     */
    goBack() {
        if (getCurrentPages().length > 1) {
            wx.navigateBack();
        } else {
            // 如果是首页，跳转到会议室列表
            wx.reLaunch({
                url: '/pages/roomList/roomList'
            });
        }
    },

    /**
     * 刷新数据
     */
    refreshData() {
        this.fetchMyBookings();
    },

    /**
     * 下拉刷新
     */
    onRefresh() {
        this.fetchMyBookings(true);
    },

    /**
     * 加载更多
     */
    loadMore() {
        if (this.data.hasMore && !this.data.loadingMore) {
            this.fetchMyBookings(false, true);
        }
    },

    /**
     * 预约卡片点击事件
     */
    onBookingCardTap(e) {
        const booking = e.currentTarget.dataset.booking;
        if (!booking || !booking.roomId) {
            wx.showToast({
                title: '会议室信息异常',
                icon: 'none'
            });
            return;
        }

        // 跳转到会议室详情页
        wx.navigateTo({
            url: `/pages/roomDetail/roomDetail?roomId=${booking.roomId}`
        });
    },

    /**
     * 跳转到会议室列表页面
     */
    goToRoomList() {
        wx.switchTab({
            url: '/pages/roomList/roomList'
        });
    },

    /**
     * 重试加载
     */
    retryLoad() {
        this.fetchMyBookings();
    },

    /**
     * 页面滚动到底部
     */
    onReachBottom() {
        if (this.data.hasMore && !this.data.loadingMore) {
            this.loadMore();
        }
    }
});