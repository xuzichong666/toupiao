const storage = require("../../utils/storage");

Page({
  data: {
    id: "",
    poll: null,
    results: [],
    totalVotes: 0,
    participantCount: 0,
    hasVoted: false,
    isClosed: false,
    typeText: "",
    statusText: "",
    deadlineText: ""
  },

  onLoad(query) {
    this.setData({
      id: query.id || ""
    });
    this.loadResult();
  },

  onShow() {
    if (this.data.id) {
      this.loadResult();
    }
  },

  onShareAppMessage() {
    return {
      title: this.data.poll ? this.data.poll.title : "邀请你参与投票",
      path: `/pages/detail/detail?id=${this.data.id}`
    };
  },

  loadResult() {
    const poll = storage.getPoll(this.data.id);

    if (!poll) {
      this.setData({ poll: null });
      return;
    }

    const totalVotes = storage.getTotalVotes(poll);
    const topVotes = poll.options.reduce((max, option) => Math.max(max, option.votes), 0);
    const results = poll.options.map((option) => ({
      ...option,
      percent: totalVotes === 0 ? 0 : Math.round((option.votes / totalVotes) * 100),
      isTop: totalVotes > 0 && option.votes === topVotes
    }));

    this.setData({
      poll,
      results,
      totalVotes,
      participantCount: storage.getParticipantCount(poll),
      hasVoted: storage.hasVoted(poll.id),
      isClosed: storage.getRuntimeStatus(poll) !== "active",
      typeText: poll.type === "multiple" ? "多选" : "单选",
      statusText: storage.getStatusText(poll),
      deadlineText: storage.formatRemaining(poll.deadline)
    });
  },

  goDetail() {
    wx.navigateTo({
      url: `/pages/detail/detail?id=${this.data.poll.id}`
    });
  },

  copyLink() {
    wx.setClipboardData({
      data: `/pages/detail/detail?id=${this.data.poll.id}`,
      success() {
        wx.showToast({ title: "投票链接已复制", icon: "none" });
      }
    });
  },

  openMore() {
    if (!this.data.poll) {
      return;
    }

    const items = ["复制链接", "分享投票"];
    if (!this.data.isClosed) {
      items.push("结束投票");
      items.push("取消投票");
    }
    items.push("删除投票");

    wx.showActionSheet({
      itemList: items,
      success: (res) => {
        const action = items[res.tapIndex];
        this.handleAction(action);
      }
    });
  },

  handleAction(action) {
    if (action === "复制链接") {
      this.copyLink();
      return;
    }

    if (action === "分享投票") {
      wx.showToast({ title: "请使用右上角分享", icon: "none" });
      return;
    }

    if (action === "结束投票") {
      storage.endPoll(this.data.poll.id);
      wx.showToast({ title: "已结束", icon: "none" });
      this.loadResult();
      return;
    }

    if (action === "取消投票") {
      storage.cancelPoll(this.data.poll.id);
      wx.showToast({ title: "已取消", icon: "none" });
      this.loadResult();
      return;
    }

    if (action === "删除投票") {
      this.deletePoll();
    }
  },

  deletePoll() {
    if (!this.data.poll) {
      return;
    }

    wx.showModal({
      title: "确认删除投票？",
      content: "删除后投票和结果都无法恢复。",
      confirmText: "删除",
      confirmColor: "#d92d20",
      success: (res) => {
        if (!res.confirm) {
          return;
        }

        const deleted = storage.deletePoll(this.data.poll.id);
        wx.showToast({
          title: deleted ? "删除成功" : "投票不存在",
          icon: "none"
        });
        wx.reLaunch({
          url: "/pages/index/index"
        });
      }
    });
  },

  goHome() {
    wx.reLaunch({
      url: "/pages/index/index"
    });
  }
});
