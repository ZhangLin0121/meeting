const Booking = require('../models/Booking');
const TimeHelper = require('../utils/timeHelper');

function parseBoolean(value, defaultValue) {
    if (value === undefined) return defaultValue;
    const normalized = String(value).trim().toLowerCase();
    if (!normalized) return defaultValue;
    return !['0', 'false', 'no', 'off'].includes(normalized);
}

function getIntervalMinutes() {
    const raw = process.env.BOOKING_COMPLETED_JOB_INTERVAL_MINUTES;
    const parsed = parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return 1;
    }
    return parsed;
}

class BookingStatusService {

    static getModifiedCount(result) {
        if (!result) return 0;
        if (typeof result.modifiedCount === 'number') return result.modifiedCount;
        if (typeof result.nModified === 'number') return result.nModified;
        if (typeof result.n === 'number') return result.n;
        return 0;
    }

    static async markCompletedBookings() {
        try {
            const now = TimeHelper.now();
            const today = TimeHelper.getStartOfDay(now.toDate());
            const nowMinutes = now.hours() * 60 + now.minutes();

            const pastResult = await Booking.updateMany(
                {
                    status: 'booked',
                    bookingDate: { $lt: today }
                },
                {
                    $set: {
                        status: 'completed',
                        updatedAt: new Date()
                    }
                }
            );

            const todayBookings = await Booking.find(
                {
                    status: 'booked',
                    bookingDate: today
                },
                { _id: 1, endTime: 1 }
            ).lean();

            const toCompleteIds = (todayBookings || [])
                .filter((booking) => {
                    if (!booking || !booking.endTime) return false;
                    const endMinutes = TimeHelper.timeToMinutes(booking.endTime);
                    return Number.isFinite(endMinutes) && endMinutes <= nowMinutes;
                })
                .map((booking) => booking._id);

            let todayResult = null;
            if (toCompleteIds.length) {
                todayResult = await Booking.updateMany(
                    { _id: { $in: toCompleteIds } },
                    {
                        $set: {
                            status: 'completed',
                            updatedAt: new Date()
                        }
                    }
                );
            }

            const totalUpdated = this.getModifiedCount(pastResult) + this.getModifiedCount(todayResult);
            if (totalUpdated > 0) {
                console.log('Booking completion job updated ' + totalUpdated + ' bookings.');
            }
        } catch (error) {
            console.error('Failed to update completed bookings:', error);
        }
    }

    static startCompletionScheduler() {
        const enabled = parseBoolean(process.env.BOOKING_COMPLETED_JOB_ENABLED, true);
        if (!enabled) {
            console.log('Booking completion job disabled.');
            return;
        }

        const intervalMinutes = getIntervalMinutes();
        const intervalMs = intervalMinutes * 60 * 1000;

        this.markCompletedBookings();
        setInterval(() => {
            this.markCompletedBookings();
        }, intervalMs);

        console.log('Booking completion job started (every ' + intervalMinutes + ' minute(s)).');
    }
}

module.exports = BookingStatusService;
