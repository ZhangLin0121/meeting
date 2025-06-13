// pages/test/test.js
const request = require('../../utils/request.js');

Page({
    data: {
        testResults: [],
        testing: false
    },

    onLoad() {
        console.log('🧪 测试页面加载');
        this.runTests();
    },

    async runTests() {
        this.setData({ testing: true, testResults: [] });

        const tests = [
            { name: '网络状态检查', test: this.testNetworkStatus },
            { name: 'API健康检查', test: this.testAPIHealth },
            { name: '会议室列表', test: this.testRoomsList },
            { name: '用户登录', test: this.testUserLogin },
            { name: '登录流程', test: this.testLoginFlow },
            { name: '完整初始化', test: this.testCompleteInitialization }
        ];

        for (const testCase of tests) {
            try {
                console.log(`🧪 开始测试: ${testCase.name}`);
                const result = await testCase.test.call(this);
                this.addTestResult(testCase.name, true, result);
            } catch (error) {
                console.error(`❌ 测试失败: ${testCase.name}`, error);
                this.addTestResult(testCase.name, false, error.message);
            }
        }

        this.setData({ testing: false });
    },

    addTestResult(name, success, message) {
        const results = this.data.testResults;
        results.push({
            name,
            success,
            message,
            timestamp: new Date().toLocaleTimeString()
        });
        this.setData({ testResults: results });
    },

    // 测试网络状态
    testNetworkStatus() {
        return new Promise((resolve, reject) => {
            wx.getNetworkType({
                success: (res) => {
                    if (res.networkType === 'none') {
                        reject(new Error('无网络连接'));
                    } else {
                        resolve(`网络类型: ${res.networkType}`);
                    }
                },
                fail: (error) => {
                    reject(new Error('获取网络状态失败'));
                }
            });
        });
    },

    // 测试API健康检查
    async testAPIHealth() {
        const result = await request.get('/api/health');
        if (result.success) {
            return `API正常: ${result.message}`;
        } else {
            throw new Error('API健康检查失败');
        }
    },

    // 测试会议室列表
    async testRoomsList() {
        const result = await request.get('/api/rooms');
        if (result.success && result.data) {
            return `获取到${result.data.length}个会议室`;
        } else {
            throw new Error('获取会议室列表失败');
        }
    },

    // 测试用户登录
    testUserLogin() {
        return new Promise((resolve, reject) => {
            wx.login({
                success: (res) => {
                    if (res.code) {
                        resolve(`登录成功，code: ${res.code.substring(0, 10)}...`);
                    } else {
                        reject(new Error('登录失败，未获取到code'));
                    }
                },
                fail: (error) => {
                    reject(new Error('微信登录失败'));
                }
            });
        });
    },

    /**
     * 测试登录流程 - 验证修复效果
     */
    async testLoginFlow() {
        console.log('🧪 开始测试登录流程...');

        wx.showLoading({
            title: '测试登录中...',
            mask: true
        });

        try {
            const WechatAuth = require('../../utils/auth.js');

            // 1. 清除现有登录状态
            WechatAuth.logout();
            console.log('✅ 已清除现有登录状态');

            // 2. 测试智能登录
            console.log('🔐 测试智能登录...');
            const userInfo = await WechatAuth.smartLogin();

            if (userInfo && userInfo.openid) {
                console.log('✅ 智能登录成功:', userInfo.openid);

                // 3. 测试API请求
                console.log('🌐 测试API请求...');
                const request = require('../../utils/request.js');
                const result = await request.get('/api/health');

                console.log('✅ API请求成功:', result);

                wx.hideLoading();
                wx.showModal({
                    title: '测试结果',
                    content: `登录流程测试成功！\n用户ID: ${userInfo.openid.substring(0, 8)}...\nAPI连接正常`,
                    showCancel: false
                });

            } else {
                throw new Error('智能登录返回无效用户信息');
            }

        } catch (error) {
            console.error('❌ 登录流程测试失败:', error);
            wx.hideLoading();
            wx.showModal({
                title: '测试失败',
                content: `登录流程测试失败：${error.message}`,
                showCancel: false
            });
        }
    },

    /**
     * 测试完整初始化流程 - 模拟页面加载过程
     */
    async testCompleteInitialization() {
        console.log('🧪 开始测试完整初始化流程...');

        wx.showLoading({
            title: '测试初始化中...',
            mask: true
        });

        try {
            // 1. 清除现有状态
            const WechatAuth = require('../../utils/auth.js');
            WechatAuth.logout();
            console.log('✅ 已清除现有登录状态');

            // 2. 模拟等待应用级登录
            console.log('⏳ 模拟等待应用级登录...');
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 3. 执行应用级登录
            console.log('🔐 执行应用级登录...');
            const app = getApp();
            if (app && app.performLogin) {
                await app.performLogin();
            }

            // 4. 测试智能登录
            console.log('🔐 测试智能登录...');
            const userInfo = await WechatAuth.smartLogin();

            if (userInfo && userInfo.openid) {
                console.log('✅ 智能登录成功:', userInfo.openid);

                // 5. 测试API请求
                console.log('🌐 测试API请求...');
                const request = require('../../utils/request.js');
                const result = await request.get('/api/rooms');

                console.log('✅ API请求成功:', result);

                wx.hideLoading();
                wx.showModal({
                    title: '测试结果',
                    content: `完整初始化流程测试成功！\n用户ID: ${userInfo.openid.substring(0, 8)}...\n会议室数量: ${result.data ? result.data.length : 0}`,
                    showCancel: false
                });

            } else {
                throw new Error('智能登录返回无效用户信息');
            }

        } catch (error) {
            console.error('❌ 完整初始化流程测试失败:', error);
            wx.hideLoading();
            wx.showModal({
                title: '测试失败',
                content: `完整初始化流程测试失败：${error.message}`,
                showCancel: false
            });
        }
    },

    // 重新运行测试
    onRetryTests() {
        this.runTests();
    },

    // 查看详细日志
    onViewLogs() {
        const errorLogs = wx.getStorageSync('errorLogs') || [];
        const logs = errorLogs.map(log =>
            `${log.timestamp}: ${log.error} (${log.page})`
        ).join('\n\n');

        wx.showModal({
            title: '错误日志',
            content: logs || '暂无错误日志',
            showCancel: false
        });
    },

    // 清除缓存
    onClearCache() {
        wx.showModal({
            title: '清除缓存',
            content: '确定要清除所有缓存数据吗？',
            success: (res) => {
                if (res.confirm) {
                    wx.clearStorageSync();
                    wx.showToast({
                        title: '缓存已清除',
                        icon: 'success'
                    });
                }
            }
        });
    }
});