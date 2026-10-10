// Aturan cerita YSPI. Daftar yang sama dipakai penghubung WhatsApp
// (yspi-supabase/aturan.mjs) — ubah keduanya bersamaan.
export const requiredFields=[['name','nama guru'],['school','sekolah'],['region','wilayah'],['date','tanggal'],['sessions','jumlah sesi'],['students','jumlah siswa'],['activity','kegiatan mengajar']] as const;
export const requiredKeys:string[]=requiredFields.map(([k])=>k);
const empty=(v:unknown)=>v===null||v===undefined||String(v).trim()==='';
// Jejak belajar (#jejak, hasil belajar siswa di rumah): cukup nama guru, dan yang diminta di
// pertemuan terakhir ATAU foto. Sekolah tidak wajib (keputusan 10 Okt 2026).
export const jejakRequiredKeys=['name'];
// Foto kegiatan cerita tidak wajib (keputusan 2 Okt 2026); hasPhoto hanya berpengaruh pada jejak.
export function missingFields(report:Record<string,unknown>,hasPhoto?:boolean){
 if(report.jenis!=='jejak')return requiredFields.filter(([k])=>empty(report[k])).map(([,label])=>label);
 const kurang:string[]=requiredFields.filter(([k])=>jejakRequiredKeys.includes(k)&&empty(report[k])).map(([,label])=>label);
 if(empty(report.activity)&&!hasPhoto)kurang.push('yang diminta di pertemuan terakhir, atau fotonya');
 return kurang;
}
export const jejakFormat=[
 '#jejak',
 'Nama: ... (boleh dilewati bila sudah pernah #cerita)',
 'Di pertemuan terakhir siswa diminta: ...',
 'Hasilnya: ... (opsional)',
 'Jumlah siswa yang ikut: ... (opsional)',
].join('\n');
export const reportFormat=[
 '#cerita',
 'Nama: ... (tidak perlu bila sudah #kenalan)',
 'Sekolah: ... (tidak perlu bila sudah #kenalan)',
 'Wilayah: ... (tidak perlu bila sudah #kenalan)',
 'Tanggal: ...',
 'Jumlah sesi: ...',
 'Jumlah siswa: ...',
 'Kegiatan: ...',
 'Kisah berdampak: ... (opsional)',
 'Kendala & kebutuhan: ... (opsional)',
 'Dana diterima: ... (opsional)',
 'Dana digunakan: ... (opsional)',
 'Catatan dana: ... (opsional)',
].join('\n');
