#Requires -RunAsAdministrator
<#
  Smart Assess Ja - Kiosk Setup

  Locks ONE Windows machine down to auto-login into a dedicated local
  account that runs only the Smart Assess desktop app in full screen,
  with no taskbar, Start menu, or desktop reachable. Nothing else on the
  machine (other accounts, other apps) is touched.

  This is NOT part of the regular Smart Assess installer and is NOT for
  teacher/student/general-use machines. Only run this on hardware a
  school has permanently dedicated to being an exam kiosk.

  Requirements:
    - Windows 10/11 Enterprise, Education, or IoT Enterprise
      (Shell Launcher is not available on Pro or Home editions)
    - Smart Assess already installed for the kiosk account (see step 3
      below if it isn't yet)
    - Run in an elevated PowerShell window (Run as Administrator)

  Usage:
    .\setup-kiosk.ps1
    .\setup-kiosk.ps1 -AccountName ExamKiosk -Force
#>

[CmdletBinding()]
param(
  # Local account that will be locked into kiosk mode. Created if it
  # doesn't already exist.
  [string]$AccountName = "ExamKiosk",

  # Password for the kiosk account. Windows' built-in auto-login
  # (AutoAdminLogon) stores this in the registry in a reversibly
  # encrypted form, not fully in the clear, but it is still readable by
  # anyone with local admin rights on the machine. That's an inherent
  # limitation of AutoAdminLogon, not something this script can avoid -
  # it's the tradeoff for a kiosk machine nobody should be logging into
  # by hand anyway. If omitted, you'll be prompted securely.
  [SecureString]$Password,

  # Override if Smart Assess isn't at the expected per-user install path.
  [string]$AppPath,

  # Skip the confirmation prompt (for scripted/unattended deployment).
  [switch]$Force
)

$ErrorActionPreference = "Stop"

function Write-Step($text) {
  Write-Host ""
  Write-Host "==> $text" -ForegroundColor Cyan
}

function Write-Ok($text) {
  Write-Host "    $text" -ForegroundColor Green
}

function Write-Warn2($text) {
  Write-Host "    $text" -ForegroundColor Yellow
}

# --- Sanity checks -----------------------------------------------------

$edition = (Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion").EditionID
if ($edition -notmatch "Enterprise|Education|IoTEnterprise") {
  Write-Warn2 "Windows edition detected: $edition"
  Write-Warn2 "Shell Launcher requires Enterprise, Education, or IoT Enterprise."
  Write-Warn2 "It will likely fail to enable on this machine. Continuing anyway in case this check is wrong for your build - stop now (Ctrl+C) if you're not sure."
}

if (-not $AppPath) {
  $AppPath = "C:\Users\$AccountName\AppData\Local\Programs\Smart Assess\Smart Assess.exe"
}

if (-not $Password) {
  $Password = Read-Host -AsSecureString "Set a password for the '$AccountName' kiosk account"
}
$plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password)
)

Write-Host ""
Write-Host "Smart Assess Ja - Kiosk Setup" -ForegroundColor White
Write-Host "This will, on THIS machine only:" -ForegroundColor White
Write-Host "  1. Enable the Windows Shell Launcher feature"
Write-Host "  2. Create (or reuse) a local account named '$AccountName'"
Write-Host "  3. Lock that account's shell to Smart Assess (no desktop, no taskbar)"
Write-Host "  4. Set that account to auto-login on boot"
Write-Host "Other accounts on this machine are not affected."
Write-Host ""

if (-not $Force) {
  $confirm = Read-Host "Type YES to proceed"
  if ($confirm -ne "YES") {
    Write-Host "Cancelled. No changes made." -ForegroundColor Yellow
    exit 0
  }
}

# --- Step 1: Enable Shell Launcher --------------------------------------

Write-Step "Enabling Shell Launcher feature"
$feature = Get-WindowsOptionalFeature -Online -FeatureName Client-EmbeddedShellLauncher
if ($feature.State -eq "Enabled") {
  Write-Ok "Already enabled."
} else {
  Enable-WindowsOptionalFeature -Online -FeatureName Client-EmbeddedShellLauncher -All -NoRestart | Out-Null
  Write-Ok "Enabled. A restart will be needed before it takes effect (see end of script)."
}

