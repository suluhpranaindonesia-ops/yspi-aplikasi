// Aturan cerita YSPI. Daftar yang sama dipakai penghubung WhatsApp
// (yspi-supabase/aturan.mjs) — ubah keduanya bersamaan.
export const requiredFields=[['name','nama guru'],['school','sekolah'],['region','wilayah'],['date','tanggal'],['sessions','jumlah sesi'],['students','jumlah siswa'],['activity','kegiatan mengajar']] as const;
export const requiredKeys:string[]=requiredFields.map(([k])=>k);
const empty=(v:unknown)=>v===null||v===undefined||String(v).trim()==='';
// Foto kegiatan tidak wajib (keputusan 2 Okt 2026); hasPhoto dipertahankan agar pemanggil tetap sama.
export function missingFields(report:Record<string,unknown>,_hasPhoto?:boolean){
 return requiredFields.filter(([k])=>empty(report[k])).map(([,label])=>label);
}
export const reportFormat=[
 '#cerita',
 'Nama: ...',
 'Sekolah: ...',
 'Wilayah: ...',
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
