# UnderstandEverythings

理解万物。每个主题用一个独立网页解释一项原理，提供初学者和架构师两种视角。从具体例子理解工作流程，或沿组件边界、数据流和设计取舍深入阅读。

当前主题

- [DeepSeek Harness 原理](topics/deepseek-harness/index.html)从一次天气查询入手，展示上下文组装、工具调用和回合结束。
- [Magpie 的运行原理](topics/magpie/index.html)跟踪一次模型请求，展示网关接入、协议转换、路由和故障切换。

在仓库根目录运行 `python3 -m http.server 8000`，然后打开 [主题目录](http://localhost:8000/)，按标题、简介或关键词查找主题。

正式站的首页显示全站 PV，主题页显示本页 PV。全站数值是首页与当前收录主题的浏览量之和。计数由 Abacus 保存，统计从上线后开始，每次加载正式站页面计一次。正式站地址在 `assets/pageviews.js` 中配置。[Abacus 文档](https://v2.jasoncameron.dev/abacus/)

新增主题请参阅[主题网页贡献指南](CONTRIBUTING.md)，其中包含目录约定、写作模板和验收清单。
