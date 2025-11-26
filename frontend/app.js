// app.js
const envConfig = require('./config/env.js');
const performance = require('./utils/performance.js');
require('./utils/console-override.js'); // 优化console输出

App({
    onLaunch() {
        performance.log('🚀 小程序启动');

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
     * 执行登录 - 优化版本，避免重复弹窗
     */
    async performLogin() {
        try {
            // 检测设备类型并记录 - 使用新的API
            const deviceInfo = wx.getDeviceInfo();
            const appBaseInfo = wx.getAppBaseInfo();
            console.log('📱 设备信息:', {
                platform: deviceInfo.platform,
                system: deviceInfo.system,
                brand: deviceInfo.brand,
                model: deviceInfo.model,
                version: appBaseInfo.version,
                SDKVersion: appBaseInfo.SDKVersion
            });

            // 使用新的微信认证工具
            const WechatAuth = require('./utils/auth.js');

            // 使用智能登录，避免重复弹窗
            console.log('🔐 开始智能登录流程...');
            const userInfo = await WechatAuth.smartLogin();

            if (userInfo && userInfo.openid) {
                this.globalData.userInfo = userInfo;
                console.log('✅ 微信登录完成，openid:', userInfo.openid);

                // 安卓设备额外验证
                if (deviceInfo.platform === 'android') {
                    console.log('📱 安卓设备：验证登录状态...');
                    setTimeout(() => {
                        const savedInfo = wx.getStorageSync('userInfo');
                        if (!savedInfo || !savedInfo.openid) {
                            console.error('❌ 安卓设备：用户信息保存验证失败');
                            wx.showModal({
                                title: '登录提示',
                                content: '检测到登录状态保存异常，建议重启小程序',
                                showCancel: true,
                                cancelText: '忽略',
                                confirmText: '重启',
                                success: (res) => {
                                    if (res.confirm) {
                                        wx.reLaunch({
                                            url: '/pages/roomList/roomList'
                                        });
                                    }
                                }
                            });
                        } else {
                            console.log('✅ 安卓设备：登录状态验证成功');
                        }
                    }, 1000);
                }

                // 显示登录成功提示
                setTimeout(() => {
                    wx.showToast({
                        title: '登录成功',
                        icon: 'success',
                        duration: 1500
                    });
                }, 500);
            } else {
                throw new Error('登录结果无效');
            }

        } catch (error) {
            console.error('❌ 登录流程失败:', error);

            // 显示用户友好的错误信息
            let errorMessage = '登录失败，请重试';
            if (error.message) {
                if (error.message.includes('网络')) {
                    errorMessage = '网络连接失败，请检查网络';
                } else if (error.message.includes('invalid code')) {
                    errorMessage = '微信授权失败，请重新尝试';
                } else if (error.message.includes('保存失败')) {
                    errorMessage = '登录信息保存失败，请重试或重启小程序';
                } else {
                    errorMessage = error.message;
                }
            }

            wx.showModal({
                title: '登录提示',
                content: errorMessage,
                showCancel: true,
                cancelText: '取消',
                confirmText: '重试',
                success: (res) => {
                    if (res.confirm) {
                        this.performLogin();
                    }
                }
            });
        }
    },

    /**
     * 登录到服务器
     */
    async loginToServer(code, userProfile = null) {
        try {
            const request = require('./utils/request.js');

            const loginData = {
                code: code
            };

            // 如果有用户头像信息，一并发送
            if (userProfile && userProfile.avatarUrl) {
                loginData.avatarUrl = userProfile.avatarUrl;
            }

            console.log('🔐 发送登录请求到服务器...');
            const result = await request.post('/api/user/wechat-login', loginData);

            if (result.success) {
                console.log('✅ 服务器登录成功:', result.data);
                this.globalData.userInfo = result.data;
                wx.setStorageSync('userInfo', result.data);

                // 如果是新用户，提示完善信息
                if (result.data.isNewUser) {
                    setTimeout(() => {
                        wx.showToast({
                            title: '请完善个人信息',
                            icon: 'none',
                            duration: 2000
                        });
                    }, 1000);
                }
            } else {
                throw new Error(result.message || '服务器登录失败');
            }

        } catch (error) {
            console.error('❌ 服务器登录失败:', error);

            // 显示错误信息
            wx.showToast({
                title: error.message || '登录失败',
                icon: 'none',
                duration: 3000
            });
        }
    },

    /**
     * 获取用户头像（需要用户授权）
     */
    getUserProfileWithAuth() {
        return new Promise((resolve, reject) => {
            wx.getUserProfile({
                desc: '用于显示您的头像',
                success: (res) => {
                    console.log('✅ 获取用户头像成功:', res.userInfo.avatarUrl ? '已获取' : '未获取');
                    // 只返回头像信息
                    resolve({ avatarUrl: res.userInfo.avatarUrl });
                },
                fail: (error) => {
                    console.log('ℹ️ 用户拒绝授权获取头像');
                    reject(error);
                }
            });
        });
    },

    /**
     * 强制登录（用于页面调用）
     */
    async forceLogin() {
        try {
            // 重新获取登录码
            const loginRes = await new Promise((resolve, reject) => {
                wx.login({
                    success: resolve,
                    fail: reject
                });
            });

            console.log('🔄 重新登录，code:', loginRes.code);

            // 尝试获取用户头像信息
            let userProfile = null;
            try {
                userProfile = await this.getUserProfileWithAuth();
            } catch (error) {
                console.log('ℹ️ 未获取到用户头像信息，使用默认配置');
            }

            // 登录到服务器
            await this.loginToServer(loginRes.code, userProfile);

            return this.globalData.userInfo;

        } catch (error) {
            console.error('❌ 强制登录失败:', error);
            throw error;
        }
    },



    globalData: {
        userInfo: null,
        apiBaseUrl: envConfig.apiBaseUrl,
        environment: envConfig.environment,
        debug: envConfig.debug,
        networkType: 'unknown',
        isConnected: true,
        loginCode: null
    }
})