(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  const prompt = "解释一下这个函数";
  const agents = {
    claude: {
      name: "Claude Code",
      baseUrl: "http://127.0.0.1:3425",
      protocol: "Messages",
      endpoint: "/v1/messages",
      setting: "settings.json · env.ANTHROPIC_BASE_URL",
      credential: "ANTHROPIC_AUTH_TOKEN",
    },
    codex: {
      name: "Codex",
      baseUrl: "http://127.0.0.1:3425/v1",
      protocol: "Responses",
      endpoint: "/v1/responses",
      setting: "config.toml · [model_providers.magpie].base_url",
      credential: "experimental_bearer_token",
    },
  };

  function gatewayTrace(agent, upstreamDenied) {
    return [
      {
        short: "原来直连",
        title: "接入前，Agent 直接请求原服务",
        description:
          "Agent 使用原服务的 Base URL 和原服务认可的凭据。请求的目的地由 Agent 的模型客户端配置决定。",
        code: "当前 Base URL → 原服务地址\n当前凭据 → 原服务的凭据",
        caption: `${agent.name} → 原模型服务 · 携带原服务凭据`,
        motion: { nodes: ["agent", "original"], link: "direct" },
      },
      {
        short: "改 Base URL",
        title: "把 Agent 的模型请求指向本机 Magpie",
        description:
          "Magpie 修改 Agent 支持的配置项，并记录原设置供断开时恢复。新地址在 Agent 的配置实际生效后使用。",
        code: `${agent.setting}\n→ ${agent.baseUrl}\n${agent.credential} → Magpie 入口凭据`,
        caption: "Agent 的客户端配置生效 · 当前 Base URL 改为本机入口",
        motion: { nodes: ["agent", "magpie"] },
      },
      {
        short: "入口收请求",
        title: "第一段，Agent 请求 Magpie",
        description: `${agent.name} 仍按 ${agent.protocol} 组织请求。它把问题和模型标识送到本机，Magpie 按自己的入口策略接收调用。`,
        code: `POST ${agent.endpoint}\n入口凭据：Magpie Gateway key 或本机访问策略\nmodel: deepseek/deepseek-chat\n「${prompt}」`,
        caption: `${agent.name} → Magpie · 使用 Magpie 的入口策略`,
        motion: { nodes: ["agent", "magpie"], link: "local" },
      },
      {
        short: "查上游配置",
        title: "从 Magpie 的供应商配置确定下一跳",
        description:
          "示例直接指定 deepseek/deepseek-chat，Magpie 读取自己存的 DeepSeek 上游地址、协议和凭据。这个地址可来自预设或手工配置。",
        code: "请求的 model：deepseek/deepseek-chat\n供应商：deepseek\n上游 Base URL：https://api.deepseek.com\n上游模型：deepseek-chat",
        caption: "Magpie 查自己的配置 · 确定模型服务地址和认证方式",
        motion: { nodes: ["magpie"] },
      },
      {
        short: "带上游 key",
        title: "第二段，Magpie 用上游凭据请求模型",
        description: `Magpie 将 ${agent.protocol} 转成示例上游的 Chat Completions 格式，并使用 DeepSeek 认可的 API key。`,
        code: `${agent.protocol} → Chat Completions\nPOST https://api.deepseek.com/chat/completions\nAuthorization: Bearer <DeepSeek API key>\nmodel: deepseek-chat`,
        caption: "Magpie → DeepSeek · 携带供应商自己的 API key",
        motion: { nodes: ["magpie", "provider"], link: "upstream" },
      },
      {
        short: "看上游结果",
        title: upstreamDenied
          ? "上游独立验凭据，返回 401"
          : "上游验过凭据，开始返回模型回复",
        description: upstreamDenied
          ? "Agent 已经成功把请求送到本机，DeepSeek 收到的是第二份凭据。这里模拟该凭据无效，上游独立拒绝请求。"
          : "模型生成回复。Magpie 解码上游流式事件，再按 Agent 使用的协议重组。",
        code: upstreamDenied
          ? "Agent → Magpie：入口已接收\nMagpie → DeepSeek：上游凭据无效\nHTTP 401 Unauthorized"
          : `上游 Chat 流式数据\n→ 内部事件 → ${agent.protocol} 事件`,
        caption: upstreamDenied
          ? "DeepSeek → Magpie · HTTP 401，第一段成功与第二段拒绝可以同时发生"
          : "DeepSeek → Magpie · 返回生成的内容与流式事件",
        motion: {
          nodes: ["provider", "magpie"],
          link: "upstream",
          direction: "backward",
        },
      },
      {
        short: "返回 Agent",
        title: upstreamDenied
          ? "Agent 收到上游鉴权错误"
          : "Agent 收到可读的回复",
        description: upstreamDenied
          ? "这个演示只有一个上游。Magpie 把失败传回 Agent，此时应核对 DeepSeek 供应商的凭据。"
          : "Agent 展示结果。若回复包含工具调用，普通模型 API 路径中由 Agent 按自身权限处理，并把结果送进下一轮。",
        code: upstreamDenied
          ? "单一上游 · 无备用候选\nMagpie → Agent：返回上游错误"
          : "文字 → Agent 展示\n工具调用 → Agent 检查并执行",
        caption: upstreamDenied
          ? `Magpie → ${agent.name} · 上游鉴权失败`
          : `Magpie → ${agent.name} · 返回客户端能读取的回复`,
        motion: {
          nodes: ["magpie", "agent"],
          link: "local",
          direction: "backward",
        },
      },
    ];
  }

  const flowBoard = $("#flow-diagram");
  const agentSelect = $("#flow-agent");
  const outcomeSelect = $("#flow-outcome");
  let flowSteps = [];
  let flowButtons = [];
  let step = 0;

  function renderFlow(index) {
    step = index;
    const current = flowSteps[step];
    const agent = agents[agentSelect.value];
    flowBoard.dataset.stage = String(step);
    flowBoard.toggleAttribute(
      "data-denied",
      step >= 5 && outcomeSelect.value === "unauthorized",
    );
    $("#direct-lane").hidden = step !== 0;
    $("#gateway-lane").hidden = step === 0;
    $("#flow-credentials").hidden = step === 0;
    $("#flow-address").textContent = step === 0 ? "原服务地址" : agent.baseUrl;
    $("#flow-step-label").textContent =
      `第 ${step + 1} 步 / 共 ${flowSteps.length} 步`;
    $("#flow-title").textContent = current.title;
    $("#flow-description").textContent = current.description;
    $("#flow-code").textContent = current.code;
    $("#flow-caption").textContent = current.caption;
    showFlowMotion(flowBoard, current.motion);

    flowButtons.forEach((button, i) => {
      button.setAttribute("aria-pressed", String(i === step));
      button.classList.toggle("completed", i < step);
    });
    $("#flow-back").disabled = step === 0;
    $("#flow-next").disabled = step === flowSteps.length - 1;
  }

  const stopFlow = createFlowPlayback($("#flow-play"), {
    hasNext: () => step < flowSteps.length - 1,
    advance: () => renderFlow(step + 1),
    rewind: () => renderFlow(0),
  });

  function loadFlow() {
    stopFlow();
    const agent = agents[agentSelect.value];
    flowSteps = gatewayTrace(agent, outcomeSelect.value === "unauthorized");
    $("#direct-agent-name").textContent = agent.name;
    $("#gateway-agent-name").textContent = agent.name;
    flowButtons = flowSteps.map(({ short }, index) => {
      const button = document.createElement("button");
      const number = document.createElement("b");
      const label = document.createElement("span");
      button.type = "button";
      button.dataset.step = String(index);
      number.textContent = index + 1;
      number.setAttribute("aria-hidden", "true");
      label.textContent = short;
      button.append(number, label);
      button.addEventListener("click", () => {
        stopFlow();
        renderFlow(index);
      });
      return button;
    });
    $("#flow-steps").replaceChildren(...flowButtons);
    $("#gateway-experiment").hidden = false;
    renderFlow(0);
  }

  agentSelect.addEventListener("change", loadFlow);
  outcomeSelect.addEventListener("change", loadFlow);
  $("#flow-next").addEventListener("click", () => {
    stopFlow();
    renderFlow(step + 1);
  });
  $("#flow-back").addEventListener("click", () => {
    stopFlow();
    renderFlow(step - 1);
    if (step === 0) $("#flow-next").focus();
  });
  $("#flow-reset").addEventListener("click", () => {
    stopFlow();
    renderFlow(0);
  });
  loadFlow();

  const protocols = {
    claude: {
      name: "Messages",
      endpoint: "POST /v1/messages",
      body: {
        model: "deepseek/deepseek-chat",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      },
      note: "Messages 的 content 可以是文本，也可以是内容块数组。这里读取角色与文字，再构建 Chat 的 messages；完整实现还要处理 system、图片、工具和推理等内容。",
    },
    codex: {
      name: "Responses",
      endpoint: "POST /v1/responses",
      body: {
        model: "deepseek/deepseek-chat",
        max_output_tokens: 1024,
        input: [
          { role: "user", content: [{ type: "input_text", text: prompt }] },
        ],
      },
      note: "Responses 把用户输入放在 input，文字块的类型叫 input_text。字段变了，但这里表达的角色与文字相同；输出也要转换回 Responses 的事件格式。",
    },
    gemini: {
      name: "Gemini",
      endpoint: "POST /v1beta/models/{模型}:generateContent",
      body: {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 1024 },
      },
      note: "Gemini 把文字放在 contents → parts → text，模型标识通常在 URL 路径中。这是非流式精简例；真实 Gemini CLI 的流式请求会使用相应的流式入口。",
    },
  };

  function showProtocol(key, focus = false) {
    const protocol = protocols[key];
    $$("[data-protocol]").forEach((tab) => {
      const active = tab.dataset.protocol === key;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      if (active && focus) tab.focus();
    });
    $("#protocol-panel").setAttribute("aria-labelledby", `tab-${key}`);
    $("#protocol-kind").textContent = protocol.name;
    $("#protocol-endpoint").textContent = protocol.endpoint;
    $("#protocol-input").textContent = JSON.stringify(protocol.body, null, 2);
    $("#protocol-output").textContent = JSON.stringify(
      {
        model: "deepseek-chat",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      },
      null,
      2,
    );
    $("#protocol-explanation").textContent = protocol.note;
  }
  $$("[data-protocol]").forEach((tab, index, tabs) => {
    tab.addEventListener("click", () => showProtocol(tab.dataset.protocol));
    tab.addEventListener("keydown", (event) => {
      let next;
      if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
      if (event.key === "ArrowLeft")
        next = (index + tabs.length - 1) % tabs.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = tabs.length - 1;
      if (next !== undefined) {
        event.preventDefault();
        showProtocol(tabs[next].dataset.protocol, true);
      }
    });
  });
  showProtocol("claude");

  let routeTimer;
  const exhausted = $("#primary-exhausted");
  const backup = $("#backup-enabled");
  const send = $("#route-send");
  const log = $("#route-log");

  function candidate(which, state, text) {
    $(`#candidate-${which}`).dataset.status = state;
    $(`#${which}-status`).textContent = text;
  }
  function prepareRoute() {
    clearTimeout(routeTimer);
    candidate("primary", "", exhausted.checked ? "模拟无额度" : "待命");
    candidate(
      "backup",
      backup.checked ? "" : "off",
      backup.checked ? "待命" : "未配置",
    );
    log.classList.remove("error");
    log.textContent = "设置已就绪。发送一次请求，观察它的去向。";
  }
  function finishRoute() {
    send.disabled = false;
    exhausted.disabled = false;
    backup.disabled = false;
    send.innerHTML = "再发送一次 <span>↗</span>";
  }
  exhausted.addEventListener("change", prepareRoute);
  backup.addEventListener("change", prepareRoute);
  send.addEventListener("click", () => {
    prepareRoute();
    send.disabled = exhausted.disabled = backup.disabled = true;
    send.textContent = "观察路由中…";
    candidate("primary", "trying", "请求中…");
    log.textContent =
      "→ 读取 group/daily-coding\n→ order：先尝试 DeepSeek 主账号";
    routeTimer = setTimeout(() => {
      if (!exhausted.checked) {
        candidate("primary", "success", "✓ 已回答");
        log.textContent += "\n✓ 主账号可用，回复返回 Agent\n· 无需使用备用模型";
        finishRoute();
        return;
      }
      candidate("primary", "error", "429 无额度");
      log.textContent += "\n× 主账号在输出前返回 429";
      if (!backup.checked) {
        log.classList.add("error");
        log.textContent += "\n× 没有可用候选，错误返回 Agent";
        finishRoute();
        return;
      }
      candidate("backup", "trying", "接替请求…");
      log.textContent += "\n→ 尝试下一候选：Kimi";
      routeTimer = setTimeout(() => {
        candidate("backup", "success", "✓ 已回答");
        log.textContent += "\n✓ 备用模型回答，回复返回 Agent";
        finishRoute();
      }, 700);
    }, 700);
  });

  const answers = [1, 2, 1];
  const explanations = [
    "DeepSeek 生成回答。Claude Code 组织上下文并执行工具，Magpie 协调路由和协议。",
    "错误仍会返回 Agent。故障切换需要可用候选，Magpie 无法凭空创造额度。",
    "先经过本机，再发到云端。本地网关不等于本地模型；是否出网取决于选择的服务。",
  ];
  function updateQuiz() {
    let answered = 0;
    let correct = 0;
    $$("[data-question]").forEach((question, index) => {
      const selected = question.querySelector("input:checked");
      const feedback = question.querySelector(".quiz-feedback");
      if (!selected) {
        delete question.dataset.correct;
        feedback.textContent = "";
        return;
      }
      answered += 1;
      const isCorrect = Number(selected.value) === answers[index];
      if (isCorrect) correct += 1;
      question.dataset.correct = String(isCorrect);
      feedback.textContent = `${isCorrect ? "✓ 理解得对。" : "↳ 再想一下。"}${explanations[index]}`;
    });
    $("#quiz-progress").textContent = `已作答 ${answered} / 3`;
    $("#quiz-result").textContent =
      answered === 3
        ? correct === 3
          ? "3 / 3 全部理解了。下一次，试着向别人讲一遍。"
          : `答对 ${correct} / 3。可以修改答案，再试一次。`
        : answered
          ? `已答对 ${correct} 题，继续探索。`
          : "选一个答案，就能看到解释。";
  }
  $$("#quiz input").forEach((input) =>
    input.addEventListener("change", updateQuiz),
  );
  $("#quiz-reset").addEventListener("click", () => {
    $$("#quiz input").forEach((input) => {
      input.checked = false;
    });
    updateQuiz();
  });

  const sections = $$("#perspectives, .lesson-section, #questions, #sources");
  const nav = $$(".chapter-nav a");
  let scheduled = false;
  function updateReading() {
    const total = document.documentElement.scrollHeight - window.innerHeight;
    $("#reading-progress").style.width =
      `${total > 0 ? Math.min(100, (window.scrollY / total) * 100) : 100}%`;
    let current = sections[0].id;
    for (const section of sections) {
      if (
        section.getClientRects().length &&
        section.getBoundingClientRect().top <= 150
      ) {
        current = section.id;
      }
    }
    nav.forEach((link) => {
      if (link.hash === `#${current}`)
        link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
    scheduled = false;
  }
  function scheduleReading() {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(updateReading);
    }
  }
  window.addEventListener("scroll", scheduleReading, { passive: true });
  window.addEventListener("resize", scheduleReading, { passive: true });
  window.addEventListener("hashchange", scheduleReading);
  $("[data-perspective-tabs]").addEventListener("perspectivechange", () => {
    stopFlow();
    scheduleReading();
  });
  updateReading();
})();
