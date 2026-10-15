import {RecordManager} from '@/components/record-manager';
export default function Page(){return <RecordManager kind='budgets' title='Budget' description='Tetapkan batas bulanan dan pantau progres pemakaian.' fields={[{key:'category',label:'Kategori',type:'text',options:undefined,required:true},
{key:'limit',label:'Limit bulanan (IDR)',type:'number',options:undefined,required:true},
{key:'month',label:'Bulan mulai',type:'date',options:undefined,required:true},
{key:'alerts',label:'Ambang notifikasi (%)',type:'text',options:undefined,required:true}]} amountKey='limit'/>}
