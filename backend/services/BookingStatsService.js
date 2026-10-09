const Booking = require('../models/Booking');
const ResponseHelper = require('../utils/responseHelper');
const TimeHelper = require('../utils/timeHelper');

class BookingStatsService {

    static async getAdminBookingStats(req, res) {
        try {
            const { roomId, startDate, endDate } = req.query;

            const query = {};
            if (roomId) {
                query.roomId = roomId;
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

            const nowDate = TimeHelper.now().toDate();

            const pipeline = [
                { $match: query },
                { $project: { status: 1, bookingDate: 1, endTime: 1 } },
                {
                    $addFields: {
                        _endHour: { $toInt: { $substrBytes: ['$endTime', 0, 2] } },
                        _endMinute: { $toInt: { $substrBytes: ['$endTime', 3, 2] } }
                    }
                },
                {
                    $addFields: {
                        _endMinutes: {
                            $add: [
                                { $multiply: ['$_endHour', 60] },
                                '$_endMinute'
                            ]
                        }
                    }
                },
                {
                    $addFields: {
                        _endDateTime: { $add: ['$bookingDate', { $multiply: ['$_endMinutes', 60000] }] }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        cancelled: {
                            $sum: {
                                $cond: [
                                    { $eq: ['$status', 'cancelled'] },
                                    1,
                                    0
                                ]
                            }
                        },
                        completed: {
                            $sum: {
                                $cond: [
                                    {
                                        $or: [
                                            { $eq: ['$status', 'completed'] },
                                            {
                                                $and: [
                                                    { $eq: ['$status', 'booked'] },
                                                    { $lte: ['$_endDateTime', nowDate] }
                                                ]
                                            }
                                        ]
                                    },
                                    1,
                                    0
                                ]
                            }
                        },
                        active: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $eq: ['$status', 'booked'] },
                                            { $gt: ['$_endDateTime', nowDate] }
                                        ]
                                    },
                                    1,
                                    0
                                ]
                            }
                        }
                    }
                }
            ];

            const results = await Booking.aggregate(pipeline);
            const stats = results && results.length ? results[0] : null;

            return ResponseHelper.success(res, {
                total: stats ? stats.total : 0,
                active: stats ? stats.active : 0,
                completed: stats ? stats.completed : 0,
                cancelled: stats ? stats.cancelled : 0
            }, '获取预约统计成功');

        } catch (error) {
            console.error('获取预约统计失败:', error);
            return ResponseHelper.serverError(res, '获取预约统计失败', error.message);
        }
    }
}

module.exports = BookingStatsService;
