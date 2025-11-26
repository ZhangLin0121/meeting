/**
 * 清空预约数据脚本（生产/测试均可用）
 * 使用 config.mongodbUri 连接并删除所有 Booking 文档。
 */
const mongoose = require("mongoose");
const config = require("../config");
const Booking = require("../models/Booking");

async function main() {
  try {
    const uri = config.mongodbUri;
    if (!uri) throw new Error("未找到 MongoDB 连接字符串 (MONGODB_URI)");
    console.log("🔗 正在连接数据库:", uri);
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log("✅ 数据库连接成功");

    const count = await Booking.countDocuments();
    console.log(`📊 当前预约数量: ${count}`);
    if (count === 0) {
      console.log("ℹ️ 没有需要删除的预约数据。");
      process.exit(0);
    }

    const result = await Booking.deleteMany({});
    console.log(`🧹 已删除预约文档: ${result.deletedCount}`);
    console.log("✅ 预约数据清理完成");
  } catch (error) {
    console.error("❌ 清空预约数据失败:", error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close().catch(() => {});
  }
}

main();
