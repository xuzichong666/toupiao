const storage = require("../../utils/storage");

const DEADLINE_OPTIONS = [
  { label: "1小时后", hours: 1 },
  { label: "3小时后", hours: 3 },
  { label: "6小时后", hours: 6 },
  { label: "12小时后", hours: 12 },
  { label: "1天后", hours: 24 },
  { label: "2天后", hours: 48 },
  { label: "3天后", hours: 72 },
  { label: "5天后", hours: 120 },
  { label: "7天后", hours: 168 },
  { label: "14天后", hours: 336 },
  { label: "30天后", hours: 720 }
];

Page({
  data: {
    title: "",
    description: "",
    type: "single",
    category: "日常投票",
    options: ["", ""],
    anonymous: true,
    deadlineIndex: 4,
    deadlineLabels: DEADLINE_OPTIONS.map((item) => item.label),
    deadlineText: DEADLINE_OPTIONS[4].label,
    maxSelections: 2,
    statusBarHeight: 20,
    optionCountInput: ""
  },

  onLoad() {
    const sysInfo = wx.getSystemInfoSync();
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight || 20
    });
  },

  onTitleInput(event) {
    this.setData({
      title: event.detail.value
    });
  },

  onDescriptionInput(event) {
    this.setData({
      description: event.detail.value
    });
  },

  chooseType(event) {
    const type = event.currentTarget.dataset.type;
    this.setData({
      type,
      maxSelections: type === "multiple" ? Math.min(this.data.maxSelections, this.getValidOptions().length || 2) : 1
    });
  },

  chooseCategory(event) {
    this.setData({
      category: event.currentTarget.dataset.category
    });
  },

  onOptionInput(event) {
    const index = Number(event.currentTarget.dataset.index);
    const options = [...this.data.options];
    options[index] = event.detail.value;
    this.setData({ options }, () => this.clampMaxSelections());
  },

  onAnonymousChange(event) {
    this.setData({
      anonymous: event.detail.value
    });
  },

  onDeadlineChange(event) {
    const deadlineIndex = Number(event.detail.value);
    this.setData({
      deadlineIndex,
      deadlineText: DEADLINE_OPTIONS[deadlineIndex].label
    });
  },

  navigateBack() {
    wx.navigateBack({
      fail() {
        wx.reLaunch({
          url: "/pages/index/index"
        });
      }
    });
  },

  decreaseMax() {
    if (this.data.maxSelections <= 2) {
      return;
    }

    this.setData({
      maxSelections: this.data.maxSelections - 1
    });
  },

  increaseMax() {
    const optionCount = Math.max(this.getValidOptions().length, 2);
    if (this.data.maxSelections >= optionCount) {
      return;
    }

    this.setData({
      maxSelections: this.data.maxSelections + 1
    });
  },

  addOption() {
    if (this.data.options.length >= 50) {
      return;
    }

    this.setData({
      options: [...this.data.options, ""]
    }, () => this.clampMaxSelections());
  },

  onOptionCountInput(event) {
    this.setData({ optionCountInput: event.detail.value });
  },

  applyOptionCount() {
    const count = parseInt(this.data.optionCountInput);
    if (isNaN(count) || count < 2 || count > 50) {
      wx.showToast({ title: "请输入2~50之间的数字", icon: "none" });
      return;
    }
    const current = this.data.options.length;
    if (count > current) {
      const extra = Array.from({ length: count - current }, () => "");
      this.setData({
        options: [...this.data.options, ...extra],
        optionCountInput: ""
      }, () => this.clampMaxSelections());
    } else if (count < current) {
      this.setData({
        options: this.data.options.slice(0, count),
        optionCountInput: ""
      }, () => this.clampMaxSelections());
    } else {
      this.setData({ optionCountInput: "" });
    }
  },

  removeOption(event) {
    if (this.data.options.length <= 2) {
      return;
    }

    const index = Number(event.currentTarget.dataset.index);
    const options = this.data.options.filter((_, optionIndex) => optionIndex !== index);
    this.setData({ options }, () => this.clampMaxSelections());
  },

  getValidOptions() {
    return this.data.options.map((option) => option.trim()).filter(Boolean);
  },

  clampMaxSelections() {
    if (this.data.type !== "multiple") {
      this.setData({ maxSelections: 1 });
      return;
    }

    const optionCount = Math.max(this.getValidOptions().length, 2);
    const maxSelections = Math.min(Math.max(this.data.maxSelections, 2), optionCount);

    if (maxSelections !== this.data.maxSelections) {
      this.setData({ maxSelections });
    }
  },

  submitCreate() {
    const title = this.data.title.trim();
    const description = this.data.description.trim();
    const options = this.getValidOptions();

    if (!title) {
      wx.showToast({
        title: "请输入标题",
        icon: "none"
      });
      return;
    }

    if (options.length < 2) {
      wx.showToast({
        title: "至少需要 2 个选项",
        icon: "none"
      });
      return;
    }

    const uniqueOptions = new Set(options);
    if (uniqueOptions.size !== options.length) {
      wx.showToast({
        title: "选项不能重复",
        icon: "none"
      });
      return;
    }

    const deadlineOption = DEADLINE_OPTIONS[this.data.deadlineIndex];
    const poll = storage.createPoll({
      title,
      description,
      category: this.data.category,
      type: this.data.type,
      anonymous: this.data.anonymous,
      maxSelections: this.data.type === "multiple" ? this.data.maxSelections : 1,
      deadline: Date.now() + deadlineOption.hours * 60 * 60 * 1000,
      options
    });

    wx.redirectTo({
      url: `/pages/success/success?id=${poll.id}`
    });
  }
});
