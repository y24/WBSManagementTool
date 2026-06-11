<#
.SYNOPSIS
    WBS管理ツール → Azure DevOps 同期スクリプト（dry_run / 動作確認用）

.DESCRIPTION
    POST /api/integrations/azure-devops/sync?dry_run=true を呼び出します。
    Azure DevOps への書き込みは一切行わず、同期対象と差分のみ確認できます。
    本番実行前のフィールドマッピング確認・チケットID確認・差分確認にご利用ください。

    事前準備（Windows ユーザー環境変数）:
      WBS_SYNC_TOKEN  ... 同期APIの認証トークン

.PARAMETER BaseUrl
    バックエンドサーバーのベースURL
    既定値: http://localhost:8000

.EXAMPLE
    .\sync_azure_devops_dry_run.ps1
    .\sync_azure_devops_dry_run.ps1 -BaseUrl http://192.168.1.10:8000
#>
[CmdletBinding()]
param(
    [string]$BaseUrl = "http://localhost:8000"
)

$ErrorActionPreference = "Stop"
$timestamp = { "[$(Get-Date -Format 'yyyy/MM/dd HH:mm:ss')]" }

Write-Host "$(& $timestamp) Azure DevOps 同期 (dry_run) を開始します (BaseUrl=$BaseUrl)" -ForegroundColor Cyan
Write-Host "        ※ Azure DevOps への書き込みは行いません" -ForegroundColor DarkCyan

# --- トークン確認 ---
if (-not $env:WBS_SYNC_TOKEN) {
    Write-Host "$(& $timestamp) [ERROR] 環境変数 WBS_SYNC_TOKEN が設定されていません。" -ForegroundColor Red
    Write-Host "        システムのプロパティ → 環境変数 → ユーザー環境変数で設定してください。" -ForegroundColor Red
    exit 1
}

# --- API 呼び出し ---
$uri     = "$BaseUrl/api/integrations/azure-devops/sync?dry_run=true"
$headers = @{ "X-Sync-Token" = $env:WBS_SYNC_TOKEN }

try {
    $res = Invoke-RestMethod `
        -Method POST `
        -Uri $uri `
        -Headers $headers `
        -ContentType "application/json"

    # --- 結果表示 ---
    Write-Host ""
    Write-Host "  status                : $($res.status)" -ForegroundColor Cyan
    Write-Host "  job_id                : $($res.job_id)"
    Write-Host "  candidates            : $($res.summary.candidates)"
    Write-Host "  invalid_ticket_id     : $($res.summary.invalid_ticket_id)" -ForegroundColor $(if ($res.summary.invalid_ticket_id -gt 0) { "Yellow" } else { "White" })
    Write-Host "  skipped_no_change     : $($res.summary.skipped_no_local_change)"
    Write-Host "  fetch_targets         : $($res.summary.fetch_targets)"
    Write-Host "  would_update          : $($res.summary.updated)" -ForegroundColor $(if ($res.summary.updated -gt 0) { "Cyan" } else { "White" })
    Write-Host "  skipped_same_value    : $($res.summary.skipped_same_remote_value)"
    Write-Host "  failed                : $($res.summary.failed)" -ForegroundColor $(if ($res.summary.failed -gt 0) { "Red" } else { "White" })
    if ($res.summary.field_updates) {
        Write-Host "  field_updates         :" -ForegroundColor Cyan
        $res.summary.field_updates.PSObject.Properties |
            Sort-Object Name |
            ForEach-Object {
                Write-Host "    $($_.Name) : $($_.Value)" -ForegroundColor Cyan
            }
    }
    Write-Host ""

    if ($res.errors.Count -gt 0) {
        Write-Host "  [WARN] エラー・警告あり:" -ForegroundColor Yellow
        foreach ($err in $res.errors) {
            $loc = if ($err.entity_type) { "[$($err.entity_type) id=$($err.entity_id) ticket=$($err.ticket_id)]" } else { "[global]" }
            Write-Host "    $loc $($err.message)" -ForegroundColor Yellow
        }
        Write-Host ""
    }

    Write-Host "$(& $timestamp) dry_run が完了しました（Azure DevOps への変更はありません）" -ForegroundColor Cyan
    exit 0
}
catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "$(& $timestamp) [ERROR] dry_run に失敗しました (HTTP $statusCode)" -ForegroundColor Red
    Write-Host "        $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
