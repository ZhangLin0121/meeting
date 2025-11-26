const mongoose = require('mongoose');
const User = require('../models/User');

// MongoDB连接配置
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/meeting';

/**
 * 设置用户为管理员的脚本
 */
async function setAdminUsers() {
    try {
        // 连接到MongoDB
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ 数据库连接成功');

        // 查看所有用户
        const allUsers = await User.find({});
        console.log('\n📋 当前数据库中的所有用户:');
        console.log('='.repeat(60));

        if (allUsers.length === 0) {
            console.log('❌ 数据库中没有用户，请先在小程序中登录创建用户');
            process.exit(1);
        }

        allUsers.forEach((user, index) => {
            console.log(`${index + 1}. OpenID: ${user.openid}`);
            console.log(`   昵称: ${user.nickname || '未设置'}`);
            console.log(`   角色: ${user.role}`);
            console.log(`   创建时间: ${user.createdAt}`);
            console.log('   ' + '-'.repeat(50));
        });

        // 如果需要批量设置管理员，可以取消下面的注释
        // const result = await User.updateMany({}, { role: 'admin' });
        // console.log(`\n✅ 已将 ${result.modifiedCount} 个用户设置为管理员`);

        // 设置所有用户为管理员（适用于测试环境）
        console.log('\n🔧 设置所有用户为管理员...');
        const updateResult = await User.updateMany({ role: 'employee' }, { role: 'admin' });
        console.log(`✅ 成功将 ${updateResult.modifiedCount} 个用户设置为管理员`);

        // 再次查看更新后的用户
        const updatedUsers = await User.find({});
        console.log('\n📋 更新后的用户角色:');
        console.log('='.repeat(60));
        updatedUsers.forEach((user, index) => {
            console.log(`${index + 1}. ${user.nickname || user.openid} - 角色: ${user.role}`);
        });

    } catch (error) {
        console.error('❌ 设置管理员失败:', error);
    } finally {
        // 关闭数据库连接
        await mongoose.connection.close();
        console.log('\n✅ 数据库连接已关闭');
        process.exit(0);
    }
}

// 运行脚本
setAdminUsers();