// pages/debug/debug.js
const envConfig = require('../../config/env.js');
const request = require('../../utils/request.js');

Page({
    data: {
        logs: [],
        userInfo: null,
        isAdmin: false,
        apiUrl: envConfig.apiBaseUrl,
        environment: envConfig.environment
    },

    onLoad() {
        this.addLog(`🚀 调试页面加载 - 环境: ${this.data.environment}`);
        this.addLog(`🌐 API地址: ${this.data.apiUrl}`);
        this.checkUserStatus();
    },

    addLog(message) {
        const logs = this.data.logs;
        const timestamp = new Date().toLocaleTimeString();
        logs.unshift(`[${timestamp}] ${message}`);

        if (logs.length > 20) {
            logs.splice(20);
        }

        this.setData({ logs });
        console.log(message);
    },

    async checkUserStatus() {
        try {
            const app = getApp();
            const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');

            if (userInfo && userInfo.openid) {
                this.setData({ userInfo });
                this.addLog(`✅ 用户已登录: ${userInfo.openid}`);
                this.addLog(`👤 用户角色: ${userInfo.role}`);

                if (userInfo.role === 'admin') {
                    this.setData({ isAdmin: true });
                    this.addLog(`🔑 管理员权限确认`);
                } else {
                    this.addLog(`❌ 非管理员用户`);
                }
            } else {
                this.addLog(`❌ 用户未登录`);
            }
        } catch (error) {
            this.addLog(`❌ 检查用户状态失败: ${error.message}`);
        }
    },

    async testApiHealth() {
        try {
            this.addLog(`🔍 测试API健康检查...`);
            const result = await request.get('/api/health');

            if (result.success) {
                this.addLog(`✅ API健康检查成功`);
                this.addLog(`📊 服务器时间: ${result.timestamp}`);
            } else {
                this.addLog(`❌ API健康检查失败: ${result.message}`);
            }
        } catch (error) {
            this.addLog(`❌ API连接失败: ${error.message}`);
        }
    },

    async testUserRole() {
        try {
            this.addLog(`🔍 测试用户角色检查...`);
            const result = await request.get('/api/user/role');

            if (result.success) {
                this.addLog(`✅ 角色检查成功: ${result.data.role}`);
                this.addLog(`🔑 是否管理员: ${result.data.isAdmin}`);
            } else {
                this.addLog(`❌ 角色检查失败: ${result.message}`);
            }
        } catch (error) {
            this.addLog(`❌ 角色检查失败: ${error.message}`);
        }
    },

    async testCreateRoom() {
        try {
            this.addLog(`🏢 测试创建会议室...`);

            const testRoom = {
                roomId: 'DEBUG_' + Date.now(),
                name: '调试测试室',
                capacity: 8,
                location: '调试楼层',
                equipment: ['投屏设备', '白板'],
                description: '这是一个调试测试用的会议室'
            };

            this.addLog(`📤 发送数据: ${JSON.stringify(testRoom)}`);

            const result = await request.post('/api/rooms', testRoom);

            if (result.success) {
                this.addLog(`✅ 创建会议室成功!`);
                this.addLog(`🆔 会议室ID: ${result.data.id}`);
            } else {
                this.addLog(`❌ 创建失败: ${result.message}`);
                if (result.details) {
                    result.details.forEach(detail => {
                        this.addLog(`  - ${detail.field}: ${detail.message}`);
                    });
                }
            }
        } catch (error) {
            this.addLog(`❌ 创建会议室失败: ${error.message}`);
        }
    },

    async testGetRooms() {
        try {
            this.addLog(`🏢 测试获取会议室列表...`);
            const result = await request.get('/api/rooms');

            if (result.success) {
                this.addLog(`✅ 获取成功，共 ${result.data.length} 个会议室`);
                result.data.forEach((room, index) => {
                    this.addLog(`  ${index + 1}. ${room.name} (${room.capacity}人)`);
                });
            } else {
                this.addLog(`❌ 获取失败: ${result.message}`);
            }
        } catch (error) {
            this.addLog(`❌ 获取会议室列表失败: ${error.message}`);
        }
    },

    clearLogs() {
        this.setData({ logs: [] });
    },

    goBack() {
        wx.navigateBack();
    }
});