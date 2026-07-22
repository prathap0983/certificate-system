package com.samudhra.certificates.security;
import io.jsonwebtoken.*; import io.jsonwebtoken.security.Keys; import org.springframework.beans.factory.annotation.Value; import org.springframework.security.core.userdetails.UserDetails; import org.springframework.stereotype.Service; import java.nio.charset.StandardCharsets; import java.util.*;
@Service public class JwtService {
  private final String secret; private final long expiration;
  public JwtService(@Value("${app.jwt-secret}") String secret,@Value("${app.jwt-expiration-ms}") long expiration){this.secret=secret;this.expiration=expiration;}
  public String issue(String email,String role){return Jwts.builder().subject(email).claim("role",role).issuedAt(new Date()).expiration(new Date(System.currentTimeMillis()+expiration)).signWith(Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8))).compact();}
  public String email(String token){return Jwts.parser().verifyWith(Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8))).build().parseSignedClaims(token).getPayload().getSubject();}
  public boolean valid(String token,UserDetails user){try{return email(token).equals(user.getUsername());}catch(JwtException e){return false;}}
}
