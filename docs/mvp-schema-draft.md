# MVP 数据库 Schema 草稿

> **状态**：已定稿（2026-10-20 需求对齐后锁定，待确认问题全部关闭）
> **日期**：2026-10-19 起草 / 2026-10-20 定稿
> **作者**：Claude
> **Reviewer**：业务方（已确认）
> **配套文档**：`docs/mvp-dev-plan.md`（决策记录与开发规划）

---

## 0. 设计原则

1. **新表统一 `mvp_` 前缀**，与旧 27 表物理隔离
2. **时间字段全部用 `timestamptz`**，抛弃旧表的 varchar 时间标签
3. **slug 软关联**，不加外键约束（沿用旧表风格）
4. **系统列省略**：所有表都有 `_created_at` / `_created_by` / `_updated_at` / `_updated_by`，下文不再重复
5. **双写策略**：通过 `legacy-sync.service.ts` 同步到旧表，P0/P1 优先，P2 可延后

---

## 1. 表清单（共 24 张）

| 域 | 表名 | 职责 | 行数估算 |
|---|---|---|---|
| **组织** | `mvp_org_relation` | 管理者/专家/专家组成员关系 | ~50 |
| **标准定义** | `mvp_competency` | 子能力定义 | ~80 |
| | `mvp_competency_level` | 子能力 × 等级锚点 | ~400 (80×5) |
| | `mvp_skill_competency` | 技能 × 等级 × 子能力要求 | ~500 |
| | `mvp_title_track` | 职称序列（13 类） | 13 |
| | `mvp_title_level` | 职称层级（每序列 4 层） | 52 (13×4) |
| | `mvp_title_requirement` | 职称所需技能 | ~200 |
| | `mvp_standard_version` | 标准版本 | ~5 |
| **员工状态** | `mvp_employee_competency` | 员工子能力认证 | ~300 |
| | `mvp_employee_skill` | 员工技能认证（新） | ~150 |
| | `mvp_employee_title` | 员工职称 | ~50 |
| **申请流程** | `mvp_application` | 申请单 | ~100 |
| | `mvp_application_item` | 申请单子能力行 | ~500 |
| | `mvp_evidence` | 证据 | ~300 |
| | `mvp_application_evidence` | 申请-证据-子能力关联 | ~800 |
| **考核** | `mvp_exam` | L2 考核会话 | ~100 |
| | `mvp_exam_question` | 考题 | ~500 |
| | `mvp_exam_answer` | 作答与评分 | ~500 |
| **审批** | `mvp_approval_task` | 审批任务 | ~200 |
| **申诉** | `mvp_appeal` | 申诉记录 | ~50 |
| **通知** | `mvp_notification` | 站内通知 | ~500 |
| | `mvp_notification_cooldown` | 推荐冷却 | ~100 |
| **事实中心** | `mvp_fact_event` | 事实事件（模拟） | ~200 |
| | `mvp_fact_sync_log` | 同步日志 | ~100 |
| **资源** | `mvp_learning_resource` | 学习资源库 | ~50 |
| **文件** | `mvp_file` | 上传文件元数据 | ~200 |
| **复核** | `mvp_recertification` | 待复核记录 | ~50 |

---

## 2. 详细表结构

### 2.1 组织关系

#### `mvp_org_relation` 组织关系表

| 列 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | uuid PK | ✓ | |
| `slug` | varchar(64) unique | ✓ | |
| `employee_slug` | varchar(64) → `employee.slug` | ✓ | 员工 |
| `relation_type` | varchar(16) | ✓ | `manager` / `expert` / `panel` / `domain_owner` |
| `target_slug` | varchar(64) → `employee.slug` | ✓ | 关系对方（主管/专家 slug） |
| `domain` | varchar(64) | | 领域标识（仅 expert/panel/domain_owner），如 `java` / `frontend` |
| `effective_from` | timestamptz | ✓ | 生效时间 |
| `effective_to` | timestamptz | | 失效时间（null = 当前有效） |
| `source` | varchar(16) | ✓ | `seed` / `admin` / `mock-fact` |

**索引**：
- `(employee_slug, relation_type, effective_to)` — 查某员工的当前主管/专家
- `(target_slug, relation_type, effective_to)` — 查某主管的所有下属

**约束**（应用层保证）：
- 同一员工同一时刻只能有一条 `relation_type='manager' AND effective_to IS NULL` 的记录

---

### 2.2 标准定义

#### `mvp_competency` 子能力定义表

| 列 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | uuid PK | ✓ | |
| `slug` | varchar(64) unique | ✓ | |
| `code` | varchar(32) | ✓ | 子能力编码，如 `JAVA-COLLECTION` |
| `name` | varchar(128) | ✓ | 名称，如"集合框架" |
| `description` | text | | 定义 |
| `kind` | varchar(16) | ✓ | `professional` / `generic` |
| `status` | varchar(16) | ✓ | `draft` / `published` / `archived` |

