FROM eclipse-temurin:17-jre
WORKDIR /app
COPY certificate-system/certificate-system/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-Xmx384m", "-Xms256m", "-jar", "app.jar"]
