const ConferenceRoom = require('../models/ConferenceRoom');
const Booking = require('../models/Booking');
const TemporaryClosure = require('../models/TemporaryClosure');
const ResponseHelper = require('../utils/responseHelper');
const TimeHelper = require('../utils/timeHelper');

/**
 * 会议室查询服务
 * 处理所有会议室查询相关的逻辑
 */
class RoomQueryService {

    /**
     * 获取会议室列表（带搜索和筛选）
     * @param {Object} req - 请求对象
     * @param {Object} res - 响应对象
     * @returns {Promise<Object>} 响应结果
     */
    static async getRooms(req, res) {
        try {
            const {
                search = '',
                capacityMin,
                capacityMax,
                equipment,
                page = 1,
                limit = 10
            } = req.query;

            // 构建查询条件
            const query = this.buildRoomQuery({ search, capacityMin, capacityMax, equipment });

            // 分页
            const skip = (page - 1) * limit;

            // 查询数据 - 从数据库获取最新数据
            const rooms = await ConferenceRoom.find(query)
                .sort({ name: 1 }) // 按名称字母顺序排序
                .skip(skip)
                .limit(parseInt(limit));

            const total = await ConferenceRoom.countDocuments(query);

            // 获取今天的日期，用于检查空闲状态
            const today = TimeHelper.getStartOfDay(new Date());

            // 为每个会议室添加今日空闲状态
            const roomsWithStatus = await Promise.all(rooms.map(async(room) => {
                const status = await this.getRoomAvailabilityStatus(room._id, today);

                // 为图片URL添加时间戳，防止缓存问题
                const timestamp = Date.now();
                const images = room.images.length > 0 ? [room.images[0] + (room.images[0].includes('?') ? '&' : '?') + `t=${timestamp}`] : [];

                return {
                    id: room._id,
                    roomId: room.roomId,
                    name: room.name,
                    capacity: room.capacity,
                    location: room.location,
                    equipment: room.equipment,
                    description: room.description,
                    images: images, // 带时间戳的图片URL
                    availability: status.availability,
                    availabilityText: status.availability === 'available' ? '可预约' : '已约满',
                    lastModified: room.updatedAt || room.createdAt, // 添加最后修改时间
                    _timestamp: timestamp // 添加时间戳用于调试
                };
            }));

            return ResponseHelper.paginated(res, roomsWithStatus, {
                page: parseInt(page),
                limit: parseInt(limit),
                total
            }, '获取会议室列表成功');

        } catch (error) {
            console.error('获取会议室列表失败:', error);
            return ResponseHelper.serverError(res, '获取会议室列表失败', error.message);
        }
    }

    /**
     * 获取会议室详情
     * @param {Object} req - 请求对象
     * @param {Object} res - 响应对象
     * @returns {Promise<Object>} 响应结果
     */
    static async getRoomDetail(req, res) {
        try {
            const { id } = req.params;
            const { date } = req.query; // 可选的日期参数，默认为今天

            console.log('🔍 获取会议室详情请求:', {
                id: id,
                idType: typeof id,
                idLength: id ? id.length : 0,
                date: date,
                headers: req.headers['x-user-openid'] || req.headers['X-User-Openid']
            });

            // 从数据库获取会议室数据
            const room = await ConferenceRoom.findById(id);

            console.log('🏢 数据库查询结果:', {
                found: !!room,
                roomId: room ? room._id : null,
                roomName: room ? room.name : null
            });

            if (!room) {
                console.log('❌ 会议室不存在，ID:', id);
                return ResponseHelper.notFound(res, '会议室不存在');
            }

            // 解析查询日期，默认为今天
            const queryDate = date ? new Date(date) : new Date();
            const { timeSlots, bookings, closures } = await this.getRoomDayInfo(id, queryDate);

            // 为图片URL添加时间戳，防止缓存问题
            const timestamp = Date.now();
            const images = room.images.map(img =>
                img + (img.includes('?') ? '&' : '?') + `t=${timestamp}`
            );

            return ResponseHelper.success(res, {
                id: room._id,
                roomId: room.roomId,
                name: room.name,
                capacity: room.capacity,
                location: room.location,
                equipment: room.equipment,
                description: room.description,
                images: images, // 带时间戳的图片URL
                queryDate: TimeHelper.formatDate(queryDate),
                isWorkday: TimeHelper.isWorkday(queryDate), // 保留工作日标识，但不限制预约
                timeSlots,
                bookings: bookings.map(booking => ({
                    id: booking._id,
                    startTime: booking.startTime,
                    endTime: booking.endTime,
                    topic: booking.topic,
                    userName: booking.userName,
                    attendeesCount: booking.attendeesCount
                })),
                lastModified: room.updatedAt || room.createdAt, // 添加最后修改时间
                _timestamp: timestamp // 添加时间戳用于调试
            }, '获取会议室详情成功');

        } catch (error) {
            console.error('获取会议室详情失败:', error);
            return ResponseHelper.serverError(res, '获取会议室详情失败', error.message);
        }
    }

