const request = require('../../utils/request');
const ProfileDataService = require('../../services/ProfileDataService');
const ProfileAvatarService = require('../../services/ProfileAvatarService');
const ProfileEditService = require('../../services/ProfileEditService');

const app = getApp();

/**
 * 个人资料页面
 * 已重构为模块化架构，使用服务层处理具体业务逻辑
 */
Page({
    /**
     * 页面的初始数据
     */
    data: {
        userInfo: null,
        isAdmin: false,
        loading: true,
        uploadingAvatar: false,
        upcomingBookingsCount: 0,
        showProfileEdit: false,
        profileForm: {
            nickname: '',
            contactName: '',
            contactPhone: ''
        }
    },

    /**
     * 页面加载
     */
    onLoad() {
        console.log('📱 个人资料页面加载');
        this.initializePage();
    },

    /**
     * 页面显示
     */
    onShow() {
        console.log('👁️ 个人资料页面显示');
        this.refreshData();
    },

    /**
     * 初始化页面
     */
    async initializePage() {
        try {
            await ProfileDataService.refreshUserData(this);
        } catch (error) {
            console.error('❌ 初始化页面失败:', error);
        }
    },

    /**
     * 刷新数据
     */
    async refreshData() {
        try {
            await ProfileDataService.getUpcomingBookingsCount(this);
        } catch (error) {
            console.error('❌ 刷新数据失败:', error);
        }
    },

    /**
     * 获取用户信息
     */
    async getUserInfo() {
        return await ProfileDataService.getUserInfo(this);
    },

    /**
     * 获取即将到来的预约数量
     */
    async getUpcomingBookingsCount() {
        return await ProfileDataService.getUpcomingBookingsCount(this);
    },

    /**
     * 选择并上传头像
     */
    async chooseAndUploadAvatar(sourceType) {
        return await ProfileAvatarService.chooseAndUploadAvatar(this, sourceType);
    },

    /**
     * 跳转到我的预约页面
     */
    goToMyBookings() {
        wx.navigateTo({
            url: '/pages/myBookings/myBookings'
        });
    },

    /**
     * 跳转到管理员页面
     */
    goToAdmin() {
        wx.navigateTo({
            url: '/pages/admin/admin'
        });
    },

    /**
     * 编辑个人信息
     */
    editProfile() {
        ProfileEditService.showEditProfile(this);
    },

    /**
     * 隐藏个人信息编辑弹窗
     */
    hideProfileModal() {
        ProfileEditService.hideEditProfile(this);
    },

    /**
     * 显示设置页面
     */
    showSettings() {
        wx.showToast({
            title: '设置功能开发中',
            icon: 'none'
        });
    },

    /**
     * 阻止事件冒泡
     */
    stopPropagation() {
        // 空函数，阻止事件冒泡
    },

    /**
     * 昵称输入
     */
    onNicknameInput(e) {
        ProfileEditService.onNicknameInput(this, e.detail.value);
    },

    /**
     * 联系人姓名输入
     */
    onContactNameInput(e) {
        ProfileEditService.onContactNameInput(this, e.detail.value);
    },

    /**
     * 联系人电话输入
     */
    onContactPhoneInput(e) {
        ProfileEditService.onContactPhoneInput(this, e.detail.value);
    },

    /**
     * 保存个人信息
     */
    async saveProfileInfo() {
        return await ProfileEditService.saveProfileInfo(this);
    },

    /**
     * 直接获取微信头像（推荐方式）
     */
    async getWechatAvatar() {
        return await ProfileAvatarService.getWechatAvatar(this);
    },

    /**
     * 获取微信用户头像
     */
    async getWechatUserProfile() {
        return await ProfileAvatarService.getWechatUserProfile(this);
    },

    /**
     * 保存头像到服务器数据库
     */
    async saveAvatarToServer(avatarUrl) {
        return await ProfileAvatarService.saveAvatarToServer(this, avatarUrl);
    },

    /**
     * 更新用户昵称
     */
    async updateUserNickname(nickname) {
        return await ProfileEditService.updateUserNickname(this, nickname);
    },

    /**
     * 选择头像方式
     */
    async chooseAvatarMethod() {
        return await ProfileAvatarService.chooseAvatarMethod(this);
    },

    /**
     * 下拉刷新
     */
    async onPullDownRefresh() {
        try {
            await this.refreshData();
            wx.stopPullDownRefresh();
        } catch (error) {
            console.error('❌ 下拉刷新失败:', error);
            wx.stopPullDownRefresh();
        }
    },

    /**
     * 分享页面
     */
    onShareAppMessage() {
        return {
            title: '会议室预订系统',
            path: '/pages/roomList/roomList'
        };
    },

    /**
     * 分享到朋友圈
     */
    onShareTimeline() {
        return {
            title: '会议室预订系统',
            query: '',
            imageUrl: '/images/share-timeline.jpg'
        };
    }
});