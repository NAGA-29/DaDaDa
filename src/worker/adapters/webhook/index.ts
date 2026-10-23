import type { IncidentInput } from '../../domain/incident'

/**
 * Push 型 Source 用のハンドラ。MVP では登録なし。
 * 例: AWS Health → EventBridge → API Destination → POST /api/webhooks/aws-health
 */
export interface WebhookHandler {
  readonly source: string
  verify(request: Request, env: Record<string, unknown>): Promise<boolean>
  handle(payload: unknown, now: Date): Promise<IncidentInput[]>
}
