const Booking = require('../models/Booking');
const ConferenceRoom = require('../models/ConferenceRoom');
const TemporaryClosure = require('../models/TemporaryClosure');
const User = require('../models/User');
const ResponseHelper = require('../utils/responseHelper');
const TimeHelper = require('../utils/timeHelper');
const config = require('../config');

/**
 * 预约控制器
 * 处理会议室预约相关的API请求
 */
class BookingController {

    /**
     * 创建预约
     * POST /api/bookings
     */
    static async createBooking(req, res) {
        try {
            const {
                roomId,
                bookingDate,
                startTime,
                endTime,
                topic,
                contactName,
                contactPhone,
                attendeesCount
            } = req.body;

            const user = req.user;

            // 验证会议室是否存在
            const room = await ConferenceRoom.findById(roomId);
            if (!room) {
                return ResponseHelper.notFound(res, '会议室不存在');
            }

            // 验证预约日期是否在允许范围内
            if (!TimeHelper.isWithinBookingRange(bookingDate)) {
                return ResponseHelper.error(res, `只能预约未来${config.booking.maxAdvanceDays}天内的会议室`);
            }

            // 验证预约时间是否在过去
            if (TimeHelper.isPastTime(bookingDate, startTime)) {
                return ResponseHelper.error(res, '不能预约过去的时间');
            }

            // 验证是否为工作日 - 现已开放周末预约
            // if (!TimeHelper.isWorkday(bookingDate)) {
            //     return ResponseHelper.error(res, '只能预约工作日的会议室');
            // }

            // 验证时间是否在办公时间内 - 已取消限制，允许全时段预约
            // if (!TimeHelper.isOfficeTime(startTime) || !TimeHelper.isOfficeTime(endTime)) {
            //     return ResponseHelper.error(res, '预约时间必须在办公时间内');
            // }

            // 验证是否跨越午休时间（全天预约除外）
            if (TimeHelper.isInvalidLunchBreakCrossing(startTime, endTime)) {
                return ResponseHelper.error(res, '预约时间不能跨越午休时间');
            }

            // 验证结束时间大于开始时间
            const startMinutes = TimeHelper.timeToMinutes(startTime);
            const endMinutes = TimeHelper.timeToMinutes(endTime);
            if (endMinutes <= startMinutes) {
                return ResponseHelper.error(res, '结束时间必须大于开始时间');
            }

            // 检查最小预约时间（30分钟）
            if (endMinutes - startMinutes < 30) {
                return ResponseHelper.error(res, '最小预约时间为30分钟');
            }

            const bookingDateObj = TimeHelper.getStartOfDay(bookingDate);

            // 检查时间段冲突
            const conflictBooking = await Booking.findOne({
                roomId,
                bookingDate: bookingDateObj,
                status: 'booked',
                $or: [
                    // 开始时间在已有预约时间段内
                    {
                        startTime: { $lte: startTime },
                        endTime: { $gt: startTime }
                    },
                    // 结束时间在已有预约时间段内
                    {
                        startTime: { $lt: endTime },
                        endTime: { $gte: endTime }
                    },
                    // 新预约完全包含已有预约
                    {
                        startTime: { $gte: startTime },
                        endTime: { $lte: endTime }
                    }
                ]
            });

            if (conflictBooking) {
                return ResponseHelper.error(res, '该时间段已被预约', 409);
            }

            // 检查临时关闭
            const closure = await TemporaryClosure.findOne({
                roomId,
                closureDate: bookingDateObj,
                $or: [
                    { isAllDay: true },
                    {
                        isAllDay: false,
                        startTime: { $lte: startTime },
                        endTime: { $gt: startTime }
                    },
                    {
                        isAllDay: false,
                        startTime: { $lt: endTime },
                        endTime: { $gte: endTime }
                    }
                ]
            });

            if (closure) {
                const reason = closure.reason ? `（${closure.reason}）` : '';
                return ResponseHelper.error(res, `该时间段会议室临时关闭${reason}`, 409);
            }

            // 创建预约
            const booking = new Booking({
                roomId,
                conferenceRoomName: room.name,
                userId: user._id,
                userName: contactName,
                userPhone: contactPhone,
                bookingDate: bookingDateObj,
                startTime,
                endTime,
                topic,
                attendeesCount,
                status: 'booked',
                isManualBooking: false
            });

            await booking.save();

            // 更新用户联系信息（如果有变化或为空）
            let shouldUpdateUser = false;

            if (!user.contactName || !user.contactPhone) {
                // 用户首次填写联系人信息
                console.log('📝 首次设置用户联系人信息');
                shouldUpdateUser = true;
            } else if (user.contactName !== contactName || user.contactPhone !== contactPhone) {
                // 用户修改了联系人信息
                console.log('📝 更新用户联系人信息:', {
                    oldName: user.contactName,
                    newName: contactName,
                    oldPhone: user.contactPhone ? user.contactPhone.substring(0, 3) + '****' + user.contactPhone.substring(7) : '',
                    newPhone: contactPhone.substring(0, 3) + '****' + contactPhone.substring(7)
                });
                shouldUpdateUser = true;
            }

            if (shouldUpdateUser) {
                user.contactName = contactName;
                user.contactPhone = contactPhone;
                await user.save();
                console.log('✅ 用户联系人信息更新成功');
            }

            return ResponseHelper.success(res, {
                id: booking._id,
                roomId: booking.roomId,
                conferenceRoomName: booking.conferenceRoomName,
                bookingDate: TimeHelper.formatDate(booking.bookingDate),
                startTime: booking.startTime,
                endTime: booking.endTime,
                topic: booking.topic,
                attendeesCount: booking.attendeesCount,
                userName: booking.userName,
                userPhone: booking.userPhone,
                status: booking.status,
                createdAt: booking.createdAt
            }, '预约成功', 201);

        } catch (error) {
            console.error('创建预约失败:', error);
            return ResponseHelper.serverError(res, '创建预约失败', error.message);
        }
    }

