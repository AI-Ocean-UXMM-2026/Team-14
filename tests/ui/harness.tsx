import {createRoot} from 'react-dom/client';
import RecordsClient from '../../app/workspace/records-client';
import PayrollClient from '../../app/workspace/payroll/payroll-client';
import ManageClient from '../../app/workspace/manage/manage-client';
import {recordFixture,payrollFixture,managementFixture} from './fixtures';
const query=new URLSearchParams(location.search),screen=query.get('screen')??'records';
createRoot(document.getElementById('root')!).render(screen==='finance'?<PayrollClient {...payrollFixture(query)}/>:screen==='management'?<ManageClient {...managementFixture(query)}/>:<RecordsClient {...recordFixture(query)}/>);
