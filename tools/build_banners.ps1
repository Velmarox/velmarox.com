# Renders every art/banners/<slug>.html to a 1600x900 JPG with headless Edge.
# Usage: powershell -File tools/build_banners.ps1            (writes art/banners/out/<slug>.jpg)
# Then copy each one to its post folder as cover.jpg and set `cover` in docs/js/data/posts.js.
$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root 'art\banners'
$out = Join-Path $src 'out'
New-Item -ItemType Directory -Force $out | Out-Null
$edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
          "$env:ProgramFiles\Google\Chrome\Application\chrome.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { throw 'No Edge or Chrome found.' }
Add-Type -AssemblyName System.Drawing
$jpeg = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$q = New-Object System.Drawing.Imaging.EncoderParameters 1
$q.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality, [long]88)
foreach ($f in Get-ChildItem $src -Filter *.html) {
  $png = Join-Path $out ($f.BaseName + '.png')
  $jpg = Join-Path $out ($f.BaseName + '.jpg')
  $url = 'file:///' + ($f.FullName -replace '\\', '/')
  $p = Start-Process $edge -ArgumentList @('--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    '--window-size=1600,900', '--virtual-time-budget=6000', "--screenshot=`"$png`"", "`"$url`"") -PassThru -WindowStyle Hidden
  $p.WaitForExit(40000) | Out-Null
  if (-not (Test-Path $png)) { Write-Warning "no screenshot for $($f.Name)"; continue }
  $img = [System.Drawing.Image]::FromFile($png)
  $img.Save($jpg, $jpeg, $q)
  $size = "$($img.Width)x$($img.Height)"
  $img.Dispose()
  Remove-Item $png
  "$($f.BaseName).jpg  $size  $([math]::Round((Get-Item $jpg).Length / 1kb)) KB"
}
