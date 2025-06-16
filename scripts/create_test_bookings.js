const mongoose = require('mongoose');
const Booking = require('./models/Booking');
const User = require('./models/User');
const ConferenceRoom = require('./models/ConferenceRoom');

async function createTestData() {
    try {
        await mongoose.connect('mongodb://localhost:27017/meeting');
        console.log('Connected to MongoDB');

        // 使用已存在的用户ID
        const userId = '684d7065a5a627b7687002e9';

        // 更新用户信息
        const user = await User.findById(userId);
        if (user) {
            user.contactName = '张志远';
            user.contactPhone = '18871627553';
            user.role = 'admin';
            await user.save();
            console.log('Updated user info');
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
        await Booking.deleteMany({ userId: userId });

        // 创建测试预约
        const now = new Date();
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const bookings = [{
                userId: userId,
                roomId: rooms[0]._id,
                conferenceRoomName: rooms[0].name,
                userName: '张志远',
                userPhone: '18871627553',
                bookingDate: tomorrow.toISOString().split('T')[0],
                startTime: '09:00',
                endTime: '10:00',
                topic: '明天的重要会议',
                attendeesCount: 5,
                status: 'booked'
            },
            {
                userId: userId,
                roomId: rooms[0]._id,
                conferenceRoomName: rooms[0].name,
                userName: '张志远',
                userPhone: '18871627553',
                bookingDate: yesterday.toISOString().split('T')[0],
                startTime: '14:00',
                endTime: '15:00',
                topic: '昨天的项目讨论',
                attendeesCount: 3,
                status: 'cancelled'
            },
            {
                userId: userId,
                roomId: rooms[0]._id,
                conferenceRoomName: rooms[0].name,
                userName: '张志远',
                userPhone: '18871627553',
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
        console.log('User bookings:', await Booking.countDocuments({ userId: userId }));

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

createTestData();