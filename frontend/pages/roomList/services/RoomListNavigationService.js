// 会议室列表导航服务模块

class RoomListNavigationService {
    /**
     * 跳转到会议室详情页
     * @param {Object} event 事件对象
     */
    static goToRoomDetail(event) {
        const room = event.currentTarget.dataset.room;
        
        if (!room || !room._id) {
            wx.showToast({
                title: '会议室信息不完整',
                icon: 'none'
            });
            return;
        }

        console.log('🏠 跳转到会议室详情:', {
            roomId: room._id,
            roomName: room.name
        });

        wx.navigateTo({
            url: `/pages/roomDetail/roomDetail?roomId=${room._id}`,
            fail: (error) => {
                console.error('❌ 跳转失败:', error);
                wx.showToast({
                    title: '跳转失败',
                    icon: 'none'
                });
            }
        });
    }

    /**
     * 跳转到管理员面板
     */
    static goToAdminPanel() {
        console.log('🔧 跳转到管理员面板');
        
        wx.navigateTo({
            url: '/pages/admin/admin',
            fail: (error) => {
                console.error('❌ 跳转管理员面板失败:', error);
                wx.showToast({
                    title: '跳转失败',
                    icon: 'none'
                });
            }
        });
    }

    /**
     * 跳转到搜索页面
     */
    static goToSearchPage() {
        console.log('🔍 跳转到搜索页面');
        
        wx.navigateTo({
            url: '/pages/search/search',
            fail: (error) => {
                console.error('❌ 跳转搜索页面失败:', error);
                wx.showToast({
                    title: '功能开发中',
                    icon: 'none'
                });
            }
        });
    }

    /**
     * 跳转到我的预约页面
     */
    static goToMyBookings() {
        console.log('📅 跳转到我的预约页面');
        
        wx.navigateTo({
            url: '/pages/myBookings/myBookings',
            fail: (error) => {
                console.error('❌ 跳转我的预约页面失败:', error);
                wx.showToast({
                    title: '跳转失败',
                    icon: 'none'
                });
            }
        });
    }

    /**
     * 打开位置地图
     * @param {Object} event 事件对象
     */
    static openLocationMap(event) {
        event.stopPropagation(); // 阻止事件冒泡
        
        const room = event.currentTarget.dataset.room;
        
        if (!room || !room.location) {
            wx.showToast({
                title: '位置信息不可用',
                icon: 'none'
            });
            return;
        }

        console.log('🗺️ 打开位置地图:', {
            roomName: room.name,
            location: room.location
        });

        // 尝试从地址获取坐标
        const location = this.getLocationFromAddress(room);
        this.openMap(room, location);
    }

    /**
     * 从地址获取位置信息
     * @param {Object} room 房间信息
     * @returns {Object} 位置坐标
     */
    static getLocationFromAddress(room) {
        // 这里可以根据具体的地址信息返回对应的坐标
        // 示例：根据楼层和房间号推算位置
        const location = room.location.toLowerCase();
        
        // 默认坐标（可以设置为公司/建筑物的中心位置）
        let latitude = 39.9042; // 北京天安门示例坐标
        let longitude = 116.4074;
        
        // 根据楼层微调坐标（这里只是示例逻辑）
        if (location.includes('1楼') || location.includes('一楼')) {
            latitude += 0.0001;
        } else if (location.includes('2楼') || location.includes('二楼')) {
            latitude += 0.0002;
        } else if (location.includes('3楼') || location.includes('三楼')) {
            latitude += 0.0003;
        }
        
        return {
            latitude,
            longitude,
            name: room.name,
            address: room.location
        };
    }

    /**
     * 打开地图
     * @param {Object} room 房间信息
     * @param {Object} location 位置信息
     */
    static openMap(room, location) {
        wx.openLocation({
            latitude: location.latitude,
            longitude: location.longitude,
            name: location.name,
            address: location.address,
            scale: 18,
            success: () => {
                console.log('✅ 地图打开成功');
            },
            fail: (error) => {
                console.error('❌ 地图打开失败:', error);
                wx.showToast({
                    title: '无法打开地图',
                    icon: 'none'
                });
            }
        });
    }
}

module.exports = RoomListNavigationService; 