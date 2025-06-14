const fs = require('fs');
const path = require('path');

/**
 * 创建占位图片
 * 为系统提供基本的图标和会议室图片，确保功能正常运行
 */

// 简单的SVG图标转Base64的函数
function createSVGIcon(svgContent, filename, targetDir) {
    const base64 = Buffer.from(svgContent).toString('base64');
    const dataURL = `data:image/svg+xml;base64,${base64}`;

    // 这里我们将创建一个简单的HTML文件来展示图标，但实际项目中应该保存为PNG
    // 为了简化，我们直接创建SVG文件
    const svgPath = path.join(targetDir, filename.replace('.png', '.png'));
    fs.writeFileSync(svgPath, svgContent);
    console.log(`✅ 创建SVG图标: ${filename.replace('.png', '.png')}`);
}

// 创建简单的占位图片（使用SVG格式）
function createPlaceholderImages() {
    console.log('🎨 创建占位图片和图标...\n');

    // 确保目录存在
    const iconDir = path.resolve(__dirname, '../frontend/images/icons');
    const imageDir = path.resolve(__dirname, '../frontend/images');
    const roomDir = path.resolve(__dirname, './uploads/rooms');

    [iconDir, imageDir, roomDir].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`📁 创建目录: ${dir}`);
        }
    });

    // 创建搜索图标
    const searchIcon = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="11" cy="11" r="8" stroke="#666" stroke-width="2"/>
        <path d="m21 21-4.35-4.35" stroke="#666" stroke-width="2"/>
    </svg>`;
    createSVGIcon(searchIcon, 'search.png', iconDir);

    // 创建灰色搜索图标
    const searchGreyIcon = `
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8.5" cy="8.5" r="6" stroke="#999" stroke-width="1.5"/>
        <path d="m15.75 15.75-3.3-3.3" stroke="#999" stroke-width="1.5"/>
    </svg>`;
    createSVGIcon(searchGreyIcon, 'search-grey.png', iconDir);

    // 创建筛选图标
    const filterIcon = `
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 3h12M4 8h8M6 13h4" stroke="#666" stroke-width="2" stroke-linecap="round"/>
    </svg>`;
    createSVGIcon(filterIcon, 'filter.png', iconDir);

    // 创建空状态图标
    const emptyIcon = `
    <svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="10" y="20" width="80" height="60" rx="4" stroke="#ccc" stroke-width="2" fill="none"/>
        <path d="M30 40h40M30 50h30M30 60h25" stroke="#ccc" stroke-width="2" stroke-linecap="round"/>
        <circle cx="25" cy="25" r="3" fill="#ccc"/>
    </svg>`;
    createSVGIcon(emptyIcon, 'empty.png', iconDir);

    // 创建管理员图标
    const adminIcon = `
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="11" cy="6" r="4" stroke="#666" stroke-width="2"/>
        <path d="M4 20v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" stroke="#666" stroke-width="2"/>
        <path d="M16 8l2 2-2 2" stroke="#f60" stroke-width="2"/>
    </svg>`;
    createSVGIcon(adminIcon, 'admin.png', iconDir);

    // 创建会议室默认图标
    const roomIcon = `
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="10" y="20" width="100" height="80" rx="8" stroke="#4A90E2" stroke-width="3" fill="#f8f9fa"/>
        <rect x="25" y="35" width="70" height="40" rx="4" stroke="#4A90E2" stroke-width="2" fill="none"/>
        <circle cx="40" cy="55" r="6" fill="#4A90E2"/>
        <circle cx="60" cy="55" r="6" fill="#4A90E2"/>
        <circle cx="80" cy="55" r="6" fill="#4A90E2"/>
        <rect x="30" y="85" width="60" height="8" rx="2" fill="#4A90E2"/>
        <text x="60" y="98" text-anchor="middle" font-family="Arial" font-size="8" fill="#666">会议室</text>
    </svg>`;
    createSVGIcon(roomIcon, 'default_room.png', imageDir);

    // 创建会议室图片（使用SVG绘制）
    const roomImages = [{
            name: 'admin_meeting_room_1.png',
            content: `
            <svg width="500" height="300" viewBox="0 0 500 300" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="500" height="300" fill="#f5f5f5"/>
                <rect x="50" y="50" width="400" height="200" rx="8" fill="#ffffff" stroke="#ddd"/>
                <rect x="100" y="100" width="300" height="100" rx="4" fill="#4A90E2" opacity="0.1"/>
                <text x="250" y="150" text-anchor="middle" font-family="Arial" font-size="16" fill="#4A90E2">行政会议室</text>
                <text x="250" y="170" text-anchor="middle" font-family="Arial" font-size="12" fill="#666">Executive Meeting Room</text>
            </svg>`
        },
        {
            name: 'creative_room_1.png',
            content: `
            <svg width="500" height="300" viewBox="0 0 500 300" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="500" height="300" fill="#fff8e1"/>
                <rect x="50" y="50" width="400" height="200" rx="8" fill="#ffffff" stroke="#ffc107"/>
                <text x="250" y="150" text-anchor="middle" font-family="Arial" font-size="16" fill="#f57c00">创意讨论室</text>
                <text x="250" y="170" text-anchor="middle" font-family="Arial" font-size="12" fill="#666">Creative Discussion Room</text>
            </svg>`
        },
        {
            name: 'large_conference_hall_1.png',
            content: `
            <svg width="500" height="300" viewBox="0 0 500 300" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="500" height="300" fill="#e8f5e8"/>
                <rect x="30" y="30" width="440" height="240" rx="8" fill="#ffffff" stroke="#4caf50"/>
                <text x="250" y="150" text-anchor="middle" font-family="Arial" font-size="18" fill="#2e7d32">大型会议厅</text>
                <text x="250" y="170" text-anchor="middle" font-family="Arial" font-size="12" fill="#666">Large Conference Hall</text>
            </svg>`
        },
        {
            name: 'small_meeting_room_1.png',
            content: `
            <svg width="500" height="300" viewBox="0 0 500 300" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="500" height="300" fill="#fce4ec"/>
                <rect x="100" y="75" width="300" height="150" rx="8" fill="#ffffff" stroke="#e91e63"/>
                <text x="250" y="150" text-anchor="middle" font-family="Arial" font-size="14" fill="#c2185b">小型洽谈室</text>
                <text x="250" y="170" text-anchor="middle" font-family="Arial" font-size="10" fill="#666">Small Meeting Room</text>
            </svg>`
        },
        {
            name: 'training_room_1.png',
            content: `
            <svg width="500" height="300" viewBox="0 0 500 300" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="500" height="300" fill="#f3e5f5"/>
                <rect x="50" y="50" width="400" height="200" rx="8" fill="#ffffff" stroke="#9c27b0"/>
                <text x="250" y="150" text-anchor="middle" font-family="Arial" font-size="16" fill="#7b1fa2">培训教室</text>
                <text x="250" y="170" text-anchor="middle" font-family="Arial" font-size="12" fill="#666">Training Room</text>
            </svg>`
        },
        {
            name: 'video_conference_room_1.png',
            content: `
            <svg width="500" height="300" viewBox="0 0 500 300" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="500" height="300" fill="#e0f2f1"/>
                <rect x="50" y="50" width="400" height="200" rx="8" fill="#ffffff" stroke="#009688"/>
                <text x="250" y="150" text-anchor="middle" font-family="Arial" font-size="16" fill="#00695c">视频会议室</text>
                <text x="250" y="170" text-anchor="middle" font-family="Arial" font-size="12" fill="#666">Video Conference Room</text>
            </svg>`
        }
    ];

    // 创建会议室图片
    roomImages.forEach(img => {
        const svgPath = path.join(roomDir, img.name);
        fs.writeFileSync(svgPath, img.content);
        console.log(`✅ 创建会议室图片: ${img.name}`);
    });

    console.log('\n✅ 占位图片创建完成!');
    console.log('\n📋 创建的文件清单:');
    console.log('图标文件:');
    console.log('  - search.png (搜索图标)');
    console.log('  - search-grey.png (灰色搜索图标)');
    console.log('  - filter.png (筛选图标)');
    console.log('  - empty.png (空状态图标)');
    console.log('  - admin.png (管理员图标)');
    console.log('  - default_room.png (默认会议室图标)');
    console.log('\n会议室图片:');
    roomImages.forEach(img => {
        console.log(`  - ${img.name}`);
    });
    console.log('\n💡 提示: SVG文件可以在现代浏览器中直接使用，也可以转换为PNG格式');
}

// 如果直接运行此脚本
if (require.main === module) {
    createPlaceholderImages();
}

module.exports = { createPlaceholderImages };