package com.samudhra.certificates.controller;

import com.samudhra.certificates.entity.*;
import com.samudhra.certificates.repository.*;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;

@RestController
@RequestMapping("/api/seed")
public class SeedController {

    private final StudentRepository students;
    private final CertificateRepository certificates;
    private final OrganizationRepository organizations;

    public SeedController(StudentRepository s, CertificateRepository c, OrganizationRepository o) {
        this.students = s;
        this.certificates = c;
        this.organizations = o;
    }

    @GetMapping
    public String seed() {
        Organization org = organizations.findAll().stream().findFirst().orElseGet(() -> {
            Organization newOrg = new Organization();
            newOrg.setName("Samudhra Tech Solutions");
            return organizations.save(newOrg);
        });

        // Recreate Certificate to ensure it's clean and linked properly
        certificates.findByCertificateNumber("CERT101").ifPresent(certificates::delete);

        Student s1 = students.findAll().stream()
                .filter(s -> "Muzan".equals(s.getName()))
                .findFirst()
                .orElseGet(() -> {
                    Student s = new Student();
                    s.setName("Muzan");
                    s.setEmail("muzan@gmail.com");
                    s.setCourse("Computer Science");
                    s.setRegisterNumber("REG001");
                    s.setOrganization(org);
                    return students.save(s);
                });

        Certificate c1 = new Certificate();
        c1.setCertificateNumber("CERT101");
        c1.setStudent(s1);
        c1.setOrganization(org);
        c1.setIssueDate(LocalDate.now());
        certificates.save(c1);

        return "Seeding successful! Student (Muzan) and Certificate (CERT101) inserted.";
    }
}
