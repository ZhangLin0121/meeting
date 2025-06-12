/**
 * 统一的API响应处理工具
 */
class ResponseHelper {

    /**
     * 成功响应
     * @param {object} res Express响应对象
     * @param {any} data 响应数据
     * @param {string} message 响应消息
     * @param {number} code 状态码，默认200
     */
    static success(res, data = null, message = '操作成功', code = 200) {
        return res.status(code).json({
            success: true,
            code,
            message,
            data,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * 错误响应
     * @param {object} res Express响应对象
     * @param {string} message 错误消息
     * @param {number} code 状态码，默认400
     * @param {any} details 错误详情
     */
    static error(res, message = '操作失败', code = 400, details = null) {
        return res.status(code).json({
            success: false,
            code,
            message,
            details,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * 验证错误响应
     * @param {object} res Express响应对象
     * @param {string} message 错误消息
     * @param {any} validationErrors 验证错误详情
     */
    static validationError(res, message = '参数验证失败', validationErrors = null) {
        return this.error(res, message, 422, validationErrors);
    }

    /**
     * 未授权响应
     * @param {object} res Express响应对象
     * @param {string} message 错误消息
     */
    static unauthorized(res, message = '未授权访问') {
        return this.error(res, message, 401);
    }

    /**
     * 禁止访问响应
     * @param {object} res Express响应对象
     * @param {string} message 错误消息
     */
    static forbidden(res, message = '禁止访问') {
        return this.error(res, message, 403);
    }

    /**
     * 资源未找到响应
     * @param {object} res Express响应对象
     * @param {string} message 错误消息
     */
    static notFound(res, message = '资源不存在') {
        return this.error(res, message, 404);
    }

    /**
     * 服务器内部错误响应
     * @param {object} res Express响应对象
     * @param {string} message 错误消息
     * @param {any} details 错误详情
     */
    static serverError(res, message = '服务器内部错误', details = null) {
        return this.error(res, message, 500, details);
    }

    /**
     * 分页响应
     * @param {object} res Express响应对象
     * @param {array} data 数据列表
     * @param {object} pagination 分页信息
     * @param {string} message 响应消息
     */
    static paginated(res, data, pagination, message = '获取成功') {
        return res.status(200).json({
            success: true,
            code: 200,
            message,
            data,
            pagination: {
                page: pagination.page || 1,
                limit: pagination.limit || 10,
                total: pagination.total || 0,
                pages: Math.ceil((pagination.total || 0) / (pagination.limit || 10))
            },
            timestamp: new Date().toISOString()
        });
    }
}

module.exports = ResponseHelper;