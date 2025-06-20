const ConferenceRoom = require('../models/ConferenceRoom');
const Booking = require('../models/Booking');
const TemporaryClosure = require('../models/TemporaryClosure');
const ResponseHelper = require('../utils/responseHelper');
const TimeHelper = require('../utils/timeHelper');

/**
 * 会议室控制器
 * 处理会议室相关的API请求
 */
class RoomController {

    /**
     * 获取会议室列表（带搜索和筛选）
     * GET /api/rooms
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
                    return ResponseHelper.error(res, `无效的设备类型: ${invalidEquipment.join(', ')}`, 400);
                }

                console.log('🔧 设备筛选条件:', { original: equipment, processed: equipmentArray });
                query.equipment = { $in: equipmentArray };
            }

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
                const status = await RoomController.getRoomAvailabilityStatus(room._id, today);

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
     * GET /api/rooms/:id
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
            const startOfDay = TimeHelper.getStartOfDay(queryDate);
            const endOfDay = TimeHelper.getEndOfDay(queryDate);

            // 检查是否为工作日 - 现已开放周末预约，所以注释掉工作日限制
            // if (!TimeHelper.isWorkday(queryDate)) {
            //     return ResponseHelper.success(res, {
            //         ...room.toJSON(),
            //         queryDate: TimeHelper.formatDate(queryDate),
            //         isWorkday: false,
            //         timeSlots: [],
            //         message: '非工作日，会议室不开放'
            //     }, '获取会议室详情成功');
            // }

            // 获取该会议室在指定日期的所有预约
            const bookings = await Booking.find({
                roomId: id,
                bookingDate: {
                    $gte: startOfDay,
                    $lte: endOfDay
                },
                status: 'booked'
            }).sort({ startTime: 1 });

            // 获取临时关闭信息
            const closures = await TemporaryClosure.find({
                roomId: id,
                closureDate: {
                    $gte: startOfDay,
                    $lte: endOfDay
                }
            });

            // 生成时间段信息
            const timeSlots = RoomController.generateTimeSlots(bookings, closures, queryDate);

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
     * GET /api/rooms/:id/availability
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
            const startOfDay = TimeHelper.getStartOfDay(queryDate);
            const endOfDay = TimeHelper.getEndOfDay(queryDate);

            // 检查是否为工作日 - 现已开放周末预约，所以注释掉工作日限制
            // if (!TimeHelper.isWorkday(queryDate)) {
            //     return ResponseHelper.success(res, {
            //         date: TimeHelper.formatDate(queryDate),
            //         isWorkday: false,
            //         timeSlots: [],
            //         temporaryClosures: [],
            //         message: '非工作日，会议室不开放'
            //     }, '获取会议室可用性成功');
            // }

            // 获取该会议室在指定日期的所有预约
            const bookings = await Booking.find({
                roomId: id,
                bookingDate: {
                    $gte: startOfDay,
                    $lte: endOfDay
                },
                status: 'booked'
            }).sort({ startTime: 1 });

            // 获取临时关闭信息
            const closures = await TemporaryClosure.find({
                roomId: id,
                closureDate: {
                    $gte: startOfDay,
                    $lte: endOfDay
                }
            });

            // 生成时间段信息
            const timeSlots = RoomController.generateTimeSlots(bookings, closures, queryDate);

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
     * 创建会议室（管理员权限）
     * POST /api/rooms
     */
    static async createRoom(req, res) {
        try {
            const { roomId, name, capacity, location, equipment, description } = req.body;

            // 检查roomId是否已存在
            const existingRoom = await ConferenceRoom.findOne({ roomId });
            if (existingRoom) {
                return ResponseHelper.error(res, '会议室ID已存在', 409);
            }

            // 创建新会议室
            const room = new ConferenceRoom({
                roomId,
                name,
                capacity,
                location,
                equipment: equipment || [],
                description: description || ''
            });

            await room.save();

            return ResponseHelper.success(res, {
                id: room._id,
                roomId: room.roomId,
                name: room.name,
                capacity: room.capacity,
                location: room.location,
                equipment: room.equipment,
                description: room.description,
                images: room.images
            }, '创建会议室成功', 201);

        } catch (error) {
            console.error('创建会议室失败:', error);
            return ResponseHelper.serverError(res, '创建会议室失败', error.message);
        }
    }

