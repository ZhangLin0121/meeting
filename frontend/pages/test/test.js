// pages/test/test.js
const request = require('../../utils/request.js');
const app = getApp();
const WechatAuth = require('../../utils/auth.js');

Page({
    /**
     * 页面的初始数据
     */
    data: {
        logs: [],
        testResults: [],
        userInfo: null,
        loginStatus: '未登录',
        apiConnected: false,
        loading: false,
        avatarUrl: '', // 测试获取的头像URL
        wechatUserInfo: {} // 测试获取的微信用户信息
    },

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad() {
        console.log('📋 测试页面加载');
        this.addLog('测试页面加载完成');

        // 开始基础测试
        this.runBasicTests();
    },

    /**
     * 添加日志
     */
    addLog(message) {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `[${timestamp}] ${message}`;

        const logs = this.data.logs;
        logs.unshift(logEntry);

        // 只保留最近20条日志
        if (logs.length > 20) {
            logs.splice(20);
        }

        this.setData({ logs });
        console.log('📋', logEntry);
    },

    /**
     * 添加测试结果
     */
    addTestResult(testName, success, message) {
        const testResults = this.data.testResults;
        testResults.unshift({
            name: testName,
            success: success,
            message: message,
            timestamp: new Date().toLocaleTimeString()
        });

        this.setData({ testResults });

        const status = success ? '✅' : '❌';
        this.addLog(`${status} ${testName}: ${message}`);
    },

    /**
     * 运行基础测试
     */
    async runBasicTests() {
        this.addLog('🧪 开始运行基础测试...');

        // 测试1: App实例获取
        await this.testAppInstance();

        // 测试2: 登录状态检查
        await this.testLoginStatus();

        // 测试3: API连接测试
        await this.testAPIConnection();

        // 测试4: 智能登录测试
        await this.testSmartLogin();

        this.addLog('🎉 基础测试完成');
    },

    /**
     * 测试App实例获取
     */
    async testAppInstance() {
        try {
            const app = getApp();
            if (app && app.globalData) {
                this.addTestResult('App实例获取', true, '成功获取App实例和globalData');
            } else {
                this.addTestResult('App实例获取', false, 'App实例或globalData为空');
            }
        } catch (error) {
            this.addTestResult('App实例获取', false, `异常: ${error.message}`);
        }
    },

    /**
     * 测试登录状态检查
     */
    async testLoginStatus() {
        try {
            const WechatAuth = require('../../utils/auth.js');
            const userInfo = WechatAuth.checkLoginStatus();

            if (userInfo && userInfo.openid) {
                this.setData({
                    userInfo: userInfo,
                    loginStatus: '已登录'
                });
                this.addTestResult('登录状态检查', true, `用户已登录: ${userInfo.openid.substring(0, 8)}...`);
            } else {
                this.setData({ loginStatus: '未登录' });
                this.addTestResult('登录状态检查', false, '用户未登录');
            }
        } catch (error) {
            this.addTestResult('登录状态检查', false, `异常: ${error.message}`);
        }
    },

    /**
     * 测试API连接
     */
    async testAPIConnection() {
        try {
            const request = require('../../utils/request.js');
            const result = await request.get('/api/health');

            if (result.success) {
                this.setData({ apiConnected: true });
                this.addTestResult('API连接测试', true, 'API连接正常');
            } else {
                this.addTestResult('API连接测试', false, result.message || 'API连接失败');
            }
        } catch (error) {
            this.addTestResult('API连接测试', false, `连接异常: ${error.message || error}`);
        }
    },

    /**
     * 测试智能登录
     */
    async testSmartLogin() {
        try {
            this.addLog('🔐 开始智能登录测试...');
            const WechatAuth = require('../../utils/auth.js');

            const startTime = Date.now();
            const userInfo = await WechatAuth.smartLogin();
            const endTime = Date.now();

            if (userInfo && userInfo.openid) {
                this.setData({
                    userInfo: userInfo,
                    loginStatus: '已登录'
                });
                this.addTestResult('智能登录测试', true, `登录成功，耗时${endTime - startTime}ms`);
            } else {
                this.addTestResult('智能登录测试', false, '登录失败：返回数据无效');
            }
        } catch (error) {
            this.addTestResult('智能登录测试', false, `登录异常: ${error.message}`);
        }
    },

    /**
     * 测试页面登录流程（模拟roomList的登录流程）
     */
    async testPageLoginFlow() {
        try {
            this.addLog('🔄 开始测试页面登录流程...');

            // 模拟roomList的登录流程
            const WechatAuth = require('../../utils/auth.js');
            const userInfo = await WechatAuth.smartLogin();

            if (userInfo && userInfo.openid) {
                // 模拟设置页面数据
                this.setData({
                    userInfo: userInfo,
                    loginStatus: '已登录'
                });

                // 模拟角色检查
                try {
                    const request = require('../../utils/request.js');
                    const roleResult = await request.get('/api/user/role', {
                        headers: {
                            'X-User-Openid': userInfo.openid
                        }
                    });

                    if (roleResult.success) {
                        this.addLog(`👤 用户角色: ${roleResult.data.role}`);
                    }
                } catch (roleError) {
                    this.addLog(`⚠️ 角色检查失败: ${roleError.message}`);
                }

                this.addTestResult('页面登录流程', true, '页面登录流程测试成功');
            } else {
                this.addTestResult('页面登录流程', false, '页面登录流程失败');
            }
        } catch (error) {
            this.addTestResult('页面登录流程', false, `流程异常: ${error.message}`);
        }
    },

    /**
     * 清除日志
     */
    clearLogs() {
        this.setData({
            logs: [],
            testResults: []
        });
        this.addLog('日志已清除');
    },

    /**
     * 重新运行测试
     */
    rerunTests() {
        this.clearLogs();
        this.runBasicTests();
    },

    /**
     * 测试登录流程
     */
    testLogin() {
        this.testPageLoginFlow();
    },

    /**
     * 跳转到房间列表
     */
    goToRoomList() {
        wx.navigateTo({
            url: '/pages/roomList/roomList'
        });
    },

    /**
     * 生命周期函数--监听页面初次渲染完成
     */
    onReady() {

    },

    /**
     * 生命周期函数--监听页面显示
     */
    onShow() {

    },

    /**
     * 生命周期函数--监听页面隐藏
     */
    onHide() {

    },

    /**
     * 生命周期函数--监听页面卸载
     */
    onUnload() {

    },

    /**
     * 页面相关事件处理函数--监听用户下拉动作
     */
    onPullDownRefresh() {

    },

    /**
     * 页面上拉触底事件的处理函数
     */
    onReachBottom() {

    },

    /**
     * 用户点击右上角分享
     */
    onShareAppMessage() {

    },

    /**
     * 测试直接获取微信头像
     */
    async testGetWechatAvatar() {
        this.setData({ loading: true });
        this.addTestResult('开始测试获取微信头像...', null);

        // 先检查API兼容性
        if (!wx.chooseAvatar) {
            this.addTestResult(`当前微信基础库版本不支持 wx.chooseAvatar API (需要 2.21.0+)`, false);
            this.addTestResult(`当前版本: ${wx.getSystemInfoSync().SDKVersion}`, false);
            this.setData({ loading: false });

            wx.showModal({
                title: 'API不支持',
                content: '当前微信版本不支持 wx.chooseAvatar API，请升级微信到最新版本或使用"获取用户信息"功能',
                showCancel: false
            });
            return;
        }

        try {
            const avatarUrl = await WechatAuth.getWechatAvatar();

            this.setData({
                avatarUrl: avatarUrl
            });

            this.addTestResult(`微信头像获取成功: ${avatarUrl}`, true);

            wx.showToast({
                title: '头像获取成功',
                icon: 'success'
            });

        } catch (error) {
            console.error('❌ 测试获取微信头像失败:', error);
            this.addTestResult(`微信头像获取失败: ${error.message}`, false);

            wx.showToast({
                title: '头像获取失败',
                icon: 'none'
            });
        } finally {
            this.setData({ loading: false });
        }
    },

    /**
     * 测试获取微信用户信息
     */
    async testGetWechatUserInfo() {
        this.setData({ loading: true });
        this.addTestResult('开始测试获取微信用户信息...', null);

        try {
            const userInfo = await WechatAuth.getWechatUserInfo();

            this.setData({
                wechatUserInfo: userInfo
            });

            this.addTestResult(`用户信息获取成功: ${userInfo.nickName}`, true);
            this.addTestResult(`头像URL: ${userInfo.avatarUrl}`, true);

            wx.showToast({
                title: '用户信息获取成功',
                icon: 'success'
            });

        } catch (error) {
            console.error('❌ 测试获取用户信息失败:', error);
            this.addTestResult(`用户信息获取失败: ${error.message}`, false);

            wx.showToast({
                title: '用户信息获取失败',
                icon: 'none'
            });
        } finally {
            this.setData({ loading: false });
        }
    },

    /**
     * 测试登录并获取用户信息
     */
    async testLoginWithUserInfo() {
        this.setData({ loading: true });
        this.addTestResult('开始测试登录并获取用户信息...', null);

        try {
            const result = await WechatAuth.loginWithUserInfo();

            this.setData({
                wechatUserInfo: result
            });

            this.addTestResult(`登录成功，用户openid: ${result.openid}`, true);
            this.addTestResult(`用户昵称: ${result.nickname}`, true);
            this.addTestResult(`头像URL: ${result.avatarUrl}`, true);

            wx.showToast({
                title: '登录并获取信息成功',
                icon: 'success'
            });

        } catch (error) {
            console.error('❌ 测试登录并获取用户信息失败:', error);
            this.addTestResult(`登录失败: ${error.message}`, false);

            wx.showToast({
                title: '登录失败',
                icon: 'none'
            });
        } finally {
            this.setData({ loading: false });
        }
    },

    /**
     * 测试头像上传到服务器
     */
    async testUploadAvatar() {
        if (!this.data.avatarUrl) {
            wx.showToast({
                title: '请先获取头像',
                icon: 'none'
            });
            return;
        }

        this.setData({ loading: true });
        this.addTestResult('开始测试头像上传...', null);

        try {
            const userInfo = wx.getStorageSync('userInfo');
            if (!userInfo || !userInfo.openid) {
                throw new Error('用户未登录，请先登录');
            }

            const uploadResult = await new Promise((resolve, reject) => {
                wx.uploadFile({
                    url: `${app.globalData.apiBaseUrl}/api/upload/avatar`,
                    filePath: this.data.avatarUrl,
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

            this.addTestResult(`头像上传成功: ${uploadResult.data.avatarUrl}`, true);

            wx.showToast({
                title: '头像上传成功',
                icon: 'success'
            });

        } catch (error) {
            console.error('❌ 测试头像上传失败:', error);
            this.addTestResult(`头像上传失败: ${error.message}`, false);

            wx.showToast({
                title: '头像上传失败',
                icon: 'none'
            });
        } finally {
            this.setData({ loading: false });
        }
    },

    /**
     * 检查微信API兼容性
     */
    checkApiCompatibility() {
        this.addTestResult('开始检查API兼容性...', null);

        const systemInfo = wx.getSystemInfoSync();
        const sdkVersion = systemInfo.SDKVersion;

        this.addTestResult(`当前微信基础库版本: ${sdkVersion}`, true);
        this.addTestResult(`系统版本: ${systemInfo.system}`, true);

        // 检查 wx.chooseAvatar API
        const hasChooseAvatar = typeof wx.chooseAvatar === 'function';
        this.addTestResult(`wx.chooseAvatar API: ${hasChooseAvatar ? '✅ 支持' : '❌ 不支持 (需要 2.21.0+)'}`, hasChooseAvatar);

        // 检查 wx.getUserProfile API
        const hasGetUserProfile = typeof wx.getUserProfile === 'function';
        this.addTestResult(`wx.getUserProfile API: ${hasGetUserProfile ? '✅ 支持' : '❌ 不支持'}`, hasGetUserProfile);

        // 检查 wx.chooseImage API
        const hasChooseImage = typeof wx.chooseImage === 'function';
        this.addTestResult(`wx.chooseImage API: ${hasChooseImage ? '✅ 支持' : '❌ 不支持'}`, hasChooseImage);

        // 版本比较函数
        function compareVersion(v1, v2) {
            const arr1 = v1.split('.');
            const arr2 = v2.split('.');
            const maxLength = Math.max(arr1.length, arr2.length);

            for (let i = 0; i < maxLength; i++) {
                const num1 = parseInt(arr1[i] || '0');
                const num2 = parseInt(arr2[i] || '0');

                if (num1 > num2) return 1;
                if (num1 < num2) return -1;
            }
            return 0;
        }

        // 检查版本是否满足要求
        const isVersionSupported = compareVersion(sdkVersion, '2.21.0') >= 0;
        this.addTestResult(`版本兼容性: ${isVersionSupported ? '✅ 满足最新功能要求' : '⚠️ 建议升级微信'}`, isVersionSupported);

        if (!isVersionSupported) {
            this.addTestResult('建议：升级微信到最新版本以获得最佳体验', null);
        }

        wx.showToast({
            title: '兼容性检查完成',
            icon: 'success'
        });
    },
});