"use strict";

const results = {
  passed: {
    evidence: "关闭通知 → 保存 → 刷新\n预期：关闭　实际：关闭",
    title: "原故障路径验证通过",
    decision: "刷新后仍是关闭，能够支持这次修复的结论。后续交付仍按对应的 Playbook 和适用的审查要求进行。",
    report: "复测表面：原设置页\n结论：此路径上的故障已修复",
  },
  "unit-only": {
    evidence: "保存函数测试通过\n原设置页刷新后的状态：未观察",
    title: "验收待定，回到原界面复测",
    decision: "单测说明被测函数符合断言。还需要确认设置页真的走了该函数，而且刷新后读取到了新值。",
    report: "复测表面：未覆盖原界面\n结论：修复未确认",
  },
  reproduced: {
    evidence: "关闭通知 → 保存 → 刷新\n预期：关闭　实际：开启",
    title: "原界面仍能复现，回到定位",
    decision: "当前改动还不能解决用户看到的故障。保留这次失败的证据，回到定位阶段检查保存与重读这两段路径。",
    report: "复测表面：原设置页\n结论：故障仍在",
  },
};

const phases = [
  {
    title: "会话收到路由指令",
    description: "启用插件的 Claude Code 会话拿到路由指令。模型读到这是一项原因未知的修复任务，选择加载 poteto-mode。",
    output: "用户报告：关闭通知并保存，刷新后又显示开启\n匹配条件：原因未知的故障",
    motion: { nodes: ["host", "lead"], link: "route" },
    caption: "会话入口 → 主 Agent · 交付路由提示和故障报告",
  },
  {
    title: "选定 Bug fix Playbook",
    description: "主 Agent 打开对应的 Markdown，把步骤登记到待办。适用的原则和专门 Skill 在需要时读取。",
    output: "教学简表\n复现 → 定位 → 规划和实现 → 原界面复测 → 整理交付",
    motion: { nodes: ["lead", "work"], link: "work" },
    caption: "主 Agent → 宿主待办工具 · 登记执行步骤",
  },
  {
    title: "先复现，再用证据限定改动",
    description: "主 Agent 在原设置页复现。子 Agent 调查保存路径，回报只更新了页面临时状态。主 Agent 界定修复范围并审查改动。",
    output: "修复前：页面显示关闭，刷新后恢复开启\n示例改动：保存动作写入持久层",
    motion: { nodes: ["work", "lead"], link: "work", direction: "backward" },
    caption: "子 Agent → 主 Agent · 回传诊断证据和改动",
  },
  {
    title: "核对验收证据",
    description: "主 Agent 对照原始复现步骤，检查验收结果能否说明刷新后的通知状态。",
    motion: { nodes: ["lead", "work"], link: "work" },
    caption: "主 Agent → 验证工具 · 收集复测输出",
  },
  {
    motion: { nodes: ["work", "lead"], link: "work", direction: "backward" },
    caption: "验证工具 → 主 Agent · 根据观测结果形成结论",
  },
];

const trace = document.getElementById("workflow-trace");
const verification = document.getElementById("verification");
const board = document.getElementById("motion");
const caption = document.getElementById("motion-caption");
const title = document.getElementById("phase-title");
const description = document.getElementById("phase-description");
const output = document.getElementById("phase-output");
const progress = document.getElementById("progress");
const previous = document.getElementById("previous");
const next = document.getElementById("next");
const play = document.getElementById("play");
let phaseIndex = 0;

function renderPhase(index) {
  phaseIndex = index;
  const phase = phases[index];
  const result = results[verification.value];
  title.textContent = phase.title ?? result.title;
  description.textContent = phase.description ?? result.decision;
  output.textContent = phase.output ?? (index === phases.length - 1 ? result.report : result.evidence);
  caption.textContent = phase.caption;
  progress.textContent = `第 ${index + 1} 步 / 共 ${phases.length} 步`;
  previous.disabled = index === 0;
  next.disabled = index === phases.length - 1;
  showFlowMotion(board, phase.motion);
}

const pause = createFlowPlayback(play, {
  hasNext: () => phaseIndex < phases.length - 1,
  advance: () => renderPhase(phaseIndex + 1),
  rewind: () => renderPhase(0),
});

previous.addEventListener("click", () => {
  pause();
  renderPhase(phaseIndex - 1);
});

next.addEventListener("click", () => {
  pause();
  renderPhase(phaseIndex + 1);
});

verification.addEventListener("change", () => {
  pause();
  renderPhase(phaseIndex);
});

trace.hidden = false;
renderPhase(phaseIndex);
