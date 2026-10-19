# 数据库迁移导出说明（技能树 · 人才管理系统）

> 导出时间：2026-10-15 ｜ 来源：妙搭应用数据库（只读通道 `lark-cli apps +db-table-get` / `+db-data-export`）
> 全部 27 张业务表均可导出，**无失败表**；`talent_shortlist_item` 为空表（0 行，仅有结构）。

## 1. 文件清单

| 文件 | 内容 |
|---|---|
| `migration/skilltree-full-export.sql` | **主交付物**：27 张表完整 DDL（含主键/UNIQUE 约束/索引/COMMENT）+ 346 行演示数据 INSERT + RLS 段（注释态），整文件包在 `BEGIN…COMMIT` 事务中 |
| `migration/export/<table>.sql` | 27 个分表数据文件（已剥离 workspace schema 前缀、补分号），便于分批导入或单表重放 |
| `migration/README.md` | 本说明 |

## 2. 导入方式

```bash
psql -d <目标库> -f migration/skilltree-full-export.sql
```

- 整个文件是一个事务：任何一步失败全部回滚。
- 需要目标库具备 `CREATE EXTENSION pgcrypto` 权限（PG13+ 内置 `gen_random_uuid()`，扩展仅为低版本兜底）。
- 未在本沙箱内做独立 PostgreSQL 的恢复实测（沙箱无本地 PG 实例），首次导入请在测试库演练。

## 3. 自定义类型与审计列（重要）

- **`user_profile` 复合类型**：平台内置类型 `(user_id varchar, name varchar, email varchar, avatar text, status integer)`，导出文件头部已提供等价 `CREATE TYPE`，独立库必须先建。
- **每表 4 个审计列**：`_created_at/_updated_at`（timestamptz(3)，默认 CURRENT_TIMESTAMP）+ `_created_by/_updated_by`（user_profile 类型）。后两者的 **DEFAULT 表达式引用平台会话变量** `current_setting('app.user_id', true)`——独立库中该变量不存在时表达式走 ELSE 分支，生成全 NULL 字段值，不影响导入；若不需要审计语义，可将默认值简化为 `NULL`。
- **`_created_by/_updated_by` 的存量值**（如 `(1809773148953787)`）是妙搭平台内部数字用户 ID，在独立环境中无业务含义、无法解析为人员，可整体 `UPDATE ... SET _created_by = NULL` 清理。不含任何账号、令牌或连接密钥。

## 4. 结构约定（迁移到新库时需知晓）

- **主键**：每表 `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`，INSERT 显式携带原 uuid（已保留原值，跨表软关联不断链）。
- **唯一约束**：`employee.slug`、`skill.slug`、`career_node.slug`、`approval.slug`、`employee_skill.slug` 等 15 处 UNIQUE（inline CONSTRAINT，文件内可见 `*_slug_key`）。
- **无外键约束**：全部表间关系为 slug/uuid **软关联**（如 `skill.category_slug`→`skill_category.slug`、`idp_action.phase_id`→`idp_phase.id`），数据库层不校验，导入顺序因此不严格依赖，但建议按文件内顺序（字典/员工 → 业务）执行。
- **无 pgEnum/CHECK**：所有枚举值（`talent_candidate.tier`、`succession_candidate.bucket`、`skill_category.kind`、`approval.status` 等）均为 varchar，取值仅由应用层约定（详见 `docs/implementation-handover.md` 第三节状态机）。
- **业务"时间"多为 varchar 展示标签**：`approval.due/submitted_at`、`employee.hire_date('2023.03')`、`skill_event.date_label` 等不是时间戳类型，排序按 `sort int` 列，迁移后不要误改列类型。
- **JSONB 字段**：原样保留（`employee.responsibilities/collaboration/development_actions/management_profile`、`employee_skill.evidence`、`team_role.skills/candidate_slugs`、`talent_candidate.dimensions/evidence` 等），字段内部结构以 DDL 中 `COMMENT ON COLUMN ... IS '@type {...}'` 注释为准。
- **次级索引**：16 个普通索引（`idx_skill_category`、`idx_employee_skill_emp`、`idx_career_node_seq`、`idx_idp_phase_plan` 等）已含在 DDL 中。

## 5. RLS 行级安全（文末注释段）

原库对 27 张表各建 4 条 policy（共 108 条），但**依赖妙搭平台专属角色**（`service_role_workspace_*` / `authenticated_workspace_*` / `anon_workspace_*`，已归一化为 `service_role` / `authenticated` / `anon`）与会话变量 `app.user_id`；其中"修改本人数据"策略的限定条件是恒假表达式，实际不生效。因此导出文件将整段 RLS 置于注释中：

- 单租户独立部署：无需启用，忽略该段即可。
- 需要行级安全：取消注释前先 `CREATE ROLE` 同名角色，并按新权限模型改写策略。

## 6. 各表行数（合计 346 行）

| 表 | 行数 | 表 | 行数 |
|---|---|---|---|
| skill | 81 | career_node_skill | 64 |
| employee_skill | 22 | employee_trait | 15 |
| idp_action | 13 | performance_record | 12 |
| skill_event | 12 | skill_gap | 12 |
| career_node | 16 | skill_category | 17 |
| talent_candidate | 10 | skill_level_anchor | 10 |
| succession_candidate | 9 | employee_project | 9 |
| employee_experience | 7 | idp_milestone | 5 |
| career_sequence | 4 | employee | 4 |
| approval | 4 | idp_adjust_rule | 4 |
| idp_phase | 4 | succession_position | 4 |
| team_role | 4 | team_assignment | 2 |
| idp_plan | 1 | team_project | 1 |
| talent_shortlist_item | **0（空表）** | | |

数据均为演示种子（虚构人名：周晨/林晓/陈然/张三等），不含真实员工隐私。

## 7. 已知限制

- 沙箱内无独立 PostgreSQL 实例，未做端到端恢复实测；SQL 为 `+db-data-export` 官方产物 + 机械剥离 schema 前缀，建议在测试库演练一次。
- 导出为时间点快照：此后的增量写入不包含在内。
- `+db-table-get` 不回传表级 RLS/policy 详情，policy 定义取自 `pg_policies` 只读查询后拼接（已归一化角色名）。
