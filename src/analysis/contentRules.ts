// =====================================
// MODULE: Content Rules
// Purpose: Uretim tarafinin okudugu TEK paylasilan nokta - onaylanmis
//          content_rule satirlarini doner. Hem worker'daki otomatik yol
//          (rankingPlanner.ts) hem manuel/Claude-yazimi is akisi (script.json
//          elle yazilirken bu fonksiyon/route okunur) AYNI veriyi gorur.
//          Kural onaylandikca/reddedildikce kod DEGISMEZ, sadece DB satiri
//          degisir - "yeniden kodlamadan uretime yansit" gereksiniminin cevabi.
// Dependencies: core/db
// Author: BestMarketer Team
// Last Modified: 2026-09-05
// =====================================

import { getDb } from '../core/db.js';

export interface ActiveRule {
  category: string;
  ruleText: string;
  rationale: string;
}

interface ContentRuleRow {
  category: string;
  rule_text: string;
  rationale: string;
}

/**
 * Bir kanalin ONAYLANMIS (status='approved') tüm kurallarini eskiden-yeniye
 * sirayla doner. Reddedilmis/onay-bekleyen kurallar asla dönmez.
 *
 * @param channelId Panelin `channel.id` degeri
 */
export function getActiveRules(channelId: string): ActiveRule[] {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT category, rule_text, rationale FROM content_rule WHERE channel_id = ? AND status = 'approved' ORDER BY created_at ASC",
    )
    .all(channelId) as ContentRuleRow[];

  return rows.map((r) => ({ category: r.category, ruleText: r.rule_text, rationale: r.rationale }));
}
