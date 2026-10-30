import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {resolveCareerDirection}=require('../dist/server/modules/growth/career-position.js');
const directions=[
  {slug:'java-new',name:'Java开发工程师',family:'T',titles:['初级Java开发工程师','中级Java开发工程师']},
  {slug:'software',name:'软件开发序列',family:'T',titles:['初级软件开发工程师']},
  {slug:'team',name:'团队管理',family:'M',titles:['初级团队主管','资深团队负责人']},
];
const profile=(role,preferred_track=null,job_grade=null)=>({role,preferred_track,job_grade});
test('初级Java岗位根据动态方向与职级名称匹配，覆盖过时的泛技术关联',()=>{
  assert.equal(resolveCareerDirection(profile('初级java开发工程师','software','T1'),directions),'java-new');
});
test('团队经理根据岗位语义匹配管理方向，旧技术职级不强制其选技术序列',()=>{
  assert.equal(resolveCareerDirection(profile('团队经理','software','T4'),directions),'team');
});
test('职级名称可以匹配任意新增方向，不依赖固定岗位列表',()=>{
  const dynamic=[...directions,{slug:'custom',name:'嵌入式安全',family:'T',titles:['初级车载安全工程师']}];
  assert.equal(resolveCareerDirection(profile('初级车载安全工程师'),dynamic),'custom');
});
test('存在多个相似方向时采用明确岗位关联，不随机选中第一项',()=>{
  const ambiguous=[{slug:'a',name:'Java后端',family:'T',titles:[]},{slug:'b',name:'Java平台',family:'T',titles:[]}];
  assert.equal(resolveCareerDirection(profile('Java工程师'),ambiguous),null);
  assert.equal(resolveCareerDirection(profile('Java工程师','b'),ambiguous),'b');
});
test('岗位未能匹配时保留有效关联，已删除或不存在的方向不能作为默认值',()=>{
  assert.equal(resolveCareerDirection(profile('未匹配岗位','team'),directions),'team');
  assert.equal(resolveCareerDirection(profile('未匹配岗位','deleted'),directions),null);
});
