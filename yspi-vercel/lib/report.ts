import {z} from 'zod';
const txt=z.string().max(12000).default('');
export const reportSchema=z.object({name:z.string().max(200).default(''),phone:z.string().max(80).default(''),school:z.string().max(300).default(''),region:z.string().max(200).default(''),date:z.string().refine(v=>v===''||/^\d{4}-\d{2}-\d{2}$/.test(v),'Tanggal tidak valid').default(''),sessions:z.number().int().min(0).max(100000).nullable().default(null),students:z.number().int().min(0).max(1000000).nullable().default(null),activity:txt,impact:txt,challenge:txt,funds_received:z.number().min(0).max(1e12).nullable().default(null),funds_used:z.number().min(0).max(1e12).nullable().default(null),funds_note:txt,jenis:z.enum(['cerita','jejak']).default('cerita')});
export const reportKeys=Object.keys(reportSchema.shape);
