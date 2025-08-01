// 管理员图片处理服务模块
const request = require('../../../utils/request.js');

class AdminImageService {
    /**
     * 选择图片
     * @param {Object} pageContext 页面上下文
     */
    static chooseImage(pageContext) {
        wx.chooseMedia({
            count: 1,
            mediaType: ['image'],
            sourceType: ['album', 'camera'],
            success: (res) => {
                const tempFilePath = res.tempFiles[0].tempFilePath;
                console.log('选择图片成功:', tempFilePath);
                
                // 设置新图片路径
                pageContext.setData({
                    'roomForm.newImagePath': tempFilePath,
                    'roomForm.uploadedImagePath': '' // 清除之前上传的图片
                });
                
                // 自动上传图片
                this.uploadImage(pageContext, tempFilePath);
            },
            fail: (error) => {
                console.error('选择图片失败:', error);
                wx.showToast({ title: '选择图片失败', icon: 'none' });
            }
        });
    }

    /**
     * 上传图片
     * @param {Object} pageContext 页面上下文
     * @param {string} filePath 文件路径
     */
    static async uploadImage(pageContext, filePath) {
        try {
            pageContext.setData({ imageUploading: true });
            
            console.log('开始上传图片:', filePath);

            // 使用wx.uploadFile上传图片
            wx.uploadFile({
                url: `${pageContext.data.apiBaseUrl}/api/upload/room-image`,
                filePath: filePath,
                name: 'image',
                header: {
                    'x-user-openid': pageContext.data.userOpenId
                },
                success: (uploadRes) => {
                    console.log('图片上传响应:', uploadRes);
                    
                    try {
                        const result = JSON.parse(uploadRes.data);
                        
                        if (result.success && result.data && result.data.imagePath) {
                            console.log('✅ 图片上传成功:', result.data.imagePath);
                            
                            // 更新表单数据
                            pageContext.setData({
                                'roomForm.uploadedImagePath': result.data.imagePath,
                                imageUploading: false
                            });
                            
                            wx.showToast({ 
                                title: '图片上传成功', 
                                icon: 'success' 
                            });
                        } else {
                            throw new Error(result.message || '上传失败');
                        }
                    } catch (parseError) {
                        console.error('解析上传响应失败:', parseError, uploadRes.data);
                        throw new Error('服务器响应格式错误');
                    }
                },
                fail: (error) => {
                    console.error('图片上传失败:', error);
                    pageContext.setData({ imageUploading: false });
                    
                    let errorMessage = '上传失败';
                    if (error.errMsg) {
                        if (error.errMsg.includes('request:fail')) {
                            errorMessage = '网络连接失败';
                        } else if (error.errMsg.includes('timeout')) {
                            errorMessage = '上传超时';
                        }
                    }
                    
                    wx.showToast({ 
                        title: errorMessage, 
                        icon: 'none' 
                    });
                }
            });
        } catch (error) {
            console.error('上传图片过程出错:', error);
            pageContext.setData({ imageUploading: false });
            wx.showToast({ title: '上传失败', icon: 'none' });
        }
    }

    /**
     * 移除当前图片
     * @param {Object} pageContext 页面上下文
     */
    static removeCurrentImage(pageContext) {
        pageContext.setData({
            'roomForm.currentImage': '',
        });
    }

    /**
     * 移除新选择的图片
     * @param {Object} pageContext 页面上下文
     */
    static removeNewImage(pageContext) {
        const { roomForm } = pageContext.data;
        
        // 如果有已上传的图片，需要删除
        if (roomForm.uploadedImagePath) {
            this.deleteUploadedImage(pageContext, roomForm.uploadedImagePath);
        }
        
        pageContext.setData({
            'roomForm.newImagePath': '',
            'roomForm.uploadedImagePath': ''
        });
    }

    /**
     * 删除已上传的图片
     * @param {Object} pageContext 页面上下文
     * @param {string} imagePath 图片路径
     */
    static async deleteUploadedImage(pageContext, imagePath) {
        try {
            await request.delete('/api/upload/room-image', { imagePath });
            console.log('✅ 已删除上传的图片:', imagePath);
        } catch (error) {
            console.error('❌ 删除上传图片失败:', error);
        }
    }

    /**
     * 图片加载成功处理
     * @param {Object} pageContext 页面上下文
     * @param {Object} event 事件对象
     */
    static onImageLoad(pageContext, event) {
        const roomId = event.currentTarget.dataset.roomId;
        console.log('✅ 图片加载成功:', roomId);
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
        console.error('❌ 图片加载失败:', roomId);
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
     * 获取本地房间图片
     * @param {string} roomName 房间名称
     * @param {string} roomId 房间ID
     * @returns {string} 图片路径
     */
    static getLocalRoomImage(roomName, roomId) {
        // 根据房间名称和ID生成本地图片路径
        const imageId = this.generateRoomId(roomName);
        return `/images/rooms/room_${imageId}.jpg`;
    }

    /**
     * 生成房间ID
     * @param {string} roomName 房间名称
     * @returns {string} 生成的ID
     */
    static generateRoomId(roomName) {
        const timestamp = Date.now();
        const hash = this.simpleHash(roomName);
        return `${timestamp}_${hash}`;
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

module.exports = AdminImageService; 