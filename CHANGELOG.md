# Changelog

## 0.8.39 - 2026-11-22

### 中文

- 新增 Native Node Agent Kernel：每个参与任务的 Bot 拥有持久线程、受限模型/工具循环、角色策略、上下文压缩、事件账本和中断恢复。
- 明确单主执行与有界贡献：NOVA 不充当 Worker，每个任务只有一个主执行者；专业 Bot 只提交结构化、限长贡献，不能并发改工作区或自行申请浏览器会话。
- 增强独立 Reviewer 门禁：执行结果、团队贡献和工具证据进入独立复核；无法解析复核结果时明确降级，不虚报 PASS。
- 完善任务责任视图：Command、Mission Control 和任务详情统一显示构建版本、主执行者、贡献者与 Reviewer；修复决策角色到实际 Bot 的映射和“角色交付”占位问题。
- 加固浏览器研究链路：任务级会话复用、页面与独立来源覆盖检查、失败证据排除和重复会话申请拦截。
- 更新桌面发布：版本、启动脚本和 E 盘数据目录保持一致，并提供最新 Windows x64 便携包。

### English

- Added the Native Node Agent Kernel with persistent Bot threads, bounded model/tool loops, role policy, context compaction, event ledgers and interrupted-thread recovery.
- Enforced one primary worker and bounded contributions. NOVA remains the orchestrator; specialist Bots return structured, length-limited advice and cannot write the workspace concurrently or request independent browser sessions.
- Strengthened the independent Reviewer gate, including explicit degraded outcomes when a valid review verdict cannot be obtained.
- Unified execution ownership across Command, Mission Control and task detail views, including build identity, primary worker, contributors and Reviewer state. Fixed decision-role-to-Bot mapping and placeholder owner labels.
- Hardened browser research with task-scoped session reuse, page and independent-host evidence checks, failed-evidence exclusion and duplicate-session rejection.
- Updated the desktop release version, launcher and E-drive profile handling, with a current Windows x64 portable build.

### Recommended environment / 推荐环境

- Windows 11 x64 recommended; Windows 10 22H2 x64 supported for the portable build.
- Portable client: no Node.js installation required; reserve about 2 GB of disk.
- Source development: Node.js 22.12+ (current LTS recommended), npm and Git; 8 GB RAM minimum, 16 GB recommended for browser/MCP/multi-Bot workloads.
- Network access is required only for external model APIs, browser research and remote MCP services.

### Release policy / 发布边界

The repository contains current source, current release notes and environment guidance only. It does not include secrets, runtime data or historical installers. The latest portable artifact is `ASUKA-0.8.39-portable.exe`; the `0.8.38` installer is retained only as a local E-drive backup and is not part of this update.

仓库只维护当前源码、当前发布说明和环境指引，不提交密钥、运行数据或历史安装包。最新便携产物为 `ASUKA-0.8.39-portable.exe`；`0.8.38` 安装包仅作为本机 E 盘备份保留，不属于本次更新。
