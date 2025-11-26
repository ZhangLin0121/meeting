// 预约服务模块
const request = require('../../../utils/request.js');

class BookingService {
    /**
     * 提交预约
     * @param {Object} bookingData 预约数据
     * @param {string} userOpenId 用户openid
     * @returns {Promise<Object>} 提交结果
     */
    static async submitBooking(bookingData, userOpenId) {
        console.log('📝 提交预约数据:', bookingData);
        
        try {
            // 验证必填字段
            const validation = this.validateBookingData(bookingData);
            if (!validation.valid) {
                throw new Error(validation.message);
            }

            const response = await request.post('/api/bookings', {
                ...bookingData,
                userOpenId
            });
            
            console.log('✅ 预约提交成功:', response);
            return response;
        } catch (error) {
            console.error('❌ 预约提交失败:', error);
            throw error;
        }
    }

    /**
     * 验证预约数据
     * @param {Object} bookingData 预约数据
     * @returns {Object} 验证结果
     */
    static validateBookingData(bookingData) {
        const { roomId, bookingDate, startTime, endTime, topic, contactName, contactPhone, attendeesCount } = bookingData;
        
        if (!roomId) {
            return { valid: false, message: '房间ID不能为空' };
        }
        
        if (!bookingDate) {
            return { valid: false, message: '请选择预约日期' };
        }

        if (!startTime || !endTime) {
            return { valid: false, message: '请选择预约时间' };
        }

        if (!topic || topic.trim().length === 0) {
            return { valid: false, message: '请填写会议主题' };
        }

        if (!contactName || contactName.trim().length === 0) {
            return { valid: false, message: '请填写联系人姓名' };
        }

        if (!contactPhone || contactPhone.trim().length === 0) {
            return { valid: false, message: '请填写联系电话' };
        }

        // 验证电话号码格式
        const phoneRegex = /^1[3-9]\d{9}$/;
        if (!phoneRegex.test(contactPhone.trim())) {
            return { valid: false, message: '请填写正确的手机号码' };
        }

        if (!attendeesCount || attendeesCount < 1) {
            return { valid: false, message: '参会人数不能少于1人' };
        }
        
        return { valid: true };
    }

    /**
     * 预约整个时段
     * @param {string} periodId 时段ID
     * @param {Object} selectedPeriod 选中的时段
     * @param {Object} bookingForm 预约表单
     * @param {string} roomId 房间ID
     * @param {string} selectedDate 选中日期
     * @param {string} userOpenId 用户openid
     * @returns {Promise<Object>} 预约结果
     */
    static async bookWholePeriod(periodId, selectedPeriod, bookingForm, roomId, selectedDate, userOpenId) {
        console.log('📅 预约整时段:', { periodId, selectedPeriod });
        
        const bookingData = {
            roomId,
            bookingDate: selectedDate,
            startTime: selectedPeriod.startTime,
            endTime: selectedPeriod.endTime,
            topic: bookingForm.topic,
            contactName: bookingForm.contactName,
            contactPhone: bookingForm.contactPhone,
            attendeesCount: bookingForm.attendeesCount,
            requirements: bookingForm.requirements || '',
            isWholePeriod: true,
            periodId
        };

        return await this.submitBooking(bookingData, userOpenId);
    }

    /**
     * 获取用户个人信息
     * @param {string} userOpenId 用户openid
     * @returns {Promise<Object>} 用户信息
     */
    static async fetchUserProfile(userOpenId) {
        try {
            const response = await request.get('/api/user/profile');
            console.log('✅ 获取用户个人信息成功:', response);
            return response;
        } catch (error) {
            console.error('❌ 获取用户个人信息失败:', error);
            throw error;
        }
    }

    /**
     * 获取用户预约历史
     * @param {string} userOpenId 用户openid
     * @returns {Promise<Array>} 预约历史
     */
    static async fetchUserBookingHistory(userOpenId) {
        try {
            const response = await request.get('/api/user/bookings?limit=10&fields=contactName,contactPhone');

            console.log('✅ 获取用户预约历史成功:', response);
            // 确保返回的是数组格式
            if (response.success && response.data) {
                return response.data.bookings || response.data || [];
            }
            return [];
        } catch (error) {
            console.error('❌ 获取用户预约历史失败:', error);
            throw error;
        }
    }

    /**
     * 保存用户预约信息到本地存储
     * @param {string} contactName 联系人姓名
     * @param {string} contactPhone 联系电话
     */
    static saveUserBookingInfo(contactName, contactPhone) {
        try {
            const userBookingInfo = {
                contactName: contactName.trim(),
                contactPhone: contactPhone.trim(),
                lastUpdated: Date.now()
            };
            
            wx.setStorageSync('userBookingInfo', userBookingInfo);
            console.log('✅ 用户预约信息已保存到本地存储');
        } catch (error) {
            console.error('❌ 保存用户预约信息失败:', error);
        }
    }

