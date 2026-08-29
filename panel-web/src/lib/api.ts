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
  getCalendar: (id: string) => request<CalendarResponse>(`/channels/${id}/calendar`),
  getBatch: (batchId: string) => request<BatchProgress>(`/batches/${batchId}`),
  createBatch: (channelId: string, input: BatchInput) =>
    request<{ batchId: string; jobIds: number[] }>(`/channels/${channelId}/batch`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  listReview: (channelId?: string) =>
    request<ReviewItem[]>(`/review${channelId ? `?channel=${encodeURIComponent(channelId)}` : ''}`),
  updateReviewMetadata: (id: number, edits: { proposedTitle?: string; proposedDescription?: string; proposedTags?: string[] }) =>
    request<ReviewItem>(`/review/${id}`, { method: 'PATCH', body: JSON.stringify(edits) }),
  approveReview: (id: number, decidedBy: string) =>
    request<{ videoId: string; studioUrl: string; publicUrl: string }>(`/review/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ decidedBy }),
    }),
  rejectReview: (id: number, decidedBy: string, note?: string) =>
    request<{ ok: true }>(`/review/${id}/reject`, { method: 'POST', body: JSON.stringify({ decidedBy, note }) }),
  requestChangesReview: (id: number, decidedBy: string, note: string) =>
    request<{ ok: true }>(`/review/${id}/request-changes`, {
      method: 'POST',
      body: JSON.stringify({ decidedBy, note }),
    }),
  requeueReview: (id: number, changedFields?: Record<string, unknown>) =>
    request<{ ok: true }>(`/review/${id}/requeue`, { method: 'POST', body: JSON.stringify({ changedFields }) }),
  regenerateReview: (id: number) =>
    request<ReviewItem>(`/review/${id}/regenerate`, { method: 'POST' }),

  listPublishTargets: (channelId: string) => request<PublishTarget[]>(`/channels/${channelId}/publish-targets`),
  updatePublishTarget: (
    channelId: string,
    platform: string,
    input: { credentialsEnvKey: string; externalChannelRef: string; enabled: boolean },
  ) =>
    request<PublishTarget>(`/channels/${channelId}/publish-targets/${platform}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),

  listStoryReferences: (channelId: string) =>
    request<StoryReference[]>(`/channels/${channelId}/story-reference`),
  addStoryReference: (channelId: string, sourceUrl: string, label?: string) =>
    request<StoryReference>(`/channels/${channelId}/story-reference`, {
      method: 'POST',
      body: JSON.stringify({ sourceUrl, label }),
    }),
  removeStoryReference: (channelId: string, refId: number) =>
    request<{ ok: true }>(`/channels/${channelId}/story-reference/${refId}`, { method: 'DELETE' }),

  listLongVideos: (channelId: string) => request<LongVideo[]>(`/channels/${channelId}/long-videos`),
  repurposeVideo: (channelId: string, jobId: number, count: number, offsetDays?: number[]) =>
    request<{ queued: number }>(`/channels/${channelId}/long-videos/${jobId}/repurpose`, {
      method: 'POST',
      body: JSON.stringify({ count, offsetDays }),
    }),
};

export interface LongVideo {
  jobId: number;
  template: string;
  title: string;
  videoId: string;
  videoUrl: string;
  publishAt: string;
  durationSec: number | null;
  derivativeCount: number;
}

export function mediaUrl(renderId: number): string {
  return `/api/media/${renderId}`;
}

export function thumbnailUrl(reviewItemId: number): string {
  return `/api/review/${reviewItemId}/thumbnail`;
}

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
  niche: string | null;
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
  niche?: string | null;
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

export interface PendingReviewSummary {
  id: number;
  job_id: number;
  kind: string;
  preview_path: string | null;
  proposed_title: string;
  created_at: string;
}

export interface CalendarResponse {
  scheduled: CalendarItem[];
  pendingReview: PendingReviewSummary[];
}

export interface BatchProgress {
  batchId: string;
  total: number;
  pending: number;
  processing: number;
  awaitingReview: number;
  done: number;
  failed: number;
  rejected: number;
  needsChanges: number;
}

export interface BatchInput {
  count: number;
  items?: Array<{ sourceRef: string; hotelName?: string; hotelCity?: string }>;
}

export interface ReviewItem {
  id: number;
  job_id: number;
  channel_id: string;
  channel_label: string;
  channel_type: 'standard' | 'story';
  kind: string;
  status: string;
  preview_path: string | null;
  thumbnail_path: string | null;
  proposed_title: string;
  proposed_description: string;
  proposed_tags_json: string;
  fact_checked_at: string | null;
  reviewer_note: string | null;
  render_id?: number;
  created_at: string;
}

export interface PublishTarget {
  id: number;
  channel_id: string;
  platform: string;
  external_channel_ref: string | null;
  enabled: number;
  credentials_env_key: string | null;
  config_json: string;
}

export interface StoryReference {
  id: number;
  channel_id: string;
  source_url: string;
  label: string | null;
  enabled: number;
  created_at: string;
}
