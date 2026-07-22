@echo off
setlocal
set MAVEN_VERSION=3.9.4
set MAVEN_DIR=.mvn\wrapper\apache-maven-%MAVEN_VERSION%
if not exist "%MAVEN_DIR%\bin\mvn.cmd" (
  echo Maven not found, downloading Apache Maven %MAVEN_VERSION%...
  powershell -NoProfile -ExecutionPolicy Bypass -File ".mvn\wrapper\download-maven.ps1" %MAVEN_VERSION%
)
"%~dp0.mvn\wrapper\apache-maven-3.9.4\bin\mvn.cmd" %*
