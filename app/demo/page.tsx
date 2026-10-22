import Workspace from './workspace';
export default async function Demo({searchParams}:{searchParams:Promise<{role?:string}>}){const {role}=await searchParams;return <Workspace initialRole={role==='teacher'?'teacher':'admin'}/>}
