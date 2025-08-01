// 管理员会议室管理服务模块
const request = require('../../../utils/request.js');

class AdminRoomService {
    /**
     * 加载会议室列表
     * @param {Object} pageContext 页面上下文
     * @returns {Promise<void>}
     */
    static async loadRooms(pageContext) {
        pageContext.setData({ roomsLoading: true });
        try {
            // 添加时间戳防止缓存
            const timestamp = Date.now();
            const result = await request.get(`/api/rooms?includeDetails=true&t=${timestamp}`);

            if (result.success && result.data) {
                // 🔧 预处理数据：为每个房间添加Apple Design所需字段
                const processedRooms = result.data.map(room => {
                    // 处理设备数量显示
                    let equipmentCount = 0;
                    let equipmentDisplay = '暂无设备';

                    if (room.equipment && Array.isArray(room.equipment) && room.equipment.length > 0) {
                        equipmentCount = room.equipment.length;
                        equipmentDisplay = room.equipment.join(', ');
                    }

                    // 处理图片URL - 与roomList保持一致的逻辑
                    let displayImage = '/images/default_room.png';
                    if (room.images && Array.isArray(room.images) && room.images.length > 0) {
                        // 构建完整的图片URL，与roomList逻辑保持一致
                        const imagePath = room.images[0];
                        displayImage = imagePath.startsWith('http') ? imagePath : `${pageContext.data.apiBaseUrl}${imagePath}`;
                        console.log('🖼️ 管理员页面处理图片URL:', {
                            roomName: room.name,
                            originalImagePath: imagePath,
                            finalDisplayImage: displayImage,
                            apiBaseUrl: pageContext.data.apiBaseUrl
                        });
                    }

                    return {
                        ...room,
                        equipmentDisplay: equipmentDisplay,
                        equipmentCount: equipmentCount,
                        displayImage: displayImage,
                        imageUrl: displayImage, // 保持向后兼容
                        imageLoading: false,
                        imageError: false
                    };
                });

                pageContext.setData({ rooms: processedRooms });
            }
        } catch (error) {
            console.error('加载会议室失败:', error);
            wx.showToast({ title: '加载会议室失败', icon: 'none' });
        } finally {
            pageContext.setData({ roomsLoading: false });
        }
    }

    /**
     * 刷新会议室列表
     * @param {Object} pageContext 页面上下文
     */
    static refreshRooms(pageContext) {
        pageContext.setData({
            rooms: [],
            roomsPage: 1,
            roomsHasMore: true
        });
        this.loadRooms(pageContext);
    }

    /**
     * 强制刷新会议室列表（清除缓存）
     * @param {Object} pageContext 页面上下文
     */
    static forceRefreshRooms(pageContext) {
        // 强制清除所有缓存数据
        pageContext.setData({
            rooms: [],
            roomsPage: 1,
            roomsHasMore: true,
            roomsLoading: false
        });

        // 立即重新加载，带上时间戳防止缓存
        this.loadRoomsWithTimestamp(pageContext);
    }

    /**
     * 带时间戳加载会议室（强制从数据库获取最新数据）
     * @param {Object} pageContext 页面上下文
     */
    static async loadRoomsWithTimestamp(pageContext) {
        if (pageContext.data.roomsLoading || !pageContext.data.roomsHasMore) return;

        try {
            pageContext.setData({ roomsLoading: true });

            // 添加时间戳防止缓存
            const timestamp = Date.now();
            const result = await request.get(`/api/rooms?page=${pageContext.data.roomsPage}&limit=10&t=${timestamp}`);

            if (result.success && result.data) {
                // 🔧 预处理数据：为每个房间添加Apple Design所需字段
                const processedRooms = result.data.map(room => {
                    // 处理设备数量显示
                    let equipmentCount = 0;
                    let equipmentDisplay = '暂无设备';

                    if (room.equipment && Array.isArray(room.equipment) && room.equipment.length > 0) {
                        equipmentCount = room.equipment.length;
                        equipmentDisplay = room.equipment.join(', ');
                    }

                    // 处理图片URL - 与roomList保持一致的逻辑
                    let displayImage = '/images/default_room.png';
                    if (room.images && Array.isArray(room.images) && room.images.length > 0) {
                        // 构建完整的图片URL，与roomList逻辑保持一致
                        const imagePath = room.images[0];
                        displayImage = imagePath.startsWith('http') ? imagePath : `${pageContext.data.apiBaseUrl}${imagePath}`;
                        console.log('🖼️ 处理图片URL:', {
                            roomName: room.name,
                            originalImagePath: imagePath,
                            finalDisplayImage: displayImage,
                            apiBaseUrl: pageContext.data.apiBaseUrl
                        });
                    }

                    return {
                        ...room,
                        equipmentDisplay: equipmentDisplay,
                        equipmentCount: equipmentCount,
                        displayImage: displayImage,
                        imageUrl: displayImage, // 保持向后兼容
                        imageLoading: false,
                        imageError: false
                    };
                });

                const newRooms = pageContext.data.roomsPage === 1 ? processedRooms : [...pageContext.data.rooms, ...processedRooms];

                pageContext.setData({
                    rooms: newRooms,
                    roomsPage: pageContext.data.roomsPage + 1,
                    roomsHasMore: result.pagination ? result.pagination.page < result.pagination.pages : false,
                    roomsLoading: false
                });
            } else {
                throw new Error(result.message || '获取会议室列表失败');
            }
        } catch (error) {
            console.error('加载会议室列表失败:', error);
            pageContext.setData({ roomsLoading: false });

            wx.showToast({
                title: '加载失败',
                icon: 'none'
            });
        }
    }

