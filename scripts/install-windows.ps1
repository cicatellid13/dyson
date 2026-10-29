#requires -Version 5.1
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$repo = 'cicatellid13/dyson'
$workRoot = Join-Path $env:LOCALAPPDATA ('DSP-Toolkit-Setup\' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $workRoot -Force | Out-Null
$logPath = Join-Path $workRoot 'setup.log'
Start-Transcript -Path $logPath | Out-Null
$oldPath = $env:PATH
$oldSigning = $env:CSC_IDENTITY_AUTO_DISCOVERY
$oldLocation = Get-Location

function Download-File([string]$Url, [string]$Destination, [hashtable]$Headers = @{}) {
    Invoke-WebRequest -UseBasicParsing -Uri $Url -OutFile $Destination -Headers $Headers
}
function Verify-File([string]$File, [string]$Checksums, [string]$Name) {
    $line = @($Checksums -split "`n" | Where-Object { $_.Trim() -match ('\s+\*?' + [Regex]::Escape($Name) + '$') })
    if ($line.Count -ne 1) { throw "No unique checksum found for $Name." }
    $expected = ($line[0].Trim() -split '\s+')[0]
    if ((Get-FileHash -Algorithm SHA256 -Path $File).Hash -ne $expected) { throw "Checksum verification failed for $Name." }
}
function Run-Checked([string]$Exe, [string[]]$Arguments) {
    & $Exe @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Exe failed (exit $LASTEXITCODE). See $logPath" }
}

try {
    if ($env:OS -ne 'Windows_NT') { throw 'Run this script on Windows.' }
    $osArch = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
    if ($osArch -notin @('AMD64', 'ARM64')) { throw 'A 64-bit Windows PC is required.' }
    $nodeArch = if ($osArch -eq 'ARM64') { 'arm64' } else { 'x64' }
    $ghArch = if ($osArch -eq 'ARM64') { 'arm64' } else { 'amd64' }

    Write-Host 'Preparing Node.js (private build tools; no system installation needed)...'
    $nodeBase = 'https://nodejs.org/dist/latest-v22.x/'
    $checksums = (Invoke-WebRequest -UseBasicParsing -Uri ($nodeBase + 'SHASUMS256.txt')).Content
    $nodePattern = 'node-v22\.[0-9]+\.[0-9]+-win-' + $nodeArch + '\.zip'
    $nodeName = [Regex]::Match($checksums, $nodePattern).Value
    if (-not $nodeName) { throw 'Could not find the official Node.js Windows download.' }
    $nodeZip = Join-Path $workRoot $nodeName
    Download-File ($nodeBase + $nodeName) $nodeZip
    Verify-File $nodeZip $checksums $nodeName
    Expand-Archive -Path $nodeZip -DestinationPath $workRoot
    $nodeDir = Join-Path $workRoot ([IO.Path]::GetFileNameWithoutExtension($nodeName))
    $env:PATH = $nodeDir + ';' + $env:PATH
    $npm = Join-Path $nodeDir 'npm.cmd'

    # If run from a downloaded repository ZIP, use that source without GitHub login.
    $localSource = if ($PSScriptRoot) { Split-Path -Parent $PSScriptRoot } else { '' }
    if ($localSource -and (Test-Path (Join-Path $localSource 'package.json')) -and (Test-Path (Join-Path $localSource 'src\App.tsx'))) {
        $source = $localSource
        Write-Host "Using source from $source"
    } else {
        Write-Host 'Downloading your private GitHub repository...'
        $ghCommand = Get-Command gh.exe -ErrorAction SilentlyContinue
        if ($ghCommand) { $gh = $ghCommand.Source } else {
            $release = Invoke-RestMethod -Uri 'https://api.github.com/repos/cli/cli/releases/latest'
            $asset = $release.assets | Where-Object { $_.name -match ('windows_' + $ghArch + '\.zip$') } | Select-Object -First 1
            $sumAsset = $release.assets | Where-Object { $_.name -match 'checksums\.txt$' } | Select-Object -First 1
            if (-not $asset -or -not $sumAsset) { throw 'Could not locate the official GitHub CLI download.' }
            $ghZip = Join-Path $workRoot $asset.name
            Download-File $asset.browser_download_url $ghZip
            $ghSums = (Invoke-WebRequest -UseBasicParsing -Uri $sumAsset.browser_download_url).Content
            Verify-File $ghZip $ghSums $asset.name
            $ghDir = Join-Path $workRoot 'github-cli'
            Expand-Archive -Path $ghZip -DestinationPath $ghDir
            $gh = (Get-ChildItem -Path $ghDir -Filter gh.exe -Recurse | Select-Object -First 1).FullName
            if (-not $gh) { throw 'GitHub CLI executable not found.' }
        }
        $savedPreference = $ErrorActionPreference
        try {
            $ErrorActionPreference = 'Continue'
            & $gh auth status --hostname github.com *> $null
            $needsLogin = $LASTEXITCODE -ne 0
        } finally { $ErrorActionPreference = $savedPreference }
        if ($needsLogin) {
            Write-Host 'Sign in using the GitHub account that can access cicatellid13/dyson.'
            Run-Checked $gh @('auth', 'login', '--hostname', 'github.com', '--web', '--git-protocol', 'https')
        }
        # Capture credentials without printing them or including them in command arguments.
        $token = & $gh auth token --hostname github.com
        if ($LASTEXITCODE -ne 0 -or -not $token) { throw 'Unable to authenticate to GitHub.' }
        $sourceZip = Join-Path $workRoot 'source.zip'
        try {
            Download-File "https://api.github.com/repos/$repo/zipball/main" $sourceZip @{ Authorization = "Bearer $token"; Accept = 'application/vnd.github+json' }
        } finally { $token = $null }
        $sourceRoot = Join-Path $workRoot 'source'
        Expand-Archive -Path $sourceZip -DestinationPath $sourceRoot
        $source = (Get-ChildItem -Path $sourceRoot -Directory | Select-Object -First 1).FullName
    }

    Set-Location $source
    Write-Host 'Installing dependencies...'
    Run-Checked $npm @('ci', '--no-audit', '--no-fund')
    Write-Host 'Checking and building DSP Toolkit. This may take several minutes...'
    $env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
    Run-Checked $npm @('run', 'build', '--', '--win', "--$nodeArch", '--publish', 'never')
    $installer = Join-Path $source 'release\DSP-Toolkit-Setup.exe'
    if (-not (Test-Path $installer)) { throw 'The build completed but the installer was not found.' }
    $configDir = Join-Path $env:APPDATA 'dsp-wiki-desktop'
    New-Item -ItemType Directory -Path $configDir -Force | Out-Null
    $configPath = Join-Path $configDir '.env'
    if (-not (Test-Path $configPath)) {
        # Secure input is not echoed or written to the setup transcript.
        $secureUri = Read-Host 'Paste your MongoDB connection string (hidden)' -AsSecureString
        $uriPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureUri)
        try {
            $mongoUri = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($uriPointer)
            if ($mongoUri -notmatch '^mongodb(\+srv)?://' -or $mongoUri -match '[\r\n]') { throw 'A valid single-line MongoDB connection string is required.' }
            [IO.File]::WriteAllText($configPath, "MONGODB_URI=$mongoUri`nMONGODB_DATABASE=dsp_fieldguide`n", (New-Object Text.UTF8Encoding($false)))
            $acl = Get-Acl $configPath
            $acl.SetAccessRuleProtection($true, $false)
            $rule = New-Object Security.AccessControl.FileSystemAccessRule([Security.Principal.WindowsIdentity]::GetCurrent().Name, 'FullControl', 'Allow')
            $acl.SetAccessRule($rule)
            Set-Acl -Path $configPath -AclObject $acl
        } finally {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($uriPointer)
            $mongoUri = $null; $secureUri = $null
        }
    }
    Write-Host 'Installing DSP Toolkit for your Windows account...'
    $installProcess = Start-Process -FilePath $installer -ArgumentList '/S' -Wait -PassThru
    if ($installProcess.ExitCode -ne 0) { throw "Installer failed (exit $($installProcess.ExitCode))." }
    Write-Host 'Installed! Open DSP Toolkit from the Start menu.'
    Write-Host "Installer: $installer"
    Write-Host 'Planets, systems and favorites sync through MongoDB. Offline changes are cached on this device.'
} catch {
    Write-Host "Setup failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Log and build files: $workRoot"
    exit 1
} finally {
    Set-Location $oldLocation
    $env:PATH = $oldPath
    $env:CSC_IDENTITY_AUTO_DISCOVERY = $oldSigning
    Stop-Transcript | Out-Null
}
