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
        },
        // 是否以嵌入模式展示（去除外层卡片样式）
        plain: {
            type: Boolean,
            value: false
        },
        // 最小可选日期
        minDate: {
            type: String,
            value: ''
        },
        // 最大可选日期
        maxDate: {
            type: String,
            value: ''
        },
        // 是否显示日期范围提示
        showDateRangeHint: {
            type: Boolean,
            value: true
        },
        // 自定义提示文案（显示在月份标题下方），优先于范围提示
        hintText: {
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
                // 年月参数无效，跳过API请求
                return;
            }
            
            this.setData({ loading: true });
            
            try {
                // 发起月度可用性请求
                
                // 使用request工具类而不是app.requestAPI
                const request = require('../../utils/request.js');
                const result = await request.get(
                    `/api/rooms/${this.data.roomId}/monthly-availability`,
                    { year: currentYear, month: currentMonth }
                );

                if (result.success && result.data) {
                    // 正常处理返回
                    // 后端返回的数据为 dailyAvailability: { 'YYYY-MM-DD': 'available|partial|booked|closed' }
                    // 这里直接保存为 monthlyAvailability，后续根据日期字符串匹配
                    const dailyAvailability = result.data.dailyAvailability || result.data.dates || {};
                    this.setData({ 
                        monthlyAvailability: dailyAvailability
                    });
                    // 调试：打印当月 25 号的原始状态
                    
                    this.updateCalendarDaysAvailability();
                    // 细化：对标记为 partial 的日期（且在允许预约范围内），进一步用日级接口核实是否真的已约满
                    this.refinePartialDaysAvailability();

                    // console: 月度可用性数据获取成功（保留必要信息）
                } else {
                    // 获取失败使用默认状态，静默降级
                    // 使用默认的可用性状态，避免界面空白
                    this.useDefaultAvailability();
                }
            } catch (error) {
                // 异常使用默认状态，静默降级
                // 使用默认的可用性状态，不显示错误提示
                this.useDefaultAvailability();
            } finally {
                this.setData({ loading: false });
            }
        },

        /**
         * 细化“部分可用”的日期：调用日级接口核查是否真的无可预约区间
         * 若无可预约区间，则将该日标记为 full（已约满）
         */
        async refinePartialDaysAvailability() {
            try {
                const { calendarDays, monthlyAvailability, roomId, minDate, maxDate } = this.data;
                if (!roomId || !calendarDays || !monthlyAvailability) return;

                // 选出本月内、未过去、范围内且月度为 partial 的日期
                const inRange = (dateStr) => {
                    if (minDate && dateStr < minDate) return false;
                    if (maxDate && dateStr > maxDate) return false;
                    return true;
                };

                const targets = calendarDays
                    .filter(d => d.isCurrentMonth && !d.isPast && inRange(d.date) && monthlyAvailability[d.date] === 'partial')
                    .map(d => d.date);

                // 限制数量，避免过多请求（优先靠前日期）
                const limited = targets.slice(0, 12);
                if (limited.length === 0) return;

                const request = require('../../utils/request.js');

                for (const dateStr of limited) {
                    try {
                        const resp = await request.get(`/api/rooms/${roomId}/availability`, { date: dateStr });
                        if (resp && resp.success && resp.data) {
                            const slots = resp.data.timeSlots || [];
                            const hasAvailable = Array.isArray(slots) && slots.some(s => s.status === 'available' && s.canBeStartTime);
                            if (!hasAvailable) {
                                const updated = this.data.calendarDays.map(d => (
                                    d.date === dateStr ? { ...d, availability: 'full', availableSlots: 0 } : d
                                ));
                                this.setData({ calendarDays: updated });
                            }
                        }
                    } catch (_) { /* 静默忽略 */ }
                }
            } catch (_) {}
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
            // 使用默认可用性状态（静默）
        },

        /**
         * 更新日历天数的可用性信息
         */
        updateCalendarDaysAvailability() {
            const { calendarDays, monthlyAvailability } = this.data;

            const mapServerStatus = (status) => {
                // 将服务端的日级状态映射为组件使用的三态
                switch (status) {
                    case 'booked':
                        return { availability: 'full', availableSlots: 0 };
                    case 'closed':
                        return { availability: 'unavailable', availableSlots: 0 };
                    case 'partial':
                        return { availability: 'available', availableSlots: 1 };
                    case 'available':
                        return { availability: 'available', availableSlots: 3 };
                    default:
                        return null;
                }
            };

            const updatedDays = calendarDays.map(day => {
                if (!day.isCurrentMonth) {
                    return day; // 非当前月份的日期不更新
                }

                // 优先按完整日期匹配，其次兼容旧格式按日号匹配
                // 先按完整日期键匹配（YYYY-MM-DD），兼容旧结构按“日号”匹配
                const dayKey = (day && typeof day.day !== 'undefined') ? String(day.day) : '';
                const raw = (monthlyAvailability[day.date] !== undefined)
                    ? monthlyAvailability[day.date]
                    : monthlyAvailability[dayKey];

                if (raw) {
                    if (typeof raw === 'string') {
                        const mapped = mapServerStatus(raw);
                        if (mapped) {
                            return {
                                ...day,
                                availability: mapped.availability,
                                availableSlots: mapped.availableSlots,
                                isWorkday: day.isWorkday
                            };
                        }
                    } else if (typeof raw === 'object') {
                        // 兼容对象格式 { availability, availableSlots, isWorkday, reason }
                        return {
                            ...day,
                            availability: raw.availability,
                            availableSlots: raw.availableSlots || 0,
                            isWorkday: raw.isWorkday,
                            reason: raw.reason
                        };
                    }
                }

                return day;
            });

            this.setData({ calendarDays: updatedDays });

            // 渲染完成
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
        },

        /**
         * 供父组件调用的刷新方法
         */
        refreshAvailability() {
            this.fetchMonthlyAvailability();
        }
    }
});
