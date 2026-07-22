package com.samudhra.certificates.entity;
import jakarta.persistence.*;
@Entity @Table(name="organizations") public class Organization extends BaseEntity {
  @Column(nullable=false) private String name; private String email; private String phone; @Column(length=2000) private String address; private String website; private String logoUrl; private String sealUrl; private String signatureUrl;
  public String getName(){return name;} public void setName(String v){name=v;} public String getEmail(){return email;} public void setEmail(String v){email=v;} public String getPhone(){return phone;} public void setPhone(String v){phone=v;} public String getAddress(){return address;} public void setAddress(String v){address=v;} public String getWebsite(){return website;} public void setWebsite(String v){website=v;} public String getLogoUrl(){return logoUrl;} public void setLogoUrl(String v){logoUrl=v;} public String getSealUrl(){return sealUrl;} public void setSealUrl(String v){sealUrl=v;} public String getSignatureUrl(){return signatureUrl;} public void setSignatureUrl(String v){signatureUrl=v;}
}
