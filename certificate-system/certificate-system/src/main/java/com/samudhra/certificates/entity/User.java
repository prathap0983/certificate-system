package com.samudhra.certificates.entity;
import jakarta.persistence.*;
@Entity @Table(name="users", indexes=@Index(columnList="email", unique=true)) public class User extends BaseEntity {
  @Column(nullable=false, unique=true) private String email; @Column(nullable=false) private String passwordHash; @Column(nullable=false) private String name; @Column(nullable=false) private String role="ADMIN";
  @ManyToOne(fetch=FetchType.LAZY) private Organization organization;
  public String getEmail(){return email;} public void setEmail(String v){email=v;} public String getPasswordHash(){return passwordHash;} public void setPasswordHash(String v){passwordHash=v;} public String getName(){return name;} public void setName(String v){name=v;} public String getRole(){return role;} public void setRole(String v){role=v;} public Organization getOrganization(){return organization;} public void setOrganization(Organization v){organization=v;}
}
