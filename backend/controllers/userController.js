const User = require('../models/User');
const Booking = require('../models/Booking');
const ResponseHelper = require('../utils/responseHelper');
const TimeHelper = require('../utils/timeHelper');
const config = require('../config');
const axios = require('axios');

/**
 * 用户控制器
 * 处理用户相关的API请求
 */
class UserController {

    /**
     * 微信小程序登录
     * POST /api/user/wechat-login
     */
    static async wechatLogin(req, res) {
        try {
            const { code, nickname, avatarUrl } = req.body;

            if (!code) {
                return ResponseHelper.error(res, '缺少微信登录code', 400);
            }

            console.log('🔐 微信登录请求:', {
                code: code.substring(0, 10) + '...',
                nickname: nickname || '未提供',
                avatarUrl: avatarUrl ? '已提供' : '未提供'
            });

            // 移除所有 MOCK 登录逻辑，始终调用微信官方接口

            // 使用code换取openid和session_key
            const wxResponse = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
                params: {
                    appid: config.wechat.appId,
                    secret: config.wechat.appSecret,
                    js_code: code,
                    grant_type: 'authorization_code'
                }
            });

            console.log('🌐 微信API响应:', wxResponse.data);

            if (wxResponse.data.errcode) {
                console.error('❌ 微信API错误:', wxResponse.data);
                return ResponseHelper.error(res, `微信登录失败: ${wxResponse.data.errmsg}`, 400);
            }

            const { openid, session_key } = wxResponse.data;

            // 查找或创建用户
            let user = await User.findOne({ openid });

            if (!user) {
                // 创建新用户
                user = new User({
                    openid,
                    nickname: nickname || '微信用户',
                    avatarUrl: avatarUrl || '',
                    role: 'employee'
                });

                await user.save();
                console.log(`✅ 新用户注册: ${openid}`);
            } else {
                // 更新用户信息
                if (nickname) user.nickname = nickname;
                if (avatarUrl) user.avatarUrl = avatarUrl;
                await user.save();
                console.log(`✅ 用户登录: ${openid}`);
            }

