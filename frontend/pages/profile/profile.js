const app = getApp();
const request = require('../../utils/request.js'); // 导入网络请求工具

Page({
    data: {
        userInfo: {}, // 用户信息
        upcomingCount: 0, // 即将开始的预约数量
        loading: false, // 加载状态
        showContactEdit: false, // 是否显示联系信息编辑弹窗
        contactForm: { // 联系信息表单
            name: '',
            phone: ''
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
                this.setData({
                    upcomingCount: result.data.upcomingBookings.length
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
     * 显示联系信息编辑弹窗
     */
    showContactModal() {
        this.setData({
            showContactEdit: true,
            contactForm: {
                name: this.data.userInfo.contactName || '',
                phone: this.data.userInfo.contactPhone || ''
            }
        });
    },

    /**
     * 隐藏联系信息编辑弹窗
     */
    hideContactModal() {
        this.setData({
            showContactEdit: false
        });
    },

    /**
     * 阻止事件冒泡
     */
    stopPropagation() {
        // 空函数，阻止事件冒泡
    },

    /**
     * 联系人姓名输入
     */
    onContactNameInput(e) {
        this.setData({
            'contactForm.name': e.detail.value
        });
    },

    /**
     * 联系人电话输入
     */
    onContactPhoneInput(e) {
        this.setData({
            'contactForm.phone': e.detail.value
        });
    },

    /**
     * 保存联系信息
     */
    async saveContactInfo() {
        const { name, phone } = this.data.contactForm;

        if (!name || !phone) {
            wx.showToast({
                title: '请填写完整信息',
                icon: 'none'
            });
            return;
        }

        if (!/^1[3-9]\d{9}$/.test(phone)) {
            wx.showToast({
                title: '请输入正确的手机号',
                icon: 'none'
            });
            return;
        }

        try {
            this.setData({ loading: true });

            const result = await request.put('/api/user/contact', {
                contactName: name,
                contactPhone: phone
            });

            if (result.success) {
                // 更新用户信息
                const updatedUserInfo = {
                    ...this.data.userInfo,
                    contactName: name,
                    contactPhone: phone
                };

                this.setData({
                    userInfo: updatedUserInfo,
                    showContactEdit: false
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