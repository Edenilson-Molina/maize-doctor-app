import { NativeModules } from 'react-native';
import { Database } from '@nozbe/watermelondb';

const hasNativeModule = !!NativeModules.WMDatabaseBridge;

let database: Database | null = null;

if (hasNativeModule) {
  const SQLiteAdapter = require('@nozbe/watermelondb/adapters/sqlite').default;
  const { schema } = require('./schema');
  const { Scan } = require('./models/Scan');
  const { Correction } = require('./models/Correction');
  const { DatasetContribution } = require('./models/DatasetContribution');

  const adapter = new SQLiteAdapter({
    schema,
    jsi: false,
    onSetUpError: (error: unknown) => {
      console.error('WatermelonDB setup error:', error);
    },
  });

  database = new Database({
    adapter,
    modelClasses: [Scan, Correction, DatasetContribution],
  });
} else {
  console.warn(
    'WatermelonDB native module not available (Expo Go). Using in-memory mock data.'
  );
}

export { database, hasNativeModule };
