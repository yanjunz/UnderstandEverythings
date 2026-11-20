"use strict";

const pluginDemo = document.getElementById("plugin-demo");
const pluginBoard = document.getElementById("plugin-motion");
const pluginState = document.getElementById("plugin-state");
const toolState = document.getElementById("tool-state");
const requestState = document.getElementById("request-state");
const pluginCaption = document.getElementById("plugin-caption");

const pluginStages = {
  mount: {
    plugin: "已挂载",
    tools: "已注册 get_weather",
    request: "等待组装",
    motion: { nodes: ["plugin", "tools"], link: "register" },
    caption: "天气插件 → 工具服务 · 注册 get_weather 的参数声明和执行函数。",
  },
  request: {
    plugin: "已挂载",
    tools: "当前 Agent 可见 get_weather",
    request: "包含 get_weather 声明",
    motion: { nodes: ["tools", "request"], link: "declare" },
    caption: "工具服务 → 模型请求 · 组装时仅带上工具声明，例如必填参数 city。",
  },
  dispose: {
    plugin: "已卸载",
    tools: "已移除 get_weather",
    request: "省略 get_weather 声明",
    motion: { nodes: ["plugin", "tools"], link: "register" },
    caption: "天气插件 → 工具服务 · 撤销注册，之后组装的请求会省略这个工具。",
  },
};

function showPluginStage(value) {
  const stage = pluginStages[value];
  pluginBoard.dataset.stage = value;
  pluginState.textContent = stage.plugin;
  toolState.textContent = stage.tools;
  requestState.textContent = stage.request;
  pluginCaption.textContent = stage.caption;
  showFlowMotion(pluginBoard, stage.motion);
}

const pluginStageControls = pluginDemo.querySelector("fieldset");
pluginStageControls.addEventListener("change", (event) => showPluginStage(event.target.value));
pluginDemo.hidden = false;
showPluginStage(pluginStageControls.querySelector(":checked").value);
