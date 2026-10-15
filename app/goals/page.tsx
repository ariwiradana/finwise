import {RecordManager} from '@/components/record-manager';
export default function Page(){return <RecordManager kind='goals' title='Target Keuangan' description='Buat target dana darurat, pembelian, atau tujuan keuangan lain.' fields={[{key:'target',label:'Target (IDR)',type:'number',options:undefined,required:true},
{key:'allocated',label:'Dana dialokasikan (IDR)',type:'number',options:undefined,required:true},
{key:'deadline',label:'Tenggat',type:'date',options:undefined,required:false},
{key:'priority',label:'Prioritas',type:'select',options:['1 - Tinggi', '2', '3 - Normal', '4', '5 - Rendah'],required:true},
{key:'status',label:'Status',type:'select',options:['Aktif', 'Jeda', 'Selesai'],required:true},
{key:'note',label:'Catatan',type:'textarea',options:undefined,required:false}]} amountKey='target'/>}