    /**
     * 从本地存储获取用户预约信息
     * @returns {Object|null} 用户预约信息
     */
    static getUserBookingInfoFromStorage() {
        try {
            const savedUserInfo = wx.getStorageSync('userBookingInfo');
            
            if (savedUserInfo && savedUserInfo.contactName && savedUserInfo.contactPhone) {
                // 检查信息是否过期（30天）
                const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
                if (savedUserInfo.lastUpdated && savedUserInfo.lastUpdated > thirtyDaysAgo) {
                    console.log('✅ 从本地存储获取用户信息:', savedUserInfo);
                    return savedUserInfo;
                } else {
                    // 信息过期，清除本地存储
                    wx.removeStorageSync('userBookingInfo');
                    console.log('⚠️ 用户信息已过期，已清除');
                }
            }
            
            return null;
        } catch (error) {
            console.error('❌ 从本地存储获取用户信息失败:', error);
            return null;
        }
    }

    /**
     * 自动填充用户信息
     * @param {string} userOpenId 用户openid
     * @returns {Promise<Object>} 用户信息
     */
    static async autoFillUserInfo(userOpenId) {
        try {
            // 优先从用户个人信息获取 - 直接从数据库获取最新信息
            const userProfile = await this.fetchUserProfile(userOpenId);

            if (userProfile && userProfile.success && userProfile.data) {
                const userData = userProfile.data;

                // 检查用户是否有联系信息
                if (userData.contactName && userData.contactPhone) {
                    console.log('✅ 使用数据库用户信息自动填充');

                    // 同时更新本地缓存
                    this.saveUserBookingInfo(userData.contactName, userData.contactPhone);

                    return {
                        contactName: userData.contactName,
                        contactPhone: userData.contactPhone,
                        source: 'database'
                    };
                }
            }
        } catch (error) {
            console.log('⚠️ 获取数据库用户信息失败，尝试其他方式:', error);
        }

        // 备用方案1：从预约历史获取
        try {
            const bookingHistory = await this.fetchUserBookingHistory(userOpenId);

            if (bookingHistory && bookingHistory.length > 0) {
                const latestBooking = bookingHistory[0];
                if (latestBooking.contactName && latestBooking.contactPhone) {
                    console.log('✅ 使用预约历史自动填充');

                    // 更新本地缓存
                    this.saveUserBookingInfo(latestBooking.contactName, latestBooking.contactPhone);

                    return {
                        contactName: latestBooking.contactName,
                        contactPhone: latestBooking.contactPhone,
                        source: 'history'
                    };
                }
            }
        } catch (error) {
            console.log('⚠️ 获取预约历史失败，使用本地存储:', error);
        }

        // 备用方案2：从本地存储获取
        const localInfo = this.getUserBookingInfoFromStorage();
        if (localInfo) {
            return {
                contactName: localInfo.contactName,
                contactPhone: localInfo.contactPhone,
                source: 'local'
            };
        }

        return null;
    }

    /**
     * 保存表单缓存
     * @param {Object} formData 表单数据
     */
    static saveFormCache(formData) {
        try {
            const cacheData = {
                ...formData,
                timestamp: Date.now()
            };
            
            wx.setStorageSync('roomDetail_formCache', cacheData);
            console.log('✅ 表单数据已缓存');
        } catch (error) {
            console.error('❌ 保存表单缓存失败:', error);
        }
    }

    /**
     * 恢复表单缓存
     * @returns {Object|null} 缓存的表单数据
     */
    static restoreFormCache() {
        try {
            const cacheData = wx.getStorageSync('roomDetail_formCache');
            
            if (cacheData && cacheData.timestamp) {
                // 检查缓存是否过期（1小时）
                const oneHourAgo = Date.now() - (60 * 60 * 1000);
                if (cacheData.timestamp > oneHourAgo) {
                    console.log('✅ 恢复表单缓存数据');
                    return cacheData;
                } else {
                    // 缓存过期，清除
                    this.clearFormCache();
                    console.log('⚠️ 表单缓存已过期，已清除');
                }
            }
            
            return null;
        } catch (error) {
            console.error('❌ 恢复表单缓存失败:', error);
            return null;
        }
    }

    /**
     * 清除表单缓存
     */
    static clearFormCache() {
        try {
            wx.removeStorageSync('roomDetail_formCache');
            console.log('✅ 表单缓存已清除');
        } catch (error) {
            console.error('❌ 清除表单缓存失败:', error);
        }
    }
}

module.exports = BookingService; 