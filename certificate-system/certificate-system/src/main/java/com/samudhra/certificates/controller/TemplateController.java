package com.samudhra.certificates.controller;

import com.samudhra.certificates.dto.ApiResponse;
import com.samudhra.certificates.entity.*;
import com.samudhra.certificates.repository.TemplateRepository;
import com.samudhra.certificates.repository.CertificateRepository;
import com.samudhra.certificates.service.CurrentUserService;
import org.springframework.data.domain.*;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/templates")
public class TemplateController {
    private final TemplateRepository templates;
    private final CertificateRepository certificates;
    private final CurrentUserService current;
    private final com.fasterxml.jackson.databind.ObjectMapper json;

    public TemplateController(TemplateRepository t, CertificateRepository certs, CurrentUserService c, com.fasterxml.jackson.databind.ObjectMapper j) {
        templates = t;
        certificates = certs;
        current = c;
        json = j;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ApiResponse<?> list(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "50") int size) {
        return ApiResponse.ok(templates.findByOrganizationId(current.organization().getId(), PageRequest.of(page, Math.min(size, 100), Sort.by("updatedAt").descending())).map(this::view));
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public ApiResponse<?> get(@PathVariable String id) {
        return ApiResponse.ok(view(owned(id)));
    }

    @PostMapping
    @Transactional
    public ApiResponse<?> create(@RequestBody Map<String, Object> body) {
        Template t = new Template();
        t.setOrganization(current.organization());
        apply(t, body);
        return ApiResponse.ok(view(templates.save(t)));
    }

    @PutMapping("/{id}")
    @Transactional
    public ApiResponse<?> update(@PathVariable String id, @RequestBody Map<String, Object> body) {
        Template t = owned(id);
        apply(t, body);
        return ApiResponse.ok(view(templates.save(t)));
    }

    @PostMapping("/{id}/publish")
    @Transactional
    public ApiResponse<?> publish(@PathVariable String id) {
        Template t = owned(id);
        t.setStatus("ACTIVE");
        return ApiResponse.ok(view(templates.save(t)));
    }

    @PostMapping("/{id}/duplicate")
    @Transactional
    public ApiResponse<?> duplicate(@PathVariable String id) {
        Template source = owned(id);
        Template copy = new Template();
        copy.setOrganization(source.getOrganization());
        copy.setName(source.getName() + " (Copy)");
        copy.setCategory(source.getCategory());
        copy.setDescription(source.getDescription());
        copy.setOrientation(source.getOrientation());
        copy.setPaperSize(source.getPaperSize());
        copy.setStatus("DRAFT");
        copy.setBackgroundJson(source.getBackgroundJson());
        for (TemplateElement e : source.getElements()) {
            TemplateElement n = new TemplateElement();
            n.setTemplate(copy);
            n.setElementId(UUID.randomUUID().toString());
            n.setType(e.getType());
            n.setRole(e.getRole());
            n.setContent(e.getContent());
            n.setAssetUrl(e.getAssetUrl());
            n.setX(e.getX());
            n.setY(e.getY());
            n.setWidth(e.getWidth());
            n.setHeight(e.getHeight());
            n.setScaleX(e.getScaleX());
            n.setScaleY(e.getScaleY());
            n.setAngle(e.getAngle());
            n.setOpacity(e.getOpacity());
            n.setZIndex(e.getZIndex());
            n.setLocked(e.isLocked());
            n.setVisible(e.isVisible());
            n.setStyleJson(e.getStyleJson());
            copy.getElements().add(n);
        }
        return ApiResponse.ok(view(templates.save(copy)));
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> delete(@PathVariable String id) {
        Template t = owned(id);
        List<Certificate> certList = certificates.findByTemplateId(t.getId());
        for (Certificate c : certList) {
            c.setTemplate(null);
            certificates.save(c);
        }
        templates.delete(t);
        return ResponseEntity.noContent().build();
    }

    private Template owned(String id) {
        Template t = templates.findById(id).orElseThrow(() -> new NoSuchElementException("Template not found"));
        if (!t.getOrganization().getId().equals(current.organization().getId()))
            throw new NoSuchElementException("Template not found");
        return t;
    }

    @SuppressWarnings("unchecked")
    private void apply(Template t, Map<String, Object> b) {
        t.setName((String) b.getOrDefault("name", t.getName()));
        t.setCategory((String) b.getOrDefault("category", t.getCategory()));
        t.setDescription((String) b.getOrDefault("description", t.getDescription()));
        t.setOrientation((String) b.getOrDefault("orientation", t.getOrientation()));
        t.setPaperSize((String) b.getOrDefault("paperSize", t.getPaperSize()));
        t.setStatus((String) b.getOrDefault("status", t.getStatus()));
        if (b.containsKey("bgConfig")) {
            try {
                t.setBackgroundJson(json.writeValueAsString(b.get("bgConfig")));
            } catch (Exception e) {
                t.setBackgroundJson("{}");
            }
        }
        if (b.containsKey("elements")) {
            t.getElements().clear();
            for (Map<String, Object> e : (List<Map<String, Object>>) b.get("elements")) {
                TemplateElement x = new TemplateElement();
                x.setTemplate(t);
                x.setElementId(String.valueOf(e.get("id")));
                x.setType(String.valueOf(e.getOrDefault("type", "text")));
                x.setRole((String) e.get("role"));
                x.setContent((String) e.get("content"));
                x.setAssetUrl((String) e.get("src"));
                x.setX(number(e.get("x")));
                x.setY(number(e.get("y")));
                x.setWidth(number(e.get("width")));
                x.setHeight(number(e.get("height")));
                x.setScaleX(numberOr(e.get("scaleX"), 1));
                x.setScaleY(numberOr(e.get("scaleY"), 1));
                x.setAngle(numberOr(e.get("rotation"), 0));
                x.setOpacity(numberOr(e.get("opacity"), 1));
                x.setZIndex(e.get("zIndex") instanceof Number n ? n.intValue() : 1);
                x.setLocked(Boolean.TRUE.equals(e.get("locked")));
                x.setVisible(!Boolean.FALSE.equals(e.get("visible")));
                try {
                    x.setStyleJson(json.writeValueAsString(e));
                } catch (Exception ex) {
                    x.setStyleJson("{}");
                }
                t.getElements().add(x);
            }
        }
    }

    private Double number(Object v) {
        return v instanceof Number n ? n.doubleValue() : null;
    }

    private Double numberOr(Object v, double d) {
        Double n = number(v);
        return n == null ? d : n;
    }

    private Map<String, Object> view(Template t) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", t.getId());
        result.put("name", t.getName());
        result.put("category", Optional.ofNullable(t.getCategory()).orElse(""));
        result.put("description", Optional.ofNullable(t.getDescription()).orElse(""));
        result.put("orientation", Optional.ofNullable(t.getOrientation()).orElse("Landscape"));
        result.put("paperSize", Optional.ofNullable(t.getPaperSize()).orElse("A4"));
        result.put("status", t.getStatus());
        try {
            result.put("bgConfig", t.getBackgroundJson() != null ? json.readValue(t.getBackgroundJson(), Map.class) : Map.of());
        } catch (Exception e) {
            result.put("bgConfig", Map.of());
        }
        result.put("elements", t.getElements().stream().map(e -> {
            Map<String, Object> x = new LinkedHashMap<>();
            if (e.getStyleJson() != null && !e.getStyleJson().isEmpty()) {
                try {
                    Map<String, Object> style = json.readValue(e.getStyleJson(), Map.class);
                    x.putAll(style);
                } catch (Exception ex) {
                    // Ignore
                }
            }
            x.put("id", e.getElementId());
            x.put("type", e.getType());
            x.put("role", Optional.ofNullable(e.getRole()).orElse(""));
            x.put("content", Optional.ofNullable(e.getContent()).orElse(""));
            x.put("src", Optional.ofNullable(e.getAssetUrl()).orElse(""));
            x.put("x", Optional.ofNullable(e.getX()).orElse(0d));
            x.put("y", Optional.ofNullable(e.getY()).orElse(0d));
            x.put("width", Optional.ofNullable(e.getWidth()).orElse(0d));
            x.put("height", Optional.ofNullable(e.getHeight()).orElse(0d));
            x.put("scaleX", e.getScaleX());
            x.put("scaleY", e.getScaleY());
            x.put("rotation", e.getAngle());
            x.put("opacity", e.getOpacity());
            x.put("zIndex", e.getZIndex());
            x.put("locked", e.isLocked());
            x.put("visible", e.isVisible());
            return x;
        }).toList());
        return result;
    }
}
