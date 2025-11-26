Page({
  data: { statusBarHeight: 20 },
  onLoad() {
    try {
      const wi = wx.getWindowInfo && wx.getWindowInfo();
      this.setData({ statusBarHeight: (wi && wi.statusBarHeight) || 20 });
    } catch (_) {}
  },
  goBack() { wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/profile/profile' }) }); }
});