    /**
     * 获取会议室指定日期的可用性
     * @param {Object} req - 请求对象
     * @param {Object} res - 响应对象
     * @returns {Promise<Object>} 响应结果
     */
    static async getRoomAvailability(req, res) {
        try {
            const { id } = req.params;
            const { date } = req.query; // 必需的日期参数

            if (!date) {
                return ResponseHelper.error(res, '缺少日期参数', 400);
            }

            // 从数据库获取会议室数据
            const room = await ConferenceRoom.findById(id);
            if (!room) {
                return ResponseHelper.notFound(res, '会议室不存在');
            }

            // 解析查询日期
            const queryDate = new Date(date);
            const { timeSlots, closures } = await this.getRoomDayInfo(id, queryDate);

            return ResponseHelper.success(res, {
                date: TimeHelper.formatDate(queryDate),
                isWorkday: TimeHelper.isWorkday(queryDate), // 保留工作日标识，但不限制预约
                timeSlots,
                temporaryClosures: closures.map(closure => ({
                    startTime: closure.startTime,
                    endTime: closure.endTime,
                    reason: closure.reason,
                    isAllDay: closure.isAllDay
                }))
            }, '获取会议室可用性成功');

        } catch (error) {
            console.error('获取会议室可用性失败:', error);
            return ResponseHelper.serverError(res, '获取会议室可用性失败', error.message);
        }
    }

    /**
     * 获取会议室月度可用性
     * @param {Object} req - 请求对象
     * @param {Object} res - 响应对象
     * @returns {Promise<Object>} 响应结果
     */
    static async getRoomMonthlyAvailability(req, res) {
        try {
            const { id } = req.params;
            const { year, month } = req.query;

            if (!year || !month) {
                return ResponseHelper.error(res, '缺少年份或月份参数', 400);
            }

            // 验证会议室存在
            const room = await ConferenceRoom.findById(id);
            if (!room) {
                return ResponseHelper.notFound(res, '会议室不存在');
            }

            // 计算月份的开始和结束日期
            const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
            const endDate = new Date(parseInt(year), parseInt(month), 0); // 获取月份的最后一天

            console.log('📅 查询月度可用性:', {
                roomId: id,
                year: year,
                month: month,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString()
            });

            // 获取该月份所有预约
            const bookings = await Booking.find({
                roomId: id,
                bookingDate: {
                    $gte: TimeHelper.getStartOfDay(startDate),
                    $lte: TimeHelper.getEndOfDay(endDate)
                },
                status: 'booked'
            });

            // 获取该月份所有临时关闭
            const closures = await TemporaryClosure.find({
                roomId: id,
                closureDate: {
                    $gte: TimeHelper.getStartOfDay(startDate),
                    $lte: TimeHelper.getEndOfDay(endDate)
                }
            });

            // 生成每日可用性状态
            const dailyAvailability = {};
            const currentDate = new Date(startDate);

            while (currentDate <= endDate) {
                const dateStr = TimeHelper.formatDate(currentDate);
                const dayBookings = bookings.filter(booking => 
                    TimeHelper.formatDate(booking.bookingDate) === dateStr
                );
                const dayClosures = closures.filter(closure => 
                    TimeHelper.formatDate(closure.closureDate) === dateStr
                );

                // 检查是否全天关闭
                const isAllDayClosed = dayClosures.some(closure => closure.isAllDay);

                if (isAllDayClosed) {
                    dailyAvailability[dateStr] = 'closed';
                } else if (dayBookings.length === 0 && dayClosures.length === 0) {
                    dailyAvailability[dateStr] = 'available';
                } else {
                    // 需要详细检查时间段
                    const RoomAvailabilityService = require('./RoomAvailabilityService');
                    const timeSlots = RoomAvailabilityService.generateTimeSlots(dayBookings, dayClosures, currentDate);
                    const hasAvailableSlots = timeSlots.some(slot => slot.status === 'available');
                    dailyAvailability[dateStr] = hasAvailableSlots ? 'partial' : 'booked';
                }

                currentDate.setDate(currentDate.getDate() + 1);
            }

            return ResponseHelper.success(res, {
                roomId: room.roomId,
                roomName: room.name,
                year: parseInt(year),
                month: parseInt(month),
                dailyAvailability: dailyAvailability
            }, '获取月度可用性成功');

        } catch (error) {
            console.error('获取月度可用性失败:', error);
            return ResponseHelper.serverError(res, '获取月度可用性失败', error.message);
        }
    }

