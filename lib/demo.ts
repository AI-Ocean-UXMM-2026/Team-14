import { type Session } from './domain/payroll';
export const sessions: Session[] = [
  {id:'SS-001',teacher:'Daw Thiri',subject:'Mathematics · Grade 8',start:'2026-10-20T02:30:00Z',end:'2026-10-20T03:35:00Z',rate:12000,verification:'verified',correction:false},
  {id:'SS-002',teacher:'U Min Htet',subject:'English · Grade 9',start:'2026-10-20T04:30:00Z',end:'2026-10-20T05:20:00Z',rate:10000,verification:'verified',correction:false},
  {id:'SS-003',teacher:'Daw May',subject:'Science · Grade 7',start:'2026-10-21T02:30:00Z',end:'2026-10-21T04:00:00Z',rate:15000,verification:'pending',correction:true},
  {id:'SS-004',teacher:'Daw Thiri',subject:'Mathematics · Grade 8',start:'2026-10-21T05:30:00Z',end:null,rate:12000,verification:'pending',correction:false}
];
