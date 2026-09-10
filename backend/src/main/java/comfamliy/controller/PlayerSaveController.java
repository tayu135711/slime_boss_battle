package comfamliy.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import jakarta.validation.Valid;

import comfamliy.entity.PlayerSave;
import comfamliy.service.PlayerSaveService;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/save")
@CrossOrigin(origins = "${FRONTEND_ORIGIN:http://localhost:5500}")
@RequiredArgsConstructor
public class PlayerSaveController {

    private final PlayerSaveService service;

    // セーブ
    @PostMapping("/session")
    public SaveSessionResponse createSession() {
        return service.createSession();
    }

    @PostMapping
    public ResponseEntity<PlayerSave> save(
            @RequestHeader("X-Player-Token") String token,
            @Valid @RequestBody PlayerSave playerSave) {
        try {
            return ResponseEntity.ok(service.save(playerSave, token));
        } catch (SecurityException e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid player token", e);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid save data", e);
        }
    }

    // ロード
    @GetMapping("/{playerId}")
    public ResponseEntity<PlayerSave> load(
            @PathVariable String playerId,
            @RequestHeader("X-Player-Token") String token) {
        if (!service.isAuthorized(playerId, token)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid player token");
        }
        return service.load(playerId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // 削除
    @DeleteMapping("/{playerId}")
    public ResponseEntity<Void> delete(
            @PathVariable String playerId,
            @RequestHeader("X-Player-Token") String token) {
        if (!service.isAuthorized(playerId, token)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid player token");
        }
        service.delete(playerId);
        return ResponseEntity.noContent().build();
    }
}