const mongoose = require('mongoose');

/**
 * 会议室临时关闭模型
 * 用于存储管理员设置的会议室临时关闭/不可预约时间段
 */
const temporaryClosureSchema = new mongoose.Schema({
    // 关联的会议室ID，指向ConferenceRoom集合
    roomId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ConferenceRoom',
        required: true,
        index: true
    },

    // 临时关闭的日期（只包含年、月、日）
    closureDate: {
        type: Date,
        required: true,
        index: true
    },

    // 临时关闭开始时间（例如："08:30"），如果全天关闭则可为空
    startTime: {
        type: String,
        validate: {
            validator: function(time) {
                // 如果不是全天关闭且有开始时间，则需要验证格式
                if (!this.isAllDay && time) {
                    return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
                }
                return true;
            },
            message: '时间格式应为 HH:MM'
        }
    },

    // 临时关闭结束时间（例如："17:30"），如果全天关闭则可为空
    endTime: {
        type: String,
        validate: {
            validator: function(time) {
                // 如果不是全天关闭且有结束时间，则需要验证格式
                if (!this.isAllDay && time) {
                    return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
                }
                return true;
            },
            message: '时间格式应为 HH:MM'
        }
    },

    // 临时关闭的原因
    reason: {
        type: String,
        default: '',
        maxlength: 200,
        trim: true
    },

    // 标记是否为全天关闭
    isAllDay: {
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
temporaryClosureSchema.index({ roomId: 1, closureDate: 1 });
temporaryClosureSchema.index({ closureDate: 1 });

// 验证中间件：如果不是全天关闭，必须有开始时间和结束时间
temporaryClosureSchema.pre('save', function(next) {
    if (!this.isAllDay) {
        if (!this.startTime || !this.endTime) {
            return next(new Error('非全天关闭时，必须指定开始时间和结束时间'));
        }

        // 验证结束时间大于开始时间
        const startMinutes = this.startTime.split(':').reduce((acc, time) => (60 * acc) + +time);
        const endMinutes = this.endTime.split(':').reduce((acc, time) => (60 * acc) + +time);

        if (endMinutes <= startMinutes) {
            return next(new Error('结束时间必须大于开始时间'));
        }
    } else {
        // 全天关闭时，清空开始时间和结束时间
        this.startTime = undefined;
        this.endTime = undefined;
    }

    next();
});

module.exports = mongoose.model('TemporaryClosure', temporaryClosureSchema);