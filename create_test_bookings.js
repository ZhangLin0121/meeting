const mongoose = require('mongoose');
const Booking = require('./models/Booking');
const User = require('./models/User');
const ConferenceRoom = require('./models/ConferenceRoom');

async function createTestData() {
    try {
        await mongoose.connect('mongodb://localhost:27017/meeting');
        console.log('Connected to MongoDB');

        // 查找或创建用户
        let user = await User.findOne({ openid: 'test123' });
        if (!user) {
            user = new User({
                openid: 'test123',
                nickname: '张志远',
                role: 'admin',
                contactName: '张志远',
                contactPhone: '18871627553'
            });
            await user.save();
            console.log('Created test user');
        }

        // 查找会议室
        let rooms = await ConferenceRoom.find({}).limit(2);
        if (rooms.length === 0) {
            console.log('No rooms found, creating test room');
            const room = new ConferenceRoom({
                roomId: 'test-room-001',
                name: '测试会议室',
                capacity: 10,
                location: '1楼',
                description: '测试用会议室',
                images: []
            });
            await room.save();
            rooms = [room];
        }

        // 删除现有的测试预约
        await Booking.deleteMany({ userId: user._id });

        // 创建测试预约
        const now = new Date();
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const bookings = [{
                userId: user._id,
                roomId: rooms[0]._id,
                conferenceRoomName: rooms[0].name,
                userName: user.contactName,
                userPhone: user.contactPhone,
                bookingDate: tomorrow.toISOString().split('T')[0],
                startTime: '09:00',
                endTime: '10:00',
                topic: '明天的重要会议',
                attendeesCount: 5,
                status: 'booked'
            },
            {
                userId: user._id,
                roomId: rooms[0]._id,
                conferenceRoomName: rooms[0].name,
                userName: user.contactName,
                userPhone: user.contactPhone,
                bookingDate: yesterday.toISOString().split('T')[0],
                startTime: '14:00',
                endTime: '15:00',
                topic: '昨天的项目讨论',
                attendeesCount: 3,
                status: 'cancelled'
            },
            {
                userId: user._id,
                roomId: rooms[0]._id,
                conferenceRoomName: rooms[0].name,
                userName: user.contactName,
                userPhone: user.contactPhone,
                bookingDate: now.toISOString().split('T')[0],
                startTime: '16:00',
                endTime: '17:00',
                topic: '今天的团队会议',
                attendeesCount: 8,
                status: 'booked'
            }
        ];

        for (const bookingData of bookings) {
            const booking = new Booking(bookingData);
            await booking.save();
        }

        console.log('Created test bookings');
        console.log('Total bookings now:', await Booking.countDocuments({}));
        console.log('User bookings:', await Booking.countDocuments({ userId: user._id }));

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

createTestData();