package com.samudhra.certificates.controller;

import com.samudhra.certificates.dto.ApiResponse;
import com.samudhra.certificates.entity.Admin;
import com.samudhra.certificates.entity.User;
import com.samudhra.certificates.repository.AdminRepository;
import com.samudhra.certificates.repository.UserRepository;
import com.samudhra.certificates.security.JwtService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
public class UserController {
    private final UserRepository userRepository;
    private final AdminRepository adminRepository;
    private final PasswordEncoder encoder;
    private final JwtService jwt;

    public UserController(UserRepository u, AdminRepository a, PasswordEncoder e, JwtService j) {
        this.userRepository = u;
        this.adminRepository = a;
        this.encoder = e;
        this.jwt = j;
    }

    public record ProfileUpdateRequest(
        String name,
        String email,
        String currentPassword,
        String newPassword
    ) {}

    public record ProfileUpdateResponse(
        String token,
        String id,
        String name,
        String email
    ) {}

    @PutMapping("/profile")
    public ResponseEntity<ApiResponse<ProfileUpdateResponse>> updateProfile(@RequestBody ProfileUpdateRequest request) {
        String currentEmail = SecurityContextHolder.getContext().getAuthentication().getName();

        Admin admin = adminRepository.findByEmail(currentEmail).orElse(null);
        User user = userRepository.findByEmail(currentEmail).orElse(null);

        if (admin == null || user == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.error("Authenticated administrator not found"));
        }

        // Validate required fields
        if (request.name() == null || request.name().isBlank()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(ApiResponse.error("Name is required"));
        }
        if (request.email() == null || request.email().isBlank()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(ApiResponse.error("Email is required"));
        }

        // Check if email is being changed and is already taken
        if (!request.email().equalsIgnoreCase(currentEmail)) {
            if (adminRepository.findByEmail(request.email()).isPresent() || 
                userRepository.findByEmail(request.email()).isPresent()) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                        .body(ApiResponse.error("Email is already in use by another account"));
            }
        }

        // If a new password is entered, verify current password and hash new password
        if (request.newPassword() != null && !request.newPassword().isBlank()) {
            if (request.currentPassword() == null || request.currentPassword().isBlank()) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(ApiResponse.error("Current password is required to change password"));
            }
            if (!encoder.matches(request.currentPassword(), admin.getPassword())) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(ApiResponse.error("Incorrect current password"));
            }
            String hashed = encoder.encode(request.newPassword());
            admin.setPassword(hashed);
            user.setPasswordHash(hashed);
        }

        // Update fields
        admin.setName(request.name());
        admin.setEmail(request.email());

        user.setName(request.name());
        user.setEmail(request.email());

        adminRepository.save(admin);
        userRepository.save(user);

        // Generate updated JWT token
        String token = jwt.issue(admin.getEmail(), "ADMIN");

        ProfileUpdateResponse responseData = new ProfileUpdateResponse(
                token,
                user.getId(),
                admin.getName(),
                admin.getEmail()
        );

        return ResponseEntity.ok(ApiResponse.ok(responseData));
    }
}
