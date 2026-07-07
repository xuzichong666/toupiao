const POLLS_KEY = "vote_choice_polls_v1";
const RECORDS_KEY = "vote_choice_records_v1";
const LOCAL_USER_ID = "local_user";
const LOCAL_USER_NAME = "我";

function safeGet(key, fallback) {
  try {
    const value = wx.getStorageSync(key);
    return value || fallback;
  } catch (error) {
    return fallback;
  }
}

function safeSet(key, value) {
  wx.setStorageSync(key, value);
}

function createId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizePoll(poll) {
  const type = poll.type || (poll.allowMultiple ? "multiple" : "single");
  const deadline = poll.deadline || poll.endsAt || poll.createdAt + 24 * 60 * 60 * 1000;

  return {
    ...poll,
    creatorId: poll.creatorId || LOCAL_USER_ID,
    creatorName: poll.creatorName || LOCAL_USER_NAME,
    category: poll.category || "日常投票",
    type,
    anonymous: typeof poll.anonymous === "boolean" ? poll.anonymous : true,
    allowMultiple: type === "multiple",
    maxSelections: type === "multiple" ? poll.maxSelections || poll.options.length : 1,
    participantScope: poll.participantScope || "all",
    participantCount: poll.participantCount || 0,
    deadline,
    status: poll.status || (poll.closed ? "ended" : "active"),
    updatedAt: poll.updatedAt || poll.createdAt
  };
}

function getPolls() {
  return safeGet(POLLS_KEY, []).map(normalizePoll);
}

function savePolls(polls) {
  safeSet(POLLS_KEY, polls.map(normalizePoll));
}

function getPoll(id) {
  return getPolls().find((poll) => poll.id === id) || null;
}

function getVoteRecords() {
  return safeGet(RECORDS_KEY, {});
}

function getVoteRecord(pollId) {
  return getVoteRecords()[pollId] || null;
}

function hasVoted(pollId) {
  return Boolean(getVoteRecord(pollId));
}

function markVoted(pollId, optionIds) {
  const records = getVoteRecords();
  records[pollId] = {
    optionIds,
    userId: LOCAL_USER_ID,
    votedAt: Date.now()
  };
  safeSet(RECORDS_KEY, records);
}

function getRuntimeStatus(poll) {
  if (!poll) {
    return "missing";
  }

  if (poll.status === "canceled") {
    return "canceled";
  }

  if (poll.status === "ended" || poll.closed || Date.now() >= poll.deadline) {
    return "ended";
  }

  return "active";
}

function isEndingSoon(poll) {
  return getRuntimeStatus(poll) === "active" && poll.deadline - Date.now() <= 30 * 60 * 1000;
}

function getStatusText(poll) {
  const status = getRuntimeStatus(poll);

  if (status === "ended") {
    return "已结束";
  }

  if (status === "canceled") {
    return "已取消";
  }

  if (isEndingSoon(poll)) {
    return "即将结束";
  }

  return "进行中";
}

function createPoll(payload) {
  const now = Date.now();
  const type = payload.type || "single";
  const optionTexts = payload.options.map((option) => {
    if (typeof option === "string") {
      return option;
    }
    return option.text;
  });

  const poll = normalizePoll({
    id: createId("poll"),
    title: payload.title,
    description: payload.description || "",
    creatorId: LOCAL_USER_ID,
    creatorName: LOCAL_USER_NAME,
    category: payload.category || "日常投票",
    type,
    anonymous: typeof payload.anonymous === "boolean" ? payload.anonymous : true,
    maxSelections: type === "multiple" ? payload.maxSelections || optionTexts.length : 1,
    participantScope: payload.participantScope || "all",
    deadline: payload.deadline || now + 24 * 60 * 60 * 1000,
    status: "active",
    participantCount: 0,
    options: optionTexts.map((text) => ({
      id: createId("opt"),
      text,
      imageUrl: "",
      votes: 0
    })),
    createdAt: now,
    updatedAt: now,
    closed: false
  });

  savePolls([poll, ...getPolls()]);
  return poll;
}