**示例数据**：
```sql
('comp-001', 'java-collection', 'JAVA-COLLECTION', 'Java 集合框架', '熟练掌握 List/Map/Set...', 'professional', 'published')
```

---

#### `mvp_competency_level` 子能力等级标准表

| 列 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | uuid PK | ✓ | |
| `competency_slug` | varchar(64) → `mvp_competency.slug` | ✓ | |
| `level` | int | ✓ | 1-5 |
| `anchor` | text | ✓ | 等级锚点描述 |
| `evidence_requirement` | jsonb | | `[{type, description, minCount}]` 证据要求 |
| `exam_required` | boolean | ✓ | 是否需要考核（L2 必考） |

**唯一约束**：`(competency_slug, level)`

**示例**：
```json
{
  "competency_slug": "java-collection",
  "level": 2,
  "anchor": "能独立使用 List/Map/Set 解决日常问题",
  "evidence_requirement": [
    {"type": "project", "description": "参与项目使用集合", "minCount": 1},
    {"type": "note", "description": "学习笔记", "minCount": 1}
  ],
  "exam_required": true
}
```

---

#### `mvp_skill_competency` 技能 × 等级 × 子能力要求表

| 列 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | uuid PK | ✓ | |
| `skill_slug` | varchar(64) → `skill.slug` | ✓ | 复用旧 skill 表 |
| `level` | int | ✓ | 1-5 |
| `competency_slug` | varchar(64) → `mvp_competency.slug` | ✓ | 要求的子能力 |
| `required_competency_level` | int | ✓ | 该子能力需要的最低等级 |
| `standard_version_slug` | varchar(64) → `mvp_standard_version.slug` | ✓ | 所属标准版本 |
| `weight` | int | ✓ | 权重（默认 1，备用） |

**唯一约束**：`(skill_slug, level, competency_slug, standard_version_slug)`

**示例**：
```
(skill-java, 2, java-collection, 2, v2026-q4, 1)
→ Java L2 要求"Java 集合框架"子能力达到 L2
```

---

#### `mvp_title_track` 职称序列表

| 列 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | uuid PK | ✓ | |
| `slug` | varchar(64) unique | ✓ | 如 `java-track` |
| `name` | varchar(128) | ✓ | "Java 工程师" |
| `category` | varchar(32) | ✓ | `研发技术` / `数据` / `业务与管理` |
| `path_kind` | varchar(16) | ✓ | `single` / `dual`（销售双路径） |
| `status` | varchar(16) | ✓ | `draft` / `published` / `archived` |

**13 个序列**：
- 研发技术：Java、前端、Python、测试与质量、运维与可靠性、算法工程
- 数据：数据分析、数据工程、数据治理
- 业务与管理：销售、产品、项目管理、客户成功

---

#### `mvp_title_level` 职称层级表

| 列 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | uuid PK | ✓ | |
| `track_slug` | varchar(64) → `mvp_title_track.slug` | ✓ | |
| `level_order` | int | ✓ | 种子统一 1-4 层；结构允许 1-6，不设 `<=4` 的 CHECK（后期可改可变层数） |
| `level_code` | varchar(32) | ✓ | 如 `P1` / `M2` |
| `name` | varchar(128) | ✓ | 如"初级 Java 工程师" |
| `path_label` | varchar(32) | | 双路径时区分 `专业` / `管理` |
| `standard_version_slug` | varchar(64) | ✓ | |

**唯一约束**：`(track_slug, level_order, path_label, standard_version_slug)`

**示例**（Java 序列）：
```
1, P1, 初级 Java 工程师
2, P2, 中级 Java 工程师
3, P3, 高级 Java 工程师
4, P4, 资深 Java 工程师
```

---

#### `mvp_title_requirement` 职称所需技能表

| 列 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | uuid PK | ✓ | |
| `title_level_id` | uuid → `mvp_title_level.id` | ✓ | |
| `skill_slug` | varchar(64) → `skill.slug` | ✓ | |
| `required_level` | int | ✓ | 最低技能等级 |
| `is_auto` | boolean | ✓ | true=自动认证；false=需人工审批 |

**示例**：
```
(P2 Java, skill-java, 2, false)
→ 中级 Java 工程师要求 Java 技能 L2，需人工审批
```

---

#### `mvp_standard_version` 标准版本表

