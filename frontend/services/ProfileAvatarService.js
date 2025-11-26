const request = require('../utils/request');

/**
 * 个人资料头像服务
 * 处理所有头像相关的逻辑
 */
class ProfileAvatarService {

    /**
     * 选择并上传头像
     * @param {Object} pageContext - 页面上下文
     * @param {string} sourceType - 来源类型 ('album', 'camera')
     * @returns {Promise<void>}
     */
    static async chooseAndUploadAvatar(pageContext, sourceType) {
        try {
            pageContext.setData({ uploadingAvatar: true });

            wx.showLoading({
                title: '选择头像中...',
                mask: true
            });

            console.log('📷 开始选择头像，来源:', sourceType);

            // 选择图片
            const chooseResult = await new Promise((resolve, reject) => {
                wx.chooseImage({
                    count: 1,
                    sizeType: ['compressed'], // 使用压缩图
                    sourceType: sourceType ? [sourceType] : ['album', 'camera'],
                    success: resolve,
                    fail: reject
                });
            });

            if (!chooseResult.tempFilePaths || chooseResult.tempFilePaths.length === 0) {
                throw new Error('未选择图片');
            }

            const tempFilePath = chooseResult.tempFilePaths[0];
            console.log('✅ 图片选择成功:', tempFilePath);

            // 更新加载提示
            wx.showLoading({
                title: '上传头像中...',
                mask: true
            });

            // 上传到服务器
            const uploadResult = await this.uploadAvatarToServer(tempFilePath);
            console.log('📤 上传结果:', uploadResult);

            // 更新用户信息
            const updatedUserInfo = this.updateLocalAvatar(pageContext, uploadResult.data.avatarUrl);

            wx.showToast({
                title: '头像更新成功',
                icon: 'success'
            });

            console.log('✅ 头像上传成功:', uploadResult.data.avatarUrl);

            // 强制刷新页面数据以确保头像显示更新
            setTimeout(() => {
                if (pageContext.refreshData) {
                    pageContext.refreshData(true);
                }
            }, 500);

        } catch (error) {
            console.error('❌ 头像上传失败:', error);
            wx.showToast({
                title: error.message || '头像上传失败',
                icon: 'none'
            });
        } finally {
            pageContext.setData({ uploadingAvatar: false });
            wx.hideLoading();
        }
    }

    /**
     * 直接获取微信头像（推荐方式）
     * @param {Object} pageContext - 页面上下文
     * @returns {Promise<void>}
     */
    static async getWechatAvatar(pageContext) {
        try {
            wx.showLoading({
                title: '获取头像中...',
                mask: true
            });

            // 检查API兼容性
            if (!wx.chooseAvatar) {
                console.log('⚠️ 当前版本不支持 wx.chooseAvatar，使用getUserProfile方案');
                wx.hideLoading();

                // 直接调用获取用户信息方法
                await this.getWechatUserProfile(pageContext);
                return;
            }

            // 使用新的微信头像选择器
            const result = await new Promise((resolve, reject) => {
                wx.chooseAvatar({
                    success: resolve,
                    fail: reject
                });
            });

            console.log('✅ 微信chooseAvatar获取成功:', result.avatarUrl);
            // 仅在调试模式下打印详细返回内容，避免污染控制台
            try {
                const env = require('../config/env.js');
                if (env.debug) {
                    console.log('📱 微信chooseAvatar完整结果:', JSON.stringify(result));
                    console.log('📱 chooseAvatar返回的数据结构:', Object.keys(result));
                    for (const key in result) {
                        console.log(`   ${key}:`, result[key]);
                    }
                }
            } catch (e) {}

            wx.hideLoading();

            // 如果返回的是本地临时文件，直接上传到服务器（会同时更新数据库与返回可访问路径）
            if (result.avatarUrl && !/^https?:\/\//.test(result.avatarUrl)) {
                wx.showLoading({ title: '上传头像中...', mask: true });
                const uploadRes = await this.uploadAvatarToServer(result.avatarUrl);
                const serverAvatar = uploadRes && uploadRes.data && uploadRes.data.avatarUrl ? uploadRes.data.avatarUrl : '';
                if (serverAvatar) {
                    this.updateLocalAvatar(pageContext, serverAvatar);
                    wx.showToast({ title: '头像更新成功', icon: 'success' });
                    setTimeout(() => pageContext.refreshData && pageContext.refreshData(true), 500);
                } else {
                    throw new Error('上传失败');
                }
            } else {
                // 远程URL：如检测为默认头像，尝试使用 getUserProfile 兜底，再保存
                let remoteUrl = result.avatarUrl;
                if (this.isDefaultWechatAvatar(remoteUrl) && typeof wx.getUserProfile === 'function') {
                    try {
                        const prof = await new Promise((resolve, reject) => {
                            wx.getUserProfile({ desc: '用于更新头像', success: resolve, fail: reject });
                        });
                        if (prof && prof.userInfo && prof.userInfo.avatarUrl) {
                            remoteUrl = prof.userInfo.avatarUrl;
                        }
                    } catch (e) {
                        // 忽略，继续使用原始URL
                    }
                }
                console.log('📱 使用微信头像URL保存:', remoteUrl);
                await this.saveAvatarToServer(pageContext, remoteUrl);
            }

        } catch (error) {
            console.error('❌ 获取微信头像失败:', error);
            wx.hideLoading();

            let errorMessage = '获取头像失败';
            if (error.errMsg) {
                if (error.errMsg.includes('cancel')) {
                    errorMessage = '已取消选择头像';
                } else if (error.errMsg.includes('fail')) {
                    errorMessage = '获取头像失败，请重试';
                }
            }

            wx.showToast({
                title: errorMessage,
                icon: 'none'
            });
        }
    }

