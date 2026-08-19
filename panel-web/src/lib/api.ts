// Panel API istemcisi - tum istekler cerez tabanli oturumu tasimak icin credentials:'include' kullanir.

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, typeof body.error === 'string' ? body.error : `HTTP ${res.status}`);
  }
  return body as T;
}

export const api = {
  login: (password: string) => request<{ ok: true }>('/login', { method: 'POST', body: JSON.stringify({ password }) }),
  logout: () => request<{ ok: true }>('/logout', { method: 'POST' }),
  me: () => request<{ authenticated: boolean }>('/me'),

  listChannels: () => request<ChannelConfig[]>('/channels'),
  getChannel: (id: string) => request<ChannelConfig>(`/channels/${id}`),
  createChannel: (input: NewChannelInput) => request<ChannelConfig>('/channels', { method: 'POST', body: JSON.stringify(input) }),
  updateChannel: (id: string, patch: Record<string, unknown>) =>
    request<ChannelConfig>(`/channels/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  updateSchedule: (id: string, rule: ScheduleRuleInput) =>
    request<ChannelConfig>(`/channels/${id}/schedule`, { method: 'PUT', body: JSON.stringify(rule) }),
  getCalendar: (id: string) => request<{ kind: string; items: CalendarItem[] }>(`/channels/${id}/calendar`),
};

export interface PrimeTimeSlot {
  id: string;
  timeZone: string;
  hour: number;
  minute: number;
  label: string;
}

export type ScheduleRule =
  | { kind: 'weekday_list'; weekdays: number[] }
  | { kind: 'every_n_days'; intervalDays: number; anchor: string }
  | { kind: 'count_per_period'; countPerPeriod: number; periodMonths: number; anchor: string };

export interface ScheduleRuleInput {
  kind: 'weekday_list' | 'every_n_days' | 'count_per_period';
  weekdays?: number[];
  intervalDays?: number;
  countPerPeriod?: number;
  periodMonths?: number;
  anchor?: string;
  slots: PrimeTimeSlot[];
}

export interface ChannelSettings {
  shortsDerivativeEnabled: boolean;
  crossPost: { facebook: boolean; instagram: boolean; tiktok: boolean };
}

export interface ChannelConfig {
  id: string;
  label: string;
  channelType: 'standard' | 'story';
  refreshTokenEnvKey: string;
  defaultTemplate: string;
  slots: PrimeTimeSlot[];
  scheduleRule: ScheduleRule;
  targetDurationSec: number;
  language: string;
  wikiLanguages: string[];
  audience: string;
  titleExamples: string[];
  styleReference: string | null;
  topicSource: 'reference' | 'ai_generated' | 'both';
  shortsDerivativeCount: number;
  categoryId: string;
  enabled: boolean;
  settings: ChannelSettings;
}

export interface NewChannelInput {
  id: string;
  label: string;
  channelType: 'standard' | 'story';
  refreshTokenEnvKey: string;
  defaultTemplate: string;
  targetDurationSec: number;
  language: string;
  categoryId: string;
  topicSource: 'reference' | 'ai_generated' | 'both';
  styleReference: string | null;
  scheduleRule: ScheduleRuleInput;
}

export interface CalendarItem {
  id: number;
  video_id: string | null;
  publish_at: string;
  status: string;
  platform: string;
  template: string;
  source_ref: string;
  job_stage: string;
}