| 列 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | uuid PK | ✓ | |
| `slug` | varchar(64) unique | ✓ | 如 `v2026-q4` |
| `version_no` | varchar(32) | ✓ | 展示用 |
| `status` | varchar(16) | ✓ | `draft` / `reviewing` / `published` / `archived` |
| `effective_at` | timestamptz | ✓ | 生效时间 |
| `created_by_employee_slug` | varchar(64) → `employee.slug` | ✓ | 起草专家 |
| `reviewed_by_employee_slug` | varchar(64) → `employee.slug` | | 领域负责人 |
| `change_summary` | text | | 变更说明 |
| `snapshot` | jsonb | | 全量标准快照（避免历史版本被污染） |

**snapshot 结构**：
```json
{
  "skill_competency": [...],
  "title_level": [...],
  "title_requirement": [...]
}
```

---

### 2.3 员工状态

#### `mvp_employee_competency` 员工子能力认证表

| 列 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | uuid PK | ✓ | |
| `slug` | varchar(64) unique | ✓ | |
| `employee_slug` | varchar(64) → `employee.slug` | ✓ | |
| `competency_slug` | varchar(64) → `mvp_competency.slug` | ✓ | |
| `level` | int | ✓ | 已认证等级 |
| `certified_at` | timestamptz | ✓ | 认证时间 |
| `certified_via` | varchar(32) | ✓ | `ai-material` / `exam` / `approval-l3` / `approval-l4` / `approval-l5` |
| `source_application_slug` | varchar(64) → `mvp_application.slug` | ✓ | 来源申请单 |
| `status` | varchar(16) | ✓ | `active` / `pending-review` / `suspended` / `revoked` |
| `last_used_at` | timestamptz | ✓ | 最近使用时间（驱动待复核判断） |
| `review_due_at` | timestamptz | | 待复核标记时间（连续 1 年无实践） |

**唯一约束**：`(employee_slug, competency_slug, level)`
**索引**：`(competency_slug, status)` — 反向查谁拥有某子能力

---

#### `mvp_employee_skill` 员工技能认证表（新）

| 列 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | uuid PK | ✓ | |
| `slug` | varchar(64) unique | ✓ | |
| `employee_slug` | varchar(64) → `employee.slug` | ✓ | |
| `skill_slug` | varchar(64) → `skill.slug` | ✓ | |
| `level` | int | ✓ | |
| `certified_at` | timestamptz | ✓ | |
| `source_application_slug` | varchar(64) → `mvp_application.slug` | ✓ | |
| `status` | varchar(16) | ✓ | `active` / `pending-review` / `suspended` / `revoked` |
| `last_used_at` | timestamptz | ✓ | |
| `review_due_at` | timestamptz | | |

**唯一约束**：`(employee_slug, skill_slug, level)`

**双写到旧表**：通过 `legacy-sync.service.ts` 同步到 `employee_skill`

---

#### `mvp_employee_title` 员工职称表

| 列 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | uuid PK | ✓ | |
| `slug` | varchar(64) unique | ✓ | |
| `employee_slug` | varchar(64) → `employee.slug` | ✓ | |
| `title_level_id` | uuid → `mvp_title_level.id` | ✓ | |
| `certified_at` | timestamptz | ✓ | |
| `source_application_slug` | varchar(64) → `mvp_application.slug` | ✓ | |
| `status` | varchar(16) | ✓ | `active` / `suspended` / `revoked` |
| `is_cross_path` | boolean | ✓ | 是否跨路径获得 |

**索引**：`(employee_slug, status)` — 一个员工可持多个职称

---

### 2.4 申请流程

#### `mvp_application` 申请单表

| 列 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | uuid PK | ✓ | |
| `slug` | varchar(64) unique | ✓ | |
| `applicant_slug` | varchar(64) → `employee.slug` | ✓ | 申请人 |
| `target_kind` | varchar(16) | ✓ | `skill` / `title` |
| `target_skill_slug` | varchar(64) → `skill.slug` | | 技能申请时填 |
| `target_level` | int | | 技能申请时填 |
| `target_title_level_id` | uuid → `mvp_title_level.id` | | 职称申请时填 |
| `is_cross_level` | boolean | ✓ | 是否跨级 |
| `is_cross_path` | boolean | ✓ | 是否跨路径 |
| `standard_version_slug` | varchar(64) → `mvp_standard_version.slug` | ✓ | **提交时锁定的标准版本** |
| `status` | varchar(32) | ✓ | `draft` / `ai-evaluating` / `pending-exam` / `in-exam` / `pending-approval` / `approved` / `rejected` / `returned` / `closed` |
| `submitted_at` | timestamptz | | 提交时间（null = 草稿） |
| `closed_at` | timestamptz | | 关闭时间（驳回 15 天后 / 认证通过） |
| `rejected_reason` | text | | 驳回原因 |
| `rejected_at` | timestamptz | | 驳回时间（用于 15 天冷却） |
| `appeal_count` | int | ✓ | 已用申诉次数（默认 0，最多 2） |
| `summary_statement` | text | | 综合实践说明（职称申请用） |