# --- Step 2: Create the kiosk account -----------------------------------

Write-Step "Setting up local account '$AccountName'"
$existingUser = Get-LocalUser -Name $AccountName -ErrorAction SilentlyContinue
if ($existingUser) {
  Write-Ok "Account already exists - updating its password."
  Set-LocalUser -Name $AccountName -Password $Password
} else {
  New-LocalUser -Name $AccountName -Password $Password -PasswordNeverExpires -UserMayNotChangePassword | Out-Null
  Add-LocalGroupMember -Group "Users" -Member $AccountName
  Write-Ok "Created account and added it to the local Users group."
}

# --- Step 3: Confirm Smart Assess is installed for this account --------

Write-Step "Checking for Smart Assess at: $AppPath"
if (-not (Test-Path $AppPath)) {
  Write-Warn2 "Smart Assess isn't installed yet for '$AccountName'."
  Write-Warn2 "Log in as '$AccountName' on this machine, install Smart Assess from"
  Write-Warn2 "smartassessja.com/download as you normally would, then log out and"
  Write-Warn2 "re-run this script - it will pick up from here without repeating the"
  Write-Warn2 "steps already done above."
  Write-Host ""
  Write-Host "Stopped before making shell/auto-login changes." -ForegroundColor Yellow
  exit 1
}
Write-Ok "Found."

# --- Step 4: Point Shell Launcher at Smart Assess -----------------------

Write-Step "Configuring Shell Launcher"
$sid = (New-Object System.Security.Principal.NTAccount($AccountName)).Translate([System.Security.Principal.SecurityIdentifier]).Value

# SetCustomShell/SetEnabled are static methods on the class itself, not
# on a per-SID instance - Get-WmiObject would return nothing for a SID
# that isn't configured yet, so this uses the [wmiclass] moniker instead.
$shellLauncherClass = [wmiclass]"\\$env:COMPUTERNAME\root\standardcimv2\embedded:WESL_UserSetting"
$shellLauncherClass.SetCustomShell(
  $sid,
  $AppPath,
  $null,
  $null,
  0  # 0 = restart the shell if it exits; a kiosk should never be able to fall back to the desktop
) | Out-Null
$shellLauncherClass.SetEnabled($true) | Out-Null
Write-Ok "Shell Launcher will now start Smart Assess for '$AccountName' instead of Explorer."

# --- Step 5: Auto-login ---------------------------------------------------

Write-Step "Enabling auto-login for '$AccountName'"
$winlogonPath = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon"
Set-ItemProperty -Path $winlogonPath -Name "AutoAdminLogon" -Value "1"
Set-ItemProperty -Path $winlogonPath -Name "DefaultUserName" -Value $AccountName
Set-ItemProperty -Path $winlogonPath -Name "DefaultPassword" -Value $plainPassword
Set-ItemProperty -Path $winlogonPath -Name "DefaultDomainName" -Value $env:COMPUTERNAME
Write-Ok "Configured."

$plainPassword = $null

# --- Done ------------------------------------------------------------------

Write-Host ""
Write-Host "Kiosk setup complete." -ForegroundColor Green
Write-Host "Restart this machine to test: it should boot straight into Smart Assess" -ForegroundColor White
Write-Host "as '$AccountName', full screen, with no way to reach the desktop." -ForegroundColor White
Write-Host ""
Write-Host "To undo: sign in as an admin account, run 'Disable-WindowsOptionalFeature" -ForegroundColor DarkGray
Write-Host "-Online -FeatureName Client-EmbeddedShellLauncher', clear the Winlogon" -ForegroundColor DarkGray
Write-Host "AutoAdminLogon value above, and delete the '$AccountName' account if no" -ForegroundColor DarkGray
Write-Host "longer needed." -ForegroundColor DarkGray