    /**
     * 获取当前用户的预约列表
     * GET /api/bookings/my
     */
    static async getMyBookings(req, res) {
        try {
            const { page = 1, limit = 10, status } = req.query;
            const user = req.user;

            const query = { userId: user._id };
            if (status) {
                query.status = status;
            }

            const skip = (page - 1) * limit;

            const bookings = await Booking.find(query)
                .skip(skip)
                .limit(parseInt(limit))
                .populate('roomId', 'name location');

            const total = await Booking.countDocuments(query);

            // 按照距离当前时间的远近排序，最近的在前面
            const now = TimeHelper.now();
            bookings.sort((a, b) => {
                const aDateTime = TimeHelper.combineDateAndTime(a.bookingDate, a.startTime);
                const bDateTime = TimeHelper.combineDateAndTime(b.bookingDate, b.startTime);

                // 计算与当前时间的绝对差值
                const aDiff = Math.abs(aDateTime.diff(now));
                const bDiff = Math.abs(bDateTime.diff(now));

                return aDiff - bDiff; // 时间差小的排在前面
            });

            const bookingList = bookings.map(booking => ({
                id: booking._id,
                roomId: booking.roomId._id,
                conferenceRoomName: booking.conferenceRoomName,
                roomLocation: booking.roomId ? booking.roomId.location : '',
                bookingDate: TimeHelper.formatDate(booking.bookingDate),
                startTime: booking.startTime,
                endTime: booking.endTime,
                topic: booking.topic,
                attendeesCount: booking.attendeesCount,
                status: booking.status,
                canCancel: booking.status === 'booked' && TimeHelper.canCancelBooking(
                    booking.bookingDate,
                    booking.startTime,
                    config.booking.cancelTimeLimitMinutes
                ),
                createdAt: booking.createdAt
            }));

            return ResponseHelper.paginated(res, bookingList, {
                page: parseInt(page),
                limit: parseInt(limit),
                total
            }, '获取我的预约列表成功');

        } catch (error) {
            console.error('获取用户预约列表失败:', error);
            return ResponseHelper.serverError(res, '获取预约列表失败', error.message);
        }
    }

    /**
     * 取消预约
     * DELETE /api/bookings/:id
     */
    static async cancelBooking(req, res) {
        try {
            const { id } = req.params;
            const user = req.user;

            const booking = await Booking.findById(id);
            if (!booking) {
                return ResponseHelper.notFound(res, '预约记录不存在');
            }

            // 检查权限：只能取消自己的预约，或管理员可以取消任何预约
            if (booking.userId.toString() !== user._id.toString() && user.role !== 'admin') {
                return ResponseHelper.forbidden(res, '无权取消此预约');
            }

            // 检查预约状态
            if (booking.status !== 'booked') {
                return ResponseHelper.error(res, '只能取消已预约状态的预约');
            }

            // 检查取消时间限制
            const limitMinutes = user.role === 'admin' ?
                config.booking.adminCancelTimeLimitMinutes :
                config.booking.cancelTimeLimitMinutes;

            if (!TimeHelper.canCancelBooking(booking.bookingDate, booking.startTime, limitMinutes)) {
                const limitText = user.role === 'admin' ? '5分钟' : '30分钟';
                return ResponseHelper.error(res, `会议开始前${limitText}内不能取消预约`);
            }

            // 取消预约
            booking.status = 'cancelled';
            await booking.save();

            return ResponseHelper.success(res, {
                id: booking._id,
                status: booking.status,
                cancelledAt: new Date()
            }, '取消预约成功');

        } catch (error) {
            console.error('取消预约失败:', error);
            return ResponseHelper.serverError(res, '取消预约失败', error.message);
        }
    }

