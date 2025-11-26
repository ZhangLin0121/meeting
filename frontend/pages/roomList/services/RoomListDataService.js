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
            // 统一房间ID字段，确保同时存在 id 与 _id
            const normalizedRoom = room._id ? room : { ...room, _id: room.id || room.roomId };
            if (!normalizedRoom.id && normalizedRoom._id) normalizedRoom.id = normalizedRoom._id;
            // 处理图片URL
            let displayImage = '/images/default_room.png';
            if (normalizedRoom.images && Array.isArray(normalizedRoom.images) && normalizedRoom.images.length > 0) {
                const imagePath = normalizedRoom.images[0];
                displayImage = imagePath.startsWith('http') ? imagePath : `${pageContext.data.apiBaseUrl}${imagePath}`;
            }

            // 生成房间特性标签
            const features = this.generateRoomFeatures(normalizedRoom);

            // 处理设备信息
            const equipmentCount = normalizedRoom.equipment ? normalizedRoom.equipment.length : 0;
            const equipmentDisplay = normalizedRoom.equipment && normalizedRoom.equipment.length > 0 
                ? normalizedRoom.equipment.slice(0, 3).join('、') + (normalizedRoom.equipment.length > 3 ? '等' : '')
                : '基础设备';

            return {
                ...normalizedRoom,
                displayImage: displayImage,
                imageLoading: false,
                imageError: false,
                // 与页面展示保持一致：使用status字段
                status: normalizedRoom.status || normalizedRoom.availability || 'available',
                features: features,
                equipmentCount: equipmentCount,
                equipmentDisplay: equipmentDisplay
            };
        });
    }

    /**
     * 根据会议室信息生成特性标签
     * @param {Object} room 会议室对象
     * @returns {Array<string>} 特性标签数组
     */
    static generateRoomFeatures(room) {
        const features = [];

        // 容量标签（简要分级）
        if (typeof room.capacity === 'number') {
            if (room.capacity <= 6) {
                features.push('小型会议');
            } else if (room.capacity <= 12) {
                features.push('中型会议');
            } else {
                features.push('大型会议');
            }
        }

        // 设备特性
        const eq = Array.isArray(room.equipment) ? room.equipment : [];
        const has = (name) => eq.includes(name);

        if (has('投屏设备')) features.push('投屏');
        if (has('视频会议设备')) features.push('视频会议');
        if (has('白板') || has('电子白板')) features.push('白板');
        if (has('网络接口/Wi-Fi')) features.push('Wi‑Fi');
        if (has('麦克风')) features.push('麦克风');
        if (has('音响系统')) features.push('音响');
        if (has('空调')) features.push('空调');
        if (has('电话')) features.push('电话');

        // 至多返回前4个，提高可读性
        return features.slice(0, 4);
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
