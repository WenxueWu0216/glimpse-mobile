import '@shopify/flash-list/jestSetup';
import mockSafeAreaContext from 'react-native-safe-area-context/jest/mock';

// There is no real device in Jest, so safe-area insets come from the
// library's own mock (all zeros).
jest.mock('react-native-safe-area-context', () => mockSafeAreaContext);
