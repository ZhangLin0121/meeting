// 管理员预约管理服务模块
const request = require('../../../utils/request.js');

class AdminBookingService {
    /**
     * 加载预约记录
     * @param {Object} pageContext 页面上下文
     */
    static async loadBookings(pageContext) {
        pageContext.setData({ bookingsLoading: true });
        try {
            let url = '/api/bookings?includeRoomDetails=true';
            if (pageContext.data.filterDate) {
                url += `&date=${pageContext.data.filterDate}`;
            }
            if (pageContext.data.statusOptions[pageContext.data.filterStatusIndex].value) {
                url += `&status=${pageContext.data.statusOptions[pageContext.data.filterStatusIndex].value}`;
            }

            const result = await request.get(url);
            if (result.success) {
                pageContext.setData({ bookings: result.data || [] });
            }
        } catch (error) {
            wx.showToast({ title: '加载预约失败', icon: 'none' });
        } finally {
            pageContext.setData({ bookingsLoading: false });
        }
    }

    /**
     * 刷新预约记录
     * @param {Object} pageContext 页面上下文
     */
    static refreshBookings(pageContext) {
        pageContext.setData({
            bookings: [],
            bookingsPage: 1,
            bookingsHasMore: true
        });
        this.loadBookings(pageContext);
    }

    /**
     * 加载更多预约记录
     * @param {Object} pageContext 页面上下文
     */
    static loadMoreBookings(pageContext) {
        this.loadBookings(pageContext);
    }

    /**
     * 筛选日期变化处理
     * @param {Object} pageContext 页面上下文
     * @param {Object} event 事件对象
     */
    static onFilterDateChange(pageContext, event) {
        pageContext.setData({ filterDate: event.detail.value });
        this.refreshBookings(pageContext);
    }

    /**
     * 筛选状态变化处理
     * @param {Object} pageContext 页面上下文
     * @param {Object} event 事件对象
     */
    static onFilterStatusChange(pageContext, event) {
        pageContext.setData({ filterStatusIndex: event.detail.value });
        this.refreshBookings(pageContext);
    }

    /**
     * 取消预约
     * @param {Object} pageContext 页面上下文
     * @param {Object} event 事件对象
     */
    static cancelBooking(pageContext, event) {
        const bookingId = event.currentTarget.dataset.id;
        const booking = pageContext.data.bookings.find(b => b._id === bookingId);
        
        wx.showModal({
            title: '确认取消',
            content: `确定要取消"${booking?.topic || '未知'}"的预约吗？`,
            success: async (res) => {
                if (res.confirm) {
                    try {
                        const result = await request.delete(`/api/bookings/${bookingId}`);
                        if (result.success) {
                            wx.showToast({ title: '取消成功', icon: 'success' });
                            this.refreshBookings(pageContext);
                        } else {
                            throw new Error(result.message || '取消失败');
                        }
                    } catch (error) {
                        console.error('取消预约失败:', error);
                        wx.showToast({ title: '取消失败', icon: 'none' });
                    }
                }
            }
        });
    }

    /**
     * 导出预约记录
     * @param {Object} pageContext 页面上下文
     */
    static async exportBookings(pageContext) {
        try {
            wx.showLoading({ title: '正在导出...' });

            // 构建导出参数
            let exportUrl = '/api/bookings/export?format=excel';
            
            if (pageContext.data.filterDate) {
                exportUrl += `&date=${pageContext.data.filterDate}`;
            }
            
            if (pageContext.data.statusOptions[pageContext.data.filterStatusIndex].value) {
                exportUrl += `&status=${pageContext.data.statusOptions[pageContext.data.filterStatusIndex].value}`;
            }

            console.log('🔗 导出URL:', exportUrl);

            const result = await request.get(exportUrl);

            if (result.success && result.data && result.data.downloadUrl) {
                wx.hideLoading();
                
                // 提示用户开始下载
                wx.showModal({
                    title: '导出成功',
                    content: '文件已生成，是否立即下载？',
                    success: (res) => {
                        if (res.confirm) {
                            this.downloadExportFile(pageContext, result.data.downloadUrl, result.data.filename);
                        }
                    }
                });
            } else {
                throw new Error(result.message || '导出失败');
            }
        } catch (error) {
            wx.hideLoading();
            console.error('导出预约记录失败:', error);
            wx.showToast({ 
                title: error.message || '导出失败', 
                icon: 'none',
                duration: 3000
            });
        }
    }

    /**
     * 下载导出文件
     * @param {Object} pageContext 页面上下文
     * @param {string} downloadUrl 下载URL
     * @param {string} filename 文件名
     */
    static downloadExportFile(pageContext, downloadUrl, filename) {
        wx.showLoading({ title: '正在下载...' });

        // 确保URL是完整的
        const fullUrl = downloadUrl.startsWith('http') ? downloadUrl : `${pageContext.data.apiBaseUrl}${downloadUrl}`;
        
        console.log('📥 开始下载文件:', {
            downloadUrl,
            fullUrl,
            filename
        });

        wx.downloadFile({
            url: fullUrl,
            success: (res) => {
                wx.hideLoading();
                
                if (res.statusCode === 200) {
                    console.log('✅ 文件下载成功:', res.tempFilePath);
                    
                    // 保存文件到相册或文件管理器
                    wx.saveFile({
                        tempFilePath: res.tempFilePath,
                        success: (saveRes) => {
                            console.log('✅ 文件保存成功:', saveRes.savedFilePath);
                            wx.showModal({
                                title: '下载完成',
                                content: `文件已保存到本地`,
                                showCancel: false,
                                confirmText: '确定'
                            });
                        },
                        fail: (saveError) => {
                            console.error('❌ 文件保存失败:', saveError);
                            
                            // 尝试打开文档
                            wx.openDocument({
                                filePath: res.tempFilePath,
                                fileType: 'xlsx',
                                success: () => {
                                    console.log('✅ 文档打开成功');
                                },
                                fail: (openError) => {
                                    console.error('❌ 文档打开失败:', openError);
                                    wx.showToast({ 
                                        title: '文件下载完成，但无法打开', 
                                        icon: 'none',
                                        duration: 3000
                                    });
                                }
                            });
                        }
                    });
                } else {
                    console.error('❌ 下载失败，状态码:', res.statusCode);
                    wx.showToast({ 
                        title: `下载失败 (${res.statusCode})`, 
                        icon: 'none',
                        duration: 3000
                    });
                }
            },
            fail: (error) => {
                wx.hideLoading();
                console.error('❌ 下载文件失败:', error);
                
                let errorMessage = '下载失败';
                if (error.errMsg) {
                    if (error.errMsg.includes('request:fail')) {
                        errorMessage = '网络连接失败，请检查网络';
                    } else if (error.errMsg.includes('timeout')) {
                        errorMessage = '下载超时，请重试';
                    } else {
                        errorMessage = `下载失败: ${error.errMsg}`;
                    }
                }
                
                wx.showToast({ 
                    title: errorMessage, 
                    icon: 'none',
                    duration: 3000
                });
            }
        });
    }
}

module.exports = AdminBookingService; 