# Team Packs / 团队包

Status: roadmap. Team Packs are not yet a shipped runtime feature.

状态：路线图。团队包尚未作为运行时功能发布。

## Concept / 概念

A Skill packages reusable instructions, resources and scripts for an agent. A Team Pack packages a reusable **team** for a class of work: roles, required Skills, tool permissions, input requirements, deliverables, approval gates and acceptance criteria.

Skill 为 Agent 打包可复用的指令、资源和脚本；团队包则为某类工作打包一支可复用的 **Bot 团队**，包括角色、所需 Skill、工具权限、输入要求、交付物、审批点和验收标准。

The intended user flow is: select a Team Pack, provide the task inputs, let NOVA instantiate or bind the required Bots, then execute through the normal single-primary-worker and independent-reviewer workflow.

预期使用流程是：选择团队包、提供任务输入，由 NOVA 实例化或绑定所需 Bot，再通过现有的单主执行者与独立 Reviewer 流程完成任务。

## Planned package shape / 计划中的包结构

```text
team-packs/
  cad-design-review/
    TEAM.md                 # scope, roles, inputs, outputs, gates
    team.json               # machine-readable manifest
    skills/                 # required or optional Skill references
    references/             # domain standards and review checklists
    examples/               # safe sample briefs and expected artifacts
```

The manifest is expected to declare:

- team ID, version, description and supported task types;
- role definitions and the preferred primary-worker capability;
- required, optional and forbidden Skills;
- MCP or domain-tool requirements and permission tiers;
- required input files, units, tolerances and source-of-truth rules;
- deliverables and machine-checkable acceptance criteria;
- blocking approval points and stop conditions;
- evaluation samples, known limitations and compatibility notes.

Manifest 需要声明团队 ID、版本、描述和任务类型，角色及主执行能力偏好，必需/可选/禁用 Skill，MCP 或领域工具与权限层级，输入文件、单位、公差和事实来源规则，交付物与可机器检查的验收条件，阻断审批点与停止条件，以及评测样例、已知限制和兼容性说明。

## Candidate domains / 候选领域

- **CAD**: parametric modeling, drawing consistency, dimension/unit checks, BOM extraction and change-impact review.
- **CNC**: setup-sheet review, toolpath preflight, tool and material constraints, collision/risk prompts and post-processing checks.
- **Design**: product design briefs, industrial-design critique, design-system consistency, manufacturability review and deliverable packaging.
- **CAD**：参数化建模、图纸一致性、尺寸与单位检查、BOM 提取和变更影响复核。
- **CNC**：装夹单检查、刀路预检、刀具与材料约束、碰撞风险提示和后处理检查。
- **Design**：产品设计简报、工业设计评审、设计系统一致性、可制造性复核和交付物整理。

These are candidate directions, not promises of specific CAD/CNC engine integration. Any future integration must document file-format support, tool versions, licensing, safety boundaries and verification evidence.

以上是候选方向，不承诺已经集成任何特定 CAD/CNC 引擎。未来集成必须记录文件格式支持范围、工具版本、许可证、安全边界和验证证据。

## Safety and quality boundaries / 安全与质量边界

- A Team Pack cannot bypass the single-primary-worker rule or create parallel writers in one workspace.
- Specialist Bots remain bounded contributors unless NOVA explicitly assigns the primary role.
- File-changing CAD/CNC/GUI actions require the existing approval and audit path.
- A pack must state what it can verify and what still requires a human engineer, licensed software or a physical check.
- Public examples must use synthetic or licensed data and must not contain customer drawings or secrets.

- 团队包不能绕过单主执行规则，也不能在同一工作区内制造多个并发写入者。
- 除 NOVA 明确指定主执行角色外，专业 Bot 只作为有界贡献者。
- 修改 CAD/CNC 文件或执行 GUI 动作时，必须沿用现有审批和审计路径。
- 团队包必须说明哪些结果可自动验证，哪些仍需要工程师、授权软件或实物检查。
- 公开示例必须使用合成或已授权数据，不得包含客户图纸或密钥。

## Contribution invitation / 欢迎参与

Proposals are welcome as issues or draft pull requests. Useful proposals include a target workflow, sample inputs, required tools, role split, review checklist, failure cases and an observable acceptance test.

欢迎通过 Issue 或草稿 PR 提交方案。高质量方案应包含目标任务流程、样例输入、所需工具、角色拆分、复核清单、失败案例和可观察的验收测试。
