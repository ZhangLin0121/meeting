// pages/test/test.js
const request = require('../../utils/request.js');

Page({
    /**
     * 页面的初始数据
     */
    data: {
        logs: [],
        testResults: [],
        userInfo: null,
        loginStatus: '未登录',
        apiConnected: false
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

    }
});