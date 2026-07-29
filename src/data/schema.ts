import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'scans',
      columns: [
        { name: 'image_uri', type: 'string' },
        { name: 'label', type: 'string', isOptional: true },
        { name: 'confidence', type: 'number', isOptional: true },
        { name: 'distribution_json', type: 'string', isOptional: true },
        { name: 'lat', type: 'number', isOptional: true },
        { name: 'lon', type: 'number', isOptional: true },
        { name: 'temperature', type: 'number', isOptional: true },
        { name: 'humidity', type: 'number', isOptional: true },
        { name: 'synced', type: 'boolean' },
        { name: 'created_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'corrections',
      columns: [
        { name: 'scan_id', type: 'string', isIndexed: true },
        { name: 'observed_label', type: 'string' },
        { name: 'note', type: 'string', isOptional: true },
        { name: 'status', type: 'string' },
        { name: 'synced', type: 'boolean' },
        { name: 'created_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'dataset_contributions',
      columns: [
        { name: 'image_uri', type: 'string' },
        { name: 'label', type: 'string' },
        { name: 'note', type: 'string', isOptional: true },
        { name: 'synced', type: 'boolean' },
        { name: 'created_at', type: 'number' },
      ],
    }),
  ],
});
