import { act, render, screen } from '@testing-library/react-native';

import '../../i18n';
import { useNetworkStore } from '../../state/networkStore';
import { OfflineBanner } from '../OfflineBanner';

describe('OfflineBanner', () => {
  beforeEach(() => useNetworkStore.setState({ isOnline: true, pendingActions: 0 }));

  it('is hidden while online', async () => {
    await render(<OfflineBanner />);
    expect(screen.queryByTestId('offline-banner')).not.toBeOnTheScreen();
  });

  it('appears when the connection drops and shows queued changes', async () => {
    await render(<OfflineBanner />);

    await act(async () => useNetworkStore.setState({ isOnline: false }));
    expect(screen.getByText("You're offline. Showing saved content.")).toBeOnTheScreen();

    await act(async () => useNetworkStore.setState({ pendingActions: 2 }));
    expect(screen.getByText("You're offline. 2 changes will sync later.")).toBeOnTheScreen();
  });
});
