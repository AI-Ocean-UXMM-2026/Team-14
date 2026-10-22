export function payrollDate(value:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new Error('INVALID_PERIOD');
 const date=new Date(value+'T00:00:00Z');
 if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value)throw new Error('INVALID_PERIOD');
 return value;
}
export function signedMmk(value:string){
 if(!/^-?\d+$/.test(value)||!Number.isSafeInteger(Number(value)))throw new Error('INVALID_AMOUNT');
 return Number(value);
}
