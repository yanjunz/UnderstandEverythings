"use strict";

const decisions = {
  queue: {
    title: "名额满后开放候补吗？",
    recommendation: "开放候补，取消时还有人可以补上。",
    options: { open: "开放候补", closed: "满额即关闭" },
  },
  reminder: {
    title: "由组织者手动给已确认参加的人发活动提醒吗？",
    recommendation: "手动发送一次，减少忘记到场的情况。",
    options: { send: "发送提醒", skip: "不发送提醒" },
  },
  timing: {
    after: ["reminder", "send"],
    title: "组织者提前 24 小时发提醒吗？",
    recommendation: "提前 24 小时，让参与者有时间安排行程。",
    options: { day: "提前 24 小时", hour: "提前 1 小时" },
  },
  promotion: {
    after: ["queue", "open"],
    needsFact: true,
    options: { auto: "自动补位", manual: "手动补位" },
  },
  hold: {
    after: ["promotion", "auto"],
    title: "自动发出补位邀请后，保留名额 12 小时吗？",
    recommendation: "保留 12 小时，给候补者答复时间，逾期再通知下一位。",
    options: { halfDay: "保留 12 小时", day: "保留 24 小时" },
  },
};

const factResults = {
  available: {
    result: "取消报名释放名额时，系统已有事件通知。",
    title: "有空位时自动邀请下一位候补者吗？",
    recommendation: "用现有名额释放事件触发自动补位，减少组织者的手工操作。",
  },
  missing: {
    result: "取消报名释放名额时，系统没有发出事件。",
    title: "本期由组织者手动补位吗？",
    recommendation: "先手动补位，控制首期范围。选择自动补位需在本期新增名额释放事件。",
  },
};

const interview = document.getElementById("interview");
const board = document.getElementById("interview-motion");
const caption = document.getElementById("motion-caption");
const factNodeStatus = document.getElementById("motion-fact-status");
const replay = document.getElementById("replay-motion");
const repositoryNode = board.querySelector('[data-flow-node="repo"]');
const agentNode = board.querySelector('[data-flow-node="agent"]');
const organizerNode = board.querySelector('[data-flow-node="user"]');
const factEdge = board.querySelector('[data-flow-link="fact"]');
const questionEdge = board.querySelector('[data-flow-link="question"]');
const replyEdge = board.querySelector('[data-flow-link="reply"]');
const title = document.getElementById("round-title");
const description = document.getElementById("round-description");
const roundForm = document.getElementById("round-form");
const questions = document.getElementById("questions");
const template = document.getElementById("question-template");
const consensus = document.getElementById("consensus");
const consensusPlan = document.getElementById("consensus-plan");
const confirm = document.getElementById("confirm");
const restart = document.getElementById("restart");
const statusRows = document.querySelectorAll("#decision-status li");
const factStatus = document.getElementById("fact-status");
const factControls = document.getElementById("fact-controls");

const answers = new Map();
let fact = null;
let offered = [];
let round = 0;
let latestMessages = [];

function availability(id) {
  const decision = decisions[id];
  if (answers.has(id)) return "settled";
  if (decision.after) {
    const [parent, requiredAnswer] = decision.after;
    if (availability(parent) === "skipped") return "skipped";
    if (!answers.has(parent)) return "dependent";
    if (answers.get(parent) !== requiredAnswer) return "skipped";
  }
  if (decision.needsFact && !fact) return "lookup";
  return "ready";
}

function setDirection(edge, direction) {
  if (direction) edge.dataset.direction = direction;
  else delete edge.dataset.direction;
}

function replayLatest() {
  for (const edge of latestMessages) {
    const packet = edge.querySelector(".motion-packet");
    packet.replaceWith(packet.cloneNode());
  }
}

function showMotion({ submittedRound, factReturned = false, questionsSent = true, confirmed = false } = {}) {
  const investigating = availability("promotion") === "lookup";
  const awaitingConfirmation = !consensus.hidden && !confirm.hidden;
  const asking = offered.length > 0 || awaitingConfirmation;
  const replying = submittedRound !== undefined || confirmed;
  const factDirection = investigating ? "backward" : factReturned ? "forward" : null;
  const newFactMessage = factDirection && factEdge.dataset.direction !== factDirection;
  const messages = [];
  latestMessages = [];

  if (replying) {
    messages.push(confirmed
      ? "组织者 → Agent · 确认报名方案。"
      : `组织者 → Agent · 提交第 ${submittedRound} 轮回答。`);
    latestMessages.push(replyEdge);
  }
  if (investigating) messages.push("Agent → 仓库调查 · 名额释放事件正在查证。");
  if (factReturned) messages.push(`仓库调查 → Agent · ${fact.result}`);
  if (newFactMessage) latestMessages.push(factEdge);

  if (offered.length) {
    if (questionsSent) {
      messages.push(`Agent → 组织者 · 发出第 ${round} 轮的 ${offered.length} 个问题和建议。`);
      latestMessages.push(questionEdge);
    } else {
      messages.push(`第 ${round} 轮仍待回答，补位方式进入下一轮。`);
    }
  } else if (awaitingConfirmation) {
    messages.push("Agent → 组织者 · 提交报名方案，等待确认。");
    latestMessages.push(questionEdge);
  }

  caption.replaceChildren(...messages.map((message) => {
    const line = document.createElement("span");
    line.textContent = message;
    return line;
  }));
  repositoryNode.toggleAttribute("data-active", Boolean(factDirection));
  agentNode.toggleAttribute("data-active", Boolean(factDirection || asking || replying));
  organizerNode.toggleAttribute("data-active", asking || replying);
  factNodeStatus.textContent = investigating ? "调查进行中" : fact ? "结果已回传"
    : answers.get("queue") === "closed" ? "已跳过" : "等待派查";
  setDirection(factEdge, factDirection);
  setDirection(questionEdge, asking ? "forward" : null);
  setDirection(replyEdge, replying ? "backward" : null);
  board.toggleAttribute("data-reply-then-ask", replying && latestMessages.includes(questionEdge));
  replayLatest();
}

