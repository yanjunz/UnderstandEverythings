(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  // A deliberately simplified teaching sequence, not a live gateway trace.
  const steps = [
    {
      title: "Agent 把你的话组织成请求",
      description:
        "Claude Code 把问题、对话上下文和可用工具整理成它熟悉的 Anthropic Messages 格式。它不需要先学会 DeepSeek 的 API。",
      code: "POST /v1/messages\nmodel: deepseek/deepseek-chat\n「解释一下这个函数」",
      statuses: ["正在组织请求", "等待请求", "等待请求"],
    },
    {
      title: "请求先来到你电脑上的 Magpie",
      description:
        "接入时，Magpie 已把 Agent 的相关配置指向本地入口。请求先来到默认的 127.0.0.1:3425，而不是直接发给原来的厂商。",
      code: "Claude Code → 本地网关\n地址: 127.0.0.1:3425\n入口: Anthropic Messages",
      statuses: ["已发送请求", "收到请求", "等待请求"],
    },
    {
      title: "根据模型标识，找到去处",
      description:
        "在这个直接指定模型的例子里，deepseek/deepseek-chat 指向 DeepSeek 服务商的模型。若选择路由组，网关还要按组策略挑选模型、key 或账号。",
      code: "deepseek / deepseek-chat\n  ↓ 服务商 / 模型\n选择可用的上游认证",
      statuses: ["等待回复", "选择服务商与模型", "等待请求"],
    },
    {
      title: "按需要，把请求翻译成另一种协议",
      description:
        "本例让 Messages 请求转成共同内部结构，再构建成 Chat Completions 请求。模型前的服务商前缀被解析；接下来使用上游所需的认证发出。",
      code: "Messages → 内部 Request → Chat\n上游 model: deepseek-chat\n使用配置的服务商凭据",
      statuses: ["等待回复", "转换并发往上游", "收到请求"],
    },
    {
      title: "模型推理，网关把回复翻译回来",
      description:
        "DeepSeek 根据实际收到的上下文生成回复。对于流式输出，网关把上游片段解码成内部事件，再编码成 Claude Code 理解的 Messages 事件。",
      code: "DeepSeek 生成一段内容\nChat 事件 → 内部 Event\n→ Messages 事件 → Claude Code",
      statuses: ["接收流式回复", "反向转换回复", "正在生成回答"],
    },
    {
      title: "Agent 收到回答，继续它的工作",
      description:
        "Claude Code 展示回答；若返回的是工具调用，就由 Agent 按权限执行工具，再把结果加入下一轮请求。你保留 Agent 的工作方式，换掉了它背后的模型。",
      code: "文字 → 显示给你\n工具调用 → Agent 检查并执行\n工具结果 → 下一轮请求",
      statuses: ["收到回答，继续工作", "本次请求完成", "本次生成结束"],
    },
  ];
  let step = 0;
  let playTimer = null;

  function stopFlow() {
    clearInterval(playTimer);
    playTimer = null;
    $("#flow-play").innerHTML = '<span aria-hidden="true">▷</span> 自动演示';
    $("#flow-play").setAttribute("aria-label", "自动演示请求流程");
  }

  function renderFlow(index) {
    step = Math.max(0, Math.min(steps.length - 1, index));
    const current = steps[step];
    $("#flow-diagram").dataset.stage = String(step);
    $("#flow-step-label").textContent =
      `STEP ${String(step + 1).padStart(2, "0")} / 06`;
    $("#flow-title").textContent = current.title;
    $("#flow-description").textContent = current.description;
    $("#flow-code").textContent = current.code;
    ["#agent-status", "#gateway-status", "#model-status"].forEach((id, i) => {
      $(id).textContent = current.statuses[i];
    });
    $$("[data-step]").forEach((button, i) => {
      button.setAttribute("aria-pressed", String(i === step));
      button.classList.toggle("completed", i < step);
    });
    $("#flow-back").disabled = step === 0;
    $("#flow-next").disabled = step === steps.length - 1;
    if (step === steps.length - 1) stopFlow();
  }

  $$("[data-step]").forEach((button) =>
    button.addEventListener("click", () => {
      stopFlow();
      renderFlow(Number(button.dataset.step));
    }),
  );
  $("#flow-next").addEventListener("click", () => {
    stopFlow();
    renderFlow(step + 1);
  });
  $("#flow-back").addEventListener("click", () => {
    stopFlow();
    renderFlow(step - 1);
  });
  $("#flow-reset").addEventListener("click", () => {
    stopFlow();
    renderFlow(0);
  });
  $("#flow-play").addEventListener("click", () => {
    if (playTimer !== null) {
      stopFlow();
      return;
    }
    if (step === steps.length - 1) renderFlow(0);
    $("#flow-play").innerHTML = '<span aria-hidden="true">Ⅱ</span> 暂停演示';
    $("#flow-play").setAttribute("aria-label", "暂停请求流程演示");
    playTimer = setInterval(() => renderFlow(step + 1), 3500);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopFlow();
  });
  renderFlow(0);

  const prompt = "解释一下这个函数";
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
    if ($("#beginner").hidden) stopFlow();
    scheduleReading();
  });
  updateReading();
})();
