import { BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { standardIssues } from '@shared/position-validation';
import { blankLevels } from '../skill-standards/skill-standards';
import type { JobFamily, PositionImportPreview, PositionImportRow } from '@shared/api.interface';

const families: Record<string, JobFamily> = { T:'T',P:'P',F:'F',M:'M',技术:'T',产品:'P',行政:'F',管理:'M', 'T（技术）':'T','P（产品）':'P','F（行政）':'F','M（管理）':'M',技术T:'T',产品P:'P',行政F:'F',管理M:'M' };
export function validateImportRows(input: unknown): PositionImportPreview {
  if (!Array.isArray(input) || !input.length || input.length > 2000) throw new BadRequestException('请提供 1–2000 条技能要求');
  const rows: PositionImportRow[] = [], errors: string[] = [], seen = new Set<string>(), definitions = new Map<string,string>();
  input.forEach((raw,index) => {
    const r=raw as Partial<PositionImportRow> | null;
    if (!r || typeof r!=='object') { errors.push(`第 ${index+2} 行格式错误`);return; }
    const family=families[String(r.family??'').trim()];
    const direction=String(r.direction??'').trim(),grade=String(r.grade??'').trim().toUpperCase();
    const skillName=String(r.skillName??'').trim(),value=String(r.requiredLevel??'').trim().replace(/^L/i,'');
    const requiredLevel=Number(value);
    if (!family || !direction || direction.length>128 || !new RegExp(`^${family}[1-4]$`).test(grade) || !skillName || skillName.length>128 || !/^[1-5]$/.test(value)) {
      errors.push(`第 ${index+2} 行：序列需为 T/P/F/M，方向和技能必填（最多128字），职级须与序列一致（如T1、P2、M3、F4），技能等级为 L1–L5`);return;
    }
    const key=JSON.stringify([family,direction,grade,skillName]);
    if(seen.has(key)){errors.push(`第 ${index+2} 行：${direction} / ${grade} / ${skillName} 重复`);return;}
    const extra:Partial<PositionImportRow>={};
    for(const field of ['skillDescription','levelDescription','evidenceRequirements'] as const){
      const value=r[field];
      if(value===undefined||value==='')continue;
      if(typeof value!=='string'||value.length>4000){errors.push(`第 ${index+2} 行：技能说明、等级标准或证明要求最多4000字`);return;}
      const normalized=value.trim();
      const standardKey=JSON.stringify([skillName,field,field==='skillDescription'?'all':requiredLevel]);
      if(definitions.has(standardKey)&&definitions.get(standardKey)!==normalized){errors.push(`第 ${index+2} 行：同名技能的说明或同等级标准不一致，请统一后导入`);return;}
      definitions.set(standardKey,normalized);extra[field]=normalized;
    }
    if(r.isRequired!==undefined && typeof r.isRequired!=='boolean'){errors.push(`第 ${index+2} 行：是否必须只能填写是或否`);return;}
    if(r.standard){
      if(standardIssues(r.standard).length){errors.push(`第 ${index+2} 行：技能说明及L1–L5的达标标准、证明材料要求必须完整`);return;}
      const signature=JSON.stringify({description:r.standard.description,levels:r.standard.levels});
      const standardKey=JSON.stringify([skillName,'full']);
      if(definitions.has(standardKey)&&definitions.get(standardKey)!==signature){errors.push(`第 ${index+2} 行：同名技能的五级标准不一致`);return;}
      definitions.set(standardKey,signature);
    }
    seen.add(key);rows.push({family,direction,grade,skillName,requiredLevel,isRequired:r.isRequired,...(r.standard?{standard:r.standard}:{}),...extra});
  });
  return {rows,errors};
}
export function parsePositionFile(filename: unknown, content: unknown): PositionImportPreview {
  if(typeof filename!=='string' || typeof content!=='string' || content.length>8*1024*1024 || !/^[A-Za-z0-9+/]*={0,2}$/.test(content))
    throw new BadRequestException('文件内容无效，最大 5MB');
  const buffer=Buffer.from(content,'base64');
  if(!buffer.length || buffer.length>5*1024*1024) throw new BadRequestException('文件为空或超过 5MB');
  const extension=filename.split('.').pop()?.toLowerCase();
  let table: unknown[][];
  try {
    if(['xlsx','xls','csv','tsv'].includes(extension??'')) {
      const isText=extension==='csv'||extension==='tsv';
      const book=isText
        ? XLSX.read(buffer.toString('utf8').replace(/^\uFEFF/,''),{type:'string',raw:true,sheetRows:2003})
        : XLSX.read(buffer,{type:'buffer',raw:true,sheetRows:2003});
      if(book.SheetNames.length!==1) throw new BadRequestException('请仅保留一个工作表后导入');
      const sheet=book.Sheets[book.SheetNames[0]];
      table=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',blankrows:false});
      // 只展开明确存在的合并范围，普通空白字段仍应报错。
      for(const range of sheet['!merges']??[])for(let r=range.s.r+1;r<=range.e.r;r++){
        if(range.s.c<=2 && table[r])table[r][range.s.c]=table[range.s.r]?.[range.s.c]??'';
      }
    } else if(['md','markdown','txt'].includes(extension??'')) {
      table=buffer.toString('utf8').replace(/^\uFEFF/,'').split(/\r?\n/).filter(line=>line.trim().includes('|'))
        .map(line=>line.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(cell=>cell.trim()))
        .filter(row=>!row.every(cell=>/^:?-{3,}:?$/.test(cell)));
    } else throw new BadRequestException('支持 .xlsx、.xls、.csv、.tsv、.md、.txt 表格');
  } catch(error) {
    if(error instanceof BadRequestException) throw error;
    throw new BadRequestException('文件解析失败，请检查文件格式');
  }
  const headers=(table.shift()??[]).map(cell=>String(cell).replace(/^\uFEFF/,'').trim());
  const aliases=[['序列','family'],['子方向','方向','岗位方向','direction'],['职级','grade'],['技能','技能名称','skillName'],['技能等级','要求等级','requiredLevel']];
  const indices=aliases.map(names=>headers.findIndex(header=>names.includes(header)));
  if(indices.some(index=>index<0)) throw new BadRequestException('缺少表头：序列、子方向、职级、技能、技能等级。Markdown 请使用表格格式');
  const optional=[['技能说明','skillDescription'],['技能描述','达标标准','等级描述','levelDescription'],['证明材料要求','证明要求','evidenceRequirements']];
  optional.forEach(names=>indices.push(headers.findIndex(header=>names.includes(header))));
  const fields=['family','direction','grade','skillName','requiredLevel','skillDescription','levelDescription','evidenceRequirements'];
  const requiredIndex=headers.findIndex(h=>['是否必须','是否必需','isRequired'].includes(h));
  const parsed=table.filter(row=>row.some(cell=>String(cell??'').trim())).filter(row=>row.some((cell,column)=>column>2&&String(cell??'').trim())).map(row=>{
    const data=Object.fromEntries(fields.map((field,index)=>[field,row[indices[index]]])) as Record<string,unknown>;
    const value=String(row[requiredIndex]??'').trim();
    data.isRequired=requiredIndex<0?true:value==='是'?true:value==='否'?false:value;
    const descriptionIndex=headers.indexOf('技能说明');
    const levels=blankLevels();let hasFull=false;
    for(const level of levels)for(const [field,label] of [['anchor','达标标准'],['evidence','证明材料要求']] as const){
      const column=headers.indexOf(`L${level.level}${label}`);
      if(column>=0){hasFull=true;level[field]=String(row[column]??'').trim();}
    }
    if(hasFull)data.standard={description:String(row[descriptionIndex]??'').trim(),levels,revision:''};
    return data;
  });
  return validateImportRows(parsed);
}
