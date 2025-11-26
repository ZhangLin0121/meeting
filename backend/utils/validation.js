const Joi = require('joi');

/**
 * 数据验证模式定义
 */
const validationSchemas = {

    // 用户相关验证
    user: {
        // 用户登录/注册
        login: Joi.object({
            openid: Joi.string().required().messages({
                'string.empty': 'openid不能为空',
                'any.required': 'openid是必填项'
            }),
            nickname: Joi.string().allow('').optional(),
            avatarUrl: Joi.string().allow('').optional()
        }),

        // 更新用户联系信息
        updateContact: Joi.object({
            nickname: Joi.string().allow('').optional(),
            contactName: Joi.string().allow('').optional().messages({
                'string.empty': '联系人姓名不能为空'
            }),
            contactPhone: Joi.string().pattern(/^1[3-9]\d{9}$/).allow('').optional().messages({
                'string.pattern.base': '请输入正确的手机号码'
            }),
            company: Joi.string().allow('').optional(),
            department: Joi.string().allow('').optional()
        })
    },

    // 会议室相关验证
    room: {
        // 创建会议室
        create: Joi.object({
            // 后端可自动生成 roomId，若不提供则由服务生成
            roomId: Joi.string().optional(),
            name: Joi.string().required().messages({
                'string.empty': '会议室名称不能为空',
                'any.required': '会议室名称是必填项'
            }),
            capacity: Joi.number().integer().min(1).required().messages({
                'number.base': '容纳人数必须是数字',
                'number.integer': '容纳人数必须是整数',
                'number.min': '容纳人数至少为1人',
                'any.required': '容纳人数是必填项'
            }),
            location: Joi.string().required().messages({
                'string.empty': '位置不能为空',
                'any.required': '位置是必填项'
            }),
            equipment: Joi.array().items(Joi.string().valid(
                '投屏设备', '麦克风', '音响系统', '白板', '电子白板',
                '视频会议设备', '网络接口/Wi-Fi', '空调', '电话', '饮水设备'
            )).optional(),
            description: Joi.string().max(500).allow('').optional(),
            images: Joi.array().items(Joi.string()).optional()
        }),

        // 更新会议室
        update: Joi.object({
            name: Joi.string().optional(),
            capacity: Joi.number().integer().min(1).optional(),
            location: Joi.string().optional(),
            equipment: Joi.array().items(Joi.string().valid(
                '投屏设备', '麦克风', '音响系统', '白板', '电子白板',
                '视频会议设备', '网络接口/Wi-Fi', '空调', '电话', '饮水设备'
            )).optional(),
            description: Joi.string().max(500).allow('').optional(),
            images: Joi.array().items(Joi.string()).optional()
        }),

        // 查询会议室列表
        list: Joi.object({
            search: Joi.string().allow('').optional(),
            capacityMin: Joi.number().integer().min(1).optional(),
            capacityMax: Joi.number().integer().min(1).optional(),
            equipment: Joi.alternatives([
                Joi.string(),
                Joi.array().items(Joi.string())
            ]).optional(),
            page: Joi.number().integer().min(1).default(1),
            limit: Joi.number().integer().min(1).max(100).default(10)
        })
    },

    // 预约相关验证
    booking: {
        // 创建预约
        create: Joi.object({
            roomId: Joi.string().required().messages({
                'string.empty': '会议室ID不能为空',
                'any.required': '会议室ID是必填项'
            }),
            bookingDate: Joi.date().required().messages({
                'date.base': '预约日期格式不正确',
                'any.required': '预约日期是必填项'
            }),
            startTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required().messages({
                'string.pattern.base': '开始时间格式应为 HH:MM',
                'any.required': '开始时间是必填项'
            }),
            endTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required().messages({
                'string.pattern.base': '结束时间格式应为 HH:MM',
                'any.required': '结束时间是必填项'
            }),
            topic: Joi.string().required().max(200).messages({
                'string.empty': '会议主题不能为空',
                'string.max': '会议主题不能超过200个字符',
                'any.required': '会议主题是必填项'
            }),
            contactName: Joi.string().required().messages({
                'string.empty': '联系人不能为空',
                'any.required': '联系人是必填项'
            }),
            contactPhone: Joi.string().pattern(/^1[3-9]\d{9}$/).required().messages({
                'string.pattern.base': '请输入正确的手机号码',
                'any.required': '联系方式是必填项'
            }),
            attendeesCount: Joi.number().integer().min(1).optional().messages({
                'number.base': '参会人数必须是数字',
                'number.integer': '参会人数必须是整数',
                'number.min': '参会人数至少为1人'
            })
        }),

        // 查询预约列表
        list: Joi.object({
            roomId: Joi.string().optional(),
            startDate: Joi.date().optional(),
            endDate: Joi.date().optional(),
            status: Joi.string().valid('booked', 'cancelled').optional(),
            page: Joi.number().integer().min(1).default(1),
            limit: Joi.number().integer().min(1).max(100).default(10)
        }),

        // 导出预约记录
        export: Joi.object({
            format: Joi.string().valid('excel', 'csv').default('excel'),
            date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
            status: Joi.string().valid('booked', 'completed', 'cancelled').optional(),
            startDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
            endDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional()
        })
    },

    // 临时关闭相关验证
    closure: {
        // 创建临时关闭
        create: Joi.object({
            roomId: Joi.string().required().messages({
                'string.empty': '会议室ID不能为空',
                'any.required': '会议室ID是必填项'
            }),
            closureDate: Joi.date().required().messages({
                'date.base': '关闭日期格式不正确',
                'any.required': '关闭日期是必填项'
            }),
            isAllDay: Joi.boolean().default(false),
            startTime: Joi.when('isAllDay', {
                is: false,
                then: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
                otherwise: Joi.string().optional()
            }),
            endTime: Joi.when('isAllDay', {
                is: false,
                then: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
                otherwise: Joi.string().optional()
            }),
            reason: Joi.string().max(200).allow('').optional()
        })
    },

    // MongoDB ObjectId 验证
    objectId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).messages({
        'string.pattern.base': 'ID格式不正确'
    })
};

/**
 * 验证中间件生成器
 * @param {object} schema Joi验证模式
 * @param {string} source 数据源：'body'、'query'、'params'
 * @returns {function} Express中间件函数
 */
function validate(schema, source = 'body') {
    return (req, res, next) => {
        const { error, value } = schema.validate(req[source], {
            abortEarly: false, // 返回所有验证错误
            allowUnknown: true, // 允许未知字段
            stripUnknown: true // 删除未知字段
        });

        if (error) {
            const errorMessages = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));

            return res.status(422).json({
                success: false,
                code: 422,
                message: '参数验证失败',
                details: errorMessages,
                timestamp: new Date().toISOString()
            });
        }

        // 将验证后的数据替换原始数据
        req[source] = value;
        next();
    };
}

module.exports = {
    schemas: validationSchemas,
    validate
};
