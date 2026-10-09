// 会议室列表搜索服务模块
const request = require('../../../utils/request.js');
const RoomListDataService = require('./RoomListDataService.js');

class RoomListSearchService {
    /**
     * 清除搜索
     * @param {Object} pageContext 页面上下文
     */
    static clearSearch(pageContext) {
        pageContext.setData({
            searchKeyword: ''
        });
        // 重新获取所有会议室数据
        // 这里需要调用DataService的fetchRooms方法
    }

    /**
     * 搜索输入处理
     * @param {Object} pageContext 页面上下文
     * @param {Object} event 事件对象
     */
    static onSearchInput(pageContext, event) {
        const keyword = event.detail.value;
        pageContext.setData({
            searchKeyword: keyword
        });
    }

    /**
     * 搜索确认
     * @param {Object} pageContext 页面上下文
     */
    static async onSearchConfirm(pageContext) {
        const keyword = pageContext.data.searchKeyword.trim();
        if (keyword) {
            await this.performSearch(pageContext, keyword);
        }
    }

    /**
     * 执行搜索
     * @param {Object} pageContext 页面上下文
     * @param {string} keyword 搜索关键词
     */
    static async performSearch(pageContext, keyword) {
        try {
            pageContext.setData({ loading: true });
            console.log('🔍 开始搜索会议室:', keyword);

            const result = await request.get('/api/rooms', {
                search: keyword
            });
            
            if (result.success) {
                const rooms = Array.isArray(result.data) ? result.data : [];
                const processedRooms = await RoomListDataService.processRoomsData(pageContext, rooms);
                pageContext.setData({
                    rooms: processedRooms,
                    loading: false
                });
                console.log('✅ 搜索完成，结果数量:', processedRooms.length);
            } else {
                throw new Error(result.message || '搜索失败');
            }
        } catch (error) {
            console.error('❌ 搜索失败:', error);
            pageContext.setData({ loading: false });
            wx.showToast({
                title: '搜索失败',
                icon: 'none'
            });
        }
    }

    /**
     * 显示筛选选项
     * @param {Object} pageContext 页面上下文
     */
    static showFilterOptions(pageContext) {
        wx.showActionSheet({
            itemList: ['按容量筛选', '按设备筛选', '清除筛选'],
            success: (res) => {
                switch (res.tapIndex) {
                    case 0:
                        this.showCapacityFilter(pageContext);
                        break;
                    case 1:
                        this.showEquipmentFilter(pageContext);
                        break;
                    case 2:
                        this.clearFilter(pageContext);
                        break;
                }
            }
        });
    }

    /**
     * 显示容量筛选
     * @param {Object} pageContext 页面上下文
     */
    static showCapacityFilter(pageContext) {
        wx.showActionSheet({
            itemList: ['小型会议室 (≤6人)', '中型会议室 (7-12人)', '大型会议室 (≥13人)'],
            success: async (res) => {
                let minCapacity, maxCapacity;
                switch (res.tapIndex) {
                    case 0:
                        minCapacity = 1;
                        maxCapacity = 6;
                        break;
                    case 1:
                        minCapacity = 7;
                        maxCapacity = 12;
                        break;
                    case 2:
                        minCapacity = 13;
                        maxCapacity = 999;
                        break;
                }
                await this.filterByCapacity(pageContext, minCapacity, maxCapacity);
            }
        });
    }

    /**
     * 按容量筛选
     * @param {Object} pageContext 页面上下文
     * @param {number} minCapacity 最小容量
     * @param {number} maxCapacity 最大容量
     */
    static async filterByCapacity(pageContext, minCapacity, maxCapacity) {
        try {
            pageContext.setData({ loading: true });
            console.log('🔍 按容量筛选:', { minCapacity, maxCapacity });

            const result = await request.get('/api/rooms', {
                capacityMin: minCapacity,
                capacityMax: maxCapacity
            });
            
            if (result.success) {
                const rooms = Array.isArray(result.data) ? result.data : [];
                const processedRooms = await RoomListDataService.processRoomsData(pageContext, rooms);
                pageContext.setData({
                    rooms: processedRooms,
                    loading: false
                });
                
                wx.showToast({
                    title: `找到 ${processedRooms.length} 个会议室`,
                    icon: 'success'
                });
            } else {
                throw new Error(result.message || '筛选失败');
            }
        } catch (error) {
            console.error('❌ 容量筛选失败:', error);
            pageContext.setData({ loading: false });
            wx.showToast({
                title: '筛选失败',
                icon: 'none'
            });
        }
    }

    /**
     * 显示设备筛选
     * @param {Object} pageContext 页面上下文
     */
    static showEquipmentFilter(pageContext) {
        wx.showActionSheet({
            itemList: ['投屏设备', '视频会议设备', '白板', '音响系统'],
            success: async (res) => {
                const equipmentList = ['投屏设备', '视频会议设备', '白板', '音响系统'];
                const selectedEquipment = equipmentList[res.tapIndex];
                await this.filterByEquipment(pageContext, selectedEquipment);
            }
        });
    }

    /**
     * 按设备筛选
     * @param {Object} pageContext 页面上下文
     * @param {string} equipment 设备名称
     */
    static async filterByEquipment(pageContext, equipment) {
        try {
            pageContext.setData({ loading: true });
            console.log('🔍 按设备筛选:', equipment);

            const result = await request.get('/api/rooms', {
                equipment: equipment
            });
            
            if (result.success) {
                const rooms = Array.isArray(result.data) ? result.data : [];
                const processedRooms = await RoomListDataService.processRoomsData(pageContext, rooms);
                pageContext.setData({
                    rooms: processedRooms,
                    loading: false
                });
                
                wx.showToast({
                    title: `找到 ${processedRooms.length} 个会议室`,
                    icon: 'success'
                });
            } else {
                throw new Error(result.message || '筛选失败');
            }
        } catch (error) {
            console.error('❌ 设备筛选失败:', error);
            pageContext.setData({ loading: false });
            wx.showToast({
                title: '筛选失败',
                icon: 'none'
            });
        }
    }

    /**
     * 清除筛选
     * @param {Object} pageContext 页面上下文
     */
    static clearFilter(pageContext) {
        console.log('🧹 清除筛选条件');
        pageContext.setData({
            searchKeyword: ''
        });
        
        // 重新获取所有会议室数据
        // 这里需要调用DataService的fetchRooms方法
        wx.showToast({
            title: '已清除筛选',
            icon: 'success'
        });
    }
}

module.exports = RoomListSearchService; 
