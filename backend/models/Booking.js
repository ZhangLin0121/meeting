const mongoose = require('mongoose');

/**
 * 会议室预约模型
 * 用于存储每条具体的会议室预约记录
 */
const bookingSchema = new mongoose.Schema({
    // 关联的会议室ID，指向ConferenceRoom集合
    roomId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ConferenceRoom',
        required: true,
        index: true
    },

    // 冗余存储会议室名称，方便快速查询显示
    conferenceRoomName: {
        type: String,
        required: true
    },

    // 关联的预约用户ID，指向User集合
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // 冗余存储预约人姓名
    userName: {
        type: String,
        required: true
    },

    // 冗余存储预约人电话
    userPhone: {
        type: String,
        required: true
    },

    // 预约的日期（只包含年、月、日，时间部分设为0点）
    bookingDate: {
        type: Date,
        required: true,
        index: true
    },

    // 预约开始时间（例如："08:30"）
    startTime: {
        type: String,
        required: true,
        validate: {
            validator: function(time) {
                return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
            },
            message: '时间格式应为 HH:MM'
        }
    },

    // 预约结束时间（例如："09:00"）
    endTime: {
        type: String,
        required: true,
        validate: {
            validator: function(time) {
                return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
            },
            message: '时间格式应为 HH:MM'
        }
    },

    // 会议主题
    topic: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },

    // 参会人数（非必填）
    attendeesCount: {
        type: Number,
        min: 1,
        default: null
    },

    // 预约状态
    status: {
        type: String,
        enum: ['booked', 'cancelled'],
        default: 'booked',
        required: true,
        index: true
    },

    // 标记是否为管理员代预约
    isManualBooking: {
        type: Boolean,
        default: false,
        required: true
    }
}, {
    // 自动添加创建时间和更新时间
    timestamps: true,
    // 转换为JSON时的选项
    toJSON: {
        transform: function(doc, ret) {
            delete ret.__v;
            return ret;
        }
    }
});

// 创建复合索引提高查询性能
bookingSchema.index({ roomId: 1, bookingDate: 1, status: 1 });
bookingSchema.index({ userId: 1, status: 1 });
bookingSchema.index({ bookingDate: 1, status: 1 });

// 确保同一会议室在同一时间段不能重复预约的复合唯一索引
bookingSchema.index({
    roomId: 1,
    bookingDate: 1,
    startTime: 1,
    endTime: 1,
    status: 1
}, {
    unique: true,
    partialFilterExpression: { status: 'booked' }
});

// 预约验证中间件：验证结束时间大于开始时间
bookingSchema.pre('save', function(next) {
    const startMinutes = this.startTime.split(':').reduce((acc, time) => (60 * acc) + +time);
    const endMinutes = this.endTime.split(':').reduce((acc, time) => (60 * acc) + +time);

    if (endMinutes <= startMinutes) {
        return next(new Error('结束时间必须大于开始时间'));
    }

    next();
});

module.exports = mongoose.model('Booking', bookingSchema);