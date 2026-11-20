"use strict";

function showFlowMotion(board, { nodes, link, direction = "forward" }) {
  for (const node of board.querySelectorAll("[data-flow-node]")) {
    node.toggleAttribute("data-active", nodes.includes(node.dataset.flowNode));
  }
  for (const edge of board.querySelectorAll("[data-flow-link]")) {
    if (edge.dataset.flowLink === link) edge.dataset.direction = direction;
    else delete edge.dataset.direction;
  }
}

function createFlowPlayback(button, { hasNext, advance, rewind }) {
  let timer = null;

  function pause() {
    clearInterval(timer);
    timer = null;
    button.textContent = "自动播放";
  }

  button.addEventListener("click", () => {
    if (timer !== null) {
      pause();
      return;
    }
    if (!hasNext()) rewind();

    button.textContent = "暂停播放";
    timer = setInterval(() => {
      advance();
      if (!hasNext()) pause();
    }, 3500);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pause();
  });
  return pause;
}