**索引**：
- `(applicant_slug, status)` — 查某员工的所有申请
- `(status, submitted_at)` — 审批队列

---

#### `mvp_application_item` 申请单子能力行表

| 列 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | uuid PK | ✓ | |
| `application_slug` | varchar(64) → `mvp_application.slug` | ✓ | |
| `competency_slug` | varchar(64) → `mvp_competency.slug` | ✓ | |
| `required_level` | int | ✓ | |
| `current_status` | varchar(32) | ✓ | `met-by-cert` / `met-by-material` / `pending-exam` / `exam-passed` / `exam-failed` / `pending-approval` / `approved` / `rejected` |
| `met_by_competency_id` | uuid → `mvp_employee_competency.id` | | 如果是 `met-by-cert`，指向已有认证 |
| `ai_evaluation` | jsonb | | `{verdict, reasoning, gaps[], suggestedQuestions[], modelVersion, evaluatedAt}` |

**唯一约束**：`(application_slug, competency_slug)`

**ai_evaluation 结构**：
```json
{
  "verdict": "satisfied" / "unsatisfied",
  "reasoning": "AI 判断理由",
  "gaps": ["缺少项目经验", "缺少证书"],
  "suggestedQuestions": ["请提供...", "请说明..."],
  "modelVersion": "gpt-4-20251001",
  "evaluatedAt": "2026-10-19T10:30:00Z"
}
```

---

#### `mvp_evidence` 证据表

| 列 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | uuid PK | ✓ | |
| `slug` | varchar(64) unique | ✓ | |
| `owner_employee_slug` | varchar(64) → `employee.slug` | ✓ | 证据所有者 |
| `kind` | varchar(16) | ✓ | `fact-ref` / `upload` / `external-link` |
| `fact_event_slug` | varchar(64) → `mvp_fact_event.slug` | | kind=fact-ref 时关联事实中心事件 |
| `file_id` | uuid → `mvp_file.id` | | kind=upload 时关联文件 |
| `external_url` | varchar(512) | | kind=external-link 时填 |
| `title` | varchar(255) | ✓ | |
| `description` | text | | |
| `uploaded_at` | timestamptz | ✓ | |
| `ai_evaluation_status` | varchar(16) | ✓ | `pending` / `evaluating` / `satisfied` / `unsatisfied` / `error` |
| `ai_evaluation` | jsonb | | AI 评估结果（材料满足度） |

**索引**：`(owner_employee_slug, kind)`

---

#### `mvp_application_evidence` 申请-证据-子能力关联表

| 列 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | uuid PK | ✓ | |
| `application_item_id` | uuid → `mvp_application_item.id` | ✓ | |
| `evidence_slug` | varchar(64) → `mvp_evidence.slug` | ✓ | |
| `sort` | int | ✓ | 展示顺序 |

**唯一约束**：`(application_item_id, evidence_slug)` — 同一证据不重复累计进度，但可关联到不同 item

---

### 2.5 考核

#### `mvp_exam` 考核会话表

| 列 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | uuid PK | ✓ | |
| `slug` | varchar(64) unique | ✓ | |
| `application_item_id` | uuid → `mvp_application_item.id` | ✓ | 对应哪个子能力的考核 |
| `employee_slug` | varchar(64) → `employee.slug` | ✓ | 考生（冗余便于查询） |
| `attempt_no` | int | ✓ | 第几次考核（1 = 首考，2+ = 补考） |
| `status` | varchar(16) | ✓ | `in-progress` / `submitted` / `grading` / `passed` / `failed` / `terminated` |
| `started_at` | timestamptz | ✓ | **服务端记录开始时间** |
| `duration_seconds` | int | ✓ | 限时时长（默认 3600） |
| `deadline_at` | timestamptz | ✓ | `started_at + duration` |
| `submitted_at` | timestamptz | | |
| `last_heartbeat_at` | timestamptz | ✓ | 用于崩溃恢复判定 |
| `resume_token` | varchar(64) | | 5 分钟恢复窗口的 token |
| `resume_expires_at` | timestamptz | | |
| `page_leave_count` | int | ✓ | 切屏/最小化次数（默认 0，>= 2 终止） |
| `terminated_reason` | varchar(64) | | `second-leave` / `closed` / `timeout` |
| `total_score` | int | | 总分（满分 100） |
| `passed` | boolean | | 是否 >= 80 通过 |
| `next_attempt_available_at` | timestamptz | | 24 小时补考冷却 |
| `demo_skip_cooldown` | boolean | ✓ | 演示用跳过冷却标记（默认 false） |

**唯一约束**：`(application_item_id, attempt_no)`
**索引**：
- `(employee_slug, status)` — 查某员工的考核
- `(status, deadline_at)` — 服务端定时检查超时

