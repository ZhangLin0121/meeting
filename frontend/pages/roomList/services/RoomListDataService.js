// 会议室列表数据服务模块
const request = require('../../../utils/request.js');
const WechatAuth = require('../../../utils/auth.js');

class RoomListDataService {
    /**
     * 用户登录
     * @returns {Promise<Object>} 用户信息
     */
    static async loginUser() {
        try {
            console.log('🔐 开始用户登录流程...');

            // 调用微信登录
            const loginResult = await new Promise((resolve, reject) => {
                wx.login({
                    success: resolve,
                    fail: reject
                });
            });

            if (!loginResult.code) {
                throw new Error('微信登录失败：无法获取登录码');
            }

            console.log('✅ 微信登录成功，code:', loginResult.code);

            // 调用后端登录接口
            const result = await request.post('/api/user/wechat-login', {
                code: loginResult.code
            });

            if (result.success && result.data) {
                console.log('✅ 后端登录成功:', result.data);
                return result.data;
            } else {
                throw new Error(result.message || '后端登录失败');
            }

        } catch (error) {
            console.error('❌ 登录失败:', error);
            throw error;
        }
    }

    /**
     * 检查用户角色
     * @param {Object} pageContext 页面上下文
     */
    static async checkUserRole(pageContext) {
        try {
            const result = await request.get('/api/user/role');
            if (result.success && result.data) {
                pageContext.setData({
                    isAdmin: result.data.isAdmin || false
                });
                console.log('✅ 用户角色检查完成:', result.data);
            }
        } catch (error) {
            console.warn('⚠️ 用户角色检查失败:', error);
            // 不影响主流程，设置默认值
            pageContext.setData({ isAdmin: false });
        }
    }

    /**
     * 获取会议室列表
     * @param {Object} pageContext 页面上下文
     */
    static async fetchRooms(pageContext) {
        if (pageContext.data.loading) {
            console.log('⏳ 正在加载中，跳过重复请求');
            return;
        }

        try {
            pageContext.setData({ loading: true });
            const result = await request.get('/api/rooms');
            if (result.success && result.data) {
                // 处理会议室数据
                const processedRooms = await this.processRoomsData(pageContext, result.data);

                pageContext.setData({
                    rooms: processedRooms,
                    loading: false
                });
            } else {
                throw new Error(result.message || '获取会议室列表失败');
            }

        } catch (error) {
            console.error('❌ 获取会议室列表失败:', error);
            pageContext.setData({ loading: false });

            // 用户友好的错误提示
            wx.showToast({
                title: '加载失败，请重试',
                icon: 'none',
                duration: 2000
            });

            throw error;
        }
    }

    /**
     * 处理会议室数据
     * @param {Object} pageContext 页面上下文
     * @param {Array} rooms 会议室数据
     * @returns {Promise<Array>} 处理后的会议室数据
     */
    static async processRoomsData(pageContext, rooms) {
        return rooms.map(room => {
            // 处理图片URL
            let displayImage = '/images/default_room.png';
            if (room.images && Array.isArray(room.images) && room.images.length > 0) {
                const imagePath = room.images[0];
                displayImage = imagePath.startsWith('http') ? imagePath : `${pageContext.data.apiBaseUrl}${imagePath}`;
            }

            // 生成房间特性标签
            const features = this.generateRoomFeatures(room);

            // 处理设备信息
            const equipmentCount = room.equipment ? room.equipment.length : 0;
            const equipmentDisplay = room.equipment && room.equipment.length > 0 
                ? room.equipment.slice(0, 3).join('、') + (room.equipment.length > 3 ? '等' : '')
                : '基础设备';

            return {
                ...room,
                displayImage: displayImage,
                imageLoading: false,
                imageError: false,
                features: features,
                equipmentCount: equipmentCount,
                equipmentDisplay: equipmentDisplay
            };
        });
    }

    /**
     * 图片加载成功处理
     * @param {Object} pageContext 页面上下文
     * @param {Object} event 事件对象
     */
    static onImageLoad(pageContext, event) {
        const roomId = event.currentTarget.dataset.roomId;
        this.updateRoomImageStatus(pageContext, roomId, { 
            imageLoading: false, 
            imageError: false 
        });
    }

    /**
     * 图片加载失败处理
     * @param {Object} pageContext 页面上下文
     * @param {Object} event 事件对象
     */
    static onImageError(pageContext, event) {
        const roomId = event.currentTarget.dataset.roomId;
        this.updateRoomImageStatus(pageContext, roomId, { 
            imageLoading: false, 
            imageError: true 
        });
    }

    /**
     * 更新房间图片状态
     * @param {Object} pageContext 页面上下文
     * @param {string} roomId 房间ID
     * @param {Object} updates 更新数据
     */
    static updateRoomImageStatus(pageContext, roomId, updates) {
        const rooms = pageContext.data.rooms.map(room => {
            if (room._id === roomId) {
                return { ...room, ...updates };
            }
            return room;
        });
        
        pageContext.setData({ rooms });
    }

    /**
     * 简单哈希函数
     * @param {string} str 字符串
     * @returns {number} 哈希值
     */
    static simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为32位整数
        }
        return Math.abs(hash);
    }
}

module.exports = RoomListDataService; 