function updatePollStatus(id, status) {
  const polls = getPolls();
  const pollIndex = polls.findIndex((poll) => poll.id === id);

  if (pollIndex === -1) {
    return false;
  }

  polls[pollIndex] = normalizePoll({
    ...polls[pollIndex],
    status,
    closed: status === "ended",
    updatedAt: Date.now()
  });
  savePolls(polls);
  return true;
}

function endPoll(id) {
  return updatePollStatus(id, "ended");
}

function cancelPoll(id) {
  return updatePollStatus(id, "canceled");
}

function deletePoll(id) {
  const polls = getPolls();
  const nextPolls = polls.filter((poll) => poll.id !== id);

  if (nextPolls.length === polls.length) {
    return false;
  }

  savePolls(nextPolls);

  const records = getVoteRecords();
  if (records[id]) {
    delete records[id];
    safeSet(RECORDS_KEY, records);
  }

  return true;
}

function submitVote(pollId, optionIds) {
  if (hasVoted(pollId)) {
    throw new Error("DUPLICATE_VOTE");
  }

  const polls = getPolls();
  const pollIndex = polls.findIndex((poll) => poll.id === pollId);

  if (pollIndex === -1) {
    throw new Error("POLL_NOT_FOUND");
  }

  const poll = polls[pollIndex];

  if (getRuntimeStatus(poll) !== "active") {
    throw new Error("POLL_CLOSED");
  }

  const validOptionIds = new Set(poll.options.map((option) => option.id));
  const selectedIds = optionIds.filter((id) => validOptionIds.has(id));

  if (selectedIds.length === 0) {
    throw new Error("EMPTY_VOTE");
  }

  if (poll.type === "single" && selectedIds.length !== 1) {
    throw new Error("INVALID_SELECTION");
  }

  if (poll.type === "multiple" && selectedIds.length > poll.maxSelections) {
    throw new Error("TOO_MANY_SELECTIONS");
  }

  const selected = new Set(selectedIds);
  const updatedPoll = normalizePoll({
    ...poll,
    participantCount: poll.participantCount + 1,
    updatedAt: Date.now(),
    options: poll.options.map((option) => ({
      ...option,
      votes: selected.has(option.id) ? option.votes + 1 : option.votes
    }))
  });

  polls[pollIndex] = updatedPoll;
  savePolls(polls);
  markVoted(pollId, selectedIds);

  return updatedPoll;
}

function getTotalVotes(poll) {
  return poll.options.reduce((sum, option) => sum + option.votes, 0);
}

function getParticipantCount(poll) {
  return poll.participantCount || 0;
}

function getLeadingOption(poll) {
  if (!poll || poll.options.length === 0) {
    return null;
  }

  return poll.options.reduce((leading, option) => (
    option.votes > leading.votes ? option : leading
  ), poll.options[0]);
}

function pad(value) {
  return `${value}`.padStart(2, "0");
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDateTime(timestamp) {
  const date = new Date(timestamp);
  return `${formatDate(timestamp)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatRemaining(deadline) {
  const diff = deadline - Date.now();

  if (diff <= 0) {
    return "已结束";
  }

  const minutes = Math.ceil(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `剩余 ${days} 天 ${hours % 24} 小时`;
  }

  if (hours > 0) {
    return `剩余 ${hours} 小时 ${restMinutes} 分钟`;
  }

  return `剩余 ${minutes} 分钟`;
}

module.exports = {
  LOCAL_USER_ID,
  cancelPoll,
  createPoll,
  deletePoll,
  endPoll,
  formatDate,
  formatDateTime,
  formatRemaining,
  getLeadingOption,
  getParticipantCount,
  getPoll,
  getPolls,
  getRuntimeStatus,
  getStatusText,
  getTotalVotes,
  getVoteRecord,
  hasVoted,
  isEndingSoon,
  submitVote
};
