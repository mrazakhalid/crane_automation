import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Decoding needs canvas/image which jsdom can't do — mock the decode util and
// exercise the component's UI wiring instead.
vi.mock('../utils/qr.js', () => ({ decodeQrFromFile: vi.fn() }));

import { decodeQrFromFile } from '../utils/qr.js';
import { ToastProvider } from '../components/ToastProvider.js';
import { QrScanner } from '../components/QrScanner.js';

function renderScanner() {
  render(
    <ToastProvider>
      <QrScanner />
    </ToastProvider>,
  );
}

const pngFile = () => new File(['fake'], 'code.png', { type: 'image/png' });

describe('QrScanner', () => {
  beforeAll(() => {
    // jsdom lacks object URLs — stub them for the preview.
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();
  });
  beforeEach(() => vi.clearAllMocks());

  it('shows the decoded QR contents in the textarea', async () => {
    vi.mocked(decodeQrFromFile).mockResolvedValue('https://crane.local/recipe/42');
    renderScanner();

    await userEvent.upload(screen.getByLabelText(/qr image file/i), pngFile());

    expect(decodeQrFromFile).toHaveBeenCalledOnce();
    expect(await screen.findByDisplayValue('https://crane.local/recipe/42')).toBeInTheDocument();
  });

  it('surfaces an error when no QR code is found', async () => {
    vi.mocked(decodeQrFromFile).mockRejectedValue(new Error('No QR code found in that image'));
    renderScanner();

    await userEvent.upload(screen.getByLabelText(/qr image file/i), pngFile());

    expect(await screen.findByRole('alert')).toHaveTextContent(/no qr code found/i);
  });
});
