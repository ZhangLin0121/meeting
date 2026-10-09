const nodemailer = require('nodemailer');
const TimeHelper = require('../utils/timeHelper');

function flag(name, def = false) {
    const val = process.env[name];
    if (val === undefined) return def;
    return String(val).trim().toLowerCase() !== '0' && !['false', 'no', 'off'].includes(String(val).trim().toLowerCase());
}

function getRecipients() {
    const raw = process.env.EMAIL_TO || process.env.EMAIL_SMTP_TO || '';
    return raw
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean);
}

function buildTransport() {
    const host = process.env.EMAIL_SMTP_HOST || process.env.EMAIL_HOST;
    const port = parseInt(process.env.EMAIL_SMTP_PORT || process.env.EMAIL_PORT || '465', 10);
    const user = process.env.EMAIL_SMTP_USER || process.env.EMAIL_USER;
    const pass = process.env.EMAIL_SMTP_PASSWORD || process.env.EMAIL_PASSWORD;
    if (!host || !port || !user || !pass) {
        return null;
    }
    const secure = flag('EMAIL_USE_SSL', port === 465);
    const useStarttls = flag('EMAIL_USE_STARTTLS', port === 587);

    const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
        tls: useStarttls ? { ciphers: 'TLSv1.2' } : undefined,
    });
    return transporter;
}

async function sendMail({ subject, text }) {
    if (!flag('EMAIL_NOTIFY', false)) return;
    const transporter = buildTransport();
    if (!transporter) return;
    const from = process.env.EMAIL_FROM || process.env.EMAIL_SMTP_USER || process.env.EMAIL_USER;
    const to = getRecipients();
    if (!from || !to.length) return;
    await transporter.sendMail({ from, to, subject, text });
}

async function sendBookingCreated({ booking, room, user }) {
    try {
        const dateStr = TimeHelper.formatDate(booking.bookingDate);
        const subject = process.env.EMAIL_SUBJECT || `会议室预约成功通知 - ${dateStr}`;
        const lines = [
            `会议室：${room.name || room.location || ''}`,
            `地点：${room.location || ''}`,
            `日期：${dateStr}`,
            `时间：${booking.startTime} - ${booking.endTime}`,
            `主题：${booking.topic || '（未填写）'}`,
            `预约人：${booking.userName || (user && user.contactName) || (user && user.nickname) || ''}`,
            `联系电话：${booking.userPhone || (user && user.contactPhone) || ''}`,
            `参会人数：${booking.attendeesCount || ''}`,
            `创建时间：${TimeHelper.now().format('YYYY-MM-DD HH:mm:ss')}`,
        ];
        await sendMail({ subject, text: lines.join('\n') });
    } catch (err) {
        console.error('发送预约邮件失败:', err);
    }
}

module.exports = {
    sendBookingCreated,
};
