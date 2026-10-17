$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$serverEnv = Join-Path $root 'server\.env'
$cloudflaredDirectory = Join-Path $env:LOCALAPPDATA 'SmartLeave\bin'
$cloudflaredPath = Join-Path $cloudflaredDirectory 'cloudflared.exe'
$tunnelProcess = $null

try {
    if (-not (Test-Path $serverEnv)) {
        throw 'server\.env is missing. Create it from server\.env.example and set a private SESSION_SECRET.'
    }
    $listener = Get-NetTCPConnection -State Listen -LocalPort 3001 -ErrorAction SilentlyContinue
    if ($listener) {
        throw 'Port 3001 is already in use. Stop the existing local API server, then run this script again.'
    }
    $mongo = Test-NetConnection -ComputerName 127.0.0.1 -Port 27017 -InformationLevel Quiet -WarningAction SilentlyContinue
    if (-not $mongo) {
        throw 'MongoDB is not listening on 127.0.0.1:27017. Start your local MongoDB service first.'
    }

    if (-not (Test-Path $cloudflaredPath)) {
        New-Item -ItemType Directory -Path $cloudflaredDirectory -Force | Out-Null
        Write-Output 'Downloading Cloudflare Tunnel from the official Cloudflare release...'
        Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile $cloudflaredPath
        $signature = Get-AuthenticodeSignature -FilePath $cloudflaredPath
        if ($signature.Status -ne 'Valid') {
            Remove-Item -LiteralPath $cloudflaredPath -Force
            throw 'Downloaded cloudflared.exe did not pass Windows signature verification.'
        }
    }

    $processInfo = New-Object System.Diagnostics.ProcessStartInfo
    $processInfo.FileName = $cloudflaredPath
    $processInfo.Arguments = 'tunnel --no-autoupdate --protocol http2 --url http://127.0.0.1:3001'
    $processInfo.UseShellExecute = $false
    $processInfo.CreateNoWindow = $true
    $processInfo.RedirectStandardOutput = $true
    $processInfo.RedirectStandardError = $true
    $tunnelProcess = New-Object System.Diagnostics.Process
    $tunnelProcess.StartInfo = $processInfo
    $null = $tunnelProcess.Start()
    $stdoutTask = $tunnelProcess.StandardOutput.ReadLineAsync()
    $stderrTask = $tunnelProcess.StandardError.ReadLineAsync()

    $publicUrl = $null
    $tunnelReady = $false
    $tunnelLogs = ''
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        if ($tunnelProcess.HasExited) {
            throw 'Cloudflare Tunnel exited before creating a public URL. Check your internet connection.'
        }
        if ($stdoutTask.IsCompleted) {
            $line = $stdoutTask.Result
            if ($null -ne $line) {
                $tunnelLogs += "$line`n"
                if ($line -match '(?i)registered tunnel connection') { $tunnelReady = $true }
                if ($line -match '(?i)(ERR|error|registered tunnel connection)') { Write-Output "Tunnel: $line" }
            }
            $stdoutTask = $tunnelProcess.StandardOutput.ReadLineAsync()
        }
        if ($stderrTask.IsCompleted) {
            $line = $stderrTask.Result
            if ($null -ne $line) {
                $tunnelLogs += "$line`n"
                if ($line -match '(?i)registered tunnel connection') { $tunnelReady = $true }
                if ($line -match '(?i)(ERR|error|registered tunnel connection)') { Write-Output "Tunnel: $line" }
            }
            $stderrTask = $tunnelProcess.StandardError.ReadLineAsync()
        }
        $match = [regex]::Match($tunnelLogs, 'https://[a-z0-9-]+\.trycloudflare\.com')
        if ($match.Success) { $publicUrl = $match.Value }
        if ($publicUrl -and $tunnelReady) { break }
        Start-Sleep -Seconds 1
    }
    if (-not $publicUrl) {
        throw 'Cloudflare Tunnel did not provide a temporary URL within 60 seconds.'
    }
    if (-not $tunnelReady) {
        throw 'Cloudflare Tunnel did not connect to the Cloudflare edge. Try another internet connection.'
    }

    Set-Location $root
    $env:NODE_ENV = 'production'
    $env:DEV_MODE = 'false'
    $env:HOSTED_ON_LAPTOP = 'true'
    $env:HOST = '127.0.0.1'
    $env:APP_ORIGIN = $publicUrl
    node -e "require('./server/config')()"
    if ($LASTEXITCODE -ne 0) {
        throw 'Production settings failed validation. Check SESSION_SECRET and MONGODB_URI in server\.env.'
    }

    Write-Output ''
    Write-Output "Smart Leave is available at $publicUrl"
    Write-Output 'Keep this window and your laptop running. Press Ctrl+C to stop the public site.'
    Write-Output 'The temporary URL changes when the tunnel is restarted.'
    npm.cmd start
}
finally {
    if ($tunnelProcess -and -not $tunnelProcess.HasExited) {
        Stop-Process -Id $tunnelProcess.Id
        $tunnelProcess.WaitForExit(10000) | Out-Null
    }
}
