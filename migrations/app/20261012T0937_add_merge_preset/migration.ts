#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/7f7899b579c163d5a4dab3005bf3d678919c855d1d8b359b0da29ceb11ea8145/contract';
import startContract from '../../snapshots/7f7899b579c163d5a4dab3005bf3d678919c855d1d8b359b0da29ceb11ea8145/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/f906272610726babb3cfd1e53275f02e7f0d5fee91beabfb036e6dd65c0da50d/contract';
import endContract from '../../snapshots/f906272610726babb3cfd1e53275f02e7f0d5fee91beabfb036e6dd65c0da50d/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'mergePreset',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('items', 'json', { notNull: true, codecRef: { codecId: 'pg/json@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'mergePreset',
        index: 'mergePreset_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'mergePreset',
        foreignKey: {
          name: 'mergePreset_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
