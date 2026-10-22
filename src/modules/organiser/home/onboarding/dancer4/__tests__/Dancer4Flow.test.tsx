// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ProfileCompletion, ProfileField } from '@/lib/profileCompletion';

const save = vi.fn();
vi.mock('@/lib/saveMyDancerProfile', () => ({ saveMyDancerProfile: (...a: unknown[]) => save(...a) }));
const request = vi.fn();
const chips = vi.fn();
const cityExists = vi.fn();
vi.mock('../dancer4Api', () => ({ fetchChipCities: () => chips(), fetchCityExists: (...a: unknown[]) => cityExists(...a), submitCityRequest: (...a: unknown[]) => request(...a) }));
const search = vi.fn();
vi.mock('../../citySearch', () => ({ searchCities: (...a: unknown[]) => search(...a) }));
vi.mock('@/components/profile/AvatarUpload', () => ({
  AvatarUpload: ({ onChange }: { onChange: (u: string) => void }) => <button type="button" onClick={() => onChange('https://img/me.jpg')}>Choose a picture</button>,
}));

import { Dancer4Flow } from '../Dancer4Flow';

const ALL: ProfileField[] = ['first_name', 'based_city_id', 'dance_role', 'avatar_url'];
const complete: ProfileCompletion = { status: 'complete', missing: [], profileId: 'p1' };

const mount = (props: Partial<React.ComponentProps<typeof Dancer4Flow>> = {}) => {
  const onDone = vi.fn();
  const refetch = vi.fn().mockResolvedValue(complete);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <Dancer4Flow missing={ALL} profileId="p1" refetch={refetch} onDone={onDone} {...props} />
    </QueryClientProvider>,
  );
  return { onDone, refetch };
};
const title = () => screen.getByTestId('dancer4-title').textContent;
const next = () => screen.getByRole('button', { name: /^(Next|Finish)$/ }) as HTMLButtonElement;

afterEach(cleanup);
beforeEach(() => {
  save.mockReset().mockResolvedValue(undefined);
  request.mockReset().mockResolvedValue(undefined);
  chips.mockReset().mockResolvedValue([{ id: 'london', name: 'London' }]);
  search.mockReset().mockResolvedValue([]);
  cityExists.mockReset().mockResolvedValue(true);
});

