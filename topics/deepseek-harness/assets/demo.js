"use strict";

const weatherQuestion = "北京现在的天气怎么样？";
const scenarios = {
  success: {
    question: weatherQuestion,
    weather: [{ city: "北京", result: { condition: "晴", temperature_c: 22 } }],
    answer: "北京现在晴，气温 22°C。",
    description: "模型根据工具返回的晴天和 22°C 写出答复。没有待处理的输入，也没有继续执行的要求，本轮结束。",
  },
  timeout: {
    question: weatherQuestion,
    weather: [{ city: "北京", result: { error: "TIMEOUT", message: "天气工具请求超时" } }],
    answer: "天气查询超时，我暂时无法确认北京现在的天气。",
    description: "模型读到超时信息，说明这次查询的结果。这个场景未配置重试，当前回合结束。",
  },
  partial: {
    question: "北京和上海现在各是什么天气？",
    weather: [
      { city: "北京", result: { condition: "晴", temperature_c: 22 } },
      { city: "上海", result: { error: "TIMEOUT", message: "天气工具请求超时" } },
    ],
    answer: "北京现在晴，气温 22°C。上海的天气查询超时，暂时无法确认。",
    description: "同一轮有两笔调用。模型按调用编号读到北京的天气和上海的超时结果，在答复里分别说明。",
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

function createTrace(scenario, weatherEnabled) {
  const userMessage = { role: "user", content: scenario.question };
  const weatherUnavailable = scenario.weather && !weatherEnabled;
  const trace = [{
    title: "组装模型上下文",
    owner: "Harness",
    description: weatherEnabled
      ? "运行时将系统提示、用户消息和可用工具定义送给模型。这里的工具定义说明了天气工具的用途及必填参数。"
      : "运行时仍发送原问题。天气插件已卸载，当前 Agent 没有可用的天气工具声明。",
    motion: { nodes: ["harness", "model"], link: "model" },
    caption: weatherEnabled
      ? "Harness → 模型 · 第一次请求带上问题和工具定义"
      : "Harness → 模型 · 发送同一个问题，省略天气工具声明",
    label: "模型输入",
    payload: {
      system: "根据用户问题作答，需要当前天气时使用可用工具。",
      messages: [userMessage],
      tools: weatherEnabled ? [weatherTool] : [],
    },
  }];

  if (scenario.weather && weatherEnabled) {
    const toolCalls = scenario.weather.map(({ city }, index) => ({
      id: `weather_${index + 1}`,
      name: weatherTool.name,
      arguments: { city },
    }));
    const toolMessages = scenario.weather.map(({ result }, index) => ({
      role: "tool",
      tool_call_id: toolCalls[index].id,
      content: result,
    }));
    const results = toolMessages.map(({ tool_call_id, content }) => ({
      call_id: tool_call_id,
      result: content,
    }));
    const resultLabels = scenario.weather.map(({ city, result }, index) => {
      const outcome = result.error ? "超时" : `${result.condition}、${result.temperature_c}°C`;
      return `${toolCalls[index].id} ${city}${outcome}`;
    });

    trace.push(
      {
        title: "提出工具调用",
        owner: "DeepSeek 模型",
        description: "模型在助手消息中提出工具名和参数。一条回复可以提出多笔调用，运行时为每笔保留对应的调用标识。",
        motion: { nodes: ["model", "harness"], link: "model", direction: "backward" },
        caption: "模型 → Harness · 返回工具名、参数和调用编号",
        label: "模型输出 · 工具调用提议",
        payload: { role: "assistant", tool_calls: toolCalls },
      },
      {
        title: "写入工具调用事件",
        owner: "Harness · 工具执行器",
        description: "Harness 把助手消息中的调用交给工具执行器。执行器在分派前将调用记录为会话事件，后续用同一个编号关联结果。",
        motion: { nodes: ["harness", "session"], link: "session" },
        caption: "Harness → 会话日志 · 为每笔调用追加 tool/call",
        label: "会话事件 · tool/call",
        payload: { calls: toolCalls },
      },
      {
        title: "把查询交给工具",
        owner: "Harness",
        description: "Harness 按当前作用域检查可用工具和参数，将模型请求分派给天气工具。",
        motion: { nodes: ["harness", "tool"], link: "tool", direction: "backward" },
        caption: "Harness → 工具 · 运行 get_weather",
        label: "执行器收到的调用",
        payload: { calls: toolCalls },
      },
      {
        title: "执行天气工具",
        owner: "Harness · 工具插件",
        description: "天气工具把查询结果交还给 Harness。查到的天气和超时信息都按各自的编号返回。",
        motion: { nodes: ["tool", "harness"], link: "tool" },
        caption: `工具 → Harness · ${resultLabels.join(" / ")}`,
        label: "工具返回结果",
        payload: { results },
      },
      {
        title: "写入会话日志",
        owner: "Harness · 会话日志",
        description: "Harness 追加工具结果事件。日志保留结果对应哪次调用，后续组装模型消息时会用到这个关系。",
        motion: { nodes: ["harness", "session"], link: "session" },
        caption: "Harness → 会话日志 · 追加 tool/result",
        label: "会话事件 · tool/result",
        payload: { results },
      },
      {
        title: "回填结果并继续",
        owner: "Harness · 会话日志",
        description: "运行时追加记录，从日志生成下一次请求的消息历史。工具结果通过调用标识与原请求对应。",
        motion: { nodes: ["session", "harness", "model"], link: "model" },
        caption: "Harness → 模型 · 第二次请求带上从日志重建的消息历史",
        label: "下一次模型请求 · 消息历史",
        payload: {
          messages: [userMessage, { role: "assistant", tool_calls: toolCalls }, ...toolMessages],
        },
      },
    );
  }

  trace.push({
    title: "给出最终答复",
    owner: "模型生成回复，Harness 结束回合",
    description: weatherUnavailable
      ? "本例没有其他天气工具。模型在第一次请求后说明无法确认实时天气，这一回合没有工具调用或结果需要回填。"
      : scenario.description,
    motion: { nodes: ["model", "harness"], link: "model", direction: "backward" },
    caption: "模型 → Harness · 返回最终答复，结束回合",
    label: "会话事件 · assistant/message → turn/end",
    payload: {
      role: "assistant",
      content: weatherUnavailable ? "当前没有可用的天气查询工具，我暂时无法确认实时天气。" : scenario.answer,
    },
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
const motionBoard = document.getElementById("harness-motion");
const motionCaption = document.getElementById("motion-caption");
const weatherPluginStatus = document.getElementById("weather-plugin-status");
const weatherToolState = document.getElementById("weather-tool-state");
const weatherStages = document.querySelector("#plugin-demo fieldset");

let trace;
let stepButtons;
let currentStep;
let weatherEnabled;

function hasWeatherPlugin() {
  return weatherStages.querySelector(":checked").value !== "dispose";
}

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
  showFlowMotion(motionBoard, step.motion);
  motionCaption.textContent = step.caption;
  progress.textContent = `第 ${index + 1} 步 / 共 ${trace.length} 步 · ${step.title}`;
  previous.disabled = index === 0;
  next.textContent = isLast ? "从头演示" : "下一步";
}

function loadScenario() {
  pausePlayback();
  weatherEnabled = hasWeatherPlugin();
  const scenario = scenarios[scenarioSelect.value];
  trace = createTrace(scenario, weatherEnabled);
  question.textContent = scenario.question;
  weatherPluginStatus.textContent = weatherEnabled
    ? "天气插件已挂载，模型可请求查天气"
    : "天气插件已卸载，模型请求不带天气工具声明";
  weatherToolState.textContent = weatherEnabled ? "执行查询" : "未挂载";
  motionBoard.toggleAttribute("data-weather-unavailable", !weatherEnabled);
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
    button.addEventListener("click", () => {
      pausePlayback();
      showStep(index);
    });
    item.append(button);
    stepButtons.push(button);
    return item;
  });

  steps.replaceChildren(...items);
  showStep(0);
}

const pausePlayback = createFlowPlayback(document.getElementById("play-demo"), {
  hasNext: () => currentStep < trace.length - 1,
  advance: () => showStep(currentStep + 1),
  rewind: () => showStep(0),
});

scenarioSelect.addEventListener("change", loadScenario);
weatherStages.addEventListener("change", () => {
  if (weatherEnabled !== hasWeatherPlugin()) loadScenario();
});
previous.addEventListener("click", () => {
  pausePlayback();
  showStep(currentStep - 1);
  if (currentStep === 0) next.focus();
});
next.addEventListener("click", () => {
  pausePlayback();
  showStep((currentStep + 1) % trace.length);
});

loadScenario();
simulator.hidden = false;
