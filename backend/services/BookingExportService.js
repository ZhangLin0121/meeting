const Booking = require('../models/Booking');
const ResponseHelper = require('../utils/responseHelper');
const TimeHelper = require('../utils/timeHelper');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

/**
 * 预约导出服务
 * 处理所有预约导出相关的逻辑
 */
class BookingExportService {

    /**
     * 导出预约记录
     * @param {Object} req - 请求对象
     * @param {Object} res - 响应对象
     * @returns {Promise<Object>} 响应结果
     */
    static async exportBookings(req, res) {
        try {
            const { format = 'excel', date, status, startDate, endDate } = req.query;

            console.log('📤 开始导出预约记录:', { format, date, status, startDate, endDate });

            // 构建查询条件
            const query = this.buildExportQuery({ date, status, startDate, endDate });

            console.log('🔍 查询条件:', query);

            // 获取所有符合条件的预约记录
            const bookings = await Booking.find(query)
                .sort({ bookingDate: -1, startTime: -1 })
                .populate('roomId', 'name location capacity')
                .populate('userId', 'nickname');

            console.log(`📋 找到 ${bookings.length} 条预约记录`);

            if (bookings.length === 0) {
                return ResponseHelper.error(res, '没有找到符合条件的预约记录');
            }

            // 格式化数据
            const exportData = this.formatExportData(bookings);

            if (format === 'csv') {
                // 生成CSV
                const csv = this.generateCSV(exportData);
                const filename = this.generateFilename('csv', { date, status, startDate, endDate });

                res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

                return res.send('\uFEFF' + csv); // 添加BOM以支持中文
            } else {
                // 生成Excel
                const workbook = this.generateExcel(exportData);
                const filename = this.generateFilename('xlsx', { date, status, startDate, endDate });

                // 将Excel文件保存到临时目录
                const tempDir = path.join(__dirname, '../temp');

                // 确保临时目录存在
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                }

                // 在导出新文件前清理旧文件（超过1小时的文件）
                this.cleanupOldFiles();

                const filePath = path.join(tempDir, filename);
                XLSX.writeFile(workbook, filePath);

                // 生成下载URL
                const downloadUrl = `https://${req.get('host')}/meeting/api/bookings/download/${filename}`;

                console.log('✅ Excel文件生成成功:', { filename, filePath, downloadUrl });

                return ResponseHelper.success(res, {
                    downloadUrl,
                    filename,
                    totalRecords: bookings.length
                }, '导出文件准备完成');
            }

        } catch (error) {
            console.error('❌ 导出预约记录失败:', error);
            return ResponseHelper.serverError(res, '导出失败', error.message);
        }
    }

    /**
     * 下载导出文件
     * @param {Object} req - 请求对象
     * @param {Object} res - 响应对象
     * @returns {Promise<Object>} 响应结果
     */
    static async downloadExportFile(req, res) {
        try {
            const { filename } = req.params;

            // 确保使用与生成文件时相同的路径
            const tempDir = path.join(__dirname, '../temp');
            const filePath = path.join(tempDir, filename);

            console.log('🔍 查找下载文件:', { filename, tempDir, filePath, exists: fs.existsSync(filePath) });

            // 检查文件是否存在
            if (!fs.existsSync(filePath)) {
                return ResponseHelper.notFound(res, '文件不存在或已过期');
            }

            // 简化文件名处理，保持原始文件名以确保微信小程序能正确识别
            const safeFilename = filename;

            // 使用更安全的方式设置响应头
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

            // 简化Content-Disposition，去掉复杂的UTF-8编码以兼容微信小程序
            res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);

            // 发送文件
            res.sendFile(filePath, (err) => {
                if (err) {
                    console.error('文件发送失败:', err);
                    if (!res.headersSent) {
                        ResponseHelper.serverError(res, '文件下载失败');
                    }
                } else {
                    console.log('✅ 文件下载完成:', filename);
                    // 不立即删除文件，让文件保留更长时间，在下次导出时统一清理旧文件
                    console.log('📁 文件将保留1小时，下次导出时自动清理');
                }
            });

        } catch (error) {
            console.error('❌ 下载文件失败:', error);
            return ResponseHelper.serverError(res, '下载失败', error.message);
        }
    }

    /**
     * 构建导出查询条件
     * @param {Object} filters - 筛选条件
     * @returns {Object} 查询条件
     */
    static buildExportQuery(filters) {
        const { date, status, startDate, endDate } = filters;
        const query = {};

        // 处理日期筛选
        if (date) {
            // 特定日期
            const targetDate = TimeHelper.getStartOfDay(date);
            query.bookingDate = targetDate;
        } else if (startDate || endDate) {
            // 日期范围
            query.bookingDate = {};
            if (startDate) {
                query.bookingDate.$gte = TimeHelper.getStartOfDay(startDate);
            }
            if (endDate) {
                query.bookingDate.$lte = TimeHelper.getStartOfDay(endDate);
            }
        }

        // 处理状态筛选
        if (status) {
            query.status = status;
        }

        return query;
    }

    /**
     * 格式化导出数据
     * @param {Array} bookings - 预约记录数组
     * @returns {Array} 格式化后的数据
     */
    static formatExportData(bookings) {
        return bookings.map((booking, index) => ({
            序号: index + 1,
            会议室名称: booking.conferenceRoomName,
            会议室位置: booking.roomId ? booking.roomId.location : '',
            会议室容量: booking.roomId ? booking.roomId.capacity : '',
            预约日期: TimeHelper.formatDate(booking.bookingDate),
            开始时间: booking.startTime,
            结束时间: booking.endTime,
            会议主题: booking.topic,
            联系人: booking.userName,
            联系电话: booking.userPhone,
            参会人数: booking.attendeesCount || '',
            用户昵称: booking.userId ? booking.userId.nickname : '',
            预约状态: this.getStatusText(booking.status),
            预约方式: booking.isManualBooking ? '管理员代预约' : '用户自助预约',
            创建时间: TimeHelper.formatDateTime(booking.createdAt)
        }));
    }

    /**
     * 生成CSV内容
     * @param {Array} data - 数据数组
     * @returns {string} CSV内容
     */
    static generateCSV(data) {
        if (data.length === 0) return '';

        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row =>
                headers.map(header => `"${(row[header] || '').toString().replace(/"/g, '""')}"`).join(',')
            )
        ].join('\n');

        return csvContent;
    }

    /**
     * 生成Excel工作簿
     * @param {Array} data - 数据数组
     * @returns {Object} Excel工作簿
     */
    static generateExcel(data) {
        // 创建工作簿
        const workbook = XLSX.utils.book_new();

        // 创建工作表
        const worksheet = XLSX.utils.json_to_sheet(data);

        // 设置列宽
        const columnWidths = [
            { wch: 6 }, // 序号
            { wch: 20 }, // 会议室名称
            { wch: 20 }, // 会议室位置
            { wch: 10 }, // 会议室容量
            { wch: 12 }, // 预约日期
            { wch: 10 }, // 开始时间
            { wch: 10 }, // 结束时间
            { wch: 30 }, // 会议主题
            { wch: 15 }, // 联系人
            { wch: 15 }, // 联系电话
            { wch: 10 }, // 参会人数
            { wch: 15 }, // 用户昵称
            { wch: 12 }, // 预约状态
            { wch: 15 }, // 预约方式
            { wch: 20 } // 创建时间
        ];

        worksheet['!cols'] = columnWidths;

        // 添加工作表到工作簿
        XLSX.utils.book_append_sheet(workbook, worksheet, '预约记录');

        return workbook;
    }

    /**
     * 生成文件名
     * @param {string} extension - 文件扩展名
     * @param {Object} filters - 筛选条件
     * @returns {string} 文件名
     */
    static generateFilename(extension, filters) {
        const moment = require('moment-timezone');
        const now = moment().tz('Asia/Shanghai').format('YYYYMMDD_HHmmss');

        let filenameParts = ['meeting_bookings_export'];

        if (filters.date) {
            filenameParts.push(filters.date.replace(/-/g, ''));
        } else if (filters.startDate || filters.endDate) {
            if (filters.startDate && filters.endDate) {
                filenameParts.push(`${filters.startDate.replace(/-/g, '')}_${filters.endDate.replace(/-/g, '')}`);
            } else if (filters.startDate) {
                filenameParts.push(`from_${filters.startDate.replace(/-/g, '')}`);
            } else if (filters.endDate) {
                filenameParts.push(`until_${filters.endDate.replace(/-/g, '')}`);
            }
        }

        if (filters.status) {
            filenameParts.push(filters.status);
        }

        filenameParts.push(now);

        return `${filenameParts.join('_')}.${extension}`;
    }

    /**
     * 清理旧的临时文件（在导出新文件时调用）
     */
    static cleanupOldFiles() {
        try {
            const tempDir = path.join(__dirname, '../temp');

            if (!fs.existsSync(tempDir)) {
                return;
            }

            const files = fs.readdirSync(tempDir);
            const now = Date.now();
            const maxAge = 60 * 60 * 1000; // 1小时

            let cleanedCount = 0;
            files.forEach(file => {
                // 只清理xlsx文件
                if (!file.endsWith('.xlsx')) return;

                const filePath = path.join(tempDir, file);
                try {
                    const stats = fs.statSync(filePath);
                    if (now - stats.mtime.getTime() > maxAge) {
                        fs.unlinkSync(filePath); // 使用同步删除，确保删除完成
                        cleanedCount++;
                        console.log('🧹 清理旧导出文件:', file);
                    }
                } catch (err) {
                    console.error('清理文件失败:', file, err.message);
                }
            });

            if (cleanedCount > 0) {
                console.log(`✅ 共清理了 ${cleanedCount} 个旧导出文件`);
            }
        } catch (error) {
            console.error('清理临时文件时出错:', error);
        }
    }

    /**
     * 获取状态文本
     * @param {string} status - 状态代码
     * @returns {string} 状态文本
     */
    static getStatusText(status) {
        const statusMap = {
            'booked': '已预约',
            'completed': '已完成',
            'cancelled': '已取消'
        };
        return statusMap[status] || status;
    }
}

module.exports = BookingExportService; 