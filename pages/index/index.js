const storage = require("../../utils/storage");

const FILTERS = [
  { key: "all", label: "全部" },
  { key: "created", label: "我发起的" },
  { key: "joined", label: "我参与的" },
  { key: "ended", label: "已结束" }
];

Page({
  data: {
    filters: FILTERS,
    activeFilter: "all",
    polls: [],
    hasPolls: false,
    emptyText: "创建一个问题，添加选项，就可以开始收集选择。"
  },

  onShow() {
    this.loadPolls();
  },

  onShareAppMessage() {
    return {
      title: "共识投票：小分歧，大共识",
      path: "/pages/index/index"
    };
  },

  loadPolls() {
    const allPolls = storage.getPolls().map((poll) => this.decoratePoll(poll));
    const polls = this.filterPolls(allPolls, this.data.activeFilter);

    this.setData({
      polls,
      hasPolls: polls.length > 0,
      emptyText: this.getEmptyText(this.data.activeFilter)
    });
  },

  decoratePoll(poll) {
    const totalVotes = storage.getTotalVotes(poll);
    const leading = storage.getLeadingOption(poll);
    const leadingPercent = totalVotes === 0 ? 0 : Math.round((leading.votes / totalVotes) * 100);
    const status = storage.getRuntimeStatus(poll);
    const hasVoted = storage.hasVoted(poll.id);

    return {
      ...poll,
      typeText: poll.type === "multiple" ? "多选" : "单选",
      categoryText: poll.category || "日常投票",
      totalVotes,
      participantCount: storage.getParticipantCount(poll),
      optionCount: poll.options.length,
      createdAtText: storage.formatDate(poll.createdAt),
      deadlineText: storage.formatRemaining(poll.deadline),
      status,
      statusText: storage.getStatusText(poll),
      statusClass: storage.isEndingSoon(poll) ? "ending" : status,
      hasVoted,
      leadingText: leading && totalVotes > 0 ? leading.text : "暂无领先选项",
      leadingPercent,
      canJoin: status === "active" && !hasVoted
    };
  },

  filterPolls(polls, filter) {
    if (filter === "created") {
      return polls.filter((poll) => poll.creatorId === storage.LOCAL_USER_ID);
    }

    if (filter === "joined") {
      return polls.filter((poll) => poll.hasVoted);
    }

    if (filter === "ended") {
      return polls.filter((poll) => poll.status === "ended" || poll.status === "canceled");
    }

    return polls;
  },

  getEmptyText(filter) {
    const textMap = {
      created: "你还没有发起投票，先创建一个选择题。",
      joined: "你还没有参与投票，可以从全部列表里选择一个。",
      ended: "当前没有已结束或已取消的投票。",
      all: "创建一个问题，添加选项，就可以开始收集选择。"
    };
    return textMap[filter] || textMap.all;
  },

  switchFilter(event) {
    this.setData({
      activeFilter: event.currentTarget.dataset.key
    }, () => this.loadPolls());
  },

  goCreate() {
    wx.navigateTo({
      url: "/pages/create/create"
    });
  },

  goDetail(event) {
    const { id } = event.currentTarget.dataset;
    const poll = storage.getPoll(id);

    if (!poll) {
      wx.showToast({ title: "投票不存在", icon: "none" });
      this.loadPolls();
      return;
    }

    if (storage.getRuntimeStatus(poll) !== "active" || storage.hasVoted(id)) {
      this.goResult(event);
      return;
    }

    wx.navigateTo({
      url: `/pages/detail/detail?id=${id}`
    });
  },

  goResult(event) {
    const { id } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/result/result?id=${id}`
    });
  },

  openActions(event) {
    const { id } = event.currentTarget.dataset;
    const poll = storage.getPoll(id);

    if (!poll) {
      wx.showToast({ title: "投票不存在", icon: "none" });
      this.loadPolls();
      return;
    }

    const status = storage.getRuntimeStatus(poll);
    const items = ["复制链接", "分享投票"];

    if (status === "active") {
      items.push("结束投票");
      items.push("取消投票");
    }

    items.push("删除投票");

    wx.showActionSheet({
      itemList: items,
      success: (res) => {
        const action = items[res.tapIndex];
        this.handleAction(action, poll.id);
      }
    });
  },

  handleAction(action, id) {
    if (action === "复制链接") {
      this.copyLink(id);
      return;
    }

    if (action === "分享投票") {
      wx.showToast({ title: "请使用右上角分享", icon: "none" });
      return;
    }

    if (action === "结束投票") {
      storage.endPoll(id);
      wx.showToast({ title: "已结束", icon: "none" });
      this.loadPolls();
      return;
    }

    if (action === "取消投票") {
      storage.cancelPoll(id);
      wx.showToast({ title: "已取消", icon: "none" });
      this.loadPolls();
      return;
    }

    if (action === "删除投票") {
      this.confirmDelete(id);
    }
  },

  copyLink(id) {
    wx.setClipboardData({
      data: `/pages/detail/detail?id=${id}`,
      success() {
        wx.showToast({ title: "投票链接已复制", icon: "none" });
      }
    });
  },

  confirmDelete(id) {
    wx.showModal({
      title: "确认删除投票？",
      content: "删除后投票和结果都无法恢复。",
      confirmText: "删除",
      confirmColor: "#d92d20",
      success: (res) => {
        if (!res.confirm) {
          return;
        }

        storage.deletePoll(id);
        wx.showToast({ title: "已删除", icon: "none" });
        this.loadPolls();
      }
    });
  }
});
