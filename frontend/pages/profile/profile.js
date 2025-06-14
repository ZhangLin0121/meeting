const app = getApp();
const request = require('../../utils/request.js'); // 导入网络请求工具

Page({
    data: {
        userInfo: {}, // 用户信息
        upcomingCount: 0, // 即将开始的预约数量
        totalBookings: 0, // 总预约数量
        loading: false, // 加载状态
        showProfileEdit: false, // 是否显示个人信息编辑弹窗
        profileForm: { // 个人信息表单
            nickname: '',
            contactName: '',
            contactPhone: ''
        },
        statusBarHeight: 0 // 状态栏高度
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

        this.getUserInfo();
    },

    onShow() {
        // 页面显示时刷新数据
        this.getUserInfo();
        this.getUpcomingBookingsCount();
    },

    /**
     * 获取用户信息
     */
    async getUserInfo() {
        try {
            // 先从全局获取用户信息
            if (app && app.globalData && app.globalData.userInfo) {
                this.setData({
                    userInfo: app.globalData.userInfo
                });
                console.log('✅ 从全局数据获取用户信息:', app.globalData.userInfo);
                return;
            }

            // 从本地存储获取
            const userInfo = wx.getStorageSync('userInfo');
            if (userInfo) {
                this.setData({
                    userInfo: userInfo
                });
                console.log('✅ 从本地存储获取用户信息:', userInfo);
                return;
            }

            // 如果都没有，尝试重新登录
            console.log('⚠️ 未找到用户信息，尝试重新登录');
            if (app && app.forceLogin) {
                const loginResult = await app.forceLogin();
                if (loginResult && loginResult.userInfo) {
                    this.setData({
                        userInfo: loginResult.userInfo
                    });
                }
            }
        } catch (error) {
            console.error('❌ 获取用户信息失败:', error);
            wx.showToast({
                title: '获取用户信息失败',
                icon: 'none'
            });
        }
    },

    /**
     * 获取即将开始的预约数量
     */
    async getUpcomingBookingsCount() {
        if (!this.data.userInfo.openid) {
            return;
        }

        try {
            const result = await request.get('/api/user/bookings');
            if (result.success && result.data) {
                const upcomingCount = result.data.upcomingBookings.length;
                const pastCount = result.data.pastBookings.length;
                this.setData({
                    upcomingCount: upcomingCount,
                    totalBookings: upcomingCount + pastCount
                });
            }
        } catch (error) {
            console.error('❌ 获取预约数量失败:', error);
        }
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
        this.setData({
            showProfileEdit: true,
            profileForm: {
                nickname: this.data.userInfo.nickname || '',
                contactName: this.data.userInfo.contactName || '',
                contactPhone: this.data.userInfo.contactPhone || ''
            }
        });
    },

    /**
     * 隐藏个人信息编辑弹窗
     */
    hideProfileModal() {
        this.setData({
            showProfileEdit: false
        });
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
        this.setData({
            'profileForm.nickname': e.detail.value
        });
    },

    /**
     * 联系人姓名输入
     */
    onContactNameInput(e) {
        this.setData({
            'profileForm.contactName': e.detail.value
        });
    },

    /**
     * 联系人电话输入
     */
    onContactPhoneInput(e) {
        this.setData({
            'profileForm.contactPhone': e.detail.value
        });
    },

    /**
     * 保存个人信息
     */
    async saveProfileInfo() {
        const { nickname, contactName, contactPhone } = this.data.profileForm;

        if (!nickname.trim()) {
            wx.showToast({
                title: '请输入昵称',
                icon: 'none'
            });
            return;
        }

        if (contactPhone && !/^1[3-9]\d{9}$/.test(contactPhone)) {
            wx.showToast({
                title: '请输入正确的手机号',
                icon: 'none'
            });
            return;
        }

        try {
            this.setData({ loading: true });

            const result = await request.put('/api/user/contact', {
                contactName: contactName.trim(),
                contactPhone: contactPhone.trim()
            });

            if (result.success) {
                // 更新用户信息
                const updatedUserInfo = {
                    ...this.data.userInfo,
                    nickname: nickname.trim(),
                    contactName: contactName.trim(),
                    contactPhone: contactPhone.trim()
                };

                this.setData({
                    userInfo: updatedUserInfo,
                    showProfileEdit: false
                });

                // 更新全局用户信息
                if (app && app.globalData) {
                    app.globalData.userInfo = updatedUserInfo;
                }

                // 更新本地存储
                wx.setStorageSync('userInfo', updatedUserInfo);

                wx.showToast({
                    title: '保存成功',
                    icon: 'success'
                });
            } else {
                throw new Error(result.message || '保存失败');
            }
        } catch (error) {
            console.error('❌ 保存联系信息失败:', error);
            wx.showToast({
                title: error.message || '保存失败',
                icon: 'none'
            });
        } finally {
            this.setData({ loading: false });
        }
    }
});