    /**
     * 测试头像URL是否能正常加载
     * @param {string} avatarUrl - 头像URL
     * @returns {Promise<boolean>} 是否能正常加载
     */
    static async testAvatarUrl(avatarUrl) {
        return new Promise((resolve) => {
            if (!avatarUrl) {
                console.log('❌ 头像URL为空');
                resolve(false);
                return;
            }

            console.log('🧪 开始测试头像URL:', avatarUrl);

            wx.getImageInfo({
                src: avatarUrl,
                success: (res) => {
                    console.log('✅ 头像URL测试成功:', avatarUrl);
                    console.log('📏 图片尺寸:', res.width, 'x', res.height);
                    console.log('📁 图片类型:', res.type);
                    resolve(true);
                },
                fail: (error) => {
                    console.error('❌ 头像URL测试失败:', avatarUrl);
                    console.error('❌ 错误详情:', error);
                    console.error('❌ 错误信息:', error.errMsg);
                    resolve(false);
                }
            });
        });
    }

    /**
     * 诊断当前头像状态
     * @param {Object} pageContext - 页面上下文
     */
    static async diagnoseAvatar(pageContext) {
        console.log('🔍 开始头像诊断...');

        // 检查当前页面数据中的头像
        const pageAvatarUrl = pageContext.data.userInfo?.avatarUrl;
        console.log('📋 页面数据中的头像URL:', pageAvatarUrl);
        console.log('📋 页面头像是否是默认:', this.isDefaultWechatAvatar(pageAvatarUrl));

        // 检查全局数据中的头像
        const app = getApp();
        const globalAvatarUrl = app.globalData?.userInfo?.avatarUrl;
        console.log('🌐 全局数据中的头像URL:', globalAvatarUrl);
        console.log('🌐 全局头像是否是默认:', this.isDefaultWechatAvatar(globalAvatarUrl));

        // 检查本地存储中的头像
        const storageAvatarUrl = wx.getStorageSync('userInfo')?.avatarUrl;
        console.log('💾 本地存储中的头像URL:', storageAvatarUrl);
        console.log('💾 存储头像是否是默认:', this.isDefaultWechatAvatar(storageAvatarUrl));

        // 测试当前头像URL是否能加载
        if (pageAvatarUrl) {
            const canLoad = await this.testAvatarUrl(pageAvatarUrl);
            console.log('🧪 页面头像加载测试结果:', canLoad);
        }

        console.log('🔍 头像诊断完成');
    }

