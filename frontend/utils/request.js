/**
 * 微信小程序网络请求工具
 * 处理API请求、错误处理、重试机制
 */

const app = getApp();

class RequestUtil {
    constructor() {
        this.baseURL = app.globalData.apiBaseUrl;
        this.timeout = 10000; // 10秒超时
        this.retryCount = 3; // 重试次数
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

            // 添加用户标识（如果存在）
            const userInfo = wx.getStorageSync('userInfo');
            if (userInfo && userInfo.openId) {
                requestHeader['X-User-Openid'] = userInfo.openId;
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
            if (userInfo && userInfo.openId) {
                formData['X-User-Openid'] = userInfo.openId;
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