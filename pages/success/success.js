const storage = require("../../utils/storage");

Page({
  data: {
    id: "",
    poll: null,
    participantCount: 0
  },

  onLoad(query) {
    const id = query.id || "";
    const poll = storage.getPoll(id);
    this.setData({
      id,
      poll,
      participantCount: poll ? storage.getParticipantCount(poll) : 0
    });
  },

  onShareAppMessage() {
    return {
      title: this.data.poll ? this.data.poll.title : "邀请你参与投票",
      path: `/pages/detail/detail?id=${this.data.id}`
    };
  },

  copyLink() {
    wx.setClipboardData({
      data: `/pages/detail/detail?id=${this.data.id}`,
      success() {
        wx.showToast({ title: "投票链接已复制", icon: "none" });
      }
    });
  },

  goDetail() {
    wx.redirectTo({
      url: `/pages/detail/detail?id=${this.data.id}`
    });
  },

  goHome() {
    wx.reLaunch({
      url: "/pages/index/index"
    });
  }
});