    /**
     * 测试微信API返回的头像
     * @param {Object} pageContext - 页面上下文
     */
    static async testWechatAvatarApis(pageContext) {
        console.log('🧪 开始测试微信头像API...');

        try {
            // 测试wx.getUserInfo
            if (typeof wx.getUserInfo === 'function') {
                console.log('🧪 测试wx.getUserInfo...');
                const userInfoResult = await new Promise((resolve) => {
                    wx.getUserInfo({
                        success: resolve,
                        fail: (error) => {
                            console.error('❌ wx.getUserInfo失败:', error);
                            resolve(null);
                        }
                    });
                });

                if (userInfoResult && userInfoResult.userInfo) {
                    console.log('✅ wx.getUserInfo结果:', userInfoResult.userInfo);
                    console.log('✅ wx.getUserInfo头像URL:', userInfoResult.userInfo.avatarUrl);
                    console.log('✅ wx.getUserInfo是否是默认头像:', this.isDefaultWechatAvatar(userInfoResult.userInfo.avatarUrl));
                }
            }

            // 测试wx.chooseAvatar
            if (wx.chooseAvatar) {
                console.log('🧪 测试wx.chooseAvatar...');
                try {
                    const chooseAvatarResult = await new Promise((resolve, reject) => {
                        wx.chooseAvatar({
                            success: resolve,
                            fail: reject
                        });
                    });
                    console.log('✅ wx.chooseAvatar结果:', chooseAvatarResult);
                    console.log('✅ wx.chooseAvatar头像URL:', chooseAvatarResult.avatarUrl);
                    console.log('✅ wx.chooseAvatar是否是默认头像:', this.isDefaultWechatAvatar(chooseAvatarResult.avatarUrl));
                } catch (error) {
                    console.error('❌ wx.chooseAvatar失败:', error);
                }
            }

            // 测试wx.getUserProfile
            if (typeof wx.getUserProfile === 'function') {
                console.log('🧪 测试wx.getUserProfile...');
                try {
                    const userProfileResult = await new Promise((resolve, reject) => {
                        wx.getUserProfile({
                            desc: '测试获取头像',
                            lang: 'zh_CN',
                            success: resolve,
                            fail: reject
                        });
                    });
                    console.log('✅ wx.getUserProfile结果:', userProfileResult.userInfo);
                    console.log('✅ wx.getUserProfile头像URL:', userProfileResult.userInfo.avatarUrl);
                    console.log('✅ wx.getUserProfile是否是默认头像:', this.isDefaultWechatAvatar(userProfileResult.userInfo.avatarUrl));
                } catch (error) {
                    console.error('❌ wx.getUserProfile失败:', error);
                }
            }

        } catch (error) {
            console.error('❌ 测试微信头像API失败:', error);
        }

        console.log('🧪 微信头像API测试完成');
    }

    

    /**
     * 获取微信用户头像（兼容方式）
     * @param {Object} pageContext - 页面上下文
     * @returns {Promise<void>}
     */
    static async getWechatUserProfile(pageContext) {
        try {
            wx.showLoading({
                title: '获取头像中...',
                mask: true
            });

            // 检查getUserProfile API的可用性
            if (typeof wx.getUserProfile !== 'function') {
                console.warn('⚠️ getUserProfile API不可用，使用备用方案');
                wx.hideLoading();
                wx.showToast({
                    title: '当前版本不支持获取头像',
                    icon: 'none'
                });
                return;
            }

            // 获取用户头像授权信息
            const result = await new Promise((resolve, reject) => {
                wx.getUserProfile({
                    desc: '用于显示您的头像',
                    lang: 'zh_CN',
                    success: resolve,
                    fail: reject
                });
            });

            console.log('✅ 获取微信用户头像成功:', result.userInfo.avatarUrl ? '已获取' : '未获取');
            console.log('📱 微信getUserProfile完整结果:', JSON.stringify(result));
            console.log('📱 微信userInfo对象:', result.userInfo);
            console.log('📱 微信头像URL:', result.userInfo?.avatarUrl);
            console.log('📱 微信头像URL类型:', typeof result.userInfo?.avatarUrl);
            console.log('📱 微信头像URL长度:', result.userInfo?.avatarUrl?.length);

            // 检查所有可能的头像字段
            console.log('🔍 检查所有可能的头像字段:');
            for (const key in result.userInfo) {
                if (key.toLowerCase().includes('avatar') || key.toLowerCase().includes('img') || key.toLowerCase().includes('icon')) {
                    console.log(`   ${key}:`, result.userInfo[key]);
                }
            }

            wx.hideLoading();

            // 直接保存头像到数据库（不再阻断默认头像）
            if (result.userInfo.avatarUrl) {
                await this.saveAvatarToServer(pageContext, result.userInfo.avatarUrl);
            } else {
                console.error('❌ 未找到avatarUrl字段');
                wx.showToast({
                    title: '未获取到头像信息',
                    icon: 'none'
                });
            }

        } catch (error) {
            console.error('❌ 获取微信用户头像失败:', error);
            wx.hideLoading();

            // 详细错误处理
            if (error.errMsg) {
                if (error.errMsg.includes('auth deny')) {
                    wx.showModal({
                        title: '授权提示',
                        content: '需要您的授权才能获取头像信息，这样可以让您的个人信息更完整',
                        showCancel: true,
                        confirmText: '重新授权',
                        success: (res) => {
                            if (res.confirm) {
                                // 用户点击重新授权，再次尝试
                                this.getWechatUserProfile(pageContext);
                            }
                        }
                    });
                } else if (error.errMsg.includes('desc length does not meet')) {
                    console.error('❌ desc参数长度不符合要求:', error.errMsg);
                    wx.showToast({
                        title: '系统参数错误，请联系管理员',
                        icon: 'none'
                    });
                } else {
                    wx.showToast({
                        title: '获取头像失败，请重试',
                        icon: 'none'
                    });
                }
            } else {
                wx.showToast({
                    title: error.message || '获取头像失败',
                    icon: 'none'
                });
            }
        }
    }

