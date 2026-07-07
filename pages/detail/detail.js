const storage = require("../../utils/storage");

Page({
  data: {
    id: "",
    poll: null,
    selectedIds: [],
    hasVoted: false,
    isClosed: false,
    selectedCountText: "",
    typeText: "",
    ruleText: "",
    statusText: "",
    deadlineText: ""
  },

  onLoad(query) {
    this.setData({
      id: query.id || ""
    });
    this.loadPoll();
  },

  onShow() {
    if (this.data.id) {
      this.loadPoll();
    }
  },

  onShareAppMessage() {
    return {
      title: this.data.poll ? this.data.poll.title : "邀请你参与投票",
      path: `/pages/detail/detail?id=${this.data.id}`
    };
  },

  loadPoll() {
    const poll = storage.getPoll(this.data.id);

    if (!poll) {
      this.setData({ poll: null });
      return;
    }

    const hasVoted = storage.hasVoted(poll.id);
    const status = storage.getRuntimeStatus(poll);
    const isClosed = status !== "active";
    const selectedIds = hasVoted || isClosed ? [] : this.data.selectedIds;

    this.setData({
      poll: this.decoratePoll(poll, selectedIds),
      selectedIds,
      hasVoted,
      isClosed,
      selectedCountText: this.getSelectedCountText(poll, selectedIds),
      typeText: poll.type === "multiple" ? "多选" : "单选",
      ruleText: poll.type === "multiple" ? `请选择你支持的选项，最多选 ${poll.maxSelections} 项` : "请选择你支持的一个选项",
      statusText: storage.getStatusText(poll),
      deadlineText: storage.formatRemaining(poll.deadline)
    });
  },

  decoratePoll(poll, selectedIds) {
    const selected = new Set(selectedIds);
    const totalVotes = storage.getTotalVotes(poll);

    return {
      ...poll,
      options: poll.options.map((option) => ({
        ...option,
        selected: selected.has(option.id),
        percent: totalVotes === 0 ? 0 : Math.round((option.votes / totalVotes) * 100)
      }))
    };
  },

  getSelectedCountText(poll, selectedIds) {
    if (!poll) {
      return "";
    }

    if (poll.type === "multiple") {
      return `已选 ${selectedIds.length}/${poll.maxSelections}`;
    }

    return selectedIds.length > 0 ? "已选择 1 项" : "请选择 1 项";
  },

  toggleOption(event) {
    if (this.data.hasVoted || this.data.isClosed || !this.data.poll) {
      return;
    }

    const optionId = event.currentTarget.dataset.id;
    let selectedIds = [];

    if (this.data.poll.type === "single") {
      selectedIds = [optionId];
    } else if (this.data.selectedIds.includes(optionId)) {
      selectedIds = this.data.selectedIds.filter((id) => id !== optionId);
    } else {
      if (this.data.selectedIds.length >= this.data.poll.maxSelections) {
        wx.showToast({
          title: `最多选择 ${this.data.poll.maxSelections} 项`,
          icon: "none"
        });
        return;
      }
      selectedIds = [...this.data.selectedIds, optionId];
    }

    this.setData({
      selectedIds,
      selectedCountText: this.getSelectedCountText(this.data.poll, selectedIds),
      poll: this.decoratePoll(this.data.poll, selectedIds)
    });
  },

  submitVote() {
    if (!this.data.poll) {
      return;
    }

    if (this.data.isClosed) {
      wx.showToast({
        title: "投票已结束",
        icon: "none"
      });
      return;
    }

    if (this.data.selectedIds.length === 0) {
      wx.showToast({
        title: "请选择至少一项",
        icon: "none"
      });
      return;
    }

    try {
      storage.submitVote(this.data.poll.id, this.data.selectedIds);
      wx.redirectTo({
        url: `/pages/result/result?id=${this.data.poll.id}`
      });
    } catch (error) {
      const messageMap = {
        DUPLICATE_VOTE: "你已投过票",
        POLL_CLOSED: "投票已结束",
        TOO_MANY_SELECTIONS: "选择数量过多",
        INVALID_SELECTION: "选择无效"
      };
      wx.showToast({
        title: messageMap[error.message] || "提交失败",
        icon: "none"
      });
      this.loadPoll();
    }
  },

  goResult() {
    wx.navigateTo({
      url: `/pages/result/result?id=${this.data.poll.id}`
    });
  }
});
