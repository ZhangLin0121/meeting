const request = require('../../utils/request.js');
const WechatAuth = require('../../utils/auth.js');

Page({
    data: {
        upcomingBookings: [],
        pastBookings: [],
        loading: true,
        refreshing: false,
        loadingMore: false,
        isEmpty: false,
        error: '',
        userOpenId: '',
        statusBarHeight: 20,
        hasMore: false,
        currentPage: 1,
        pageSize: 20,
        apiBaseUrl: '',
        // 跳转聚焦支持
        pendingFocus: '',
        scrollIntoView: '',
        highlightUpcoming: false,
        highlightPast: false,
        filterStatus: 'all',
        displayUpcoming: [],
        displayPast: []
    },

    async onLoad(options) {
        try {
            const wi = wx.getWindowInfo && wx.getWindowInfo();
            this.setData({ statusBarHeight: (wi && wi.statusBarHeight) || 20 });
        } catch(_){}

        this.setData({ apiBaseUrl: request.getBaseUrl && request.getBaseUrl() || '' });

        // 读取来自个人资料页的跳转参数
        if (options && options.focus) {
            const f = String(options.focus || '').toLowerCase();
            if (['upcoming','past','all'].includes(f)) this.setData({ pendingFocus: f });
        }

        await this.ensureLogin();
        await this.fetchMyBookings();
        this.applyFocus();
    },

    async onShow() {
        // 支持从 tabBar 切换携带的聚焦参数（通过 storage）
        try {
            const f = wx.getStorageSync('__myBookingsFocus');
            if (f) {
                this.setData({ pendingFocus: String(f).toLowerCase() });
                wx.removeStorageSync('__myBookingsFocus');
            }
        } catch(_){}

        if (this.data.userOpenId) {
            await this.fetchMyBookings();
            this.applyFocus();
        }
    },



    /**
     * 获取我的预约记录
     */
    async fetchMyBookings(isRefresh = false, isLoadMore = false) {
        if (!this.data.userOpenId) {
            await this.ensureLogin();
            if (!this.data.userOpenId) {
                this.setData({ isEmpty: true, upcomingBookings: [], pastBookings: [] });
                return;
            }
        }

        if (isRefresh) this.setData({ refreshing: true });
        else if (isLoadMore) this.setData({ loadingMore: true });
        else this.setData({ loading: true });

        this.setData({ error: '', isEmpty: false });
        try {
            const page = isLoadMore ? this.data.currentPage + 1 : 1;
            const result = await request.get('/api/user/bookings', { page, pageSize: this.data.pageSize });
            if (!result.success || !result.data) throw new Error(result.message || '获取预约记录失败');

            const { upcomingBookings, pastBookings, hasMore, pagination } = result.data;

            const normalize = (list) => list.map(b => ({
                ...b,
                createdAtFmt: this.formatDate(b.createdAt),
                // 拼接首图
                roomImageUrl: b.roomImage ? (b.roomImage.startsWith('http') ? b.roomImage : `${this.data.apiBaseUrl}${b.roomImage}`) : '/images/default_room.png'
            }));

            // 过滤掉已取消的记录，不计入“即将开始”
            const filteredUpcoming = (upcomingBookings || []).filter(b => b && b.status !== 'cancelled');
            const formattedUpcoming = normalize(filteredUpcoming);
            // 历史记录保留已取消，便于追溯
            const formattedPast = normalize(pastBookings || []);

            const pages = (pagination && pagination.pages) || ((formattedUpcoming.length + formattedPast.length) === this.data.pageSize ? page + 1 : page);

            if (isLoadMore) {
                this.setData({
                    upcomingBookings: this.data.upcomingBookings.concat(formattedUpcoming),
                    pastBookings: this.data.pastBookings.concat(formattedPast),
                    hasMore: !!(hasMore || (pagination && pagination.hasMore)),
                    currentPage: page,
                });
            } else {
            this.setData({
                upcomingBookings: formattedUpcoming,
                pastBookings: formattedPast,
                hasMore: !!(hasMore || (pagination && pagination.hasMore) || (page < pages)),
                currentPage: 1,
                isEmpty: formattedUpcoming.length === 0 && formattedPast.length === 0
            });
            }
            this.applyFilter();
        } catch (e) {
            if (!isLoadMore) this.setData({ error: e.message || '加载失败' });
            else wx.showToast({ title: '加载失败', icon: 'none' });
        } finally {
            this.setData({ loading: false, refreshing: false, loadingMore: false });
        }
    },

    // 应用滚动定位与高亮
    applyFocus() {
        const f = this.data.pendingFocus;
        if (!f) return;
        if (f === 'upcoming' && this.data.upcomingBookings.length) {
            this.setData({ scrollIntoView: 'upcomingSection', highlightUpcoming: true });
            setTimeout(() => this.setData({ highlightUpcoming: false }), 1000);
        } else if (f === 'past' && this.data.pastBookings.length) {
            this.setData({ scrollIntoView: 'pastSection', highlightPast: true });
            setTimeout(() => this.setData({ highlightPast: false }), 1000);
        } else if (f === 'upcoming') {
            wx.showToast({ title: '暂无即将开始的预约', icon: 'none' });
        } else if (f === 'past') {
            wx.showToast({ title: '暂无历史预约', icon: 'none' });
        }
        this.setData({ pendingFocus: '', filterStatus: 'active' }, () => this.applyFilter());
    },

    /**
     * 切换筛选
     */
    onFilterChange(e) {
        const status = e.currentTarget.dataset.status;
        this.setData({ filterStatus: status }, () => this.applyFilter());
    },

    /**
     * 根据筛选状态生成展示列表
     */
    applyFilter() {
        const { filterStatus, upcomingBookings, pastBookings } = this.data;

        const match = (item) => {
            if (!item) return false;
            if (filterStatus === 'all') return true;
            if (filterStatus === 'active') return item.status !== 'cancelled';
            if (filterStatus === 'cancelled') return item.status === 'cancelled';
            return true;
        };

        this.setData({
            displayUpcoming: (upcomingBookings || []).filter(match),
            displayPast: (pastBookings || []).filter(match)
        });
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
    },

    async ensureLogin() {
        try {
            const openid = WechatAuth.getUserOpenId();
            if (openid) { this.setData({ userOpenId: openid }); return; }
            const info = await WechatAuth.smartLogin();
            if (info && info.openid) this.setData({ userOpenId: info.openid });
        } catch (e) {
            this.setData({ error: '登录失败，请重试' });
        }
    },

    async cancelBooking(e) {
        const id = e.currentTarget.dataset.id;
        const b = e.currentTarget.dataset.b;
        if (!id) return;
        wx.showModal({
            title: '取消预约',
            content: `确定取消“${b.topic || b.conferenceRoomName}”吗？`,
            success: async (res) => {
                if (!res.confirm) return;
                try {
                    const r = await request.delete(`/api/bookings/${id}`);
                    if (r.success) {
                        wx.showToast({ title: '已取消', icon: 'success' });
                        this.fetchMyBookings();
                    } else throw new Error(r.message || '取消失败');
                } catch (err) {
                    wx.showToast({ title: '取消失败', icon: 'none' });
                }
            }
        });
    }
});