    /**
     * 更新会议室信息（管理员权限）
     * PUT /api/rooms/:id
     */
    static async updateRoom(req, res) {
        try {
            const { id } = req.params;
            const updates = req.body;

            console.log('🔧 更新会议室请求:', {
                roomId: id,
                updates: updates,
                hasImages: !!updates.images,
                imagesLength: updates.images ? updates.images.length : 0
            });

            const room = await ConferenceRoom.findById(id);
            if (!room) {
                return ResponseHelper.notFound(res, '会议室不存在');
            }

            console.log('📋 更新前会议室数据:', {
                name: room.name,
                images: room.images
            });

            // 如果更新roomId，检查是否与其他会议室冲突
            if (updates.roomId && updates.roomId !== room.roomId) {
                const existingRoom = await ConferenceRoom.findOne({ roomId: updates.roomId });
                if (existingRoom) {
                    return ResponseHelper.error(res, '会议室ID已存在', 409);
                }
            }

            // 更新字段
            Object.keys(updates).forEach(key => {
                if (updates[key] !== undefined) {
                    console.log(`📝 更新字段 ${key}:`, updates[key]);
                    room[key] = updates[key];
                }
            });

            await room.save();

            console.log('✅ 更新后会议室数据:', {
                name: room.name,
                images: room.images
            });

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
                lastModified: room.updatedAt || room.createdAt,
                _timestamp: timestamp
            }, '更新会议室成功');

        } catch (error) {
            console.error('更新会议室失败:', error);
            return ResponseHelper.serverError(res, '更新会议室失败', error.message);
        }
    }

    /**
     * 删除会议室（管理员权限）
     * DELETE /api/rooms/:id
     */
    static async deleteRoom(req, res) {
        try {
            const { id } = req.params;

            const room = await ConferenceRoom.findById(id);
            if (!room) {
                return ResponseHelper.notFound(res, '会议室不存在');
            }

            // 检查是否有未来的预约
            const now = new Date();
            const futureBookings = await Booking.countDocuments({
                roomId: id,
                $or: [
                    { bookingDate: { $gt: now } },
                    {
                        bookingDate: { $gte: TimeHelper.getStartOfDay(now) },
                        startTime: { $gt: TimeHelper.now().format('HH:mm') }
                    }
                ],
                status: 'booked'
            });

            if (futureBookings > 0) {
                return ResponseHelper.error(res, '该会议室还有未来的预约记录，无法删除', 409);
            }

            await ConferenceRoom.findByIdAndDelete(id);

            return ResponseHelper.success(res, null, '删除会议室成功');

        } catch (error) {
            console.error('删除会议室失败:', error);
            return ResponseHelper.serverError(res, '删除会议室失败', error.message);
        }
    }

    /**
     * 生成时间段信息
     * @param {Array} bookings 预约记录
     * @param {Array} closures 临时关闭记录
     * @param {Date} queryDate 查询日期，用于检查过去时间
     * @returns {Array} 时间段数组
     */
    static generateTimeSlots(bookings, closures, queryDate) {
        console.log('🔍 生成时间段信息，预约记录:', bookings.map(b => ({
            startTime: b.startTime,
            endTime: b.endTime,
            topic: b.topic
        })));
        const config = require('../config');
        const slots = [];

        // 定义时间段配置 - 修正为用户要求的时间点
        const timeSlotConfigs = [
            // 上午时段：08:30 09:00 09:30 10:00 10:30 11:00 11:30 12:00
            { startTime: '08:30', endTime: '09:00', period: 'morning' },
            { startTime: '09:00', endTime: '09:30', period: 'morning' },
            { startTime: '09:30', endTime: '10:00', period: 'morning' },
            { startTime: '10:00', endTime: '10:30', period: 'morning' },
            { startTime: '10:30', endTime: '11:00', period: 'morning' },
            { startTime: '11:00', endTime: '11:30', period: 'morning' },
            { startTime: '11:30', endTime: '12:00', period: 'morning' },

            // 中午时段：12:00 12:30 13:00 13:30 14:00 14:30
            { startTime: '12:00', endTime: '12:30', period: 'noon' },
            { startTime: '12:30', endTime: '13:00', period: 'noon' },
            { startTime: '13:00', endTime: '13:30', period: 'noon' },
            { startTime: '13:30', endTime: '14:00', period: 'noon' },
            { startTime: '14:00', endTime: '14:30', period: 'noon' },

            // 下午时段：14:30 一直到 22:00 (30分钟间隔)
            { startTime: '14:30', endTime: '15:00', period: 'afternoon' },
            { startTime: '15:00', endTime: '15:30', period: 'afternoon' },
            { startTime: '15:30', endTime: '16:00', period: 'afternoon' },
            { startTime: '16:00', endTime: '16:30', period: 'afternoon' },
            { startTime: '16:30', endTime: '17:00', period: 'afternoon' },
            { startTime: '17:00', endTime: '17:30', period: 'afternoon' },
            { startTime: '17:30', endTime: '18:00', period: 'afternoon' },
            { startTime: '18:00', endTime: '18:30', period: 'afternoon' },
            { startTime: '18:30', endTime: '19:00', period: 'afternoon' },
            { startTime: '19:00', endTime: '19:30', period: 'afternoon' },
            { startTime: '19:30', endTime: '20:00', period: 'afternoon' },
            { startTime: '20:00', endTime: '20:30', period: 'afternoon' },
            { startTime: '20:30', endTime: '21:00', period: 'afternoon' },
            { startTime: '21:00', endTime: '21:30', period: 'afternoon' },
            { startTime: '21:30', endTime: '22:00', period: 'afternoon' }
        ];

        // 为每个时间槽检查预约状态
        timeSlotConfigs.forEach(slotConfig => {
            const startMinutes = TimeHelper.timeToMinutes(slotConfig.startTime);
            const endMinutes = TimeHelper.timeToMinutes(slotConfig.endTime);

            // 检查是否被预约
            const isBooked = bookings.some(booking => {
                const bookingStart = TimeHelper.timeToMinutes(booking.startTime);
                const bookingEnd = TimeHelper.timeToMinutes(booking.endTime);
                // 检查时间槽是否与预约时间有重叠
                const hasOverlap = startMinutes < bookingEnd && endMinutes > bookingStart;
                return hasOverlap;
            });

            // 检查是否临时关闭
            const isClosed = closures.some(closure => {
                if (closure.isAllDay) return true;
                const closureStart = TimeHelper.timeToMinutes(closure.startTime);
                const closureEnd = TimeHelper.timeToMinutes(closure.endTime);
                return startMinutes >= closureStart && startMinutes < closureEnd;
            });

            // 检查是否为过去的时间（只有查询今天时才需要检查）
            const isPastTime = queryDate && TimeHelper.isPastTime(queryDate, slotConfig.startTime);

            let status = 'available';
            if (isClosed) {
                status = 'closed';
            } else if (isBooked) {
                status = 'booked';
            } else if (isPastTime) {
                status = 'past'; // 过去的时间段标记为不可用
            }

            slots.push({
                startTime: slotConfig.startTime,
                endTime: slotConfig.endTime,
                status,
                period: slotConfig.period
            });
        });

        return slots;
    }

    /**
     * 获取会议室月份可用性概览
     * GET /api/rooms/:id/availability/month
     */
    static async getMonthAvailability(req, res) {
        try {
            const { id } = req.params;
            const { year, month } = req.query;

            // 验证参数
            if (!year || !month) {
                return ResponseHelper.error(res, '请提供年份和月份参数', 400);
            }

            const queryYear = parseInt(year);
            const queryMonth = parseInt(month);

            if (queryYear < 2020 || queryYear > 2030 || queryMonth < 1 || queryMonth > 12) {
                return ResponseHelper.error(res, '年份或月份参数无效', 400);
            }

            console.log('📅 获取月份可用性:', { roomId: id, year: queryYear, month: queryMonth });

            // 检查会议室是否存在
            const room = await ConferenceRoom.findById(id);
            if (!room) {
                return ResponseHelper.notFound(res, '会议室不存在');
            }

            // 获取该月的第一天和最后一天
            const firstDay = new Date(queryYear, queryMonth - 1, 1);
            const lastDay = new Date(queryYear, queryMonth, 0);

            console.log('📅 查询日期范围:', {
                firstDay: firstDay.toISOString(),
                lastDay: lastDay.toISOString()
            });

            // 获取整个月的预约数据
            const monthBookings = await Booking.find({
                roomId: id,
                bookingDate: {
                    $gte: TimeHelper.getStartOfDay(firstDay),
                    $lte: TimeHelper.getEndOfDay(lastDay)
                },
                status: 'booked'
            }).sort({ bookingDate: 1, startTime: 1 });

            // 获取整个月的临时关闭数据
            const monthClosures = await TemporaryClosure.find({
                roomId: id,
                closureDate: {
                    $gte: TimeHelper.getStartOfDay(firstDay),
                    $lte: TimeHelper.getEndOfDay(lastDay)
                }
            });

            // 为每一天计算可用性状态
            const dailyAvailability = {};
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            for (let day = 1; day <= lastDay.getDate(); day++) {
                const currentDate = new Date(queryYear, queryMonth - 1, day);
                const dateKey = `${queryYear}-${String(queryMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

                // 检查是否为过去的日期
                if (currentDate < today) {
                    dailyAvailability[dateKey] = {
                        morning: 'past',
                        noon: 'past',
                        afternoon: 'past'
                    };
                    continue;
                }

                // 获取当天的预约和关闭记录
                const dayBookings = monthBookings.filter(booking => {
                    const bookingDate = new Date(booking.bookingDate);
                    return bookingDate.getDate() === day &&
                        bookingDate.getMonth() === queryMonth - 1 &&
                        bookingDate.getFullYear() === queryYear;
                });

                const dayClosures = monthClosures.filter(closure => {
                    const closureDate = new Date(closure.closureDate);
                    return closureDate.getDate() === day &&
                        closureDate.getMonth() === queryMonth - 1 &&
                        closureDate.getFullYear() === queryYear;
                });

                // 生成时间段并分析可用性
                const timeSlots = this.generateTimeSlots(dayBookings, dayClosures, currentDate);

                // 按时段分组分析
                const periodStatus = {
                    morning: this.analyzePeriodStatus(timeSlots, 'morning'),
                    noon: this.analyzePeriodStatus(timeSlots, 'noon'),
                    afternoon: this.analyzePeriodStatus(timeSlots, 'afternoon')
                };

                dailyAvailability[dateKey] = periodStatus;
            }

            console.log('📊 月份可用性计算完成:', Object.keys(dailyAvailability).length, '天');

            return ResponseHelper.success(res, dailyAvailability, '获取月份可用性成功');

        } catch (error) {
            console.error('获取月份可用性失败:', error);
            return ResponseHelper.serverError(res, '获取月份可用性失败', error.message);
        }
    }

    /**
     * 分析时段状态
     */
    static analyzePeriodStatus(timeSlots, period) {
        const periodSlots = timeSlots.filter(slot => slot.period === period);

        if (periodSlots.length === 0) {
            return 'available';
        }

        const availableCount = periodSlots.filter(slot => slot.status === 'available').length;
        const totalCount = periodSlots.length;

        if (availableCount === 0) {
            return 'unavailable';
        } else if (availableCount === totalCount) {
            return 'available';
        } else {
            return 'partial';
        }
    }

    /**
     * 获取会议室在指定日期的可用性状态
     * @param {string} roomId 会议室ID
     * @param {Date} date 日期
     * @returns {Object} 可用性状态
     */
    static async getRoomAvailabilityStatus(roomId, date) {
        try {
            const startOfDay = TimeHelper.getStartOfDay(date);
            const endOfDay = TimeHelper.getEndOfDay(date);

            // 检查是否为工作日 - 现已开放周末预约，所以注释掉工作日限制
            // if (!TimeHelper.isWorkday(date)) {
            //     return { availability: 'unavailable', reason: 'non_workday' };
            // }

            // 检查是否全天临时关闭
            const allDayClosure = await TemporaryClosure.findOne({
                roomId,
                closureDate: { $gte: startOfDay, $lte: endOfDay },
                isAllDay: true
            });

            if (allDayClosure) {
                return { availability: 'unavailable', reason: 'all_day_closure' };
            }

            // 获取所有预约和部分时间关闭
            const bookings = await Booking.find({
                roomId,
                bookingDate: { $gte: startOfDay, $lte: endOfDay },
                status: 'booked'
            });

            const partialClosures = await TemporaryClosure.find({
                roomId,
                closureDate: { $gte: startOfDay, $lte: endOfDay },
                isAllDay: false
            });

            // 检查是否完全被预约或关闭
            const timeSlots = this.generateTimeSlots(bookings, partialClosures, date);
            const availableSlots = timeSlots.filter(slot => slot.status === 'available');

            return {
                availability: availableSlots.length > 0 ? 'available' : 'full',
                availableSlots: availableSlots.length
            };

        } catch (error) {
            console.error('检查会议室可用性失败:', error);
            return { availability: 'unknown', reason: 'error' };
        }
    }
}

module.exports = RoomController;