import {RecordManager} from '@/components/record-manager';
export default function Page(){return <RecordManager kind='categories' title='Kategori' description='Atur kategori pemasukan, pengeluaran, transfer, aset, dan alokasi.' fields={[{key:'type',label:'Tipe kategori',type:'select',options:['Pemasukan', 'Pengeluaran', 'Transfer', 'Alokasi', 'Aset', 'Liabilitas'],required:true},
{key:'parent',label:'Kategori induk',type:'text',options:undefined,required:false},
{key:'color',label:'Warna / label',type:'text',options:undefined,required:false}]} amountKey={undefined}/>}
