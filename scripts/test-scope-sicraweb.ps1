# Test: le credenziali Sicraweb del progetto timbrature (modulo Personale)
# valgono anche per un'API di un modulo diverso (Affari Generali)?
#
# Uso:
#   1) Imposta le 4 variabili SICRAWEB_* qui sotto (o via $env: prima di lanciare lo script)
#   2) Esegui: .\scripts\test-scope-sicraweb.ps1
#
# Non stampa mai la password. Il bearer token viene mostrato solo troncato.

$ErrorActionPreference = "Stop"

# --- Credenziali: valorizza queste 4 righe (o esporta le stesse variabili d'ambiente prima) ---
$SicrawebHost   = if ($env:SICRAWEB_HOST)     { $env:SICRAWEB_HOST }     else { "https://ENTE.sicraweb.maggioli.cloud" }
$SicrawebAlias  = if ($env:SICRAWEB_ALIAS)    { $env:SICRAWEB_ALIAS }    else { "" }
$SicrawebUser   = if ($env:SICRAWEB_USERNAME) { $env:SICRAWEB_USERNAME } else { "" }
$SicrawebPass   = if ($env:SICRAWEB_PASSWORD) { $env:SICRAWEB_PASSWORD } else { "" }

if (-not $SicrawebAlias -or -not $SicrawebUser -or -not $SicrawebPass) {
    Write-Host "Imposta SICRAWEB_ALIAS, SICRAWEB_USERNAME, SICRAWEB_PASSWORD (variabili d'ambiente o nello script) prima di eseguire." -ForegroundColor Yellow
    exit 1
}

Write-Host "== 1) Logon su $SicrawebHost (alias=$SicrawebAlias, user=$SicrawebUser) ==" -ForegroundColor Cyan

$logonBody = @{
    alias           = $SicrawebAlias
    username        = $SicrawebUser
    password        = $SicrawebPass
    tokenExpiration = 0
} | ConvertTo-Json

try {
    $logonResp = Invoke-RestMethod -Method Post `
        -Uri "$SicrawebHost/client/services/rest/infrastruttura/aut/v2/basic/logon" `
        -ContentType "application/json" `
        -Body $logonBody
} catch {
    Write-Host "Logon fallito: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
    exit 1
}

$token = $logonResp.bearerToken
Write-Host "Logon OK. Ente: $($logonResp.ente)  Utente: $($logonResp.utente)  Token: $($token.Substring(0, [Math]::Min(16,$token.Length)))..." -ForegroundColor Green

# --- 2) Chiamata di controllo sul modulo previsto: Personale (deve funzionare) ---
Write-Host "`n== 2) Controllo sul modulo Personale (atteso: 200) ==" -ForegroundColor Cyan
try {
    $oggi = Get-Date -Format "dd/MM/yyyy"
    $perResp = Invoke-WebRequest -Method Post `
        -Uri "$SicrawebHost/client/services/rest/personale/per/v1/export-presenze/timbrature/riepilogo" `
        -Headers @{ Authorization = "Bearer $token" } `
        -ContentType "application/json" `
        -Body (@{ codEnte = @($env:SICRAWEB_COD_ENTE); dtaDal = $oggi; dtaAl = $oggi; codiciFiscali=@(); codBadge=@(); codOrologio=@(); skip=0; take=1 } | ConvertTo-Json) `
        -SkipHttpErrorCheck
    Write-Host "Status: $($perResp.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "Errore inatteso: $($_.Exception.Message)" -ForegroundColor Red
}

# --- 3) Chiamata di prova su un'API di un modulo DIVERSO: Affari Generali (test di scope) ---
Write-Host "`n== 3) Test di scope: API Affari Generali / ricerche documentale (GET, sola lettura) ==" -ForegroundColor Cyan
$agUri = "https://CONDIVISA.sicraweb.maggioli.cloud/client/services/rest/affarigenerali/ric/v2/ric-mgmt/ricerche/documenti?filtro=test&numElementi=1"

try {
    $agResp = Invoke-WebRequest -Method Get -Uri $agUri `
        -Headers @{ Authorization = "Bearer $token" } `
        -SkipHttpErrorCheck
    Write-Host "Status: $($agResp.StatusCode)" -ForegroundColor Yellow
    Write-Host $agResp.Content
} catch {
    Write-Host "Errore inatteso: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nInterpretazione:" -ForegroundColor Cyan
Write-Host "  200            -> l'account ha accesso anche al modulo Affari Generali (scope PIU' ampio del previsto)"
Write-Host "  401            -> token non riconosciuto/non valido su questo endpoint"
Write-Host "  403            -> autenticato, ma l'account NON ha i permessi per questo modulo (scope limitato, come atteso)"