    /**
     * 保存头像到服务器数据库
     * @param {Object} pageContext - 页面上下文
     * @param {string} avatarUrl - 头像URL
     * @returns {Promise<void>}
     */
    static async saveAvatarToServer(pageContext, avatarUrl) {
        try {
            console.log('💾 开始保存头像到数据库:', avatarUrl);
            console.log('💾 头像URL类型:', typeof avatarUrl);
            console.log('💾 头像URL长度:', avatarUrl?.length);

            // 调用后端API保存头像
            const result = await request.put('/api/user/avatar', {
                avatarUrl: avatarUrl
            });

            console.log('💾 服务器完整响应:', JSON.stringify(result, null, 2));
            console.log('💾 服务器响应success字段:', result.success);
            console.log('💾 服务器响应data字段:', result.data);
            console.log('💾 服务器响应data.avatarUrl字段:', result.data?.avatarUrl);

            if (result.success) {
                console.log('💾 服务器返回结果:', result);

                // 使用服务器返回的头像URL（如果有的话），否则使用原始URL
                const finalAvatarUrl = result.data?.avatarUrl || avatarUrl;
                console.log('💾 最终使用的头像URL:', finalAvatarUrl);

                // 更新本地用户信息
                this.updateLocalAvatar(pageContext, finalAvatarUrl);

                wx.showToast({
                    title: '头像更新成功',
                    icon: 'success'
                });

                console.log('✅ 头像保存到数据库成功');

                // 强制刷新页面数据以确保头像显示更新
                setTimeout(() => {
                    if (pageContext.refreshData) {
                        pageContext.refreshData(true);
                    }
                }, 500);
            } else {
                throw new Error(result.message || '保存头像失败');
            }

        } catch (error) {
            console.error('❌ 保存头像到数据库失败:', error);

            // 即使保存到数据库失败，也要更新本地显示
            this.updateLocalAvatar(pageContext, avatarUrl);

            wx.showToast({
                title: '头像已更新，但未同步到服务器',
                icon: 'none',
                duration: 3000
            });
        }
    }

    /**
     * 上传头像文件到服务器
     * @param {string} tempFilePath - 临时文件路径
     * @returns {Promise<Object>} 上传结果
     */
    static async uploadAvatarToServer(tempFilePath) {
        return new Promise((resolve, reject) => {
            wx.uploadFile({
                url: request.getBaseUrl() + '/api/upload/avatar',
                filePath: tempFilePath,
                name: 'avatar',
                header: {
                    'x-user-openid': wx.getStorageSync('userInfo')?.openid || ''
                },
                success: (res) => {
                    try {
                        if (res.statusCode === 200 || res.statusCode === 201) {
                            const data = JSON.parse(res.data);
                            if (data.success) {
                                resolve(data);
                            } else {
                                reject(new Error(data.message || '上传失败'));
                            }
                        } else {
                            reject(new Error(`上传失败，状态码: ${res.statusCode}`));
                        }
                    } catch (error) {
                        reject(new Error('解析服务器响应失败'));
                    }
                },
                fail: (error) => {
                    reject(new Error(error.errMsg || '上传失败'));
                }
            });
        });
    }

