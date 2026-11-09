import '@shopify/flash-list/jestSetup';
import mockNetInfo from '@react-native-community/netinfo/jest/netinfo-mock';
import mockSafeAreaContext from 'react-native-safe-area-context/jest/mock';

// There is no real device in Jest, so native modules are replaced by the
// mocks their libraries ship.
jest.mock('react-native-safe-area-context', () => mockSafeAreaContext);
jest.mock('@react-native-community/netinfo', () => mockNetInfo);

// Unit tests use the in-memory store; sqliteStore.test.ts covers the SQL.
jest.mock('./src/offline/defaultStore', () => {
  const { MemoryStore } = jest.requireActual<typeof import('./src/offline/memoryStore')>(
    './src/offline/memoryStore',
  );
  return { createDefaultStore: () => new MemoryStore() };
});
