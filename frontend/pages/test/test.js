// pages/test/test.js - 微信小程序诊断测试页面
const request = require('../../utils/request.js');
const app = getApp();
const WechatAuth = require('../../utils/auth.js');

Page({
    /**
     * 页面的初始数据
     */
    data: {
        // 诊断状态
        diagnostics: {
            appStatus: '检查中...',
            loginStatus: '检查中...',
            apiStatus: '检查中...',
            storageStatus: '检查中...',
            networkStatus: '检查中...'
        },
        // 详细信息
        details: {
            userInfo: null,
            systemInfo: null,
            networkType: null,
            logs: []
        },
        // 测试按钮状态
        testing: false
    },

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad() {
        console.log('🧪 诊断页面启动');
        this.addLog('诊断页面启动');
        this.startDiagnostics();
    },

    /**
     * 添加日志
     */
    addLog(message) {
        const logs = this.data.details.logs;
        logs.unshift({
            time: new Date().toLocaleTimeString(),
            message: message
        });
        
        // 只保留最近50条日志
        if (logs.length > 50) {
            logs.splice(50);
        }
        
        this.setData({
            'details.logs': logs
        });
    },

    /**
     * 开始诊断
     */
    async startDiagnostics() {
        this.addLog('开始系统诊断...');
        
        try {
            // 1. 检查App状态
            await this.checkAppStatus();
            
            // 2. 检查网络状态
            await this.checkNetworkStatus();
            
            // 3. 检查存储状态
            await this.checkStorageStatus();
            
            // 4. 检查登录状态
            await this.checkLoginStatus();
            
            // 5. 检查API连接
            await this.checkAPIStatus();
            
            this.addLog('诊断完成！');
            
        } catch (error) {
            console.error('❌ 诊断过程出错:', error);
            this.addLog(`诊断出错: ${error.message}`);
        }
    },

    /**
     * 检查App状态
     */
    async checkAppStatus() {
        try {
            this.addLog('检查App状态...');
            
            const app = getApp();
            const systemInfo = wx.getSystemInfoSync();
            
            let status = '✅ 正常';
            if (!app) {
                status = '❌ App实例不存在';
            } else if (!app.globalData) {
                status = '⚠️ globalData不存在';
            }
            
            this.setData({
                'diagnostics.appStatus': status,
                'details.systemInfo': {
                    platform: systemInfo.platform,
                    system: systemInfo.system,
                    version: systemInfo.version,
                    SDKVersion: systemInfo.SDKVersion,
                    brand: systemInfo.brand,
                    model: systemInfo.model
                }
            });
            
            this.addLog(`App状态: ${status}`);
            this.addLog(`系统平台: ${systemInfo.platform} ${systemInfo.system}`);
            
        } catch (error) {
            const errorMsg = '❌ App状态检查失败';
            this.setData({
                'diagnostics.appStatus': errorMsg
            });
            this.addLog(`${errorMsg}: ${error.message}`);
        }
    },

    /**
     * 检查网络状态
     */
    async checkNetworkStatus() {
        try {
            this.addLog('检查网络状态...');
            
            const networkInfo = await new Promise((resolve, reject) => {
                wx.getNetworkType({
                    success: resolve,
                    fail: reject
                });
            });
            
            let status = '✅ 网络正常';
            if (networkInfo.networkType === 'none') {
                status = '❌ 网络不可用';
            } else if (networkInfo.networkType === 'unknown') {
                status = '⚠️ 网络状态未知';
            }
            
            this.setData({
                'diagnostics.networkStatus': status,
                'details.networkType': networkInfo.networkType
            });
            
            this.addLog(`网络状态: ${status} (${networkInfo.networkType})`);
            
        } catch (error) {
            const errorMsg = '❌ 网络状态检查失败';
            this.setData({
                'diagnostics.networkStatus': errorMsg
            });
            this.addLog(`${errorMsg}: ${error.message}`);
        }
    },

    /**
     * 检查存储状态
     */
    async checkStorageStatus() {
        try {
            this.addLog('检查存储状态...');
            
            const userInfo = wx.getStorageSync('userInfo');
            const logs = wx.getStorageSync('logs');
            const loginTime = wx.getStorageSync('loginTime');
            
            let status = '✅ 存储正常';
            let details = [];
            
            if (userInfo) {
                details.push(`用户信息: 已存储 (openid: ${userInfo.openid ? '有' : '无'})`);
            } else {
                details.push('用户信息: 未存储');
                status = '⚠️ 缺少用户信息';
            }
            
            if (loginTime) {
                const loginDate = new Date(loginTime);
                details.push(`登录时间: ${loginDate.toLocaleString()}`);
            } else {
                details.push('登录时间: 未记录');
            }
            
            this.setData({
                'diagnostics.storageStatus': status,
                'details.userInfo': userInfo
            });
            
            this.addLog(`存储状态: ${status}`);
            details.forEach(detail => this.addLog(detail));
            
        } catch (error) {
            const errorMsg = '❌ 存储状态检查失败';
            this.setData({
                'diagnostics.storageStatus': errorMsg
            });
            this.addLog(`${errorMsg}: ${error.message}`);
        }
    },

    /**
     * 检查登录状态
     */
    async checkLoginStatus() {
        try {
            this.addLog('检查登录状态...');
            
            const app = getApp();
            const storageUserInfo = wx.getStorageSync('userInfo');
            let globalUserInfo = null;
            
            if (app && app.globalData && app.globalData.userInfo) {
                globalUserInfo = app.globalData.userInfo;
            }
            
            let status = '❌ 未登录';
            let details = [];
            
            if (globalUserInfo && globalUserInfo.openid) {
                status = '✅ 全局状态已登录';
                details.push(`全局openid: ${globalUserInfo.openid}`);
            }
            
            if (storageUserInfo && storageUserInfo.openid) {
                if (status === '❌ 未登录') {
                    status = '⚠️ 仅本地存储有登录信息';
                }
                details.push(`存储openid: ${storageUserInfo.openid}`);
            }
            
            this.setData({
                'diagnostics.loginStatus': status
            });
            
            this.addLog(`登录状态: ${status}`);
            details.forEach(detail => this.addLog(detail));
            
        } catch (error) {
            const errorMsg = '❌ 登录状态检查失败';
            this.setData({
                'diagnostics.loginStatus': errorMsg
            });
            this.addLog(`${errorMsg}: ${error.message}`);
        }
    },

    /**
     * 检查API连接
     */
    async checkAPIStatus() {
        try {
            this.addLog('检查API连接...');
            
            // 测试健康检查接口
            const healthResult = await request.get('/api/health');
            
            let status = '✅ API连接正常';
            this.addLog(`API健康检查: ${healthResult.message || '成功'}`);
            
            // 测试会议室列表接口
            try {
                const roomsResult = await request.get('/api/rooms');
                if (roomsResult.success) {
                    this.addLog(`会议室接口: 正常 (${roomsResult.data ? roomsResult.data.length : 0}个会议室)`);
                } else {
                    this.addLog(`会议室接口: ${roomsResult.message}`);
                    status = '⚠️ 部分API异常';
                }
            } catch (roomError) {
                this.addLog(`会议室接口: 失败 - ${roomError.message}`);
                status = '⚠️ 部分API异常';
            }
            
            this.setData({
                'diagnostics.apiStatus': status
            });
            
        } catch (error) {
            const errorMsg = '❌ API连接失败';
            this.setData({
                'diagnostics.apiStatus': errorMsg
            });
            this.addLog(`${errorMsg}: ${error.message}`);
            this.addLog('请检查网络连接和服务器状态');
        }
    },

    /**
     * 强制重新登录
     */
    async forceLogin() {
        try {
            this.setData({ testing: true });
            this.addLog('开始强制重新登录...');
            
            const WechatAuth = require('../../utils/auth.js');
            const userInfo = await WechatAuth.performWechatLogin();
            
            if (userInfo && userInfo.openid) {
                this.addLog(`重新登录成功: ${userInfo.openid}`);
                wx.showToast({
                    title: '登录成功',
                    icon: 'success'
                });
                
                // 重新运行诊断
                setTimeout(() => {
                    this.startDiagnostics();
                }, 1000);
            } else {
                throw new Error('登录返回数据无效');
            }
            
        } catch (error) {
            this.addLog(`强制登录失败: ${error.message}`);
            wx.showModal({
                title: '登录失败',
                content: error.message,
                showCancel: false
            });
        } finally {
            this.setData({ testing: false });
        }
    },

    /**
     * 清除所有数据
     */
    clearAllData() {
        wx.showModal({
            title: '确认清除',
            content: '这将清除所有本地数据，需要重新登录',
            success: (res) => {
                if (res.confirm) {
                    try {
                        wx.clearStorageSync();
                        const app = getApp();
                        if (app && app.globalData) {
                            app.globalData.userInfo = null;
                        }
                        
                        this.addLog('已清除所有本地数据');
                        wx.showToast({
                            title: '清除成功',
                            icon: 'success'
                        });
                        
                        // 重新运行诊断
                        setTimeout(() => {
                            this.startDiagnostics();
                        }, 1000);
                        
                    } catch (error) {
                        this.addLog(`清除数据失败: ${error.message}`);
                    }
                }
            }
        });
    },

    /**
     * 跳转到会议室列表
     */
    goToRoomList() {
        wx.switchTab({
            url: '/pages/roomList/roomList'
        });
    },

    /**
     * 重新运行诊断
     */
    runDiagnostics() {
        this.setData({
            'details.logs': []
        });
        this.startDiagnostics();
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
        console.log('🧪 诊断页面显示');
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