// 调试状态栏高度的脚本
// 在微信开发者工具的控制台中运行

console.log('🔍 开始调试状态栏高度...');

// 获取系统信息
const systemInfo = wx.getSystemInfoSync();
console.log('📱 完整系统信息:', systemInfo);

// 重点检查状态栏相关信息
console.log('📏 状态栏高度:', systemInfo.statusBarHeight);
console.log('📱 设备型号:', systemInfo.model);
console.log('📱 系统版本:', systemInfo.system);
console.log('📱 微信版本:', systemInfo.version);
console.log('📱 屏幕宽度:', systemInfo.screenWidth);
console.log('📱 屏幕高度:', systemInfo.screenHeight);
console.log('📱 可用高度:', systemInfo.windowHeight);
console.log('📱 可用宽度:', systemInfo.windowWidth);

// 获取胶囊按钮信息
try {
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect();
    console.log('🔘 胶囊按钮信息:', menuButtonInfo);
    console.log('🔘 胶囊按钮顶部位置:', menuButtonInfo.top);
    console.log('🔘 胶囊按钮高度:', menuButtonInfo.height);
} catch (error) {
    console.log('❌ 获取胶囊按钮信息失败:', error);
}

// 计算导航栏高度
const statusBarHeight = systemInfo.statusBarHeight || 44;
console.log('✅ 最终使用的状态栏高度:', statusBarHeight);

// 检查页面元素
setTimeout(() => {
    const navbar = document.querySelector('.custom-navbar');
    if (navbar) {
        console.log('📐 导航栏元素样式:', window.getComputedStyle(navbar));
        console.log('📐 导航栏位置:', navbar.getBoundingClientRect());
    } else {
        console.log('❌ 未找到导航栏元素');
    }
}, 1000);