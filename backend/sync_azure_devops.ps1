<#
.SYNOPSIS
    WBS管理ツール → Azure DevOps 同期スクリプト（本番実行）

.DESCRIPTION
    POST /api/integrations/azure-devops/sync を呼び出し、
    WBS管理ツールの日付情報（開始予定日・終了予定日・開始日・終了日）を
    Azure DevOps Work Item に反映します。

    事前準備（Windows ユーザー環境変数）:
      WBS_SYNC_TOKEN  ... 同期APIの認証トークン

.PARAMETER BaseUrl
    バックエンドサーバーのベースURL
    既定値: http://localhost:8000

.EXAMPLE
    .\sync_azure_devops.ps1
    .\sync_azure_devops.ps1 -BaseUrl http://192.168.1.10:8000
#>
[CmdletBinding()]
param(
    [string]$BaseUrl = "http://localhost:8000"
)

$ErrorActionPreference = "Stop"
$timestamp = { "[$(Get-Date -Format 'yyyy/MM/dd HH:mm:ss')]" }

Write-Host "$(& $timestamp) Azure DevOps 同期を開始します (BaseUrl=$BaseUrl)" -ForegroundColor Cyan

# --- トークン確認 ---
if (-not $env:WBS_SYNC_TOKEN) {
    Write-Host "$(& $timestamp) [ERROR] 環境変数 WBS_SYNC_TOKEN が設定されていません。" -ForegroundColor Red
    Write-Host "        システムのプロパティ → 環境変数 → ユーザー環境変数で設定してください。" -ForegroundColor Red
    exit 1
}

# --- API 呼び出し ---
$uri     = "$BaseUrl/api/integrations/azure-devops/sync"
$headers = @{ "X-Sync-Token" = $env:WBS_SYNC_TOKEN }

try {
    $res = Invoke-RestMethod `
        -Method POST `
        -Uri $uri `
        -Headers $headers `
        -ContentType "application/json"

    # --- 結果表示 ---
    $statusColor = if ($res.status -eq "success") { "Green" } `
                   elseif ($res.status -eq "partial_success") { "Yellow" } `
                   else { "Red" }

    Write-Host ""
    Write-Host "  status                : $($res.status)" -ForegroundColor $statusColor
    Write-Host "  job_id                : $($res.job_id)"
    Write-Host "  candidates            : $($res.summary.candidates)"
    Write-Host "  invalid_ticket_id     : $($res.summary.invalid_ticket_id)"
    Write-Host "  skipped_no_change     : $($res.summary.skipped_no_local_change)"
    Write-Host "  fetch_targets         : $($res.summary.fetch_targets)"
    Write-Host "  skipped_same_value    : $($res.summary.skipped_same_remote_value)"
    Write-Host "  updated               : $($res.summary.updated)" -ForegroundColor $(if ($res.summary.updated -gt 0) { "Green" } else { "White" })
    Write-Host "  failed                : $($res.summary.failed)" -ForegroundColor $(if ($res.summary.failed -gt 0) { "Red" } else { "White" })
    if ($res.summary.field_updates) {
        Write-Host "  field_updates         :" -ForegroundColor Green
        $res.summary.field_updates.PSObject.Properties |
            Sort-Object Name |
            ForEach-Object {
                Write-Host "    $($_.Name) : $($_.Value)" -ForegroundColor Green
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

    Write-Host "$(& $timestamp) 同期が完了しました" -ForegroundColor Cyan
    exit 0
}
catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "$(& $timestamp) [ERROR] 同期に失敗しました (HTTP $statusCode)" -ForegroundColor Red
    Write-Host "        $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
