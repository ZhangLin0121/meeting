const mongoose = require('mongoose');

/**
 * 会议室模型
 * 用于存储所有会议室的基本信息、设备和图片
 */
const conferenceRoomSchema = new mongoose.Schema({
    // 会议室唯一标识符，由系统生成或管理员指定
    roomId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },

    // 会议室名称
    name: {
        type: String,
        required: true,
        trim: true
    },

    // 会议室可容纳的人数
    capacity: {
        type: Number,
        required: true,
        min: 1
    },

    // 会议室所在的位置
    location: {
        type: String,
        required: true,
        trim: true
    },

    // 会议室配备的设备列表
    equipment: {
        type: [String],
        default: [],
        validate: {
            validator: function(equipmentArray) {
                // 允许的设备类型
                const allowedEquipment = [
                    '投屏设备',
                    '麦克风',
                    '音响系统',
                    '白板',
                    '电子白板',
                    '视频会议设备',
                    '网络接口/Wi-Fi',
                    '空调',
                    '电话',
                    '饮水设备'
                ];
                return equipmentArray.every(item => allowedEquipment.includes(item));
            },
            message: '设备类型不在允许的列表中'
        }
    },

    // 会议室的详细描述
    description: {
        type: String,
        default: '',
        maxlength: 500
    },

    // 会议室图片的URL列表
    images: {
        type: [String],
        default: []
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

// 创建索引提高查询性能
conferenceRoomSchema.index({ roomId: 1 });
conferenceRoomSchema.index({ name: 1 });
conferenceRoomSchema.index({ capacity: 1 });
conferenceRoomSchema.index({ location: 1 });

// 支持按设备筛选的索引
conferenceRoomSchema.index({ equipment: 1 });

// 支持文本搜索的索引
conferenceRoomSchema.index({
    name: 'text',
    description: 'text',
    location: 'text'
});

module.exports = mongoose.model('ConferenceRoom', conferenceRoomSchema);
