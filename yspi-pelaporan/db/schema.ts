// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import {sqliteTable,text,integer,real,index} from 'drizzle-orm/sqlite-core';
export const reports=sqliteTable('reports',{
 id:text('id').primaryKey(),name:text('name').notNull().default(''),phone:text('phone').notNull().default(''),school:text('school').notNull().default(''),region:text('region').notNull().default(''),date:text('date').notNull().default(''),sessions:integer('sessions'),students:integer('students'),activity:text('activity').notNull().default(''),impact:text('impact').notNull().default(''),challenge:text('challenge').notNull().default(''),funds_received:real('funds_received'),funds_used:real('funds_used'),funds_note:text('funds_note').notNull().default(''),raw:text('raw').notNull().default(''),source:text('source').notNull().default('manual'),status:text('status').notNull().default('review'),issue_status:text('issue_status').notNull().default('open'),model:text('model').notNull().default(''),created_at:text('created_at').notNull(),updated_at:text('updated_at').notNull()
},t=>[index('idx_reports_created').on(t.created_at)]);
export const jobs=sqliteTable('jobs',{id:text('id').primaryKey(),kind:text('kind').notNull(),payload:text('payload').notNull(),status:text('status').notNull().default('pending'),result:text('result'),error:text('error'),lease:text('lease'),lease_until:integer('lease_until'),created_at:text('created_at').notNull()},t=>[index('idx_jobs_queue').on(t.status,t.created_at)]);
export const media=sqliteTable('media',{id:text('id').primaryKey(),report_id:text('report_id').notNull().references(()=>reports.id),name:text('name').notNull(),type:text('type').notNull(),key:text('key').notNull(),created_at:text('created_at').notNull()},t=>[index('idx_media_report').on(t.report_id)]);
export const settings=sqliteTable('settings',{key:text('key').primaryKey(),value:text('value').notNull()});
