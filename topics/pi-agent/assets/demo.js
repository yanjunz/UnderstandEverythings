"use strict";

(() => {
  const trace = document.getElementById("pi-trace");
  const fileState = document.getElementById("pi-file-state");
  const previous = document.getElementById("pi-prev");
  const next = document.getElementById("pi-next");
  const question = "这个项目怎么跑测试？";
  const file = '{ "scripts": { "test": "vitest run" } }';
  const missing = "ENOENT：找不到 package.json";
  const commonSteps = [
    {
      title: "问题进入会话",
      sender: "用户",
      receiver: "Pi 会话",
      payload: question,
      detail: "你问的是当前项目。要给出这个项目的命令，模型得先知道它怎样配置测试。",
    },
    {
      title: "第一次请求模型",
      sender: "Pi 的 Agent 循环",
      receiver: "模型",
      payload: "用户消息：" + question + "\n可用工具摘录：read(path)",
      detail: "Pi 把提问和可用工具的说明一起交给模型。此时模型只知道可以读文件。",
    },
    {
      title: "模型请求读取文件",
      sender: "模型",
      receiver: "Pi 的 Agent 循环",
      payload: 'toolCall · id=call_1\nread({ "path": "package.json" })',
      detail: "模型生成工具名和参数。Pi 找到已注册的 read 工具，校验参数，再交给它读取项目目录里的文件。",
    },
  ];

  function stepsForFile(exists) {
    const result = exists ? file : missing;
    return [
      ...commonSteps,
      {
        title: exists ? "read 读到了测试脚本" : "read 找不到文件",
        sender: "read 工具",
        receiver: "Pi 的 Agent 循环",
        payload: result,
        detail: exists ? "read 返回了文件内容。Pi 用 call_1 将结果和刚才的请求配对。" : "read 报告文件缺失。Pi 捕获这个工具错误，保留调用编号 call_1 并标记失败。",
      },
      {
        title: "工具结果进入第二次模型请求",
        sender: "Pi 的 Agent 循环",
        receiver: "模型",
        payload: "toolResult · toolCallId=call_1\nisError=" + !exists + "\n" + result,
        detail: "模型现在一起看到原问题、刚才的工具调用和对应结果。" + (exists ? "它可以根据 scripts.test 回答。" : "它得知读取失败，还需要更多信息才能确认命令。"),
      },
      {
        title: exists ? "模型给出测试命令" : "模型请用户确认目录",
        sender: "模型经 Pi 会话",
        receiver: "用户",
        payload: exists ? "在项目根目录运行 npm test。它会执行 vitest run。" : "当前目录里找不到 package.json。这个项目的根目录在哪里？",
        detail: "这次回复只包含文本。在没有排队消息的假设下，本次循环结束。测试命令未执行。",
      },
    ];
  }

  let index = 0;
  function render() {
    const steps = stepsForFile(fileState.value === "present");
    const step = steps[index];
    document.getElementById("pi-progress").textContent = "第 " + (index + 1) + " 步 / 共 " + steps.length + " 步";
    document.getElementById("pi-step-title").textContent = step.title;
    document.getElementById("pi-sender").textContent = step.sender;
    document.getElementById("pi-receiver").textContent = step.receiver;
    document.getElementById("pi-payload").textContent = step.payload;
    document.getElementById("pi-detail").textContent = step.detail;
    previous.disabled = index === 0;
    next.textContent = index === steps.length - 1 ? "从头看" : "下一步";
  }

  previous.addEventListener("click", () => {
    index -= 1;
    render();
  });
  next.addEventListener("click", () => {
    index = (index + 1) % stepsForFile(fileState.value === "present").length;
    render();
  });
  fileState.addEventListener("change", () => {
    index = commonSteps.length;
    render();
  });
  render();
  trace.hidden = false;
})();