function renderStatus() {
  const labels = {
    skipped: "已跳过",
    dependent: "等待前置决定",
    lookup: "等待调查结果",
    ready: "下轮可问",
  };
  for (const row of statusRows) {
    const id = row.dataset.decision;
    const status = availability(id);
    row.dataset.status = status;
    const detail = status === "settled" ? decisions[id].options[answers.get(id)] : labels[status];
    row.querySelector("strong").textContent = offered.includes(id) ? "本轮要问" : detail;
  }
  factControls.hidden = availability("promotion") !== "lookup";
  factStatus.textContent = fact?.result ?? (
    answers.get("queue") === "open" ? "正在查名额释放时能否触发候补补位。"
      : answers.get("queue") === "closed" ? "已跳过这项调查。" : "开放候补后，再查是否已有名额释放事件。"
  );
}

function makeQuestion(id, position) {
  const decision = decisions[id];
  const wording = decision.needsFact ? fact : decision;
  const field = template.content.cloneNode(true);
  field.querySelector("legend").textContent = `Q${position + 1} ${wording.title}`;
  field.querySelector(".recommendation").textContent = `建议 ${wording.recommendation}`;
  const options = field.querySelector(".choice-list");
  for (const [value, labelText] of Object.entries(decision.options)) {
    const label = document.createElement("label");
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = id;
    radio.value = value;
    radio.required = true;
    label.append(radio, labelText);
    options.append(label);
  }
  return field;
}

function summarizePlan() {
  let queuePlan = "名额满后关闭报名。";
  if (answers.get("queue") === "open") {
    if (answers.get("promotion") === "manual") {
      queuePlan = "开放候补，有空位时由组织者手动补位。";
    } else {
      const hold = decisions.hold.options[answers.get("hold")];
      const trigger = fact === factResults.missing ? "先新增名额释放事件，再" : "";
      queuePlan = `开放候补，${trigger}在有空位时自动邀请下一位候补者，并为其${hold}。`;
    }
  }

  const reminderPlan = answers.get("reminder") === "send"
    ? `组织者${decisions.timing.options[answers.get("timing")]}向已确认参加的人手动发提醒。`
    : "活动前不另发提醒。";
  consensusPlan.textContent = queuePlan + reminderPlan;
}

function offerNextRound() {
  offered = Object.keys(decisions).filter((id) => availability(id) === "ready");
  roundForm.hidden = offered.length === 0;
  consensus.hidden = true;
  confirm.hidden = false;
  if (offered.length) {
    round += 1;
    title.textContent = `第 ${round} 轮提问`;
    description.textContent = "这些问题的前置条件已经满足。选好本轮每道题的答案再提交。";
    questions.replaceChildren(...offered.map(makeQuestion));
  } else if (availability("promotion") === "lookup") {
    title.textContent = "等待仓库调查";
    description.textContent = "目前没有独立的问题可继续。请在「模拟仓库调查」返回一个结果。";
  } else {
    title.textContent = "等待确认共识";
    description.textContent = "适用的分支都已解决。请核对下方方案，再确认双方理解一致。";
    summarizePlan();
    consensus.hidden = false;
  }
  renderStatus();
}

roundForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const submittedRound = round;
  const selection = new FormData(roundForm);
  for (const id of offered) answers.set(id, selection.get(id));
  offerNextRound();
  showMotion({ submittedRound });
  title.focus();
});

factControls.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const questionsSent = offered.length === 0;
  fact = factResults[button.value];
  if (questionsSent) offerNextRound();
  else renderStatus();
  showMotion({ factReturned: true, questionsSent });
  title.focus();
});

confirm.addEventListener("click", () => {
  confirm.hidden = true;
  title.textContent = "共识已确认";
  description.textContent = "本次访谈结束。下方保留本次确认的方案。";
  consensus.querySelector("h4").textContent = "已确认的报名方案";
  showMotion({ confirmed: true });
  title.focus();
});

restart.addEventListener("click", () => {
  fact = null;
  round = 0;
  answers.clear();
  consensus.querySelector("h4").textContent = "请核对报名方案";
  offerNextRound();
  showMotion();
  title.focus();
});

replay.addEventListener("click", replayLatest);
interview.hidden = false;
offerNextRound();
showMotion();
