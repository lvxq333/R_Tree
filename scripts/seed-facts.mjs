import 'dotenv/config';
import postgres from 'postgres';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

// Fixed fixtures are repeatable, explicitly fictional, and never infer skill certification.
const scenarios = {
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
      if(!person) throw new Error(`模拟数据缺少对应员工：${slug}`);
      const insert=async (key,kind,title,date,content) => {
        const rows=await tx`INSERT INTO mvp_mock_fact_source(source_key,employee_id,kind,title,occurrence_label,content)
          VALUES (${key},${person.id},${kind},${'[模拟] '+title},${date},${JSON.stringify({
            isSimulated:true,dataset:'skilltree-facts-demo-v1',...content})}::text::jsonb)
          ON CONFLICT(source_key) DO NOTHING RETURNING source_key`;
        inserted+=rows.length;
      };
      for(const [index,[message,file,added,deleted]] of scenario.commits.entries()) {
        const key=`demo-v1:${slug}:commit:${index+1}`;
        const hash=createHash('sha1').update(key).digest('hex');
        await insert(key,'git_commit',message,`2026-09-${14+index*3}`,{
          repository:scenario.repository,commitHash:hash,authorEmployeeId:person.id,branch:'main',message,
          committedAt:`2026-09-${14+index*3}T02:00:00Z`,files:[{path:file,additions:added,deletions:deleted}],
          pullRequest:{number:101+index,state:'merged',reviewStatus:'approved'},
          ci:{status:'passed',checks:['unit-tests','lint']},relatedSkillSlugs:[scenario.skills[index]],
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