    /**
     * 显示添加会议室弹窗
     * @param {Object} pageContext 页面上下文
     */
    static showAddRoomModal(pageContext) {
        console.log('显示添加会议室弹窗');
        
        // 重置表单数据
        pageContext.setData({
            showRoomModal: true,
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
     * 编辑会议室
     * @param {Object} pageContext 页面上下文
     * @param {Object} event 事件对象
     */
    static editRoom(pageContext, event) {
        const roomId = event.currentTarget.dataset.id;
        const room = pageContext.data.rooms.find(r => r._id === roomId);
        
        if (!room) {
            wx.showToast({ title: '会议室不存在', icon: 'none' });
            return;
        }

        console.log('编辑会议室:', room);

        // 填充表单数据
        pageContext.setData({
            showRoomModal: true,
            isEditMode: true,
            editingRoomId: roomId,
            roomForm: {
                name: room.name || '',
                capacity: room.capacity ? room.capacity.toString() : '',
                location: room.location || '',
                equipment: room.equipment || [],
                description: room.description || '',
                currentImage: room.displayImage || '',
                newImagePath: '',
                uploadedImagePath: ''
            }
        });
    }

    /**
     * 删除会议室
     * @param {Object} pageContext 页面上下文
     * @param {Object} event 事件对象
     */
    static deleteRoom(pageContext, event) {
        const roomId = event.currentTarget.dataset.id;
        const room = pageContext.data.rooms.find(r => r._id === roomId);
        
        wx.showModal({
            title: '确认删除',
            content: `确定要删除会议室"${room?.name || '未知'}"吗？`,
            success: async (res) => {
                if (res.confirm) {
                    try {
                        const result = await request.delete(`/api/rooms/${roomId}`);
                        if (result.success) {
                            wx.showToast({ title: '删除成功', icon: 'success' });
                            this.refreshRooms(pageContext);
                        } else {
                            throw new Error(result.message || '删除失败');
                        }
                    } catch (error) {
                        console.error('删除会议室失败:', error);
                        wx.showToast({ title: '删除失败', icon: 'none' });
                    }
                }
            }
        });
    }

    /**
     * 提交会议室表单
     * @param {Object} pageContext 页面上下文
     */
    static async submitRoomForm(pageContext) {
        const { roomForm, isEditMode, editingRoomId } = pageContext.data;

        // 验证表单
        if (!roomForm.name.trim()) {
            wx.showToast({ title: '请填写会议室名称', icon: 'none' });
            return;
        }

        if (!roomForm.capacity || roomForm.capacity <= 0) {
            wx.showToast({ title: '请填写正确的容量', icon: 'none' });
            return;
        }

        if (!roomForm.location.trim()) {
            wx.showToast({ title: '请填写会议室位置', icon: 'none' });
            return;
        }

        try {
            // 构建提交数据
            const roomData = {
                name: roomForm.name.trim(),
                capacity: parseInt(roomForm.capacity),
                location: roomForm.location.trim(),
                equipment: roomForm.equipment,
                description: roomForm.description.trim()
            };

            // 处理图片
            if (roomForm.uploadedImagePath) {
                roomData.images = [roomForm.uploadedImagePath];
            } else if (isEditMode && roomForm.currentImage && !roomForm.newImagePath) {
                // 编辑模式下，如果没有新图片，保持原图片
                const currentRoom = pageContext.data.rooms.find(r => r._id === editingRoomId);
                if (currentRoom && currentRoom.images) {
                    roomData.images = currentRoom.images;
                }
            }

            let result;
            if (isEditMode) {
                result = await request.put(`/api/rooms/${editingRoomId}`, roomData);
            } else {
                result = await request.post('/api/rooms', roomData);
            }

            if (result.success) {
                wx.showToast({ 
                    title: isEditMode ? '更新成功' : '创建成功', 
                    icon: 'success' 
                });
                
                // 关闭弹窗并刷新列表
                pageContext.setData({ showRoomModal: false });
                this.refreshRooms(pageContext);
            } else {
                throw new Error(result.message || '操作失败');
            }
        } catch (error) {
            console.error('提交会议室表单失败:', error);
            wx.showToast({ title: '操作失败', icon: 'none' });
        }
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
}

module.exports = AdminRoomService; 