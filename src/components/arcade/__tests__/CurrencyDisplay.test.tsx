import { render, screen, act } from '@testing-library/react';
import { CurrencyDisplay } from '@/components/arcade/CurrencyDisplay';
import { CurrencyService } from '@/services/CurrencyService';

describe('CurrencyDisplay', () => {
  it('renders the initial coin balance from the provided service', () => {
    const service = new CurrencyService();
    service.setBalance(250);

    render(<CurrencyDisplay currencyService={service} />);

    expect(screen.getByLabelText('Coins')).toHaveTextContent('250');
  });

  it('formats large balances as grouped coin amounts', () => {
    const service = new CurrencyService();
    service.setBalance(12_345);

    render(<CurrencyDisplay currencyService={service} />);

    expect(screen.getByLabelText('Coins')).toHaveTextContent('12,345');
  });

  it('updates and animates when the service emits a balance change', () => {
    jest.useFakeTimers();
    try {
      const service = new CurrencyService();
      service.setBalance(10);

      const { container } = render(<CurrencyDisplay currencyService={service} />);
      const wrapper = container.querySelector('.currency-display') as HTMLElement;

      expect(screen.getByLabelText('Coins')).toHaveTextContent('10');
      expect(wrapper).not.toHaveClass('animate-coin-tick');

      act(() => {
        service.setBalance(99);
      });

      expect(screen.getByLabelText('Coins')).toHaveTextContent('99');
      expect(wrapper).toHaveClass('animate-coin-tick');
      // The delta readout tells the player what just changed.
      expect(screen.getByText('+89')).toBeInTheDocument();

      // The animation flag clears once the tick timeout elapses.
      act(() => {
        jest.advanceTimersByTime(1400);
      });
      expect(wrapper).not.toHaveClass('animate-coin-tick');
    } finally {
      jest.useRealTimers();
    }
  });

  it('unsubscribes from the service on unmount', () => {
    const service = new CurrencyService();
    service.setBalance(5);
    const unsubscribe = jest.fn();
    jest.spyOn(service, 'onCoinsChanged').mockReturnValue(unsubscribe);

    const { unmount } = render(<CurrencyDisplay currencyService={service} />);
    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
