// 管理员页面 - 模块化重构版
const AdminRoomService = require('./services/AdminRoomService.js');
const AdminBookingService = require('./services/AdminBookingService.js');
const AdminImageService = require('./services/AdminImageService.js');
const AdminUtilService = require('./services/AdminUtilService.js');

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
            '饮水设备'
        ],

        // 系统信息相关
        statusBarHeight: 0,
        menuButtonInfo: null,
        customNavBarHeight: 0
    },

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad(options) {
        console.log('管理员页面加载');

        // 安全获取App数据
        AdminUtilService.safeGetAppData(this);

        // 获取系统信息
        AdminUtilService.getSystemInfo(this);
    },

    /**
     * 生命周期函数--监听页面显示
     */
    onShow() {
        console.log('管理员页面显示');
        
        // 刷新当前选项卡的数据
        AdminUtilService.refreshCurrentTabData(this);
    },

    /**
     * 页面相关事件处理函数--监听用户下拉动作
     */
    onPullDownRefresh() {
        console.log('下拉刷新');
        
        if (this.data.currentTab === 0) {
            AdminRoomService.refreshRooms(this);
        } else {
            AdminBookingService.refreshBookings(this);
        }
        
        // 停止下拉刷新动画
        setTimeout(() => {
            wx.stopPullDownRefresh();
        }, 1000);
    },

    // ==================== 导航相关方法 ====================

    /**
     * 返回会议室列表
     */
    goBackToRoomList() {
        AdminUtilService.goBackToRoomList();
    },

    /**
     * 跳转到调试页面
     */
    goToDebug() {
        AdminUtilService.goToDebug();
    },

    // ==================== 选项卡切换 ====================

    /**
     * 切换选项卡
     */
    switchTab(e) {
        AdminUtilService.switchTab(this, e);
        
        // 加载对应数据
        if (this.data.currentTab === 0) {
            AdminRoomService.loadRooms(this);
        } else if (this.data.currentTab === 1) {
            AdminBookingService.loadBookings(this);
        }
    },

    // ==================== 会议室管理相关方法 ====================

    /**
     * 加载会议室列表
     */
    async loadRooms() {
        await AdminRoomService.loadRooms(this);
    },

    /**
     * 刷新会议室列表
     */
    refreshRooms() {
        AdminRoomService.refreshRooms(this);
    },

    /**
     * 强制刷新会议室列表
     */
    forceRefreshRooms() {
        AdminRoomService.forceRefreshRooms(this);
    },

    /**
     * 加载更多会议室
     */
    loadMoreRooms() {
        AdminRoomService.loadMoreRooms(this);
    },

    /**
     * 显示添加会议室弹窗
     */
    showAddRoomModal() {
        AdminRoomService.showAddRoomModal(this);
    },

    /**
     * 编辑会议室
     */
    editRoom(e) {
        AdminRoomService.editRoom(this, e);
    },

    /**
     * 删除会议室
     */
    deleteRoom(e) {
        AdminRoomService.deleteRoom(this, e);
    },

    /**
     * 提交会议室表单
     */
    async submitRoomForm() {
        await AdminRoomService.submitRoomForm(this);
    },

    // ==================== 预约记录管理相关方法 ====================

    /**
     * 加载预约记录
     */
    async loadBookings() {
        await AdminBookingService.loadBookings(this);
    },

    /**
     * 刷新预约记录
     */
    refreshBookings() {
        AdminBookingService.refreshBookings(this);
    },

    /**
     * 加载更多预约记录
     */
    loadMoreBookings() {
        AdminBookingService.loadMoreBookings(this);
    },

    /**
     * 筛选日期变化
     */
    onFilterDateChange(e) {
        AdminBookingService.onFilterDateChange(this, e);
    },

    /**
     * 筛选状态变化
     */
    onFilterStatusChange(e) {
        AdminBookingService.onFilterStatusChange(this, e);
    },

    /**
     * 取消预约
     */
    cancelBooking(e) {
        AdminBookingService.cancelBooking(this, e);
    },

    /**
     * 导出预约记录
     */
    async exportBookings() {
        await AdminBookingService.exportBookings(this);
    },

    // ==================== 表单和弹窗相关方法 ====================

    /**
     * 隐藏会议室弹窗
     */
    hideRoomModal() {
        AdminUtilService.hideRoomModal(this);
    },

    /**
     * 表单输入处理
     */
    onRoomFormInput(e) {
        AdminUtilService.onRoomFormInput(this, e);
    },

    /**
     * 切换设备选择
     */
    toggleEquipment(e) {
        AdminUtilService.toggleEquipment(this, e);
    },

    // ==================== 图片相关方法 ====================

    /**
     * 选择图片
     */
    chooseImage() {
        AdminImageService.chooseImage(this);
    },

    /**
     * 移除当前图片
     */
    removeCurrentImage() {
        AdminImageService.removeCurrentImage(this);
    },

    /**
     * 移除新图片
     */
    removeNewImage() {
        AdminImageService.removeNewImage(this);
    },

    /**
     * 图片加载成功
     */
    onImageLoad(e) {
        AdminImageService.onImageLoad(this, e);
    },

    /**
     * 图片加载失败
     */
    onImageError(e) {
        AdminImageService.onImageError(this, e);
    },

    // ==================== 工具方法 ====================

    /**
     * 阻止事件冒泡
     */
    stopPropagation(e) {
        AdminUtilService.stopPropagation(e);
    }
});