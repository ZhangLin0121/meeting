// app.js
App({
    onLaunch() {
        console.log('🚀 小程序启动');

        // 展示本地存储能力
        const logs = wx.getStorageSync('logs') || []
        logs.unshift(Date.now())
        wx.setStorageSync('logs', logs)

        // 检查网络状态
        this.checkNetworkStatus();

        // 登录
        this.performLogin();
    },

    onShow() {
        console.log('📱 小程序显示');
        // 检查网络状态
        this.checkNetworkStatus();
    },

    onHide() {
        console.log('📱 小程序隐藏');
    },

    onError(error) {
        console.error('❌ 小程序错误:', error);

        // 记录错误日志
        const errorLogs = wx.getStorageSync('errorLogs') || [];
        errorLogs.unshift({
            error: error,
            timestamp: new Date().toISOString(),
            page: (getCurrentPages().pop() && getCurrentPages().pop().route) || 'unknown'
        });

        // 只保留最近50条错误日志
        if (errorLogs.length > 50) {
            errorLogs.splice(50);
        }

        wx.setStorageSync('errorLogs', errorLogs);
    },

    /**
     * 检查网络状态
     */
    checkNetworkStatus() {
        wx.getNetworkType({
            success: (res) => {
                console.log('🌐 网络类型:', res.networkType);
                this.globalData.networkType = res.networkType;

                if (res.networkType === 'none') {
                    wx.showToast({
                        title: '网络连接失败',
                        icon: 'none',
                        duration: 3000
                    });
                }
            },
            fail: (error) => {
                console.error('❌ 获取网络状态失败:', error);
            }
        });

        // 监听网络状态变化
        wx.onNetworkStatusChange((res) => {
            console.log('🌐 网络状态变化:', res);
            this.globalData.networkType = res.networkType;
            this.globalData.isConnected = res.isConnected;

            if (!res.isConnected) {
                wx.showToast({
                    title: '网络连接断开',
                    icon: 'none',
                    duration: 2000
                });
            } else {
                console.log('✅ 网络连接恢复');
            }
        });
    },

    /**
     * 执行登录
     */
    performLogin() {
        wx.login({
            success: (res) => {
                console.log('✅ 微信登录成功，code:', res.code);
                this.globalData.loginCode = res.code;

                // 获取用户信息
                this.getUserProfile();
            },
            fail: (error) => {
                console.error('❌ 微信登录失败:', error);
                wx.showToast({
                    title: '登录失败，请重试',
                    icon: 'none',
                    duration: 2000
                });
            }
        });
    },

    /**
     * 获取用户信息
     */
    getUserProfile() {
        // 检查是否已有用户信息
        const userInfo = wx.getStorageSync('userInfo');
        if (userInfo) {
            console.log('📱 使用缓存的用户信息:', userInfo);
            this.globalData.userInfo = userInfo;
            return;
        }

        // 静默获取用户信息（不弹窗）
        wx.getUserProfile({
            desc: '用于完善会议室预约功能',
            success: (res) => {
                console.log('✅ 获取用户信息成功:', res.userInfo);
                this.globalData.userInfo = res.userInfo;
                wx.setStorageSync('userInfo', res.userInfo);
            },
            fail: (error) => {
                console.log('ℹ️ 用户未授权获取信息，使用默认配置');
                // 不强制要求用户信息，使用默认配置
                this.globalData.userInfo = {
                    nickName: '用户',
                    avatarUrl: '/images/default-avatar.png'
                };
            }
        });
    },

    /**
     * 测试API连接
     */
    async testAPIConnection() {
        try {
            const request = require('./utils/request.js');
            const result = await request.get('/api/health');
            console.log('✅ API连接测试成功:', result);
            return true;
        } catch (error) {
            console.error('❌ API连接测试失败:', error);
            return false;
        }
    },

    globalData: {
        userInfo: null,
        apiBaseUrl: 'http://47.122.68.192',
        networkType: 'unknown',
        isConnected: true,
        loginCode: null
    }
})