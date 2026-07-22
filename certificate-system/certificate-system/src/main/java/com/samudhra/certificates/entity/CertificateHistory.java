package com.samudhra.certificates.entity;
import jakarta.persistence.*;
@Entity @Table(name="certificate_history", indexes=@Index(columnList="certificate_id")) public class CertificateHistory extends BaseEntity {
  @ManyToOne(fetch=FetchType.LAZY,optional=false) private Certificate certificate; @ManyToOne(fetch=FetchType.LAZY) private User actor; @Column(nullable=false) private String action; @Lob @Column(columnDefinition="LONGTEXT") private String details;
  public Certificate getCertificate(){return certificate;} public void setCertificate(Certificate v){certificate=v;} public User getActor(){return actor;} public void setActor(User v){actor=v;} public String getAction(){return action;} public void setAction(String v){action=v;} public String getDetails(){return details;} public void setDetails(String v){details=v;}
}
