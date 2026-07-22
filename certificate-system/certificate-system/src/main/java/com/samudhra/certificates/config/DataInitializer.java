package com.samudhra.certificates.config;

import com.samudhra.certificates.entity.*;
import com.samudhra.certificates.repository.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class DataInitializer {

    @Bean
    public CommandLineRunner seed(
            OrganizationRepository organizations,
            UserRepository users,
            AdminRepository admins,
            PasswordEncoder passwords
    ) {
        return args -> {
            if (admins.findByEmail("admin@samudhratechsolutions.com").isEmpty()) {
                Admin admin = new Admin();
                admin.setName("Admin");
                admin.setEmail("admin@samudhratechsolutions.com");
                admin.setPassword(passwords.encode("admin123"));
                admins.save(admin);
            }
            if (users.findByEmail("admin@samudhratechsolutions.com").isEmpty()) {
                Organization org = organizations.findAll().stream().findFirst().orElseGet(() -> {
                    Organization newOrg = new Organization();
                    newOrg.setName("Samudhra Tech Solutions");
                    return organizations.save(newOrg);
                });
                User user = new User();
                user.setName("Admin");
                user.setEmail("admin@samudhratechsolutions.com");
                user.setRole("ADMIN");
                user.setPasswordHash(passwords.encode("admin123"));
                user.setOrganization(org);
                users.save(user);
            }
        };
    }

    @Bean
    public CommandLineRunner seedDummyData(
            StudentRepository students,
            CertificateRepository certificates,
            OrganizationRepository organizations
    ) {
        return args -> {
            if (students.count() == 0 && certificates.count() == 0) {
                Organization org = organizations.findAll().stream().findFirst().orElseGet(() -> {
                    Organization newOrg = new Organization();
                    newOrg.setName("Samudhra Tech Solutions");
                    return organizations.save(newOrg);
                });

                Student s1 = new Student();
                s1.setName("Muzan");
                s1.setEmail("muzan@gmail.com");
                s1.setCourse("Computer Science");
                s1.setRegisterNumber("REG001");
                s1.setOrganization(org);
                s1 = students.save(s1);

                Certificate c1 = new Certificate();
                c1.setCertificateNumber("CERT101");
                c1.setStudent(s1);
                c1.setOrganization(org);
                c1.setIssueDate(java.time.LocalDate.now());
                certificates.save(c1);

                System.out.println("[DataInitializer] Successfully populated database with dummy student and certificate records.");
            }
        };
    }
}
