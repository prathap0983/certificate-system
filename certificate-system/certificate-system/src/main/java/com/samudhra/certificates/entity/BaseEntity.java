package com.samudhra.certificates.entity;

import jakarta.persistence.*;
import java.time.Instant;

@MappedSuperclass
public abstract class BaseEntity {
  @Id @GeneratedValue(strategy = GenerationType.UUID) private String id;
  @Column(nullable = false, updatable = false) private Instant createdAt;
  @Column(nullable = false) private Instant updatedAt;
  @PrePersist void created() { createdAt = updatedAt = Instant.now(); }
  @PreUpdate void updated() { updatedAt = Instant.now(); }
  public String getId() { return id; } public Instant getCreatedAt() { return createdAt; } public Instant getUpdatedAt() { return updatedAt; }
}
