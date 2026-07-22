package com.samudhra.certificates.config;

import com.samudhra.certificates.repository.UserRepository;
import com.samudhra.certificates.repository.AdminRepository;
import com.samudhra.certificates.security.JwtAuthenticationFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public UserDetailsService users(UserRepository repository, AdminRepository adminRepository) {
        return email -> adminRepository.findByEmail(email)
                .map(admin -> User.withUsername(admin.getEmail())
                        .password(admin.getPassword())
                        .roles("ADMIN")
                        .build())
                .or(() -> repository.findByEmail(email)
                        .map(u -> User.withUsername(u.getEmail())
                                .password(u.getPasswordHash())
                                .roles(u.getRole())
                                .build()))
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));
    }

    @Bean
    public SecurityFilterChain security(HttpSecurity http, JwtAuthenticationFilter jwt) throws Exception {
        return http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> {})
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .anyRequest().permitAll()
                )
                .addFilterBefore(jwt, UsernamePasswordAuthenticationFilter.class)
                .build();
    }
}
