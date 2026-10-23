import 'dotenv/config';
import postgres from 'postgres';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

// Fixed fixtures are repeatable, explicitly fictional, and never infer skill certification.
const scenarios = {
  'zhang-wei': { repository:'payment-service-demo', skills:['sys-design-split','sys-design-split','testing','testing','slo-design','sys-design-split'], priorOrg:'研发技术中心 / Java组',
    commits:[
      ['订单与支付模块边界设计及契约校验','docs/adr/payment-boundary.md',142,18,{design:'将订单状态机与支付通道适配分离；订单模块只通过 PaymentPort 发起扣款，通道适配层负责重试与幂等。列出创建、确认、取消三条主流程及超时、重复回调两类异常路径。',tradeoff:'比较同步调用和异步事件两种方案；因支付回调可能乱序，采用事件驱动加幂等键，并记录最终一致性窗口和补偿策略。',validation:'完成接口契约评审；16 个契约用例覆盖正常与异常输入，评审发现的 3 处边界歧义已修改设计文档。'}],
      ['支付回调幂等实现与模块拆分验证','src/payment/CallbackHandler.java',96,31,{implementation:'按订单、支付交易、通道适配三个模块实现接口；回调先校验签名、交易号与幂等键，重复回调返回已有处理结果。',verification:'使用正常回调、重复回调、超时后回调和错误签名进行集成验证；重复回调未产生二次扣款，错误签名被拒绝。',review:'代码评审记录了接口依赖方向和回滚方案，并根据评审意见增加失败事件重放测试。'}],
      ['支付服务测试方案与边界用例','tests/payment/TestPlan.md',118,12,{testDesign:'根据订单状态机设计正常支付、重复提交、金额边界、无效签名、通道超时与回调乱序用例；逐项标记风险、前置条件、预期状态和验收依据。',automation:'用 JUnit 与 MockServer 实现 28 个自动化用例；隔离通道依赖并使用固定时钟验证超时重试。',analysis:'首轮发现 2 个偶发失败，定位为共享测试数据和异步回调竞态；改为每例独立交易号并等待明确状态后，连续 30 次运行通过。'}],
      ['支付质量门禁流水线配置及失败复盘','ci/payment-quality-gate.yaml',84,9,{gate:'流水线设置单元测试、契约测试和静态检查三道门禁；测试失败阻止合并，覆盖率低于 80% 要求解释并经评审。',results:'试运行时发现异常退款路径未覆盖，补充 6 个用例；门禁日志保留失败原因、对应提交和复跑结果。',rollback:'门禁误报时保留人工审批例外及 24 小时内复核记录，避免直接关闭全部检查。'}],
      ['核心支付链路 SLO 定义与告警演练','docs/slo/payment-slo.md',105,13,{serviceLevel:'将支付确认成功率定义为成功确认数/有效支付请求数，排除用户主动取消；目标 99.9%，观察窗口 28 天。',signals:'监控成功率、P95 延迟和超时重试比例；以 5 分钟与 1 小时双窗口燃烧率告警区分突发故障和持续退化。',exercise:'用隔离演示环境注入通道超时，验证告警触发、值班定位和恢复记录；复盘发现重试指标缺少通道标签并已补齐。'}],
      ['支付回调并发压测与资源调优','reports/payment-callback-load.md',91,15,{baseline:'在隔离压测环境以每秒 300 次回调运行 20 分钟，P95 延迟 240 毫秒，CPU 峰值 78%，堆内存峰值 1.4GB；重复回调占 15%。',diagnosis:'火焰图和线程采样显示同步查询交易状态造成连接池等待；堆分析发现重试上下文保留了完整请求体。',change:'将只读状态查询改为批量缓存并限制重试上下文大小；按交易号分区处理，维持幂等锁作用域。',verification:'相同流量与数据集复测 20 分钟，P95 降至 125 毫秒，CPU 峰值 57%，堆内存峰值 930MB；用 600 次/秒峰值和重复回调回归验证，无重复扣款或状态错乱。'}],
    ],
    objectives:[] },
  'zhang-san': { repository:'payment-service', skills:['programming','testing','k8s'], priorOrg:'业务研发部 / 订单组',
    commits:[['拆分订单路由策略并补充泛型接口','src/routing/Strategy.java',68,21],
      ['补充支付异常路径单元测试','tests/PaymentServiceTest.java',124,8],
      ['完善K8s资源限制与发布回滚配置','deploy/payment.yaml',35,12]],
    objectives:[['提升支付服务交付质量','关键路径单元测试覆盖率',60,85,79,'%'],
      ['完成支付服务容器化实践','完成部署、配置排查和回滚演练',0,3,2,'项']] },
  'zhou-chen': { repository:'observability-platform', skills:['observability-building','k8s','collaboration'], priorOrg:'基础架构部 / 容器平台组',
    commits:[['统一核心服务告警标签','rules/service-alerts.yaml',83,26],
      ['补充集群迁移前容量检查脚本','scripts/capacity-check.py',112,9],
      ['完善分批迁移与回滚运行手册','docs/migration-runbook.md',96,18]],
    objectives:[['提升核心服务可观测性','接入统一告警规范的服务数量',30,46,44,'个'],
      ['提高集群迁移安全性','完成迁移回滚演练次数',0,4,3,'次']] },
  'lin-xiao': { repository:'sre-toolkit', skills:['slo-design','incident-response','capacity-gov'], priorOrg:'基础架构部 / 运维组',
    commits:[['完善核心链路SLO计算规则','rules/core-slo.yaml',72,14],
      ['新增依赖超时故障演练场景','chaos/dependency-timeout.yaml',58,4],
      ['优化容量压测结果汇总脚本','scripts/load-summary.py',89,23]],
    objectives:[['提高核心链路稳定性','完成高优风险整改数量',0,18,16,'项'],
      ['提升应急响应能力','通过联合故障演练的系统数量',2,8,6,'个']] },
  'chen-ran': { repository:'environment-automation', skills:['automation-dev','infra-as-code','k8s'], priorOrg:'研发效能部 / 工具组',
    commits:[['实现环境编排任务失败重试','src/workflows/retry.py',105,17],
      ['增加基础设施策略校验规则','policies/resource-limits.rego',64,6],
      ['完善容器资源扫描报告','scripts/resource-audit.py',77,19]],
    objectives:[['提升标准环境交付效率','标准环境自动交付流程数量',2,5,4,'类'],
      ['降低基础设施配置风险','接入策略校验的发布流水线数量',1,4,3,'条']] },
};

