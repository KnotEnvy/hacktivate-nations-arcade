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

  it('formats large balances using formatNumber', () => {
    const service = new CurrencyService();
    service.setBalance(12_345);

    render(<CurrencyDisplay currencyService={service} />);

    expect(screen.getByLabelText('Coins')).toHaveTextContent('12.3K');
  });

  it('updates and animates when the service emits a balance change', () => {
    jest.useFakeTimers();
    try {
      const service = new CurrencyService();
      service.setBalance(10);

      const { container } = render(<CurrencyDisplay currencyService={service} />);
      const wrapper = container.querySelector('.currency-display') as HTMLElement;

      expect(screen.getByLabelText('Coins')).toHaveTextContent('10');
      expect(wrapper).not.toHaveClass('animate-bounce');

      act(() => {
        service.setBalance(99);
      });

      expect(screen.getByLabelText('Coins')).toHaveTextContent('99');
      expect(wrapper).toHaveClass('animate-bounce');

      // The animation flag clears after the 600ms timeout.
      act(() => {
        jest.advanceTimersByTime(600);
      });
      expect(wrapper).not.toHaveClass('animate-bounce');
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
