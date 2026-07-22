# Upgrade Plan: certificate-system (20260716055642)

- **Generated**: 2026-07-16 05:56:42
- **HEAD Branch**: N/A
- **HEAD Commit ID**: N/A

## Available Tools

**JDKs**
- JDK 26.0.1: C:\Program Files\Java\jdk-26.0.1\bin (available for verification)
- JDK 21: not available (baseline will be skipped)

**Build Tools**
- Maven Wrapper: .\mvnw.cmd (used for verification)

## Guidelines

- Upgrade the application runtime to the latest LTS Java version available in the environment.
- Keep the change minimal and preserve existing application behavior.
- Use the Maven wrapper for build verification.

> Note: You can add any specific guidelines or constraints for the upgrade process here if needed, bullet points are preferred.

## Options

- Working branch: appmod/java-upgrade-20260716055642
- Run tests before and after the upgrade: true

## Upgrade Goals

- Java 25

## Technology Stack

| Technology/Dependency | Current | Min Compatible Version | Why Incompatible |
| ---------------------- | ------- | ---------------------- | ---------------- |
| Java | 21 | 25 | User requested |
| Spring Boot | 3.4.3 | 3.4.3 | Current version is compatible with the target runtime |
| Maven Wrapper | 3.9.4 | 3.9.4 | Already suitable for the target runtime |

## Derived Upgrades

- Update the project Java target property to 25.
- Align runtime image references to a Java 25-compatible build/runtime image.

## Impact Analysis

### Dependency Changes

| File | Dependency | Current | Action | Target | Reason |
| ---- | ---------- | ------- | ------ | ------ | ------ |
| pom.xml | java.version | 21 | upgrade | 25 | User requested |
| docker-compose.yml | Maven runtime image | maven:3.9.4-jdk-17 | upgrade | maven:3.9.4-eclipse-temurin-25 | Align runtime image with the upgraded Java version |

### Source Code Changes

| File | Location | Current | Required Change | Reason |
| ---- | -------- | ------- | --------------- | ------ |
| None expected | - | - | - | The codebase is already compatible with the current Spring Boot line |

### Configuration Changes

| File | Property/Setting | Current | Required Change | Reason |
| ---- | ---------------- | ------- | --------------- | ------ |
| README.md | Java prerequisite | JDK 21 | update | Runtime documentation drift |

### CI/CD Changes

| File | Location | Current | Required Change |
| ---- | -------- | ------- | --------------- |
| docker-compose.yml | app image | maven:3.9.4-jdk-17 | change to a Java 25 image |

### Risks & Warnings

- The environment provides JDK 26 rather than JDK 25, so verification will use the available toolchain and the project target will be set to 25.

## Upgrade Steps

- Step 1: Update Java target and runtime references
  - **Rationale**: The project is already on a modern Spring Boot release, so the main change is aligning the Java target and runtime images to the requested LTS version.
  - **Changes to Make**: Apply the dependency and configuration changes from Impact Analysis.
  - **Verification**: Run the Maven wrapper compile/test commands with the available JDK.

- Step 2: Validate build and tests
  - **Rationale**: A runtime change should be verified by a full Maven test pass.
  - **Changes to Make**: Resolve any build or test issues introduced by the Java version change.
  - **Verification**: Run mvn clean test with the Maven wrapper.

- Step 3: Final validation and summary
  - **Rationale**: Confirm the project builds and tests successfully on the upgraded Java target.
  - **Changes to Make**: Capture the final verification details in the progress and summary files.
  - **Verification**: Re-run the full Maven test suite and review the results.
