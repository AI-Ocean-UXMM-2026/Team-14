/** Explicit school-local input; never inherit the browser or server timezone. */
export function yangonTimestamp(input:string):string {
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input))throw new Error('INVALID_INTERVAL');
 const time=Date.parse(input+':00+06:30');
 if(!Number.isFinite(time)||new Date(time+390*60000).toISOString().slice(0,16)!==input)throw new Error('INVALID_INTERVAL');
 return new Date(time).toISOString();
}
export function yangonInput(timestamp:string){const time=Date.parse(timestamp);if(!Number.isFinite(time))return '';return new Date(time+390*60000).toISOString().slice(0,16);}
