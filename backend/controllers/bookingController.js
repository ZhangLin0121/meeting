const BookingValidationService = require('../services/BookingValidationService');
const BookingOperationService = require('../services/BookingOperationService');
const BookingExportService = require('../services/BookingExportService');
const BookingUtilService = require('../services/BookingUtilService');

/**
 * 预约控制器
 * 处理会议室预约相关的API请求
 * 已重构为模块化架构，使用服务层处理具体业务逻辑
 */
class BookingController {

    /**
     * 创建预约
     * POST /api/bookings
     */
    static async createBooking(req, res) {
        return await BookingOperationService.createBooking(req, res);
    }

    /**
     * 获取当前用户的预约列表
     * GET /api/bookings/my
     */
    static async getMyBookings(req, res) {
        return await BookingOperationService.getMyBookings(req, res);
    }

    /**
     * 取消预约
     * DELETE /api/bookings/:id
     */
    static async cancelBooking(req, res) {
        return await BookingOperationService.cancelBooking(req, res);
    }

    /**
     * 获取所有预约记录（管理员权限）
     * GET /api/bookings
     */
    static async getAllBookings(req, res) {
        return await BookingOperationService.getAllBookings(req, res);
    }

    /**
     * 管理员代预约
     * POST /api/bookings/manual
     */
    static async createManualBooking(req, res) {
        return await BookingOperationService.createManualBooking(req, res);
    }

    /**
     * 导出预约记录
     * GET /api/bookings/export
     */
    static async exportBookings(req, res) {
        return await BookingExportService.exportBookings(req, res);
    }

    /**
     * 清理旧的临时文件（在导出新文件时调用）
     */
    static cleanupOldFiles() {
        return BookingExportService.cleanupOldFiles();
    }

    /**
     * 下载导出文件
     * GET /api/bookings/download/:filename
     */
    static async downloadExportFile(req, res) {
        return await BookingExportService.downloadExportFile(req, res);
    }

    /**
     * 生成CSV内容
     */
    static generateCSV(data) {
        return BookingExportService.generateCSV(data);
    }

    /**
     * 生成Excel工作簿
     */
    static generateExcel(data) {
        return BookingExportService.generateExcel(data);
    }

    /**
     * 生成文件名
     */
    static generateFilename(extension, filters) {
        return BookingExportService.generateFilename(extension, filters);
    }

    /**
     * 获取状态文本
     */
    static getStatusText(status) {
        return BookingUtilService.getStatusText(status);
    }
}

module.exports = BookingController;