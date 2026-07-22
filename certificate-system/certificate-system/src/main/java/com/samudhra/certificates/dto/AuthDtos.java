package com.samudhra.certificates.dto;
import jakarta.validation.constraints.*;
public final class AuthDtos { private AuthDtos(){} public record LoginRequest(@NotBlank @Email String email,@NotBlank String password){} public record LoginResponse(String token,String id,String name,String email,String role){} }
