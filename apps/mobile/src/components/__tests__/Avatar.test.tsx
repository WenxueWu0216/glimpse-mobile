import { render, screen } from '@testing-library/react-native';

import { Avatar } from '../Avatar';

test('falls back to the first letter when there is no picture', async () => {
  await render(<Avatar name="leo" uri={null} />);
  expect(screen.getByText('L')).toBeOnTheScreen();
});
