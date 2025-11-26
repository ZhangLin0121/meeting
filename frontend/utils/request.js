/**
 * 微信小程序网络请求工具
 * 处理API请求、错误处理、重试机制
 */

const envConfig = require('../config/env.js');

class RequestUtil {
    constructor() {
        try {
            const app = getApp();
            this.baseURL = (app && app.globalData && app.globalData.apiBaseUrl) || envConfig.apiBaseUrl;
        } catch (error) {
            this.baseURL = envConfig.apiBaseUrl;
        }
        this.timeout = envConfig.timeout;
    }

    // 提供基础URL给需要使用 wx.uploadFile 等原生API的模块
    getBaseUrl() {
        return this.baseURL;
    }

    request(options) {
        return new Promise((resolve, reject) => {
            const { url, method = 'GET', data = {}, header = {} } = options;
            const fullUrl = url.startsWith('http') ? url : `${this.baseURL}${url}`;

            const requestHeader = {
                'Content-Type': 'application/json',
                ...header
            };

            const userInfo = this.getUserInfo();
            if (userInfo && userInfo.openid) {
                requestHeader['X-User-Openid'] = userInfo.openid;
            }

            wx.request({
                url: fullUrl,
                method,
                data,
                header: requestHeader,
                timeout: this.timeout,
                success: (res) => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(res.data);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${res.data && res.data.message || '请求失败'}`));
                    }
                },
                fail: (error) => {
                    reject(new Error(error.errMsg || '网络请求失败'));
                }
            });
        });
    }

    getUserInfo() {
        try {
            const app = getApp();
            if (app && app.globalData && app.globalData.userInfo && app.globalData.userInfo.openid) {
                return app.globalData.userInfo;
            }
            const userInfo = wx.getStorageSync('userInfo');
            if (userInfo && userInfo.openid) {
                return userInfo;
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    get(url, params = {}) {
        const queryString = Object.keys(params)
            .filter(key => params[key] !== undefined && params[key] !== null)
            .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
            .join('&');

        const fullUrl = queryString ? `${url}?${queryString}` : url;
        return this.request({ url: fullUrl, method: 'GET' });
    }

    post(url, data = {}) {
        return this.request({ url, method: 'POST', data });
    }

    put(url, data = {}) {
        return this.request({ url, method: 'PUT', data });
    }

    delete(url, data = {}) {
        return this.request({ url, method: 'DELETE', data });
    }
}

const request = new RequestUtil();
module.exports = request;
