"use strict";

const weatherQuestion = "北京现在的天气怎么样？";
const scenarios = {
  success: {
    question: weatherQuestion,
    toolResult: { condition: "晴", temperature_c: 22 },
    answer: "北京现在晴，气温 22°C。",
    description: "模型根据工具返回的晴天和 22°C 写出答复。没有待处理的输入，也没有继续执行的要求，本轮结束。",
  },
  timeout: {
    question: weatherQuestion,
    toolResult: { error: "TIMEOUT", message: "天气工具请求超时" },
    answer: "天气查询超时，我暂时无法确认北京现在的天气。",
    description: "模型读到超时信息，说明这次查询的结果。这个场景未配置重试，当前回合结束。",
  },
  direct: {
    question: "摄氏度怎样换算成华氏度？",
    answer: "华氏度 = 摄氏度 × 9 ÷ 5 + 32。例如，22°C 等于 71.6°F。",
    description: "模型用已知的换算公式直接回复，未请求工具。在这个场景中，Harness 可以在第一次模型请求后结束回合。",
  },
};

const weatherTool = {
  name: "get_weather",
  description: "查询指定城市的当前天气",
  parameters: { city: "string" },
  required: ["city"],
};

function createTrace(scenario) {
  const userMessage = { role: "user", content: scenario.question };
  const trace = [{
    title: "组装模型上下文",
    owner: "Harness",
    description: "运行时将系统提示、用户消息和可用工具定义送给模型。这里的工具定义说明了天气工具的用途及必填参数。",
    label: "模型输入",
    payload: {
      system: "根据用户问题作答，需要当前天气时使用可用工具。",
      messages: [userMessage],
      tools: [weatherTool],
    },
  }];

  if (scenario.toolResult) {
    const toolCall = { id: "weather_1", name: weatherTool.name, arguments: { city: "北京" } };
    const toolMessage = { role: "tool", tool_call_id: toolCall.id, content: scenario.toolResult };

    trace.push(
      {
        title: "提出工具调用",
        owner: "DeepSeek 模型",
        description: "模型发出工具名和参数。运行时接收调用请求，并在会话中记录对应的调用标识。",
        label: "会话事件 · tool/call",
        payload: toolCall,
      },
      {
        title: "执行天气工具",
        owner: "Harness · 工具插件",
        description: "执行器确认工具可用并检查参数，再运行天气工具。成功数据和超时信息都可以成为工具结果。",
        label: "会话事件 · tool/result",
        payload: { call_id: toolCall.id, result: scenario.toolResult },
      },
      {
        title: "回填结果并继续",
        owner: "Harness · 会话日志",
        description: "运行时追加记录，从日志生成下一次请求的消息历史。工具结果通过调用标识与原请求对应。",
        label: "下一次模型请求 · 消息历史",
        payload: {
          user: userMessage,
          assistant: { role: "assistant", tool_call_id: toolCall.id, name: toolCall.name },
          tool: toolMessage,
        },
      },
    );
  }

  trace.push({
    title: "给出最终答复",
    owner: "模型生成回复，Harness 结束回合",
    description: scenario.description,
    label: "会话事件 · assistant/message → turn/end",
    payload: { role: "assistant", content: scenario.answer },
  });

  return trace;
}

const simulator = document.querySelector("[data-simulator]");
const scenarioSelect = document.getElementById("scenario");
const steps = document.getElementById("steps");
const previous = document.getElementById("previous");
const next = document.getElementById("next");
const question = document.getElementById("question");
const stageTitle = document.getElementById("stage-title");
const stageOwner = document.getElementById("stage-owner");
const stageDescription = document.getElementById("stage-description");
const payloadTitle = document.getElementById("payload-title");
const payload = document.getElementById("payload");
const progress = document.getElementById("step-progress");

let trace;
let stepButtons;
let currentStep;

function formatPayload(data) {
  const lines = Object.entries(data).map(([key, value]) => {
    return `  ${JSON.stringify(key)}: ${JSON.stringify(value)}`;
  });
  return `{\n${lines.join(",\n")}\n}`;
}

function showStep(index) {
  currentStep = index;
  const step = trace[index];
  const isLast = index === trace.length - 1;

  for (const [buttonIndex, button] of stepButtons.entries()) {
    if (buttonIndex === index) {
      button.setAttribute("aria-current", "step");
    } else {
      button.removeAttribute("aria-current");
    }
  }

  stageTitle.textContent = step.title;
  stageOwner.textContent = step.owner;
  stageDescription.textContent = step.description;
  payloadTitle.textContent = step.label;
  payload.textContent = formatPayload(step.payload);
  progress.textContent = `第 ${index + 1} 步 / 共 ${trace.length} 步 · ${step.title}`;
  previous.disabled = index === 0;
  next.textContent = isLast ? "从头演示" : "下一步";
}

function loadScenario() {
  const scenario = scenarios[scenarioSelect.value];
  trace = createTrace(scenario);
  question.textContent = scenario.question;
  stepButtons = [];

  const items = trace.map((step, index) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    const number = document.createElement("span");
    number.className = "step-number";
    number.setAttribute("aria-hidden", "true");
    number.textContent = index + 1;
    button.type = "button";
    button.append(number, step.title);
    button.addEventListener("click", () => showStep(index));
    item.append(button);
    stepButtons.push(button);
    return item;
  });

  steps.replaceChildren(...items);
  showStep(0);
}

scenarioSelect.addEventListener("change", loadScenario);
previous.addEventListener("click", () => {
  showStep(currentStep - 1);
  if (currentStep === 0) next.focus();
});
next.addEventListener("click", () => showStep((currentStep + 1) % trace.length));

loadScenario();
simulator.hidden = false;
