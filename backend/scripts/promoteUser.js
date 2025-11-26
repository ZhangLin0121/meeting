require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const config = require('../config');

const MONGODB_URI = process.env.MONGODB_URI || config.mongodbUri || 'mongodb://127.0.0.1:27017/meeting_room_booking';

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--company' && args[i + 1]) { result.company = args[++i]; }
    else if (args[i] === '--contact' && args[i + 1]) { result.contactName = args[++i]; }
    else if (args[i] === '--openid' && args[i + 1]) { result.openid = args[++i]; }
  }
  return result;
}

async function main() {
  const { company, contactName, openid } = parseArgs();
  if (!company && !contactName && !openid) {
    console.error('用法: node scripts/promoteUser.js [--company 公司] [--contact 姓名] [--openid openid]');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('✅ 已连接数据库:', MONGODB_URI);

  const filter = {};
  if (openid) filter.openid = openid;
  if (company) filter.company = company;
  if (contactName) filter.contactName = contactName;

  const users = await User.find(filter);
  if (users.length === 0) {
    console.log('❌ 未找到匹配用户:', filter);
    await mongoose.connection.close();
    process.exit(2);
  }

  const result = await User.updateMany(filter, { role: 'admin' });
  console.log(`✅ 已设置 ${result.modifiedCount} 个用户为管理员`);

  const updated = await User.find(filter);
  updated.forEach(u => {
    console.log(`- ${u.company || u.contactName || u.openid}: ${u.role}`);
  });

  await mongoose.connection.close();
  console.log('✅ 数据库连接已关闭');
}

main().catch(async (e) => {
  console.error('❌ 操作失败:', e);
  try { await mongoose.connection.close(); } catch {}
  process.exit(1);
});
