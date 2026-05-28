import { render, screen, fireEvent } from '@testing-library/react';
import { WelcomeBanner } from '@/components/auth/WelcomeBanner';

describe('WelcomeBanner', () => {
  it('renders the authenticated state with the user name and sign-out button', () => {
    const onSignIn = jest.fn();
    const onSignOut = jest.fn();
    render(
      <WelcomeBanner
        name="Ada Lovelace"
        authenticated
        onSignIn={onSignIn}
        onSignOut={onSignOut}
      />
    );

    expect(screen.getByText('Welcome')).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Sign in' })
    ).not.toBeInTheDocument();
  });

  it('renders the unauthenticated state with the sign-in button', () => {
    render(
      <WelcomeBanner name="Ada Lovelace" authenticated={false} onSignIn={jest.fn()} />
    );

    expect(screen.getByText('Sign in required')).toBeInTheDocument();
    expect(
      screen.getByText('Use an approved account to continue')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    // The name should not leak when unauthenticated.
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument();
  });

  it('fires onSignIn when the sign-in button is clicked', () => {
    const onSignIn = jest.fn();
    render(<WelcomeBanner name="x" authenticated={false} onSignIn={onSignIn} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it('fires onSignOut when the sign-out button is clicked', () => {
    const onSignOut = jest.fn();
    render(
      <WelcomeBanner
        name="x"
        authenticated
        onSignIn={jest.fn()}
        onSignOut={onSignOut}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it('does not crash when authenticated without an onSignOut handler', () => {
    render(<WelcomeBanner name="x" authenticated onSignIn={jest.fn()} />);
    const button = screen.getByRole('button', { name: 'Sign out' });
    // onClick is undefined; clicking should be a no-op rather than throwing.
    expect(() => fireEvent.click(button)).not.toThrow();
  });
});
