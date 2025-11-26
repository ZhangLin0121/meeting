const ConferenceRoom = require('../models/ConferenceRoom');
const Booking = require('../models/Booking');
const ResponseHelper = require('../utils/responseHelper');
const TimeHelper = require('../utils/timeHelper');

/**
 * 会议室管理服务
 * 处理所有会议室管理相关的逻辑
 */
class RoomManagementService {
    /**
     * 生成会议室ID（后端自动生成，避免前端手填）
     * @param {string} name 会议室名称
     * @returns {string} 生成的唯一ID
     */
    static generateRoomId(name = '') {
        // 基于时间戳与随机数，附加 ASCII 名称片段，避免外部依赖
        const ts = Date.now().toString(36);
        const rand = Math.random().toString(36).slice(2, 6);
        const namePart = (name || 'room').replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
        return `rm-${namePart || 'room'}-${ts}-${rand}`.toLowerCase();
    }

    /**
     * 创建会议室（管理员权限）
     * @param {Object} req - 请求对象
     * @param {Object} res - 响应对象
     * @returns {Promise<Object>} 响应结果
     */
    static async createRoom(req, res) {
        try {
            let { roomId, name, capacity, location, equipment, description, images } = req.body;

            // 生成或校验 roomId
            if (!roomId) {
                roomId = this.generateRoomId(name);
            } else {
                roomId = String(roomId).trim();
            }

            // 确保唯一
            const existingRoom = await ConferenceRoom.findOne({ roomId });
            if (existingRoom) {
                return ResponseHelper.error(res, '会议室ID已存在', 409);
            }

            // 规范字段
            const safeEquipment = Array.isArray(equipment) ? equipment : [];
            const safeImages = Array.isArray(images) ? images : [];

            // 创建新会议室
            const room = new ConferenceRoom({
                roomId,
                name,
                capacity,
                location,
                equipment: safeEquipment,
                description: description || '',
                images: safeImages
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
     * @param {Object} req - 请求对象
     * @param {Object} res - 响应对象
     * @returns {Promise<Object>} 响应结果
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
     * @param {Object} req - 请求对象
     * @param {Object} res - 响应对象
     * @returns {Promise<Object>} 响应结果
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
     * 验证会议室数据
     * @param {Object} roomData - 会议室数据
     * @returns {Object} 验证结果
     */
    static validateRoomData(roomData) {
        const required = ['roomId', 'name', 'capacity', 'location'];
        const missing = required.filter(field => !roomData[field]);

        if (missing.length > 0) {
            return {
                valid: false,
                message: `缺少必填字段: ${missing.join(', ')}`
            };
        }

        // 验证容量
        if (roomData.capacity && (roomData.capacity < 1 || roomData.capacity > 1000)) {
            return {
                valid: false,
                message: '会议室容量应在1-1000人之间'
            };
        }

        // 验证设备类型
        if (roomData.equipment && Array.isArray(roomData.equipment)) {
            const validEquipment = ['投屏设备', '麦克风', '音响系统', '白板', '电子白板', '视频会议设备', '网络接口/Wi-Fi', '空调', '电话', '饮水设备'];
            const invalidEquipment = roomData.equipment.filter(eq => !validEquipment.includes(eq));

            if (invalidEquipment.length > 0) {
                return {
                    valid: false,
                    message: `无效的设备类型: ${invalidEquipment.join(', ')}`
                };
            }
        }

        return { valid: true };
    }

    /**
     * 格式化会议室响应数据
     * @param {Object} room - 会议室对象
     * @param {Object} options - 格式化选项
     * @returns {Object} 格式化后的数据
     */
    static formatRoomResponse(room, options = {}) {
        const timestamp = Date.now();
        
        // 为图片URL添加时间戳，防止缓存问题
        const images = room.images.map(img =>
            img + (img.includes('?') ? '&' : '?') + `t=${timestamp}`
        );

        const formatted = {
            id: room._id,
            roomId: room.roomId,
            name: room.name,
            capacity: room.capacity,
            location: room.location,
            equipment: room.equipment,
            description: room.description,
            images: images,
            lastModified: room.updatedAt || room.createdAt,
            _timestamp: timestamp
        };

        // 可选字段
        if (options.includeAvailability) {
            formatted.availability = options.availability;
            formatted.availabilityText = options.availability === 'available' ? '可预约' : '已约满';
        }

        if (options.includeStats) {
            formatted.stats = options.stats;
        }

        return formatted;
    }

    /**
     * 批量更新会议室
     * @param {Array} roomUpdates - 会议室更新数组
     * @returns {Promise<Object>} 更新结果
     */
    static async batchUpdateRooms(roomUpdates) {
        const results = {
            success: [],
            failed: [],
            total: roomUpdates.length
        };

        for (const update of roomUpdates) {
            try {
                const { id, ...updateData } = update;
                
                const room = await ConferenceRoom.findById(id);
                if (!room) {
                    results.failed.push({
                        id: id,
                        error: '会议室不存在'
                    });
                    continue;
                }

                // 验证数据
                const validation = this.validateRoomData(updateData);
                if (!validation.valid) {
                    results.failed.push({
                        id: id,
                        error: validation.message
                    });
                    continue;
                }

                // 更新字段
                Object.keys(updateData).forEach(key => {
                    if (updateData[key] !== undefined) {
                        room[key] = updateData[key];
                    }
                });

                await room.save();
                results.success.push({
                    id: id,
                    roomId: room.roomId,
                    name: room.name
                });

            } catch (error) {
                results.failed.push({
                    id: update.id,
                    error: error.message
                });
            }
        }

        return results;
    }

    /**
     * 检查会议室名称是否唯一
     * @param {string} name - 会议室名称
     * @param {string} excludeId - 排除的会议室ID（用于更新时）
     * @returns {Promise<boolean>} 是否唯一
     */
    static async isRoomNameUnique(name, excludeId = null) {
        const query = { name: name };
        if (excludeId) {
            query._id = { $ne: excludeId };
        }

        const existingRoom = await ConferenceRoom.findOne(query);
        return !existingRoom;
    }

    /**
     * 获取会议室使用统计
     * @param {string} roomId - 会议室ID
     * @param {Date} startDate - 开始日期
     * @param {Date} endDate - 结束日期
     * @returns {Promise<Object>} 使用统计
     */
    static async getRoomUsageStats(roomId, startDate, endDate) {
        try {
            const bookings = await Booking.find({
                roomId: roomId,
                bookingDate: {
                    $gte: TimeHelper.getStartOfDay(startDate),
                    $lte: TimeHelper.getEndOfDay(endDate)
                },
                status: 'booked'
            });

            const stats = {
                totalBookings: bookings.length,
                totalHours: 0,
                averageDuration: 0,
                peakHours: {},
                dailyUsage: {}
            };

            bookings.forEach(booking => {
                // 计算时长
                const startMinutes = TimeHelper.timeToMinutes(booking.startTime);
                const endMinutes = TimeHelper.timeToMinutes(booking.endTime);
                const duration = endMinutes - startMinutes;
                stats.totalHours += duration / 60;

                // 统计高峰时段
                const hour = Math.floor(startMinutes / 60);
                stats.peakHours[hour] = (stats.peakHours[hour] || 0) + 1;

                // 统计每日使用情况
                const dateStr = TimeHelper.formatDate(booking.bookingDate);
                if (!stats.dailyUsage[dateStr]) {
                    stats.dailyUsage[dateStr] = {
                        bookings: 0,
                        hours: 0
                    };
                }
                stats.dailyUsage[dateStr].bookings += 1;
                stats.dailyUsage[dateStr].hours += duration / 60;
            });

            // 计算平均时长
            stats.averageDuration = stats.totalBookings > 0 ? 
                Math.round((stats.totalHours / stats.totalBookings) * 60) : 0;

            // 找出最繁忙的时段
            const peakHour = Object.keys(stats.peakHours).reduce((a, b) => 
                stats.peakHours[a] > stats.peakHours[b] ? a : b, '0');
            stats.peakHour = `${peakHour}:00-${parseInt(peakHour) + 1}:00`;

            return stats;

        } catch (error) {
            console.error('获取会议室使用统计失败:', error);
            throw error;
        }
    }

    /**
     * 复制会议室
     * @param {string} sourceRoomId - 源会议室ID
     * @param {Object} newRoomData - 新会议室数据
     * @returns {Promise<Object>} 复制结果
     */
    static async duplicateRoom(sourceRoomId, newRoomData) {
        try {
            const sourceRoom = await ConferenceRoom.findById(sourceRoomId);
            if (!sourceRoom) {
                throw new Error('源会议室不存在');
            }

            // 检查新会议室ID是否已存在
            const existingRoom = await ConferenceRoom.findOne({ roomId: newRoomData.roomId });
            if (existingRoom) {
                throw new Error('新会议室ID已存在');
            }

            // 创建新会议室
            const newRoom = new ConferenceRoom({
                roomId: newRoomData.roomId,
                name: newRoomData.name || `${sourceRoom.name} (副本)`,
                capacity: newRoomData.capacity || sourceRoom.capacity,
                location: newRoomData.location || sourceRoom.location,
                equipment: newRoomData.equipment || [...sourceRoom.equipment],
                description: newRoomData.description || sourceRoom.description,
                images: [] // 不复制图片
            });

            await newRoom.save();

            return {
                success: true,
                room: this.formatRoomResponse(newRoom)
            };

        } catch (error) {
            console.error('复制会议室失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = RoomManagementService; 
