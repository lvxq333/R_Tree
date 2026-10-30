import * as XLSX from 'xlsx';
import type { PositionCatalog } from '@shared/api.interface';
import { JOB_FAMILIES } from '@shared/position-validation';

/** 单一工作表：每项岗位技能一行，空职级也保留。 */
export function exportPositionWorkbook(catalog: PositionCatalog): Buffer {
  const rows: string[][] = [['序列','方向','职级','技能名称','技能等级','技能描述','是否必须']];
  const merges: XLSX.Range[] = [];
  const merge = (start: number, end: number, col: number) => {
    if (end > start) merges.push({s:{r:start,c:col},e:{r:end,c:col}});
  };
  for (const family of JOB_FAMILIES) {
    const familyStart = rows.length;
    for (const direction of catalog.directions.filter(d=>d.family===family.code).sort((a,b)=>a.name.localeCompare(b.name,'zh-CN')||a.slug.localeCompare(b.slug))) {
      const directionStart = rows.length;
      for (const grade of direction.grades) {
        const gradeStart = rows.length;
        if (!grade.requirements.length) rows.push([family.name+family.code,direction.name,grade.code,'','','','']);
        for (const requirement of grade.requirements) {
          const standard = requirement.standard ?? catalog.skillStandards[requirement.skillName];
          rows.push([family.name+family.code,direction.name,grade.code,requirement.skillName,`L${requirement.requiredLevel}`,
            standard?.levels.find(l=>l.level===requirement.requiredLevel)?.anchor.trim() || '未配置',
            requirement.isRequired === undefined ? '未配置' : requirement.isRequired ? '是' : '否']);
        }
        merge(gradeStart,rows.length-1,2);
      }
      merge(directionStart,rows.length-1,1);
    }
    merge(familyStart,rows.length-1,0);
  }
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!merges']=merges;
  sheet['!cols']=[12,26,10,30,12,90,12].map(wch=>({wch}));
  sheet['!rows']=rows.map((row,index)=>({hpt:index===0?28:Math.max(30,18*(Math.ceil(row[5].length/42)+row[5].split('\n').length-1))}));
  sheet['!margins']={left:.25,right:.25,top:.4,bottom:.4,header:.2,footer:.2};
  const book=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book,sheet,'公司岗位技能标准');
  const buffer:Buffer=XLSX.write(book,{type:'buffer',bookType:'xlsx'});
  // SheetJS社区版不写入对齐和冻结配置；在生成的OOXML中补齐这两项。
  const zip=XLSX.CFB.read(buffer,{type:'buffer'});
  const xml=(path:string)=>Buffer.from(XLSX.CFB.find(zip,'/'+path).content).toString('utf8');
  const put=(path:string,content:string)=>XLSX.CFB.utils.cfb_add(zip,'/'+path,Buffer.from(content));
  let styles=xml('xl/styles.xml');
  const xf='<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>';
  const count=Number(styles.match(/<cellXfs count="(\d+)"/)?.[1]??1);
  styles=styles.replace(/<cellXfs count="\d+"/,`<cellXfs count="${count+1}"`).replace('</cellXfs>',xf+'</cellXfs>');
  put('xl/styles.xml',styles);
  const worksheet=xml('xl/worksheets/sheet1.xml')
    .replace(/<sheetView([^>]*?)\/>/,'<sheetView$1><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView>')
    .replace(/<c\b([^>]*?)>/g,(_all:string,attrs:string)=>`<c${attrs.replace(/ s="\d+"/,'')} s="${count}">`);
  put('xl/worksheets/sheet1.xml',worksheet);
  return Buffer.from(XLSX.CFB.write(zip,{type:'buffer',fileType:'zip'}));
}
