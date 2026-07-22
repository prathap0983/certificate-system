FROM eclipse-temurin:17-jdk-alpine
WORKDIR /app
COPY certificate-system/certificate-system /app
RUN ./mvnw clean package -DskipTests
EXPOSE 8080
CMD ["java", "-jar", "target/certificate-system-0.0.1-SNAPSHOT.jar"]
