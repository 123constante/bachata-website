import { fireEvent, screen, within } from '@testing-library/react';

/** Drive the Languages tick list to exactly this comma list (the field is a picker now, not a text input). */
export const setLanguages = async (text: string): Promise<void> => {
  const picker = await screen.findByTestId('languages-picker');
  const want = text.split(',').map((s) => s.trim()).filter(Boolean);
  const chips = picker.querySelector('[data-testid="languages-chips"]');
  if (chips) {
    for (const b of within(chips as HTMLElement).queryAllByRole('button')) {
      const label = b.getAttribute('aria-label') ?? '';
      const name = label.replace(/^Remove /, '');
      if (label.startsWith('Remove ') && !want.some((w) => w.toLowerCase() === name.toLowerCase())) fireEvent.click(b);
    }
  }
  for (const w of want) {
    const box = within(picker).getByLabelText(w) as HTMLInputElement;
    if (!box.checked) fireEvent.click(box);
  }
};