    /**
     * 获取所有预约记录（管理员权限）
     * GET /api/bookings
     */
    static async getAllBookings(req, res) {
        try {
            const {
                page = 1,
                    limit = 10,
                    roomId,
                    startDate,
                    endDate,
                    status = 'booked'
            } = req.query;

            const query = {};

            if (roomId) {
                query.roomId = roomId;
            }

            if (status) {
                query.status = status;
            }

            if (startDate || endDate) {
                query.bookingDate = {};
                if (startDate) {
                    query.bookingDate.$gte = TimeHelper.getStartOfDay(startDate);
                }
                if (endDate) {
                    query.bookingDate.$lte = TimeHelper.getEndOfDay(endDate);
                }
            }

            const skip = (page - 1) * limit;

            const bookings = await Booking.find(query)
                .sort({ bookingDate: -1, startTime: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('roomId', 'name location')
                .populate('userId', 'nickname');

            const total = await Booking.countDocuments(query);

            const bookingList = bookings.map(booking => ({
                id: booking._id,
                roomId: booking.roomId._id,
                conferenceRoomName: booking.conferenceRoomName,
                roomLocation: booking.roomId ? booking.roomId.location : '',
                bookingDate: TimeHelper.formatDate(booking.bookingDate),
                startTime: booking.startTime,
                endTime: booking.endTime,
                topic: booking.topic,
                attendeesCount: booking.attendeesCount,
                userName: booking.userName,
                userPhone: booking.userPhone,
                userNickname: booking.userId ? booking.userId.nickname : '',
                status: booking.status,
                isManualBooking: booking.isManualBooking,
                canCancel: booking.status === 'booked' && TimeHelper.canCancelBooking(
                    booking.bookingDate,
                    booking.startTime,
                    config.booking.adminCancelTimeLimitMinutes
                ),
                createdAt: booking.createdAt
            }));

            return ResponseHelper.paginated(res, bookingList, {
                page: parseInt(page),
                limit: parseInt(limit),
                total
            }, '获取预约记录成功');

        } catch (error) {
            console.error('获取所有预约记录失败:', error);
            return ResponseHelper.serverError(res, '获取预约记录失败', error.message);
        }
    }

    /**
     * 管理员代预约
     * POST /api/bookings/manual
     */
    static async createManualBooking(req, res) {
        try {
            const {
                roomId,
                bookingDate,
                startTime,
                endTime,
                topic,
                contactName,
                contactPhone,
                attendeesCount,
                targetUserId
            } = req.body;

            const admin = req.user;

            // 查找目标用户（被代预约的用户）
            let targetUser = null;
            if (targetUserId) {
                targetUser = await User.findById(targetUserId);
                if (!targetUser) {
                    return ResponseHelper.notFound(res, '目标用户不存在');
                }
            }

            // 验证会议室是否存在
            const room = await ConferenceRoom.findById(roomId);
            if (!room) {
                return ResponseHelper.notFound(res, '会议室不存在');
            }

            // 其他验证逻辑与普通预约相同
            if (!TimeHelper.isWithinBookingRange(bookingDate)) {
                return ResponseHelper.error(res, `只能预约未来${config.booking.maxAdvanceDays}天内的会议室`);
            }

            // 验证是否为工作日 - 现已开放周末预约
            // if (!TimeHelper.isWorkday(bookingDate)) {
            //     return ResponseHelper.error(res, '只能预约工作日的会议室');
            // }

            // 验证时间是否在办公时间内 - 已取消限制，允许全时段预约
            // if (!TimeHelper.isOfficeTime(startTime) || !TimeHelper.isOfficeTime(endTime)) {
            //     return ResponseHelper.error(res, '预约时间必须在办公时间内');
            // }

            // 验证是否跨越午休时间（全天预约除外）
            if (TimeHelper.isInvalidLunchBreakCrossing(startTime, endTime)) {
                return ResponseHelper.error(res, '预约时间不能跨越午休时间');
            }

            const startMinutes = TimeHelper.timeToMinutes(startTime);
            const endMinutes = TimeHelper.timeToMinutes(endTime);
            if (endMinutes <= startMinutes) {
                return ResponseHelper.error(res, '结束时间必须大于开始时间');
            }

            if (endMinutes - startMinutes < 30) {
                return ResponseHelper.error(res, '最小预约时间为30分钟');
            }

            const bookingDateObj = TimeHelper.getStartOfDay(bookingDate);

            // 检查时间段冲突
            const conflictBooking = await Booking.findOne({
                roomId,
                bookingDate: bookingDateObj,
                status: 'booked',
                $or: [{
                        startTime: { $lte: startTime },
                        endTime: { $gt: startTime }
                    },
                    {
                        startTime: { $lt: endTime },
                        endTime: { $gte: endTime }
                    },
                    {
                        startTime: { $gte: startTime },
                        endTime: { $lte: endTime }
                    }
                ]
            });

            if (conflictBooking) {
                return ResponseHelper.error(res, '该时间段已被预约', 409);
            }

            // 检查临时关闭
            const closure = await TemporaryClosure.findOne({
                roomId,
                closureDate: bookingDateObj,
                $or: [
                    { isAllDay: true },
                    {
                        isAllDay: false,
                        startTime: { $lte: startTime },
                        endTime: { $gt: startTime }
                    },
                    {
                        isAllDay: false,
                        startTime: { $lt: endTime },
                        endTime: { $gte: endTime }
                    }
                ]
            });

            if (closure) {
                const reason = closure.reason ? `（${closure.reason}）` : '';
                return ResponseHelper.error(res, `该时间段会议室临时关闭${reason}`, 409);
            }

            // 创建预约
            const booking = new Booking({
                roomId,
                conferenceRoomName: room.name,
                userId: targetUser ? targetUser._id : admin._id,
                userName: contactName,
                userPhone: contactPhone,
                bookingDate: bookingDateObj,
                startTime,
                endTime,
                topic,
                attendeesCount,
                status: 'booked',
                isManualBooking: true
            });

            await booking.save();

            return ResponseHelper.success(res, {
                id: booking._id,
                roomId: booking.roomId,
                conferenceRoomName: booking.conferenceRoomName,
                bookingDate: TimeHelper.formatDate(booking.bookingDate),
                startTime: booking.startTime,
                endTime: booking.endTime,
                topic: booking.topic,
                attendeesCount: booking.attendeesCount,
                userName: booking.userName,
                userPhone: booking.userPhone,
                status: booking.status,
                isManualBooking: booking.isManualBooking,
                createdAt: booking.createdAt
            }, '代预约成功', 201);

        } catch (error) {
            console.error('管理员代预约失败:', error);
            return ResponseHelper.serverError(res, '代预约失败', error.message);
        }
    }

    /**
     * 导出预约记录
     * GET /api/bookings/export
     */
    static async exportBookings(req, res) {
        try {
            const { format = 'excel', date, status, startDate, endDate } = req.query;

            console.log('📤 开始导出预约记录:', { format, date, status, startDate, endDate });

            // 构建查询条件
            let query = {};

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
            const exportData = bookings.map((booking, index) => ({
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
                预约状态: BookingController.getStatusText(booking.status),
                预约方式: booking.isManualBooking ? '管理员代预约' : '用户自助预约',
                创建时间: TimeHelper.formatDateTime(booking.createdAt)
            }));

            if (format === 'csv') {
                // 生成CSV
                const csv = BookingController.generateCSV(exportData);
                const filename = BookingController.generateFilename('csv', { date, status, startDate, endDate });

                res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

                return res.send('\uFEFF' + csv); // 添加BOM以支持中文
            } else {
                // 生成Excel
                const workbook = BookingController.generateExcel(exportData);
                const filename = BookingController.generateFilename('xlsx', { date, status, startDate, endDate });

                // 将Excel文件保存到临时目录
                const fs = require('fs');
                const path = require('path');
                const tempDir = path.join(__dirname, '../temp');

                // 确保临时目录存在
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                }

                // 在导出新文件前清理旧文件（超过1小时的文件）
                BookingController.cleanupOldFiles();

                const filePath = path.join(tempDir, filename);
                const XLSX = require('xlsx');
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
     * 清理旧的临时文件（在导出新文件时调用）
     */
    static cleanupOldFiles() {
        try {
            const fs = require('fs');
            const path = require('path');
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
     * 下载导出文件
     * GET /api/bookings/download/:filename
     */
    static async downloadExportFile(req, res) {
        try {
            const { filename } = req.params;
            const fs = require('fs');
            const path = require('path');

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

            // 使用encodeURIComponent编码文件名，确保HTTP头部安全
            const encodedFilename = encodeURIComponent(safeFilename);
            res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`);

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
     * 生成CSV内容
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
     */
    static generateExcel(data) {
        const XLSX = require('xlsx');

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
     * 获取状态文本
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

module.exports = BookingController;