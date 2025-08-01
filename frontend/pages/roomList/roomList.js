// pages/roomList/roomList.js
const RoomListDataService = require('./services/RoomListDataService.js');
const RoomListSearchService = require('./services/RoomListSearchService.js');
const RoomListNavigationService = require('./services/RoomListNavigationService.js');
const RoomListUtilService = require('./services/RoomListUtilService.js');

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
        customNavBarHeight: 0,
        // 页面配置
        refreshing: false,
        hasMore: true,
        currentPage: 1
    },

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad() {
        console.log('会议室列表页面加载');

        // 获取系统信息，包括状态栏高度
        RoomListUtilService.getSystemInfo(this);

        // 获取用户openid和设置API基础URL
        RoomListUtilService.getUserOpenId(this);
        RoomListUtilService.setApiBaseUrl(this);

        // 页面加载完成，会在onShow中初始化数据
    },

    /**
     * 生命周期函数--监听页面初次渲染完成
     */
    onReady() {
        // 页面渲染完成
    },

    /**
     * 生命周期函数--监听页面显示
     */
    async onShow() {
        console.log('📱 页面显示，开始初始化...');

        // 打印当前页面状态，帮助调试
        RoomListUtilService.printPageStatus(this);

        await this.initializePage();
    },

    /**
     * 生命周期函数--监听页面隐藏
     */
    onHide() {
        // 页面隐藏
    },

    /**
     * 生命周期函数--监听页面卸载
     */
    onUnload() {
        // 页面卸载
    },

    /**
     * 页面相关事件处理函数--监听用户下拉动作
     */
    onPullDownRefresh() {
        RoomListUtilService.onPullDownRefresh(this, this.fetchRooms.bind(this));
    },

    /**
     * 页面上拉触底事件的处理函数
     */
    onReachBottom() {
        RoomListUtilService.onReachBottom();
    },

    /**
     * 下拉刷新处理函数
     */
    onRefresh() {
        RoomListUtilService.onRefresh(this, this.fetchRooms.bind(this));
    },

    /**
     * 用户点击右上角分享
     */
    onShareAppMessage() {
        return {
            title: '会议室预订系统',
            path: '/pages/roomList/roomList'
        };
    },

    // ==================== 数据相关方法 ====================

    /**
     * 智能初始化页面
     */
    async initializePage() {
        await RoomListUtilService.initializePage(
            this, 
            this.loginUser.bind(this),
            this.checkUserRole.bind(this),
            this.fetchRooms.bind(this)
        );
    },

    /**
     * 用户登录
     */
    async loginUser() {
        return await RoomListDataService.loginUser();
    },

    /**
     * 检查用户角色
     */
    async checkUserRole() {
        await RoomListDataService.checkUserRole(this);
    },

    /**
     * 获取会议室列表
     */
    async fetchRooms() {
        await RoomListDataService.fetchRooms(this);
    },

    /**
     * 图片加载成功
     */
    onImageLoad(e) {
        RoomListDataService.onImageLoad(this, e);
    },

    /**
     * 图片加载失败
     */
    onImageError(e) {
        RoomListDataService.onImageError(this, e);
    },

    // ==================== 搜索相关方法 ====================

    /**
     * 清除搜索
     */
    clearSearch() {
        RoomListSearchService.clearSearch(this);
        this.fetchRooms(); // 重新获取所有数据
    },

    /**
     * 搜索输入处理
     */
    onSearchInput(e) {
        RoomListSearchService.onSearchInput(this, e);
    },

    /**
     * 搜索确认
     */
    async onSearchConfirm() {
        await RoomListSearchService.onSearchConfirm(this);
    },

    /**
     * 显示筛选选项
     */
    showFilterOptions() {
        RoomListSearchService.showFilterOptions(this);
    },

    /**
     * 显示容量筛选
     */
    showCapacityFilter() {
        RoomListSearchService.showCapacityFilter(this);
    },

    /**
     * 显示设备筛选
     */
    showEquipmentFilter() {
        RoomListSearchService.showEquipmentFilter(this);
    },

    /**
     * 清除筛选
     */
    clearFilter() {
        RoomListSearchService.clearFilter(this);
        this.fetchRooms(); // 重新获取所有数据
    },

    // ==================== 导航相关方法 ====================

    /**
     * 跳转到会议室详情页
     */
    goToRoomDetail(e) {
        RoomListNavigationService.goToRoomDetail(e);
    },

    /**
     * 跳转到管理员面板
     */
    goToAdminPanel() {
        RoomListNavigationService.goToAdminPanel();
    },

    /**
     * 跳转到搜索页面
     */
    goToSearchPage() {
        RoomListNavigationService.goToSearchPage();
    },

    /**
     * 跳转到我的预约页面
     */
    goToMyBookings() {
        RoomListNavigationService.goToMyBookings();
    },

    /**
     * 打开位置地图
     */
    openLocationMap(e) {
        RoomListNavigationService.openLocationMap(e);
    }
});