    /**
     * 构建会议室查询条件
     * @param {Object} filters - 筛选条件
     * @returns {Object} 查询条件
     */
    static buildRoomQuery(filters) {
        const { search, capacityMin, capacityMax, equipment } = filters;
        const query = {};

        // 文本搜索
        if (search) {
            query.$text = { $search: search };
        }

        // 容纳人数筛选
        if (capacityMin || capacityMax) {
            query.capacity = {};
            if (capacityMin) query.capacity.$gte = parseInt(capacityMin);
            if (capacityMax) query.capacity.$lte = parseInt(capacityMax);
        }

        // 设备筛选
        if (equipment && equipment.length > 0) {
            const equipmentArray = Array.isArray(equipment) ? equipment : [equipment];

            // 验证设备类型是否有效
            const validEquipment = ['投屏设备', '麦克风', '音响系统', '白板', '电子白板', '视频会议设备', '网络接口/Wi-Fi', '空调', '电话'];
            const invalidEquipment = equipmentArray.filter(eq => !validEquipment.includes(eq));

            if (invalidEquipment.length > 0) {
                throw new Error(`无效的设备类型: ${invalidEquipment.join(', ')}`);
            }

            console.log('🔧 设备筛选条件:', { original: equipment, processed: equipmentArray });
            query.equipment = { $in: equipmentArray };
        }

        return query;
    }

    /**
     * 获取会议室某日的详细信息
     * @param {string} roomId - 会议室ID
     * @param {Date} queryDate - 查询日期
     * @returns {Promise<Object>} 包含时间段、预约和关闭信息
     */
    static async getRoomDayInfo(roomId, queryDate) {
        const startOfDay = TimeHelper.getStartOfDay(queryDate);
        const endOfDay = TimeHelper.getEndOfDay(queryDate);

        // 获取该会议室在指定日期的所有预约
        const bookings = await Booking.find({
            roomId: roomId,
            bookingDate: {
                $gte: startOfDay,
                $lte: endOfDay
            },
            status: 'booked'
        }).sort({ startTime: 1 });

        // 获取临时关闭信息
        const closures = await TemporaryClosure.find({
            roomId: roomId,
            closureDate: {
                $gte: startOfDay,
                $lte: endOfDay
            }
        });

        // 生成时间段信息
        const RoomAvailabilityService = require('./RoomAvailabilityService');
        const timeSlots = RoomAvailabilityService.generateTimeSlots(bookings, closures, queryDate);

        return { timeSlots, bookings, closures };
    }

    /**
     * 获取会议室可用性状态
     * @param {string} roomId - 会议室ID
     * @param {Date} date - 日期
     * @returns {Promise<Object>} 可用性状态
     */
    static async getRoomAvailabilityStatus(roomId, date) {
        try {
            const startOfDay = TimeHelper.getStartOfDay(date);
            const endOfDay = TimeHelper.getEndOfDay(date);

            // 检查是否有全天临时关闭
            const allDayClosure = await TemporaryClosure.findOne({
                roomId: roomId,
                closureDate: {
                    $gte: startOfDay,
                    $lte: endOfDay
                },
                isAllDay: true
            });

            if (allDayClosure) {
                return {
                    availability: 'closed',
                    reason: '临时关闭'
                };
            }

            // 获取当天所有预约
            const bookings = await Booking.find({
                roomId: roomId,
                bookingDate: {
                    $gte: startOfDay,
                    $lte: endOfDay
                },
                status: 'booked'
            });

            // 获取部分时间关闭
            const partialClosures = await TemporaryClosure.find({
                roomId: roomId,
                closureDate: {
                    $gte: startOfDay,
                    $lte: endOfDay
                },
                isAllDay: false
            });

            // 生成时间段检查可用性
            const RoomAvailabilityService = require('./RoomAvailabilityService');
            const timeSlots = RoomAvailabilityService.generateTimeSlots(bookings, partialClosures, date);
            const hasAvailableSlots = timeSlots.some(slot => slot.status === 'available');

            return {
                availability: hasAvailableSlots ? 'available' : 'booked'
            };

        } catch (error) {
            console.error('获取会议室可用性状态失败:', error);
            return {
                availability: 'unknown',
                reason: '查询失败'
            };
        }
    }
}

module.exports = RoomQueryService; 