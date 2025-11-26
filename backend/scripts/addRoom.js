require('dotenv').config();
const mongoose = require('mongoose');
const ConferenceRoom = require('../models/ConferenceRoom');
const config = require('../config');

const MONGODB_URI = process.env.MONGODB_URI || config.mongodbUri || 'mongodb://127.0.0.1:27017/meeting_room_booking';

function parseArgs() {
  const args = process.argv.slice(2);
  const props = {
    roomId: 'TEST001',
    name: '测试会议室',
    capacity: 6,
    location: '测试楼层',
    equipment: ['白板', '投屏设备', '空调', '网络接口/Wi-Fi'],
    description: '用于测试的会议室',
    images: ['/uploads/rooms/room_1750831376108_549383236.jpg']
  };

  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    const val = args[i + 1];
    if (!val) continue;
    if (key === '--roomId') { props.roomId = val; i++; }
    else if (key === '--name') { props.name = val; i++; }
    else if (key === '--capacity') { props.capacity = parseInt(val, 10); i++; }
    else if (key === '--location') { props.location = val; i++; }
    else if (key === '--equipment') { props.equipment = val.split(','); i++; }
    else if (key === '--description') { props.description = val; i++; }
    else if (key === '--image') { props.images = [val]; i++; }
  }

  return props;
}

async function main() {
  const payload = parseArgs();
  await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('✅ 已连接数据库:', MONGODB_URI);

  const room = await ConferenceRoom.findOneAndUpdate(
    { roomId: payload.roomId },
    { $set: payload },
    { upsert: true, new: true }
  );

  console.log('✅ 会议室已创建/更新:');
  console.log({
    id: room._id.toString(),
    roomId: room.roomId,
    name: room.name,
    capacity: room.capacity,
    location: room.location,
    images: room.images
  });

  await mongoose.connection.close();
  console.log('✅ 数据库连接已关闭');
}

main().catch(async (e) => {
  console.error('❌ 新增会议室失败:', e);
  try { await mongoose.connection.close(); } catch {}
  process.exit(1);
});

