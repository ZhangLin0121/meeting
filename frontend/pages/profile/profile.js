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
        supportsChooseAvatar: false,
        upcomingBookingsCount: 0,
        totalBookings: 0,
        showProfileEdit: false,
        statusBarHeight: 20,
        profileForm: {
            company: '',
            contactName: '',
            contactPhone: '',
            policyAgreed: false,
            policyVersion: 'v1.0'
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
    async onShow() {
        console.log('👁️ 个人资料页面显示');
        await this.refreshData();
        this.checkForcedProfileCompletion();
    },

    /**
     * 初始化页面
     */
    async initializePage() {
        try {
            // 获取状态栏高度
            const windowInfo = wx.getWindowInfo();
            const supportsChooseAvatar = !!wx.chooseAvatar || (typeof wx.canIUse === 'function' && wx.canIUse('button.open-type.chooseAvatar'));
            this.setData({
                statusBarHeight: windowInfo.statusBarHeight || 20,
                supportsChooseAvatar
            });

            await ProfileDataService.refreshUserData(this);
            // 获取用户统计信息
            await ProfileDataService.getUserStats(this);
        } catch (error) {
            console.error('❌ 初始化页面失败:', error);
        }
    },

    /**
     * 刷新数据
     * @param {boolean} forceRefresh - 是否强制从服务器刷新
     */
    async refreshData(forceRefresh = false) {
        try {
            if (forceRefresh) {
                await ProfileDataService.refreshUserData(this, true);
                // 强制刷新时也更新统计信息和即将到来数量
                await ProfileDataService.getUpcomingBookingsCount(this);
                await ProfileDataService.getUserStats(this);
            } else {
                await ProfileDataService.getUpcomingBookingsCount(this);
                // 普通刷新时也更新统计信息
                await ProfileDataService.getUserStats(this);
            }
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

    // 点击“即将到来”统计，跳转并定位到即将开始
    goToUpcomingBookings() {
        const isAdmin = this.data.userInfo && this.data.userInfo.role === 'admin';
        if (isAdmin) {
            wx.navigateTo({ url: '/pages/adminBookings/adminBookings' });
        } else {
            try { wx.setStorageSync('__myBookingsFocus', 'upcoming'); } catch(_){}
            wx.switchTab({ url: '/pages/myBookings/myBookings' });
        }
    },

    // 点击“总预约数”，跳转到我的预约（顶部）
    goToAllBookings() {
        const isAdmin = this.data.userInfo && this.data.userInfo.role === 'admin';
        if (isAdmin) {
            wx.navigateTo({ url: '/pages/adminBookings/adminBookings' });
        } else {
            try { wx.setStorageSync('__myBookingsFocus', 'all'); } catch(_){}
            wx.switchTab({ url: '/pages/myBookings/myBookings' });
        }
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
     * 直接跳转预约管理（管理员）
     */
    goToAdminBookings() {
        wx.navigateTo({
            url: '/pages/adminBookings/adminBookings'
        });
    },

    openLegal() { wx.navigateTo({ url: '/pages/legal/service' }); },

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
     * 检测是否需要强制完善资料
     */
    checkForcedProfileCompletion() {
        try {
            const redirectFlag = wx.getStorageSync('profileCompletionRedirect');
            if (redirectFlag && redirectFlag.timestamp) {
                const isExpired = Date.now() - redirectFlag.timestamp > 5 * 60 * 1000;
                if (!isExpired) {
                    wx.removeStorageSync('profileCompletionRedirect');
                    if (!this.data.showProfileEdit) {
                        ProfileEditService.showEditProfile(this);
                    }
                    wx.showToast({
                        title: '请先完善联系信息',
                        icon: 'none'
                    });
                }
            }
        } catch (error) {
            console.warn('⚠️ 检测资料完善标记失败:', error);
        }
    },

    /**
     * 公司名称输入
     */
    onCompanyInput(e) {
        ProfileEditService.onCompanyInput(this, e.detail.value);
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

    onPolicyCheck(e) {
        const checked = (e.detail.value || []).includes('agree');
        this.setData({ 'profileForm.policyAgreed': checked });
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

    // 基础库>=2.21：open-type方式直接返回临时路径
    async onChooseAvatar(e) {
        try {
            const tempFilePath = e.detail && e.detail.avatarUrl;
            if (!tempFilePath) return;
            // 直接上传临时文件并更新显示
            const uploadRes = await ProfileAvatarService.uploadAvatarToServer(tempFilePath);
            const serverAvatar = uploadRes && uploadRes.data && uploadRes.data.avatarUrl ? uploadRes.data.avatarUrl : '';
            if (serverAvatar) {
                ProfileAvatarService.updateLocalAvatar(this, serverAvatar);
                wx.showToast({ title: '头像更新成功', icon: 'success' });
                // 强制刷新资料，拉最新服务器数据
                await ProfileDataService.refreshUserData(this, true);
            } else {
                wx.showToast({ title: '上传失败', icon: 'none' });
            }
        } catch (err) {
            console.error('❌ 上传头像失败:', err);
            wx.showToast({ title: '上传失败', icon: 'none' });
        }
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
     * 更新用户公司名称
     */
    async updateUserCompany(company) {
        return await ProfileEditService.updateUserNickname(this, company);
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
     * 头像加载失败处理
     */
    onAvatarError() {
        console.error('❌ 头像加载失败');
        // 清除无效的头像URL，显示默认头像
        if (this.data.userInfo && this.data.userInfo.avatarUrl) {
            this.setData({
                'userInfo.avatarUrl': ''
            });

            // 同时更新存储
            const app = getApp();
            if (app.globalData && app.globalData.userInfo) {
                app.globalData.userInfo.avatarUrl = '';
            }
            wx.setStorageSync('userInfo', this.data.userInfo);
        }
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
    },

    /**
     * 诊断头像状态（调试用）
     */
    async diagnoseAvatar() {
        console.log('🩺 开始头像诊断...');
        await ProfileAvatarService.diagnoseAvatar(this);
    },

    /**
     * 测试微信头像API（调试用）
     */
    async testWechatAvatarApis() {
        console.log('🧪 开始测试微信头像API...');
        await ProfileAvatarService.testWechatAvatarApis(this);
    }
});
