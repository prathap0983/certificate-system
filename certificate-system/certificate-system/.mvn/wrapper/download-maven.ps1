param(
  [string]$version = "3.9.4"
)
$primary = "https://downloads.apache.org/maven/maven-3/$version/binaries/apache-maven-$version-bin.zip"
$archive = "https://archive.apache.org/dist/maven/maven-3/$version/binaries/apache-maven-$version-bin.zip"
$zip = ".mvn\\wrapper\\apache-maven.zip"
New-Item -ItemType Directory -Force -Path '.mvn\\wrapper' | Out-Null

function Download-And-Extract($url) {
  Write-Host "Trying: $url"
  try {
    Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing -ErrorAction Stop
    Write-Host "Downloaded to $zip"
    Expand-Archive -Path $zip -DestinationPath '.mvn\\wrapper' -Force
    Remove-Item $zip -Force
    return $true
  } catch {
    Write-Host ("Failed to download from " + $url + ": " + $_.Exception.Message)
    if (Test-Path $zip) { Remove-Item $zip -Force }
    return $false
  }
}

if (-not (Download-And-Extract $primary)) {
  Write-Host "Primary failed, trying archive mirror..."
  if (-not (Download-And-Extract $archive)) {
    Write-Error "Failed to download Apache Maven from both primary and archive URLs."
    exit 1
  }
}
