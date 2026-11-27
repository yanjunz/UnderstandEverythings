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

const bugPhases = [
  {
    title: "会话收到路由指令",
    description: "SessionStart 把路由规则加入会话。模型读到故障的原因还未知，选择加载 poteto-mode。",
    output: "用户报告：关闭通知并保存，刷新后又显示开启\n模型选择：加载 poteto-mode",
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
    description: "刷新后显示旧值，可能是保存失败，也可能是回读出错。子 Agent 对比两项观测，主 Agent 据此把改动限定在保存路径。",
    output: "保存后直接查看记录：仍是开启\n准备一条已关闭的测试记录，再刷新：正确显示关闭\n示例改动：让保存动作写入记录",
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

const smallChangePhases = [
  {
    title: "模型选择直接处理",
    description: "会话里的路由规则允许有明显验证办法的单文件小改直接完成。模型判断这次只是改一个标题。",
    output: "用户请求：把「通知设置」标题改成「消息通知」\n模型选择：直接改文案并验证",
    motion: { nodes: ["host", "lead"], link: "route" },
    caption: "会话入口 → 主 Agent · 提供路由规则和小改请求",
  },
  {
    title: "改标题并打开设置页",
    description: "主 Agent 在单个文件里更新文案，然后打开设置页确认看到的新标题。",
    output: "单文件改动：通知设置 → 消息通知\n原界面显示：消息通知",
    motion: { nodes: ["lead", "work"], link: "work" },
    caption: "主 Agent → 宿主工具 · 编辑文案并检查实际页面",
  },
];

const tddPhases = [
  {
    title: "模型直接加载 TDD Skill",
    description: "用户明确指定了先用失败的回归测试复现问题，模型直接调用 pstack:tdd。",
    output: "用户请求：先写一个失败的回归测试，再修复通知保存\n模型选择：加载 pstack:tdd",
    motion: { nodes: ["host", "lead"], link: "route" },
    caption: "会话入口 → 主 Agent · 传递明确的 TDD 请求",
  },
  {
    title: "先确认测试因原故障失败",
    description: "把关掉通知、保存后重新加载的行为写成测试，并在修改前先运行一次。",
    output: "重新加载后的通知状态\n预期：关闭　实际：开启",
    motion: { nodes: ["lead", "work"], link: "work" },
    caption: "主 Agent → 测试工具 · 复现并核对预期的失败",
  },
  {
    title: "修复后重跑同一个测试",
    description: "修好保存路径后再次运行同一条回归测试，观察先前失败的条件是否改变。",
    output: "重新加载后的通知状态\n预期：关闭　实际：关闭",
    motion: { nodes: ["work", "lead"], link: "work", direction: "backward" },
    caption: "测试工具 → 主 Agent · 返回修复后的结果",
  },
];

const taskPhases = { bug: bugPhases, small: smallChangePhases, tdd: tddPhases };
const trace = document.getElementById("workflow-trace");
const task = document.getElementById("task");
const verification = document.getElementById("verification");
const verificationField = document.getElementById("verification-field");
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
  const phases = taskPhases[task.value];
  const phase = phases[index];
  const result = results[verification.value];
  title.textContent = phase.title ?? result.title;
  description.textContent = phase.description ?? result.decision;
  output.textContent = phase.output ?? (index === phases.length - 1 ? result.report : result.evidence);
  caption.textContent = phase.caption;
  progress.textContent = `第 ${index + 1} 步 / 共 ${phases.length} 步`;
  previous.disabled = index === 0;
  next.disabled = index === phases.length - 1;
  verificationField.hidden = task.value !== "bug";
  showFlowMotion(board, phase.motion);
}

const pause = createFlowPlayback(play, {
  hasNext: () => !next.disabled,
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

task.addEventListener("change", () => {
  pause();
  renderPhase(0);
});

verification.addEventListener("change", () => {
  pause();
  renderPhase(phaseIndex);
});

trace.hidden = false;
renderPhase(phaseIndex);
