Component({
    properties: {
        // 会议室ID
        roomId: {
            type: String,
            value: ''
        },
        // 选中的日期
        selectedDate: {
            type: String,
            value: ''
        }
    },

    data: {
        currentYear: 0,
        currentMonth: 0,
        calendarDays: [], // 日历显示的日期数组
        monthlyAvailability: {}, // 月度可用性数据
        loading: false,
        today: '',
        
        // 日历显示相关
        weekdays: ['日', '一', '二', '三', '四', '五', '六'],
        monthNames: ['一月', '二月', '三月', '四月', '五月', '六月', 
                    '七月', '八月', '九月', '十月', '十一月', '十二月']
    },

    lifetimes: {
        attached() {
            this.initializeCalendar();
        }
    },

    observers: {
        'roomId': function(newRoomId) {
            if (newRoomId && this.data.currentYear && this.data.currentMonth) {
                this.fetchMonthlyAvailability();
            }
        }
    },

    methods: {
        /**
         * 初始化日历
         */
        initializeCalendar() {
            const today = new Date();
            this.setData({
                currentYear: today.getFullYear(),
                currentMonth: today.getMonth() + 1,
                today: this.formatDateString(today)
            });
            this.generateCalendarDays();
            if (this.data.roomId) {
                this.fetchMonthlyAvailability();
            }
        },

        /**
         * 生成日历天数数组
         */
        generateCalendarDays() {
            const { currentYear, currentMonth } = this.data;
            const firstDay = new Date(currentYear, currentMonth - 1, 1);
            const lastDay = new Date(currentYear, currentMonth, 0);
            const startDate = new Date(firstDay);
            
            // 计算第一天是周几（0-6）
            const firstDayOfWeek = firstDay.getDay();
            
            // 往前推到周日，填充上个月的日期
            startDate.setDate(startDate.getDate() - firstDayOfWeek);
            
            // 计算需要的周数（智能显示，最少5周，最多6周）
            const daysInMonth = lastDay.getDate();
            const weeksNeeded = Math.ceil((firstDayOfWeek + daysInMonth) / 7);
            const totalDays = Math.max(35, weeksNeeded * 7); // 最少5周，动态计算
            
            const calendarDays = [];
            const today = new Date();
            
            // 生成计算出的天数
            for (let i = 0; i < totalDays; i++) {
                const currentDate = new Date(startDate);
                currentDate.setDate(startDate.getDate() + i);
                
                const day = currentDate.getDate();
                const month = currentDate.getMonth() + 1;
                const year = currentDate.getFullYear();
                const dateString = this.formatDateString(currentDate);
                
                calendarDays.push({
                    day: day,
                    date: dateString,
                    isCurrentMonth: month === currentMonth,
                    isToday: dateString === this.data.today,
                    isSelected: dateString === this.data.selectedDate,
                    isPast: currentDate < new Date(today.getFullYear(), today.getMonth(), today.getDate()),
                    availability: currentDate < new Date(today.getFullYear(), today.getMonth(), today.getDate()) ? 'past' : 'available', // 过去的日期标记为past，其他为available
                    availableSlots: currentDate < new Date(today.getFullYear(), today.getMonth(), today.getDate()) ? 0 : 3, // 假设非过去日期有3个时段可用
                    isWorkday: true
                });
            }
            
            this.setData({ calendarDays });
        },

        /**
         * 获取月度可用性数据
         */
        async fetchMonthlyAvailability() {
            if (!this.data.roomId) return;
            
            // 检查年月参数的有效性，避免在初始化过程中发送无效请求
            const { currentYear, currentMonth } = this.data;
            if (!currentYear || !currentMonth || currentYear === 0 || currentMonth === 0) {
                console.log('📅 年月参数无效，跳过API请求:', { currentYear, currentMonth });
                return;
            }
            
            this.setData({ loading: true });
            
            try {
                console.log('📅 获取月度可用性:', {
                    roomId: this.data.roomId,
                    year: currentYear,
                    month: currentMonth
                });
                
                // 使用request工具类而不是app.requestAPI
                const request = require('../../utils/request.js');
                const result = await request.get(
                    `/api/rooms/${this.data.roomId}/monthly-availability`,
                    { year: currentYear, month: currentMonth }
                );
                
                if (result.success && result.data) {
                    this.setData({ 
                        monthlyAvailability: result.data.dates || {}
                    });
                    this.updateCalendarDaysAvailability();
                    
                    console.log('📊 月度可用性数据获取成功:', result.data.summary);
                } else {
                    console.warn('⚠️ 获取月度可用性失败，使用默认状态:', result.message);
                    // 使用默认的可用性状态，避免界面空白
                    this.useDefaultAvailability();
                }
            } catch (error) {
                console.warn('⚠️ 获取月度可用性异常，使用默认状态:', error);
                // 使用默认的可用性状态，不显示错误提示
                this.useDefaultAvailability();
            } finally {
                this.setData({ loading: false });
            }
        },

        /**
         * 使用默认可用性状态（当API失败时的备选方案）
         */
        useDefaultAvailability() {
            const { calendarDays } = this.data;
            const today = new Date();
            
            const updatedDays = calendarDays.map(day => {
                if (!day.isCurrentMonth) {
                    return day; // 非当前月份的日期不更新
                }
                
                const dayDate = new Date(day.date);
                const isPast = dayDate < new Date(today.getFullYear(), today.getMonth(), today.getDate());
                
                return {
                    ...day,
                    availability: isPast ? 'past' : 'available',
                    availableSlots: isPast ? 0 : 3,
                    isWorkday: true
                };
            });
            
            this.setData({ calendarDays: updatedDays });
            console.log('📋 使用默认可用性状态');
        },

        /**
         * 更新日历天数的可用性信息
         */
        updateCalendarDaysAvailability() {
            const { calendarDays, monthlyAvailability } = this.data;
            
            const updatedDays = calendarDays.map(day => {
                if (!day.isCurrentMonth) {
                    return day; // 非当前月份的日期不更新
                }
                
                const dayStr = day.day.toString();
                const dayData = monthlyAvailability[dayStr];
                
                if (dayData) {
                    return {
                        ...day,
                        availability: dayData.availability,
                        availableSlots: dayData.availableSlots || 0,
                        isWorkday: dayData.isWorkday,
                        reason: dayData.reason
                    };
                }
                
                return day;
            });
            
            this.setData({ calendarDays: updatedDays });
        },

        /**
         * 切换到上个月
         */
        goToPrevMonth() {
            let { currentYear, currentMonth } = this.data;
            
            currentMonth--;
            if (currentMonth < 1) {
                currentMonth = 12;
                currentYear--;
            }
            
            this.setData({ currentYear, currentMonth });
            this.generateCalendarDays();
            this.fetchMonthlyAvailability();
        },

        /**
         * 切换到下个月
         */
        goToNextMonth() {
            let { currentYear, currentMonth } = this.data;
            
            currentMonth++;
            if (currentMonth > 12) {
                currentMonth = 1;
                currentYear++;
            }
            
            this.setData({ currentYear, currentMonth });
            this.generateCalendarDays();
            this.fetchMonthlyAvailability();
        },

        /**
         * 日期点击事件
         */
        onDateTap(e) {
            const { index } = e.currentTarget.dataset;
            const day = this.data.calendarDays[index];
            
            if (!day.isCurrentMonth || day.isPast || day.availability === 'unavailable') {
                return; // 不可选择的日期
            }
            
            if (day.availability === 'full') {
                wx.showToast({
                    title: '该日期已约满',
                    icon: 'none'
                });
                return;
            }
            
            // 更新选中状态
            const updatedDays = this.data.calendarDays.map((d, i) => ({
                ...d,
                isSelected: i === index
            }));
            
            this.setData({ 
                calendarDays: updatedDays,
                selectedDate: day.date
            });
            
            // 通知父组件日期选择变化
            this.triggerEvent('datechange', {
                date: day.date,
                availability: day.availability,
                availableSlots: day.availableSlots
            });
        },

        /**
         * 格式化日期字符串
         */
        formatDateString(date) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        },

        /**
         * 获取日期状态的样式类名
         */
        getDateStatusClass(availability, isPast, isCurrentMonth) {
            if (!isCurrentMonth) return 'other-month';
            if (isPast) return 'past-date';
            
            switch (availability) {
                case 'available':
                    return 'available-date';
                case 'full':
                    return 'full-date';
                case 'unavailable':
                    return 'unavailable-date';
                default:
                    return 'unknown-date';
            }
        }
    }
});