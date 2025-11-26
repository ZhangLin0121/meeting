// 会议室管理（全新重构）
const request = require('../../utils/request.js');
const WechatAuth = require('../../utils/auth.js');

Page({
    data: {
        statusBarHeight: 20,
        apiBaseUrl: '',
        userOpenId: '',

        loading: true,
        refreshing: false,
        rooms: [],
        filteredRooms: [],
        keyword: '',

        // Bottom Sheet
        showSheet: false,
        sheetVisible: false,
        editing: false,
        currentId: null,
        form: {
            name: '',
            capacity: '',
            location: '',
            equipment: [],
            description: '',
            imagePreview: '',   // 预览（完整URL或临时路径）
            uploadedPath: ''    // 后端返回的相对路径
        },

        equipmentOptions: [
            '投屏设备','麦克风','音响系统','白板','电子白板',
            '视频会议设备','网络接口/Wi-Fi','空调','电话','饮水设备'
        ],
        equipmentOptionsDisplay: []
    },

    onLoad() {
        // 系统信息
        try {
            const wi = wx.getWindowInfo && wx.getWindowInfo();
            this.setData({ statusBarHeight: (wi && wi.statusBarHeight) || 20 });
        } catch (_) {}

        // Base URL & OpenId
        try {
            this.setData({ apiBaseUrl: request.getBaseUrl && request.getBaseUrl() || '' });
            const user = request.getUserInfo && request.getUserInfo();
            this.setData({ userOpenId: user && user.openid || '' });
        } catch (_) {}

        // 权限检查
        this.ensureAdmin().then((ok) => {
            if (ok) this.loadRooms();
        });
    },

    async ensureAdmin() {
        const tryCheck = async () => {
            const res = await request.get('/api/user/role');
            if (!res.success || res.data.role !== 'admin') {
                throw new Error('forbidden');
            }
            return true;
        };

        try {
            return await tryCheck();
        } catch (e) {
        // 可能未登录或会话丢失，尝试登录一次后重试
        try {
            await WechatAuth.performWechatLogin();
                // 重新同步 openid
                try {
                    const u = request.getUserInfo && request.getUserInfo();
                    this.setData({ userOpenId: (u && u.openid) || this.data.userOpenId });
                } catch (_) {}
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

    async loadRooms() {
        try {
            this.setData({ loading: true });
            const limit = 100; // 后端校验最大100
            let page = 1;
            let pages = 1;
            const all = [];

            do {
                // 不带多余query，避免校验出错
                const res = await request.get('/api/rooms', { page, limit });
                if (!res.success) throw new Error(res.message || '加载失败');
                const list = Array.isArray(res.data) ? res.data : [];
                pages = res.pagination && res.pagination.pages ? res.pagination.pages : 1;

                // 归一化与展示图拼接
                for (const r of list) {
                    const id = r._id || r.id;
                    let img = '/images/default_room.png';
                    if (r.images && r.images.length > 0) {
                        const p = r.images[0];
                        img = (typeof p === 'string' && p.startsWith('http')) ? p : `${this.data.apiBaseUrl}${p}`;
                    }
                    const availability = r.availability || 'available';
                    all.push({ ...r, _id: id, displayImage: img, availability });
                }
                page += 1;
            } while (page <= pages);

            this.setData({ rooms: all }, () => this.applyFilter());
        } catch (e) {
            wx.showToast({ title: '加载失败', icon: 'none' });
        } finally {
            this.setData({ loading: false, refreshing: false });
        }
    },

    reloadRooms() { this.loadRooms(); },

    onPullDownRefresh() {
        this.setData({ refreshing: true });
        this.loadRooms().finally(() => wx.stopPullDownRefresh());
    },

    // 搜索
    onSearch(e) {
        this.setData({ keyword: e.detail.value || '' }, () => this.applyFilter());
    },
    clearSearch() { this.setData({ keyword: '' }, () => this.applyFilter()); },
    applyFilter() {
        const kw = (this.data.keyword || '').toLowerCase().trim();
        const filtered = kw ? this.data.rooms.filter(r => {
            return (r.name && r.name.toLowerCase().includes(kw)) ||
                   (r.location && r.location.toLowerCase().includes(kw)) ||
                   (r.roomId && String(r.roomId).toLowerCase().includes(kw));
        }) : this.data.rooms.slice();
        this.setData({ filteredRooms: filtered });
    },

    // 导航
    goBack() { wx.navigateBack({ fail: () => wx.redirectTo({ url: '/pages/roomList/roomList' }) }); },

    // 打开创建/编辑
    openCreate() {
        this.setData({
            showSheet: true,
            sheetVisible: true,
            editing: false,
            currentId: null,
            form: { name: '', capacity: '', location: '', equipment: [], description: '', imagePreview: '', uploadedPath: '' }
        });
        this.updateEquipmentDisplay();
    },
    openEdit(e) {
        const id = e.currentTarget.dataset.id;
        const room = this.data.rooms.find(r => r._id === id);
        if (!room) return;
        this.setData({
            showSheet: true,
            sheetVisible: true,
            editing: true,
            currentId: id,
            form: {
                name: room.name || '',
                capacity: String(room.capacity || ''),
                location: room.location || '',
                equipment: (room.equipment || []).slice(),
                description: room.description || '',
                imagePreview: room.displayImage || '',
                uploadedPath: (room.images && room.images[0]) || ''
            }
        });
        this.updateEquipmentDisplay();
    },
    openActions(e) {
        const id = e.currentTarget.dataset.id2;
        wx.showActionSheet({
            itemList: ['编辑', '删除'],
            success: (res) => {
                if (res.tapIndex === 0) this.openEdit({ currentTarget: { dataset: { id } } });
                if (res.tapIndex === 1) this.removeRoom(id);
            }
        });
    },

    closeSheet() { this.setData({ sheetVisible: false }); setTimeout(() => this.setData({ showSheet: false }), 240); },
    noop() {},
    prevent() {},

    // 表单
    onFormInput(e) {
        const field = e.currentTarget.dataset.field;
        const v = e.detail.value;
        this.setData({ [`form.${field}`]: v });
    },
    toggleEq(e) {
        const eq = e.currentTarget.dataset.eq;
        const arr = this.data.form.equipment.slice();
        const idx = arr.indexOf(eq);
        if (idx > -1) arr.splice(idx, 1); else arr.push(eq);
        this.setData({ 'form.equipment': arr });
        this.updateEquipmentDisplay();
    },
    updateEquipmentDisplay() {
        const selected = new Set(this.data.form.equipment || []);
        const display = (this.data.equipmentOptions || []).map(name => ({ name, selected: selected.has(name) }));
        this.setData({ equipmentOptionsDisplay: display });
    },
    chooseImage() {
        wx.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album','camera'], success: (res) => {
            const filePath = res.tempFiles[0].tempFilePath;
            this.setData({ 'form.imagePreview': filePath, 'form.uploadedPath': '' });
            this.uploadImage(filePath);
        } });
    },
    uploadImage(filePath) {
        const base = this.data.apiBaseUrl;
        const openid = this.data.userOpenId;
        if (!base) return wx.showToast({ title: '上传地址缺失', icon: 'none' });
        wx.uploadFile({
            url: `${base}/api/upload/room-image`,
            filePath,
            name: 'image',
            header: { 'X-User-Openid': openid },
            success: (r) => {
                try {
                    const data = JSON.parse(r.data);
                    if (data && data.success && data.data && data.data.imagePath) {
                        this.setData({ 'form.uploadedPath': data.data.imagePath });
                        wx.showToast({ title: '图片已上传', icon: 'success' });
                    } else {
                        wx.showToast({ title: '上传失败', icon: 'none' });
                    }
                } catch (_) { wx.showToast({ title: '上传失败', icon: 'none' }); }
            },
            fail: () => wx.showToast({ title: '上传失败', icon: 'none' })
        });
    },

    // 提交
    async submit() {
        const f = this.data.form;
        if (!f.name.trim()) return wx.showToast({ title: '请输入名称', icon: 'none' });
        if (!f.capacity || Number(f.capacity) <= 0) return wx.showToast({ title: '请输入容量', icon: 'none' });
        if (!f.location.trim()) return wx.showToast({ title: '请输入位置', icon: 'none' });

        const payload = {
            name: f.name.trim(),
            capacity: parseInt(f.capacity, 10),
            location: f.location.trim(),
            equipment: f.equipment,
            description: (f.description || '').trim()
        };
        if (f.uploadedPath) payload.images = [f.uploadedPath];

        try {
            let res;
            if (this.data.editing) {
                res = await request.put(`/api/rooms/${this.data.currentId}`, payload);
            } else {
                res = await request.post('/api/rooms', payload);
            }
            if (res.success) {
                wx.showToast({ title: this.data.editing ? '已保存' : '已创建', icon: 'success' });
                this.closeSheet();
                this.loadRooms();
            } else {
                throw new Error(res.message || '提交失败');
            }
        } catch (e) {
            wx.showToast({ title: '提交失败', icon: 'none' });
        }
    },

    removeRoom(id) {
        wx.showModal({ title: '确认删除', content: '删除后不可恢复', success: async (r) => {
            if (!r.confirm) return;
            try {
                const res = await request.delete(`/api/rooms/${id}`);
                if (res.success) { wx.showToast({ title: '已删除', icon: 'success' }); this.loadRooms(); }
                else throw new Error(res.message || '删除失败');
            } catch (e) { wx.showToast({ title: '删除失败', icon: 'none' }); }
        } });
    },

    confirmDelete() {
        if (!this.data.editing || !this.data.currentId) return;
        this.removeRoom(this.data.currentId);
    }
});
