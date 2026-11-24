"use strict";

const decisions = {
  queue: {
    title: "名额满后开放候补吗？",
    recommendation: "开放候补，取消时还有人可以补上。",
    options: { open: "开放候补", closed: "满额即关闭" },
  },
  reminder: {
    title: "向已确认参加的人发活动提醒吗？",
    recommendation: "发送一次，减少忘记到场的情况。",
    options: { send: "发送提醒", skip: "不发送提醒" },
  },
  timing: {
    after: ["reminder", "send"],
    title: "提醒提前 24 小时发出吗？",
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
    result: "仓库已有可复用的后台任务能力。",
    title: "有空位时自动邀请下一位候补者吗？",
    recommendation: "复用现有后台任务做自动补位，减少组织者的手工操作。",
  },
  missing: {
    result: "仓库缺少可复用的后台任务能力。",
    title: "本期由组织者手动补位吗？",
    recommendation: "先手动补位，控制首期范围。选择自动补位会把新增后台任务纳入本期。",
  },
};

const interview = document.getElementById("interview");
const board = document.getElementById("interview-motion");
const caption = document.getElementById("motion-caption");
const title = document.getElementById("round-title");
const description = document.getElementById("round-description");
const roundForm = document.getElementById("round-form");
const questions = document.getElementById("questions");
const template = document.getElementById("question-template");
const confirm = document.getElementById("confirm");
const restart = document.getElementById("restart");
const statusRows = document.querySelectorAll("#decision-status li");
const factStatus = document.getElementById("fact-status");
const factControls = document.getElementById("fact-controls");

const answers = new Map();
let fact = null;
let offered = [];
let round = 0;

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

function showMotion(message, motion) {
  caption.textContent = message;
  showFlowMotion(board, motion);
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
    answers.get("queue") === "open" ? "调查中。返回结果后才能决定补位方式。"
      : answers.get("queue") === "closed" ? "已跳过这项调查。" : "开放候补后，才调查后台执行能力。"
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

function offerNextRound() {
  offered = Object.keys(decisions).filter((id) => availability(id) === "ready");
  roundForm.hidden = offered.length === 0;
  confirm.hidden = true;
  if (offered.length) {
    round += 1;
    title.textContent = `第 ${round} 轮提问`;
    description.textContent = "这些问题的前置条件已经满足。选好本轮每道题的答案再提交。";
    questions.replaceChildren(...offered.map(makeQuestion));
    showMotion(`Agent → 组织者 · 提交这一轮的 ${offered.length} 个问题和建议`, {
      nodes: ["agent", "user"], link: "question",
    });
  } else if (availability("promotion") === "lookup") {
    title.textContent = "等待仓库调查";
    description.textContent = "目前没有独立的问题可继续。请在「模拟仓库调查」返回一个结果。";
    showMotion("Agent → 仓库调查 · 查询能否复用后台任务", {
      nodes: ["agent", "repo"], link: "fact", direction: "backward",
    });
  } else {
    title.textContent = "等待确认共识";
    description.textContent = "适用的分支都已解决。请核对「问题依赖」中的答案，再确认双方理解一致。";
    confirm.hidden = false;
    showMotion("Agent → 组织者 · 请核对所有决定并确认", {
      nodes: ["agent", "user"], link: "question",
    });
  }
  renderStatus();
}

roundForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const selection = new FormData(roundForm);
  for (const id of offered) answers.set(id, selection.get(id));
  offerNextRound();
  title.focus();
});

factControls.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  fact = factResults[button.value];
  if (offered.length) renderStatus();
  else offerNextRound();
  showMotion(`仓库调查 → Agent · ${fact.result}${offered.includes("promotion") ? "" : " 补位方式进入下一轮。"}`, {
    nodes: ["repo", "agent"], link: "fact",
  });
  title.focus();
});

confirm.addEventListener("click", () => {
  confirm.hidden = true;
  title.textContent = "共识已确认";
  description.textContent = "本次访谈结束。右侧保留本次确认的决定。";
  showMotion("组织者 → Agent · 确认当前方案的共同理解", {
    nodes: ["user", "agent"], link: "question", direction: "backward",
  });
  title.focus();
});

restart.addEventListener("click", () => {
  fact = null;
  round = 0;
  answers.clear();
  offerNextRound();
  title.focus();
});

interview.hidden = false;
offerNextRound();