export async function seedMockFacts(db) {
  let inserted=0;
  await db.begin(async tx => {
    await tx`SELECT pg_advisory_xact_lock(17019002)`;
    const employees=await tx`SELECT id,slug,org,role FROM employee ORDER BY slug`;
    for(const [slug,scenario] of Object.entries(scenarios)) {
      const person=employees.find(e=>e.slug===slug);
      if(!person) continue;
      const insert=async (key,kind,title,date,content) => {
        const rows=await tx`INSERT INTO mvp_mock_fact_source(source_key,employee_id,kind,title,occurrence_label,content)
          VALUES (${key},${person.id},${kind},${'[模拟] '+title},${date},${JSON.stringify({
            isSimulated:true,dataset:'skilltree-facts-demo-v1',...content})}::text::jsonb)
          ON CONFLICT(source_key) DO NOTHING RETURNING source_key`;
        inserted+=rows.length;
      };
      for(const [index,[message,file,added,deleted,details]] of scenario.commits.entries()) {
        const key=`demo-v1:${slug}:commit:${index+1}`;
        const hash=createHash('sha1').update(key).digest('hex');
        await insert(key,'git_commit',message,`2026-09-${14+index*3}`,{
          repository:scenario.repository,commitHash:hash,authorEmployeeId:person.id,branch:'main',message,
          committedAt:`2026-09-${14+index*3}T02:00:00Z`,files:[{path:file,additions:added,deletions:deleted}],
          pullRequest:{number:101+index,state:'merged',reviewStatus:'approved'},
          ci:{status:'passed',checks:['unit-tests','lint']},relatedSkillSlugs:[scenario.skills[index]],
          scenarioNotice:'开发演示样本，非张伟真实贡献；仅用于验证技能申请和 AI 材料评估流程',
          ...(details ?? {}),
          sourceRef:`mock://git/${scenario.repository}/commit/${hash}`,
        });
      }
      for(const [index,[objective,metric,baseline,target,current,unit]] of scenario.objectives.entries()) {
        await insert(`demo-v1:${slug}:okr:${index+1}`,'okr',objective,'2026-Q3',{
          period:'2026-Q3',ownerEmployeeId:person.id,objective,
          keyResults:[{id:`KR${index+1}`,metric,baseline,target,current,unit,direction:'increase',
            progressPercent:Math.round((current-baseline)/(target-baseline)*100),updatedAt:'2026-09-25T02:00:00Z'}],
          lifecycleStatus:'closed',outcome:'partially_achieved',
          relatedSkillSlugs:[scenario.skills[index]],sourceRef:`mock://okr/${slug}/2026-Q3/${index+1}`,
        });
      }
      await insert(`demo-v1:${slug}:transfer:1`,'employee_transfer','组织内岗位调动记录','2026-01-05',{
        employeeId:person.id,effectiveDate:'2026-01-05',transferType:'internal_transfer',
        from:{org:scenario.priorOrg,role:person.role},to:{org:person.org,role:person.role},
        reason:'模拟组织调整，职责延续并增加跨组协作',status:'effective',
        profileWriteback:false,sourceRef:`mock://hr/transfers/${slug}/2026-01-05`,
      });
    }
  });
  return inserted;
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const db=postgres(process.env.DATABASE_URL,{max:1});
  try { console.log(`模拟事实源已就绪，本次新增 ${await seedMockFacts(db)} 条；不覆盖已有模拟源或员工档案。`); }
  finally { await db.end(); }
}