describe('Dancer4Flow', () => {
  it('walks all four questions, one per screen, and finishes through the server check', async () => {
    const { onDone, refetch } = mount();
    expect(title()).toBe('Your first name');
    expect(screen.getByTestId('dancer4-progress').textContent).toBe('Step 1 of 4');
    expect(next().disabled).toBe(true);
    expect(screen.getByTestId('dancer4-reason').textContent).toBe('Type your first name');
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Marta' } });
    fireEvent.click(next());
    await waitFor(() => expect(title()).toBe('Which city do you dance in?'));
    expect(save).toHaveBeenLastCalledWith({ first_name: 'Marta' });

    expect(next().disabled).toBe(true);
    expect(screen.getByTestId('dancer4-reason').textContent).toBe('Pick your city');
    fireEvent.click(await screen.findByRole('button', { name: 'London' }));
    fireEvent.click(next());
    await waitFor(() => expect(title()).toBe('Do you lead or follow?'));
    expect(save).toHaveBeenLastCalledWith({ based_city_id: 'london' });

    expect(screen.getByTestId('dancer4-reason').textContent).toBe('Pick one');
    fireEvent.click(screen.getByRole('radio', { name: 'Follower' }));
    fireEvent.click(next());
    await waitFor(() => expect(title()).toBe('Add a photo of you'));
    expect(save).toHaveBeenLastCalledWith({ dance_role: 'Follower' });

    expect(next().disabled).toBe(true);
    expect(screen.getByTestId('dancer4-reason').textContent).toBe('Add a photo');
    fireEvent.click(screen.getByRole('button', { name: 'Choose a picture' }));
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenLastCalledWith({ avatar_url: 'https://img/me.jpg' });
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledTimes(4);
  });

  it('prefilled city is skipped and saved with the first answer; the prefilled name is shown, editable, on its step', async () => {
    mount({ prefill: { first_name: 'Marta', city_id: 'c9' } });
    await waitFor(() => expect(title()).toBe('Your first name'));
    expect(screen.getByTestId('dancer4-progress').textContent).toBe('Step 1 of 3');
    expect((screen.getByLabelText('First name') as HTMLInputElement).value).toBe('Marta');
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Martina' } });
    fireEvent.click(next());
    await waitFor(() => expect(title()).toBe('Do you lead or follow?'));
    expect(save).toHaveBeenLastCalledWith({ based_city_id: 'c9', first_name: 'Martina' });
    expect(cityExists).toHaveBeenCalledWith('c9');
  });

  it('a prefill that answers the city and the name saves after the person confirms the name', async () => {
    const { onDone } = mount({ missing: ['first_name', 'based_city_id'], prefill: { first_name: 'Marta', city_id: 'c9' } });
    await waitFor(() => expect(title()).toBe('Your first name'));
    fireEvent.click(next());
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenCalledWith({ based_city_id: 'c9', first_name: 'Marta' });
  });

  // F1: whatever the invite carried, a city that does not exist (or cannot be checked) is asked, never saved unseen.
  it.each([
    ['unknown city id', () => cityExists.mockResolvedValue(false)],
    ['the city check fails', () => cityExists.mockRejectedValue(new Error('offline'))],
  ])('%s: the city question is asked and the stale id is never sent', async (_l, arrange) => {
    arrange();
    mount({ prefill: { first_name: null, city_id: 'stale' } });
    await waitFor(() => expect(title()).toBe('Your first name'));
    expect(screen.getByTestId('dancer4-progress').textContent).toBe('Step 1 of 4');
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Marta' } });
    fireEvent.click(next());
    await waitFor(() => expect(title()).toBe('Which city do you dance in?'));
    expect(save.mock.calls.every(([b]) => !('based_city_id' in b))).toBe(true);
  });

  it('a prefilled city the server then refuses is dropped, the question is asked, and what was saved stays', async () => {
    save.mockImplementation(async (b: Record<string, string>) => { if (b.based_city_id === 'c9') throw new Error('SAVE_FAILED'); });
    mount({ missing: ['based_city_id', 'dance_role'], prefill: { first_name: null, city_id: 'c9' } });
    await waitFor(() => expect(title()).toBe('Do you lead or follow?'));
    fireEvent.click(screen.getByRole('radio', { name: 'Leader' }));
    fireEvent.click(next());
    await waitFor(() => expect(title()).toBe('Which city do you dance in?'));
    expect(screen.queryByTestId('dancer4-error')).toBeNull();
    expect(save).toHaveBeenLastCalledWith({ dance_role: 'Leader' });
    // the person can now answer it and finish
    fireEvent.click(await screen.findByRole('button', { name: 'London' }));
    fireEvent.click(next());
    await waitFor(() => expect(save).toHaveBeenLastCalledWith({ based_city_id: 'london' }));
  });

  it('a genuine failure of an unrelated save is still an error, not a dropped prefill', async () => {
    save.mockRejectedValue(new Error('offline'));
    mount({ missing: ['based_city_id', 'dance_role'], prefill: { first_name: null, city_id: 'c9' } });
    await waitFor(() => expect(title()).toBe('Do you lead or follow?'));
    fireEvent.click(screen.getByRole('radio', { name: 'Leader' }));
    fireEvent.click(next());
    expect(await screen.findByTestId('dancer4-error')).toBeTruthy();
    expect(title()).toBe('Do you lead or follow?');
  });

  it('city not found: tell us your city, request sent, the city is still required', async () => {
    mount({ missing: ['based_city_id'] });
    fireEvent.change(screen.getByLabelText('Search for your city'), { target: { value: 'Kraków' } });
    const notFound = await screen.findByTestId('dancer4-city-notfound');
    expect(notFound.textContent).toBe("Can't find it? Tell us your city");
    fireEvent.click(notFound);
    expect((screen.getByLabelText('Your city') as HTMLInputElement).value).toBe('Kraków');
    fireEvent.click(screen.getByTestId('dancer4-city-send'));
    await waitFor(() => expect(request).toHaveBeenCalledWith('Kraków'));
    expect(screen.getByTestId('dancer4-city-requested').textContent).toContain('pick the nearest city above');
    expect(next().disabled).toBe(true);
    expect(screen.getByTestId('dancer4-reason').textContent).toBe('Pick the nearest city for now');
  });

  it('a failed city request says so and can be retried', async () => {
    request.mockRejectedValueOnce(new Error('x'));
    mount({ missing: ['based_city_id'] });
    fireEvent.change(screen.getByLabelText('Search for your city'), { target: { value: 'Kraków' } });
    fireEvent.click(await screen.findByTestId('dancer4-city-notfound'));
    fireEvent.click(screen.getByTestId('dancer4-city-send'));
    expect(await screen.findByText(/could not send that/i)).toBeTruthy();
    fireEvent.click(screen.getByTestId('dancer4-city-send'));
    await waitFor(() => expect(screen.getByTestId('dancer4-city-requested')).toBeTruthy());
  });

  it('a failed save stays on the question, says so, and sends nothing twice on retry', async () => {
    save.mockRejectedValueOnce(new Error('boom'));
    mount({ missing: ['first_name', 'dance_role'] });
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Marta' } });
    fireEvent.click(next());
    expect(await screen.findByTestId('dancer4-error')).toBeTruthy();
    expect(title()).toBe('Your first name');
    fireEvent.click(next());
    await waitFor(() => expect(title()).toBe('Do you lead or follow?'));
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('the server saying "not complete" after the last save is shown, not swallowed', async () => {
    const refetch = vi.fn().mockResolvedValue({ status: 'incomplete', missing: ['avatar_url'], profileId: 'p1' });
    const { onDone } = mount({ missing: ['dance_role'], refetch });
    fireEvent.click(screen.getByRole('radio', { name: 'Leader' }));
    fireEvent.click(next());
    expect(await screen.findByTestId('dancer4-error')).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('Back returns to the previous question and is absent on the first', async () => {
    mount({ missing: ['first_name', 'dance_role'] });
    expect(screen.queryByTestId('dancer4-back')).toBeNull();
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Marta' } });
    fireEvent.click(next());
    await waitFor(() => expect(title()).toBe('Do you lead or follow?'));
    fireEvent.click(screen.getByTestId('dancer4-back'));
    expect(title()).toBe('Your first name');
    // Changing the answer after Back sends the new value, not nothing.
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Maria' } });
    fireEvent.click(next());
    await waitFor(() => expect(title()).toBe('Do you lead or follow?'));
    expect(save).toHaveBeenLastCalledWith({ first_name: 'Maria' });
  });
});