---

#### `mvp_exam_question` 考题表

| 列 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | uuid PK | ✓ | |
| `exam_slug` | varchar(64) → `mvp_exam.slug` | ✓ | |
| `sort` | int | ✓ | 1-5 |
| `question_kind` | varchar(16) | ✓ | `objective` / `subjective` |
| `question_text` | text | ✓ | |
| `options` | jsonb | | `[{key, text}]` 客观题选项 |
| `correct_answer` | varchar(16) | | 客观题答案 |
| `reference_answer` | text | | 主观题参考答案 |
| `max_score` | int | ✓ | 默认 20 |
| `generated_by` | varchar(16) | ✓ | `ai` / `manual` |
| `prompt_snapshot` | jsonb | ✓ | 生成时的 prompt + 模型 + 版本 |

**prompt_snapshot 结构**：
```json
{
  "prompt": "根据以下等级标准生成 3 道客观题和 2 道简答题...",
  "model": "gpt-4-20251001",
  "temperature": 0.7,
  "generatedAt": "2026-10-19T10:30:00Z"
}
```

---

#### `mvp_exam_answer` 作答与评分表

| 列 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | uuid PK | ✓ | |
| `question_id` | uuid → `mvp_exam_question.id` | ✓ | |
| `answer_text` | text | ✓ | 主观题答案 / 客观题选项 key |
| `saved_at` | timestamptz | ✓ | 每次自动保存更新时间 |
| `score` | int | | |
| `grading_feedback` | text | | 评分依据（主观题必填） |
| `graded_by` | varchar(16) | | `ai` / `expert` |
| `graded_at` | timestamptz | | |

**唯一约束**：`(question_id)` — 一题一答

---

### 2.6 审批

#### `mvp_approval_task` 审批任务表

| 列 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | uuid PK | ✓ | |
| `slug` | varchar(64) unique | ✓ | |
| `application_slug` | varchar(64) → `mvp_application.slug` | ✓ | |
| `task_kind` | varchar(32) | ✓ | `l3-manager` / `l4-manager` / `l4-expert` / `l5-manager` / `l5-expert` / `l5-panel` / `cross-level-expert` / `appeal-first` / `appeal-second` / `title-approval` / `recertification` / `correction` |
| `assignee_employee_slug` | varchar(64) → `employee.slug` | | 审批人（null = 待分配） |
| `step_order` | int | ✓ | 串行步骤序号 |
| `status` | varchar(16) | ✓ | `pending` / `approved` / `rejected` / `returned` / `waiting-assign` / `skipped` |
| `decision_comment` | text | | |
| `decided_at` | timestamptz | | |
| `waiting_assign_reason` | varchar(64) | | `manager-missing` / `conflict-of-interest` |

**索引**：
- `(assignee_employee_slug, status)` — 审批队列
- `(application_slug, step_order)` — 查申请单的审批流程

**专家组处理**：每个成员一行 `mvp_approval_task`，全员 `approved` 才进入下一步

---

### 2.7 申诉

#### `mvp_appeal` 申诉记录表

| 列 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | uuid PK | ✓ | |
| `slug` | varchar(64) unique | ✓ | |
| `application_slug` | varchar(64) → `mvp_application.slug` | ✓ | 原申请 |
| `appeal_no` | int | ✓ | 1 / 2（最多 2 次） |
| `appeal_kind` | varchar(32) | ✓ | `l1-l2-material` / `l2-exam` / `l3-l5-decision` |
| `trigger_task_id` | uuid → `mvp_approval_task.id` | | 引发申诉的审批任务（L3+） |
| `appeal_reason` | text | ✓ | 员工填写的申诉理由 |
| `ai_questions` | jsonb | | L1/L2 材料申诉时 AI 生成的针对性问题 |
| `employee_response` | text | | 员工补充说明 |
| `status` | varchar(16) | ✓ | `pending` / `approved` / `rejected` |
| `decided_by_employee_slug` | varchar(64) → `employee.slug` | | |
| `decision_comment` | text | | |
| `decided_at` | timestamptz | | |

**唯一约束**：`(application_slug, appeal_no)`

---

### 2.8 通知

#### `mvp_notification` 站内通知表

| 列 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | uuid PK | ✓ | |
| `slug` | varchar(64) unique | ✓ | |
| `recipient_employee_slug` | varchar(64) → `employee.slug` | ✓ | |
| `kind` | varchar(32) | ✓ | `candidate-evidence` / `candidate-application` / `exam-ready` / `exam-result` / `approval-pending` / `approval-result` / `appeal-result` / `recertification-due` / `evidence-auth-request` / `system-error` |
| `title` | varchar(255) | ✓ | |
| `body` | text | ✓ | |
| `link` | varchar(255) | | 跳转链接（前端路由） |
| `payload` | jsonb | | 结构化数据（如 application_slug、competency_slug） |
| `read_at` | timestamptz | | |
| `dismissed_at` | timestamptz | | 员工明确拒绝（用于 3 个月冷却判定） |
| `sent_via_feishu` | boolean | ✓ | 默认 false |

