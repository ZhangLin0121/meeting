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

            // 更新用户信息
            const updatedUserInfo = this.updateLocalAvatar(pageContext, uploadResult.data.avatarUrl);

            wx.showToast({
                title: '头像更新成功',
                icon: 'success'
            });

            console.log('✅ 头像上传成功:', uploadResult.data.avatarUrl);

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
                this.getWechatUserProfile(pageContext);
                return;
            }

            // 使用新的微信头像选择器
            const result = await new Promise((resolve, reject) => {
                wx.chooseAvatar({
                    success: resolve,
                    fail: reject
                });
            });

            console.log('✅ 微信头像获取成功:', result.avatarUrl);

            wx.hideLoading();

            // 保存头像到数据库
            await this.saveAvatarToServer(pageContext, result.avatarUrl);

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
            wx.hideLoading();

            // 保存头像到数据库
            if (result.userInfo.avatarUrl) {
                await this.saveAvatarToServer(pageContext, result.userInfo.avatarUrl);
            } else {
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

            // 调用后端API保存头像
            const result = await request.put('/api/user/avatar', {
                avatarUrl: avatarUrl
            });

            if (result.success) {
                // 更新本地用户信息
                this.updateLocalAvatar(pageContext, avatarUrl);

                wx.showToast({
                    title: '头像更新成功',
                    icon: 'success'
                });

                console.log('✅ 头像保存到数据库成功');
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
                url: request.getBaseUrl() + '/api/user/upload-avatar',
                filePath: tempFilePath,
                name: 'avatar',
                header: {
                    'x-user-openid': wx.getStorageSync('userInfo')?.openid || ''
                },
                success: (res) => {
                    try {
                        if (res.statusCode === 200) {
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
        const updatedUserInfo = {
            ...pageContext.data.userInfo,
            avatarUrl: avatarUrl
        };

        pageContext.setData({
            userInfo: updatedUserInfo
        });

        // 更新全局数据和本地存储
        const app = getApp();
        if (app && app.globalData) {
            app.globalData.userInfo = updatedUserInfo;
        }
        wx.setStorageSync('userInfo', updatedUserInfo);

        console.log('✅ 本地头像信息已更新');
        return updatedUserInfo;
    }

    /**
     * 选择头像方式
     * @param {Object} pageContext - 页面上下文
     * @returns {Promise<void>}
     */
    static async chooseAvatarMethod(pageContext) {
        return new Promise((resolve) => {
            wx.showActionSheet({
                itemList: ['拍照', '从相册选择', '使用微信头像'],
                success: async (res) => {
                    try {
                        switch (res.tapIndex) {
                            case 0:
                                await this.chooseAndUploadAvatar(pageContext, 'camera');
                                break;
                            case 1:
                                await this.chooseAndUploadAvatar(pageContext, 'album');
                                break;
                            case 2:
                                await this.getWechatAvatar(pageContext);
                                break;
                        }
                        resolve();
                    } catch (error) {
                        console.error('❌ 选择头像失败:', error);
                        resolve();
                    }
                },
                fail: () => {
                    resolve();
                }
            });
        });
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