import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const rooms=sqliteTable('rooms',{code:text('code').primaryKey(),data:text('data').notNull(),version:integer('version').notNull(),expires:integer('expires').notNull()},t=>[index('rooms_expires').on(t.expires)]);
export const rates=sqliteTable('rates',{key:text('key').primaryKey(),count:integer('count').notNull(),expires:integer('expires').notNull()},t=>[index('rates_expires').on(t.expires)]);