    /**
     * 更新本地头像信息
     * @param {Object} pageContext - 页面上下文
     * @param {string} avatarUrl - 头像URL
     * @returns {Object} 更新后的用户信息
     */
    static updateLocalAvatar(pageContext, avatarUrl) {
        console.log('🔄 更新本地头像:', avatarUrl);

        // 确保头像URL可被前端访问
        let finalAvatarUrl = avatarUrl || '';
        if (finalAvatarUrl) {
            if (finalAvatarUrl.startsWith('/uploads/')) {
                // 拼接后端域名
                finalAvatarUrl = request.getBaseUrl() + finalAvatarUrl;
            } else if (finalAvatarUrl.startsWith('//')) {
                finalAvatarUrl = `https:${finalAvatarUrl}`;
            }
        }

        // 如果是 http 资源，下载到本地临时路径以规避 http 被禁止的问题
        if (finalAvatarUrl && finalAvatarUrl.startsWith('http://')) {
            try {
                wx.downloadFile({
                    url: finalAvatarUrl,
                    success: (res) => {
                        if (res.tempFilePath) {
                            const updatedUserInfo = {
                                ...pageContext.data.userInfo,
                                avatarUrl: res.tempFilePath
                            };
                            pageContext.setData({ userInfo: updatedUserInfo });
                            const app = getApp();
                            if (app && app.globalData) app.globalData.userInfo = updatedUserInfo;
                            wx.setStorageSync('userInfo', updatedUserInfo);
                        }
                    },
                    fail: (err) => {
                        console.warn('⚠️ 下载头像失败，回退使用原URL:', err);
                        const ts = Date.now();
                        const updatedUserInfo = {
                            ...pageContext.data.userInfo,
                            avatarUrl: finalAvatarUrl + (finalAvatarUrl.includes('?') ? '&' : '?') + 't=' + ts
                        };
                        pageContext.setData({ userInfo: updatedUserInfo });
                        const app = getApp();
                        if (app && app.globalData) app.globalData.userInfo = updatedUserInfo;
                        wx.setStorageSync('userInfo', updatedUserInfo);
                    }
                });
            } catch (e) {
                console.warn('⚠️ 下载头像异常，使用原URL:', e);
                const ts = Date.now();
                const updatedUserInfo = {
                    ...pageContext.data.userInfo,
                    avatarUrl: finalAvatarUrl + (finalAvatarUrl.includes('?') ? '&' : '?') + 't=' + ts
                };
                pageContext.setData({ userInfo: updatedUserInfo });
                const app = getApp();
                if (app && app.globalData) app.globalData.userInfo = updatedUserInfo;
                wx.setStorageSync('userInfo', updatedUserInfo);
            }
            return;
        }

        // 加时间戳防止缓存（https 或本地）
        const ts = Date.now();
        const updatedUserInfo = {
            ...pageContext.data.userInfo,
            avatarUrl: finalAvatarUrl ? (finalAvatarUrl + (finalAvatarUrl.includes('?') ? '&' : '?') + 't=' + ts) : ''
        };

        console.log('📋 设置页面数据前:', pageContext.data.userInfo?.avatarUrl);
        pageContext.setData({
            userInfo: updatedUserInfo
        });
        console.log('📋 设置页面数据后:', pageContext.data.userInfo?.avatarUrl);

        // 更新全局数据和本地存储
        const app = getApp();
        if (app && app.globalData) {
            console.log('📋 更新全局数据前:', app.globalData.userInfo?.avatarUrl);
            app.globalData.userInfo = updatedUserInfo;
            console.log('📋 更新全局数据后:', app.globalData.userInfo?.avatarUrl);
        }

        console.log('📋 更新本地存储前:', wx.getStorageSync('userInfo')?.avatarUrl);
        wx.setStorageSync('userInfo', updatedUserInfo);
        console.log('📋 更新本地存储后:', wx.getStorageSync('userInfo')?.avatarUrl);

        console.log('✅ 本地头像信息已更新:', updatedUserInfo.avatarUrl);

        // 不再强制 getImageInfo 校验，避免跨域或时序导致头像被清空

        return updatedUserInfo;
    }

