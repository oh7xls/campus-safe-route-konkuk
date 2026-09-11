export type Point={lng:number;lat:number;name:string};
export type Facility={id:string;type:'CCTV'|'보안등';lng:number;lat:number;source:string;updatedAt:string};
export type Report={id:string;type:string;lng:number;lat:number;description:string;createdAt:string;expiresAt:string;confidence:number;status:'확인 필요'|'신뢰도 높음'|'신뢰도 낮음'};
