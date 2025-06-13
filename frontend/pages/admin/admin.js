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
        apiBaseUrl: '',

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
            '电话'
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
        statusBarHeight: 0
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
    initializePage() {
        // 延迟执行权限检查，确保用户openid已获取
        setTimeout(() => {
            this.checkAdminPermission();
        }, 500);

        this.loadRooms();
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
     * 检查管理员权限
     */
    async checkAdminPermission() {
        try {
            console.log('🔐 检查管理员权限，当前用户openid:', this.data.userOpenId);

            if (!this.data.userOpenId) {
                throw new Error('用户身份信息缺失');
            }

            const result = await this.requestAPI('GET', '/api/user/role');

            if (result.success) {
                console.log('✅ 用户权限检查成功:', result.data);

                if (result.data.role !== 'admin') {
                    wx.showModal({
                        title: '权限不足',
                        content: '您没有管理员权限，无法访问此页面。',
                        showCancel: false,
                        success: () => {
                            wx.navigateBack({
                                delta: 1,
                                fail: () => {
                                    wx.switchTab({
                                        url: '/pages/roomList/roomList'
                                    });
                                }
                            });
                        }
                    });
                }
            } else {
                throw new Error(result.message || '权限检查失败');
            }
        } catch (error) {
            console.error('❌ 管理员权限检查失败:', error);
            wx.showToast({
                title: error.message || '权限验证失败',
                icon: 'none',
                duration: 3000
            });
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

        if (tab === 1 && this.data.bookings.length === 0) {
            this.loadBookings();
        }
    },

    /**
     * 加载会议室列表
     */
    async loadRooms() {
        if (this.data.roomsLoading || !this.data.roomsHasMore) return;

        try {
            this.setData({ roomsLoading: true });

            const result = await this.requestAPI('GET', `/api/rooms?page=${this.data.roomsPage}&limit=10`);

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
        if (this.data.bookingsLoading || !this.data.bookingsHasMore) return;

        try {
            this.setData({ bookingsLoading: true });

            let url = `/api/bookings?page=${this.data.bookingsPage}&limit=10`;

            // 添加筛选条件
            if (this.data.filterDate) {
                url += `&startDate=${this.data.filterDate}&endDate=${this.data.filterDate}`;
            }

            const statusValue = this.data.statusOptions[this.data.filterStatusIndex].value;
            if (statusValue) {
                url += `&status=${statusValue}`;
            }

            const result = await this.requestAPI('GET', url);

            if (result.success && result.data) {
                const newBookings = this.data.bookingsPage === 1 ? result.data : [...this.data.bookings, ...result.data];

                this.setData({
                    bookings: newBookings,
                    bookingsPage: this.data.bookingsPage + 1,
                    bookingsHasMore: result.pagination ? result.pagination.page < result.pagination.pages : false,
                    bookingsLoading: false
                });
            } else {
                throw new Error(result.message || '获取预约记录失败');
            }
        } catch (error) {
            console.error('加载预约记录失败:', error);
            this.setData({ bookingsLoading: false });

            wx.showToast({
                title: '加载失败',
                icon: 'none'
            });
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
        this.refreshBookings();
    },

    /**
     * 筛选状态变化
     */
    onFilterStatusChange(e) {
        this.setData({ filterStatusIndex: parseInt(e.detail.value) });
        this.refreshBookings();
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
        const roomId = e.currentTarget.dataset.roomId;

        // 从最新的rooms数组中查找会议室数据
        const room = this.data.rooms.find(r => r.id === roomId);

        if (!room) {
            wx.showToast({
                title: '会议室数据不存在',
                icon: 'none'
            });
            return;
        }

        // 为防止图片缓存，给图片URL添加时间戳
        const currentImageWithTimestamp = (room.images && room.images.length > 0) ?
            room.images[0] + '?t=' + Date.now() :
            '';

        console.log('📝 编辑会议室 - 会议室数据:', room);
        console.log('📋 当前会议室设备:', room.equipment);
        console.log('🔧 设备选项列表:', this.data.equipmentOptions);

        // 预计算设备选中状态
        const equipmentSelection = {};
        const equipment = room.equipment || [];
        this.data.equipmentOptions.forEach(option => {
            equipmentSelection[option] = equipment.indexOf(option) !== -1;
        });

        this.setData({
            showRoomModal: true,
            isEditMode: true,
            editingRoomId: room.id,
            imageUploading: false,
            equipmentSelection: equipmentSelection, // 新增设备选中状态映射
            roomForm: {
                name: room.name || '',
                capacity: room.capacity ? room.capacity.toString() : '',
                location: room.location || '',
                equipment: equipment,
                description: room.description || '',
                currentImage: currentImageWithTimestamp,
                newImagePath: '',
                uploadedImagePath: '',
                removedCurrentImage: false
            }
        }, () => {
            console.log('✅ 表单数据设置完成');
            console.log('📋 表单中的设备数组:', this.data.roomForm.equipment);
            console.log('🎯 设备选中状态映射:', this.data.equipmentSelection);
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
     * 阻止事件冒泡
     */
    stopPropagation() {
        // 阻止事件冒泡，防止点击弹窗内容时关闭弹窗
    },

    /**
     * 会议室表单输入
     */
    onRoomFormInput(e) {
        const field = e.currentTarget.dataset.field;
        const value = e.detail.value;

        this.setData({
            [`roomForm.${field}`]: value
        });
    },

    /**
     * 切换设备选择
     */
    toggleEquipment(e) {
        console.log('🔧 toggleEquipment 被调用');
        console.log('📱 事件数据:', e.currentTarget.dataset);

        const equipment = e.currentTarget.dataset.equipment;
        const debugInfo = e.currentTarget.dataset.debug;

        console.log(`🎯 点击设备: "${equipment}"`);
        console.log(`🔢 调试信息 - indexOf结果: ${debugInfo}`);
        console.log(`📋 当前roomForm.equipment:`, this.data.roomForm.equipment);
        console.log(`📊 设备数组类型:`, typeof this.data.roomForm.equipment);
        console.log(`✅ 是否为数组:`, Array.isArray(this.data.roomForm.equipment));

        // 确保设备数组是一个有效的数组
        let currentEquipment = this.data.roomForm.equipment;
        if (!Array.isArray(currentEquipment)) {
            currentEquipment = [];
            console.warn('⚠️ 设备数组无效，重置为空数组');
        }

        // 创建新的数组副本
        const newEquipment = [...currentEquipment];

        const index = newEquipment.indexOf(equipment);
        const isCurrentlySelected = index > -1;

        console.log(`🔍 indexOf检查: "${equipment}" 在数组中的位置: ${index}`);
        console.log(`📌 当前选中状态: ${isCurrentlySelected}`);

        if (isCurrentlySelected) {
            // 移除设备（取消选择）
            newEquipment.splice(index, 1);
            console.log(`❌ 取消选择设备: "${equipment}"`);
        } else {
            // 添加设备（选择）
            newEquipment.push(equipment);
            console.log(`✅ 选择设备: "${equipment}"`);
        }

        console.log('🔄 设备状态变化:');
        console.log('  之前选中的设备:', currentEquipment);
        console.log('  现在选中的设备:', newEquipment);

        // 更新设备数组和选中状态映射
        const newEquipmentSelection = {...this.data.equipmentSelection };
        newEquipmentSelection[equipment] = !isCurrentlySelected;

        this.setData({
            'roomForm.equipment': newEquipment,
            'equipmentSelection': newEquipmentSelection
        }, () => {
            // 回调中验证更新是否成功
            const finalSelected = this.data.roomForm.equipment.indexOf(equipment) !== -1;
            const mappedSelected = this.data.equipmentSelection[equipment];
            console.log(`📋 setData完成 - "${equipment}"`);
            console.log(`   数组中状态: ${finalSelected ? '已选中' : '未选中'}`);
            console.log(`   映射中状态: ${mappedSelected ? '已选中' : '未选中'}`);
            console.log(`📊 最终设备数组:`, this.data.roomForm.equipment);
        });

        // 添加触觉反馈
        wx.vibrateShort();
    },

    /**
     * 测试样式渲染（调试用）
     */
    testStyleRender() {
        console.log('🧪 强力测试样式渲染');

        // 创建测试用的设备选中状态
        const testEquipmentSelection = {
            '投屏设备': true,
            '麦克风': true,
            '音响系统': false,
            '白板': true,
            '电子白板': false,
            '视频会议设备': true,
            '网络接口/Wi-Fi': false,
            '空调': false,
            '电话': false
        };

        const testEquipment = ['投屏设备', '麦克风', '白板', '视频会议设备'];

        this.setData({
            'roomForm.equipment': testEquipment,
            'equipmentSelection': testEquipmentSelection
        }, () => {
            console.log('🎨 强力测试数据设置完成');
            console.log('📋 设备数组:', this.data.roomForm.equipment);
            console.log('🎯 选中状态映射:', this.data.equipmentSelection);

            // 验证每个设备的状态
            this.data.equipmentOptions.forEach(option => {
                const inArray = this.data.roomForm.equipment.indexOf(option) !== -1;
                const inMapping = this.data.equipmentSelection[option];
                console.log(`🔍 "${option}": 数组${inArray ? '✅' : '❌'} | 映射${inMapping ? '✅' : '❌'}`);
            });
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
        const { name, capacity, location } = this.data.roomForm;

        // 验证必填字段
        if (!name || !name.trim()) {
            wx.showToast({
                title: '请输入会议室名称',
                icon: 'none'
            });
            return;
        }

        if (!capacity || !capacity.trim()) {
            wx.showToast({
                title: '请输入容纳人数',
                icon: 'none'
            });
            return;
        }

        if (!location || !location.trim()) {
            wx.showToast({
                title: '请输入会议室位置',
                icon: 'none'
            });
            return;
        }

        // 验证容纳人数
        const capacityNum = parseInt(capacity);
        if (isNaN(capacityNum) || capacityNum < 1) {
            wx.showToast({
                title: '请输入正确的容纳人数',
                icon: 'none'
            });
            return;
        }

        try {
            wx.showLoading({ title: '提交中...' });

            const formData = {
                name: name.trim(),
                capacity: capacityNum,
                location: location.trim(),
                equipment: this.data.roomForm.equipment,
                description: this.data.roomForm.description.trim()
            };

            // 处理图片
            if (this.data.roomForm.uploadedImagePath) {
                // 有新上传的图片，使用新图片
                formData.images = [this.data.roomForm.uploadedImagePath];
                console.log('🖼️ 使用新上传的图片:', formData.images);
            } else if (this.data.roomForm.removedCurrentImage) {
                // 用户主动移除了当前图片
                formData.images = [];
                console.log('🗑️ 用户移除了图片');
            } else if (this.data.roomForm.currentImage && this.data.isEditMode) {
                // 编辑模式下保持原有图片 - 去掉时间戳
                const currentImageClean = this.data.roomForm.currentImage.split('?')[0];
                formData.images = [currentImageClean];
                console.log('📁 保持原有图片:', formData.images);
            } else {
                // 没有图片
                formData.images = [];
                console.log('❌ 没有图片');
            }

            console.log('📤 即将提交的表单数据:', formData);

            let result;
            if (this.data.isEditMode) {
                // 编辑会议室
                console.log('✏️ 编辑会议室，ID:', this.data.editingRoomId);
                result = await this.requestAPI('PUT', `/api/rooms/${this.data.editingRoomId}`, formData);
            } else {
                // 添加会议室 - 需要生成roomId
                formData.roomId = `ROOM${Date.now().toString().slice(-6)}`;
                console.log('➕ 添加会议室，roomId:', formData.roomId);
                result = await this.requestAPI('POST', '/api/rooms', formData);
            }

            wx.hideLoading();

            if (result.success) {
                wx.showToast({
                    title: this.data.isEditMode ? '编辑成功' : '添加成功',
                    icon: 'success'
                });

                this.hideRoomModal();

                // 立即强制刷新会议室列表，获取最新数据
                this.forceRefreshRooms();
            } else {
                throw new Error(result.message || '操作失败');
            }
        } catch (error) {
            wx.hideLoading();
            console.error('提交会议室表单失败:', error);

            wx.showToast({
                title: error.message || '操作失败',
                icon: 'none'
            });
        }
    },

    /**
     * 删除会议室
     */
    deleteRoom(e) {
        const roomId = e.currentTarget.dataset.roomId;
        const roomName = e.currentTarget.dataset.roomName;

        wx.showModal({
            title: '确认删除',
            content: `确定要删除会议室"${roomName}"吗？此操作不可恢复。`,
            confirmText: '删除',
            confirmColor: '#ff3b30',
            success: async(res) => {
                if (res.confirm) {
                    try {
                        wx.showLoading({ title: '删除中...' });

                        const result = await this.requestAPI('DELETE', `/api/rooms/${roomId}`);

                        wx.hideLoading();

                        if (result.success) {
                            wx.showToast({
                                title: '删除成功',
                                icon: 'success'
                            });

                            this.refreshRooms();
                        } else {
                            throw new Error(result.message || '删除失败');
                        }
                    } catch (error) {
                        wx.hideLoading();
                        console.error('删除会议室失败:', error);

                        wx.showToast({
                            title: error.message || '删除失败',
                            icon: 'none'
                        });
                    }
                }
            }
        });
    },

    /**
     * 取消预约
     */
    cancelBooking(e) {
        const bookingId = e.currentTarget.dataset.bookingId;
        const bookingInfo = e.currentTarget.dataset.bookingInfo;

        wx.showModal({
            title: '确认取消',
            content: `确定要取消"${bookingInfo.topic}"的预约吗？`,
            confirmText: '取消预约',
            confirmColor: '#ff3b30',
            success: async(res) => {
                if (res.confirm) {
                    try {
                        wx.showLoading({ title: '取消中...' });

                        const result = await this.requestAPI('DELETE', `/api/bookings/${bookingId}`);

                        wx.hideLoading();

                        if (result.success) {
                            wx.showToast({
                                title: '取消成功',
                                icon: 'success'
                            });

                            this.refreshBookings();
                        } else {
                            throw new Error(result.message || '取消失败');
                        }
                    } catch (error) {
                        wx.hideLoading();
                        console.error('取消预约失败:', error);

                        wx.showToast({
                            title: error.message || '取消失败',
                            icon: 'none'
                        });
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
    }
});