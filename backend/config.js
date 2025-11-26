require('dotenv').config();

module.exports = {
    // 服务器配置
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',

    // MongoDB 数据库配置
    mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/meeting_room_booking',

    // 时区设置 - 中国北京时间
    timezone: process.env.TIMEZONE || 'Asia/Shanghai',

    // 文件上传配置
    uploadPath: process.env.UPLOAD_PATH || 'uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 20971520, // 20MB

    // 微信小程序配置
    wechat: {
        appId: process.env.WECHAT_APP_ID || 'wxa4f8f0622653dea5',
        appSecret: process.env.WECHAT_APP_SECRET || '1ebfd5606d696d1dbba7d3a44cd02877',
        subscribeMessageTemplateId: process.env.WECHAT_SUB_MSG_TEMPLATE_ID || 'D5h5Vcz2HrYxpAVClFsRLA0t-K1zR4A_FJxld3Fe08w',
        cancelSubscribeMessageTemplateId: process.env.WECHAT_CANCEL_SUB_MSG_TEMPLATE_ID || 'IousbkyGHmqRnN-kC65aHF3bMBmVOhPgLNFqwcnb2O8',
        reminderTemplateId: process.env.WECHAT_REMIND_SUB_MSG_TEMPLATE_ID || 'onoJdIQC822XlUMyfgvRgNOlVXGHDWiJxD7hqzMvUDw'
    },

    // 会议室开放时间配置 - 修复时间段配置以匹配前端
    office: {
        startTime: process.env.OFFICE_START_TIME || '08:30',
        endTimeMorning: process.env.OFFICE_END_TIME_MORNING || '12:00',
        startTimeNoon: process.env.OFFICE_START_TIME_NOON || '12:00',
        endTimeNoon: process.env.OFFICE_END_TIME_NOON || '14:30',
        startTimeAfternoon: process.env.OFFICE_START_TIME_AFTERNOON || '14:30',
        endTime: process.env.OFFICE_END_TIME || '22:00'
    },

    // 预约时间限制
    booking: {
        maxAdvanceDays: parseInt(process.env.MAX_ADVANCE_DAYS) || 15,
        cancelTimeLimitMinutes: parseInt(process.env.CANCEL_TIME_LIMIT_MINUTES) || 30,
        adminCancelTimeLimitMinutes: parseInt(process.env.ADMIN_CANCEL_TIME_LIMIT_MINUTES) || 5
    }
};
