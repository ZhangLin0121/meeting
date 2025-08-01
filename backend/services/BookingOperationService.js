const Booking = require('../models/Booking');
const ConferenceRoom = require('../models/ConferenceRoom');
const User = require('../models/User');
const ResponseHelper = require('../utils/responseHelper');
const TimeHelper = require('../utils/timeHelper');
const BookingValidationService = require('./BookingValidationService');
const config = require('../config');

/**
 * 预约操作服务
 * 处理所有预约CRUD操作相关的逻辑
 */
class BookingOperationService {

    /**
     * 创建预约
     * @param {Object} req - 请求对象
     * @param {Object} res - 响应对象
     * @returns {Promise<Object>} 响应结果
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

            // 使用验证服务进行完整验证
            const validation = await BookingValidationService.validateBookingRequest({
                roomId,
                bookingDate,
                startTime,
                endTime,
                user
            });

            if (!validation.valid) {
                return ResponseHelper.error(res, validation.message, validation.code || 400);
            }

            const { room, bookingDateObj } = validation;

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
            await this.updateUserContactInfo(user, contactName, contactPhone);

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
     * @param {Object} req - 请求对象
     * @param {Object} res - 响应对象
     * @returns {Promise<Object>} 响应结果
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
     * @param {Object} req - 请求对象
     * @param {Object} res - 响应对象
     * @returns {Promise<Object>} 响应结果
     */
    static async cancelBooking(req, res) {
        try {
            const { id } = req.params;
            const user = req.user;

            const booking = await Booking.findById(id);
            if (!booking) {
                return ResponseHelper.notFound(res, '预约记录不存在');
            }

            // 检查权限
            const permissionCheck = BookingValidationService.validateUserPermission(user, booking, 'cancel');
            if (!permissionCheck.hasPermission) {
                return ResponseHelper.forbidden(res, permissionCheck.message);
            }

            // 检查预约状态
            if (booking.status !== 'booked') {
                return ResponseHelper.error(res, '只能取消已预约状态的预约');
            }

            // 检查取消时间限制
            const cancelCheck = BookingValidationService.validateCancelTimeLimit(booking.bookingDate, booking.startTime, user);
            if (!cancelCheck.canCancel) {
                return ResponseHelper.error(res, cancelCheck.message);
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
     * @param {Object} req - 请求对象
     * @param {Object} res - 响应对象
     * @returns {Promise<Object>} 响应结果
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
     * @param {Object} req - 请求对象
     * @param {Object} res - 响应对象
     * @returns {Promise<Object>} 响应结果
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

            // 使用验证服务进行完整验证
            const validation = await BookingValidationService.validateBookingRequest({
                roomId,
                bookingDate,
                startTime,
                endTime,
                user: admin
            });

            if (!validation.valid) {
                return ResponseHelper.error(res, validation.message, validation.code || 400);
            }

            const { room, bookingDateObj } = validation;

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
     * 更新用户联系信息
     * @param {Object} user - 用户对象
     * @param {string} contactName - 联系人姓名
     * @param {string} contactPhone - 联系人电话
     * @returns {Promise<void>}
     */
    static async updateUserContactInfo(user, contactName, contactPhone) {
        try {
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
        } catch (error) {
            console.error('❌ 更新用户联系信息失败:', error);
            // 不抛出错误，因为这不是关键操作
        }
    }
}

module.exports = BookingOperationService; 