/**
 * 微信小程序网络请求工具
 * 处理API请求、错误处理、重试机制
 */

class RequestUtil {
    constructor() {
        // 安全获取baseURL，避免getApp()返回undefined
        try {
            const app = getApp();
            this.baseURL = (app && app.globalData && app.globalData.apiBaseUrl) ?
                app.globalData.apiBaseUrl :
                'https://www.cacophonyem.me/meeting';
        } catch (error) {
            console.warn('⚠️ 获取App实例失败，使用默认API地址:', error);
            this.baseURL = 'https://www.cacophonyem.me/meeting';
        }

        this.timeout = 10000; // 10秒超时
        this.retryCount = 3; // 重试次数
        this.isHandlingAuthError = false; // 防止重复处理认证错误的标志

        // 检测设备类型
        this.isAndroid = this.detectAndroidDevice();
        if (this.isAndroid) {
            console.log('📱 检测到安卓设备，启用特殊处理逻辑');
            this.timeout = 15000; // 安卓设备增加超时时间
        }

        console.log('🔧 RequestUtil 初始化完成，baseURL:', this.baseURL);
    }

    /**
     * 检测是否为安卓设备
     */
    detectAndroidDevice() {
        try {
            const systemInfo = wx.getSystemInfoSync();
            const platform = systemInfo.platform;
            const userAgent = systemInfo.brand || '';

            console.log('📱 设备信息:', {
                platform,
                brand: systemInfo.brand,
                model: systemInfo.model,
                system: systemInfo.system
            });

            return platform === 'android' ||
                userAgent.toLowerCase().includes('android') ||
                systemInfo.system.toLowerCase().includes('android');
        } catch (error) {
            console.warn('⚠️ 无法检测设备类型:', error);
            return false;
        }
    }

