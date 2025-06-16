const request = require('../../utils/request.js');

Page({

    /**
     * 页面的初始数据
     */
    data: {
        // 当前选项卡：0-会议室管理，1-预约记录
        currentTab: 0,

        // 用户信息
        userOpenId: '',

        // 会议室管理相关
        rooms: [],
        roomsLoading: false,
        roomsPage: 1,
        roomsHasMore: true,

        // 预约记录相关
        bookings: [],
        bookingsLoading: false,
        bookingsPage: 1,
        bookingsHasMore: true,

        // 筛选条件
        filterDate: '',
        filterStatusIndex: 0,
        statusOptions: [
            { value: '', text: '全部状态' },
            { value: 'booked', text: '已预约' },
            { value: 'completed', text: '已完成' },
            { value: 'cancelled', text: '已取消' }
        ],

        // 会议室表单弹窗
        showRoomModal: false,
        isEditMode: false,
        editingRoomId: null,
        roomForm: {
            name: '',
            capacity: '',
            location: '',
            equipment: [],
            description: '',
            currentImage: '', // 当前图片路径（编辑时）
            newImagePath: '', // 新选择的图片本地路径
            uploadedImagePath: '' // 上传后的图片路径
        },

        // 图片上传相关
        imageUploading: false,
        apiBaseUrl: 'https://www.cacophonyem.me/meeting',

        // 设备选项
        equipmentOptions: [
            '投屏设备',
            '麦克风',
            '音响系统',
            '白板',
            '电子白板',
            '视频会议设备',
            '网络接口/Wi-Fi',
            '空调',
            '饮水设备'
        ],

        activeTab: 'rooms',
        showAddRoomModal: false,
        showEditRoomModal: false,
        newRoom: {
            name: '',
            capacity: '',
            location: '',
            description: '',
            equipment: '',
            imageUrl: ''
        },
        editingRoom: null,
        statusBarHeight: 0,

        // 系统信息相关
        menuButtonInfo: null,
        customNavBarHeight: 0
    },

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad(options) {
        console.log('管理员页面加载');

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

                // 初始化页面
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
     * 初始化页面
     */
    async initializePage() {
        await this.checkAdminPermission();
        this.loadRooms();
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
            console.error('❌ 获取系统信息失败:', error);
            this.setData({
                statusBarHeight: 20, // 默认值
                customNavBarHeight: 44 // 默认值
            });
        }
    },

    /**
     * 检查管理员权限
     */
    async checkAdminPermission() {
        try {
            const result = await this.requestAPI('GET', '/api/user/role');
            if (!result.success || !result.data.isAdmin) {
                wx.showModal({
                    title: '权限不足',
                    content: '您没有管理员权限',
                    showCancel: false,
                    success: () => wx.navigateBack()
                });
            }
        } catch (error) {
            wx.showToast({ title: '权限验证失败', icon: 'none' });
            wx.navigateBack();
        }
    },

    /**
     * 生命周期函数--监听页面显示
     */
    onShow() {
        console.log('📱 管理员页面显示，当前用户openid:', this.data.userOpenId);

        // 确保有用户openid
        if (!this.data.userOpenId) {
            console.log('⚠️ 缺少用户openid，重新获取');
            this.getUserOpenId();

            // 等待获取openid后再刷新数据
            setTimeout(() => {
                this.refreshCurrentTabData();
            }, 500);
        } else {
            // 立即刷新数据
            this.refreshCurrentTabData();
        }
    },

    /**
     * 刷新当前选项卡的数据
     */
    refreshCurrentTabData() {
        if (this.data.currentTab === 0) {
            this.refreshRooms();
        } else {
            this.refreshBookings();
        }
    },

    /**
     * 下拉刷新
     */
    onPullDownRefresh() {
        if (this.data.currentTab === 0) {
            this.refreshRooms();
        } else {
            this.refreshBookings();
        }

        setTimeout(() => {
            wx.stopPullDownRefresh();
        }, 1000);
    },

    /**
     * 返回到会议室列表页面
     */
    goBackToRoomList() {
        wx.navigateBack({
            delta: 1,
            fail: () => {
                // 如果没有上级页面，则跳转到会议室列表页面
                wx.redirectTo({
                    url: '/pages/roomList/roomList'
                });
            }
        });
    },

    /**
     * 切换选项卡
     */
    switchTab(e) {
        const tab = parseInt(e.currentTarget.dataset.tab);
        this.setData({ currentTab: tab });
        if (tab === 0) {
            this.loadRooms();
        } else {
            this.loadBookings();
        }
    },

    /**
     * 加载会议室列表
     */
    async loadRooms() {
        this.setData({ roomsLoading: true });
        try {
            const result = await this.requestAPI('GET', '/api/rooms?includeDetails=true');
            if (result.success) {
                this.setData({ rooms: result.data || [] });
            }
        } catch (error) {
            wx.showToast({ title: '加载会议室失败', icon: 'none' });
        } finally {
            this.setData({ roomsLoading: false });
        }
    },

    /**
     * 刷新会议室列表
     */
    refreshRooms() {
        this.setData({
            rooms: [],
            roomsPage: 1,
            roomsHasMore: true
        });
        this.loadRooms();
    },

    /**
     * 强制刷新会议室列表（清除缓存）
     */
    forceRefreshRooms() {
        // 强制清除所有缓存数据
        this.setData({
            rooms: [],
            roomsPage: 1,
            roomsHasMore: true,
            roomsLoading: false
        });

        // 立即重新加载，带上时间戳防止缓存
        this.loadRoomsWithTimestamp();
    },

    /**
     * 加载更多会议室
     */
    loadMoreRooms() {
        this.loadRooms();
    },

    /**
     * 带时间戳加载会议室（强制从数据库获取最新数据）
     */
    async loadRoomsWithTimestamp() {
        if (this.data.roomsLoading || !this.data.roomsHasMore) return;

        try {
            this.setData({ roomsLoading: true });

            // 添加时间戳防止缓存
            const timestamp = Date.now();
            const result = await this.requestAPI('GET', `/api/rooms?page=${this.data.roomsPage}&limit=10&t=${timestamp}`);

            if (result.success && result.data) {
                // 🔧 预处理数据：为每个房间添加Apple Design所需字段
                const processedRooms = result.data.map(room => {
                    // 处理设备数量显示
                    let equipmentCount = 0;
                    let equipmentDisplay = '暂无设备';

                    if (room.equipment && Array.isArray(room.equipment) && room.equipment.length > 0) {
                        equipmentCount = room.equipment.length;
                        equipmentDisplay = room.equipment.join(', ');
                    }

                    // 处理图片URL
                    let imageUrl = null;
                    if (room.images && Array.isArray(room.images) && room.images.length > 0) {
                        imageUrl = this.data.apiBaseUrl + room.images[0];
                    }

                    return {
                        ...room,
                        equipmentDisplay: equipmentDisplay,
                        equipmentCount: equipmentCount,
                        imageUrl: imageUrl
                    };
                });

                const newRooms = this.data.roomsPage === 1 ? processedRooms : [...this.data.rooms, ...processedRooms];

                this.setData({
                    rooms: newRooms,
                    roomsPage: this.data.roomsPage + 1,
                    roomsHasMore: result.pagination ? result.pagination.page < result.pagination.pages : false,
                    roomsLoading: false
                });
            } else {
                throw new Error(result.message || '获取会议室列表失败');
            }
        } catch (error) {
            console.error('加载会议室列表失败:', error);
            this.setData({ roomsLoading: false });

            wx.showToast({
                title: '加载失败',
                icon: 'none'
            });
        }
    },

    /**
     * 加载预约记录
     */
    async loadBookings() {
        this.setData({ bookingsLoading: true });
        try {
            let url = '/api/bookings?includeRoomDetails=true';
            if (this.data.filterDate) {
                url += `&date=${this.data.filterDate}`;
            }
            if (this.data.statusOptions[this.data.filterStatusIndex].value) {
                url += `&status=${this.data.statusOptions[this.data.filterStatusIndex].value}`;
            }

            const result = await this.requestAPI('GET', url);
            if (result.success) {
                this.setData({ bookings: result.data || [] });
            }
        } catch (error) {
            wx.showToast({ title: '加载预约失败', icon: 'none' });
        } finally {
            this.setData({ bookingsLoading: false });
        }
    },

    /**
     * 刷新预约记录
     */
    refreshBookings() {
        this.setData({
            bookings: [],
            bookingsPage: 1,
            bookingsHasMore: true
        });
        this.loadBookings();
    },

    /**
     * 加载更多预约记录
     */
    loadMoreBookings() {
        this.loadBookings();
    },

    /**
     * 筛选日期变化
     */
    onFilterDateChange(e) {
        this.setData({ filterDate: e.detail.value });
        this.loadBookings();
    },

    /**
     * 筛选状态变化
     */
    onFilterStatusChange(e) {
        this.setData({ filterStatusIndex: parseInt(e.detail.value) });
        this.loadBookings();
    },

    /**
     * 显示添加会议室弹窗
     */
    showAddRoomModal() {
        console.log('➕ 添加新会议室 - 初始化空表单');

        // 新增时所有设备都不选中
        const equipmentSelection = {};
        this.data.equipmentOptions.forEach(option => {
            equipmentSelection[option] = false;
        });

        this.setData({
            showRoomModal: true,
            isEditMode: false,
            editingRoomId: null,
            imageUploading: false,
            equipmentSelection: equipmentSelection, // 新增设备选中状态映射
            roomForm: {
                name: '',
                capacity: '',
                location: '',
                equipment: [], // 新增时所有设备都不选中
                description: '',
                currentImage: '',
                newImagePath: '',
                uploadedImagePath: '',
                removedCurrentImage: false
            }
        }, () => {
            console.log('✅ 新增表单初始化完成');
            console.log('📋 初始设备数组:', this.data.roomForm.equipment);
            console.log('🎯 设备选中状态映射:', this.data.equipmentSelection);
        });
    },

    /**
     * 编辑会议室
     */
    editRoom(e) {
        const room = e.currentTarget.dataset.room;

        // 设置设备选中状态
        const equipmentSelection = {};
        this.data.equipmentOptions.forEach(option => {
            equipmentSelection[option] = Array.isArray(room.equipment) && room.equipment.includes(option);
        });

        this.setData({
            showRoomModal: true,
            isEditMode: true,
            editingRoomId: room.id,
            equipmentSelection: equipmentSelection,
            roomForm: {
                name: room.name || '',
                capacity: room.capacity ? room.capacity.toString() : '',
                location: room.location || '',
                equipment: Array.isArray(room.equipment) ? room.equipment : [],
                description: room.description || '',
                currentImage: room.imageUrl || '', // 设置当前图片路径
                newImagePath: '',
                uploadedImagePath: '',
                removedCurrentImage: false
            }
        });

        console.log('📝 编辑会议室数据:', {
            roomId: room.id,
            currentImage: room.imageUrl,
            equipment: room.equipment
        });
    },

    /**
     * 隐藏会议室弹窗
     */
    hideRoomModal() {
        // 完全重置表单状态，防止数据残留
        const emptyEquipmentSelection = {};
        this.data.equipmentOptions.forEach(option => {
            emptyEquipmentSelection[option] = false;
        });

        this.setData({
            showRoomModal: false,
            isEditMode: false,
            editingRoomId: null,
            imageUploading: false,
            equipmentSelection: emptyEquipmentSelection, // 重置设备选中状态映射
            roomForm: {
                name: '',
                capacity: '',
                location: '',
                equipment: [], // 确保设备数组重置为空
                description: '',
                currentImage: '',
                newImagePath: '',
                uploadedImagePath: '',
                removedCurrentImage: false
            }
        });
    },

    /**
     * 会议室表单输入
     */
    onRoomFormInput(e) {
        const field = e.currentTarget.dataset.field;
        this.setData({
            [`roomForm.${field}`]: e.detail.value
        });
    },

    /**
     * 切换设备选择
     */
    toggleEquipment(e) {
        const equipment = e.currentTarget.dataset.equipment;
        const currentEquipment = [...this.data.roomForm.equipment];
        const index = currentEquipment.indexOf(equipment);

        if (index > -1) {
            currentEquipment.splice(index, 1);
        } else {
            currentEquipment.push(equipment);
        }

        this.setData({
            'roomForm.equipment': currentEquipment
        });
    },

    /**
     * 选择图片
     */
    chooseImage() {
        wx.chooseImage({
            count: 1,
            sizeType: ['compressed'],
            sourceType: ['album', 'camera'],
            success: (res) => {
                const tempFilePath = res.tempFilePaths[0];

                this.setData({
                    'roomForm.newImagePath': tempFilePath,
                    'roomForm.uploadedImagePath': '', // 清除之前上传的图片路径
                });

                // 立即上传图片
                this.uploadImage(tempFilePath);
            },
            fail: (error) => {
                console.error('选择图片失败:', error);
                wx.showToast({
                    title: '选择图片失败',
                    icon: 'none'
                });
            }
        });
    },

    /**
     * 上传图片
     */
    async uploadImage(filePath) {
        try {
            this.setData({ imageUploading: true });

            const uploadResult = await new Promise((resolve, reject) => {
                wx.uploadFile({
                    url: `${this.data.apiBaseUrl}/api/upload/room-image`,
                    filePath: filePath,
                    name: 'image',
                    header: {
                        'X-User-Openid': this.data.userOpenId
                    },
                    success: (res) => {
                        console.log('图片上传响应:', res);

                        // 检查HTTP状态码
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            try {
                                const data = JSON.parse(res.data);
                                if (data.success) {
                                    resolve(data.data);
                                } else {
                                    reject(new Error(data.message || '上传失败'));
                                }
                            } catch (error) {
                                reject(new Error('解析响应失败'));
                            }
                        } else {
                            // HTTP状态码错误
                            try {
                                const errorData = JSON.parse(res.data);
                                reject(new Error(errorData.message || `HTTP ${res.statusCode}: API接口不存在`));
                            } catch (error) {
                                reject(new Error(`HTTP ${res.statusCode}: API接口不存在`));
                            }
                        }
                    },
                    fail: (error) => {
                        reject(error);
                    }
                });
            });

            this.setData({
                'roomForm.uploadedImagePath': uploadResult.imagePath,
                imageUploading: false
            });

            wx.showToast({
                title: '图片上传成功',
                icon: 'success'
            });

        } catch (error) {
            console.error('上传图片失败:', error);
            this.setData({ imageUploading: false });

            wx.showToast({
                title: error.message || '图片上传失败',
                icon: 'none'
            });

            // 上传失败时清除新图片
            this.setData({
                'roomForm.newImagePath': ''
            });
        }
    },

    /**
     * 移除当前图片
     */
    removeCurrentImage() {
        this.setData({
            'roomForm.currentImage': '',
            'roomForm.removedCurrentImage': true // 标记已移除当前图片
        });
    },

    /**
     * 移除新选择的图片
     */
    removeNewImage() {
        // 如果已经上传了，需要删除服务器上的文件
        if (this.data.roomForm.uploadedImagePath) {
            this.deleteUploadedImage(this.data.roomForm.uploadedImagePath);
        }

        this.setData({
            'roomForm.newImagePath': '',
            'roomForm.uploadedImagePath': ''
        });

        wx.showToast({
            title: '已移除图片',
            icon: 'success'
        });
    },

    /**
     * 删除已上传的图片
     */
    async deleteUploadedImage(imagePath) {
        try {
            await this.requestAPI('DELETE', '/api/upload/room-image', {
                imagePath: imagePath
            });
        } catch (error) {
            console.error('删除图片失败:', error);
        }
    },

    /**
     * 提交会议室表单
     */
    async submitRoomForm() {
        const { name, capacity, location, equipment, description } = this.data.roomForm;

        if (!name || !name.trim()) {
            wx.showToast({ title: '请输入会议室名称', icon: 'none' });
            return;
        }
        if (!capacity || !capacity.trim()) {
            wx.showToast({ title: '请输入容纳人数', icon: 'none' });
            return;
        }

        const roomData = {
            name: name.trim(),
            capacity: parseInt(capacity),
            location: location.trim(),
            equipment,
            description: description.trim()
        };

        try {
            wx.showLoading({ title: this.data.isEditMode ? '更新中...' : '创建中...' });

            let result;
            if (this.data.isEditMode) {
                result = await this.requestAPI('PUT', `/api/rooms/${this.data.editingRoomId}`, roomData);
            } else {
                result = await this.requestAPI('POST', '/api/rooms', roomData);
            }

            if (result.success) {
                wx.showToast({
                    title: this.data.isEditMode ? '更新成功' : '创建成功',
                    icon: 'success'
                });
                this.hideRoomModal();
                this.loadRooms();
            } else {
                throw new Error(result.message || '操作失败');
            }
        } catch (error) {
            wx.showToast({ title: error.message || '操作失败', icon: 'none' });
        } finally {
            wx.hideLoading();
        }
    },

    /**
     * 删除会议室
     */
    deleteRoom(e) {
        const room = e.currentTarget.dataset.room;
        wx.showModal({
            title: '确认删除',
            content: `确定要删除会议室 "${room.name}" 吗？`,
            success: async(res) => {
                if (res.confirm) {
                    try {
                        wx.showLoading({ title: '删除中...' });
                        const result = await this.requestAPI('DELETE', `/api/rooms/${room.id}`);
                        if (result.success) {
                            wx.showToast({ title: '删除成功', icon: 'success' });
                            this.loadRooms();
                        } else {
                            throw new Error(result.message || '删除失败');
                        }
                    } catch (error) {
                        wx.showToast({ title: error.message || '删除失败', icon: 'none' });
                    } finally {
                        wx.hideLoading();
                    }
                }
            }
        });
    },

    /**
     * 取消预约
     */
    cancelBooking(e) {
        const booking = e.currentTarget.dataset.booking;
        wx.showModal({
            title: '确认取消',
            content: `确定要取消这个预约吗？`,
            success: async(res) => {
                if (res.confirm) {
                    try {
                        wx.showLoading({ title: '取消中...' });
                        const result = await this.requestAPI('PUT', `/api/bookings/${booking.id}/cancel`);
                        if (result.success) {
                            wx.showToast({ title: '取消成功', icon: 'success' });
                            this.loadBookings();
                        } else {
                            throw new Error(result.message || '取消失败');
                        }
                    } catch (error) {
                        wx.showToast({ title: error.message || '取消失败', icon: 'none' });
                    } finally {
                        wx.hideLoading();
                    }
                }
            }
        });
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