**索引**：
- `(recipient_employee_slug, read_at)` — 未读通知
- `(recipient_employee_slug, created_at)` — 通知列表

---

#### `mvp_notification_cooldown` 推荐冷却表

| 列 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | uuid PK | ✓ | |
| `employee_slug` | varchar(64) → `employee.slug` | ✓ | |
| `dismissed_key` | varchar(128) | ✓ | 被拒绝的候选目标唯一键，如 `application:{skill}:{level}` |
| `dismissed_at` | timestamptz | ✓ | |
| `cooldown_until` | timestamptz | ✓ | dismissed_at + 3 个月 |

**唯一约束**：`(employee_slug, dismissed_key)`

---

### 2.9 事实中心（模拟）

#### `mvp_fact_event` 事实事件表

| 列 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | uuid PK | ✓ | |
| `slug` | varchar(64) unique | ✓ | 事实 ID（来自事实中心） |
| `employee_slug` | varchar(64) → `employee.slug` | ✓ | |
| `event_kind` | varchar(32) | ✓ | `project-participation` / `training-complete` / `certificate-obtained` / `work-output` |
| `occurred_at` | timestamptz | ✓ | 事实发生时间 |
| `source` | varchar(32) | ✓ | 来源系统（mock 时为 `mock-fact-center`） |
| `source_version` | varchar(32) | ✓ | 来源版本 |
| `change_kind` | varchar(16) | ✓ | `created` / `updated` / `revoked` |
| `payload` | jsonb | ✓ | 事实详情 |
| `related_competency_slugs` | jsonb | | 预判相关子能力（mock 用） |
| `permission_scope` | jsonb | | `[{role, employee_slugs[]}]` 访问控制 |
| `ingested_at` | timestamptz | ✓ | 进入本系统时间 |
| `processed_at` | timestamptz | | 判断层处理完成时间 |

**唯一约束**：`(slug, source_version)` — 同一事件同一版本不重复处理
**索引**：
- `(employee_slug, processed_at)` — 查某员工的事实
- `(ingested_at)` — 增量拉取

---

#### `mvp_fact_sync_log` 同步日志表

| 列 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | uuid PK | ✓ | |
| `sync_kind` | varchar(16) | ✓ | `scheduled` / `manual` / `realtime` |
| `started_at` | timestamptz | ✓ | |
| `finished_at` | timestamptz | | |
| `events_fetched` | int | | |
| `events_processed` | int | | |
| `error` | text | | |

---

### 2.10 学习资源

#### `mvp_learning_resource` 学习资源库表

| 列 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | uuid PK | ✓ | |
| `slug` | varchar(64) unique | ✓ | |
| `kind` | varchar(16) | ✓ | `course` / `project` / `training` |
| `title` | varchar(255) | ✓ | |
| `description` | text | | |
| `url` | varchar(512) | | |
| `targets_competency_slugs` | jsonb | | 对应子能力（用于推荐） |
| `estimated_effort` | varchar(64) | | 投入说明 |
| `evidence_template` | text | | 完成后可提交的证据类型说明 |
| `is_demo` | boolean | ✓ | MVP 全部为演示标记（默认 true） |
| `status` | varchar(16) | ✓ | `active` / `archived` |

---

### 2.11 文件

#### `mvp_file` 文件元数据表

| 列 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | uuid PK | ✓ | |
| `slug` | varchar(64) unique | ✓ | |
| `uploader_employee_slug` | varchar(64) → `employee.slug` | ✓ | |
| `original_filename` | varchar(255) | ✓ | |
| `mime_type` | varchar(64) | ✓ | |
| `size_bytes` | int | ✓ | |
| `storage_path` | varchar(512) | ✓ | `.local/uploads/` 下相对路径 |
| `extracted_text` | text | | PDF/DOCX 提取的文本 |
| `extraction_status` | varchar(16) | ✓ | `pending` / `ok` / `failed` |
| `extraction_error` | text | | |

**索引**：`(uploader_employee_slug)`

---

### 2.12 复核

#### `mvp_recertification` 待复核记录表

