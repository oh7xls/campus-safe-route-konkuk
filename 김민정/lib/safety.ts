import type {Facility,Report} from './types';
const dist=(a:{lng:number;lat:number},b:{lng:number;lat:number})=>{const r=6371000,p=Math.PI/180,x=(b.lng-a.lng)*p*Math.cos((a.lat+b.lat)*p/2),y=(b.lat-a.lat)*p;return Math.hypot(x,y)*r};
export function evaluate(line:[number,number][], facilities:Facility[], reports:Report[]){
 const near=(x:{lng:number;lat:number})=>line.some(([lng,lat])=>dist(x,{lng,lat})<=45);
 const f=facilities.filter(near), active=reports.filter(r=>new Date(r.expiresAt)>new Date()&&near(r));
 const cctv=f.filter(x=>x.type==='CCTV').length, lamps=f.filter(x=>x.type==='보안등').length;
 const penalty=active.reduce((s,r)=>s+(r.confidence/100)*({ '통행 불가':34,'가로등 고장':18,'공사 중':14,'어두운 구간':12}[r.type]??8),0);
 return {score:Math.max(0,Math.min(100,55+cctv*2+lamps*1.2-penalty)),cctv,lamps,active,reason:active.length?`${active[0].type} 제보 ${active.length}건을 반영했습니다.`:`현재 유효 제보가 없어 공공시설 정보만 반영했습니다.`};
}
