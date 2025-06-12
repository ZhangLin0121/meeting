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
            { name: '用户登录', test: this.testUserLogin }
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