    /**
     * 选择头像方式
     * @param {Object} pageContext - 页面上下文
     * @returns {Promise<void>}
     */
    static async chooseAvatarMethod(pageContext) {
        return new Promise((resolve) => {
            const hasChooseAvatar = typeof wx.chooseAvatar === 'function';
            const hasGetUserProfile = typeof wx.getUserProfile === 'function';
            const items = hasChooseAvatar
                ? ['拍照', '从相册选择', '使用微信头像']
                : hasGetUserProfile
                    ? ['拍照', '从相册选择', '使用微信头像']
                    : ['拍照', '从相册选择'];

            wx.showActionSheet({
                itemList: items,
                success: async (res) => {
                    try {
                        // 映射选择
                        if (!hasChooseAvatar && !hasGetUserProfile && res.tapIndex === 2) {
                            // 不会出现
                            return resolve();
                        }
                        if (res.tapIndex === 0) {
                            await this.chooseAndUploadAvatar(pageContext, 'camera');
                        } else if (res.tapIndex === 1) {
                            await this.chooseAndUploadAvatar(pageContext, 'album');
                        } else if (res.tapIndex === 2) {
                            if (hasChooseAvatar) await this.getWechatAvatar(pageContext);
                            else if (hasGetUserProfile) await this.getWechatUserProfile(pageContext);
                        }
                        resolve();
                    } catch (error) {
                        console.error('❌ 选择头像失败:', error);
                        resolve();
                    }
                },
                fail: () => resolve()
            });
        });
    }

    /**
     * 检查是否是默认微信头像
     * @param {string} avatarUrl - 头像URL
     * @returns {boolean} 是否是默认头像
     */
    static isDefaultWechatAvatar(avatarUrl) {
        if (!avatarUrl) return true;

        // 常见的微信默认头像URL模式
        const defaultAvatarPatterns = [
            'POgEwh4mIHO4nibH0KlMECNjjGxQUq24ZEaGT4poC6icRiccVGKSyXwibcPq4BWmiaIGuG1icwxaQX6grC9VemZoJ8rg', // 用户提供的默认头像
            'mmopen/vi_32/POgEwh4mIHO4nibH0KlMECNjjGxQUq24ZEaGT4poC6icRiccVGKSyXwibcPq4BWmiaIGuG1icwxaQX6grC9VemZoJ8rg',
            'default_avatar',
            'anonymous_user',
            'unknown_user'
        ];

        return defaultAvatarPatterns.some(pattern => avatarUrl.includes(pattern));
    }

    /**
     * 验证头像文件
     * @param {string} filePath - 文件路径
     * @returns {Promise<Object>} 验证结果
     */
    static async validateAvatarFile(filePath) {
        return new Promise((resolve) => {
            wx.getFileInfo({
                filePath: filePath,
                success: (res) => {
                    const maxSize = 2 * 1024 * 1024; // 2MB

                    if (res.size > maxSize) {
                        resolve({
                            valid: false,
                            message: '头像文件不能超过2MB'
                        });
                    } else {
                        resolve({
                            valid: true,
                            size: res.size
                        });
                    }
                },
                fail: () => {
                    resolve({
                        valid: false,
                        message: '无法获取文件信息'
                    });
                }
            });
        });
    }

    /**
     * 压缩头像图片
     * @param {string} filePath - 原文件路径
     * @param {number} quality - 压缩质量 (0-100)
     * @returns {Promise<string>} 压缩后的文件路径
     */
    static async compressAvatar(filePath, quality = 80) {
        return new Promise((resolve, reject) => {
            wx.compressImage({
                src: filePath,
                quality: quality,
                success: (res) => {
                    resolve(res.tempFilePath);
                },
                fail: (error) => {
                    reject(new Error(error.errMsg || '图片压缩失败'));
                }
            });
        });
    }

    /**
     * 删除头像
     * @param {Object} pageContext - 页面上下文
     * @returns {Promise<void>}
     */
    static async deleteAvatar(pageContext) {
        try {
            wx.showModal({
                title: '确认删除',
                content: '确定要删除当前头像吗？',
                success: async (res) => {
                    if (res.confirm) {
                        try {
                            // 调用后端API删除头像
                            const result = await request.delete('/api/user/avatar');
                            
                            if (result.success) {
                                // 更新本地信息，使用默认头像
                                this.updateLocalAvatar(pageContext, '');
                                
                                wx.showToast({
                                    title: '头像已删除',
                                    icon: 'success'
                                });
                            } else {
                                throw new Error(result.message || '删除头像失败');
                            }
                        } catch (error) {
                            console.error('❌ 删除头像失败:', error);
                            wx.showToast({
                                title: error.message || '删除头像失败',
                                icon: 'none'
                            });
                        }
                    }
                }
            });
        } catch (error) {
            console.error('❌ 删除头像操作失败:', error);
        }
    }
}

module.exports = ProfileAvatarService; 
