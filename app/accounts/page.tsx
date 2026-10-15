import {RecordManager} from '@/components/record-manager';
export default function Page(){return <RecordManager kind='accounts' title='Akun & Rekening' description='Kelola bank, cash, e-wallet, tabungan, investasi, dan kartu kredit.' fields={[{key:'type',label:'Jenis akun',type:'select',options:['Cash', 'Bank', 'E-wallet', 'Tabungan', 'Deposito', 'Investasi', 'Kartu kredit'],required:true},
{key:'openingBalance',label:'Saldo awal (IDR)',type:'number',options:undefined,required:true,allowNegative:true},
{key:'openingBalanceDate',label:'Tanggal saldo awal',type:'date',options:undefined,required:true},
{key:'minimumBalance',label:'Batas saldo minimum (IDR)',type:'number',options:undefined,required:false}]} amountKey='openingBalance'/>}