    /**
     * 发起网络请求
     * @param {Object} options 请求配置
     * @returns {Promise}
     */
    request(options) {
        return new Promise((resolve, reject) => {
            const {
                url,
                method = 'GET',
                data = {},
                header = {},
                timeout = this.timeout,
                retry = 0
            } = options;

            // 构建完整URL
            const fullUrl = url.startsWith('http') ? url : `${this.baseURL}${url}`;

            // 默认请求头
            const defaultHeader = {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            };

            // 合并请求头
            const requestHeader = {...defaultHeader, ...header };

            // 增强用户标识获取逻辑 - 修复安卓设备问题
            const userInfo = this.getUserInfo();
            if (userInfo && userInfo.openid) {
                // 使用多种请求头格式确保兼容性
                requestHeader['X-User-Openid'] = userInfo.openid;
                requestHeader['x-user-openid'] = userInfo.openid; // 小写版本
                requestHeader['openid'] = userInfo.openid; // 简化版本

                // 添加调试信息
                console.log('🔑 添加用户标识到请求头:', userInfo.openid);
            } else {
                console.warn('⚠️ 未找到用户标识信息');
            }

            console.log(`🌐 发起请求: ${method} ${fullUrl}`, {
                data,
                header: requestHeader
            });

            wx.request({
                url: fullUrl,
                method,
                data,
                header: requestHeader,
                timeout,
                success: (res) => {
                    console.log(`✅ 请求成功: ${method} ${fullUrl}`, res);

                    // 检查HTTP状态码
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(res.data);
                    } else {
                        console.error(`❌ HTTP错误: ${res.statusCode}`, res);

                        // 特殊处理401错误 - 可能是登录状态丢失
                        if (res.statusCode === 401) {
                            this.handleAuthError();
                        }

                        reject(new Error(`HTTP ${res.statusCode}: ${res.data?.message || '请求失败'}`));
                    }
                },
                fail: (error) => {
                    console.error(`❌ 请求失败: ${method} ${fullUrl}`, error);

                    // 网络错误重试
                    if (retry < this.retryCount && this.shouldRetry(error)) {
                        console.log(`🔄 重试请求 (${retry + 1}/${this.retryCount}): ${method} ${fullUrl}`);
                        setTimeout(() => {
                            this.request({...options, retry: retry + 1 })
                                .then(resolve)
                                .catch(reject);
                        }, 1000 * (retry + 1)); // 递增延迟
                    } else {
                        reject(this.formatError(error));
                    }
                }
            });
        });
    }

    /**
     * 增强的用户信息获取方法
     * 解决安卓设备上的存储同步问题
     */
    getUserInfo() {
        try {
            // 首先尝试从全局状态获取
            const app = getApp();
            if (app && app.globalData && app.globalData.userInfo && app.globalData.userInfo.openid) {
                console.log('📱 从全局状态获取用户信息');
                return app.globalData.userInfo;
            }

            // 然后尝试从本地存储获取
            const userInfo = wx.getStorageSync('userInfo');
            if (userInfo && userInfo.openid) {
                console.log('💾 从本地存储获取用户信息');
                // 同步到全局状态
                if (app && app.globalData) {
                    app.globalData.userInfo = userInfo;
                }
                return userInfo;
            }

            // 安卓设备特殊处理：可能存在存储延迟
            if (this.isAndroid) {
                console.log('📱 安卓设备：尝试延迟获取用户信息');
                // 短暂延迟后再次尝试
                setTimeout(() => {
                    const retryUserInfo = wx.getStorageSync('userInfo');
                    if (retryUserInfo && retryUserInfo.openid && app && app.globalData) {
                        app.globalData.userInfo = retryUserInfo;
                        console.log('✅ 安卓设备延迟获取成功');
                    }
                }, 100);
            }

            console.warn('⚠️ 未找到有效的用户信息');
            return null;
        } catch (error) {
            console.error('❌ 获取用户信息失败:', error);
            return null;
        }
    }

    /**
     * 处理认证错误 - 优化版本，避免重复弹窗
     */
    handleAuthError() {
        console.warn('🔐 检测到认证错误，可能需要重新登录');

        // 防止重复处理认证错误
        if (this.isHandlingAuthError) {
            console.log('⚠️ 正在处理认证错误，跳过重复处理');
            return;
        }
        this.isHandlingAuthError = true;

        // 清除可能损坏的用户信息
        try {
            wx.removeStorageSync('userInfo');
            const app = getApp();
            if (app && app.globalData) {
                app.globalData.userInfo = null;
            }
        } catch (error) {
            console.error('清除用户信息失败:', error);
        }

        // 静默重新登录，避免弹窗
        this.silentReLogin()
            .then(() => {
                console.log('✅ 静默重新登录成功');
                this.isHandlingAuthError = false;
            })
            .catch((error) => {
                console.error('❌ 静默重新登录失败:', error);
                this.isHandlingAuthError = false;

                // 只有在静默登录失败时才显示弹窗
                wx.showModal({
                    title: '登录提示',
                    content: '缺少用户身份信息，请重新登录',
                    showCancel: false,
                    confirmText: '重新登录',
                    success: () => {
                        try {
                            const app = getApp();
                            if (app && app.performLogin) {
                                app.performLogin();
                            }
                        } catch (error) {
                            console.error('触发重新登录失败:', error);
                        }
                    }
                });
            });
    }

    /**
     * 静默重新登录 - 使用智能登录
     */
    async silentReLogin() {
        try {
            console.log('🔄 开始静默重新登录...');
            const WechatAuth = require('./auth.js');

            // 使用智能登录，避免重复登录
            const userInfo = await WechatAuth.smartLogin();

            if (userInfo && userInfo.openid) {
                console.log('✅ 静默重新登录成功:', userInfo.openid.substring(0, 8) + '...');

                // 确保全局状态也更新
                const app = getApp();
                if (app && app.globalData) {
                    app.globalData.userInfo = userInfo;
                }

                return userInfo;
            } else {
                throw new Error('静默登录失败：无效的用户信息');
            }
        } catch (error) {
            console.error('❌ 静默重新登录失败:', error);
            throw error;
        }
    }

    /**
     * GET请求
     */
    get(url, params = {}, options = {}) {
        // 构建查询字符串
        const queryString = Object.keys(params)
            .filter(key => params[key] !== undefined && params[key] !== null)
            .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
            .join('&');

        const fullUrl = queryString ? `${url}?${queryString}` : url;

        return this.request({
            url: fullUrl,
            method: 'GET',
            ...options
        });
    }

    /**
     * POST请求
     */
    post(url, data = {}, options = {}) {
        return this.request({
            url,
            method: 'POST',
            data,
            ...options
        });
    }

    /**
     * PUT请求
     */
    put(url, data = {}, options = {}) {
        return this.request({
            url,
            method: 'PUT',
            data,
            ...options
        });
    }

    /**
     * DELETE请求
     */
    delete(url, options = {}) {
        return this.request({
            url,
            method: 'DELETE',
            ...options
        });
    }

    /**
     * 判断是否应该重试
     */
    shouldRetry(error) {
        // 网络错误、超时错误可以重试
        const retryableErrors = [
            'request:fail timeout',
            'request:fail',
            'request:fail net::ERR_NETWORK_CHANGED',
            'request:fail net::ERR_INTERNET_DISCONNECTED'
        ];

        return retryableErrors.some(errorType =>
            error.errMsg && error.errMsg.includes(errorType)
        );
    }

    /**
     * 格式化错误信息
     */
    formatError(error) {
        let message = '网络请求失败';

        if (error.errMsg) {
            if (error.errMsg.includes('timeout')) {
                message = '请求超时，请检查网络连接';
            } else if (error.errMsg.includes('fail')) {
                message = '网络连接失败，请检查网络设置';
            }
        }

        return new Error(message);
    }

    /**
     * 上传文件
     */
    uploadFile(url, filePath, name = 'file', formData = {}) {
        return new Promise((resolve, reject) => {
            const fullUrl = url.startsWith('http') ? url : `${this.baseURL}${url}`;

            // 添加用户标识
            const userInfo = wx.getStorageSync('userInfo');
            if (userInfo && userInfo.openid) {
                formData['X-User-Openid'] = userInfo.openid;
            }

            console.log(`📤 上传文件: ${fullUrl}`, { filePath, name, formData });

            wx.uploadFile({
                url: fullUrl,
                filePath,
                name,
                formData,
                success: (res) => {
                    console.log('✅ 文件上传成功:', res);
                    try {
                        const data = JSON.parse(res.data);
                        resolve(data);
                    } catch (e) {
                        resolve(res.data);
                    }
                },
                fail: (error) => {
                    console.error('❌ 文件上传失败:', error);
                    reject(this.formatError(error));
                }
            });
        });
    }
}

// 创建实例
const request = new RequestUtil();

// 导出方法
module.exports = {
    request: request.request.bind(request),
    get: request.get.bind(request),
    post: request.post.bind(request),
    put: request.put.bind(request),
    delete: request.delete.bind(request),
    uploadFile: request.uploadFile.bind(request)
};