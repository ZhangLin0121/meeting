const request = require('../utils/request');

/**
 * 个人资料编辑服务
 * 处理所有个人资料编辑相关的逻辑
 */
class ProfileEditService {

    /**
     * 显示编辑个人信息弹窗
     * @param {Object} pageContext - 页面上下文
     * @returns {void}
     */
    static showEditProfile(pageContext) {
        const userInfo = pageContext.data.userInfo || {};
        
        pageContext.setData({
            showProfileEdit: true,
            profileForm: {
                nickname: userInfo.nickname || '',
                contactName: userInfo.contactName || '',
                contactPhone: userInfo.contactPhone || ''
            }
        });

        console.log('📝 显示编辑个人信息弹窗');
    }

    /**
     * 隐藏个人信息编辑弹窗
     * @param {Object} pageContext - 页面上下文
     * @returns {void}
     */
    static hideEditProfile(pageContext) {
        pageContext.setData({
            showProfileEdit: false
        });

        console.log('❌ 隐藏编辑个人信息弹窗');
    }

    /**
     * 处理昵称输入
     * @param {Object} pageContext - 页面上下文
     * @param {string} value - 输入值
     * @returns {void}
     */
    static onNicknameInput(pageContext, value) {
        pageContext.setData({
            'profileForm.nickname': value
        });
    }

    /**
     * 处理联系人姓名输入
     * @param {Object} pageContext - 页面上下文
     * @param {string} value - 输入值
     * @returns {void}
     */
    static onContactNameInput(pageContext, value) {
        pageContext.setData({
            'profileForm.contactName': value
        });
    }

    /**
     * 处理联系人电话输入
     * @param {Object} pageContext - 页面上下文
     * @param {string} value - 输入值
     * @returns {void}
     */
    static onContactPhoneInput(pageContext, value) {
        pageContext.setData({
            'profileForm.contactPhone': value
        });
    }

    /**
     * 保存个人信息
     * @param {Object} pageContext - 页面上下文
     * @returns {Promise<void>}
     */
    static async saveProfileInfo(pageContext) {
        const { nickname, contactName, contactPhone } = pageContext.data.profileForm;

        // 验证输入
        const validation = this.validateProfileForm({ nickname, contactName, contactPhone });
        if (!validation.valid) {
            wx.showToast({
                title: validation.message,
                icon: 'none'
            });
            return;
        }

        try {
            pageContext.setData({ loading: true });

            const result = await request.put('/api/user/contact', {
                nickname: nickname.trim(),
                contactName: contactName.trim(),
                contactPhone: contactPhone.trim()
            });

            if (result.success) {
                // 使用服务器返回的最新用户信息
                const updatedUserInfo = {
                    ...pageContext.data.userInfo,
                    nickname: result.data.nickname,
                    contactName: result.data.contactName,
                    contactPhone: result.data.contactPhone
                };

                pageContext.setData({
                    userInfo: updatedUserInfo,
                    showProfileEdit: false
                });

                // 更新全局用户信息
                const app = getApp();
                if (app && app.globalData) {
                    app.globalData.userInfo = updatedUserInfo;
                }

                // 更新本地存储
                wx.setStorageSync('userInfo', updatedUserInfo);

                wx.showToast({
                    title: '保存成功',
                    icon: 'success'
                });

                console.log('✅ 个人信息保存成功');
            } else {
                throw new Error(result.message || '保存失败');
            }
        } catch (error) {
            console.error('❌ 保存联系信息失败:', error);
            wx.showToast({
                title: error.message || '保存失败',
                icon: 'none'
            });
        } finally {
            pageContext.setData({ loading: false });
        }
    }

