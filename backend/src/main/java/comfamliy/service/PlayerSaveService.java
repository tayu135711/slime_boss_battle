package comfamliy.service;

import comfamliy.entity.PlayerSave;
import comfamliy.repository.PlayerSaveRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class PlayerSaveService {

    private final PlayerSaveRepository repository;

    public PlayerSave save(PlayerSave playerSave) {
        playerSave.setUpdatedAt(LocalDateTime.now());
        return repository.save(playerSave);
    }

    public Optional<PlayerSave> load(String playerId) {
        return repository.findById(playerId);
    }

    public void delete(String playerId) {
        repository.deleteById(playerId);
    }
}