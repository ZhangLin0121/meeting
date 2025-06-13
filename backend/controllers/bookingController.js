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

            // 验证是否为工作日 - 现已开放周末预约
            // if (!TimeHelper.isWorkday(bookingDate)) {
            //     return ResponseHelper.error(res, '只能预约工作日的会议室');
            // }

            // 验证时间是否在办公时间内
            if (!TimeHelper.isOfficeTime(startTime) || !TimeHelper.isOfficeTime(endTime)) {
                return ResponseHelper.error(res, '预约时间必须在办公时间内');
            }

            // 验证是否跨越午休时间
            if (TimeHelper.isAcrossLunchBreak(startTime, endTime)) {
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
                .sort({ bookingDate: -1, startTime: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('roomId', 'name location');

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

            if (!TimeHelper.isOfficeTime(startTime) || !TimeHelper.isOfficeTime(endTime)) {
                return ResponseHelper.error(res, '预约时间必须在办公时间内');
            }

            if (TimeHelper.isAcrossLunchBreak(startTime, endTime)) {
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
}

module.exports = BookingController;