| 列 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | uuid PK | ✓ | |
| `slug` | varchar(64) unique | ✓ | |
| `target_kind` | varchar(16) | ✓ | `competency` / `skill` |
| `target_id` | uuid | ✓ | `mvp_employee_competency.id` 或 `mvp_employee_skill.id` |
| `employee_slug` | varchar(64) → `employee.slug` | ✓ | |
| `triggered_at` | timestamptz | ✓ | 标记待复核时间（= last_used_at + 1 年） |
| `status` | varchar(16) | ✓ | `pending` / `in-review` / `cleared` / `failed` |
| `cleared_at` | timestamptz | | |
| `cleared_reason` | varchar(64) | | `new-evidence` / `exam-passed` / `approval-passed` / `failed-no-demote` |

---

## 3. 双写映射规则

### P0 优先级（MVP 必须）

#### 3.1 技能认证 → `employee_skill`

**触发**：`mvp_employee_skill` 新增/状态变更
**映射**：

| 新表 | 旧表 `employee_skill` | 规则 |
|---|---|---|
| `slug` | `slug` | `'mvp-' + slug` |
| `employee_slug` | `employee_slug` | 直接 |
| `skill_slug` | `skill_slug` | 直接 |
| — | `title` | 从 `skill` 表查 `name` |
| — | `category` | 从 `skill` 表查 `category_slug` |
| — | `source` | `'mvp-certification'` |
| — | `sourceShort` | `'MVP'` |
| — | `sourceLabel` | `'MVP 技能认证'` |
| `level` | `current_level` + `target_level` | 都填 `level` |
| — | `confidence` | `80` |
| `status` | `status` + `status_label` | 见下表 |
| `certified_at` | `approved_at` | 转 `'YYYY-MM-DD'` |
| `review_due_at` | `expiry` | 转 `'YYYY-MM-DD'` |
| `last_used_at` | `last_used` | 转 `'YYYY-MM-DD'` |
| — | `sort` | `0` |

**状态映射**：

| 新表 `status` | 旧表 `status` | 旧表 `status_label` |
|---|---|---|
| `active` | `approved` | `已点亮` |
| `pending-review` | `review` | `待复核` |
| `suspended` | `returned` | `已暂停` |
| `revoked` | `returned` | `已撤销` |

---

#### 3.2 审批历史 → `approval`

**触发**：`mvp_approval_task` 状态变为 `approved` / `rejected` / `returned`
**映射**：

| 新表 | 旧表 `approval` | 规则 |
|---|---|---|
| `slug` | `slug` | `'mvp-' + slug` |
| `application_slug` | `linked_slug` | `'mvp-' + application_slug` |
| `task_kind` | `kind` | L3-L5 申请→`'application'`；纠正→`'downgrade'` |
| — | `applicant` | 从 `mvp_application` join `employee.name` |
| — | `current_level` | `mvp_application.target_level - 1` |
| — | `target_level` | `mvp_application.target_level` |
| `created_at` | `submitted_at` | 转 `'YYYY-MM-DD'` |
| — | `due` | `'09-19'`（保留旧表写死风格） |
| `status` | `status` | 直接映射 |

---

#### 3.3 新员工 → `employee`

**触发**：种子数据插入（一次性）
**映射**：直接 `INSERT INTO employee ...`，组织关系进 `mvp_org_relation`

---

### P1 优先级（MVP 推荐）

#### 3.4 技能事件 → `skill_event`

**触发**：`mvp_employee_skill` 新增
**映射**：

| 新表 | 旧表 `skill_event` | 规则 |
|---|---|---|
| — | `slug` | `'mvp-event-' + uuid` |
| `employee_slug` | `employee_slug` | 直接 |
| `certified_at` | `date_label` | 转 `'YYYY-MM-DD'` |
| — | `title` | `"获得 {skill.name} L{level} 认证"` |
| — | `kind` | `'certification'` |
| — | `total` | `1` |
| — | `sort` | 当前最大 `sort + 1` |

---

#### 3.5 Gap → `skill_gap`

**触发**：判断层计算出新 Gap（申请提交后 / 事实中心增量同步后）
**映射**：

| 来源 | 旧表 `skill_gap` | 规则 |
|---|---|---|
| — | `slug` | `'mvp-gap-' + uuid` |
| — | `employee_slug` | 直接 |
| — | `skill_slug` | 目标技能 |
| — | `filled` | 当前已认证等级 |
| — | `target` | 目标等级 |
| — | `source` | `'mvp-calculated'` |
| — | `priority` | `'p0'` / `'p1'` / `'p2'`（按 Gap 数量） |
| — | `sort` | 当前最大 `sort + 1` |

**清理策略**：每次重算前**删除该员工该技能的所有 `source='mvp-calculated'` 记录**，再插入新的

---

#### 3.6 人才候选人 → `talent_candidate`

**触发**：`mvp_employee_skill` 新增 / `level` 提升
**映射**：

