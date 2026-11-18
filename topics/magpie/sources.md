# Magpie：来源与实现对照

研究对象是 **[yetone/magpie](https://github.com/yetone/magpie)**，不是同名的窗口缩放工具或指令数据生成项目。

本篇查阅版本：[`9314999a4a771eccda4888d3fa7cde84e8bef855`](https://github.com/yetone/magpie/tree/9314999a4a771eccda4888d3fa7cde84e8bef855)。查阅日期：2026-11-18。

以下路径均相对于该固定版本，不声称覆盖后续版本。

| 页面中的结论 | 主要依据 |
| --- | --- |
| 本地网关，默认 `127.0.0.1:3425`；支持 Chat、Responses、Messages、Gemini | [官方中文 README](https://github.com/yetone/magpie/blob/9314999a4a771eccda4888d3fa7cde84e8bef855/README.zh-CN.md)；[`gateway.go` 的 DefaultAddr、Handler](https://github.com/yetone/magpie/blob/9314999a4a771eccda4888d3fa7cde84e8bef855/internal/gateway/gateway.go#L47) |
| 修改 Agent 自身配置以接入，记录并支持恢复 | [Agent wiring](https://github.com/yetone/magpie/blob/9314999a4a771eccda4888d3fa7cde84e8bef855/docs/subsystems/agent-wiring.md)，`internal/agent` 中的 Apply、stash、Disconnect |
| 跨协议读取为共同内部结构，再构建目标请求 | [`ir.go`](https://github.com/yetone/magpie/blob/9314999a4a771eccda4888d3fa7cde84e8bef855/internal/gateway/ir.go)；[`gateway.go` 的 parseRequest 与 build](https://github.com/yetone/magpie/blob/9314999a4a771eccda4888d3fa7cde84e8bef855/internal/gateway/gateway.go#L9906) |
| 回复中的文本、工具调用、推理需要正确转换 | [`chat.go`](https://github.com/yetone/magpie/blob/9314999a4a771eccda4888d3fa7cde84e8bef855/internal/gateway/chat.go)、[`anthropic.go`](https://github.com/yetone/magpie/blob/9314999a4a771eccda4888d3fa7cde84e8bef855/internal/gateway/anthropic.go)、[`responses.go`](https://github.com/yetone/magpie/blob/9314999a4a771eccda4888d3fa7cde84e8bef855/internal/gateway/responses.go) 的 decoder、encoder，以及 `ir.go` 的 Event |
| 相同协议在条件合适时可原生转发，非所有请求都强制往返 IR | [`gateway.go` 的 attempt、relay 选择](https://github.com/yetone/magpie/blob/9314999a4a771eccda4888d3fa7cde84e8bef855/internal/gateway/gateway.go#L5933)，[Gateway routing](https://github.com/yetone/magpie/blob/9314999a4a771eccda4888d3fa7cde84e8bef855/docs/subsystems/gateway-routing.md) |
| 路由组、顺序选择、订阅账号切换；无候选时错误仍返回 | 官方 README 的 Routing groups；Gateway routing 的运行路径与失败行为 |
| 教学中的故障切换以回复尚未输出为前提 | Gateway routing 开头明确描述：upstream fails before any of the reply is sent；真实代码还要考虑失败类型、候选资格、会话与已输出内容 |
| 普通 API 路径中，工具执行和后续推理轮次属于客户端 | [Gateway request hooks](https://github.com/yetone/magpie/blob/9314999a4a771eccda4888d3fa7cde84e8bef855/docs/subsystems/gateway-request-hooks.md) 开头的职责约定；页面明确区分内置工具、MCP 和订阅桥接路径 |
| Claude 订阅会使用本地 claude 程序，并桥接工具 | [Claude subscription bridge](https://github.com/yetone/magpie/blob/9314999a4a771eccda4888d3fa7cde84e8bef855/docs/subsystems/claude-subscription-bridge.md)；官方 README 的 Subscriptions |
| 隐私脱敏可选且默认关闭；不是本地推理保证 | 官方 README 的 Privacy masking 及其已列明的识别局限 |

## 交互示意的边界

- 请求流程中的六步是便于学习的逻辑分组，不是源码中严格的一一对应函数调用栈；省略中间件、插件、协议探测、缓存、限流、取消与服务商特殊规则。
- 协议对照仅展示单条用户文字及输出上限。真实 Agent 请求更复杂；Gemini 示例采用非流式入口，以免把 URL 与内容结构混在一起。IR 卡片是含义示意，不是真正的 Go 对象序列化格式。
- `deepseek/deepseek-chat` 用于解释 `provider/model` 的结构，不构成该模型、服务商或账号当前可用的承诺。Chat 例子的路径相对于服务商配置的基础地址；实际完整 URL 取决于配置。
- 路由实验只模拟 `order` 组的三个分支：首选成功、首选 429 后备用成功、首选 429 且无备用。计时为 UI 演示，不是延迟测量；不能据此概括所有 429、错误状态和重试策略。
- 页面不会连接本机 Magpie、调用模型、读取 Agent 配置或请求 API key。答案和日志全部来自浏览器内的固定教学数据。
- 本篇依据文档与静态源码阅读，不声称在本环境编译或运行过 Magpie 本体，也不验证其所有兼容性和隐私行为。

## 建议继续阅读的顺序

1. README 中的整体结构：确定组件与术语。
2. `docs/subsystems/agent-wiring.md`：理解请求为何先到 Magpie。
3. `docs/subsystems/gateway-routing.md`：理解目标选择和失败边界。
4. `internal/gateway/ir.go` → `gateway.go` 中的 `parseRequest` / `build` → 各协议 decoder / encoder：研究转换实现。
5. 若关注订阅复用，再单独研究 `claude-subscription-bridge.md`，不要用 API key 直连路径推断它的细节。
