const mongoose = require('mongoose');

/**
 * 用户模型
 * 用于存储小程序用户的信息，包括微信身份和联系方式
 */
const userSchema = new mongoose.Schema({
    // 微信用户在小程序内的唯一标识
    openid: {
        type: String,
        required: true,
        unique: true,
        index: true
    },

    // 用户的微信昵称
    nickname: {
        type: String,
        default: ''
    },

    // 用户的微信头像URL
    avatarUrl: {
        type: String,
        default: ''
    },

    // 用户角色，默认为普通员工
    role: {
        type: String,
        enum: ['employee', 'admin'],
        default: 'employee',
        required: true
    },

    // 用户联系人姓名（在首次预约时可能填写或管理员代填）
    contactName: {
        type: String,
        default: ''
    },

    // 用户联系电话（在首次预约时可能填写或管理员代填）
    contactPhone: {
        type: String,
        default: ''
    },

    // 用户所在公司名称
    company: {
        type: String,
        default: ''
    },

    // 用户所在部门
    department: {
        type: String,
        default: ''
    }
}, {
    // 自动添加创建时间和更新时间
    timestamps: true,
    // 转换为JSON时的选项
    toJSON: {
        transform: function(doc, ret) {
            // 隐藏敏感信息
            delete ret.__v;
            return ret;
        }
    }
});

// 创建索引提高查询性能
userSchema.index({ openid: 1 });
userSchema.index({ role: 1 });

module.exports = mongoose.model('User', userSchema);