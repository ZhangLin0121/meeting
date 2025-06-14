const mongoose = require('mongoose');
const ConferenceRoom = require('./models/ConferenceRoom');
const config = require('./config');

/**
 * 初始化会议室数据
 * 包含完整的会议室信息和图片路径
 */

// 会议室初始数据
const roomsData = [{
        roomId: 'ROOM001',
        name: '行政会议室',
        capacity: 12,
        location: '3楼A区',
        equipment: ['投屏设备', '麦克风', '音响系统', '白板', '空调', '视频会议设备'],
        description: '行政办公区主要会议室，适合管理层会议、项目讨论等。配备完善的音视频设备，支持远程会议。',
        images: [
            '/uploads/rooms/admin_meeting_room_1.png'
        ]
    },
    {
        roomId: 'ROOM002',
        name: '创意讨论室',
        capacity: 8,
        location: '2楼B区',
        equipment: ['白板', '电子白板', '投屏设备', '空调', '网络接口/Wi-Fi'],
        description: '专为创意团队设计的讨论空间，配备电子白板和多种协作工具，激发团队创新思维。',
        images: [
            '/uploads/rooms/creative_room_1.png'
        ]
    },
    {
        roomId: 'ROOM003',
        name: '大型会议厅',
        capacity: 30,
        location: '1楼中央',
        equipment: ['投屏设备', '麦克风', '音响系统', '视频会议设备', '空调', '电话'],
        description: '公司最大的会议空间，适合全员大会、重要客户会议、培训讲座等大型活动。',
        images: [
            '/uploads/rooms/large_conference_hall_1.png'
        ]
    },
    {
        roomId: 'ROOM004',
        name: '小型洽谈室',
        capacity: 4,
        location: '3楼C区',
        equipment: ['投屏设备', '空调', '网络接口/Wi-Fi'],
        description: '私密舒适的小型会议空间，适合一对一面谈、小组讨论、客户洽谈等。',
        images: [
            '/uploads/rooms/small_meeting_room_1.png'
        ]
    },
    {
        roomId: 'ROOM005',
        name: '培训教室',
        capacity: 20,
        location: '2楼A区',
        equipment: ['投屏设备', '麦克风', '音响系统', '白板', '空调', '网络接口/Wi-Fi'],
        description: '专业的培训环境，配备教学所需的各种设备，适合内部培训、讲座、工作坊等。',
        images: [
            '/uploads/rooms/training_room_1.png'
        ]
    },
    {
        roomId: 'ROOM006',
        name: '视频会议室',
        capacity: 6,
        location: '4楼A区',
        equipment: ['视频会议设备', '投屏设备', '麦克风', '音响系统', '空调', '网络接口/Wi-Fi'],
        description: '专业的远程会议环境，配备高清摄像头和专业音响设备，确保远程沟通效果。',
        images: [
            '/uploads/rooms/video_conference_room_1.png'
        ]
    }
];

/**
 * 连接数据库并插入数据
 */
async function initializeRooms() {
    try {
        // 连接数据库
        await mongoose.connect(config.mongodbUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('✅ 数据库连接成功');

        // 清空现有会议室数据（可选）
        const existingRooms = await ConferenceRoom.find();
        if (existingRooms.length > 0) {
            console.log(`⚠️  发现 ${existingRooms.length} 条现有会议室数据`);
            const readline = require('readline');
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            const answer = await new Promise(resolve => {
                rl.question('是否要清空现有数据并重新插入？(y/n): ', resolve);
            });
            rl.close();

            if (answer.toLowerCase() === 'y') {
                await ConferenceRoom.deleteMany({});
                console.log('✅ 已清空现有会议室数据');
            } else {
                console.log('❌ 已取消数据初始化');
                process.exit(0);
            }
        }

        // 插入新数据
        console.log('🚀 开始插入会议室数据...');

        let successCount = 0;
        let errorCount = 0;

        for (const roomData of roomsData) {
            try {
                const room = new ConferenceRoom(roomData);
                await room.save();
                console.log(`✅ 成功插入会议室: ${roomData.name} (${roomData.roomId})`);
                successCount++;
            } catch (error) {
                console.error(`❌ 插入会议室失败: ${roomData.name}`, error.message);
                errorCount++;
            }
        }

        console.log('\n📊 数据插入完成统计:');
        console.log(`✅ 成功: ${successCount} 条`);
        console.log(`❌ 失败: ${errorCount} 条`);
        console.log(`📝 总计: ${roomsData.length} 条`);

        // 验证数据
        const totalRooms = await ConferenceRoom.countDocuments();
        console.log(`\n📋 数据库中现有会议室总数: ${totalRooms} 个`);

        // 显示插入的会议室列表
        console.log('\n📝 已插入的会议室列表:');
        const rooms = await ConferenceRoom.find().sort({ roomId: 1 });
        rooms.forEach(room => {
            console.log(`  - ${room.roomId}: ${room.name} (${room.capacity}人, ${room.location})`);
        });

    } catch (error) {
        console.error('❌ 数据初始化失败:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n✅ 数据库连接已关闭');
        process.exit(0);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    initializeRooms();
}

module.exports = { roomsData, initializeRooms };