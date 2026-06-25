package comfamliy.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import comfamliy.entity.PlayerSave;
import comfamliy.service.PlayerSaveService;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/save")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class PlayerSaveController {

    private final PlayerSaveService service;

    // セーブ
    @PostMapping
    public ResponseEntity<PlayerSave> save(@RequestBody PlayerSave playerSave) {
        return ResponseEntity.ok(service.save(playerSave));
    }

    // ロード
    @GetMapping("/{playerId}")
    public ResponseEntity<PlayerSave> load(@PathVariable String playerId) {
        return service.load(playerId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // 削除
    @DeleteMapping("/{playerId}")
    public ResponseEntity<Void> delete(@PathVariable String playerId) {
        service.delete(playerId);
        return ResponseEntity.noContent().build();
    }
}