            return ResponseHelper.success(res, {
                id: user._id,
                openid: user.openid,
                nickname: user.nickname,
                avatarUrl: user.avatarUrl,
                role: user.role,
                contactName: user.contactName,
                contactPhone: user.contactPhone,
                company: user.company,
                department: user.department,
                isNewUser: !user.contactName || !user.contactPhone,
                sessionKey: session_key // 注意：生产环境中不应该返回session_key
            }, '登录成功');

        } catch (error) {
            console.error('❌ 微信登录失败:', error);

            if (error.code === 'ENOTFOUND') {
                return ResponseHelper.error(res, '网络连接失败，请检查网络设置', 500);
            }

            return ResponseHelper.serverError(res, '登录失败', error.message);
        }
    }

    /**
     * 获取当前用户信息
     * GET /api/user/profile
     */
    static async getProfile(req, res) {
        try {
            const user = req.user;

            return ResponseHelper.success(res, {
                id: user._id,
                openid: user.openid,
                nickname: user.nickname,
                avatarUrl: user.avatarUrl,
                role: user.role,
                contactName: user.contactName,
                contactPhone: user.contactPhone,
                company: user.company,
                department: user.department,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            }, '获取用户信息成功');

        } catch (error) {
            console.error('获取用户信息失败:', error);
            return ResponseHelper.serverError(res, '获取用户信息失败', error.message);
        }
    }

    /**
     * 更新用户联系信息
     * PUT /api/user/contact
     */
    static async updateContact(req, res) {
        try {
            const { nickname, contactName, contactPhone, company, department } = req.body;
            const user = req.user;

            console.log(`📝 用户 ${user.openid} 更新用户信息:`, { nickname, contactName, contactPhone, company, department });

            // 更新用户信息
            if (nickname !== undefined) {
                user.nickname = nickname;
            }
            if (contactName !== undefined) {
                user.contactName = contactName;
            }
            if (contactPhone !== undefined) {
                user.contactPhone = contactPhone;
            }
            if (company !== undefined) {
                user.company = company;
            }
            if (department !== undefined) {
                user.department = department;
            }

            await user.save();

            return ResponseHelper.success(res, {
                id: user._id,
                nickname: user.nickname,
                contactName: user.contactName,
                contactPhone: user.contactPhone,
                company: user.company,
                department: user.department,
                updatedAt: user.updatedAt
            }, '更新用户信息成功');

        } catch (error) {
            console.error('更新用户信息失败:', error);
            return ResponseHelper.serverError(res, '更新用户信息失败', error.message);
        }
    }

    /**
     * 更新用户头像
     * PUT /api/user/avatar
     */
    static async updateAvatar(req, res) {
        try {
            const { avatarUrl } = req.body;
            const user = req.user;

            if (!avatarUrl) {
                return ResponseHelper.error(res, '缺少头像URL参数', 400);
            }

            console.log(`🖼️ 用户 ${user.openid} 更新头像:`, avatarUrl);

            // 更新用户头像
            user.avatarUrl = avatarUrl;
            await user.save();

            return ResponseHelper.success(res, {
                id: user._id,
                avatarUrl: user.avatarUrl,
                updatedAt: user.updatedAt
            }, '头像更新成功');

        } catch (error) {
            console.error('更新用户头像失败:', error);
            return ResponseHelper.serverError(res, '更新头像失败', error.message);
        }
    }

    /**
     * 用户登录/注册（通过微信openid）
     * POST /api/user/login
     */
    static async login(req, res) {
        try {
            const { openid, nickname, avatarUrl } = req.body;

            // 查找或创建用户
            let user = await User.findOne({ openid });

            if (!user) {
                // 创建新用户
                user = new User({
                    openid,
                    nickname: nickname || '',
                    avatarUrl: avatarUrl || '',
                    role: 'employee'
                });

                await user.save();
                console.log(`✅ 新用户注册: ${openid}`);
            } else {
                // 更新用户信息
                if (nickname) user.nickname = nickname;
                if (avatarUrl) user.avatarUrl = avatarUrl;
                await user.save();
            }

            return ResponseHelper.success(res, {
                id: user._id,
                openid: user.openid,
                nickname: user.nickname,
                avatarUrl: user.avatarUrl,
                role: user.role,
                contactName: user.contactName,
                contactPhone: user.contactPhone,
                company: user.company,
                department: user.department,
                isNewUser: !user.contactName || !user.contactPhone
            }, '登录成功');

        } catch (error) {
            console.error('用户登录失败:', error);
            return ResponseHelper.serverError(res, '登录失败', error.message);
        }
    }

    /**
     * 获取用户角色信息（检查是否为管理员）
     * GET /api/user/role
     */
    static async getRole(req, res) {
        try {
            const user = req.user;

            return ResponseHelper.success(res, {
                role: user.role,
                isAdmin: user.role === 'admin',
                permissions: user.role === 'admin' ? [
                    'room_management',
                    'booking_management',
                    'user_booking'
                ] : ['user_booking']
            }, '获取角色信息成功');

        } catch (error) {
            console.error('获取用户角色失败:', error);
            return ResponseHelper.serverError(res, '获取角色信息失败', error.message);
        }
    }

    /**
     * 获取用户自己的预约记录
     * GET /api/user/bookings
     * @param {Object} req - 请求对象，包含用户信息 (req.user) 和分页参数 (query)
     * @param {Object} res - 响应对象
     */
    static async getUserBookings(req, res) {
        try {
            const userId = req.user._id; // 从认证中间件获取用户ID
            const now = TimeHelper.now(); // 获取当前时间（Moment对象，已考虑时区）

            // 分页参数
            const page = parseInt(req.query.page) || 1;
            const pageSize = parseInt(req.query.pageSize) || 20;
            const skip = (page - 1) * pageSize;

            console.log(`📋 用户 ${userId} 请求获取预约记录 (第${page}页，每页${pageSize}条)...`);

            // 获取当前用户的所有预约记录，排除已删除的预约
            const totalCount = await Booking.countDocuments({ userId: userId, status: { $ne: 'deleted' } });

            const bookings = await Booking.find({ userId: userId, status: { $ne: 'deleted' } })
                .populate('roomId', 'name capacity location images') // 关联查询会议室信息
                .sort({ bookingDate: -1, startTime: -1 }) // 按日期和开始时间倒序排列（最新的在前面）
                .skip(skip)
                .limit(pageSize)
                .lean(); // 返回Plain Old JavaScript Object (POJO)

            const upcomingBookings = [];
            const pastBookings = [];

            for (const booking of bookings) {
                // 将预约日期和结束时间合并，用于判断预约是否已结束
                const bookingEndDateTime = TimeHelper.combineDateAndTime(booking.bookingDate, booking.endTime);
                // 将预约日期和开始时间合并，用于判断预约是否进行中
                const bookingStartDateTime = TimeHelper.combineDateAndTime(booking.bookingDate, booking.startTime);
                const isCancelled = booking.status === 'cancelled';

                // 格式化数据，确保前端易于显示
                const formattedBooking = {
                    id: booking._id,
                    roomId: booking.roomId ? booking.roomId._id : null, // 确保roomId存在
                    conferenceRoomName: booking.roomId ? booking.roomId.name : '未知会议室',
                    roomLocation: booking.roomId ? booking.roomId.location : '未知地点',
                    roomImage: (booking.roomId && booking.roomId.images && booking.roomId.images.length > 0) ? booking.roomId.images[0] : '', // 提供默认图片
                    bookingDate: TimeHelper.formatDate(booking.bookingDate), // YYYY-MM-DD
                    bookingDateWithWeekday: TimeHelper.formatDateWithWeekday(booking.bookingDate), // YYYY-MM-DD (周X)
                    startTime: booking.startTime,
                    endTime: booking.endTime,
                    topic: booking.topic,
                    attendeesCount: booking.attendeesCount,
                    contactName: booking.userName, // 使用预约时的联系人姓名
                    // 手机号脱敏处理
                    contactPhone: booking.userPhone ? booking.userPhone.substring(0, 3) + '****' + booking.userPhone.substring(7) : '',
                    status: booking.status, // 原始状态，如 'booked', 'cancelled'
                    createdAt: booking.createdAt,
                };

                // 已取消的预约直接归入历史记录，便于在“已取消”筛选中展示
                if (isCancelled) {
                    formattedBooking.displayStatus = '已取消';
                    pastBookings.push(formattedBooking);
                    continue;
                }

                // 根据当前时间判断预约的显示状态
                if (bookingEndDateTime.isBefore(now)) {
                    // 预约已结束
                    formattedBooking.displayStatus = '已完成';
                    pastBookings.push(formattedBooking);
                } else {
                    // 预约尚未结束或正在进行
                    if (bookingStartDateTime.isBefore(now) && bookingEndDateTime.isAfter(now)) {
                        formattedBooking.displayStatus = '进行中';
                    } else {
                        formattedBooking.displayStatus = '已预约';
                    }
                    upcomingBookings.push(formattedBooking);
                }
            }

            // 历史预约按日期倒序排列（最近的在前面）
            pastBookings.sort((a, b) => new Date(b.bookingDate + ' ' + b.endTime) - new Date(a.bookingDate + ' ' + a.endTime));
            // 即将开始的预约按日期正序排列
            upcomingBookings.sort((a, b) => new Date(a.bookingDate + ' ' + a.startTime) - new Date(b.bookingDate + ' ' + b.startTime));

            // 计算分页信息
            const totalPages = Math.ceil(totalCount / pageSize);
            const hasMore = page < totalPages;

            console.log(`✅ 用户 ${userId} 获取预约记录成功。即将开始: ${upcomingBookings.length}, 历史: ${pastBookings.length}, 总数: ${totalCount}, 页数: ${page}/${totalPages}`);

            return ResponseHelper.success(res, {
                upcomingBookings,
                pastBookings,
                pagination: {
                    currentPage: page,
                    totalPages: totalPages,
                    totalCount: totalCount,
                    pageSize: pageSize,
                    hasMore: hasMore
                },
                hasMore: hasMore // 兼容前端期望的字段
            }, '获取预约记录成功');

        } catch (error) {
            console.error('❌ 获取用户预约记录失败:', error);
            return ResponseHelper.serverError(res, '获取预约记录失败', error.message);
        }
    }
}

module.exports = UserController;
