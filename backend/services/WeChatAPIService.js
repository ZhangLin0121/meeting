const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger'); // 假设存在一个logger工具

class WeChatAPIService {
    constructor() {
        this.appId = config.wechat.appId;
        this.appSecret = config.wechat.appSecret;
        this.accessToken = null;
        this.accessTokenExpiresIn = 0;
        this.templateId = config.wechat.subscribeMessageTemplateId;
        this.cancelTemplateId = config.wechat.cancelSubscribeMessageTemplateId;
        this.reminderTemplateId = config.wechat.reminderTemplateId;
        this.gettingAccessToken = false; // 防止并发请求accessToken
    }

    /**
     * 获取微信 access_token
     * 优先从缓存获取，如果过期则重新请求
     * @returns {Promise<string>}
     */
    async getAccessToken() {
        if (!this.appId || !this.appSecret) {
            logger.error('WeChatAPIService: appId or appSecret is not configured, skip fetching access_token.');
            return null;
        }

        if (this.accessToken && (Date.now() < this.accessTokenExpiresIn)) {
            return this.accessToken;
        }

        if (this.gettingAccessToken) {
            // 如果正在获取，等待结果
            logger.warn('WeChatAPIService: AccessToken is already being fetched, waiting...');
            return new Promise(resolve => {
                const checkInterval = setInterval(() => {
                    if (!this.gettingAccessToken && this.accessToken) {
                        clearInterval(checkInterval);
                        resolve(this.accessToken);
                    } else if (!this.gettingAccessToken && !this.accessToken) {
                        // 如果获取失败，尝试重新获取 (避免无限等待)
                        clearInterval(checkInterval);
                        this.getAccessToken().then(resolve).catch(() => resolve(null));
                    }
                }, 500);
            });
        }

        this.gettingAccessToken = true;
        logger.info('WeChatAPIService: Fetching new access_token...');

        try {
            const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${this.appId}&secret=${this.appSecret}`;
            const response = await axios.get(url);
            const { access_token, expires_in } = response.data;

            if (access_token) {
                this.accessToken = access_token;
                // 提前10分钟过期，确保在使用时总是有效的
                this.accessTokenExpiresIn = Date.now() + (expires_in - 600) * 1000;
                logger.info('WeChatAPIService: Access_token fetched successfully.');
                return access_token;
            } else {
                logger.error('WeChatAPIService: Failed to get access_token', response.data);
                throw new Error('Failed to get access_token');
            }
        } catch (error) {
            logger.error('WeChatAPIService: Error fetching access_token', error.message);
            this.accessToken = null;
            this.accessTokenExpiresIn = 0;
            throw error;
        } finally {
            this.gettingAccessToken = false;
        }
    }

    /**
     * 发送微信订阅消息
     * @param {string} toUser - 接收消息的用户 OpenID
     * @param {Object} data - 消息内容 (与模板关键词对应)
     * @param {string} page - 点击消息后跳转的小程序页面路径
     * @param {string} templateId - 可选，指定模板ID（默认使用配置的成功通知模板）
     * @returns {Promise<Object>}
     */
    async sendSubscriptionMessage(toUser, data, page = '', templateId = null) {
        const useTemplateId = templateId || this.templateId;
        if (!useTemplateId) {
            logger.warn('WeChatAPIService: Subscription message templateId is not configured.');
            return { errcode: -1, errmsg: 'Template ID not configured' };
        }

        try {
            const accessToken = await this.getAccessToken();
            if (!accessToken) {
                logger.error('WeChatAPIService: No access_token available to send subscription message.');
                return { errcode: -1, errmsg: 'No access_token' };
            }

            const url = `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${accessToken}`;
            const postData = {
                touser: toUser,
                template_id: useTemplateId,
                page: page,
                data: data
            };

            logger.info('WeChatAPIService: Sending subscription message...', JSON.stringify(postData));
            const response = await axios.post(url, postData);

            if (response.data.errcode === 0) {
                logger.info('WeChatAPIService: Subscription message sent successfully to', toUser);
                return response.data;
            } else {
                logger.error('WeChatAPIService: Failed to send subscription message', response.data);
                // 如果 access_token 失效，强制刷新
                if (response.data.errcode === 40001 || response.data.errcode === 42001) {
                    logger.warn('WeChatAPIService: AccessToken expired or invalid, forcing refresh.');
                    this.accessToken = null;
                    this.accessTokenExpiresIn = 0;
                }
                return response.data;
            }
        } catch (error) {
            logger.error('WeChatAPIService: Error sending subscription message', error.message);
            return { errcode: -1, errmsg: error.message };
        }
    }
}

module.exports = new WeChatAPIService();
