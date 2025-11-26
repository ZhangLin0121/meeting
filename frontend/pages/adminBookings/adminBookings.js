const request = require('../../utils/request.js');
const WechatAuth = require('../../utils/auth.js');

Page({
    data: {
        statusBarHeight: 20,
        bookings: [],
        bookingsLoading: false,
        bookingsPage: 1,
        bookingsHasMore: true,
        exporting: false,
        filterStatus: 'active',
        filteredBookings: [],
        stats: {
            total: 0,
            active: 0,
            completed: 0,
            cancelled: 0
        }
    },

    onLoad() {
        try {
            const wi = wx.getWindowInfo && wx.getWindowInfo();
            this.setData({ statusBarHeight: (wi && wi.statusBarHeight) || 20 });
        } catch (_) {}
        this.ensureAdmin().then((ok) => {
            if (ok) this.loadBookings(true);
        });
    },

    async ensureAdmin() {
        const tryCheck = async () => {
            const res = await request.get('/api/user/role');
            if (!res.success || res.data.role !== 'admin') throw new Error('forbidden');
            return true;
        };
        try {
            return await tryCheck();
        } catch (e) {
            try {
                await WechatAuth.performWechatLogin();
                return await tryCheck();
            } catch (err) {
                wx.showModal({
                    title: '权限不足',
                    content: '此页面仅限管理员访问或登录已失效',
                    showCancel: false,
                    success: () => wx.navigateBack()
                });
                return false;
            }
        }
    },

    async loadBookings(reset = false) {
        if (this.data.bookingsLoading) return;
        try {
            this.setData({ bookingsLoading: true });
            const page = reset ? 1 : this.data.bookingsPage;
            const limit = 20;
            const res = await request.get('/api/bookings', { page, limit });
            if (!res.success) throw new Error(res.message || '加载失败');
            const now = Date.now();
            const list = (res.data || []).map((b, idx) => {
                const start = new Date(`${b.bookingDate} ${b.startTime}`).getTime();
                const end = new Date(`${b.bookingDate} ${b.endTime}`).getTime();
                let displayStatus = '已预约';
                let cls = 'ok';
                if (b.status === 'cancelled') { displayStatus = '已取消'; cls = 'closed'; }
                else if (now > end) { displayStatus = '已完成'; cls = 'muted'; }
                else if (now >= start && now <= end) { displayStatus = '进行中'; cls = 'busy'; }
                const baseId = b.id || b._id || 'booking';
                // uniqueKey 避免 wx:key 冲突（同一房间或重复数据也能区分）
                const uniqueKey = `${baseId}-${page}-${idx}`;
                return { ...b, displayStatus, displayStatusClass: cls, uniqueKey };
            });
            const pages = (res.pagination && res.pagination.pages)
                || (list.length === limit ? page + 1 : page);
            const merged = page === 1 ? list : this.data.bookings.concat(list);
            this.setData({
                bookings: merged,
                bookingsPage: page + 1,
                bookingsHasMore: page < pages
            });
            this.applyFilter();
        } catch (e) {
            wx.showToast({ title: '加载预约失败', icon: 'none' });
            this.setData({ bookingsHasMore: false });
        } finally {
            this.setData({ bookingsLoading: false });
        }
    },

    loadMoreBookings() {
        if (this.data.bookingsHasMore && !this.data.bookingsLoading) {
            this.loadBookings(false);
        }
    },

    async exportBookings() {
        if (this.data.exporting) return;
        try {
            this.setData({ exporting: true });
            wx.showLoading({ title: '正在导出...', mask: true });
            const res = await request.get('/api/bookings/export', { format: 'excel' });
            if (!res || !res.success || !res.data || !res.data.downloadUrl) {
                throw new Error(res && res.message ? res.message : '导出失败');
            }
            const url = res.data.downloadUrl;
            wx.downloadFile({
                url,
                success: (r) => {
                    const filePath = r.tempFilePath;
                    wx.openDocument({
                        filePath,
                        fileType: 'xlsx',
                        showMenu: true,
                        success: () => wx.showToast({ title: '已打开导出文件', icon: 'success' }),
                        fail: () => wx.showToast({ title: '打开文件失败', icon: 'none' })
                    });
                },
                fail: () => {
                    wx.setClipboardData({ data: url, success: () => wx.showToast({ title: '已复制下载链接', icon: 'none' }) });
                },
                complete: () => wx.hideLoading()
            });
        } catch (e) {
            wx.hideLoading();
            wx.showToast({ title: e.message || '导出失败', icon: 'none' });
        } finally {
            this.setData({ exporting: false });
        }
    },

    async adminCancelBooking(e) {
        const id = e.currentTarget.dataset.id;
        wx.showModal({
            title: '取消预约',
            content: '确认取消该预约吗？',
            success: async (res) => {
                if (!res.confirm) return;
                try {
                    const r = await request.delete(`/api/bookings/${id}`);
                    if (r.success) {
                        wx.showToast({ title: '已取消', icon: 'success' });
                        this.setData({ bookingsPage: 1, bookings: [] });
                        this.loadBookings(true);
                    } else {
                        throw new Error(r.message || '取消失败');
                    }
                } catch (err) {
                    wx.showToast({ title: '取消失败', icon: 'none' });
                }
            }
        });
    },

    onReachBottom() {
        this.loadMoreBookings();
    },

    goBack() {
        wx.navigateBack({ fail: () => wx.redirectTo({ url: '/pages/admin/admin' }) });
    },

    onFilterChange(e) {
        const s = e.currentTarget.dataset.status || 'all';
        this.setData({ filterStatus: s }, () => this.applyFilter());
    },

    applyFilter() {
        const status = this.data.filterStatus;
        const match = (b) => {
            if (!b) return false;
            if (status === 'all') return true;
            if (status === 'active') return b.displayStatus === '已预约' || b.displayStatus === '进行中';
            if (status === 'cancelled') return b.status === 'cancelled' || b.displayStatus === '已取消';
            if (status === 'completed') return b.displayStatus === '已完成';
            return true;
        };
        const all = this.data.bookings || [];
        const filtered = all.filter(match);

        const stats = {
            total: all.length,
            active: all.filter(b => b && (b.displayStatus === '已预约' || b.displayStatus === '进行中')).length,
            completed: all.filter(b => b && b.displayStatus === '已完成').length,
            cancelled: all.filter(b => b && (b.status === 'cancelled' || b.displayStatus === '已取消')).length
        };

        this.setData({
            filteredBookings: filtered,
            stats
        });
    }
});
