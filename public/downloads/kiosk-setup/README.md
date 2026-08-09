# Smart Assess Ja — Kiosk Setup

A standalone tool for IT admins, **separate from the regular Smart Assess
download**. Everyone else — teachers, students, school/system admins
installing on their own computer — should keep using the normal
[Download Smart Assess](https://smartassessja.com/download) button. There
is only one app installer; this script does not replace or duplicate it.

Run this only on a Windows machine a school has permanently dedicated to
being an exam kiosk (e.g. a computer lab machine used for nothing else).
It locks that one machine so it boots straight into Smart Assess, full
screen, with no way to reach the Windows desktop, taskbar, or Start menu.

## Requirements

- Windows 10/11 **Enterprise, Education, or IoT Enterprise** (Shell
  Launcher, the underlying feature, isn't available on Pro or Home)
- Local administrator access on the machine
- The regular Smart Assess installer, downloaded separately

## Usage

1. On the target machine, open PowerShell **as Administrator**.
2. Run:
   ```powershell
   .\setup-kiosk.ps1
   ```
3. If Smart Assess isn't installed yet for the kiosk account, the script
   stops and tells you to log in as that account, install it normally,
   then re-run the script.
4. Restart the machine to test.

Optional parameters: `-AccountName` (default `ExamKiosk`), `-AppPath`
(override the expected install location), `-Force` (skip the
confirmation prompt for scripted deployment).

## Undoing it

Sign in with a different local administrator account, then:

```powershell
Disable-WindowsOptionalFeature -Online -FeatureName Client-EmbeddedShellLauncher
```

and clear the `AutoAdminLogon` value under
`HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon`. Delete the
kiosk account if it's no longer needed.

## What this does *not* do

- Does not touch any other account on the machine.
- Does not modify the regular Smart Assess installer or app.
- Does not provide macOS kiosk lockdown — macOS has no built-in
  equivalent to Shell Launcher; true lockdown there needs MDM (Jamf,
  Mosyle, etc.), which is a separate, ongoing cost.
