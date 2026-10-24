# wrapped.sh for Windows without a POSIX shell (PowerShell 5.1 or 7). It shares
# wrapped.sh's install, so either one can run first. Uses the curl.exe and tar.exe
# that ship with Windows 10 and later. Set AGENT_WRAPPED_NO_UPDATE=1 to skip the check.
$ErrorActionPreference = "Stop"

$repo = "vkpdeveloper/agent-wrapped"
$dir = if ($env:AGENT_WRAPPED_HOME) { $env:AGENT_WRAPPED_HOME } else { Join-Path $HOME ".local/share/agent-wrapped" }
$bin = Join-Path $dir "agent-wrapped.exe"
$checked = Join-Path $dir ".last-update-check"

function Fail($message) {
  [Console]::Error.WriteLine("agent-wrapped: $message")
  exit 1
}

# Latest release version, from the redirect of /releases/latest (no API rate limit).
function Latest {
  $match = curl.exe -fsSI "https://github.com/$repo/releases/latest" | Select-String "^location:.*/releases/tag/v(\S+)"
  if ($match) { $match.Matches[0].Groups[1].Value }
}

function Install($version) {
  [Console]::Error.WriteLine("agent-wrapped: installing v$version for windows-x64")
  New-Item -ItemType Directory -Force $dir | Out-Null
  $tmp = Join-Path $dir ".install.$PID"
  New-Item -ItemType Directory -Force $tmp | Out-Null
  try {
    curl.exe -fsSL "https://github.com/$repo/releases/download/v$version/agent-wrapped-windows-x64.tar.gz" -o "$tmp/release.tar.gz"
    if ($LASTEXITCODE) { throw "download failed" }
    tar.exe -xzf "$tmp/release.tar.gz" -C $tmp
    if ($LASTEXITCODE) { throw "extract failed" }
    # Swap in only what the release ships, keeping node_modules/.remotion,
    # where the Chrome used for rendering is cached.
    foreach ($name in "agent-wrapped.exe", "site", "compositor", "package.json") {
      Remove-Item -Recurse -Force -ErrorAction SilentlyContinue (Join-Path $dir $name)
      Move-Item (Join-Path $tmp $name) (Join-Path $dir $name)
    }
  } finally {
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $tmp
  }
}

$now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
if (-not (Test-Path $bin)) {
  $version = Latest
  if (-not $version) { Fail "could not find the latest release on github.com/$repo" }
  try { Install $version } catch { Fail "install failed: $_" }
  Set-Content $checked $now
} elseif ($env:AGENT_WRAPPED_NO_UPDATE -ne "1") {
  $last = if (Test-Path $checked) { [long](Get-Content $checked -TotalCount 1) } else { 0 }
  if ($now - $last -ge 86400) {
    Set-Content $checked $now
    $version = Latest
    $current = & $bin --version
    if ($version -and [version]$version -gt [version]$current) {
      try { Install $version } catch { [Console]::Error.WriteLine("agent-wrapped: update to v$version failed, using v$current") }
    }
  }
}

& $bin @args
exit $LASTEXITCODE
