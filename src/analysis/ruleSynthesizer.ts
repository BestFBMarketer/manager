// =====================================
// MODULE: Rule Synthesizer
// Purpose: Kanalin birikmis video_analytics_snapshot verisinden LLM ile
//          pattern bulur, content_rule(status='proposed') satirlari yazar.
//          Insan onayindan gecmeden hicbir sey aktif olmaz (getActiveRules
//          sadece status='approved' okur) - bkz analysis/contentRules.ts.
// Dependencies: llm/router, core/db, core/logger, core/notify, analysis/contentRules
// Author: BestMarketer Team
// Last Modified: 2026-09-05
// =====================================

import { getDb } from '../core/db.js';
import { Logger } from '../core/logger.js';
import { notify } from '../core/notify.js';
import { callLlmJson } from '../llm/router.js';
import { getActiveRules } from './contentRules.js';

const MIN_VIDEOS_FOR_SYNTHESIS = 8; // az veriden gurultulu pattern uydurmasin

interface LatestSnapshotRow {
  video_id: string;
  title: string | null;
  views: number;
  average_view_percentage: number | null;
  likes: number;
  comments: number;
}

interface ExistingRuleRow {
  category: string;
  rule_text: string;
  status: string;
}

export interface ProposedRule {
  category: string;
  ruleText: string;
  rationale: string;
  evidenceVideoIds: string[];
}

function isProposedRuleList(value: unknown): value is { rules: ProposedRule[] } {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (!Array.isArray(obj.rules)) return false;
  return obj.rules.every((r) => {
    if (typeof r !== 'object' || r === null) return false;
    const rule = r as Record<string, unknown>;
    return (
      typeof rule.category === 'string' &&
      typeof rule.ruleText === 'string' &&
      typeof rule.rationale === 'string' &&
      Array.isArray(rule.evidenceVideoIds) &&
      rule.evidenceVideoIds.every((v) => typeof v === 'string')
    );
  });
}

function getLatestSnapshots(channelId: string): LatestSnapshotRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT video_id, title, views, average_view_percentage, likes, comments
       FROM video_analytics_snapshot v1
       WHERE channel_id = ?
         AND snapshot_date = (
           SELECT MAX(snapshot_date) FROM video_analytics_snapshot v2
           WHERE v2.channel_id = v1.channel_id AND v2.video_id = v1.video_id
         )
       ORDER BY views DESC`,
    )
    .all(channelId) as LatestSnapshotRow[];
}

function getAllExistingRules(channelId: string): ExistingRuleRow[] {
  const db = getDb();
  return db
    .prepare('SELECT category, rule_text, status FROM content_rule WHERE channel_id = ?')
    .all(channelId) as ExistingRuleRow[];
}

function buildUserPrompt(snapshots: LatestSnapshotRow[], existingRules: ExistingRuleRow[]): string {
  const lines = [
    'Per-video performance data (views | avg_view_pct | likes | comments | title):',
    ...snapshots.map(
      (s) =>
        `- ${s.views} | ${s.average_view_percentage?.toFixed(1) ?? '?'}% | ${s.likes}li/${s.comments}co | ${s.title ?? s.video_id}`,
    ),
  ];

  if (existingRules.length > 0) {
    lines.push(
      '',
      'Rules already known for this channel (do NOT propose these again, even reworded):',
      ...existingRules.map((r) => `- [${r.status}] (${r.category}) ${r.rule_text}`),
    );
  }

  lines.push(
    '',
    'Propose 0-3 NEW content rules based on patterns in this data that are not already known.',
    'Each rule must be concrete and actionable for whoever writes the next video\'s hook/title/outro.',
  );

  return lines.join('\n');
}

const SYSTEM_PROMPT = [
  'You are a YouTube Shorts data analyst. You are given per-video performance data for one channel',
  '(views, average-view-percentage retention, likes, comments, titles).',
  'Find concrete, actionable patterns: what title/thumbnail phrasing, pacing, or content style correlates',
  'with high retention or high engagement (likes+comments relative to views) on THIS channel\'s own data.',
  'Do not invent generic YouTube advice - only propose a rule if the data in front of you actually supports it.',
  'If you cannot find any new, well-supported pattern, return an empty rules array - that is a valid answer.',
  'Return ONLY this JSON schema:',
  '{"rules": [{"category": "hook"|"title"|"pacing"|"outro"|"tier_choice"|"engagement"|"general",',
  '"ruleText": string, "rationale": string, "evidenceVideoIds": string[]}]}',
].join(' ');

/**
 * Bir kanal icin pattern-synthesis calistirir, content_rule(status='proposed')
 * satirlari yazar. Yeterli veri yoksa (MIN_VIDEOS_FOR_SYNTHESIS altinda) sessizce
 * atlar - erken/gurultulu oneri uretmemek icin.
 *
 * @returns eklenen proposed kural sayisi
 */
export async function synthesizeRulesForChannel(channelId: string): Promise<number> {
  const snapshots = getLatestSnapshots(channelId);
  if (snapshots.length < MIN_VIDEOS_FOR_SYNTHESIS) {
    Logger.info(
      `${channelId}: sadece ${snapshots.length} video verisi var (min ${MIN_VIDEOS_FOR_SYNTHESIS}), pattern-synthesis atlaniyor`,
    );
    return 0;
  }

  const existingRules = getAllExistingRules(channelId);
  const { data } = await callLlmJson<{ rules: ProposedRule[] }>(
    { task: 'patternSynthesis', system: SYSTEM_PROMPT, user: buildUserPrompt(snapshots, existingRules) },
    isProposedRuleList,
  );

  if (data.rules.length === 0) {
    Logger.info(`${channelId}: yeni bir pattern bulunamadi (LLM 0 kural onerdi)`);
    return 0;
  }

  const db = getDb();
  const insert = db.prepare(
    `INSERT INTO content_rule (channel_id, category, rule_text, rationale, evidence_json, status, proposed_by)
     VALUES (?, ?, ?, ?, ?, 'proposed', 'rule_synthesizer')`,
  );
  const insertMany = db.transaction((rules: ProposedRule[]) => {
    for (const rule of rules) {
      insert.run(channelId, rule.category, rule.ruleText, rule.rationale, JSON.stringify(rule.evidenceVideoIds));
    }
  });
  insertMany(data.rules);

  Logger.success(`${channelId}: ${data.rules.length} yeni kural onerildi (onay bekliyor)`);
  await notify({
    subject: `${data.rules.length} yeni içerik kuralı onay bekliyor: ${channelId}`,
    body: data.rules.map((r) => `[${r.category}] ${r.ruleText}\n  Gerekçe: ${r.rationale}`).join('\n\n'),
    severity: 'info',
  });

  // Mevcut aktif kural sayisi da bilgi amacli loglanir - kural setinin sadece
  // buyudugunu degil, uretimin gercekten neyi okudugunu gormek icin.
  Logger.info(`${channelId}: su anda ${getActiveRules(channelId).length} onaylanmis aktif kural var`);
  return data.rules.length;
}