| 来源 | 旧表 `talent_candidate` | 规则 |
|---|---|---|
| `employee_slug` | `slug` | `'mvp-candidate-' + employee_slug` |
| — | `name` | 从 `employee` 查 |
| — | `role` | 从 `employee` 查 |
| — | `org` | 从 `employee` 查 |
| — | `tier` | `'direct'` / `'adjacent'` / `'potential'` |
| — | `dimensions` | JSONB `[{label: 技能名, value: level}]` |
| — | `reason` | AI 评估摘要拼接 |
| — | `evidence` | 关联的 `mvp_evidence` |
| — | `gap` | 未满足的 Gap 描述 |
| — | `sort` | 当前最大 `sort + 1` |

**更新策略**：`ON CONFLICT (slug) DO UPDATE`，同一员工只有一条候选人记录

---

### P2 优先级（可延后）

#### 3.7 继任候选人 → `succession_candidate`

**MVP 阶段不做**，需要岗位-职称匹配规则

---

#### 3.8 IDP 联动

**MVP 阶段不做**，需要 IDP 生成规则

---

#### 3.9 组队候选人刷新

**MVP 阶段手动触发**，保留为管理员按钮

---

## 4. 关键决策点确认

| # | 决策 | 我的提议 | 你的确认 |
|---|---|---|---|
| 1 | 新表前缀 | `mvp_` | ✅ |
| 2 | 时间字段 | `timestamptz` | ✅ |
| 3 | 标准版本快照 | 发布时全量 snapshot 到 `snapshot` jsonb | ✅ |
| 4 | 专家组审批 | 每个成员一行 `mvp_approval_task` | ✅ |
| 5 | 员工技能新表 vs 复用旧表 | 新建 `mvp_employee_skill` 与旧表隔离 | ✅ |
| 6 | 考核计时 | 完全服务端（heartbeat 保活） | ✅ |
| 7 | 证据关联粒度 | `application_item` 级（子能力行） | ✅ |
| 8 | 申诉次数 | 独立 `mvp_appeal` 表 + `application.appeal_count` 冗余 | ✅ |
| 9 | 通知冷却 | 独立冷却表 | ✅ |
| 10 | 事实事件持久化 | 持久化到 `mvp_fact_event` | ✅ |
| 11 | 双写策略 | P0/P1/P2 分级，失败不影响新流程 | ✅ |

---

## 5. 待确认问题（已于 2026-10-20 关闭）

> 全部 8 项已在需求对齐中定论，结论同步到 `docs/mvp-dev-plan.md` 第 0 节「决策记录」。此处保留问题原文以便追溯。

| # | 原问题 | 定论 |
|---|---|---|
| 1 | 30 名员工的种子数据 | 4 名真实员工 + 26 名虚构演示员工，全部标演示数据；组织关系按 13 序列分配主管/专家/专家组（D7） |
| 2 | `mvp_org_relation.domain` 取值范围 | 13 序列 slug 粒度（`java`/`frontend`/…），跨路径专家复核需要领域粒度 |
| 3 | 审批任务 assignee 为 NULL 时 | `status='waiting-assign'` + NULL |
| 4 | L1 材料判断满足后是否直接写 active | 直接 `active` 并通知员工，不服走申诉（D6） |
| 5 | 同技能重复申请同等级 | 不允许，只能升级或走申诉/复核（D10） |
| 6 | 考核时长 | 统一 60 分钟/子能力 |
| 7 | 文件配额 | 仅单文件 20MB，无全局配额 |
| 8 | 通知保留期 | 永久 |

**另外三项与本稿表结构相关的修正**（详见 mvp-dev-plan.md）：

- `mvp_title_level`：13 序列统一 4 层（52 条），`level_order` 去掉 `<=4` 的 CHECK，保留 1~6 上限，便于后期改可变层数（D1）。
- `mvp_appeal`：新增 `decided_kind`（`ai` / `manager` / `expert`），用于区分 L1/L2 材料申诉的 AI 重判、主管判定与 L3-L5 专家复核。
- `mvp_standard_version`：新增 `source`（`refined` / `ai-draft` / `assumed`）、`reviewed_by`、`published_by`，支撑「领域专家编写 → 领域负责人审核 → 管理员发布」三级流程（D11）。


---

## 6. 下一步

你 review 完这份草稿并确认后，我会：

1. 把 24 张表的 Drizzle 定义写到 `server/database/mvp-schema.ts`（独立文件，不动现有 `schema.ts`）
2. 写迁移脚本 `scripts/mvp-migrate.mjs`（只创建新表，不动 27 张旧表）
3. 写 30 名员工 + 组织关系 + 13 序列骨架 + 3 个完整序列（Java / 数据分析 / 销售）的种子脚本
4. 写 `legacy-sync.service.ts` 的 P0 映射逻辑
5. 然后再开始 M2 的接口和页面

**有任何要调整的地方，请直接告诉我改哪里。**
