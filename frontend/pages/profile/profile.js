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
        statusBarHeight: 0, // 状态栏高度
        uploadingAvatar: false // 头像上传状态
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
            // 直接从服务器获取最新的用户信息
            console.log('🔄 从服务器获取最新用户信息...');
            const result = await request.get('/api/user/profile');

            if (result.success && result.data) {
                const userInfo = result.data;
                this.setData({
                    userInfo: userInfo
                });

                // 更新全局用户信息
                if (app && app.globalData) {
                    app.globalData.userInfo = userInfo;
                }

                // 更新本地存储
                wx.setStorageSync('userInfo', userInfo);

                console.log('✅ 从服务器获取用户信息成功:', userInfo);
                return;
            }

            // 如果服务器获取失败，尝试从本地获取
            const localUserInfo = wx.getStorageSync('userInfo');
            if (localUserInfo) {
                this.setData({
                    userInfo: localUserInfo
                });
                console.log('✅ 从本地存储获取用户信息:', localUserInfo);
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

            // 尝试从本地存储获取
            const localUserInfo = wx.getStorageSync('userInfo');
            if (localUserInfo) {
                this.setData({
                    userInfo: localUserInfo
                });
                console.log('✅ 从本地存储获取用户信息:', localUserInfo);
            } else {
                wx.showToast({
                    title: '获取用户信息失败',
                    icon: 'none'
                });
            }
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
     * 选择并上传头像
     */
    async chooseAndUploadAvatar() {
        try {
            // 显示选择图片
            const chooseResult = await new Promise((resolve, reject) => {
                wx.chooseImage({
                    count: 1,
                    sizeType: ['compressed'], // 压缩图片
                    sourceType: ['album', 'camera'], // 支持相册和拍照
                    success: resolve,
                    fail: reject
                });
            });

            if (!chooseResult.tempFilePaths || chooseResult.tempFilePaths.length === 0) {
                return;
            }

            const tempFilePath = chooseResult.tempFilePaths[0];

            // 显示上传状态
            this.setData({ uploadingAvatar: true });

            wx.showLoading({
                title: '上传头像中...',
                mask: true
            });

            // 获取用户openid用于认证
            const userInfo = wx.getStorageSync('userInfo');
            if (!userInfo || !userInfo.openid) {
                throw new Error('用户未登录，请先登录');
            }

            // 上传到服务器
            const uploadResult = await new Promise((resolve, reject) => {
                wx.uploadFile({
                    url: `${app.globalData.apiBaseUrl}/api/upload/avatar`,
                    filePath: tempFilePath,
                    name: 'avatar',
                    header: {
                        'x-user-openid': userInfo.openid
                    },
                    success: (res) => {
                        try {
                            const data = JSON.parse(res.data);
                            if (data.success) {
                                resolve(data);
                            } else {
                                reject(new Error(data.message || '上传失败'));
                            }
                        } catch (parseError) {
                            reject(new Error('服务器响应格式错误'));
                        }
                    },
                    fail: reject
                });
            });

            // 更新本地用户信息
            const updatedUserInfo = {
                ...this.data.userInfo,
                avatarUrl: `${app.globalData.apiBaseUrl}${uploadResult.data.avatarUrl}`
            };

            this.setData({
                userInfo: updatedUserInfo
            });

            // 更新全局数据和本地存储
            if (app && app.globalData) {
                app.globalData.userInfo = updatedUserInfo;
            }
            wx.setStorageSync('userInfo', updatedUserInfo);

            wx.showToast({
                title: '头像更新成功',
                icon: 'success'
            });

            console.log('✅ 头像上传成功:', uploadResult.data.avatarUrl);

        } catch (error) {
            console.error('❌ 头像上传失败:', error);
            wx.showToast({
                title: error.message || '头像上传失败',
                icon: 'none'
            });
        } finally {
            this.setData({ uploadingAvatar: false });
            wx.hideLoading();
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
                nickname: nickname.trim(),
                contactName: contactName.trim(),
                contactPhone: contactPhone.trim()
            });

            if (result.success) {
                // 使用服务器返回的最新用户信息
                const updatedUserInfo = {
                    ...this.data.userInfo,
                    nickname: result.data.nickname,
                    contactName: result.data.contactName,
                    contactPhone: result.data.contactPhone
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