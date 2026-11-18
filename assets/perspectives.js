"use strict";

const perspectiveList = document.querySelector("[data-perspective-tabs]");
const perspectiveTabs = Array.from(perspectiveList.querySelectorAll("a"));
const perspectivePanels = perspectiveTabs.map((tab) => document.getElementById(tab.hash.slice(1)));

function activatePerspective(selectedIndex) {
  perspectiveTabs.forEach((tab, index) => {
    const selected = index === selectedIndex;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    perspectivePanels[index].hidden = !selected;
  });
  perspectiveList.dispatchEvent(new Event("perspectivechange"));
}

function perspectiveFromLocation() {
  const target = document.getElementById(location.hash.slice(1));
  return perspectivePanels.findIndex((panel) => panel.contains(target));
}

function selectPerspective(index) {
  const tab = perspectiveTabs[index];
  activatePerspective(index);
  history.replaceState(history.state, "", tab.hash);
}

perspectiveList.setAttribute("role", "tablist");
perspectiveTabs.forEach((tab, index) => {
  const panel = perspectivePanels[index];
  tab.setAttribute("role", "tab");
  tab.setAttribute("aria-controls", panel.id);
  panel.setAttribute("role", "tabpanel");
  panel.setAttribute("aria-labelledby", tab.id);
  panel.tabIndex = 0;

  tab.addEventListener("click", (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    selectPerspective(index);
  });
});

perspectiveList.addEventListener("keydown", (event) => {
  const current = perspectiveTabs.indexOf(event.target);
  if (current === -1) return;

  const last = perspectiveTabs.length - 1;
  let next;
  switch (event.key) {
    case "ArrowLeft": next = current === 0 ? last : current - 1; break;
    case "ArrowRight": next = current === last ? 0 : current + 1; break;
    case "Home": next = 0; break;
    case "End": next = last; break;
    case " ": next = current; break;
    default: return;
  }

  event.preventDefault();
  selectPerspective(next);
  perspectiveTabs[next].focus();
});

activatePerspective(Math.max(0, perspectiveFromLocation()));
window.addEventListener("hashchange", () => {
  const index = perspectiveFromLocation();
  if (index === -1 || !perspectivePanels[index].hidden) return;

  activatePerspective(index);
  document.getElementById(location.hash.slice(1)).scrollIntoView();
});
