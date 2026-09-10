package comfamliy.service;

import comfamliy.controller.SaveSessionResponse;
import comfamliy.entity.PlayerSave;
import comfamliy.repository.PlayerSaveRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class PlayerSaveService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final PlayerSaveRepository repository;

    public SaveSessionResponse createSession() {
        return new SaveSessionResponse(randomValue(18), randomValue(32));
    }

    public PlayerSave save(PlayerSave playerSave, String token) {
        Optional<PlayerSave> existing = repository.findById(playerSave.getPlayerId());
        if (existing.isPresent()) {
            if (!matches(token, existing.get().getTokenHash())) {
                throw new SecurityException("Invalid player token");
            }
            playerSave.setTokenHash(existing.get().getTokenHash());
        } else {
            if (token == null || token.isBlank()) {
                throw new SecurityException("Missing player token");
            }
            playerSave.setTokenHash(hash(token));
        }
        validateProgress(playerSave);
        playerSave.setUpdatedAt(LocalDateTime.now());
        return repository.save(playerSave);
    }

    public boolean isAuthorized(String playerId, String token) {
        return repository.findById(playerId)
                .map(save -> matches(token, save.getTokenHash()))
                .orElse(false);
    }

    public Optional<PlayerSave> load(String playerId) {
        return repository.findById(playerId);
    }

    public void delete(String playerId) {
        repository.deleteById(playerId);
    }

    private void validateProgress(PlayerSave playerSave) {
        if (playerSave.getStageIndex() > 13 || playerSave.getUnlockedStages() > 14
                || playerSave.getTotalClears() > 100000) {
            throw new IllegalArgumentException("Invalid progress values");
        }
    }

    private static String randomValue(int bytes) {
        byte[] value = new byte[bytes];
        RANDOM.nextBytes(value);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(value);
    }

    private static String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
        } catch (Exception e) {
            throw new IllegalStateException("Unable to hash player token", e);
        }
    }

    private static boolean matches(String token, String tokenHash) {
        return token != null && tokenHash != null
                && MessageDigest.isEqual(hash(token).getBytes(StandardCharsets.UTF_8),
                        tokenHash.getBytes(StandardCharsets.UTF_8));
    }
}