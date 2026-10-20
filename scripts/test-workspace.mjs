import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeWorkspace, tenureInMonths } from '../dist/server/modules/employee/employee-workspace.service.js';

const at = new Date('2026-10-19T04:00:00Z');
const skill = (id, values = {}) => ({
  id, skillSlug: id, currentLevel: 2, status: 'approved', approvedAt: null,
  updatedAt: new Date('2026-09-01T00:00:00Z'), ...values,
});

test('候选和退回材料不计为认证；待复核保留原等级', () => {
  const result = summarizeWorkspace([
    skill('java'), skill('requirements', { status: 'review', currentLevel: 3 }),
    skill('k8s', { status: 'ready', currentLevel: 1 }),
    skill('testing', { status: 'returned', currentLevel: 1 }),
  ], [], at);
  assert.equal(result.certifiedSkillCount, 2);
  assert.equal(result.averageSkillLevel, 2.5);
  assert.equal(result.candidateCount, 1);
  assert.deepEqual(result.maturity, { expert: 0, core: 1, growth: 1 });
});

test('相同技能去重，已有认证的再次申请不丢失原等级', () => {
  const result = summarizeWorkspace([
    skill('first', { skillSlug: 'java' }),
    skill('second', { skillSlug: 'java', currentLevel: 3, updatedAt: new Date('2026-09-02T00:00:00Z') }),
    skill('prior', { status: 'pending', approvedAt: '2026-09-01', currentLevel: 4 }),
    skill('invalid', { currentLevel: 6 }),
  ], [], at);
  assert.equal(result.certifiedSkillCount, 2);
  assert.equal(result.averageSkillLevel, 3.5);
  assert.deepEqual(result.maturity, { expert: 1, core: 1, growth: 0 });
});

test('最新正式降级覆盖历史高等级，不统计成历史最高等级', () => {
  const result = summarizeWorkspace([
    skill('old', { skillSlug: 'java', currentLevel: 4, approvedAt: '2026-08-01' }),
    skill('new', { skillSlug: 'java', currentLevel: 2, approvedAt: '2026-09-01' }),
  ], [], at);
  assert.equal(result.certifiedSkillCount, 1);
  assert.equal(result.averageSkillLevel, 2);
  assert.deepEqual(result.maturity, { expert: 0, core: 0, growth: 1 });
});

test('无技能标识的旧记录不凭名称猜测合并，未知指标保持空值', () => {
  const result = summarizeWorkspace([
    skill('legacy-1', { skillSlug: null }), skill('legacy-2', { skillSlug: null }),
  ], [], at);
  assert.equal(result.certifiedSkillCount, 2);
  assert.equal(result.superEmployeeLevel, null);
});

test('近三月升级按上海月份计算，不包含初次点亮、降级、过期和未来事件', () => {
  const result = summarizeWorkspace([], [
    { dateLabel: '2026.08', level: 'L2 → L3' },
    { dateLabel: '2026.10', level: 'L3 -> L4' },
    { dateLabel: '2026.09', level: '未点亮 → L2' },
    { dateLabel: '2026.09', level: 'L4 → L3' },
    { dateLabel: '2026.07', level: 'L4 → L5' },
    { dateLabel: '2026.11', level: 'L1 → L2' },
    { dateLabel: '2026.13', level: 'L1 → L2' },
  ], new Date('2026-09-30T16:30:00Z'));
  assert.equal(result.recentUpgradeCount, 2);
});

test('空数据没有虚构平均等级或认证数', () => {
  const result = summarizeWorkspace([], [], at);
  assert.equal(result.certifiedSkillCount, 0);
  assert.equal(result.averageSkillLevel, null);
  assert.equal(result.recentUpgradeCount, 0);
});

test('入职记录只有月份，不虚构精确入职天数', () => {
  assert.equal(tenureInMonths('2025.07', at), 15);
  assert.equal(tenureInMonths('2026.10', at), 0);
  assert.equal(tenureInMonths('2026.11', at), null);
  assert.equal(tenureInMonths('2026.13', at), null);
  assert.equal(tenureInMonths(null, at), null);
});
