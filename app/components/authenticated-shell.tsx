import WorkspaceShell from './workspace-shell';
import {logout} from '../login/actions';
export default function AuthenticatedShell({children,role,page,title}:{children:React.ReactNode;role:'admin'|'teacher';page:string;title:string}){return <WorkspaceShell role={role} page={page} title={title} signOut={<form action={logout}><button className="btn small">Sign out</button></form>}>{children}</WorkspaceShell>}