    /**
     * 更新用户昵称
     * @param {Object} pageContext - 页面上下文
     * @param {string} nickname - 新昵称
     * @returns {Promise<void>}
     */
    static async updateUserNickname(pageContext, nickname) {
        try {
            if (!nickname || !nickname.trim()) {
                wx.showToast({
                    title: '昵称不能为空',
                    icon: 'none'
                });
                return;
            }

            const result = await request.put('/api/user/contact', {
                nickname: nickname.trim()
            });

            if (result.success) {
                // 更新本地数据
                const updatedUserInfo = {
                    ...pageContext.data.userInfo,
                    nickname: result.data.nickname
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

                wx.showToast({
                    title: '昵称更新成功',
                    icon: 'success'
                });

                console.log('✅ 昵称更新成功:', nickname);
            } else {
                throw new Error(result.message || '更新昵称失败');
            }
        } catch (error) {
            console.error('❌ 更新昵称失败:', error);
            wx.showToast({
                title: error.message || '更新昵称失败',
                icon: 'none'
            });
        }
    }

    /**
     * 验证个人信息表单
     * @param {Object} formData - 表单数据
     * @returns {Object} 验证结果
     */
    static validateProfileForm(formData) {
        const { nickname, contactName, contactPhone } = formData;

        // 验证昵称
        if (!nickname || !nickname.trim()) {
            return {
                valid: false,
                message: '请输入昵称'
            };
        }

        if (nickname.trim().length > 20) {
            return {
                valid: false,
                message: '昵称不能超过20个字符'
            };
        }

        // 验证联系人姓名
        if (contactName && contactName.trim().length > 20) {
            return {
                valid: false,
                message: '联系人姓名不能超过20个字符'
            };
        }

        // 验证手机号
        if (contactPhone && contactPhone.trim()) {
            const phoneRegex = /^1[3-9]\d{9}$/;
            if (!phoneRegex.test(contactPhone.trim())) {
                return {
                    valid: false,
                    message: '请输入正确的手机号'
                };
            }
        }

        return {
            valid: true,
            message: '验证通过'
        };
    }

    /**
     * 重置表单
     * @param {Object} pageContext - 页面上下文
     * @returns {void}
     */
    static resetProfileForm(pageContext) {
        const userInfo = pageContext.data.userInfo || {};
        
        pageContext.setData({
            profileForm: {
                nickname: userInfo.nickname || '',
                contactName: userInfo.contactName || '',
                contactPhone: userInfo.contactPhone || ''
            }
        });

        console.log('🔄 个人信息表单已重置');
    }

    /**
     * 检查表单是否有变更
     * @param {Object} pageContext - 页面上下文
     * @returns {boolean} 是否有变更
     */
    static hasFormChanges(pageContext) {
        const userInfo = pageContext.data.userInfo || {};
        const formData = pageContext.data.profileForm || {};

        const hasNicknameChange = (formData.nickname || '').trim() !== (userInfo.nickname || '');
        const hasContactNameChange = (formData.contactName || '').trim() !== (userInfo.contactName || '');
        const hasContactPhoneChange = (formData.contactPhone || '').trim() !== (userInfo.contactPhone || '');

        return hasNicknameChange || hasContactNameChange || hasContactPhoneChange;
    }

    /**
     * 批量更新用户信息
     * @param {Object} pageContext - 页面上下文
     * @param {Object} updates - 更新数据
     * @returns {Promise<void>}
     */
    static async batchUpdateUserInfo(pageContext, updates) {
        try {
            pageContext.setData({ loading: true });

            // 验证所有字段
            const validation = this.validateProfileForm(updates);
            if (!validation.valid) {
                wx.showToast({
                    title: validation.message,
                    icon: 'none'
                });
                return;
            }

            const result = await request.put('/api/user/profile', updates);

            if (result.success) {
                // 更新本地数据
                const updatedUserInfo = {
                    ...pageContext.data.userInfo,
                    ...result.data
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

                wx.showToast({
                    title: '更新成功',
                    icon: 'success'
                });

                console.log('✅ 批量更新用户信息成功');
            } else {
                throw new Error(result.message || '更新失败');
            }
        } catch (error) {
            console.error('❌ 批量更新用户信息失败:', error);
            wx.showToast({
                title: error.message || '更新失败',
                icon: 'none'
            });
        } finally {
            pageContext.setData({ loading: false });
        }
    }

    /**
     * 格式化电话号码显示
     * @param {string} phone - 电话号码
     * @returns {string} 格式化后的电话号码
     */
    static formatPhoneDisplay(phone) {
        if (!phone) return '未设置';
        
        // 隐藏中间4位数字
        if (phone.length === 11) {
            return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
        }
        
        return phone;
    }

    /**
     * 生成用户信息完整度
     * @param {Object} userInfo - 用户信息
     * @returns {Object} 完整度信息
     */
    static getUserInfoCompleteness(userInfo) {
        if (!userInfo) {
            return {
                percentage: 0,
                completedFields: [],
                missingFields: ['nickname', 'contactName', 'contactPhone', 'avatarUrl']
            };
        }

        const fields = [
            { key: 'nickname', name: '昵称', weight: 25 },
            { key: 'contactName', name: '联系人姓名', weight: 25 },
            { key: 'contactPhone', name: '联系电话', weight: 25 },
            { key: 'avatarUrl', name: '头像', weight: 25 }
        ];

        let completedWeight = 0;
        const completedFields = [];
        const missingFields = [];

        fields.forEach(field => {
            if (userInfo[field.key] && userInfo[field.key].trim()) {
                completedWeight += field.weight;
                completedFields.push(field.name);
            } else {
                missingFields.push(field.name);
            }
        });

        return {
            percentage: completedWeight,
            completedFields: completedFields,
            missingFields: missingFields
        };
    }

    /**
     * 导出用户信息
     * @param {Object} userInfo - 用户信息
     * @returns {string} 导出的文本
     */
    static exportUserInfo(userInfo) {
        if (!userInfo) return '暂无用户信息';

        const exportData = [
            `昵称: ${userInfo.nickname || '未设置'}`,
            `联系人姓名: ${userInfo.contactName || '未设置'}`,
            `联系电话: ${userInfo.contactPhone || '未设置'}`,
            `用户角色: ${userInfo.role === 'admin' ? '管理员' : '普通用户'}`,
            `注册时间: ${userInfo.createdAt ? new Date(userInfo.createdAt).toLocaleString() : '未知'}`,
            `最后更新: ${userInfo.updatedAt ? new Date(userInfo.updatedAt).toLocaleString() : '未知'}`
        ];

        return exportData.join('\n');
    }

    /**
     * 清空表单
     * @param {Object} pageContext - 页面上下文
     * @returns {void}
     */
    static clearProfileForm(pageContext) {
        pageContext.setData({
            profileForm: {
                nickname: '',
                contactName: '',
                contactPhone: ''
            }
        });

        console.log('🗑️ 个人信息表单已清空');
    }

    /**
     * 预填充表单
     * @param {Object} pageContext - 页面上下文
     * @param {Object} userData - 用户数据
     * @returns {void}
     */
    static prefillProfileForm(pageContext, userData) {
        pageContext.setData({
            profileForm: {
                nickname: userData.nickname || '',
                contactName: userData.contactName || '',
                contactPhone: userData.contactPhone || ''
            }
        });

        console.log('📋 个人信息表单已预填充');
    }
}

module.exports = ProfileEditService; 