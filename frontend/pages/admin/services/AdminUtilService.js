// 管理员工具服务模块
const envConfig = require('../../../config/env.js');
const WechatAuth = require('../../../utils/auth.js');
const request = require('../../../utils/request.js');

class AdminUtilService {
    /**
     * 安全获取App数据，避免getApp()返回undefined
     * @param {Object} pageContext 页面上下文
     */
    static safeGetAppData(pageContext) {
        try {
            const app = getApp();

            if (app && app.globalData) {
                pageContext.setData({
                    apiBaseUrl: app.globalData.apiBaseUrl || envConfig.apiBaseUrl
                });
                console.log('✅ 成功获取App全局数据');

                // 获取用户openid
                const userOpenId = WechatAuth.getUserOpenId();
                pageContext.setData({ userOpenId });

                // 初始化页面
                this.initializePage(pageContext);
            } else {
                console.warn('⚠️ App实例未就绪，使用默认配置');
                pageContext.setData({
                    apiBaseUrl: envConfig.apiBaseUrl
                });

                // 延迟重试获取用户数据
                setTimeout(() => {
                    this.safeGetAppData(pageContext);
                }, 500);
            }
        } catch (error) {
            console.error('❌ 获取App数据失败:', error);

            // 使用默认配置
            pageContext.setData({
                apiBaseUrl: envConfig.apiBaseUrl
            });

            // 延迟重试
            setTimeout(() => {
                this.safeGetAppData(pageContext);
            }, 1000);
        }
    }

    /**
     * 初始化页面
     * @param {Object} pageContext 页面上下文
     */
    static async initializePage(pageContext) {
        await this.checkAdminPermission(pageContext);
        // 加载会议室数据将由AdminRoomService处理
    }

    /**
     * 检查管理员权限
     * @param {Object} pageContext 页面上下文
     */
    static async checkAdminPermission(pageContext) {
        try {
            const userOpenId = pageContext.data.userOpenId;
            if (!userOpenId) {
                throw new Error('用户未登录');
            }

            const result = await request.get('/api/user/role');
            
            if (!result.success || result.data.role !== 'admin') {
                wx.showModal({
                    title: '权限不足',
                    content: '您没有管理员权限，无法访问此页面',
                    showCancel: false,
                    success: () => {
                        wx.navigateBack();
                    }
                });
                return false;
            }

            console.log('✅ 管理员权限验证通过');
            return true;
        } catch (error) {
            console.error('❌ 检查管理员权限失败:', error);
            wx.showModal({
                title: '权限验证失败',
                content: '无法验证您的权限，请重新登录',
                showCancel: false,
                success: () => {
                    wx.navigateBack();
                }
            });
            return false;
        }
    }

    /**
     * 获取系统信息，计算状态栏高度和导航栏安全区域
     * @param {Object} pageContext 页面上下文
     */
    static getSystemInfo(pageContext) {
        try {
            const windowInfo = wx.getWindowInfo();
            const menuButtonInfo = wx.getMenuButtonBoundingClientRect();

            console.log('📱 窗口信息:', windowInfo);
            console.log('🔘 胶囊按钮信息:', menuButtonInfo);

            const statusBarHeight = windowInfo.statusBarHeight || 20;

            // 计算自定义导航栏的安全高度
            // 胶囊按钮顶部到状态栏底部的距离 * 2 + 胶囊按钮高度
            const customNavBarHeight = menuButtonInfo.top && menuButtonInfo.height ?
                (menuButtonInfo.top - statusBarHeight) * 2 + menuButtonInfo.height : 44;

            pageContext.setData({
                statusBarHeight: statusBarHeight,
                menuButtonInfo: menuButtonInfo,
                customNavBarHeight: customNavBarHeight
            });

            console.log('✅ 导航栏信息设置完成:', {
                statusBarHeight,
                customNavBarHeight,
                menuButtonInfo
            });
        } catch (error) {
            console.error('❌ 获取系统信息失败:', error);
            pageContext.setData({
                statusBarHeight: 20, // 默认值
                customNavBarHeight: 44 // 默认值
            });
        }
    }

    /**
     * 刷新当前选项卡数据
     * @param {Object} pageContext 页面上下文
     */
    static refreshCurrentTabData(pageContext) {
        if (pageContext.data.currentTab === 0) {
            // 刷新会议室数据将由AdminRoomService处理
            console.log('刷新会议室数据');
        } else if (pageContext.data.currentTab === 1) {
            // 刷新预约数据将由AdminBookingService处理
            console.log('刷新预约数据');
        }
    }

    /**
     * 切换选项卡
     * @param {Object} pageContext 页面上下文
     * @param {Object} event 事件对象
     */
    static switchTab(pageContext, event) {
        const tab = parseInt(event.currentTarget.dataset.tab);
        pageContext.setData({ currentTab: tab });

        // 根据选项卡加载对应数据
        if (tab === 1) {
            // 加载预约数据将由AdminBookingService处理
            console.log('切换到预约记录选项卡');
        }
    }

    /**
     * 隐藏会议室弹窗
     * @param {Object} pageContext 页面上下文
     */
    static hideRoomModal(pageContext) {
        const { roomForm } = pageContext.data;
        
        // 如果有未保存的上传图片，删除它
        if (roomForm.uploadedImagePath && !pageContext.data.isEditMode) {
            // AdminImageService.deleteUploadedImage(pageContext, roomForm.uploadedImagePath);
        }
        
        pageContext.setData({
            showRoomModal: false,
            isEditMode: false,
            editingRoomId: null,
            roomForm: {
                name: '',
                capacity: '',
                location: '',
                equipment: [],
                description: '',
                currentImage: '',
                newImagePath: '',
                uploadedImagePath: ''
            }
        });
    }

    /**
     * 表单输入处理
     * @param {Object} pageContext 页面上下文
     * @param {Object} event 事件对象
     */
    static onRoomFormInput(pageContext, event) {
        const field = event.currentTarget.dataset.field;
        const value = event.detail.value;
        pageContext.setData({
            [`roomForm.${field}`]: value
        });
    }

    /**
     * 切换设备选择
     * @param {Object} pageContext 页面上下文
     * @param {Object} event 事件对象
     */
    static toggleEquipment(pageContext, event) {
        const equipment = event.currentTarget.dataset.equipment;
        const currentEquipment = pageContext.data.roomForm.equipment || [];
        
        let newEquipment;
        if (currentEquipment.includes(equipment)) {
            // 移除设备
            newEquipment = currentEquipment.filter(item => item !== equipment);
        } else {
            // 添加设备
            newEquipment = [...currentEquipment, equipment];
        }
        
        pageContext.setData({
            'roomForm.equipment': newEquipment
        });
    }

    /**
     * 阻止事件冒泡
     * @param {Object} event 事件对象
     */
    static stopPropagation(event) {
        // 阻止事件冒泡，用于弹窗内部点击
    }

    /**
     * 返回会议室列表
     */
    static goBackToRoomList() {
        wx.navigateBack({
            delta: 1,
            fail: () => {
                // 如果返回失败，跳转到会议室列表页
                wx.redirectTo({
                    url: '/pages/roomList/roomList'
                });
            }
        });
    }

    /**
     * 跳转到调试页面
     */
    static goToDebug() {
        wx.navigateTo({
            url: '/pages/test/test'
        });
    }
}

module.exports = AdminUtilService; 