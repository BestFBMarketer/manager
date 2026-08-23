// =====================================
// MODULE: Stage Types
// Purpose: Worker stage'lerinin ortak dönüş sözleşmesi - review_item'a yazılacak veri
// Author: BestMarketer Team
// Last Modified: 2026-08-23
// =====================================

export interface JobRow {
  id: number;
  channel_id: string;
  template: string;
  source_ref: string;
  status: string;
  stage: string;
  error: string | null;
  created_at: string;
  updated_at: string;
  claimed_at: string | null;
  batch_id?: string;
}

/**
 * Her worker stage'i bir işi bitirdiğinde bunu döner. runQueue bunu
 * review_item satırına yazar - onay anında LLM tekrar çalışmaz (EK5).
 */
export interface StageResult {
  previewPath: string;
  proposedTitle: string;
  proposedDescription: string;
  proposedTags: string[];
  /**
   * writeVideoMetadata'ya verilen orijinal bağlam (subject/highlights/durationSec).
   * review_item.metadata_context_json'a yazılır ki "Yeniden Oluştur" butonu aynı
   * bağlamla LLM'i tekrar çağırabilsin - context olmadan regenerate anlamsız
   * (jenerik) bir sonuç üretirdi.
   */
  metadataContext: {
    subject: string;
    highlights: string[];
    durationSec: number;
  };
}
